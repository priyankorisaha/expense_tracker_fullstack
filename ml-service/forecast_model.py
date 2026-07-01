import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score


class BudgetForecastModel:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=150, max_depth=8, random_state=42)
        self.trained = False

    def _build_features(self, expenses_df):
        if expenses_df.empty:
            return pd.DataFrame()

        expenses_df = expenses_df.copy()
        expenses_df['date'] = pd.to_datetime(expenses_df['date'])
        expenses_df['year_month'] = expenses_df['date'].dt.to_period('M')
        monthly = expenses_df.groupby(['year_month', 'category'])['amount'].sum().unstack(fill_value=0)
        monthly['total_spend'] = monthly.sum(axis=1)
        monthly['month_index'] = np.arange(len(monthly))
        monthly['moving_avg_2'] = monthly['total_spend'].rolling(2, min_periods=1).mean()
        monthly['moving_avg_3'] = monthly['total_spend'].rolling(3, min_periods=1).mean()
        monthly['seasonal'] = monthly.index.month
        monthly = monthly.reset_index(drop=True)
        return monthly

    def train(self, expenses_df):
        features = self._build_features(expenses_df)
        if features.empty or len(features) < 2:
            self.trained = False
            return

        X = features.drop(columns=['total_spend'])
        y = features['total_spend']
        self.model.fit(X, y)
        self.trained = True

    def predict_next_month(self, expenses_df):
        features = self._build_features(expenses_df)
        if features.empty or not self.trained:
            return 0.0

        latest = features.iloc[-1:].copy()
        latest['month_index'] = latest['month_index'] + 1
        latest['moving_avg_2'] = latest['total_spend'].rolling(2, min_periods=1).mean().iloc[-1]
        latest['moving_avg_3'] = latest['total_spend'].rolling(3, min_periods=1).mean().iloc[-1]
        latest['seasonal'] = ((latest['seasonal'] % 12) + 1).replace(0, 12)
        if 'total_spend' in latest.columns:
            latest = latest.drop(columns=['total_spend'])

        return float(max(self.model.predict(latest)[0], 0.0))
