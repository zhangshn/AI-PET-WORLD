/**
 * 当前文件负责：统一导出事件系统模块的公开入口。
 */

export type {
  ContinuityState,
  EventSystemUpdateInput,
  InteractionEventInput,
  MakeWorldEventInput,
  MakeWorldEventResult,
  PetHatchedEventInput,
  PetStateLike,
} from "./event-schema"

export {
  createContinuityId,
  createEventId,
} from "./event-id-runner"

export { makeWorldEvent } from "./event-factory-runner"

export {
  buildHomeContextFromHomeState,
  getActionEventIntensity,
  getEmotionalLabel,
  getEventAction,
  getEventMood,
  getLegacyDrivePrimary,
  getNarrativeTypeByAction,
  getPetEventKey,
  getPhaseTag,
  getSourceDriveFromPet,
} from "./event-pet-context-runner"

export {
  buildActionEventStyleInput,
  buildMoodEventStyleInput,
} from "./event-style-input-runner"

export type {
  BuildActionEventStyleInputEnhancements,
} from "./event-style-input-runner"

export { buildActionEndMessage } from "./event-action-end-message-runner"

export {
  buildEnhancedActionEventPayload,
  decorateNarrativeMessageByContinuity,
  shouldEmitActionNarrativeEvent,
  shouldResetContinuity,
} from "./event-continuity-runner"