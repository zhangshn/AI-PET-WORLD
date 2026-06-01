// 该文件用于生成自然石头像素对象的基础轮廓。

import { cloneMask, createMask, fillSmallGaps, type PixelArtMask } from "../../core/mask-utils";
import { noiseAt } from "../../core/seeded-noise";
import type { StoneGrid, StoneTemplate } from "./stone-object-types";

export function generateStoneSilhouetteMask(template: StoneTemplate): PixelArtMask {
  const mask = createMask(template.gridWidth, template.gridHeight, false);
  const centerX = template.gridWidth * 0.5;
  const centerY = template.gridHeight * 0.5;
  const radiusX = template.gridWidth * 0.47;
  const radiusY = template.gridHeight * 0.41;

  for (let y = 0; y < template.gridHeight; y += 1) {
    for (let x = 0; x < template.gridWidth; x += 1) {
      const nx = (x - centerX) / radiusX;
      const ny = (y - centerY) / radiusY;
      const ridge = buildRidgeFractal(template, x, y);
      const upperCompression = y < template.gridHeight * 0.24 ? 0.1 : 0;
      const bottomWeight = y > template.gridHeight * 0.72 ? -0.15 : 0;
      const sideChip = x < template.gridWidth * 0.16 || x > template.gridWidth * 0.84 ? 0.05 : 0;
      const ellipseValue = nx * nx + (ny + ridge + upperCompression) * (ny + ridge + upperCompression);
      const localNoise = (noiseAt(template.seed, x, y, 3) - 0.5) * 0.16;

      if (ellipseValue + localNoise + sideChip + bottomWeight < 1) {
        mask[y][x] = true;
      }
    }
  }

  return stabilizeStoneBase(fillSmallGaps(mask), template);
}

export function stabilizeStoneBase(mask: PixelArtMask, template: StoneTemplate): PixelArtMask {
  const next = cloneMask(mask);
  const baseY = template.gridHeight - 3;
  const centerX = template.gridWidth * 0.5;

  for (let x = 0; x < template.gridWidth; x += 1) {
    const distance = Math.abs(x - centerX) / centerX;
    if (distance < 0.74) {
      next[baseY][x] = true;
      next[baseY - 1][x] = true;
    }
  }

  return next;
}

export function buildStoneGridFromMask(mask: PixelArtMask): StoneGrid {
  return mask.map((row) =>
    row.map((filled) => ({
      filled,
      tone: filled ? "main" : "shadow",
    }))
  );
}

function buildRidgeFractal(template: StoneTemplate, x: number, y: number): number {
  const low = Math.sin((x / template.gridWidth) * Math.PI * 2.15) * 0.075;
  const mid = Math.sin((x / template.gridWidth) * Math.PI * 5.4 + 0.8) * 0.032;
  const high = (noiseAt(template.seed, x, y, 97) - 0.5) * 0.045;

  return low + mid + high;
}
