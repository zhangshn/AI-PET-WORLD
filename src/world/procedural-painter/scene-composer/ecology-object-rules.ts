import { clamp } from "./scene-composer-random";
import type {
  SceneAnchor,
  SceneComposerBiome,
  SceneObject,
  SceneObjectEcologyRole,
  SceneObjectGrowthStage,
  SceneObjectKind,
} from "./scene-composer-schema";

export type EcologyRuleInput = {
  biome: SceneComposerBiome;
  moisture: number;
  anchor: SceneAnchor;
  movementInfluence: number;
  spatialUseInfluence: number;
  ecologyInfluence: number;
  nearCanopy?: boolean;
  nearUnderstory?: boolean;
  nearFlowerPatch?: boolean;
};

export type EcologyObjectProfile = {
  health: number;
  age: number;
  growthStage: SceneObjectGrowthStage;
  ecologyHealth: number;
  stressLevel: number;
  moistureAffinity: number;
  traceSensitivity: number;
  scaleBias: number;
  ecologyRole: SceneObjectEcologyRole;
};

export function resolveTreeEcologyProfile(
  input: EcologyRuleInput
): EcologyObjectProfile {
  const ecologyHealth = resolveEcologyHealth(input, 8);
  const age = clamp(Math.round(18 + input.anchor.ageRoll * 118), 0, 140);
  const stressLevel = resolveStress(input, 12);
  const health = clamp(
    Math.round(ecologyHealth + input.moisture * 0.18 - stressLevel * 0.28),
    18,
    100
  );

  return {
    health,
    age,
    growthStage: resolveGrowthStage(age, health),
    ecologyHealth,
    stressLevel,
    moistureAffinity: clamp(Math.round(48 + input.moisture * 0.42), 0, 100),
    traceSensitivity: 72,
    scaleBias: clamp(1 + (health - 64) * 0.003 - input.spatialUseInfluence * 0.0015, 0.74, 1.16),
    ecologyRole: "canopy",
  };
}

export function resolveBushEcologyProfile(
  input: EcologyRuleInput
): EcologyObjectProfile {
  const ecologyHealth = resolveEcologyHealth(input, 14);
  const age = clamp(Math.round(8 + input.anchor.ageRoll * 72), 0, 90);
  const stressLevel = resolveStress(input, 4);
  const health = clamp(
    Math.round(ecologyHealth + input.ecologyInfluence * 0.12 - stressLevel * 0.22),
    15,
    100
  );

  return {
    health,
    age,
    growthStage: resolveGrowthStage(age, health),
    ecologyHealth,
    stressLevel,
    moistureAffinity: clamp(Math.round(42 + input.moisture * 0.48), 0, 100),
    traceSensitivity: 58,
    scaleBias: clamp(0.92 + input.ecologyInfluence * 0.002 - stressLevel * 0.002, 0.68, 1.14),
    ecologyRole: "understory",
  };
}

export function resolveFlowerEcologyProfile(
  input: EcologyRuleInput
): EcologyObjectProfile {
  const ecologyHealth = resolveEcologyHealth(input, input.biome === "grassland" ? 18 : 8);
  const age = clamp(Math.round(2 + input.anchor.ageRoll * 28), 0, 40);
  const stressLevel = resolveStress(input, input.biome === "desert" ? 18 : 2);
  const health = clamp(
    Math.round(ecologyHealth + input.ecologyInfluence * 0.1 - stressLevel * 0.32),
    12,
    100
  );

  return {
    health,
    age,
    growthStage: resolveGrowthStage(age, health),
    ecologyHealth,
    stressLevel,
    moistureAffinity: clamp(Math.round(38 + input.moisture * 0.52), 0, 100),
    traceSensitivity: 82,
    scaleBias: clamp(0.82 + health * 0.003 - stressLevel * 0.003, 0.56, 1.12),
    ecologyRole: "flower_patch",
  };
}

