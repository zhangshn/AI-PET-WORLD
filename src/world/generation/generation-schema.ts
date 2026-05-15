/**
 * 当前文件负责：定义世界生成输入、seed 与生成结果类型。
 */

import type {
  HomeMapState,
  HomeZone,
} from "@/world/map-state/home-map-state-schema"
import type { PlacementRecipeItem } from "@/world/placement/placement-schema"

export type WorldSeedInput = {
  ownerId: string
  birthSignature: string
  worldSalt: string
}

export type StableWorldSeed = {
  value: string
  numericHash: number
  sourceText: string
}

export type InitialHomeGenerationParams = {
  seedInput: WorldSeedInput
  constructionStyle?: string
  resourceBiasTags?: string[]
}

export type InitialHomeSceneRecipe = {
  id: string
  name: string
  columns: number
  rows: number
  tileSize: number
  zones: HomeZone[]
  recipeItems: PlacementRecipeItem[]
  tags: string[]
}

export type InitialHomeGenerationInput = {
  params: InitialHomeGenerationParams
  recipe?: InitialHomeSceneRecipe
}

export type InitialHomeGenerationResult = {
  seed: StableWorldSeed
  mapState: HomeMapState
  placementWarnings: string[]
  rejectedPlacementIds: string[]
  tags: string[]
}
