// 该文件用于提供通用环境融合滤镜。

import type { PixelBlock } from "../../pixel-primitives/pixel-primitive-schema";
import { findBottomFilledY, findGridBounds, type PixelArtGrid } from "../core/grid-utils";
import type { PixelBlockBuilder } from "../core/pixel-block-builder";
import { noiseAt } from "../core/seeded-noise";

export type EnvironmentGrassBlendConfig = {
  seed: string;
  originX: number;
  originY: number;
  cellSize: number;
  grassLightColor: string;
  grassDarkColor: string;
  opacity?: number;
  salt?: number;
  step?: number;
  threshold?: number;
  minHeight?: number;
  maxHeight?: number;
};

export function buildForegroundGrassBlend<TTone extends string>(
  grid: PixelArtGrid<TTone>,
  builder: PixelBlockBuilder,
  config: EnvironmentGrassBlendConfig
): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const bounds = findGridBounds(grid);
  if (!bounds) return blocks;

  const opacity = config.opacity ?? 0.72;
  const salt = config.salt ?? 71;
  const step = config.step ?? 2;
  const threshold = config.threshold ?? 0.4;
  const minHeight = config.minHeight ?? 4;
  const maxHeight = config.maxHeight ?? 12;

  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    const bottomY = findBottomFilledY(grid, x);
    if (bottomY === null) continue;

    const noise = noiseAt(config.seed, x, bottomY, salt);
    if (noise < threshold) continue;

    const height = minHeight + Math.round(noise * (maxHeight - minHeight));
    const color = noise > 0.68 ? config.grassLightColor : config.grassDarkColor;

    blocks.push(
      builder.block({
        primitiveKind: "tall_block",
        x: config.originX + x * config.cellSize,
        y: config.originY + (bottomY + 1) * config.cellSize - height,
        width: Math.max(2, config.cellSize + 1),
        height,
        color,
        opacity,
        layer: "foreground",
      })
    );
  }

  return blocks;
}
