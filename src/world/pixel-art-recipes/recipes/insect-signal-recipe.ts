// 该文件用于生成自然昆虫生态信号像素对象 recipe。

import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation";
import { validatePixelObjectRecipe } from "../../pixel-primitives/pixel-object-validator";
import type {
  PixelObjectRecipeResult,
  PixelPartId,
  PixelShapeId,
} from "../../pixel-primitives/pixel-primitive-schema";
import { getPixelSemanticStructure } from "../../pixel-primitives/semantic-structure-library";
import { createPixelBlockBuilder } from "../core/pixel-block-builder";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export function buildNaturalInsectSignalRecipe(): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("natural_insect_signal_block");
  const parts: PixelPartId[] = ["insect_body", "insect_head", "insect_wing", "insect_leg", "insect_antenna", "insect_highlight"];
  const shapes: PixelShapeId[] = ["body_cluster", "wing_chip", "leg_line", "antenna_line", "highlight_chip"];
  const blocks = [
    blockBuilder.block({ primitiveKind: "transparent_block", x: 93, y: 99, width: 15, height: 8, color: PIXEL_PALETTE.wing, opacity: 0.36, layer: "object" }),
    blockBuilder.block({ primitiveKind: "transparent_block", x: 111, y: 99, width: 15, height: 8, color: PIXEL_PALETTE.wing, opacity: 0.36, layer: "object" }),
    blockBuilder.block({ primitiveKind: "square_block", x: 104, y: 103, width: 11, height: 10, color: PIXEL_PALETTE.insect, opacity: 1, layer: "object" }),
    blockBuilder.block({ primitiveKind: "dot_block", x: 107, y: 97, width: 6, height: 6, color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    blockBuilder.block({ primitiveKind: "highlight_block", x: 110, y: 105, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.9, layer: "object" }),
    blockBuilder.block({ primitiveKind: "line_block", x: 97, y: 115, width: 9, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 0.9, layer: "object" }),
    blockBuilder.block({ primitiveKind: "line_block", x: 114, y: 115, width: 9, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 0.9, layer: "object" }),
    blockBuilder.block({ primitiveKind: "line_block", x: 104, y: 94, width: 7, height: 2, color: PIXEL_PALETTE.insectDark, opacity: 0.72, layer: "object" }),
    blockBuilder.block({ primitiveKind: "dot_block", x: 90, y: 92, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.52, layer: "atmosphere" }),
    blockBuilder.block({ primitiveKind: "dot_block", x: 126, y: 93, width: 3, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.42, layer: "atmosphere" }),
  ];
  const draft: DraftPixelObject = {
    kind: "insect",
    label: "昆虫",
    recipeId: "natural_insect_signal_recipe",
    recipeVersion: "procedural-insect-signal",
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
