// 该文件用于生成自然草地 Tile 的高质量像素 recipe。

import { PIXEL_PALETTE } from "../pixel-style-foundation";
import { validatePixelObjectRecipe } from "../pixel-object-validator";
import { getPixelSemanticStructure } from "../semantic-structure-library";
import type { PixelBlock, PixelObjectRecipeResult, PixelPartId, PixelShapeId } from "../pixel-primitive-schema";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;
type BlockInput = Omit<PixelBlock, "id">;

let blockCounter = 0;

export function buildNaturalGrassTileQualityRecipe(): PixelObjectRecipeResult {
  blockCounter = 0;
  const parts: PixelPartId[] = ["ground_base", "grass_detail", "soil_detail", "pressed_detail", "worn_detail"];
  const shapes: PixelShapeId[] = ["grass_chip", "soil_chip", "pressed_mark", "worn_strip"];
  const blocks = [
    b({ primitiveKind: "square_block", x: 62, y: 62, width: 88, height: 88, color: PIXEL_PALETTE.grassBase, opacity: 1, layer: "ground" }),
    b({ primitiveKind: "square_block", x: 62, y: 62, width: 26, height: 22, color: PIXEL_PALETTE.grassDark, opacity: 0.18, layer: "ground" }),
    b({ primitiveKind: "square_block", x: 112, y: 62, width: 38, height: 24, color: PIXEL_PALETTE.grassLight, opacity: 0.11, layer: "ground" }),
    b({ primitiveKind: "square_block", x: 62, y: 118, width: 22, height: 32, color: PIXEL_PALETTE.grassLight, opacity: 0.12, layer: "ground" }),
    b({ primitiveKind: "wide_block", x: 78, y: 103, width: 55, height: 6, color: PIXEL_PALETTE.grassDark, opacity: 0.38, layer: "trace" }),
    b({ primitiveKind: "wide_block", x: 92, y: 118, width: 36, height: 5, color: PIXEL_PALETTE.soil, opacity: 0.32, layer: "trace" }),
    b({ primitiveKind: "wide_block", x: 94, y: 126, width: 28, height: 4, color: PIXEL_PALETTE.soilDark, opacity: 0.24, layer: "trace" }),
    ...grassBladeCluster(72, 74),
    ...grassBladeCluster(122, 82),
    ...grassBladeCluster(82, 128),
    ...groundNoise(),
  ];
  const draft: DraftPixelObject = {
    kind: "grass_tile",
    label: "草地 Tile",
    recipeId: "natural_grass_tile_quality_recipe_v1",
    recipeVersion: "1.1.0",
    goldenAlgorithm: "formal_ground_recipe_v1",
    semanticStructureId: getPixelSemanticStructure("grass_tile").id,
    anchor: { type: "tile_origin", x: 62, y: 62 },
    bounds: { x: 62, y: 62, width: 88, height: 88 },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };
  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function grassBladeCluster(startX: number, startY: number): PixelBlock[] {
  return [
    b({ primitiveKind: "tall_block", x: startX, y: startY + 8, width: 3, height: 16, color: PIXEL_PALETTE.grassLight, opacity: 0.82, layer: "ground" }),
    b({ primitiveKind: "tall_block", x: startX + 10, y: startY, width: 3, height: 22, color: PIXEL_PALETTE.grassDark, opacity: 0.78, layer: "ground" }),
    b({ primitiveKind: "tall_block", x: startX + 20, y: startY + 14, width: 3, height: 12, color: PIXEL_PALETTE.grassLight, opacity: 0.76, layer: "ground" }),
  ];
}

function groundNoise(): PixelBlock[] {
  const positions = [
    [74, 92, PIXEL_PALETTE.grassLight],
    [96, 78, PIXEL_PALETTE.grassDark],
    [134, 94, PIXEL_PALETTE.grassLight],
    [82, 136, PIXEL_PALETTE.grassDark],
    [116, 141, PIXEL_PALETTE.grassLight],
    [105, 92, PIXEL_PALETTE.soil],
  ] as const;
  return positions.map(([x, y, color]) => b({ primitiveKind: "noise_block", x, y, width: 3, height: 3, color, opacity: 0.62, layer: "ground" }));
}

function b(input: BlockInput): PixelBlock {
  blockCounter += 1;
  return { id: `natural_grass_tile_block_${blockCounter}`, ...input };
}
