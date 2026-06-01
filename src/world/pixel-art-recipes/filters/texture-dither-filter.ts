// 该文件用于提供通用概率纹理抖动滤镜。

import { cloneGrid, isGridEdge, type PixelArtGrid } from "../core/grid-utils";
import { isLocalNoisePeak, noiseAt } from "../core/seeded-noise";

export type TextureDitherBoundaryChecker = (x: number, y: number) => boolean;

export type TextureDitherToneResolver<TTone extends string> = (input: {
  tone: TTone;
  noise: number;
  nearBoundary: boolean;
  nearEdge: boolean;
}) => TTone;

export type TextureDitherFilterConfig<TTone extends string> = {
  seed: string;
  salt?: number;
  boundaryChecker?: TextureDitherBoundaryChecker;
  toneResolver: TextureDitherToneResolver<TTone>;
  boundaryThreshold?: number;
  edgeThreshold?: number;
  requireLocalPeak?: boolean;
};

export function applyTextureDitherFilter<TTone extends string>(
  grid: PixelArtGrid<TTone>,
  config: TextureDitherFilterConfig<TTone>
): PixelArtGrid<TTone> {
  const next = cloneGrid(grid);
  const salt = config.salt ?? 101;
  const boundaryThreshold = config.boundaryThreshold ?? 0.58;
  const edgeThreshold = config.edgeThreshold ?? 0.74;
  const requireLocalPeak = config.requireLocalPeak ?? true;

  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < grid[y].length - 1; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const nearBoundary = config.boundaryChecker?.(x, y) ?? false;
      const nearEdge = isGridEdge(grid, x, y);
      if (!nearBoundary && !nearEdge) continue;

      const noise = noiseAt(config.seed, x, y, salt);
      const threshold = nearBoundary ? boundaryThreshold : edgeThreshold;
      if (noise <= threshold) continue;
      if (requireLocalPeak && !isLocalNoisePeak(config.seed, x, y, salt)) continue;

      cell.tone = config.toneResolver({
        tone: cell.tone,
        noise,
        nearBoundary,
        nearEdge,
      });
    }
  }

  return next;
}
