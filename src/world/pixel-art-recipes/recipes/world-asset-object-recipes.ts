// Builds stable world-fact asset recipes for structures and facilities.

import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation";
import { validatePixelObjectRecipe } from "../../pixel-primitives/pixel-object-validator";
import type {
  PixelBlock,
  PixelBounds,
  PixelObjectRecipeResult,
  PixelPartId,
  PixelShapeId,
} from "../../pixel-primitives/pixel-primitive-schema";
import { getPixelSemanticStructure } from "../../pixel-primitives/semantic-structure-library";
import { createPixelBlockBuilder } from "../core/pixel-block-builder";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export type WorldAssetObjectRecipeInput = {
  sourceObjectId?: string;
  x?: number;
  y?: number;
  scale?: number;
  health?: number;
  growthStage?: string;
  stressLevel?: number;
  deterministicKey?: string;
  stateTags?: string[];
};

export function buildWorldStructureObjectRecipe(
  input: WorldAssetObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("structure_object_block");
  const scale = clamp(input.scale ?? 1, 0.62, 1.45);
  const centerX = Math.round(input.x ?? 112);
  const baseY = Math.round(input.y ?? 148);
  const health = clamp(input.health ?? 76, 0, 100);
  const muted = health < 48 || (input.stressLevel ?? 0) > 60;
  const width = Math.max(34, Math.round(58 * scale));
  const wallHeight = Math.max(20, Math.round(34 * scale));
  const roofHeight = Math.max(10, Math.round(16 * scale));
  const left = centerX - Math.round(width / 2);
  const wallTop = baseY - wallHeight - Math.round(8 * scale);
  const roofTop = wallTop - roofHeight + Math.round(2 * scale);

  const blocks: PixelBlock[] = [
    blockBuilder.block({
      primitiveKind: "shadow_block",
      x: left - Math.round(6 * scale),
      y: baseY - Math.round(4 * scale),
      width: width + Math.round(12 * scale),
      height: Math.max(5, Math.round(10 * scale)),
      color: PIXEL_PALETTE.shadow,
      opacity: muted ? 0.18 : 0.3,
      layer: "shadow",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: left,
      y: baseY - Math.round(9 * scale),
      width,
      height: Math.max(6, Math.round(9 * scale)),
      color: PIXEL_PALETTE.stoneDark,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: left + Math.round(5 * scale),
      y: wallTop,
      width: width - Math.round(10 * scale),
      height: wallHeight,
      color: PIXEL_PALETTE.cloth,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: left,
      y: roofTop + Math.round(roofHeight * 0.45),
      width,
      height: Math.max(5, Math.round(roofHeight * 0.55)),
      color: PIXEL_PALETTE.trunkDark,
      opacity: muted ? 0.82 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: left + Math.round(8 * scale),
      y: roofTop,
      width: width - Math.round(16 * scale),
      height: Math.max(5, Math.round(roofHeight * 0.6)),
      color: PIXEL_PALETTE.trunk,
      opacity: muted ? 0.82 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "tall_block",
      x: centerX - Math.round(5 * scale),
      y: baseY - Math.round(24 * scale),
      width: Math.max(6, Math.round(10 * scale)),
      height: Math.max(12, Math.round(22 * scale)),
      color: PIXEL_PALETTE.clothDark,
      opacity: muted ? 0.72 : 1,
      layer: "object",
    }),
    ...buildWindowBlocks({ blockBuilder, left, wallTop, width, scale, muted }),
  ];

  return finishDraft({
    kind: "structure",
    label: "structure",
    recipeId: "world_structure_object_recipe",
    recipeVersion: "world-asset-structure-recipe",
    goldenAlgorithm: "world_structure_block_recipe",
    parts: ["structure_shadow", "structure_base", "structure_wall", "structure_roof", "structure_door", "structure_window"],
    shapes: ["shadow_patch", "stone_cluster", "cloth_panel", "highlight_chip"],
    anchor: { type: "center_bottom", x: centerX, y: baseY },
    blocks,
  });
}

