import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { deriveNaturalHydrology } from "../build-earth-geospatial-soil-hydrology.mjs";
import { sha256 } from "./ai-painter-stage4-dataset-audit.mjs";

// Source-space evidence only. This module does not project real coordinates to
// game geometry, select a river template, create WorldFacts or grant data use.
export function validateD8Routing({ width, height, receiver, filledElevation, accumulation }) {
  const size = width * height;
  assert(Number.isInteger(width) && width >= 2 && Number.isInteger(height) && height >= 2 &&
    size <= 1024 * 768, "invalid bounded routing grid");
  assert(receiver instanceof Int32Array && receiver.length === size &&
    filledElevation instanceof Float32Array && filledElevation.length === size &&
    accumulation instanceof Uint32Array && accumulation.length === size, "invalid routing arrays");
  assert(filledElevation.every(Number.isFinite), "non-finite filled elevation");
  const incoming = new Uint32Array(size), expected = new Uint32Array(size);
  expected.fill(1);
  const outlets = [];
  for (let i = 0; i < size; i++) {
    const next = receiver[i], x = i % width, y = Math.floor(i / width);
    assert(next >= -1 && next < size && next !== i, "invalid routing receiver");
    if (next === -1) {
      assert(x === 0 || y === 0 || x === width - 1 || y === height - 1, "unresolved interior sink");
      outlets.push(i);
    } else {
      assert(Math.abs(next % width - x) <= 1 && Math.abs(Math.floor(next / width) - y) <= 1,
        "receiver is not a D8 neighbor");
      assert(filledElevation[next] <= filledElevation[i], "uphill routing edge");
      incoming[next]++;
    }
  }
  // Independently accumulate in graph order, not the producer's flood order.
  const queue = new Int32Array(size);
  let head = 0, tail = 0;
  for (let i = 0; i < size; i++) if (incoming[i] === 0) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++], next = receiver[i];
    if (next >= 0) {
      expected[next] += expected[i];
      if (--incoming[next] === 0) queue[tail++] = next;
    }
  }
  assert.equal(head, size, "routing cycle detected");
  for (let i = 0; i < size; i++) assert.equal(accumulation[i], expected[i], `flow accumulation mismatch:${i}`);
  const outletCellTotal = outlets.reduce((total, i) => total + expected[i], 0);
  assert.equal(outletCellTotal, size, "flow mass conservation failed");
  return { cellCount: size, outletCount: outlets.length, outletCellTotal,
    acyclic: true, accumulationIndependentlyRecomputed: true };
}

// Exact segment/rectangle clipping. Counting centers on either side misses
// segments entering and leaving a narrow window, and mislabels diagonal edges.
export function segmentWindowCrossings(from, to, window) {
  assert([from.x, from.y, to.x, to.y, window.left, window.top, window.width, window.height]
    .every(Number.isFinite) && window.width > 0 && window.height > 0, "invalid window segment");
  const right = window.left + window.width, bottom = window.top + window.height;
  let enter = 0, exit = 1;
  for (const [a, b, low, high] of [[from.x, to.x, window.left, right], [from.y, to.y, window.top, bottom]]) {
    if (a === b) { if (a <= low || a >= high) return []; continue; }
    const t1 = (low - a) / (b - a), t2 = (high - a) / (b - a);
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter >= exit) return []; // Tangency is not flow through the interior.
  }
  const inside = p => p.x > window.left && p.x < right && p.y > window.top && p.y < bottom;
  const event = (t, role) => {
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const tolerance = 1e-9;
    const boundarySides = [["west", point.x - window.left], ["east", point.x - right],
      ["north", point.y - window.top], ["south", point.y - bottom]]
      .filter(([, distance]) => Math.abs(distance) <= tolerance).map(([side]) => side);
    assert(boundarySides.length >= 1, "clipped crossing has no boundary");
    return { role, boundarySides, point, cornerAmbiguous: boundarySides.length !== 1 };
  };
  return [...(!inside(from) ? [event(enter, "inlet")] : []),
    ...(!inside(to) ? [event(exit, "outlet")] : [])];
}

