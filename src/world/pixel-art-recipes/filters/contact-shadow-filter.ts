// 该文件用于生成像素物体的接地阴影。

import type { PixelBlock } from "../../pixel-primitives/pixel-primitive-schema";
import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation";
import type { PixelArtGrid } from "../core/grid-utils";
import { findGridBounds } from "../core/grid-utils";
import type { PixelBlockBuilder } from "../core/pixel-block-builder";

export type ContactShadowInput<TTone extends string> = {
  grid: PixelArtGrid<TTone>;
  originX: number;
  originY: number;
  cellSize: number;
  blockBuilder: PixelBlockBuilder;
  expandX?: number;
  outerHeight?: number;
  innerHeight?: number;
  outerOpacity?: number;
  innerOpacity?: number;
};

export function buildContactShadowBlocks<TTone extends string>(input: ContactShadowInput<TTone>): PixelBlock[] {
  const bounds = findGridBounds(input.grid);
  if (!bounds) return [];

  const expandX = input.expandX ?? 5;
  const outerHeight = input.outerHeight ?? 8;
  const innerHeight = input.innerHeight ?? 5;
  const outerOpacity = input.outerOpacity ?? 0.42;
  const innerOpacity = input.innerOpacity ?? 0.26;

  const x = input.originX + bounds.minX * input.cellSize - expandX;
  const y = input.originY + (bounds.maxY + 1) * input.cellSize - 1;
  const width = (bounds.maxX - bounds.minX + 1) * input.cellSize + expandX * 2;

  return [
    input.blockBuilder.block({
      primitiveKind: "shadow_block",
      x,
      y,
      width,
      height: outerHeight,
      color: PIXEL_PALETTE.shadow,
      opacity: outerOpacity,
      layer: "shadow",
    }),
    input.blockBuilder.block({
      primitiveKind: "shadow_block",
      x: x + Math.round(width * 0.18),
      y: y - 2,
      width: Math.round(width * 0.62),
      height: innerHeight,
      color: PIXEL_PALETTE.shadow,
      opacity: innerOpacity,
      layer: "shadow",
    }),
  ];
}
