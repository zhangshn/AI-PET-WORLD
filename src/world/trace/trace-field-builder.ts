import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { clamp } from "@/world/procedural-painter/scene-composer/scene-composer-random"
import type {
  SpaceCell,
  SpaceGrid,
  SpaceRegionKind,
  SpaceTerrainKind,
} from "@/world/space"

import {
  normalizeTraceStrength,
  resolveTraceAge,
  resolveTraceLifecyclePhase,
  resolveTraceStrengthLevel,
} from "./trace-lifecycle"
import { summarizeTraceField } from "./trace-summary"
import type {
  TraceArea,
  TraceAudit,
  TraceEffects,
  TraceEvidenceLevel,
  TraceFact,
  TraceField,
  TraceScope,
  TraceSourceKind,
  TraceSourceReliability,
  TraceTargetRef,
  TraceType,
  TraceVisualHints,
  TraceVisualKind,
} from "./trace-schema"

export type BuildTraceFieldFromWorldInput = {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
}

export function buildTraceFieldFromWorld(
  input: BuildTraceFieldFromWorldInput
): TraceField {
  const traces = buildRegionTraces(input)
  const traceFieldWithoutSummary = {
    id: `trace_field_${input.homeMapState.worldId}`,
    worldId: input.homeMapState.worldId,
    traces,
    projectedCellIds: uniqueStrings(
      traces.flatMap((trace) => trace.relatedCellIds)
    ),
  }

  return {
    ...traceFieldWithoutSummary,
    summary: summarizeTraceField(traceFieldWithoutSummary),
  }
}

function buildRegionTraces(input: BuildTraceFieldFromWorldInput): TraceFact[] {
  const regionKinds = Array.from(
    new Set(input.spaceGrid.cells.map((cell) => cell.regionKind))
  )

  return regionKinds.flatMap((regionKind) => {
    const regionCells = input.spaceGrid.cells.filter(
      (cell) => cell.regionKind === regionKind
    )
    return [
      buildSpatialUseTrace({
        ...input,
        regionKind,
        regionCells,
      }),
      buildMovementTrace({
        ...input,
        regionKind,
        regionCells,
      }),
      buildEcologyChangeTrace({
        ...input,
        regionKind,
        regionCells,
      }),
    ].filter((trace): trace is TraceFact => Boolean(trace))
  })
}

function buildSpatialUseTrace(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  regionKind: SpaceRegionKind
  regionCells: SpaceCell[]
}): TraceFact | null {
  const signalCells = input.regionCells.filter(
    (cell) =>
      cell.occupancyKind !== "empty" ||
      cell.traceStrength >= 38 ||
      (cell.passability !== "blocked" && cell.movementCost >= 72)
  )

  if (signalCells.length === 0) {
    return null
  }

  const occupiedRatio =
    signalCells.filter((cell) => cell.occupancyKind !== "empty").length /
    Math.max(1, input.regionCells.length)
  const costSignal = average(
    signalCells
      .filter((cell) => cell.passability !== "blocked")
      .map((cell) => cell.movementCost)
  )
  const strength = normalizeTraceStrength(
    average(signalCells.map((cell) => cell.traceStrength)) * 0.4 +
      occupiedRatio * 100 * 0.35 +
      costSignal * 0.25
  )

  return buildTraceFact({
    homeMapState: input.homeMapState,
    type: "spatial_use",
    sourceKind: "space_projection",
    strength,
    cells: signalCells,
    relatedPlacementIds: uniqueStrings(
      signalCells.flatMap((cell) => cell.occupancyIds)
    ),
    regionKind: input.regionKind,
    tags: ["space_projection", "spatial_use"],
  })
}

function buildMovementTrace(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  regionKind: SpaceRegionKind
  regionCells: SpaceCell[]
}): TraceFact | null {
  const signalCells = input.regionCells.filter((cell) => cell.traceStrength > 0)

  if (signalCells.length === 0) {
    return null
  }

  const relatedMovementPlacementIds = resolveMovementCompatibilityPlacementIds({
    homeMapState: input.homeMapState,
    spaceGrid: input.spaceGrid,
    regionKind: input.regionKind,
  })
  const sourceKind: TraceSourceKind =
    relatedMovementPlacementIds.length > 0
      ? "movement_compatibility_input"
      : "space_projection"
  const strength = normalizeTraceStrength(
    average(signalCells.map((cell) => cell.traceStrength)) * 0.72 +
      Math.max(...signalCells.map((cell) => cell.traceStrength)) * 0.28
  )

  return buildTraceFact({
    homeMapState: input.homeMapState,
    type: "movement",
    sourceKind,
    strength,
    cells: signalCells,
    relatedPlacementIds: relatedMovementPlacementIds,
    regionKind: input.regionKind,
    tags: ["movement_trace", sourceKind],
  })
}

