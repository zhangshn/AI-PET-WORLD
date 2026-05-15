/**
 * 当前文件负责：定义 MVP 初始家园的宠物照护设施坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_FACILITY_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-facility-layer",
  name: "初始家园照护设施层",
  placements: [
    {
      id: "food-bowl",
      assetId: "facilityFoodBowlFull01",
      label: "食物碗",
      x: 34,
      y: 29,
      scale: 0.9,
      layer: 60,
    },
    {
      id: "water-bowl",
      assetId: "facilityWaterBowlFull01",
      label: "水盆",
      x: 36,
      y: 29,
      scale: 0.9,
      layer: 60,
    },
    {
      id: "pet-bed",
      assetId: "facilityPetBedNeat01",
      label: "宠物临时休息点",
      x: 55,
      y: 29,
      scale: 0.96,
      layer: 60,
    },
    {
      id: "storage-box",
      assetId: "facilityStorageBoxClosed01",
      label: "储物箱",
      x: 39,
      y: 30,
      scale: 0.78,
      layer: 60,
    },
    {
      id: "rest-lamp",
      assetId: "facilityLampOn01",
      label: "临时小灯",
      x: 62,
      y: 30,
      scale: 0.82,
      layer: 61,
    },
  ],
}
