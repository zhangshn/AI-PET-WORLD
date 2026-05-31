// 该文件用于生成自然石头的高质量像素 recipe。

import { PIXEL_PALETTE } from "../pixel-style-foundation";
import { validatePixelObjectRecipe } from "../pixel-object-validator";
import { getPixelSemanticStructure } from "../semantic-structure-library";
import type { PixelBlock, PixelObjectRecipeResult, PixelPartId, PixelShapeId } from "../pixel-primitive-schema";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;
type BlockInput = Omit<PixelBlock, "id">;

let blockCounter = 0;

export function buildNaturalStoneQualityRecipe(): PixelObjectRecipeResult {
  blockCounter = 0;
  const parts: PixelPartId[] = ["stone_shadow", "stone_body", "stone_dark_edge", "stone_highlight"];
  const shapes: PixelShapeId[] = ["stone_cluster", "shadow_patch", "highlight_chip"];
  const blocks = [
    b({ primitiveKind: "shadow_block", x: 78, y: 136, width: 62, height: 10, color: PIXEL_PALETTE.shadow, opacity: 0.34, layer: "shadow" }),
    b({ primitiveKind: "wide_block", x: 80, y: 116, width: 55, height: 14, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 86, y: 104, width: 48, height: 14, color: PIXEL_PALETTE.stone, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 92, y: 94, width: 34, height: 12, color: PIXEL_PALETTE.stone, opacity: 1, layer: "object" }),
    b({ primitiveKind: "square_block", x: 80, y: 108, width: 10, height: 11, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
    b({ primitiveKind: "square_block", x: 129, y: 111, width: 10, height: 14, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
    b({ primitiveKind: "highlight_block", x: 94, y: 99, width: 23, height: 5, color: PIXEL_PALETTE.stoneLight, opacity: 1, layer: "object" }),
    b({ primitiveKind: "line_block", x: 103, y: 114, width: 16, height: 2, color: PIXEL_PALETTE.stoneDark, opacity: 0.72, layer: "object" }),
  ];
  const draft: DraftPixelObject = {
    kind: "stone",
    label: "石头",
    recipeId: "natural_stone_quality_recipe_v1",
    recipeVersion: "1.1.0",
    semanticStructureId: getPixelSemanticStructure("stone").id,
    anchor: { type: "center_bottom", x: 110, y: 141 },
    bounds: { x: 78, y: 92, width: 64, height: 54 },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };
  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function b(input: BlockInput): PixelBlock {
  blockCounter += 1;
  return { id: `natural_stone_block_${blockCounter}`, ...input };
}