export function analyzeWindowHydrology({ routing, sourceGrid, sourceWindow, excludedCells, threshold }) {
  const { width, height, receiver, accumulation, filledElevation, drainageLikelihood } = routing;
  const validation = validateD8Routing(routing);
  assert(Number.isInteger(sourceGrid.width) && Number.isInteger(sourceGrid.height) &&
    sourceGrid.width >= width && sourceGrid.height >= height, "invalid source grid");
  assert([sourceWindow.left, sourceWindow.top, sourceWindow.width, sourceWindow.height].every(Number.isInteger) &&
    sourceWindow.left >= 0 && sourceWindow.top >= 0 && sourceWindow.width > 0 && sourceWindow.height > 0 &&
    sourceWindow.left + sourceWindow.width <= sourceGrid.width &&
    sourceWindow.top + sourceWindow.height <= sourceGrid.height, "invalid source window");
  assert(excludedCells instanceof Uint8Array && excludedCells.length === receiver.length &&
    drainageLikelihood instanceof Uint8Array && drainageLikelihood.length === receiver.length, "invalid channel support arrays");
  assert(Number.isInteger(threshold) && threshold >= 0 && threshold <= 255, "invalid source drainage threshold");
  const center = i => ({ x: (i % width + 0.5) * sourceGrid.width / width,
    y: (Math.floor(i / width) + 0.5) * sourceGrid.height / height });
  const crossings = [];
  for (let i = 0; i < receiver.length; i++) {
    const next = receiver[i];
    if (next < 0) continue;
    for (const event of segmentWindowCrossings(center(i), center(next), sourceWindow)) {
      crossings.push({ ...event, sourceCell: i, receiverCell: next,
        accumulationAtSource: accumulation[i], elevationDrop: filledElevation[i] - filledElevation[next],
        touchesRemovalMask: Boolean(excludedCells[i] || excludedCells[next]),
        sourceThresholdSupported: drainageLikelihood[i] >= threshold && drainageLikelihood[next] >= threshold });
    }
  }
  const supported = crossings.filter(c => c.sourceThresholdSupported && !c.touchesRemovalMask);
  return { validation, sourceWindow, sourceThreshold: threshold, crossings,
    supportedBoundaryCounts: { inlets: supported.filter(c => c.role === "inlet").length,
      outlets: supported.filter(c => c.role === "outlet").length,
      ambiguousCorners: supported.filter(c => c.cornerAmbiguous).length },
    interpretation: "source_routing_support_not_final_water_presence_or_neighbor_qualification",
    // Single-receiver D8 evidence cannot establish river splitting/anabranches.
    anabranchEstablished: false, worldFactsQualified: false, gameGeometryCreated: false };
}

export function accumulateUpstreamExclusions(routing, excludedCells) {
  validateD8Routing(routing);
  assert(excludedCells instanceof Uint8Array && excludedCells.length === routing.receiver.length,
    "invalid upstream exclusion mask");
  const totals = Uint32Array.from(excludedCells, n => n === 0 ? 0 : 1);
  const incoming = new Uint32Array(totals.length), queue = new Int32Array(totals.length);
  for (const next of routing.receiver) if (next >= 0) incoming[next]++;
  let head = 0, tail = 0;
  for (let i = 0; i < incoming.length; i++) if (incoming[i] === 0) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++], next = routing.receiver[i];
    if (next >= 0) { totals[next] += totals[i]; if (--incoming[next] === 0) queue[tail++] = next; }
  }
  return totals;
}

