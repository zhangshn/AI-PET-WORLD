/**
 * 当前文件负责：提供世界舞台渲染器统一出口。
 */

export {
  drawStaticWorld,
  getStaticWorldRenderKey,
  type DrawStaticWorldInput,
  type StaticWorldLayerRefs,
} from "../graphics/stage-static-world-renderer"

export {
  clearCoreActorVisuals,
  createCoreActorVisualRegistry,
  createCoreActorVisuals,
  syncCoreActorVisuals,
  type ActorMotionState,
  type ActorVisualState,
  type CoreActorVisualRegistry,
  type CreateCoreActorsInput,
  type SyncCoreActorsInput,
} from "../graphics/stage-actor-renderer"

export {
  clearRuntimeEntityVisuals,
  createRuntimeEntityVisualRegistry,
  syncRuntimeEntityVisuals,
  type RuntimeEntityVisualRegistry,
  type RuntimeEntityVisualState,
  type SyncRuntimeEntitiesInput,
} from "../graphics/runtime-entity-renderer"

export {
  animateStimulusVisuals,
  clearStimulusVisuals,
  createStimulusVisualRegistry,
  syncStimulusVisuals,
  type StimulusVisualRegistry,
  type StimulusVisualState,
  type SyncStimulusVisualsInput,
} from "../graphics/stage-stimulus-renderer"

export {
  getActiveZonePosition,
  syncWorldZoneVisuals,
  type SyncWorldZonesInput,
} from "../graphics/stage-zone-renderer"