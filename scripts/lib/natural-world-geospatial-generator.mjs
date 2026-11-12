import { createNaturalWorldGeometryNovelty } from "./natural-world-geometry-novelty.mjs";
import { createNaturalWorldComposition } from "./natural-world-composition.mjs";
import { createNaturalWorldHydrology } from "./natural-world-hydrology.mjs";
import {
  ribbonPolygonVariable,
  rectanglePolygon,
  boundsPolygon,
  pointsEqual,
  polygonsOverlap,
  randomInt,
  mulberry32,
  clamp,
  buildVariableWidthCorridorPolygons,
} from "./natural-world-geometry.mjs";
export { buildVariableWidthCorridorPolygons } from "./natural-world-geometry.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";
import { auditCompleteMapScope } from "./complete-map-scope-gate.mjs";
import {
  buildAnonymousRouteNaturalnessProfile,
  buildNaturalAnonymousCenterline,
  buildNaturalRouteHalfWidths,
} from "./anonymous-route-naturalness.mjs";
import {
  NATURAL_WATER_CENTERLINE_POINT_COUNT,
  auditAnonymousWaterCorridorShape,
  buildNaturalAnonymousWaterCenterline,
  buildNaturalWaterHalfWidths,
} from "./anonymous-water-naturalness.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
  MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./measurement-driven-anonymous-topology.mjs";
import {
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./measurement-derived-coarse-hydrology.mjs";
import {
  buildCompleteMapStructuralIdentities,
  buildIndependentTrainingRegionConnectivity,
  buildRealEarthRegionSourcePackage,
  qualifyNaturalWorldSources,
  naturalWorldDigest,
  readNaturalWorldBinding,
} from "./real-earth-region-governance.mjs";

export const NATURAL_WORLD_PRODUCER_FILES = Object.freeze([
  "scripts/lib/natural-world-geospatial-generator.mjs",
  "scripts/lib/natural-world-geometry.mjs",
  "scripts/lib/natural-world-geometry-novelty.mjs",
  "scripts/lib/natural-world-hydrology.mjs",
  "scripts/lib/natural-world-composition.mjs",
  "scripts/lib/natural-world-visual-manifest.mjs",
  "scripts/lib/natural-world-visual-task.mjs",
  "scripts/lib/natural-world-condition-compiler.mjs",
  "scripts/build-earth-geospatial-complete-map-conditions.mjs", "scripts/lib/real-earth-region-governance.mjs",
  "scripts/build-current-world-visual-fact-manifest.mjs", "scripts/build-current-world-visual-generation-task-package.mjs",
  "scripts/compile-current-world-visual-conditions.mjs", "src/world/runtime/natural-world-bootstrap.ts",
  "scripts/lib/anonymous-route-naturalness.mjs", "scripts/lib/anonymous-water-naturalness.mjs",
  "scripts/lib/measurement-driven-anonymous-topology.mjs", "scripts/lib/measurement-derived-coarse-hydrology.mjs",
  "scripts/lib/world-visual-dictionary-contract.mjs",
  "src/world/runtime/world-runtime-record-validation.ts", "src/world/runtime/world-runtime-store-adapter.ts",
  "src/world/runtime/world-runtime-store.ts", "src/world/runtime/world-runtime-production-store.ts", "src/world/runtime/runtime-path-security.ts",
]);
export function naturalWorldFactsEnvelope(proposal) {
  assertNatural(proposal?.schemaVersion === "natural-world-generated-facts-v1" && proposal.scope === "natural_world_runtime_v1", "natural facts scope unsupported");
  return { schemaVersion: "natural-world-facts-snapshot-v1", worldId: proposal.identity.worldId,
    regionId: proposal.identity.regionId, tick: proposal.tick,
    payload: Object.fromEntries(["terrainRegions", "objectFootprints", "walkableRegions", "collisionRegions"].map(k => [k, structuredClone(proposal.geometry[k])])) };
}
/** Replaying exact current source and generation, rather than trusting release flags. */
export async function verifyNaturalWorldFactRelease({ root = process.cwd(), binding }) {
  assertNatural(fs.realpathSync(root) === fs.realpathSync(process.cwd()), "natural producer requires declared project cwd");
  const inputReads = [];
  const read = b => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(readNaturalWorldBinding(root, b, inputReads)));
  const release = read(binding);
  assertNatural(release.schemaVersion === "natural-world-source-fact-release-v1" && release.scope === "natural_world_runtime_v1", "unknown natural fact release scope");
  assertNatural(Array.isArray(release.producerBindings) && release.producerBindings.length === NATURAL_WORLD_PRODUCER_FILES.length, "natural producer bindings incomplete");
  for (let i = 0; i < NATURAL_WORLD_PRODUCER_FILES.length; i++) {
    assertNatural(release.producerBindings[i].path === NATURAL_WORLD_PRODUCER_FILES[i], "natural producer binding identity mismatch");
    readNaturalWorldBinding(root, release.producerBindings[i], inputReads);
  }
  const stored = read(release.generatedFactsBinding);
  const sourcePackage = read(release.sourcePackageBinding);
  const proposal = await buildEarthGeospatialCompleteMapConditions({ naturalWorldInput: release.creationInput });
  assertNatural(naturalWorldDigest(stored) === naturalWorldDigest(proposal) && naturalWorldDigest(sourcePackage) === naturalWorldDigest(proposal.sourcePackage), "natural fact release replay mismatch");
  const factsEnvelope = naturalWorldFactsEnvelope(proposal);
  assertNatural(release.factHash === naturalWorldDigest(factsEnvelope) && release.worldId === proposal.identity.worldId &&
    release.regionId === proposal.identity.regionId && release.ownerId === proposal.identity.ownerId && release.tick === 0 &&
    release.sourcePackageIdentity === proposal.sourcePackageIdentity, "natural fact release identity mismatch");
  const { sourceFactReleaseIdentity, ...payload } = release;
  assertNatural(sourceFactReleaseIdentity === `natural-source-facts-${naturalWorldDigest(payload)}`, "natural source fact release digest mismatch");
  return { release, proposal, factsEnvelope, inputReads: [...inputReads, ...proposal.sourceInputReads] };
}

export function createNaturalWorldRandom(initialU32, saved = null) {
  assertNatural(Number.isInteger(initialU32) && initialU32 >= 0 && initialU32 <= 0xffffffff, "RNG initial state invalid");
  let currentU32 = initialU32, drawCount = 0;
  if (saved !== null) {
    assertNatural(saved.status === "captured" && saved.algorithmId === "mulberry32" && saved.algorithmVersion === "u32-v1", "RNG algorithm unsupported");
    const state = saved.state;
    assertNatural(state && state.initialU32 === initialU32 && Number.isSafeInteger(state.drawCount) && state.drawCount >= 0 &&
      Number.isInteger(state.currentU32) && state.currentU32 >= 0 && state.currentU32 <= 0xffffffff &&
      Number((BigInt(initialU32) + BigInt(state.drawCount) * 0x6d2b79f5n) & 0xffffffffn) === state.currentU32, "RNG continuation state invalid");
    ({ currentU32, drawCount } = state);
  }
  return {
    next() {
      assertNatural(drawCount < Number.MAX_SAFE_INTEGER, "RNG counter exhausted");
      currentU32 = (currentU32 + 0x6d2b79f5) >>> 0; drawCount++;
      let value = currentU32;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    snapshot() { return { status: "captured", algorithmId: "mulberry32", algorithmVersion: "u32-v1", state: { initialU32, currentU32, drawCount } }; },
  };
}
function assertNatural(value, message) { if (!value) throw new Error(message); }

// Importing the geometry implementation must not execute the historical CLI.
export function replacementPathOriginWithinContract(point, side, canvas, contract) {
  if (!point || !canvas || !contract || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      !(canvas.width > 0) || !(canvas.height > 0) ||
      contract.version !== "complete-map-boundary-port-to-interior-depth-v1" ||
      contract.reviewThresholdChanged !== false || contract.completeMapRouteSpanThreshold !== 0.35 ||
      !["minimumNormalizedDepth", "maximumNormalizedDepth", "minimumTangentialFraction", "maximumTangentialFraction"]
        .every(key => Number.isFinite(contract[key]) && contract[key] > 0 && contract[key] < 1)) return false;
  const x = point.x / canvas.width, y = point.y / canvas.height;
  const depth = { west: x, east: 1 - x, north: y, south: 1 - y }[side];
  const tangent = ["west", "east"].includes(side) ? y : x;
  return depth >= contract.minimumNormalizedDepth && depth <= contract.maximumNormalizedDepth &&
    depth > contract.completeMapRouteSpanThreshold && tangent >= contract.minimumTangentialFraction &&
    tangent <= contract.maximumTangentialFraction;
}

// A replacement input produces an unpublished CPU proposal only; it never
// enters the legacy event, latest-pointer, task or compilation branches below.
export async function buildEarthGeospatialCompleteMapConditions({ replacementGeometryInput = null, naturalWorldInput = null } = {}) {
const ROOT = process.cwd();
assertNatural(!(replacementGeometryInput && naturalWorldInput), "ambiguous generation mode");
const naturalSources = naturalWorldInput ? qualifyNaturalWorldSources({ root: ROOT, input: naturalWorldInput }) : null;
const V7_SLOT_ID = naturalSources ? null : replacementGeometryInput?.slotContext?.assignment?.slotId ?? valueFor("--v7-slot-id");
const V7_SLOT_CONTEXT = naturalSources ?? replacementGeometryInput?.slotContext ?? (V7_SLOT_ID
  ? loadV7SlotContext(V7_SLOT_ID)
  : null);
assert(
  V7_SLOT_CONTEXT,
  "legacy fixed shared complete-map geometry was removed; a measurement-backed --v7-slot-id is required",
);
const V7_SLOT_COARSE_HYDROLOGY_PROFILE = replacementGeometryInput?.coarseHydrologyProfile ?? (
  V7_SLOT_CONTEXT &&
  landscapeRequiresVisibleWater(
    V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
  )
    ? buildMeasurementDerivedCoarseHydrologyProfile({
        assignment: V7_SLOT_CONTEXT.assignment,
        root: ROOT,
      })
    : null);
const AUTHORIZED_WATER_SEED_REVISION_SLOTS = new Set([
  "v7-capacity-slot-122",
  "v7-capacity-slot-123",
  "v7-capacity-slot-124",
  "v7-capacity-slot-125",
  "v7-capacity-slot-126",
  "v7-capacity-slot-127",
  "v7-capacity-slot-128",
  "v7-capacity-slot-129",
  "v7-capacity-slot-130",
  "v7-capacity-slot-131",
  "v7-capacity-slot-140",
  "v7-capacity-slot-141",
  "v7-capacity-slot-142",
  "v7-capacity-slot-143",
]);
const EXPECTED_V7_SLOT_SEED_REVISION =
  V7_SLOT_ID === "v7-capacity-slot-122"
    ? "owner-directed-v7-capacity-slot-122-water-naturalness-revision-8-20260727"
  : V7_SLOT_ID === "v7-capacity-slot-119"
    ? "owner-directed-v7-capacity-slot-119-route-naturalness-revision-1-20260727"
  : V7_SLOT_ID === "v7-capacity-slot-201"
    ? "owner-directed-v7-capacity-slot-201-full-world-route-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-169"
    ? "owner-directed-v7-capacity-slot-169-full-world-framework-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-205"
    ? "owner-directed-v7-capacity-slot-205-full-world-framework-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-185"
    ? "owner-directed-v7-capacity-slot-185-construction-grammar-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-190"
    ? "owner-directed-v7-capacity-slot-190-cross-modal-rgb-collapse-prevention-revision-6-20260802"
  : V7_SLOT_ID === "v7-capacity-slot-194"
    ? "owner-directed-v7-capacity-slot-194-cross-modal-rgb-collapse-prevention-revision-3-20260801"
    : V7_SLOT_ID === "v7-capacity-slot-123"
      ? null
    : V7_SLOT_ID && AUTHORIZED_WATER_SEED_REVISION_SLOTS.has(V7_SLOT_ID)
      ? `owner-directed-${V7_SLOT_ID}-seed-revision-1-20260727`
      : null;
const V7_SLOT_SEED_REVISION = naturalSources ? null : replacementGeometryInput ? (replacementGeometryInput.waterProjection
  ? "measurement-replacement-geometry-proposal-v2" : "measurement-replacement-geometry-proposal-v1") : valueFor("--v7-slot-seed-revision");
const V7_SLOT_COMPOSITION_REVISION = naturalSources ? "measurement-derived-complete-world-proposal-v1" : replacementGeometryInput ? (replacementGeometryInput.waterProjection
  ? "measurement-derived-complete-world-proposal-v2" : "measurement-derived-complete-world-proposal-v1") : valueFor(
  "--v7-slot-composition-revision",
);
const THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION =
  "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731";
const THAILAND_REBUILD64_SEMANTIC_TOPOLOGY_REVISION =
  "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801";
const THAILAND_REBUILD64_FLOWING_WATER_CONNECTIVITY_REVISION =
  "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801";
const THAILAND_REBUILD64_CROSS_MODAL_RGB_COLLAPSE_PREVENTION_REVISION =
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801";
const EXPECTED_V7_SLOT_COMPOSITION_REVISIONS =
  /^v7-capacity-slot-(14[6-9]|1[5-9][0-9]|20[0-9])$/.test(
    V7_SLOT_ID ?? "",
  )
    ? [
        THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION,
        THAILAND_REBUILD64_SEMANTIC_TOPOLOGY_REVISION,
        THAILAND_REBUILD64_FLOWING_WATER_CONNECTIVITY_REVISION,
        THAILAND_REBUILD64_CROSS_MODAL_RGB_COLLAPSE_PREVENTION_REVISION,
      ]
    : [];
const V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID = naturalSources ? null : valueFor(
  "--v7-slot-seed-preflight-authorization-id",
);
const AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID =
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728";
const SLOT_123_PREFLIGHT_REVISION_PATTERN =
  /^owner-directed-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-micro-candidate-\d+-20260728$/;
const authorizedSlot123SeedPreflightCandidate =
  V7_SLOT_ID === "v7-capacity-slot-123" &&
  V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ===
    AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID &&
  SLOT_123_PREFLIGHT_REVISION_PATTERN.test(
    V7_SLOT_SEED_REVISION ?? "",
  );
const authorizedSlot194SemanticTopologyRevision =
  V7_SLOT_ID === "v7-capacity-slot-194" &&
  V7_SLOT_SEED_REVISION ===
    "owner-directed-v7-capacity-slot-194-semantic-topology-diversity-revision-2-20260801" &&
  fs.existsSync(
    path.resolve(
      ROOT,
      ".runtime/ai-painter/owner-action-requests/owner-authorized-thailand-rebuild64-semantic-topology-diversity-upgrade-20260801/request.json",
    ),
  );
if (V7_SLOT_SEED_REVISION && !replacementGeometryInput) {
  assert(
    V7_SLOT_SEED_REVISION === EXPECTED_V7_SLOT_SEED_REVISION ||
      authorizedSlot123SeedPreflightCandidate ||
      authorizedSlot194SemanticTopologyRevision,
    "V7 slot seed revision is not authorized for this slot",
  );
}
if (V7_SLOT_COMPOSITION_REVISION && !replacementGeometryInput && !naturalSources) {
  assert(
    EXPECTED_V7_SLOT_COMPOSITION_REVISIONS.includes(
      V7_SLOT_COMPOSITION_REVISION,
    ),
    "V7 slot composition revision is not authorized for this slot",
  );
}
if (V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID) {
  assert(
    authorizedSlot123SeedPreflightCandidate,
    "V7 slot seed preflight authorization is invalid",
  );
}
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const OWNER_AUTHORIZATION_REF =
  V7_SLOT_CONTEXT?.authorizationId ??
  "owner-approved-real-geography-naturalization-route-20260724";
const WORLD_PROFILE_ID =
  "mainland-southeast-asia-tropical-monsoon-natural-home-v1";
const CONNECTIVITY_BLUEPRINT_ID =
  "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1";
const WIDTH = 1024;
const HEIGHT = 768;
const {
  buildMeasurementDrivenGrasslandForestCompositionArchitecture,
  buildMeasurementDrivenIndependentCompositionArchitecture,
  applyFullWorldDynamicReadinessToComposition,
  buildFullWorldDynamicReadinessContract,
  buildSlotEcologicalZones,
  placeObjects,
  placeObjectsByCompositionArchitecture,
  objectCountFromFacts,
} = createNaturalWorldComposition({
  width: WIDTH, height: HEIGHT, naturalSources,
  V7_SLOT_COMPOSITION_REVISION,
  THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION,
  canonicalSha256, currentPathBoundaryConnection,
  irregularEllipsePolygon, landscapeTypeToEcosystem, assert,
});
const { geometrySkeletonPayload, compositionOccupancyCells, canonicalTaggedOccupancyFingerprint, maximumTransformedTaggedOccupancySimilarity, buildTransformedSkeletonPayloads, routeOccupancyCells, maximumTransformedOccupancySimilarity } = createNaturalWorldGeometryNovelty({ width: WIDTH, height: HEIGHT, sha256 });
const { buildMeasurementDerivedInternalHydrology } = createNaturalWorldHydrology({
  width: WIDTH, height: HEIGHT, irregularEllipsePolygon,
});
const RUNTIME_ROOT =
  V7_SLOT_CONTEXT?.runtimeRoot ??
  ".runtime/ai-painter/earth-geospatial-complete-map-condition-runs";
const WORLD_FACT_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-naturalized-world-fact-runs",
  "latest.json",
);
const REGION_CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
  "region-contract.json",
);
const CONNECTIVITY_BLUEPRINT_PATH =
  "data/world-samples/world-connectivity/blueprints/mainland-southeast-asia-tropical-monsoon-natural-home-v1/mainland-southeast-asia-earth-reference-natural-home-region-0001-v1/blueprint.json";
const SOURCE_REGISTRY_PATH =
  "data/world-samples/earth-geospatial/source-registry/earth-geospatial-source-registry-v1.json";
const DICTIONARY_PATH =
  "data/world-visual-data-dictionary/mvp-natural-home-v0.3.json";
const WORLD_PROFILE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json";
const FACTUAL_REFERENCE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json";
const ENGINEERED_REMOVAL_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-engineered-removal-runs",
  "latest.json",
);
const WATER_NATURALNESS_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-water-naturalness-profile-runs",
  "latest.json",
);

