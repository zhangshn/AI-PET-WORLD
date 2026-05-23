/**
 * 当前文件职责：从管家人格、地貌与资源状态生成结构化房屋偏好。
 */

import type {
  HouseArchetype,
  HouseMaterialPreference,
  HousePreference,
  HousePreferenceBuildInput,
  HouseSpatialPreference,
} from "./house-style-schema"

export function buildHousePreference(
  input: HousePreferenceBuildInput
): HousePreference {
  const personalityDrivers = selectPersonalityDrivers(input.constructionStyle)
  const archetype = selectHouseArchetype(personalityDrivers[0])
  const resourcePosture = selectResourcePosture(input)
  const scalePreference = selectScalePreference(input, resourcePosture)
  const materialPreference = selectMaterialPreference(input, archetype)
  const spatialPreference = buildSpatialPreference({
    input,
    archetype,
    resourcePosture,
    scalePreference,
  })

  return {
    preferenceId: [
      "house-style",
      normalizeToken(input.worldId),
      input.biomeType,
      archetype,
      scalePreference,
    ].join(":"),
    archetype,
    materialPreference,
    spatialPreference,
    scalePreference,
    resourcePosture,
    sourceBiome: input.biomeType,
    personalityDrivers,
    resourceDrivers: buildResourceDrivers(input),
    styleReason: [
      `archetype:${archetype}`,
      `biome:${input.biomeType}`,
      `resource:${resourcePosture}`,
      `scale:${scalePreference}`,
    ].join(" / "),
    styleTags: [
      "house_preference",
      "butler_personality_driven",
      "biome_driven",
      "resource_driven",
      archetype,
      materialPreference,
      scalePreference,
      input.biomeType,
      ...input.tags,
    ],
  }
}

function selectPersonalityDrivers(
  style: HousePreferenceBuildInput["constructionStyle"]
): HousePreference["personalityDrivers"] {
  return (Object.entries(style) as Array<
    [HousePreference["personalityDrivers"][number], number]
  >)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1]

      return left[0].localeCompare(right[0])
    })
    .slice(0, 2)
    .map(([key]) => key)
}

function selectHouseArchetype(
  driver: HousePreference["personalityDrivers"][number]
): HouseArchetype {
  const archetypeByDriver = {
    structuredBuilder: "ordered_compact_cabin",
    warmCaretaker: "warm_care_cottage",
    protectiveKeeper: "protective_courtyard",
    quietMaintainer: "quiet_retreat_house",
    aestheticOrganizer: "aesthetic_garden_home",
    adaptivePlanner: "adaptive_modular_home",
  } satisfies Record<
    HousePreference["personalityDrivers"][number],
    HouseArchetype
  >

  return archetypeByDriver[driver]
}

function selectResourcePosture(
  input: HousePreferenceBuildInput
): HousePreference["resourcePosture"] {
  const resourceScore =
    input.resources.materialReadiness * 0.36 +
    input.resources.careReadiness * 0.24 +
    input.resources.groundHealth * 0.2 +
    input.resources.naturalGrowth * 0.12 -
    input.resources.spacePressure * 0.08

  if (resourceScore >= 62) return "abundant"
  if (resourceScore >= 42) return "stable"

  return "scarce"
}

function selectScalePreference(
  input: HousePreferenceBuildInput,
  resourcePosture: HousePreference["resourcePosture"]
): HousePreference["scalePreference"] {
  if (resourcePosture === "scarce" || input.resources.spacePressure >= 58) {
    return "conservative"
  }

  if (
    resourcePosture === "abundant" &&
    input.constructionStyle.adaptivePlanner +
      input.constructionStyle.structuredBuilder >=
      1.1
  ) {
    return "expandable"
  }

  return "moderate"
}

function selectMaterialPreference(
  input: HousePreferenceBuildInput,
  archetype: HouseArchetype
): HouseMaterialPreference {
  if (input.biomeType === "forest") return "wood_and_leaf"
  if (input.biomeType === "desert") return "stone_and_shade"
  if (input.biomeType === "oasis") return "water_softened_clay"
  if (archetype === "adaptive_modular_home") return "lightweight_modular"

  return "balanced_natural_mix"
}

function buildSpatialPreference(input: {
  input: HousePreferenceBuildInput
  archetype: HouseArchetype
  resourcePosture: HousePreference["resourcePosture"]
  scalePreference: HousePreference["scalePreference"]
}): HouseSpatialPreference {
  const footprint =
    input.scalePreference === "expandable"
      ? "expandable"
      : input.scalePreference === "conservative"
        ? "compact"
        : "balanced"
  const privacy =
    input.archetype === "protective_courtyard" ||
    input.input.shelterSafetyBias > 0.08
      ? "protected"
      : input.archetype === "quiet_retreat_house" ||
          input.input.boundaryDensityBias > 0.08
        ? "buffered"
        : "open"
  const layoutFlow =
    input.archetype === "ordered_compact_cabin"
      ? "ordered"
      : input.archetype === "adaptive_modular_home"
        ? "adaptive"
        : input.archetype === "protective_courtyard"
          ? "clustered"
          : "soft"

  return {
    footprint,
    privacy,
    layoutFlow,
    preferredAnchorZone:
      input.archetype === "warm_care_cottage"
        ? "initial_care"
        : input.archetype === "protective_courtyard"
          ? "temporary_shelter"
          : input.archetype === "quiet_retreat_house"
            ? "quiet_living"
            : "visual_center",
    expansionReadiness: clamp01(
      input.input.resources.materialReadiness / 100 +
        input.input.constructionStyle.adaptivePlanner / 3 -
        input.input.resources.spacePressure / 180
    ),
    maintenanceRisk: clamp01(
      input.input.maintenanceRisk +
        input.input.materialCostMultiplier / 10 +
        (input.resourcePosture === "scarce" ? 0.12 : 0)
    ),
    tags: [
      "house_spatial_preference",
      footprint,
      privacy,
      layoutFlow,
      input.input.biomeType,
    ],
  }
}

function buildResourceDrivers(input: HousePreferenceBuildInput): string[] {
  return [
    `material:${input.resources.materialReadiness}`,
    `care:${input.resources.careReadiness}`,
    `natural:${input.resources.naturalGrowth}`,
    `ground:${input.resources.groundHealth}`,
    `space:${input.resources.spacePressure}`,
    `maintenance:${input.maintenanceRisk.toFixed(2)}`,
  ]
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
