/**
 * 当前文件负责：统一导出宠物系统内部各子模块的公开入口。
 */

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

export { mapTimelineStateToPetMood } from "./pet-mood/pet-mood-gateway"

export {
  buildPetStateEvents,
  type PetStateEvent,
} from "./pet-state-events/pet-state-events-gateway"

export {
  runPetZoneInfluence,
  type RunPetZoneInfluenceInput,
  type RunPetZoneInfluenceResult,
} from "./pet-zone/pet-zone-gateway"