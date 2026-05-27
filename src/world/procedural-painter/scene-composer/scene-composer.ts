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
  const tiles = buildSceneTiles(clean, traceSamples, layoutSeed, traceField);
  const grassTuftResult = buildSceneGrassTufts(
    clean,
    tiles,
    traceSamples,
    layoutSeed,
    traceField
  );
  const grassTufts = grassTuftResult.grassTufts;
  const factObjects = clean.factObjects ?? [];
  const generatedObjectResult = buildSceneObjects(
    clean,
    tiles,
    traceSamples,
    layoutSeed,
    traceField
  );
  const generatedObjects = generatedObjectResult.generatedObjects;
  const objects = mergeFactAndGeneratedObjects({
    factObjects,
    generatedObjects,
  });
  const longUsedAreaTiles = tiles.filter((tile) => tile.kind === "path").length;
  const traceEdgeTiles = tiles.filter((tile) => tile.kind === "edge").length;
  const pressedGrassTiles = tiles.filter(
    (tile) => tile.visualKind === "pressed_grass"
  ).length;
  const wornGrassTiles = tiles.filter(
    (tile) => tile.visualKind === "worn_grass"
  ).length;
  const exposedSoilTiles = tiles.filter(
    (tile) => tile.visualKind === "exposed_soil"
  ).length;
  const ecologyTransitionTiles = tiles.filter(
    (tile) => tile.visualKind === "ecology_transition"
  ).length;
  const recoveryGrowthTiles = tiles.filter(
    (tile) => tile.visualKind === "recovery_growth"
  ).length;

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    tileSize: SCENE_TILE_SIZE,
    biome: clean.biome,
    moisture: clean.moisture,
    decorationDensity: clean.decorationDensity,
    traceShape: clean.traceShape,
    traceDensity: clean.traceDensity,
    hasTraceFact: traceField.hasTraceFact,
    traceFacts: clean.traceFacts ?? [],
    traceSamples,
    traceField,
    // Deprecated compatibility: retained until legacy debug consumers migrate.
    roadShape: clean.traceShape,
    hasRoadFact: traceField.hasTraceFact,
    tiles,
    grassTufts,
    factObjects,
    generatedObjects,
    objects,
    summary: {
      grassTiles: tiles.filter((tile) => tile.kind === "grass").length,
      longUsedAreaTiles,
      traceEdgeTiles,
      // Deprecated compatibility: legacy visual tile summary names.
      pathTiles: longUsedAreaTiles,
      edgeTiles: traceEdgeTiles,
      traceInfluencedTiles: traceField.influencedTiles ?? 0,
      movementInfluencedTiles: traceField.movementInfluencedTiles ?? 0,
      spatialUseInfluencedTiles: traceField.spatialUseInfluencedTiles ?? 0,
      ecologyInfluencedTiles: traceField.ecologyInfluencedTiles ?? 0,
      traceSuppressedGrassTufts: grassTuftResult.traceSuppressedGrassTufts,
      traceAvoidedGeneratedObjects:
        generatedObjectResult.traceAvoidedGeneratedObjects,
      pressedGrassTiles,
      wornGrassTiles,
      exposedSoilTiles,
      ecologyTransitionTiles,
      recoveryGrowthTiles,
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
