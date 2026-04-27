/**
 * ======================================================
 * AI-PET-WORLD
 * Behavior Gateway
 * ======================================================
 */

export {
  buildBehaviorProcessFromCognition,
  stepBehaviorProcess,
} from "./behavior-engine"

export type {
  ActiveBehaviorProcess,
  BehaviorDelta,
  BehaviorProcessStage,
  BehaviorProcessType,
  BuildBehaviorProcessInput,
  StepBehaviorProcessInput,
  StepBehaviorProcessResult,
} from "./behavior-types"