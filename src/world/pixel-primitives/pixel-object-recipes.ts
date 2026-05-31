// 该文件用于根据语义结构、像素形状和部件生成第一版像素对象。

import { PIXEL_PALETTE } from "./pixel-style-foundation";
import { validatePixelObjectRecipe } from "./pixel-object-validator";
import { getPixelSemanticStructure } from "./semantic-structure-library";
import type { PixelBlock, PixelObjectKind, PixelObjectRecipeResult, PixelPartId, PixelPrimitiveKind, PixelShapeId } from "./pixel-primitive-schema";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

type BlockInput = Omit<PixelBlock, "id">;

let blockCounter = 0;

export function buildPixelObjectRecipe(kind: PixelObjectKind): PixelObjectRecipeResult {
  const draft = kind === "tree"
    ? buildTreeRecipe()
    : kind === "grass_tile"
      ? buildGrassTileRecipe()
      : kind === "stone"
        ? buildStoneRecipe()
        : kind === "insect"
          ? buildInsectRecipe()
          : buildButlerRecipe();

  return {
    ...draft,
    validation: validatePixelObjectRecipe(draft),
  };
}

export const PIXEL_OBJECT_KINDS: PixelObjectKind[] = ["tree", "grass_tile", "stone", "insect", "butler"];

function buildTreeRecipe(): DraftPixelObject {
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
    block({ primitiveKind: "shadow_block", x: 70, y: 154, width: 76, height: 16, color: PIXEL_PALETTE.shadow, opacity: 0.42, layer: "shadow" }),
    block({ primitiveKind: "dark_block", x: 96, y: 92, width: 17, height: 66, color: PIXEL_PALETTE.trunkDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "tall_block", x: 102, y: 96, width: 13, height: 58, color: PIXEL_PALETTE.trunk, opacity: 1, layer: "object" }),
    block({ primitiveKind: "highlight_block", x: 112, y: 108, width: 4, height: 36, color: PIXEL_PALETTE.trunkLight, opacity: 1, layer: "object" }),
    ...leafCluster(116, 70, 1, PIXEL_PALETTE.leafDark, [4, 10, 18, 24, 25, 20, 11]),
    ...leafCluster(94, 60, 1, PIXEL_PALETTE.leaf, [5, 13, 22, 28, 27, 20, 9]),
    ...leafCluster(70, 76, 0.78, PIXEL_PALETTE.leaf, [4, 10, 16, 20, 18, 10]),
    ...leafCluster(86, 46, 0.68, PIXEL_PALETTE.leafLight, [3, 7, 13, 15, 10, 4]),
    ...leafCluster(102, 104, 0.86, PIXEL_PALETTE.leafUnder, [5, 14, 22, 24, 17, 8]),
  ];

  return objectDraft({
    kind: "tree",
    label: "树木",
    recipeId: "pixel_object_tree_recipe_v1",
    recipeVersion: "1.0.0",
    goldenAlgorithm: "scene_composer_tree_recipe",
    parts,
    shapes,
    blocks,
    anchor: { type: "root_bottom", x: 104, y: 158 },
    bounds: { x: 36, y: 30, width: 128, height: 140 },
  });
}

function buildGrassTileRecipe(): DraftPixelObject {
  const parts: PixelPartId[] = ["ground_base", "grass_detail", "soil_detail", "pressed_detail", "worn_detail"];
  const shapes: PixelShapeId[] = ["grass_chip", "soil_chip", "pressed_mark", "worn_strip"];
  const blocks = [
    block({ primitiveKind: "square_block", x: 56, y: 56, width: 96, height: 96, color: PIXEL_PALETTE.grassBase, opacity: 1, layer: "ground" }),
    block({ primitiveKind: "wide_block", x: 72, y: 98, width: 54, height: 8, color: PIXEL_PALETTE.grassDark, opacity: 0.5, layer: "trace" }),
    block({ primitiveKind: "wide_block", x: 82, y: 116, width: 42, height: 6, color: PIXEL_PALETTE.soil, opacity: 0.35, layer: "trace" }),
    ...grassDetails(66, 66),
  ];

  return objectDraft({
    kind: "grass_tile",
    label: "草地 Tile",
    recipeId: "pixel_object_grass_tile_recipe_v1",
    recipeVersion: "1.0.0",
    goldenAlgorithm: "formal_ground_recipe_v1",
    parts,
    shapes,
    blocks,
    anchor: { type: "tile_origin", x: 56, y: 56 },
    bounds: { x: 56, y: 56, width: 96, height: 96 },
  });
}

