// 该文件用于测试 V3 程序化像素美术石头 recipe。

import { PIXEL_PALETTE } from "../pixel-style-foundation";
import { validatePixelObjectRecipe } from "../pixel-object-validator";
import { getPixelSemanticStructure } from "../semantic-structure-library";
import type {
  PixelBlock,
  PixelLayerKind,
  PixelObjectRecipeResult,
  PixelPartId,
  PixelPrimitiveKind,
  PixelShapeId,
} from "../pixel-primitive-schema";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;
type BlockInput = Omit<PixelBlock, "id">;

type StoneTone =
  | "outline"
  | "shadow"
  | "dark"
  | "main"
  | "light"
  | "highlight"
  | "crack";

type StoneCell = {
  filled: boolean;
  tone: StoneTone;
};

type StoneMask = boolean[][];

type StoneGrid = StoneCell[][];

type StoneTemplate = {
  seed: string;
  originX: number;
  originY: number;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  lightDirection: "top_left";
};

type MaskBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

let blockCounter = 0;

const STONE_TEMPLATE: StoneTemplate = {
  seed: "natural_stone_v3_boulder_seed",
  originX: 78,
  originY: 92,
  cellSize: 2,
  gridWidth: 32,
  gridHeight: 27,
  lightDirection: "top_left",
};

export function buildNaturalStoneV3Recipe(): PixelObjectRecipeResult {
  blockCounter = 0;

  const template = STONE_TEMPLATE;
  const rawMask = generateSilhouetteMask(template);
  const shapedMask = shapeFilterEdgeNoise(rawMask, template);
  const baseGrid = buildGridFromMask(shapedMask);
  const litGrid = applyLightingField(baseGrid, template);
  const texturedGrid = textureFilterDithering(litGrid, template);
  const crackedGrid = applyCrackField(texturedGrid, template);
  const highlightedGrid = applyHighlightField(crackedGrid, template);

  const blocks = [
    ...buildContactAo(highlightedGrid, template),
    ...quantizeGridToBlocks(highlightedGrid, template),
    ...environmentFilterBleeding(highlightedGrid, template),
  ];

  const parts: PixelPartId[] = [
    "stone_shadow",
    "stone_body",
    "stone_dark_edge",
    "stone_highlight",
  ];

  const shapes: PixelShapeId[] = [
    "stone_cluster",
    "shadow_patch",
    "highlight_chip",
    "soil_chip",
    "grass_chip",
  ];

  const draft: DraftPixelObject = {
    kind: "stone",
    label: "V3 石头",
    recipeId: "natural_stone_v3_procedural_art_recipe",
    recipeVersion: "3.1.0-experiment",
    semanticStructureId: getPixelSemanticStructure("stone").id,
    anchor: {
      type: "center_bottom",
      x: template.originX + Math.round((template.gridWidth * template.cellSize) / 2),
      y: template.originY + template.gridHeight * template.cellSize,
    },
    bounds: {
      x: template.originX,
      y: template.originY,
      width: template.gridWidth * template.cellSize,
      height: template.gridHeight * template.cellSize,
    },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return {
    ...draft,
    validation: validatePixelObjectRecipe(draft),
  };
}

/**
 * 第 1 层：生成整体石头剪影。
 * 这里不再手写 x/y 方块，而是用椭圆密度 + seed 噪声生成可复现的不规则轮廓。
 */
function generateSilhouetteMask(template: StoneTemplate): StoneMask {
  const mask = createMask(template.gridWidth, template.gridHeight, false);
  const centerX = template.gridWidth * 0.5;
  const centerY = template.gridHeight * 0.48;
  const radiusX = template.gridWidth * 0.46;
  const radiusY = template.gridHeight * 0.42;

  for (let y = 0; y < template.gridHeight; y += 1) {
    for (let x = 0; x < template.gridWidth; x += 1) {
      const nx = (x - centerX) / radiusX;
      const ny = (y - centerY) / radiusY;

      const topCompression = y < template.gridHeight * 0.22 ? 0.12 : 0;
      const bottomWeight = y > template.gridHeight * 0.72 ? -0.12 : 0;
      const ridge = Math.sin((x / template.gridWidth) * Math.PI * 2.2) * 0.08;
      const localNoise = (noiseAt(template.seed, x, y, 3) - 0.5) * 0.2;

      const value = nx * nx + (ny + ridge + topCompression) * (ny + ridge + topCompression);

      if (value + localNoise + bottomWeight < 1) {
        mask[y][x] = true;
      }
    }
  }

  return fillSmallGaps(mask, template);
}

/**
 * 第 2 层：ShapeFilter。
 * 给轮廓边缘加入受控扰动，让石头不再是数学完美图形。
 */
function shapeFilterEdgeNoise(mask: StoneMask, template: StoneTemplate): StoneMask {
  const next = cloneMask(mask);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      if (!mask[y][x]) continue;

      const edge = isMaskEdge(mask, x, y);
      if (!edge) continue;

      const n = noiseAt(template.seed, x, y, 11);
      const bottomProtected = y > template.gridHeight * 0.78;

      if (!bottomProtected && n < 0.16) {
        next[y][x] = false;
      }

      if (n > 0.9) {
        const direction = n > 0.95 ? 1 : -1;
        const targetX = clamp(x + direction, 0, template.gridWidth - 1);
        const targetY = clamp(y + (n > 0.97 ? -1 : 0), 0, template.gridHeight - 1);
        next[targetY][targetX] = true;
      }
    }
  }

  return fillSmallGaps(next, template);
}

