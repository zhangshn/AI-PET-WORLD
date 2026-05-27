import {
  SCENE_COLUMNS,
  SCENE_HEIGHT,
  SCENE_ROWS,
  SCENE_TILE_SIZE,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import { buildRoadSamples } from "./road-composer";
import { clamp, stableUnit } from "./scene-composer-random";
import type {
  SceneComposerFact,
  SceneTraceFact,
  SceneTraceField,
  SceneTraceSample,
} from "./scene-composer-schema";

export type SceneTraceInfluenceField = SceneTraceField & {
  influenceAt: (x: number, y: number) => number;
};

export type BuildTraceSamplesInput = {
  width: number;
  height: number;
  traceShape: number;
  traceDensity: number;
  traceFacts: SceneTraceFact[];
  worldSeed: string;
  biome: SceneComposerFact["biome"];
};

export function buildTraceSamples(
  input: BuildTraceSamplesInput
): SceneTraceSample[] {
  if (input.traceFacts.length > 0) {
    return buildTraceFactSamples(input);
  }

  // Deprecated compatibility fallback: this reuses the legacy visual sample
  // builder only when no formal trace facts are available.
  return buildRoadSamples({
    id: "trace_fallback",
    biome: input.biome,
    moisture: 50,
    decorationDensity: input.traceDensity,
    traceShape: input.traceShape,
    traceDensity: input.traceDensity,
    worldSeed: input.worldSeed,
    hasTraceFact: input.traceDensity > 0,
    traceFacts: [],
    roadShape: input.traceShape,
  });
}

export function buildTraceInfluenceField(
  input: BuildTraceSamplesInput
): SceneTraceInfluenceField {
  const samples = buildTraceSamples(input);
  const influences = buildTileInfluences(input, samples);

  return {
    kind: "movement",
    traceShape: input.traceShape,
    traceDensity: input.traceDensity,
    hasTraceFact: input.traceFacts.length > 0 || input.traceDensity > 0,
    facts: input.traceFacts,
    samples,
    averageInfluence: average(influences),
    maxInfluence: influences.length > 0 ? Math.max(...influences) : 0,
    influencedTiles: influences.filter((influence) => influence >= 24).length,
    influenceAt: (x, y) => resolveInfluenceAt(input, samples, x, y),
  };
}

export function buildMovementTraceSamples(
  fact: SceneComposerFact
): SceneTraceSample[] {
  return buildTraceSamples({
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    traceShape: fact.traceShape,
    traceDensity: fact.traceDensity,
    traceFacts: fact.traceFacts ?? [],
    worldSeed: fact.worldSeed,
    biome: fact.biome,
  });
}

export function buildMovementTraceField(input: {
  fact: SceneComposerFact;
  samples?: SceneTraceSample[];
}): SceneTraceInfluenceField {
  const field = buildTraceInfluenceField({
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    traceShape: input.fact.traceShape,
    traceDensity: input.fact.traceDensity,
    traceFacts: input.fact.traceFacts ?? [],
    worldSeed: input.fact.worldSeed,
    biome: input.fact.biome,
  });

  if (!input.samples) {
    return field;
  }

  return {
    ...field,
    samples: input.samples,
  };
}

function buildTraceFactSamples(
  input: BuildTraceSamplesInput
): SceneTraceSample[] {
  return Array.from({ length: SCENE_COLUMNS }, (_, column) => {
    const x = column * SCENE_TILE_SIZE + SCENE_TILE_SIZE / 2;
    const influenceY = weightedTraceCenterY(input, x);
    const fallbackCenter = fallbackTraceCenter(input, column);
    const centerY = influenceY ?? fallbackCenter;
    const center = centerY / SCENE_TILE_SIZE;
    const width = resolveSampleHalfWidth(input, x);

    return {
      column,
      center,
      x,
      topY: Math.round(centerY - width),
      bottomY: Math.round(centerY + width),
    };
  });
}

function weightedTraceCenterY(
  input: BuildTraceSamplesInput,
  x: number
): number | undefined {
  let weightedY = 0;
  let totalWeight = 0;

  input.traceFacts.forEach((traceFact, index) => {
    const point = resolveTraceFactPoint(input, traceFact, index);
    const radius = resolveTraceFactRadius(input, traceFact, index);
    const distanceX = Math.abs(point.x - x);
    const localWeight =
      distanceX > radius
        ? 0
        : ((radius - distanceX) / radius) * traceFact.strength;

    weightedY += point.y * localWeight;
    totalWeight += localWeight;
  });

  if (totalWeight <= 0) {
    return undefined;
  }

  return clamp(Math.round(weightedY / totalWeight), 0, input.height);
}

function fallbackTraceCenter(input: BuildTraceSamplesInput, column: number): number {
  const curve = (input.traceShape - 50) / 50;
  const wave =
    Math.sin((column / SCENE_COLUMNS) * Math.PI * 1.35 + curve * 0.8) *
    (1.2 + Math.abs(curve) * 1.5);
  const slope = 11.5 - column * 0.12;
  return (slope + wave + curve * 2.2) * SCENE_TILE_SIZE;
}

function resolveSampleHalfWidth(input: BuildTraceSamplesInput, x: number): number {
  const maxInfluence = input.traceFacts.reduce((strength, traceFact, index) => {
    const point = resolveTraceFactPoint(input, traceFact, index);
    const radius = resolveTraceFactRadius(input, traceFact, index);
    const distanceX = Math.abs(point.x - x);
    const localStrength =
      distanceX > radius
        ? 0
        : ((radius - distanceX) / radius) * traceFact.strength;
    return Math.max(strength, localStrength);
  }, input.traceFacts.length > 0 ? 0 : input.traceDensity);

  return clamp(Math.round(18 + maxInfluence * 0.22), 18, 46);
}

function buildTileInfluences(
  input: BuildTraceSamplesInput,
  samples: SceneTraceSample[]
): number[] {
  const influences: number[] = [];

  for (let row = 0; row < SCENE_ROWS; row += 1) {
    for (let column = 0; column < SCENE_COLUMNS; column += 1) {
      influences.push(
        resolveInfluenceAt(
          input,
          samples,
          column * SCENE_TILE_SIZE + SCENE_TILE_SIZE / 2,
          row * SCENE_TILE_SIZE + SCENE_TILE_SIZE / 2
        )
      );
    }
  }

  return influences;
}

function resolveInfluenceAt(
  input: BuildTraceSamplesInput,
  samples: SceneTraceSample[],
  x: number,
  y: number
): number {
  if (input.traceFacts.length > 0) {
    return clamp(
      Math.round(
        input.traceFacts.reduce((strength, traceFact, index) => {
          const point = resolveTraceFactPoint(input, traceFact, index);
          const radius = resolveTraceFactRadius(input, traceFact, index);
          const distance = Math.hypot(point.x - x, point.y - y);
          if (distance > radius) {
            return strength;
          }

          const localStrength =
            traceFact.strength * Math.pow((radius - distance) / radius, 1.35);
          return Math.max(strength, localStrength);
        }, 0)
      ),
      0,
      100
    );
  }

  const column = clamp(Math.floor(x / SCENE_TILE_SIZE), 0, samples.length - 1);
  const sample = samples[column];
  if (!sample) {
    return 0;
  }

  const centerY = sample.center * SCENE_TILE_SIZE;
  const distance = Math.abs(y - centerY);
  const radius = clamp(28 + input.traceDensity * 0.24, 28, 56);

  return clamp(
    Math.round(input.traceDensity * Math.max(0, (radius - distance) / radius)),
    0,
    100
  );
}

function resolveTraceFactPoint(
  input: BuildTraceSamplesInput,
  traceFact: SceneTraceFact,
  index: number
): { x: number; y: number } {
  return {
    x:
      traceFact.x ??
      Math.round(stableUnit(`${input.worldSeed}:${traceFact.id}:x:${index}`) * input.width),
    y:
      traceFact.y ??
      Math.round(
        fallbackTraceCenter(
          input,
          Math.floor((input.traceShape / 100) * (SCENE_COLUMNS - 1))
        )
      ),
  };
}

function resolveTraceFactRadius(
  input: BuildTraceSamplesInput,
  traceFact: SceneTraceFact,
  index: number
): number {
  return clamp(
    Math.round(
      traceFact.radius ??
        (54 +
          traceFact.strength * 0.8 +
          stableUnit(`${input.worldSeed}:${traceFact.id}:radius:${index}`) * 30)
    ),
    36,
    Math.max(input.width, input.height)
  );
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  );
}
