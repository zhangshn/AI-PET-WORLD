import {
  buildDefaultSceneComposerFact,
  composeScene,
} from "@/world/procedural-painter/scene-composer/scene-composer";
import { renderScenePlanToSvg } from "@/world/procedural-painter/scene-composer/scene-svg-renderer";
import type {
  SceneComposerBiome,
  SceneCompositionPlan,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema";

export type PixelSceneBiome = SceneComposerBiome;

export type PixelSceneWorldFact = {
  id: string;
  biome: PixelSceneBiome;
  moisture: number;
  density: number;
  pathCurve: number;
  worldSeed: string;
};

export type PixelSceneCompositionPlan = Omit<
  SceneCompositionPlan,
  "decorationDensity" | "roadShape"
> & {
  density: number;
};

export function buildDefaultPixelSceneFact(
  input: Partial<PixelSceneWorldFact> = {}
): PixelSceneWorldFact {
  const fact = buildDefaultSceneComposerFact({
    id: input.id,
    biome: input.biome,
    moisture: input.moisture,
    decorationDensity: input.density,
    roadShape: input.pathCurve,
    worldSeed: input.worldSeed,
  });

  return fromSceneComposerFact(fact);
}

export function composePixelWorldScene(
  fact: PixelSceneWorldFact
): PixelSceneCompositionPlan {
  const plan = composeScene(toSceneComposerFact(fact));

  return {
    ...plan,
    density: plan.decorationDensity,
  };
}

export function buildPixelWorldSceneSvg(fact: PixelSceneWorldFact): string {
  return renderScenePlanToSvg(composeScene(toSceneComposerFact(fact)));
}

function toSceneComposerFact(fact: PixelSceneWorldFact) {
  return {
    id: fact.id,
    biome: fact.biome,
    moisture: fact.moisture,
    decorationDensity: fact.density,
    roadShape: fact.pathCurve,
    worldSeed: fact.worldSeed,
  };
}

function fromSceneComposerFact(
  fact: ReturnType<typeof buildDefaultSceneComposerFact>
): PixelSceneWorldFact {
  return {
    id: fact.id,
    biome: fact.biome,
    moisture: fact.moisture,
    density: fact.decorationDensity,
    pathCurve: fact.roadShape,
    worldSeed: fact.worldSeed,
  };
}
