import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const CONTRACT_PATH = path.join(ROOT, "data", "world-samples", "world-connectivity", "world-connectivity-contract-v1.json")
const TASK_LATEST_PATH = path.join(ROOT, ".runtime", "ai-painter", "world-visual-generation-task-packages", "latest.json")
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "world-connectivity-proposals")

const contract = readJson(CONTRACT_PATH)
const taskLatest = readJson(TASK_LATEST_PATH)
const taskPath = path.resolve(ROOT, taskLatest.taskPath)
const task = readJson(taskPath)
const createdAt = new Date().toISOString()
const proposalId = `world-connectivity-proposal-${task.worldId}-${task.tick}-${createdAt.replace(/[:.]/g, "-")}`
const outputDir = path.join(OUTPUT_ROOT, proposalId)
const proposalPath = path.join(outputDir, "proposal.json")

const width = task.outputSize?.width
const height = task.outputSize?.height
assert(width === 1024 && height === 768, "current_task_output_size_invalid")
assert(task.worldProfileId === contract.scope.worldProfileId, "current_task_world_profile_mismatch")

const terrainRegions = task.spatialLayers?.terrainRegions ?? []
const pathRegions = terrainRegions.filter((region) => region.kind === "path_ground")
const waterRegions = terrainRegions.filter((region) => region.kind === "water")
const shorelineRegions = terrainRegions.filter((region) => region.kind === "shoreline")
const naturalBoundaryRegions = terrainRegions.filter((region) => region.kind === "natural_boundary")

const waterBoundaryContacts = waterRegions.flatMap((region) => boundaryContacts(region, width, height))
const shorelineBoundaryContacts = shorelineRegions.flatMap((region) => boundaryContacts(region, width, height))
const naturalBoundaryContacts = naturalBoundaryRegions.flatMap((region) => boundaryContacts(region, width, height))
const pathBoundaryContacts = pathRegions.flatMap((region) => boundaryContacts(region, width, height))
const pathExtensionCandidates = pathRegions
  .map((region) => nearestBoundaryCandidate(region, width, height))
  .filter((candidate) => candidate.minimumBoundaryDistance !== null && candidate.minimumBoundaryDistance <= 128)

const proposal = {
  schemaVersion: "world-connectivity-blueprint-proposal-v1",
  proposalId,
  status: "pending_owner_review",
  titleZh: "第一版自然家园大世界连接蓝图候选",
  titleEn: "First natural-home large-world connectivity blueprint proposal",
  createdAt,
  createdAtAsiaShanghai: formatShanghai(createdAt),
  contractId: contract.contractId,
  contractPath: projectPath(CONTRACT_PATH),
  source: {
    taskId: task.taskId,
    taskPath: projectPath(taskPath),
    taskSha256: task.taskSha256,
    worldId: task.worldId,
    ownerId: task.ownerId,
    tick: task.tick,
    worldProfileId: task.worldProfileId,
    structureId: task.sourceBindings?.structureId,
  },
  currentRegion: {
    proposedRegionId: `${task.worldId}:natural-home:region-0001`,
    identityStatus: "candidate_not_registered",
    bounds: { x: 0, y: 0, width, height },
    regionalLandscapeType: "pending_owner_review",
    neighborRegionIds: [],
  },
  extractedEvidence: {
    waterBoundaryContacts,
    shorelineBoundaryContacts,
    naturalBoundaryContacts,
    pathBoundaryContacts,
    pathExtensionCandidates,
    routeGraph: task.mapGrammar?.routeGraph ?? null,
    objectIdentityCount: task.spatialLayers?.objectFootprints?.length ?? 0,
    sourceRule: "coordinates_extracted_from_current_task_package_not_from_rgb",
  },
  candidateConnections: {
    watercourse: waterBoundaryContacts.map((contact, index) => ({
      candidateId: `watercourse-candidate-${String(index + 1).padStart(2, "0")}`,
      sourceRegionId: contact.sourceRegionId,
      boundarySide: contact.boundarySide,
      boundarySpan: contact.boundarySpan,
      status: "candidate_requires_owner_hydrology_decision",
      flowDirection: null,
      connectsToRegionId: null,
      connectsToEdgePortId: null,
      formalEdgePortCreated: false,
    })),
    path: pathExtensionCandidates.map((candidate, index) => ({
      candidateId: `path-extension-candidate-${String(index + 1).padStart(2, "0")}`,
      sourceRegionId: candidate.sourceRegionId,
      nearestBoundarySides: candidate.nearestBoundarySides,
      boundaryDistance: candidate.minimumBoundaryDistance,
      status: "candidate_requires_owner_exit_side_decision",
      connectsToRegionId: null,
      connectsToEdgePortId: null,
      formalEdgePortCreated: false,
    })),
    ecologyTransition: [],
    elevationTransition: [],
  },
  ownerReviewRequired: {
    required: true,
    decisions: [
      "confirm_first_region_identity_and_regional_landscape_type",
      "select_or_reject_path_exit_boundary_side",
      "define_watercourse_upstream_downstream_or_closed_water_status",
      "define_neighbor_region_ids_and_landscape_types",
      "define_ecology_and_elevation_transition_ports",
      "approve_connectivity_positive_and_negative_coverage_thresholds"
    ],
  },
  authorityBoundary: {
    worldStateMutated: false,
    formalBlueprintCreated: false,
    formalBlueprintEligible: false,
    visualUsedToInferTopology: false,
    rgbGenerated: false,
    ownerApprovalRecorded: false,
  },
  blockers: [
    "world_connectivity_blueprint_missing",
    "world_connectivity_owner_review_required",
    "neighbor_regions_undefined",
    "path_exit_unapproved",
    "hydrology_direction_undefined"
  ],
  storage: {
    automaticStorage: true,
    proposalPath: projectPath(proposalPath),
    formalBlueprintPath: null,
  },
}
proposal.proposalSha256 = sha256(stablePayload(proposal))

