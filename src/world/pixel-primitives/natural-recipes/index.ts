// 该文件用于统一导出自然世界高质量像素 recipe。

import { buildPixelObjectRecipe } from "../pixel-object-recipes";
import type { PixelObjectRecipeResult } from "../pixel-primitive-schema";
import { buildNaturalGrassTileRecipe } from "../../pixel-art-recipes/recipes/grass-tile-recipe";
import { buildNaturalInsectSignalRecipe } from "../../pixel-art-recipes/recipes/insect-signal-recipe";
import { buildNaturalStoneObjectRecipe } from "../../pixel-art-recipes/recipes/stone-object-recipe";

export type NaturalPixelObjectKind = "tree" | "grass_tile" | "stone" | "insect";

export const NATURAL_PIXEL_OBJECT_KINDS: NaturalPixelObjectKind[] = ["tree", "grass_tile", "stone", "insect"];

export function buildNaturalObjectQualityRecipe(kind: NaturalPixelObjectKind): PixelObjectRecipeResult {
  if (kind === "grass_tile") return buildNaturalGrassTileRecipe();
  if (kind === "stone") return buildNaturalStoneObjectRecipe();
  if (kind === "insect") return buildNaturalInsectSignalRecipe();
  return buildPixelObjectRecipe("tree");
}
