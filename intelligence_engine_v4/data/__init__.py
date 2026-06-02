"""
Data loading and feature engineering for V4.
Training topics = 35 topics from the gold standard dataset.
"""

import json
import math
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

import numpy as np


def load_gold_standard(path: str = None) -> List[dict]:
    if path is None:
        from intelligence_engine_v4.config import GOLD_STANDARD_PATH as _p
        path = _p
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('questions', [])


def load_knowledge_graph(path: str = None) -> dict:
    if path is None:
        from intelligence_engine_v4.config import KNOWLEDGE_GRAPH_PATH as _p
        path = _p
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_difficulty_db(path: str = None) -> dict:
    if path is None:
        from intelligence_engine_v4.config import DIFFICULTY_DB_PATH as _p
        path = _p
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ── Load Training Topics from Gold Standard ──────────────────────────
def _get_gold_topics():
    questions = load_gold_standard()
    topics = sorted(set(
        q.get('topic', '').strip()
        for q in questions
        if q.get('topic', '').strip()
    ))
    return topics


# TRAIN_TOPICS = exactly the 35 gold standard topics
TRAIN_TOPICS = _get_gold_topics()

DOMAINS = ['economy', 'politics', 'history', 'geography', 'society']

# Domain mapping for gold standard topics
TOPIC_TO_DOMAIN_MAP = {
    'GDP·국민소득': 'economy', '경제성장·경기변동': 'economy', '고용·노동': 'economy',
    '국제무역': 'economy', '금융·통화정책': 'economy', '소득분배·지니계수': 'economy',
    '수요·공급과 시장균형': 'economy', '일본경제사': 'economy', '재정·조세정책': 'economy',
    '환율·국제수지': 'economy',
    '국제정치·국제기구': 'politics', '사법·재판': 'politics', '선거·정당': 'politics',
    '안전보장·방위': 'politics', '정치사상': 'politics', '지방자치': 'politics',
    '통치기구': 'politics', '헌법·기본권': 'politics',
    '냉전': 'history', '대공황': 'history', '러시아혁명·소련': 'history',
    '산업혁명·자본주의': 'history', '세계대전': 'history', '시민혁명': 'history',
    '전후세계질서': 'history', '제국주의·식민지': 'history', '근대일본': 'history',
    '기후·케펜구분': 'geography', '인구·도시화': 'geography', '자원·농업': 'geography',
    '지도·GIS': 'geography', '지형·판구조': 'geography',
    '다문화사회': 'society', '사회보장·복지': 'society', '환경문제': 'society',
}

# Build DOMAIN_OF_TOPIC for all topics
DOMAIN_OF_TOPIC = {}
for t in TRAIN_TOPICS:
    DOMAIN_OF_TOPIC[t] = TOPIC_TO_DOMAIN_MAP.get(t, 'society')

# Index maps
TOPIC_TO_IDX = {t: i for i, t in enumerate(TRAIN_TOPICS)}
IDX_TO_TOPIC = {i: t for i, t in enumerate(TRAIN_TOPICS)}
N_TOPICS = len(TRAIN_TOPICS)

TOPIC_DOMAIN_IDX = {}
for t in TRAIN_TOPICS:
    dom = DOMAIN_OF_TOPIC.get(t, 'economy')
    TOPIC_DOMAIN_IDX[t] = DOMAINS.index(dom) if dom in DOMAINS else 0

# ALL_TOPICS (same as TRAIN_TOPICS for simplicity)
ALL_TOPICS = TRAIN_TOPICS


# ── Topic Clusters ──────────────────────────────────────────────────

TOPIC_CLUSTERS = {
    "Revolution_Cluster": {"label": "혁명·변혁", "topics": ["시민혁명", "산업혁명·자본주의", "제국주의·식민지"]},
    "Macroeconomics_Cluster": {"label": "거시경제", "topics": ["GDP·국민소득", "경제성장·경기변동", "고용·노동", "소득분배·지니계수", "일본경제사"]},
    "Market_Cluster": {"label": "시장·정책", "topics": ["수요·공급과 시장균형", "금융·통화정책", "재정·조세정책"]},
    "International_Cluster": {"label": "국제·교류", "topics": ["국제무역", "환율·국제수지", "국제정치·국제기구", "안전보장·방위"]},
    "War_Peace_Cluster": {"label": "전쟁·평화", "topics": ["세계대전", "냉전", "전후세계질서"]},
    "Governance_Cluster": {"label": "통치·제도", "topics": ["헌법·기본권", "통치기구", "선거·정당", "지방자치", "사법·재판"]},
    "Political_Ideology_Cluster": {"label": "정치사상", "topics": ["정치사상"]},
    "Physical_Geo_Cluster": {"label": "자연지리", "topics": ["기후·케펜구분", "지형·판구조"]},
    "Human_Geo_Cluster": {"label": "인문지리", "topics": ["인구·도시화", "자원·농업", "지도·GIS"]},
    "Social_Issues_Cluster": {"label": "사회이슈", "topics": ["환경문제", "사회보장·복지", "다문화사회", "근대일본"]},
    "Economic_History_Cluster": {"label": "경제사", "topics": ["대공황", "러시아혁명·소련"]},
}

