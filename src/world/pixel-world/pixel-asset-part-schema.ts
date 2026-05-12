/**
 * 当前文件负责：定义像素资产拆分层的基础类型。
 */

import type { WorldObjectKind, WorldObjectStyleTag } from "./world-object-schema"

export type PixelAssetPartCategory =
  | "ground"
  | "path"
  | "home_structure"
  | "home_facility"
  | "town_structure"
  | "adoption_center"
  | "butler"
  | "pet"
  | "effect"
  | "environment"
  | "interaction"

export type PixelAssetPartLayer =
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

export type PixelAssetPartUsage =
  | "tile"
  | "object_part"
  | "actor_part"
  | "effect_part"
  | "marker"
  | "overlay"

export type PixelAssetRenderMode = "graphics_placeholder" | "sprite_future"

export type PixelAssetPartDefinition = {
  id: string
  kind: string
  category: PixelAssetPartCategory
  targetWorldObjects: WorldObjectKind[]
  layer: PixelAssetPartLayer
  usage: PixelAssetPartUsage
  renderMode: PixelAssetRenderMode
  displayName: string
  description: string
  size: {
    width: number
    height: number
  }
  anchor: {
    x: number
    y: number
  }
  styleTags: WorldObjectStyleTag[]
  stateTags: string[]
  defaultVisible: boolean
  canRepeat: boolean
  notes?: string
}
