import { createHash } from "node:crypto";
import { buildCompleteMapSemanticTopologySignature } from "./complete-map-semantic-topology-signature.mjs";

const SCHEMAS = new Set(["ai-assisted-training-world-fact-blueprint-v1", "ai-assisted-training-world-fact-blueprint-v2"]);
const TERRAIN = new Set(["grass", "water", "shoreline", "path_ground", "natural_boundary", "mud_patch", "tall_grass"]);
const OBJECTS = new Set(["tree", "rock", "shrub", "bamboo", "reed", "grass_detail"]);
export const GEOMETRY_TRANSFORMS = ["identity", "horizontal_mirror", "vertical_mirror", "rotate_180"];
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function check(ok, code, field) {
  if (!ok) throw Object.assign(new Error(`${code}: ${field}`), { code, field });
}
function array(value, field, minimum = 0) {
  check(Array.isArray(value) && value.length >= minimum && value.length <= 4096,
    "historical_geometry_invalid", field);
  return value;
}
function point(value, field) {
  check(value && typeof value.x === "number" && Number.isFinite(value.x)
    && typeof value.y === "number" && Number.isFinite(value.y), "historical_geometry_invalid", field);
  return { x: value.x, y: value.y };
}
function polygon(value, field) {
  const points = array(value, field, 3).map((p, i) => point(p, `${field}[${i}]`));
  check(new Set(points.map((p) => JSON.stringify(p))).size >= 3, "historical_geometry_invalid", field);
  // This is Schema validation, not a WorldFacts validity or polygon simplicity gate.
  return points;
}
function bounds(value, field) {
  point(value, field);
  check(typeof value.width === "number" && Number.isFinite(value.width) && value.width > 0
    && typeof value.height === "number" && Number.isFinite(value.height) && value.height > 0,
  "historical_geometry_invalid", field);
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}
function sorted(values) { return values.map((v) => JSON.stringify(v)).sort().map((v) => JSON.parse(v)); }
function transformedPoint(p, transform, canvas) {
  return { x: ["horizontal_mirror", "rotate_180"].includes(transform) ? canvas.width - p.x : p.x,
    y: ["vertical_mirror", "rotate_180"].includes(transform) ? canvas.height - p.y : p.y };
}
function ring(points, transform, canvas) {
  const values = points.map((p) => transformedPoint(p, transform, canvas));
  if (JSON.stringify(values[0]) === JSON.stringify(values.at(-1))) values.pop();
  // Polygon start vertex and winding have no identity; retain all actual vertices.
  const variants = [];
  for (const direction of [values, [...values].reverse()]) {
    const tokens = direction.map((p) => JSON.stringify(p));
    const minimum = [...tokens].sort()[0];
    for (let i = 0; i < tokens.length; i++) if (tokens[i] === minimum) {
      variants.push(JSON.stringify([...direction.slice(i), ...direction.slice(0, i)]));
    }
  }
  return JSON.parse(variants.sort()[0]);
}
function rectangle(value) {
  return [{ x: value.x, y: value.y }, { x: value.x + value.width, y: value.y },
    { x: value.x + value.width, y: value.y + value.height }, { x: value.x, y: value.y + value.height }];
}

// Keep the legacy payload and property order byte-for-byte stable. A task with
// no declared entrance/focal geometry gets only the shared spatial-layer hash,
// never the legacy complete-layout identity with fabricated bounds.
function geometryVariants({ canvas, terrain, walkable, collision, objects, entrance, focal }) {
  return GEOMETRY_TRANSFORMS.map((transform) => {
    const shape = (rows) => sorted(rows.map((r) => ({ ...r, polygon: ring(r.polygon, transform, canvas) })));
    const terrainPayload = shape(terrain);
    const objectsPayload = sorted(objects.map((o) => ({ kind: o.kind, blocksMovement: o.blocksMovement,
      polygon: ring(rectangle(o.footprint), transform, canvas) })));
    const role = (kind) => {
      const items = terrainPayload.filter((r) => r.kind === kind);
      return items.length ? hash([canvas.width, canvas.height, items]) : null;
    };
    const spatialPayload = [canvas.width, canvas.height, terrainPayload, shape(walkable), shape(collision), objectsPayload];
    return { transform, routePolygons: role("path_ground"), waterPolygons: role("water"),
      shorelinePolygons: role("shoreline"), boundaryPolygons: role("natural_boundary"),
      terrainLayout: hash([canvas.width, canvas.height, terrainPayload]),
      objectLayout: objectsPayload.length ? hash([canvas.width, canvas.height, objectsPayload]) : null,
      completeDeclaredLayout: entrance === null ? null : hash([...spatialPayload,
        ring(rectangle(entrance), transform, canvas), focal === null ? null : ring(rectangle(focal), transform, canvas)]),
      ...(entrance === null ? { declaredSpatialLayersLayout: hash(spatialPayload) } : {}) };
  });
}

