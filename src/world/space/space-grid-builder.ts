import type {
  HomeMapState,
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { clamp } from "@/world/procedural-painter/scene-composer/scene-composer-random"
import type { TraceField } from "@/world/trace"

import type {
  SpaceCell,
  SpaceFamiliarityLevel,
  SpaceGrid,
  SpaceMovementCostFactor,
  SpaceOccupancy,
  SpaceOccupancyKind,
  SpacePassability,
  SpacePassabilitySource,
  SpaceRegion,
  SpaceRegionKind,
  SpaceRegionSource,
  SpaceTerrainKind,
  SpaceTraceStrength,
} from "./space-schema"
import { summarizeSpaceGrid } from "./space-summary"
import { buildTraceInfluenceForSpaceGrid } from "./space-trace-influence"

export type BuildSpaceGridFromHomeMapStateInput = {
  homeMapState: HomeMapState
  traceField?: TraceField
}

type IndexedPlacement = {
  placement: MapPlacement
  column: number
  row: number
}

type IndexedZone = {
  zone: HomeZone
  minColumn: number
  maxColumn: number
  minRow: number
  maxRow: number
  kind: SpaceRegionKind
  priority: number
  area: number
}

type RegionResolution = {
  regionId: string
  regionKind: SpaceRegionKind
  regionName: string
  regionSource: SpaceRegionSource
  zoneId?: string
}

type PassabilityResolution = {
  passability: SpacePassability
  passable: boolean
  blockedReason?: string
  passabilitySource: SpacePassabilitySource
}

type MovementCostResolution = {
  baseMoveCost: number
  movementCost: number
  movementCostFactors: SpaceMovementCostFactor[]
}

export function buildSpaceGridFromHomeMapState(
  input: BuildSpaceGridFromHomeMapStateInput
): SpaceGrid {
  const { homeMapState } = input
  const columns = Math.max(1, Math.round(homeMapState.mapSize.columns))
  const rows = Math.max(1, Math.round(homeMapState.mapSize.rows))
  const tileSize = Math.max(1, Math.round(homeMapState.mapSize.tileSize))
  const indexedPlacements = homeMapState.placements.map((placement) =>
    indexPlacement(placement, {
      columns,
      rows,
      tileSize,
    })
  )
  const indexedZones = homeMapState.zones.map((zone) =>
    indexZone(zone, { columns, rows })
  )
  const cells: SpaceCell[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellPlacements = indexedPlacements
        .filter((indexedPlacement) =>
          isPlacementOccupyingCell(indexedPlacement, {
            row,
            column,
          })
        )
        .map((indexedPlacement) => indexedPlacement.placement)
      const region = resolveRegion({
        row,
        column,
        rows,
        columns,
        indexedZones,
      })
      const occupancy = resolveOccupancy(cellPlacements)
      const occupancyKind = resolveOccupancyKind(occupancy)
      const terrainKind = resolveTerrainKind({
        homeMapState,
        regionKind: region.regionKind,
        occupancyKind,
      })
      const traceStrength = resolveTraceStrength({
        homeMapState,
        indexedPlacements,
        row,
        column,
      })
      const passability = resolvePassability({
        regionKind: region.regionKind,
        occupancy,
        occupancyKind,
      })
      const moistureHint = resolveMoistureHint(homeMapState)
      const ecologyHealthHint = resolveEcologyHealthHint(homeMapState)
      const movementCost = resolveMovementCost({
        terrainKind,
        passability,
        occupancy,
        traceStrength,
        spacePressure: homeMapState.resources.spacePressure,
        humidity: moistureHint,
        ecologyHealth: ecologyHealthHint,
      })
      const coordinate = {
        x: column * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2,
        z: resolveZLayer({ occupancyKind, regionKind: region.regionKind }),
        layer: resolveZLayer({ occupancyKind, regionKind: region.regionKind }),
      }

      cells.push({
        id: `space_cell_${column}_${row}`,
        ...coordinate,
        coordinate,
        row,
        column,
        regionId: region.regionId,
        regionType: region.regionKind,
        regionName: region.regionName,
        regionSource: region.regionSource,
        regionKind: region.regionKind,
        terrainKind,
        passability: passability.passability,
        passable: passability.passable,
        blockedReason: passability.blockedReason,
        passabilitySource: passability.passabilitySource,
        baseMoveCost: movementCost.baseMoveCost,
        movementCost: movementCost.movementCost,
        movementCostFactors: movementCost.movementCostFactors,
        occupancyKind,
        occupancy,
        occupancyIds: occupancy.map((item) => item.placementId),
        traceStrength,
        traceLevel: resolveTraceLevel(traceStrength),
        traceInfluenceStrength: 0,
        traceInfluenceFactors: [],
        familiarity: 0,
        familiarityLevel: "unknown",
        humidity: moistureHint,
        ecologyHealth: ecologyHealthHint,
        moistureHint,
        ecologyHealthHint,
      })
    }
  }

  const partialGridWithoutTrace: SpaceGrid = {
    id: `space_grid_${homeMapState.worldId}`,
    worldId: homeMapState.worldId,
    columns,
    rows,
    tileSize,
    width: columns * tileSize,
    height: rows * tileSize,
    cells,
    regions: buildSpaceRegions(cells),
    summary: emptySummary(),
  }
  const traceInfluence = buildTraceInfluenceForSpaceGrid({
    spaceGrid: partialGridWithoutTrace,
    traceField: input.traceField,
  })
  const influencedCells = applyTraceInfluenceToCells({
    cells,
    traceInfluenceByCellId: traceInfluence.traceInfluenceByCellId,
  })
  const partialGrid: SpaceGrid = {
    ...partialGridWithoutTrace,
    cells: influencedCells,
    regions: buildSpaceRegions(influencedCells),
    traceInfluenceSummary: input.traceField ? traceInfluence.summary : undefined,
  }

  return {
    ...partialGrid,
    summary: summarizeSpaceGrid(partialGrid),
  }
}

