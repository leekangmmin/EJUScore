// ═══════════════════════════════════════════════════════════════════
// AI Architecture — Hybrid Model Router with RAG and Vector Search
// Tier 1: Fast local model (Qwen 0.5B) — simple classifications
// Tier 2: Larger local model (Qwen 1.5B+) — analysis, feedback
// Tier 3: Optional cloud API (GPT-4, Claude, etc.) — complex tutoring
// Automatic routing with confidence scoring.
// ═══════════════════════════════════════════════════════════════════

import embedStore, { getQuestionEmbedding, cosineSimilarity } from '../vector/embeddingStore';

// Tier configuration
const TIERS = {
  FAST_LOCAL: {
    id: 'fast_local',
    name: 'Tier 1 — Fast Local',
    model: 'Qwen2.5-0.5B',
    capabilities: ['classify', 'extract_keywords', 'simple_qa'],
    maxTokens: 512,
    confidenceBase: 0.6,
  },
  LARGE_LOCAL: {
    id: 'large_local',
    name: 'Tier 2 — Large Local',
    model: 'Qwen2.5-1.5B',
    capabilities: ['analyze', 'generate_feedback', 'explain_concept', 'diagnose'],
    maxTokens: 2048,
    confidenceBase: 0.8,
  },
  CLOUD_API: {
    id: 'cloud_api',
    name: 'Tier 3 — Cloud API',
    models: ['gpt-4o', 'claude-3-opus', 'gemini-2.0'],
    capabilities: ['tutor', 'deep_analysis', 'root_cause', 'study_plan', 'essay_review'],
    maxTokens: 8192,
    confidenceBase: 0.95,
  },
};

/**
 * Route a request to the appropriate AI tier based on:
 *   - Task complexity
 *   - Required capabilities
 *   - Available models
 *   - User preference (privacy/performance)
 *
 * @param {object} request - { task, input, context, options }
 * @returns {Promise<object>} { result, tier, confidence, latency }
 */
export async function routeAIRequest(request) {
  const { task, input, context = {}, options = {} } = request;
  const userTier = options.preferredTier || 'auto';

  // Determine required capabilities
  const requiredCaps = getRequiredCapabilities(task, input);

  // Check if RAG can provide a direct answer
  const ragResult = await tryRAG(task, input, context);
  if (ragResult && ragResult.confidence > (options.minConfidence || 0.7)) {
    return {
      result: ragResult.answer,
      tier: 'rag',
      confidence: ragResult.confidence,
      latency: ragResult.latency,
      method: 'retrieval_augmented',
      sources: ragResult.sources,
    };
  }

  // Tier selection logic
  let selectedTier;

  if (userTier !== 'auto') {
    // User-specified tier
    selectedTier = getTierById(userTier);
  } else {
    // Automatic routing
    selectedTier = selectTier(task, requiredCaps, options);
  }

  if (!selectedTier) {
    // Fallback to fastest available
    selectedTier = TIERS.FAST_LOCAL;
  }

  // Execute with selected tier
  const startTime = performance.now();
  const result = await executeInTier(selectedTier, task, input, context, options);
  const latency = performance.now() - startTime;

  return {
    result,
    tier: selectedTier.id,
    model: selectedTier.model || selectedTier.models?.[0],
    confidence: estimateConfidence(selectedTier, result, options),
    latency,
    method: 'direct_inference',
  };
}

/**
 * Try to answer via RAG (Retrieval-Augmented Generation).
 * Searches vector embeddings for similar questions/answers.
 */
async function tryRAG(task, input, context) {
  if (!input || typeof input !== 'string') return null;
  if (input.length < 10) return null;

  const startTime = performance.now();

  try {
    // Search for similar questions in embedding store
    const threshold = task === 'classify' ? 0.85 : 0.75;
    const similarQuestions = await getQuestionEmbedding(input);

    if (!similarQuestions || similarQuestions.length === 0) {
      return null;
    }

    // Find closest match
    let bestMatch = null;
    let bestScore = 0;

    for (const sq of similarQuestions) {
      const score = cosineSimilarity(input, sq.text);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = sq;
      }
    }

    if (bestMatch && bestScore >= threshold) {
      return {
        answer: bestMatch.answer || bestMatch.text,
        confidence: bestScore,
        latency: performance.now() - startTime,
        sources: [{
          questionId: bestMatch.id,
          similarity: bestScore,
          text: bestMatch.text,
        }],
      };
    }
  } catch (e) {
    console.warn('[AI Router] RAG lookup failed:', e.message);
  }

  return null;
}

