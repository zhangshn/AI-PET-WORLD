/**
 * 当前文件职责：把世界执行结果转成管家的学习反馈。
 */

import type { ConstructionSafeApplyResult } from "@/world/construction/construction-schema"

import type {
  ButlerAutonomousIntent,
  ButlerMemoryEffect,
  ButlerMemoryLearnedPreferences,
  ButlerMemoryState,
} from "./butler-autonomy-schema"

export function buildButlerLearningEffectsFromSafeApply(input: {
  selectedIntent: ButlerAutonomousIntent
  memoryState: ButlerMemoryState
  safeApplyResult?: ConstructionSafeApplyResult
}): ButlerMemoryEffect[] {
  if (!input.safeApplyResult) return []

  const acceptedCount = input.safeApplyResult.acceptedDiffIds.length
  const rejectedCount = input.safeApplyResult.rejectedDiffs.length
  const effects: ButlerMemoryEffect[] = []

  if (acceptedCount > 0) {
    effects.push(
      buildAcceptedEffect({
        selectedIntent: input.selectedIntent,
        memoryState: input.memoryState,
        acceptedCount,
      })
    )
  }

  if (rejectedCount > 0) {
    effects.push(
      buildRejectedEffect({
        selectedIntent: input.selectedIntent,
        memoryState: input.memoryState,
        rejectedCount,
      })
    )
  }

  return effects
}

function buildAcceptedEffect(input: {
  selectedIntent: ButlerAutonomousIntent
  memoryState: ButlerMemoryState
  acceptedCount: number
}): ButlerMemoryEffect {
  const targetPreference = resolvePositivePreference(input.selectedIntent)

  return {
    effectId: `learning-effect-accepted-${input.selectedIntent.kind}`,
    targetPreference,
    delta: buildBoundedDelta({
      currentValue: input.memoryState.learnedPreferences[targetPreference],
      baseDelta: Math.min(3, input.acceptedCount),
      direction: "positive",
    }),
    reason: "世界接受了本轮变化，管家会轻微增强相近行动的信心。",
    tags: [
      "learning_update",
      "safe_apply_accepted",
      input.selectedIntent.kind,
    ],
  }
}

function buildRejectedEffect(input: {
  selectedIntent: ButlerAutonomousIntent
  memoryState: ButlerMemoryState
  rejectedCount: number
}): ButlerMemoryEffect {
  const targetPreference = input.selectedIntent.constructionAllowed
    ? "resourceCautionBias"
    : "waitingBias"

  return {
    effectId: `learning-effect-rejected-${input.selectedIntent.kind}`,
    targetPreference,
    delta: buildBoundedDelta({
      currentValue: input.memoryState.learnedPreferences[targetPreference],
      baseDelta: Math.min(4, input.rejectedCount + 1),
      direction: "positive",
    }),
    reason: "世界拒绝了部分变化，管家会提高谨慎、等待或重新观察倾向，避免重复卡死。",
    tags: [
      "learning_update",
      "safe_apply_rejected",
      "deadlock_prevention",
      input.selectedIntent.kind,
    ],
  }
}

function resolvePositivePreference(
  intent: ButlerAutonomousIntent
): keyof ButlerMemoryLearnedPreferences {
  switch (intent.kind) {
    case "prepare_care":
      return "careBias"
    case "maintain_boundary":
    case "preserve_quiet_space":
      return "boundaryBias"
    case "prepare_resources":
    case "organize_storage":
      return "storageBias"
    case "stabilize_shelter":
      return "shelterBias"
    case "wait_and_record":
    case "observe_world":
      return "waitingBias"
    default:
      return "resourceCautionBias"
  }
}

function buildBoundedDelta(input: {
  currentValue: number
  baseDelta: number
  direction: "positive" | "negative"
}): number {
  if (input.direction === "negative") {
    if (input.currentValue <= 20) return 0
    return -Math.abs(input.baseDelta)
  }

  if (input.currentValue >= 85) return 0
  if (input.currentValue >= 75) return Math.max(1, input.baseDelta - 1)
  return Math.max(1, input.baseDelta)
}
