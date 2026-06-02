/**
 * TrendDashboardData — Data loader for trend_analysis_complete.json
 * Loads the comprehensive trend analysis and prediction data into the dashboard.
 */
import { PAST_EXAM_BANK } from '../data/ejuPastExamBank';

// ── Import JSON data at build time ──
// These will be bundled by Vite
import trendCompleteData from '../../dataset/trend-analysis/trend_analysis_complete.json';
import prediction2026_2028 from '../../dataset/prediction/prediction_2026_2028.json';
import weaknessConnector from '../../dataset/prediction/weakness_connector.json';
import insightsV2 from '../../dataset/insights/insights_v2.json';

const COMPLETE_TREND = trendCompleteData;
const PREDICTION = prediction2026_2028;
const WEAKNESS = weaknessConnector;
const INSIGHTS = insightsV2;

export { COMPLETE_TREND, PREDICTION, WEAKNESS, INSIGHTS };

/**
 * Build enhanced model that combines PAST_EXAM_BANK with complete trend data
 */
export function buildEnhancedModel() {
  const jk = PAST_EXAM_BANK.jongkwa;
  const trend = COMPLETE_TREND;
  const pred = PREDICTION;
  
  // Domain metadata
  const SUBJECT_MAP = {
    economy:   { name: '경제',   color: '#10b981', icon: '💰' },
    politics:  { name: '정치',   color: '#ef4444', icon: '🏛️' },
    geography: { name: '지리',   color: '#0ea5e9', icon: '🌍' },
    history:   { name: '역사',   color: '#8b5cf6', icon: '📖' },
    society:   { name: '사회',   color: '#f59e0b', icon: '👥' },
  };

  const COMP_KEYS = ['economy', 'politics', 'geography', 'history', 'society'];

  // 1. Enhanced domain stats from trend analysis
  const domainStats = {};
  let totalQ = 0;
  COMP_KEYS.forEach(key => {
    const d = trend.domain_trends?.[key];
    const count = d?.total || 0;
    domainStats[key] = count;
    totalQ += count;
  });

  const subjectList = COMP_KEYS
    .map(k => ({
      id: k,
      ...SUBJECT_MAP[k],
      count: domainStats[k] || 0,
      pct: totalQ ? Math.round(((domainStats[k] || 0) / totalQ) * 100) : 0
    }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // 2. Enhanced byYear data from trend
  const byYear = [];
  if (trend.domain_trends) {
    const allYears = new Set();
    COMP_KEYS.forEach(key => {
      const d = trend.domain_trends[key];
      if (d?.yearly) {
        Object.keys(d.yearly).forEach(y => allYears.add(parseInt(y)));
      }
    });
    
    Array.from(allYears).sort().forEach(year => {
      const entry = { year: String(year), exams: 2, numQ: 0 };
      let total = 0;
      COMP_KEYS.forEach(key => {
        const count = trend.domain_trends?.[key]?.yearly?.[String(year)] || 0;
        entry[SUBJECT_MAP[key].name] = count;
        total += count;
      });
      entry.total = total;
      entry.numQ = total;
      byYear.push(entry);
    });
  }

  // 3. TOP 100 topics
  const top100 = (trend.top_100_topics || []).map((t, i) => ({
    rank: i + 1,
    topic: t.topic,
    domain: t.domain || '',
    total: t.total || 0,
    years: t.years_appeared || 0,
  }));

  // 4. Rising topics
  const rising = (trend.growing_topics || []).slice(0, 20).map(t => ({
    topic: t.topic,
    domain: t.domain || '',
    growth: t.growth_rate_pct || 0,
    recent5: t.period_5yr_count || 0,
    total: t.total_count || 0,
  }));

  // 5. Falling topics
  const falling = (trend.declining_topics || []).slice(0, 20).map(t => ({
    topic: t.topic,
    domain: t.domain || '',
    growth: t.growth_rate_pct || 0,
    recent5: t.period_5yr_count || 0,
    total: t.total_count || 0,
  }));

  // 6. Gap topics (long-term unused)
  const gapTopics = (trend.gap_topics || []).slice(0, 20).map(t => ({
    topic: t.topic,
    domain: t.domain || '',
    gapYears: t.gap_years || 0,
    lastYear: t.last_appeared_year,
    total: t.total_count || 0,
    priority: t.total_count >= 10 ? 'A' : t.total_count >= 5 ? 'B' : 'C',
  }));

  // 7. Predictions
  const predictions = {
    '2026': (pred.yearly?.['2026'] || []).slice(0, 30),
    '2027': (pred.yearly?.['2027'] || []).slice(0, 20),
    '2028': (pred.yearly?.['2028'] || []).slice(0, 20),
  };

  // 8. Weakness connector
  const weaknessDomains = WEAKNESS?.domains || {};

  // 9. Statistics summary
  const stats = {
    totalQuestions: trend.total_questions_analyzed || 0,
    totalYears: trend.total_years || 0,
    totalTopics: trend.total_topics_tracked || 0,
    growingCount: trend.statistics?.growing_count || 0,
    decliningCount: trend.statistics?.declining_count || 0,
    gapCount: trend.statistics?.gap_count || 0,
    period: trend.analysis_period || '',
  };

  // 10. Math-specific analysis (from PAST_EXAM_BANK)
  const math = PAST_EXAM_BANK.math;
  const mathTopics = math
    ? Object.entries(math.topics || {})
        .map(([id, name]) => ({ 
          id, name, 
          exams: math.topicExams?.[id] || 0, 
          total: math.totalExams || 0,
          pct: Math.round(((math.topicExams?.[id] || 0) / (math.totalExams || 1)) * 100) 
        }))
        .filter(t => t.exams > 0)
        .sort((a, b) => b.exams - a.exams)
    : [];

  return {
    subjectList,
    byYear,
    top100,
    rising,
    falling,
    gapTopics,
    predictions,
    weaknessDomains,
    stats,
    mathTopics,
    math,
    SUBJECT_MAP,
    COMP_KEYS,
    insights: INSIGHTS,
  };
}
