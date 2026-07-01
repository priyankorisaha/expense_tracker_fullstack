import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest


class SpendingAnomalyModel:
    def __init__(self):
        self.model = IsolationForest(contamination=0.05, random_state=42)
        self.trained = False

    def _build_features(self, transactions):
        df = pd.DataFrame(transactions)
        if df.empty:
            return df
        df = df.copy()
        df['amount'] = df['amount'].astype(float)
        df['date'] = pd.to_datetime(df['date'])
        df['day_of_month'] = df['date'].dt.day
        df['weekday'] = df['date'].dt.weekday
        df['month'] = df['date'].dt.month
        df['category'] = df['category'].fillna('other').astype('category')
        cat_dummies = pd.get_dummies(df['category'], prefix='cat')
        df = pd.concat([df[['amount', 'day_of_month', 'weekday', 'month']], cat_dummies], axis=1)
        return df

    def train(self, transactions):
        features = self._build_features(transactions)
        if features.empty or len(features) < 10:
            self.trained = False
            return
        self.model.fit(features)
        self.trained = True

    def _heuristic_anomaly_indices(self, transactions):
        amounts = [float(txn.get('amount', 0)) for txn in transactions if txn.get('amount') is not None]
        if len(amounts) < 2:
            return []

        amounts = np.array(amounts, dtype=float)
        positive = amounts[amounts > 0]
        if len(positive) < 2:
            return []

        min_amt = positive.min()
        max_amt = positive.max()
        candidates = set()

        if min_amt > 0 and max_amt / min_amt >= 2.5:
            candidates.add(int(np.argmax(amounts)))

        if len(positive) >= 3:
            mean = float(np.mean(positive))
            std = float(np.std(positive, ddof=0))
            if std > 0:
                for idx, amt in enumerate(amounts):
                    if amt > mean + 2.5 * std:
                        candidates.add(idx)

        if len(positive) >= 4:
            q1 = np.percentile(positive, 25)
            q3 = np.percentile(positive, 75)
            iqr = q3 - q1
            if iqr > 0:
                for idx, amt in enumerate(amounts):
                    if amt > q3 + 1.5 * iqr:
                        candidates.add(idx)

        return sorted(candidates)

    def is_anomalous(self, transaction, transactions):
        all_transactions = transactions + [transaction]
        if self.trained and len(all_transactions) >= 10:
            features = self._build_features(all_transactions)
            if features.empty or len(features) < 10:
                return False
            scores = self.model.predict(features)
            return bool(scores[-1] == -1)

        indices = self._heuristic_anomaly_indices(all_transactions)
        return len(indices) > 0 and indices[-1] == len(all_transactions) - 1

    def detect_anomalies(self, transactions):
        if len(transactions) >= 10:
            if not self.trained:
                self.train(transactions)
            if self.trained:
                features = self._build_features(transactions)
                if not features.empty and len(features) >= 10:
                    scores = self.model.predict(features)
                    anomalies = []
                    for idx, score in enumerate(scores):
                        if score == -1:
                            txn = transactions[idx]
                            anomalies.append({
                                'index': idx,
                                'date': txn.get('date'),
                                'amount': float(txn.get('amount', 0)),
                                'category': txn.get('category', 'other'),
                                'title': txn.get('title', ''),
                            })
                    if anomalies:
                        return anomalies

        indices = self._heuristic_anomaly_indices(transactions)
        anomalies = []
        for idx in indices:
            txn = transactions[idx]
            anomalies.append({
                'index': idx,
                'date': txn.get('date'),
                'amount': float(txn.get('amount', 0)),
                'category': txn.get('category', 'other'),
                'title': txn.get('title', ''),
            })
        return anomalies
