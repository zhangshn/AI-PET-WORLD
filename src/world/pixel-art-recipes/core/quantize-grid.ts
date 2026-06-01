// 该文件用于把像素艺术网格量化为 PixelBlock。

import type { PixelBlock, PixelLayerKind, PixelPrimitiveKind } from "../../pixel-primitives/pixel-primitive-schema";
import type { PixelArtGrid } from "./grid-utils";
import type { PixelBlockBuilder } from "./pixel-block-builder";

export type PixelArtTone = string;

export type PixelArtColorResolver<TTone extends PixelArtTone> = (tone: TTone) => string;
export type PixelArtOpacityResolver<TTone extends PixelArtTone> = (tone: TTone) => number;
export type PixelArtLayerResolver<TTone extends PixelArtTone> = (tone: TTone) => PixelLayerKind;
export type PixelArtPrimitiveResolver<TTone extends PixelArtTone> = (
  tone: TTone,
  width: number,
  height: number
) => PixelPrimitiveKind;

export type QuantizeGridInput<TTone extends PixelArtTone> = {
  grid: PixelArtGrid<TTone>;
  originX: number;
  originY: number;
  cellSize: number;
  blockBuilder: PixelBlockBuilder;
  resolveColor: PixelArtColorResolver<TTone>;
  resolveOpacity: PixelArtOpacityResolver<TTone>;
  resolveLayer: PixelArtLayerResolver<TTone>;
  resolvePrimitive: PixelArtPrimitiveResolver<TTone>;
};

export function quantizeGridToPixelBlocks<TTone extends PixelArtTone>(input: QuantizeGridInput<TTone>): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const { grid, originX, originY, cellSize, blockBuilder } = input;

  for (let y = 0; y < grid.length; y += 1) {
    let x = 0;

    while (x < grid[y].length) {
      const cell = grid[y][x];

      if (!cell.filled) {
        x += 1;
        continue;
      }

      const tone = cell.tone;
      let run = 1;

      while (x + run < grid[y].length && grid[y][x + run].filled && grid[y][x + run].tone === tone) {
        run += 1;
      }

      const width = run * cellSize;
      const height = cellSize;

      blocks.push(
        blockBuilder.block({
          primitiveKind: input.resolvePrimitive(tone, width, height),
          x: originX + x * cellSize,
          y: originY + y * cellSize,
          width,
          height,
          color: input.resolveColor(tone),
          opacity: input.resolveOpacity(tone),
          layer: input.resolveLayer(tone),
        })
      );

      x += run;
    }
  }

  return blocks;
}