function applyTraceInfluenceToCells(input: {
  cells: SpaceCell[]
  traceInfluenceByCellId: ReturnType<
    typeof buildTraceInfluenceForSpaceGrid
  >["traceInfluenceByCellId"]
}): SpaceCell[] {
  return input.cells.map((cell) => {
    const influence = input.traceInfluenceByCellId[cell.id]

    if (!influence) return cell

    const movementCostBeforeTrace = cell.movementCost
    const canApplyMovementDelta =
      cell.passability !== "blocked" && cell.passability !== "unknown"
    const movementCostAfterTrace = canApplyMovementDelta
      ? clamp(movementCostBeforeTrace + influence.movementCostDelta, 12, 180)
      : movementCostBeforeTrace
    const familiarity = clamp(
      Math.round((cell.familiarity ?? 0) + influence.familiarityDelta),
      0,
      100
    )
    const traceStrength = clamp(
      Math.max(cell.traceStrength, influence.strength),
      0,
      100
    )
    const movementCostFactors =
      canApplyMovementDelta && influence.factors.length > 0
        ? [
            ...cell.movementCostFactors,
            {
              source: "trace_effect" as const,
              amount: movementCostAfterTrace - movementCostBeforeTrace,
              reason: `trace_effect:${influence.factors
                .map((factor) => factor.traceId)
                .join("+")}`,
            },
          ]
        : cell.movementCostFactors

    return {
      ...cell,
      movementCost: movementCostAfterTrace,
      movementCostFactors,
      traceStrength,
      traceLevel: resolveTraceLevel(traceStrength),
      traceInfluenceStrength: influence.strength,
      traceInfluenceFactors: influence.factors,
      movementCostBeforeTrace,
      movementCostAfterTrace,
      familiarity,
      familiarityLevel: resolveFamiliarityLevel(familiarity),
    }
  })
}

