/**
 * 当前文件负责：定义像素部件组合规则的基础类型。
 */

import type { PixelAssetPartLayer } from "./pixel-asset-part-schema"
import type { WorldObjectKind, WorldObjectStyleTag } from "./world-object-schema"

export type PixelCompositionKind =
  | "home_shelter"
  | "home_garden"
  | "home_care_corner"
  | "town_adoption_center"
  | "butler_actor"
  | "pet_actor"
  | "arrival_area"
  | "world_ground"
  | "interaction_feedback"
  | "atmosphere"

export type PixelCompositionTarget =
  | "home"
  | "town"
  | "adoption_center"
  | "butler"
  | "pet"
  | "environment"
  | "interaction"

export type PixelCompositionPartSlot = {
  partKind: string
  layer: PixelAssetPartLayer
  order: number
  repeatHint: number
  isRequired: boolean
  offsetX: number
  offsetY: number
  notes?: string
}

export type PixelCompositionRule = {
  id: string
  kind: PixelCompositionKind
  target: PixelCompositionTarget
  displayName: string
  description: string
  targetWorldObjects: WorldObjectKind[]
  partSlots: PixelCompositionPartSlot[]
  styleTags: WorldObjectStyleTag[]
  stateTags: string[]
  unlockStageTags: string[]
  defaultEnabled: boolean
  notes?: string
}
