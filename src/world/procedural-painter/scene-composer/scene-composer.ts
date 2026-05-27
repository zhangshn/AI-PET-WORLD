// This file provides the formal composition entry for pixel world scenes.

import {
  SCENE_HEIGHT,
  SCENE_TILE_SIZE,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import {
  buildSceneObjects,
  mergeFactAndGeneratedObjects,
} from "./object-composer";
import { clamp } from "./scene-composer-random";
import { buildSceneTiles } from "./terrain-composer";
import {
  buildMovementTraceField,
  buildMovementTraceSamples,
} from "./trace-composer";
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
  traceShape: 58,
  traceDensity: 72,
  worldSeed: "ai_pet_world_scene_composer_seed_001",
  hasTraceFact: true,
  includeActorPlaceholder: true,
};

export function buildDefaultSceneComposerFact(
  input: Partial<SceneComposerFact> = {}
): SceneComposerFact {
  return normalizeSceneComposerFact({
    ...DEFAULT_SCENE_COMPOSER_FACT,
    ...removeUndefinedSceneComposerFields(input),
  });
}

export function composeScene(fact: SceneComposerFact): SceneCompositionPlan {
  const clean = normalizeSceneComposerFact(fact);
  const layoutSeed = `${clean.worldSeed}:${clean.id}:scene-composer-v5:${clean.biome}`;
  const traceSamples = buildMovementTraceSamples(clean);
  const traceField = buildMovementTraceField({
    fact: clean,
    samples: traceSamples,
  });
  const tiles = buildSceneTiles(clean, traceSamples, layoutSeed);
  const grassTufts = buildSceneGrassTufts(clean, tiles, traceSamples, layoutSeed);
  const factObjects = clean.factObjects ?? [];
  const generatedObjects = buildSceneObjects(
    clean,
    tiles,
    traceSamples,
    layoutSeed
  );
  const objects = mergeFactAndGeneratedObjects({
    factObjects,
    generatedObjects,
  });

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    tileSize: SCENE_TILE_SIZE,
    biome: clean.biome,
    moisture: clean.moisture,
    decorationDensity: clean.decorationDensity,
    traceShape: clean.traceShape,
    traceDensity: clean.traceDensity,
    hasTraceFact: clean.hasTraceFact ?? true,
    traceFacts: clean.traceFacts ?? [],
    traceSamples,
    traceField,
    // Deprecated compatibility: retained until legacy debug consumers migrate.
    roadShape: clean.traceShape,
    hasRoadFact: clean.hasTraceFact ?? true,
    tiles,
    grassTufts,
    factObjects,
    generatedObjects,
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
  const traceShape = fact.traceShape ?? fact.roadShape ?? 50;
  const hasTraceFact = fact.hasTraceFact ?? fact.hasRoadFact ?? true;
  const traceDensity = fact.traceDensity ?? fact.decorationDensity;

  return {
    ...fact,
    moisture: clamp(Math.round(fact.moisture), 0, 100),
    decorationDensity: clamp(Math.round(fact.decorationDensity), 0, 100),
    traceShape: clamp(Math.round(traceShape), 0, 100),
    traceDensity: clamp(Math.round(traceDensity), 0, 100),
    hasTraceFact,
    traceFacts: fact.traceFacts ?? [],
    // Deprecated compatibility: legacy callers may still read these fields.
    roadShape: clamp(Math.round(traceShape), 0, 100),
    hasRoadFact: hasTraceFact,
    includeActorPlaceholder: fact.includeActorPlaceholder ?? true,
    factObjects: fact.factObjects ?? [],
  };
}

function removeUndefinedSceneComposerFields(
  input: Partial<SceneComposerFact>
): Partial<SceneComposerFact> {
  const clean: Partial<SceneComposerFact> = {};

  if (input.id !== undefined) {
    clean.id = input.id;
  }

  if (input.biome !== undefined) {
    clean.biome = input.biome;
  }

  if (input.moisture !== undefined) {
    clean.moisture = input.moisture;
  }

  if (input.decorationDensity !== undefined) {
    clean.decorationDensity = input.decorationDensity;
  }

  if (input.traceShape !== undefined) {
    clean.traceShape = input.traceShape;
  }

  if (input.traceDensity !== undefined) {
    clean.traceDensity = input.traceDensity;
  }

  if (input.worldSeed !== undefined) {
    clean.worldSeed = input.worldSeed;
  }

  if (input.hasTraceFact !== undefined) {
    clean.hasTraceFact = input.hasTraceFact;
  }

  if (input.traceFacts !== undefined) {
    clean.traceFacts = input.traceFacts;
  }

  if (input.roadShape !== undefined) {
    clean.roadShape = input.roadShape;
  }

  if (input.hasRoadFact !== undefined) {
    clean.hasRoadFact = input.hasRoadFact;
  }

  if (input.includeActorPlaceholder !== undefined) {
    clean.includeActorPlaceholder = input.includeActorPlaceholder;
  }

  if (input.factObjects !== undefined) {
    clean.factObjects = input.factObjects;
  }

  return clean;
}