const createdAtUtc = naturalWorldInput?.createdAtUtc ?? new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
if (naturalSources) {
  const input = structuredClone(naturalWorldInput);
  const identity = Object.fromEntries(["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"].map(k => [k, input[k]]));
  const seedHex = naturalWorldDigest({ identity, sourcePackageIdentity: naturalSources.sourcePackageIdentity, ruleVersion: "natural-world-bootstrap-v1" });
  const random = createNaturalWorldRandom(Number.parseInt(seedHex.slice(0, 8), 16));
  const initialRandomState = random.snapshot();
  const worldFacts = { measuredNaturalFacts: {
    relief: naturalSources.assignment.metrics.elevationMetres,
    landCoverAfterHumanRemoval: { classHistogram: naturalSources.newSourcePackage.measurement.classHistogram },
    climate: naturalSources.climateFacts,
  } };
  const connectivity = buildIndependentTrainingRegionConnectivity({ naturalWorldScope: true, slotId: null,
    assignment: naturalSources.assignment, worldProfileId: input.worldProfileId, sourcePackage: naturalSources.newSourcePackage,
    width: WIDTH, height: HEIGHT, hasWater: landscapeRequiresVisibleWater(naturalSources.assignment.regionalLandscapeType),
    anonymousCompositionArchitectureRevision: V7_SLOT_COMPOSITION_REVISION, regionIdentity: input.regionId });
  const geometry = buildV7SlotGameGeometry({ conditionId: `natural-${seedHex.slice(0, 24)}`, random: () => random.next(), seedHex,
    worldFacts, connectivityBlueprint: connectivity, slotContext: naturalSources,
    routeNaturalnessProfile: naturalSources.routeNaturalnessProfile, waterNaturalnessProfile: null });
  assert(geometry.routeNaturalnessAudit?.passed === true && geometry.terrainRegions.length > 0 && geometry.walkableRegions.length > 0 &&
    geometry.objectFootprints.length > 0 && geometry.collisionRegions.length > 0, "natural geometry production failed");
  return { schemaVersion: "natural-world-generated-facts-v1", scope: "natural_world_runtime_v1", status: "unpublished_natural_world_candidate",
    creationInput: input, identity, tick: 0, stateVersion: 0, ruleVersion: "natural-world-bootstrap-v1", seedHex,
    measuredNaturalFacts: worldFacts.measuredNaturalFacts, geometry, connectivity,
    regionalLandscapeType: naturalSources.assignment.regionalLandscapeType,
    environment: { climate: naturalSources.climateFacts, seasonScenario: naturalSources.contract.state.seasonScenario,
      weather: { status: "unknown", reason: "climatology_is_not_current_weather" },
      lighting: { status: "unknown", reason: "no_current_light_observation_or_simulation_clock" },
      localTime: { status: "unknown", reason: "no_simulation_clock_initialized" }, wind: { status: "unknown", reason: "climatology_is_not_current_wind" } },
    initialRandomState, randomState: random.snapshot(), sourcePackage: naturalSources.newSourcePackage,
    knowledgeDatasetBinding: naturalSources.knowledgeDatasetBinding,
    sourcePackageIdentity: naturalSources.sourcePackageIdentity, sourceInputReads: naturalSources.inputReads,
    outputBoundary: { rgbCreated: false, frameCreated: false, modelExecuted: false, worldEntryEligible: false } };
}
if (replacementGeometryInput) {
  const input = replacementGeometryInput;
  assert(input.schemaVersion === "ai-painter-replacement-geometry-input-v1", "unsupported replacement geometry input");
  assert(input.coarseHydrologyProfile?.measurementFingerprint === V7_SLOT_CONTEXT.assignment.fingerprints.direct,
    "replacement hydrology is not bound to its measurement window");
  assert(/^[a-f0-9]{64}$/.test(input.seedHex ?? ""), "replacement geometry seed missing");
  assert(input.connectivity?.currentRegion?.regionId === input.regionId,
    "replacement connectivity region identity mismatch");
  const worldFacts = buildV7SlotWorldFacts({ conditionId: input.conditionId, seedHex: input.seedHex,
    parentWorldFacts: input.parentWorldFacts, parentWorldFactRun: input.parentWorldFactRun,
    parentWorldFactsSha256: input.parentWorldFactRun.worldFactsSha256, slotContext: V7_SLOT_CONTEXT });
  delete worldFacts.ownerAuthorizationRef;
  worldFacts.status = "unpublished_measurement_derived_world_facts_proposal";
  worldFacts.regionId = input.regionId;
  worldFacts.worldId = input.worldId;
  if (input.waterProjection?.schemaVersion === "measured-joint-through-channel-projection-proposal-v1") {
    assert(input.neighborContext?.role === "neighbor_geometry_context_not_capacity_sample" &&
      input.neighborContext.candidateId === V7_SLOT_CONTEXT.assignment.candidateId &&
      V7_SLOT_CONTEXT.assignment.split === null, "through-channel generation requires an unsplit neighbor context");
    delete worldFacts.v7SlotBinding;
    worldFacts.neighborContextBinding = structuredClone(input.neighborContext);
  }
  const geometry = buildV7SlotGameGeometry({ conditionId: input.conditionId,
    random: mulberry32(Number.parseInt(input.seedHex.slice(0, 8), 16)), seedHex: input.seedHex,
    worldFacts, connectivityBlueprint: input.connectivity, slotContext: V7_SLOT_CONTEXT,
    routeNaturalnessProfile: input.routeNaturalnessProfile, waterNaturalnessProfile: input.waterNaturalnessProfile });
  geometry.connectivityCoordinateProjection = structuredClone(input.connectivity.anonymousTrainingCoordinateProjection);
  return { schemaVersion: "ai-painter-replacement-geometry-proposal-v1", createdAtUtc, createdAtAsiaShanghai,
    status: "complete_geometry_proposed_not_pre_rgb_qualified", worldId: input.worldId, regionId: input.regionId,
    worldFacts, geometry, structuralIdentities: buildCompleteMapStructuralIdentities({ connectivity: input.connectivity, geometry }),
    outputBoundary: { conditionPackCreated: false, imageGenerationStarted: false, rgbCreated: false,
      gpuTrainingStarted: false, trainingAllowed: false, runtimeFrameEligible: false, canEnterWorld: false } };
}
const runId = V7_SLOT_CONTEXT
  ? `earth-geospatial-v7-slot-condition-${V7_SLOT_ID}-${createdAtUtc.replace(
      /[:.]/g,
      "-",
    )}`
  : `earth-geospatial-complete-map-conditions-${createdAtUtc.replace(
      /[:.]/g,
      "-",
    )}`;
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId);
const taskRoot = path.join(runRoot, "complete-map-condition-task");
const commandName = V7_SLOT_CONTEXT
  ? [
      "npm run build:earth-geospatial-v7-mvp-slot-condition --",
      `--v7-slot-id=${V7_SLOT_ID}`,
      ...(V7_SLOT_SEED_REVISION
        ? [`--v7-slot-seed-revision=${V7_SLOT_SEED_REVISION}`]
        : []),
      ...(V7_SLOT_COMPOSITION_REVISION
        ? [
            `--v7-slot-composition-revision=${V7_SLOT_COMPOSITION_REVISION}`,
          ]
        : []),
      ...(V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID
        ? [
            `--v7-slot-seed-preflight-authorization-id=${V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID}`,
          ]
        : []),
    ].join(" ")
  : "npm run build:earth-geospatial-complete-map-conditions";

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_complete_map_conditions_started",
  title: "Earth-reference complete-map condition compilation started",
  titleZh: "真实地理参照完整地图条件编译已启动",
  titleEn: "Earth-reference complete-map condition compilation started",
  summary:
    "程序开始把自然化世界事实和已审核的大世界连接契约归一化为新的匿名游戏坐标，生成世界导演、完整地图任务和23通道。不得读取历史RGB、复制真实地图几何、生成RGB或启动GPU。",
  summaryEn:
    "The program started normalizing naturalized WorldFacts and the approved large-world connectivity contract into new de-identified game coordinates, a World Director output, a complete-map task, and 23 channels. Historical RGB, real-map geometry copying, RGB generation, and GPU execution are forbidden.",
  command: commandName,
  runId,
});

