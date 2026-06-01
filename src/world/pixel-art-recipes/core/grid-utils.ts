// 该文件用于提供程序化像素美术生成的像素网格工具。

export type PixelArtGridCell<TTone extends string> = {
  filled: boolean;
  tone: TTone;
};

export type PixelArtGrid<TTone extends string> = PixelArtGridCell<TTone>[][];

export type PixelArtGridBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function cloneGrid<TTone extends string>(grid: PixelArtGrid<TTone>): PixelArtGrid<TTone> {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

export function isGridEdge<TTone extends string>(grid: PixelArtGrid<TTone>, x: number, y: number): boolean {
  if (!grid[y]?.[x]?.filled) return false;

  return [
    grid[y - 1]?.[x],
    grid[y + 1]?.[x],
    grid[y]?.[x - 1],
    grid[y]?.[x + 1],
  ].some((item) => !item?.filled);
}

export function findGridBounds<TTone extends string>(grid: PixelArtGrid<TTone>): PixelArtGridBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell.filled) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if (!Number.isFinite(minX)) return null;

  return { minX, maxX, minY, maxY };
}

export function findBottomFilledY<TTone extends string>(grid: PixelArtGrid<TTone>, x: number): number | null {
  for (let y = grid.length - 1; y >= 0; y -= 1) {
    if (grid[y]?.[x]?.filled) return y;
  }

  return null;
}
