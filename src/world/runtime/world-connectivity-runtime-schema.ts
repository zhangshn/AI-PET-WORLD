export type WorldBoundarySide = "north" | "east" | "south" | "west"

export type WorldConnectivityPoint = {
  x: number
  y: number
}

export type WorldRegionNeighborStub = {
  regionId: string
  relativePosition: WorldBoundarySide
  regionalLandscapeType: string
  topologyRole: string
  generationStatus: "reserved_not_generated"
}

export type WorldRegionEdgePort = {
  edgePortId: string
  kind: "path" | "watercourse" | "ecology_transition" | "elevation_transition"
  regionId: string
  boundarySide: WorldBoundarySide
  boundaryPosition: WorldConnectivityPoint | null
  direction: string
  width: number
  elevation: {
    class: string
    exactMeters: number | null
    status: string
  }
  role: string
  connectsToRegionId: string
  connectsToEdgePortId: string
  state: string
  version: number
}

export type WorldConnectivityRuntimeState = {
  schemaVersion: "world-connectivity-runtime-state-v1"
  contractId: string
  blueprintId: string
  blueprintPath: string
  blueprintSha256: string
  status:
    | "runtime_migrated_pending_owner_review"
    | "runtime_migrated_owner_approved"
  currentRegion: {
    regionId: string
    worldId: string
    worldSeed: string
    worldProfileId: string
    worldBounds: {
      regionX: number
      regionY: number
      widthRegions: number
      heightRegions: number
    }
    localBounds: {
      x: number
      y: number
      width: number
      height: number
    }
    regionalLandscapeType: string
    elevationBand: {
      class: string
      referenceElevationMeters: number
      exactPerPortElevationPendingRuntimeTerrainModel: boolean
    }
    neighborRegionIds: string[]
    edgePorts: string[]
    pathGraphId: string
    hydrologyGraphId: string
    walkableGraphId: string
    objectIdentitySetId: string
    version: number
    contentHash: string
  }
  neighborRegionStubs: WorldRegionNeighborStub[]
  edgePorts: WorldRegionEdgePort[]
  pathGraph: {
    pathGraphId: string
    nodes: string[]
    edges: Array<{
      source: string
      target: string
      sourceStructureId?: string
      coordinates?: WorldConnectivityPoint[]
      width?: number
      status: string
    }>
    westBoundaryStatus: string
    crossesWater: boolean
  }
  hydrologyGraph: {
    hydrologyGraphId: string
    waterBodyId: string
    flowAxis: string
    upstreamPortId: string
    downstreamPortId: string
    lateralContinuationPortId: string
    seasonalRegime: string
    wetSeasonReference: string
    exactDischargeModelStatus: string
  }
  walkableGraph: {
    walkableGraphId: string
    requiredConnectedNodesAfterMigration: string[]
    watercoursePortsWalkable: boolean
    collisionRevalidationRequired: boolean
    migrationStatus:
      | "runtime_migrated_pending_owner_review"
      | "runtime_migrated_owner_approved"
  }
  migration: {
    migrationId: string
    sourceTick: number
    targetTick: number
    migratedAtUtc: string
    migratedAtAsiaShanghai: string
    ownerAuthorizationRef: string
    reportPath: string
  }
  ownerReview?: {
    reviewId: string
    decision: "approved"
    reviewedAtUtc: string
    reviewedAtAsiaShanghai: string
    ownerCommand: string
    reviewPath: string
  }
  tags: string[]
}
