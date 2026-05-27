import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from "./scene-composer-constants";
import {
  resolveBushEcologyProfile,
  resolveFlowerEcologyProfile,
  resolveObjectEcologyRole,
  resolveStoneEcologyProfile,
  resolveTreeEcologyProfile,
  shouldSpawnInsectSignal,
  shouldSpawnMushroom,
  type EcologyRuleInput,
  type EcologyObjectProfile,
} from "./ecology-object-rules";
import { buildTraceEdgeObjectAnchors } from "./trace-edge-composer";
import { clamp, stableUnit } from "./scene-composer-random";
import { findSceneTileAt } from "./terrain-composer";
import type { SceneTraceInfluenceField } from "./trace-composer";
import type {
  SceneAnchor,
  SceneComposerBiome,
  SceneComposerFact,
  SceneObject,
  SceneObjectKind,
  SceneObjectLayer,
  SceneTile,
  SceneTraceSample,
} from "./scene-composer-schema";

export type SceneObjectBuildResult = {
  generatedObjects: SceneObject[];
  traceAvoidedGeneratedObjects: number;
};

export function buildSceneObjects(
  fact: SceneComposerFact,
  tiles: SceneTile[],
  traceSamples: SceneTraceSample[],
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
    const movementInfluence =
      traceField?.movementInfluenceAt(anchor.x, anchor.y) ?? 0;
    const ecologyInput = buildEcologyRuleInput(fact, anchor, traceField);
    const profile = resolveTreeEcologyProfile(ecologyInput);
    if (!tile || tile.kind !== "grass") {
      return;
    }

    if (movementInfluence >= 82 || anchor.rank > includeRate + profile.ecologyHealth * 0.002) {
      traceAvoidedGeneratedObjects += 1;
      return;
    }

    objects.push(buildTreeFromAnchor(anchor, profile));
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
    const movementInfluence =
      traceField?.movementInfluenceAt(anchor.x, anchor.y) ?? 0;
    const spatialUseInfluence =
      traceField?.spatialUseInfluenceAt(anchor.x, anchor.y) ?? 0;
    const ecologyInfluence = traceField?.ecologyInfluenceAt(anchor.x, anchor.y) ?? 0;
    const weightedIncludeRate = clamp(
      includeRate +
        ecologyInfluence * 0.0022 -
        spatialUseInfluence * 0.0014 -
        movementInfluence * 0.0028,
      0,
      1
    );
    if (anchor.rank > weightedIncludeRate || !tile || tile.kind !== "grass") {
      return;
    }

    if (movementInfluence >= 72) {
      traceAvoidedGeneratedObjects += 1;
      return;
    }

    objects.push(
      buildSmallObjectFromAnchor(
        anchor,
        fact,
        buildEcologyRuleInput(fact, anchor, traceField),
        false
      )
    );
  });

  buildTraceEdgeObjectAnchors(traceSamples, `${layoutSeed}:trace-edge-decor`).forEach(
    (anchor) => {
      const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
      const movementInfluence =
        traceField?.movementInfluenceAt(anchor.x, anchor.y) ?? 0;
      const spatialUseInfluence =
        traceField?.spatialUseInfluenceAt(anchor.x, anchor.y) ?? 0;
      const ecologyInfluence =
        traceField?.ecologyInfluenceAt(anchor.x, anchor.y) ?? 0;
      const weightedIncludeRate = clamp(
        includeRate +
          ecologyInfluence * 0.0016 -
          spatialUseInfluence * 0.001 -
          movementInfluence * 0.002,
        0,
        1
      );
      if (anchor.rank > weightedIncludeRate || !tile || tile.kind === "path") {
        return;
      }

      if (movementInfluence >= 78) {
        traceAvoidedGeneratedObjects += 1;
        return;
      }

      objects.push(
        buildSmallObjectFromAnchor(
          anchor,
          fact,
          buildEcologyRuleInput(fact, anchor, traceField),
          true
        )
      );
    }
  );

  buildSceneAnchors(
    `${layoutSeed}:micro-ecology`,
    fact.biome === "desert" ? 8 : 24,
    24,
    SCENE_WIDTH - 24,
    112,
    SCENE_HEIGHT - 28
  ).forEach((anchor) => {
    const tile = findSceneTileAt(tiles, anchor.x, anchor.y);
    if (!tile || tile.kind === "path") {
      return;
    }

    const ecologyInput = buildEcologyRuleInput(fact, anchor, traceField, objects);

    if (shouldSpawnInsectSignal(ecologyInput)) {
      const profile = resolveInsectSignalProfile(ecologyInput);
      objects.push({
        id: `insect_signal_${anchor.id}`,
        kind: "insect_signal",
        x: anchor.x,
        y: anchor.y - Math.round(8 + anchor.scaleRoll * 12),
        scale: clamp(0.58 + anchor.scaleRoll * 0.34, 0.5, 0.95),
        layer: "middle",
        ...profileToObjectFields(profile),
      });
      return;
    }

    if (shouldSpawnMushroom(ecologyInput)) {
      const profile = resolveMushroomProfile(ecologyInput);
      objects.push({
        id: `mushroom_${anchor.id}`,
        kind: "mushroom",
        x: anchor.x,
        y: anchor.y,
        scale: clamp(0.52 + anchor.scaleRoll * 0.42 + profile.scaleBias * 0.08, 0.46, 0.96),
        layer: resolveSceneLayer(anchor.y),
        ...profileToObjectFields(profile),
      });
    }
  });

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
  profile: EcologyObjectProfile
): SceneObject {
  return {
    id: `permanent_tree_${anchor.id}`,
    kind: "tree",
    x: anchor.x,
    y: anchor.y,
    scale: clamp((0.76 + anchor.scaleRoll * 0.42) * profile.scaleBias, 0.62, 1.28),
    layer: resolveSceneLayer(anchor.y),
    ...profileToObjectFields(profile),
  };
}

