// 该文件用于定义正式像素主世界渲染命令计划类型。

import type { PixelWorldBounds, PixelWorldCanvas, PixelWorldLayerKind } from "./pixel-worldview-types";

export type PixelWorldRenderCommandKind =
  | "fill_tile"
  | "draw_trace_patch"
  | "place_object_recipe"
  | "draw_actor_marker"
  | "apply_atmosphere_tint"
  | "draw_overlay_label";

export type PixelWorldRenderCommand = {
  id: string;
  layer: PixelWorldLayerKind;
  kind: PixelWorldRenderCommandKind;
  sourceId: string;
  bounds?: PixelWorldBounds;
  sortY?: number;
  opacity?: number;
  visible: boolean;
  tileX?: number;
  tileY?: number;
  recipeId?: string;
  text?: string;
  stateTags?: string[];
};

export type PixelWorldRenderLayerSummary = {
  layer: PixelWorldLayerKind;
  count: number;
};

export type PixelWorldRenderPlan = {
  worldId: string;
  tick: number;
  canvas: PixelWorldCanvas;
  commands: PixelWorldRenderCommand[];
  layerSummaries: PixelWorldRenderLayerSummary[];
};
