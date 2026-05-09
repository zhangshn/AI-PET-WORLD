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
} from "./drive/pet-drive-gateway"

export {
  goalSystem,
  GoalSystem,
  type GoalPriority,
  type GoalSystemInput,
  type PetGoalDriveAlignment,
  type PetGoalLifeTendencyHint,
  type PetGoalState,
  type PetGoalType,
} from "./goal/pet-goal-gateway"

export {
  attentionSystem,
  AttentionSystem,
  type AttentionFocusType,
  type AttentionState,
  type BuildAttentionContext,
} from "./attention/pet-attention-gateway"

export {
  applyPetActionStability,
  selectPetAction,
  type ActionDecisionReason,
  type ActionStabilityState,
  type SelectPetActionInput,
  type SelectPetActionResult,
} from "./action-intention/pet-action-intention-gateway"

export {
  runPetStimulusPerception,
  type RunPetStimulusPerceptionInput,
  type RunPetStimulusPerceptionResult,
} from "./cognition/pet-cognition-layer-gateway"

export {
  runPetLife,
  type RunPetLifeInput,
  type RunPetLifeResult,
  mapTimelineStateToPetMood,
  evaluateFoodOffer,
  applyFeeding,
  type ApplyFeedingInput,
  type ApplyFeedingResult,
  type EvaluateFoodOfferInput,
  type FoodOfferDecision,
} from "./daily-state/daily-state-gateway"

export {
  buildPetStateEvents,
  type PetStateEvent,
  runPetZoneInfluence,
  type RunPetZoneInfluenceInput,
  type RunPetZoneInfluenceResult,
} from "./world-boundary/pet-world-boundary-gateway"

export {
  runPetRuntimeTick,
} from "./pet-runtime/pet-runtime-runner"

export type {
  RunPetRuntimeTickInput,
  RunPetRuntimeTickResult,
} from "./pet-runtime/pet-runtime-runner"

export {
  evaluateApproachOffer,
  evaluateRestOffer,
  type EvaluatePetOpportunityInput,
  type PetOpportunityDecision,
} from "./opportunity-decision/pet-opportunity-decision-gateway"

export {
  applyAcceptedApproachOfferEffect,
  applyAcceptedRestOfferEffect,
  expressPetAction,
  type ApplyPetOpportunityEffectInput,
  type ApplyPetOpportunityEffectResult,
  type PetExpressionInput,
  type PetExpressionReason,
  type PetExpressionResult,
} from "./behavior/pet-behavior-gateway"

export {
  PET_CORE_ALLOWED_CHAIN,
  PET_CORE_AUTONOMOUS_DRIVE_MODULES,
  PET_CORE_BEHAVIOR_EXECUTION_MODULES,
  PET_CORE_BOUNDARY_MODULES,
  PET_CORE_BOUNDARY_SUMMARY,
  PET_CORE_DAILY_STATE_MODULES,
  PET_CORE_FORBIDDEN_RULES,
  PET_CORE_LEARNING_MODULES,
  PET_CORE_MEMORY_RELATION_MODULES,
  PET_CORE_PUBLIC_GATEWAYS,
  PET_CORE_RUNTIME_MODULES,
  PET_CORE_TEST_OR_UI_RULES,
  PET_CORE_TUNING_MODULES,
  PET_CORE_WORLD_EVENT_BOUNDARY_MODULES,
  PET_CORE_WORLD_INFLUENCE_MODULES,
  type PetCoreBoundaryLayer,
  type PetCoreBoundaryModule,
} from "./pet-core-boundary"
