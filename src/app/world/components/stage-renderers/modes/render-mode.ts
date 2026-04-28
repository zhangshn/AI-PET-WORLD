/**
 * 当前文件负责：定义世界舞台渲染模式。
 */

export type StageRenderMode = "graphics" | "pixel_assets"

export const DEFAULT_STAGE_RENDER_MODE: StageRenderMode = "graphics"

export function isGraphicsRenderMode(mode: StageRenderMode): boolean {
  return mode === "graphics"
}

export function isPixelAssetRenderMode(mode: StageRenderMode): boolean {
  return mode === "pixel_assets"
}