try {
  const worldFactLatest = readJson(WORLD_FACT_LATEST_PATH);
  const worldFactRun = readJson(path.join(ROOT, worldFactLatest.runPath));
  const worldFacts = readJson(path.join(ROOT, worldFactRun.worldFactsPath));
  // Preserve the existing contract-file existence and JSON parsing check.
  readJson(REGION_CONTRACT_PATH);
  const runtimeConnectivityBlueprint = V7_SLOT_CONTEXT
    ? null
    : readJson(path.join(ROOT, CONNECTIVITY_BLUEPRINT_PATH));

  assert(worldFactRun.contractId === CONTRACT_ID, "WorldFacts contract mismatch");
  assert(worldFacts.contractId === CONTRACT_ID, "WorldFacts identity mismatch");
  assert(
    worldFacts.status ===
      "naturalized_world_facts_compiled_conditions_pending",
    "WorldFacts are not ready for condition compilation",
  );
  assert(
    worldFacts.identityBoundary.exactRealWorldGeometryCarriedForward ===
      false &&
      worldFacts.identityBoundary.exactOsmGeometryCarriedForward === false &&
      worldFacts.identityBoundary.finalGameCoordinateGeometryCreated === false,
    "WorldFacts crossed the real-geometry boundary",
  );
  assert(
    worldFacts.autonomyFacts.presetHomeSite === false &&
      worldFacts.autonomyFacts.presetActivityCenter === false &&
      worldFacts.autonomyFacts.presetConstructionClearing === false &&
      worldFacts.autonomyFacts.focalAreaActive === false,
    "WorldFacts violate the initial-world autonomy contract",
  );
  if (runtimeConnectivityBlueprint) {
    assert(
      runtimeConnectivityBlueprint.blueprintId ===
        CONNECTIVITY_BLUEPRINT_ID,
      "connectivity blueprint mismatch",
    );
    assert(
      runtimeConnectivityBlueprint.worldProfileId === WORLD_PROFILE_ID,
      "connectivity world profile mismatch",
    );
  }

  const realEarthRegionSourcePackage = buildRealEarthRegionSourcePackage({
    root: ROOT,
    assignment: V7_SLOT_CONTEXT.assignment,
    regionContractPath: projectPath(REGION_CONTRACT_PATH),
    sourceRegistryPath: SOURCE_REGISTRY_PATH,
    factualReferencePath: FACTUAL_REFERENCE_PATH,
    worldProfilePath: WORLD_PROFILE_PATH,
    seasonSnapshotPath: V7_SLOT_CONTEXT.snapshotPath,
    measurementWindowPlanPath: V7_SLOT_CONTEXT.planPath,
  });
  const realEarthRegionSourcePackagePath = path.join(
    taskRoot,
    "real-earth-region-source-package.json",
  );
  writeJsonAtomic(
    realEarthRegionSourcePackagePath,
    realEarthRegionSourcePackage,
  );
  const realEarthRegionSourcePackageArtifactSha256 = sha256File(
    realEarthRegionSourcePackagePath,
  );

  const effectiveConnectivityBlueprint =
    buildIndependentTrainingRegionConnectivity({
      slotId: V7_SLOT_ID,
      assignment: V7_SLOT_CONTEXT.assignment,
      worldProfileId: WORLD_PROFILE_ID,
      sourcePackage: realEarthRegionSourcePackage,
      width: WIDTH,
      height: HEIGHT,
      hasWater: landscapeRequiresVisibleWater(
        V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
      ),
      anonymousCompositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION,
    });
  const effectiveConnectivityBlueprintPath = path.join(
    taskRoot,
    "regional-connectivity-instance.json",
  );
  writeJsonAtomic(
    effectiveConnectivityBlueprintPath,
    effectiveConnectivityBlueprint,
  );
  const effectiveConnectivityBlueprintArtifactSha256 = sha256File(
    effectiveConnectivityBlueprintPath,
  );

  const parentWorldFactsSha256 = sha256File(
    path.join(ROOT, worldFactRun.worldFactsPath),
  );
  const seedHex = sha256(
    Buffer.from(
      [
        parentWorldFactsSha256,
        realEarthRegionSourcePackage.packageSha256,
        effectiveConnectivityBlueprint.connectivityInstanceSha256,
        V7_SLOT_CONTEXT?.assignment?.fingerprints?.direct ?? "base-condition",
        V7_SLOT_ID ?? "base-condition",
        V7_SLOT_SEED_REVISION ?? "initial-seed-revision",
        V7_SLOT_COMPOSITION_REVISION ??
          "initial-composition-architecture",
        V7_SLOT_COARSE_HYDROLOGY_PROFILE
          ? COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY
          : "no-coarse-hydrology-profile",
        "deidentified-complete-map-game-coordinate-normalization-v2",
      ].join(":"),
    ),
  );
  const random = mulberry32(Number.parseInt(seedHex.slice(0, 8), 16));
  const conditionId = V7_SLOT_CONTEXT
    ? `earth-reference-v7-${V7_SLOT_ID}-${seedHex.slice(0, 12)}`
    : `earth-reference-naturalized-complete-map-${seedHex.slice(0, 12)}`;
  const worldId = `training-world:${conditionId}`;
  const taskId = `world-visual-task-${conditionId}-${createdAtUtc.replace(
    /[:.]/g,
    "-",
  )}`;
  const directorRunId = `world-director-${conditionId}-${createdAtUtc.replace(
    /[:.]/g,
    "-",
  )}`;
  const effectiveWorldFacts = V7_SLOT_CONTEXT
    ? buildV7SlotWorldFacts({
        conditionId,
        seedHex,
        parentWorldFacts: worldFacts,
        parentWorldFactRun: worldFactRun,
        parentWorldFactsSha256,
        slotContext: V7_SLOT_CONTEXT,
      })
    : worldFacts;
  const slotWorldFactsPath = V7_SLOT_CONTEXT
    ? path.join(taskRoot, "slot-world-facts.json")
    : path.join(ROOT, worldFactRun.worldFactsPath);
  if (V7_SLOT_CONTEXT) {
    writeJsonAtomic(slotWorldFactsPath, effectiveWorldFacts);
  }
  const effectiveWorldFactRun = V7_SLOT_CONTEXT
    ? {
        runId,
        worldFactsPath: projectPath(slotWorldFactsPath),
      }
    : worldFactRun;
  const worldFactsSha256 = sha256File(slotWorldFactsPath);
  const routeNaturalnessProfile = V7_SLOT_CONTEXT
    ? loadAnonymousRouteNaturalnessProfile()
    : null;
  const routeNaturalnessProfilePath = V7_SLOT_CONTEXT
    ? path.join(taskRoot, "route-naturalness-reference-profile.json")
    : null;
  if (routeNaturalnessProfilePath) {
    writeJsonAtomic(routeNaturalnessProfilePath, routeNaturalnessProfile);
  }
  const waterNaturalnessProfile =
    V7_SLOT_CONTEXT &&
    landscapeRequiresVisibleWater(
      V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
    )
      ? loadAnonymousWaterNaturalnessProfile()
      : null;
  const waterNaturalnessProfilePath = waterNaturalnessProfile
    ? path.join(taskRoot, "water-naturalness-reference-profile.json")
    : null;
  if (waterNaturalnessProfilePath) {
    writeJsonAtomic(waterNaturalnessProfilePath, waterNaturalnessProfile);
  }

  const geometry = buildV7SlotGameGeometry({
    conditionId,
    random,
    seedHex,
    worldFacts: effectiveWorldFacts,
    connectivityBlueprint: effectiveConnectivityBlueprint,
    slotContext: V7_SLOT_CONTEXT,
    routeNaturalnessProfile,
    waterNaturalnessProfile,
  });
  if (V7_SLOT_CONTEXT) {
    geometry.connectivityCoordinateProjection =
      structuredClone(
        effectiveConnectivityBlueprint
          .anonymousTrainingCoordinateProjection,
      );
    geometry.routeNaturalnessReference = {
      profileId: routeNaturalnessProfile.profileId,
      profilePath: projectPath(routeNaturalnessProfilePath),
      profileSha256: sha256File(routeNaturalnessProfilePath),
      aggregateStatisticsOnly: true,
      exactOsmGeometryCarriedForward: false,
    };
    if (waterNaturalnessProfile) {
      geometry.waterNaturalnessReference = {
        profileId: waterNaturalnessProfile.profileId,
        profilePath: projectPath(waterNaturalnessProfilePath),
        profileSha256: sha256File(waterNaturalnessProfilePath),
        aggregateStatisticsOnly: true,
        exactOsmGeometryCarriedForward: false,
      };
    }
    geometry.geometryNoveltyAudit = auditV7SlotGeometryNovelty({
      geometry,
      slotContext: V7_SLOT_CONTEXT,
    });
  }
  const structuralIdentities = buildCompleteMapStructuralIdentities({
    connectivity: effectiveConnectivityBlueprint,
    geometry,
  });
  const sourceFactIds = buildSourceFactIds(conditionId, geometry);
  const blueprint = buildBlueprint({
    conditionId,
    worldId,
    taskId,
    seedHex,
    worldFacts: effectiveWorldFacts,
    worldFactRun: effectiveWorldFactRun,
    geometry,
    connectivityBlueprint: effectiveConnectivityBlueprint,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    realEarthRegionSourcePackage,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    structuralIdentities,
  });
  applyV7SlotBlueprintContext(blueprint, V7_SLOT_CONTEXT);
  blueprint.blueprintSha256 = canonicalSha256(blueprint);
  const blueprintPath = path.join(taskRoot, "world-fact-blueprint.json");
  writeJsonAtomic(blueprintPath, blueprint);

  const director = buildDirector({
    conditionId,
    worldId,
    taskId,
    directorRunId,
    sourceFactIds,
    worldFacts: effectiveWorldFacts,
    geometry,
  });
  applyV7SlotDirectorContext(director, V7_SLOT_CONTEXT, geometry);
  director.directorSha256 = canonicalSha256(director);
  const directorPath = path.join(taskRoot, "director-output.json");
  writeJsonAtomic(directorPath, director);

  const visualFacts = buildVisualFactManifest({
    conditionId,
    worldId,
    taskId,
    sourceFactIds,
    worldFacts: effectiveWorldFacts,
    geometry,
  });
  applyV7SlotVisualFactContext(visualFacts, V7_SLOT_CONTEXT);
  visualFacts.manifestSha256 = canonicalSha256(visualFacts);
  const visualFactPath = path.join(taskRoot, "visual-fact-manifest.json");
  writeJsonAtomic(visualFactPath, visualFacts);

  const task = buildTask({
    conditionId,
    worldId,
    taskId,
    director,
    geometry,
    visualFacts,
    blueprintPath,
    directorPath,
    visualFactPath,
    worldFacts: effectiveWorldFacts,
    worldFactRun: effectiveWorldFactRun,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    realEarthRegionSourcePackage,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
  });
  applyV7SlotTaskContext(task, V7_SLOT_CONTEXT);
  task.taskSha256 = canonicalSha256(task);
  const taskPath = path.join(taskRoot, "task-package.json");
  writeJsonAtomic(taskPath, task);

  const taskManifestPath = path.join(taskRoot, "task-manifest.json");
  const taskManifest = {
    schemaVersion: "world-visual-generation-task-manifest-v1",
    taskId,
    status: task.status,
    inferenceStatus: "rgb_generation_not_started",
    createdAt: createdAtUtc,
    createdAtAsiaShanghai,
    dictionaryVersionId: task.dictionaryVersionId,
    worldId,
    ownerId: task.ownerId,
    tick: task.tick,
    worldProfileId: WORLD_PROFILE_ID,
    generationContractVersion: task.generationContractVersion,
    conditionLabel: conditionId,
    earthParameterSnapshotId: task.earthParameterSnapshotId,
    sourceMode: V7_SLOT_CONTEXT
      ? "bounded_real_measurement_window_plus_independent_region_source_and_connectivity"
      : "naturalized_earth_facts_plus_locked_connectivity",
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    realEarthRegionSourcePackageArtifactSha256,
    connectivityBlueprintId:
      effectiveConnectivityBlueprint.blueprintId,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    connectivityBlueprintSha256:
      effectiveConnectivityBlueprint.connectivityInstanceSha256,
    connectivityBlueprintArtifactSha256:
      effectiveConnectivityBlueprintArtifactSha256,
    structuralIdentities,
    v7SlotId: V7_SLOT_ID,
    split: V7_SLOT_CONTEXT?.assignment?.split ?? "unassigned_pre_rgb",
    taskSha256: task.taskSha256,
    taskPath: projectPath(taskPath),
    manifestPath: projectPath(taskManifestPath),
    directorPath: projectPath(directorPath),
    blueprintPath: projectPath(blueprintPath),
    imageCount: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    automaticStorage: true,
  };
  writeJsonAtomic(taskManifestPath, taskManifest);

  execFileSync(
    process.execPath,
    [
      path.join(ROOT, "scripts", "compile-current-world-visual-conditions.mjs"),
      "--task-manifest",
      projectPath(taskManifestPath),
    ],
    { cwd: ROOT, stdio: "pipe" },
  );

  const conditionPackPath = path.join(
    taskRoot,
    "compiled-conditions",
    "condition-pack.json",
  );
  const conditionManifestPath = path.join(
    taskRoot,
    "compiled-conditions",
    "manifest.json",
  );
  const conditionPack = readJson(conditionPackPath);
  const conditionManifest = readJson(conditionManifestPath);
  assert(
    conditionManifest.channelCount === 23 &&
      conditionPack.channels?.length === 23,
    "complete-map compiler did not create exactly 23 channels",
  );

  const scopeAudit = await auditCompleteMapScope({
    blueprint,
    directorOutput: director,
    task,
    conditionPack,
    connectivityBlueprint: effectiveConnectivityBlueprint,
  });
  assert(
    scopeAudit.passed === true &&
      scopeAudit.status === "complete_map_scope_passed",
    `complete-map scope audit failed: ${scopeAudit.issues.join(",")}`,
  );
  const scopeAuditPath = path.join(taskRoot, "complete-map-scope-audit.json");
  writeJsonAtomic(scopeAuditPath, scopeAudit);

  const lineage = {
    schemaVersion: "earth-reference-complete-map-condition-lineage-v1",
    runId,
    conditionId,
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    sourceWorldFactRunId: effectiveWorldFactRun.runId,
    sourceWorldFactsPath: effectiveWorldFactRun.worldFactsPath,
    sourceWorldFactsSha256: worldFactsSha256,
    parentWorldFactRunId: V7_SLOT_CONTEXT ? worldFactRun.runId : null,
    parentWorldFactsPath: V7_SLOT_CONTEXT
      ? worldFactRun.worldFactsPath
      : null,
    parentWorldFactsSha256: V7_SLOT_CONTEXT
      ? parentWorldFactsSha256
      : null,
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    realEarthRegionSourcePackageArtifactSha256,
    connectivityBlueprintId:
      effectiveConnectivityBlueprint.blueprintId,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    connectivityBlueprintSha256:
      effectiveConnectivityBlueprint.connectivityInstanceSha256,
    connectivityBlueprintArtifactSha256:
      effectiveConnectivityBlueprintArtifactSha256,
    concreteRegion0001InstanceRead: false,
    structuralIdentities,
    normalizationAlgorithm: {
      id: "deidentified-complete-map-game-coordinate-normalization-v2",
      deterministicSeedSha256: seedHex,
      seedRevision: V7_SLOT_SEED_REVISION ?? null,
      compositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION ?? null,
      seedPreflightAuthorizationId:
        V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
      consumesAggregateMeasuredFactsOnly: true,
      copiesRealMapGeometry: false,
      copiesOsmGeometry: false,
      readsHistoricalRgb: false,
      usesHistoricalLayout: false,
      createsNewGameCoordinateGeometry: true,
    },
    routeNaturalnessReference: V7_SLOT_CONTEXT
      ? {
          profileId: routeNaturalnessProfile.profileId,
          profilePath: projectPath(routeNaturalnessProfilePath),
          profileSha256: sha256File(routeNaturalnessProfilePath),
          publicSourceProvider:
            routeNaturalnessProfile.source.provider,
          publicSourceLicense:
            routeNaturalnessProfile.source.license,
          aggregateStatisticsOnly: true,
          exactOsmGeometryCarriedForward: false,
          coordinatesPersistedInProfile: false,
        }
      : null,
    waterNaturalnessReference: waterNaturalnessProfile
      ? {
          profileId: waterNaturalnessProfile.profileId,
          profilePath: projectPath(waterNaturalnessProfilePath),
          profileSha256: sha256File(waterNaturalnessProfilePath),
          publicSourceProvider:
            waterNaturalnessProfile.source.provider,
          publicSourceLicense:
            waterNaturalnessProfile.source.license,
          aggregateStatisticsOnly: true,
          exactOsmGeometryCarriedForward: false,
          coordinatesPersistedInProfile: false,
          osmElementIdsPersistedInProfile: false,
        }
      : null,
    v7SlotBinding: V7_SLOT_CONTEXT
      ? {
          slotId: V7_SLOT_ID,
          split: V7_SLOT_CONTEXT.assignment.split,
          regionalLandscapeType:
            V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
          monsoonSeason: V7_SLOT_CONTEXT.assignment.monsoonSeason,
          measurementWindowPlanRunId: V7_SLOT_CONTEXT.planRunId,
          measurementWindowPlanPath: V7_SLOT_CONTEXT.planPath,
          measurementWindowPlanSha256: V7_SLOT_CONTEXT.planSha256,
          candidateId: V7_SLOT_CONTEXT.assignment.candidateId,
          measurementFingerprint:
            V7_SLOT_CONTEXT.assignment.fingerprints.direct,
          anonymousGameCoordinateSeedRevision:
            V7_SLOT_SEED_REVISION ?? null,
          anonymousCompositionArchitectureRevision:
            V7_SLOT_COMPOSITION_REVISION ?? null,
          anonymousGameCoordinateSeedPreflightAuthorizationId:
            V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
          exactMeasurementGeometryCarriedForward: false,
          sourcePixelWindowCarriedIntoGameGeometry: false,
        }
      : null,
    autonomyContract: {
      presetHomeSite: false,
      presetActivityCenter: false,
      presetConstructionClearing: false,
      presetRouteConvergencePlatform: false,
      focalAreaActive: false,
      focalAreaRequiredValue: "all_zero",
    },
    outputBoundary: {
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
  };
  const lineagePath = path.join(taskRoot, "condition-lineage.json");
  writeJsonAtomic(lineagePath, lineage);

  indexRunFiles(runRoot, runId);
  const runManifest = {
    schemaVersion: "earth-reference-complete-map-condition-run-v1",
    runId,
    status: "complete_map_conditions_ready_rgb_authorization_required",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    conditionId,
    worldFactRunId: effectiveWorldFactRun.runId,
    worldFactsPath: effectiveWorldFactRun.worldFactsPath,
    worldFactsSha256,
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    realEarthRegionSourcePackageArtifactSha256,
    connectivityBlueprintId:
      effectiveConnectivityBlueprint.blueprintId,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    connectivityBlueprintSha256:
      effectiveConnectivityBlueprint.connectivityInstanceSha256,
    connectivityBlueprintArtifactSha256:
      effectiveConnectivityBlueprintArtifactSha256,
    structuralIdentities,
    v7SlotId: V7_SLOT_ID,
    split: V7_SLOT_CONTEXT?.assignment?.split ?? null,
    regionalLandscapeType:
      V7_SLOT_CONTEXT?.assignment?.regionalLandscapeType ?? null,
    monsoonSeason: V7_SLOT_CONTEXT?.assignment?.monsoonSeason ?? null,
    anonymousGameCoordinateSeedRevision:
      V7_SLOT_SEED_REVISION ?? null,
    anonymousCompositionArchitectureRevision:
      V7_SLOT_COMPOSITION_REVISION ?? null,
    anonymousGameCoordinateSeedPreflightAuthorizationId:
      V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
    routeNaturalnessProfilePath: V7_SLOT_CONTEXT
      ? projectPath(routeNaturalnessProfilePath)
      : null,
    routeNaturalnessProfileSha256: V7_SLOT_CONTEXT
      ? sha256File(routeNaturalnessProfilePath)
      : null,
    routeNaturalnessAudit:
      geometry.routeNaturalnessAudit ?? null,
    routeWaterAvoidanceAudit:
      geometry.routeWaterAvoidanceAudit ?? null,
    waterNaturalnessProfilePath: waterNaturalnessProfilePath
      ? projectPath(waterNaturalnessProfilePath)
      : null,
    waterNaturalnessProfileSha256: waterNaturalnessProfilePath
      ? sha256File(waterNaturalnessProfilePath)
      : null,
    waterNaturalnessAudit:
      geometry.waterNaturalnessAudit ?? null,
    waterCorridorShapeAudit:
      geometry.waterCorridorShapeAudit ?? null,
    internalHydrologyProfile:
      geometry.internalHydrologyProfile ?? null,
    internalHydrologyAudit:
      geometry.internalHydrologyAudit ?? null,
    lateralContinuationAudit:
      geometry.lateralContinuationAudit ?? null,
    coarseHydrologyMainChannelProfile:
      geometry.coarseHydrologyMainChannelProfile ?? null,
    mainChannelSelection:
      geometry.mainChannelSelection ?? null,
    blueprintPath: projectPath(blueprintPath),
    blueprintSha256: sha256File(blueprintPath),
    directorPath: projectPath(directorPath),
    directorSha256: sha256File(directorPath),
    visualFactManifestPath: projectPath(visualFactPath),
    visualFactManifestSha256: sha256File(visualFactPath),
    taskPath: projectPath(taskPath),
    taskSha256: sha256File(taskPath),
    taskManifestPath: projectPath(taskManifestPath),
    taskManifestSha256: sha256File(taskManifestPath),
    conditionManifestPath: projectPath(conditionManifestPath),
    conditionManifestSha256: sha256File(conditionManifestPath),
    conditionPackPath: projectPath(conditionPackPath),
    conditionPackSha256: sha256File(conditionPackPath),
    scopeAuditPath: projectPath(scopeAuditPath),
    scopeAuditSha256: sha256File(scopeAuditPath),
    lineagePath: projectPath(lineagePath),
    lineageSha256: sha256File(lineagePath),
    channelCount: conditionManifest.channelCount,
    completeMapScopePassed: true,
    focalAreaNonZeroCount:
      conditionPack.channels.find((entry) => entry.id === "focal_area")
        ?.statistics?.nonZeroCount ?? -1,
    exactRealWorldGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
    historicalRgbRead: false,
    historicalLayoutRead: false,
    newGameCoordinateGeometryCreated: true,
    remainingBlockers: [],
    nextRequiredAuthorization:
      "owner_authorization_required_before_any_rgb_generation",
    outputBoundary: {
      worldDirectorOutputCreated: true,
      completeMap23ChannelsCreated: true,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
  };

  if (!V7_SLOT_CONTEXT) {
    updateRegionContract(runManifest);
  }
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "complete-map-condition-run.json",
    record: runManifest,
    latest: {
      contractId: CONTRACT_ID,
      conditionId,
      v7SlotId: V7_SLOT_ID,
      split: V7_SLOT_CONTEXT?.assignment?.split ?? null,
      channelCount: 23,
      completeMapScopePassed: true,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_complete_map_conditions_completed",
    title: "Earth-reference complete-map conditions passed",
    titleZh: "真实地理参照完整地图条件已通过",
    titleEn: "Earth-reference complete-map conditions passed",
    summary:
      "程序已自动保存自然化世界事实绑定、世界导演、完整地图任务、23通道、范围审核、来源谱系、双时区时间和哈希。focal_area为全零；未读取历史RGB或真实地图几何，未生成RGB，未启动GPU。",
    summaryEn:
      "The program automatically stored the naturalized WorldFacts binding, World Director output, complete-map task, 23 channels, scope audit, source lineage, dual-timezone timestamps, and hashes. focal_area is all-zero; no historical RGB or real-map geometry was read, no RGB was created, and no GPU was started.",
    command: commandName,
    runId,
    evidencePath: runPath,
  });

  console.log(
    JSON.stringify(
      {
        runId,
        status: runManifest.status,
        conditionId,
        v7SlotId: V7_SLOT_ID,
        split: V7_SLOT_CONTEXT?.assignment?.split ?? null,
        regionalLandscapeType:
          V7_SLOT_CONTEXT?.assignment?.regionalLandscapeType ?? null,
        monsoonSeason: V7_SLOT_CONTEXT?.assignment?.monsoonSeason ?? null,
        channelCount: runManifest.channelCount,
        completeMapScopePassed: runManifest.completeMapScopePassed,
        focalAreaNonZeroCount: runManifest.focalAreaNonZeroCount,
        remainingBlockers: runManifest.remainingBlockers,
        nextRequiredAuthorization: runManifest.nextRequiredAuthorization,
        imageGenerationStarted: false,
        gpuTrainingStarted: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  const failure = {
    schemaVersion: "earth-reference-complete-map-condition-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    v7SlotId: V7_SLOT_ID,
    anonymousGameCoordinateSeedRevision:
      V7_SLOT_SEED_REVISION ?? null,
    anonymousCompositionArchitectureRevision:
      V7_SLOT_COMPOSITION_REVISION ?? null,
    anonymousGameCoordinateSeedPreflightAuthorizationId:
      V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
    errorCode: "earth_geospatial_complete_map_conditions_failed",
    error: error instanceof Error ? error.message : String(error),
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    rgbCreated: false,
  };
  const failurePath = path.join(runRoot, "failure.json");
  writeJsonAtomic(failurePath, failure);
  indexFile(failurePath, runId);
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_complete_map_conditions_failed",
    title: "Earth-reference complete-map condition compilation failed",
    titleZh: "真实地理参照完整地图条件编译失败",
    titleEn: "Earth-reference complete-map condition compilation failed",
    summary: failure.error,
    summaryEn: failure.error,
    command: commandName,
    runId,
    evidencePath: projectPath(failurePath),
  });
  throw error;
}

function buildV7SlotWorldFacts({
  conditionId,
  seedHex,
  parentWorldFacts,
  parentWorldFactRun,
  parentWorldFactsSha256,
  slotContext,
}) {
  const assignment = slotContext.assignment;
  const metrics = assignment.metrics;
  const totalPixels = WIDTH * HEIGHT;
  const treeRatio = Number(
    metrics.reconstructedLandCoverRatio?.treeCover ?? 0,
  );
  const shrubRatio = Number(
    metrics.reconstructedLandCoverRatio?.shrubland ?? 0,
  );
  const grassRatio = Number(
    metrics.reconstructedLandCoverRatio?.grassland ?? 0,
  );
  const bareRatio = Number(
    metrics.reconstructedLandCoverRatio?.bareOrSparse ?? 0,
  );
  const meanElevation = Number(metrics.elevationMetres?.mean ?? 0);
  const reliefClass =
    meanElevation < 350
      ? "lowland"
      : meanElevation < 520
        ? "river_valley_to_foothill"
        : meanElevation < 700
          ? "foothill"
          : "low_mountain";
  const targetSystem = landscapeTypeToEcosystem(
    assignment.regionalLandscapeType,
  );

  return {
    ...structuredClone(parentWorldFacts),
    schemaVersion: "earth-reference-v7-slot-world-facts-v1",
    worldFactSetId: `world-facts-${conditionId}`,
    status: "v7_slot_world_facts_compiled_conditions_pending",
    createdAtUtc,
    createdAtAsiaShanghai,
    ownerAuthorizationRef: slotContext.authorizationId,
    parentWorldFacts: {
      runId: parentWorldFactRun.runId,
      path: parentWorldFactRun.worldFactsPath,
      sha256: parentWorldFactsSha256,
    },
    v7SlotBinding: {
      slotId: V7_SLOT_ID,
      split: assignment.split,
      regionalLandscapeType: assignment.regionalLandscapeType,
      monsoonSeason: assignment.monsoonSeason,
      requiredEntranceDirection:
        assignment.requiredEntranceDirection,
      coverageRole: assignment.coverageRole,
      measurementWindowPlanRunId: slotContext.planRunId,
      measurementWindowPlanPath: slotContext.planPath,
      measurementWindowPlanSha256: slotContext.planSha256,
      candidateId: assignment.candidateId,
      measurementBounds: assignment.measurementBounds,
      sourcePixelWindow: assignment.sourcePixelWindow,
      measurementFingerprint: assignment.fingerprints.direct,
      anonymousGameCoordinateSeedRevision:
        V7_SLOT_SEED_REVISION ?? null,
      anonymousCompositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION ?? null,
      anonymousGameCoordinateSeedPreflightAuthorizationId:
        V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
      transformCanonicalFingerprint:
        assignment.fingerprints.transformCanonical,
      exactMeasurementGeometryCarriedForward: false,
      sourcePixelWindowCarriedIntoGameGeometry: false,
      targetEcologyIsDirectlyClaimedByWindowSelection: false,
      additionalEvidenceRequirements:
        assignment.additionalEvidenceRequirements,
    },
    measuredNaturalFacts: {
      ...structuredClone(parentWorldFacts.measuredNaturalFacts),
      relief: {
        minimumMetres: metrics.elevationMetres.minimum,
        maximumMetres: metrics.elevationMetres.maximum,
        meanMetres: metrics.elevationMetres.mean,
        relativeElevation: metrics.relativeElevation,
        relativeRelief: metrics.relativeRelief,
        normalizedSlope: metrics.normalizedSlope,
        derivedClass: reliefClass,
        derivation:
          "aggregate_measurement_window_statistics_without_real_geometry_copy",
      },
      drainage: {
        likelihoodRatio: metrics.drainageLikelihoodRatio,
        role:
          "aggregate_support_only_not_a_mandatory_visible_water_geometry",
      },
      landCoverAfterHumanRemoval: {
        classHistogram: {
          "10": Math.round(totalPixels * treeRatio),
          "20": Math.round(totalPixels * shrubRatio),
          "30": Math.round(totalPixels * grassRatio),
          "60": Math.round(totalPixels * bareRatio),
        },
        classRatio: {
          treeCover: treeRatio,
          shrubland: shrubRatio,
          grassland: grassRatio,
          bareOrSparse: bareRatio,
        },
        humanRemovalRatio: metrics.humanRemovalRatio,
        exactRasterCarriedForward: false,
      },
    },
    ecologyFacts: {
      ...structuredClone(parentWorldFacts.ecologyFacts),
      targetRegionalLandscapeType: assignment.regionalLandscapeType,
      supportedNaturalSystems: [
        targetSystem,
        ...new Set(
          slotContext.factualReference.earthFacts?.ecosystems ?? [],
        ),
      ].filter(Boolean),
      evidence: {
        regionalProfileId: slotContext.worldProfile.worldProfileId,
        regionalProfilePath: WORLD_PROFILE_PATH,
        factualReferenceId: slotContext.factualReference.referenceId,
        factualReferencePath: FACTUAL_REFERENCE_PATH,
        seasonSnapshotId: slotContext.snapshot.snapshotId,
        seasonSnapshotPath: slotContext.snapshotPath,
        externalImagesUsed: false,
      },
    },
    environmentContext: structuredClone(slotContext.snapshot.environment),
    identityBoundary: {
      ...structuredClone(parentWorldFacts.identityBoundary),
      exactRealWorldGeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      exactMeasurementWindowGeometryCarriedForward: false,
      finalGameCoordinateGeometryCreated: true,
      deterministicAnonymousGeometrySeedSha256: seedHex,
    },
    autonomyFacts: {
      ...structuredClone(parentWorldFacts.autonomyFacts),
      presetHomeSite: false,
      presetActivityCenter: false,
      presetConstructionClearing: false,
      focalAreaActive: false,
    },
    outputBoundary: {
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
  };
}

function loadAnonymousRouteNaturalnessProfile() {
  const latest = readJson(ENGINEERED_REMOVAL_LATEST_PATH);
  const manifestPath = path.join(ROOT, latest.runPath);
  const manifest = readJson(manifestPath);
  assert(
    manifest.status === "engineered_feature_removal_evidence_compiled",
    "engineered-removal evidence is not ready for route naturalness aggregation",
  );
  assert(
    manifest.source?.provider === "OpenStreetMap contributors" &&
      manifest.source?.license === "Open Database License (ODbL) 1.0",
    "public route source identity or license is invalid",
  );
  const rawResponsePath = path.join(ROOT, manifest.source.rawResponsePath);
  assert(
    sha256File(rawResponsePath) === manifest.source.rawResponseSha256,
    "public route source hash mismatch",
  );
  const rawOsm = readJson(rawResponsePath);
  const profile = buildAnonymousRouteNaturalnessProfile({
    rawOsm,
    createdAtUtc,
    createdAtAsiaShanghai,
    source: {
      profileId:
        "sakaerat-wang-nam-khiao-anonymous-route-naturalness-v1",
      sourceId: manifest.source.sourceId,
      provider: manifest.source.provider,
      product: manifest.source.product,
      license: manifest.source.license,
      licenseUrl: manifest.source.licenseUrl,
      attribution: manifest.source.attribution,
      acquiredAtUtc: manifest.source.acquiredAtUtc,
      acquiredAtAsiaShanghai: manifest.source.acquiredAtAsiaShanghai,
      rawResponsePath: manifest.source.rawResponsePath,
      rawResponseSha256: manifest.source.rawResponseSha256,
      engineeredRemovalManifestPath: latest.runPath,
      engineeredRemovalManifestSha256: sha256File(manifestPath),
      ownerAuthorizationRefs: [
        manifest.ownerAuthorizationRef,
        "project-owner-command-2026-07-27-slot-119-rejected-route-too-rigid",
        "project-owner-authorization-2026-07-27-slot-119-anonymous-route-naturalness-repair",
      ],
    },
  });
  profile.profileSha256 = canonicalSha256(profile);
  return profile;
}

function loadAnonymousWaterNaturalnessProfile() {
  const latest = readJson(WATER_NATURALNESS_LATEST_PATH);
  const manifestPath = path.join(ROOT, latest.runPath);
  const manifest = readJson(manifestPath);
  assert(
    manifest.status ===
      "aggregate_public_water_naturalness_profile_ready",
    "public water naturalness profile run is not ready",
  );
  assert(
    manifest.source?.provider === "OpenStreetMap contributors" &&
      manifest.source?.license === "Open Database License (ODbL) 1.0",
    "public water source identity or license is invalid",
  );
  assert(
    sha256File(path.join(ROOT, manifest.profilePath)) ===
      manifest.profileSha256 &&
      latest.profilePath === manifest.profilePath &&
      latest.profileSha256 === manifest.profileSha256,
    "public water naturalness profile hash mismatch",
  );
  assert(
    sha256File(path.join(ROOT, manifest.rawResponsePath)) ===
      manifest.rawResponseSha256,
    "public water source response hash mismatch",
  );
  const profile = readJson(path.join(ROOT, manifest.profilePath));
  assert(
    profile.status ===
      "aggregate_public_water_naturalness_profile_ready" &&
      profile.selection?.measurableWayCount >=
        profile.selection?.minimumSourceWayCount &&
      profile.source?.exactGeometryCopied === false &&
      profile.source?.coordinatesPersistedInProfile === false &&
      profile.source?.osmElementIdsPersistedInProfile === false &&
      profile.source?.perFeatureMetricsPersistedInProfile === false &&
      profile.identityBoundary?.exactOsmGeometryCarriedForward === false &&
      profile.identityBoundary?.finalGameCoordinatesRemainAnonymous === true,
    "public water profile crossed the aggregate-only identity boundary",
  );
  const conditionReferenceProfile = structuredClone(profile);
  delete conditionReferenceProfile.profileSha256;
  delete conditionReferenceProfile.source.regionalAggregateBounds;
  delete conditionReferenceProfile.source.observationBounds;
  conditionReferenceProfile.source.acquisitionProfilePath =
    manifest.profilePath;
  conditionReferenceProfile.source.acquisitionProfileSha256 =
    manifest.profileSha256;
  conditionReferenceProfile.source.coordinatesPersistedInProfile = false;
  return conditionReferenceProfile;
}

function buildV7SlotGameGeometry({
  conditionId,
  random,
  seedHex,
  worldFacts,
  connectivityBlueprint,
  slotContext,
  routeNaturalnessProfile,
  waterNaturalnessProfile,
}) {
  const assignment = slotContext.assignment;
  const hasWater = landscapeRequiresVisibleWater(
    assignment.regionalLandscapeType,
  );
  const layoutProfile =
    buildMeasurementDrivenAnonymousLayoutProfile({
      assignment,
      hasWater,
      coarseHydrologyProfile:
        V7_SLOT_COARSE_HYDROLOGY_PROFILE,
      routeSearchExpansionRevision:
        [
          THAILAND_REBUILD64_SEMANTIC_TOPOLOGY_REVISION,
          THAILAND_REBUILD64_FLOWING_WATER_CONNECTIVITY_REVISION,
          THAILAND_REBUILD64_CROSS_MODAL_RGB_COLLAPSE_PREVENTION_REVISION,
          "measurement-derived-complete-world-proposal-v1",
          "measurement-derived-complete-world-proposal-v2",
        ].includes(V7_SLOT_COMPOSITION_REVISION)
          ? V7_SLOT_COMPOSITION_REVISION
          : null,
    });
  const topology = layoutProfile.routeTopology;
  let waterGeometry = null;
  let route = null;
  let pathPolygon = null;
  if (
    hasWater &&
    layoutProfile.coarseHydrologyMainChannelProfile
  ) {
    waterGeometry = buildAnonymousWaterGeometry({
      random,
      routePolygon: null,
      waterNaturalnessProfile,
      connectivityBlueprint,
      broadRiverControlFractions:
        layoutProfile.waterControlFractions,
      internalHydrologyProfile:
        layoutProfile.internalHydrologyProfile,
      coarseHydrologyProfile:
        layoutProfile.coarseHydrologyMainChannelProfile,
    });
    route = buildAnonymousRouteAvoidingWater({
      topology,
      random,
      routeNaturalnessProfile,
      layoutProfile,
      waterPolygons: waterGeometry.waterPolygons,
      connectivityBlueprint,
    });
    pathPolygon = route.pathPolygon;
  } else {
    route = buildAnonymousRoute(
      topology,
      random,
      routeNaturalnessProfile,
      layoutProfile,
      connectivityBlueprint,
    );
    pathPolygon = ribbonPolygonVariable(
      route.points,
      buildNaturalRouteHalfWidths(route.points.length, random),
      WIDTH,
      HEIGHT,
    );
  }
  const pathCenterline = route.points;
  const entranceBounds = route.entranceBounds;
  const baseCompositionArchitecture = V7_SLOT_COMPOSITION_REVISION
    ? V7_SLOT_ID === "v7-capacity-slot-198"
      ? buildMeasurementDrivenGrasslandForestCompositionArchitecture({
          assignment,
          random,
        })
      : buildMeasurementDrivenIndependentCompositionArchitecture({
          assignment,
          random,
        })
    : null;
  const compositionArchitecture = baseCompositionArchitecture
    ? applyFullWorldDynamicReadinessToComposition({
        architecture: baseCompositionArchitecture,
        assignment,
        connectivityBlueprint,
      })
    : null;
  const waterBoundaryEdges = waterGeometry?.usedEdges ?? [];
  const usedBoundaryEdges = [
    ...new Set([...route.usedEdges, ...waterBoundaryEdges]),
  ];
  const naturalBoundaryCandidates = compositionArchitecture
    ? buildMosaicNaturalBoundaries(usedBoundaryEdges, random)
    : buildAnonymousNaturalBoundaries(usedBoundaryEdges, random);
  const naturalBoundaryPolygons = compositionArchitecture
    ? naturalBoundaryCandidates.filter(
        (polygon) => !polygonsOverlap(pathPolygon, polygon),
      )
    : naturalBoundaryCandidates;
  assert(
    naturalBoundaryPolygons.length > 0,
    "measurement-driven composition has no route-safe natural boundary polygon",
  );
  const tallGrassRegions = compositionArchitecture?.tallGrassRegions ?? [
    irregularEllipsePolygon(
      randomInt(210, 390, random),
      randomInt(150, 310, random),
      randomInt(92, 142, random),
      randomInt(46, 78, random),
      18,
      random,
    ),
    irregularEllipsePolygon(
      randomInt(570, 790, random),
      randomInt(420, 610, random),
      randomInt(104, 158, random),
      randomInt(52, 86, random),
      18,
      random,
    ),
    irregularEllipsePolygon(
      randomInt(360, 650, random),
      randomInt(300, 500, random),
      randomInt(72, 118, random),
      randomInt(38, 68, random),
      16,
      random,
    ),
  ];
  const mudRegions = compositionArchitecture?.mudRegions ?? [
    irregularEllipsePolygon(
      randomInt(180, 820, random),
      randomInt(150, 620, random),
      randomInt(46, 74, random),
      randomInt(22, 38, random),
      16,
      random,
    ),
  ];
  if (hasWater && !waterGeometry) {
    waterGeometry = buildAnonymousWaterGeometry({
          random,
          routePolygon: pathPolygon,
          waterNaturalnessProfile,
          connectivityBlueprint,
          broadRiverControlFractions:
            layoutProfile.waterControlFractions,
          internalHydrologyProfile:
            layoutProfile.internalHydrologyProfile,
          coarseHydrologyProfile:
            layoutProfile.coarseHydrologyMainChannelProfile,
        });
  }
  const baseGrass = rectanglePolygon(0, 0, WIDTH, HEIGHT);
  const terrainRegions = [
    terrain(`${conditionId}-grass`, "grass", baseGrass),
    ...(waterGeometry
      ? [
          ...waterGeometry.waterPolygons.map((polygon, index) =>
            terrain(
              `${conditionId}-water-${index + 1}`,
              "water",
              polygon,
            ),
          ),
          ...waterGeometry.shorelinePolygons.map((polygon, index) =>
            terrain(
              `${conditionId}-shoreline-${index + 1}`,
              "shoreline",
              polygon,
            ),
          ),
        ]
      : []),
    terrain(`${conditionId}-path`, "path_ground", pathPolygon),
    ...naturalBoundaryPolygons.map((polygon, index) =>
      terrain(
        `${conditionId}-natural-boundary-${index + 1}`,
        "natural_boundary",
        polygon,
      ),
    ),
    ...tallGrassRegions.map((polygon, index) =>
      terrain(
        `${conditionId}-tall-grass-${index + 1}`,
        "tall_grass",
        polygon,
      ),
    ),
    ...mudRegions.map((polygon, index) =>
      terrain(`${conditionId}-mud-${index + 1}`, "mud_patch", polygon),
    ),
  ];
  const walkableRegions = [
    { sourceId: `${conditionId}-path-walkable`, polygon: pathPolygon },
  ];
  const collisionRegions = [
    ...(waterGeometry
      ? waterGeometry.waterPolygons.map((polygon, index) => ({
          sourceId: `${conditionId}-water-collision-${index + 1}`,
          polygon,
        }))
      : []),
    ...naturalBoundaryPolygons.map((polygon, index) => ({
      sourceId: `${conditionId}-boundary-collision-${index + 1}`,
      polygon,
    })),
  ];
  const forbiddenMasks = [
    pathPolygon,
    ...naturalBoundaryPolygons,
    ...(waterGeometry ? waterGeometry.waterPolygons : []),
  ];
  const objectFootprints = compositionArchitecture
    ? placeObjectsByCompositionArchitecture({
        conditionId,
        random,
        forbiddenMasks,
        targetCount: objectCountFromFacts(worldFacts),
        architecture: compositionArchitecture,
      })
    : placeObjects({
        conditionId,
        random,
        forbiddenMasks,
        targetCount: objectCountFromFacts(worldFacts),
      });
  for (const object of objectFootprints) {
    if (object.blocksMovement) {
      collisionRegions.push({
        sourceId: `${object.objectId}-collision`,
        polygon: boundsPolygon(object.footprint),
      });
    }
  }

  const currentPorts = (connectivityBlueprint.edgePorts ?? []).filter(
    (entry) => entry.regionId === connectivityBlueprint.currentRegion.regionId,
  );
  const pathPortIds = currentPorts
    .filter((entry) => entry.kind === "path")
    .map((entry) => entry.edgePortId);
  return {
    hasWater,
    entranceBounds,
    focalBounds: null,
    terrainRegions,
    walkableRegions,
    collisionRegions,
    objectFootprints,
    pathCenterline,
    waterCenterline: waterGeometry?.centerline ?? [],
    waterHalfWidths: waterGeometry?.waterHalfWidths ?? [],
    waterBranchCenterlines:
      waterGeometry?.branchCenterlines ?? [],
    waterBranchHalfWidths:
      waterGeometry?.branchHalfWidths ?? [],
    waterConnectivityPorts:
      waterGeometry?.connectivityPorts ?? null,
    routeTopology: topology,
    routeNaturalnessAudit: route.naturalnessAudit,
    routeWaterAvoidanceAudit:
      route.waterAvoidanceAudit ?? null,
    waterNaturalnessAudit:
      waterGeometry?.naturalnessAudit ?? null,
    waterCorridorShapeAudit:
      waterGeometry?.corridorShapeAudit ?? null,
    internalHydrologyProfile:
      waterGeometry?.internalHydrologyProfile ?? null,
    internalHydrologyAudit:
      waterGeometry?.internalHydrologyAudit ?? null,
    lateralContinuationAudit:
      waterGeometry?.lateralContinuationAudit ?? null,
    coarseHydrologyMainChannelProfile:
      waterGeometry?.coarseHydrologyProfile ?? null,
    mainChannelSelection:
      waterGeometry?.mainChannelSelection ?? null,
    ecologicalZones: buildSlotEcologicalZones({
      conditionId,
      assignment,
      hasWater,
      compositionArchitecture,
    }),
    compositionArchitecture,
    worldFrameContract: buildFullWorldDynamicReadinessContract({
      assignment,
      connectivityBlueprint,
    }),
    connectivityEvidence: {
      routeTopology: topology,
      pathPortIds,
      largeWorldConnectionSemantics:
        "current_region_path_graph_binding_without_real_geometry_copy",
      waterRequiredByCurrentWorldFacts: hasWater,
    },
    geometryDerivation: describeMeasuredWaterDerivation({ base: {
      methodId: MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
      seedFingerprint: seedHex,
      seedRevision: V7_SLOT_SEED_REVISION ?? null,
      compositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION ?? null,
      seedPreflightAuthorizationId:
        V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
      measurementSupportFingerprint: assignment.fingerprints.direct,
      measurementTopologyFingerprint:
        layoutProfile.topologySelection
          .measurementTopologyFingerprint,
      aggregateLayoutProfileSha256: layoutProfile.profileSha256,
      exactRealWorldGeometryCarriedForward: false,
      exactMeasurementWindowGeometryCarriedForward: false,
      sourcePixelWindowCarriedForward: false,
      historicalRgbRead: false,
      historicalLayoutRead: false,
      mirrorOrRotationTemplateUsed: false,
      layoutVariant: layoutProfile.layoutVariant,
      routeTopologyFamily:
        MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
      routeWaterAvoidanceMethod:
        route.waterAvoidanceAudit
          ? "measurement_fact_driven_independent_full_free_space_candidate_passage_v8"
          : null,
      routeWaterAvoidancePassed:
        route.waterAvoidanceAudit?.passed ?? null,
      macroTopologySource:
        layoutProfile.coarseHydrologyMainChannelProfile
          ? "measurement_window_aggregate_facts_plus_all_eight_quantized_thai_dem_d8_to_independent_internal_hydrology_without_fixed_boundary_water_ports"
          : "measurement_window_fingerprint_plus_aggregate_natural_facts",
      retrySeedAffectsMacroTopology: false,
      retrySeedScope:
        layoutProfile.topologySelection.retrySeedScope,
      layoutSelectionByte:
        layoutProfile.topologySelection.layoutSelectionByte,
      routeTopologySelectionByte:
        layoutProfile.topologySelection.routeTopologySelectionByte,
      routeMacroProfileSha256:
        layoutProfile.waterAvoidingRoutePlan?.routeMacroProfile
          ?.profileSha256 ?? null,
      waterControlProfileSelectionByte:
        layoutProfile.topologySelection
          .waterControlProfileSelectionByte,
      waterControlProfileIndex:
        layoutProfile.waterControlProfileIndex,
      internalHydrologyFamily:
        layoutProfile.internalHydrologyProfile?.family ?? null,
      internalHydrologyProfileSha256:
        layoutProfile.internalHydrologyProfile?.profileSha256 ?? null,
      coarseHydrologyMainChannelFamily:
        layoutProfile.coarseHydrologyMainChannelProfile?.family ??
        null,
      coarseHydrologyMainChannelProfileSha256:
        layoutProfile.coarseHydrologyMainChannelProfile
          ?.profileSha256 ?? null,
      coarseHydrologyMainChannelSource:
        layoutProfile.coarseHydrologyMainChannelProfile
          ? structuredClone(
              layoutProfile.coarseHydrologyMainChannelProfile
                .source,
            )
          : null,
      exactD8GeometryCarriedForward: false,
      internalHydrologySelectionByte:
        layoutProfile.topologySelection
          .internalHydrologySelectionByte,
      floodplainBasinSelectionByte:
        layoutProfile.topologySelection
          .floodplainBasinSelectionByte,
    }, projection: replacementGeometryInput?.waterProjection ?? null }),
  };
}

function auditV7SlotGeometryNovelty({ geometry, slotContext }) {
  const directFingerprint = sha256(
    Buffer.from(JSON.stringify(geometrySkeletonPayload(geometry))),
  );
  const transformedPayloads = buildTransformedSkeletonPayloads(geometry);
  const transformCanonicalFingerprint = sha256(
    Buffer.from([...transformedPayloads].sort()[0]),
  );
  const routeOccupancy = routeOccupancyCells(geometry.pathCenterline);
  const compositionOccupancy = compositionOccupancyCells(geometry);
  const compositionCanonicalFingerprint = canonicalTaggedOccupancyFingerprint([
    ...routeOccupancy.map((cell) => `route:${cell}`),
    ...compositionOccupancy,
  ]);
  const previousComparisons = [];
  let supersededSameSlotConditionRunCount = 0;
  const runtimeRoot = path.join(ROOT, slotContext.runtimeRoot);
  if (fs.existsSync(runtimeRoot)) {
    for (const entry of fs.readdirSync(runtimeRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(
        runtimeRoot,
        entry.name,
        "complete-map-condition-run.json",
      );
      if (!fs.existsSync(manifestPath)) continue;
      const previousManifest = readJson(manifestPath);
      if (!previousManifest.v7SlotId) continue;
      if (
        previousManifest.v7SlotId === V7_SLOT_ID &&
        !geometry.geometryDerivation?.compositionArchitectureRevision
      ) {
        supersededSameSlotConditionRunCount += 1;
        continue;
      }
      if (previousManifest.v7SlotId === V7_SLOT_ID) {
        supersededSameSlotConditionRunCount += 1;
      }
      const previousBlueprint = readJson(
        path.join(ROOT, previousManifest.blueprintPath),
      );
      const previousGeometry = previousBlueprint.geometry;
      const previousCanonical =
        previousGeometry.geometryNoveltyAudit
          ?.transformCanonicalFingerprint ??
        sha256(
          Buffer.from(
            [...buildTransformedSkeletonPayloads(previousGeometry)].sort()[0],
          ),
        );
      const previousOccupancy =
        previousGeometry.geometryNoveltyAudit?.routeOccupancy ??
        routeOccupancyCells(previousGeometry.pathCenterline);
      const previousCompositionOccupancy =
        previousGeometry.geometryNoveltyAudit?.compositionOccupancy ??
        compositionOccupancyCells(previousGeometry);
      const routeSimilarity =
        maximumTransformedOccupancySimilarity(
          routeOccupancy,
          previousOccupancy,
        );
      const compositionSimilarity =
        maximumTransformedTaggedOccupancySimilarity(
          compositionOccupancy,
          previousCompositionOccupancy,
        );
      previousComparisons.push({
        slotId: previousManifest.v7SlotId,
        conditionId: previousManifest.conditionId,
        comparisonClass:
          previousManifest.v7SlotId === V7_SLOT_ID
            ? "superseded_same_slot_condition"
            : "other_capacity_slot",
        transformCanonicalFingerprint: previousCanonical,
        compositionCanonicalFingerprint:
          previousGeometry.geometryNoveltyAudit
            ?.compositionCanonicalFingerprint ??
          canonicalTaggedOccupancyFingerprint([
            ...previousOccupancy.map((cell) => `route:${cell}`),
            ...previousCompositionOccupancy,
          ]),
        maximumRouteOccupancySimilarity: routeSimilarity,
        maximumCompositionOccupancySimilarity:
          compositionSimilarity,
        maximumCompleteFrameworkSimilarity: Number(
          (routeSimilarity * 0.35 +
            compositionSimilarity * 0.65).toFixed(6),
        ),
      });
    }
  }
  const exactTransformDuplicate = previousComparisons.find(
    (entry) =>
      entry.transformCanonicalFingerprint ===
      transformCanonicalFingerprint,
  );
  const mostSimilar = [...previousComparisons].sort(
    (left, right) =>
      right.maximumRouteOccupancySimilarity -
      left.maximumRouteOccupancySimilarity,
  )[0] ?? null;
  const mostSimilarFramework = [...previousComparisons].sort(
    (left, right) =>
      right.maximumCompleteFrameworkSimilarity -
      left.maximumCompleteFrameworkSimilarity,
  )[0] ?? null;
  const comparedUniqueSlotIds = [
    ...new Set(previousComparisons.map((entry) => entry.slotId)),
  ].sort();
  const requiredCapacitySlotIds = geometry.geometryDerivation
    ?.compositionArchitectureRevision
    ? Array.from(
        { length: 64 },
        (_, index) => `v7-capacity-slot-${146 + index}`,
      )
    : [];
  const missingRequiredCapacitySlotIds = requiredCapacitySlotIds.filter(
    (slotId) => !comparedUniqueSlotIds.includes(slotId),
  );
  const maximumAllowedRouteOccupancySimilarity = 0.92;
  const maximumAllowedCompleteFrameworkSimilarity = 0.68;
  assert(
    !exactTransformDuplicate,
    `V7 slot geometry is an exact mirror/rotation duplicate of ${exactTransformDuplicate?.slotId}`,
  );
  assert(
    !mostSimilarFramework ||
      mostSimilarFramework.maximumCompleteFrameworkSimilarity <
        maximumAllowedCompleteFrameworkSimilarity,
    `V7 slot complete composition framework is too similar to ${mostSimilarFramework?.slotId}: ${mostSimilarFramework?.maximumCompleteFrameworkSimilarity}`,
  );
  assert(
    !mostSimilar ||
      mostSimilar.maximumRouteOccupancySimilarity <
        maximumAllowedRouteOccupancySimilarity,
    `V7 slot route skeleton is too similar to ${mostSimilar?.slotId}: ${mostSimilar?.maximumRouteOccupancySimilarity}`,
  );
  assert(
    missingRequiredCapacitySlotIds.length === 0,
    `V7 slot complete-framework audit did not compare all 64 capacity identities: ${missingRequiredCapacitySlotIds.join(", ")}`,
  );
  return {
    schemaVersion: "v7-slot-game-geometry-novelty-audit-v1",
    status: "passed",
    directFingerprint,
    transformCanonicalFingerprint,
    routeOccupancy,
    compositionOccupancy,
    compositionCanonicalFingerprint,
    comparedSlotCount: previousComparisons.length,
    comparedUniqueSlotCount: comparedUniqueSlotIds.length,
    comparedUniqueSlotIds,
    requiredCapacitySlotIds,
    missingRequiredCapacitySlotIds,
    supersededSameSlotConditionRunCount,
    sameCapacityIdentityComparedAsIndependentMap:
      Boolean(geometry.geometryDerivation?.compositionArchitectureRevision),
    maximumAllowedRouteOccupancySimilarity,
    maximumAllowedCompleteFrameworkSimilarity,
    mostSimilarPreviousSlot: mostSimilar,
    mostSimilarCompleteFramework: mostSimilarFramework,
    sameSlotSupersededConditionsCompared:
      Boolean(geometry.geometryDerivation?.compositionArchitectureRevision),
    exactTransformDuplicateFound: false,
    mirrorOrRotationTemplateUsed: false,
    sharedRouteSkeletonDetected: false,
  };
}

function currentPathBoundaryConnection(connectivityBlueprint) {
  const currentRegionId =
    connectivityBlueprint.currentRegion.regionId;
  const pathPort = (
    connectivityBlueprint.edgePorts ?? []
  ).find(
    (entry) =>
      entry.regionId === currentRegionId &&
      entry.kind === "path" &&
      entry.boundaryPosition,
  );
  assert(pathPort, "current regional path connectivity port is missing");
  return {
    edgePortId: pathPort.edgePortId,
    boundarySide: pathPort.boundarySide,
    point: {
      x: pathPort.boundaryPosition.x,
      y: pathPort.boundaryPosition.y,
    },
  };
}

function currentPathInteriorEntryPoint(connectivityBlueprint) {
  const pathPlan =
    connectivityBlueprint.anonymousTrainingCoordinateProjection
      ?.pathPlan;
  const point = pathPlan?.interiorEntryPoint;
  const contract = pathPlan?.interiorEntryDepthContract;
  assert(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      contract?.version ===
        "complete-map-boundary-port-to-interior-depth-v1" &&
      contract.completeMapRouteSpanThreshold === 0.35 &&
      contract.reviewThresholdChanged === false,
    "current regional path interior-entry depth contract is missing",
  );
  const side = pathPlan.boundarySide;
  const normalizedDepth =
    side === "west"
      ? point.x / WIDTH
      : side === "east"
        ? (WIDTH - point.x) / WIDTH
        : side === "north"
          ? point.y / HEIGHT
          : (HEIGHT - point.y) / HEIGHT;
  assert(
    normalizedDepth >= contract.minimumNormalizedDepth &&
      normalizedDepth >
        contract.completeMapRouteSpanThreshold,
    "current regional path interior entry is too shallow for a complete map",
  );
  return {
    x: point.x,
    y: point.y,
  };
}

function boundarySideToCanvasEdge(boundarySide) {
  const edge = {
    north: "top",
    east: "right",
    south: "bottom",
    west: "left",
  }[boundarySide];
  assert(
    edge,
    `unsupported connectivity boundary side: ${boundarySide}`,
  );
  return edge;
}

function entranceBoundsForBoundaryConnection(connection) {
  const point = connection.point;
  if (connection.boundarySide === "west") {
    return {
      x: 0,
      y: clamp(point.y - 42, 0, HEIGHT - 84),
      width: 52,
      height: 84,
    };
  }
  if (connection.boundarySide === "east") {
    return {
      x: WIDTH - 52,
      y: clamp(point.y - 42, 0, HEIGHT - 84),
      width: 52,
      height: 84,
    };
  }
  if (connection.boundarySide === "north") {
    return {
      x: clamp(point.x - 42, 0, WIDTH - 84),
      y: 0,
      width: 84,
      height: 52,
    };
  }
  return {
    x: clamp(point.x - 42, 0, WIDTH - 84),
    y: HEIGHT - 52,
    width: 84,
    height: 52,
  };
}

function pointStaysWithinRouteBoundaryEnvelope({
  point,
  connection,
  margin,
  approachHalfWidth,
}) {
  const inside =
    point.x >= margin &&
    point.x <= WIDTH - margin &&
    point.y >= margin &&
    point.y <= HEIGHT - margin;
  if (inside) return true;
  if (
    connection.boundarySide === "west" ||
    connection.boundarySide === "east"
  ) {
    const touchesConnectedSide =
      connection.boundarySide === "west"
        ? point.x < margin
        : point.x > WIDTH - margin;
    return (
      touchesConnectedSide &&
      point.y >= margin &&
      point.y <= HEIGHT - margin &&
      Math.abs(point.y - connection.point.y) <= approachHalfWidth
    );
  }
  const touchesConnectedSide =
    connection.boundarySide === "north"
      ? point.y < margin
      : point.y > HEIGHT - margin;
  return (
    touchesConnectedSide &&
    point.x >= margin &&
    point.x <= WIDTH - margin &&
    Math.abs(point.x - connection.point.x) <= approachHalfWidth
  );
}

function buildAnonymousRoute(
  topology,
  random,
  routeNaturalnessProfile,
  layoutProfile,
  connectivityBlueprint,
) {
  const pathConnection =
    currentPathBoundaryConnection(connectivityBlueprint);
  const pathBoundaryPosition = pathConnection.point;
  const pathBoundaryEdge = boundarySideToCanvasEdge(
    pathConnection.boundarySide,
  );
  const pathInteriorEntryPoint =
    currentPathInteriorEntryPoint(connectivityBlueprint);
  const controls = {
    left_to_right_meandering_passage: {
      start: { x: 0, y: randomInt(470, 610, random) },
      end: { x: WIDTH, y: randomInt(150, 290, random) },
      usedEdges: ["left", "right"],
    },
    top_to_bottom_broken_curve_passage: {
      start: { x: randomInt(180, 360, random), y: 0 },
      end: { x: randomInt(650, 850, random), y: HEIGHT },
      usedEdges: ["top", "bottom"],
    },
    left_to_bottom_diagonal_passage: {
      start: { x: 0, y: randomInt(170, 340, random) },
      end: { x: randomInt(620, 850, random), y: HEIGHT },
      usedEdges: ["left", "bottom"],
    },
    right_to_bottom_diagonal_passage: {
      start: { x: WIDTH, y: randomInt(150, 330, random) },
      end: { x: randomInt(170, 420, random), y: HEIGHT },
      usedEdges: ["right", "bottom"],
    },
    upper_bank_transverse_passage: {
      start: { x: 0, y: randomInt(120, 230, random) },
      end: { x: WIDTH, y: randomInt(140, 270, random) },
      usedEdges: ["left", "right"],
    },
    seeded_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
    upper_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
    lower_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
    transverse_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
  };
  const selected = controls[topology];
  assert(
    routeNaturalnessProfile?.status ===
      "aggregate_public_route_naturalness_profile_ready",
    "anonymous route naturalness reference profile is missing",
  );
  const naturalRoute = buildNaturalAnonymousCenterline({
    start: selected.start,
    end: selected.end,
    random,
    width: WIDTH,
    height: HEIGHT,
    profile: routeNaturalnessProfile,
    safeBounds: null,
  });
  const start = selected.start;
  const connectedPoint =
    start.x === 0 ||
    start.x === WIDTH ||
    start.y === 0 ||
    start.y === HEIGHT
      ? start
      : selected.end;
  const entranceBounds =
    connectedPoint.x === 0
      ? {
          x: 0,
          y: clamp(connectedPoint.y - 42, 0, HEIGHT - 84),
          width: 52,
          height: 84,
        }
      : connectedPoint.x === WIDTH
        ? {
            x: WIDTH - 52,
            y: clamp(connectedPoint.y - 42, 0, HEIGHT - 84),
            width: 52,
            height: 84,
          }
        : connectedPoint.y === HEIGHT
          ? {
              x: clamp(connectedPoint.x - 42, 0, WIDTH - 84),
              y: HEIGHT - 52,
              width: 84,
              height: 52,
            }
          : {
              x: clamp(connectedPoint.x - 42, 0, WIDTH - 84),
              y: 0,
              width: 84,
              height: 52,
            };
  return {
    points: naturalRoute.points,
    naturalnessAudit: naturalRoute.audit,
    entranceBounds,
    usedEdges: selected.usedEdges,
  };
}

function buildAnonymousRouteAvoidingWater({
  topology,
  random,
  routeNaturalnessProfile,
  layoutProfile,
  waterPolygons,
  connectivityBlueprint,
}) {
  assert(
    [
      "seeded_interior_to_current_region_port_passage",
      "upper_interior_to_current_region_port_passage",
      "lower_interior_to_current_region_port_passage",
      "transverse_interior_to_current_region_port_passage",
    ].includes(topology) &&
      Array.isArray(waterPolygons) &&
      waterPolygons.length > 0,
    "water-avoiding route construction inputs are invalid",
  );
  const routePlan = layoutProfile.waterAvoidingRoutePlan;
  assert(
    [
      "measurement-driven-full-free-space-route-plan-v8",
      "measurement-driven-full-free-space-route-plan-v9",
      "measurement-driven-full-free-space-route-plan-v10",
    ].includes(routePlan.schemaVersion) &&
      routePlan.routeTopology === topology &&
      [
        "measurement_selected_anonymous_origin_candidates_then_full_canvas_water_collision_rejection",
        "measurement_selected_anonymous_origin_candidates_plus_connectivity_boundary_projected_candidates_then_full_canvas_water_collision_rejection",
      ].includes(routePlan.method) &&
      routePlan.exactD8GeometryCarriedForward === false &&
      routePlan.sourcePixelCoordinatesRead === false &&
      routePlan.historicalGeometryRead === false &&
      routePlan.fixedSharedSkeletonUsed === false &&
      routePlan.connectivityPortsAreBoundaryConstraintsOnly === true &&
      Array.isArray(routePlan.candidateOriginFractions) &&
      routePlan.candidateOriginFractions.length >= 8 &&
      Number.isInteger(routePlan.preferredOriginIndex) &&
      routePlan.preferredOriginIndex >= 0 &&
      routePlan.preferredOriginIndex <
        routePlan.candidateOriginFractions.length &&
      routePlan.candidateOriginFractions.every(
        (entry) =>
          Number.isFinite(entry.x) &&
          Number.isFinite(entry.y) &&
          entry.x > 0 &&
          entry.x < 1 &&
          entry.y > 0 &&
          entry.y < 1,
      ) &&
      routePlan.candidateAttemptsPerOrigin >= 4 &&
      routePlan.routeMacroProfile?.sourceBandCount === 8 &&
      routePlan.routeMacroProfile
        ?.connectivityPortsAreBoundaryConstraintsOnly === true &&
      routePlan.routeMacroProfile?.slotIdentityRead === false &&
      routePlan.routeMacroProfile?.retrySeedRead === false &&
      routePlan.routeMacroProfile?.historicalGeometryRead === false &&
      routePlan.routeMacroProfile?.fixedSharedSkeletonUsed === false,
    "measurement-driven full-free-space route plan is invalid",
  );
  const pathConnection =
    currentPathBoundaryConnection(connectivityBlueprint);
  const end = pathConnection.point;
  const boundaryProjectedOrigins =
    routePlan.boundaryProjectedCandidateExpansionRequired === true
      ? routePlan.candidateOriginFractions.map((origin) => {
          if (pathConnection.boundarySide === "west") {
            return { x: 0.12 + origin.x * 0.38, y: origin.y };
          }
          if (pathConnection.boundarySide === "east") {
            return { x: 0.88 - origin.x * 0.38, y: origin.y };
          }
          if (pathConnection.boundarySide === "north") {
            return { x: origin.x, y: 0.12 + origin.y * 0.38 };
          }
          return { x: origin.x, y: 0.88 - origin.y * 0.38 };
        })
      : [];
  const effectiveOrigins = [
    ...routePlan.candidateOriginFractions.map((origin) => ({
      ...origin,
      source: "measurement_selected_full_canvas",
    })),
    ...boundaryProjectedOrigins.map((origin) => ({
      ...origin,
      source: "connectivity_boundary_projected",
    })),
  ];
  const candidates = [];
  const failures = [];
  const excludedOrigins = [];
  let evaluatedAttemptCount = 0;
  for (
    let originIndex = 0;
    originIndex < effectiveOrigins.length;
    originIndex += 1
  ) {
    const origin = effectiveOrigins[originIndex];
    const start = {
      x: Math.round(WIDTH * origin.x),
      y: Math.round(HEIGHT * origin.y),
    };
    if (replacementGeometryInput?.waterProjection && !replacementPathOriginWithinContract(start,
      pathConnection.boundarySide, { width: WIDTH, height: HEIGHT },
      connectivityBlueprint.anonymousTrainingCoordinateProjection.pathPlan.interiorEntryDepthContract)) {
      excludedOrigins.push({ originIndex, code: "route_origin_outside_existing_depth_contract" });
      continue;
    }
    for (
      let originAttempt = 1;
      originAttempt <= routePlan.candidateAttemptsPerOrigin;
      originAttempt += 1
    ) {
      evaluatedAttemptCount += 1;
      let naturalRoute = null;
      try {
        naturalRoute = buildNaturalAnonymousCenterline({
          start,
          end,
          random,
          width: WIDTH,
          height: HEIGHT,
          profile: routeNaturalnessProfile,
        });
      } catch (error) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_naturalness_envelope_failed",
          message: String(error?.message ?? error).slice(
            0,
            500,
          ),
        });
        continue;
      }
      const halfWidths = buildNaturalRouteHalfWidths(
        naturalRoute.points.length,
        random,
      );
      const interiorBoundaryMargin =
        Math.max(...halfWidths) + 66;
      const connectedBoundaryApproachHalfWidth = Math.max(
        42,
        interiorBoundaryMargin,
      );
      const staysInsideUnconnectedBoundaries =
        naturalRoute.points
          .slice(0, -1)
          .every(
            (point) =>
              pointStaysWithinRouteBoundaryEnvelope({
                point,
                connection: pathConnection,
                margin: interiorBoundaryMargin,
                approachHalfWidth:
                  connectedBoundaryApproachHalfWidth,
              }),
          );
      if (!staysInsideUnconnectedBoundaries) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_touches_uncontracted_map_boundary",
        });
        continue;
      }
      const pathPolygon = ribbonPolygonVariable(
        naturalRoute.points,
        halfWidths,
        WIDTH,
        HEIGHT,
      );
      const overlapsWater = waterPolygons.some(
        (waterPolygon) =>
          polygonsOverlap(pathPolygon, waterPolygon),
      );
      if (overlapsWater) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_water_geometry_conflict",
        });
        continue;
      }
      const chordRatio =
        Math.hypot(start.x - end.x, start.y - end.y) /
        Math.hypot(WIDTH, HEIGHT);
      if (chordRatio < routePlan.completeMapMinimumChordRatio) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_complete_map_span_insufficient",
          chordRatio: Number(chordRatio.toFixed(6)),
        });
        continue;
      }
      candidates.push({
        originIndex,
        originSource: origin.source,
        originAttempt,
        start,
        points: naturalRoute.points,
        naturalnessAudit: naturalRoute.audit,
        halfWidths,
        pathPolygon,
        chordRatio,
        measurementOriginDistance: Math.min(
          Math.abs(
            originIndex - routePlan.preferredOriginIndex,
          ),
          routePlan.candidateOriginFractions.length -
            Math.abs(
              originIndex - routePlan.preferredOriginIndex,
            ),
        ),
      });
    }
  }
  assert(
    candidates.length > 0,
    `water-avoiding anonymous route could not satisfy the existing gates: ${JSON.stringify(
      {
        routeOriginSelectionByte:
          routePlan.routeOriginSelectionByte,
        candidateOriginFractions:
          routePlan.candidateOriginFractions,
        failures,
      },
    )}`,
  );
  const targetSinuosity =
    routeNaturalnessProfile.anonymousGenerationEnvelope
      .targetSinuosity;
  candidates.sort(
    (left, right) =>
      right.chordRatio - left.chordRatio ||
      left.measurementOriginDistance -
        right.measurementOriginDistance ||
      Math.abs(
        left.naturalnessAudit.sinuosity - targetSinuosity,
      ) -
        Math.abs(
          right.naturalnessAudit.sinuosity -
            targetSinuosity,
        ) ||
      left.originIndex - right.originIndex ||
      left.originAttempt - right.originAttempt,
  );
  const selected = candidates[0];
  return {
    points: selected.points,
    naturalnessAudit: selected.naturalnessAudit,
    pathPolygon: selected.pathPolygon,
    entranceBounds: entranceBoundsForBoundaryConnection(
      pathConnection,
    ),
    usedEdges: [
      boundarySideToCanvasEdge(pathConnection.boundarySide),
    ],
    waterAvoidanceAudit: {
      schemaVersion:
        replacementGeometryInput?.waterProjection ? "anonymous-route-water-avoidance-audit-v7" : "anonymous-route-water-avoidance-audit-v6",
      status: "passed",
      passed: true,
      topology,
      selectedOriginIndex: selected.originIndex,
      selectedOrigin: selected.start,
      selectedOriginSource: selected.originSource,
      selectedOriginAttempt: selected.originAttempt,
      selectedOriginMeasurementDistance:
        selected.measurementOriginDistance,
      evaluatedAttemptCount,
      baseCandidateOriginCount:
        routePlan.candidateOriginFractions.length,
      boundaryProjectedCandidateOriginCount:
        boundaryProjectedOrigins.length,
      effectiveCandidateOriginCount: effectiveOrigins.length,
      passingCandidateCount: candidates.length,
      rejectedCandidateCount: failures.length,
      ...(replacementGeometryInput?.waterProjection ? { excludedOrigins, originDepthContractChecked: true } : {}),
      fullCanvasCandidateSearch: true,
      sideEnvelopeFollowed: false,
      measurementDrivenRoutePlan:
        structuredClone(routePlan),
      completeMapChordRatio: Number(
        selected.chordRatio.toFixed(6),
      ),
      pathWaterOverlap: false,
      currentRegionPathPortPreserved: true,
      pathBoundarySide: pathConnection.boundarySide,
      waterGeometrySource:
        "current_anonymous_dem_d8_driven_water_polygons",
      exactRealWorldGeometryUsed: false,
      exactD8GeometryUsed: false,
      retrySeedAffectsMacroTopology: false,
    },
  };
}

