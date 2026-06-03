/**
 * 当前文件负责：生成 WORLD-GEN-03 布局差异化审计结果。
 */

import type {
  HomeMapSize,
  HomeZone,
  MapPlacement,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"
import { buildInitialHomePlacements } from "@/world/placement/placement-engine"
import { INITIAL_HOME_PLACEMENT_RULE_SET } from "@/world/placement/placement-rules"

import type {
  InitialHomeAreaRecipe,
  WorldLayoutGenerationInput,
} from "./generation-schema"
import { INITIAL_HOME_SCENE_RECIPE } from "./initial-home-scene-recipe"
import { auditWorldLayoutGenerationInput } from "./world-layout-input-audit"
import { buildWorldLayoutGenerationInput } from "./world-layout-input-builder"
import { buildStableWorldSeed } from "./world-seed"
import {
  WORLD_LAYOUT_VARIATION_SCENARIOS,
  type WorldLayoutVariationScenario,
} from "./world-layout-variation-scenarios"

export type WorldLayoutLayerCounts = Record<MapPlacementLayer, number>

export type WorldLayoutVariationMetrics = {
  totalPlacements: number
  layerCounts: WorldLayoutLayerCounts
  pathLength: number
  natureCount: number
  surfaceDecorationCount: number
  supportGroundCount: number
  compactSupportScore: number
  shelterCoordinate: string
  storageCoordinate: string
  butlerCoordinate: string
}

export type WorldLayoutVariationScenarioAudit = {
  scenarioId: string
  scenarioName: string
  stableSeed: string
  biomeType: WorldLayoutGenerationInput["biome"]["biomeType"]
  selectedCandidateId: string
  candidateCount: number
  constraintCount: number
  layoutVariantId: string
  pathStyle: WorldLayoutGenerationInput["variant"]["pathStyle"]
  shelterBias: WorldLayoutGenerationInput["variant"]["shelterBias"]
  natureBias: WorldLayoutGenerationInput["variant"]["natureBias"]
  quietAreaBias: WorldLayoutGenerationInput["variant"]["quietAreaBias"]
  expectedDrivers: string[]
  isStableAcrossRepeatedBuild: boolean
  fingerprint: string
  repeatedFingerprint: string
  zoneFingerprint: string
  metrics: WorldLayoutVariationMetrics
  warnings: string[]
  rejectedPlacementIds: string[]
  layoutInputTags: string[]
}

export type WorldLayoutVariationPairAudit = {
  baseScenarioId: string
  comparedScenarioId: string
  sameFingerprint: boolean
  variantDifferences: string[]
  coordinateDifferences: string[]
  metricDifferences: string[]
  observableDifferenceScore: number
  passedObservableDifference: boolean
}

export type WorldLayoutVariationAudit = {
  auditId: "WORLD-GEN-03-layout-variation-audit"
  scenarioCount: number
  stableScenarioCount: number
  pairCount: number
  passedPairCount: number
  scenarios: WorldLayoutVariationScenarioAudit[]
  pairs: WorldLayoutVariationPairAudit[]
  warnings: string[]
  tags: string[]
}

export function buildWorldLayoutVariationAudit(
  scenarios: readonly WorldLayoutVariationScenario[] = WORLD_LAYOUT_VARIATION_SCENARIOS
): WorldLayoutVariationAudit {
  const scenarioAudits = scenarios.map(buildScenarioAudit)
  const pairs = buildPairAudits(scenarioAudits)
  const warnings = [
    ...scenarioAudits.flatMap((scenario) => scenario.warnings),
    ...pairs.flatMap((pair) =>
      pair.passedObservableDifference
        ? []
        : [
            `布局差异不足：${pair.baseScenarioId} -> ${pair.comparedScenarioId}`,
          ]
    ),
  ]

  return {
    auditId: "WORLD-GEN-03-layout-variation-audit",
    scenarioCount: scenarioAudits.length,
    stableScenarioCount: scenarioAudits.filter(
      (scenario) => scenario.isStableAcrossRepeatedBuild
    ).length,
    pairCount: pairs.length,
    passedPairCount: pairs.filter((pair) => pair.passedObservableDifference)
      .length,
    scenarios: scenarioAudits,
    pairs,
    warnings,
    tags: [
      "world_gen_03",
      "layout_variation_audit",
      "stable_seed_replay_check",
      "observable_difference_check",
      "no_ui_world_fact_generation",
      "no_direct_life_layout",
    ],
  }
}

function buildScenarioAudit(
  scenario: WorldLayoutVariationScenario
): WorldLayoutVariationScenarioAudit {
  const firstBuild = buildScenarioPlacements(scenario)
  const repeatedBuild = buildScenarioPlacements(scenario)
  const fingerprint = buildPlacementFingerprint(firstBuild.placements)
  const repeatedFingerprint = buildPlacementFingerprint(repeatedBuild.placements)
  const metrics = buildVariationMetrics(firstBuild.placements)
  const isStableAcrossRepeatedBuild = fingerprint === repeatedFingerprint

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    stableSeed: firstBuild.layoutInput.seed,
    biomeType: firstBuild.layoutInput.biome.biomeType,
    selectedCandidateId: firstBuild.layoutInput.selectedCandidate.candidateId,
    candidateCount: firstBuild.layoutInput.candidates.length,
    constraintCount: firstBuild.layoutInput.constraints.length,
    layoutVariantId: firstBuild.layoutInput.variant.variantId,
    pathStyle: firstBuild.layoutInput.variant.pathStyle,
    shelterBias: firstBuild.layoutInput.variant.shelterBias,
    natureBias: firstBuild.layoutInput.variant.natureBias,
    quietAreaBias: firstBuild.layoutInput.variant.quietAreaBias,
    expectedDrivers: scenario.expectedDrivers,
    isStableAcrossRepeatedBuild,
    fingerprint,
    repeatedFingerprint,
    zoneFingerprint: buildZoneFingerprint(firstBuild.zones),
    metrics,
    warnings: [
      ...firstBuild.warnings,
      ...repeatedBuild.warnings,
      ...(isStableAcrossRepeatedBuild
        ? []
        : [`${scenario.id} repeated build fingerprint 不一致。`]),
    ],
    rejectedPlacementIds: [
      ...firstBuild.rejectedPlacementIds,
      ...repeatedBuild.rejectedPlacementIds,
    ],
    layoutInputTags: firstBuild.layoutInput.tags,
  }
}

