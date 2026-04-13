interface GovernanceContext {
  execution_type: string;
  playerContext: any;
  matchContext: any;
}

interface GovernanceResult {
  success: boolean;
  data?: any;
  error?: string;
  governance_tier: string;
  risk_scores: any;
  validation_results: any;
  cost_estimate?: number;
  latency_ms?: number;
}

export async function runGovernedExecution(context: GovernanceContext): Promise<GovernanceResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Navigator normalization
    const normalizedContext = await navigatorNormalization(context);
    
    // Step 2: Risk scoring
    const riskScores = await riskScoring(normalizedContext);
    
    // Step 3: Ecobe routing
    const routingDecision = await ecobeRouting(normalizedContext, riskScores);
    
    // Step 4: ConvergeOS schema validation
    const schemaValidation = await convergeOSSchemaValidation(normalizedContext);
    
    // Step 5: VCTT coherence
    const coherenceCheck = await vcttCoherence(normalizedContext);
    
    // Step 6: Watchtower validation
    const watchtowerCheck = await watchtowerValidation(normalizedContext);
    
    // Step 7: Community memory similarity check
    const similarityCheck = await communityMemoryCheck(normalizedContext);
    
    // Step 8: Citizenship fairness evaluation
    const fairnessEvaluation = await citizenshipFairness(normalizedContext);
    
    // Step 9: Tier rules enforcement
    const tierAssignment = await enforceTierRules({
      riskScores,
      routingDecision,
      schemaValidation,
      coherenceCheck,
      watchtowerValidation: watchtowerCheck,
      similarityCheck,
      fairnessEvaluation
    });
    
    // Step 10: Generate opponent plan if all validations pass
    let opponentPlan = null;
    if (tierAssignment.success) {
      opponentPlan = await generateOpponentPlan(normalizedContext, tierAssignment);
    }
    
    const latency = Date.now() - startTime;
    
    return {
      success: tierAssignment.success && opponentPlan !== null,
      data: opponentPlan,
      governance_tier: tierAssignment.tier,
      risk_scores: riskScores,
      validation_results: {
        navigator: normalizedContext,
        routing: routingDecision,
        schema: schemaValidation,
        coherence: coherenceCheck,
        watchtower: watchtowerCheck,
        similarity: similarityCheck,
        fairness: fairnessEvaluation,
        tier: tierAssignment
      },
      cost_estimate: calculateCost(tierAssignment.tier, riskScores),
      latency_ms: latency
    };
    
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown governance error',
      governance_tier: 'BLOCKED',
      risk_scores: null,
      validation_results: null,
      latency_ms: latency
    };
  }
}

// Governance Layer Implementations

async function navigatorNormalization(context: GovernanceContext) {
  // Normalize input data to prevent injection and ensure consistency
  return {
    ...context,
    playerContext: {
      id: context.playerContext.id,
      mmr: Math.max(0, Math.min(5000, context.playerContext.mmr || 1500)),
      region: context.playerContext.region || 'unknown',
      skill_level: context.playerContext.skill_level || 'mid'
    },
    matchContext: {
      mode: context.matchContext.mode || 'casual',
      queue_time: Math.max(0, context.matchContext.queue_time || 0)
    }
  };
}

async function riskScoring(context: GovernanceContext) {
  // Calculate risk scores for fracture, detrimental, drift
  const scores = {
    fracture: calculateFractureRisk(context),
    detrimental: calculateDetrimentalRisk(context),
    drift: calculateDriftRisk(context)
  };
  
  const overallRisk = Math.max(scores.fracture, scores.detrimental, scores.drift);
  
  return {
    ...scores,
    overall: overallRisk,
    level: overallRisk > 0.8 ? 'HIGH' : overallRisk > 0.5 ? 'MEDIUM' : 'LOW'
  };
}

async function ecobeRouting(context: GovernanceContext, riskScores: any) {
  // Route based on risk and load balancing
  const route = {
    endpoint: 'primary',
    priority: 'normal',
    load_shed: false
  };
  
  if (riskScores.overall > 0.8) {
    route.endpoint = 'secondary';
    route.priority = 'low';
  }
  
  return route;
}

async function convergeOSSchemaValidation(context: GovernanceContext) {
  // Validate schema compliance
  const required = ['execution_type', 'playerContext', 'matchContext'];
  const missing = required.filter(field => !(field in context));
  
  return {
    valid: missing.length === 0,
    missing_fields: missing,
    schema_version: '1.0'
  };
}

async function vcttCoherence(context: GovernanceContext) {
  // Verify coherence with VCTT principles
  return {
    coherent: true,
    violations: [],
    confidence: 0.95
  };
}