function resolveFamiliarityLevel(value: number): SpaceFamiliarityLevel {
  if (value >= 72) return "habitual"
  if (value >= 52) return "trusted"
  if (value >= 28) return "familiar"
  if (value > 0) return "noticed"

  return "unknown"
}

function indexPlacement(
  placement: MapPlacement,
  input: {
    columns: number
    rows: number
    tileSize: number
  }
): IndexedPlacement {
  const column =
    placement.x <= input.columns
      ? Math.round(placement.x) - 1
      : Math.floor(placement.x / input.tileSize)
  const row =
    placement.y <= input.rows
      ? Math.round(placement.y) - 1
      : Math.floor(placement.y / input.tileSize)

  return {
    placement,
    column: clamp(column, 0, input.columns - 1),
    row: clamp(row, 0, input.rows - 1),
  }
}

function indexZone(
  zone: HomeZone,
  input: {
    columns: number
    rows: number
  }
): IndexedZone {
  const minColumn = clamp(Math.round(zone.bounds.x) - 1, 0, input.columns - 1)
  const minRow = clamp(Math.round(zone.bounds.y) - 1, 0, input.rows - 1)
  const maxColumn = clamp(
    Math.round(zone.bounds.x + zone.bounds.width - 1) - 1,
    minColumn,
    input.columns - 1
  )
  const maxRow = clamp(
    Math.round(zone.bounds.y + zone.bounds.height - 1) - 1,
    minRow,
    input.rows - 1
  )

  return {
    zone,
    minColumn,
    maxColumn,
    minRow,
    maxRow,
    kind: resolveZoneRegionKind(zone),
    priority: resolveZonePriority(zone),
    area: Math.max(1, (maxColumn - minColumn + 1) * (maxRow - minRow + 1)),
  }
}

function isPlacementOccupyingCell(
  indexedPlacement: IndexedPlacement,
  cell: {
    row: number
    column: number
  }
): boolean {
  const radius = resolveOccupancyRadius(indexedPlacement.placement)
  return (
    Math.abs(indexedPlacement.column - cell.column) <= radius &&
    Math.abs(indexedPlacement.row - cell.row) <= radius
  )
}

function resolveOccupancyRadius(placement: MapPlacement): number {
  if (placement.layer === "structure") return 1
  if (placement.layer === "facility") return 1
  if (placement.layer === "nature" && placement.scale > 1.1) return 1

  return 0
}

function resolveRegion(input: {
  row: number
  column: number
  rows: number
  columns: number
  indexedZones: IndexedZone[]
}): RegionResolution {
  if (
    input.row === 0 ||
    input.column === 0 ||
    input.row === input.rows - 1 ||
    input.column === input.columns - 1
  ) {
    return {
      regionId: "boundary:map-edge",
      regionKind: "boundary",
      regionName: labelForRegionKind("boundary"),
      regionSource: "boundary",
    }
  }

  const zone = findZoneForCell({
    row: input.row,
    column: input.column,
    indexedZones: input.indexedZones,
  })

  if (zone) {
    return {
      regionId: `zone:${zone.zone.id}`,
      regionKind: zone.kind,
      regionName: zone.zone.name || labelForRegionKind(zone.kind),
      regionSource: "home_map_zone",
      zoneId: zone.zone.id,
    }
  }

  return resolveFallbackRegion({
    row: input.row,
    column: input.column,
    rows: input.rows,
    columns: input.columns,
  })
}

function findZoneForCell(input: {
  row: number
  column: number
  indexedZones: IndexedZone[]
}): IndexedZone | null {
  const matches = input.indexedZones.filter(
    (indexedZone) =>
      input.column >= indexedZone.minColumn &&
      input.column <= indexedZone.maxColumn &&
      input.row >= indexedZone.minRow &&
      input.row <= indexedZone.maxRow
  )

  if (matches.length === 0) return null

  return matches.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }

    return left.area - right.area
  })[0]
}

