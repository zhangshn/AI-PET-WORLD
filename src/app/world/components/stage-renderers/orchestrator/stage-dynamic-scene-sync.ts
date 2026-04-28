/**
 * 当前文件负责：同步外部世界动态图层。
 */

import {
  createCoreActorVisuals,
  syncCoreActorVisuals,
  syncRuntimeEntityVisuals,
  syncStimulusVisuals,
  syncWorldZoneVisuals,
} from "../gateway/stage-renderer-gateway"
import type { SyncGraphicsStageInput } from "./graphics-stage-orchestrator"

export function syncDynamicWorld(input: SyncGraphicsStageInput) {
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