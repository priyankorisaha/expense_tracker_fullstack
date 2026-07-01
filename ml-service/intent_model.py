import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from data import INTENT_TRAINING_DATA


class FinanceIntentModel:
    def __init__(self, min_confidence=0.55):
        self.min_confidence = min_confidence
        self.pipeline = Pipeline([
            ('vectorizer', TfidfVectorizer(ngram_range=(1, 2), stop_words='english')),
            ('classifier', CalibratedClassifierCV(LinearSVC(C=1.0, max_iter=200), cv=3))
        ])
        self.trained = False

    def train(self):
        X, y = zip(*INTENT_TRAINING_DATA)
        self.pipeline.fit(X, y)
        self.trained = True

    def predict(self, text):
        if not self.trained:
            raise RuntimeError('FinanceIntentModel has not been trained yet.')

        normalized = (text or '').strip().lower()
        probs = self.pipeline.predict_proba([normalized])[0]
        best_index = int(np.argmax(probs))
        label = self.pipeline.predict([normalized])[0]
        confidence = float(probs[best_index])

        if confidence < self.min_confidence:
            return 'general', confidence
        return label, confidence
