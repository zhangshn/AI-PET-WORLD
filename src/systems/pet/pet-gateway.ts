/**
 * 当前文件负责：统一导出宠物系统内部各子模块的公开入口。
 */

export {
  resolvePetBirthGender,
  type PetBirthGenderResult,
  type PetBirthGenderSeedInput,
} from "./pet-birth/pet-birth-gateway"

export {
  driveSystem,
  DriveSystem,
  type DriveScores,
  type DriveSnapshot,
  type DriveSystemInput,
  type DriveType,
} from "./pet-drive/pet-drive-gateway"

export {
  goalSystem,
  GoalSystem,
  type GoalPriority,
  type GoalSystemInput,
  type PetGoalDriveAlignment,
  type PetGoalLifeTendencyHint,
  type PetGoalState,
  type PetGoalType,
} from "./pet-goal/pet-goal-gateway"

export {
  attentionSystem,
  AttentionSystem,
  type AttentionFocusType,
  type AttentionState,
  type BuildAttentionContext,
} from "./pet-attention/pet-attention-gateway"

export {
  applyPetActionStability,
  selectPetAction,
  type ActionDecisionReason,
  type ActionStabilityState,
  type SelectPetActionInput,
  type SelectPetActionResult,
} from "./pet-action/pet-action-gateway"

export {
  runPetStimulusPerception,
  type RunPetStimulusPerceptionInput,
  type RunPetStimulusPerceptionResult,
} from "./pet-cognition/pet-cognition-gateway"

export {
  evaluateFoodOffer,
  applyFeeding,
  type ApplyFeedingInput,
  type ApplyFeedingResult,
  type EvaluateFoodOfferInput,
  type FoodOfferDecision,
} from "./pet-feeding/pet-feeding-gateway"

export {
  runPetLife,
  type RunPetLifeInput,
  type RunPetLifeResult,
} from "./pet-life/pet-life-gateway"

export {
  mapTimelineStateToPetMood,
} from "./pet-mood/pet-mood-gateway"

export {
  buildPetStateEvents,
  type PetStateEvent,
} from "./pet-state-events/pet-state-events-gateway"

export {
  runPetZoneInfluence,
  type RunPetZoneInfluenceInput,
  type RunPetZoneInfluenceResult,
} from "./pet-zone/pet-zone-gateway"

export {
  runPetRuntimeTick,
} from "./pet-runtime/pet-runtime-runner"

export type {
  RunPetRuntimeTickInput,
  RunPetRuntimeTickResult,
} from "./pet-runtime/pet-runtime-runner"

export {
  applyAcceptedApproachOfferEffect,
  applyAcceptedRestOfferEffect,
  evaluateApproachOffer,
  evaluateRestOffer,
  type ApplyPetOpportunityEffectInput,
  type ApplyPetOpportunityEffectResult,
  type EvaluatePetOpportunityInput,
  type PetOpportunityDecision,
} from "./pet-opportunity/pet-opportunity-gateway"

export {
  expressPetAction,
} from "./pet-expression/pet-expression-gateway"

export type {
  PetExpressionInput,
  PetExpressionReason,
  PetExpressionResult,
} from "./pet-expression/pet-expression-gateway"

export {
  PET_CORE_ALLOWED_CHAIN,
  PET_CORE_BOUNDARY_MODULES,
  PET_CORE_BOUNDARY_SUMMARY,
  PET_CORE_DECISION_MODULES,
  PET_CORE_FORBIDDEN_RULES,
  PET_CORE_PUBLIC_GATEWAYS,
  PET_CORE_RUNTIME_MODULES,
  PET_CORE_TEST_OR_UI_RULES,
  PET_CORE_TUNING_MODULES,
  type PetCoreBoundaryLayer,
  type PetCoreBoundaryModule,
} from "./pet-core-boundary"