/**
 * 第 3 层：由 mask 构建基础 grid。
 */
function buildGridFromMask(mask: StoneMask): StoneGrid {
  return mask.map((row) =>
    row.map((filled) => ({
      filled,
      tone: filled ? "main" : "shadow",
    }))
  );
}

/**
 * 第 4 层：LightingField。
 * 按左上光源自动分配亮面、主面、暗面、外轮廓。
 */
function applyLightingField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);
  const centerX = template.gridWidth * 0.5;
  const centerY = template.gridHeight * 0.5;

  for (let y = 0; y < template.gridHeight; y += 1) {
    for (let x = 0; x < template.gridWidth; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const edge = isGridEdge(grid, x, y);
      const upper = y < centerY * 0.78;
      const left = x < centerX;
      const right = x > centerX + 4;
      const bottom = y > centerY + 5;

      const topPlane = y < 7 + Math.round((x - centerX) * 0.1);
      const leftPlane = left && y < centerY + 4;
      const rightPlane = right && y > 6;
      const bottomPlane = bottom;

      if (edge && (right || bottom || x < 3)) {
        cell.tone = "outline";
      } else if (topPlane || (upper && leftPlane)) {
        cell.tone = "light";
      } else if (rightPlane || bottomPlane) {
        cell.tone = "dark";
      } else {
        cell.tone = "main";
      }
    }
  }

  return next;
}

/**
 * 第 5 层：TextureFilter。
 * 根据分面边界自动添加抖动，不再手写 dots 坐标。
 */
function textureFilterDithering(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);
  const centerX = template.gridWidth * 0.5;

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const boundaryA = Math.abs(y - (6 + (x - centerX) * 0.12)) <= 1;
      const boundaryB = Math.abs(y - (13 - (x - centerX) * 0.22)) <= 1;
      const boundaryC = Math.abs(x - (20 + y * 0.05)) <= 1;
      const nearBoundary = boundaryA || boundaryB || boundaryC;

      if (!nearBoundary) continue;

      const n = noiseAt(template.seed, x, y, 23);
      const checker = (x + y) % 2 === 0;

      if (cell.tone === "main" && checker && n > 0.42) {
        cell.tone = "light";
      } else if (cell.tone === "light" && !checker && n > 0.5) {
        cell.tone = "main";
      } else if (cell.tone === "dark" && checker && n > 0.55) {
        cell.tone = "main";
      }
    }
  }

  return next;
}

/**
 * 第 6 层：裂纹生成。
 * 裂纹基于 seed 和当前 mask 走向生成，不再固定坐标。
 */