function buildAnonymousNaturalBoundaries(usedEdges, random) {
  const availableEdges = ["top", "right", "bottom", "left"].filter(
    (edge) => !usedEdges.includes(edge),
  );
  return availableEdges.map((edge) => {
    const thickness = randomInt(38, 62, random);
    if (edge === "top") {
      return [
        { x: 0, y: 0 },
        { x: WIDTH, y: 0 },
        { x: WIDTH, y: thickness + randomInt(-8, 8, random) },
        { x: Math.round(WIDTH * 0.66), y: thickness + randomInt(-10, 10, random) },
        { x: Math.round(WIDTH * 0.34), y: thickness + randomInt(-10, 10, random) },
        { x: 0, y: thickness + randomInt(-8, 8, random) },
      ];
    }
    if (edge === "bottom") {
      return [
        { x: 0, y: HEIGHT },
        { x: WIDTH, y: HEIGHT },
        { x: WIDTH, y: HEIGHT - thickness + randomInt(-8, 8, random) },
        { x: Math.round(WIDTH * 0.62), y: HEIGHT - thickness + randomInt(-10, 10, random) },
        { x: Math.round(WIDTH * 0.28), y: HEIGHT - thickness + randomInt(-10, 10, random) },
        { x: 0, y: HEIGHT - thickness + randomInt(-8, 8, random) },
      ];
    }
    if (edge === "left") {
      return rectanglePolygon(0, 0, thickness, HEIGHT);
    }
    return rectanglePolygon(WIDTH - thickness, 0, thickness, HEIGHT);
  });
}

