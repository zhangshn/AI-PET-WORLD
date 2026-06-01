// 该文件用于定义自然石头像素对象 recipe 的默认模板。

import type { StoneTemplate } from "./stone-object-types";

export const STONE_OBJECT_TEMPLATE: StoneTemplate = {
  seed: "natural_stone_boulder_seed",
  originX: 78,
  originY: 92,
  cellSize: 2,
  gridWidth: 32,
  gridHeight: 27,
  lightDirection: "top_left",
  environmentTintStrength: 0.07,
};
