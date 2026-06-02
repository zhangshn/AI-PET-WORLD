// 该文件用于定义正式像素主世界渲染器边界类型。
import type { PixelWorldCanvas, PixelWorldLayerKind } from "./pixel-worldview-types";
import type { PixelWorldRenderPlan } from "./pixel-worldview-render-types";

export type PixelWorldRendererMode = "headless_plan" | "pixel_buffer" | "future_pixi";

export type PixelWorldRendererTargetKind = "debug_headless" | "formal_world";

export type PixelWorldRendererSafety = {
  allowSvg: false;
  allowCanvasDom: false;
  allowCssGeometry: false;
  allowRuntimeWrite: false;
  allowDefaultPet: false;
};

export type PixelWorldRendererFrameLayer = {
  layer: PixelWorldLayerKind;
  commandIds: string[];
  visibleCount: number;
  hiddenCount: number;
};

export type PixelWorldRendererFrame = {
  frameId: string;
  worldId: string;
  tick: number;
  mode: PixelWorldRendererMode;
  target: PixelWorldRendererTargetKind;
  canvas: PixelWorldCanvas;
  sourcePlanCommandCount: number;
  layers: PixelWorldRendererFrameLayer[];
  safety: PixelWorldRendererSafety;
};

export type PixelWorldRendererInput = {
  plan: PixelWorldRenderPlan;
  mode?: PixelWorldRendererMode;
  target?: PixelWorldRendererTargetKind;
};

export type PixelWorldRendererResult = {
  frame: PixelWorldRendererFrame;
  sourcePlan: PixelWorldRenderPlan;
};