function buildEcologyChangeTrace(input: {
  homeMapState: HomeMapState
  regionKind: SpaceRegionKind
  regionCells: SpaceCell[]
}): TraceFact | null {
  const resources = input.homeMapState.resources
  const ecologyStress = Math.max(
    0,
    100 - resources.groundHealth,
    100 - resources.naturalGrowth,
    resources.spacePressure
  )
  const regionEcologySignal =
    average(input.regionCells.map((cell) => 100 - cell.ecologyHealthHint)) * 0.5 +
    ecologyStress * 0.5
  const strength = normalizeTraceStrength(regionEcologySignal)

  if (strength < 18) {
    return null
  }

  return buildTraceFact({
    homeMapState: input.homeMapState,
    type: "ecology_change",
    sourceKind: "ecology_state",
    strength,
    cells: input.regionCells,
    relatedPlacementIds: [],
    regionKind: input.regionKind,
    tags: ["ecology_state", "ecology_change"],
    ecologyHealthHint: average(
      input.regionCells.map((cell) => cell.ecologyHealthHint)
    ),
  })
}

function buildTraceFact(input: {
  homeMapState: HomeMapState
  type: TraceType
  sourceKind: TraceSourceKind
  strength: number
  cells: SpaceCell[]
  relatedPlacementIds: string[]
  regionKind: SpaceRegionKind
  tags: string[]
  ecologyHealthHint?: number
}): TraceFact {
  const strength = normalizeTraceStrength(input.strength)
  const age = resolveTraceAge({
    createdAt: input.homeMapState.createdAt,
    updatedAt: input.homeMapState.updatedAt,
  })
  const area = buildTraceArea(input.cells)
  const target = buildTraceTarget(input)
  const scope = buildTraceScope({
    cells: input.cells,
    relatedPlacementIds: input.relatedPlacementIds,
    regionKind: input.regionKind,
    target,
  })
  const fallback = input.cells.some((cell) => cell.regionSource === "fallback")
  const evidenceLevel = resolveEvidenceLevel({
    confidence: resolveConfidence({
      strength,
      cellCount: input.cells.length,
      sourceKind: input.sourceKind,
    }),
    sourceKind: input.sourceKind,
    fallback,
  })
  const sourceReliability = resolveSourceReliability({
    sourceKind: input.sourceKind,
    fallback,
  })
  const derivedFrom = buildDerivedFrom({
    cells: input.cells,
    relatedPlacementIds: input.relatedPlacementIds,
    sourceKind: input.sourceKind,
  })
  const generationReason = buildGenerationReason({
    type: input.type,
    sourceKind: input.sourceKind,
    regionKind: input.regionKind,
    strength,
  })
  const warnings = buildTraceWarnings({
    fallback,
    relatedPlacementIds: input.relatedPlacementIds,
  })
  const confidence = resolveConfidence({
    strength,
    cellCount: input.cells.length,
    sourceKind: input.sourceKind,
  })
  const audit: TraceAudit = {
    evidenceLevel,
    sourceReliability,
    derivedFrom,
    generationReason,
    warnings,
    tags: uniqueStrings([
      "trace_audit",
      `evidence:${evidenceLevel}`,
      `reliability:${sourceReliability}`,
    ]),
  }

  return {
    id: `trace_${input.homeMapState.worldId}_${input.type}_${input.regionKind}`,
    type: input.type,
    sourceKind: input.sourceKind,
    lifecyclePhase: resolveTraceLifecyclePhase({
      strength,
      age,
      sourceKind: input.sourceKind,
      ecologyHealthHint: input.ecologyHealthHint,
    }),
    strength,
    strengthLevel: resolveTraceStrengthLevel(strength),
    age,
    confidence,
    area,
    target,
    anchor: {
      primary: target,
      secondary: buildSecondaryTargets(input.relatedPlacementIds),
      fallback,
      reason: generationReason,
    },
    scope,
    relatedCellIds: input.cells.map((cell) => cell.id),
    relatedPlacementIds: input.relatedPlacementIds,
    regionKinds: [input.regionKind],
    terrainKinds: uniqueTerrainKinds(input.cells),
    effects: buildTraceEffects({
      type: input.type,
      strength,
      ecologyHealthHint: input.ecologyHealthHint,
    }),
    visualHints: buildTraceVisualHints({
      type: input.type,
      strength,
      lifecyclePhase: resolveTraceLifecyclePhase({
        strength,
        age,
        sourceKind: input.sourceKind,
        ecologyHealthHint: input.ecologyHealthHint,
      }),
      terrainKinds: uniqueTerrainKinds(input.cells),
    }),
    evidenceLevel,
    sourceReliability,
    derivedFrom,
    createdAtTick: input.homeMapState.createdAt || 0,
    updatedAtTick: input.homeMapState.updatedAt || 0,
    lastReinforcedTick: input.homeMapState.updatedAt || 0,
    generationReason,
    warnings,
    audit,
    tags: uniqueStrings([
      ...input.tags,
      `region:${input.regionKind}`,
      `type:${input.type}`,
      `source:${input.sourceKind}`,
    ]),
  }
}

