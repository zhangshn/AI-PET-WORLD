import {
  SCENE_COLUMNS,
  SCENE_ROWS,
  SCENE_TILE_SIZE,
} from "./scene-composer-constants";
import { stableUnit } from "./scene-composer-random";
import type { SceneTraceInfluenceField } from "./trace-composer";
import type {
  PathSample,
  SceneComposerFact,
  SceneTile,
  SceneTileKind,
} from "./scene-composer-schema";

export function buildSceneTiles(
  fact: SceneComposerFact,
  traceSamples: PathSample[],
  layoutSeed: string,
  traceField?: SceneTraceInfluenceField
): SceneTile[] {
  const hasTraceFact = fact.hasTraceFact ?? fact.hasRoadFact ?? true;
  const tiles: SceneTile[] = [];

  for (let row = 0; row < SCENE_ROWS; row += 1) {
    for (let column = 0; column < SCENE_COLUMNS; column += 1) {
      const tileCenterX = column * SCENE_TILE_SIZE + SCENE_TILE_SIZE / 2;
      const tileCenterY = row * SCENE_TILE_SIZE + SCENE_TILE_SIZE / 2;
      const movementInfluence =
        traceField?.movementInfluenceAt(tileCenterX, tileCenterY) ?? 0;
      const spatialUseInfluence =
        traceField?.spatialUseInfluenceAt(tileCenterX, tileCenterY) ?? 0;
      const ecologyInfluence =
        traceField?.ecologyInfluenceAt(tileCenterX, tileCenterY) ?? 0;
      const ecologyTransitionInfluence = Math.max(
        movementInfluence >= 24 && movementInfluence < 52 ? movementInfluence : 0,
        ecologyInfluence * 0.58,
        spatialUseInfluence * 0.42
      );
      const kind: SceneTileKind = !hasTraceFact
        ? "grass"
        : movementInfluence >= 52
          // "path" is deprecated renderer compatibility for long-used area tile.
          ? "path"
          : ecologyTransitionInfluence >= 34
            // "edge" is deprecated renderer compatibility for trace edge / ecology transition tile.
            ? "edge"
            : "grass";
      const variant = Math.floor(
        stableUnit(`${layoutSeed}:tile:${column}:${row}`) * 4
      );
      const transitionCenter = traceSamples[column]?.center ?? SCENE_ROWS / 2;
      const edgeMask =
        kind === "edge" ? (row < transitionCenter ? "top" : "bottom") : undefined;

      tiles.push({
        id: `tile_${column}_${row}`,
        x: column * SCENE_TILE_SIZE,
        y: row * SCENE_TILE_SIZE,
        kind,
        variant,
        edgeMask,
      });
    }
  }

  return tiles;
}

export function findSceneTileAt(
  tiles: SceneTile[],
  x: number,
  y: number
): SceneTile | undefined {
  const column = Math.floor(x / SCENE_TILE_SIZE);
  const row = Math.floor(y / SCENE_TILE_SIZE);
  return tiles.find(
    (tile) =>
      tile.x === column * SCENE_TILE_SIZE && tile.y === row * SCENE_TILE_SIZE
  );
}
