/**
 * 当前文件负责：定义主世界视觉设计系统的通用类型。
 */

export type StageDesignCategory =
  | "terrain"
  | "tree"
  | "plant"
  | "insect"
  | "water"
  | "stone"
  | "structure"
  | "actor_zone"
  | "atmosphere"
  | "gameplay_signal"

export type StageDesignPriority = "P0" | "P1" | "P2"

export type StageDesignDensity =
  | "none"
  | "very_low"
  | "low"
  | "medium"
  | "high"

export type StageDesignPlacement =
  | "core_courtyard"
  | "pet_activity_area"
  | "butler_observation_area"
  | "home_area"
  | "life_capsule_area"
  | "forest_edge"
  | "flower_slope"
  | "lake_side"
  | "path_side"
  | "map_edge"
  | "background"
  | "foreground"
  | "night_only"
  | "debug_only"

export type StageDesignInteractionRole =
  | "visual_only"
  | "pet_perception_source"
  | "butler_work_target"
  | "home_progress_anchor"
  | "world_notice_anchor"
  | "atmosphere_feedback"
  | "movement_guidance"
  | "future_expandable"

export type StageDesignTimeMode =
  | "all_day"
  | "daytime"
  | "night"
  | "weather_sensitive"

export type StageDesignMvpStatus =
  | "enabled"
  | "disabled"
  | "reserved"

export type StageDesignSpawnMode =
  | "fixed"
  | "seeded_random"
  | "runtime_dynamic"

export type StageDesignSpawnRule = {
  min: number
  max: number
  defaultCount: number
  mode: StageDesignSpawnMode
}

export type StageDesignItem = {
  id: string
  category: StageDesignCategory
  label: string
  description: string

  priority: StageDesignPriority
  mvpStatus: StageDesignMvpStatus

  density: StageDesignDensity
  placements: StageDesignPlacement[]
  interactionRoles: StageDesignInteractionRole[]
  timeMode: StageDesignTimeMode

  /**
   * 数量生成规则。
   *
   * MVP 当前只作为设计约束使用。
   * 后续 renderer / validator 接入后，用它控制昆虫、粒子、光斑等动态元素数量。
   */
  spawnRule?: StageDesignSpawnRule

  visualKeywords: string[]
  validationNotes: string[]

  /**
   * 季节扩展备注。
   *
   * MVP 阶段不读取、不执行、不参与生成。
   * 后续季节系统接入后，可以用于影响数量、颜色、活跃时间和出现区域。
   */
  seasonalHook?: string

  /**
   * 未来扩展备注。
   *
   * MVP 阶段不读取、不执行、不参与生成。
   * 用于记录未来可能接入的八字、风水、五行、季节、生态等扩展方向。
   */
  futureHook?: string
}

export type StageDesignCatalogGroup = {
  groupId: string
  label: string
  description: string
  items: StageDesignItem[]
}

export function getEnabledStageDesignItems(
  items: StageDesignItem[]
): StageDesignItem[] {
  return items.filter((item) => item.mvpStatus === "enabled")
}

export function getStageDesignItemsByCategory(
  items: StageDesignItem[],
  category: StageDesignCategory
): StageDesignItem[] {
  return items.filter((item) => item.category === category)
}

export function getStageDesignItemsByPriority(
  items: StageDesignItem[],
  priority: StageDesignPriority
): StageDesignItem[] {
  return items.filter((item) => item.priority === priority)
}