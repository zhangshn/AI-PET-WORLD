/**
 * 当前文件职责：根据管家的世界感知与最近结果生成当前意识状态。
 */

import type {
  ButlerAutonomyInput,
  ButlerConsciousState,
  ButlerWorldPerception,
} from "./schema"

export function buildButlerConsciousState(input: {
  input: ButlerAutonomyInput
  perception: ButlerWorldPerception
}): ButlerConsciousState {
  const rejectedCount = input.input.recentSafeApplyResult?.rejectedDiffs.length ?? 0
  const acceptedCount = input.input.recentSafeApplyResult?.acceptedDiffIds.length ?? 0
  const focus = buildFocus({
    rejectedCount,
    perception: input.perception,
  })
  const emotionalTone = buildEmotionalTone({
    rejectedCount,
    perception: input.perception,
  })

  return {
    stateId: `butler-conscious-${input.input.worldId}-${input.input.now}`,
    focus,
    emotionalTone,
    attentionLevel: clampScore(55 + input.perception.risks.length * 12),
    cautionLevel: clampScore(
      input.perception.resourcePressure +
        input.perception.spacePressure / 2 +
        rejectedCount * 12
    ),
    confidenceLevel: clampScore(55 + acceptedCount * 10 - rejectedCount * 14),
    recoveryPressure: clampScore(rejectedCount * 25),
    reason: buildReason({
      rejectedCount,
      acceptedCount,
      riskCount: input.perception.risks.length,
      focus,
    }),
    tags: [
      "butler_conscious_state",
      "derived_from_world_perception",
      "no_home_map_write",
      focus,
      emotionalTone,
    ],
  }
}

function buildFocus(input: {
  rejectedCount: number
  perception: ButlerWorldPerception
}): ButlerConsciousState["focus"] {
  if (input.rejectedCount > 0) return "recovering"
  if (input.perception.resourcePressure >= 60) return "waiting"
  if (input.perception.boundaryMaintenanceNeed >= 55) return "maintaining"
  if (input.perception.adoptionReadinessConcern >= 60) return "protecting"
  return "observing"
}

function buildEmotionalTone(input: {
  rejectedCount: number
  perception: ButlerWorldPerception
}): ButlerConsciousState["emotionalTone"] {
  if (input.rejectedCount > 0) return "frustrated"
  if (input.perception.resourcePressure >= 60) return "cautious"
  if (input.perception.adoptionReadinessConcern >= 55) return "protective"
  if (input.perception.risks.length >= 2) return "focused"
  return "calm"
}

function buildReason(input: {
  rejectedCount: number
  acceptedCount: number
  riskCount: number
  focus: ButlerConsciousState["focus"]
}): string {
  if (input.rejectedCount > 0) {
    return "上一轮存在被拒绝的世界变化，管家会先恢复、观察并降低重复尝试。"
  }

  if (input.acceptedCount > 0) {
    return "上一轮变化已被世界接受，管家的信心轻微提高，但仍会继续观察资源和生态。"
  }

  if (input.riskCount > 0) {
    return "管家观察到资源、空间或照护相关风险，当前意识会更谨慎。"
  }

  if (input.focus === "maintaining") {
    return "管家注意到自然边界和土地状态，需要先维持世界稳定。"
  }

  return "管家正在读取资源、生态、空间与建设状态，先形成自主判断。"
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
