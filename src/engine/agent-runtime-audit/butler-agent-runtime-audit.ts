/**
 * 当前文件负责：把世界运行时管家任务状态映射为 AgentCycleTrace。
 */

import {
  buildAgentCycleTrace,
  buildAgentExpression,
  buildAgentInterpretation,
  buildAgentIntention,
  buildAgentMemoryImpact,
  buildAgentPerception,
  buildAgentSignal,
} from "@/ai/gateway"

import type {
  AgentCycleTrace,
  AgentIntentionType,
  AgentSignalCategory,
  AgentSignalSource,
} from "@/ai/gateway"

import {
  buildButlerProfileTaskTuning,
} from "@/systems/butler/butler-gateway"

import type {
  ButlerTask,
} from "@/systems/butler/butler-schema"

import type {
  RuntimeButlerAgentAuditInput,
} from "./agent-runtime-audit-types"

function normalizeButlerIntentionType(task: ButlerTask): AgentIntentionType {
  if (task === "watching_incubator") return "watch_over"
  if (task === "building_home") return "build"
  if (task === "watching_pet") return "observe"
  if (task === "offering_food") return "offer_opportunity"
  if (task === "offering_rest") return "offer_opportunity"
  if (task === "offering_approach") return "offer_opportunity"
  if (task === "idle") return "wait"

  return "unknown"
}

function getSignalSource(input: RuntimeButlerAgentAuditInput): AgentSignalSource {
  if (
    input.incubator &&
    input.incubator.status !== "hatched" &&
    input.incubator.progress < 100
  ) {
    return "home"
  }

  if (input.pet) {
    return "relation"
  }

  if (input.home && input.home.status !== "completed") {
    return "home"
  }

  return "time"
}

function getSignalCategory(
  input: RuntimeButlerAgentAuditInput
): AgentSignalCategory {
  if (
    input.incubator &&
    input.incubator.status !== "hatched" &&
    input.incubator.progress < 100
  ) {
    return "resource"
  }

  if (input.butler.task.startsWith("offering_")) {
    return "opportunity"
  }

  if (input.pet) {
    return "relational"
  }

  if (input.home && input.home.status !== "completed") {
    return "spatial"
  }

  return "temporal"
}

function buildButlerProfileTags(
  input: RuntimeButlerAgentAuditInput
): string[] {
  const profile = input.butler.profile

  if (!profile) {
    return ["no_butler_profile"]
  }

  return [
    `mapping_${profile.identity.mappingMode}`,
    `birth_${profile.identity.birthTimeMode}`,
    `care_${profile.careStyle}`,
    `build_${profile.buildStyle}`,
    `boundary_${profile.boundaryStyle}`,
    `opportunity_${profile.opportunityStyle}`,
  ]
}

function buildButlerProfileReasonLines(
  input: RuntimeButlerAgentAuditInput
): string[] {
  const profile = input.butler.profile

  if (!profile) {
    return [
      "管家 Profile 尚未注入，本轮只根据任务、环境和旧行为偏置进行审计。",
    ]
  }

  return [
    `管家映射模式：${profile.identity.mappingMode}。`,
    `出生时间模式：${profile.identity.birthTimeMode}。`,
    `照护风格：${profile.careStyle}。`,
    `建设风格：${profile.buildStyle}。`,
    `边界风格：${profile.boundaryStyle}。`,
    `机会提供方式：${profile.opportunityStyle}。`,
    `Profile Bias：carePriority=${profile.bias.carePriority}，constructionDrive=${profile.bias.constructionDrive}，observationPatience=${profile.bias.observationPatience}，boundarySensitivity=${profile.bias.boundarySensitivity}，opportunityInitiative=${profile.bias.opportunityInitiative}。`,
  ]
}

function buildButlerProfileTuningReasonLines(
  input: RuntimeButlerAgentAuditInput
): string[] {
  const profile = input.butler.profile

  if (!profile) {
    return [
      "Profile Tuning：未注入 ButlerProfile，本轮没有 Profile 调参。",
    ]
  }

  const tuning = buildButlerProfileTaskTuning(profile)

  return [
    `Profile Tuning：carePriorityOffset=${tuning.carePriorityOffset}，constructionDriveOffset=${tuning.constructionDriveOffset}，foodSensitivityOffset=${tuning.foodSensitivityOffset}，restSensitivityOffset=${tuning.restSensitivityOffset}，approachSensitivityOffset=${tuning.approachSensitivityOffset}，observationBiasOffset=${tuning.observationBiasOffset}。`,
  ]
}

function buildButlerProfileSummary(
  input: RuntimeButlerAgentAuditInput
): string {
  const profile = input.butler.profile

  if (!profile) {
    return "当前管家尚未绑定 ButlerProfile。"
  }

  return [
    "当前管家已绑定 ButlerProfile",
    `模式=${profile.identity.mappingMode}`,
    `照护=${profile.careStyle}`,
    `建设=${profile.buildStyle}`,
    `边界=${profile.boundaryStyle}`,
    `机会=${profile.opportunityStyle}`,
  ].join("，")
}

