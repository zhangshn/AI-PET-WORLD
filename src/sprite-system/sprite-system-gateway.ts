/**
 * 当前文件负责：导出像素 Sprite Sheet 元数据系统入口。
 */

export { spriteFrames, spriteMetadataIndex } from "./sprite-index"

export {
  findSpriteFrame,
  findSpriteVariantMapping,
  resolveSpriteVariant,
  resolveSpriteVariants,
} from "./sprite-resolver"

export type {
  SpriteAnchor,
  SpriteAnimation,
  SpriteAnimationId,
  SpriteCategory,
  SpriteFrameId,
  SpriteFrameMetadata,
  SpriteFrameRect,
  SpriteGridSize,
  SpriteMetadataIndex,
  SpriteSheetId,
  SpriteSheetMetadata,
  SpriteVariantMapping,
  SpriteVisualTags,
} from "./sprite-metadata.types"

export type { ResolvedSpriteVariant } from "./sprite-resolver"
