from flask import Flask, request, jsonify
import os
import re
import sys
import pandas as pd
import numpy as np
import datetime

# Ensure local module imports work regardless of how the service is started.
sys.path.insert(0, os.path.dirname(__file__))

# Import training datasets and model classes
from data import EXPENSE_TRAINING_DATA, INTENT_TRAINING_DATA
from expense_model import ExpenseCategoryModel
from intent_model import FinanceIntentModel
from forecast_model import BudgetForecastModel
from health_model import FinancialHealthModel
from savings_model import SavingsRecommendationModel
from anomaly_model import SpendingAnomalyModel

app = Flask(__name__)

# ----------------------------------------------------
# 1. TRAIN MACHINE LEARNING MODELS ON STARTUP
# ----------------------------------------------------

print("Initializing local ML service models...")

expense_model = ExpenseCategoryModel(min_confidence=0.6)
expense_model.train()

intent_model = FinanceIntentModel(min_confidence=0.6)
intent_model.train()

forecast_model = BudgetForecastModel()

health_model = FinancialHealthModel()
health_model.train([
    {"income": 4000, "expense": 2500, "balance": 1500, "debt_ratio": 0.10, "utilization": 0.63, "transaction_count": 45, "forecasted_spending": 2500, "top_category": "food", "health_score": 75},
    {"income": 6500, "expense": 3600, "balance": 2900, "debt_ratio": 0.08, "utilization": 0.55, "transaction_count": 62, "forecasted_spending": 3600, "top_category": "rent", "health_score": 82},
    {"income": 5200, "expense": 4300, "balance": 900, "debt_ratio": 0.22, "utilization": 0.83, "transaction_count": 58, "forecasted_spending": 4300, "top_category": "utilities", "health_score": 61},
    {"income": 4800, "expense": 3000, "balance": 1800, "debt_ratio": 0.12, "utilization": 0.63, "transaction_count": 53, "forecasted_spending": 3000, "top_category": "transport", "health_score": 78},
    {"income": 7200, "expense": 5200, "balance": 2000, "debt_ratio": 0.16, "utilization": 0.72, "transaction_count": 68, "forecasted_spending": 5200, "top_category": "shopping", "health_score": 70},
    {"income": 5800, "expense": 3800, "balance": 2000, "debt_ratio": 0.09, "utilization": 0.66, "transaction_count": 40, "forecasted_spending": 3800, "top_category": "subscriptions", "health_score": 79},
])

savings_model = SavingsRecommendationModel()
savings_model.train([
    {"income": 4500, "expense": 2700, "balance": 1800, "spending_trend": 0.05, "transaction_count": 42, "ideal_savings": 1200},
    {"income": 5900, "expense": 3800, "balance": 2100, "spending_trend": 0.08, "transaction_count": 53, "ideal_savings": 1500},
    {"income": 6200, "expense": 4600, "balance": 1600, "spending_trend": 0.12, "transaction_count": 55, "ideal_savings": 1400},
    {"income": 5200, "expense": 3200, "balance": 2000, "spending_trend": 0.02, "transaction_count": 48, "ideal_savings": 1400},
    {"income": 7100, "expense": 4300, "balance": 2800, "spending_trend": 0.07, "transaction_count": 67, "ideal_savings": 1700},
    {"income": 3300, "expense": 2300, "balance": 1000, "spending_trend": 0.15, "transaction_count": 36, "ideal_savings": 900},
])

anomaly_model = SpendingAnomalyModel()

print("Local ML service models initialized.")

# ----------------------------------------------------
# 2. HELPER FUNCTIONS
# ----------------------------------------------------

