import numpy as np
from sklearn.ensemble import RandomForestRegressor
import pandas as pd


class FinancialHealthModel:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=120, max_depth=6, random_state=42)
        self.trained = False

    def train(self, historical_context):
        if not historical_context or len(historical_context) < 5:
            self.trained = False
            return

        df = pd.DataFrame(historical_context)
        if df.empty:
            self.trained = False
            return

        features = df[['income', 'expense', 'balance', 'debt_ratio', 'utilization', 'transaction_count', 'forecasted_spending']].copy()
        features = pd.concat([features, pd.get_dummies(df['top_category'], prefix='cat', dummy_na=True)], axis=1)
        self.feature_names_ = list(features.columns)
        target = df['health_score']
        self.model.fit(features, target)
        self.trained = True

    def _align_features(self, df):
        for col in self.feature_names_:
            if col not in df.columns:
                df[col] = 0.0
        extra = [col for col in df.columns if col not in self.feature_names_]
        if extra:
            df = df.drop(columns=extra)
        return df[self.feature_names_]

    def predict(self, context):
        if not self.trained:
            return 50.0

        row = {
            'income': float(context.get('income', 0.0)),
            'expense': float(context.get('expense', 0.0)),
            'balance': float(context.get('balance', 0.0)),
            'debt_ratio': float(context.get('debt_ratio', 0.0)),
            'utilization': float(context.get('utilization', 0.0)),
            'transaction_count': int(context.get('transaction_count', 0)),
            'forecasted_spending': float(context.get('forecasted_spending', 0.0))
        }
        df = pd.DataFrame([row])
        df = pd.concat([df, pd.get_dummies(pd.Series([context.get('top_category', None)]), prefix='cat', dummy_na=True)], axis=1)
        df = self._align_features(df)
        return float(max(0.0, min(100.0, self.model.predict(df)[0])))