function buildTraceTarget(input: {
  homeMapState: HomeMapState
  type: TraceType
  cells: SpaceCell[]
  relatedPlacementIds: string[]
  regionKind: SpaceRegionKind
}): TraceTargetRef {
  const firstCell = input.cells[0]
  const regionId = firstCell?.regionId ?? `region:${input.regionKind}`
  const regionName = firstCell?.regionName ?? input.regionKind

  if (
    input.relatedPlacementIds.length > 0 &&
    (input.type === "construction_maintenance" ||
      input.type === "relationship_interaction")
  ) {
    return {
      kind: "placement",
      id: input.relatedPlacementIds[0],
      label: `Placement ${input.relatedPlacementIds[0]}`,
    }
  }

  return {
    kind: "region",
    id: regionId,
    label: regionName,
  }
}

function buildSecondaryTargets(placementIds: string[]): TraceTargetRef[] {
  return placementIds.map((placementId) => ({
    kind: "placement",
    id: placementId,
    label: `Placement ${placementId}`,
  }))
}

function buildTraceScope(input: {
  cells: SpaceCell[]
  relatedPlacementIds: string[]
  regionKind: SpaceRegionKind
  target: TraceTargetRef
}): TraceScope {
  const targetKinds = uniqueStrings([
    input.target.kind,
    ...input.relatedPlacementIds.map(() => "placement"),
  ]) as TraceScope["targetKinds"]

  return {
    kind: input.relatedPlacementIds.length > 0 ? "object_level" : "region_level",
    targetKinds,
    cellIds: input.cells.map((cell) => cell.id),
    placementIds: input.relatedPlacementIds,
    regionKinds: [input.regionKind],
    terrainKinds: uniqueTerrainKinds(input.cells),
  }
}

function buildTraceEffects(input: {
  type: TraceType
  strength: number
  ecologyHealthHint?: number
}): TraceEffects {
  const weight = Number((input.strength / 100).toFixed(2))
  const ecologyStress =
    input.ecologyHealthHint === undefined
      ? 0
      : Number(((50 - input.ecologyHealthHint) / 100).toFixed(2))

  if (input.type === "movement") {
    return emptyEffects({
      movementCostDelta: -4 * weight,
      familiarityDelta: 8 * weight,
      memoryWeightDelta: 5 * weight,
      visualIntensityDelta: 10 * weight,
    })
  }

  if (input.type === "ecology_change") {
    return emptyEffects({
      ecologyHealthDelta: ecologyStress * 10,
      maintenancePriorityDelta: 6 * weight,
      memoryWeightDelta: 4 * weight,
      visualIntensityDelta: 8 * weight,
    })
  }

  if (input.type === "construction_maintenance") {
    return emptyEffects({
      maintenancePriorityDelta: 8 * weight,
      safetyFeelingDelta: 3 * weight,
      visualIntensityDelta: 6 * weight,
    })
  }

  if (input.type === "relationship_interaction") {
    return emptyEffects({
      safetyFeelingDelta: 5 * weight,
      relationshipWeightDelta: 8 * weight,
      memoryWeightDelta: 6 * weight,
      visualIntensityDelta: 4 * weight,
    })
  }

  if (input.type === "emotion_attention") {
    return emptyEffects({
      safetyFeelingDelta: 4 * weight,
      relationshipWeightDelta: 5 * weight,
      memoryWeightDelta: 7 * weight,
      visualIntensityDelta: 7 * weight,
    })
  }

  if (input.type === "time_passage") {
    return emptyEffects({
      maintenancePriorityDelta: 4 * weight,
      visualIntensityDelta: 5 * weight,
      memoryWeightDelta: 3 * weight,
    })
  }

  return emptyEffects({
    familiarityDelta: 5 * weight,
    behaviorProbabilityDelta: 3 * weight,
    memoryWeightDelta: 4 * weight,
    visualIntensityDelta: 5 * weight,
  })
}

