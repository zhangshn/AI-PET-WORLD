import { clamp, pointInPolygon } from "./natural-world-geometry.mjs";

// Pure geometry fingerprints and occupancy comparisons. No history lookup,
// world writes, admission decision or model execution.
export function createNaturalWorldGeometryNovelty({ width: WIDTH, height: HEIGHT, sha256 }) {
  if (!(Number.isFinite(WIDTH) && WIDTH > 0 && Number.isFinite(HEIGHT) && HEIGHT > 0 && typeof sha256 === "function")) {
    throw new Error("geometry novelty requires canvas and digest");
  }
  return { geometrySkeletonPayload, compositionOccupancyCells, canonicalTaggedOccupancyFingerprint, maximumTransformedTaggedOccupancySimilarity, buildTransformedSkeletonPayloads, routeOccupancyCells, maximumTransformedOccupancySimilarity };

function geometrySkeletonPayload(geometry) {
  return {
    routeTopology: geometry.routeTopology,
    pathCenterline: normalizePoints(geometry.pathCenterline),
    waterCenterline: normalizePoints(geometry.waterCenterline ?? []),
    waterBranchCenterlines: (
      geometry.waterBranchCenterlines ?? []
    ).map((points) => normalizePoints(points)),
    compositionOccupancy: compositionOccupancyCells(geometry),
  };
}

function compositionOccupancyCells(geometry) {
  const cells = new Set();
  for (const region of geometry.terrainRegions ?? []) {
    if (
      ![
        "natural_boundary",
        "tall_grass",
        "mud_patch",
        "water",
        "shoreline",
      ].includes(region.kind)
    ) {
      continue;
    }
    for (const cell of polygonOccupancyCells(region.polygon)) {
      cells.add(`terrain_${region.kind}:${cell}`);
    }
  }
  for (const zone of geometry.ecologicalZones ?? []) {
    if (!Array.isArray(zone.polygon)) continue;
    for (const cell of polygonOccupancyCells(zone.polygon)) {
      cells.add(`ecology_${zone.kind}:${cell}`);
    }
  }
  for (const object of geometry.objectFootprints ?? []) {
    const x = object.footprint.x + object.footprint.width / 2;
    const y = object.footprint.y + object.footprint.height / 2;
    const column = clamp(Math.floor((x / WIDTH) * 16), 0, 15);
    const row = clamp(Math.floor((y / HEIGHT) * 12), 0, 11);
    cells.add(`object_${object.kind}:${column},${row}`);
  }
  return [...cells].sort();
}

function polygonOccupancyCells(polygon) {
  const cells = [];
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      const point = {
        x: ((column + 0.5) / 16) * WIDTH,
        y: ((row + 0.5) / 12) * HEIGHT,
      };
      if (pointInPolygon(point, polygon)) {
        cells.push(`${column},${row}`);
      }
    }
  }
  return cells;
}

function canonicalTaggedOccupancyFingerprint(taggedCells) {
  const canonicalForms = normalizedPointTransforms().map((transform) =>
    [...new Set(taggedCells.map((entry) => {
      const separator = entry.lastIndexOf(":");
      const tag = entry.slice(0, separator);
      const [column, row] = entry.slice(separator + 1).split(",").map(Number);
      const point = {
        x: (column + 0.5) / 16,
        y: (row + 0.5) / 12,
      };
      const value = transform(point);
      return `${tag}:${clamp(Math.floor(value.x * 16), 0, 15)},${clamp(Math.floor(value.y * 12), 0, 11)}`;
    }))].sort().join("|"),
  );
  return sha256(Buffer.from(canonicalForms.sort()[0] ?? ""));
}

