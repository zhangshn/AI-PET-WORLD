/**
 * 当前文件负责：提供舞台渲染配置相关统一出口。
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