function applyCrackField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);
  const paths = [
    {
      startX: Math.round(template.gridWidth * (0.34 + noiseAt(template.seed, 2, 1, 31) * 0.1)),
      startY: Math.round(template.gridHeight * (0.32 + noiseAt(template.seed, 4, 1, 32) * 0.12)),
      dx: 1,
      dy: 0.34,
      length: 9,
    },
    {
      startX: Math.round(template.gridWidth * (0.62 + noiseAt(template.seed, 6, 1, 33) * 0.1)),
      startY: Math.round(template.gridHeight * (0.28 + noiseAt(template.seed, 8, 1, 34) * 0.15)),
      dx: -0.35,
      dy: 1,
      length: 8,
    },
    {
      startX: Math.round(template.gridWidth * (0.28 + noiseAt(template.seed, 10, 1, 35) * 0.14)),
      startY: Math.round(template.gridHeight * (0.62 + noiseAt(template.seed, 12, 1, 36) * 0.12)),
      dx: 1,
      dy: 0.2,
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
        if (branchNoise > 0.72 && iy + 1 < template.gridHeight && next[iy + 1][ix]?.filled) {
          next[iy + 1][ix].tone = "crack";
        }
      }

      const drift = noiseAt(template.seed, ix, iy, 51 + pathIndex) - 0.5;
      x += path.dx + drift * 0.55;
      y += path.dy + Math.abs(drift) * 0.25;
    }
  });

  return next;
}

/**
 * 第 7 层：高光生成。
 * 高光跟随左上受光区域生成，不再固定坐标。
 */
function applyHighlightField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const upperLeft = x < template.gridWidth * 0.58 && y < template.gridHeight * 0.48;
      const smallEdgeLight = isGridEdge(grid, x, y) && x < template.gridWidth * 0.65;
      const n = noiseAt(template.seed, x, y, 61);

      if ((upperLeft && cell.tone === "light" && n > 0.78) || (smallEdgeLight && n > 0.9)) {
        cell.tone = "highlight";
      }
    }
  }

  return next;
}

/**
 * 第 8 层：接地 AO。
 * 依据实际 mask 底部自动生成，不再写死阴影位置。
 */
function buildContactAo(grid: StoneGrid, template: StoneTemplate): PixelBlock[] {
  const bounds = findGridBounds(grid);
  if (!bounds) return [];

  const x = template.originX + bounds.minX * template.cellSize - 5;
  const y = template.originY + (bounds.maxY + 1) * template.cellSize - 1;
  const width = (bounds.maxX - bounds.minX + 1) * template.cellSize + 10;

  return [
    b({
      primitiveKind: "shadow_block",
      x,
      y,
      width,
      height: 8,
      color: PIXEL_PALETTE.shadow,
      opacity: 0.4,
      layer: "shadow",
    }),
    b({
      primitiveKind: "shadow_block",
      x: x + Math.round(width * 0.18),
      y: y - 2,
      width: Math.round(width * 0.62),
      height: 5,
      color: PIXEL_PALETTE.shadow,
      opacity: 0.25,
      layer: "shadow",
    }),
  ];
}

/**
 * 第 9 层：EnvironmentFilter。
 * 根据实际底部边界生成草地遮挡和环境色污染。
 */
function environmentFilterBleeding(grid: StoneGrid, template: StoneTemplate): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const bounds = findGridBounds(grid);
  if (!bounds) return blocks;

  for (let x = bounds.minX; x <= bounds.maxX; x += 2) {
    const bottomY = findBottomFilledY(grid, x);
    if (bottomY === null) continue;

    const n = noiseAt(template.seed, x, bottomY, 71);
    if (n < 0.42) continue;

    const grassHeight = 4 + Math.round(n * 8);
    const grassColor = n > 0.68 ? PIXEL_PALETTE.grassLight : PIXEL_PALETTE.grassDark;

    blocks.push(
      b({
        primitiveKind: "tall_block",
        x: template.originX + x * template.cellSize,
        y: template.originY + (bottomY + 1) * template.cellSize - grassHeight,
        width: 3,
        height: grassHeight,
        color: grassColor,
        opacity: 0.72,
        layer: "foreground",
      })
    );
  }

  for (let i = 0; i < 5; i += 1) {
    const x = bounds.minX + Math.round(noiseAt(template.seed, i, 0, 81) * (bounds.maxX - bounds.minX));
    const bottomY = findBottomFilledY(grid, x);
    if (bottomY === null) continue;

    blocks.push(
      b({
        primitiveKind: "noise_block",
        x: template.originX + x * template.cellSize,
        y: template.originY + (bottomY + 1) * template.cellSize - 2,
        width: 4,
        height: 4,
        color: PIXEL_PALETTE.grassBase,
        opacity: 0.46,
        layer: "foreground",
      })
    );
  }

  return blocks;
}