/**
 * Select the appropriate AI tier based on task and capabilities.
 */
function selectTier(task, requiredCaps, options) {
  // Check if task can be handled locally (privacy-sensitive)
  const isLocalTask = ['classify', 'extract', 'simple_diagnosis'].includes(task);
  const isComplexTask = ['tutor', 'deep_analysis', 'study_plan', 'essay_review'].includes(task);

  if (options.privacyMode && isLocalTask) {
    return TIERS.FAST_LOCAL;
  }

  // Check available AI engines
  const hasLocalAI = Boolean(window.electronAPI?.ai);
  const hasCloudAI = Boolean(options.apiKey || window.OPENAI_API_KEY);

  if (isComplexTask && hasCloudAI) {
    return TIERS.CLOUD_API;
  }

  if (hasLocalAI) {
    // Check if task requires larger model
    const needsLargeModel = requiredCaps.some(cap =>
      !TIERS.FAST_LOCAL.capabilities.includes(cap)
    );
    return needsLargeModel ? TIERS.LARGE_LOCAL : TIERS.FAST_LOCAL;
  }

  // Fallback to rule-based if no AI available
  return null;
}

/**
 * Determine required capabilities for a task.
 */
function getRequiredCapabilities(task, input) {
  const taskCapabilityMap = {
    classify: ['classify'],
    extract_keywords: ['extract_keywords'],
    generate_feedback: ['analyze', 'generate_feedback'],
    diagnose: ['diagnose'],
    explain: ['explain_concept'],
    tutor: ['analyze', 'explain_concept', 'diagnose', 'tutor'],
    deep_analysis: ['analyze', 'diagnose', 'tutor'],
    study_plan: ['analyze', 'diagnose'],
    essay_review: ['analyze', 'tutor'],
    simple_qa: ['simple_qa'],
    root_cause: ['diagnose', 'analyze'],
  };

  const caps = taskCapabilityMap[task] || ['simple_qa'];
  return caps;
}

/**
 * Execute a request in a specific tier.
 */
async function executeInTier(tier, task, input, context, options) {
  if (!tier) return generateFallbackResponse(task, input, context);

  switch (tier.id) {
    case 'fast_local':
    case 'large_local':
      return executeLocalAI(tier, task, input, context, options);
    case 'cloud_api':
      return executeCloudAI(tier, task, input, context, options);
    default:
      return generateFallbackResponse(task, input, context);
  }
}

/**
 * Execute via local AI model (Electron worker).
 */
async function executeLocalAI(tier, task, input, context, options) {
  // Check if Electron AI API is available
  if (window.electronAPI?.ai) {
    try {
      const prompt = buildPrompt(tier, task, input, context);
      const result = await window.electronAPI.ai.generate({
        messages: prompt,
        maxTokens: tier.maxTokens,
        temperature: options.temperature || 0.3,
      });
      return result;
    } catch (e) {
      console.warn('[AI Router] Local AI failed:', e.message);
    }
  }

  // Fallback to web worker
  try {
    const worker = new Worker(
      new URL('../workers/aiAnalysisWorker.js', import.meta.url),
      { type: 'module' }
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        resolve(generateFallbackResponse(task, input, context));
      }, 30000);

      worker.onmessage = (event) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(event.data.result || event.data);
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(generateFallbackResponse(task, input, context));
      };

      worker.postMessage({
        type: task,
        input,
        context,
        tier: tier.id,
        model: tier.model,
        maxTokens: tier.maxTokens,
      });
    });
  } catch (e) {
    return generateFallbackResponse(task, input, context);
  }
}

/**
 * Execute via cloud API.
 */
async function executeCloudAI(tier, task, input, context, options) {
  const apiKey = options.apiKey || window.OPENAI_API_KEY;
  if (!apiKey) return generateFallbackResponse(task, input, context);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: getSystemPrompt(task),
          },
          {
            role: 'user',
            content: formatInputForCloud(task, input, context),
          },
        ],
        max_tokens: tier.maxTokens,
        temperature: options.temperature || 0.3,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || generateFallbackResponse(task, input, context);
  } catch (e) {
    console.warn('[AI Router] Cloud API failed:', e.message);
    return generateFallbackResponse(task, input, context);
  }
}