export function deriveWindowHydrologyGraph({ routing, sourceGrid, sourceWindow, excludedCells, threshold }) {
  const boundary = analyzeWindowHydrology({ routing, sourceGrid, sourceWindow, excludedCells, threshold });
  const upstreamExclusions = accumulateUpstreamExclusions(routing, excludedCells);
  const cellPoint = i => ({ x: (i % routing.width + 0.5) * sourceGrid.width / routing.width,
    y: (Math.floor(i / routing.width) + 0.5) * sourceGrid.height / routing.height });
  const inside = p => p.x > sourceWindow.left && p.x < sourceWindow.left + sourceWindow.width &&
    p.y > sourceWindow.top && p.y < sourceWindow.top + sourceWindow.height;
  const nodes = [], edges = [], gaps = [];
  const ports = boundary.crossings.filter(c => c.sourceThresholdSupported && !c.touchesRemovalMask)
    .map((c, i) => ({ ...c, nodeId: `source-port:${i}`, upstreamExcludedCellCount: upstreamExclusions[c.sourceCell] }));
  const selected = new Set();
  for (let i = 0; i < routing.receiver.length; i++) {
    if (inside(cellPoint(i)) && !excludedCells[i] && routing.drainageLikelihood[i] >= threshold) {
      selected.add(i);
      nodes.push({ nodeId: `source-cell:${i}`, sourceCell: i, sourcePoint: cellPoint(i),
        filledElevation: routing.filledElevation[i], upstreamExcludedCellCount: upstreamExclusions[i] });
    }
  }
  const links = new Set();
  const link = (source, target) => { const key = `${source}|${target}`;
    if (!links.has(key)) { links.add(key); edges.push({ source, target }); } };
  for (const i of selected) {
    const next = routing.receiver[i];
    if (selected.has(next)) link(`source-cell:${i}`, `source-cell:${next}`);
    else if (!ports.some(p => p.role === "outlet" && p.sourceCell === i)) {
      gaps.push({ code: "supported_channel_ends_without_boundary_outlet", sourceCell: i, receiverCell: next });
    }
  }
  for (const p of ports) {
    nodes.push({ nodeId: p.nodeId, sourcePoint: p.point, role: p.role,
      upstreamExcludedCellCount: p.upstreamExcludedCellCount });
    const cell = p.role === "inlet" ? p.receiverCell : p.sourceCell;
    if (!selected.has(cell)) { gaps.push({ code: "boundary_port_without_supported_interior_cell", port: p.nodeId }); continue; }
    if (p.cornerAmbiguous) gaps.push({ code: "ambiguous_boundary_corner", port: p.nodeId });
    if (p.role === "inlet") link(p.nodeId, `source-cell:${cell}`);
    else link(`source-cell:${cell}`, p.nodeId);
  }
  const incoming = new Map(nodes.map(n => [n.nodeId, 0])), outgoing = new Map(nodes.map(n => [n.nodeId, 0]));
  for (const e of edges) { incoming.set(e.target, incoming.get(e.target) + 1); outgoing.set(e.source, outgoing.get(e.source) + 1); }
  const roots = nodes.filter(n => incoming.get(n.nodeId) === 0).map(n => n.nodeId);
  const confluences = nodes.filter(n => incoming.get(n.nodeId) > 1).map(n => n.nodeId);
  const affectedNodes = nodes.filter(n => n.upstreamExcludedCellCount > 0).map(n => n.nodeId);
  if (!nodes.length) gaps.push({ code: "no_supported_water_network" });
  if (affectedNodes.length) gaps.push({ code: "supported_network_upstream_intersects_removal_mask", nodeIds: affectedNodes });
  return { schemaVersion: "measured-window-hydrology-support-graph-v1", sourceWindow, nodes, edges, ports,
    roots, confluences, gaps, sourceMaskIsolationVerified: nodes.length > 0 && affectedNodes.length === 0,
    sourceGraphContinuous: nodes.length > 0 && gaps.every(g => g.code === "supported_network_upstream_intersects_removal_mask"),
    interpretation: "thresholded_source_support_graph_not_a_published_world_hydrology_graph",
    worldFactsQualified: false, gameGeometryCreated: false };
}