/**
 * 第 10 层：像素量化。
 * 把 grid 合并成横向连续 PixelBlock。
 */
function quantizeGridToBlocks(grid: StoneGrid, template: StoneTemplate): PixelBlock[] {
  const blocks: PixelBlock[] = [];

  for (let y = 0; y < template.gridHeight; y += 1) {
    let x = 0;

    while (x < template.gridWidth) {
      const cell = grid[y][x];

      if (!cell.filled) {
        x += 1;
        continue;
      }

      const tone = cell.tone;
      let run = 1;

      while (
        x + run < template.gridWidth &&
        grid[y][x + run].filled &&
        grid[y][x + run].tone === tone
      ) {
        run += 1;
      }

      const width = run * template.cellSize;
      const height = template.cellSize;

      blocks.push(
        b({
          primitiveKind: primitiveForTone(tone, width, height),
          x: template.originX + x * template.cellSize,
          y: template.originY + y * template.cellSize,
          width,
          height,
          color: colorForTone(tone),
          opacity: opacityForTone(tone),
          layer: layerForTone(tone),
        })
      );

      x += run;
    }
  }

  return blocks;
}

function fillSmallGaps(mask: StoneMask, template: StoneTemplate): StoneMask {
  const next = cloneMask(mask);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
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

function findGridBounds(grid: StoneGrid): MaskBounds | null {
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

function findBottomFilledY(grid: StoneGrid, x: number): number | null {
  for (let y = grid.length - 1; y >= 0; y -= 1) {
    if (grid[y]?.[x]?.filled) return y;
  }

  return null;
}

function isMaskEdge(mask: StoneMask, x: number, y: number): boolean {
  if (!mask[y][x]) return false;

  return [
    mask[y - 1]?.[x],
    mask[y + 1]?.[x],
    mask[y]?.[x - 1],
    mask[y]?.[x + 1],
  ].some((item) => !item);
}

function isGridEdge(grid: StoneGrid, x: number, y: number): boolean {
  if (!grid[y][x].filled) return false;

  return [
    grid[y - 1]?.[x],
    grid[y + 1]?.[x],
    grid[y]?.[x - 1],
    grid[y]?.[x + 1],
  ].some((item) => !item?.filled);
}

function createMask(width: number, height: number, value: boolean): StoneMask {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

function cloneMask(mask: StoneMask): StoneMask {
  return mask.map((row) => [...row]);
}

function cloneGrid(grid: StoneGrid): StoneGrid {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function primitiveForTone(tone: StoneTone, width: number, height: number): PixelPrimitiveKind {
  if (tone === "highlight") return "highlight_block";
  if (tone === "outline" || tone === "dark" || tone === "crack") return "dark_block";
  if (width <= 3 && height <= 3) return "dot_block";
  if (width > height) return "wide_block";
  return "square_block";
}

function colorForTone(tone: StoneTone): string {
  if (tone === "outline") return "#2f3733";
  if (tone === "shadow") return PIXEL_PALETTE.shadow;
  if (tone === "dark") return PIXEL_PALETTE.stoneDark;
  if (tone === "main") return PIXEL_PALETTE.stone;
  if (tone === "light") return PIXEL_PALETTE.stoneLight;
  if (tone === "highlight") return PIXEL_PALETTE.highlight;
  return "#39413c";
}

function opacityForTone(tone: StoneTone): number {
  if (tone === "highlight") return 0.7;
  if (tone === "crack") return 0.84;
  return 1;
}

function layerForTone(_tone: StoneTone): PixelLayerKind {
  return "object";
}

function noiseAt(seed: string, x: number, y: number, salt: number): number {
  const hash = hashString(`${seed}:${x}:${y}:${salt}`);
  return (hash % 10000) / 10000;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function b(input: BlockInput): PixelBlock {
  blockCounter += 1;
  return { id: `stone_v3_block_${blockCounter}`, ...input };
}