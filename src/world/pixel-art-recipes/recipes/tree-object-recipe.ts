// 该文件用于生成自然树木像素对象 recipe。

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
import { createPixelBlockBuilder } from "../core/pixel-block-builder";

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
  const blocks: PixelBlock[] = sceneBlocks.map((block) =>
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
  );

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
    label: "树木",
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
