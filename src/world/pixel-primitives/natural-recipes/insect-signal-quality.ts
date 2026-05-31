// 该文件用于生成自然昆虫生态信号的高质量像素 recipe。

import { PIXEL_PALETTE } from "../pixel-style-foundation";
import { validatePixelObjectRecipe } from "../pixel-object-validator";
import { getPixelSemanticStructure } from "../semantic-structure-library";
import type { PixelBlock, PixelObjectRecipeResult, PixelPartId, PixelShapeId } from "../pixel-primitive-schema";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;
type BlockInput = Omit<PixelBlock, "id">;

let blockCounter = 0;

export function buildNaturalInsectSignalQualityRecipe(): PixelObjectRecipeResult {
  blockCounter = 0;
  const parts: PixelPartId[] = ["insect_body", "insect_head", "insect_wing", "insect_leg", "insect_antenna", "insect_highlight"];
  const shapes: PixelShapeId[] = ["body_cluster", "wing_chip", "leg_line", "antenna_line", "highlight_chip"];
  const blocks = [
    b({ primitiveKind: "transparent_block", x: 93, y: 99, width: 15, height: 8, color: PIXEL_PALETTE.wing, opacity: 0.36, layer: "object" }),
    b({ primitiveKind: "transparent_block", x: 111, y: 99, width: 15, height: 8, color: PIXEL_PALETTE.wing, opacity: 0.36, layer: "object" }),
    b({ primitiveKind: "square_block", x: 104, y: 103, width: 11, height: 10, color: PIXEL_PALETTE.insect, opacity: 1, layer: "object" }),
    b({ primitiveKind: "dot_block", x: 107, y: 97, width: 6, height: 6, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    b({ primitiveKind: "highlight_block", x: 110, y: 105, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.9, layer: "object" }),
    b({ primitiveKind: "line_block", x: 97, y: 115, width: 9, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 0.9, layer: "object" }),
    b({ primitiveKind: "line_block", x: 114, y: 115, width: 9, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 0.9, layer: "object" }),
    b({ primitiveKind: "line_block", x: 104, y: 94, width: 7, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 0.72, layer: "object" }),
    b({ primitiveKind: "dot_block", x: 90, y: 92, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.52, layer: "atmosphere" }),
    b({ primitiveKind: "dot_block", x: 126, y: 93, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.42, layer: "atmosphere" }),
  ];
  const draft: DraftPixelObject = {
    kind: "insect",
    label: "昆虫生态信号",
    recipeId: "natural_insect_signal_quality_recipe_v1",
    recipeVersion: "1.1.0",
    semanticStructureId: getPixelSemanticStructure("insect").id,
    anchor: { type: "body_center", x: 110, y: 108 },
    bounds: { x: 90, y: 92, width: 38, height: 26 },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };
  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function b(input: BlockInput): PixelBlock {
  blockCounter += 1;
  return { id: `natural_insect_signal_block_${blockCounter}`, ...input };
}
