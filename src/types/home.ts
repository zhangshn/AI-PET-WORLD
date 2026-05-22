/**
 * 当前文件负责：定义家园系统状态。
 */

export type HomeStatus =
  | "idle"
  | "building"
  | "completed"

export type HomeConstructionStage =
  | "temporary_shelter"
  | "foundation"
  | "frame"
  | "roof"
  | "interior"
  | "garden"
  | "completed"

export type HomeEvolutionFocus =
  | "balanced"
  | "expansion"
  | "stability"
  | "comfort"
  | "order"
  | "adaptive"

export type HomeSpaceId =
  | "empty_land"
  | "initial_care_area"
  | "temporary_shelter"
  | "garden_area"
  | "storage_area"
  | "activity_area"

export type HomeSpaceStatus =
  | "locked"
  | "available"
  | "building"
  | "active"

export type HomeSpaceRole =
  | "origin"
  | "care"
  | "shelter"
  | "garden"
  | "storage"
  | "activity"

export type HomeSpaceState = {
  id: HomeSpaceId
  name: string
  role: HomeSpaceRole
  status: HomeSpaceStatus
  order: number
  progress: number
  comfort: number
  stability: number
  activity: number
  description: string
  tags: string[]
}

export type HomeSpaceSummary = {
  primarySpaceId: HomeSpaceId
  primarySpaceName: string
  buildingSpaceIds: HomeSpaceId[]
  activeSpaceIds: HomeSpaceId[]
  availableSpaceIds: HomeSpaceId[]
  maintenanceSpaceIds: HomeSpaceId[]
  activitySpaceIds: HomeSpaceId[]
  overallComfort: number
  overallStability: number
  overallActivity: number
  summary: string
  tags: string[]
}

export type HomeFacilityId =
  | "basic_care_station"
  | "shelter_bed"
  | "food_corner"
  | "water_corner"
  | "storage_box"
  | "garden_patch"
  | "observation_spot"

export type HomeFacilityStatus =
  | "locked"
  | "planned"
  | "building"
  | "active"
  | "needs_maintenance"

export type HomeFacilityRole =
  | "care"
  | "rest"
  | "food"
  | "water"
  | "storage"
  | "garden"
  | "observation"

export type HomeFacilityState = {
  id: HomeFacilityId
  name: string
  role: HomeFacilityRole
  status: HomeFacilityStatus
  spaceId: HomeSpaceId
  progress: number
  durability: number
  usefulness: number
  comfortBonus: number
  stabilityBonus: number
  activityBonus: number
  description: string
  tags: string[]
}

export type HomeLifecyclePhase =
  | "initial_empty_land"
  | "initial_care_phase"
  | "temporary_shelter_phase"
  | "basic_living_phase"
  | "garden_opening_phase"
  | "stable_home_phase"

export type HomeLifecycleState = {
  phase: HomeLifecyclePhase
  phaseProgress: number
  mainGoal: string
  nextGoal: string
  canSupportPetExploration: boolean
  canSupportPetRest: boolean
  canSupportFoodRoutine: boolean
  canSupportGardenActivity: boolean
  summary: string
  tags: string[]
}

export type HomeGoalId =
  | "stabilize_initial_care"
  | "build_temporary_shelter"
  | "complete_basic_living"
  | "open_garden_area"
  | "maintain_home_facilities"
  | "prepare_future_expansion"

export type HomeGoalPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent"

export type HomeGoalTarget =
  | "care"
  | "space"
  | "facility"
  | "home"
  | "future_world"

export type HomeGoalState = {
  id: HomeGoalId
  priority: HomeGoalPriority
  target: HomeGoalTarget
  progress: number
  title: string
  description: string
  reason: string
  recommendedBehaviorKinds: string[]
  tags: string[]
}

export type HomeState = {
  level: number
  progress: number
  status: HomeStatus
  constructionStage: HomeConstructionStage
  evolutionFocus: HomeEvolutionFocus
  gardenProgress: number
  comfort: number
  stability: number
  expansion: number
  homeSpaces?: HomeSpaceState[]
  spaceSummary?: HomeSpaceSummary
  homeFacilities?: HomeFacilityState[]
  lifecycle?: HomeLifecycleState
  homeGoals?: HomeGoalState[]
}