function resolveFallbackRegion(input: {
  row: number
  column: number
  rows: number
  columns: number
}): RegionResolution {
  const xRatio = (input.column + 0.5) / input.columns
  const yRatio = (input.row + 0.5) / input.rows
  const centerDistance = Math.hypot(xRatio - 0.5, yRatio - 0.5)
  const kind: SpaceRegionKind =
    centerDistance < 0.18 ? "home" : centerDistance < 0.36 ? "yard" : "nature"

  return {
    regionId: `fallback:${kind}`,
    regionKind: kind,
    regionName: `Fallback ${labelForRegionKind(kind)}`,
    regionSource: "fallback",
  }
}

function resolveZoneRegionKind(zone: HomeZone): SpaceRegionKind {
  if (hasAnyToken(zone, ["town_connection", "town-connection"])) {
    return "town_connection"
  }

  if (hasAnyToken(zone, ["blocked", "sealed"])) {
    return "blocked"
  }

  if (hasAnyToken(zone, ["unopened"])) {
    return "unopened"
  }

  if (hasAnyToken(zone, ["locked"])) {
    return "locked"
  }

  if (zone.type === "temporary_shelter") return "home"
  if (zone.type === "quiet_living") return "home"
  if (zone.type === "storage_tools") return "structure"
  if (zone.type === "natural_boundary") return "nature"

  return "yard"
}

function resolveZonePriority(zone: HomeZone): number {
  if (zone.type === "temporary_shelter") return 100
  if (zone.type === "quiet_living") return 95
  if (zone.type === "storage_tools") return 88
  if (zone.type === "initial_care") return 84
  if (zone.type === "entry_area") return 80
  if (zone.type === "visual_center") return 60
  if (zone.type === "natural_boundary") return 10

  return 1
}

function resolveTerrainKind(input: {
  homeMapState: HomeMapState
  regionKind: SpaceRegionKind
  occupancyKind: SpaceOccupancyKind
}): SpaceTerrainKind {
  if (
    input.regionKind === "structure" ||
    input.occupancyKind === "structure_object"
  ) {
    return "built"
  }

  if (input.regionKind === "boundary") return "stone"

  const biomeType = input.homeMapState.ecologyState?.biomeType
  const resources = input.homeMapState.resources

  if (biomeType === "desert") return "sand"
  if (biomeType === "oasis") return resources.groundHealth < 42 ? "wetland" : "grass"
  if (biomeType === "forest") return "forest_floor"

  if (resources.spacePressure > 76) return "soil"
  if (resources.groundHealth < 34) return "soil"
  if (resources.naturalGrowth > 78) return "forest_floor"

  return "grass"
}

function resolvePassability(input: {
  regionKind: SpaceRegionKind
  occupancy: SpaceOccupancy[]
  occupancyKind: SpaceOccupancyKind
}): PassabilityResolution {
  if (input.regionKind === "blocked") {
    return {
      passability: "blocked",
      passable: false,
      blockedReason: "blocked_region",
      passabilitySource: "blocked_region",
    }
  }

  if (input.regionKind === "unopened") {
    return {
      passability: "blocked",
      passable: false,
      blockedReason: "unopened_region",
      passabilitySource: "unopened_region",
    }
  }

  if (input.regionKind === "locked") {
    return {
      passability: "blocked",
      passable: false,
      blockedReason: "locked_region",
      passabilitySource: "locked_region",
    }
  }

  if (input.regionKind === "boundary") {
    return {
      passability: "restricted",
      passable: false,
      blockedReason: "boundary",
      passabilitySource: "boundary",
    }
  }

  const blockingOccupancy = input.occupancy.find((item) => item.blocksMovement)
  if (blockingOccupancy) {
    return {
      passability: "blocked",
      passable: false,
      blockedReason: `placement:${blockingOccupancy.placementId}`,
      passabilitySource: "placement",
    }
  }

  if (input.occupancyKind === "life_object") {
    return {
      passability: "restricted",
      passable: false,
      blockedReason: "life_object_occupancy",
      passabilitySource: "placement",
    }
  }

  return {
    passability: "passable",
    passable: true,
    passabilitySource: "terrain",
  }
}

