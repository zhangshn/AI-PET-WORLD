// 该文件提供像素世界场景组合器的正式入口。

import {
  buildDefaultPixelSceneFact,
  buildPixelWorldSceneSvg,
  composePixelWorldScene,
  type PixelSceneWorldFact,
} from "@/world/procedural-painter/scene/scene-composer-test-module";

import type {
  SceneComposerFact,
  SceneCompositionPlan,
} from "./scene-composer-schema";

export function buildDefaultSceneComposerFact(
  input: Partial<SceneComposerFact> = {}
): SceneComposerFact {
  const legacyFact = buildDefaultPixelSceneFact({
    id: input.id,
    biome: input.biome,
    moisture: input.moisture,
    density: input.decorationDensity,
    pathCurve: input.roadShape,
    worldSeed: input.worldSeed,
  });

  return fromLegacyFact(legacyFact);
}

export function composeScene(fact: SceneComposerFact): SceneCompositionPlan {
  const legacyPlan = composePixelWorldScene(toLegacyFact(fact));

  return {
    ...legacyPlan,
    decorationDensity: legacyPlan.density,
    roadShape: fact.roadShape,
  };
}

export function buildSceneSvg(fact: SceneComposerFact): string {
  return buildPixelWorldSceneSvg(toLegacyFact(fact));
}

function toLegacyFact(fact: SceneComposerFact): PixelSceneWorldFact {
  return {
    id: fact.id,
    biome: fact.biome,
    moisture: fact.moisture,
    density: fact.decorationDensity,
    pathCurve: fact.roadShape,
    worldSeed: fact.worldSeed,
  };
}

function fromLegacyFact(fact: PixelSceneWorldFact): SceneComposerFact {
  return {
    id: fact.id,
    biome: fact.biome,
    moisture: fact.moisture,
    decorationDensity: fact.density,
    roadShape: fact.pathCurve,
    worldSeed: fact.worldSeed,
  };
}
