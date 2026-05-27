import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import { buildTraceEdgeGrassAnchors } from "./trace-edge-composer";
import { clamp } from "./scene-composer-random";
import { buildSceneAnchors, resolveSceneLayer } from "./object-composer";
import { findSceneTileAt } from "./terrain-composer";
import type { SceneTraceInfluenceField } from "./trace-composer";
import type {
  SceneComposerFact,
  SceneGrassTuft,
  SceneTile,
  SceneTraceSample,
} from "./scene-composer-schema";

export type SceneGrassTuftBuildResult = {
  grassTufts: SceneGrassTuft[];
  traceSuppressedGrassTufts: number;
};

export function buildSceneGrassTufts(
  fact: SceneComposerFact,
  tiles: SceneTile[],
  traceSamples: SceneTraceSample[],
  layoutSeed: string,
  traceField?: SceneTraceInfluenceField
): SceneGrassTuftBuildResult {
  const moistureRate = fact.moisture / 100;
  const densityRate = fact.decorationDensity / 100;
  const biomeFactor =
    fact.biome === "desert"
      ? 0.32
      : fact.biome === "oasis"
        ? 1.16
        : fact.biome === "grassland"
          ? 1.12
          : 1;
  const includeRate = clamp(densityRate * biomeFactor, 0, 1);
  const tufts: SceneGrassTuft[] = [];
  let traceSuppressedGrassTufts = 0;

  buildSceneAnchors(
    `${layoutSeed}:ambient-grass`,
    260,
    6,
    SCENE_WIDTH - 12,
    84,
    SCENE_HEIGHT - 14
  ).forEach((anchor) => {
    const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
    const movementInfluence = traceField?.movementInfluenceAt(anchor.x, anchor.y) ?? 0;
    const spatialUseInfluence =
      traceField?.spatialUseInfluenceAt(anchor.x, anchor.y) ?? 0;
    const ecologyInfluence = traceField?.ecologyInfluenceAt(anchor.x, anchor.y) ?? 0;
    const suppression = clamp(
      movementInfluence * 0.012 + spatialUseInfluence * 0.003,
      0,
      0.92
    );
    const heightFactor = clamp(
      1 - movementInfluence * 0.004 - spatialUseInfluence * 0.0015 +
        ecologyInfluence * 0.001,
      0.42,
      1.16
    );
    if (anchor.rank > includeRate || !tile || tile.kind === "path") {
      return;
    }

    if (suppression > 0 && anchor.rank < suppression) {
      traceSuppressedGrassTufts += 1;
      return;
    }

    tufts.push({
      id: `grass_${anchor.id}`,
      x: anchor.x,
      y: anchor.y,
      height: Math.max(
        2,
        Math.round(
          (3 + anchor.scaleRoll * (4 + moistureRate * 10)) *
            heightFactor
        )
      ),
      light:
        ecologyInfluence >= 44
          ? anchor.roll > 0.46 - moistureRate * 0.16
          : anchor.roll > 0.56 - moistureRate * 0.18,
      layer:
        anchor.y > 292 ? "front" : anchor.roll > 0.65 ? "middle" : "back",
    });
  });

  buildTraceEdgeGrassAnchors(traceSamples, `${layoutSeed}:trace-edge-grass`).forEach(
    (anchor) => {
      const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
      const movementInfluence =
        traceField?.movementInfluenceAt(anchor.x, anchor.y) ?? 0;
      const spatialUseInfluence =
        traceField?.spatialUseInfluenceAt(anchor.x, anchor.y) ?? 0;
      const ecologyInfluence =
        traceField?.ecologyInfluenceAt(anchor.x, anchor.y) ?? 0;
      const suppression = clamp(
        movementInfluence * 0.008 + spatialUseInfluence * 0.002,
        0,
        0.7
      );
      const heightFactor = clamp(
        1 - movementInfluence * 0.003 - spatialUseInfluence * 0.001 +
          ecologyInfluence * 0.001,
        0.48,
        1.14
      );
      if (anchor.rank > includeRate || !tile || tile.kind === "path") {
        return;
      }

      if (suppression > 0 && anchor.rank < suppression) {
        traceSuppressedGrassTufts += 1;
        return;
      }

      tufts.push({
        id: `trace_edge_grass_${anchor.id}`,
        x: anchor.x,
        y: anchor.y,
        height: Math.max(
          2,
          Math.round(
            (3 + anchor.scaleRoll * (5 + moistureRate * 8)) *
              heightFactor
          )
        ),
        light:
          ecologyInfluence >= 44
            ? anchor.roll > 0.4 - moistureRate * 0.14
            : anchor.roll > 0.48 - moistureRate * 0.16,
        layer: anchor.y > 292 ? "front" : "middle",
      });
    }
  );

  return {
    grassTufts: tufts,
    traceSuppressedGrassTufts,
  };
}

export { resolveSceneLayer };