function resolveOccupancy(placements: MapPlacement[]): SpaceOccupancy[] {
  return placements
    .filter((placement) => placement.layer !== "ground" && placement.layer !== "edge")
    .map((placement) => {
      const objectType = resolvePlacementOccupancyKind(placement)

      return {
        objectId: placement.assetId,
        objectType,
        placementId: placement.id,
        blocksMovement: resolvesBlocksMovement(placement),
        blocksVision: resolvesBlocksVision(placement),
        layer: placement.layer,
        source: "placement",
        tags: placement.tags,
      }
    })
}

function resolveOccupancyKind(occupancy: SpaceOccupancy[]): SpaceOccupancyKind {
  if (occupancy.length === 0) return "empty"
  if (occupancy.some((item) => item.objectType === "structure_object")) {
    return "structure_object"
  }

  if (occupancy.some((item) => item.objectType === "life_object")) {
    return "life_object"
  }

  if (occupancy.some((item) => item.objectType === "natural_object")) {
    return "natural_object"
  }

  if (occupancy.some((item) => item.objectType === "event_anchor")) {
    return "event_anchor"
  }

  return "unknown"
}

function resolvePlacementOccupancyKind(
  placement: MapPlacement
): SpaceOccupancyKind {
  if (placement.layer === "structure" || placement.layer === "facility") {
    return "structure_object"
  }

  if (placement.layer === "actor") return "life_object"
  if (placement.layer === "nature") return "natural_object"
  if (
    placement.layer === "path" ||
    placement.layer === "zone" ||
    placement.layer === "surface-decoration" ||
    placement.layer === "atmosphere"
  ) {
    return "event_anchor"
  }

  return "unknown"
}

function resolvesBlocksMovement(placement: MapPlacement): boolean {
  if (placement.layer === "structure" || placement.layer === "facility") {
    return true
  }

  if (placement.layer === "nature") {
    return hasAnyToken(placement, [
      "tree",
      "large",
      "canopy",
      "rock",
      "stone",
      "blocked",
      "barrier",
    ])
  }

  return false
}

function resolvesBlocksVision(placement: MapPlacement): boolean {
  if (placement.layer === "structure" || placement.layer === "facility") {
    return true
  }

  return placement.layer === "nature" && hasAnyToken(placement, ["tree", "canopy"])
}

function resolveTraceStrength(input: {
  homeMapState: HomeMapState
  indexedPlacements: IndexedPlacement[]
  row: number
  column: number
}): number {
  const tracePlacements = input.indexedPlacements.filter((indexedPlacement) =>
    isMovementTraceCompatibilityPlacement(indexedPlacement.placement)
  )

  if (tracePlacements.length === 0) {
    return 0
  }

  const strongestSignal = tracePlacements.reduce((strength, indexedPlacement) => {
    const distance = Math.hypot(
      indexedPlacement.column - input.column,
      indexedPlacement.row - input.row
    )
    const localSignal = clamp(Math.round(100 - distance * 42), 0, 100)
    return Math.max(strength, localSignal)
  }, 0)
  const resourceBias = Math.round(
    input.homeMapState.resources.groundHealth * 0.08 +
      input.homeMapState.resources.naturalGrowth * 0.12
  )

  return clamp(strongestSignal + resourceBias, 0, 100)
}

function resolveTraceLevel(traceStrength: number): SpaceTraceStrength {
  if (traceStrength >= 72) return "strong"
  if (traceStrength >= 38) return "medium"
  if (traceStrength > 0) return "weak"

  return "none"
}