function buildStoneRecipe(): DraftPixelObject {
  const parts: PixelPartId[] = ["stone_shadow", "stone_body", "stone_dark_edge", "stone_highlight"];
  const shapes: PixelShapeId[] = ["stone_cluster", "shadow_patch", "highlight_chip"];
  const blocks = [
    block({ primitiveKind: "shadow_block", x: 82, y: 132, width: 54, height: 10, color: PIXEL_PALETTE.shadow, opacity: 0.34, layer: "shadow" }),
    block({ primitiveKind: "wide_block", x: 82, y: 106, width: 46, height: 18, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "wide_block", x: 88, y: 98, width: 38, height: 16, color: PIXEL_PALETTE.stone, opacity: 1, layer: "object" }),
    block({ primitiveKind: "square_block", x: 118, y: 112, width: 14, height: 12, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "highlight_block", x: 94, y: 102, width: 18, height: 5, color: PIXEL_PALETTE.stoneLight, opacity: 1, layer: "object" }),
  ];

  return objectDraft({
    kind: "stone",
    label: "石头",
    recipeId: "pixel_object_stone_recipe_v1",
    recipeVersion: "1.0.0",
    parts,
    shapes,
    blocks,
    anchor: { type: "center_bottom", x: 108, y: 136 },
    bounds: { x: 78, y: 94, width: 60, height: 48 },
  });
}

