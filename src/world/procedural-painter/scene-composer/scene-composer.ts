import {
  SCENE_HEIGHT,
  SCENE_TILE_SIZE,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import { buildSceneObjects } from "./object-composer";
import { buildRoadSamples } from "./road-composer";
import { clamp } from "./scene-composer-random";
import { buildSceneTiles } from "./terrain-composer";
import { buildSceneGrassTufts } from "./vegetation-composer";
import type {
  SceneComposerFact,
  SceneCompositionPlan,
} from "./scene-composer-schema";

const DEFAULT_SCENE_COMPOSER_FACT: SceneComposerFact = {
  id: "pixel_scene_composer_preview",
  biome: "forest",
  moisture: 74,
  decorationDensity: 72,
  roadShape: 58,
  worldSeed: "ai_pet_world_scene_composer_seed_001",
};

export function buildDefaultSceneComposerFact(
  input: Partial<SceneComposerFact> = {}
): SceneComposerFact {
  return normalizeSceneComposerFact({
    ...DEFAULT_SCENE_COMPOSER_FACT,
    ...input,
  });
}

export function composeScene(fact: SceneComposerFact): SceneCompositionPlan {
  const clean = normalizeSceneComposerFact(fact);
  const layoutSeed = `${clean.worldSeed}:${clean.id}:scene-composer-v5:${clean.biome}`;
  const pathSamples = buildRoadSamples(clean);
  const tiles = buildSceneTiles(clean, pathSamples, layoutSeed);
  const grassTufts = buildSceneGrassTufts(clean, tiles, pathSamples, layoutSeed);
  const objects = buildSceneObjects(clean, tiles, pathSamples, layoutSeed);

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    tileSize: SCENE_TILE_SIZE,
    biome: clean.biome,
    moisture: clean.moisture,
    decorationDensity: clean.decorationDensity,
    roadShape: clean.roadShape,
    tiles,
    grassTufts,
    objects,
    summary: {
      grassTiles: tiles.filter((tile) => tile.kind === "grass").length,
      pathTiles: tiles.filter((tile) => tile.kind === "path").length,
      edgeTiles: tiles.filter((tile) => tile.kind === "edge").length,
      grassTufts: grassTufts.length,
      trees: objects.filter((object) => object.kind === "tree").length,
      bushes: objects.filter((object) => object.kind === "bush").length,
      stones: objects.filter((object) => object.kind === "stone").length,
      flowers: objects.filter((object) => object.kind === "flower").length,
    },
  };
}

export function normalizeSceneComposerFact(
  fact: SceneComposerFact
): SceneComposerFact {
  return {
    ...fact,
    moisture: clamp(Math.round(fact.moisture), 0, 100),
    decorationDensity: clamp(Math.round(fact.decorationDensity), 0, 100),
    roadShape: clamp(Math.round(fact.roadShape), 0, 100),
  };
}