function buildScenarioPlacements(scenario: WorldLayoutVariationScenario): {
  layoutInput: WorldLayoutGenerationInput
  placements: MapPlacement[]
  zones: HomeZone[]
  warnings: string[]
  rejectedPlacementIds: string[]
} {
  const stableSeed = buildStableWorldSeed({
    ownerId: scenario.generationInput.ownerId,
    birthSignature: scenario.generationInput.birthSignature,
    worldSalt: scenario.generationInput.worldSalt,
  })
  const layoutBuildResult = buildWorldLayoutGenerationInput({
    generationInput: scenario.generationInput,
    seed: stableSeed,
    resources: scenario.resources,
  })
  const inputAudit = auditWorldLayoutGenerationInput(
    layoutBuildResult.layoutInput
  )
  const zones = INITIAL_HOME_SCENE_RECIPE.areas.map((area) =>
    toHomeZone(area, layoutBuildResult.layoutInput)
  )
  const placementResult = buildInitialHomePlacements({
    worldId: scenario.generationInput.worldId,
    ownerId: scenario.generationInput.ownerId,
    seed: stableSeed,
    recipe: INITIAL_HOME_SCENE_RECIPE,
    zones,
    rules: INITIAL_HOME_PLACEMENT_RULE_SET,
    butlerConstructionStyle: scenario.generationInput.butlerConstructionStyle,
    layoutInput: layoutBuildResult.layoutInput,
  })

  return {
    layoutInput: layoutBuildResult.layoutInput,
    placements: placementResult.placements,
    zones,
    warnings: [...inputAudit.warnings, ...placementResult.warnings],
    rejectedPlacementIds: placementResult.rejectedPlacementIds,
  }
}

function buildPairAudits(
  scenarios: WorldLayoutVariationScenarioAudit[]
): WorldLayoutVariationPairAudit[] {
  const pairs: WorldLayoutVariationPairAudit[] = []

  scenarios.forEach((baseScenario, baseIndex) => {
    scenarios.slice(baseIndex + 1).forEach((comparedScenario) => {
      pairs.push(buildPairAudit(baseScenario, comparedScenario))
    })
  })

  return pairs
}

