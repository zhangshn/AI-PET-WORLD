// 该文件用于测试 V4 程序化像素美术石头 recipe。

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
  | "ambientDark"
  | "main"
  | "light"
  | "highlight"
  | "crack"
  | "textureLight"
  | "textureDark";

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
  environmentTintStrength: number;
};

type MaskBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

let blockCounter = 0;

const STONE_TEMPLATE: StoneTemplate = {
  seed: "natural_stone_v4_boulder_seed",
  originX: 78,
  originY: 92,
  cellSize: 2,
  gridWidth: 32,
  gridHeight: 27,
  lightDirection: "top_left",
  environmentTintStrength: 0.07,
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
  const environmentGrid = applyEnvironmentTintField(highlightedGrid, template);

  const blocks = [
    ...buildContactAo(environmentGrid, template),
    ...quantizeGridToBlocks(environmentGrid, template),
    ...environmentFilterBleeding(environmentGrid, template),
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
    label: "V4 石头",
    recipeId: "natural_stone_v3_procedural_art_recipe",
    recipeVersion: "4.0.0-quality-pass-01",
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

function generateSilhouetteMask(template: StoneTemplate): StoneMask {
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

  return stabilizeRockBase(fillSmallGaps(mask, template), template);
}

function buildRidgeFractal(template: StoneTemplate, x: number, y: number): number {
  const low = Math.sin((x / template.gridWidth) * Math.PI * 2.15) * 0.075;
  const mid = Math.sin((x / template.gridWidth) * Math.PI * 5.4 + 0.8) * 0.032;
  const high = (noiseAt(template.seed, x, y, 97) - 0.5) * 0.045;

  return low + mid + high;
}

function shapeFilterEdgeNoise(mask: StoneMask, template: StoneTemplate): StoneMask {
  const next = cloneMask(mask);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      if (!mask[y][x]) continue;
      if (!isMaskEdge(mask, x, y)) continue;

      const n = noiseAt(template.seed, x, y, 11);
      const bottomProtected = y > template.gridHeight * 0.78;

      if (!bottomProtected && n < 0.14) {
        next[y][x] = false;
      }

      if (n > 0.91) {
        const pushX = n > 0.955 ? 1 : -1;
        const pushY = n > 0.975 ? -1 : 0;
        const targetX = clamp(x + pushX, 0, template.gridWidth - 1);
        const targetY = clamp(y + pushY, 0, template.gridHeight - 1);
        next[targetY][targetX] = true;
      }
    }
  }

  return stabilizeRockBase(fillSmallGaps(next, template), template);
}

function buildGridFromMask(mask: StoneMask): StoneGrid {
  return mask.map((row) =>
    row.map((filled) => ({
      filled,
      tone: filled ? "main" : "shadow",
    }))
  );
}

function applyLightingField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);

  for (let y = 0; y < template.gridHeight; y += 1) {
    for (let x = 0; x < template.gridWidth; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const edge = isGridEdge(grid, x, y);
      const topBoundary = topPlaneBoundary(template, x);
      const frontBoundary = frontPlaneBoundary(template, x);
      const rightBoundary = rightPlaneBoundary(template, y);

      const topPlane = y <= topBoundary;
      const frontPlane = y > topBoundary && y <= frontBoundary;
      const leftLightPlane = x < template.gridWidth * 0.5 && y < template.gridHeight * 0.62;
      const rightDarkPlane = x >= rightBoundary && y > topBoundary + 1;
      const bottomPlane = y > template.gridHeight * 0.7;

      if (edge && (rightDarkPlane || bottomPlane || x < template.gridWidth * 0.12)) {
        cell.tone = "outline";
      } else if (topPlane || leftLightPlane) {
        cell.tone = "light";
      } else if (rightDarkPlane) {
        cell.tone = "dark";
      } else if (bottomPlane) {
        cell.tone = "ambientDark";
      } else if (frontPlane) {
        cell.tone = "main";
      } else {
        cell.tone = "main";
      }
    }
  }

  return next;
}