def get_monthly_forecast_for_category(category_df):
    """
    Given a DataFrame of transactions for a category, groups them by month
    and uses Linear Regression to forecast next month's spending.
    """
    if len(category_df) == 0:
        return 0.0

    # Parse and group by month
    category_df = category_df.copy()
    category_df['date'] = pd.to_datetime(category_df['date'])
    category_df['year_month'] = category_df['date'].dt.to_period('M')
    
    monthly_sums = category_df.groupby('year_month')['amount'].sum().reset_index()
    monthly_sums = monthly_sums.sort_values('year_month')
    
    # If we have at least 2 distinct months, perform Linear Regression
    n_months = len(monthly_sums)
    if n_months >= 2:
        X = np.arange(n_months).reshape(-1, 1)  # Month indexes: 0, 1, 2...
        y = monthly_sums['amount'].values
        
        from sklearn.linear_model import LinearRegression
        reg = LinearRegression()
        reg.fit(X, y)
        
        # Forecast the next month (index = n_months)
        forecast = reg.predict(np.array([[n_months]]))[0]
        # Avoid negative forecast predictions
        return float(max(forecast, 0.0))
    elif n_months == 1:
        # If only 1 month, return that month's spending
        return float(monthly_sums['amount'].iloc[0])
    
    return 0.0

def get_risk_level(utilization):
    if utilization >= 1:
        return "critical"
    if utilization >= 0.85:
        return "high"
    if utilization >= 0.65:
        return "medium"
    if utilization >= 0.40:
        return "low"
    return "excellent"

def get_limit_multiplier(risk_level):
    if risk_level == "critical":
        return 0.70
    if risk_level == "high":
        return 0.80
    if risk_level == "medium":
        return 0.88
    return 0.95

# ----------------------------------------------------
# 3. ENDPOINTS
# ----------------------------------------------------

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "expense-tracker-ml-service",
        "timestamp": datetime.datetime.now().isoformat()
    }), 200

@app.route('/categorize', methods=['POST'])
def categorize():
    """
    POST /categorize
    Input JSON: { "title": "...", "description": "...", "amount": 0.0 }
    Output JSON: { "category": "...", "confidence": 0.0-1.0, "reason": "..." }
    """
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    
    text = f"{title} {description}".lower()
    
    if not text.strip():
        return jsonify({
            "category": "other",
            "confidence": 0.5,
            "reason": "Empty inputs, using other category fallback."
        })
    
    # Run prediction
    pred_category, confidence = expense_model.predict(text)
    confidence = round(confidence, 2)
    reason = f"Classified as '{pred_category}' with {int(confidence * 100)}% confidence using a local SVM-based expense model."

    if pred_category == 'other' and confidence < 0.65:
        reason = "Expense description was not strongly matched to a category, so fallback to an 'other' classification."

    return jsonify({
        "category": pred_category,
        "confidence": confidence,
        "reason": reason
    })

