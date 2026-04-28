/**
 * 当前文件负责：提供舞台渲染共享类型与工具统一出口。
 */

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