// Legacy v1/v2 store polygon regions, not path/water recipe centerlines. Never
// manufacture those fields or treat absent topology as a dry/empty world.
export function extractHistoricalGeometry(blueprint) {
  check(SCHEMAS.has(blueprint?.schemaVersion), "historical_geometry_schema_unsupported", "schemaVersion");
  const canvas = blueprint.canvas;
  check(canvas && Number.isInteger(canvas.width) && canvas.width > 0
    && Number.isInteger(canvas.height) && canvas.height > 0
    && canvas.width * canvas.height <= 16_777_216, "historical_geometry_invalid", "canvas");
  const g = blueprint.geometry;
  check(g && typeof g === "object" && !Array.isArray(g), "historical_geometry_missing", "geometry");
  check(typeof g.hasWater === "boolean", "historical_geometry_invalid", "hasWater");
  const regions = (key, kindRequired = false) => array(g[key], key).map((r, i) => {
    check(r && (!kindRequired || TERRAIN.has(r.kind)), "historical_geometry_schema_unsupported", `${key}[${i}].kind`);
    return { ...(kindRequired ? { kind: r.kind } : {}), polygon: polygon(r.polygon, `${key}[${i}].polygon`) };
  });
  const terrain = regions("terrainRegions", true), walkable = regions("walkableRegions"), collision = regions("collisionRegions");
  check(terrain.length > 0, "historical_geometry_missing", "terrainRegions");
  check(g.hasWater === terrain.some((r) => r.kind === "water"), "historical_geometry_conflict", "hasWater/terrainRegions");
  const objects = array(g.objectFootprints, "objectFootprints").map((o, i) => {
    check(o && OBJECTS.has(o.kind) && typeof o.blocksMovement === "boolean",
      "historical_geometry_schema_unsupported", `objectFootprints[${i}].kind/blocksMovement`);
    return { kind: o.kind, blocksMovement: o.blocksMovement, footprint: bounds(o.footprint, `objectFootprints[${i}].footprint`) };
  });
  const entrance = bounds(g.entranceBounds, "entranceBounds");
  check(Object.hasOwn(g, "focalBounds"), "historical_geometry_missing", "focalBounds");
  const focal = g.focalBounds === null ? null : bounds(g.focalBounds, "focalBounds");
  // Validate declared passages without inferring any when the legacy field is absent.
  if (Object.hasOwn(g, "boundaryPassages")) array(g.boundaryPassages, "boundaryPassages").forEach((p, i) => {
    check(p && ["top", "bottom", "left", "right"].includes(p.edge) && Number.isInteger(p.routeIndex)
      && p.routeIndex >= 0, "historical_geometry_invalid", `boundaryPassages[${i}]`);
    bounds(p.bounds, `boundaryPassages[${i}].bounds`);
  });
  const variants = geometryVariants({ canvas, terrain, walkable, collision, objects, entrance, focal });
  const missingTopologyFields = ["pathCenterline", "waterCenterline", "ecologicalZones"]
    .filter((field) => !Object.hasOwn(g, field));
  let signature = null;
  // Validate every present topology input even on partially populated old records.
  for (const key of ["pathCenterline", "waterCenterline"]) if (Object.hasOwn(g, key)) {
    array(g[key], key, key === "pathCenterline" || g.hasWater ? 2 : 0).forEach((p, i) => point(p, `${key}[${i}]`));
    if (key === "waterCenterline") check(g.hasWater ? g[key].length >= 2 : g[key].length === 0,
      "historical_geometry_conflict", key);
  }
  if (Object.hasOwn(g, "waterBranchCenterlines")) array(g.waterBranchCenterlines, "waterBranchCenterlines")
    .forEach((line, i) => array(line, `waterBranchCenterlines[${i}]`, 2).forEach((p) => point(p, "waterBranchCenterlines.point")));
  let ecologicalZonesWithoutGeometry = null;
  if (Object.hasOwn(g, "ecologicalZones")) {
    ecologicalZonesWithoutGeometry = 0;
    array(g.ecologicalZones, "ecologicalZones").forEach((z, i) => {
      check(z && typeof z.kind === "string" && z.kind.length && typeof z.role === "string" && z.role.length,
        "historical_geometry_invalid", `ecologicalZones[${i}]`);
      if (Object.hasOwn(z, "polygon")) polygon(z.polygon, `ecologicalZones[${i}].polygon`);
      else ecologicalZonesWithoutGeometry++;
    });
  }
  if (g.compositionArchitecture !== undefined) {
    check(g.compositionArchitecture && typeof g.compositionArchitecture === "object",
      "historical_geometry_invalid", "compositionArchitecture");
    if (g.compositionArchitecture.openMeadowPolygon !== undefined) polygon(g.compositionArchitecture.openMeadowPolygon, "openMeadowPolygon");
    if (g.compositionArchitecture.objectPlacementZones !== undefined) array(g.compositionArchitecture.objectPlacementZones, "objectPlacementZones")
      .forEach((z, i) => polygon(z?.polygon, `objectPlacementZones[${i}].polygon`));
  }
  if (g.internalHydrologyProfile != null) {
    const profile = g.internalHydrologyProfile;
    check(typeof profile === "object" && !Array.isArray(profile), "historical_geometry_invalid", "internalHydrologyProfile");
    if (profile.internalNetworkConnectionMode !== undefined) check(typeof profile.internalNetworkConnectionMode === "string"
      && profile.internalNetworkConnectionMode.length, "historical_geometry_invalid", "internalNetworkConnectionMode");
    for (const key of ["divergenceFraction", "rejoinFraction", "lateralOffsetFraction", "backwaterBasinCount"])
      if (profile[key] !== undefined) check(typeof profile[key] === "number" && Number.isFinite(profile[key]),
        "historical_geometry_invalid", `internalHydrologyProfile.${key}`);
    if (profile.backwaterBasinLongitudinalFractions !== undefined) array(profile.backwaterBasinLongitudinalFractions, "backwaterBasinLongitudinalFractions")
      .forEach((value) => check(typeof value === "number" && Number.isFinite(value), "historical_geometry_invalid", "backwaterBasinLongitudinalFractions.item"));
  }
  if (!missingTopologyFields.length) signature = buildCompleteMapSemanticTopologySignature(blueprint, canvas);
  return { schemaVersion: "ai-painter-historical-declared-geometry-audit-v1",
    sourceSchema: blueprint.schemaVersion, representation: signature ? "centerline_and_declared_polygons" : "declared_polygons_only",
    canvas: { width: canvas.width, height: canvas.height }, hasWater: g.hasWater,
    counts: { terrainRegions: terrain.length, walkableRegions: walkable.length, collisionRegions: collision.length,
      objectFootprints: objects.length, boundaryPassages: g.boundaryPassages?.length ?? null },
    variants, signature, missingTopologyFields, ecologicalZonesWithoutGeometry,
    limitations: ["exact_declared_polygon_vertex_comparison_not_near_duplicate_or_topology_qualification",
      "layout_hashes_cover_common_polygon_footprint_and_entrance_layers_not_all_blueprint_fields",
      "non_spatial_ecology_labels_do_not_prove_zone_geometry",
      "no_centerline_or_ecological_zone_inferred_from_polygons", "polygon_simplicity_and_worldfacts_validity_not_certified"],
    trainingQualified: false, fullSemanticUniquenessQualified: false };
}

