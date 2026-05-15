/**
 * 当前文件负责：定义 MVP 初始家园的自然物件坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_NATURE_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-nature-layer",
  name: "初始家园自然物件层",
  placements: [
    {
      id: "upper-left-tree",
      assetId: "natureTreeSmall01",
      label: "左上小树",
      x: 7,
      y: 9,
      scale: 1,
      layer: 36,
    },
    {
      id: "left-boundary-bush",
      assetId: "natureBushSmall01",
      label: "左侧自然边界灌木",
      x: 8,
      y: 11,
      scale: 0.92,
      layer: 35,
    },
    {
      id: "arrival-bottom-bush",
      assetId: "natureBushSmall01",
      label: "抵达点下方灌木",
      x: 20,
      y: 29,
      scale: 0.82,
      layer: 35,
    },
    {
      id: "middle-bush",
      assetId: "natureBushSmall01",
      label: "中部自然灌木",
      x: 39,
      y: 21,
      scale: 0.86,
      layer: 35,
    },
    {
      id: "shelter-right-bush",
      assetId: "natureBushSmall01",
      label: "临时住所右侧灌木",
      x: 57,
      y: 25,
      scale: 0.88,
      layer: 35,
    },
    {
      id: "right-boundary-bush",
      assetId: "natureBushSmall01",
      label: "右侧自然边界灌木",
      x: 67,
      y: 15,
      scale: 0.94,
      layer: 35,
    },
    {
      id: "right-upper-tree",
      assetId: "natureTreeSmall01",
      label: "右侧小树",
      x: 69,
      y: 14,
      scale: 0.94,
      layer: 36,
    },
  ],
}