function buildPairAudit(
  baseScenario: WorldLayoutVariationScenarioAudit,
  comparedScenario: WorldLayoutVariationScenarioAudit
): WorldLayoutVariationPairAudit {
  const variantDifferences = buildVariantDifferences(
    baseScenario,
    comparedScenario
  )
  const coordinateDifferences = buildCoordinateDifferences(
    baseScenario,
    comparedScenario
  )
  const metricDifferences = buildMetricDifferences(
    baseScenario,
    comparedScenario
  )
  const sameFingerprint = baseScenario.fingerprint === comparedScenario.fingerprint
  const observableDifferenceScore =
    variantDifferences.length * 2 +
    coordinateDifferences.length * 2 +
    metricDifferences.length +
    (sameFingerprint ? 0 : 3)

  return {
    baseScenarioId: baseScenario.scenarioId,
    comparedScenarioId: comparedScenario.scenarioId,
    sameFingerprint,
    variantDifferences,
    coordinateDifferences,
    metricDifferences,
    observableDifferenceScore,
    passedObservableDifference: observableDifferenceScore >= 4 && !sameFingerprint,
  }
}

function buildVariantDifferences(
  baseScenario: WorldLayoutVariationScenarioAudit,
  comparedScenario: WorldLayoutVariationScenarioAudit
): string[] {
  return [
    baseScenario.biomeType === comparedScenario.biomeType
      ? null
      : `biome:${baseScenario.biomeType}->${comparedScenario.biomeType}`,
    baseScenario.selectedCandidateId === comparedScenario.selectedCandidateId
      ? null
      : `candidate:${baseScenario.selectedCandidateId}->${comparedScenario.selectedCandidateId}`,
    baseScenario.pathStyle === comparedScenario.pathStyle
      ? null
      : `pathStyle:${baseScenario.pathStyle}->${comparedScenario.pathStyle}`,
    baseScenario.shelterBias === comparedScenario.shelterBias
      ? null
      : `shelterBias:${baseScenario.shelterBias}->${comparedScenario.shelterBias}`,
    baseScenario.natureBias === comparedScenario.natureBias
      ? null
      : `natureBias:${baseScenario.natureBias}->${comparedScenario.natureBias}`,
    baseScenario.quietAreaBias === comparedScenario.quietAreaBias
      ? null
      : `quietAreaBias:${baseScenario.quietAreaBias}->${comparedScenario.quietAreaBias}`,
  ].filter((value): value is string => value !== null)
}

function buildCoordinateDifferences(
  baseScenario: WorldLayoutVariationScenarioAudit,
  comparedScenario: WorldLayoutVariationScenarioAudit
): string[] {
  return [
    buildCoordinateDifference(
      "shelter",
      baseScenario.metrics.shelterCoordinate,
      comparedScenario.metrics.shelterCoordinate
    ),
    buildCoordinateDifference(
      "storage",
      baseScenario.metrics.storageCoordinate,
      comparedScenario.metrics.storageCoordinate
    ),
    buildCoordinateDifference(
      "butler",
      baseScenario.metrics.butlerCoordinate,
      comparedScenario.metrics.butlerCoordinate
    ),
  ].filter((value): value is string => value !== null)
}

function buildCoordinateDifference(
  label: string,
  baseCoordinate: string,
  comparedCoordinate: string
): string | null {
  if (baseCoordinate === comparedCoordinate) return null

  return `${label}:${baseCoordinate}->${comparedCoordinate}`
}

function buildMetricDifferences(
  baseScenario: WorldLayoutVariationScenarioAudit,
  comparedScenario: WorldLayoutVariationScenarioAudit
): string[] {
  return [
    buildMetricDifference(
      "pathLength",
      baseScenario.metrics.pathLength,
      comparedScenario.metrics.pathLength
    ),
    buildMetricDifference(
      "natureCount",
      baseScenario.metrics.natureCount,
      comparedScenario.metrics.natureCount
    ),
    buildMetricDifference(
      "surfaceDecorationCount",
      baseScenario.metrics.surfaceDecorationCount,
      comparedScenario.metrics.surfaceDecorationCount
    ),
    buildMetricDifference(
      "supportGroundCount",
      baseScenario.metrics.supportGroundCount,
      comparedScenario.metrics.supportGroundCount
    ),
    buildMetricDifference(
      "compactSupportScore",
      baseScenario.metrics.compactSupportScore,
      comparedScenario.metrics.compactSupportScore
    ),
  ].filter((value): value is string => value !== null)
}

function buildMetricDifference(
  label: string,
  baseValue: number,
  comparedValue: number
): string | null {
  if (baseValue === comparedValue) return null

  return `${label}:${baseValue}->${comparedValue}`
}

