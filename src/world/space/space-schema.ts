export type SpaceCoordinate = {
  x: number
  y: number
  z: number
  layer: number
}

export type SpaceRegionKind =
  | "home"
  | "yard"
  | "nature"
  | "structure"
  | "town_connection"
  | "blocked"
  | "boundary"
  | "unopened"
  | "locked"
  | "unknown"

export type SpaceTerrainKind =
  | "grass"
  | "soil"
  | "forest_floor"
  | "sand"
  | "wetland"
  | "stone"
  | "built"
  | "unknown"

export type SpacePassability =
  | "passable"
  | "blocked"
  | "restricted"
  | "unknown"

export type SpaceOccupancyKind =
  | "empty"
  | "natural_object"
  | "structure_object"
  | "life_object"
  | "event_anchor"
  | "unknown"

export type SpaceTraceStrength = "none" | "weak" | "medium" | "strong"

export type SpaceFamiliarityLevel =
  | "unknown"
  | "noticed"
  | "familiar"
  | "trusted"
  | "habitual"

export type SpaceRegionSource =
  | "home_map_zone"
  | "boundary"
  | "placement"
  | "fallback"

export type SpacePassabilitySource =
  | "terrain"
  | "placement"
  | "boundary"
  | "blocked_region"
  | "unopened_region"
  | "locked_region"
  | "unknown"

export type SpaceOccupancy = {
  objectId: string
  objectType: SpaceOccupancyKind
  placementId: string
  blocksMovement: boolean
  blocksVision: boolean
  layer: string
  source: "placement"
  tags: string[]
}

export type SpaceMovementCostFactor = {
  source:
    | "terrain"
    | "passability"
    | "occupancy"
    | "space_pressure"
    | "humidity"
    | "ecology_health"
    | "trace_strength"
    | "trace_effect"
  amount: number
  reason: string
}

export type SpaceTraceInfluenceFactor = {
  traceId: string
  traceType: string
  lifecyclePhase: string
  movementCostDelta: number
  familiarityDelta: number
  visualIntensityDelta: number
  strength: number
  reason: string
}

export type SpaceTraceInfluence = {
  cellId: string
  strength: number
  movementCostDelta: number
  familiarityDelta: number
  visualIntensityDelta: number
  factors: SpaceTraceInfluenceFactor[]
}

export type SpaceTraceInfluenceSummary = {
  totalInfluencedCells: number
  averageTraceInfluenceStrength: number
  averageFamiliarity: number
  highMaintenanceTraceCount: number
  familiarRegionCount: number
  preferredObservationRegions: SpaceRegionKind[]
  highTraceMovementCostRegions: SpaceRegionKind[]
  maintenancePriorityHints: string[]
  warnings: string[]
  tags: string[]
}

export type SpaceBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type SpaceCell = SpaceCoordinate & {
  id: string
  row: number
  column: number
  coordinate: SpaceCoordinate
  regionId: string
  regionType: SpaceRegionKind
  regionName?: string
  regionSource: SpaceRegionSource
  regionKind: SpaceRegionKind
  terrainKind: SpaceTerrainKind
  passability: SpacePassability
  passable: boolean
  blockedReason?: string
  passabilitySource: SpacePassabilitySource
  baseMoveCost: number
  movementCost: number
  movementCostFactors: SpaceMovementCostFactor[]
  occupancyKind: SpaceOccupancyKind
  occupancy: SpaceOccupancy[]
  occupancyIds: string[]
  traceStrength: number
  traceLevel: SpaceTraceStrength
  traceInfluenceStrength: number
  traceInfluenceFactors: SpaceTraceInfluenceFactor[]
  movementCostBeforeTrace?: number
  movementCostAfterTrace?: number
  humidity?: number
  ecologyHealth?: number
  familiarity?: number
  familiarityLevel?: SpaceFamiliarityLevel
  moistureHint: number
  ecologyHealthHint: number
}

export type SpaceRegion = {
  id: string
  kind: SpaceRegionKind
  label: string
  source: SpaceRegionSource
  zoneIds: string[]
  fallback: boolean
  bounds: SpaceBounds
  cellIds: string[]
  passableCells: number
  blockedCells: number
  averageMovementCost: number
  averageTraceStrength: number
}

export type SpaceGridSummary = {
  totalCells: number
  passableCells: number
  blockedCells: number
  restrictedCells: number
  occupiedCells: number
  traceInfluencedCells: number
  averageMovementCost: number
  averageTraceStrength: number
  averageFamiliarity: number
  regionCounts: Record<SpaceRegionKind, number>
  terrainCounts: Record<SpaceTerrainKind, number>
  occupancyCounts: Record<SpaceOccupancyKind, number>
}

export type SpaceGrid = {
  id: string
  worldId: string
  columns: number
  rows: number
  tileSize: number
  width: number
  height: number
  cells: SpaceCell[]
  regions: SpaceRegion[]
  summary: SpaceGridSummary
  traceInfluenceSummary?: SpaceTraceInfluenceSummary
}
