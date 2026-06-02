/**
 * 当前文件负责：把感知线索转换为主体自己的意识解释。
 *
 * 注意：
 * 解释不是命令。
 * 解释不直接决定 action。
 * 同一个 WorldSignal 会因为不同意识核、人格与关系状态，被解释成不同含义。
 */

import type {
  ButlerProfile,
} from "@/ai/ai-system-gateway"
import type {
  ZiweiConsciousnessKernel,
} from "@/ai/consciousness-core/consciousness/consciousness-gateway"

import type {
  ButlerWorldPerceptionSnapshot,
  PetWorldPerceptionSnapshot,
  WorldSignal,
} from "./agent-world-perception"

export type AgentInterpretationTone =
  | "curious"
  | "careful"
  | "protective"
  | "steady"
  | "distant"
  | "open"

export type AgentInterpretationPosture =
  | "observe_first"
  | "approach_slowly"
  | "maintain_boundary"
  | "stabilize_environment"
  | "explore_carefully"
  | "record_only"

export type AgentConsciousnessInterpretation = {
  dominantMeaning: string
  tone: AgentInterpretationTone
  posture: AgentInterpretationPosture
  confidence: number
  signalId: string | null
  summary: string
  reasons: string[]
  tags: string[]
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function firstSignal(
  perception: PetWorldPerceptionSnapshot | ButlerWorldPerceptionSnapshot | null | undefined
): WorldSignal | null {
  return perception?.perceivedSignals[0] ?? null
}

function buildBaseInterpretation(input: {
  signal: WorldSignal | null
  agentTag: string
}): AgentConsciousnessInterpretation {
  if (!input.signal) {
    return {
      dominantMeaning: "no_clear_signal",
      tone: "steady",
      posture: "record_only",
      confidence: 0,
      signalId: null,
      summary: "当前没有足够明确的世界线索可供解释。",
      reasons: ["没有感知到明确 WorldSignal。"],
      tags: [input.agentTag, "consciousness_interpretation", "no_signal", "not_command"],
    }
  }

  return {
    dominantMeaning: input.signal.kind,
    tone: "steady",
    posture: "observe_first",
    confidence: clampConfidence(input.signal.intensity),
    signalId: input.signal.id,
    summary: `主体把线索解释为：${input.signal.summary}`,
    reasons: [input.signal.summary],
    tags: [
      input.agentTag,
      "consciousness_interpretation",
      `signal_${input.signal.kind}`,
      input.signal.id,
      "not_command",
    ],
  }
}

export function interpretPetWorldPerception(input: {
  perception: PetWorldPerceptionSnapshot | null | undefined
  consciousness: ZiweiConsciousnessKernel | null | undefined
}): AgentConsciousnessInterpretation {
  const signal = firstSignal(input.perception)
  const base = buildBaseInterpretation({
    signal,
    agentTag: "pet_interpretation",
  })

  if (!signal || !input.consciousness) return base

  const reasons = [...base.reasons]
  const tags = [...base.tags]
  let tone: AgentInterpretationTone = base.tone
  let posture: AgentInterpretationPosture = base.posture
  let dominantMeaning = base.dominantMeaning
  let confidence = base.confidence

  if (signal.kind === "exploration_context") {
    if (input.consciousness.noveltyResponse === "pulled_by_novelty") {
      dominantMeaning = "novelty_invitation"
      tone = "curious"
      posture = "explore_carefully"
      confidence += 8
      reasons.push("意识核对新奇变化更容易产生吸引。")
      tags.push("novelty_pulled")
    } else if (input.consciousness.noveltyResponse === "prefer_stable_known") {
      dominantMeaning = "boundary_change_to_observe"
      tone = "careful"
      posture = "observe_first"
      confidence += 3
      reasons.push("意识核更偏向稳定熟悉，因此先观察环境变化。")
      tags.push("novelty_cautious")
    } else {
      dominantMeaning = "new_space_to_scan"
      tone = "curious"
      posture = "observe_first"
      confidence += 5
      reasons.push("意识核会先扫描变化，再决定是否进入。")
      tags.push("scan_then_enter")
    }
  }

  if (signal.kind === "background_context") {
    if (input.consciousness.recoveryResistance === "rest_when_safe") {
      dominantMeaning = "stable_background_for_recovery"
      tone = "steady"
      posture = "stabilize_environment"
      confidence += 5
      reasons.push("意识核在安全背景下更容易接受恢复。")
      tags.push("safe_recovery_interpretation")
    } else {
      dominantMeaning = "stable_background_to_monitor"
      tone = "careful"
      posture = "observe_first"
      confidence += 3
      reasons.push("意识核会把稳定背景先解释为可持续观察的环境。")
      tags.push("background_monitoring")
    }
  }

  if (input.consciousness.threatInterpretation === "avoid_first") {
    tone = tone === "curious" ? "careful" : tone
    posture = posture === "explore_carefully" ? "observe_first" : posture
    reasons.push("威胁解释风格偏先回避，因此解释结果会更保守。")
    tags.push("threat_avoid_first")
  }

  return {
    dominantMeaning,
    tone,
    posture,
    confidence: clampConfidence(confidence),
    signalId: signal.id,
    summary: `宠物把「${signal.summary}」解释为 ${dominantMeaning}。`,
    reasons: reasons.slice(0, 6),
    tags: Array.from(new Set(tags)).slice(0, 24),
  }
}

export function interpretButlerWorldPerception(input: {
  perception: ButlerWorldPerceptionSnapshot | null | undefined
  profile: ButlerProfile | null | undefined
}): AgentConsciousnessInterpretation {
  const signal = firstSignal(input.perception)
  const base = buildBaseInterpretation({
    signal,
    agentTag: "butler_interpretation",
  })

  if (!signal) return base

  const reasons = [...base.reasons]
  const tags = [...base.tags]
  let tone: AgentInterpretationTone = base.tone
  let posture: AgentInterpretationPosture = base.posture
  let dominantMeaning = base.dominantMeaning
  let confidence = base.confidence

  if (signal.kind === "care_context") {
    dominantMeaning = "care_responsibility_signal"
    tone = "protective"
    posture = "stabilize_environment"
    confidence += 8
    reasons.push("管家把照护类线索解释为环境稳定责任。")
    tags.push("butler_care_responsibility")
  }

  if (signal.kind === "maintenance_context") {
    dominantMeaning = "maintenance_responsibility_signal"
    tone = "careful"
    posture = "stabilize_environment"
    confidence += 7
    reasons.push("管家把维护类线索解释为管理责任，而不是世界命令。")
    tags.push("butler_maintenance_responsibility")
  }

  if (signal.kind === "construction_context") {
    dominantMeaning = "home_growth_management_signal"
    tone = "steady"
    posture = "stabilize_environment"
    confidence += 5
    reasons.push("管家把建设类线索解释为家园成长管理。")
    tags.push("butler_home_growth_management")
  }

  if (signal.kind === "exploration_context") {
    dominantMeaning = "space_boundary_management_signal"
    tone = "careful"
    posture = "observe_first"
    confidence += 4
    reasons.push("管家把空间变化先解释为边界管理线索。")
    tags.push("butler_boundary_management")
  }

  if (input.profile?.behaviorBias?.butlerBehaviorBias) {
    const bias = input.profile.behaviorBias.butlerBehaviorBias

    if (bias.carePriority >= 65) {
      tone = tone === "steady" ? "protective" : tone
      confidence += 3
      reasons.push("管家人格中的照护优先级较高，使解释更偏保护。")
      tags.push("profile_high_care_priority")
    }

    if (bias.constructionDrive >= 65) {
      confidence += 3
      reasons.push("管家人格中的建设倾向较高，使家园线索更容易被重视。")
      tags.push("profile_high_construction_drive")
    }
  }

  return {
    dominantMeaning,
    tone,
    posture,
    confidence: clampConfidence(confidence),
    signalId: signal.id,
    summary: `管家把「${signal.summary}」解释为 ${dominantMeaning}。`,
    reasons: reasons.slice(0, 6),
    tags: Array.from(new Set(tags)).slice(0, 24),
  }
}
