/**
 * 当前文件负责：集中管理世界地图渲染特性开关。
 */

export const WORLD_RENDER_FEATURE_FLAGS = {
  renderGroundTiles: false,
  useCanvasPath: true,
  useCanvasEdge: false,
  useCanvasDecal: true,
} as const
