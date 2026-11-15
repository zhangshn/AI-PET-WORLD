import sharp from "sharp"
import type { GameMapVisualUnitSlot } from "./game-map-composite-schema"

export type GameMapRuntimeCompositorAuditItem = {
  slotId: string
  unitKind: GameMapVisualUnitSlot["unitKind"]
  bindingId: string
  approvedAssetId: string
  left: number
  top: number
  width: number
  height: number
  sourceImageWidth: number
  sourceImageHeight: number
  sourceImageUrl: string
  sourceImageSha256: string
  sourceHasAlpha: boolean
}

export type GameMapRuntimeCompositorQualityMetrics = {
  averageVerticalSeamDelta: number
  averageHorizontalSeamDelta: number
  maxVerticalGridSeamDelta: number
  maxHorizontalGridSeamDelta: number
  maxVerticalGridSeamRatio: number
  maxHorizontalGridSeamRatio: number
  visibleGridArtifactSuspected: boolean
  minHorizontalTextureRepeatDelta: number
  minVerticalTextureRepeatDelta: number
  repetitiveTextureArtifactSuspected: boolean
  denseTextureArtifactSuspected: boolean
  maxTerrainPatchVerticalDelta: number
  maxTerrainPatchHorizontalDelta: number
  maxTerrainPatchVerticalRatio: number
  maxTerrainPatchHorizontalRatio: number
  terrainPatchArtifactSuspected: boolean
  patchBandArtifactSuspected: boolean
  objectMaterialAlphaMissingCount: number
  objectMaterialAlphaMissingSuspected: boolean
  gridArtifactSuspected: boolean
}

function parseTerrainPatchSlotId(
  slotId: string
): { groupId: string; row: number; column: number } | null {
  const match = /^(.*)-patch-(\d+)-(\d+)$/.exec(slotId)
  if (!match) return null
  return {
    groupId: match[1] ?? "",
    row: Number(match[2]),
    column: Number(match[3]),
  }
}

