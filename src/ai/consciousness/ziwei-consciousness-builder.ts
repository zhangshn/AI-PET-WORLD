/**
 * ======================================================
 * AI-PET-WORLD
 * Ziwei Consciousness Builder
 * ======================================================
 *
 * 当前文件负责：
 * 1. 根据 PersonalityProfile 构建紫微意识核
 * 2. 把“人格画像”提升为“意识运转规则”
 * ======================================================
 */

import type { PersonalityProfile } from "../ziwei-core/schema"
import type {
  AttachmentApproachStyle,
  ConsciousnessArchetype,
  ConsciousnessBias,
  ConsciousnessCoreDrive,
  NoveltyResponseStyle,
  OrderResponseStyle,
  RecoveryResistanceStyle,
  ThreatInterpretationStyle,
  ZiweiConsciousnessKernel,
} from "./consciousness-types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function hasSummaryKeyword(
  summaries: string[],
  keywords: string[]
): boolean {
  const joined = summaries.join(" ")
  return keywords.some((keyword) => joined.includes(keyword))
}

function deriveArchetype(
  profile: PersonalityProfile
): ConsciousnessArchetype {
  const t = profile.traits
  const s = profile.summaries ?? []

  if (
    hasSummaryKeyword(s, ["突破", "打破旧状态", "主动性较强", "行动欲"]) ||
    (t.activity >= 72 && t.discipline < 55)
  ) {
    return "challenger"
  }

  if (
    hasSummaryKeyword(s, ["探索欲偏强", "变化和可能性", "新鲜感"]) ||
    (t.curiosity >= 68 && t.activity >= 62)
  ) {
    return "seeker"
  }

  if (
    hasSummaryKeyword(s, ["稳妥", "承接", "容纳", "掌控", "统筹"]) ||
    (t.stability >= 68 && t.discipline >= 64)
  ) {
    return "guardian"
  }

  if (
    hasSummaryKeyword(s, ["观察", "理解", "留意", "判断"]) ||
    (t.emotionalSensitivity >= 68 && t.activity <= 58)
  ) {
    return "observer"
  }

  if (
    hasSummaryKeyword(s, ["和气", "柔软", "缓冲", "公平", "分寸"]) ||
    (t.stability >= 58 && t.restPreference >= 52)
  ) {
    return "harmonizer"
  }

  return "wanderer"
}

function deriveCoreDrive(
  archetype: ConsciousnessArchetype
): ConsciousnessCoreDrive {
  switch (archetype) {
    case "seeker":
      return "expand"
    case "guardian":
      return "stabilize"
    case "observer":
      return "understand"
    case "harmonizer":
      return "connect"
    case "challenger":
      return "breakthrough"
    case "wanderer":
    default:
      return "drift"
  }
}

function deriveBias(
  archetype: ConsciousnessArchetype,
  profile: PersonalityProfile
): ConsciousnessBias {
  const t = profile.traits

  const base: ConsciousnessBias = {
    restResistance: 50,
    riskTolerance: 50,
    attachmentBias: 50,
    observationBias: 50,
    comfortSeeking: 50,
    changeSeeking: 50,
  }

  switch (archetype) {
    case "challenger":
      base.restResistance = 78
      base.riskTolerance = 82
      base.attachmentBias = 44
      base.observationBias = 46
      base.comfortSeeking = 28
      base.changeSeeking = 88
      break

    case "seeker":
      base.restResistance = 64
      base.riskTolerance = 70
      base.attachmentBias = 48
      base.observationBias = 56
      base.comfortSeeking = 36
      base.changeSeeking = 80
      break

    case "guardian":
      base.restResistance = 42
      base.riskTolerance = 36
      base.attachmentBias = 72
      base.observationBias = 60
      base.comfortSeeking = 74
      base.changeSeeking = 34
      break

    case "observer":
      base.restResistance = 48
      base.riskTolerance = 38
      base.attachmentBias = 40
      base.observationBias = 88
      base.comfortSeeking = 56
      base.changeSeeking = 38
      break

    case "harmonizer":
      base.restResistance = 34
      base.riskTolerance = 30
      base.attachmentBias = 78
      base.observationBias = 58
      base.comfortSeeking = 84
      base.changeSeeking = 28
      break

    case "wanderer":
    default:
      base.restResistance = 56
      base.riskTolerance = 50
      base.attachmentBias = 46
      base.observationBias = 62
      base.comfortSeeking = 46
      base.changeSeeking = 58
      break
  }

  return {
    restResistance: clamp(
      base.restResistance +
        (t.activity - 50) * 0.18 -
        (t.restPreference - 50) * 0.12
    ),
    riskTolerance: clamp(
      base.riskTolerance +
        (t.activity - 50) * 0.14 +
        (t.curiosity - 50) * 0.1 -
        (t.stability - 50) * 0.08
    ),
    attachmentBias: clamp(
      base.attachmentBias +
        (t.stability - 50) * 0.16
    ),
    observationBias: clamp(
      base.observationBias +
        (t.emotionalSensitivity - 50) * 0.18 +
        (t.curiosity - 50) * 0.08
    ),
    comfortSeeking: clamp(
      base.comfortSeeking +
        (t.restPreference - 50) * 0.22 -
        (t.activity - 50) * 0.08
    ),
    changeSeeking: clamp(
      base.changeSeeking +
        (t.activity - 50) * 0.16 +
        (t.curiosity - 50) * 0.16 -
        (t.discipline - 50) * 0.06
    ),
  }
}

