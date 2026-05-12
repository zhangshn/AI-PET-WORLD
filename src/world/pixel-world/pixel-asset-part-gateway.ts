/**
 * 当前文件负责：导出像素资产拆分层的查询入口。
 */

import { PIXEL_ASSET_PARTS } from "./pixel-asset-part-registry"

import type {
  PixelAssetPartCategory,
  PixelAssetPartDefinition,
  PixelAssetPartLayer,
} from "./pixel-asset-part-schema"
import type {
  WorldObjectKind,
  WorldObjectStyleTag,
} from "./world-object-schema"

export { PIXEL_ASSET_PARTS }

export function getPixelAssetPartsByCategory(
  category: PixelAssetPartCategory
): PixelAssetPartDefinition[] {
  return PIXEL_ASSET_PARTS.filter((part) => part.category === category)
}

export function getPixelAssetPartsByLayer(
  layer: PixelAssetPartLayer
): PixelAssetPartDefinition[] {
  return PIXEL_ASSET_PARTS.filter((part) => part.layer === layer)
}

export function getPixelAssetPartsByWorldObject(
  kind: WorldObjectKind
): PixelAssetPartDefinition[] {
  return PIXEL_ASSET_PARTS.filter((part) =>
    part.targetWorldObjects.includes(kind)
  )
}

export function getPixelAssetPartsByStyleTag(
  styleTag: WorldObjectStyleTag
): PixelAssetPartDefinition[] {
  return PIXEL_ASSET_PARTS.filter((part) =>
    part.styleTags.includes(styleTag)
  )
}

export function getRepeatablePixelAssetParts(): PixelAssetPartDefinition[] {
  return PIXEL_ASSET_PARTS.filter((part) => part.canRepeat)
}

export function getSpriteFuturePixelAssetParts(): PixelAssetPartDefinition[] {
  return PIXEL_ASSET_PARTS.filter(
    (part) => part.renderMode === "sprite_future"
  )
}

export type {
  PixelAssetPartCategory,
  PixelAssetPartDefinition,
  PixelAssetPartLayer,
  PixelAssetPartUsage,
  PixelAssetRenderMode,
} from "./pixel-asset-part-schema"
