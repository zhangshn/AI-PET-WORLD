// 该文件用于统一导出自然世界高质量像素 recipe。

import { buildPixelObjectRecipe } from "../pixel-object-recipes";
import type { PixelObjectRecipeResult } from "../pixel-primitive-schema";
import { buildNaturalGrassTileQualityRecipe } from "./grass-tile-quality";
import { buildNaturalInsectSignalQualityRecipe } from "./insect-signal-quality";
import { buildNaturalStoneQualityRecipe } from "./stone-quality";

export type NaturalPixelObjectKind = "tree" | "grass_tile" | "stone" | "insect";

export const NATURAL_PIXEL_OBJECT_KINDS: NaturalPixelObjectKind[] = ["tree", "grass_tile", "stone", "insect"];

export function buildNaturalObjectQualityRecipe(kind: NaturalPixelObjectKind): PixelObjectRecipeResult {
  if (kind === "grass_tile") return buildNaturalGrassTileQualityRecipe();
  if (kind === "stone") return buildNaturalStoneQualityRecipe();
  if (kind === "insect") return buildNaturalInsectSignalQualityRecipe();
  return buildPixelObjectRecipe("tree");
}
