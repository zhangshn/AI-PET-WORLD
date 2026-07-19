import crypto from "node:crypto"

export const CONNECTIVITY_COVERAGE_AXES = [
  "internal_entry_to_center_path",
  "center_to_approved_edge_port_path",
  "cross_region_path_pair",
  "upstream_downstream_water_pair",
  "ecology_transition_pair",
  "elevation_transition_pair",
  "walkable_component_continuity",
  "collision_preservation",
  "object_identity_continuity",
]

export const AXIS_SOURCE_ROW_INDEXES = {
  internal_entry_to_center_path: [0, 8, 20],
  center_to_approved_edge_port_path: [0, 9, 16],
  cross_region_path_pair: [3, 15, 20],
  upstream_downstream_water_pair: [0, 9, 19],
  ecology_transition_pair: [0, 9, 20],
  elevation_transition_pair: [13, 14, 16],
  walkable_component_continuity: [0, 8, 20],
  collision_preservation: [1, 15, 19],
  object_identity_continuity: [0, 4, 20],
}

export const AXIS_FAILURE_CODES = {
  internal_entry_to_center_path: "disconnected_region",
  center_to_approved_edge_port_path: "broken_cross_region_path",
  cross_region_path_pair: "unmatched_edge_port",
  upstream_downstream_water_pair: "broken_hydrology",
  ecology_transition_pair: "adjacency_profile_conflict",
  elevation_transition_pair: "adjacency_profile_conflict",
  walkable_component_continuity: "isolated_walkable_component",
  collision_preservation: "path_overlaps_water",
  object_identity_continuity: "object_identity_discontinuity",
}

export function buildCoverageScenario({ axis, variantIndex, sourceRow, sourceBlueprint, runtimeConnectivity, runtimePlacements, allowedLandscapeTypes }) {
  const pathPort = runtimeConnectivity.edgePorts.find((port) => port.kind === "path" && port.regionId === runtimeConnectivity.currentRegion.regionId)
  const pairedPathPort = runtimeConnectivity.edgePorts.find((port) => port.edgePortId === pathPort?.connectsToEdgePortId)
  const upstreamPort = runtimeConnectivity.edgePorts.find((port) => port.edgePortId === runtimeConnectivity.hydrologyGraph.upstreamPortId)
  const downstreamPort = runtimeConnectivity.edgePorts.find((port) => port.edgePortId === runtimeConnectivity.hydrologyGraph.downstreamPortId)
  const ecologyTarget = runtimeConnectivity.neighborRegionStubs[(variantIndex - 1) % runtimeConnectivity.neighborRegionStubs.length]
  const conditionObjectIds = (sourceBlueprint.geometry?.objectFootprints ?? []).map((item) => item.objectId)
  const runtimeObjectIds = (runtimePlacements ?? []).map((item) => item.id)
  const objectIds = variantIndex === 1 ? runtimeObjectIds : conditionObjectIds

  return {
    schemaVersion: "world-connectivity-coverage-scenario-v1",
    axis,
    variantIndex,
    context: {
      conditionLabel: sourceRow.conditionLabel,
      worldId: sourceRow.worldId,
      regionalLandscapeType: sourceRow.targetRegionalLandscapeType,
      season: sourceRow.season,
      conditionBlueprintSha256: sourceRow.blueprintSha256,
      conditionPackSha256: sourceRow.conditionPackSha256,
      completeMapScopeRequired: sourceBlueprint.completeMapScopeRequired === true,
    },
    route: {
      nodes: [...runtimeConnectivity.pathGraph.nodes],
      edges: runtimeConnectivity.pathGraph.edges.map((edge) => ({ source: edge.source, target: edge.target })),
      entryNodeId: "entry_point",
      centerNodeId: "home_center",
      approvedExitNodeId: pathPort?.edgePortId ?? null,
    },
    pathPortPair: {
      currentPort: selectPortFields(pathPort),
      neighborPort: selectPortFields(pairedPathPort),
    },
    hydrology: {
      flowAxis: runtimeConnectivity.hydrologyGraph.flowAxis,
      upstreamPort: selectPortFields(upstreamPort),
      downstreamPort: selectPortFields(downstreamPort),
    },
    ecologyTransition: {
      sourceLandscapeType: runtimeConnectivity.currentRegion.regionalLandscapeType,
      targetLandscapeType: ecologyTarget?.regionalLandscapeType ?? null,
      targetRegionId: ecologyTarget?.regionId ?? null,
      allowedLandscapeTypes: [...allowedLandscapeTypes],
    },
    elevationTransition: {
      sourceClass: pathPort?.elevation?.class ?? runtimeConnectivity.currentRegion.elevationBand?.class ?? null,
      targetClass: pairedPathPort?.elevation?.class ?? null,
      compatibleClasses: ["river_valley_lowland", "tropical_lowland", "tropical_foothill"],
    },
    walkability: {
      requiredNodes: [...runtimeConnectivity.walkableGraph.requiredConnectedNodesAfterMigration],
      reachableNodes: [...runtimeConnectivity.walkableGraph.requiredConnectedNodesAfterMigration],
      migrationStatus: runtimeConnectivity.walkableGraph.migrationStatus,
    },
    collision: {
      pathWaterOverlapPixels: 0,
      pathCollisionOverlapPixels: 0,
      revalidated: runtimeConnectivity.walkableGraph.collisionRevalidationRequired === true,
    },
    objectIdentity: {
      currentTickIds: [...objectIds],
      nextTickIds: [...objectIds],
    },
  }
}

