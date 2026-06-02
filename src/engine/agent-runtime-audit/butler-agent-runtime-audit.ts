/**
 * 当前文件职责：把世界运行时管家任务状态映射为 AgentCycleTrace。
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
  AgentSignalCategory,
  AgentSignalSource,
} from "@/ai/ai-system-gateway"

import type {
  ButlerTask,
} from "@/systems/butler/butler-schema"

import type {
  RuntimeButlerAgentAuditInput,
} from "./agent-runtime-audit-types"

function normalizeButlerIntentionType(task: ButlerTask): AgentIntentionType {
  if (task === "building_home") return "build"
  if (task === "watching_pet") return "observe"
  if (task === "offering_food") return "offer_opportunity"
  if (task === "offering_rest") return "offer_opportunity"
  if (task === "offering_approach") return "offer_opportunity"
  if (task === "idle") return "wait"

  return "unknown"
}

function getSignalSource(input: RuntimeButlerAgentAuditInput): AgentSignalSource {
  if (input.home && input.home.status !== "completed") return "home"
  if (input.pet) return "relation"
  return "world"
}

function getSignalCategory(input: RuntimeButlerAgentAuditInput): AgentSignalCategory {
  if (input.butler.task === "building_home") return "spatial"
  if (input.butler.task.startsWith("offering_")) return "opportunity"
  if (input.pet) return "relational"
  return "environment"
}

function buildSignalSummary(input: RuntimeButlerAgentAuditInput): string {
  if (input.butler.task === "building_home") {
    return `管家正在观察家园建设状态，家园进度 ${input.home?.progress ?? 0}。`
  }

  if (input.butler.task.startsWith("offering_")) {
    return "管家正在形成照护机会，但不会替宠物做决定。"
  }

  if (input.pet) {
    return `管家正在观察已进入系统的宠物：${input.pet.name}。`
  }

  return "管家正在观察世界基础运行与家园维护状态。"
}

function buildButlerExpression(task: ButlerTask): string {
  if (task === "building_home") return "整理家园"
  if (task === "watching_pet") return "安静观察"
  if (task === "offering_food") return "准备食物机会"
  if (task === "offering_rest") return "准备休息机会"
  if (task === "offering_approach") return "保持谨慎靠近"

  return "待命观察"
}

function buildInterpretationSummary(input: RuntimeButlerAgentAuditInput): string {
  if (input.butler.task === "building_home") {
    return "管家将当前信号解释为家园建设或维护需求。"
  }

  if (input.butler.task.startsWith("offering_")) {
    return "管家将当前信号解释为可提供但不可强制的照护机会。"
  }

  if (input.pet) {
    return "管家将当前信号解释为观察已进入系统的宠物关系。"
  }

  return "管家将当前信号解释为世界基础运行状态。"
}

function buildIntentionSummary(input: RuntimeButlerAgentAuditInput): string {
  if (input.butler.task === "building_home") {
    return "管家意图推进家园建设与维护。"
  }

  if (input.butler.task.startsWith("offering_")) {
    return "管家意图提供照护机会，等待宠物自主回应。"
  }

  if (input.butler.task === "watching_pet") {
    return "管家意图观察宠物状态并保持边界。"
  }

  return "管家意图保持待命并观察世界。"
}

function buildReasonLines(input: RuntimeButlerAgentAuditInput): string[] {
  const trace = input.butler.latestTaskDecisionTrace

  return [
    `当前任务：${input.butler.task}`,
    `当前心情：${input.butler.mood}`,
    `家园状态：${input.home?.status ?? "unknown"}`,
    input.pet ? "宠物已通过后置领养审查进入系统。" : "当前没有宠物运行态；未来需通过小镇领养中心审查。",
    trace ? `任务选择原因：${trace.reason}` : "暂无任务选择审计。",
  ]
}

function buildMemoryImpactDelta(input: RuntimeButlerAgentAuditInput): number {
  if (input.butler.task === "building_home") return 8
  if (input.butler.task.startsWith("offering_")) return 6
  if (input.butler.task === "watching_pet") return 4

  return 1
}

export function buildRuntimeButlerAgentCycleTrace(
  input: RuntimeButlerAgentAuditInput
): AgentCycleTrace {
  const signal = buildAgentSignal({
    id: `butler-signal-${input.tick}`,
    source: getSignalSource(input),
    category: getSignalCategory(input),
    polarity: "neutral",
    intensity: input.butler.task === "idle" ? 32 : 72,
    summary: buildSignalSummary(input),
    tags: [
      "butler_runtime_signal",
      `task_${input.butler.task}`,
      input.pet ? "has_pet" : "no_default_pet",
    ],
  })
  const perception = buildAgentPerception({
    agentKind: "butler",
    agentId: input.butler.name,
    signalId: signal.id,
    focus: input.butler.task === "idle" ? "monitor" : "resource_check",
    attention: input.butler.task === "idle" ? 42 : 78,
    perceivedMeaning: buildSignalSummary(input),
    reasons: buildReasonLines(input),
  })
  const interpretation = buildAgentInterpretation({
    agentKind: "butler",
    agentId: input.butler.name,
    signalId: signal.id,
    type: input.butler.task === "idle" ? "uncertain" : "resourceful",
    confidence: input.butler.task === "idle" ? 48 : 82,
    internalSummary: buildInterpretationSummary(input),
    reasons: buildReasonLines(input),
  })
  const intentionType = normalizeButlerIntentionType(input.butler.task)
  const intention = buildAgentIntention({
    agentKind: "butler",
    agentId: input.butler.name,
    type: intentionType,
    source: input.butler.task === "building_home" ? "home" : "duty",
    strength: input.butler.task === "idle" ? 28 : 78,
    summary: buildIntentionSummary(input),
    reasons: buildReasonLines(input),
  })
  const expression = buildAgentExpression({
    agentKind: "butler",
    agentId: input.butler.name,
    internalIntent: intention.type,
    visibleExpression: buildButlerExpression(input.butler.task),
    mode: input.butler.task.startsWith("offering_")
      ? "opportunity_action"
      : "environment_action",
    confidence: 84,
    reason: "管家表达当前任务，但不生成世界事实。",
  })
  const memoryImpact = buildAgentMemoryImpact({
    agentKind: "butler",
    agentId: input.butler.name,
    type: input.butler.task === "building_home"
      ? "world_impression"
      : "rhythm_impression",
    delta: buildMemoryImpactDelta(input),
    summary: "管家根据当前任务形成轻量运行记忆影响。",
    sourceSignalId: signal.id,
    sourceIntentionType: intention.type,
  })

  return buildAgentCycleTrace({
    agentKind: "butler",
    agentId: input.butler.name,
    tick: input.tick,
    signal,
    perception,
    interpretation,
    intention,
    expression,
    memoryImpact,
  })
}