function maximumTransformedTaggedOccupancySimilarity(current, previous) {
  const previousSet = new Set(previous);
  let maximum = 0;
  for (const transform of normalizedPointTransforms()) {
    const transformed = new Set(current.map((entry) => {
      const separator = entry.lastIndexOf(":");
      const tag = entry.slice(0, separator);
      const [column, row] = entry.slice(separator + 1).split(",").map(Number);
      const value = transform({
        x: (column + 0.5) / 16,
        y: (row + 0.5) / 12,
      });
      return `${tag}:${clamp(Math.floor(value.x * 16), 0, 15)},${clamp(Math.floor(value.y * 12), 0, 11)}`;
    }));
    const union = new Set([...transformed, ...previousSet]);
    let intersection = 0;
    for (const cell of transformed) {
      if (previousSet.has(cell)) intersection += 1;
    }
    maximum = Math.max(
      maximum,
      union.size === 0 ? 1 : intersection / union.size,
    );
  }
  return Number(maximum.toFixed(6));
}

function buildTransformedSkeletonPayloads(geometry) {
  const route = normalizePoints(geometry.pathCenterline);
  const water = normalizePoints(geometry.waterCenterline ?? []);
  const waterBranches = (
    geometry.waterBranchCenterlines ?? []
  ).map((points) => normalizePoints(points));
  const payloads = [];
  for (const transform of normalizedPointTransforms()) {
    const transformedRoute = route.map(transform);
    const transformedWater = water.map(transform);
    const transformedWaterBranches = waterBranches.map((points) =>
      points.map(transform),
    );
    for (const reverseRoute of [false, true]) {
      for (const reverseWater of [false, true]) {
        payloads.push(
          JSON.stringify({
            pathCenterline: reverseRoute
              ? [...transformedRoute].reverse()
              : transformedRoute,
            waterCenterline: reverseWater
              ? [...transformedWater].reverse()
              : transformedWater,
            waterBranchCenterlines: transformedWaterBranches.map(
              (points) =>
                reverseWater ? [...points].reverse() : points,
            ),
          }),
        );
      }
    }
  }
  return payloads;
}

function normalizePoints(points) {
  return (points ?? []).map((point) => ({
    x: Number((point.x / WIDTH).toFixed(4)),
    y: Number((point.y / HEIGHT).toFixed(4)),
  }));
}

function normalizedPointTransforms() {
  return [
    ({ x, y }) => ({ x, y }),
    ({ x, y }) => ({ x: 1 - x, y }),
    ({ x, y }) => ({ x, y: 1 - y }),
    ({ x, y }) => ({ x: 1 - x, y: 1 - y }),
    ({ x, y }) => ({ x: y, y: x }),
    ({ x, y }) => ({ x: 1 - y, y: x }),
    ({ x, y }) => ({ x: y, y: 1 - x }),
    ({ x, y }) => ({ x: 1 - y, y: 1 - x }),
  ];
}

function routeOccupancyCells(points) {
  const cells = new Set();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 12),
    );
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const column = clamp(Math.floor((x / WIDTH) * 16), 0, 15);
      const row = clamp(Math.floor((y / HEIGHT) * 12), 0, 11);
      cells.add(`${column},${row}`);
    }
  }
  return [...cells].sort();
}

function maximumTransformedOccupancySimilarity(current, previous) {
  const currentPoints = current.map((cell) => {
    const [column, row] = cell.split(",").map(Number);
    return { x: (column + 0.5) / 16, y: (row + 0.5) / 12 };
  });
  const previousSet = new Set(previous);
  let maximum = 0;
  for (const transform of normalizedPointTransforms()) {
    const transformed = new Set(
      currentPoints.map((point) => {
        const value = transform(point);
        const column = clamp(Math.floor(value.x * 16), 0, 15);
        const row = clamp(Math.floor(value.y * 12), 0, 11);
        return `${column},${row}`;
      }),
    );
    const union = new Set([...transformed, ...previousSet]);
    let intersection = 0;
    for (const cell of transformed) {
      if (previousSet.has(cell)) intersection += 1;
    }
    maximum = Math.max(
      maximum,
      union.size === 0 ? 1 : intersection / union.size,
    );
  }
  return Number(maximum.toFixed(6));
}
}
