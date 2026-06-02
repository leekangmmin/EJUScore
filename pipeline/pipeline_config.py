"""
EJU Intelligence Platform - Pipeline Configuration
Central configuration for the dataset construction pipeline.
"""
import os

# Source directories
COMPREHENSIVE_DIR = "/Users/igangmin/Desktop/에쥬 기출/종합과목"
MATHEMATICS_DIR = "/Users/igangmin/Desktop/에쥬 기출/에쥬 수학기출"

# Output base - relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

# Output subdirectories
COMPREHENSIVE_OUTPUT = os.path.join(DATASET_DIR, "comprehensive")
MATHEMATICS_OUTPUT = os.path.join(DATASET_DIR, "mathematics")
TREND_ANALYSIS_DIR = os.path.join(DATASET_DIR, "trend-analysis")
TOPIC_FREQUENCY_DIR = os.path.join(DATASET_DIR, "topic-frequency")
KNOWLEDGE_GRAPH_DIR = os.path.join(DATASET_DIR, "knowledge-graph")
REPORTS_DIR = os.path.join(DATASET_DIR, "reports")

# OCR Configuration
TESSERACT_LANG = "jpn+eng"
OCR_DPI = 150  # Reduced from 300 for speed (still good quality for text)
OCR_CONFIDENCE_THRESHOLD = 0.8

# Japanese era to Gregorian year mapping
ERA_MAP = {
    "平成14": 2002, "平成15": 2003, "平成16": 2004,
    "平成17": 2005, "平成18": 2006, "平成19": 2007,
    "平成20": 2008, "平成21": 2009, "平成22": 2010,
    "平成23": 2011, "平成24": 2012, "平成25": 2013,
    "平成26": 2014, "平成27": 2015, "平成28": 2016,
    "平成29": 2017, "平成30": 2018,
    "令和1": 2019, "令和2": 2020, "令和3": 2021,
    "令和4": 2022, "令和5": 2023, "令和6": 2024, "令和7": 2025,
}

# Comprehensive taxonomy
COMPREHENSIVE_TAXONOMY = {
    "economy": {"label": "Economic", "topics": {
        "market_equilibrium": "수요·공급과 시장균형", "gdp_national_income": "GDP·국민소득",
        "exchange_rate_balance": "환율·국제수지", "fiscal_tax_policy": "재정·조세정책",
        "monetary_policy": "금융·통화정책", "international_trade": "국제무역",
        "employment_labor": "고용·노동", "economic_growth": "경제성장·경기변동",
        "income_distribution": "소득분배·지니계수", "japanese_economy": "일본경제사",
    }},
    "politics": {"label": "Political", "topics": {
        "constitution_basic_rights": "헌법·기본권", "governing_institutions": "통치기구",
        "elections_parties": "선거·정당", "international_politics": "국제정치·국제기구",
        "local_governance": "지방자치", "judiciary": "사법·재판",
        "political_thought": "정치사상", "security_defense": "안전보장·방위",
    }},
    "history": {"label": "Historical", "topics": {
        "civic_revolutions": "시민혁명", "industrial_capitalism": "산업혁명·자본주의",
        "imperialism_colonialism": "제국주의·식민지", "world_wars": "세계대전",
        "cold_war": "냉전", "modern_japan": "일본근대사",
        "postwar_world": "전후세계질서", "globalization": "세계화·지역통합",
    }},
    "geography": {"label": "Geographic", "topics": {
        "climate": "기후·케펜구분", "topography_plates": "지형·판구조",
        "population_cities": "인구·도시화", "resources_agriculture": "자원·농업",
        "maps_gis": "지도·GIS", "environment": "환경·생태", "industry_transportation": "산업·교통",
    }},
    "society": {"label": "Social", "topics": {
        "environment_issues": "환경문제", "social_security": "사회보장·복지",
        "demographics": "저출산·고령화", "information_society": "정보화사회",
        "gender_equality": "젠더·평등", "multiculturalism": "다문화사회",
        "ethics_modern_society": "윤리·현대사회",
    }}
}

# Mathematics taxonomy
MATHEMATICS_TAXONOMY = {
    "algebra": {"label": "Algebra", "topics": {
        "equations_inequalities": "방정식·부등식", "quadratic_functions": "이차함수",
        "exponential_logarithm": "지수·로그", "sequences": "수열",
    }},
    "calculus": {"label": "Calculus", "topics": {
        "differentiation": "미분", "integration": "적분", "limits": "극한", "optimization": "최적화",
    }},
    "geometry": {"label": "Geometry", "topics": {
        "plane_geometry": "평면도형", "coordinate_geometry": "좌표기하",
        "vectors": "벡터", "trigonometry": "삼각함수",
    }},
    "probability": {"label": "Probability & Statistics", "topics": {
        "probability": "확률", "statistics": "통계", "combinatorics": "순열·조합", "distributions": "확률분포",
    }}
}

for d in [COMPREHENSIVE_OUTPUT, MATHEMATICS_OUTPUT, TREND_ANALYSIS_DIR,
          TOPIC_FREQUENCY_DIR, KNOWLEDGE_GRAPH_DIR, REPORTS_DIR]:
    os.makedirs(d, exist_ok=True)