function readDirectTaskGeometry(task, record, taskPath) {
  check(task?.schemaVersion === "runtime-frame-generation-task-v1",
    "historical_geometry_schema_unsupported", "schemaVersion");
  const binding = record.conditionBinding;
  check(typeof binding.taskSha256 === "string" && /^[a-f0-9]{64}$/.test(binding.taskSha256)
    && task.taskSha256 === binding.taskSha256, "historical_geometry_content_hash_mismatch", "conditionBinding.taskSha256");
  // This Schema hashes JSON.stringify(task) BEFORE adding taskSha256. It is a
  // content hash, not the SHA of the pretty-printed file tracked by the reader.
  const payload = { ...task }; delete payload.taskSha256;
  check(hash(payload) === binding.taskSha256, "historical_geometry_content_hash_mismatch", "taskSha256");
  check(typeof record.recordId === "string" && record.recordId.length > 0
    && typeof task.taskId === "string" && task.taskId.length > 0 && binding.taskId === task.taskId
    && typeof task.worldId === "string" && task.worldId.length > 0 && binding.worldId === task.worldId
    && Number.isSafeInteger(task.tick) && task.tick >= 0 && binding.tick === task.tick,
  "historical_geometry_identity_conflict", "record/conditionBinding/task");
  if (binding.worldProfileId !== undefined) check(binding.worldProfileId === task.worldProfileId,
    "historical_geometry_identity_conflict", "conditionBinding.worldProfileId");
  if (record.worldBinding !== undefined) {
    const world = record.worldBinding;
    check(world && typeof world === "object" && !Array.isArray(world),
      "historical_geometry_identity_conflict", "worldBinding");
    for (const [field, expected] of Object.entries({ worldId: task.worldId, tick: task.tick,
      taskPackageId: task.taskId, taskPackagePath: taskPath, worldProfileId: task.worldProfileId })) {
      if (Object.hasOwn(world, field)) check(world[field] === expected,
        "historical_geometry_identity_conflict", `worldBinding.${field}`);
    }
  }
  const canvas = task.outputSize;
  check(canvas && Number.isInteger(canvas.width) && canvas.width > 0
    && Number.isInteger(canvas.height) && canvas.height > 0 && canvas.width * canvas.height <= 16_777_216
    && canvas.frameScope === "complete_runtime_frame", "historical_geometry_invalid", "outputSize");
  const g = task.spatialLayers;
  check(g && typeof g === "object" && !Array.isArray(g), "historical_geometry_missing", "spatialLayers");
  const knownLayers = ["terrainRegions", "walkableRegions", "collisionRegions", "objectFootprints", "interactionRegions", "stateRegions"];
  check(Object.keys(g).every((key) => knownLayers.includes(key)),
    "historical_geometry_schema_unsupported", "spatialLayers.fields");
  const regions = (key, kinds) => array(g[key], `spatialLayers.${key}`).map((r, i) => {
    check(r && kinds.has(r.kind), "historical_geometry_schema_unsupported", `spatialLayers.${key}[${i}].kind`);
    return { ...(key === "terrainRegions" ? { kind: r.kind } : {}), polygon: polygon(r.polygon, `spatialLayers.${key}[${i}].polygon`) };
  });
  const terrain = regions("terrainRegions", TERRAIN);
  check(terrain.length > 0, "historical_geometry_missing", "spatialLayers.terrainRegions");
  const walkable = regions("walkableRegions", new Set(["walkable_area"]));
  const collision = regions("collisionRegions", new Set(["blocked_area"]));
  const taskObjects = new Set(["tree", "rock", "shrub", "flower_patch", "grass_detail"]);
  const objects = array(g.objectFootprints, "spatialLayers.objectFootprints").map((o, i) => {
    check(o && taskObjects.has(o.kind) && typeof o.blocksMovement === "boolean",
      "historical_geometry_schema_unsupported", `spatialLayers.objectFootprints[${i}].kind/blocksMovement`);
    const footprint = bounds(o.footprint, `spatialLayers.objectFootprints[${i}].footprint`);
    check(Number.isFinite(footprint.x + footprint.width) && Number.isFinite(footprint.y + footprint.height),
      "historical_geometry_invalid", `spatialLayers.objectFootprints[${i}].footprint.extent`);
    return { kind: o.kind, blocksMovement: o.blocksMovement, footprint };
  });
  // Non-empty interaction geometry needs its own defined adapter; state labels
  // are descriptive only and cannot supply missing spatial or ecology facts.
  check(array(g.interactionRegions, "spatialLayers.interactionRegions").length === 0,
    "historical_geometry_schema_unsupported", "spatialLayers.interactionRegions");
  const states = array(g.stateRegions, "spatialLayers.stateRegions");
  states.forEach((s) => check(typeof s === "string" && s.length > 0,
    "historical_geometry_schema_unsupported", "spatialLayers.stateRegions.item"));
  const missingTopology = ["entranceBounds", "focalBounds", "hasWater", "pathCenterline", "waterCenterline",
    "routeTopology", "ecologicalZones", "boundaryPassages"];
  return { recordId: record.recordId, taskPath, blueprintPath: null,
    schemaVersion: "ai-painter-historical-declared-geometry-audit-v1", sourceSchema: task.schemaVersion,
    sourceRepresentation: "runtime_frame_task_spatial_layers", representation: "declared_polygons_only",
    sourceBinding: { path: taskPath, taskId: task.taskId, worldId: task.worldId, tick: task.tick,
      contentSha256: binding.taskSha256, hashScheme: "json_stringify_omit_taskSha256_v1" },
    canvas: { width: canvas.width, height: canvas.height }, hasWater: null,
    counts: { terrainRegions: terrain.length, walkableRegions: walkable.length, collisionRegions: collision.length,
      objectFootprints: objects.length, boundaryPassages: null, interactionRegions: 0, stateLabels: states.length },
    variants: geometryVariants({ canvas, terrain, walkable, collision, objects, entrance: null, focal: null }),
    signature: null, missingTopology, missingTopologyFields: [...missingTopology], ecologicalZonesWithoutGeometry: null,
    limitations: ["only_declared_spatialLayers_polygons_and_footprints_are_fingerprinted",
      "entrance_focal_water_presence_route_and_ecology_not_inferred_from_other_task_fields",
      "completeDeclaredLayout_unavailable_without_declared_entrance_and_focal_geometry",
      "state_labels_are_not_geometry", "polygon_simplicity_and_worldfacts_validity_not_certified",
      "geometry_evidence_does_not_prove_rgb_alignment_or_training_eligibility"],
    trainingQualified: false, fullSemanticUniquenessQualified: false };
}