function buildButlerSignalSummary(
  input: RuntimeButlerAgentAuditInput
): string {
  const profileSummary = buildButlerProfileSummary(input)

  if (
    input.incubator &&
    input.incubator.status !== "hatched" &&
    input.incubator.progress < 100
  ) {
    return `孵化器仍在运行，进度 ${input.incubator.progress}，稳定度 ${input.incubator.stability}。${profileSummary}`
  }

  if (input.butler.task === "offering_food") {
    return `宠物需求可能上升，管家准备提供食物机会。${profileSummary}`
  }

  if (input.butler.task === "offering_rest") {
    return `宠物可能需要恢复，管家准备提供休息机会。${profileSummary}`
  }

  if (input.butler.task === "offering_approach") {
    return `宠物关系状态允许靠近，管家准备提供互动机会。${profileSummary}`
  }

  if (input.butler.task === "building_home") {
    return `家园仍有建设空间，管家将注意力放在环境维护上。${profileSummary}`
  }

  if (input.butler.task === "watching_pet") {
    return `宠物已经出生，管家保持观察但不直接控制宠物行为。${profileSummary}`
  }

  return `当前没有紧急事务，管家维持待命观察。${profileSummary}`
}

function buildButlerPerceptionReasons(
  input: RuntimeButlerAgentAuditInput
): string[] {
  const reasons: string[] = [
    `当前任务：${input.butler.task}`,
    `当前心情：${input.butler.mood}`,
    `当前时间：Day ${input.time.day} - ${input.time.hour}:00`,
  ]

  if (input.incubator) {
    reasons.push(
      `孵化器状态：${input.incubator.status}，进度 ${input.incubator.progress}。`
    )
  }

  if (input.pet) {
    reasons.push(
      `宠物状态：能量 ${Math.round(input.pet.energy)}，饥饿 ${Math.round(input.pet.hunger)}，阶段 ${input.pet.lifeState.phase}。`
    )
  }

  if (input.home) {
    reasons.push(
      `家园状态：${input.home.status}，等级 ${input.home.level}。`
    )
  }

  reasons.push(...buildButlerProfileReasonLines(input))
  reasons.push(...buildButlerProfileTuningReasonLines(input))

  return reasons
}

function buildButlerInterpretationType(task: ButlerTask) {
  if (task === "watching_incubator") return "demanding"
  if (task === "building_home") return "resourceful"
  if (task.startsWith("offering_")) return "comforting"
  if (task === "watching_pet") return "familiar"
  if (task === "idle") return "irrelevant"

  return "unknown"
}

function buildButlerInterpretationSummary(
  input: RuntimeButlerAgentAuditInput
): string {
  const profile = input.butler.profile

  if (!profile) {
    return "管家将当前世界状态解释为需要维护、观察或提供机会的情境。当前尚未接入 ButlerProfile。"
  }

  return [
    "管家将当前世界状态解释为需要维护、观察或提供机会的情境。",
    `本轮解释会参考 ButlerProfile：${profile.identity.mappingMode} / ${profile.careStyle} / ${profile.buildStyle} / ${profile.boundaryStyle} / ${profile.opportunityStyle}。`,
    "Profile 只参与解释和审计，不直接控制宠物行为。",
  ].join("")
}

function buildButlerIntentionSummary(
  input: RuntimeButlerAgentAuditInput
): string {
  const task = input.butler.task
  const profile = input.butler.profile

  const profileText = profile
    ? `管家当前 Profile 倾向：照护=${profile.careStyle}，建设=${profile.buildStyle}，边界=${profile.boundaryStyle}，机会=${profile.opportunityStyle}。`
    : "管家当前尚未绑定 Profile。"

  if (task === "watching_incubator") {
    return `管家的内部意图是维持孵化器稳定。${profileText}`
  }

  if (task === "building_home") {
    return `管家的内部意图是维护和建设家园环境。${profileText}`
  }

  if (task === "watching_pet") {
    return `管家的内部意图是观察宠物状态，而不是替宠物做决定。${profileText}`
  }

  if (task === "offering_food") {
    return `管家的内部意图是提供食物机会，由宠物自主接受或拒绝。${profileText}`
  }

  if (task === "offering_rest") {
    return `管家的内部意图是提供休息机会，由宠物自主接受或拒绝。${profileText}`
  }

  if (task === "offering_approach") {
    return `管家的内部意图是提供靠近机会，而不是强制互动。${profileText}`
  }

  return `管家当前保持待命。${profileText}`
}