TOPIC_TO_CLUSTER = {}
for cname, cinfo in TOPIC_CLUSTERS.items():
    for t in cinfo["topics"]:
        TOPIC_TO_CLUSTER[t] = cname

CLUSTER_TO_TOPICS = {c: info["topics"] for c, info in TOPIC_CLUSTERS.items()}
CLUSTER_NAMES = list(TOPIC_CLUSTERS.keys())
N_CLUSTERS = len(CLUSTER_NAMES)

TOPIC_DIFFICULTY_DEFAULT = {t: 0.5 for t in TRAIN_TOPICS}


# ── Prerequisite Map ────────────────────────────────────────────────
# NOTE: Original map had references to topics not in TRAIN_TOPICS
# (e.g., '경제학 기초', '삼권분립', '계몽사상', '근대사회', '민족주의', '지리 기초').
# These references never matched any topic in TOPIC_TO_IDX, making
# apply_prerequisite_boost() completely dead code.
#
# Fix: PREREQUISITE_MAP_FIXED remaps these to the closest actual TRAIN_TOPICS.

_PREREQUISITE_REMAP = {
    '경제학 기초': '수요·공급과 시장균형',
    '삼권분립': '헌법·기본권',
    '계몽사상': '시민혁명',
    '근대사회': '시민혁명',
    '민족주의': '세계대전',
    '지리 기초': '기후·케펜구분',
}

PREREQUISITE_MAP_RAW = {
    '수요·공급과 시장균형': ['경제학 기초'],
    'GDP·국민소득': ['수요·공급과 시장균형', '경제학 기초'],
    '환율·국제수지': ['GDP·국민소득', '금융·통화정책'],
    '금융·통화정책': ['수요·공급과 시장균형', 'GDP·국민소득'],
    '재정·조세정책': ['GDP·국민소득', '수요·공급과 시장균형'],
    '국제무역': ['환율·국제수지', 'GDP·국민소득', '국제정치·국제기구'],
    '고용·노동': ['경제성장·경기변동', '수요·공급과 시장균형'],
    '경제성장·경기변동': ['GDP·국민소득', '금융·통화정책'],
    '소득분배·지니계수': ['경제성장·경기변동', '고용·노동'],
    '일본경제사': ['경제성장·경기변동', '근대일본'],
    '헌법·기본권': ['시민혁명', '정치사상'],
    '통치기구': ['헌법·기본권', '삼권분립'],
    '선거·정당': ['헌법·기본권', '통치기구'],
    '국제정치·국제기구': ['세계대전', '냉전'],
    '지방자치': ['통치기구', '헌법·기본권'],
    '사법·재판': ['헌법·기본권', '통치기구', '삼권분립'],
    '정치사상': ['시민혁명'],
    '안전보장·방위': ['국제정치·국제기구', '냉전'],
    '시민혁명': ['계몽사상', '근대사회'],
    '산업혁명·자본주의': ['시민혁명'],
    '제국주의·식민지': ['산업혁명·자본주의'],
    '세계대전': ['제국주의·식민지', '민족주의'],
    '냉전': ['세계대전'],
    '근대일본': ['시민혁명'],
    '전후세계질서': ['세계대전', '냉전'],
    '러시아혁명·소련': ['세계대전', '제국주의·식민지'],
    '대공황': ['세계대전', '금융·통화정책'],
    '기후·케펜구분': ['지리 기초'],
    '지형·판구조': ['지리 기초'],
    '인구·도시화': ['지리 기초'],
    '자원·농업': ['기후·케펜구분', '지형·판구조'],
    '지도·GIS': ['지리 기초'],
    '환경문제': ['산업혁명·자본주의'],
    '사회보장·복지': ['경제성장·경기변동', '고용·노동'],
    '다문화사회': ['근대일본'],
}

def _build_fixed_prerequisite_map():
    """Build a prerequisite map where all references point to valid TRAIN_TOPICS."""
    fixed = {}
    for topic, prereqs in PREREQUISITE_MAP_RAW.items():
        fixed[topic] = []
        for p in prereqs:
            mapped = _PREREQUISITE_REMAP.get(p, p)  # remap or keep as-is
            if mapped in TOPIC_TO_IDX:
                fixed[topic].append(mapped)
            # If still not in TOPIC_TO_IDX, skip (shouldn't happen after remap)
    return fixed

PREREQUISITE_MAP = _build_fixed_prerequisite_map()