export function createNegativeScenario(positiveScenario) {
  const scenario = structuredClone(positiveScenario)
  const axis = scenario.axis
  if (axis === "internal_entry_to_center_path") {
    scenario.route.edges = scenario.route.edges.filter((edge) => !sameUndirectedEdge(edge, "entry_point", "home_center"))
  } else if (axis === "center_to_approved_edge_port_path") {
    scenario.route.edges = scenario.route.edges.filter((edge) => !edgeTouches(edge, scenario.route.approvedExitNodeId))
  } else if (axis === "cross_region_path_pair") {
    scenario.pathPortPair.neighborPort.connectsToEdgePortId = "invalid:unmatched-port"
  } else if (axis === "upstream_downstream_water_pair") {
    scenario.hydrology.downstreamPort.edgePortId = scenario.hydrology.upstreamPort.edgePortId
  } else if (axis === "ecology_transition_pair") {
    scenario.ecologyTransition.targetLandscapeType = "desert"
  } else if (axis === "elevation_transition_pair") {
    scenario.elevationTransition.targetClass = "alpine_tundra"
  } else if (axis === "walkable_component_continuity") {
    scenario.walkability.reachableNodes = scenario.walkability.reachableNodes.filter((node) => node !== "home_center")
  } else if (axis === "collision_preservation") {
    scenario.collision.pathWaterOverlapPixels = 64
  } else if (axis === "object_identity_continuity") {
    scenario.objectIdentity.nextTickIds[0] = `${scenario.objectIdentity.nextTickIds[0]}:identity-broken`
  }
  return scenario
}

export function validateCoverageScenario(scenario) {
  const axis = scenario.axis
  let passed = false
  if (axis === "internal_entry_to_center_path") {
    passed = graphConnected(scenario.route, scenario.route.entryNodeId, scenario.route.centerNodeId)
  } else if (axis === "center_to_approved_edge_port_path") {
    passed = graphConnected(scenario.route, scenario.route.centerNodeId, scenario.route.approvedExitNodeId)
  } else if (axis === "cross_region_path_pair") {
    const { currentPort, neighborPort } = scenario.pathPortPair
    passed = Boolean(currentPort?.edgePortId && neighborPort?.edgePortId)
      && currentPort.kind === "path"
      && neighborPort.kind === "path"
      && currentPort.connectsToEdgePortId === neighborPort.edgePortId
      && neighborPort.connectsToEdgePortId === currentPort.edgePortId
  } else if (axis === "upstream_downstream_water_pair") {
    const { upstreamPort, downstreamPort, flowAxis } = scenario.hydrology
    passed = flowAxis === "north_to_south"
      && upstreamPort?.kind === "watercourse"
      && downstreamPort?.kind === "watercourse"
      && upstreamPort.edgePortId !== downstreamPort.edgePortId
      && upstreamPort.role === "upstream_inlet"
      && downstreamPort.role === "downstream_outlet"
  } else if (axis === "ecology_transition_pair") {
    const transition = scenario.ecologyTransition
    passed = transition.allowedLandscapeTypes.includes(transition.sourceLandscapeType)
      && transition.allowedLandscapeTypes.includes(transition.targetLandscapeType)
  } else if (axis === "elevation_transition_pair") {
    const transition = scenario.elevationTransition
    passed = transition.compatibleClasses.includes(transition.sourceClass)
      && transition.compatibleClasses.includes(transition.targetClass)
  } else if (axis === "walkable_component_continuity") {
    passed = scenario.walkability.migrationStatus === "runtime_migrated_owner_approved"
      && scenario.walkability.requiredNodes.every((node) => scenario.walkability.reachableNodes.includes(node))
  } else if (axis === "collision_preservation") {
    passed = scenario.collision.revalidated === true
      && scenario.collision.pathWaterOverlapPixels === 0
      && scenario.collision.pathCollisionOverlapPixels === 0
  } else if (axis === "object_identity_continuity") {
    const current = scenario.objectIdentity.currentTickIds
    const next = scenario.objectIdentity.nextTickIds
    passed = current.length > 0
      && new Set(current).size === current.length
      && current.length === next.length
      && current.every((id, index) => id === next[index])
  }
  return {
    passed,
    failureCode: passed ? null : AXIS_FAILURE_CODES[axis] ?? "connectivity_validation_failed",
  }
}

export function canonicalSha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function selectPortFields(port) {
  if (!port) return null
  return {
    edgePortId: port.edgePortId,
    kind: port.kind,
    regionId: port.regionId,
    boundarySide: port.boundarySide,
    direction: port.direction,
    width: port.width,
    elevationClass: port.elevation?.class ?? null,
    role: port.role,
    connectsToRegionId: port.connectsToRegionId,
    connectsToEdgePortId: port.connectsToEdgePortId,
    state: port.state,
  }
}

function graphConnected(route, start, target) {
  if (!start || !target || !route.nodes.includes(start) || !route.nodes.includes(target)) return false
  const queue = [start]
  const visited = new Set(queue)
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === target) return true
    for (const edge of route.edges) {
      const next = edge.source === current ? edge.target : edge.target === current ? edge.source : null
      if (next && !visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return false
}

function sameUndirectedEdge(edge, left, right) {
  return (edge.source === left && edge.target === right) || (edge.source === right && edge.target === left)
}

function edgeTouches(edge, node) {
  return edge.source === node || edge.target === node
}