function emptyEffects(
  overrides: Partial<TraceEffects> = {}
): TraceEffects {
  return {
    movementCostDelta: 0,
    familiarityDelta: 0,
    ecologyHealthDelta: 0,
    safetyFeelingDelta: 0,
    maintenancePriorityDelta: 0,
    behaviorProbabilityDelta: 0,
    memoryWeightDelta: 0,
    visualIntensityDelta: 0,
    relationshipWeightDelta: 0,
    ...overrides,
  }
}

function buildTraceVisualHints(input: {
  type: TraceType
  strength: number
  lifecyclePhase: TraceFact["lifecyclePhase"]
  terrainKinds: SpaceTerrainKind[]
}): TraceVisualHints {
  const visualKind = resolveVisualKind(input)
  const intensity = clamp(Math.round(input.strength), 0, 100)

  return {
    visualKind,
    intensity,
    opacityHint: Number((intensity / 100).toFixed(2)),
    layerHint: visualKind === "none" ? "none" : "surface",
    textureHint: visualKind === "none" ? undefined : visualKind,
    colorMoodHint: resolveColorMoodHint(input.type),
    animationHint: input.type === "emotion_attention" ? "pulse" : "none",
    displayPriority: resolveDisplayPriority(input.type, input.strength),
    userFacingLabel: resolveUserFacingLabel(input.type),
    productSafeDescription: resolveProductSafeDescription(input.type),
  }
}

function resolveVisualKind(input: {
  type: TraceType
  lifecyclePhase: TraceFact["lifecyclePhase"]
  terrainKinds: SpaceTerrainKind[]
}): TraceVisualKind {
  if (input.lifecyclePhase === "repaired") return "repaired_ground"
  if (input.lifecyclePhase === "covered") return "faded_area"
  if (input.type === "movement") return "worn_ground"
  if (input.type === "ecology_change") {
    return input.terrainKinds.includes("wetland") ? "moss" : "exposed_soil"
  }
  if (input.type === "construction_maintenance") return "maintained_area"
  if (input.type === "relationship_interaction") return "comfort_spot"
  if (input.type === "behavior_activity") return "waiting_spot"
  if (input.type === "emotion_attention") return "attention_glow"
  if (input.type === "time_passage") return "faded_area"
  if (input.type === "spatial_use") return "flattened_grass"

  return "none"
}

function resolveColorMoodHint(type: TraceType): string {
  if (type === "ecology_change") return "earth"
  if (type === "relationship_interaction") return "warm"
  if (type === "emotion_attention") return "soft_focus"
  if (type === "time_passage") return "muted"

  return "natural"
}

function resolveDisplayPriority(type: TraceType, strength: number): number {
  const typePriority =
    type === "event_impact"
      ? 18
      : type === "emotion_attention"
        ? 14
        : type === "movement"
          ? 12
          : 8

  return clamp(typePriority + Math.round(strength / 12), 0, 30)
}

function resolveUserFacingLabel(type: TraceType): string {
  if (type === "spatial_use") return "Spatial use trace"
  if (type === "movement") return "Movement trace"
  if (type === "ecology_change") return "Ecology change trace"
  if (type === "behavior_activity") return "Behavior activity trace"
  if (type === "construction_maintenance") return "Construction maintenance trace"
  if (type === "relationship_interaction") return "Relationship interaction trace"
  if (type === "emotion_attention") return "Emotion attention trace"
  if (type === "time_passage") return "Time passage trace"

  return "Event impact trace"
}

function resolveProductSafeDescription(type: TraceType): string {
  if (type === "movement") return "A derived hint for frequently used ground."
  if (type === "ecology_change") return "A derived hint for ecological change."
  if (type === "emotion_attention") return "A derived hint for attention."

  return `A derived ${type} trace hint.`
}

