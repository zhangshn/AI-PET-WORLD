// 该文件用于统一导出正式像素渲染模型能力。

export { buildFormalPixelRenderModel } from "./formal-pixel-renderer-gateway"
export { buildFormalPixelSvg } from "./formal-pixel-svg-renderer"
export type {
  FormalPixelActorLayer,
  FormalPixelActorRenderItem,
  FormalPixelAtmosphereLayer,
  FormalPixelAtmosphereRenderItem,
  FormalPixelCanvas,
  FormalPixelLayerKind,
  FormalPixelObjectLayer,
  FormalPixelObjectRenderItem,
  FormalPixelRendererAudit,
  FormalPixelRenderLayers,
  FormalPixelRenderModel,
  FormalPixelRenderSource,
  FormalPixelTileLayer,
  FormalPixelTileRenderItem,
  FormalPixelTraceLayer,
  FormalPixelTraceRenderItem,
} from "./formal-pixel-renderer-schema"
