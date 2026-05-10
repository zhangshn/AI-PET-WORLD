/**
 * 当前文件负责：调度当前 Graphics 模式下的世界舞台静态与动态渲染。
 */

import type { WorldStimulus } from "@/ai/gateway"
import type { TimeState } from "@/engine/timeSystem"
import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import {
  animateStimulusVisuals,
  syncStageAffordances,
  type ActorMotionState,
  type ButlerMotionProcessState,
  type CoreActorVisualRegistry,
  type RuntimeEntityVisualRegistry,
  type PetMotionProcessState,
  type StimulusVisualRegistry,
} from "../gateway/stage-renderer-gateway"
import {
  syncStageClickFeedbacks,
  type StageClickFeedback,
} from "../graphics/feedback/stage-click-feedback-renderer"
import {
  buildWorldFocusPoints,
} from "../focus-points/world-focus-point-gateway"
import { logStageDebug } from "./stage-debug-logger"
import { clearExteriorDynamicLayers } from "./stage-dynamic-layer-cleaner"
import { syncDynamicWorld } from "./stage-dynamic-scene-sync"
import { syncStageOverlay } from "./stage-overlay-renderer"
import { redrawStaticSceneIfNeeded } from "./stage-static-scene-sync"
import type { WorldStageLayerRefs } from "./stage-layer-types"
import type { WorldStageSceneMode } from "./stage-scene-mode"

export type GraphicsStageRenderState = {
  lastStaticWorldKey: string | null
  phase: number
  clickFeedbacks: StageClickFeedback[]
  debugMessage?: string
}

export type SyncGraphicsStageInput = {
  layers: WorldStageLayerRefs
  runtimeEntityVisuals: RuntimeEntityVisualRegistry
  stimulusVisuals: StimulusVisualRegistry
  actorVisuals: CoreActorVisualRegistry
  petMotion: ActorMotionState
  petMotionProcess: PetMotionProcessState
  butlerMotion: ActorMotionState
  butlerMotionProcess: ButlerMotionProcessState
  renderState: GraphicsStageRenderState
  sceneMode: WorldStageSceneMode
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  home: HomeState | null
  incubator: IncubatorState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
  runtime: WorldRuntimeState | null
  tick: number
  width: number
  height: number
}

export function createGraphicsStageRenderState(): GraphicsStageRenderState {
  return {
    lastStaticWorldKey: null,
    phase: 0,
    clickFeedbacks: [],
    debugMessage: "stage init",
  }
}

export function advanceGraphicsStagePhase(input: {
  renderState: GraphicsStageRenderState
  deltaScale: number
}) {
  input.renderState.phase += 0.035 * input.deltaScale
}

export function syncGraphicsStage(input: SyncGraphicsStageInput) {
  logStageDebug(input)

  const focusPoints = buildWorldFocusPoints({
    sceneMode: input.sceneMode,
    map: input.runtime?.map ?? null,
    home: input.home,
    incubator: input.incubator,
    pet: input.pet,
    butler: input.butler,
    petMotion: input.petMotion,
    butlerMotion: input.butlerMotion,
    ecology: input.ecology,
  })

  redrawStaticSceneIfNeeded(input)

  if (input.sceneMode === "exterior") {
    syncDynamicWorld(input)
  } else {
    clearExteriorDynamicLayers(input.layers)
  }

  animateStimulusVisuals({
    visuals: input.stimulusVisuals,
    phase: input.renderState.phase,
  })

  if (input.layers.affordanceLayer) {
    syncStageAffordances({
      layer: input.layers.affordanceLayer,
      sceneMode: input.sceneMode,
      focusPoints,
      phase: input.renderState.phase,
    })
  }

  syncStageOverlay({
    overlay: input.layers.overlay,
    width: input.width,
    height: input.height,
    period: input.time?.period,
  })

  syncStageClickFeedbacks({
    layer: input.layers.feedbackLayer,
    feedbacks: input.renderState.clickFeedbacks,
    nowMs: getNowMs(),
  })
}

export function resetGraphicsStageRenderState(
  renderState: GraphicsStageRenderState
) {
  renderState.lastStaticWorldKey = null
  renderState.phase = 0
  renderState.clickFeedbacks = []
  renderState.debugMessage = "stage reset"
}

function getNowMs(): number {
  return globalThis.performance?.now() ?? Date.now()
}
