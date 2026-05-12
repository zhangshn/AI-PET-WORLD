/**
 * 当前文件负责：导出像素世界渲染图层查询入口。
 */

import { PIXEL_RENDER_LAYERS } from "./pixel-render-layer-registry"

import type {
  PixelRenderLayerDefinition,
  PixelRenderLayerId,
  PixelRenderLayerPurpose,
} from "./pixel-render-layer-schema"
import type { PixelAssetPartCategory } from "./pixel-asset-part-schema"

export { PIXEL_RENDER_LAYERS }

export function getPixelRenderLayerById(
  id: PixelRenderLayerId
): PixelRenderLayerDefinition | null {
  return PIXEL_RENDER_LAYERS.find((layer) => layer.id === id) ?? null
}

export function getPixelRenderLayersByPurpose(
  purpose: PixelRenderLayerPurpose
): PixelRenderLayerDefinition[] {
  return PIXEL_RENDER_LAYERS.filter((layer) => layer.purpose === purpose)
}

export function getPixelRenderLayersByAcceptedCategory(
  category: PixelAssetPartCategory
): PixelRenderLayerDefinition[] {
  return PIXEL_RENDER_LAYERS.filter((layer) =>
    layer.acceptsPartCategories.includes(category)
  )
}

export function getOrderedPixelRenderLayers(): PixelRenderLayerDefinition[] {
  return [...PIXEL_RENDER_LAYERS].sort((left, right) => left.order - right.order)
}

export function getVisiblePixelRenderLayers(): PixelRenderLayerDefinition[] {
  return getOrderedPixelRenderLayers().filter((layer) => layer.defaultVisible)
}

export type {
  PixelRenderLayerDefinition,
  PixelRenderLayerId,
  PixelRenderLayerPurpose,
} from "./pixel-render-layer-schema"
