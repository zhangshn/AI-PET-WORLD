// 该文件用于生成自然树木像素对象 recipe。

import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation";
import { validatePixelObjectRecipe } from "../../pixel-primitives/pixel-object-validator";
import type {
  PixelBlock,
  PixelObjectRecipeResult,
  PixelPartId,
  PixelShapeId,
} from "../../pixel-primitives/pixel-primitive-schema";
import { getPixelSemanticStructure } from "../../pixel-primitives/semantic-structure-library";
import { createPixelBlockBuilder, type PixelBlockBuilder } from "../core/pixel-block-builder";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export function buildNaturalTreeObjectRecipe(): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("pixel_block");
  const parts: PixelPartId[] = [
    "tree_shadow",
    "tree_trunk",
    "tree_trunk_light",
    "tree_crown_dark",
    "tree_crown_main",
    "tree_crown_highlight",
    "tree_crown_under",
  ];
  const shapes: PixelShapeId[] = ["shadow_patch", "trunk_strip", "leaf_cluster", "leaf_row", "highlight_chip"];
  const blocks = [
    blockBuilder.block({ primitiveKind: "shadow_block", x: 70, y: 154, width: 76, height: 16, color: PIXEL_PALETTE.shadow, opacity: 0.42, layer: "shadow" }),
    blockBuilder.block({ primitiveKind: "dark_block", x: 96, y: 92, width: 17, height: 66, color: PIXEL_PALETTE.trunkDark, opacity: 1, layer: "object" }),
    blockBuilder.block({ primitiveKind: "tall_block", x: 102, y: 96, width: 13, height: 58, color: PIXEL_PALETTE.trunk, opacity: 1, layer: "object" }),
    blockBuilder.block({ primitiveKind: "highlight_block", x: 112, y: 108, width: 4, height: 36, color: PIXEL_PALETTE.trunkLight, opacity: 1, layer: "object" }),
    ...leafCluster(116, 70, 1, PIXEL_PALETTE.leafDark, [4, 10, 18, 24, 25, 20, 11], blockBuilder),
    ...leafCluster(94, 60, 1, PIXEL_PALETTE.leaf, [5, 13, 22, 28, 27, 20, 9], blockBuilder),
    ...leafCluster(70, 76, 0.78, PIXEL_PALETTE.leaf, [4, 10, 16, 20, 18, 10], blockBuilder),
    ...leafCluster(86, 46, 0.68, PIXEL_PALETTE.leafLight, [3, 7, 13, 15, 10, 4], blockBuilder),
    ...leafCluster(102, 104, 0.86, PIXEL_PALETTE.leafUnder, [5, 14, 22, 24, 17, 8], blockBuilder),
  ];

  const draft: DraftPixelObject = {
    kind: "tree",
    label: "树木",
    recipeId: "natural_tree_object_recipe",
    recipeVersion: "procedural-tree-object",
    goldenAlgorithm: "scene_composer_tree_recipe",
    semanticStructureId: getPixelSemanticStructure("tree").id,
    anchor: { type: "root_bottom", x: 104, y: 158 },
    bounds: { x: 36, y: 30, width: 128, height: 140 },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function leafCluster(
  cx: number,
  cy: number,
  scale: number,
  color: string,
  rows: number[],
  blockBuilder: PixelBlockBuilder
): PixelBlock[] {
  const rowHeight = Math.max(3, Math.round(4 * scale));
  const topY = Math.round(cy - (rows.length * rowHeight) / 2);

  return rows.map((row, index) => {
    const width = Math.max(6, Math.round(row * 3 * scale));
    const x = Math.round(cx - width / 2 + (index % 3) * 2);
    const y = topY + index * rowHeight;
    return blockBuilder.block({ primitiveKind: "wide_block", x, y, width, height: rowHeight, color, opacity: 1, layer: "object" });
  });
}