export function buildWorldFacilityObjectRecipe(
  input: WorldAssetObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("facility_object_block");
  const scale = clamp(input.scale ?? 1, 0.58, 1.7);
  const centerX = Math.round(input.x ?? 108);
  const baseY = Math.round(input.y ?? 140);
  const health = clamp(input.health ?? 74, 0, 100);
  const muted = health < 46 || (input.stressLevel ?? 0) > 60;
  const underConstruction = (input.stateTags ?? []).some(
    (tag) =>
      tag === "butler_construction_result" ||
      tag === "construction_plan_add_diff" ||
      tag.startsWith("construction_stage:") ||
      tag.includes("under_construction")
  );
  const width = Math.max(24, Math.round(42 * scale));
  const bodyHeight = Math.max(16, Math.round(28 * scale));
  const left = centerX - Math.round(width / 2);
  const bodyTop = baseY - bodyHeight - Math.round(6 * scale);

  const blocks: PixelBlock[] = [
    blockBuilder.block({
      primitiveKind: "shadow_block",
      x: left - Math.round(4 * scale),
      y: baseY - Math.round(3 * scale),
      width: width + Math.round(8 * scale),
      height: Math.max(4, Math.round(8 * scale)),
      color: PIXEL_PALETTE.shadow,
      opacity: muted ? 0.16 : 0.26,
      layer: "shadow",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: left,
      y: baseY - Math.round(8 * scale),
      width,
      height: Math.max(5, Math.round(8 * scale)),
      color: PIXEL_PALETTE.stoneDark,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: left + Math.round(4 * scale),
      y: bodyTop,
      width: width - Math.round(8 * scale),
      height: bodyHeight,
      color: underConstruction ? PIXEL_PALETTE.stone : PIXEL_PALETTE.cloth,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "highlight_block",
      x: left + width - Math.round(11 * scale),
      y: bodyTop + Math.round(5 * scale),
      width: Math.max(4, Math.round(6 * scale)),
      height: Math.max(10, Math.round(18 * scale)),
      color: underConstruction ? PIXEL_PALETTE.stoneLight : PIXEL_PALETTE.clothLight,
      opacity: muted ? 0.54 : 0.88,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "line_block",
      x: left - Math.round(4 * scale),
      y: bodyTop + Math.round(11 * scale),
      width: Math.max(8, Math.round(14 * scale)),
      height: Math.max(2, Math.round(3 * scale)),
      color: underConstruction ? PIXEL_PALETTE.trunk : PIXEL_PALETTE.trunkLight,
      opacity: muted ? 0.7 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "dot_block",
      x: centerX - Math.round(6 * scale),
      y: bodyTop + Math.round(8 * scale),
      width: Math.max(3, Math.round(4 * scale)),
      height: Math.max(3, Math.round(4 * scale)),
      color: PIXEL_PALETTE.highlight,
      opacity: muted ? 0.58 : 0.92,
      layer: "object",
    }),
    ...buildFacilityConstructionCueBlocks({
      blockBuilder,
      centerX,
      baseY,
      left,
      bodyTop,
      width,
      scale,
      muted,
      enabled: underConstruction,
    }),
  ];

  return finishDraft({
    kind: "facility",
    label: "facility",
    recipeId: "world_facility_object_recipe",
    recipeVersion: "world-asset-facility-recipe",
    goldenAlgorithm: "world_facility_block_recipe",
    parts: ["facility_shadow", "facility_base", "facility_body", "facility_accent", "facility_tool"],
    shapes: ["shadow_patch", "stone_cluster", "cloth_panel", "highlight_chip", "leg_line"],
    anchor: { type: "center_bottom", x: centerX, y: baseY },
    blocks,
  });
}