fs.mkdirSync(outputDir, { recursive: true })
writeJson(proposalPath, proposal)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "world-connectivity-proposal-manifest-v1",
  proposalId,
  status: proposal.status,
  createdAt,
  createdAtAsiaShanghai: proposal.createdAtAsiaShanghai,
  worldId: task.worldId,
  tick: task.tick,
  contractId: contract.contractId,
  proposalSha256: proposal.proposalSha256,
  proposalPath: projectPath(proposalPath),
  automaticStorage: true,
})

console.log(JSON.stringify({
  ok: true,
  status: proposal.status,
  proposalId,
  proposalPath: projectPath(proposalPath),
  waterBoundaryContactCount: waterBoundaryContacts.length,
  pathBoundaryContactCount: pathBoundaryContacts.length,
  pathExtensionCandidateCount: pathExtensionCandidates.length,
  formalBlueprintCreated: false,
  blockers: proposal.blockers,
}, null, 2))

function boundaryContacts(region, mapWidth, mapHeight) {
  const points = region.polygon ?? []
  const definitions = [
    { side: "north", values: points.filter((point) => point.y === 0).map((point) => point.x) },
    { side: "east", values: points.filter((point) => point.x === mapWidth).map((point) => point.y) },
    { side: "south", values: points.filter((point) => point.y === mapHeight).map((point) => point.x) },
    { side: "west", values: points.filter((point) => point.x === 0).map((point) => point.y) },
  ]
  return definitions
    .filter((item) => item.values.length >= 2)
    .map((item) => ({
      sourceRegionId: region.sourceId ?? region.id,
      kind: region.kind,
      boundarySide: item.side,
      boundarySpan: { start: Math.min(...item.values), end: Math.max(...item.values) },
      evidencePointCount: item.values.length,
    }))
}

function nearestBoundaryCandidate(region, mapWidth, mapHeight) {
  const points = region.polygon ?? []
  const distances = {
    north: Math.min(...points.map((point) => point.y)),
    east: Math.min(...points.map((point) => mapWidth - point.x)),
    south: Math.min(...points.map((point) => mapHeight - point.y)),
    west: Math.min(...points.map((point) => point.x)),
  }
  const sorted = Object.entries(distances).sort((a, b) => a[1] - b[1])
  const minimumBoundaryDistance = sorted[0]?.[1] ?? null
  return {
    sourceRegionId: region.sourceId ?? region.id,
    minimumBoundaryDistance,
    nearestBoundarySides: sorted
      .filter(([, distance]) => distance <= Math.max(128, minimumBoundaryDistance ?? 0))
      .map(([side, distance]) => ({ side, distance })),
    currentlyTouchesBoundary: minimumBoundaryDistance === 0,
  }
}

function stablePayload(value) {
  const copy = structuredClone(value)
  delete copy.proposalSha256
  return JSON.stringify(copy)
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function formatShanghai(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(" ", "T") + "+08:00"
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_json_missing:${projectPath(filePath)}`)
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function assert(condition, code) {
  if (!condition) throw new Error(code)
}
