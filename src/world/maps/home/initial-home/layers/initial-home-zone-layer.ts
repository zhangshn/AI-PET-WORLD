/**
 * 当前文件负责：定义 MVP 初始家园的区域痕迹坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_ZONE_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-zone-layer",
  name: "初始家园区域痕迹层",
  placements: [
    {
      id: "adoption-arrival-zone",
      assetId: "zoneInitialEmptyLandTrace01",
      label: "临时领养抵达空地",
      x: 18,
      y: 21,
      scale: 0.92,
      layer: 20,
      alpha: 0.86,
    },
    {
      id: "care-zone",
      assetId: "zoneInitialEmptyLandTrace01",
      label: "基础照护区",
      x: 35,
      y: 30,
      scale: 0.58,
      layer: 20,
      alpha: 0.66,
    },
    {
      id: "pet-rest-zone",
      assetId: "zoneInitialEmptyLandTrace01",
      label: "宠物临时休息区",
      x: 55,
      y: 29,
      scale: 0.58,
      layer: 20,
      alpha: 0.62,
    },
  ],
}
