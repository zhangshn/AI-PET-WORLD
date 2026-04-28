/**
 * 当前文件负责：提供像素贴图模式舞台渲染器统一出口。
 */

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