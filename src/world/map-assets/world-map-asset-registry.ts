/**
 * 当前文件负责：登记世界地图可复用 PNG 素材。
 */

import type { WorldMapAssetDefinition } from "./world-map-asset-schema"

export const WORLD_MAP_ASSETS = {
  groundGrassBase01: {
    id: "groundGrassBase01",
    category: "ground",
    path: "/assets/generated/world/ground/ground_grass_base_01.png",
    baseSize: 32,
    anchor: "top-left",
    description: "基础草地 tile",
  },
  pathDirtHorizontal01: {
    id: "pathDirtHorizontal01",
    category: "path",
    path: "/assets/generated/world/paths/path_dirt_horizontal_01.png",
    baseSize: 32,
    anchor: "top-left",
    description: "泥土小路 tile",
  },
  zoneInitialEmptyLandTrace01: {
    id: "zoneInitialEmptyLandTrace01",
    category: "zone",
    path: "/assets/generated/world/zones/zone_initial_empty_land_trace_01.png",
    baseSize: 128,
    anchor: "bottom-center",
    description: "未整理空地区域痕迹",
  },
  arrivalPointGrassRingSoft01: {
    id: "arrivalPointGrassRingSoft01",
    category: "structure",
    path: "/assets/generated/home/arrival-point/arrival_point_grass_ring_soft_01.png",
    baseSize: 128,
    anchor: "bottom-center",
    description: "宠物临时领养抵达点",
  },
  buildingTempShelterCanvasTent01: {
    id: "buildingTempShelterCanvasTent01",
    category: "structure",
    path: "/assets/generated/home/buildings/temp-shelter/building_temp_shelter_canvas_tent_01.png",
    baseSize: 128,
    anchor: "bottom-center",
    description: "管家临时管理帐篷",
  },
  facilityFoodBowlFull01: {
    id: "facilityFoodBowlFull01",
    category: "facility",
    path: "/assets/generated/home/facilities/facility_food_bowl_full_01.png",
    baseSize: 64,
    anchor: "bottom-center",
    description: "食物碗",
  },
  facilityWaterBowlFull01: {
    id: "facilityWaterBowlFull01",
    category: "facility",
    path: "/assets/generated/home/facilities/facility_water_bowl_full_01.png",
    baseSize: 64,
    anchor: "bottom-center",
    description: "水碗",
  },
  facilityPetBedNeat01: {
    id: "facilityPetBedNeat01",
    category: "facility",
    path: "/assets/generated/home/facilities/facility_pet_bed_neat_01.png",
    baseSize: 64,
    anchor: "bottom-center",
    description: "宠物临时休息窝",
  },
  facilityLampOn01: {
    id: "facilityLampOn01",
    category: "facility",
    path: "/assets/generated/home/facilities/facility_lamp_on_01.png",
    baseSize: 64,
    anchor: "bottom-center",
    description: "临时小灯",
  },
  natureBushRoundLow01: {
    id: "natureBushRoundLow01",
    category: "nature",
    path: "/assets/generated/world/nature/nature_bush_round_low_01.png",
    baseSize: 64,
    anchor: "bottom-center",
    description: "低矮圆形灌木",
  },
  surfaceGrassTuftLow01: {
    id: "surfaceGrassTuftLow01",
    category: "surface_decoration",
    path: "/assets/generated/world/surface/surface_grass_tuft_low_01.png",
    baseSize: 32,
    anchor: "bottom-center",
    description: "低矮草丛装饰",
  },
} as const satisfies Record<string, WorldMapAssetDefinition>

export type WorldMapAssetId = keyof typeof WORLD_MAP_ASSETS

export function getWorldMapAssetPath(assetId: WorldMapAssetId): string {
  return WORLD_MAP_ASSETS[assetId].path
}
