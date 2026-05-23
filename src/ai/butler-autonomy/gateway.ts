/**
 * 当前文件职责：提供 AI 管家自主意识核心的统一公开入口。
 */

import { auditButlerAutonomousIntent } from "./audit"
import { buildButlerConsciousState } from "./conscious-state"
import { buildButlerGoals } from "./goal-generator"
import { buildButlerSelectedIntent } from "./intent-ranking"
import {
  buildButlerMemoryEffects,
  buildInitialButlerMemoryState,
} from "./memory-state"
import { buildButlerMotivations } from "./motivation-engine"
import { buildButlerSoulProfileFromButlerProfile } from "./soul-profile-adapter"
import { buildButlerWorldPerception } from "./world-perception"
import type { ButlerAutonomyInput, ButlerAutonomyResult } from "./schema"

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
  const memoryEffects = buildButlerMemoryEffects({
    selectedIntent,
    memoryState,
  })
  const audit = auditButlerAutonomousIntent({
    intent: selectedIntent,
    worldId: input.worldId,
    ownerId: input.ownerId,
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
    explanations: [
      {
        id: `butler-autonomy-explanation-${input.worldId}-${input.now}`,
        title: "管家自主意识判断",
        body: selectedIntent.reason,
        tags: ["butler_autonomy_explanation", selectedIntent.kind],
      },
    ],
    tags: [
      "butler_autonomy_result",
      "schema_phase_ready",
      selectedIntent.kind,
      consciousState.focus,
      ...audit.tags,
    ],
  }
}