function buildSmallObjectFromAnchor(
  anchor: SceneAnchor,
  fact: SceneComposerFact,
  ecologyInput: EcologyRuleInput,
  traceEdge: boolean
): SceneObject {
  const ecologyLift = ecologyInput.ecologyInfluence / 100;
  const movementPressure = ecologyInput.movementInfluence / 100;
  const bushChance = clamp(
    (traceEdge ? 0.42 : fact.biome === "forest" ? 0.52 : 0.4) +
      ecologyLift * 0.16 -
      movementPressure * 0.18,
    0.18,
    0.68
  );
  const stoneChance = clamp(
    (traceEdge ? 0.78 : 0.72) +
      (fact.biome === "desert" ? 0.12 : 0) +
      movementPressure * 0.08,
    bushChance + 0.1,
    0.88
  );
  const layer = resolveSceneLayer(anchor.y);
  const prefix = traceEdge ? "trace_edge" : "ambient";

  if (anchor.roll < bushChance) {
    const profile = resolveBushEcologyProfile(ecologyInput);
    return {
      id: `${prefix}_bush_${anchor.id}`,
      kind: "bush",
      x: anchor.x,
      y: anchor.y,
      scale: clamp((0.72 + anchor.scaleRoll * 0.45) * profile.scaleBias, 0.54, 1.18),
      layer,
      ...profileToObjectFields(profile),
    };
  }

  if (anchor.roll < stoneChance) {
    const profile = resolveStoneEcologyProfile(ecologyInput);
    return {
      id: `${prefix}_stone_${anchor.id}`,
      kind: "stone",
      x: anchor.x,
      y: anchor.y,
      scale: clamp((0.78 + anchor.scaleRoll * 0.36) * profile.scaleBias, 0.66, 1.22),
      layer,
      ...profileToObjectFields(profile),
    };
  }

  const profile = resolveFlowerEcologyProfile(ecologyInput);
  return {
    id: `${prefix}_flower_${anchor.id}`,
    kind: "flower",
    x: anchor.x,
    y: anchor.y,
    scale: clamp((0.72 + anchor.scaleRoll * 0.32) * profile.scaleBias, 0.48, 1.08),
    layer,
    ...profileToObjectFields(profile),
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
  if (kind === "mushroom") return 14
  if (kind === "insect_signal") return 12

  return 36
}

function buildEcologyRuleInput(
  fact: SceneComposerFact,
  anchor: SceneAnchor,
  traceField?: SceneTraceInfluenceField,
  existingObjects: SceneObject[] = []
): EcologyRuleInput {
  return {
    biome: fact.biome,
    moisture: fact.moisture,
    anchor,
    movementInfluence: traceField?.movementInfluenceAt(anchor.x, anchor.y) ?? 0,
    spatialUseInfluence:
      traceField?.spatialUseInfluenceAt(anchor.x, anchor.y) ?? 0,
    ecologyInfluence: traceField?.ecologyInfluenceAt(anchor.x, anchor.y) ?? 0,
    nearCanopy: hasNearbyObject(existingObjects, anchor, "tree", 82),
    nearUnderstory: hasNearbyObject(existingObjects, anchor, "bush", 54),
    nearFlowerPatch: hasNearbyObject(existingObjects, anchor, "flower", 48),
  };
}

function profileToObjectFields(profile: EcologyObjectProfile): Pick<
  SceneObject,
  | "health"
  | "age"
  | "ecologyRole"
  | "moistureAffinity"
  | "traceSensitivity"
  | "ecologyHealth"
  | "growthStage"
  | "stressLevel"
> {
  return {
    health: profile.health,
    age: profile.age,
    ecologyRole: profile.ecologyRole,
    moistureAffinity: profile.moistureAffinity,
    traceSensitivity: profile.traceSensitivity,
    ecologyHealth: profile.ecologyHealth,
    growthStage: profile.growthStage,
    stressLevel: profile.stressLevel,
  };
}

function resolveMushroomProfile(input: EcologyRuleInput): EcologyObjectProfile {
  const profile = resolveFlowerEcologyProfile(input);

  return {
    ...profile,
    ecologyRole: resolveObjectEcologyRole("mushroom"),
    growthStage: profile.growthStage === "old" ? "mature" : profile.growthStage,
    traceSensitivity: 88,
    scaleBias: clamp(0.82 + input.moisture * 0.003 + input.ecologyInfluence * 0.002, 0.62, 1.1),
  };
}

function resolveInsectSignalProfile(input: EcologyRuleInput): EcologyObjectProfile {
  const profile = resolveFlowerEcologyProfile(input);

  return {
    ...profile,
    ecologyRole: resolveObjectEcologyRole("insect_signal"),
    growthStage: "mature",
    traceSensitivity: 94,
    scaleBias: 1,
  };
}

function hasNearbyObject(
  objects: SceneObject[],
  anchor: SceneAnchor,
  kind: SceneObjectKind,
  radius: number
): boolean {
  return objects.some(
    (object) =>
      object.kind === kind &&
      Math.hypot(object.x - anchor.x, object.y - anchor.y) <= radius
  );
}