@app.route('/forecast-budget', methods=['POST'])
def forecast_budget():
    """
    POST /forecast-budget
    Input JSON: { "incomes": [...], "expenses": [...], "currency": "..." }
    Output JSON:
    {
      "healthScore": 0-100,
      "safeToSpend": float,
      "categoryBudgets": [{"category": "...", "suggestedLimit": float}],
      "recommendations": ["..."],
      "message": "...",
      "followUps": ["..."]
    }
    """
    data = request.get_json() or {}
    incomes_raw = data.get('incomes', [])
    expenses_raw = data.get('expenses', [])
    currency = data.get('currency', 'USD')
    
    # Load into Pandas DataFrames
    incomes_df = pd.DataFrame(incomes_raw)
    expenses_df = pd.DataFrame(expenses_raw)
    
    # Fallback to defaults if no records exist
    if incomes_df.empty:
        monthly_income = 0.0
    else:
        # Group income by month and use the average or the last month's income
        incomes_df['date'] = pd.to_datetime(incomes_df['date'])
        incomes_df['year_month'] = incomes_df['date'].dt.to_period('M')
        monthly_income = float(incomes_df.groupby('year_month')['amount'].sum().iloc[-1])
        
    if expenses_df.empty:
        # Default empty output response
        return jsonify({
            "healthScore": 100,
            "safeToSpend": float(monthly_income),
            "categoryBudgets": [],
            "recommendations": ["Add some expenses to get personalized ML-driven budgets!"],
            "message": f"Welcome! We're ready to forecast your budgets. Your monthly income is calculated as {currency} {monthly_income:.2f}.",
            "followUps": ["How can I set up my first category budget?", "Tell me about 50/30/20 saving plans"],
            "riskLevel": "excellent"
        })
        
    forecast_model.train(expenses_df)
    forecasted_expense = forecast_model.predict_next_month(expenses_df)

    # Fallback to recent month totals if the model is not yet able to forecast reliably.
    if forecasted_expense <= 0.0:
        expenses_df['date'] = pd.to_datetime(expenses_df['date'], errors='coerce')
        expenses_df['year_month'] = expenses_df['date'].dt.to_period('M')
        if not expenses_df.empty and not expenses_df['year_month'].isna().all():
            forecasted_expense = float(expenses_df.groupby('year_month')['amount'].sum().iloc[-1])

    expenses_df['category'] = expenses_df['category'].fillna('other')
    categories = expenses_df['category'].unique()
    category_forecasts = []
    total_forecasted_expense = 0.0

    for category in categories:
        cat_df = expenses_df[expenses_df['category'] == category]
        forecasted_spend = float(max(forecast_model.predict_next_month(cat_df), 0.0)) if len(cat_df) >= 2 else float(cat_df['amount'].sum())

        category_forecasts.append({
            "category": str(category),
            "forecastedSpend": forecasted_spend
        })
        total_forecasted_expense += forecasted_spend

    # Use the overall forecast when available, otherwise derive from category totals.
    if total_forecasted_expense <= 0.0:
        total_forecasted_expense = float(max(forecasted_expense, 0.0))

    if monthly_income <= 0.0:
        safe_to_spend = 0.0
    else:
        safe_to_spend = max(round(monthly_income - total_forecasted_expense, 2), 0.0)

    utilization = total_forecasted_expense / monthly_income if monthly_income > 0 else 0.0
    risk_level = get_risk_level(utilization)
    limit_multiplier = get_limit_multiplier(risk_level)

    transaction_count = len(expenses_df)
    category_totals = expenses_df.groupby('category')['amount'].sum().reset_index().sort_values('amount', ascending=False)
    top_category = category_totals['category'].iloc[0] if not category_totals.empty else 'other'
    spending_trend = 0.0
    if len(expenses_df) >= 2:
        monthly_counts = expenses_df.groupby(expenses_df['date'].dt.to_period('M'))['amount'].sum()
        spending_trend = float(monthly_counts.pct_change().fillna(0).iloc[-1] if len(monthly_counts) > 1 else 0.0)

    health_context = {
        'income': monthly_income,
        'expense': total_forecasted_expense,
        'balance': max(monthly_income - total_forecasted_expense, 0.0),
        'debt_ratio': min(1.0, transaction_count / max(transaction_count + 10, 1) * 0.25),
        'utilization': utilization,
        'transaction_count': transaction_count,
        'forecasted_spending': total_forecasted_expense,
        'top_category': top_category
    }
    health_score = int(round(health_model.predict(health_context)))

    savings_context = {
        'income': monthly_income,
        'expense': total_forecasted_expense,
        'balance': max(monthly_income - total_forecasted_expense, 0.0),
        'expense_ratio': total_forecasted_expense / max(monthly_income, 1.0),
        'balance_ratio': max(monthly_income - total_forecasted_expense, 0.0) / max(monthly_income, 1.0),
        'spending_trend': spending_trend,
        'trend_3m': spending_trend,
        'transaction_count': transaction_count
    }
    suggested_savings = float(round(savings_model.predict(savings_context), 2))

    category_budgets = []
    for item in category_forecasts:
        suggested_limit = round(item["forecastedSpend"] * limit_multiplier, 2)
        category_budgets.append({
            "category": item["category"],
            "suggestedLimit": float(max(suggested_limit, 0.0))
        })
    category_budgets = sorted(category_budgets, key=lambda x: x['suggestedLimit'], reverse=True)

    recommendations = []
    if risk_level == "critical":
        recommendations.append(f"Critical risk: forecasted spending is {int(utilization * 100)}% of income. Pause non-essential spending until cash flow improves.")
    elif risk_level == "high":
        recommendations.append(f"High risk: forecasted spending is {int(utilization * 100)}% of income. Reduce flexible categories by 15-20% to increase breathing room.")
    elif risk_level == "medium":
        recommendations.append(f"Medium risk: forecasted spending is {int(utilization * 100)}% of income. A focused cut in your top categories will improve your headroom.")
    elif risk_level == "low":
        recommendations.append(f"Low risk: forecasted spending is {int(utilization * 100)}% of income. Keep category limits active and protect savings.")
    else:
        recommendations.append(f"Excellent zone: forecasted spending is only {int(utilization * 100)}% of income, leaving strong room for savings.")

    if category_budgets:
        top_cat = category_budgets[0]
        cut_percent = 25 if risk_level == "critical" else 20 if risk_level == "high" else 12 if risk_level == "medium" else 8
        recommendations.append(f"Top driver: trimming {top_cat['category']} by {cut_percent}% could free about {currency} {round(top_cat['suggestedLimit'] * cut_percent / 100, 2)} next month.")

    recommendations.append(f"Aim to save around {currency} {suggested_savings:.2f} next month and keep a weekly spending review.")

    message = (
        f"Based on our local models, next month's projected spending is {currency} {total_forecasted_expense:.2f} versus {currency} {monthly_income:.2f} income. "
        f"Your safe-to-spend amount is {currency} {safe_to_spend:.2f}, estimated health score is {health_score}/100, and suggested monthly savings is {currency} {suggested_savings:.2f}."
    )

    follow_ups = [
        "How did the model calculate these recommended limits?",
        "Can you suggest a detailed saving roadmap?",
        "What happens to my forecast if my utilities expense increases?"
    ]

    return jsonify({
        "healthScore": health_score,
        "safeToSpend": safe_to_spend,
        "categoryBudgets": category_budgets,
        "recommendations": recommendations,
        "message": message,
        "followUps": follow_ups,
        "riskLevel": risk_level
    })

