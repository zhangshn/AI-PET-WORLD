// 该文件用于生成自然石头像素对象 recipe。

import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation";
import { validatePixelObjectRecipe } from "../../pixel-primitives/pixel-object-validator";
import type {
  PixelBlock,
  PixelLayerKind,
  PixelObjectRecipeResult,
  PixelPartId,
  PixelPrimitiveKind,
  PixelShapeId,
} from "../../pixel-primitives/pixel-primitive-schema";
import { getPixelSemanticStructure } from "../../pixel-primitives/semantic-structure-library";
import { clamp, mixHex } from "../core/color-utils";
import {
  cloneGrid,
  findBottomFilledY,
  findGridBounds,
  isGridEdge,
  type PixelArtGrid,
} from "../core/grid-utils";
import { cloneMask, createMask, fillSmallGaps, type PixelArtMask } from "../core/mask-utils";
import { createPixelBlockBuilder, type PixelBlockBuilder } from "../core/pixel-block-builder";
import { quantizeGridToPixelBlocks } from "../core/quantize-grid";
import { noiseAt } from "../core/seeded-noise";
import { buildContactShadowBlocks } from "../filters/contact-shadow-filter";
import { buildForegroundGrassBlend } from "../filters/environment-blend-filter";
import { applyShapeNoiseFilter } from "../filters/shape-noise-filter";
import { applyTextureDitherFilter } from "../filters/texture-dither-filter";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

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

type StoneGrid = PixelArtGrid<StoneTone>;

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

const STONE_TEMPLATE: StoneTemplate = {
  seed: "natural_stone_boulder_seed",
  originX: 78,
  originY: 92,
  cellSize: 2,
  gridWidth: 32,
  gridHeight: 27,
  lightDirection: "top_left",
  environmentTintStrength: 0.07,
};

export function buildNaturalStoneObjectRecipe(): PixelObjectRecipeResult {
  const template = STONE_TEMPLATE;
  const blockBuilder = createPixelBlockBuilder("stone_object_block");

  const rawMask = generateSilhouetteMask(template);
  const shapedMask = stabilizeRockBase(
    applyShapeNoiseFilter(rawMask, {
      seed: template.seed,
    }),
    template
  );
  const baseGrid = buildGridFromMask(shapedMask);
  const litGrid = applyLightingField(baseGrid, template);
  const texturedGrid = applyTextureField(litGrid, template);
  const crackedGrid = applyCrackField(texturedGrid, template);
  const highlightedGrid = applyHighlightField(crackedGrid, template);
  const environmentGrid = applyEnvironmentTintField(highlightedGrid, template);

  const blocks = [
    ...buildContactShadowBlocks({
      grid: environmentGrid,
      originX: template.originX,
      originY: template.originY,
      cellSize: template.cellSize,
      blockBuilder,
    }),
    ...quantizeGridToPixelBlocks({
      grid: environmentGrid,
      originX: template.originX,
      originY: template.originY,
      cellSize: template.cellSize,
      blockBuilder,
      resolveColor: (tone) => colorForTone(tone, template),
      resolveOpacity: opacityForTone,
      resolveLayer: layerForTone,
      resolvePrimitive: primitiveForTone,
    }),
    ...buildEnvironmentBlendBlocks(environmentGrid, template, blockBuilder),
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
    label: "石头",
    recipeId: "natural_stone_object_recipe",
    recipeVersion: "asset-grid-quality-pass",
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

function generateSilhouetteMask(template: StoneTemplate): PixelArtMask {
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

  return stabilizeRockBase(fillSmallGaps(mask), template);
}

function buildRidgeFractal(template: StoneTemplate, x: number, y: number): number {
  const low = Math.sin((x / template.gridWidth) * Math.PI * 2.15) * 0.075;
  const mid = Math.sin((x / template.gridWidth) * Math.PI * 5.4 + 0.8) * 0.032;
  const high = (noiseAt(template.seed, x, y, 97) - 0.5) * 0.045;

  return low + mid + high;
}

function stabilizeRockBase(mask: PixelArtMask, template: StoneTemplate): PixelArtMask {
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

function buildGridFromMask(mask: PixelArtMask): StoneGrid {
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

function applyTextureField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  return applyTextureDitherFilter(grid, {
    seed: template.seed,
    boundaryChecker: (x, y) => isNearPlaneBoundary(template, x, y),
    toneResolver: ({ tone, noise }) => {
      if (tone === "light") return "textureLight";
      if (tone === "main") return noise > 0.78 ? "textureLight" : "textureDark";
      if (tone === "dark" || tone === "ambientDark") return noise > 0.7 ? "textureDark" : "main";
      return tone;
    },
  });
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

      const noise = noiseAt(template.seed, x, y, 121);
      if ((cell.tone === "dark" || cell.tone === "main" || cell.tone === "textureDark") && noise > 0.42) {
        cell.tone = "ambientDark";
      }
    }
  }

  return next;
}

function buildEnvironmentBlendBlocks(
  grid: StoneGrid,
  template: StoneTemplate,
  blockBuilder: PixelBlockBuilder
): PixelBlock[] {
  return [
    ...buildForegroundGrassBlend(grid, blockBuilder, {
      seed: template.seed,
      originX: template.originX,
      originY: template.originY,
      cellSize: template.cellSize,
      grassLightColor: PIXEL_PALETTE.grassLight,
      grassDarkColor: PIXEL_PALETTE.grassDark,
    }),
    ...buildForegroundGrassNoise(grid, template, blockBuilder),
  ];
}

function buildForegroundGrassNoise(
  grid: StoneGrid,
  template: StoneTemplate,
  blockBuilder: PixelBlockBuilder
): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const bounds = findGridBounds(grid);
  if (!bounds) return blocks;

  for (let index = 0; index < 5; index += 1) {
    const x = bounds.minX + Math.round(noiseAt(template.seed, index, 0, 81) * (bounds.maxX - bounds.minX));
    const bottomY = findBottomFilledY(grid, x);
    if (bottomY === null) continue;

    blocks.push(
      blockBuilder.block({
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

function layerForTone(): PixelLayerKind {
  return "object";
}
