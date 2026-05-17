/**
 * 当前文件负责：定义管家建设意图的数据协议。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type {
  HomeResourceState,
  HomeZoneType,
} from "@/world/map-state/home-map-state-schema"

export type ConstructionIntentType =
  | "improve_pet_rest"
  | "improve_care_area"
  | "add_natural_boundary"
  | "organize_storage"
  | "soften_arrival_area"
  | "decorate_home"

export type ConstructionIntentSource =
  | "butler_personality"
  | "pet_need"
  | "world_resource"
  | "weather"
  | "event"
  | "routine"

export type ConstructionExpectedEffect =
  | "restComfortUp"
  | "careReadinessUp"
  | "securityUp"
  | "naturalBeautyUp"
  | "storageOrderUp"
  | "arrivalComfortUp"

export type PetConstructionContext = {
  energy: number
  hunger: number
  mood?: string
  currentZoneType?: HomeZoneType
  recentAction?: string
  tags?: string[]
}

export type ButlerConstructionContext = {
  mood?: string
  currentTask?: string
  constructionStyle?: ButlerConstructionStyleVector
  tags?: string[]
}

export type ConstructionIntent = {
  id: string
  type: ConstructionIntentType
  source: ConstructionIntentSource
  targetZoneType: HomeZoneType
  urgency: number
  reason: string
  preferredAssetTags: string[]
  expectedEffects: ConstructionExpectedEffect[]
  createdAt: number
  tags: string[]
}

export type ConstructionIntentPlannerInput = {
  worldTick: number
  now: number
  pet: PetConstructionContext
  butler: ButlerConstructionContext
  resources: HomeResourceState
}

export type ConstructionIntentPlannerResult = {
  intents: ConstructionIntent[]
  messages: string[]
  tags: string[]
}