function deriveThreatInterpretation(
  archetype: ConsciousnessArchetype,
  bias: ConsciousnessBias
): ThreatInterpretationStyle {
  if (archetype === "observer") return "observe_first"
  if (archetype === "guardian") return "stabilize_first"
  if (archetype === "challenger" && bias.riskTolerance >= 70) {
    return "test_boundary"
  }
  if (bias.riskTolerance <= 40) return "avoid_first"
  return "counter_if_needed"
}

function deriveAttachmentApproach(
  archetype: ConsciousnessArchetype,
  bias: ConsciousnessBias
): AttachmentApproachStyle {
  if (archetype === "harmonizer") return "warm_and_open"
  if (archetype === "guardian") return "relationship_as_anchor"
  if (archetype === "observer") return "slow_confirm_then_approach"
  if (archetype === "challenger") return "control_then_approach"
  if (bias.attachmentBias <= 42) return "selective_distance"
  return "slow_confirm_then_approach"
}

function deriveRecoveryResistance(
  archetype: ConsciousnessArchetype,
  bias: ConsciousnessBias
): RecoveryResistanceStyle {
  if (archetype === "harmonizer") return "prefer_soft_recovery"
  if (archetype === "guardian") return "rest_when_safe"
  if (bias.restResistance >= 75) return "resist_rest_until_low"
  if (bias.restResistance >= 60) return "delay_rest"
  return "rest_when_safe"
}

function deriveNoveltyResponse(
  archetype: ConsciousnessArchetype,
  bias: ConsciousnessBias
): NoveltyResponseStyle {
  if (archetype === "seeker") return "pulled_by_novelty"
  if (archetype === "observer") return "scan_then_enter"
  if (archetype === "guardian") return "prefer_stable_known"
  if (bias.changeSeeking >= 72) return "pulled_by_novelty"
  return "curious_but_cautious"
}

function deriveOrderResponse(
  archetype: ConsciousnessArchetype,
  profile: PersonalityProfile
): OrderResponseStyle {
  const t = profile.traits

  if (archetype === "guardian") return "follow_structure"
  if (archetype === "challenger" && t.discipline < 62) {
    return "challenge_structure"
  }
  if (t.discipline >= 68) return "follow_structure"
  if (t.activity >= 66 && t.curiosity >= 62) return "selective_acceptance"
  return "build_own_order"
}

function buildSummaries(
  archetype: ConsciousnessArchetype,
  coreDrive: ConsciousnessCoreDrive,
  bias: ConsciousnessBias,
  threatInterpretation: ThreatInterpretationStyle,
  recoveryResistance: RecoveryResistanceStyle
): string[] {
  const results: string[] = []

  switch (archetype) {
    case "seeker":
      results.push("意识更容易被新变化和外部可能性牵引。")
      break
    case "guardian":
      results.push("意识更倾向先稳住结构，再决定下一步。")
      break
    case "observer":
      results.push("意识更倾向先理解世界，再决定是否进入。")
      break
    case "harmonizer":
      results.push("意识更重视舒适、平衡与关系缓冲。")
      break
    case "challenger":
      results.push("意识更倾向通过突破边界来确认自身存在。")
      break
    case "wanderer":
      results.push("意识更容易在流动中寻找方向，而不是先固定目标。")
      break
  }

  switch (coreDrive) {
    case "expand":
      results.push("长期核心驱动力偏向向外扩展。")
      break
    case "stabilize":
      results.push("长期核心驱动力偏向维持与承接。")
      break
    case "understand":
      results.push("长期核心驱动力偏向观察与理解。")
      break
    case "connect":
      results.push("长期核心驱动力偏向连接与靠近。")
      break
    case "breakthrough":
      results.push("长期核心驱动力偏向突破旧状态。")
      break
    case "drift":
      results.push("长期核心驱动力偏向顺势流动。")
      break
  }

  if (threatInterpretation === "observe_first") {
    results.push("面对不确定变化时，通常会先观察而不是立刻进入。")
  }

  if (recoveryResistance === "resist_rest_until_low") {
    results.push("在没有到达明显低点前，不太愿意主动停下来恢复。")
  }

  if (bias.changeSeeking >= 72) {
    results.push("对变化与新鲜刺激有持续拉力。")
  }

  if (bias.comfortSeeking >= 72) {
    results.push("会较早把舒适和恢复纳入决定。")
  }

  return results
}

export function buildZiweiConsciousnessKernel(
  personalityProfile: PersonalityProfile
): ZiweiConsciousnessKernel {
  const archetype = deriveArchetype(personalityProfile)
  const coreDrive = deriveCoreDrive(archetype)
  const bias = deriveBias(archetype, personalityProfile)

  const threatInterpretation = deriveThreatInterpretation(archetype, bias)
  const attachmentApproach = deriveAttachmentApproach(archetype, bias)
  const recoveryResistance = deriveRecoveryResistance(archetype, bias)
  const noveltyResponse = deriveNoveltyResponse(archetype, bias)
  const orderResponse = deriveOrderResponse(archetype, personalityProfile)

  const summaries = buildSummaries(
    archetype,
    coreDrive,
    bias,
    threatInterpretation,
    recoveryResistance
  )

  return {
    archetype,
    coreDrive,
    threatInterpretation,
    attachmentApproach,
    recoveryResistance,
    noveltyResponse,
    orderResponse,
    bias,
    summaries,
  }
}