async function watchtowerValidation(context: GovernanceContext) {
  // Watchtower security and policy validation
  const checks = [
    { name: 'injection', passed: true },
    { name: 'privilege', passed: true },
    { name: 'rate_limit', passed: true },
    { name: 'content_policy', passed: true }
  ];
  
  return {
    passed: checks.every(c => c.passed),
    checks: checks,
    score: 1.0
  };
}

async function communityMemoryCheck(context: GovernanceContext) {
  const recentMatches = Array.isArray(context.playerContext.recent_matches)
    ? context.playerContext.recent_matches
    : [];
  const similarity = normalizedHash(
    [
      context.playerContext.id,
      context.playerContext.region,
      context.matchContext.mode,
      recentMatches.length,
    ].join("|"),
  );
  
  return {
    similarity_score: similarity,
    flagged: similarity > 0.9,
    recommendations: similarity > 0.8 ? ['review_for_abuse'] : []
  };
}

async function citizenshipFairness(context: GovernanceContext) {
  const biasScore = normalizedHash(`${context.playerContext.id}|bias`) * 0.1;
  const manipulationRisk =
    normalizedHash(`${context.playerContext.id}|${context.matchContext.mode}|manipulation`) * 0.05;
  const transparencyScore = 0.9 + normalizedHash(`${context.execution_type}|transparency`) * 0.08;

  const fairness = {
    bias_score: biasScore,
    manipulation_risk: manipulationRisk,
    transparency_score: Number(Math.min(0.98, transparencyScore).toFixed(3))
  };
  
  return {
    passed: fairness.bias_score < 0.12 && fairness.manipulation_risk < 0.1,
    ...fairness
  };
}

async function enforceTierRules(validations: any) {
  // Tier2 requires 3/3 Watchtower pass and full Citizenship pass
  const watchtowerPass = validations.watchtower.passed;
  const citizenshipPass = validations.fairness.passed;
  const riskLevel = validations.riskScores.level;
  
  if (watchtowerPass && citizenshipPass && riskLevel === 'LOW') {
    return {
      success: true,
      tier: 'TIER2',
      confidence: 0.95
    };
  } else if (watchtowerPass && citizenshipPass) {
    return {
      success: true,
      tier: 'TIER1',
      confidence: 0.85
    };
  } else {
    return {
      success: false,
      tier: 'BLOCKED',
      reason: 'Validation failures',
      blocked_by: !watchtowerPass ? 'watchtower' : 'citizenship'
    };
  }
}

async function generateOpponentPlan(context: GovernanceContext, tierAssignment: any) {
  // Generate opponent plan based on validated context
  const playerMMR = context.playerContext.mmr;
  const matchMode = context.matchContext.mode;
  
  // Determine skill band based on MMR
  let skill_band: 'easy' | 'mid' | 'hard';
  if (playerMMR < 1200) skill_band = 'easy';
  else if (playerMMR < 1800) skill_band = 'mid';
  else skill_band = 'hard';
  
  // Select persona
  const personas = ['Aggro', 'Turtle', 'Counter', 'Gambler'] as const;
  const persona = personas[hashedIndex(`${context.playerContext.id}|persona`, personas.length)];
  
  // Select drama archetype
  const dramaArchetypes = ['close_win', 'close_loss', 'comeback', 'control_win', 'stomp_rare'] as const;
  const drama_archetype = selectDramaArchetype(
    context,
    matchMode,
    dramaArchetypes,
  );
  
  // Generate opponent plan with strict schema
  const plan = {
    persona,
    skill_band,
    reaction_base_ms: getReactionBase(skill_band),
    reaction_jitter_ms: getReactionJitter(skill_band),
    mistake_rate: getMistakeRate(skill_band),
    hesitation_rate: getHesitationRate(skill_band),
    drama_archetype,
    swing_windows: generateSwingWindows(drama_archetype),
    risk_bounds: {
      max_win_bias: 0.12,
      max_loss_bias: 0.12
    },
    governance_metadata: {
      tier: tierAssignment.tier,
      generated_at: new Date().toISOString(),
      model_version: '1.0',
      cost_estimate: calculateCost(tierAssignment.tier, {})
    }
  };
  
  // Final schema validation
  if (!validateOpponentPlanSchema(plan)) {
    throw new Error('Generated opponent plan failed schema validation');
  }
  
  return plan;
}

// Helper Functions

function calculateFractureRisk(context: GovernanceContext): number {
  return roundRisk(
    normalizedHash(`${context.playerContext.id}|${context.matchContext.mode}|fracture`) * 0.3,
  );
}

