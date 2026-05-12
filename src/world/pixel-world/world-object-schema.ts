/**
 * 当前文件负责：定义像素世界业务对象层的基础类型。
 */

export type WorldObjectCategory =
  | "home"
  | "town"
  | "adoption_center"
  | "actor"
  | "pet"
  | "ground"
  | "path"
  | "facility"
  | "interaction"
  | "environment"
  | "effect"

export type WorldObjectKind =
  | "home_land"
  | "home_boundary"
  | "home_path"
  | "temporary_shelter"
  | "home_foundation"
  | "home_wall"
  | "home_roof"
  | "home_door"
  | "home_window"
  | "home_light"
  | "home_fence"
  | "garden_patch"
  | "observation_spot"
  | "storage_box"
  | "food_corner"
  | "water_corner"
  | "pet_bed"
  | "town_gate"
  | "town_path"
  | "town_square"
  | "adoption_center"
  | "adoption_sign"
  | "adoption_counter"
  | "adoption_waiting_area"
  | "adoption_notice_board"
  | "pet_arrival_point"
  | "butler_town_route"
  | "home_welcome_area"
  | "butler_actor"
  | "butler_tool"
  | "butler_emotion_effect"
  | "pet_actor"
  | "pet_shadow"
  | "pet_emotion_effect"
  | "grass_base"
  | "grass_detail"
  | "grass_flower"
  | "grass_weed"
  | "dirt_path"
  | "stone_path"
  | "footprint_pet"
  | "maintenance_mark"
  | "ambient_light"
  | "weather_overlay"

export type WorldObjectInteractionRole =
  | "none"
  | "clickable"
  | "observable"
  | "enter"
  | "exit"
  | "inspect"
  | "build_target"
  | "pet_focus"
  | "butler_focus"
  | "arrival_focus"

export type WorldObjectBuildRole =
  | "none"
  | "land"
  | "shelter"
  | "structure"
  | "facility"
  | "garden"
  | "path"
  | "boundary"
  | "comfort"
  | "care"
  | "storage"
  | "town_service"

export type WorldObjectPerceptionRole =
  | "none"
  | "pet_sense"
  | "butler_sense"
  | "both_sense"
  | "player_observe"

export type WorldObjectStyleTag =
  | "structured"
  | "warm"
  | "protective"
  | "aesthetic"
  | "quiet"
  | "adaptive"
  | "order"
  | "comfort"
  | "stability"
  | "garden"
  | "care"
  | "boundary"
  | "arrival"
  | "town"
  | "home"
  | "pet_life"

export type PixelWorldObjectDefinition = {
  id: string
  kind: WorldObjectKind
  category: WorldObjectCategory
  displayName: string
  description: string
  defaultVisible: boolean
  interactionRoles: WorldObjectInteractionRole[]
  buildRole: WorldObjectBuildRole
  perceptionRole: WorldObjectPerceptionRole
  styleTags: WorldObjectStyleTag[]
  requiredStageTags: string[]
  unlockHint: string
  notes?: string
}
