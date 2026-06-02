/**
 * 当前文件职责：提供 AI 管家自主意识核心的统一公开入口。
 */

import { auditButlerAutonomousIntent } from "./audit"
import { buildButlerConsciousState } from "./conscious-state"
import { buildButlerAutonomyExplanations } from "./explanation"
import { buildButlerGoals } from "./goal-generator"
import { buildButlerSelectedIntent } from "./intent-ranking"
import { buildButlerLearningEffectsFromSafeApply } from "./learning-update"
import {
  buildButlerMemoryEffects,
  buildInitialButlerMemoryState,
} from "./memory-state"
import { buildButlerMotivations } from "./motivation-engine"
import { buildButlerSoulProfileFromButlerProfile } from "./soul-profile-adapter"
import { buildButlerWorldPerception } from "./world-perception"
import type { ButlerAutonomyInput, ButlerAutonomyResult } from "./butler-autonomy-schema"

export function buildButlerAutonomyResult(
  input: ButlerAutonomyInput
): ButlerAutonomyResult {
  const soulProfile =
    input.butlerSoulProfile ??
    buildButlerSoulProfileFromButlerProfile(input.butlerProfile)
  const memoryState = input.butlerMemoryState ?? buildInitialButlerMemoryState(input)
  const perception = buildButlerWorldPerception(input)
  const consciousState = buildButlerConsciousState({ input, perception })
  const motivations = buildButlerMotivations({
    soulProfile,
    perception,
    consciousState,
    memoryState,
  })
  const candidateGoals = buildButlerGoals({
    motivations,
    perception,
    consciousState,
    memoryState,
  })
  const selectedIntent = buildButlerSelectedIntent({
    input,
    perception,
    motivations,
    candidateGoals,
    memoryState,
    consciousState,
  })
  const directMemoryEffects = buildButlerMemoryEffects({
    selectedIntent,
    memoryState,
  })
  const learningEffects = buildButlerLearningEffectsFromSafeApply({
    selectedIntent,
    memoryState,
    safeApplyResult: input.recentSafeApplyResult,
  })
  const memoryEffects = [...directMemoryEffects, ...learningEffects]
  const audit = auditButlerAutonomousIntent({
    intent: selectedIntent,
    worldId: input.worldId,
    ownerId: input.ownerId,
  })
  const explanations = buildButlerAutonomyExplanations({
    worldId: input.worldId,
    now: input.now,
    selectedIntent,
    perception,
    consciousState,
    motivations,
    memoryEffects,
  })

  return {
    soulProfile,
    perception,
    consciousState,
    motivations,
    candidateGoals,
    selectedIntent,
    memoryEffects,
    audit,
    explanations,
    tags: [
      "butler_autonomy_result",
      "schema_phase_ready",
      "explanation_layer_ready",
      learningEffects.length > 0
        ? "learning_feedback_ready"
        : "learning_feedback_waiting_for_world_result",
      selectedIntent.kind,
      consciousState.focus,
      ...audit.tags,
    ],
  }
}
