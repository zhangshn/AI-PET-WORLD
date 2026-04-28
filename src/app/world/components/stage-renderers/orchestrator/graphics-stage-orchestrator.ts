/**
 * 当前文件负责：调度当前 Graphics 模式下的世界舞台静态与动态渲染。
 */

import type { WorldStimulus } from "@/ai/gateway"
import type { TimeState } from "@/engine/timeSystem"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import {
  animateStimulusVisuals,
  createCoreActorVisuals,
  drawStaticWorld,
  getStaticWorldRenderKey,
  syncCoreActorVisuals,
  syncRuntimeEntityVisuals,
  syncStimulusVisuals,
  syncWorldZoneVisuals,
  type ActorMotionState,
  type CoreActorVisualRegistry,
  type RuntimeEntityVisualRegistry,
  type StimulusVisualRegistry,
} from "../gateway/stage-renderer-gateway"
import {
  drawShelterInterior,
  getShelterInteriorRenderKey,
} from "../graphics/stage-interior-renderer"
import { syncStageOverlay } from "./stage-overlay-renderer"
import type { WorldStageLayerRefs } from "./stage-layer-types"
import type { WorldStageSceneMode } from "./stage-scene-mode"

export type GraphicsStageRenderState = {
  lastStaticWorldKey: string | null
  phase: number
}

export type SyncGraphicsStageInput = {
  layers: WorldStageLayerRefs
  runtimeEntityVisuals: RuntimeEntityVisualRegistry
  stimulusVisuals: StimulusVisualRegistry
  actorVisuals: CoreActorVisualRegistry
  petMotion: ActorMotionState
  butlerMotion: ActorMotionState
  renderState: GraphicsStageRenderState
  sceneMode: WorldStageSceneMode
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
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
  }
}

export function advanceGraphicsStagePhase(input: {
  renderState: GraphicsStageRenderState
  deltaScale: number
}) {
  input.renderState.phase += 0.035 * input.deltaScale
}

export function syncGraphicsStage(input: SyncGraphicsStageInput) {
  redrawStaticSceneIfNeeded(input)

  if (input.sceneMode === "exterior") {
    syncDynamicWorld(input)
  }

  animateStimulusVisuals({
    visuals: input.stimulusVisuals,
    phase: input.renderState.phase,
  })

  syncStageOverlay({
    overlay: input.layers.overlay,
    width: input.width,
    height: input.height,
    period: input.time?.period,
  })
}

export function resetGraphicsStageRenderState(
  renderState: GraphicsStageRenderState
) {
  renderState.lastStaticWorldKey = null
  renderState.phase = 0
}

function redrawStaticSceneIfNeeded(input: SyncGraphicsStageInput) {
  const renderKey = getCurrentStaticRenderKey(input)

  if (input.renderState.lastStaticWorldKey === renderKey) return

  input.renderState.lastStaticWorldKey = renderKey

  if (input.sceneMode === "shelterInterior") {
    drawShelterInterior({
      backgroundLayer: input.layers.backgroundLayer,
      terrainLayer: input.layers.landLayer,
      structureLayer: input.layers.structureLayer,
      natureLayer: input.layers.natureLayer,
      foregroundLayer: input.layers.foregroundLayer,
      incubator: input.incubator,
      pet: input.pet,
      width: input.width,
      height: input.height,
    })
    return
  }

  drawStaticWorld({
    layers: {
      backgroundLayer: input.layers.backgroundLayer,
      terrainLayer: input.layers.landLayer,
      structureLayer: input.layers.structureLayer,
      natureLayer: input.layers.natureLayer,
      foregroundLayer: input.layers.foregroundLayer,
    },
    runtime: input.runtime,
    fallbackWidth: input.width,
    fallbackHeight: input.height,
  })
}

function getCurrentStaticRenderKey(input: SyncGraphicsStageInput): string {
  if (input.sceneMode === "shelterInterior") {
    return getShelterInteriorRenderKey({
      incubator: input.incubator,
      pet: input.pet,
      width: input.width,
      height: input.height,
    })
  }

  return getStaticWorldRenderKey(input.runtime)
}

function syncDynamicWorld(input: SyncGraphicsStageInput) {
  if (input.layers.natureLayer) {
    syncRuntimeEntityVisuals({
      layer: input.layers.natureLayer,
      runtime: input.runtime,
      visuals: input.runtimeEntityVisuals,
    })
  }

  if (input.layers.zoneLayer) {
    syncWorldZoneVisuals({
      layer: input.layers.zoneLayer,
      ecology: input.ecology,
    })
  }

  if (input.layers.entityLayer) {
    createCoreActorVisuals({
      layer: input.layers.entityLayer,
      registry: input.actorVisuals,
    })

    syncCoreActorVisuals({
      registry: input.actorVisuals,
      pet: input.pet,
      butler: input.butler,
      incubator: input.incubator,
      ecology: input.ecology,
      tick: input.tick,
      phase: input.renderState.phase,
      petMotion: input.petMotion,
      butlerMotion: input.butlerMotion,
    })
  }

  if (input.layers.stimulusLayer) {
    syncStimulusVisuals({
      layer: input.layers.stimulusLayer,
      stimuli: input.stimuli,
      visuals: input.stimulusVisuals,
      tick: input.tick,
    })
  }
}