export function pairMeasuredHydrologyPorts({ candidateId, candidates, graph, routing, sourceGrid }) {
  validateD8Routing(routing);
  assert(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 4096 &&
    new Set(candidates.map(c => c.candidateId)).size === candidates.length, "invalid measured neighbor pool");
  const selected = candidates.filter(c => c.candidateId === candidateId);
  assert.equal(selected.length, 1, "current measured candidate missing");
  assert.deepEqual(selected[0].sourcePixelWindow, graph.sourceWindow, "graph source window mismatch");
  const center = i => ({ x: (i % routing.width + 0.5) * sourceGrid.width / routing.width,
    y: (Math.floor(i / routing.width) + 0.5) * sourceGrid.height / routing.height });
  const opposites = { north: "south", south: "north", west: "east", east: "west" };
  const pairs = [], gaps = [];
  for (const port of graph.ports) {
    assert(Number.isInteger(port.sourceCell) && port.sourceCell >= 0 && port.sourceCell < routing.receiver.length &&
      routing.receiver[port.sourceCell] === port.receiverCell, "port does not match a source routing edge");
    const actual = segmentWindowCrossings(center(port.sourceCell), center(port.receiverCell), graph.sourceWindow)
      .filter(p => p.role === port.role && JSON.stringify(p.boundarySides) === JSON.stringify(port.boundarySides) &&
        Math.abs(p.point.x - port.point.x) <= 1e-9 && Math.abs(p.point.y - port.point.y) <= 1e-9);
    assert.equal(actual.length, 1, "source port crossing does not reproduce");
    if (port.cornerAmbiguous) { gaps.push({ port: port.nodeId, code: "ambiguous_boundary_corner" }); continue; }
    const side = port.boundarySides[0], current = graph.sourceWindow;
    const neighbors = candidates.filter(c => {
      if (c.candidateId === candidateId) return false;
      const w = c.sourcePixelWindow;
      assert(w && [w.left, w.top, w.width, w.height].every(Number.isInteger) && w.width > 0 && w.height > 0,
        "invalid neighboring measurement window");
      if (side === "east" || side === "west") return (side === "east"
        ? w.left === current.left + current.width : w.left + w.width === current.left) &&
        port.point.y > w.top && port.point.y < w.top + w.height;
      return (side === "south" ? w.top === current.top + current.height : w.top + w.height === current.top) &&
        port.point.x > w.left && port.point.x < w.left + w.width;
    });
    if (neighbors.length !== 1) { gaps.push({ port: port.nodeId, code: "measured_neighbor_not_unique", matches: neighbors.length }); continue; }
    const neighbor = neighbors[0];
    const samePoint = p => Math.abs(p.x - port.point.x) <= 1e-9 && Math.abs(p.y - port.point.y) <= 1e-9;
    const possibleEdges = [[port.sourceCell, port.receiverCell]];
    // A receiver center can lie exactly on the shared boundary: the source
    // window exits on one edge, the neighbor enters on the following edge.
    if (port.role === "outlet" && samePoint(center(port.receiverCell)) && routing.receiver[port.receiverCell] >= 0)
      possibleEdges.push([port.receiverCell, routing.receiver[port.receiverCell]]);
    if (port.role === "inlet" && samePoint(center(port.sourceCell))) {
      for (let i = 0; i < routing.receiver.length; i++)
        if (routing.receiver[i] === port.sourceCell) possibleEdges.push([i, port.sourceCell]);
    }
    const matching = possibleEdges.flatMap(([from, to]) =>
      segmentWindowCrossings(center(from), center(to), neighbor.sourcePixelWindow)
        .filter(p => p.role !== port.role && !p.cornerAmbiguous && p.boundarySides[0] === opposites[side] && samePoint(p.point))
        .map(p => ({ ...p, sourceCell: from, receiverCell: to })));
    if (matching.length !== 1) { gaps.push({ port: port.nodeId, code: "neighbor_flow_crossing_not_paired" }); continue; }
    pairs.push({ sourcePortId: port.nodeId, sourceCandidateId: candidateId, neighborCandidateId: neighbor.candidateId,
      neighborSourceWindow: neighbor.sourcePixelWindow, sourceCell: port.sourceCell, receiverCell: port.receiverCell,
      neighborSourceCell: matching[0].sourceCell, neighborReceiverCell: matching[0].receiverCell,
      sourceSide: side, neighborSide: opposites[side], sourceRole: port.role, neighborRole: matching[0].role,
      sourceIntersection: port.point, neighborIntersection: matching[0].point });
  }
  return { pairs, gaps, allSourcePortsPaired: graph.ports.length > 0 && gaps.length === 0,
    worldGraphConnected: false, pathConnectivityEstablished: false };
}