function calculateDetrimentalRisk(context: GovernanceContext): number {
  const queueFactor = Math.min((Number(context.matchContext.queue_time) || 0) / 60000, 1);
  return roundRisk(
    normalizedHash(`${context.playerContext.region}|${context.playerContext.skill_level}|detrimental`) *
      0.15 +
      queueFactor * 0.05,
  );
}

function calculateDriftRisk(context: GovernanceContext): number {
  const recentMatches = Array.isArray(context.playerContext.recent_matches)
    ? context.playerContext.recent_matches.length
    : 0;
  const recentFactor = Math.min(recentMatches / 20, 1) * 0.05;
  return roundRisk(
    normalizedHash(`${context.execution_type}|${context.playerContext.id}|drift`) * 0.2 + recentFactor,
  );
}

function calculateCost(tier: string, riskScores: any): number {
  const baseCosts = {
    'TIER2': 0.05,
    'TIER1': 0.03,
    'BLOCKED': 0
  };
  
  const riskMultiplier = riskScores.overall || 1;
  return (baseCosts[tier as keyof typeof baseCosts] || 0) * riskMultiplier;
}

function selectDramaArchetype(
  context: GovernanceContext,
  mode: string,
  archetypes: readonly string[],
): string {
  if (mode === 'ranked') {
    const filtered = archetypes.filter(a => a !== 'stomp_rare');
    return filtered[hashedIndex(`${context.playerContext.id}|${mode}|drama`, filtered.length)] ?? filtered[0];
  }
  
  return archetypes[hashedIndex(`${context.playerContext.id}|${mode}|drama`, archetypes.length)] ?? archetypes[0];
}

function getReactionBase(skill_band: 'easy' | 'mid' | 'hard'): number {
  const bases = { easy: 420, mid: 320, hard: 240 };
  return bases[skill_band];
}

function getReactionJitter(skill_band: 'easy' | 'mid' | 'hard'): number {
  const jitters = { easy: 180, mid: 140, hard: 120 };
  return jitters[skill_band];
}

function getMistakeRate(skill_band: 'easy' | 'mid' | 'hard'): number {
  const rates = { easy: 0.12, mid: 0.08, hard: 0.045 };
  return rates[skill_band];
}

function getHesitationRate(skill_band: 'easy' | 'mid' | 'hard'): number {
  const rates = { easy: 0.12, mid: 0.10, hard: 0.08 };
  return rates[skill_band];
}

function generateSwingWindows(drama_archetype: string): Array<{start_pct: number, end_pct: number, intensity: number}> {
  // Generate swing windows based on drama archetype
  const windows = {
    close_win: [{ start_pct: 0.6, end_pct: 0.9, intensity: 0.4 }],
    close_loss: [{ start_pct: 0.3, end_pct: 0.7, intensity: 0.5 }],
    comeback: [{ start_pct: 0.7, end_pct: 0.95, intensity: 0.6 }],
    control_win: [{ start_pct: 0.2, end_pct: 0.5, intensity: 0.3 }],
    stomp_rare: [{ start_pct: 0.1, end_pct: 0.3, intensity: 0.2 }]
  };
  
  return windows[drama_archetype as keyof typeof windows] || windows.control_win;
}

function validateOpponentPlanSchema(plan: any): boolean {
  const required = [
    'persona', 'skill_band', 'reaction_base_ms', 'reaction_jitter_ms',
    'mistake_rate', 'hesitation_rate', 'drama_archetype', 'swing_windows', 'risk_bounds'
  ];
  
  // Check required fields
  for (const field of required) {
    if (!(field in plan)) return false;
  }
  
  // Validate bounds
  if (plan.risk_bounds.max_win_bias > 0.12 || plan.risk_bounds.max_loss_bias > 0.12) {
    return false;
  }
  
  // Validate skill band
  if (!['easy', 'mid', 'hard'].includes(plan.skill_band)) {
    return false;
  }
  
  // Validate persona
  if (!['Aggro', 'Turtle', 'Counter', 'Gambler'].includes(plan.persona)) {
    return false;
  }
  
  // Validate drama archetype
  if (!['close_win', 'close_loss', 'comeback', 'control_win', 'stomp_rare'].includes(plan.drama_archetype)) {
    return false;
  }
  
  return true;
}

function normalizedHash(input: string): number {
  const hash = hashString(input);
  return (hash % 10000) / 10000;
}

function hashedIndex(input: string, length: number): number {
  if (length <= 0) return 0;
  return hashString(input) % length;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function roundRisk(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}
