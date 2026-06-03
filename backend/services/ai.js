const API_URL = 'https://api.openai.com/v1/chat/completions';

const hasApiKey = () => Boolean(process.env.OPENAI_API_KEY);

const callLLM = async (messages, temperature = 0.2) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        console.error('OpenAI API key is missing. Set OPENAI_API_KEY in .env');
        return null;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages,
                temperature,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('OpenAI API returned error', response.status, text);
            return null;
        }

        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
            console.error('OpenAI API returned no message content', JSON.stringify(json));
            return null;
        }

        return content;
    } catch (err) {
        console.error('callLLM exception:', err);
        return null;
    }
};

exports.autoCategorizeExpense = async ({ title, description, amount }) => {
    try {
        const prompt = [
            { role: 'system', content: 'Categorize user expense into JSON {"category":"...","merchant":"...","confidence":0.0-1.0,"reason":"..."}' },
            { role: 'user', content: `title=${title || ''}; description=${description || ''}; amount=${amount || 0}` },
        ];

        const raw = await callLLM(prompt, 0);
        if (!raw) {
            const fallback = {
                category: 'other',
                merchant: title || 'Unknown',
                confidence: 0.55,
                reason: 'Fallback categorization',
            };
            return fallback;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            console.error('autoCategorizeExpense: JSON parse failed', err, raw);
            parsed = null;
        }

        const fallbackCategory = (text) => {
            const lower = (text || '').toLowerCase();
            if (/uber|lyft|taxi|bus|fuel|petrol|gas/.test(lower)) return 'transport';
            if (/food|restaurant|cafe|grocery/.test(lower)) return 'food';
            if (/rent|electricity|internet|water|utility/.test(lower)) return 'utilities';
            if (/netflix|spotify|prime|subscription/.test(lower)) return 'subscriptions';
            if (/doctor|hospital|medicine/.test(lower)) return 'medical';
            return 'other';
        };

        return {
            category: parsed?.category || fallbackCategory(`${title} ${description}`),
            merchant: parsed?.merchant || title || 'Unknown',
            confidence: Number(parsed?.confidence || 0.7),
            reason: parsed?.reason || 'AI or fallback',
        };
    } catch (error) {
        console.error('autoCategorizeExpense error:', error);
        return {
            category: 'other',
            merchant: title || 'Unknown',
            confidence: 0.5,
            reason: 'fallback due error',
        };
    }
};

exports.generateBudgetAdvice = async ({ monthlyIncome, topCategories, currency }) => {
    try {
        const totalExpense = topCategories.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const safeToSpend = Math.max(Math.round(monthlyIncome - totalExpense), 0);
        const utilization = monthlyIncome > 0 ? Math.min(1, totalExpense / monthlyIncome) : 0;
        const healthScore = Math.max(0, Math.min(100, Math.round((1 - utilization) * 100)));

        const categoryBudgets = topCategories.map((item) => ({
            category: item.category,
            suggestedLimit: Math.max(Math.round(item.amount * 0.9), 0),
        }));

        const recommendations = [];
        if (utilization > 0.9) {
            recommendations.push('I see your expenses are very high relative to income; let’s tighten the top category this month.');
        } else if (utilization > 0.75) {
            recommendations.push('Nice progress — you are close to a secure budget zone, just a little more control needed.');
        } else {
            recommendations.push('Excellent job! Your budget is well-balanced and you have room to grow savings.');
        }

        if (topCategories.length > 0) {
            const top1 = topCategories[0];
            recommendations.push(`Try reducing ${top1.category} by 10% next month and see how that helps your safe-to-spend number.`);
        }

        recommendations.push('Keep a small weekly review to stay on track and avoid surprise over-spending.');

        const messages = [];
        if (utilization > 0.9) {
            messages.push(`Heads-up: you are spending ${Math.round(utilization * 100)}% of your income. Prioritize essentials and delay non-urgent purchases.`);
        } else if (utilization > 0.75) {
            messages.push(`You are at ${Math.round(utilization * 100)}% of income. A small tweak will make your monthly cash flow much stronger.`);
        } else {
            messages.push(`You are in a healthy zone at ${Math.round(utilization * 100)}% utilization. Great work keeping your expense rhythm steady!`);
        }

        messages.push(`Based on your current data, you can safely spend around ${currency || 'USD'} ${safeToSpend}.`);

        const followUps = [
            'Can you suggest three small changes I can make in the next week?',
            'What is the best way to save for an emergency fund with this budget?',
            'How should I adjust if my income changes next month?',
        ];

        return {
            healthScore,
            safeToSpend,
            categoryBudgets,
            recommendations,
            message: messages.join(' '),
            followUps,
        };
    } catch (error) {
        console.error('generateBudgetAdvice error:', error);
        return {
            healthScore: 0,
            safeToSpend: 0,
            categoryBudgets: [],
            recommendations: ['Unable to compute recommendations right now. Please try again later.'],
            message: 'Oops! I could not generate advice at the moment. Try again in a few seconds.',
            followUps: ['Check your income and expenses entries', 'Reload the app and try again'],
        };
    }
};