function buildVariationMetrics(
  placements: MapPlacement[]): WorldLayoutVariationMetrics {
  const layerCounts = buildLayerCounts(placements)
  const shelter = findPlacement(placements, "temporary-shelter")
  const storage = findPlacement(placements, "storage-box")
  const butler = findPlacement(placements, "butler-near-shelter")
  const supportGroundCount = placements.filter((placement) =>
    placement.tags.includes("ground_support")
  ).length

  return {
    totalPlacements: placements.length,
    layerCounts,
    pathLength: layerCounts.path,
    natureCount: layerCounts.nature,
    surfaceDecorationCount: layerCounts["surface-decoration"],
    supportGroundCount,
    compactSupportScore: supportGroundCount,
    shelterCoordinate: coordinateOf(shelter),
    storageCoordinate: coordinateOf(storage),
    butlerCoordinate: coordinateOf(butler),
  }
}

function buildLayerCounts(placements: MapPlacement[]): WorldLayoutLayerCounts {
  const counts: WorldLayoutLayerCounts = {
    ground: 0,
    path: 0,
    edge: 0,
    zone: 0,
    structure: 0,
    facility: 0,
    nature: 0,
    "surface-decoration": 0,
    actor: 0,
    atmosphere: 0,
  }

  placements.forEach((placement) => {
    counts[placement.layer] += 1
  })

  return counts
}

function buildPlacementFingerprint(placements: MapPlacement[]): string {
  return placements
    .map((placement) =>
      [
        placement.id,
        placement.assetId,
        placement.layer,
        placement.x,
        placement.y,
        placement.scale,
        placement.alpha,
        placement.tags.join("+"),
      ].join(":")
    )
    .sort()
    .join("|")
}

export function buildInitialHomeLayoutFingerprint(input: {
  zones: HomeZone[]
  placements: MapPlacement[]
}): string {
  return [
    buildZoneFingerprint(input.zones),
    buildPlacementFingerprint(input.placements),
  ].join("::")
}

function buildZoneFingerprint(zones: HomeZone[]): string {
  return zones
    .map((zone) =>
      [
        zone.id,
        zone.type,
        zone.bounds.x,
        zone.bounds.y,
        zone.bounds.width,
        zone.bounds.height,
        zone.tags.join("+"),
      ].join(":")
    )
    .sort()
    .join("|")
}

function findPlacement(
  placements: MapPlacement[],
  id: string
): MapPlacement | undefined {
  return placements.find((placement) => placement.id === id)
}

function coordinateOf(placement: MapPlacement | undefined): string {
  if (!placement) return "missing"

  return `${placement.x},${placement.y}`
}

function toHomeZone(
  area: InitialHomeAreaRecipe,
  layoutInput: WorldLayoutGenerationInput
): HomeZone {
  const offset = layoutInput.selectedCandidate.zoneOffsets[area.areaType] ?? {
    x: 0,
    y: 0,
  }

  return {
    id: area.id,
    type: area.areaType,
    name: area.name,
    purpose: area.purpose,
    bounds: getAreaBounds(area, offset),
    tags: [
      ...area.tags,
      "layout_candidate_zone",
      layoutInput.selectedCandidate.candidateId,
      layoutInput.biome.biomeType,
    ],
  }
}

function getAreaBounds(area: InitialHomeAreaRecipe, offset: { x: number; y: number }) {
  return {
    x: area.center.x + offset.x - Math.floor(area.size.width / 2),
    y: area.center.y + offset.y - Math.floor(area.size.height / 2),
    width: area.size.width,
    height: area.size.height,
  }
}

export function summarizeWorldLayoutVariationAudit(
  audit: WorldLayoutVariationAudit
): string[] {
  return [
    `scenarioCount:${audit.scenarioCount}`,
    `stableScenarioCount:${audit.stableScenarioCount}`,
    `pairCount:${audit.pairCount}`,
    `passedPairCount:${audit.passedPairCount}`,
    `warningCount:${audit.warnings.length}`,
  ]
}

export function assertWorldLayoutVariationAuditPassed(
  audit: WorldLayoutVariationAudit
): boolean {
  return (
    audit.scenarioCount > 1 &&
    audit.scenarioCount === audit.stableScenarioCount &&
    audit.pairCount === audit.passedPairCount &&
    audit.warnings.length === 0
  )
}

export function getWorldLayoutVariationMapSize(): HomeMapSize {
  return INITIAL_HOME_SCENE_RECIPE.mapSize
}