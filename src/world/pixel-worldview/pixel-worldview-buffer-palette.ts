// 该文件用于解析像素主世界纯数据缓冲区的颜色提示。
import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { PixelWorldBufferCellKind } from "./pixel-worldview-buffer-types";

export type PixelWorldBufferColorToken =
  | "grass_tile"
  | "pressed_trace"
  | "natural_object"
  | "actor_marker"
  | "atmosphere_tint"
  | "overlay_label"
  | "fallback";

export type PixelWorldBufferPaletteEntry = {
  token: PixelWorldBufferColorToken;
  color: string;
};

export const PIXEL_WORLD_BUFFER_PALETTE: Record<PixelWorldBufferColorToken, PixelWorldBufferPaletteEntry> = {
  grass_tile: { token: "grass_tile", color: "#5f8f4e" },
  pressed_trace: { token: "pressed_trace", color: "#8a6a3f" },
  natural_object: { token: "natural_object", color: "#4f6f3f" },
  actor_marker: { token: "actor_marker", color: "#d6b26f" },
  atmosphere_tint: { token: "atmosphere_tint", color: "#8fb6ff" },
  overlay_label: { token: "overlay_label", color: "#ffffff" },
  fallback: { token: "fallback", color: "#ff00ff" },
};

export function resolvePixelWorldBufferColorHint(input: {
  layer: PixelWorldLayerKind;
  kind: PixelWorldBufferCellKind;
  recipeId?: string;
  text?: string;
}): string {
  if (input.kind === "tile") return PIXEL_WORLD_BUFFER_PALETTE.grass_tile.color;
  if (input.kind === "trace") return PIXEL_WORLD_BUFFER_PALETTE.pressed_trace.color;
  if (input.kind === "object_marker") return PIXEL_WORLD_BUFFER_PALETTE.natural_object.color;
  if (input.kind === "actor_marker") return PIXEL_WORLD_BUFFER_PALETTE.actor_marker.color;
  if (input.kind === "atmosphere") return PIXEL_WORLD_BUFFER_PALETTE.atmosphere_tint.color;
  if (input.kind === "overlay_marker") return PIXEL_WORLD_BUFFER_PALETTE.overlay_label.color;
  return PIXEL_WORLD_BUFFER_PALETTE.fallback.color;
}
