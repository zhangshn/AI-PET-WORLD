import {
  SCENE_COLUMNS,
  SCENE_ROWS,
  SCENE_TILE_SIZE,
} from "./scene-composer-constants";
import { stableUnit } from "./scene-composer-random";
import { resolveRoadWidth } from "./road-composer";
import type {
  PathSample,
  SceneComposerFact,
  SceneTile,
  SceneTileKind,
} from "./scene-composer-schema";

export function buildSceneTiles(
  fact: SceneComposerFact,
  pathSamples: PathSample[],
  layoutSeed: string
): SceneTile[] {
  const pathWidth = resolveRoadWidth(fact.biome);
  const hasRoadFact = fact.hasRoadFact ?? true;
  const tiles: SceneTile[] = [];

  for (let row = 0; row < SCENE_ROWS; row += 1) {
    for (let column = 0; column < SCENE_COLUMNS; column += 1) {
      const center = pathSamples[column]?.center ?? 0;
      const distance = Math.abs(row - center);
      const kind: SceneTileKind = !hasRoadFact
        ? "grass"
        : distance <= pathWidth
          ? "path"
          : distance <= pathWidth + 0.95
            ? "edge"
            : "grass";
      const variant = Math.floor(
        stableUnit(`${layoutSeed}:tile:${column}:${row}`) * 4
      );
      const edgeMask =
        kind === "edge" ? (row < center ? "top" : "bottom") : undefined;

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