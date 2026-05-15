/**
 * 当前文件负责：定义 MVP 初始家园的地表小装饰坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_SURFACE_DECORATION_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-surface-decoration-layer",
  name: "初始家园地表装饰层",
  placements: [
    {
      id: "arrival-side-grass",
      assetId: "surfaceGrassTuftLow01",
      label: "抵达点旁草丛",
      x: 14,
      y: 24,
      scale: 0.78,
      layer: 30,
    },
    {
      id: "mid-left-grass",
      assetId: "surfaceGrassTuftLow01",
      label: "中部左侧草丛",
      x: 28,
      y: 22,
      scale: 0.76,
      layer: 30,
    },
    {
      id: "shelter-side-grass",
      assetId: "surfaceGrassTuftLow01",
      label: "帐篷旁草丛",
      x: 47,
      y: 19,
      scale: 0.78,
      layer: 30,
    },
    {
      id: "right-bottom-grass",
      assetId: "surfaceGrassTuftLow01",
      label: "右下草丛",
      x: 70,
      y: 35,
      scale: 0.84,
      layer: 30,
    },
    {
      id: "lower-unfinished-grass",
      assetId: "surfaceGrassTuftLow01",
      label: "未整理地块草丛",
      x: 44,
      y: 39,
      scale: 0.8,
      layer: 30,
    },
  ],
}