function resolveMovementCost(input: {
  terrainKind: SpaceTerrainKind
  passability: PassabilityResolution
  occupancy: SpaceOccupancy[]
  traceStrength: number
  spacePressure: number
  humidity: number
  ecologyHealth: number
}): MovementCostResolution {
  const baseMoveCost = terrainBaseCost(input.terrainKind)
  const movementCostFactors: SpaceMovementCostFactor[] = [
    {
      source: "terrain",
      amount: baseMoveCost,
      reason: `terrain:${input.terrainKind}`,
    },
  ]

  if (input.passability.passability === "blocked") {
    movementCostFactors.push({
      source: "passability",
      amount: 999,
      reason: input.passability.blockedReason ?? "blocked",
    })

    return {
      baseMoveCost,
      movementCost: 999,
      movementCostFactors,
    }
  }

  let cost = baseMoveCost

  if (input.passability.passability === "restricted") {
    cost += 88
    movementCostFactors.push({
      source: "passability",
      amount: 88,
      reason: input.passability.blockedReason ?? "restricted",
    })
  }

  if (input.passability.passability === "unknown") {
    cost += 52
    movementCostFactors.push({
      source: "passability",
      amount: 52,
      reason: "unknown_passability",
    })
  }

  const nonBlockingOccupancyCount = input.occupancy.filter(
    (item) => !item.blocksMovement
  ).length
  if (nonBlockingOccupancyCount > 0) {
    const occupancyCost = Math.min(18, nonBlockingOccupancyCount * 3)
    cost += occupancyCost
    movementCostFactors.push({
      source: "occupancy",
      amount: occupancyCost,
      reason: "non_blocking_placement_occupancy",
    })
  }

  const pressureCost = Math.round(input.spacePressure * 0.24)
  cost += pressureCost
  movementCostFactors.push({
    source: "space_pressure",
    amount: pressureCost,
    reason: "home_resource_space_pressure",
  })

  if (input.humidity >= 76) {
    cost += 6
    movementCostFactors.push({
      source: "humidity",
      amount: 6,
      reason: "high_humidity",
    })
  }

  if (input.ecologyHealth < 36) {
    cost += 8
    movementCostFactors.push({
      source: "ecology_health",
      amount: 8,
      reason: "low_ecology_health",
    })
  } else if (input.ecologyHealth > 72) {
    cost -= 4
    movementCostFactors.push({
      source: "ecology_health",
      amount: -4,
      reason: "healthy_ecology",
    })
  }

  if (input.traceStrength > 0) {
    const traceDiscount = Math.round(input.traceStrength * 0.12)
    cost -= traceDiscount
    movementCostFactors.push({
      source: "trace_strength",
      amount: -traceDiscount,
      reason: "read_only_existing_trace_signal",
    })
  }

  return {
    baseMoveCost,
    movementCost: clamp(cost, 12, 180),
    movementCostFactors,
  }
}

function terrainBaseCost(terrainKind: SpaceTerrainKind): number {
  const terrainBaseCostMap: Record<SpaceTerrainKind, number> = {
    grass: 34,
    soil: 46,
    forest_floor: 54,
    sand: 62,
    wetland: 74,
    stone: 48,
    built: 42,
    unknown: 68,
  }

  return terrainBaseCostMap[terrainKind]
}

function resolveZLayer(input: {
  occupancyKind: SpaceOccupancyKind
  regionKind: SpaceRegionKind
}): number {
  if (input.occupancyKind === "structure_object") return 2
  if (input.occupancyKind === "natural_object") return 1
  if (input.occupancyKind === "life_object") return 1
  if (input.regionKind === "boundary") return 1

  return 0
}

