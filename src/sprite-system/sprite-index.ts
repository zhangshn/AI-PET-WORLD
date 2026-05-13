/**
 * 当前文件负责：提供像素 Sprite Sheet 占位元数据索引。
 */

import type {
  SpriteAnimationId,
  SpriteCategory,
  SpriteFrameMetadata,
  SpriteGridSize,
  SpriteMetadataIndex,
  SpriteSheetId,
  SpriteSheetMetadata,
  SpriteVariantMapping,
  SpriteVisualTags,
} from "./sprite-metadata.types"

function buildFrame(input: SpriteFrameMetadata): SpriteFrameMetadata {
  return input
}

function makeFrame(input: {
  id: string
  sheetId: SpriteSheetId
  category: SpriteCategory
  name: string
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
  gridSize: SpriteGridSize
  tags: SpriteVisualTags
  description: string
}): SpriteFrameMetadata {
  return buildFrame({
    id: input.id,
    sheetId: input.sheetId,
    category: input.category,
    name: input.name,
    rect: {
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
    },
    anchor: { x: input.anchorX, y: input.anchorY },
    gridSize: input.gridSize,
    tags: input.tags,
    description: input.description,
  })
}

const butlerFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "butler_structured_compact_v1_idle_0", sheetId: "actors_butlers_v1", category: "butler", name: "秩序建设型管家待机帧", x: 0, y: 0, width: 32, height: 48, anchorX: 16, anchorY: 44, gridSize: { columns: 2, rows: 3 }, tags: { archetype: "structured_builder", colorTone: "metal_clear", butlerSilhouette: "steady_compact" }, description: "稳定、方正、衣着整齐，适合秩序建设型玩家的管家外观。" }),
  makeFrame({ id: "butler_soft_round_v1_idle_0", sheetId: "actors_butlers_v1", category: "butler", name: "温暖照护型管家待机帧", x: 32, y: 0, width: 32, height: 48, anchorX: 16, anchorY: 44, gridSize: { columns: 2, rows: 3 }, tags: { archetype: "warm_caretaker", colorTone: "earth_warm", butlerSilhouette: "soft_round" }, description: "暖色、柔和、照护感更强，适合温暖照护型玩家。" }),
  makeFrame({ id: "butler_guarded_upright_v1_idle_0", sheetId: "actors_butlers_v1", category: "butler", name: "边界守护型管家待机帧", x: 64, y: 0, width: 32, height: 48, anchorX: 16, anchorY: 44, gridSize: { columns: 2, rows: 3 }, tags: { archetype: "protective_keeper", colorTone: "wood_green", butlerSilhouette: "guarded_upright" }, description: "直立、边界感更强，适合保护和观察型管家。" }),
  makeFrame({ id: "butler_elegant_light_v1_idle_0", sheetId: "actors_butlers_v1", category: "butler", name: "审美整理型管家待机帧", x: 96, y: 0, width: 32, height: 48, anchorX: 16, anchorY: 44, gridSize: { columns: 2, rows: 3 }, tags: { archetype: "aesthetic_organizer", colorTone: "fire_bright", butlerSilhouette: "elegant_light" }, description: "轻盈、有装饰感，适合审美整理型家园。" }),
  makeFrame({ id: "butler_quiet_simple_v1_idle_0", sheetId: "actors_butlers_v1", category: "butler", name: "安静维护型管家待机帧", x: 128, y: 0, width: 32, height: 48, anchorX: 16, anchorY: 44, gridSize: { columns: 2, rows: 3 }, tags: { archetype: "quiet_maintainer", colorTone: "water_quiet", butlerSilhouette: "quiet_simple" }, description: "低调、稳定、少装饰，适合安静维护型玩家。" }),
  makeFrame({ id: "butler_balanced_adaptive_v1_idle_0", sheetId: "actors_butlers_v1", category: "butler", name: "适应规划型管家待机帧", x: 160, y: 0, width: 32, height: 48, anchorX: 16, anchorY: 44, gridSize: { columns: 2, rows: 3 }, tags: { archetype: "adaptive_planner", colorTone: "moon_soft", butlerSilhouette: "balanced_adaptive" }, description: "平衡、混合，适合根据资源和宠物状态动态调整。" }),
]

const petFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "pet_stable_attached_v1_idle_0", sheetId: "actors_pets_v1", category: "pet", name: "稳定依恋型宠物待机帧", x: 0, y: 0, width: 32, height: 32, anchorX: 16, anchorY: 30, gridSize: { columns: 2, rows: 2 }, tags: { petMatchType: "stable_attached", colorTone: "metal_clear" }, description: "稳定、亲近、体型偏圆稳的宠物外观。" }),
  makeFrame({ id: "pet_soft_companion_v1_idle_0", sheetId: "actors_pets_v1", category: "pet", name: "柔软陪伴型宠物待机帧", x: 32, y: 0, width: 32, height: 32, anchorX: 16, anchorY: 30, gridSize: { columns: 2, rows: 2 }, tags: { petMatchType: "soft_companion", colorTone: "earth_warm" }, description: "柔和、圆润、低攻击性，更强调陪伴感。" }),
  makeFrame({ id: "pet_alert_guardian_v1_idle_0", sheetId: "actors_pets_v1", category: "pet", name: "警觉守护型宠物待机帧", x: 64, y: 0, width: 32, height: 32, anchorX: 16, anchorY: 30, gridSize: { columns: 2, rows: 2 }, tags: { petMatchType: "alert_guardian", colorTone: "wood_green" }, description: "耳朵更明显、站姿更警觉，适合边界守护型家园。" }),
  makeFrame({ id: "pet_curious_playful_v1_idle_0", sheetId: "actors_pets_v1", category: "pet", name: "好奇活泼型宠物待机帧", x: 96, y: 0, width: 32, height: 32, anchorX: 16, anchorY: 30, gridSize: { columns: 2, rows: 2 }, tags: { petMatchType: "curious_playful", colorTone: "fire_bright" }, description: "体态更轻、更亮，尾巴或耳朵更活跃。" }),
  makeFrame({ id: "pet_quiet_observer_v1_idle_0", sheetId: "actors_pets_v1", category: "pet", name: "安静观察型宠物待机帧", x: 128, y: 0, width: 32, height: 32, anchorX: 16, anchorY: 30, gridSize: { columns: 2, rows: 2 }, tags: { petMatchType: "quiet_observer", colorTone: "water_quiet" }, description: "低饱和、眼神安静、动作幅度小。" }),
  makeFrame({ id: "pet_adaptive_partner_v1_idle_0", sheetId: "actors_pets_v1", category: "pet", name: "适应伙伴型宠物待机帧", x: 160, y: 0, width: 32, height: 32, anchorX: 16, anchorY: 30, gridSize: { columns: 2, rows: 2 }, tags: { petMatchType: "adaptive_partner", colorTone: "moon_soft" }, description: "混合体态，可随场景变化。" }),
]

const treeFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "tree_neat_low_grass_v1_base_0", sheetId: "nature_trees_v1", category: "nature", name: "整齐低草树木", x: 0, y: 0, width: 48, height: 64, anchorX: 24, anchorY: 60, gridSize: { columns: 3, rows: 4 }, tags: { gardenStyle: "neat_low_grass", colorTone: "metal_clear" }, description: "秩序建设型家园的整齐树木和低草边界。" }),
  makeFrame({ id: "tree_warm_flower_patch_v1_base_0", sheetId: "nature_trees_v1", category: "nature", name: "温暖花丛树木", x: 48, y: 0, width: 48, height: 64, anchorX: 24, anchorY: 60, gridSize: { columns: 3, rows: 4 }, tags: { gardenStyle: "warm_flower_patch", colorTone: "earth_warm" }, description: "温暖照护型家园的花丛树木。" }),
  makeFrame({ id: "tree_protected_shrub_edge_v1_base_0", sheetId: "nature_trees_v1", category: "nature", name: "防护灌木边界树木", x: 96, y: 0, width: 48, height: 64, anchorX: 24, anchorY: 60, gridSize: { columns: 3, rows: 4 }, tags: { gardenStyle: "protected_shrub_edge", colorTone: "wood_green" }, description: "边界守护型家园的树木与灌木边界。" }),
  makeFrame({ id: "tree_decorative_garden_v1_base_0", sheetId: "nature_trees_v1", category: "nature", name: "装饰花园树木", x: 144, y: 0, width: 48, height: 64, anchorX: 24, anchorY: 60, gridSize: { columns: 3, rows: 4 }, tags: { gardenStyle: "decorative_garden", colorTone: "fire_bright" }, description: "审美整理型家园的装饰花园树木。" }),
  makeFrame({ id: "tree_quiet_shade_v1_base_0", sheetId: "nature_trees_v1", category: "nature", name: "安静树荫", x: 192, y: 0, width: 48, height: 64, anchorX: 24, anchorY: 60, gridSize: { columns: 3, rows: 4 }, tags: { gardenStyle: "quiet_shade", colorTone: "water_quiet" }, description: "安静维护型家园的低饱和树荫。" }),
  makeFrame({ id: "tree_mixed_natural_v1_base_0", sheetId: "nature_trees_v1", category: "nature", name: "混合自然树木", x: 240, y: 0, width: 48, height: 64, anchorX: 24, anchorY: 60, gridSize: { columns: 3, rows: 4 }, tags: { gardenStyle: "mixed_natural", colorTone: "moon_soft" }, description: "适应规划型家园的混合自然树木。" }),
]

const shelterFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "shelter_straight_frame_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "直线框架临时住所", x: 0, y: 0, width: 80, height: 64, anchorX: 40, anchorY: 60, gridSize: { columns: 5, rows: 4 }, tags: { shelterStyle: "straight_frame", homeStyle: "orderly_structured" }, description: "HOME-02 阶段的秩序型临时住所。" }),
  makeFrame({ id: "shelter_soft_canopy_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "柔和遮蔽临时住所", x: 80, y: 0, width: 80, height: 64, anchorX: 40, anchorY: 60, gridSize: { columns: 5, rows: 4 }, tags: { shelterStyle: "soft_canopy", homeStyle: "warm_care_first" }, description: "HOME-02 阶段的温暖照护型临时住所。" }),
  makeFrame({ id: "shelter_reinforced_edge_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "加固边界临时住所", x: 160, y: 0, width: 80, height: 64, anchorX: 40, anchorY: 60, gridSize: { columns: 5, rows: 4 }, tags: { shelterStyle: "reinforced_edge", homeStyle: "protected_boundary" }, description: "HOME-02 阶段的边界防护型临时住所。" }),
  makeFrame({ id: "shelter_decorated_roof_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "装饰屋顶临时住所", x: 240, y: 0, width: 80, height: 64, anchorX: 40, anchorY: 60, gridSize: { columns: 5, rows: 4 }, tags: { shelterStyle: "decorated_roof", homeStyle: "flowered_aesthetic" }, description: "HOME-02 阶段的审美整理型临时住所。" }),
  makeFrame({ id: "shelter_low_quiet_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "低调安静临时住所", x: 320, y: 0, width: 80, height: 64, anchorX: 40, anchorY: 60, gridSize: { columns: 5, rows: 4 }, tags: { shelterStyle: "low_quiet_shelter", homeStyle: "quiet_minimal" }, description: "HOME-02 阶段的安静维护型临时住所。" }),
  makeFrame({ id: "shelter_adaptive_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "适应型临时住所", x: 400, y: 0, width: 80, height: 64, anchorX: 40, anchorY: 60, gridSize: { columns: 5, rows: 4 }, tags: { shelterStyle: "adaptive_shelter", homeStyle: "adaptive_mixed" }, description: "HOME-02 阶段的适应规划型临时住所。" }),
]

const houseFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "home_orderly_structured_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "秩序结构型基础小屋", x: 0, y: 64, width: 96, height: 80, anchorX: 48, anchorY: 76, gridSize: { columns: 6, rows: 5 }, tags: { homeStyle: "orderly_structured", colorTone: "metal_clear" }, description: "HOME-03 阶段基础小屋，占地 6x5 tile。" }),
  makeFrame({ id: "home_warm_care_first_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "温暖照护型基础小屋", x: 96, y: 64, width: 96, height: 80, anchorX: 48, anchorY: 76, gridSize: { columns: 6, rows: 5 }, tags: { homeStyle: "warm_care_first", colorTone: "earth_warm" }, description: "HOME-03 阶段暖色照护型基础小屋。" }),
  makeFrame({ id: "home_protected_boundary_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "边界防护型基础小屋", x: 192, y: 64, width: 96, height: 80, anchorX: 48, anchorY: 76, gridSize: { columns: 6, rows: 5 }, tags: { homeStyle: "protected_boundary", colorTone: "wood_green" }, description: "HOME-03 阶段带边界防护感的基础小屋。" }),
  makeFrame({ id: "home_flowered_aesthetic_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "花园审美型基础小屋", x: 288, y: 64, width: 96, height: 80, anchorX: 48, anchorY: 76, gridSize: { columns: 6, rows: 5 }, tags: { homeStyle: "flowered_aesthetic", colorTone: "fire_bright" }, description: "HOME-03 阶段带装饰屋顶和窗光的基础小屋。" }),
  makeFrame({ id: "home_quiet_minimal_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "安静极简型基础小屋", x: 384, y: 64, width: 96, height: 80, anchorX: 48, anchorY: 76, gridSize: { columns: 6, rows: 5 }, tags: { homeStyle: "quiet_minimal", colorTone: "water_quiet" }, description: "HOME-03 阶段低调稳定的基础小屋。" }),
  makeFrame({ id: "home_adaptive_mixed_v1_base_0", sheetId: "buildings_home_v1", category: "building", name: "适应混合型基础小屋", x: 480, y: 64, width: 96, height: 80, anchorX: 48, anchorY: 76, gridSize: { columns: 6, rows: 5 }, tags: { homeStyle: "adaptive_mixed", colorTone: "moon_soft" }, description: "HOME-03 阶段可根据场景调整的混合型基础小屋。" }),
]

const facilityFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "care_storage_first_v1_base_0", sheetId: "facilities_care_v1", category: "facility", name: "储物优先照护角", x: 0, y: 0, width: 80, height: 48, anchorX: 40, anchorY: 44, gridSize: { columns: 5, rows: 3 }, tags: { carePriority: "storage_first" }, description: "储物、整理和资源管理更明显的照护角。" }),
  makeFrame({ id: "care_comfort_first_v1_base_0", sheetId: "facilities_care_v1", category: "facility", name: "舒适优先照护角", x: 80, y: 0, width: 80, height: 48, anchorX: 40, anchorY: 44, gridSize: { columns: 5, rows: 3 }, tags: { carePriority: "comfort_first" }, description: "宠物床、食物碗、水碗更突出的照护角。" }),
  makeFrame({ id: "care_safety_first_v1_base_0", sheetId: "facilities_care_v1", category: "facility", name: "安全优先照护角", x: 160, y: 0, width: 80, height: 48, anchorX: 40, anchorY: 44, gridSize: { columns: 5, rows: 3 }, tags: { carePriority: "safety_first" }, description: "观察点和边界感更强的照护角。" }),
  makeFrame({ id: "care_beauty_first_v1_base_0", sheetId: "facilities_care_v1", category: "facility", name: "美观优先照护角", x: 240, y: 0, width: 80, height: 48, anchorX: 40, anchorY: 44, gridSize: { columns: 5, rows: 3 }, tags: { carePriority: "beauty_first" }, description: "花、垫子和装饰感更强的照护角。" }),
  makeFrame({ id: "care_stability_first_v1_base_0", sheetId: "facilities_care_v1", category: "facility", name: "稳定优先照护角", x: 320, y: 0, width: 80, height: 48, anchorX: 40, anchorY: 44, gridSize: { columns: 5, rows: 3 }, tags: { carePriority: "stability_first" }, description: "安静、低调、耐久的照护角。" }),
  makeFrame({ id: "care_context_first_v1_base_0", sheetId: "facilities_care_v1", category: "facility", name: "情境优先照护角", x: 400, y: 0, width: 80, height: 48, anchorX: 40, anchorY: 44, gridSize: { columns: 5, rows: 3 }, tags: { carePriority: "context_first" }, description: "根据宠物状态和资源动态调整的照护角。" }),
]

const adoptionFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "adoption_center_clear_service_v1_base_0", sheetId: "buildings_adoption_v1", category: "building", name: "清晰服务型临时领养中心", x: 0, y: 0, width: 96, height: 64, anchorX: 48, anchorY: 60, gridSize: { columns: 6, rows: 4 }, tags: { archetype: "structured_builder", colorTone: "metal_clear" }, description: "结构清晰、服务路径明确的临时领养中心。" }),
  makeFrame({ id: "adoption_center_warm_service_v1_base_0", sheetId: "buildings_adoption_v1", category: "building", name: "温暖服务型临时领养中心", x: 96, y: 0, width: 96, height: 64, anchorX: 48, anchorY: 60, gridSize: { columns: 6, rows: 4 }, tags: { archetype: "warm_caretaker", colorTone: "earth_warm" }, description: "欢迎感和照护感更强的临时领养中心。" }),
  makeFrame({ id: "adoption_center_protected_service_v1_base_0", sheetId: "buildings_adoption_v1", category: "building", name: "防护服务型临时领养中心", x: 192, y: 0, width: 96, height: 64, anchorX: 48, anchorY: 60, gridSize: { columns: 6, rows: 4 }, tags: { archetype: "protective_keeper", colorTone: "wood_green" }, description: "边界和安全感更强的临时领养中心。" }),
  makeFrame({ id: "adoption_center_decorative_service_v1_base_0", sheetId: "buildings_adoption_v1", category: "building", name: "装饰服务型临时领养中心", x: 288, y: 0, width: 96, height: 64, anchorX: 48, anchorY: 60, gridSize: { columns: 6, rows: 4 }, tags: { archetype: "aesthetic_organizer", colorTone: "fire_bright" }, description: "招牌、花和窗光更明显的临时领养中心。" }),
  makeFrame({ id: "adoption_center_quiet_service_v1_base_0", sheetId: "buildings_adoption_v1", category: "building", name: "安静服务型临时领养中心", x: 384, y: 0, width: 96, height: 64, anchorX: 48, anchorY: 60, gridSize: { columns: 6, rows: 4 }, tags: { archetype: "quiet_maintainer", colorTone: "water_quiet" }, description: "低调、安静、不打扰的临时领养中心。" }),
  makeFrame({ id: "adoption_center_adaptive_service_v1_base_0", sheetId: "buildings_adoption_v1", category: "building", name: "适应服务型临时领养中心", x: 480, y: 0, width: 96, height: 64, anchorX: 48, anchorY: 60, gridSize: { columns: 6, rows: 4 }, tags: { archetype: "adaptive_planner", colorTone: "moon_soft" }, description: "根据家园阶段和宠物抵达情况调整的临时领养中心。" }),
]

const tileFrames: SpriteFrameMetadata[] = [
  makeFrame({ id: "tile_grass_base_v1_0", sheetId: "tiles_ground_v1", category: "tile", name: "基础草地 Tile", x: 0, y: 0, width: 16, height: 16, anchorX: 0, anchorY: 0, gridSize: { columns: 1, rows: 1 }, tags: { gardenStyle: "mixed_natural" }, description: "可重复拼接的基础草地。" }),
  makeFrame({ id: "tile_dirt_path_v1_0", sheetId: "tiles_path_v1", category: "tile", name: "泥路 Tile", x: 0, y: 0, width: 16, height: 16, anchorX: 0, anchorY: 0, gridSize: { columns: 1, rows: 1 }, tags: { homeStyle: "orderly_structured" }, description: "可重复拼接的泥土路径。" }),
]

const buildingFrames = [...shelterFrames, ...houseFrames]

function buildAnimation(
  id: SpriteAnimationId,
  frameIds: string[],
  loop: boolean
) {
  return { id, frameIds, frameDurationMs: id === "idle" ? 600 : 1000, loop }
}

const sheets: SpriteSheetMetadata[] = [
  { id: "actors_butlers_v1", imagePath: "/assets/pixel/actors/butlers/actors_butlers_v1.png", tileSize: 16, pixelScale: 4, category: "butler", frameWidth: 32, frameHeight: 48, frames: butlerFrames, animations: [buildAnimation("idle", butlerFrames.map((frame) => frame.id), true)], notes: "MVP 6 类管家待机帧占位索引，真实图片后续补充。" },
  { id: "actors_pets_v1", imagePath: "/assets/pixel/actors/pets/actors_pets_v1.png", tileSize: 16, pixelScale: 4, category: "pet", frameWidth: 32, frameHeight: 32, frames: petFrames, animations: [buildAnimation("idle", petFrames.map((frame) => frame.id), true)], notes: "MVP 6 类宠物待机帧占位索引，真实图片后续补充。" },
  { id: "nature_trees_v1", imagePath: "/assets/pixel/nature/trees.png", tileSize: 16, pixelScale: 4, category: "nature", frameWidth: 48, frameHeight: 64, frames: treeFrames, animations: [buildAnimation("base", treeFrames.map((frame) => frame.id), false)], notes: "6 类花园 / 树木占位索引。" },
  { id: "buildings_home_v1", imagePath: "/assets/pixel/buildings/buildings_home_v1.png", tileSize: 16, pixelScale: 4, category: "building", frameWidth: 96, frameHeight: 80, frames: buildingFrames, animations: [buildAnimation("base", buildingFrames.map((frame) => frame.id), false)], notes: "临时住所和基础小屋 sprite 占位索引。" },
  { id: "buildings_adoption_v1", imagePath: "/assets/pixel/buildings/adoption_centers.png", tileSize: 16, pixelScale: 4, category: "building", frameWidth: 96, frameHeight: 64, frames: adoptionFrames, animations: [buildAnimation("base", adoptionFrames.map((frame) => frame.id), false)], notes: "临时领养中心 sprite 占位索引。" },
  { id: "facilities_care_v1", imagePath: "/assets/pixel/facilities/facilities_care_v1.png", tileSize: 16, pixelScale: 4, category: "facility", frameWidth: 80, frameHeight: 48, frames: facilityFrames, animations: [buildAnimation("base", facilityFrames.map((frame) => frame.id), false)], notes: "照护角 sprite 占位索引。" },
  { id: "tiles_ground_v1", imagePath: "/assets/pixel/tiles/ground.png", tileSize: 16, pixelScale: 4, category: "tile", frameWidth: 16, frameHeight: 16, frames: tileFrames.filter((frame) => frame.sheetId === "tiles_ground_v1"), animations: [buildAnimation("base", ["tile_grass_base_v1_0"], false)], notes: "地面 tile 占位索引。" },
  { id: "tiles_path_v1", imagePath: "/assets/pixel/tiles/path.png", tileSize: 16, pixelScale: 4, category: "tile", frameWidth: 16, frameHeight: 16, frames: tileFrames.filter((frame) => frame.sheetId === "tiles_path_v1"), animations: [buildAnimation("base", ["tile_dirt_path_v1_0"], false)], notes: "路径 tile 占位索引。" },
]

const frameGroups = [
  butlerFrames,
  petFrames,
  treeFrames,
  buildingFrames,
  facilityFrames,
  adoptionFrames,
]

const variantMappings: SpriteVariantMapping[] = frameGroups.flatMap((frames) =>
  frames.map((frame) => {
    const animationId: SpriteAnimationId =
      frame.category === "butler" || frame.category === "pet" ? "idle" : "base"

    return {
      spriteVariantId: frame.id.replace("_idle_0", "").replace("_base_0", ""),
      frameId: frame.id,
      sheetId: frame.sheetId,
      animationId,
      description: frame.description,
    }
  })
)

export const spriteMetadataIndex: SpriteMetadataIndex = {
  sheets,
  variantMappings,
}

export const spriteFrames = [
  ...butlerFrames,
  ...petFrames,
  ...treeFrames,
  ...buildingFrames,
  ...facilityFrames,
  ...adoptionFrames,
  ...tileFrames,
]
