"""
EJU Intelligence Platform - Knowledge Graph Builder
Constructs comprehensive knowledge graph from extracted exam data.
"""
import json
import os
from typing import List, Dict, Optional
from datetime import datetime
from .pipeline_config import KNOWLEDGE_GRAPH_DIR


class KnowledgeGraphBuilder:
    """Builds a comprehensive knowledge graph from EJU exam data."""

    def __init__(self):
        self.nodes = {}
        self.edges = []

    def add_exam_data(self, exam_questions: List[Dict], year: int, exam_id: str):
        for q in exam_questions:
            domain = q.get('domain', 'unknown')
            topic = q.get('topic', '')
            subtopic = q.get('subtopic', '')
            concepts = q.get('concepts', [])
            difficulty = q.get('difficulty', 3)
            q_type = q.get('question_type', 'unknown')
            q_id = q.get('id', '')

            if domain != 'unknown':
                domain_id = f'domain:{domain}'
                if domain_id not in self.nodes:
                    self.nodes[domain_id] = {
                        'id': domain_id, 'type': 'domain', 'label': domain,
                        'description': f'EJU {domain} domain',
                        'question_count': 0, 'years': set(),
                        'avg_difficulty': 0, 'difficulty_sum': 0,
                    }
                self.nodes[domain_id]['question_count'] += 1
                self.nodes[domain_id]['years'].add(year)
                self.nodes[domain_id]['difficulty_sum'] += difficulty

            if topic:
                topic_id = f'topic:{topic}'
                if topic_id not in self.nodes:
                    self.nodes[topic_id] = {
                        'id': topic_id, 'type': 'topic', 'label': topic,
                        'description': f'EJU topic: {topic}',
                        'question_count': 0, 'years': set(),
                        'avg_difficulty': 0, 'difficulty_sum': 0,
                        'question_types': set(),
                    }
                self.nodes[topic_id]['question_count'] += 1
                self.nodes[topic_id]['years'].add(year)
                self.nodes[topic_id]['difficulty_sum'] += difficulty
                self.nodes[topic_id]['question_types'].add(q_type)
                if domain != 'unknown':
                    self._add_edge(topic_id, f'domain:{domain}', 'belongs_to', 1.0)

            if subtopic:
                subtopic_id = f'subtopic:{subtopic}'
                if subtopic_id not in self.nodes:
                    self.nodes[subtopic_id] = {
                        'id': subtopic_id, 'type': 'subtopic', 'label': subtopic,
                        'description': f'EJU subtopic: {subtopic}',
                        'question_count': 0, 'years': set(),
                    }
                self.nodes[subtopic_id]['question_count'] += 1
                self.nodes[subtopic_id]['years'].add(year)
                if topic:
                    self._add_edge(subtopic_id, f'topic:{topic}', 'part_of', 0.8)

            for concept in concepts:
                concept_id = f'concept:{concept}'
                if concept_id not in self.nodes:
                    self.nodes[concept_id] = {
                        'id': concept_id, 'type': 'concept', 'label': concept,
                        'description': f'Concept: {concept}',
                        'question_count': 0, 'years': set(),
                    }
                self.nodes[concept_id]['question_count'] += 1
                self.nodes[concept_id]['years'].add(year)
                if topic:
                    self._add_edge(concept_id, f'topic:{topic}', 'related_to', 0.6)

    def _add_edge(self, source_id: str, target_id: str, edge_type: str, weight: float):
        existing = [e for e in self.edges if e['sourceId'] == source_id and e['targetId'] == target_id]
        if not existing:
            self.edges.append({
                'id': f'edge_{len(self.edges) + 1}',
                'sourceId': source_id, 'targetId': target_id,
                'type': edge_type, 'weight': weight,
            })

    def add_prerequisite_relationships(self):
        prerequisites = [
            ('topic:수요·공급과 시장균형', 'topic:GDP·국민소득', 0.7),
            ('topic:GDP·국민소득', 'topic:경제성장·경기변동', 0.8),
            ('topic:GDP·국민소득', 'topic:환율·국제수지', 0.6),
            ('topic:수요·공급과 시장균형', 'topic:재정·조세정책', 0.5),
            ('topic:수요·공급과 시장균형', 'topic:금융·통화정책', 0.6),
            ('topic:금융·통화정책', 'topic:일본경제사', 0.5),
            ('topic:국제무역', 'topic:환율·국제수지', 0.7),
            ('topic:헌법·기본권', 'topic:통치기구', 0.8),
            ('topic:헌법·기본권', 'topic:사법·재판', 0.7),
            ('topic:통치기구', 'topic:선거·정당', 0.7),
            ('topic:통치기구', 'topic:지방자치', 0.6),
            ('topic:국제정치·국제기구', 'topic:안전보장·방위', 0.7),
            ('topic:정치사상', 'topic:헌법·기본권', 0.6),
            ('topic:시민혁명', 'topic:산업혁명·자본주의', 0.8),
            ('topic:산업혁명·자본주의', 'topic:제국주의·식민지', 0.7),
            ('topic:제국주의·식민지', 'topic:세계대전', 0.8),
            ('topic:세계대전', 'topic:냉전', 0.9),
            ('topic:냉전', 'topic:전후세계질서', 0.8),
            ('topic:냉전', 'topic:세계화·지역통합', 0.6),
            ('topic:지형·판구조', 'topic:기후·케펜구분', 0.5),
            ('topic:기후·케펜구분', 'topic:자원·농업', 0.6),
            ('topic:기후·케펜구분', 'topic:인구·도시화', 0.5),
            ('topic:인구·도시화', 'topic:산업·교통', 0.6),
        ]
        for source, target, weight in prerequisites:
            if source in self.nodes and target in self.nodes:
                self._add_edge(source, target, 'prerequisite', weight)

    def add_cross_domain_connections(self):
        connections = [
            ('topic:냉전', 'topic:국제정치·국제기구', 0.8),
            ('topic:세계대전', 'topic:국제정치·국제기구', 0.7),
            ('topic:전후세계질서', 'topic:안전보장·방위', 0.7),
            ('topic:산업혁명·자본주의', 'topic:경제성장·경기변동', 0.7),
            ('topic:일본경제사', 'topic:일본근대사', 0.8),
            ('topic:자원·농업', 'topic:국제무역', 0.6),
            ('topic:환경·생태', 'topic:환경문제', 0.7),
            ('topic:인구·도시화', 'topic:저출산·고령화', 0.8),
            ('topic:환경·생태', 'topic:환경문제', 0.7),
        ]
        for source, target, weight in connections:
            if source in self.nodes and target in self.nodes:
                self._add_edge(source, target, 'related', weight)

    def finalize_nodes(self):
        for node_id, node in self.nodes.items():
            if node.get('difficulty_sum') and node.get('question_count'):
                node['avg_difficulty'] = round(node['difficulty_sum'] / node['question_count'], 2)
            if 'difficulty_sum' in node:
                del node['difficulty_sum']
            if 'years' in node:
                node['years'] = sorted(node['years']) if isinstance(node['years'], set) else node['years']
            if 'question_types' in node:
                node['question_types'] = sorted(node['question_types']) if isinstance(node['question_types'], set) else node['question_types']
            node['masteryLevel'] = 0.0

    def build(self) -> Dict:
        self.add_prerequisite_relationships()
        self.add_cross_domain_connections()
        self.finalize_nodes()

        domain_count = sum(1 for n in self.nodes.values() if n['type'] == 'domain')
        topic_count = sum(1 for n in self.nodes.values() if n['type'] == 'topic')
        concept_count = sum(1 for n in self.nodes.values() if n['type'] == 'concept')

        return {
            'name': 'EJU Comprehensive Knowledge Graph',
            'version': '2.0.0',
            'generated_at': datetime.now().isoformat(),
            'statistics': {
                'total_nodes': len(self.nodes),
                'total_edges': len(self.edges),
                'domains': domain_count, 'topics': topic_count, 'concepts': concept_count,
                'edge_types': {
                    'belongs_to': sum(1 for e in self.edges if e['type'] == 'belongs_to'),
                    'prerequisite': sum(1 for e in self.edges if e['type'] == 'prerequisite'),
                    'related': sum(1 for e in self.edges if e['type'] == 'related'),
                    'part_of': sum(1 for e in self.edges if e['type'] == 'part_of'),
                    'related_to': sum(1 for e in self.edges if e['type'] == 'related_to'),
                }
            },
            'nodes': list(self.nodes.values()),
            'edges': self.edges,
        }

    def save(self, output_dir: str = None):
        if output_dir is None:
            output_dir = KNOWLEDGE_GRAPH_DIR
        os.makedirs(output_dir, exist_ok=True)
        graph = self.build()
        path = os.path.join(output_dir, 'knowledge_graph.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(graph, f, ensure_ascii=False, indent=2)
        print(f"  Knowledge Graph saved to: {path}")
        print(f"  {graph['statistics']['total_nodes']} nodes, {graph['statistics']['total_edges']} edges")
        return path
