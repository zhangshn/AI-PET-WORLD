// The existing compiler's native pixel-center rule, shared without changing
// sampling semantics. Callers validate the task or proposal before allocating.
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function rasterizePolygons(records, canvasWidth, canvasHeight) {
  const pixels = Buffer.alloc(canvasWidth * canvasHeight);
  for (const record of records) fillPolygon(pixels, record.polygon ?? [], canvasWidth, canvasHeight, 255);
  return pixels;
}
export function rasterizeFootprints(records, canvasWidth, canvasHeight) {
  const pixels = Buffer.alloc(canvasWidth * canvasHeight);
  for (const record of records) fillBounds(pixels, record.footprint, canvasWidth, canvasHeight, 255);
  return pixels;
}
function fillPolygon(pixels, polygon, canvasWidth, canvasHeight, value) {
  if (!Array.isArray(polygon) || polygon.length < 3) return;
  const minX = clamp(Math.floor(Math.min(...polygon.map(point => point.x))), 0, canvasWidth - 1);
  const maxX = clamp(Math.ceil(Math.max(...polygon.map(point => point.x))), 0, canvasWidth - 1);
  const minY = clamp(Math.floor(Math.min(...polygon.map(point => point.y))), 0, canvasHeight - 1);
  const maxY = clamp(Math.ceil(Math.max(...polygon.map(point => point.y))), 0, canvasHeight - 1);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (pointInPolygon(x + 0.5, y + 0.5, polygon)) pixels[y * canvasWidth + x] = value;
  }
}
export function fillBounds(pixels, bounds, canvasWidth, canvasHeight, value) {
  if (!bounds) return;
  const left = clamp(Math.floor(bounds.x), 0, canvasWidth), top = clamp(Math.floor(bounds.y), 0, canvasHeight);
  const right = clamp(Math.ceil(bounds.x + bounds.width), 0, canvasWidth);
  const bottom = clamp(Math.ceil(bounds.y + bounds.height), 0, canvasHeight);
  for (let y = top; y < bottom; y++) pixels.fill(value, y * canvasWidth + left, y * canvasWidth + right);
}
function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current++) {
    const a = polygon[current], b = polygon[previous];
    const intersects = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