/**
 * Build prompt for local AI.
 */
function buildPrompt(tier, task, input, context) {
  const systemPrompt = getSystemPrompt(task);
  const userPrompt = formatInputForCloud(task, input, context);

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Get system prompt for a specific task.
 */
function getSystemPrompt(task) {
  const prompts = {
    classify: `You are an EJU (Examination for Japanese University Admission) subject classifier. 
Classify the given Japanese text into one of these subjects: economy, politics, history, geography, society.
Respond with ONLY the subject name in English.`,

    extract_keywords: `Extract key EJU-related keywords and concepts from the given Japanese text.
Return as a comma-separated list.`,

    generate_feedback: `You are an EJU learning coach. Provide motivational feedback in Korean based on the student's exam data.
Be concise (2-3 sentences), warm, and encouraging. Include specific observations.`,

    diagnose: `Analyze the student's EJU exam performance and identify weaknesses.
Focus on patterns: which domains, which question types, which error types.
Provide analysis in Korean.`,

    explain_concept: `You are an EJU tutor explaining a concept to a student.
Explain in Korean with clear examples. Assume the student is preparing for Japanese university admission.
Include: 1) What the concept is 2) Why it matters for EJU 3) A simple example`,

    tutor: `You are a world-class EJU tutor. Provide comprehensive tutoring in Korean.
For the student's mistake:
1. WHY the student's answer is wrong
2. WHY the correct answer is correct
3. WHICH concept is missing
4. SIMILAR past questions for reference
5. PROBABILITY of this topic reappearing
6. RECOMMENDED study strategy`,

    deep_analysis: `Perform a deep analysis of the student's EJU exam history.
Identify: root causes, recurring patterns, knowledge gaps, and improvement trajectory.
Provide actionable insights in Korean.`,

    study_plan: `Create a personalized EJU study plan in Korean.
Based on: target scores, current level, weak areas, time until exam.
Include: daily/weekly schedule, priority topics, resource recommendations.`,

    simple_qa: `Answer the student's EJU-related question concisely in Korean.`,
  };

  return prompts[task] || prompts.simple_qa;
}

/**
 * Format input for cloud API.
 */
function formatInputForCloud(task, input, context) {
  if (typeof input === 'string') return input;

  // For complex tasks, serialize the context
  if (task === 'tutor' || task === 'deep_analysis') {
    return JSON.stringify({ question: input, context });
  }

  return JSON.stringify(input);
}

/**
 * Estimate confidence of the AI response.
 */
function estimateConfidence(tier, result, options) {
  if (!result) return 0;
  if (typeof result !== 'string' || result.length === 0) return 0;

  // Base confidence from tier
  let confidence = tier.confidenceBase || 0.5;

  // Adjust based on result quality
  if (result.length > 100) confidence += 0.1;
  if (result.includes('모르') || result.includes('모릅')) confidence -= 0.2;

  return Math.max(0.1, Math.min(0.99, confidence));
}

/**
 * Generate fallback response when AI is not available.
 */
function generateFallbackResponse(task, input, context) {
  const fallbacks = {
    classify: 'economy',
    extract_keywords: '',
    generate_feedback: '데이터를 분석 중입니다. 더 많은 시험 기록이 필요합니다.',
    diagnose: '충분한 데이터가 없어 정확한 진단이 어렵습니다. 시험 기록을 추가해주세요.',
    explain_concept: 'AI 모델을 불러올 수 없습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.',
    tutor: 'AI 튜터 모드를 사용하려면 로컬 AI 모델이 필요합니다. 설정에서 모델을 로드해주세요.',
    deep_analysis: '심층 분석을 위해서는 AI 모델 로드가 필요합니다.',
    study_plan: '학습 계획 생성을 위해 AI 모델을 로드해주세요.',
    simple_qa: '질문에 답변할 수 없습니다. AI 모델이 아직 준비되지 않았습니다.',
  };

  return fallbacks[task] || '처리 중 오류가 발생했습니다. 다시 시도해주세요.';
}

/**
 * Get tier by ID.
 */
function getTierById(id) {
  for (const tier of Object.values(TIERS)) {
    if (tier.id === id) return tier;
  }
  return null;
}

export { TIERS };
export default { routeAIRequest };