function resolveEvidenceLevel(input: {
  confidence: number
  sourceKind: TraceSourceKind
  fallback: boolean
}): TraceEvidenceLevel {
  if (input.fallback) return "low"
  if (
    input.confidence >= 72 ||
    input.sourceKind === "movement_compatibility_input"
  ) {
    return "high"
  }

  return input.confidence >= 42 ? "medium" : "low"
}

function resolveSourceReliability(input: {
  sourceKind: TraceSourceKind
  fallback: boolean
}): TraceSourceReliability {
  if (input.fallback) return "fallback"
  if (
    input.sourceKind === "movement_compatibility_input" ||
    input.sourceKind === "placement_state"
  ) {
    return "observed"
  }
  if (input.sourceKind === "world_event") return "explicit"

  return "derived"
}

function buildDerivedFrom(input: {
  cells: SpaceCell[]
  relatedPlacementIds: string[]
  sourceKind: TraceSourceKind
}): string[] {
  return uniqueStrings([
    "HomeMapState",
    "SpaceGrid",
    `source:${input.sourceKind}`,
    ...input.cells.map((cell) => `cell:${cell.id}`),
    ...input.relatedPlacementIds.map((placementId) => `placement:${placementId}`),
  ])
}

function buildGenerationReason(input: {
  type: TraceType
  sourceKind: TraceSourceKind
  regionKind: SpaceRegionKind
  strength: number
}): string {
  return `${input.type} trace derived from ${input.sourceKind} in ${input.regionKind} with strength ${input.strength}.`
}

function buildTraceWarnings(input: {
  fallback: boolean
  relatedPlacementIds: string[]
}): string[] {
  return [
    input.fallback ? "Trace uses fallback region projection." : "",
    "createdAtTick and updatedAtTick mirror HomeMapState timestamps until persisted trace ticks exist.",
    input.relatedPlacementIds.length === 0
      ? "Trace has no direct placement anchor."
      : "",
  ].filter(Boolean)
}

function resolveMovementCompatibilityPlacementIds(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  regionKind: SpaceRegionKind
}): string[] {
  return input.homeMapState.placements
    .filter(isMovementTraceCompatibilityPlacement)
    .filter((placement) => {
      const cell = findNearestCell(input.spaceGrid, placement)
      return cell?.regionKind === input.regionKind
    })
    .map((placement) => placement.id)
}

function findNearestCell(
  spaceGrid: SpaceGrid,
  placement: MapPlacement
): SpaceCell | undefined {
  const usesGridUnits =
    placement.x <= spaceGrid.columns && placement.y <= spaceGrid.rows
  const x = usesGridUnits
    ? (placement.x - 0.5) * spaceGrid.tileSize
    : placement.x
  const y = usesGridUnits
    ? (placement.y - 0.5) * spaceGrid.tileSize
    : placement.y

  return spaceGrid.cells.reduce<SpaceCell | undefined>((nearestCell, cell) => {
    if (!nearestCell) return cell

    const currentDistance = Math.hypot(cell.x - x, cell.y - y)
    const nearestDistance = Math.hypot(nearestCell.x - x, nearestCell.y - y)
    return currentDistance < nearestDistance ? cell : nearestCell
  }, undefined)
}

function buildTraceArea(cells: SpaceCell[]): TraceArea {
  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  const maxX = Math.max(...cells.map((cell) => cell.x))
  const maxY = Math.max(...cells.map((cell) => cell.y))
  const x = average(cells.map((cell) => cell.x))
  const y = average(cells.map((cell) => cell.y))
  const radius = clamp(
    Math.round(Math.max(maxX - minX, maxY - minY) / 2),
    1,
    9999
  )

  return {
    x,
    y,
    radius,
    minX,
    minY,
    maxX,
    maxY,
  }
}

function resolveConfidence(input: {
  strength: number
  cellCount: number
  sourceKind: TraceSourceKind
}): number {
  const sourceBonus =
    input.sourceKind === "movement_compatibility_input"
      ? 12
      : input.sourceKind === "ecology_state"
        ? 8
        : 4

  return clamp(Math.round(input.strength * 0.62 + input.cellCount + sourceBonus), 0, 100)
}

function uniqueTerrainKinds(cells: SpaceCell[]): SpaceTerrainKind[] {
  return Array.from(new Set(cells.map((cell) => cell.terrainKind)))
}

function isMovementTraceCompatibilityPlacement(placement: MapPlacement): boolean {
  return placement.layer === "path" || placement.tags.includes("path")
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  )
}
