import {
  SCENE_COLUMNS,
  SCENE_HEIGHT,
  SCENE_TILE_SIZE,
} from "./scene-composer-constants";
import { clamp, stableUnit } from "./scene-composer-random";
import type {
  PathSample,
  SceneAnchor,
  SceneComposerBiome,
  SceneComposerFact,
} from "./scene-composer-schema";

export function buildRoadSamples(fact: SceneComposerFact): PathSample[] {
  const pathWidth = resolveRoadWidth(fact.biome);

  return Array.from({ length: SCENE_COLUMNS }, (_, column) => {
    const curve = ((fact.traceShape ?? fact.roadShape ?? 50) - 50) / 50;
    const wave =
      Math.sin((column / SCENE_COLUMNS) * Math.PI * 1.35 + curve * 0.8) *
      (1.2 + Math.abs(curve) * 1.5);
    const slope = 11.5 - column * 0.12;
    const center = slope + wave + curve * 2.2;

    return {
      column,
      center,
      x: column * SCENE_TILE_SIZE + SCENE_TILE_SIZE / 2,
      topY: Math.round((center - pathWidth - 0.8) * SCENE_TILE_SIZE),
      bottomY: Math.round((center + pathWidth + 1.35) * SCENE_TILE_SIZE),
    };
  });
}

export function resolveRoadWidth(biome: SceneComposerBiome): number {
  if (biome === "desert") {
    return 1.9;
  }

  if (biome === "grassland") {
    return 1.45;
  }

  return 1.3;
}

export function buildRoadsideGrassAnchors(
  pathSamples: PathSample[],
  seed: string
): SceneAnchor[] {
  return pathSamples.flatMap((sample) => {
    if (sample.column % 2 !== 0) {
      return [];
    }

    return (["top", "bottom"] as const).map((side, sideIndex) => {
      const offset = Math.round(
        (stableUnit(`${seed}:offset:${sample.column}:${side}`) - 0.5) * 14
      );
      const y =
        side === "top" ? sample.topY - 4 - offset : sample.bottomY + 4 + offset;

      return {
        id: `${sample.column}_${side}`,
        x: Math.round(
          sample.x +
            (stableUnit(`${seed}:x:${sample.column}:${side}`) - 0.5) * 18
        ),
        y: clamp(y, 84, SCENE_HEIGHT - 14),
        rank: stableUnit(`${seed}:rank:${sample.column}:${side}`),
        roll: stableUnit(`${seed}:kind:${sample.column}:${side}`),
        scaleRoll: stableUnit(`${seed}:scale:${sample.column}:${side}`),
        ageRoll: stableUnit(`${seed}:age:${sample.column}:${sideIndex}`),
        healthRoll: stableUnit(`${seed}:health:${sample.column}:${sideIndex}`),
      };
    });
  });
}

export function buildRoadsideObjectAnchors(
  pathSamples: PathSample[],
  seed: string
): SceneAnchor[] {
  return pathSamples.flatMap((sample) => {
    if (sample.column % 4 !== 1) {
      return [];
    }

    return (["top", "bottom"] as const).map((side, sideIndex) => {
      const offset = Math.round(
        (stableUnit(`${seed}:offset:${sample.column}:${side}`) - 0.5) * 18
      );
      const y =
        side === "top"
          ? sample.topY - 10 - offset
          : sample.bottomY + 10 + offset;

      return {
        id: `${sample.column}_${side}`,
        x: Math.round(
          sample.x +
            (stableUnit(`${seed}:x:${sample.column}:${side}`) - 0.5) * 22
        ),
        y: clamp(y, 92, SCENE_HEIGHT - 42),
        rank: stableUnit(`${seed}:rank:${sample.column}:${side}`),
        roll: stableUnit(`${seed}:kind:${sample.column}:${side}`),
        scaleRoll: stableUnit(`${seed}:scale:${sample.column}:${side}`),
        ageRoll: stableUnit(`${seed}:age:${sample.column}:${sideIndex}`),
        healthRoll: stableUnit(`${seed}:health:${sample.column}:${sideIndex}`),
      };
    });
  });
}