function buildMosaicNaturalBoundaries(usedEdges, random) {
  const availableEdges = ["top", "right", "bottom", "left"].filter(
    (edge) => !usedEdges.includes(edge),
  );
  return availableEdges.map((edge) => {
    const jitter = () => randomInt(-10, 10, random);
    if (edge === "left") {
      return [
        { x: 0, y: 0 },
        { x: 0, y: HEIGHT },
        { x: 92 + jitter(), y: HEIGHT },
        { x: 66 + jitter(), y: 620 },
        { x: 118 + jitter(), y: 470 },
        { x: 72 + jitter(), y: 300 },
        { x: 132 + jitter(), y: 145 },
        { x: 104 + jitter(), y: 0 },
      ];
    }
    if (edge === "right") {
      return [
        { x: WIDTH, y: 0 },
        { x: WIDTH, y: HEIGHT },
        { x: 884 + jitter(), y: HEIGHT },
        { x: 906 + jitter(), y: 610 },
        { x: 858 + jitter(), y: 455 },
        { x: 914 + jitter(), y: 285 },
        { x: 870 + jitter(), y: 120 },
        { x: 898 + jitter(), y: 0 },
      ];
    }
    if (edge === "bottom") {
      return [
        { x: 0, y: HEIGHT },
        { x: WIDTH, y: HEIGHT },
        { x: WIDTH, y: 682 + jitter() },
        { x: 835, y: 646 + jitter() },
        { x: 650, y: 696 + jitter() },
        { x: 470, y: 660 + jitter() },
        { x: 285, y: 704 + jitter() },
        { x: 120, y: 664 + jitter() },
        { x: 0, y: 688 + jitter() },
      ];
    }
    return [
      { x: 0, y: 0 },
      { x: WIDTH, y: 0 },
      { x: WIDTH, y: 86 + jitter() },
      { x: 800, y: 116 + jitter() },
      { x: 620, y: 72 + jitter() },
      { x: 430, y: 126 + jitter() },
      { x: 220, y: 78 + jitter() },
      { x: 0, y: 102 + jitter() },
    ];
  });
}

