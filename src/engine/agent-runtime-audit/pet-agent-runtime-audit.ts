/**
 * 当前文件负责：把世界运行时宠物行为决策映射为 AgentCycleTrace。
 */

import {
  buildAgentCycleTrace,
  buildAgentExpression,
  buildAgentInterpretation,
  buildAgentIntention,
  buildAgentMemoryImpact,
  buildAgentPerception,
  buildAgentSignal,
} from "@/ai/ai-system-gateway"

import type {
  AgentCycleTrace,
  AgentIntentionType,
} from "@/ai/ai-system-gateway"

import type {
  RuntimePetAgentAuditInput,
} from "./agent-runtime-audit-types"

function normalizeIntentionType(value: string): AgentIntentionType {
  if (value === "eat") return "eat"
  if (value === "rest") return "rest"
  if (value === "observe") return "observe"
  if (value === "explore") return "explore"
  if (value === "approach") return "approach"
  if (value === "avoid") return "avoid"

  if (value === "restore_self") return "rest"
  if (value === "satisfy_need") return "eat"
  if (value === "observe_boundary") return "observe"
  if (value === "expand_territory") return "explore"
  if (value === "secure_attachment") return "approach"
  if (value === "preserve_distance") return "avoid"
  if (value === "stabilize_state") return "maintain"

  return "unknown"
}

function buildSignalSummary(input: RuntimePetAgentAuditInput): string {
  const sources: string[] = []

  if (input.hasCognitionInfluence) {
    sources.push("认知解释")
  }

  if (input.hasLifeTendencyInfluence) {
    sources.push("生命运行趋向")
  }

  if (input.hasGoalDriveAlignment) {
    sources.push("drive 与 goal 校正")
  }

  if (sources.length === 0) {
    sources.push("身体状态与当前目标")
  }

  return `当前宠物行为由${sources.join("、")}共同形成。`
}

function buildPerceptionReasons(input: RuntimePetAgentAuditInput): string[] {
  const reasons: string[] = [
    `当前生命阶段：${input.lifePhase}`,
    `当前能量：${Math.round(input.energy)}`,
    `当前饥饿：${Math.round(input.hunger)}`,
  ]

  if (input.hasCognitionInfluence) {
    reasons.push("世界信号已进入宠物认知层。")
  }

  if (input.hasLifeTendencyInfluence) {
    reasons.push("生命运行趋向已进入 drive 层。")
  }

  return reasons
}

function buildInterpretationReasons(input: RuntimePetAgentAuditInput): string[] {
  const reasons: string[] = [
    `主导 drive：${input.driveDominant}(${input.driveDominantScore.toFixed(2)})`,
    `当前 goal：${input.goalType}`,
    `goal 来源：${input.goalSource}`,
  ]

  if (input.hasGoalLifeTendencyHint) {
    reasons.push("生命趋向已进入 goal 解释。")
  }

  if (input.hasGoalDriveAlignment) {
    reasons.push("goal 已读取 drive alignment。")
  }

  return reasons
}

function buildIntentionReasons(input: RuntimePetAgentAuditInput): string[] {
  return [
    `raw action intent：${input.rawAction}`,
    `goal priority：${input.goalPriority}`,
    input.goalSummary,
  ]
}

function buildExpressionReason(input: RuntimePetAgentAuditInput): string {
  return [
    input.expressionSummary,
    `稳定层原因：${input.stabilityReason}`,
  ].join(" ")
}

function buildMemoryDelta(input: RuntimePetAgentAuditInput): number {
  if (input.finalAction === "resting" || input.finalAction === "sleeping") {
    return 2
  }

  if (input.finalAction === "observing") {
    return 1
  }

  if (input.finalAction === "exploring") {
    return 2
  }

  if (input.finalAction === "alert_idle") {
    return -1
  }

  return 0
}

export function buildRuntimePetAgentCycleTrace(
  input: RuntimePetAgentAuditInput
): AgentCycleTrace {
  const signal = buildAgentSignal({
    id: `pet-runtime-signal-${input.petName}-${input.tick}`,
    source: input.hasCognitionInfluence ? "world" : "body",
    category: input.hasCognitionInfluence
      ? "environment"
      : "physical",
    polarity: "mixed",
    intensity: Math.max(
      1,
      Math.min(100, input.driveDominantScore)
    ),
    summary: buildSignalSummary(input),
    sourceRef: {
      kind: "world_runtime_tick",
      id: String(input.tick),
      name: input.petName,
    },
    tags: [
      input.lifePhase,
      input.driveDominant,
      input.goalType,
    ],
  })

  const perception = buildAgentPerception({
    agentKind: "pet",
    agentId: input.petName,
    signalId: signal.id,
    focus:
      input.finalAction === "observing"
        ? "monitor"
        : "notice",
    attention: input.driveDominantScore,
    perceivedMeaning:
      "宠物根据当前身体、认知、生命趋向与目标状态形成主体感知。",
    reasons: buildPerceptionReasons(input),
  })

  const interpretation = buildAgentInterpretation({
    agentKind: "pet",
    agentId: input.petName,
    signalId: signal.id,
    type:
      input.finalAction === "alert_idle"
        ? "uncertain"
        : "interesting",
    confidence: Math.max(40, input.driveDominantScore),
    internalSummary:
      "宠物将当前世界与自身状态解释为可行动但需要经过生命阶段表达过滤的情境。",
    reasons: buildInterpretationReasons(input),
  })

  const intention = buildAgentIntention({
    agentKind: "pet",
    agentId: input.petName,
    type: normalizeIntentionType(input.driveDominant),
    source: "drive",
    strength: input.driveDominantScore,
    summary: `当前内部意图偏向 ${input.driveDominant}，候选行为为 ${input.rawAction}。`,
    reasons: buildIntentionReasons(input),
  })

  const expression = buildAgentExpression({
    agentKind: "pet",
    agentId: input.petName,
    internalIntent: input.rawAction,
    visibleExpression: input.finalAction,
    mode:
      input.rawAction === input.finalAction
        ? "visible_action"
        : "subtle_motion",
    confidence:
      input.expressedAction === input.finalAction
        ? 86
        : 68,
    reason: buildExpressionReason(input),
  })

  const memoryImpact = buildAgentMemoryImpact({
    agentKind: "pet",
    agentId: input.petName,
    type:
      input.finalAction === "resting" ||
      input.finalAction === "sleeping"
        ? "self_impression"
        : "world_impression",
    delta: buildMemoryDelta(input),
    summary:
      "本轮行为结果会作为经验候选进入后续记忆更新，而不是单纯日志。",
    sourceSignalId: signal.id,
    sourceIntentionType: intention.type,
  })

  return buildAgentCycleTrace({
    agentKind: "pet",
    agentId: input.petName,
    tick: input.tick,
    signal,
    perception,
    interpretation,
    intention,
    expression,
    memoryImpact,
  })
}