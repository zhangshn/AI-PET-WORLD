import type { PixelWorldCanvas, PixelWorldLayerKind } from "./pixel-worldview-types";

export type PixelWorldBufferCellKind =
  | "tile"
  | "trace"
  | "object_marker"
  | "object_block"
  | "actor_marker"
  | "atmosphere"
  | "overlay_marker";

export type PixelWorldBufferCell = {
  id: string;
  layer: PixelWorldLayerKind;
  kind: PixelWorldBufferCellKind;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId?: string;
  sourceCommandId: string;
  visible: boolean;
  opacity: number;
  colorHint?: string;
  recipeId?: string;
  text?: string;
  stateTags?: string[];
};

export type PixelWorldBufferLayer = {
  layer: PixelWorldLayerKind;
  cells: PixelWorldBufferCell[];
  visibleCount: number;
  hiddenCount: number;
};

export type PixelWorldPixelBufferFrame = {
  bufferId: string;
  worldId: string;
  tick: number;
  canvas: PixelWorldCanvas;
  layers: PixelWorldBufferLayer[];
  cellCount: number;
};

export type PixelWorldBufferBuildResult = {
  buffer: PixelWorldPixelBufferFrame;
};