exports.chatWithFinanceAssistant = async ({ question, context }) => {
    try {
        const text = (question || '').toLowerCase().trim();
        const income = Number(context?.totalIncome || 0);
        const expense = Number(context?.totalExpense || 0);
        const balance = Number(context?.balance || income - expense);
        const topCategories = Array.isArray(context?.topCategories) ? context.topCategories : [];
        const detectedAmount = question?.match(/(\d[\d,]*)/);
        const askedAmount = detectedAmount ? Number(detectedAmount[1].replace(/,/g, '')) : null;
        const planningAmount = askedAmount && askedAmount > 0 ? askedAmount : income;
        const savingsTarget = Math.round(planningAmount * 0.3);
        const needsBudget = Math.round(planningAmount * 0.5);
        const wantsBudget = Math.round(planningAmount * 0.2);
        const weeklyWantsBudget = Math.round(wantsBudget / 4);
        const savingsRate = income > 0 ? Math.round((Math.max(balance, 0) / income) * 100) : 0;
        const categoryHints = topCategories.slice(0, 3).map((row) => `- ${row.category}: ${Math.round(Number(row.amount || 0))}`).join('\n');
        const wantsSpendingPlan = /spend|budget|plan|allocate|distribution|split/.test(text);
        const wantsSavings = /save|saving|invest|sip|emergency fund|goal/.test(text);
        const wantsExpenseCut = /reduce|cut|lower|decrease|optimi[sz]e/.test(text);
        const wantsWeekly = /week|weekly|per week/.test(text);
        const wantsCategory = /category|categories|food|rent|transport|subscription/.test(text);

        const openingOptions = [
            'Hey there! I’m your budgeting buddy — let’s make money feel like a team game.',
            'Nice question! I’ve got your back with a practical money chat.',
            'Absolutely, this is a great topic. Let’s turn your budget into wins.',
        ];
        const opening = openingOptions[Math.floor(Math.random() * openingOptions.length)];

        let answer = `${opening}\n\n`;
        answer += `Here is what I can see in your current snapshot:\n- Income: ${income}\n- Expense: ${expense}\n- Balance: ${balance}\n`;
        if (categoryHints) answer += `- Top spending categories:\n${categoryHints}\n`;

        if (wantsSpendingPlan || askedAmount) {
            answer += `\nBased on your goal of planning ${planningAmount}, here’s a friendly 50/30/20 split:\n- Needs: ${needsBudget}\n- Savings/Investments: ${savingsTarget}\n- Wants: ${wantsBudget}\n- Weekly wants cap: ${weeklyWantsBudget}\n`;
        }

        if (wantsSavings) {
            answer += `\nGood call on savings! Aim for at least 30% of income (~${Math.round(income * 0.3)}). Your current savings rate is around ${savingsRate}%.`;
        }

        if (wantsExpenseCut) {
            const topOne = topCategories[0];
            if (topOne) {
                answer += `\nLet’s trim ${topOne.category} by 10% this month to save about ${Math.round(Number(topOne.amount || 0) * 0.1)}.`;
            } else {
                answer += '\nA good quick move: track spending for 2 weeks and then cut the top non-essential category by 10%.\n';
            }
        }

        if (wantsWeekly) {
            const weeklyNeeds = Math.round(needsBudget / 4);
            const weeklySavings = Math.round(savingsTarget / 4);
            answer += `\nWeek-by-week direction:\n- Needs: ${weeklyNeeds}\n- Savings: ${weeklySavings}\n- Wants: ${weeklyWantsBudget}\n`;
        }

        if (wantsCategory && topCategories.length > 0) {
            answer += '\nCategory focus: keep each top category a bit lower (10% down) than last month to build momentum.\n';
        }

        if (!wantsSpendingPlan && !wantsSavings && !wantsExpenseCut && !wantsWeekly && !wantsCategory) {
            answer += '\nI have a few ideas: you can ask me to be your debt-slayer, savings planner, or grocery negotiator. What would you like next?\n';
        }

        const followUps = [
            'Help me create a daily spending plan',
            'How can I save 20% more without feeling restricted?',
            'Show me a simple plan to reduce grocery spend',
            'Tell me how to make an emergency fund fast',
        ];

        return {
            answer: answer + '\nPractical next step: save first, then spend wisely. Ask me for a day-by-day tracker if you want.',
            followUps,
        };
    } catch (error) {
        console.error('chatWithFinanceAssistant error:', error);
        return {
            answer: 'I could not generate advice right now. Please retry with a shorter question.',
            followUps: ['How to spend 60000 efficiently'],
        };
    }
};