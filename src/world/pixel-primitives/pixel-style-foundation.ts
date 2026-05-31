// 该文件用于定义像素原型库的基础色板与风格规则。

import type { PixelLayerKind } from "./pixel-primitive-schema";

export const PIXEL_STYLE_FOUNDATION_ID = "pixel_style_foundation_v1";

export const PIXEL_UNIT = 4;

export const PIXEL_LAYER_ORDER: PixelLayerKind[] = [
  "ground",
  "trace",
  "shadow",
  "object",
  "actor",
  "foreground",
  "atmosphere",
];

export const PIXEL_PALETTE = {
  canvas: "#17231f",
  grassBase: "#2c6736",
  grassDark: "#1b4e2b",
  grassLight: "#5ca65b",
  leafDark: "#0d4026",
  leaf: "#2f7a3d",
  leafLight: "#78c65a",
  leafUnder: "#11381f",
  trunkDark: "#5b351f",
  trunk: "#93602f",
  trunkLight: "#c28340",
  soil: "#7b5631",
  soilDark: "#4d3824",
  stoneDark: "#59635a",
  stone: "#818b80",
  stoneLight: "#a8b1a7",
  insectDark: "#24311f",
  insect: "#42592c",
  wing: "#c7d9c8",
  skin: "#d7c08a",
  clothDark: "#233c39",
  cloth: "#3f6861",
  clothLight: "#7aa092",
  shadow: "#06120d",
  highlight: "#d6efb5",
} as const;

export const PIXEL_OBJECT_SIZE_LIMITS = {
  tree: { minWidth: 56, maxWidth: 150, minHeight: 80, maxHeight: 180 },
  grass_tile: { minWidth: 48, maxWidth: 96, minHeight: 48, maxHeight: 96 },
  stone: { minWidth: 16, maxWidth: 64, minHeight: 12, maxHeight: 54 },
  insect: { minWidth: 10, maxWidth: 38, minHeight: 8, maxHeight: 30 },
  butler: { minWidth: 18, maxWidth: 48, minHeight: 34, maxHeight: 90 },
} as const;
