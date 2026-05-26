import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import { buildRoadsideGrassAnchors } from "./road-composer";
import { clamp } from "./scene-composer-random";
import { buildSceneAnchors, resolveSceneLayer } from "./object-composer";
import { findSceneTileAt } from "./terrain-composer";
import type {
  PathSample,
  SceneComposerFact,
  SceneGrassTuft,
  SceneTile,
} from "./scene-composer-schema";

export function buildSceneGrassTufts(
  fact: SceneComposerFact,
  tiles: SceneTile[],
  pathSamples: PathSample[],
  layoutSeed: string
): SceneGrassTuft[] {
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

  buildSceneAnchors(
    `${layoutSeed}:ambient-grass`,
    260,
    6,
    SCENE_WIDTH - 12,
    84,
    SCENE_HEIGHT - 14
  ).forEach((anchor) => {
    const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
    if (anchor.rank > includeRate || !tile || tile.kind === "path") {
      return;
    }

    tufts.push({
      id: `grass_${anchor.id}`,
      x: anchor.x,
      y: anchor.y,
      height: Math.round(3 + anchor.scaleRoll * (4 + moistureRate * 10)),
      light: anchor.roll > 0.56 - moistureRate * 0.18,
      layer:
        anchor.y > 292 ? "front" : anchor.roll > 0.65 ? "middle" : "back",
    });
  });

  buildRoadsideGrassAnchors(pathSamples, `${layoutSeed}:roadside-grass`).forEach(
    (anchor) => {
      const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
      if (anchor.rank > includeRate || !tile || tile.kind === "path") {
        return;
      }

      tufts.push({
        id: `road_grass_${anchor.id}`,
        x: anchor.x,
        y: anchor.y,
        height: Math.round(3 + anchor.scaleRoll * (5 + moistureRate * 8)),
        light: anchor.roll > 0.48 - moistureRate * 0.16,
        layer: anchor.y > 292 ? "front" : "middle",
      });
    }
  );

  return tufts;
}

export { resolveSceneLayer };
