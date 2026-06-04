// Builds the stable natural stone pixel object recipe used by VisualGeneration.
import { validatePixelObjectRecipe } from "../../pixel-primitives/pixel-object-validator";
import type {
  PixelObjectRecipeResult,
  PixelPartId,
  PixelShapeId,
} from "../../pixel-primitives/pixel-primitive-schema";
import { getPixelSemanticStructure } from "../../pixel-primitives/semantic-structure-library";
import { createPixelBlockBuilder } from "../core/pixel-block-builder";
import { quantizeGridToPixelBlocks } from "../core/quantize-grid";
import { buildContactShadowBlocks } from "../filters/contact-shadow-filter";
import { applyShapeNoiseFilter } from "../filters/shape-noise-filter";
import {
  applyStoneCrackField,
  applyStoneHighlightField,
  applyStoneTextureField,
} from "./stone-object/stone-object-details";
import {
  applyStoneEnvironmentTintField,
  buildStoneEnvironmentBlendBlocks,
} from "./stone-object/stone-object-environment";
import { applyStoneLightingField } from "./stone-object/stone-object-lighting";
import {
  buildStoneGridFromMask,
  generateStoneSilhouetteMask,
  stabilizeStoneBase,
} from "./stone-object/stone-object-shape";
import {
  resolveStoneColor,
  resolveStoneLayer,
  resolveStoneOpacity,
  resolveStonePrimitive,
} from "./stone-object/stone-object-style";
import { STONE_OBJECT_TEMPLATE } from "./stone-object/stone-object-template";
import type { StoneTemplate } from "./stone-object/stone-object-types";

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">;

export type NaturalStoneObjectRecipeInput = {
  sourceObjectId?: string;
  x?: number;
  y?: number;
  scale?: number;
  deterministicKey?: string;
};

export function buildNaturalStoneObjectRecipe(
  input: NaturalStoneObjectRecipeInput = {}
): PixelObjectRecipeResult {
  const template = buildStoneTemplate(input);
  const blockBuilder = createPixelBlockBuilder("stone_object_block");

  const rawMask = generateStoneSilhouetteMask(template);
  const shapedMask = stabilizeStoneBase(
    applyShapeNoiseFilter(rawMask, {
      seed: template.seed,
    }),
    template
  );
  const baseGrid = buildStoneGridFromMask(shapedMask);
  const litGrid = applyStoneLightingField(baseGrid, template);
  const texturedGrid = applyStoneTextureField(litGrid, template);
  const crackedGrid = applyStoneCrackField(texturedGrid, template);
  const highlightedGrid = applyStoneHighlightField(crackedGrid, template);
  const environmentGrid = applyStoneEnvironmentTintField(highlightedGrid, template);

  const blocks = [
    ...buildContactShadowBlocks({
      grid: environmentGrid,
      originX: template.originX,
      originY: template.originY,
      cellSize: template.cellSize,
      blockBuilder,
    }),
    ...quantizeGridToPixelBlocks({
      grid: environmentGrid,
      originX: template.originX,
      originY: template.originY,
      cellSize: template.cellSize,
      blockBuilder,
      resolveColor: (tone) => resolveStoneColor(tone, template),
      resolveOpacity: resolveStoneOpacity,
      resolveLayer: resolveStoneLayer,
      resolvePrimitive: resolveStonePrimitive,
    }),
    ...buildStoneEnvironmentBlendBlocks(environmentGrid, template, blockBuilder),
  ];

  const parts: PixelPartId[] = [
    "stone_shadow",
    "stone_body",
    "stone_dark_edge",
    "stone_highlight",
  ];

  const shapes: PixelShapeId[] = [
    "stone_cluster",
    "shadow_patch",
    "highlight_chip",
    "soil_chip",
    "grass_chip",
  ];

  const draft: DraftPixelObject = {
    kind: "stone",
    label: "stone",
    recipeId: "natural_stone_object_recipe",
    recipeVersion: "asset-grid-quality-pass",
    semanticStructureId: getPixelSemanticStructure("stone").id,
    anchor: {
      type: "center_bottom",
      x: template.originX + Math.round((template.gridWidth * template.cellSize) / 2),
      y: template.originY + template.gridHeight * template.cellSize,
    },
    bounds: {
      x: template.originX,
      y: template.originY,
      width: template.gridWidth * template.cellSize,
      height: template.gridHeight * template.cellSize,
    },
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  };

  return {
    ...draft,
    validation: validatePixelObjectRecipe(draft),
  };
}

function buildStoneTemplate(input: NaturalStoneObjectRecipeInput): StoneTemplate {
  const scale = Math.max(0.5, Math.min(1.6, input.scale ?? 1));
  const cellSize = Math.max(1, Math.round(STONE_OBJECT_TEMPLATE.cellSize * scale));
  const width = STONE_OBJECT_TEMPLATE.gridWidth * cellSize;
  const height = STONE_OBJECT_TEMPLATE.gridHeight * cellSize;
  const originX =
    input.x === undefined
      ? STONE_OBJECT_TEMPLATE.originX
      : Math.round(input.x - width / 2);
  const originY =
    input.y === undefined
      ? STONE_OBJECT_TEMPLATE.originY
      : Math.round(input.y - height);

  return {
    ...STONE_OBJECT_TEMPLATE,
    seed: input.deterministicKey ?? STONE_OBJECT_TEMPLATE.seed,
    originX,
    originY,
    cellSize,
  };
}
