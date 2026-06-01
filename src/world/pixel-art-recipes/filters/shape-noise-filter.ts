// 该文件用于提供通用轮廓扰动滤镜。

import { clamp } from "../core/color-utils";
import { cloneMask, fillSmallGaps, isMaskEdge, type PixelArtMask } from "../core/mask-utils";
import { noiseAt } from "../core/seeded-noise";

export type ShapeNoiseFilterConfig = {
  seed: string;
  removeSalt?: number;
  addSalt?: number;
  removeThreshold?: number;
  addThreshold?: number;
  protectBottomRatio?: number;
  fillGaps?: boolean;
};

export function applyShapeNoiseFilter(mask: PixelArtMask, config: ShapeNoiseFilterConfig): PixelArtMask {
  const next = cloneMask(mask);
  const removeSalt = config.removeSalt ?? 11;
  const addSalt = config.addSalt ?? removeSalt;
  const removeThreshold = config.removeThreshold ?? 0.14;
  const addThreshold = config.addThreshold ?? 0.91;
  const protectBottomRatio = config.protectBottomRatio ?? 0.78;

  for (let y = 1; y < mask.length - 1; y += 1) {
    for (let x = 1; x < mask[y].length - 1; x += 1) {
      if (!mask[y][x] || !isMaskEdge(mask, x, y)) continue;

      const removeNoise = noiseAt(config.seed, x, y, removeSalt);
      const bottomProtected = y > mask.length * protectBottomRatio;

      if (!bottomProtected && removeNoise < removeThreshold) {
        next[y][x] = false;
      }

      const addNoise = noiseAt(config.seed, x, y, addSalt);
      if (addNoise > addThreshold) {
        const pushX = addNoise > 0.955 ? 1 : -1;
        const pushY = addNoise > 0.975 ? -1 : 0;
        const targetX = clamp(x + pushX, 0, mask[y].length - 1);
        const targetY = clamp(y + pushY, 0, mask.length - 1);
        next[targetY][targetX] = true;
      }
    }
  }

  return config.fillGaps ?? true ? fillSmallGaps(next) : next;
}