export function resolveStoneEcologyProfile(
  input: EcologyRuleInput
): EcologyObjectProfile {
  const dryness = 100 - input.moisture;
  const ecologyHealth = clamp(Math.round(42 + dryness * 0.18), 0, 100);
  const age = clamp(Math.round(40 + input.anchor.ageRoll * 180), 0, 240);
  const stressLevel = clamp(
    Math.round(18 + input.spatialUseInfluence * 0.16 + dryness * 0.12),
    0,
    100
  );

  return {
    health: 100,
    age,
    growthStage: "old",
    ecologyHealth,
    stressLevel,
    moistureAffinity: clamp(Math.round(28 + input.moisture * 0.18), 0, 100),
    traceSensitivity: 18,
    scaleBias: clamp(0.92 + dryness * 0.002 + input.anchor.scaleRoll * 0.08, 0.78, 1.16),
    ecologyRole: "stone_anchor",
  };
}

export function shouldSpawnMushroom(input: EcologyRuleInput): boolean {
  if (input.biome === "desert" || input.movementInfluence >= 42) {
    return false;
  }

  const habitat =
    input.moisture * 0.006 +
    input.ecologyInfluence * 0.004 +
    (input.nearCanopy ? 0.18 : 0) +
    (input.nearUnderstory ? 0.12 : 0) -
    input.spatialUseInfluence * 0.002;

  return input.anchor.rank < clamp(habitat, 0.06, 0.58);
}

export function shouldSpawnInsectSignal(input: EcologyRuleInput): boolean {
  if (input.movementInfluence >= 38 || input.biome === "desert") {
    return false;
  }

  const habitat =
    input.moisture * 0.0035 +
    input.ecologyInfluence * 0.005 +
    (input.nearFlowerPatch ? 0.22 : 0) +
    (input.nearUnderstory ? 0.1 : 0) -
    input.spatialUseInfluence * 0.0025;

  return input.anchor.rank < clamp(habitat, 0.04, 0.48);
}

export function resolveObjectEcologyRole(
  kind: SceneObjectKind
): SceneObjectEcologyRole {
  if (kind === "tree") return "canopy";
  if (kind === "bush") return "understory";
  if (kind === "flower") return "flower_patch";
  if (kind === "stone") return "stone_anchor";
  if (kind === "mushroom") return "fungi";
  if (kind === "insect_signal") return "micro_life";
  if (kind === "actor") return "placeholder";

  return "ground_cover";
}

export function isEcologyObject(object: SceneObject): boolean {
  return object.kind !== "actor";
}

function resolveEcologyHealth(input: EcologyRuleInput, bias: number): number {
  const biomeMoistureFit =
    input.biome === "desert"
      ? 100 - input.moisture
      : input.biome === "oasis"
        ? input.moisture
        : 70 - Math.abs(input.moisture - 62);

  return clamp(
    Math.round(
      34 +
        biomeMoistureFit * 0.42 +
        input.ecologyInfluence * 0.28 -
        input.movementInfluence * 0.24 -
        input.spatialUseInfluence * 0.08 +
        bias
    ),
    0,
    100
  );
}

function resolveStress(input: EcologyRuleInput, bias: number): number {
  const moistureStress =
    input.biome === "desert"
      ? Math.max(0, input.moisture - 54)
      : Math.abs(input.moisture - 64) * 0.42;

  return clamp(
    Math.round(
      input.movementInfluence * 0.5 +
        input.spatialUseInfluence * 0.18 +
        moistureStress +
        bias -
        input.ecologyInfluence * 0.12
    ),
    0,
    100
  );
}

function resolveGrowthStage(
  age: number,
  health: number
): SceneObjectGrowthStage {
  if (health < 32) return "declining";
  if (age < 10) return "sprout";
  if (age < 32) return "young";
  if (age > 105) return health > 48 ? "old" : "declining";

  return "mature";
}