function buildAnonymousWaterGeometry({
  random,
  routePolygon,
  waterNaturalnessProfile,
  connectivityBlueprint,
  broadRiverControlFractions = null,
  internalHydrologyProfile = null,
  coarseHydrologyProfile = null,
}) {
  if (replacementGeometryInput?.waterProjection) {
    const projection = replacementGeometryInput.waterProjection;
    const { projectionSha256, ...payload } = projection;
    assert(crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex") === projectionSha256,
      "measured water projection bytes do not match identity");
    const throughChannel = projection.schemaVersion === "measured-joint-through-channel-projection-proposal-v1";
    assert((projection.schemaVersion === "measured-single-channel-game-projection-proposal-v2" || throughChannel) &&
      projection.outputBoundary.worldFactsQualified === false && projection.outputBoundary.trainingAllowed === false &&
      projection.candidateId === V7_SLOT_CONTEXT.assignment.candidateId &&
      projection.canvas.width === WIDTH && projection.canvas.height === HEIGHT &&
      connectivityBlueprint.hydrologyGraph.projectionSha256 === projectionSha256,
      "measured water projection does not bind this unpublished connectivity");
    const channel = projection.edges[0];
    const ports = connectivityBlueprint.anonymousTrainingCoordinateProjection.waterPlan.externalWaterPorts;
    assert(throughChannel ? (ports.length === 2 && ports[0].boundarySide === "west" && ports[0].flowRole === "upstream_inlet" &&
      ports[1].boundarySide === "north" && ports[1].flowRole === "downstream_outlet" &&
      projection.regionId === connectivityBlueprint.currentRegion.regionId &&
      projection.outputBoundary.countsAsAdditionalSample === false) : ports.length === 1,
    "measured water projection ports do not match its source topology");
    return { centerline: structuredClone(channel.centerline), waterHalfWidths: structuredClone(channel.halfWidths),
      branchCenterlines: [], branchHalfWidths: [], waterPolygons: structuredClone(projection.waterPolygons),
      shorelinePolygons: structuredClone(projection.shorelinePolygons), naturalnessAudit: projection.audit.naturalness,
      corridorShapeAudit: projection.audit.corridor,
      internalHydrologyProfile: { family: throughChannel ? "measured_through_channel_projection_v1" : "measured_single_channel_projection_v1",
        internalNetworkConnectionMode: throughChannel ? "measured_external_inlet_to_external_outlet" : "internal_supported_channel_to_measured_outlet",
        sourceGraphIdentity: projection.sourceGraphIdentity },
      internalHydrologyAudit: { passed: true, scope: "verified_source_chain_contraction_only", sourceGraphIdentity: projection.sourceGraphIdentity },
      lateralContinuationAudit: null, coarseHydrologyProfile: null, mainChannelSelection: { projectionSha256 },
      usedEdges: ports.map(p => boundarySideToCanvasEdge(p.boundarySide)), connectivityPorts: { externalWaterPortIds: ports.map(p => p.edgePortId),
        upstreamPortId: throughChannel ? ports[0].edgePortId : null, downstreamPortId: ports.at(-1).edgePortId, boundarySides: ports.map(p => p.boundarySide),
        boundaryWaterDirectionInvented: false } };
  }
  const waterPlan =
    connectivityBlueprint.anonymousTrainingCoordinateProjection
      ?.waterPlan;
  const usedEdges = waterPlan?.externalWaterPorts?.map(
    (port) => port.boundarySide,
  ) ?? [];
  assert(
    waterPlan &&
      Array.isArray(waterPlan.externalWaterPorts) &&
      waterPlan.externalWaterPorts.length === 2 &&
      waterPlan.externalWaterPorts.some(
        (port) => port.boundarySide === "north" &&
          port.flowRole === "upstream_inlet",
      ) &&
      waterPlan.externalWaterPorts.some(
        (port) => port.boundarySide === "south" &&
          port.flowRole === "downstream_outlet",
      ) &&
      waterPlan.lateralBoundaryContinuationRequired === false &&
      waterPlan.boundaryWaterDirectionInvented === false,
    "current regional water plan is missing its contracted upstream inlet or downstream outlet",
  );
  assert(
    internalHydrologyProfile?.family ===
      MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY &&
      internalHydrologyProfile
        .connectivityPortsAreBoundaryConstraintsOnly === true &&
      internalHydrologyProfile
        .singleBroadCenterlineIsOnlyInternalHydrology === false,
    "measurement-derived anonymous internal hydrology profile is missing",
  );
  if (coarseHydrologyProfile) {
    assert(
      coarseHydrologyProfile.family ===
        COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY &&
        coarseHydrologyProfile.identityBoundary
          ?.connectivityPortsAreBoundaryConstraintsOnly === true &&
        coarseHydrologyProfile.identityBoundary
          ?.exactD8GeometryCarriedForward === false,
      "coarse hydrology main-channel profile crossed the anonymous geometry boundary",
    );
  }
  const rawWaterHalfWidths = coarseHydrologyProfile
    ? buildMeasurementDerivedNetworkHalfWidths({
        pointCount:
          COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
        startHalfWidth: waterPlan.startHalfWidth,
        endHalfWidth: waterPlan.endHalfWidth,
        coarseHydrologyProfile,
      })
    : buildNaturalWaterHalfWidths(
        NATURAL_WATER_CENTERLINE_POINT_COUNT,
        random,
        {
          startHalfWidth: waterPlan.startHalfWidth,
          endHalfWidth: waterPlan.endHalfWidth,
        },
      );
  const waterHalfWidths =
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "two_separated_interior_headwater_tributaries_to_main_channel"
      ? rawWaterHalfWidths.map((value) =>
          Math.max(12, Math.round(value * 0.58)),
        )
      : rawWaterHalfWidths;
  const naturalWater = coarseHydrologyProfile
    ? buildMeasurementDerivedAnonymousMainChannel({
        start: structuredClone(waterPlan.start),
        end: structuredClone(waterPlan.end),
        width: WIDTH,
        height: HEIGHT,
        coarseHydrologyProfile,
        waterNaturalnessProfile,
        corridorHalfWidths: waterHalfWidths,
      })
    : buildNaturalAnonymousWaterCenterline({
        start: structuredClone(waterPlan.start),
        end: structuredClone(waterPlan.end),
        random,
        width: WIDTH,
        height: HEIGHT,
        profile: waterNaturalnessProfile,
        interiorBias: {
          x:
            internalHydrologyProfile.branchSide === "west"
              ? -72
              : 72,
          y: 0,
        },
        broadRiverMode: true,
        broadRiverControlFractions,
        preferredSinuosity:
          waterNaturalnessProfile.anonymousGenerationEnvelope
            .minimumSinuosity + 0.08,
        corridorHalfWidths: waterHalfWidths,
      });
  const centerline = naturalWater.points;
  const primaryWaterPolygons = buildVariableWidthCorridorPolygons(
    centerline,
    waterHalfWidths,
    WIDTH,
    HEIGHT,
  );
  const internalHydrology =
    buildMeasurementDerivedInternalHydrology({
      centerline,
      waterHalfWidths,
      waterNaturalnessProfile,
      internalHydrologyProfile,
      coarseHydrologyProfile,
    });
  const waterPolygons = [
    ...primaryWaterPolygons,
    ...internalHydrology.waterPolygons,
  ];
  const corridorShapeAudit = auditAnonymousWaterCorridorShape(
    centerline,
    waterHalfWidths,
  );
  assert(
    corridorShapeAudit.passed,
    `anonymous water corridor shape is invalid: ${JSON.stringify(
      corridorShapeAudit,
    )}`,
  );
  if (routePolygon) {
    assert(
      !waterPolygons.some((polygon) =>
        polygonsOverlap(routePolygon, polygon),
      ),
      "anonymous water geometry conflicts with the route; a new slot seed is required",
    );
  }
  assert(
    pointsEqual(centerline[0], waterPlan.start) &&
      pointsEqual(centerline.at(-1), waterPlan.end),
    "anonymous water centerline does not bind the current internal water plan",
  );
  const shorelinePolygons = [
    ...buildVariableWidthCorridorPolygons(
      centerline,
      waterHalfWidths.map((value) => value + 14),
      WIDTH,
      HEIGHT,
    ),
    ...internalHydrology.shorelinePolygons,
  ];
  return {
    centerline,
    waterHalfWidths,
    branchCenterlines: internalHydrology.branchCenterlines,
    branchHalfWidths: internalHydrology.branchHalfWidths,
    waterPolygons,
    shorelinePolygons,
    naturalnessAudit: naturalWater.audit,
    corridorShapeAudit,
    internalHydrologyProfile,
    internalHydrologyAudit: internalHydrology.audit,
    lateralContinuationAudit: null,
    coarseHydrologyProfile,
    mainChannelSelection: naturalWater.selection ?? null,
    usedEdges,
    connectivityPorts: {
      externalWaterPortIds: waterPlan.externalWaterPorts.map(
        (port) => port.edgePortId,
      ),
      upstreamPortId: waterPlan.externalWaterPorts.find(
        (port) => port.flowRole === "upstream_inlet",
      )?.edgePortId ?? null,
      downstreamPortId: waterPlan.externalWaterPorts.find(
        (port) => port.flowRole === "downstream_outlet",
      )?.edgePortId ?? null,
      boundarySides: usedEdges,
      boundaryWaterDirectionInvented: false,
    },
  };
}

