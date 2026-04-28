/**
 * 当前文件负责：创建与重置世界舞台运行期渲染状态。
 */

import {
  clearCoreActorVisuals,
  clearRuntimeEntityVisuals,
  clearStimulusVisuals,
  createCoreActorVisualRegistry,
  createRuntimeEntityVisualRegistry,
  createStimulusVisualRegistry,
  type ActorMotionState,
  type CoreActorVisualRegistry,
  type RuntimeEntityVisualRegistry,
  type StimulusVisualRegistry,
} from "../gateway/stage-renderer-gateway"
import {
  createGraphicsStageRenderState,
  resetGraphicsStageRenderState,
  type GraphicsStageRenderState,
} from "./graphics-stage-orchestrator"
import {
  createStageCameraState,
  resetStageCamera,
  type StageCameraState,
} from "./stage-camera-controller"

export type WorldStageRuntimeState = {
  runtimeEntityVisuals: RuntimeEntityVisualRegistry
  stimulusVisuals: StimulusVisualRegistry
  actorVisuals: CoreActorVisualRegistry
  renderState: GraphicsStageRenderState
  camera: StageCameraState
  petMotion: ActorMotionState
  butlerMotion: ActorMotionState
}

export function createWorldStageRuntimeState(): WorldStageRuntimeState {
  return {
    runtimeEntityVisuals: createRuntimeEntityVisualRegistry(),
    stimulusVisuals: createStimulusVisualRegistry(),
    actorVisuals: createCoreActorVisualRegistry(),
    renderState: createGraphicsStageRenderState(),
    camera: createStageCameraState(),
    petMotion: {
      x: 620,
      y: 420,
      targetX: 620,
      targetY: 420,
      speed: 1.1,
    },
    butlerMotion: {
      x: 340,
      y: 340,
      targetX: 340,
      targetY: 340,
      speed: 0.95,
    },
  }
}

export function cleanupWorldStageRuntimeState(state: WorldStageRuntimeState) {
  clearRuntimeEntityVisuals(state.runtimeEntityVisuals)
  clearStimulusVisuals(state.stimulusVisuals)
  clearCoreActorVisuals(state.actorVisuals)
  resetGraphicsStageRenderState(state.renderState)
  resetStageCamera(state.camera)
}