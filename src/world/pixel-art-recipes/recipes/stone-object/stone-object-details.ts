// 该文件用于处理自然石头像素对象的裂纹、高光和纹理。

import { clamp } from "../../core/color-utils";
import { cloneGrid, isGridEdge } from "../../core/grid-utils";
import { noiseAt } from "../../core/seeded-noise";
import { applyTextureDitherFilter } from "../../filters/texture-dither-filter";
import { isNearStonePlaneBoundary } from "./stone-object-lighting";
import type { StoneGrid, StoneTemplate } from "./stone-object-types";

export function applyStoneTextureField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  return applyTextureDitherFilter(grid, {
    seed: template.seed,
    boundaryChecker: (x, y) => isNearStonePlaneBoundary(template, x, y),
    toneResolver: ({ tone, noise }) => {
      if (tone === "light") return "textureLight";
      if (tone === "main") return noise > 0.78 ? "textureLight" : "textureDark";
      if (tone === "dark" || tone === "ambientDark") return noise > 0.7 ? "textureDark" : "main";
      return tone;
    },
  });
}

export function applyStoneCrackField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);
  const paths = [
    {
      startX: Math.round(template.gridWidth * (0.34 + noiseAt(template.seed, 2, 1, 31) * 0.08)),
      startY: Math.round(template.gridHeight * (0.31 + noiseAt(template.seed, 4, 1, 32) * 0.1)),
      dx: 1,
      dy: 0.28,
      length: 9,
    },
    {
      startX: Math.round(template.gridWidth * (0.62 + noiseAt(template.seed, 6, 1, 33) * 0.08)),
      startY: Math.round(template.gridHeight * (0.27 + noiseAt(template.seed, 8, 1, 34) * 0.12)),
      dx: -0.3,
      dy: 0.95,
      length: 8,
    },
    {
      startX: Math.round(template.gridWidth * (0.28 + noiseAt(template.seed, 10, 1, 35) * 0.12)),
      startY: Math.round(template.gridHeight * (0.62 + noiseAt(template.seed, 12, 1, 36) * 0.1)),
      dx: 1,
      dy: 0.18,
      length: 7,
    },
  ];

  paths.forEach((path, pathIndex) => {
    let x = path.startX;
    let y = path.startY;

    for (let step = 0; step < path.length; step += 1) {
      const ix = clamp(Math.round(x), 0, template.gridWidth - 1);
      const iy = clamp(Math.round(y), 0, template.gridHeight - 1);

      if (next[iy]?.[ix]?.filled && !isGridEdge(next, ix, iy)) {
        next[iy][ix].tone = "crack";

        const branchNoise = noiseAt(template.seed, ix, iy, 41 + pathIndex);
        if (branchNoise > 0.78 && iy + 1 < template.gridHeight && next[iy + 1][ix]?.filled) {
          next[iy + 1][ix].tone = "crack";
        }
      }

      const drift = noiseAt(template.seed, ix, iy, 51 + pathIndex) - 0.5;
      x += path.dx + drift * 0.55;
      y += path.dy + Math.abs(drift) * 0.22;
    }
  });

  return next;
}

export function applyStoneHighlightField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      const cell = next[y][x];
      if (!cell.filled || cell.tone === "crack") continue;

      const upperLeft = x < template.gridWidth * 0.6 && y < template.gridHeight * 0.46;
      const edgeLight = isGridEdge(grid, x, y) && x < template.gridWidth * 0.64;
      const noise = noiseAt(template.seed, x, y, 61);

      if (
        (upperLeft && (cell.tone === "light" || cell.tone === "textureLight") && noise > 0.83) ||
        (edgeLight && noise > 0.93)
      ) {
        cell.tone = "highlight";
      }
    }
  }

  return next;
}