function textureFilterDithering(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const nearBoundary = isNearPlaneBoundary(template, x, y);
      const nearEdge = isGridEdge(grid, x, y);
      if (!nearBoundary && !nearEdge) continue;

      const n = noiseAt(template.seed, x, y, 101);
      const localPeak = isLocalNoisePeak(template, x, y, 101);
      const threshold = nearBoundary ? 0.58 : 0.74;

      if (n <= threshold || !localPeak) continue;

      if (cell.tone === "light") {
        cell.tone = "textureLight";
      } else if (cell.tone === "main") {
        cell.tone = n > 0.78 ? "textureLight" : "textureDark";
      } else if (cell.tone === "dark" || cell.tone === "ambientDark") {
        cell.tone = n > 0.7 ? "textureDark" : "main";
      }
    }
  }

  return next;
}

function applyCrackField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
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

function applyHighlightField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);

  for (let y = 1; y < template.gridHeight - 1; y += 1) {
    for (let x = 1; x < template.gridWidth - 1; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;
      if (cell.tone === "crack") continue;

      const upperLeft = x < template.gridWidth * 0.6 && y < template.gridHeight * 0.46;
      const edgeLight = isGridEdge(grid, x, y) && x < template.gridWidth * 0.64;
      const n = noiseAt(template.seed, x, y, 61);

      if ((upperLeft && (cell.tone === "light" || cell.tone === "textureLight") && n > 0.83) || (edgeLight && n > 0.93)) {
        cell.tone = "highlight";
      }
    }
  }

  return next;
}

function applyEnvironmentTintField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);
  const bounds = findGridBounds(next);
  if (!bounds) return next;

  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    const bottomY = findBottomFilledY(next, x);
    if (bottomY === null) continue;

    for (let y = Math.max(bounds.minY, bottomY - 3); y <= bottomY; y += 1) {
      const cell = next[y]?.[x];
      if (!cell?.filled) continue;

      const n = noiseAt(template.seed, x, y, 121);
      if ((cell.tone === "dark" || cell.tone === "main" || cell.tone === "textureDark") && n > 0.42) {
        cell.tone = "ambientDark";
      }
    }
  }

  return next;
}

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
      opacity: 0.42,
      layer: "shadow",
    }),
    b({
      primitiveKind: "shadow_block",
      x: x + Math.round(width * 0.18),
      y: y - 2,
      width: Math.round(width * 0.62),
      height: 5,
      color: PIXEL_PALETTE.shadow,
      opacity: 0.26,
      layer: "shadow",
    }),
  ];
}

function environmentFilterBleeding(grid: StoneGrid, template: StoneTemplate): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const bounds = findGridBounds(grid);
  if (!bounds) return blocks;

  for (let x = bounds.minX; x <= bounds.maxX; x += 2) {
    const bottomY = findBottomFilledY(grid, x);
    if (bottomY === null) continue;

    const n = noiseAt(template.seed, x, bottomY, 71);
    if (n < 0.4) continue;

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
        opacity: 0.48,
        layer: "foreground",
      })
    );
  }

  return blocks;
}

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

      blocks.push(
        b({
          primitiveKind: primitiveForTone(tone, run * template.cellSize, template.cellSize),
          x: template.originX + x * template.cellSize,
          y: template.originY + y * template.cellSize,
          width: run * template.cellSize,
          height: template.cellSize,
          color: colorForTone(tone, template),
          opacity: opacityForTone(tone),
          layer: layerForTone(tone),
        })
      );

      x += run;
    }
  }

  return blocks;
}

function topPlaneBoundary(template: StoneTemplate, x: number): number {
  const centerX = template.gridWidth * 0.5;
  return 6 + Math.round((x - centerX) * 0.08 + Math.sin((x / template.gridWidth) * Math.PI * 2) * 1.2);
}

