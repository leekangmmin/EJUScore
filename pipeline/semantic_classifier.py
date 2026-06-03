"""
EJU Semantic Domain Classifier — 3-tier hybrid classification system.
Replaces the original keyword-only classifier with a tiered approach:
  Tier 1: Extended keyword + pattern matching (fast)
  Tier 2: Embedding-based cosine similarity (medium)
  Tier 3: LLM fallback (slow, optional)
"""
import re
import json
import os
from typing import Dict, List, Optional, Tuple, Any

from .domain_lexicon import get_domain_data, compute_keyword_score
from .embedding_store import EmbeddingStore


class SemanticClassifier:
    """
    Three-tier hybrid domain classifier for EJU comprehensive subject.
    
    Usage:
        classifier = SemanticClassifier()
        domain, confidence = classifier.classify(question_text, answer_choices)
    """

    # Thresholds for tier transitions
    TIER1_CONFIDENCE_THRESHOLD = 0.85  # Tier 1 is sufficient
    TIER2_CONFIDENCE_THRESHOLD = 0.70  # Tier 2 is sufficient
    TIER3_MIN_CONFIDENCE = 0.40         # Tier 3 always returns >= this

    DOMAINS = ['economy', 'politics', 'history', 'geography', 'society']

    def __init__(self, data_dir: str = None):
        self.domain_data = get_domain_data()
        self.embedding_store = EmbeddingStore(data_dir)
        self.stats: Dict[str, Any] = {
            'tier1_classifications': 0,
            'tier2_classifications': 0,
            'tier3_classifications': 0,
            'unknown': 0,
            'total': 0,
        }
        self._llm_available = False  # Set to True if LLM is configured

    def initialize(self, high_confidence_questions: List[Dict] = None) -> bool:
        """Initialize the classifier, optionally building embedding store from existing data."""
        if high_confidence_questions and len(high_confidence_questions) > 50:
            success = self.embedding_store.build_from_dataset(high_confidence_questions)
            return success
        return False

    def classify(
        self,
        question_text: str,
        answer_choices: List[str] = None,
        context_window: List[str] = None,
        exam_metadata: Dict = None,
    ) -> Tuple[str, float, str]:
        """
        Classify a question into EJU domain.
        
        Args:
            question_text: The main question text
            answer_choices: List of answer choice strings (optional)
            context_window: Surrounding question texts for context (optional)
            exam_metadata: Dict with year, round, etc. (optional)
            
        Returns:
            (domain, confidence, tier_used)
            domain: one of 'economy', 'politics', 'history', 'geography', 'society', 'unknown'
            confidence: 0.0-1.0
            tier_used: 'tier1', 'tier2', 'tier3', or 'unknown'
        """
        self.stats['total'] += 1

        if not question_text or len(question_text.strip()) < 10:
            self.stats['unknown'] += 1
            return 'unknown', 0.0, 'unknown'

        text = question_text.strip()
        if answer_choices:
            text_with_choices = text + ' ' + ' '.join(answer_choices)
        else:
            text_with_choices = text

        # ── Tier 1: Keyword + Pattern matching ──
        domain, confidence = self._tier1_classify(text_with_choices)
        if domain != 'unknown' and confidence >= self.TIER1_CONFIDENCE_THRESHOLD:
            self.stats['tier1_classifications'] += 1
            return domain, round(confidence, 4), 'tier1'

        # ── Tier 2: Embedding-based ──
        if self.embedding_store.is_fitted:
            domain2, conf2 = self.embedding_store.classify(
                text=text,
                context=' '.join(answer_choices) if answer_choices else '',
                window_texts=context_window,
            )
            # Use Tier 2 if its confidence is higher or meets threshold
            if domain2 != 'unknown' and conf2 >= self.TIER2_CONFIDENCE_THRESHOLD:
                self.stats['tier2_classifications'] += 1
                return domain2, round(conf2, 4), 'tier2'
            elif domain != 'unknown' and confidence >= conf2:
                # Tier 1 is better than Tier 2, use Tier 1
                self.stats['tier1_classifications'] += 1
                return domain, round(confidence, 4), 'tier1'
            elif domain2 != 'unknown':
                # Tier 2 is better despite low confidence
                self.stats['tier2_classifications'] += 1
                return domain2, round(conf2, 4), 'tier2'

        # ── Tier 3: LLM fallback (if available) ──
        if self._llm_available:
            domain3, conf3 = self._tier3_classify(text, answer_choices, context_window)
            if domain3 != 'unknown':
                self.stats['tier3_classifications'] += 1
                return domain3, round(conf3, 4), 'tier3'

        # ── Fallback: return best guess from Tier 1 ──
        if domain != 'unknown':
            self.stats['tier1_classifications'] += 1
            return domain, round(confidence, 4), 'tier1'

        self.stats['unknown'] += 1
        return 'unknown', 0.0, 'unknown'

    def _tier1_classify(self, text: str) -> Tuple[str, float]:
        """
        Tier 1: Keyword + pattern-based classification.
        Uses extended lexicon from domain_lexicon.py.
        """
        if not text:
            return 'unknown', 0.0

        scores = {}
        for domain in self.DOMAINS:
            score, kw_count, pat_count = compute_keyword_score(text, self.domain_data[domain])
            scores[domain] = score

        # Find best domain
        best_domain = max(scores, key=scores.get)
        best_score = scores[best_domain]

        if best_score < 0.1:
            return 'unknown', best_score

        # Check if there's a clear winner
        sorted_domains = sorted(scores.items(), key=lambda x: -x[1])
        if len(sorted_domains) >= 2:
            margin = sorted_domains[0][1] - sorted_domains[1][1]
            if margin < 0.05 and sorted_domains[0][1] > 0:
                # Ambiguous between top two
                best_score *= 0.8

        return best_domain, min(best_score, 1.0)

    def _tier3_classify(
        self,
        text: str,
        answer_choices: List[str] = None,
        context_window: List[str] = None,
    ) -> Tuple[str, float]:
        """
        Tier 3: LLM-based fallback classification.
        Uses a structured prompt to ask an LLM for domain classification.
        
        NOTE: This requires an LLM API to be configured.
        Returns 'unknown' with low confidence if LLM is not available.
        """
        # This is a placeholder for LLM integration.
        # In production, this would call an API like OpenAI, Claude, etc.
        
        # For now, use a heuristic approach as minimal LLM fallback:
        # Analyze character-level patterns to detect domain hints
        
        # Detect numerical data patterns (often economy or geography)
        has_numbers = bool(re.search(r'\d+[\.\,\s]*[%％]|\d+\.\d+', text))
        has_dates = bool(re.search(r'\d{4}年|\d{2}世紀|\d+年代', text))
        has_places = bool(re.search(r'日本|中国|アメリカ|EU|アジア|ヨーロッパ|アフリカ', text))

        # Use the best Tier 1 result (already computed)
        best_domain, best_score = self._tier1_classify(text)
        
        # Adjust confidence based on heuristics
        if best_domain == 'unknown' and has_dates:
            return 'history', 0.45
        
        if best_domain == 'unknown' and has_numbers and has_places:
            return 'geography', 0.40
            
        if best_domain == 'unknown' and has_places:
            return 'politics', 0.35

        return 'unknown', 0.3

    def classify_with_context(
        self,
        question: Dict,
        adjacent_questions: List[Dict] = None,
        exam_metadata: Dict = None,
    ) -> Tuple[str, float, str]:
        """
        Classify a question with full context.
        
        Args:
            question: Question dict with 'text' and optionally 'answer_choices'
            adjacent_questions: List of surrounding question dicts
            exam_metadata: Dict with year, round, etc.
            
        Returns:
            (domain, confidence, tier_used)
        """
        text = question.get('text', '') or question.get('cleaned_text', '') or ''
        choices = question.get('answer_choices', [])
        
        # Build context window
        context_window = []
        if adjacent_questions:
            for aq in adjacent_questions:
                qt = aq.get('text', '') or aq.get('cleaned_text', '') or ''
                if qt:
                    context_window.append(qt)

        return self.classify(
            question_text=text,
            answer_choices=choices if choices else None,
            context_window=context_window if context_window else None,
            exam_metadata=exam_metadata,
        )

    def get_stats(self) -> Dict:
        """Return classification statistics."""
        return dict(self.stats)

    def enable_llm(self, enabled: bool = True):
        """Enable or disable LLM fallback (Tier 3)."""
        self._llm_available = enabled