export function compareHistoricalGeometry(left, right) {
  const results = [];
  const direct = left.variants.find((v) => v.transform === "identity");
  check(direct && right.variants?.length === 4, "historical_geometry_invalid", "comparison variants");
  for (const variant of right.variants) {
    const roles = ["routePolygons", "waterPolygons", "shorelinePolygons", "boundaryPolygons", "terrainLayout", "objectLayout", "completeDeclaredLayout"]
      .filter((key) => direct[key] !== null && direct[key] === variant[key]);
    if (roles.length) results.push({ transform: variant.transform, roles,
      interpretation: "declared_geometry_match_requires_context_not_automatic_capacity_rejection" });
  }
  return results;
}

export function readHistoricalGeometry(reader, record) {
  const taskPath = record.conditionBinding?.taskPackagePath;
  check(taskPath, "historical_structured_task_missing", "conditionBinding.taskPackagePath");
  const task = reader.json(taskPath);
  const blueprintPath = task.sourceBindings?.trainingBlueprintPath;
  if (!blueprintPath && (task.schemaVersion === "runtime-frame-generation-task-v1" || Object.hasOwn(task, "spatialLayers"))) {
    return readDirectTaskGeometry(task, record, taskPath);
  }
  check(blueprintPath, "historical_blueprint_reference_missing", "sourceBindings.trainingBlueprintPath");
  const blueprint = reader.json(blueprintPath, task.sourceBindings.trainingBlueprintSha256 ?? undefined);
  check(typeof task.taskId === "string" && task.taskId.length && typeof task.worldId === "string" && task.worldId.length
    && record.conditionBinding.taskId === task.taskId && blueprint.taskId === task.taskId && blueprint.worldId === task.worldId,
  "historical_geometry_identity_conflict", "record/task/blueprint");
  return { recordId: record.recordId, taskPath, blueprintPath, ...extractHistoricalGeometry(blueprint) };
}
