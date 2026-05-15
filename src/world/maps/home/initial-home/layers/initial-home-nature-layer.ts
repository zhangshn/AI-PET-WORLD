/**
 * 当前文件负责：定义 MVP 初始家园的自然物件坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_NATURE_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-nature-layer",
  name: "初始家园自然物件层",
  placements: [
    {
      id: "left-boundary-bush",
      assetId: "natureBushRoundLow01",
      label: "左侧自然边界灌木",
      x: 8,
      y: 11,
      scale: 0.92,
      layer: 35,
    },
    {
      id: "arrival-bottom-bush",
      assetId: "natureBushRoundLow01",
      label: "抵达点下方灌木",
      x: 20,
      y: 29,
      scale: 0.82,
      layer: 35,
    },
    {
      id: "middle-bush",
      assetId: "natureBushRoundLow01",
      label: "中部自然灌木",
      x: 39,
      y: 21,
      scale: 0.86,
      layer: 35,
    },
    {
      id: "shelter-right-bush",
      assetId: "natureBushRoundLow01",
      label: "临时帐篷右侧灌木",
      x: 57,
      y: 25,
      scale: 0.88,
      layer: 35,
    },
    {
      id: "right-boundary-bush",
      assetId: "natureBushRoundLow01",
      label: "右侧自然边界灌木",
      x: 67,
      y: 15,
      scale: 0.94,
      layer: 35,
    },
  ],
}