function buildFacilityConstructionCueBlocks(input: {
  blockBuilder: ReturnType<typeof createPixelBlockBuilder>;
  centerX: number;
  baseY: number;
  left: number;
  bodyTop: number;
  width: number;
  scale: number;
  muted: boolean;
  enabled: boolean;
}): PixelBlock[] {
  if (!input.enabled) return [];

  const foundationWidth = input.width + Math.round(26 * input.scale);
  const foundationLeft = input.centerX - Math.round(foundationWidth / 2);
  const scaffoldHeight = Math.max(20, Math.round(32 * input.scale));
  const scaffoldTop = input.bodyTop - Math.round(7 * input.scale);
  const wallTop = input.baseY - Math.round(36 * input.scale);
  const wallThickness = Math.max(5, Math.round(7 * input.scale));
  const wallInset = Math.max(8, Math.round(11 * input.scale));

  return [
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft,
      y: input.baseY - Math.round(4 * input.scale),
      width: foundationWidth,
      height: Math.max(5, Math.round(8 * input.scale)),
      color: PIXEL_PALETTE.soilDark,
      opacity: input.muted ? 0.58 : 0.78,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + wallInset,
      y: wallTop,
      width: foundationWidth - wallInset * 2,
      height: wallThickness,
      color: PIXEL_PALETTE.stoneLight,
      opacity: input.muted ? 0.56 : 0.82,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + wallInset,
      y: input.baseY - Math.round(18 * input.scale),
      width: foundationWidth - wallInset * 2,
      height: wallThickness,
      color: PIXEL_PALETTE.stoneDark,
      opacity: input.muted ? 0.58 : 0.86,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "tall_block",
      x: foundationLeft + wallInset,
      y: wallTop,
      width: wallThickness,
      height: Math.max(18, Math.round(24 * input.scale)),
      color: PIXEL_PALETTE.stone,
      opacity: input.muted ? 0.56 : 0.84,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "tall_block",
      x: foundationLeft + foundationWidth - wallInset - wallThickness,
      y: wallTop,
      width: wallThickness,
      height: Math.max(18, Math.round(24 * input.scale)),
      color: PIXEL_PALETTE.stone,
      opacity: input.muted ? 0.56 : 0.84,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + wallInset + Math.round(10 * input.scale),
      y: wallTop + Math.round(10 * input.scale),
      width: foundationWidth - wallInset * 2 - Math.round(20 * input.scale),
      height: Math.max(8, Math.round(12 * input.scale)),
      color: PIXEL_PALETTE.soil,
      opacity: input.muted ? 0.38 : 0.58,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: input.centerX - Math.round(9 * input.scale),
      y: input.baseY - Math.round(17 * input.scale),
      width: Math.max(14, Math.round(18 * input.scale)),
      height: Math.max(4, Math.round(5 * input.scale)),
      color: PIXEL_PALETTE.trunkLight,
      opacity: input.muted ? 0.5 : 0.78,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: input.centerX - Math.round(13 * input.scale),
      y: input.baseY - Math.round(11 * input.scale),
      width: Math.max(20, Math.round(26 * input.scale)),
      height: Math.max(4, Math.round(5 * input.scale)),
      color: PIXEL_PALETTE.trunk,
      opacity: input.muted ? 0.48 : 0.74,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + Math.round(6 * input.scale),
      y: input.baseY - Math.round(14 * input.scale),
      width: foundationWidth - Math.round(12 * input.scale),
      height: Math.max(4, Math.round(5 * input.scale)),
      color: PIXEL_PALETTE.stone,
      opacity: input.muted ? 0.56 : 0.82,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + Math.round(11 * input.scale),
      y: input.baseY - Math.round(24 * input.scale),
      width: foundationWidth - Math.round(22 * input.scale),
      height: Math.max(4, Math.round(6 * input.scale)),
      color: PIXEL_PALETTE.soil,
      opacity: input.muted ? 0.44 : 0.66,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "tall_block",
      x: input.left - Math.round(10 * input.scale),
      y: scaffoldTop,
      width: Math.max(3, Math.round(5 * input.scale)),
      height: scaffoldHeight,
      color: PIXEL_PALETTE.trunkDark,
      opacity: input.muted ? 0.58 : 0.82,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "tall_block",
      x: input.left + input.width + Math.round(5 * input.scale),
      y: scaffoldTop,
      width: Math.max(3, Math.round(5 * input.scale)),
      height: scaffoldHeight,
      color: PIXEL_PALETTE.trunkDark,
      opacity: input.muted ? 0.58 : 0.82,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "tall_block",
      x: input.centerX - Math.round(3 * input.scale),
      y: scaffoldTop + Math.round(3 * input.scale),
      width: Math.max(3, Math.round(4 * input.scale)),
      height: scaffoldHeight - Math.round(5 * input.scale),
      color: PIXEL_PALETTE.trunk,
      opacity: input.muted ? 0.5 : 0.74,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "line_block",
      x: input.left - Math.round(12 * input.scale),
      y: scaffoldTop + Math.round(9 * input.scale),
      width: input.width + Math.round(24 * input.scale),
      height: Math.max(2, Math.round(4 * input.scale)),
      color: PIXEL_PALETTE.trunkLight,
      opacity: input.muted ? 0.56 : 0.8,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "line_block",
      x: input.left - Math.round(8 * input.scale),
      y: scaffoldTop + Math.round(19 * input.scale),
      width: input.width + Math.round(17 * input.scale),
      height: Math.max(2, Math.round(3 * input.scale)),
      color: PIXEL_PALETTE.trunkLight,
      opacity: input.muted ? 0.42 : 0.64,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "highlight_block",
      x: input.left + Math.round(input.width * 0.18),
      y: input.baseY - Math.round(22 * input.scale),
      width: Math.max(10, Math.round(16 * input.scale)),
      height: Math.max(3, Math.round(5 * input.scale)),
      color: PIXEL_PALETTE.highlight,
      opacity: input.muted ? 0.48 : 0.74,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + Math.round(4 * input.scale),
      y: input.baseY - Math.round(19 * input.scale),
      width: Math.max(12, Math.round(20 * input.scale)),
      height: Math.max(5, Math.round(7 * input.scale)),
      color: PIXEL_PALETTE.stoneDark,
      opacity: input.muted ? 0.5 : 0.74,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: foundationLeft + Math.round(9 * input.scale),
      y: input.baseY - Math.round(25 * input.scale),
      width: Math.max(10, Math.round(18 * input.scale)),
      height: Math.max(4, Math.round(6 * input.scale)),
      color: PIXEL_PALETTE.stone,
      opacity: input.muted ? 0.48 : 0.72,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "dot_block",
      x: foundationLeft + foundationWidth - Math.round(19 * input.scale),
      y: input.baseY - Math.round(26 * input.scale),
      width: Math.max(4, Math.round(6 * input.scale)),
      height: Math.max(4, Math.round(6 * input.scale)),
      color: PIXEL_PALETTE.highlight,
      opacity: input.muted ? 0.44 : 0.68,
      layer: "object",
    }),
  ];
}