@app.route('/chat-advice', methods=['POST'])
def chat_advice():
    """
    POST /chat-advice
    Input JSON: { "question": "...", "context": {...} }
    Output JSON: { "answer": "...", "followUps": [...] }
    """
    try:
        data = request.get_json() or {}
        question = data.get('question', '').strip()
        context = data.get('context', {})

        if not question:
            return jsonify({
                "answer": "Hello! Ask me any budgeting or financial planning question, and I'll analyze it locally.",
                "followUps": []
            })

        # Predict Chat Intent
        intent, intent_confidence = intent_model.predict(question)
        text = question.lower()

        # Fetch Context Data
        income = float(context.get('totalIncome', 0.0))
        expense = float(context.get('totalExpense', 0.0))
        balance = float(context.get('balance', income - expense))
        top_categories = context.get('topCategories', [])

        health_score = int(round(health_model.predict({
            'income': income,
            'expense': expense,
            'balance': balance,
            'debt_ratio': 0.0,
            'utilization': expense / income if income > 0 else 0.0,
            'transaction_count': len(top_categories),
            'forecasted_spending': expense,
            'top_category': top_categories[0]['category'] if top_categories else 'other'
        })))

        savings_suggestion = round(savings_model.predict({
            'income': income,
            'expense': expense,
            'balance': balance,
            'expense_ratio': expense / income if income > 0 else 0.0,
            'balance_ratio': balance / income if income > 0 else 0.0,
            'spending_trend': 0.0,
            'trend_3m': 0.0,
            'transaction_count': len(top_categories)
        }), 2)

        # Keyword-based intent hints to broaden coverage
        wants_debt = bool(re.search(r'\b(debt|loan|emi|credit card|borrow|pay off|interest)\b', text))
        wants_investment = bool(re.search(r'\b(invest|investment|mutual fund|stock|portfolio|return|capital gain|sip|equity)\b', text))
        wants_emergency = bool(re.search(r'\b(emergency fund|rainy day|unexpected expense|buffer|cash reserve|contingency)\b', text))
        wants_tax = bool(re.search(r'\b(tax|income tax|deduction|gst|capital gains|audit|file my tax)\b', text))
        wants_credit = bool(re.search(r'\b(credit score|credit report|score|borrower|credit utilization|credit limit)\b', text))
        wants_bills = bool(re.search(r'\b(bill|utility|rent|electricity|internet|subscription|monthly payment|invoice)\b', text))
        wants_salary = bool(re.search(r'\b(salary|income growth|raise|pay increase|earn more|side income)\b', text))
        wants_forecast = bool(re.search(r'\b(forecast|project|predict|estimate)\b', text))
        wants_anomaly = bool(re.search(r'\b(anomaly|irregular|unexpected|outlier)\b', text))

        top_cat_str = ''
        if len(top_categories) > 0:
            tc = top_categories[0]
            top_cat_str = f"Your largest expense category is **{tc['category']}** with **{tc['amount']}** spent. "

        if wants_debt:
            answer = (
                f"🧠 **[Local ML Intent: Debt Strategy]**\n\n"
                f"You asked about debt management, so here is a clear, step-by-step approach:\n"
                f"1. List each debt balance, interest rate, and minimum payment.\n"
                f"2. Pay at least the minimum due on all accounts, then apply extra funds to the highest-interest balance first.\n"
                f"3. Avoid adding new unsecured debt while you reduce existing balances.\n"
                f"4. If your debt payments are more than 20% of income, consider a consolidation plan or negotiating lower rates.\n"
                f"5. Track progress weekly and celebrate each account that reaches zero."
            )
            follow_ups = [
                'How do I choose between snowball and avalanche payoff?',
                'What if I can only pay minimums this month?',
                'How much debt payment is healthy for my income?'
            ]

        elif wants_investment:
            answer = (
                f"🧠 **[Local ML Intent: Investment Guidance]**\n\n"
                f"Investing wisely begins with a stable financial foundation. Follow these points:\n"
                f"1. Make sure you have 3-6 months of expenses in a liquid emergency fund before taking risk.\n"
                f"2. Define your goal: short-term (0-3 years), medium-term (3-7 years), or long-term (7+ years).\n"
                f"3. Diversify: consider a mix of index funds, ETFs, and low-cost mutual funds rather than single stocks.\n"
                f"4. Start small and contribute consistently, for example via SIP or automated monthly investments.\n"
                f"5. Review your portfolio annually and rebalance to stay aligned with your goals."
            )
            follow_ups = [
                'What is the simplest investment plan I can start with?',
                'Should I prioritize debt or investment first?',
                'How much should I invest each month?'
            ]

        elif wants_emergency:
            answer = (
                f"🧠 **[Local ML Intent: Emergency Fund]**\n\n"
                f"A strong emergency fund is one of the best protections for your budget. Here is how to build it:\n"
                f"1. Calculate 3-6 months of essential living expenses, including rent, groceries, utilities, and loan payments.\n"
                f"2. Keep this money in a safe, liquid account, such as a savings account or liquid mutual fund.\n"
                f"3. Save a fixed amount every month until you reach the target. Even a small steady amount adds up quickly.\n"
                f"4. Use the fund only for true emergencies, not routine spending.\n"
                f"5. Once established, review it annually and increase it if your expenses rise."
            )
            follow_ups = [
                'How much should my emergency fund be?',
                'Where is the safest place to keep emergency cash?',
                'How do I protect my fund from inflation?'
            ]

        elif wants_tax:
            answer = (
                f"🧠 **[Local ML Intent: Tax Planning]**\n\n"
                f"Tax-smart planning can save you meaningful money each year. Follow these steps:\n"
                f"1. Track your income and all deductible expenses carefully.\n"
                f"2. Claim eligible deductions or exemptions under your local tax rules.\n"
                f"3. Use tax-saving investments or retirement accounts if available.\n"
                f"4. Keep documentation for all receipts and statements.\n"
                f"5. If your situation is complex, consult a qualified tax advisor before filing."
            )
            follow_ups = [
                'What documents do I need for tax filing?',
                'How can I reduce my taxable income legally?',
                'Should I use a tax preparer or file online?'
            ]

        elif wants_credit:
            answer = (
                f"🧠 **[Local ML Intent: Credit Score]**\n\n"
                f"Improving your credit score is a process of consistent, smart behavior. Start with these points:\n"
                f"1. Pay all bills on time — payment history is the strongest factor.\n"
                f"2. Keep your credit utilization low, ideally below 30% of your available limit.\n"
                f"3. Avoid opening too many new accounts in a short period.\n"
                f"4. Check your credit report regularly and correct any errors promptly.\n"
                f"5. Keep older accounts open if they have a positive history."
            )
            follow_ups = [
                'What is a good credit utilization ratio?',
                'How soon can I improve my credit score?',
                'What hurts a credit score the most?'
            ]

        elif wants_bills:
            answer = (
                f"🧠 **[Local ML Intent: Bill Management]**\n\n"
                f"Managing monthly bills well keeps your cash flow stable. Follow these steps:\n"
                f"1. List all recurring bills and note due dates for each.\n"
                f"2. Automate payments when possible to avoid late fees.\n"
                f"3. Review subscriptions and cancel any unused services.\n"
                f"4. Compare providers for utilities, internet, and insurance to find lower rates.\n"
                f"5. Treat your bills like planned expenses rather than surprises."
            )
            follow_ups = [
                'How do I organize recurring bills better?',
                'Should I pay bills weekly or monthly?',
                'How can I reduce my internet and utility costs?'
            ]

        elif wants_salary:
            answer = (
                f"🧠 **[Local ML Intent: Income Growth]**\n\n"
                f"Growing your income is often the fastest path to better financial health. Use this approach:\n"
                f"1. Review your current work income and identify opportunities for a raise or promotion.\n"
                f"2. Consider a side income or freelance work that fits your skills and schedule.\n"
                f"3. Keep your expenses steady while your income increases, so extra money builds savings.\n"
                f"4. Invest part of extra income into long-term savings or retirement.\n"
                f"5. Track your progress quarterly and adjust goals as needed."
            )
            follow_ups = [
                'How can I ask my manager for a raise?',
                'What are easy side income ideas?',
                'Should I increase savings when income grows?'
            ]

        elif wants_forecast or intent == 'forecast':
            forecast_amount = 0.0
            category_forecasts = []
            expenses_list = context.get('recentExpenses', [])

            if isinstance(expenses_list, list) and len(expenses_list) >= 2:
                expenses_df = pd.DataFrame(expenses_list)
                if 'date' in expenses_df.columns and 'amount' in expenses_df.columns:
                    if 'category' not in expenses_df.columns:
                        expenses_df['category'] = 'other'

                    forecast_model.train(expenses_df)
                    forecast_amount = float(max(forecast_model.predict_next_month(expenses_df), 0.0))

                if forecast_amount > 0.0:
                    top_categories = (
                        expenses_df['category'].fillna('other')
                        .value_counts()
                        .head(3)
                        .index.tolist()
                    )
                    for category in top_categories:
                        category_df = expenses_df[expenses_df['category'] == category]
                        if len(category_df) >= 2:
                            cat_forecast = float(max(forecast_model.predict_next_month(category_df), 0.0))
                        else:
                            cat_forecast = float(category_df['amount'].sum())
                        category_forecasts.append((category, cat_forecast))

            if forecast_amount > 0.0:
                safe_to_spend = float(max(income - forecast_amount, 0.0))
                answer = (
                    f"🧠 **[Local ML Intent: Forecasting]**\n\n"
                    f"I used your recent expense history to estimate next month's spending at **{forecast_amount:.2f}**.\n"
                    f"With your current income of **{income:.2f}**, that leaves about **{safe_to_spend:.2f}** available as a buffer.\n"
                    f"Keep an eye on your biggest categories and recurring payments to improve this forecast over time."
                )

                if category_forecasts:
                    category_lines = []
                    for category, amount in category_forecasts[:2]:
                        category_lines.append(f"- {category}: {amount:.2f}")
                    answer += "\n\nTop category forecasts:\n" + "\n".join(category_lines)
                    top_category, top_amount = category_forecasts[0]
                    if top_amount > 0:
                        potential_savings = round(top_amount * 0.10, 2)
                        answer += (
                            f"\n\nYour largest forecasted category is **{top_category}** at **{top_amount:.2f}**. "
                            f"A 10% reduction there could free about **{potential_savings:.2f}** next month."
                        )

                follow_ups = [
                    'What can I do to lower this next-month forecast?',
                    'Which categories should I watch most closely?',
                    'Can you give me a savings goal based on this forecast?'
                ]
            else:
                answer = (
                    f"🧠 **[Local ML Intent: Forecasting]**\n\n"
                    f"I need at least a couple of recent expenses with dates to generate a stronger forecast.\n"
                    f"Right now, I can still encourage you to track recurring bills and update your expense history regularly so predictions become more accurate."
                )
                follow_ups = [
                    'Add more expenses and ask again for a forecast',
                    'How many months of data do I need for a good forecast?',
                    'What should I record for the most accurate predictions?'
                ]

        elif wants_anomaly:
            anomalies = []
            expenses_list = context.get('recentExpenses', [])

            if isinstance(expenses_list, list) and len(expenses_list) >= 10:
                anomaly_model.train(expenses_list)
                anomalies = anomaly_model.detect_anomalies(expenses_list)

            if anomalies:
                anomaly_lines = []
                for anomaly in anomalies[:3]:
                    anomaly_lines.append(
                        f"- {anomaly['date']}: {anomaly['category']} {anomaly['amount']:.2f}"
                    )
                answer = (
                    f"🧠 **[Local ML Intent: Anomaly Detection]**\n\n"
                    f"I found {len(anomalies)} unusual transaction(s) in your recent expenses. Here are the first few:\n"
                    f"{chr(10).join(anomaly_lines)}\n\n"
                    f"These transactions differ from your normal spending patterns. Review them to confirm whether they were valid or accidental."
                )
                follow_ups = [
                    'Show me the next set of anomalies',
                    'How can I prevent accidental overspending?',
                    'What should I do if a transaction is fraudulent?'
                ]
            else:
                answer = (
                    f"🧠 **[Local ML Intent: Anomaly Detection]**\n\n"
                    f"I could not detect a strong anomaly in the recent expense history you provided."
                    f" Make sure you have at least 10 transactions and try again with a longer expense history."
                )
                follow_ups = [
                    'Add more transactions and try again',
                    'What counts as an anomaly in spending?',
                    'How many records does anomaly detection need?'
                ]

        elif intent == 'savings':
            savings_rate = round((max(balance, 0.0) / income) * 100, 1) if income > 0 else 0.0
            suggested_savings = round(income * 0.3, 2)
            answer = (
                f"🧠 **[Local ML Intent: Savings Plan]**\n\n"
                f"Your current savings rate is **{savings_rate}%** of your total income.\n"
                f"To create a strong savings habit:\n"
                f"1. Aim to save at least 30% of income, which is about **{suggested_savings}**.\n"
                f"2. Pay yourself first by moving savings into a separate account as soon as you receive income.\n"
                f"3. Build an emergency fund covering 3-6 months of essential expenses.\n"
                f"4. Review your budget monthly and increase savings gradually."
            )
            follow_ups = [
                'How to structure an emergency fund?',
                'What investments are suitable for a 30% savings tier?',
                'How can I improve my savings rate?' 
            ]

        elif intent == 'reduction':
            answer = (
                f"🧠 **[Local ML Intent: Expense Reduction]**\n\n"
                f"I recommend these practical cost-cutting steps:\n"
                f"1. Identify your top 3 spending categories and reduce each by at least 10%.\n"
                f"2. Cancel unused subscriptions and delay non-essential purchases.\n"
                f"3. Set a weekly discretionary budget and check it every few days.\n"
                f"4. Compare prices before buying and favor cheaper meal, transport, or shopping options.\n"
            )
            if top_cat_str:
                answer = answer.replace('I recommend', f"{top_cat_str}I recommend")
            follow_ups = [
                'Show me a list of my top 3 categories to optimize',
                'How to reduce food budget without dining compromises?',
                'Tell me more about auditing subscription expenses'
            ]

        elif intent == 'weekly':
            weekly_cap = round(income * 0.2 / 4, 2)
            answer = (
                f"🧠 **[Local ML Intent: Weekly Cap Allocation]**\n\n"
                f"A reliable weekly budget helps you stay on track without feeling overwhelmed:\n"
                f"- Needs: {round(income * 0.5 / 4, 2)} per week\n"
                f"- Savings: {round(income * 0.3 / 4, 2)} per week\n"
                f"- Wants: {weekly_cap} per week\n\n"
                f"Review this every Sunday and adjust for any unexpected expenses."
            )
            follow_ups = [
                'How to track weekly expenses efficiently?',
                'Should I carry over leftover weekly allowance?',
                'Tips for staying below my wants cap'
            ]

        elif intent == 'budget_planning':
            needs = round(income * 0.5, 2)
            wants = round(income * 0.2, 2)
            savings = round(income * 0.3, 2)
            answer = (
                f"🧠 **[Local ML Intent: Budget Planning & Split]**\n\n"
                f"Here is a detailed monthly budget framework for your income of **{income}**:\n"
                f"1. Allocate **{needs}** to essential needs (rent, groceries, utilities).\n"
                f"2. Reserve **{savings}** for savings and emergency preparation.\n"
                f"3. Use **{wants}** for discretionary spending, keeping your money balanced.\n"
                f"4. Track actual spending each week and compare it to this plan.\n"
                f"5. Adjust the percentages if your fixed costs or goals change."
            )
            follow_ups = [
                'What counts as a Need vs a Want?',
                'Can I try a 60/20/20 budget model?',
                'Help me categorize my utilities bills'
            ]

        else:
            expense_pct = round((expense / income) * 100, 1) if income > 0 else 0
            answer = (
                f"🧠 **[Local ML Intent: General Finance Summary]**\n\n"
                f"Here is a clear, pointwise summary of your current situation:\n"
                f"1. Total income is **{income}**.\n"
                f"2. Total expense is **{expense}**.\n"
                f"3. Net balance is **{balance}**.\n"
                f"4. You are currently spending **{expense_pct}%** of income.\n"
                f"5. If you want to improve your financial health, focus on increasing savings, reducing high-cost categories, and keeping monthly bills under control.\n"
                f"6. Ask me for a specific next step such as savings, debt payoff, investment guidance, or bill reduction."
            )
            follow_ups = [
                'How can I save more money?',
                'Give me a weekly spending budget',
                'Where am I spending too much?'
            ]

        return jsonify({
            "answer": answer,
            "followUps": follow_ups
        })

    except Exception as e:
        print(f"[chat-advice error] {e}")
        return jsonify({
            "answer": "I’m unable to analyze your question right now. Please try again in a moment or ask a simpler forecast question.",
            "followUps": [
                "Would you like a basic budget forecast?",
                "How much might I spend next month?"
            ]
        }), 200

if __name__ == '__main__':
    # Running Flask app on port 5002
    app.run(host='0.0.0.0', port=5002, debug=False)
