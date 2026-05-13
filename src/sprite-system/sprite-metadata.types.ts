/**
 * 当前文件负责：保留 Sprite 元数据类型，避免历史草稿文件造成构建错误。
 */

import type {
  ButlerSilhouette,
  CarePriority,
  GardenStyleType,
  HomeStyleType,
  PetMatchType,
  ShelterStyleType,
  VisualColorTone,
  ZiweiVisualArchetype,
} from "../visual-system/visual-dna.types"

export type SpriteCategory =
  | "tile"
  | "nature"
  | "butler"
  | "pet"
  | "building"
  | "facility"
  | "effect"

export type SpriteSheetId =
  | "tiles_ground_v1"
  | "tiles_path_v1"
  | "nature_trees_v1"
  | "actors_butlers_v1"
  | "actors_pets_v1"
  | "buildings_home_v1"
  | "buildings_adoption_v1"
  | "facilities_care_v1"

export type SpriteFrameId = string

export type SpriteFrameRect = {
  x: number
  y: number
  width: number
  height: number
}

export type SpriteAnchor = {
  x: number
  y: number
}

export type SpriteGridSize = {
  columns: number
  rows: number
}

export type SpriteAnimationId =
  | "idle"
  | "walk_down"
  | "walk_up"
  | "walk_left"
  | "walk_right"
  | "work"
  | "observe"
  | "rest"
  | "eat"
  | "approach"
  | "avoid"
  | "base"

export type SpriteAnimation = {
  id: SpriteAnimationId
  frameIds: SpriteFrameId[]
  frameDurationMs: number
  loop: boolean
}

export type SpriteVisualTags = {
  archetype?: ZiweiVisualArchetype
  colorTone?: VisualColorTone
  butlerSilhouette?: ButlerSilhouette
  petMatchType?: PetMatchType
  homeStyle?: HomeStyleType
  gardenStyle?: GardenStyleType
  shelterStyle?: ShelterStyleType
  carePriority?: CarePriority
}

export type SpriteFrameMetadata = {
  id: SpriteFrameId
  sheetId: SpriteSheetId
  category: SpriteCategory
  name: string
  rect: SpriteFrameRect
  anchor: SpriteAnchor
  gridSize: SpriteGridSize
  tags: SpriteVisualTags
  description: string
}

export type SpriteSheetMetadata = {
  id: SpriteSheetId
  imagePath: string
  tileSize: number
  pixelScale: number
  category: SpriteCategory
  frameWidth: number
  frameHeight: number
  frames: SpriteFrameMetadata[]
  animations: SpriteAnimation[]
  notes: string
}

export type SpriteVariantMapping = {
  spriteVariantId: string
  frameId: SpriteFrameId
  sheetId: SpriteSheetId
  animationId: SpriteAnimationId
  description: string
}

export type SpriteMetadataIndex = {
  sheets: SpriteSheetMetadata[]
  variantMappings: SpriteVariantMapping[]
}
