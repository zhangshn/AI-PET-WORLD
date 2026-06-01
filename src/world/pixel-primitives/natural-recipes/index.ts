// 该文件用于统一导出自然世界高质量像素 recipe。

import type { PixelObjectRecipeResult } from "../pixel-primitive-schema";
import { buildNaturalGrassTileRecipe } from "../../pixel-art-recipes/recipes/grass-tile-recipe";
import { buildNaturalInsectSignalRecipe } from "../../pixel-art-recipes/recipes/insect-signal-recipe";
import { buildNaturalStoneObjectRecipe } from "../../pixel-art-recipes/recipes/stone-object-recipe";
import { buildNaturalTreeObjectRecipe } from "../../pixel-art-recipes/recipes/tree-object-recipe";

export type NaturalPixelObjectKind = "tree" | "grass_tile" | "stone" | "insect";

export const NATURAL_PIXEL_OBJECT_KINDS: NaturalPixelObjectKind[] = ["tree", "grass_tile", "stone", "insect"];

export function buildNaturalObjectRecipe(kind: NaturalPixelObjectKind): PixelObjectRecipeResult {
  if (kind === "tree") return buildNaturalTreeObjectRecipe();
  if (kind === "grass_tile") return buildNaturalGrassTileRecipe();
  if (kind === "stone") return buildNaturalStoneObjectRecipe();
  if (kind === "insect") return buildNaturalInsectSignalRecipe();
  return buildNaturalTreeObjectRecipe();
}
