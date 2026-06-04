// Builds the stable natural tree pixel object recipe used by VisualGeneration.
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
import { buildSceneComposerTreeBlockPlan } from "../../procedural-painter/scene-composer/scene-composer-tree-recipe";
import type { SceneObject } from "../../procedural-painter/scene-composer/scene-composer-schema";
import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation";
import { createPixelBlockBuilder, type PixelBlockBuilder } from "../core/pixel-block-builder";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export type NaturalTreeObjectRecipeInput = {
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

export function buildNaturalTreeObjectRecipe(
  input: NaturalTreeObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("pixel_block");
  const palette = buildScenePalette("forest", 74);
  const treeObject: SceneObject = {
    id: input.sourceObjectId ?? "natural_tree_object_recipe_preview",
    kind: "tree",
    x: input.x ?? 104,
    y: input.y ?? 158,
    scale: input.scale ?? 1,
    layer: "middle",
    health: input.health ?? 80,
    age: 40,
    ecologyRole: "canopy",
    moistureAffinity: 74,
    traceSensitivity: 40,
    ecologyHealth: 80,
    growthStage: normalizeTreeGrowthStage(input.growthStage),
    stressLevel: input.stressLevel ?? 0,
  };

  const sceneBlocks = buildSceneComposerTreeBlockPlan(treeObject, palette);
  const blocks: PixelBlock[] = [
    ...sceneBlocks.map((block) =>
      blockBuilder.block({
        primitiveKind: block.primitiveKind,
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        color: block.color,
        opacity: block.opacity,
        layer: block.layer,
      })
    ),
    ...buildReadableCanopyVolumeBlocks({
      blockBuilder,
      centerX: treeObject.x,
      baseY: treeObject.y,
      scale: treeObject.scale,
      stressed: (treeObject.stressLevel ?? 0) > 62 || (treeObject.health ?? 80) < 46,
    }),
  ];

  const parts: PixelPartId[] = [
    "tree_shadow",
    "tree_trunk",
    "tree_trunk_light",
    "tree_crown_dark",
    "tree_crown_main",
    "tree_crown_highlight",
    "tree_crown_under",
  ];

  const shapes: PixelShapeId[] = [
    "shadow_patch",
    "trunk_strip",
    "leaf_cluster",
    "leaf_row",
    "highlight_chip",
  ];

  const draft: DraftPixelObject = {
    kind: "tree",
    label: "tree",
    recipeId: "natural_tree_object_recipe",
    recipeVersion: "scene-composer-tree-recipe",
    goldenAlgorithm: "scene_composer_tree_recipe",
    semanticStructureId: getPixelSemanticStructure("tree").id,
    anchor: { type: "root_bottom", x: treeObject.x, y: treeObject.y },
    bounds: resolveBounds(blocks),
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function buildReadableCanopyVolumeBlocks(input: {
  blockBuilder: PixelBlockBuilder;
  centerX: number;
  baseY: number;
  scale: number;
  stressed: boolean;
}): PixelBlock[] {
  const scale = clamp(input.scale, 0.72, 1.35);
  const crownTop = input.baseY - Math.round(102 * scale);
  const dark = input.stressed ? PIXEL_PALETTE.leafUnder : PIXEL_PALETTE.leafDark;
  const main = input.stressed ? PIXEL_PALETTE.leafDark : PIXEL_PALETTE.leaf;
  const light = input.stressed ? PIXEL_PALETTE.leaf : PIXEL_PALETTE.leafLight;
  const trunkBaseY = input.baseY - Math.round(34 * scale);

  return [
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: Math.round(input.centerX - 45 * scale),
      y: Math.round(crownTop + 18 * scale),
      width: Math.max(22, Math.round(92 * scale)),
      height: Math.max(10, Math.round(18 * scale)),
      color: dark,
      opacity: 0.72,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: Math.round(input.centerX - 36 * scale),
      y: Math.round(crownTop + 6 * scale),
      width: Math.max(22, Math.round(68 * scale)),
      height: Math.max(10, Math.round(16 * scale)),
      color: main,
      opacity: 0.82,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: Math.round(input.centerX - 58 * scale),
      y: Math.round(crownTop + 35 * scale),
      width: Math.max(18, Math.round(44 * scale)),
      height: Math.max(9, Math.round(15 * scale)),
      color: main,
      opacity: 0.86,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: Math.round(input.centerX + 12 * scale),
      y: Math.round(crownTop + 34 * scale),
      width: Math.max(20, Math.round(50 * scale)),
      height: Math.max(9, Math.round(16 * scale)),
      color: dark,
      opacity: 0.76,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "highlight_block",
      x: Math.round(input.centerX - 26 * scale),
      y: Math.round(crownTop + 10 * scale),
      width: Math.max(10, Math.round(24 * scale)),
      height: Math.max(4, Math.round(7 * scale)),
      color: light,
      opacity: input.stressed ? 0.34 : 0.58,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "highlight_block",
      x: Math.round(input.centerX + 2 * scale),
      y: Math.round(crownTop + 25 * scale),
      width: Math.max(8, Math.round(18 * scale)),
      height: Math.max(3, Math.round(6 * scale)),
      color: light,
      opacity: input.stressed ? 0.28 : 0.5,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "wide_block",
      x: Math.round(input.centerX - 15 * scale),
      y: Math.round(trunkBaseY + 25 * scale),
      width: Math.max(8, Math.round(18 * scale)),
      height: Math.max(4, Math.round(7 * scale)),
      color: PIXEL_PALETTE.trunkDark,
      opacity: 0.88,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "line_block",
      x: Math.round(input.centerX - 25 * scale),
      y: Math.round(input.baseY - 8 * scale),
      width: Math.max(10, Math.round(22 * scale)),
      height: Math.max(2, Math.round(4 * scale)),
      color: PIXEL_PALETTE.trunkDark,
      opacity: 0.74,
      layer: "object",
    }),
    input.blockBuilder.block({
      primitiveKind: "line_block",
      x: Math.round(input.centerX + 4 * scale),
      y: Math.round(input.baseY - 7 * scale),
      width: Math.max(10, Math.round(20 * scale)),
      height: Math.max(2, Math.round(4 * scale)),
      color: PIXEL_PALETTE.trunk,
      opacity: 0.7,
      layer: "object",
    }),
  ];
}

function normalizeTreeGrowthStage(
  value: string | undefined
): SceneObject["growthStage"] {
  if (
    value === "sprout" ||
    value === "young" ||
    value === "mature" ||
    value === "old" ||
    value === "declining"
  ) {
    return value;
  }

  return "mature";
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