function landscapeRequiresVisibleWater(type) {
  return /riparian|river|floodplain|swamp|marsh|pond|creek|stream|drainage|riverbank/.test(
    type,
  );
}

function landscapeTypeToEcosystem(type) {
  const mapping = {
    "seasonal-evergreen-semi-evergreen-forest":
      "seasonal_evergreen_or_semi_evergreen_forest",
    "lowland-evergreen-tropical-forest":
      "lowland_tropical_evergreen_forest",
    "moist-deciduous-teak-forest": "moist_deciduous_forest",
    "dry-dipterocarp-woodland":
      "dry_dipterocarp_forest_or_woodland",
    "bamboo-grove": "bamboo_grove",
    "riparian-tropical-forest": "riparian_forest",
    "monsoon-grassland": "monsoon_grassland",
    "river-floodplain": "river_floodplain",
    "freshwater-swamp": "freshwater_swamp",
    "reed-marsh": "reed_marsh",
    "limestone-foothill": "limestone_foothill",
    "forested-low-mountain": "forested_low_mountain",
  };
  return mapping[type] ?? type.replaceAll("-", "_");
}

function applyV7SlotBlueprintContext(blueprint, slotContext) {
  if (!slotContext) return;
  const assignment = slotContext.assignment;
  blueprint.status = "v7_slot_complete_map_world_facts_ready_rgb_missing";
  blueprint.split = assignment.split;
  blueprint.sourceMode =
    "bounded_real_measurement_window_plus_independent_region_source_and_connectivity";
  blueprint.landscapeType = assignment.regionalLandscapeType;
  blueprint.environmentContext = {
    contractVersion: "world-visual-environment-context-v1",
    ...structuredClone(slotContext.snapshot.environment),
    habitatMoistureClass: slotContext.snapshot.environment.groundMoisture,
    sourceSnapshotId: slotContext.snapshot.snapshotId,
    sourceSnapshotPath: slotContext.snapshotPath,
    sourceRecordClassificationUsed: true,
  };
  blueprint.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: assignment.split,
    coverageRole: assignment.coverageRole,
    measurementWindowPlanRunId: slotContext.planRunId,
    measurementWindowPlanPath: slotContext.planPath,
    candidateId: assignment.candidateId,
    directFingerprint: assignment.fingerprints.direct,
    anonymousCompositionArchitectureRevision:
      V7_SLOT_COMPOSITION_REVISION ?? null,
    exactRealWorldGeometryCarriedForward: false,
    sourcePixelWindowCarriedIntoGameGeometry: false,
  };
  blueprint.semanticRules.waterPolicy = blueprint.geometry.hasWater
    ? "visible_water_required_by_current_landscape_world_facts"
    : "no_major_visible_water_required_by_current_landscape_world_facts";
}

function applyV7SlotDirectorContext(director, slotContext, geometry) {
  if (!slotContext) return;
  const assignment = slotContext.assignment;
  const environment = slotContext.snapshot.environment;
  const requiredStructure = [
    "entrance",
    "main_path",
    "natural_boundary",
    "multiple_ecological_zones",
    ...(geometry.hasWater ? ["defined_world_fact_water_system"] : []),
  ];
  director.sceneIntent.mainStory =
    `A complete de-identified ${assignment.regionalLandscapeType} natural region for the ${assignment.monsoonSeason} season, derived from aggregate measurements, the approved regional ecology profile, and new anonymous game coordinates.`;
  director.sceneIntent.mustShow = requiredStructure;
  director.compositionPlan.readOrder = requiredStructure;
  director.compositionPlan.layoutIntent =
    `${geometry.routeTopology}_with_multiple_ecological_zones_without_preset_site`;
  director.terrainPlan.terrainKinds = [
    ...new Set(geometry.terrainRegions.map((entry) => entry.kind)),
  ];
  director.terrainPlan.terrainTransitions = [
    "grass_to_path",
    "object_to_ground",
    ...(geometry.hasWater
      ? ["grass_to_water", "shoreline_to_water"]
      : []),
  ];
  director.terrainPlan.waterEdgeRules = geometry.hasWater
    ? ["continuous_natural_shoreline", "world_fact_water_readability"]
    : [];
  director.materialRecipePlan.requiredMaterials = [
    "seasonal_tropical_ground",
    "dirt_path",
    "stone",
    "vegetation_detail",
    ...(geometry.hasWater ? ["freshwater", "shoreline_soil"] : []),
  ];
  director.singleMapEcologyPlan = {
    landscapeType: assignment.regionalLandscapeType,
    moisture: environment.groundMoisture,
    vegetationDensity: "regional_profile_with_readable_passage",
    snapshotId: slotContext.snapshot.snapshotId,
    season: assignment.monsoonSeason,
    environmentState: environment.environmentState ?? environment.monsoonPhase,
    groundMoisture: environment.groundMoisture,
    requiredFeatures: geometry.ecologicalZones.map((entry) => entry.zoneId),
    optionalFeatures: [],
  };
  director.singleMapMaterialPlan = {
    palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
    season: assignment.monsoonSeason,
    environmentState: environment.environmentState ?? environment.monsoonPhase,
    weather: environment.weather,
    lighting: environment.lighting,
    groundMoisture: environment.groundMoisture,
  };
  director.compositionRecipePlan.readOrder = requiredStructure;
  director.singleMapCompositionPlan.routeIntent = geometry.routeTopology;
  director.generationTaskDraft.requiredParts = requiredStructure;
  director.fixPlanInput.source =
    "bounded_real_measurement_window_regional_profile_and_season_snapshot";
  director.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: assignment.split,
    measurementWindowPlanRunId: slotContext.planRunId,
    candidateId: assignment.candidateId,
  };
}

function applyV7SlotVisualFactContext(visualFacts, slotContext) {
  if (!slotContext) return;
  visualFacts.status = "v7_slot_complete_map_visual_facts_passed";
  visualFacts.worldSignals.biomeType =
    slotContext.assignment.regionalLandscapeType;
  visualFacts.worldSignals.moistureLevel =
    slotContext.snapshot.environment.groundMoisture;
  visualFacts.worldSignals.vegetationDensity =
    "regional_profile_with_readable_passage";
  visualFacts.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: slotContext.assignment.split,
    candidateId: slotContext.assignment.candidateId,
  };
}

function applyV7SlotTaskContext(task, slotContext) {
  if (!slotContext) return;
  const assignment = slotContext.assignment;
  task.status = "v7_slot_complete_map_task_ready_rgb_authorization_required";
  task.sourceBindings.sourceMode =
    "bounded_real_measurement_window_plus_independent_region_source_and_connectivity";
  task.sourceBindings.measurementWindowPlanPath = slotContext.planPath;
  task.sourceBindings.measurementWindowPlanSha256 = slotContext.planSha256;
  task.sourceBindings.seasonSnapshotPath = slotContext.snapshotPath;
  task.sourceBindings.seasonSnapshotSha256 = sha256File(
    path.join(ROOT, slotContext.snapshotPath),
  );
  task.sourceBindings.regionalProfilePath = WORLD_PROFILE_PATH;
  task.sourceBindings.regionalProfileSha256 = sha256File(
    path.join(ROOT, WORLD_PROFILE_PATH),
  );
  task.sourceBindings.factualReferenceSha256 = sha256File(
    path.join(ROOT, FACTUAL_REFERENCE_PATH),
  );
  task.drawingProcess.spatialBlockoutSource =
    "new_anonymous_game_coordinate_geometry_from_bounded_measurement_aggregates";
  task.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: assignment.split,
    regionalLandscapeType: assignment.regionalLandscapeType,
    monsoonSeason: assignment.monsoonSeason,
    candidateId: assignment.candidateId,
    measurementFingerprint: assignment.fingerprints.direct,
  };
}