function buildInsectRecipe(): DraftPixelObject {
  const parts: PixelPartId[] = ["insect_body", "insect_head", "insect_wing", "insect_leg", "insect_antenna", "insect_highlight"];
  const shapes: PixelShapeId[] = ["body_cluster", "head_block", "wing_chip", "leg_line", "antenna_line", "highlight_chip"];
  const blocks = [
    block({ primitiveKind: "transparent_block", x: 91, y: 93, width: 14, height: 8, color: PIXEL_PALETTE.wing, opacity: 0.42, layer: "object" }),
    block({ primitiveKind: "transparent_block", x: 107, y: 93, width: 14, height: 8, color: PIXEL_PALETTE.wing, opacity: 0.42, layer: "object" }),
    block({ primitiveKind: "square_block", x: 101, y: 98, width: 10, height: 12, color: PIXEL_PALETTE.insect, opacity: 1, layer: "object" }),
    block({ primitiveKind: "dot_block", x: 103, y: 92, width: 7, height: 7, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "line_block", x: 94, y: 111, width: 10, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "line_block", x: 109, y: 111, width: 10, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "line_block", x: 99, y: 90, width: 8, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    block({ primitiveKind: "highlight_block", x: 105, y: 100, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 1, layer: "object" }),
  ];

  return objectDraft({
    kind: "insect",
    label: "昆虫",
    recipeId: "pixel_object_insect_recipe_v1",
    recipeVersion: "1.0.0",
    parts,
    shapes,
    blocks,
    anchor: { type: "body_center", x: 106, y: 104 },
    bounds: { x: 90, y: 88, width: 34, height: 28 },
  });
}

function buildButlerRecipe(): DraftPixelObject {
  const parts: PixelPartId[] = ["butler_shadow", "butler_leg", "butler_body", "butler_cloth", "butler_arm", "butler_head", "butler_hair_or_hat"];
  const shapes: PixelShapeId[] = ["shadow_patch", "leg_strip", "cloth_panel", "arm_strip", "head_block", "highlight_chip"];
  const blocks = [
    block({ primitiveKind: "shadow_block", x: 92, y: 148, width: 32, height: 8, color: PIXEL_PALETTE.shadow, opacity: 0.34, layer: "shadow" }),
    block({ primitiveKind: "tall_block", x: 100, y: 128, width: 5, height: 22, color: PIXEL_PALETTE.clothDark, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "tall_block", x: 111, y: 128, width: 5, height: 22, color: PIXEL_PALETTE.clothDark, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "wide_block", x: 96, y: 100, width: 24, height: 31, color: PIXEL_PALETTE.cloth, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "highlight_block", x: 112, y: 104, width: 4, height: 18, color: PIXEL_PALETTE.clothLight, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "tall_block", x: 91, y: 105, width: 4, height: 22, color: PIXEL_PALETTE.clothDark, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "tall_block", x: 121, y: 105, width: 4, height: 22, color: PIXEL_PALETTE.clothDark, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "square_block", x: 98, y: 80, width: 20, height: 20, color: PIXEL_PALETTE.skin, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "wide_block", x: 96, y: 76, width: 24, height: 6, color: PIXEL_PALETTE.clothDark, opacity: 1, layer: "actor" }),
    block({ primitiveKind: "dot_block", x: 104, y: 88, width: 3, height: 3, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "actor" }),
  ];

  return objectDraft({
    kind: "butler",
    label: "管家",
    recipeId: "pixel_object_butler_recipe_v1",
    recipeVersion: "1.0.0",
    parts,
    shapes,
    blocks,
    anchor: { type: "feet_center", x: 108, y: 150 },
    bounds: { x: 88, y: 74, width: 42, height: 84 },
  });
}

function objectDraft(input: {
  kind: PixelObjectKind;
  label: string;
  recipeId: string;
  recipeVersion: string;
  goldenAlgorithm?: string;
  parts: PixelPartId[];
  shapes: PixelShapeId[];
  blocks: PixelBlock[];
  anchor: DraftPixelObject["anchor"];
  bounds: DraftPixelObject["bounds"];
}): DraftPixelObject {
  return {
    kind: input.kind,
    label: input.label,
    recipeId: input.recipeId,
    recipeVersion: input.recipeVersion,
    goldenAlgorithm: input.goldenAlgorithm,
    semanticStructureId: getPixelSemanticStructure(input.kind).id,
    anchor: input.anchor,
    bounds: input.bounds,
    blocks: input.blocks,
    usedPrimitives: unique(input.blocks.map((item) => item.primitiveKind)),
    usedShapes: input.shapes,
    usedParts: input.parts,
  };
}

function block(input: BlockInput): PixelBlock {
  blockCounter += 1;
  return { id: `pixel_block_${blockCounter}`, ...input };
}

function leafCluster(cx: number, cy: number, scale: number, color: string, rows: number[]): PixelBlock[] {
  const rowHeight = Math.max(3, Math.round(4 * scale));
  const topY = Math.round(cy - (rows.length * rowHeight) / 2);
  return rows.map((row, index) => {
    const width = Math.max(6, Math.round(row * 3 * scale));
    const x = Math.round(cx - width / 2 + (index % 3) * 2);
    const y = topY + index * rowHeight;
    return block({ primitiveKind: "wide_block", x, y, width, height: rowHeight, color, opacity: 1, layer: "object" });
  });
}

function grassDetails(startX: number, startY: number): PixelBlock[] {
  const positions = [
    [0, 4], [16, 28], [28, 8], [44, 40], [58, 20], [70, 52], [18, 64], [82, 72],
  ];
  return positions.map(([x, y], index) => block({
    primitiveKind: index % 3 === 0 ? "tall_block" : "dot_block",
    x: startX + x,
    y: startY + y,
    width: index % 3 === 0 ? 4 : 3,
    height: index % 3 === 0 ? 14 : 3,
    color: index % 2 === 0 ? PIXEL_PALETTE.grassLight : PIXEL_PALETTE.grassDark,
    opacity: 0.88,
    layer: "ground",
  }));
}

function unique<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items));
}