function frontPlaneBoundary(template: StoneTemplate, x: number): number {
  const centerX = template.gridWidth * 0.5;
  return 14 - Math.round((x - centerX) * 0.12);
}

function rightPlaneBoundary(template: StoneTemplate, y: number): number {
  return 20 + Math.round(Math.sin((y / template.gridHeight) * Math.PI) * 1.5);
}

function isNearPlaneBoundary(template: StoneTemplate, x: number, y: number): boolean {
  const top = Math.abs(y - topPlaneBoundary(template, x)) <= 1;
  const front = Math.abs(y - frontPlaneBoundary(template, x)) <= 1;
  const right = Math.abs(x - rightPlaneBoundary(template, y)) <= 1;
  return top || front || right;
}

function isLocalNoisePeak(template: StoneTemplate, x: number, y: number, salt: number): boolean {
  const current = noiseAt(template.seed, x, y, salt);
  const neighborValues = [
    noiseAt(template.seed, x - 1, y, salt),
    noiseAt(template.seed, x + 1, y, salt),
    noiseAt(template.seed, x, y - 1, salt),
    noiseAt(template.seed, x, y + 1, salt),
  ];

  return neighborValues.filter((value) => value > current).length <= 1;
}

function stabilizeRockBase(mask: StoneMask, template: StoneTemplate): StoneMask {
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

  if (tone === "outline" || tone === "dark" || tone === "ambientDark" || tone === "crack" || tone === "textureDark") {
    return "dark_block";
  }

  if (tone === "textureLight") return "noise_block";
  if (width <= 3 && height <= 3) return "dot_block";
  if (width > height) return "wide_block";

  return "square_block";
}

function colorForTone(tone: StoneTone, template: StoneTemplate): string {
  const ambientDark = mixHex(PIXEL_PALETTE.stoneDark, PIXEL_PALETTE.grassDark, template.environmentTintStrength);
  const ambientOutline = mixHex("#2f3733", PIXEL_PALETTE.grassDark, template.environmentTintStrength);
  const ambientCrack = mixHex("#39413c", PIXEL_PALETTE.grassDark, template.environmentTintStrength * 0.8);
  const textureLight = mixHex(PIXEL_PALETTE.stoneLight, PIXEL_PALETTE.stone, 0.28);
  const textureDark = mixHex(PIXEL_PALETTE.stoneDark, PIXEL_PALETTE.grassDark, 0.1);

  if (tone === "outline") return ambientOutline;
  if (tone === "shadow") return PIXEL_PALETTE.shadow;
  if (tone === "dark") return PIXEL_PALETTE.stoneDark;
  if (tone === "ambientDark") return ambientDark;
  if (tone === "main") return PIXEL_PALETTE.stone;
  if (tone === "light") return PIXEL_PALETTE.stoneLight;
  if (tone === "highlight") return PIXEL_PALETTE.highlight;
  if (tone === "textureLight") return textureLight;
  if (tone === "textureDark") return textureDark;

  return ambientCrack;
}

function opacityForTone(tone: StoneTone): number {
  if (tone === "highlight") return 0.68;
  if (tone === "textureLight") return 0.72;
  if (tone === "textureDark") return 0.78;
  if (tone === "crack") return 0.86;

  return 1;
}

function layerForTone(_tone: StoneTone): PixelLayerKind {
  return "object";
}

function mixHex(baseHex: string, tintHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const tint = hexToRgb(tintHex);

  const r = Math.round(base.r * (1 - amount) + tint.r * amount);
  const g = Math.round(base.g * (1 - amount) + tint.g * amount);
  const bValue = Math.round(base.b * (1 - amount) + tint.b * amount);

  return rgbToHex(r, g, bValue);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, bValue: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(bValue)}`;
}

function toHex(value: number): string {
  return clamp(value, 0, 255).toString(16).padStart(2, "0");
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
  return { id: `stone_v4_block_${blockCounter}`, ...input };
}