// Elevation SUPPORT, not surveyed water-surface height. Boundary heights are
// interpolated along verified D8 edges in the derived Priority-Flood raster.
// A graph gap remains a gap even when every retained edge flows downhill.
export function auditMeasuredSourceElevations({ graph, ...source }) {
  validateD8Routing(source.routing);
  const current = deriveWindowHydrologyGraph({ ...source, sourceWindow: graph.sourceWindow });
  assert.deepEqual(graph, current, "source elevation graph does not reproduce");
  const { routing, sourceGrid } = source;
  const center = cell => ({ x: (cell % routing.width + 0.5) * sourceGrid.width / routing.width,
    y: (Math.floor(cell / routing.width) + 0.5) * sourceGrid.height / routing.height });
  const nodes = graph.nodes.map(n => {
    if (Number.isInteger(n.sourceCell)) return { nodeId: n.nodeId, sourceCell: n.sourceCell,
      elevationMetres: routing.filledElevation[n.sourceCell], method: "derived_priority_flood_cell_value" };
    const port = graph.ports.find(p => p.nodeId === n.nodeId);
    assert(port, "source elevation node lacks a cell or verified port");
    const a = center(port.sourceCell), b = center(port.receiverCell), dx = b.x - a.x, dy = b.y - a.y;
    const t = ((port.point.x - a.x) * dx + (port.point.y - a.y) * dy) / (dx * dx + dy * dy);
    assert(Number.isFinite(t) && t >= 0 && t <= 1, "source elevation boundary lies outside its D8 edge");
    return { nodeId: n.nodeId, sourceCell: port.sourceCell, receiverCell: port.receiverCell,
      interpolationFraction: t, sourceElevationMetres: routing.filledElevation[port.sourceCell],
      receiverElevationMetres: routing.filledElevation[port.receiverCell],
      elevationMetres: routing.filledElevation[port.sourceCell] * (1 - t) + routing.filledElevation[port.receiverCell] * t,
      method: "linear_boundary_interpolation_between_derived_cells" };
  });
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  const edges = graph.edges.map(e => {
    const a = byId.get(e.source), b = byId.get(e.target);
    assert(a && b && b.elevationMetres <= a.elevationMetres, "supported source elevation edge flows uphill");
    return { ...e, sourceElevationMetres: a.elevationMetres, targetElevationMetres: b.elevationMetres,
      dropMetres: a.elevationMetres - b.elevationMetres };
  });
  return { schemaVersion: "measured-source-elevation-support-audit-v1",
    sourceGraphSha256: sha256(JSON.stringify(graph)), nodes, edges, retainedEdgesNonIncreasing: true,
    sourceGraphComplete: graph.gaps.length === 0 && graph.nodes.length > 0, gaps: structuredClone(graph.gaps),
    zeroDropEdges: edges.filter(e => e.dropMetres === 0).length,
    limitation: "derived_routing_support_not_water_depth_survey_or_hydrology_naturalization_qualification",
    gameHeightFieldCreated: false, worldFactsQualified: false, trainingAllowed: false };
}

