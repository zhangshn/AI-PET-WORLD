/**
 * 当前文件负责：定义像素世界渲染图层结构。
 */

import type { PixelAssetPartCategory } from "./pixel-asset-part-schema"

export type PixelRenderLayerId =
  | "groundBaseLayer"
  | "groundDetailLayer"
  | "pathLayer"
  | "structureBaseLayer"
  | "structureLayer"
  | "structureDetailLayer"
  | "actorShadowLayer"
  | "actorLayer"
  | "actorPartLayer"
  | "actorEffectLayer"
  | "interactionLayer"
  | "atmosphereLayer"
  | "devOverlayLayer"

export type PixelRenderLayerPurpose =
  | "ground"
  | "detail"
  | "path"
  | "structure"
  | "actor"
  | "effect"
  | "interaction"
  | "atmosphere"
  | "development"

export type PixelRenderLayerDefinition = {
  id: PixelRenderLayerId
  order: number
  purpose: PixelRenderLayerPurpose
  displayName: string
  description: string
  acceptsPartCategories: PixelAssetPartCategory[]
  defaultVisible: boolean
  blocksInteraction: boolean
  notes?: string
}
