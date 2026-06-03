// Builds the stable natural mushroom pixel object recipe used by VisualGeneration.

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

export type NaturalMushroomObjectRecipeInput = {
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

export function buildNaturalMushroomObjectRecipe(
  input: NaturalMushroomObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("mushroom_object_block");
  const palette = buildScenePalette("forest", 82);
  const scale = clamp(input.scale ?? 1, 0.5, 1.35);
  const centerX = Math.round(input.x ?? 106);
  const baseY = Math.round(input.y ?? 137);
  const health = clamp(input.health ?? 70, 0, 100);
  const stressLevel = clamp(input.stressLevel ?? 0, 0, 100);
  const youngScale = input.growthStage === "sprout" || input.growthStage === "young" ? 0.82 : 1;
  const finalScale = scale * youngScale;
  const capWidth = Math.max(8, Math.round(24 * finalScale));
  const capHeight = Math.max(5, Math.round(10 * finalScale));
  const stemWidth = Math.max(4, Math.round(7 * finalScale));
  const stemHeight = Math.max(7, Math.round(16 * finalScale));
  const capTopY = baseY - stemHeight - capHeight + Math.round(2 * finalScale);
  const muted = stressLevel > 60 || health < 48;

  const blocks: PixelBlock[] = [
    blockBuilder.block({
      primitiveKind: "shadow_block",
      x: centerX - Math.round(15 * finalScale),
      y: baseY - Math.round(2 * finalScale),
      width: Math.max(10, Math.round(30 * finalScale)),
      height: Math.max(3, Math.round(6 * finalScale)),
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
      color: palette.mushroomStem,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: centerX - Math.round(capWidth / 2),
      y: capTopY + Math.round(capHeight * 0.48),
      width: capWidth,
      height: Math.max(4, Math.round(capHeight * 0.52)),
      color: palette.mushroomCap,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: centerX - Math.round(capWidth * 0.36),
      y: capTopY,
      width: Math.max(7, Math.round(capWidth * 0.72)),
      height: Math.max(4, Math.round(capHeight * 0.56)),
      color: palette.mushroomCap,
      opacity: muted ? 0.78 : 1,
      layer: "object",
    }),
    blockBuilder.block({
      primitiveKind: "wide_block",
      x: centerX - Math.round(capWidth * 0.36),
      y: capTopY + capHeight,
      width: Math.max(7, Math.round(capWidth * 0.72)),
      height: Math.max(2, Math.round(3 * finalScale)),
      color: palette.soilDark,
      opacity: muted ? 0.52 : 0.68,
      layer: "object",
    }),
    ...buildSpotBlocks({
      blockBuilder,
      centerX,
      capTopY,
      scale: finalScale,
      color: PIXEL_PALETTE.highlight,
      muted,
    }),
  ];

  const parts: PixelPartId[] = [
    "mushroom_shadow",
    "mushroom_stem",
    "mushroom_cap",
    "mushroom_under",
    "mushroom_spot",
  ];
  const shapes: PixelShapeId[] = ["shadow_patch", "trunk_strip", "stone_cluster", "highlight_chip"];
  const draft: DraftPixelObject = {
    kind: "mushroom",
    label: "蘑菇",
    recipeId: "natural_mushroom_object_recipe",
    recipeVersion: "scene-composer-mushroom-recipe",
    goldenAlgorithm: "scene_composer_mushroom_recipe",
    semanticStructureId: getPixelSemanticStructure("mushroom").id,
    anchor: { type: "center_bottom", x: centerX, y: baseY },
    bounds: resolveBounds(blocks),
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function buildSpotBlocks(input: {
  blockBuilder: ReturnType<typeof createPixelBlockBuilder>;
  centerX: number;
  capTopY: number;
  scale: number;
  color: string;
  muted: boolean;
}): PixelBlock[] {
  const spotSize = Math.max(2, Math.round(3 * input.scale));

  return [
    input.blockBuilder.block({
      primitiveKind: "dot_block",
      x: input.centerX - Math.round(5 * input.scale),
      y: input.capTopY + Math.round(3 * input.scale),
      width: spotSize,
      height: spotSize,
      color: input.color,
      opacity: input.muted ? 0.58 : 0.9,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "dot_block",
      x: input.centerX + Math.round(5 * input.scale),
      y: input.capTopY + Math.round(5 * input.scale),
      width: spotSize,
      height: spotSize,
      color: input.color,
      opacity: input.muted ? 0.5 : 0.82,
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
