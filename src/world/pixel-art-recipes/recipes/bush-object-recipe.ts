// Builds the stable natural bush pixel object recipe used by VisualGeneration.

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
import { createPixelBlockBuilder, type PixelBlockBuilder } from "../core/pixel-block-builder";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export type NaturalBushObjectRecipeInput = {
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

export function buildNaturalBushObjectRecipe(
  input: NaturalBushObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("bush_object_block");
  const scale = clamp(input.scale ?? 1, 0.5, 1.5);
  const centerX = Math.round(input.x ?? 104);
  const baseY = Math.round(input.y ?? 136);
  const health = clamp(input.health ?? 80, 0, 100);
  const stressLevel = clamp(input.stressLevel ?? 0, 0, 100);
  const heightScale = input.growthStage === "young" || input.growthStage === "sprout" ? 0.82 : 1;
  const healthScale = 0.86 + (health / 100) * 0.18;
  const finalScale = scale * heightScale * healthScale;

  const blocks: PixelBlock[] = [
    blockBuilder.block({
      primitiveKind: "shadow_block",
      x: Math.round(centerX - 36 * finalScale),
      y: Math.round(baseY - 4 * finalScale),
      width: Math.max(16, Math.round(72 * finalScale)),
      height: Math.max(4, Math.round(10 * finalScale)),
      color: PIXEL_PALETTE.shadow,
      opacity: 0.24 + (health / 100) * 0.12,
      layer: "shadow",
    }),
    ...leafCluster({
      blockBuilder,
      cx: centerX + Math.round(2 * finalScale),
      cy: baseY - Math.round(24 * finalScale),
      scale: finalScale * 0.78,
      color: PIXEL_PALETTE.leafDark,
      rows: [3, 7, 12, 13, 8, 3],
    }),
    ...leafCluster({
      blockBuilder,
      cx: centerX - Math.round(13 * finalScale),
      cy: baseY - Math.round(18 * finalScale),
      scale: finalScale * 0.64,
      color: PIXEL_PALETTE.leaf,
      rows: [3, 8, 11, 8, 3],
    }),
    ...leafCluster({
      blockBuilder,
      cx: centerX + Math.round(15 * finalScale),
      cy: baseY - Math.round(19 * finalScale),
      scale: finalScale * 0.62,
      color: PIXEL_PALETTE.leaf,
      rows: [3, 8, 10, 7, 3],
    }),
  ];

  if (stressLevel < 70) {
    blocks.push(
      blockBuilder.block({
        primitiveKind: "highlight_block",
        x: Math.round(centerX - 8 * finalScale),
        y: Math.round(baseY - 33 * finalScale),
        width: Math.max(4, Math.round(10 * finalScale)),
        height: Math.max(2, Math.round(4 * finalScale)),
        color: PIXEL_PALETTE.leafLight,
        opacity: 0.7 + ((70 - stressLevel) / 70) * 0.22,
        layer: "object",
      })
    );
  }

  const parts: PixelPartId[] = ["bush_shadow", "bush_dark", "bush_main", "bush_highlight"];
  const shapes: PixelShapeId[] = ["shadow_patch", "leaf_cluster", "leaf_row", "highlight_chip"];
  const draft: DraftPixelObject = {
    kind: "bush",
    label: "灌木",
    recipeId: "natural_bush_object_recipe",
    recipeVersion: "scene-composer-bush-recipe",
    goldenAlgorithm: "scene_composer_bush_recipe",
    semanticStructureId: getPixelSemanticStructure("bush").id,
    anchor: { type: "center_bottom", x: centerX, y: baseY },
    bounds: resolveBounds(blocks),
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return { ...draft, validation: validatePixelObjectRecipe(draft) };
}

function leafCluster(input: {
  blockBuilder: PixelBlockBuilder;
  cx: number;
  cy: number;
  scale: number;
  color: string;
  rows: number[];
}): PixelBlock[] {
  const rowHeight = Math.max(3, Math.round(4 * input.scale));
  const topY = Math.round(input.cy - (input.rows.length * rowHeight) / 2);

  return input.rows.map((row, index) => {
    const width = Math.max(6, Math.round(row * 3 * input.scale));
    const x = Math.round(input.cx - width / 2 + (index % 3) * 2 * input.scale);
    const y = topY + index * rowHeight;

    return input.blockBuilder.block({
      primitiveKind: "wide_block",
      x,
      y,
      width,
      height: rowHeight,
      color: input.color,
      opacity: 1,
      layer: "object",
    });
  });
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
