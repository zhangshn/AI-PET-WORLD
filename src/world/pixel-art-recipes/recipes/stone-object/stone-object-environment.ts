// 该文件用于处理自然石头像素对象的环境融合。

import type { PixelBlock } from "../../../pixel-primitives/pixel-primitive-schema";
import { PIXEL_PALETTE } from "../../../pixel-primitives/pixel-style-foundation";
import { findBottomFilledY, findGridBounds, cloneGrid } from "../../core/grid-utils";
import type { PixelBlockBuilder } from "../../core/pixel-block-builder";
import { noiseAt } from "../../core/seeded-noise";
import { buildForegroundGrassBlend } from "../../filters/environment-blend-filter";
import type { StoneGrid, StoneTemplate } from "./stone-object-types";

export function applyStoneEnvironmentTintField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);
  const bounds = findGridBounds(next);
  if (!bounds) return next;

  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    const bottomY = findBottomFilledY(next, x);
    if (bottomY === null) continue;

    for (let y = Math.max(bounds.minY, bottomY - 3); y <= bottomY; y += 1) {
      const cell = next[y]?.[x];
      if (!cell?.filled) continue;

      const noise = noiseAt(template.seed, x, y, 121);
      if ((cell.tone === "dark" || cell.tone === "main" || cell.tone === "textureDark") && noise > 0.42) {
        cell.tone = "ambientDark";
      }
    }
  }

  return next;
}

export function buildStoneEnvironmentBlendBlocks(
  grid: StoneGrid,
  template: StoneTemplate,
  blockBuilder: PixelBlockBuilder
): PixelBlock[] {
  return [
    ...buildForegroundGrassBlend(grid, blockBuilder, {
      seed: template.seed,
      originX: template.originX,
      originY: template.originY,
      cellSize: template.cellSize,
      grassLightColor: PIXEL_PALETTE.grassLight,
      grassDarkColor: PIXEL_PALETTE.grassDark,
    }),
    ...buildForegroundGrassNoise(grid, template, blockBuilder),
  ];
}

function buildForegroundGrassNoise(
  grid: StoneGrid,
  template: StoneTemplate,
  blockBuilder: PixelBlockBuilder
): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const bounds = findGridBounds(grid);
  if (!bounds) return blocks;

  for (let index = 0; index < 5; index += 1) {
    const x = bounds.minX + Math.round(noiseAt(template.seed, index, 0, 81) * (bounds.maxX - bounds.minX));
    const bottomY = findBottomFilledY(grid, x);
    if (bottomY === null) continue;

    blocks.push(
      blockBuilder.block({
        primitiveKind: "noise_block",
        x: template.originX + x * template.cellSize,
        y: template.originY + (bottomY + 1) * template.cellSize - 2,
        width: 4,
        height: 4,
        color: PIXEL_PALETTE.grassBase,
        opacity: 0.48,
        layer: "foreground",
      })
    );
  }

  return blocks;
}
