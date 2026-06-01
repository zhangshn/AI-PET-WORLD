// 该文件用于定义自然石头像素对象 recipe 的内部类型。

import type { PixelArtGrid } from "../../core/grid-utils";

export type StoneTone =
  | "outline"
  | "shadow"
  | "dark"
  | "ambientDark"
  | "main"
  | "light"
  | "highlight"
  | "crack"
  | "textureLight"
  | "textureDark";

export type StoneGrid = PixelArtGrid<StoneTone>;

export type StoneTemplate = {
  seed: string;
  originX: number;
  originY: number;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  lightDirection: "top_left";
  environmentTintStrength: number;
};
