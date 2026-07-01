import numpy as np
from sklearn.ensemble import RandomForestRegressor
import pandas as pd


class SavingsRecommendationModel:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=120, max_depth=8, random_state=42)
        self.trained = False

    def train(self, records):
        if not records or len(records) < 5:
            self.trained = False
            return

        df = pd.DataFrame(records)
        if df.empty:
            self.trained = False
            return

        df['expense_ratio'] = df['expense'] / df['income'].replace(0, np.nan)
        df['balance_ratio'] = df['balance'] / df['income'].replace(0, np.nan)
        df['trend_3m'] = df['spending_trend'].rolling(3, min_periods=1).mean()
        df = df.fillna(0)

        X = df[['income', 'expense', 'balance', 'expense_ratio', 'balance_ratio', 'spending_trend', 'trend_3m', 'transaction_count']]
        y = df['ideal_savings']
        self.model.fit(X, y)
        self.trained = True

    def predict(self, context):
        if not self.trained:
            return float(round(float(context.get('income', 0.0)) * 0.2, 2))

        row = {
            'income': float(context.get('income', 0.0)),
            'expense': float(context.get('expense', 0.0)),
            'balance': float(context.get('balance', 0.0)),
            'expense_ratio': float(context.get('expense_ratio', 0.0)),
            'balance_ratio': float(context.get('balance_ratio', 0.0)),
            'spending_trend': float(context.get('spending_trend', 0.0)),
            'trend_3m': float(context.get('trend_3m', 0.0)),
            'transaction_count': int(context.get('transaction_count', 0))
        }
        df = pd.DataFrame([row])
        return float(max(0.0, self.model.predict(df)[0]))
