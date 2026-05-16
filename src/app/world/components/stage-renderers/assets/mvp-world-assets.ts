/**
 * 当前文件负责：登记 MVP 世界拼装阶段使用的 PNG 像素素材路径。
 */

export const MVP_WORLD_ASSETS = {
  groundGrassBase: "/assets/generated/world/ground/ground_grass_base_01.png",
  pathDirtHorizontal: "/assets/generated/world/paths/path_dirt_horizontal_01.png",
  surfaceGrassTuftLow:
    "/assets/generated/world/surface/surface_grass_tuft_low_01.png",
  natureBushRoundLow:
    "/assets/generated/world/nature/nature_bush_round_low_01.png",
  zoneInitialEmptyLandTrace:
    "/assets/generated/world/zones/zone_initial_empty_land_trace_01.png",
  facilityFoodBowlFull:
    "/assets/generated/home/facilities/facility_food_bowl_full_01.png",
  facilityWaterBowlFull:
    "/assets/generated/home/facilities/facility_water_bowl_full_01.png",
  facilityPetBedNeat:
    "/assets/generated/home/facilities/facility_pet_bed_neat_01.png",
  facilityLampOn: "/assets/generated/home/facilities/facility_lamp_on_01.png",
  buildingTempShelterCanvasTent:
    "/assets/generated/home/buildings/temp-shelter/building_temp_shelter_canvas_tent_01.png",
  arrivalPointGrassRingSoft:
    "/assets/generated/home/arrival-point/arrival_point_grass_ring_soft_01.png",
} as const

export type MvpWorldAssetKey = keyof typeof MVP_WORLD_ASSETS