function buildButlerExpression(task: ButlerTask): string {
  if (task === "watching_incubator") return "watching_incubator"
  if (task === "building_home") return "building_home"
  if (task === "watching_pet") return "watching_pet"
  if (task === "offering_food") return "preparing_food_opportunity"
  if (task === "offering_rest") return "preparing_rest_opportunity"
  if (task === "offering_approach") return "preparing_approach_opportunity"

  return "idle"
}

function buildButlerExpressionReason(
  input: RuntimeButlerAgentAuditInput
): string {
  const profile = input.butler.profile

  if (!profile) {
    return "管家的可见行为是管理性表达，不直接覆盖宠物自主行为。"
  }

  return [
    "管家的可见行为是管理性表达，不直接覆盖宠物自主行为。",
    `本轮表达携带 Profile 风格痕迹：照护=${profile.careStyle}，建设=${profile.buildStyle}，边界=${profile.boundaryStyle}，机会=${profile.opportunityStyle}。`,
  ].join("")
}

function buildButlerMemoryDelta(task: ButlerTask): number {
  if (task === "watching_incubator") return 1
  if (task === "building_home") return 1
  if (task.startsWith("offering_")) return 2
  if (task === "watching_pet") return 1

  return 0
}

function buildButlerMemorySummary(
  input: RuntimeButlerAgentAuditInput
): string {
  const profile = input.butler.profile

  if (!profile) {
    return "本轮管家任务结果未来可进入管家记忆，用于形成管理经验。"
  }

  return [
    "本轮管家任务结果未来可进入管家记忆，用于形成管理经验。",
    `记忆审计会保留 Profile 上下文：${profile.identity.mappingMode} / ${profile.careStyle} / ${profile.buildStyle} / ${profile.boundaryStyle} / ${profile.opportunityStyle}。`,
  ].join("")
}

export function buildRuntimeButlerAgentCycleTrace(
  input: RuntimeButlerAgentAuditInput
): AgentCycleTrace {
  const signal = buildAgentSignal({
    id: `butler-runtime-signal-${input.butler.name}-${input.tick}`,
    source: getSignalSource(input),
    category: getSignalCategory(input),
    polarity: "mixed",
    intensity:
      input.butler.task === "idle"
        ? 20
        : 70,
    summary: buildButlerSignalSummary(input),
    sourceRef: {
      kind: "world_runtime_tick",
      id: String(input.tick),
      name: input.butler.name,
    },
    tags: [
      input.butler.task,
      input.butler.mood,
      input.time.period ?? "unknown_period",
      ...buildButlerProfileTags(input),
    ],
  })

  const perception = buildAgentPerception({
    agentKind: "butler",
    agentId: input.butler.name,
    signalId: signal.id,
    focus:
      input.butler.task === "idle"
        ? "monitor"
        : "notice",
    attention:
      input.butler.task === "idle"
        ? 35
        : 76,
    perceivedMeaning:
      "管家根据孵化器、宠物、家园、时间状态和自身 Profile 形成管理性观察。",
    reasons: buildButlerPerceptionReasons(input),
  })

  const interpretation = buildAgentInterpretation({
    agentKind: "butler",
    agentId: input.butler.name,
    signalId: signal.id,
    type: buildButlerInterpretationType(input.butler.task),
    confidence:
      input.butler.task === "idle"
        ? 48
        : 82,
    internalSummary: buildButlerInterpretationSummary(input),
    reasons: [
      "管家不是宠物控制器。",
      "当前任务只能形成机会或环境维护，不能直接决定宠物行为。",
      ...buildButlerProfileReasonLines(input),
      ...buildButlerProfileTuningReasonLines(input),
    ],
  })

  const intention = buildAgentIntention({
    agentKind: "butler",
    agentId: input.butler.name,
    type: normalizeButlerIntentionType(input.butler.task),
    source:
      input.butler.task === "building_home"
        ? "home"
        : "duty",
    strength:
      input.butler.task === "idle"
        ? 28
        : 78,
    summary: buildButlerIntentionSummary(input),
    reasons: [
      `当前任务：${input.butler.task}`,
      `当前心情：${input.butler.mood}`,
      ...buildButlerProfileReasonLines(input),
      ...buildButlerProfileTuningReasonLines(input),
    ],
  })

  const expression = buildAgentExpression({
    agentKind: "butler",
    agentId: input.butler.name,
    internalIntent: intention.type,
    visibleExpression: buildButlerExpression(input.butler.task),
    mode:
      input.butler.task.startsWith("offering_")
        ? "opportunity_action"
        : "environment_action",
    confidence: 84,
    reason: buildButlerExpressionReason(input),
  })

  const memoryImpact = buildAgentMemoryImpact({
    agentKind: "butler",
    agentId: input.butler.name,
    type:
      input.butler.task === "building_home"
        ? "resource_impression"
        : "relation_impression",
    delta: buildButlerMemoryDelta(input.butler.task),
    summary: buildButlerMemorySummary(input),
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