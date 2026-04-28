/**
 * 当前文件负责：提供世界舞台渲染器统一出口。
 */

export {
  DEFAULT_STAGE_RENDER_MODE,
  isGraphicsRenderMode,
  isPixelAssetRenderMode,
  type StageRenderMode,
} from "../modes/render-mode"

export {
  STAGE_VISUAL_CONFIG,
  getStageTileVisual,
  type StageActorVisualConfig,
  type StageTileVisualConfig,
  type StageVisualTone,
  type StageWorldVisualConfig,
} from "../config/stage-visual-config"

export {
  STAGE_ASSET_MANIFEST,
  getStageAssetDefinition,
  type StageActorAssetManifest,
  type StageAssetCategory,
  type StageAssetDefinition,
  type StageAssetManifest,
  type StageEffectAssetManifest,
  type StageObjectAssetManifest,
  type StageTileAssetManifest,
} from "../config/asset-manifest"

export {
  getStageTileTheme,
  type StageTileThemeDefinition,
  type StageTileThemeMode,
} from "../config/tile-theme"

export {
  getStageSpriteTheme,
  type StageSpriteKind,
  type StageSpriteThemeDefinition,
} from "../config/sprite-theme"

export {
  type RuntimeVisualState,
  type StageAlphaFill,
  type StageColor,
  type StagePoint,
  type StageSize,
  type StageVisualRegistry,
} from "../shared/stage-renderer-types"

export {
  clampNumber,
  createMixedSeed,
  createPointSeed,
  createStringSeed,
  darkenColor,
  lightenColor,
} from "../shared/stage-renderer-utils"

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
} from "../graphics/actors/stage-actor-renderer"

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
} from "../graphics/zones/stage-zone-renderer"

export {
  drawAssetWorldTiles,
  type DrawAssetWorldTilesInput,
} from "../assets/asset-tile-renderer"

export {
  syncAssetCoreActors,
  type SyncAssetCoreActorsInput,
} from "../assets/asset-actor-renderer"

export {
  syncAssetRuntimeEntities,
  type SyncAssetRuntimeEntitiesInput,
} from "../assets/asset-entity-renderer"

export {
  syncAssetEffects,
  type SyncAssetEffectsInput,
} from "../assets/asset-effect-renderer"