function buildWindowBlocks(input: {
  blockBuilder: ReturnType<typeof createPixelBlockBuilder>;
  left: number;
  wallTop: number;
  width: number;
  scale: number;
  muted: boolean;
}): PixelBlock[] {
  const size = Math.max(5, Math.round(8 * input.scale));
  const y = input.wallTop + Math.round(9 * input.scale);

  return [
    input.blockBuilder.block({
      primitiveKind: "square_block",
      x: input.left + Math.round(12 * input.scale),
      y,
      width: size,
      height: size,
      color: PIXEL_PALETTE.clothLight,
      opacity: input.muted ? 0.52 : 0.9,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "square_block",
      x: input.left + input.width - Math.round(20 * input.scale),
      y,
      width: size,
      height: size,
      color: PIXEL_PALETTE.clothLight,
      opacity: input.muted ? 0.52 : 0.9,
      layer: "object",
    }),
  ];
}

function finishDraft(input: {
  kind: "structure" | "facility";
  label: string;
  recipeId: string;
  recipeVersion: string;
  goldenAlgorithm: string;
  parts: PixelPartId[];
  shapes: PixelShapeId[];
  anchor: DraftPixelObject["anchor"];
  blocks: PixelBlock[];
}): PixelObjectRecipeResult {
  const draft: DraftPixelObject = {
    kind: input.kind,
    label: input.label,
    recipeId: input.recipeId,
    recipeVersion: input.recipeVersion,
    goldenAlgorithm: input.goldenAlgorithm,
    semanticStructureId: getPixelSemanticStructure(input.kind).id,
    anchor: input.anchor,
    bounds: resolveBounds(input.blocks),
    blocks: input.blocks,
    usedPrimitives: Array.from(new Set(input.blocks.map((item) => item.primitiveKind))),
    usedShapes: input.shapes,
    usedParts: input.parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function resolveBounds(blocks: PixelBlock[]): PixelBounds {
  const left = Math.min(...blocks.map((block) => block.x));
  const top = Math.min(...blocks.map((block) => block.y));
  const right = Math.max(...blocks.map((block) => block.x + block.width));
  const bottom = Math.max(...blocks.map((block) => block.y + block.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