async function measureCompositeOutputQuality(
  outputBytes: Buffer,
  auditItems: GameMapRuntimeCompositorAuditItem[] = []
): Promise<GameMapRuntimeCompositorQualityMetrics> {
  const raw = await sharp(outputBytes, { failOn: "error" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = raw.info.width
  const height = raw.info.height
  const channels = raw.info.channels
  const data = raw.data

  const verticalDeltas: number[] = []
  for (let x = 1; x < width; x += 1) {
    verticalDeltas.push(measureVerticalSeamDelta(data, width, height, channels, x))
  }
  const horizontalDeltas: number[] = []
  for (let y = 1; y < height; y += 1) {
    horizontalDeltas.push(measureHorizontalSeamDelta(data, width, height, channels, y))
  }

  const averageVerticalSeamDelta = average(verticalDeltas)
  const averageHorizontalSeamDelta = average(horizontalDeltas)
  const maxVerticalGridSeamDelta = max(
    gridLines(width).map((x) => measureVerticalSeamDelta(data, width, height, channels, x))
  )
  const maxHorizontalGridSeamDelta = max(
    gridLines(height).map((y) => measureHorizontalSeamDelta(data, width, height, channels, y))
  )
  const maxVerticalGridSeamRatio = ratio(
    maxVerticalGridSeamDelta,
    averageVerticalSeamDelta
  )
  const maxHorizontalGridSeamRatio = ratio(
    maxHorizontalGridSeamDelta,
    averageHorizontalSeamDelta
  )
  const repetitiveTextureMetrics = measureRepetitiveTextureMetrics(
    data,
    width,
    height,
    channels
  )
  const terrainPatchBoundaries = terrainPatchBoundaryLines(auditItems, width, height)
  const maxTerrainPatchVerticalDelta = max(
    terrainPatchBoundaries.vertical.map((x) =>
      measureVerticalSeamDelta(data, width, height, channels, x)
    )
  )
  const maxTerrainPatchHorizontalDelta = max(
    terrainPatchBoundaries.horizontal.map((y) =>
      measureHorizontalSeamDelta(data, width, height, channels, y)
    )
  )
  const maxTerrainPatchVerticalRatio = ratio(
    maxTerrainPatchVerticalDelta,
    averageVerticalSeamDelta
  )
  const maxTerrainPatchHorizontalRatio = ratio(
    maxTerrainPatchHorizontalDelta,
    averageHorizontalSeamDelta
  )
  const terrainPatchArtifactSuspected =
    (maxTerrainPatchVerticalDelta >= 0.06 && maxTerrainPatchVerticalRatio >= 1.25) ||
    (maxTerrainPatchHorizontalDelta >= 0.06 && maxTerrainPatchHorizontalRatio >= 1.25)
  const patchBandArtifactSuspected =
    (maxTerrainPatchVerticalDelta >= 0.035 && maxTerrainPatchVerticalRatio >= 1.1) ||
    (maxTerrainPatchHorizontalDelta >= 0.045 && maxTerrainPatchHorizontalRatio >= 1.2) ||
    (maxHorizontalGridSeamDelta >= 0.06 && maxHorizontalGridSeamRatio >= 1.55)
  const objectMaterialAlphaMissingCount = auditItems.filter(
    (item) => isObjectVisualUnitKind(item.unitKind) && !item.sourceHasAlpha
  ).length
  const objectMaterialAlphaMissingSuspected = objectMaterialAlphaMissingCount > 0
  const visibleGridArtifactSuspected =
    maxVerticalGridSeamDelta >= 0.08 &&
    maxVerticalGridSeamRatio >= 1.65 &&
    maxHorizontalGridSeamDelta >= 0.055 &&
    maxHorizontalGridSeamRatio >= 1.35
  const repetitiveTextureArtifactSuspected =
    repetitiveTextureMetrics.minHorizontalTextureRepeatDelta < 0.012 ||
    repetitiveTextureMetrics.minVerticalTextureRepeatDelta < 0.012
  const denseTextureArtifactSuspected =
    averageVerticalSeamDelta >= 0.055 && averageHorizontalSeamDelta >= 0.045
  const gridArtifactSuspected =
    (maxVerticalGridSeamDelta >= 0.075 && maxVerticalGridSeamRatio >= 2.35) ||
    (maxHorizontalGridSeamDelta >= 0.075 && maxHorizontalGridSeamRatio >= 2.35) ||
    visibleGridArtifactSuspected ||
    terrainPatchArtifactSuspected ||
    patchBandArtifactSuspected ||
    repetitiveTextureArtifactSuspected ||
    denseTextureArtifactSuspected ||
    objectMaterialAlphaMissingSuspected

  return {
    averageVerticalSeamDelta: roundMetric(averageVerticalSeamDelta),
    averageHorizontalSeamDelta: roundMetric(averageHorizontalSeamDelta),
    maxVerticalGridSeamDelta: roundMetric(maxVerticalGridSeamDelta),
    maxHorizontalGridSeamDelta: roundMetric(maxHorizontalGridSeamDelta),
    maxVerticalGridSeamRatio: roundMetric(maxVerticalGridSeamRatio),
    maxHorizontalGridSeamRatio: roundMetric(maxHorizontalGridSeamRatio),
    visibleGridArtifactSuspected,
    minHorizontalTextureRepeatDelta: roundMetric(
      repetitiveTextureMetrics.minHorizontalTextureRepeatDelta
    ),
    minVerticalTextureRepeatDelta: roundMetric(
      repetitiveTextureMetrics.minVerticalTextureRepeatDelta
    ),
    repetitiveTextureArtifactSuspected,
    denseTextureArtifactSuspected,
    maxTerrainPatchVerticalDelta: roundMetric(maxTerrainPatchVerticalDelta),
    maxTerrainPatchHorizontalDelta: roundMetric(maxTerrainPatchHorizontalDelta),
    maxTerrainPatchVerticalRatio: roundMetric(maxTerrainPatchVerticalRatio),
    maxTerrainPatchHorizontalRatio: roundMetric(maxTerrainPatchHorizontalRatio),
    terrainPatchArtifactSuspected,
    patchBandArtifactSuspected,
    objectMaterialAlphaMissingCount,
    objectMaterialAlphaMissingSuspected,
    gridArtifactSuspected,
  }
}

async function repairCompositeSeams(
  outputBytes: Buffer,
  auditItems: GameMapRuntimeCompositorAuditItem[]
): Promise<Buffer> {
  const raw = await sharp(outputBytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = raw.info.width
  const height = raw.info.height
  const channels = raw.info.channels
  const data = Buffer.from(raw.data)
  const boundaries = terrainPatchBoundaryLines(auditItems, width, height)

  for (const x of boundaries.vertical) {
    softenVerticalSeam(data, width, height, channels, x, 5)
  }
  for (const y of boundaries.horizontal) {
    softenHorizontalSeam(data, width, height, channels, y, 5)
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer()
}

function softenVerticalSeam(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  radius: number
): void {
  const leftReference = Math.max(0, x - radius * 3)
  const rightReference = Math.min(width - 1, x + radius * 3)
  if (leftReference >= x || rightReference <= x) return
  for (let y = 0; y < height; y += 1) {
    const left = pixelAt(data, width, channels, leftReference, y)
    const right = pixelAt(data, width, channels, rightReference, y)
    for (let column = Math.max(0, x - radius); column <= Math.min(width - 1, x + radius); column += 1) {
      const strength = 0.62 * (1 - Math.abs(column - x) / Math.max(1, radius + 1))
      blendPixel(data, width, channels, column, y, left, right, strength)
    }
  }
}

function softenHorizontalSeam(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  y: number,
  radius: number
): void {
  const topReference = Math.max(0, y - radius * 3)
  const bottomReference = Math.min(height - 1, y + radius * 3)
  if (topReference >= y || bottomReference <= y) return
  for (let x = 0; x < width; x += 1) {
    const top = pixelAt(data, width, channels, x, topReference)
    const bottom = pixelAt(data, width, channels, x, bottomReference)
    for (let row = Math.max(0, y - radius); row <= Math.min(height - 1, y + radius); row += 1) {
      const strength = 0.62 * (1 - Math.abs(row - y) / Math.max(1, radius + 1))
      blendPixel(data, width, channels, x, row, top, bottom, strength)
    }
  }
}

function pixelAt(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
): number[] {
  const offset = (y * width + x) * channels
  return [
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 255,
  ]
}

function blendPixel(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number,
  first: number[],
  second: number[],
  strength: number
): void {
  const offset = (y * width + x) * channels
  const target = [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
    (first[2] + second[2]) / 2,
    Math.max(first[3], second[3]),
  ]
  for (let channel = 0; channel < Math.min(channels, 4); channel += 1) {
    const current = data[offset + channel] ?? 0
    data[offset + channel] = Math.round(current * (1 - strength) + target[channel] * strength)
  }
}

function isObjectVisualUnitKind(unitKind: GameMapVisualUnitSlot["unitKind"]): boolean {
  return unitKind.endsWith("_visual_unit")
}

function measureRepetitiveTextureMetrics(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): {
  minHorizontalTextureRepeatDelta: number
  minVerticalTextureRepeatDelta: number
} {
  const shifts = [8, 12, 16, 24, 32, 48, 64].filter(
    (shift) => shift < width / 2 && shift < height / 2
  )
  if (shifts.length === 0) {
    return {
      minHorizontalTextureRepeatDelta: 1,
      minVerticalTextureRepeatDelta: 1,
    }
  }

  return {
    minHorizontalTextureRepeatDelta: Math.min(
      ...shifts.map((shift) =>
        measureTextureRepeatDelta(data, width, height, channels, shift, 0)
      )
    ),
    minVerticalTextureRepeatDelta: Math.min(
      ...shifts.map((shift) =>
        measureTextureRepeatDelta(data, width, height, channels, 0, shift)
      )
    ),
  }
}

function measureTextureRepeatDelta(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  shiftX: number,
  shiftY: number
): number {
  let total = 0
  let count = 0
  const step = 4
  for (let y = 0; y < height - shiftY; y += step) {
    for (let x = 0; x < width - shiftX; x += step) {
      total += Math.abs(
        luminanceAt(data, width, channels, x, y) -
          luminanceAt(data, width, channels, x + shiftX, y + shiftY)
      )
      count += 1
    }
  }
  return count === 0 ? 1 : total / count
}

function terrainPatchBoundaryLines(
  auditItems: GameMapRuntimeCompositorAuditItem[],
  width: number,
  height: number
): { vertical: number[]; horizontal: number[] } {
  const vertical = new Set<number>()
  const horizontal = new Set<number>()

  for (const item of auditItems) {
    const patch = parseTerrainPatchSlotId(item.slotId)
    if (!patch) continue
    if (patch.column > 0) {
      addBoundaryLine(vertical, item.left, width)
      addBoundaryLine(vertical, item.left + 32, width)
    }
    if (patch.row > 0) {
      addBoundaryLine(horizontal, item.top, height)
      addBoundaryLine(horizontal, item.top + 32, height)
    }
  }

  return {
    vertical: [...vertical],
    horizontal: [...horizontal],
  }
}

function addBoundaryLine(lines: Set<number>, value: number, limit: number): void {
  const rounded = Math.round(value)
  if (rounded > 0 && rounded < limit) {
    lines.add(rounded)
  }
}

function measureVerticalSeamDelta(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number
): number {
  let total = 0
  for (let y = 0; y < height; y += 1) {
    total += Math.abs(
      luminanceAt(data, width, channels, x, y) -
        luminanceAt(data, width, channels, x - 1, y)
    )
  }
  return total / height
}

function measureHorizontalSeamDelta(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  y: number
): number {
  let total = 0
  for (let x = 0; x < width; x += 1) {
    total += Math.abs(
      luminanceAt(data, width, channels, x, y) -
        luminanceAt(data, width, channels, x, y - 1)
    )
  }
  return total / width
}

function luminanceAt(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
): number {
  const offset = (y * width + x) * channels
  const red = data[offset] ?? 0
  const green = data[offset + 1] ?? 0
  const blue = data[offset + 2] ?? 0
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

function gridLines(size: number): number[] {
  const lines: number[] = []
  for (let value = 64; value < size; value += 64) {
    lines.push(value)
  }
  return lines
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function max(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values)
}

function ratio(value: number, baseline: number): number {
  return baseline <= 0 ? 0 : value / baseline
}

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000
}

export { measureCompositeOutputQuality, repairCompositeSeams, parseTerrainPatchSlotId }
