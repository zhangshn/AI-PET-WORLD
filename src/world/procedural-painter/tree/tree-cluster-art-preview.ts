// 该文件用于让树木 Debug 单体预览复用场景组合中的原始树木算法。

import { buildScenePalette } from "../scene-composer/scene-composer-palette";
import {
  renderSceneComposerTreeObject,
  renderSceneComposerTreeShadow,
} from "../scene-composer/scene-composer-tree-recipe";
import type { SceneObject, SceneObjectGrowthStage } from "../scene-composer/scene-composer-schema";
import type { PixelTreeWorldFact } from "./tree-render-test-module";

export function buildPixelClusterTreeSvg(fact: PixelTreeWorldFact): string {
  const clean = normalizeFact(fact);
  const palette = buildScenePalette(clean.biome, clean.moisture);
  const tree = buildSceneTreeObject(clean);
  const label = `${clean.biome} ${tree.growthStage}/h${clean.health}/m${clean.moisture}/a${clean.age}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" shape-rendering="crispEdges" role="img" aria-label="single pixel tree preview" data-visual-scope="tree_only" data-tree-algorithm="scene_composer_tree_recipe">`,
    `<rect x="0" y="0" width="320" height="320" fill="${palette.bg}"/>`,
    `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeText(label)}</text>`,
    renderSceneComposerTreeShadow(tree, palette),
    renderSceneComposerTreeObject(tree, palette),
    `</svg>`,
  ].join("\n");
}

function buildSceneTreeObject(fact: PixelTreeWorldFact): SceneObject {
  return {
    id: fact.id,
    kind: "tree",
    x: 160,
    y: 250,
    scale: resolveScale(fact),
    layer: "middle",
    health: fact.health,
    age: fact.age,
    ecologyRole: "canopy",
    moistureAffinity: fact.moisture,
    traceSensitivity: 40,
    ecologyHealth: fact.health,
    growthStage: resolveGrowthStage(fact),
    stressLevel: Math.max(0, 100 - fact.health),
  };
}

function resolveGrowthStage(fact: PixelTreeWorldFact): SceneObjectGrowthStage {
  if (fact.health <= 28) return "declining";
  if (fact.growth <= 18) return "sprout";
  if (fact.growth <= 62) return "young";
  if (fact.age >= 96) return "old";
  return "mature";
}

function resolveScale(fact: PixelTreeWorldFact): number {
  const growthScale = fact.growth <= 18 ? 0.62 : fact.growth <= 62 ? 0.86 : 1;
  const ageScale = 0.92 + Math.min(0.22, fact.age / 520);
  return Math.max(0.42, Math.min(1.28, growthScale * ageScale));
}

function normalizeFact(fact: PixelTreeWorldFact): PixelTreeWorldFact {
  return {
    ...fact,
    growth: clamp(Math.round(fact.growth), 0, 100),
    health: clamp(Math.round(fact.health), 0, 100),
    moisture: clamp(Math.round(fact.moisture), 0, 100),
    age: clamp(Math.round(fact.age), 0, 300),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