function buildSpaceRegions(cells: SpaceCell[]): SpaceRegion[] {
  const regionIds = Array.from(new Set(cells.map((cell) => cell.regionId)))

  return regionIds.map((regionId) => {
    const regionCells = cells.filter((cell) => cell.regionId === regionId)
    const firstCell = regionCells[0]
    const movementCostCells = regionCells.filter(
      (cell) => cell.passability !== "blocked" && cell.passability !== "unknown"
    )

    return {
      id: regionId,
      kind: firstCell?.regionKind ?? "unknown",
      label:
        firstCell?.regionName ??
        labelForRegionKind(firstCell?.regionKind ?? "unknown"),
      source: firstCell?.regionSource ?? "fallback",
      zoneIds: Array.from(
        new Set(
          regionCells
            .map((cell) =>
              cell.regionId.startsWith("zone:")
                ? cell.regionId.replace("zone:", "")
                : ""
            )
            .filter(Boolean)
        )
      ),
      fallback: regionCells.some((cell) => cell.regionSource === "fallback"),
      bounds: {
        minX: Math.min(...regionCells.map((cell) => cell.x)),
        minY: Math.min(...regionCells.map((cell) => cell.y)),
        maxX: Math.max(...regionCells.map((cell) => cell.x)),
        maxY: Math.max(...regionCells.map((cell) => cell.y)),
      },
      cellIds: regionCells.map((cell) => cell.id),
      passableCells: regionCells.filter((cell) => cell.passable).length,
      blockedCells: regionCells.filter((cell) => !cell.passable).length,
      averageMovementCost: average(
        movementCostCells.map((cell) => cell.movementCost)
      ),
      averageTraceStrength: average(
        regionCells.map((cell) => cell.traceStrength)
      ),
    }
  })
}

function labelForRegionKind(kind: SpaceRegionKind): string {
  if (kind === "home") return "Home core"
  if (kind === "yard") return "Yard"
  if (kind === "nature") return "Nature area"
  if (kind === "structure") return "Structure area"
  if (kind === "town_connection") return "Town connection"
  if (kind === "blocked") return "Blocked area"
  if (kind === "boundary") return "Boundary"
  if (kind === "unopened") return "Unopened area"
  if (kind === "locked") return "Locked area"

  return "Unknown area"
}

function resolveMoistureHint(homeMapState: HomeMapState): number {
  return clamp(
    Math.round(
      homeMapState.resources.groundHealth * 0.48 +
        homeMapState.resources.naturalGrowth * 0.32 +
        (100 - homeMapState.resources.spacePressure) * 0.2
    ),
    0,
    100
  )
}

function resolveEcologyHealthHint(homeMapState: HomeMapState): number {
  return clamp(
    Math.round(
      homeMapState.resources.groundHealth * 0.62 +
        homeMapState.resources.naturalGrowth * 0.38
    ),
    0,
    100
  )
}

function isMovementTraceCompatibilityPlacement(placement: MapPlacement): boolean {
  return placement.layer === "path" || placement.tags.includes("path")
}

function hasAnyToken(
  item: MapPlacement | HomeZone,
  tokens: string[]
): boolean {
  const itemTokens = [
    item.id,
    "assetId" in item ? item.assetId : "",
    "label" in item ? item.label : item.name,
    "layer" in item ? item.layer : item.type,
    ...item.tags,
  ].map((token) => token.toLowerCase())

  return tokens.some((token) =>
    itemTokens.some((itemToken) => itemToken.includes(token))
  )
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  )
}

function emptySummary() {
  return {
    totalCells: 0,
    passableCells: 0,
    blockedCells: 0,
    restrictedCells: 0,
    occupiedCells: 0,
    traceInfluencedCells: 0,
    averageMovementCost: 0,
    averageTraceStrength: 0,
    averageFamiliarity: 0,
    regionCounts: {
      home: 0,
      yard: 0,
      nature: 0,
      structure: 0,
      town_connection: 0,
      blocked: 0,
      boundary: 0,
      unopened: 0,
      locked: 0,
      unknown: 0,
    },
    terrainCounts: {
      grass: 0,
      soil: 0,
      forest_floor: 0,
      sand: 0,
      wetland: 0,
      stone: 0,
      built: 0,
      unknown: 0,
    },
    occupancyCounts: {
      empty: 0,
      natural_object: 0,
      structure_object: 0,
      life_object: 0,
      event_anchor: 0,
      unknown: 0,
    },
  }
}
