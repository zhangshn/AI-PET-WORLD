/**
 * 当前文件负责：定义 MVP 初始家园的大型临时结构坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_STRUCTURE_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-structure-layer",
  name: "初始家园临时结构层",
  placements: [
    {
      id: "adoption-arrival-point",
      assetId: "arrivalPointGrassRingSoft01",
      label: "临时领养抵达点",
      x: 18,
      y: 21,
      scale: 0.92,
      layer: 50,
    },
    {
      id: "butler-temporary-shelter",
      assetId: "buildingTempShelterCanvasTent01",
      label: "管家临时管理点",
      x: 52,
      y: 20,
      scale: 1,
      layer: 70,
    },
  ],
}
