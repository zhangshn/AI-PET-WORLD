// 该文件用于测试 V3 程序化像素美术石头 recipe。

import { PIXEL_PALETTE } from "../pixel-style-foundation";
import { validatePixelObjectRecipe } from "../pixel-object-validator";
import { getPixelSemanticStructure } from "../semantic-structure-library";
import type { PixelBlock, PixelObjectRecipeResult, PixelPartId, PixelShapeId } from "../pixel-primitive-schema";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;
type BlockInput = Omit<PixelBlock, "id">;

let blockCounter = 0;

export function buildNaturalStoneV3Recipe(): PixelObjectRecipeResult {
  blockCounter = 0;

  const parts: PixelPartId[] = ["stone_shadow", "stone_body", "stone_dark_edge", "stone_highlight"];
  const shapes: PixelShapeId[] = ["stone_cluster", "shadow_patch", "highlight_chip", "soil_chip", "grass_chip"];
  const blocks = [
    ...contactAo(),
    ...silhouetteBody(),
    ...shapeFilterEdgeNoise(),
    ...volumePlanes(),
    ...textureFilterDithering(),
    ...cracksAndHighlights(),
    ...environmentFilterBleeding(),
  ];

  const draft: DraftPixelObject = {
    kind: "stone",
    label: "V3 石头",
    recipeId: "natural_stone_v3_procedural_art_recipe",
    recipeVersion: "3.0.0-experiment",
    semanticStructureId: getPixelSemanticStructure("stone").id,
    anchor: { type: "center_bottom", x: 110, y: 143 },
    bounds: { x: 78, y: 92, width: 64, height: 54 },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function contactAo(): PixelBlock[] {
  return [
    b({ primitiveKind: "shadow_block", x: 74, y: 140, width: 74, height: 11, color: PIXEL_PALETTE.shadow, opacity: 0.38, layer: "shadow" }),
    b({ primitiveKind: "shadow_block", x: 88, y: 136, width: 48, height: 7, color: PIXEL_PALETTE.shadow, opacity: 0.26, layer: "shadow" }),
  ];
}

function silhouetteBody(): PixelBlock[] {
  return [
    b({ primitiveKind: "wide_block", x: 92, y: 92, width: 38, height: 8, color: PIXEL_PALETTE.stoneLight, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 86, y: 100, width: 52, height: 10, color: PIXEL_PALETTE.stone, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 80, y: 110, width: 62, height: 12, color: PIXEL_PALETTE.stone, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 78, y: 122, width: 60, height: 12, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 84, y: 134, width: 48, height: 9, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
  ];
}

function shapeFilterEdgeNoise(): PixelBlock[] {
  return [
    b({ primitiveKind: "square_block", x: 78, y: 104, width: 8, height: 8, color: PIXEL_PALETTE.canvas, opacity: 1, layer: "object" }),
    b({ primitiveKind: "square_block", x: 134, y: 98, width: 7, height: 8, color: PIXEL_PALETTE.canvas, opacity: 1, layer: "object" }),
    b({ primitiveKind: "square_block", x: 138, y: 126, width: 5, height: 7, color: PIXEL_PALETTE.canvas, opacity: 1, layer: "object" }),
    b({ primitiveKind: "square_block", x: 82, y: 135, width: 7, height: 5, color: PIXEL_PALETTE.canvas, opacity: 1, layer: "object" }),
    b({ primitiveKind: "dark_block", x: 82, y: 111, width: 7, height: 5, color: PIXEL_PALETTE.stoneDark, opacity: 0.92, layer: "object" }),
    b({ primitiveKind: "dark_block", x: 132, y: 112, width: 7, height: 16, color: PIXEL_PALETTE.stoneDark, opacity: 1, layer: "object" }),
  ];
}

function volumePlanes(): PixelBlock[] {
  return [
    b({ primitiveKind: "wide_block", x: 94, y: 97, width: 26, height: 5, color: PIXEL_PALETTE.stoneLight, opacity: 1, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 88, y: 107, width: 28, height: 11, color: PIXEL_PALETTE.stoneLight, opacity: 0.74, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 116, y: 103, width: 20, height: 15, color: PIXEL_PALETTE.stoneDark, opacity: 0.72, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 94, y: 120, width: 32, height: 12, color: PIXEL_PALETTE.stone, opacity: 0.88, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 122, y: 120, width: 17, height: 15, color: PIXEL_PALETTE.stoneDark, opacity: 0.9, layer: "object" }),
    b({ primitiveKind: "wide_block", x: 88, y: 128, width: 25, height: 12, color: PIXEL_PALETTE.stoneDark, opacity: 0.76, layer: "object" }),
  ];
}

function textureFilterDithering(): PixelBlock[] {
  const dots = [
    [115, 106, PIXEL_PALETTE.stoneLight], [121, 109, PIXEL_PALETTE.stone], [111, 119, PIXEL_PALETTE.stoneDark],
    [98, 118, PIXEL_PALETTE.stoneLight], [104, 123, PIXEL_PALETTE.stoneDark], [128, 118, PIXEL_PALETTE.stone],
    [91, 129, PIXEL_PALETTE.stone], [118, 133, PIXEL_PALETTE.stoneLight], [132, 131, PIXEL_PALETTE.stone],
  ] as const;
  return dots.map(([x, y, color]) => b({ primitiveKind: "dot_block", x, y, width: 3, height: 3, color, opacity: 0.72, layer: "object" }));
}

function cracksAndHighlights(): PixelBlock[] {
  return [
    b({ primitiveKind: "line_block", x: 104, y: 106, width: 18, height: 2, color: PIXEL_PALETTE.stoneDark, opacity: 0.82, layer: "object" }),
    b({ primitiveKind: "line_block", x: 113, y: 108, width: 3, height: 14, color: PIXEL_PALETTE.stoneDark, opacity: 0.76, layer: "object" }),
    b({ primitiveKind: "line_block", x: 91, y: 122, width: 14, height: 2, color: PIXEL_PALETTE.stoneDark, opacity: 0.72, layer: "object" }),
    b({ primitiveKind: "line_block", x: 128, y: 116, width: 9, height: 2, color: PIXEL_PALETTE.shadow, opacity: 0.55, layer: "object" }),
    b({ primitiveKind: "highlight_block", x: 96, y: 96, width: 19, height: 3, color: PIXEL_PALETTE.highlight, opacity: 0.68, layer: "object" }),
    b({ primitiveKind: "highlight_block", x: 87, y: 113, width: 12, height: 3, color: PIXEL_PALETTE.stoneLight, opacity: 0.72, layer: "object" }),
    b({ primitiveKind: "highlight_block", x: 119, y: 124, width: 10, height: 3, color: PIXEL_PALETTE.stoneLight, opacity: 0.56, layer: "object" }),
  ];
}

function environmentFilterBleeding(): PixelBlock[] {
  return [
    b({ primitiveKind: "noise_block", x: 82, y: 140, width: 4, height: 4, color: PIXEL_PALETTE.grassDark, opacity: 0.74, layer: "foreground" }),
    b({ primitiveKind: "tall_block", x: 92, y: 133, width: 3, height: 16, color: PIXEL_PALETTE.grassLight, opacity: 0.78, layer: "foreground" }),
    b({ primitiveKind: "tall_block", x: 132, y: 130, width: 3, height: 18, color: PIXEL_PALETTE.grassLight, opacity: 0.72, layer: "foreground" }),
    b({ primitiveKind: "noise_block", x: 114, y: 139, width: 4, height: 4, color: PIXEL_PALETTE.grassBase, opacity: 0.52, layer: "foreground" }),
  ];
}

function b(input: BlockInput): PixelBlock {
  blockCounter += 1;
  return { id: `stone_v3_block_${blockCounter}`, ...input };
}