export function traceMeasuredDownstream({ routing, excludedCells, sourceGrid, candidates, startCell }) {
  validateD8Routing(routing);
  assert(Number.isInteger(startCell) && startCell >= 0 && startCell < routing.receiver.length, "invalid downstream start cell");
  assert(sourceGrid && Number.isInteger(sourceGrid.width) && sourceGrid.width > 0 && Number.isInteger(sourceGrid.height) &&
    sourceGrid.height > 0 && sourceGrid.width <= 1024 && sourceGrid.height <= 768, "invalid downstream source grid");
  assert(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 4096 &&
    candidates.every(c => typeof c.candidateId === "string" && c.candidateId.length > 0) &&
    new Set(candidates.map(c => c.candidateId)).size === candidates.length, "invalid downstream candidate pool");
  for (const c of candidates) {
    const w = c.sourcePixelWindow;
    assert(w && [w.left, w.top, w.width, w.height].every(Number.isInteger) && w.left >= 0 && w.top >= 0 && w.width > 0 && w.height > 0 &&
      w.left + w.width <= sourceGrid.width && w.top + w.height <= sourceGrid.height, "invalid downstream candidate window");
  }
  const upstream = accumulateUpstreamExclusions(routing, excludedCells), cells = [], regionVisits = [];
  let cell = startCell;
  while (cell >= 0) {
    assert(cells.length < routing.receiver.length, "downstream trace exceeded source grid");
    const point = { x: (cell % routing.width + 0.5) * sourceGrid.width / routing.width,
      y: (Math.floor(cell / routing.width) + 0.5) * sourceGrid.height / routing.height };
    // Half-open ownership is for indexing cell centers only, not port pairing.
    // Physical boundary intersections remain the responsibility of the segment
    // crossing/paired-port checker and are never inferred from this ownership.
    const owners = candidates.filter(c => {
      const w = c.sourcePixelWindow; return point.x >= w.left && point.x < w.left + w.width && point.y >= w.top && point.y < w.top + w.height;
    });
    assert.equal(owners.length, 1, "downstream source cell has missing or ambiguous region ownership");
    const candidateId = owners[0].candidateId;
    if (regionVisits.at(-1)?.candidateId !== candidateId) regionVisits.push({ candidateId, firstCell: cell, firstTraceIndex: cells.length });
    cells.push({ cell, receiverCell: routing.receiver[cell], candidateId, point, filledElevation: routing.filledElevation[cell],
      accumulation: routing.accumulation[cell], locallyExcluded: excludedCells[cell] > 0, upstreamExcludedCellCount: upstream[cell] });
    cell = routing.receiver[cell];
  }
  const firstExposed = cells.find(c => c.upstreamExcludedCellCount > 0) ?? null;
  return { schemaVersion: "measured-downstream-source-trace-v1", startCell, cells, regionVisits,
    firstExposed, reachesAnalysisBoundary: true, endsAtAnalysisCell: cells.at(-1).cell,
    sourceMaskIsolationAlongTrace: firstExposed === null,
    interpretation: "downstream_source_diagnostic_not_a_new_zero_exposure_acceptance_policy",
    limitations: ["human_footprint_exposure_requires_existing_naturalization_policy_review_not_automatic_source_rejection",
      "analysis_grid_discharge_is_not_a_verified_real_river_mouth", "cell_region_visits_are_not_worldgraph_qualification"],
    worldFactsQualified: false, worldGraphConnected: false };
}

export function replayNaturalLandCover(raw, mask, width, height) {
  assert(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 1024 && height <= 768 &&
    raw instanceof Uint8Array && mask instanceof Uint8Array && raw.length === width * height && mask.length === raw.length,
    "invalid naturalization raster input");
  assert(mask.every(v => v === 0 || v === 255), "invalid removal mask values");
  assert(raw.every((v, i) => ![40, 50].includes(v) || mask[i] === 255), "human land-cover class is not excluded");
  // Recompute from the ORIGINAL observed classes, not from stored reconstructed
  // output. Same specified seed order and N/E/S/W tie order as the old producer.
  const values = new Uint8Array(raw), distance = new Int32Array(raw.length).fill(-1), queue = new Int32Array(raw.length);
  let head = 0, tail = 0, reconstructed = 0, maximumDistancePixels = 0;
  for (let i = 0; i < raw.length; i++) if (!mask[i] && raw[i] > 0) { queue[tail++] = i; distance[i] = 0; }
  assert(tail > 0, "no natural source cells for reconstruction");
  while (head < tail) {
    const i = queue[head++], x = i % width;
    for (const next of [i >= width ? i - width : -1, x < width - 1 ? i + 1 : -1,
      i + width < raw.length ? i + width : -1, x > 0 ? i - 1 : -1]) {
      if (next < 0 || distance[next] >= 0) continue;
      distance[next] = distance[i] + 1; values[next] = values[i]; queue[tail++] = next;
      if (mask[next]) { reconstructed++; maximumDistancePixels = Math.max(maximumDistancePixels, distance[next]); }
    }
  }
  assert.equal(reconstructed, mask.reduce((n, v) => n + Number(v > 0), 0), "not all excluded source pixels reconstructed");
  return { values, reconstructed, maximumDistancePixels };
}

