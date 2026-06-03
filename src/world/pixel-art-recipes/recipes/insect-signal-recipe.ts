import { validatePixelObjectRecipe } from "../../pixel-primitives/pixel-object-validator"
import type {
  PixelObjectRecipeResult,
  PixelPartId,
  PixelShapeId,
} from "../../pixel-primitives/pixel-primitive-schema"
import { PIXEL_PALETTE } from "../../pixel-primitives/pixel-style-foundation"
import { getPixelSemanticStructure } from "../../pixel-primitives/semantic-structure-library"
import { createPixelBlockBuilder } from "../core/pixel-block-builder"

type DraftPixelObject = Omit<PixelObjectRecipeResult, "validation">

export type NaturalInsectSignalRecipeInput = {
  sourceObjectId?: string
  x?: number
  y?: number
  scale?: number
}

export function buildNaturalInsectSignalRecipe(
  input: NaturalInsectSignalRecipeInput = {}
): PixelObjectRecipeResult {
  const blockBuilder = createPixelBlockBuilder("natural_insect_signal_block")
  const scale = Math.max(0.6, Math.min(1.5, input.scale ?? 1))
  const centerX = input.x ?? 110
  const centerY = input.y ?? 108
  const localX = (value: number) => Math.round(centerX + (value - 110) * scale)
  const localY = (value: number) => Math.round(centerY + (value - 108) * scale)
  const size = (value: number) => Math.max(1, Math.round(value * scale))
  const parts: PixelPartId[] = [
    "insect_body",
    "insect_head",
    "insect_wing",
    "insect_leg",
    "insect_antenna",
    "insect_highlight",
  ]
  const shapes: PixelShapeId[] = [
    "body_cluster",
    "wing_chip",
    "leg_line",
    "antenna_line",
    "highlight_chip",
  ]
  const blocks = [
    blockBuilder.block({ primitiveKind: "transparent_block", x: localX(93), y: localY(99), width: size(15), height: size(8), color: PIXEL_PALETTE.wing, opacity: 0.36, layer: "object" }),
    blockBuilder.block({ primitiveKind: "transparent_block", x: localX(111), y: localY(99), width: size(15), height: size(8), color: PIXEL_PALETTE.wing, opacity: 0.36, layer: "object" }),
    blockBuilder.block({ primitiveKind: "square_block", x: localX(104), y: localY(103), width: size(11), height: size(10), color: PIXEL_PALETTE.insect, opacity: 1, layer: "object" }),
    blockBuilder.block({ primitiveKind: "dot_block", x: localX(107), y: localY(97), width: size(6), height: size(6), color: PIXEL_PALETTE.insectDark, opacity: 1, layer: "object" }),
    blockBuilder.block({ primitiveKind: "highlight_block", x: localX(110), y: localY(105), width: size(3), height: size(3), color: PIXEL_PALETTE.highlight, opacity: 0.9, layer: "object" }),
    blockBuilder.block({ primitiveKind: "line_block", x: localX(97), y: localY(115), width: size(9), height: size(2), color: PIXEL_PALETTE.insectDark, opacity: 0.9, layer: "object" }),
    blockBuilder.block({ primitiveKind: "line_block", x: localX(114), y: localY(115), width: size(9), height: size(2), color: PIXEL_PALETTE.insectDark, opacity: 0.9, layer: "object" }),
    blockBuilder.block({ primitiveKind: "line_block", x: localX(104), y: localY(94), width: size(7), height: size(2), color: PIXEL_PALETTE.insectDark, opacity: 0.72, layer: "object" }),
    blockBuilder.block({ primitiveKind: "dot_block", x: localX(90), y: localY(92), width: size(3), height: size(3), color: PIXEL_PALETTE.highlight, opacity: 0.52, layer: "atmosphere" }),
    blockBuilder.block({ primitiveKind: "dot_block", x: localX(126), y: localY(93), width: size(3), height: size(3), color: PIXEL_PALETTE.highlight, opacity: 0.42, layer: "atmosphere" }),
  ]
  const draft: DraftPixelObject = {
    kind: "insect",
    label: "insect signal",
    recipeId: "natural_insect_signal_recipe",
    recipeVersion: "procedural-insect-signal",
    semanticStructureId: getPixelSemanticStructure("insect").id,
    anchor: { type: "body_center", x: centerX, y: centerY },
    bounds: resolveBounds(blocks),
    blocks,
    usedPrimitives: Array.from(new Set(blocks.map((item) => item.primitiveKind))),
    usedShapes: shapes,
    usedParts: parts,
  }

  return { ...draft, validation: validatePixelObjectRecipe(draft) }
}

function resolveBounds(
  blocks: Array<{ x: number; y: number; width: number; height: number }>
) {
  const left = Math.min(...blocks.map((block) => block.x))
  const top = Math.min(...blocks.map((block) => block.y))
  const right = Math.max(...blocks.map((block) => block.x + block.width))
  const bottom = Math.max(...blocks.map((block) => block.y + block.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}
