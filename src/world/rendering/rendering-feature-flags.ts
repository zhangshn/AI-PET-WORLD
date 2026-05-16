/**
 * 当前文件负责：集中管理世界地图渲染特性开关。
 */

export const WORLD_RENDER_FEATURE_FLAGS = {
  useCanvasGround: true,
  useCanvasPath: true,
  useCanvasEdge: true,
  useCanvasDecal: true,
} as const