export function replayBoundNaturalization({ reader, naturalizedRunBinding }) {
  const run = reader.bound(naturalizedRunBinding), lineage = reader.bound({ path: run.lineagePath, sha256: run.lineageSha256 });
  const select = role => { const matches = lineage.sourceArtifacts.filter(a => a.role === role); assert.equal(matches.length, 1); return reader.bound(matches[0]); };
  const measurement = select("measurement_window"), removal = select("engineered_feature_removal");
  assert.equal(measurement.contractId, run.contractId); assert.equal(removal.contractId, run.contractId);
  const width = 1024, height = 768, size = width * height;
  const unpack = binding => { const data = gunzipSync(reader.bytes(binding.path, binding.sha256), { maxOutputLength: size });
    assert.equal(data.length, size); return data; };
  const land = measurement.rasterWindows.landCover;
  const raw = unpack({ path: land.outputPath, sha256: land.outputSha256 });
  const worldCoverMask = unpack({ path: measurement.humanRemoval.removalMaskPath, sha256: measurement.humanRemoval.removalMaskSha256 });
  const masks = new Map();
  for (const record of removal.masks) {
    assert(record.width === width && record.height === height && !masks.has(record.category), "invalid engineered mask identity");
    masks.set(record.category, unpack(record));
  }
  const all = masks.get("all_engineered"); assert(all, "combined engineered mask missing");
  const combined = unpack({ path: run.combinedHumanRemovalMaskPath, sha256: run.combinedHumanRemovalMaskSha256 });
  const categoryMasks = [...masks].filter(([k]) => k !== "all_engineered").map(([, v]) => v);
  for (let i = 0; i < size; i++) {
    assert.equal(worldCoverMask[i] > 0, [40, 50].includes(raw[i]), "WorldCover exclusion does not match raw observed class");
    const categoryUnion = categoryMasks.some(v => v[i] > 0);
    assert.equal(all[i] > 0, categoryUnion, "engineered mask union mismatch");
    assert.equal(combined[i], worldCoverMask[i] || all[i] ? 255 : 0, "combined naturalization mask mismatch");
  }
  const reconstruction = replayNaturalLandCover(raw, combined, width, height);
  const stored = unpack({ path: run.reconstructedNaturalLandCoverPath, sha256: run.reconstructedNaturalLandCoverSha256 });
  assert(Buffer.from(reconstruction.values).equals(stored), "natural land-cover reconstruction does not reproduce from original classes");
  assert.equal(reconstruction.reconstructed, run.statistics.reconstructedPixelCount);
  assert.equal(reconstruction.maximumDistancePixels, run.statistics.reconstructionMaximumDistancePixels);
  return { raw, reconstructed: reconstruction.values, combinedMask: combined, masks: new Map([["worldcover_cropland_or_built_up", worldCoverMask], ...masks]),
    evidence: { schemaVersion: "bound-natural-land-cover-replay-v1", originalClassRasterSha256: sha256(raw),
      combinedMaskSha256: sha256(combined), reconstructedRasterSha256: sha256(stored), pixelCount: size,
      reconstructedPixelCount: reconstruction.reconstructed, maximumDistancePixels: reconstruction.maximumDistancePixels,
      categoryMasksRecomputedAsUnion: true, landCoverReconstructionReproduced: true,
      hydrologyNaturalizationQualified: false, worldFactsQualified: false,
      limitation: "land_cover_reconstruction_does_not_establish_natural_river_topology_or_remove_engineered_hydrologic_effects" } };
}

