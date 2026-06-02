"""
EJU Intelligence Platform - Trend Analysis Engine
Builds topic frequency tables, trend analysis, and question evolution tracking.
"""
import json
import os
from typing import List, Dict
from collections import defaultdict
from datetime import datetime
from .pipeline_config import TOPIC_FREQUENCY_DIR, TREND_ANALYSIS_DIR


class TrendAnalyzer:
    """Analyzes trends across all processed EJU exams."""

    def __init__(self):
        self.topic_frequency = defaultdict(lambda: defaultdict(int))
        self.domain_frequency = defaultdict(lambda: defaultdict(int))
        self.difficulty_by_year = defaultdict(list)
        self.question_type_by_year = defaultdict(lambda: defaultdict(int))

    def process_exam(self, exam_questions: List[Dict], year: int):
        """Process a single exam's questions for trend analysis."""
        for q in exam_questions:
            topic = q.get('topic', '')
            domain = q.get('domain', 'unknown')
            difficulty = q.get('difficulty', 3)
            q_type = q.get('question_type', 'multiple_choice')
            if topic:
                self.topic_frequency[topic][year] += 1
            self.domain_frequency[domain][year] += 1
            self.difficulty_by_year[year].append(difficulty)
            self.question_type_by_year[year][q_type] += 1

    def build_topic_frequency_table(self) -> Dict:
        table = {}
        for topic, years in self.topic_frequency.items():
            frequencies = {}
            total = 0
            for year in sorted(years.keys()):
                frequencies[str(year)] = years[year]
                total += years[year]
            frequencies['total'] = total
            table[topic] = frequencies
        return table

    def build_domain_frequency_table(self) -> Dict:
        table = {}
        for domain, years in self.domain_frequency.items():
            frequencies = {}
            total = 0
            for year in sorted(years.keys()):
                frequencies[str(year)] = years[year]
                total += years[year]
            frequencies['total'] = total
            table[domain] = frequencies
        return table

    def analyze_trends(self) -> Dict:
        analysis = {
            'growing_topics': [], 'declining_topics': [], 'stable_topics': [],
            'new_appearances': [], 'disappearances': [],
            'difficulty_trend': {}, 'question_type_trends': {},
        }

        all_years = set()
        for topic, years in self.topic_frequency.items():
            all_years.update(years.keys())

        if not all_years:
            return analysis
        sorted_years = sorted(all_years)
        if len(sorted_years) < 2:
            return analysis

        for topic, years_data in self.topic_frequency.items():
            counts = [years_data.get(y, 0) for y in sorted_years]
            if len(counts) >= 2:
                mid = len(counts) // 2
                first_half_avg = sum(counts[:mid]) / max(mid, 1)
                second_half_avg = sum(counts[mid:]) / max(len(counts) - mid, 1)
                slope = second_half_avg - first_half_avg

                freq_dict = {str(y): years_data.get(y, 0) for y in sorted_years}
                if slope > 0.5:
                    analysis['growing_topics'].append({'topic': topic, 'slope': round(slope, 2), 'frequencies': freq_dict})
                elif slope < -0.5:
                    analysis['declining_topics'].append({'topic': topic, 'slope': round(slope, 2), 'frequencies': freq_dict})
                else:
                    analysis['stable_topics'].append({'topic': topic, 'frequencies': freq_dict})

            recent_years = sorted_years[-3:] if len(sorted_years) >= 3 else sorted_years
            earlier_years = [y for y in sorted_years if y not in recent_years]
            appeared_recent = any(years_data.get(y, 0) > 0 for y in recent_years)
            absent_earlier = all(years_data.get(y, 0) == 0 for y in earlier_years)

            if appeared_recent and absent_earlier and earlier_years:
                analysis['new_appearances'].append({
                    'topic': topic,
                    'first_appeared': min(y for y in recent_years if years_data.get(y, 0) > 0),
                })

            if earlier_years:
                appeared_earlier = any(years_data.get(y, 0) > 0 for y in earlier_years)
                absent_recent = all(years_data.get(y, 0) == 0 for y in recent_years)
                if appeared_earlier and absent_recent:
                    analysis['disappearances'].append({
                        'topic': topic,
                        'last_appeared': max(y for y in earlier_years if years_data.get(y, 0) > 0),
                    })

        for year in sorted(self.difficulty_by_year.keys()):
            difficulties = self.difficulty_by_year[year]
            if difficulties:
                analysis['difficulty_trend'][str(year)] = {
                    'mean': round(sum(difficulties) / len(difficulties), 2),
                    'count': len(difficulties),
                }

        for year in sorted(self.question_type_by_year.keys()):
            analysis['question_type_trends'][str(year)] = dict(self.question_type_by_year[year])

        return analysis

    def predict_future_trends(self) -> Dict:
        predictions = {}
        next_year = max((y for t in self.topic_frequency.values() for y in t.keys()), default=2025) + 1

        for topic, years_data in self.topic_frequency.items():
            sorted_years = sorted(years_data.keys())
            if len(sorted_years) < 3:
                continue
            recent_counts = [years_data[y] for y in sorted_years[-3:]]
            avg_count = sum(recent_counts) / len(recent_counts)
            if len(recent_counts) >= 2:
                trend = recent_counts[-1] - recent_counts[0]
                predicted = max(0, round(avg_count + trend * 0.5))
            else:
                predicted = round(avg_count)
            predictions[topic] = {
                'predicted_year': next_year,
                'predicted_count': predicted,
                'recent_average': round(avg_count, 1),
                'confidence': min(0.9, 0.3 + len(sorted_years) * 0.02),
            }
        return predictions

    def save_topic_frequency(self, output_dir: str = None):
        if output_dir is None: output_dir = TOPIC_FREQUENCY_DIR
        table = self.build_topic_frequency_table()
        path = os.path.join(output_dir, 'topic_frequency.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(table, f, ensure_ascii=False, indent=2)
        return path

    def save_domain_frequency(self, output_dir: str = None):
        if output_dir is None: output_dir = TOPIC_FREQUENCY_DIR
        table = self.build_domain_frequency_table()
        path = os.path.join(output_dir, 'domain_frequency.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(table, f, ensure_ascii=False, indent=2)
        return path

    def save_trend_analysis(self, output_dir: str = None):
        if output_dir is None: output_dir = TREND_ANALYSIS_DIR
        analysis = self.analyze_trends()
        predictions = self.predict_future_trends()
        output = {
            'analysis': analysis,
            'predictions': predictions,
            'generated_at': datetime.now().isoformat(),
            'total_exams_analyzed': len(self.difficulty_by_year),
        }
        path = os.path.join(output_dir, 'trend_analysis.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        return path

    def save_all(self, output_dir: str = None):
        return {
            'topic_frequency': self.save_topic_frequency(output_dir),
            'domain_frequency': self.save_domain_frequency(output_dir),
            'trend_analysis': self.save_trend_analysis(output_dir),
        }
