// Builds the stable natural flower pixel object recipe used by VisualGeneration.

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
import { buildScenePalette } from "../../procedural-painter/scene-composer/scene-composer-palette";
import { createPixelBlockBuilder } from "../core/pixel-block-builder";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export type NaturalFlowerObjectRecipeInput = {
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

export function buildNaturalFlowerObjectRecipe(
  input: NaturalFlowerObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("flower_object_block");
  const palette = buildScenePalette("forest", 68);
  const scale = clamp(input.scale ?? 1, 0.5, 1.35);
  const centerX = Math.round(input.x ?? 106);
  const baseY = Math.round(input.y ?? 136);
  const health = clamp(input.health ?? 76, 0, 100);
  const stressLevel = clamp(input.stressLevel ?? 0, 0, 100);
  const bloomSize = Math.max(
    2,
    Math.round((stressLevel > 60 ? 3 : health > 72 ? 5 : 4) * scale)
  );
  const stemHeight = Math.max(9, Math.round(22 * scale));
  const stemWidth = Math.max(2, Math.round(3 * scale));
  const bloomColor = health > 72 ? palette.insectSignal : palette.flower;
  const bloomY = baseY - stemHeight - Math.round(6 * scale);

  const blocks: PixelBlock[] = [
    blockBuilder.block({
      primitiveKind: "shadow_block",
      x: centerX - Math.round(10 * scale),
      y: baseY - Math.round(2 * scale),
      width: Math.max(8, Math.round(20 * scale)),
      height: Math.max(3, Math.round(5 * scale)),
      color: PIXEL_PALETTE.shadow,
      opacity: 0.18 + (health / 100) * 0.08,
      layer: "shadow",
    }),
    blockBuilder.block({
      primitiveKind: "tall_block",
      x: centerX - Math.floor(stemWidth / 2),
      y: baseY - stemHeight,
      width: stemWidth,
      height: stemHeight,
      color: palette.grassDark,
      opacity: 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: centerX - Math.round(9 * scale),
      y: baseY - Math.round(10 * scale),
      width: Math.max(5, Math.round(9 * scale)),
      height: Math.max(2, Math.round(3 * scale)),
      color: palette.grassLight,
      opacity: 0.86,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: centerX + Math.round(2 * scale),
      y: baseY - Math.round(13 * scale),
      width: Math.max(5, Math.round(9 * scale)),
      height: Math.max(2, Math.round(3 * scale)),
      color: palette.grassLight,
      opacity: 0.86,
      layer: "object",
    }),
    ...buildBloomBlocks({
      centerX,
      bloomY,
      bloomSize,
      bloomColor,
      highlightColor: PIXEL_PALETTE.highlight,
      blockBuilder,
      muted: stressLevel > 60,
    }),
  ];

  const parts: PixelPartId[] = [
    "flower_shadow",
    "flower_stem",
    "flower_leaf",
    "flower_bloom",
    "flower_highlight",
  ];
  const shapes: PixelShapeId[] = ["shadow_patch", "grass_chip", "highlight_chip"];
  const draft: DraftPixelObject = {
    kind: "flower",
    label: "flower",
    recipeId: "natural_flower_object_recipe",
    recipeVersion: "scene-composer-flower-recipe",
    goldenAlgorithm: "scene_composer_flower_recipe",
    semanticStructureId: getPixelSemanticStructure("flower").id,
    anchor: { type: "center_bottom", x: centerX, y: baseY },
    bounds: resolveBounds(blocks),
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function buildBloomBlocks(input: {
  centerX: number;
  bloomY: number;
  bloomSize: number;
  bloomColor: string;
  highlightColor: string;
  muted: boolean;
  blockBuilder: ReturnType<typeof createPixelBlockBuilder>;
}): PixelBlock[] {
  const petalOpacity = input.muted ? 0.72 : 1;
  const centerSize = Math.max(2, Math.round(input.bloomSize * 0.72));

  return [
    input.blockBuilder.block({
      primitiveKind: "square_block",
      x: input.centerX - input.bloomSize - 2,
      y: input.bloomY + 3,
      width: input.bloomSize,
      height: input.bloomSize,
      color: input.bloomColor,
      opacity: petalOpacity,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "square_block",
      x: input.centerX + 2,
      y: input.bloomY + 3,
      width: input.bloomSize,
      height: input.bloomSize,
      color: input.bloomColor,
      opacity: petalOpacity,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "square_block",
      x: input.centerX - Math.floor(input.bloomSize / 2),
      y: input.bloomY - 2,
      width: input.bloomSize,
      height: input.bloomSize,
      color: input.bloomColor,
      opacity: petalOpacity,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "dot_block",
      x: input.centerX - Math.floor(centerSize / 2),
      y: input.bloomY + 4,
      width: centerSize,
      height: centerSize,
      color: input.highlightColor,
      opacity: input.muted ? 0.68 : 1,
      layer: "object",
    }),
  ];
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