# Check integrity
_remap_issues = []
for topic, prereqs in PREREQUISITE_MAP.items():
    for p in prereqs:
        if p not in TOPIC_TO_IDX:
            _remap_issues.append((topic, p))
if _remap_issues:
    raise RuntimeError(f"Prerequisite remap failed: {_remap_issues}")


# ── Feature Engineering ──────────────────────────────────────────────

def build_topic_year_matrix(questions: List[dict]) -> Dict[str, Dict[int, int]]:
    """Build topic -> year -> count matrix."""
    matrix = defaultdict(lambda: defaultdict(int))
    for q in questions:
        year = q.get('year')
        topic = q.get('topic', '').strip()
        if not topic or not year:
            continue
        matrix[topic][int(year)] += 1
    for t in TRAIN_TOPICS:
        if t not in matrix:
            matrix[t] = {}
    return {k: dict(v) for k, v in matrix.items()}


def build_topic_features(year_matrix, target_year=2026):
    """Build feature matrix (N_TOPICS × 8)."""
    N, F = N_TOPICS, 8
    features = np.zeros((N, F), dtype=np.float32)

    try:
        diff_db = load_difficulty_db()
        difficulties = diff_db.get('difficulties', {})
    except:
        difficulties = {}

    decay = math.log(2) / 3.0
    years = list(range(2002, target_year))
    n_years = len(years)

    for i, topic in enumerate(TRAIN_TOPICS):
        yearly = year_matrix.get(topic, {})
        if not yearly:
            features[i, 0] = 0.0
            features[i, 1] = 0.0
            features[i, 2] = TOPIC_DOMAIN_IDX.get(topic, 0) / 4.0
            features[i, 3] = 0.5
            features[i, 4] = 0.0
            features[i, 5] = 0.3
            features[i, 6] = 0.0
            features[i, 7] = 0.0
            continue

        active = sum(1 for y, c in yearly.items() if c > 0)
        features[i, 0] = active / max(1, n_years)

        tw, ws = 0.0, 0.0
        for y in years:
            c = yearly.get(y, 0)
            w = math.exp(-decay * (target_year - y))
            tw += c * w
            ws += w
        features[i, 1] = tw / max(1e-8, ws) / 5.0

        features[i, 2] = TOPIC_DOMAIN_IDX.get(topic, 0) / 4.0
        diff = difficulties.get(topic, TOPIC_DIFFICULTY_DEFAULT.get(topic, 0.5))
        if isinstance(diff, dict):
            diff = diff.get('difficulty', 0.5)
        features[i, 3] = float(diff)

        prereq_c = len(PREREQUISITE_MAP.get(topic, []))
        as_prereq = sum(1 for t, p in PREREQUISITE_MAP.items() if topic in p)
        features[i, 4] = min(1.0, (prereq_c + as_prereq) / 15.0)

        cluster = TOPIC_TO_CLUSTER.get(topic, '')
        if cluster:
            ct = CLUSTER_TO_TOPICS.get(cluster, [])
            ca = sum(1 for cct in ct for y, c in year_matrix.get(cct, {}).items() if c > 0)
            features[i, 5] = min(1.0, ca / 50.0)
        else:
            features[i, 5] = 0.3

        recent_ys = [y for y in range(max(2002, target_year - 5), target_year)]
        if len(recent_ys) >= 3:
            counts = [yearly.get(y, 0) for y in recent_ys]
            if np.std(counts) > 0:
                features[i, 6] = max(-1.0, min(1.0, np.polyfit(np.arange(len(recent_ys)), counts, 1)[0]))

        all_c = [yearly.get(y, 0) for y in years]
        if np.std(all_c) > 0:
            features[i, 7] = min(1.0, np.std(all_c) / 3.0)

    return features


def build_knowledge_graph_adjacency():
    """Build adjacency matrix (N_TOPICS × N_TOPICS)."""
    N = N_TOPICS
    adj = np.zeros((N, N), dtype=np.float32)
    for i, ti in enumerate(TRAIN_TOPICS):
        for j, tj in enumerate(TRAIN_TOPICS):
            if i == j:
                continue
            if tj in PREREQUISITE_MAP.get(ti, []):
                adj[i, j] = 0.9
            if ti in PREREQUISITE_MAP.get(tj, []):
                adj[j, i] = 0.9
    return adj


def build_labels(year_matrix, target_year):
    """Build binary label vector (N_TOPICS,)."""
    labels = np.zeros(N_TOPICS, dtype=np.float32)
    for i, topic in enumerate(TRAIN_TOPICS):
        if year_matrix.get(topic, {}).get(target_year, 0) > 0:
            labels[i] = 1.0
    return labels


def compute_ground_truth_count(year_matrix, target_year):
    return int(sum(1 for topic in TRAIN_TOPICS if year_matrix.get(topic, {}).get(target_year, 0) > 0))
