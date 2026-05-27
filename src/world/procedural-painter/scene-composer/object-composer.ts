import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import { buildRoadsideObjectAnchors } from "./road-composer";
import { clamp, stableUnit } from "./scene-composer-random";
import { findSceneTileAt } from "./terrain-composer";
import type { SceneTraceInfluenceField } from "./trace-composer";
import type {
  PathSample,
  SceneAnchor,
  SceneComposerBiome,
  SceneComposerFact,
  SceneObject,
  SceneObjectLayer,
  SceneTile,
} from "./scene-composer-schema";

export type SceneObjectBuildResult = {
  generatedObjects: SceneObject[];
  traceAvoidedGeneratedObjects: number;
};

export function buildSceneObjects(
  fact: SceneComposerFact,
  tiles: SceneTile[],
  pathSamples: PathSample[],
  layoutSeed: string,
  traceField?: SceneTraceInfluenceField
): SceneObjectBuildResult {
  const densityRate = fact.decorationDensity / 100;
  const biomeFactor =
    fact.biome === "desert" ? 0.36 : fact.biome === "grassland" ? 0.78 : fact.biome === "oasis" ? 0.9 : 1;
  const includeRate = clamp(densityRate * biomeFactor, 0, 1);
  const objects: SceneObject[] = [];
  let traceAvoidedGeneratedObjects = 0;
  const actorTile =
    tiles.find(
      (tile) => tile.kind === "path" && tile.x > 260 && tile.x < 360 && tile.y > 200
    ) ?? tiles.find((tile) => tile.kind === "path");

  if (fact.includeActorPlaceholder !== false && actorTile) {
    objects.push({
      id: "actor_preview",
      kind: "actor",
      x: actorTile.x + 12,
      y: actorTile.y + 22,
      scale: 1,
      layer: "middle",
    });
  }

  buildSceneAnchors(
    `${layoutSeed}:permanent-trees`,
    permanentTreeCountFor(fact.biome),
    36,
    SCENE_WIDTH - 36,
    116,
    SCENE_HEIGHT - 48
  ).forEach((anchor) => {
    const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
    const influence = traceField?.influenceAt(anchor.x, anchor.y) ?? 0;
    if (!tile || tile.kind !== "grass") {
      return;
    }

    if (influence >= 78) {
      traceAvoidedGeneratedObjects += 1;
      return;
    }

    objects.push(buildTreeFromAnchor(anchor, fact));
  });

  buildSceneAnchors(
    `${layoutSeed}:small-decor`,
    fact.biome === "desert" ? 26 : 44,
    18,
    SCENE_WIDTH - 36,
    92,
    SCENE_HEIGHT - 42
  ).forEach((anchor) => {
    const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
    const influence = traceField?.influenceAt(anchor.x, anchor.y) ?? 0;
    if (anchor.rank > includeRate || !tile || tile.kind !== "grass") {
      return;
    }

    if (influence >= 64) {
      traceAvoidedGeneratedObjects += 1;
      return;
    }

    objects.push(buildSmallObjectFromAnchor(anchor, fact, false));
  });

  buildRoadsideObjectAnchors(pathSamples, `${layoutSeed}:roadside-decor`).forEach(
    (anchor) => {
      const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
      const influence = traceField?.influenceAt(anchor.x, anchor.y) ?? 0;
      if (anchor.rank > includeRate || !tile || tile.kind === "path") {
        return;
      }

      if (influence >= 74) {
        traceAvoidedGeneratedObjects += 1;
        return;
      }

      objects.push(buildSmallObjectFromAnchor(anchor, fact, true));
    }
  );

  return {
    generatedObjects: objects,
    traceAvoidedGeneratedObjects,
  };
}

export function mergeFactAndGeneratedObjects(input: {
  factObjects: SceneObject[]
  generatedObjects: SceneObject[]
}): SceneObject[] {
  const filteredGeneratedObjects = input.generatedObjects.filter(
    (generatedObject) =>
      !input.factObjects.some((factObject) =>
        isTooCloseToFactObject({
          factObject,
          generatedObject,
        })
      )
  )

  return [...input.factObjects, ...filteredGeneratedObjects]
}

export function buildSceneAnchors(
  seed: string,
  count: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): SceneAnchor[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${index}`,
    x: Math.round(minX + stableUnit(`${seed}:x:${index}`) * (maxX - minX)),
    y: Math.round(minY + stableUnit(`${seed}:y:${index}`) * (maxY - minY)),
    rank: stableUnit(`${seed}:rank:${index}`),
    roll: stableUnit(`${seed}:kind:${index}`),
    scaleRoll: stableUnit(`${seed}:scale:${index}`),
    ageRoll: stableUnit(`${seed}:age:${index}`),
    healthRoll: stableUnit(`${seed}:health:${index}`),
  }));
}

export function resolveSceneLayer(y: number): SceneObjectLayer {
  if (y < 210) {
    return "back";
  }

  if (y > 300) {
    return "front";
  }

  return "middle";
}

function buildTreeFromAnchor(
  anchor: SceneAnchor,
  fact: SceneComposerFact
): SceneObject {
  return {
    id: `permanent_tree_${anchor.id}`,
    kind: "tree",
    x: anchor.x,
    y: anchor.y,
    scale: 0.76 + anchor.scaleRoll * 0.42,
    layer: resolveSceneLayer(anchor.y),
    health: clamp(Math.round(58 + fact.moisture * 0.36 + anchor.healthRoll * 22), 20, 100),
    age: clamp(Math.round(22 + anchor.ageRoll * 88), 0, 120),
  };
}

function buildSmallObjectFromAnchor(
  anchor: SceneAnchor,
  fact: SceneComposerFact,
  roadside: boolean
): SceneObject {
  const bushChance = roadside ? 0.42 : fact.biome === "forest" ? 0.52 : 0.4;
  const stoneChance = roadside ? 0.78 : 0.72;
  const layer = resolveSceneLayer(anchor.y);

  if (anchor.roll < bushChance) {
    return {
      id: `${roadside ? "roadside" : "ambient"}_bush_${anchor.id}`,
      kind: "bush",
      x: anchor.x,
      y: anchor.y,
      scale: 0.72 + anchor.scaleRoll * 0.45,
      layer,
    };
  }

  if (anchor.roll < stoneChance) {
    return {
      id: `${roadside ? "roadside" : "ambient"}_stone_${anchor.id}`,
      kind: "stone",
      x: anchor.x,
      y: anchor.y,
      scale: 0.78 + anchor.scaleRoll * 0.36,
      layer,
    };
  }

  return {
    id: `${roadside ? "roadside" : "ambient"}_flower_${anchor.id}`,
    kind: "flower",
    x: anchor.x,
    y: anchor.y,
    scale: 0.72 + anchor.scaleRoll * 0.32,
    layer,
  };
}

function permanentTreeCountFor(biome: SceneComposerBiome): number {
  if (biome === "desert") {
    return 1;
  }

  if (biome === "grassland") {
    return 2;
  }

  if (biome === "oasis") {
    return 3;
  }

  return 5;
}

function isTooCloseToFactObject(input: {
  factObject: SceneObject
  generatedObject: SceneObject
}): boolean {
  const distance = Math.hypot(
    input.factObject.x - input.generatedObject.x,
    input.factObject.y - input.generatedObject.y
  )

  return distance < resolveFactObjectAvoidanceRadius(input.generatedObject.kind)
}

function resolveFactObjectAvoidanceRadius(kind: SceneObject["kind"]): number {
  if (kind === "tree") return 54
  if (kind === "bush") return 32
  if (kind === "stone") return 24
  if (kind === "flower") return 18

  return 36
}