export function replayBoundHydrology({ reader, naturalizedRunBinding }) {
  const run = reader.bound(naturalizedRunBinding);
  const lineage = reader.bound({ path: run.lineagePath, sha256: run.lineageSha256 });
  const select = role => {
    const entries = lineage.sourceArtifacts.filter(a => a.role === role);
    assert.equal(entries.length, 1, `source role must resolve uniquely:${role}`);
    return entries[0];
  };
  const hydroBinding = select("soil_and_natural_hydrology");
  const manifest = reader.bound(hydroBinding), h = manifest.naturalHydrology;
  const removal = reader.bound(select("engineered_feature_removal"));
  assert(removal.status === "engineered_feature_removal_evidence_compiled" &&
    removal.evidenceContract?.finalWorldGeometryMustBeReconstructed === true &&
    removal.evidenceContract?.prohibitedUses?.includes("final_world_fact_geometry"), "invalid removal boundary");
  assert(h?.analysisGrid?.width === 256 && h.analysisGrid.height === 192 &&
    h.method?.includes("Priority-Flood") && h.method.includes("D8"), "unsupported bound hydrology source");
  const width = h.analysisGrid.width, height = h.analysisGrid.height, size = width * height;
  const unpack = (p, hash, length) => {
    const bytes = gunzipSync(reader.bytes(p, hash), { maxOutputLength: length });
    assert.equal(bytes.length, length, "source raster length mismatch"); return bytes;
  };
  const elevationBytes = unpack(h.elevationPath, h.elevationSha256, size * 4);
  const elevation = Float32Array.from({ length: size }, (_, i) => elevationBytes.readFloatLE(i * 4));
  const derived = deriveNaturalHydrology(elevation, width, height, { includeRouting: true });
  const arrayHashes = {};
  for (const [key, prefix, type] of [["filledElevation", "filledElevation", "f32"], ["slope", "slope", "f32"],
    ["accumulation", "accumulation", "u32"], ["drainageLikelihood", "drainageLikelihood", "u8"]]) {
    const actual = Buffer.alloc(size * (type === "u8" ? 1 : 4));
    for (let i = 0; i < size; i++) {
      if (type === "f32") actual.writeFloatLE(derived[key][i], i * 4);
      else if (type === "u32") actual.writeUInt32LE(derived[key][i], i * 4);
      else actual[i] = derived[key][i];
    }
    const recorded = unpack(h[`${prefix}Path`], h[`${prefix}Sha256`], actual.length);
    assert(actual.equals(recorded), `stored hydrology does not reproduce:${key}`);
    arrayHashes[key] = sha256(actual);
  }
  const threshold = h.statistics?.drainageLikelihoodThreshold;
  assert.equal(threshold, derived.statistics.drainageLikelihoodThreshold, "source drainage threshold mismatch");
  const sourceGrid = { width: 1024, height: 768 };
  const mask = unpack(run.combinedHumanRemovalMaskPath, run.combinedHumanRemovalMaskSha256, 1024 * 768);
  const excludedCells = new Uint8Array(size);
  for (let y = 0; y < 768; y++) for (let x = 0; x < 1024; x++) {
    if (mask[y * 1024 + x]) excludedCells[Math.floor(y / 4) * width + Math.floor(x / 4)] = 1;
  }
  const routing = { width, height, ...derived };
  return { routing, excludedCells, threshold, sourceGrid,
    evidence: { naturalizedRunBinding, hydrologyManifest: { path: hydroBinding.path, sha256: hydroBinding.sha256 },
      reproducedArrayHashes: arrayHashes, validation: validateD8Routing(routing),
      limitations: ["legacy_source_routing_reproduction_not_physical_model_certification",
        "removal_mask_excludes_cells_but_does_not_recompute_upstream_catchments",
        "source_threshold_support_is_not_a_new_visual_acceptance_threshold",
        "neighbor_worldfacts_and_anonymous_game_projection_not_created"] } };
}
