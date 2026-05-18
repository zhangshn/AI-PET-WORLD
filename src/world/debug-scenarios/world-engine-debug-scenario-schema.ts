/**
 * 当前文件职责：定义世界引擎调试场景派生结果类型。
 */

import type {
  ConstructionDebugPetPreset,
  ConstructionDebugScenarioResult,
} from "@/world/construction/construction-debug-scenario"
import type { EnvironmentState } from "@/world/environment/environment-gateway"
import type { PlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import type { IntentDecision } from "@/world/intent-system/intent-gateway"
import type { MapDiffValidationResult } from "@/world/map-state/map-diff-validator"
import type {
  WorldChangePlan,
  WorldDiffProposal,
} from "@/world/world-evolution/world-evolution-gateway"

export type WorldEngineDebugStageResult = {
  environmentState: EnvironmentState
  placementGeometryAudit: PlacementGeometryAuditReport
  butlerIntentDecision: IntentDecision
  worldChangePlan: WorldChangePlan
  worldDiffProposal: WorldDiffProposal
  worldDiffProposalValidation: MapDiffValidationResult
}

export type WorldEngineDebugScenarioResult = {
  initial: WorldEngineDebugStageResult
  next: WorldEngineDebugStageResult
  tags: string[]
}

export type BuildWorldEngineDebugScenarioInput = {
  debugResult: ConstructionDebugScenarioResult
  petPreset: ConstructionDebugPetPreset
}
