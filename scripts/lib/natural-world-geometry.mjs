// Pure geometry and seeded sampling. No filesystem, model, storage or process access.
export function ribbonPolygon(points, halfWidth, width, height) {
  return ribbonPolygonVariable(
    points,
    points.map(() => halfWidth),
    width,
    height,
  );
}

export function ribbonPolygonVariable(points, halfWidths, width, height) {
  const left = [];
  const right = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const halfWidth = halfWidths[index];
    left.push({
      x: clamp(Math.round(points[index].x + nx * halfWidth), 0, width),
      y: clamp(Math.round(points[index].y + ny * halfWidth), 0, height),
    });
    right.push({
      x: clamp(Math.round(points[index].x - nx * halfWidth), 0, width),
      y: clamp(Math.round(points[index].y - ny * halfWidth), 0, height),
    });
  }
  return [...left, ...right.reverse()];
}

export function rectanglePolygon(x, y, width, height) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function boundsPolygon(bounds) {
  return rectanglePolygon(bounds.x, bounds.y, bounds.width, bounds.height);
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointsEqual(left, right, tolerance = 1e-6) {
  return (
    Math.abs(left.x - right.x) <= tolerance &&
    Math.abs(left.y - right.y) <= tolerance
  );
}

export function polygonsOverlap(left, right) {
  if (
    left.some((point) => pointInPolygon(point, right)) ||
    right.some((point) => pointInPolygon(point, left))
  ) {
    return true;
  }
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex];
    const leftEnd = left[(leftIndex + 1) % left.length];
    for (
      let rightIndex = 0;
      rightIndex < right.length;
      rightIndex += 1
    ) {
      const rightStart = right[rightIndex];
      const rightEnd = right[(rightIndex + 1) % right.length];
      if (
        lineSegmentsIntersect(
          leftStart,
          leftEnd,
          rightStart,
          rightEnd,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export function minimumPolygonXAtY(polygons, targetY) {
  let minimumX = Number.POSITIVE_INFINITY;
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (start.y === end.y) {
        if (targetY === start.y) {
          minimumX = Math.min(
            minimumX,
            start.x,
            end.x,
          );
        }
        continue;
      }
      const minimumY = Math.min(start.y, end.y);
      const maximumY = Math.max(start.y, end.y);
      if (targetY < minimumY || targetY > maximumY) continue;
      const t =
        (targetY - start.y) / (end.y - start.y);
      const x = start.x + (end.x - start.x) * t;
      minimumX = Math.min(minimumX, x);
    }
  }
  assert(
    Number.isFinite(minimumX),
    `anonymous water has no horizontal occupancy at y=${targetY}`,
  );
  return minimumX;
}

export function boundsTouchesPolygon(bounds, polygon) {
  const rectangle = boundsPolygon(bounds);
  const rectanglePoints = [
    ...rectangle,
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
  ];
  if (rectanglePoints.some((point) => pointInPolygon(point, polygon))) {
    return true;
  }
  if (
    polygon.some(
      (point) =>
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height,
    )
  ) {
    return true;
  }
  for (let rectangleIndex = 0; rectangleIndex < rectangle.length; rectangleIndex += 1) {
    const rectangleStart = rectangle[rectangleIndex];
    const rectangleEnd = rectangle[(rectangleIndex + 1) % rectangle.length];
    for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
      const polygonStart = polygon[polygonIndex];
      const polygonEnd = polygon[(polygonIndex + 1) % polygon.length];
      if (
        lineSegmentsIntersect(
          rectangleStart,
          rectangleEnd,
          polygonStart,
          polygonEnd,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export function lineSegmentsIntersect(a, b, c, d) {
  const orientation = (p, q, r) =>
    Math.sign(
      (q.y - p.y) * (r.x - q.x) -
        (q.x - p.x) * (r.y - q.y),
    );
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first !== second && third !== fourth;
}

export function boundsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function expandBounds(bounds, amount) {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

export function jitter(base, amount, random) {
  return Math.round(base + (random() * 2 - 1) * amount);
}

export function randomInt(minimum, maximum, random) {
  return Math.floor(minimum + random() * (maximum - minimum + 1));
}

export function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function buildVariableWidthCorridorPolygons(
  points,
  halfWidths,
  width,
  height,
) {
  corridorAssert(
    points.length >= 2 && halfWidths.length === points.length,
    "variable-width corridor inputs are invalid",
  );
  const polygons = points.map((point, index) =>
    circlePolygon(
      point,
      halfWidths[index],
      20,
      width,
      height,
    ),
  );
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const startWidth = halfWidths[index];
    const endWidth = halfWidths[index + 1];
    const corridorPolygon = convexHull([
      {
        x: corridorClamp(Math.round(start.x + nx * startWidth), 0, width),
        y: corridorClamp(Math.round(start.y + ny * startWidth), 0, height),
      },
      {
        x: corridorClamp(Math.round(end.x + nx * endWidth), 0, width),
        y: corridorClamp(Math.round(end.y + ny * endWidth), 0, height),
      },
      {
        x: corridorClamp(Math.round(end.x - nx * endWidth), 0, width),
        y: corridorClamp(Math.round(end.y - ny * endWidth), 0, height),
      },
      {
        x: corridorClamp(Math.round(start.x - nx * startWidth), 0, width),
        y: corridorClamp(Math.round(start.y - ny * startWidth), 0, height),
      },
    ]);
    if (corridorPolygon.length >= 3) {
      polygons.push(corridorPolygon);
    }
  }
  return polygons;
}

function circlePolygon(center, radius, sides, width, height) {
  return convexHull(
    Array.from({ length: sides }, (_, index) => {
      const angle = (Math.PI * 2 * index) / sides;
      return {
        x: corridorClamp(
          Math.round(center.x + Math.cos(angle) * radius),
          0,
          width,
        ),
        y: corridorClamp(
          Math.round(center.y + Math.sin(angle) * radius),
          0,
          height,
        ),
      };
    }),
  );
}

function convexHull(points) {
  const unique = [
    ...new Map(
      points.map((point) => [`${point.x},${point.y}`, point]),
    ).values(),
  ].sort((left, right) => left.x - right.x || left.y - right.y);
  if (unique.length <= 2) return unique;
  const cross = (origin, left, right) =>
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x);
  const lower = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower.at(-2), lower.at(-1), point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper = [];
  for (const point of [...unique].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper.at(-2), upper.at(-1), point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

const corridorClamp = clamp;
const corridorAssert = (ok, message) => { if (!ok) throw new Error(message); };
function assert(condition, message) { if (!condition) throw new Error(message); }
