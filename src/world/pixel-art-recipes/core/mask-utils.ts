// 该文件用于提供程序化像素美术生成的剪影 mask 工具。

export type PixelArtMask = boolean[][];

export type PixelArtBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function createMask(width: number, height: number, value: boolean): PixelArtMask {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

export function cloneMask(mask: PixelArtMask): PixelArtMask {
  return mask.map((row) => [...row]);
}

export function isMaskEdge(mask: PixelArtMask, x: number, y: number): boolean {
  if (!mask[y]?.[x]) return false;

  return [
    mask[y - 1]?.[x],
    mask[y + 1]?.[x],
    mask[y]?.[x - 1],
    mask[y]?.[x + 1],
  ].some((item) => !item);
}

export function fillSmallGaps(mask: PixelArtMask): PixelArtMask {
  const next = cloneMask(mask);

  for (let y = 1; y < mask.length - 1; y += 1) {
    for (let x = 1; x < mask[y].length - 1; x += 1) {
      if (mask[y][x]) continue;

      const filledNeighbors = [
        mask[y - 1][x],
        mask[y + 1][x],
        mask[y][x - 1],
        mask[y][x + 1],
      ].filter(Boolean).length;

      if (filledNeighbors >= 3) {
        next[y][x] = true;
      }
    }
  }

  return next;
}

export function findMaskBounds(mask: PixelArtMask): PixelArtBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  mask.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if (!Number.isFinite(minX)) return null;

  return { minX, maxX, minY, maxY };
}
