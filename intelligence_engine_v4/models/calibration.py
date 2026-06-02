"""
Probability Calibration for V4 Predictor
==========================================
Platt Scaling (Sigmoid Calibration) for improved probability estimates.

Method: Platt Scaling
  - Fits a sigmoid: P_calibrated = 1 / (1 + exp(a * raw_prob + b))
  - Only 2 parameters (a, b) → very sample-efficient
  - Well-suited for 840 samples (35 topics x 24 years)
  
Why not Isotonic Regression:
  - Isotonic regression needs 30-50 samples per bin
  - With 35 topics, each bin would have ~24 samples (too few)
  - Platt Scaling needs only 2 parameters → much more robust at this data scale
"""

import math
import numpy as np
from typing import Dict, List, Optional, Tuple

from intelligence_engine_v4.config import (
    TEST_YEARS, TARGET_YEARS,
)
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    N_TOPICS, build_topic_year_matrix, build_labels,
    load_gold_standard,
)


class PlattCalibrator:
    """
    Platt Scaling (Sigmoid Calibration) for probability scores.
    
    Fits: P(y=1|f) = 1 / (1 + exp(A * f + B))
    
    Where f is the raw score (logit of the uncalibrated probability).
    
    Reference:
        Platt, J. (1999). "Probabilistic outputs for support vector machines
        and comparisons to regularized likelihood methods."
    """
    
    def __init__(self):
        self.A = 0.0
        self.B = 0.0
        self.is_fitted = False
        self.prior_pos = 0.0
        self.prior_neg = 0.0
    
    def _sigmoid(self, f: np.ndarray) -> np.ndarray:
        """Apply sigmoid: 1 / (1 + exp(A * f + B))."""
        return 1.0 / (1.0 + np.exp(self.A * f + self.B))
    
    def fit(self, scores: np.ndarray, labels: np.ndarray, max_iter: int = 100):
        """
        Fit Platt scaling parameters using Newton's method.
        
        Args:
            scores: Raw probability scores (N,)
            labels: Binary labels (N,)
            max_iter: Maximum optimization iterations
        """
        # Convert probabilities to logits (handle edge cases)
        scores = np.clip(scores, 1e-7, 1 - 1e-7)
        logits = np.log(scores / (1.0 - scores))
        
        # Count positives and negatives for prior correction
        self.prior_pos = (labels == 1).sum()
        self.prior_neg = (labels == 0).sum()
        total = self.prior_pos + self.prior_neg
        
        # Initialize A, B
        self.A = 1.0
        self.B = 0.0
        
        # Prior correction: target values for positive/negative
        # Using: t+ = (N+ + 1) / (N+ + 2), t- = 1 / (N- + 2)
        # (Platt's recommended correction)
        t_pos = (self.prior_pos + 1.0) / (self.prior_pos + 2.0) if self.prior_pos > 0 else 0.5
        t_neg = 1.0 / (self.prior_neg + 2.0) if self.prior_neg > 0 else 0.5
        
        # Target values
        targets = np.where(labels == 1, t_pos, t_neg)
        
        # Newton's method for optimization
        for iteration in range(max_iter):
            f = self.A * logits + self.B
            p = 1.0 / (1.0 + np.exp(-np.clip(f, -100, 100)))
            
            # Gradient
            err = p - targets
            gA = (err * logits).sum()
            gB = err.sum()
            
            # Hessian
            h = p * (1.0 - p)
            hA = (h * logits * logits).sum()
            hB = (h * logits).sum()
            hBB = h.sum()
            
            # Newton update
            det = hA * hBB - hB * hB
            if abs(det) < 1e-15:
                break
            
            dA = -(hBB * gA - hB * gB) / det
            dB = -(-hB * gA + hA * gB) / det
            
            # Line search (simple backtracking)
            step = 1.0
            for _ in range(20):
                A_new = self.A + step * dA
                B_new = self.B + step * dB
                f_new = A_new * logits + B_new
                p_new = 1.0 / (1.0 + np.exp(-np.clip(f_new, -100, 100)))
                
                # Log loss
                loss_new = -np.mean(targets * np.log(np.clip(p_new, 1e-15, 1.0)) +
                                     (1 - targets) * np.log(np.clip(1 - p_new, 1e-15, 1.0)))
                
                # Current loss
                loss_cur = -np.mean(targets * np.log(np.clip(p, 1e-15, 1.0)) +
                                     (1 - targets) * np.log(np.clip(1 - p, 1e-15, 1.0)))
                
                if loss_new < loss_cur:
                    break
                step *= 0.5
            
            self.A += step * dA
            self.B += step * dB
            
            # Convergence check
            if step * (abs(dA) + abs(dB)) < 1e-10:
                break
        
        self.is_fitted = True
    
    def predict(self, scores: np.ndarray) -> np.ndarray:
        """
        Calibrate probability scores.
        
        Args:
            scores: Raw probability scores (N,) or (N, M)
            
        Returns:
            Calibrated probabilities (same shape)
        """
        if not self.is_fitted:
            return scores
        
        scores = np.clip(np.asarray(scores, dtype=np.float64), 1e-7, 1 - 1e-7)
        logits = np.log(scores / (1.0 - scores))
        
        calibrated = self._sigmoid(logits)
        return np.clip(calibrated, 0.01, 0.99).astype(np.float32)
    
    def get_params(self) -> Dict:
        """Return fitted parameters."""
        return {
            'A': float(self.A),
            'B': float(self.B),
            'is_fitted': self.is_fitted,
            'prior_pos': int(self.prior_pos),
            'prior_neg': int(self.prior_neg),
        }


def train_calibrator(
    prob_fn,
    year_matrix: Dict[str, Dict[int, int]],
    test_years: Optional[List[int]] = None,
) -> PlattCalibrator:
    """
    Train Platt calibrator on all training years.
    
    Args:
        prob_fn: Function (year_matrix, target_year) -> np.ndarray of probabilities
        year_matrix: Topic-year count matrix
        test_years: Years to include in training (default: all except target)
        
    Returns:
        Fitted PlattCalibrator
    """
    if test_years is None:
        test_years = list(range(2003, 2026))
    
    all_scores = []
    all_labels = []
    
    for year in test_years:
        scores = prob_fn(year_matrix, year)
        labels = build_labels(year_matrix, year)
        all_scores.append(scores)
        all_labels.append(labels)
    
    scores_all = np.concatenate(all_scores)
    labels_all = np.concatenate(all_labels)
    
    calibrator = PlattCalibrator()
    calibrator.fit(scores_all, labels_all)
    
    return calibrator
