"""
EJU Confidence Scoring System — Separates and tracks three independent
confidence dimensions:
  1. classifier_confidence  (domain label correctness)
  2. segmentation_confidence (question boundary correctness)
  3. ocr_confidence (text extraction quality)
  
Produces overall_confidence as a weighted or min-based combination.
"""
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ConfidenceScores:
    """Separate confidence scores for each pipeline dimension."""
    ocr_confidence: float = 0.0
    segmentation_confidence: float = 0.0
    classifier_confidence: float = 0.0

    # Overall aggregate
    overall_confidence: float = 0.0

    # Tracking metadata
    classifier_tier: str = 'none'  # 'tier1', 'tier2', 'tier3', 'unknown'
    segmentation_quality: str = 'unknown'  # 'clean', 'repaired', 'fragment', 'unknown'


class ConfidenceScorer:
    """
    Computes and tracks confidence across all pipeline dimensions.
    
    Overall confidence is computed as:
      strict (min):  overall = min(ocr, seg, classifier)
      weighted:      overall = 0.3*ocr + 0.3*seg + 0.4*classifier
    """

    def __init__(self, mode: str = 'weighted'):
        """
        Args:
            mode: 'weighted' (default) or 'strict' (min-based)
        """
        self.mode = mode
        self.scores: List[ConfidenceScores] = []

    def compute(
        self,
        ocr_conf: float = 0.0,
        seg_conf: float = 0.0,
        classifier_conf: float = 0.0,
        classifier_tier: str = 'unknown',
        seg_quality: str = 'unknown',
    ) -> ConfidenceScores:
        """
        Compute combined confidence scores.
        
        Args:
            ocr_conf: OCR extraction confidence (0.0-1.0)
            seg_conf: Segmentation boundary confidence (0.0-1.0)
            classifier_conf: Domain classifier confidence (0.0-1.0)
            classifier_tier: Which tier classified this
            seg_quality: Segmentation quality description
            
        Returns:
            ConfidenceScores with all dimensions
        """
        if self.mode == 'strict':
            overall = min(ocr_conf, seg_conf, classifier_conf)
        else:
            # Weighted: prioritize classifier, then segmentation, then OCR
            overall = (
                0.30 * ocr_conf +
                0.30 * seg_conf +
                0.40 * classifier_conf
            )

        cs = ConfidenceScores(
            ocr_confidence=round(ocr_conf, 4),
            segmentation_confidence=round(seg_conf, 4),
            classifier_confidence=round(classifier_conf, 4),
            overall_confidence=round(overall, 4),
            classifier_tier=classifier_tier,
            segmentation_quality=seg_quality,
        )

        self.scores.append(cs)
        return cs

    def compute_from_question(
        self,
        question: Dict,
        seg_confidence: float = None,
        classifier_confidence: float = None,
        classifier_tier: str = None,
    ) -> ConfidenceScores:
        """
        Compute confidence from a question dict (from pipeline).
        
        Args:
            question: Question dict with optional confidence fields
            seg_confidence: Override segmentation confidence
            classifier_confidence: Override classifier confidence
            classifier_tier: Override classifier tier
            
        Returns:
            ConfidenceScores
        """
        ocr_conf = question.get('ocr_confidence', 0) or 0

        if seg_confidence is None:
            seg_conf = question.get('segmentation_confidence', ocr_conf) or ocr_conf
        else:
            seg_conf = seg_confidence

        if classifier_confidence is None:
            class_conf = question.get('domain_confidence', 0) or 0
        else:
            class_conf = classifier_confidence

        tier = classifier_tier or question.get('classifier_tier', 'unknown')

        # Determine seg quality
        text = question.get('text', '') or ''
        if len(text) < 20:
            seg_quality = 'fragment'
        elif seg_conf >= 0.8:
            seg_quality = 'clean'
        elif seg_conf >= 0.5:
            seg_quality = 'repaired'
        else:
            seg_quality = 'unknown'

        return self.compute(
            ocr_conf=ocr_conf,
            seg_conf=seg_conf,
            classifier_conf=class_conf,
            classifier_tier=tier,
            seg_quality=seg_quality,
        )

    def get_summary(self) -> Dict:
        """Get summary statistics for all scored questions."""
        if not self.scores:
            return {
                'total': 0,
                'avg_overall': 0.0,
                'avg_ocr': 0.0,
                'avg_segmentation': 0.0,
                'avg_classifier': 0.0,
            }

        return {
            'total': len(self.scores),
            'avg_overall': round(
                sum(s.overall_confidence for s in self.scores) / len(self.scores), 4
            ),
            'avg_ocr': round(
                sum(s.ocr_confidence for s in self.scores) / len(self.scores), 4
            ),
            'avg_segmentation': round(
                sum(s.segmentation_confidence for s in self.scores) / len(self.scores), 4
            ),
            'avg_classifier': round(
                sum(s.classifier_confidence for s in self.scores) / len(self.scores), 4
            ),
            'low_confidence_count': sum(
                1 for s in self.scores if s.overall_confidence < 0.6
            ),
        }

    def get_threshold_breakdown(self) -> Dict[str, int]:
        """Breakdown by overall confidence thresholds."""
        if not self.scores:
            return {}

        return {
            'excellent_0.9+': sum(1 for s in self.scores if s.overall_confidence >= 0.9),
            'good_0.8+': sum(1 for s in self.scores if 0.8 <= s.overall_confidence < 0.9),
            'fair_0.6+': sum(1 for s in self.scores if 0.6 <= s.overall_confidence < 0.8),
            'poor_0.4+': sum(1 for s in self.scores if 0.4 <= s.overall_confidence < 0.6),
            'bad_<0.4': sum(1 for s in self.scores if s.overall_confidence < 0.4),
        }
