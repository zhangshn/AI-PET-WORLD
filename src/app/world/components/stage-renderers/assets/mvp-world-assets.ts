/**
 * 当前文件负责：登记 MVP 世界拼装测试层使用的 PNG 素材路径。
 */

export const MVP_WORLD_ASSETS = {
  groundGrassBase01: "/assets/generated/world/ground/ground_grass_base_01.png",
  pathDirtHorizontal01: "/assets/generated/world/paths/path_dirt_horizontal_01.png",
  surfaceGrassTuftLow01:
    "/assets/generated/world/surface/surface_grass_tuft_low_01.png",
  natureBushRoundLow01:
    "/assets/generated/world/nature/nature_bush_round_low_01.png",
  zoneInitialEmptyLandTrace01:
    "/assets/generated/world/zones/zone_initial_empty_land_trace_01.png",
  facilityFoodBowlFull01:
    "/assets/generated/home/facilities/facility_food_bowl_full_01.png",
  facilityWaterBowlFull01:
    "/assets/generated/home/facilities/facility_water_bowl_full_01.png",
  facilityPetBedNeat01:
    "/assets/generated/home/facilities/facility_pet_bed_neat_01.png",
  facilityLampOn01:
    "/assets/generated/home/facilities/facility_lamp_on_01.png",
  buildingTempShelterCanvasTent01:
    "/assets/generated/home/buildings/temp-shelter/building_temp_shelter_canvas_tent_01.png",
  arrivalPointGrassRingSoft01:
    "/assets/generated/home/arrival-point/arrival_point_grass_ring_soft_01.png",
} as const

export type MvpWorldAssetId = keyof typeof MVP_WORLD_ASSETS

export function getMvpWorldAssetPath(assetId: MvpWorldAssetId): string {
  return MVP_WORLD_ASSETS[assetId]
}