function buildBlueprint({
  conditionId,
  worldId,
  taskId,
  seedHex,
  worldFacts,
  worldFactRun,
  geometry,
  connectivityBlueprint,
  connectivityBlueprintPath,
  realEarthRegionSourcePackage,
  realEarthRegionSourcePackagePath,
  structuralIdentities,
}) {
  return {
    schemaVersion: "ai-assisted-training-world-fact-blueprint-v2",
    blueprintId: `training-world-facts-${conditionId}`,
    status: "naturalized_complete_map_world_facts_ready_rgb_missing",
    createdAtUtc,
    createdAtAsiaShanghai,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    generationContractVersion: "complete-map-scope-world-facts-v2",
    conditionLabel: conditionId,
    split: "unassigned_pre_rgb",
    uniqueWorldSeed: seedHex,
    uniqueLayoutVariant: "new_game_coordinate_geometry_from_aggregate_facts",
    sourceBlueprintReuse: false,
    sourceTransformReuse: false,
    sourceRgbRead: false,
    sourceImageGeometryRead: false,
    completeMapScopeRequired: true,
    worldFrameContract: geometry.worldFrameContract,
    sourceMode:
      "bounded_real_measurement_window_plus_independent_region_source_and_connectivity",
    taskId,
    worldId,
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    earthParameterSnapshotId: worldFacts.worldFactSetId,
    earthParameterSnapshotPath: worldFactRun.worldFactsPath,
    factualReferenceId: "sakaerat-wang-nam-khiao-mvp-reference-v1",
    factualReferencePath: FACTUAL_REFERENCE_PATH,
    connectivityContractId: "natural-home-large-world-connectivity-v1",
    connectivityBlueprintId: connectivityBlueprint.blueprintId,
    connectivityBlueprintPath,
    regionId: connectivityBlueprint.currentRegion.regionId,
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath,
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    structuralIdentities,
    landscapeType:
      "mainland-southeast-asia-naturalized-lowland-valley-low-hill-mosaic",
    landscapeProfile: {
      referenceRole: worldFacts.identityBoundary.role,
      measuredReliefClass:
        worldFacts.measuredNaturalFacts.relief.derivedClass,
      measuredNaturalSystems: worldFacts.ecologyFacts.supportedNaturalSystems,
      copiedRealMapGeometry: false,
      copiedOsmGeometry: false,
    },
    environmentContext: {
      contractVersion: "world-visual-environment-context-v1",
      season: "wet_season",
      monsoonPhase: "active_monsoon",
      environmentState: "humid_post_rain_daylight",
      weather: "post_rain_clearing",
      lighting: "warm_humid_soft_daylight",
      groundMoisture: "moist",
      visibility: "clear_humid_air",
      wind: "light",
      standingWaterOutsideDefinedWaterBodies: false,
      habitatMoistureClass: "high",
      sourceSnapshotId: worldFacts.worldFactSetId,
      sourceRecordClassificationUsed: true,
    },
    canvas: {
      width: WIDTH,
      height: HEIGHT,
      frameScope: "complete_runtime_frame",
    },
    geometry,
    semanticRules: {
      waterFlow: geometry.hasWater
        ? "current_world_fact_internal_hydrology_without_invented_boundary_direction"
        : "no_major_visible_water_required_by_current_world_facts",
      routeIntent:
        `${connectivityBlueprint.anonymousTrainingCoordinateProjection.pathPlan.boundarySide}_boundary_natural_passage_without_preset_home_site_or_convergence_platform`,
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
      focalAreaPolicy: "inactive_all_zero_compatibility_channel",
      camera: "top_down_slight_three_quarter_2d",
      style: "native_1024x768_high_resolution_pixel_game_map",
      geometryOrigin:
        "new_deidentified_game_coordinates_from_current_region_source_package_and_independent_connectivity_instance",
      forbidden: [
        "building",
        "character",
        "animal",
        "bridge",
        "text",
        "ui",
        "program_drawn_final_art",
        "preset_home_site",
        "activity_center",
        "construction_clearing",
        "route_convergence_platform",
        "mirrored_historical_layout",
        "rotated_historical_layout",
        "copied_real_map_geometry",
        "copied_osm_geometry",
        "region_0001_concrete_connectivity_instance_reuse",
        "cross_region_source_fact_reuse",
        "theme_architecture_reuse",
        "instance_detail_reuse",
        "external_background",
        "solid_color_matte",
        "floating_map_or_island_cutout",
        "decorative_polygon_map_edge",
        "route_boundary_side_mismatch",
        "baked_non_world_pixels",
      ],
    },
    outputContract: {
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    automaticStorage: true,
  };
}

function buildDirector({
  conditionId,
  worldId,
  taskId,
  directorRunId,
  sourceFactIds,
  worldFacts,
  geometry,
}) {
  const ecologicalZoneIds = geometry.ecologicalZones.map(
    (entry) => entry.zoneId,
  );
  return {
    schemaVersion: "world-visual-director-output-v1",
    directorRunId,
    createdAt: createdAtUtc,
    createdAtAsiaShanghai,
    dictionaryVersionId: "mvp-natural-home-v0.3",
    worldId,
    generationContractVersion: "complete-map-scope-world-facts-v2",
    conditionLabel: conditionId,
    tick: 0,
    sourceFactIds,
    singleMapScopePlan: {
      activeGoal: "single_complete_map_visual",
      outputSize: { width: WIDTH, height: HEIGHT },
      localCropAllowed: false,
    },
    sceneIntent: {
      sceneIntentId: `natural-region-${conditionId}`,
      sceneType: "training_complete_natural_region_map",
      mainStory:
        "A complete de-identified mainland Southeast Asia tropical monsoon natural region derived from measured relief, ecology, soil, hydrology, and locked large-world connectivity before RGB creation.",
      primaryFocus: "complete_natural_region",
      mustShow: [
        "entrance",
        "main_path",
        "natural_boundary",
        "multiple_ecological_zones",
        "north_to_south_watercourse",
      ],
      mayShow: ["tree", "rock", "shrub", "grass_detail", "riparian_detail"],
      mustNotShow: [
        "player",
        "butler",
        "building",
        "animal",
        "debug_preview",
        "material_test_board",
        "preset_home_site",
        "activity_center",
        "construction_clearing",
        "route_convergence_platform",
      ],
    },
    compositionPlan: {
      readOrder: [
        "entrance",
        "main_path",
        "natural_boundary",
        "ecological_zones",
        "north_to_south_watercourse",
      ],
      focalHierarchy: [
        "complete_natural_region",
        "large_world_connections",
        "ecological_zones",
        "detail_clusters",
      ],
      layoutIntent:
        "complete_region_with_south_path_connection_north_to_south_water_and_west_natural_boundary_without_preset_site",
      clutterBudget: "controlled_with_irregular_quiet_natural_areas",
      cameraFit: "top_down_complete_map_readability",
    },
    terrainPlan: {
      baseTerrain: "grass",
      terrainKinds: [
        "grass",
        "water",
        "shoreline",
        "path_ground",
        "natural_boundary",
        "mud_patch",
        "tall_grass",
      ],
      terrainTransitions: [
        "grass_to_path",
        "grass_to_water",
        "shoreline_to_water",
        "object_to_ground",
      ],
      pathWearRules: [
        "soft_embedded_edge",
        "continuous_natural_passage",
        "no_center_platform",
      ],
      waterEdgeRules: [
        "continuous_natural_shoreline",
        "north_to_south_flow_readability",
      ],
      forbiddenTerrainArtifacts: [
        "random_noise_field",
        "gray_green_camouflage",
        "pasted_path_band",
        "hard_cut_shoreline",
        "square_center_clearing",
      ],
    },
    assetPlan: {
      allowedKinds: ["tree", "rock", "shrub", "grass_detail"],
      objectCount: geometry.objectFootprints.length,
    },
    motionPlan: {
      currentScope: "static_visual_milestone",
      futureRuntimeMotionReserved: true,
      dynamicReadinessSource:
        "worldfacts_23_channels_walkable_collision_and_object_footprints",
      bakedBackdropForbidden: true,
      everyPixelMustRemainWorldAddressable: true,
    },
    drawingProcessPlan: {
      structureBeforePixels: true,
      sourceImageGeometryRead: false,
      realMapGeometryRead: false,
      programDrawnFinalArtForbidden: true,
    },
    artDirectionPlan: {
      targetEntryId: "art-direction/professional-game-art-direction",
      playerFacingStandard: "formal_game_map_not_training_preview",
      forbiddenLooks: [
        "noise",
        "collage",
        "sticker",
        "wallpaper",
        "debug_preview",
        "external_background",
        "solid_color_matte",
        "floating_map_or_island_cutout",
        "decorative_polygon_map_edge",
        "route_boundary_side_mismatch",
      ],
      styleUnityTargets: [
        "camera",
        "palette",
        "scale",
        "lighting",
        "material_language",
      ],
    },
    materialRecipePlan: {
      requiredMaterials: [
        "humid_grass",
        "dirt_path",
        "freshwater",
        "shoreline_soil",
        "stone",
        "vegetation_detail",
      ],
    },
    singleMapEcologyPlan: {
      landscapeType:
        "mainland-southeast-asia-tropical-monsoon-lowland-valley-low-hill",
      moisture: "high",
      vegetationDensity: "high_with_readable_passage",
      snapshotId: worldFacts.worldFactSetId,
      season: "wet_season",
      environmentState: "humid_post_rain_daylight",
      groundMoisture: "moist",
      requiredFeatures: ecologicalZoneIds,
      optionalFeatures: [],
    },
    singleMapMaterialPlan: {
      palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
      season: "wet_season",
      environmentState: "humid_post_rain_daylight",
      weather: "post_rain_clearing",
      lighting: "warm_humid_soft_daylight",
      groundMoisture: "moist",
    },
    compositionRecipePlan: {
      readOrder: [
        "entrance",
        "main_path",
        "natural_boundary",
        "ecological_zones",
        "north_to_south_watercourse",
      ],
      focalHierarchy: [
        "complete_natural_region",
        "large_world_connections",
        "ecological_zones",
        "detail_clusters",
      ],
      layoutIntent:
        "new_game_coordinate_complete_region_from_current_world_facts",
      clutterBudget: "controlled_with_irregular_quiet_natural_areas",
      cameraFit: "top_down_complete_map_readability",
    },
    singleMapCompositionPlan: {
      entranceBounds: geometry.entranceBounds,
      routeIntent:
        "south_boundary_natural_passage_without_preset_home_site",
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
    },
    renderLayerRecipePlan: {
      orderedLayerRefs: [
        "base_terrain",
        "shoreline",
        "water",
        "path",
        "boundary",
        "footprints",
        "objects",
        "shadows",
        "detail",
        "polish",
      ],
      preserveRules: [
        "route_readability",
        "ecological_zone_readability",
        "object_contact",
        "terrain_transition",
      ],
      forbiddenLayerOutputs: [
        "debug",
        "fallback",
        "placeholder",
        "program_only_final_art",
      ],
    },
    qualityRubricPlan: {
      required: [
        "game_read",
        "map_grammar",
        "style_unity",
        "grounding",
        "polish",
      ],
      ownerReviewRequired: true,
    },
    singleMapAcceptancePlan: {
      passDefinition:
        "one_complete_professional_natural_region_map_visual",
      ownerReviewRequired: true,
    },
    fixPlanInput: {
      previousFailures: [],
      source: "naturalized_earth_reference_world_facts",
    },
    generationTaskDraft: {
      schemaVersion: "runtime-frame-generation-task-v1",
      taskId,
      outputSize: { width: WIDTH, height: HEIGHT },
      requiredParts: [
        "entrance",
        "main_path",
        "natural_boundary",
        "ecological_zones",
        "watercourse",
      ],
    },
    safety: {
      changesRuntimeWorldFacts: false,
      existingRgbBindingForbidden: true,
      formalCandidate: false,
    },
    autonomyContract: {
      siteSelectionPolicy: "runtime_butler_autonomy_only",
      presetHomeSite: false,
      presetActivityCenter: false,
      constructionClearing: false,
      focalAreaActive: false,
    },
    factualReference: {
      referenceId: "sakaerat-wang-nam-khiao-mvp-reference-v1",
      path: FACTUAL_REFERENCE_PATH,
      copiedRealMapGeometry: false,
      copiedOsmGeometry: false,
      externalImageUsed: false,
    },
  };
}

function buildVisualFactManifest({
  conditionId,
  worldId,
  taskId,
  sourceFactIds,
  worldFacts,
  geometry,
}) {
  return {
    schemaVersion: "world-visual-fact-manifest-v1",
    manifestId: `visual-facts-${taskId}`,
    worldId,
    tick: 0,
    dictionaryVersionId: "mvp-natural-home-v0.3",
    createdAt: createdAtUtc,
    createdAtAsiaShanghai,
    passed: true,
    status: "naturalized_complete_map_visual_facts_passed",
    includedFactIds: sourceFactIds,
    excludedFactIds: [],
    visualFacts: [
      {
        factId: `${conditionId}:entrance`,
        semanticType: "entrance",
        sourceType: "naturalized_world_fact_normalization",
        bounds: geometry.entranceBounds,
      },
      {
        factId: `${conditionId}:natural-boundary`,
        semanticType: "natural_boundary",
        sourceType: "current_region_independent_connectivity_instance",
        bounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      },
      ...geometry.terrainRegions.map((entry) => ({
        factId: `${conditionId}:terrain:${entry.sourceId}`,
        semanticType: `terrain_${entry.kind}`,
        sourceType: "naturalized_world_fact_normalization",
        polygon: entry.polygon,
      })),
    ],
    forbiddenLeakIds: [],
    counts: {
      includedFacts: sourceFactIds.length,
      excludedFacts: 0,
    },
    worldSignals: {
      biomeType:
        "mainland-southeast-asia-tropical-monsoon-natural-mosaic",
      moistureLevel: "high",
      vegetationDensity: "high_with_readable_passage",
      measuredReliefClass:
        worldFacts.measuredNaturalFacts.relief.derivedClass,
      missingSignals: [],
    },
  };
}

function buildTask({
  conditionId,
  worldId,
  taskId,
  director,
  geometry,
  visualFacts,
  blueprintPath,
  directorPath,
  visualFactPath,
  worldFacts,
  worldFactRun,
  connectivityBlueprintPath,
  realEarthRegionSourcePackage,
  realEarthRegionSourcePackagePath,
}) {
  const task = {
    schemaVersion: "runtime-frame-generation-task-v1",
    taskId,
    status: "naturalized_complete_map_task_ready_rgb_authorization_required",
    generationContractVersion: "complete-map-scope-world-facts-v2",
    dictionaryVersionId: "mvp-natural-home-v0.3",
    worldId,
    ownerId: "project-owner",
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    earthParameterSnapshotId: worldFacts.worldFactSetId,
    outputSize: {
      width: WIDTH,
      height: HEIGHT,
      aspect: "4:3",
      frameScope: "complete_runtime_frame",
    },
    sourceBindings: {
      sourceMode:
        "bounded_real_measurement_window_plus_independent_region_source_and_connectivity",
      trainingBlueprintPath: projectPath(blueprintPath),
      promptEvidencePath: null,
      naturalizedWorldFactsPath: worldFactRun.worldFactsPath,
      naturalizedWorldFactsSha256: sha256File(
        path.join(ROOT, worldFactRun.worldFactsPath),
      ),
      visualFactManifestId: visualFacts.manifestId,
      visualFactManifestPath: projectPath(visualFactPath),
      visualFactManifestSha256: visualFacts.manifestSha256,
      dictionaryPath: DICTIONARY_PATH,
      worldProfilePath: WORLD_PROFILE_PATH,
      earthParameterSnapshotPath: worldFactRun.worldFactsPath,
      connectivityBlueprintPath,
      realEarthRegionId:
        realEarthRegionSourcePackage.identity.realEarthRegionId,
      realEarthRegionSourcePackageId:
        realEarthRegionSourcePackage.packageId,
      realEarthRegionSourcePackagePath,
      realEarthRegionSourcePackageSha256:
        realEarthRegionSourcePackage.packageSha256,
      datasetPackagePath: null,
      datasetPackageId: null,
      runtimeFramePath: null,
      runtimeFrameId: null,
      structureId: `training-structure-${conditionId}`,
      factualReferencePath: FACTUAL_REFERENCE_PATH,
      directorOutputPath: projectPath(directorPath),
    },
    singleMapScope: {
      activeGoal: "single_complete_map_visual",
      forbiddenCurrentRequirements: ["player", "building", "animal"],
      allowedCurrentRequirements: [
        "map_structure",
        "terrain",
        "material",
        "ecology",
        "composition",
        "storage",
      ],
    },
    drawingProcess: {
      intentLock: true,
      spatialBlockoutSource:
        "new_game_coordinate_geometry_from_naturalized_world_facts",
      textureBeforeBlockoutForbidden: true,
      sourceImageGeometryRead: false,
      realMapGeometryRead: false,
      reviewPass: { machineReview: true, ownerReview: true },
    },
    inferenceGate: {
      status: "rgb_generation_not_authorized",
      canRunCompleteVisualInference: false,
      reasons: [
        "owner_rgb_authorization_missing",
        "rgb_missing",
        "machine_review_missing",
        "owner_review_missing",
      ],
      authorizationId: OWNER_AUTHORIZATION_REF,
      ownerApprovalAutomatic: false,
      gpuTrainingAuthorized: false,
    },
    bootstrapInferenceGate: {
      status: "historical_third_party_bootstrap_disabled",
      canRunBootstrapInference: false,
      canEnterWorld: false,
      canCountAsPositiveSample: false,
      independentTrainingEligible: false,
      requiresMachineReview: true,
      requiresOwnerReview: true,
    },
    visualStyle: {
      camera: "top_down_slight_three_quarter_2d",
      palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
      lighting: "single_soft_daylight_direction",
      materialDensity: "controlled_multi_scale_detail",
      grounding: "footprint_contact_shadow_and_transition_required",
      frameCoverage:
        "continuous_in_world_surface_fills_the_1024x768_rectangle_edge_to_edge",
      externalBackdrop: "forbidden",
    },
    worldFrameContract: geometry.worldFrameContract,
    dynamicReadiness: {
      currentOutput: "static_rgb_world_baseline",
      futureRuntimeMotionReserved: true,
      semanticSource:
        "worldfacts_23_channels_walkable_collision_and_object_footprints",
      everyPixelWorldAddressable: true,
      backgroundVoidAllowed: false,
    },
    forbiddenContent: [
      "player",
      "butler",
      "building",
      "construction",
      "npc",
      "animal",
      "debug_overlay",
      "local_material_test_board",
      "preset_home_site",
      "activity_center",
      "route_convergence_platform",
      "external_background",
      "solid_color_matte",
      "floating_map_or_island_cutout",
      "decorative_polygon_map_edge",
      "route_boundary_side_mismatch",
    ],
    spatialLayers: {
      terrainRegions: geometry.terrainRegions,
      walkableRegions: geometry.walkableRegions,
      collisionRegions: geometry.collisionRegions,
      objectFootprints: geometry.objectFootprints,
    },
    directorPlan: director,
    previousFailures: [],
  };
  return task;
}

function buildSourceFactIds(conditionId, geometry) {
  return [
    `${conditionId}:entrance`,
    `${conditionId}:natural-boundary`,
    ...geometry.terrainRegions.map(
      (entry) => `${conditionId}:terrain:${entry.sourceId}`,
    ),
  ];
}

function terrain(sourceId, kind, polygon) {
  return { sourceId, kind, polygon };
}

function irregularEllipsePolygon(
  centerX,
  centerY,
  radiusX,
  radiusY,
  steps,
  random,
) {
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const irregularity = 0.86 + random() * 0.25;
    points.push({
      x: clamp(
        Math.round(centerX + Math.cos(angle) * radiusX * irregularity),
        0,
        WIDTH,
      ),
      y: clamp(
        Math.round(centerY + Math.sin(angle) * radiusY * irregularity),
        0,
        HEIGHT,
      ),
    });
  }
  return points;
}



function updateRegionContract(manifest) {
  const contract = readJson(REGION_CONTRACT_PATH);
  contract.status =
    "complete_map_conditions_ready_rgb_authorization_required";
  contract.updatedAtUtc = createdAtUtc;
  contract.updatedAtAsiaShanghai = createdAtAsiaShanghai;
  contract.blockers = [];
  contract.measurementEvidence = {
    ...(contract.measurementEvidence ?? {}),
    completeMapConditionRunId: manifest.runId,
    completeMapConditionLatestPath: `${RUNTIME_ROOT}/latest.json`,
    worldDirectorOutputCreated: true,
    completeMap23ChannelsCreated: true,
    completeMapScopePassed: true,
    focalAreaNonZeroCount: manifest.focalAreaNonZeroCount,
    exactRealWorldGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
  };
  contract.outputBoundary = {
    ...(contract.outputBoundary ?? {}),
    completeMap23ChannelsCreated: true,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    formalCandidateEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  };
  writeJsonAtomic(REGION_CONTRACT_PATH, contract);
}

function indexRunFiles(directory, sourceRunId) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      indexRunFiles(absolutePath, sourceRunId);
    } else if (entry.isFile()) {
      indexFile(absolutePath, sourceRunId);
    }
  }
}

function indexFile(filePath, sourceRunId) {
  const stats = fs.statSync(filePath);
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: sourceRunId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(filePath),
  });
}

function canonicalSha256(value) {
  return sha256(Buffer.from(JSON.stringify(value)));
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function valueFor(flag) {
  const inline = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function loadV7SlotContext(slotId) {
  const slotNumber = Number(
    /^v7-capacity-slot-(\d{3})$/.exec(slotId)?.[1],
  );
  assert(
    Number.isInteger(slotNumber) &&
      slotNumber >= 146 &&
      slotNumber <= 209,
    `V7 slot is outside the authorized 146-209 rebuild range: ${slotId}`,
  );
  const config = readJson(
    path.join(
      ROOT,
      "ml",
      "ai-painter",
      "config",
      "complete-world-ai-assisted-cold-start-v7.json",
    ),
  );
  const authorization =
    config.training?.dataCapacityDecision?.boundedDataBuildAuthorization;
  assert(
    authorization?.authorizationId ===
      "owner-authorized-isolate-legacy40-and-rebuild-thailand-mvp64-20260729",
    "V7 bounded data-build authorization identity mismatch",
  );
  assert(
    authorization.status === "authorized_data_preparation_only" &&
      authorization.conditionPackagePreparationAuthorized === true &&
      authorization.imageGenerationAuthorized === false &&
      authorization.gpuTrainingAuthorized === false &&
      authorization.runtimeFrameAuthorized === false &&
      authorization.worldEntryAuthorized === false,
    "V7 bounded authorization does not permit this no-RGB condition build",
  );

  const latest = readJson(
    path.join(
      ROOT,
      ".runtime",
      "ai-painter",
      "earth-geospatial-v7-mvp-window-plans",
      "latest.json",
    ),
  );
  const plan = readJson(path.join(ROOT, latest.runPath));
  const rawAssignment = (plan.assignments ?? []).find(
    (entry) => entry.slotId === slotId,
  );
  const sequenceRegistry = readJson(path.join(
    ROOT,
    "data",
    "ai-painter",
    "system-governance",
    "thailand-rebuild64-sequence-registry-v1.json",
  ));
  const sequenceEntry = sequenceRegistry.entries?.find(
    (entry) => entry.legacyCapacitySlotId === slotId,
  );
  const assignment = rawAssignment
    ? {
        ...normalizeV7WindowAssignment(rawAssignment),
        requiredEntranceDirection: sequenceEntry?.entranceDirection,
      }
    : null;
  assert(assignment, `V7 slot assignment is missing: ${slotId}`);
  assert(
    ["north", "east", "south", "west"].includes(
      assignment.requiredEntranceDirection,
    ),
    `V7 slot registered entrance direction is missing: ${slotId}`,
  );
  assert(
    assignment.regionalLandscapeTypeStatus ===
      "derived_from_current_window_world_facts_and_ecology" &&
      typeof assignment.regionalLandscapeType === "string",
    `V7 slot world-fact ecology derivation is incomplete: ${slotId}`,
  );
  assert(
    assignment.imageGenerationAuthorized === false &&
      assignment.gpuTrainingAuthorized === false,
    "V7 slot assignment crossed the RGB or GPU gate",
  );

  const snapshotPaths = {
    wet_season:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-v2.json",
    wet_to_dry_transition:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-wet-to-dry-transition-v1.json",
    dry_season:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-late-dry-season-v1.json",
    dry_to_wet_transition:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-dry-to-wet-transition-v1.json",
  };
  const snapshotPath = snapshotPaths[assignment.monsoonSeason];
  assert(snapshotPath, `season snapshot is missing: ${assignment.monsoonSeason}`);
  const snapshot = readJson(path.join(ROOT, snapshotPath));
  assert(
    snapshot.environment?.season === assignment.monsoonSeason,
    "season snapshot identity mismatch",
  );

  const worldProfile = readJson(
    path.join(
      ROOT,
      "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json",
    ),
  );
  const factualReference = readJson(
    path.join(
      ROOT,
      "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json",
    ),
  );
  assert(
    worldProfile.worldProfileId ===
      "mainland-southeast-asia-tropical-monsoon-natural-home-v1" &&
      factualReference.parentWorldProfileId === worldProfile.worldProfileId,
    "regional profile or factual-reference identity mismatch",
  );
  assert(
    worldProfile.ecosystemFramework?.included?.length > 0 &&
      factualReference.mvpVisualBoundary?.completeMapRequirement,
    "regional ecology evidence is incomplete",
  );

  return {
    authorizationId: authorization.authorizationId,
    runtimeRoot:
      ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs",
    planRunId: plan.runId,
    planPath: latest.runPath,
    planSha256: sha256File(path.join(ROOT, latest.runPath)),
    assignment,
    snapshotPath,
    snapshot,
    worldProfile,
    factualReference,
  };
}

function normalizeV7WindowAssignment(assignment) {
  return {
    ...assignment,
    candidateId:
      assignment.candidateId ?? assignment.measurementWindowId,
    metrics:
      assignment.metrics ?? assignment.measurementMetrics,
    fingerprints:
      assignment.fingerprints ?? assignment.measurementFingerprints,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
}

const corridorAssert = (ok, message) => { if (!ok) throw new Error(message); };

// Legacy layout controls can still explain terrain/object/path placement, but
// must not describe a substituted measured water surface as an eight-band one.
export function describeMeasuredWaterDerivation({ base, projection }) {
  if (!projection) return base;
  const { projectionSha256, ...payload } = projection;
  corridorAssert(crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex") === projectionSha256,
    "measured water derivation projection identity mismatch");
  corridorAssert(["measured-single-channel-game-projection-proposal-v2", "measured-joint-upstream-water-projection-proposal-v1",
    "measured-joint-through-channel-projection-proposal-v1"].includes(projection.schemaVersion),
    "unsupported measured water derivation schema");
  const oldKeys = ["methodId", "macroTopologySource", "waterControlProfileSelectionByte", "waterControlProfileIndex",
    "internalHydrologyFamily", "internalHydrologyProfileSha256", "coarseHydrologyMainChannelFamily",
    "coarseHydrologyMainChannelProfileSha256", "coarseHydrologyMainChannelSource", "internalHydrologySelectionByte", "floodplainBasinSelectionByte"];
  const result = { ...base };
  for (const key of oldKeys) delete result[key];
  return { ...result, methodId: "bound_measured_water_with_existing_non_water_layout_v1",
    macroTopologySource: "measured_supported_channel_and_bound_anonymous_projection",
    baseLayoutProvenance: { role: "retained_layout_selection_context_not_active_water_surface",
      ...Object.fromEntries(oldKeys.filter(k => Object.hasOwn(base, k)).map(k => [k, structuredClone(base[k])])) },
    activeWaterGeometry: { schemaVersion: projection.schemaVersion, projectionSha256,
      sourceGraphIdentity: projection.sourceGraphIdentity, sourcePairingIdentity: projection.sourcePairingIdentity,
      jointProjectionSha256: projection.jointProjectionSha256 ?? null,
      waterPolygonsSha256: crypto.createHash("sha256").update(JSON.stringify(projection.waterPolygons)).digest("hex"),
      shorelinePolygonsSha256: crypto.createHash("sha256").update(JSON.stringify(projection.shorelinePolygons)).digest("hex"),
      exactSourceGeometryCopied: false, worldFactsQualified: false, trainingAllowed: false } };
}

