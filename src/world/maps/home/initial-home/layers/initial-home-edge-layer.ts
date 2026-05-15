/**
 * 当前文件负责：定义 MVP 初始家园的地面边缘坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_EDGE_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-edge-layer",
  name: "初始家园地面边缘层",
  placements: [
    {
      id: "shelter-dirt-edge-top",
      assetId: "edgeGrassDirtTop01",
      label: "临时住所泥地上边缘",
      x: 50,
      y: 18,
      scale: 0.75,
      layer: 11,
    },
    {
      id: "shelter-dirt-edge-bottom",
      assetId: "edgeGrassDirtBottom01",
      label: "临时住所泥地下边缘",
      x: 50,
      y: 21,
      scale: 0.75,
      layer: 11,
    },
    {
      id: "shelter-dirt-edge-left",
      assetId: "edgeGrassDirtLeft01",
      label: "临时住所泥地左边缘",
      x: 48,
      y: 19,
      scale: 0.75,
      layer: 11,
    },
    {
      id: "shelter-dirt-edge-right",
      assetId: "edgeGrassDirtRight01",
      label: "临时住所泥地右边缘",
      x: 54,
      y: 19,
      scale: 0.75,
      layer: 11,
    },
    {
      id: "care-dirt-edge-top",
      assetId: "edgeGrassDirtTop01",
      label: "照护区泥地上边缘",
      x: 34,
      y: 28,
      scale: 0.75,
      layer: 11,
    },
    {
      id: "care-dirt-edge-bottom",
      assetId: "edgeGrassDirtBottom01",
      label: "照护区泥地下边缘",
      x: 34,
      y: 30,
      scale: 0.75,
      layer: 11,
    },
  ],
}
