import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const BLOCK_SIZE = 16
const CORNER_SIZE = 48
const MAXIMUM_MATTE_LOCAL_STD_DEV = 7
const MAXIMUM_CORNER_COLOR_DISTANCE = 34
const MAXIMUM_EXTERNAL_MATTE_RATIO = 0.015
const MINIMUM_FLOATING_CUTOUT_MATTE_RATIO = 0.03

export async function auditCompleteMapWorldFrameIntegrity({ record, imagePath }) {
  const absolutePath = resolveProjectPath(imagePath)
  const bytes = fs.readFileSync(absolutePath)
  const metadata = await sharp(bytes, { failOn: "error" }).metadata()
  const rgba = await sharp(bytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = rgba.info
  const pixels = rgba.data
  const cornerStats = [
    blockStats(pixels, width, height, channels, 0, 0, CORNER_SIZE, CORNER_SIZE),
    blockStats(pixels, width, height, channels, width - CORNER_SIZE, 0, CORNER_SIZE, CORNER_SIZE),
    blockStats(pixels, width, height, channels, 0, height - CORNER_SIZE, CORNER_SIZE, CORNER_SIZE),
    blockStats(pixels, width, height, channels, width - CORNER_SIZE, height - CORNER_SIZE, CORNER_SIZE, CORNER_SIZE),
  ]
  const dominantCornerCluster = selectDominantSmoothCornerCluster(cornerStats)
  const blockAnalysis = dominantCornerCluster
    ? analyzeBorderConnectedMatte({
        pixels,
        width,
        height,
        channels,
        referenceColor: dominantCornerCluster.mean,
      })
    : emptyBlockAnalysis(width, height)
  const transparentPixelCount = countTransparentPixels(pixels, channels)
  const transparentPixelRatio = transparentPixelCount / Math.max(1, width * height)
  const issues = []

  if (transparentPixelCount > 0) {
    issues.push(issue(
      "complete_map_transparent_world_void",
      "The complete map contains transparent pixels that do not resolve to an in-world surface or object.",
      "完整地图包含不属于世界地表或世界对象的透明像素。",
      "full_frame",
    ))
  }
  if (
    dominantCornerCluster?.cornerCount >= 3 &&
    blockAnalysis.borderConnectedMatteRatio > MAXIMUM_EXTERNAL_MATTE_RATIO
  ) {
    issues.push(issue(
      "complete_map_external_solid_backdrop_detected",
      "A low-texture solid-color backdrop is connected across the outside edges of the frame.",
      "画面边缘检测到大面积连通的低纹理纯色外部背景。",
      "full_frame",
    ))
  }
  if (
    dominantCornerCluster?.cornerCount >= 3 &&
    blockAnalysis.borderConnectedMatteRatio > MINIMUM_FLOATING_CUTOUT_MATTE_RATIO &&
    blockAnalysis.borderSideCoverageCount >= 3
  ) {
    issues.push(issue(
      "complete_map_floating_island_or_cutout_detected",
      "The playable region appears as an irregular floating map or cutout surrounded by a backdrop.",
      "可玩区域呈现为被背景包围的不规则悬浮地图或裁切图。",
      "full_frame_boundary",
    ))
  }

  return {
    schemaVersion: "complete-map-world-frame-integrity-audit-v2",
    contractVersion:
      "complete-rectangular-world-and-future-dynamic-readiness-v2",
    status: issues.length === 0
      ? "full_rectangular_world_frame_passed"
      : "full_rectangular_world_frame_failed",
    passed: issues.length === 0,
    imagePath: projectPath(absolutePath),
    image: {
      width,
      height,
      sourceHasAlpha: metadata.hasAlpha === true,
      transparentPixelCount,
      transparentPixelRatio: round(transparentPixelRatio),
    },
    thresholds: {
      blockSizePixels: BLOCK_SIZE,
      cornerSizePixels: CORNER_SIZE,
      maximumMatteLocalStdDev: MAXIMUM_MATTE_LOCAL_STD_DEV,
      maximumCornerColorDistance: MAXIMUM_CORNER_COLOR_DISTANCE,
      maximumExternalMatteRatio: MAXIMUM_EXTERNAL_MATTE_RATIO,
      minimumFloatingCutoutMatteRatio: MINIMUM_FLOATING_CUTOUT_MATTE_RATIO,
    },
    cornerStats: cornerStats.map(compactStats),
    dominantSmoothCornerCluster: dominantCornerCluster
      ? {
          cornerCount: dominantCornerCluster.cornerCount,
          cornerIndexes: dominantCornerCluster.cornerIndexes,
          mean: roundColor(dominantCornerCluster.mean),
        }
      : null,
    borderConnectedMatte: blockAnalysis,
    worldSurfaceCoverageRatio: round(1 - blockAnalysis.borderConnectedMatteRatio - transparentPixelRatio),
    contractEvidence: {
      recordWorldFrameContractVersion:
        record?.conditionBinding?.worldFrameContractVersion ??
        record?.worldFrameContract?.contractVersion ??
        null,
      everyPixelMustBeWorldAddressable: true,
      externalBackdropAllowed: false,
      floatingMapOrIslandCutoutAllowed: false,
      currentMilestone: "static_rgb",
      futureRuntimeMotionReserved: true,
    },
    issues,
  }
}

function analyzeBorderConnectedMatte({ pixels, width, height, channels, referenceColor }) {
  const columns = Math.ceil(width / BLOCK_SIZE)
  const rows = Math.ceil(height / BLOCK_SIZE)
  const candidates = new Uint8Array(columns * rows)
  const visited = new Uint8Array(columns * rows)
  const stats = new Array(columns * rows)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      const value = blockStats(
        pixels,
        width,
        height,
        channels,
        column * BLOCK_SIZE,
        row * BLOCK_SIZE,
        Math.min(BLOCK_SIZE, width - column * BLOCK_SIZE),
        Math.min(BLOCK_SIZE, height - row * BLOCK_SIZE),
      )
      stats[index] = value
      const distance = colorDistance(value.mean, referenceColor)
      if (
        value.maximumChannelStdDev <= MAXIMUM_MATTE_LOCAL_STD_DEV &&
        value.luminanceStdDev <= MAXIMUM_MATTE_LOCAL_STD_DEV &&
        distance <= MAXIMUM_CORNER_COLOR_DISTANCE
      ) {
        candidates[index] = 1
      }
    }
  }

  const queue = new Int32Array(columns * rows)
  let head = 0
  let tail = 0
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (row !== 0 && row !== rows - 1 && column !== 0 && column !== columns - 1) continue
      const index = row * columns + column
      if (!candidates[index] || visited[index]) continue
      visited[index] = 1
      queue[tail++] = index
    }
  }
  while (head < tail) {
    const index = queue[head++]
    const column = index % columns
    const row = Math.floor(index / columns)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextColumn = column + dx
      const nextRow = row + dy
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue
      const next = nextRow * columns + nextColumn
      if (!candidates[next] || visited[next]) continue
      visited[next] = 1
      queue[tail++] = next
    }
  }

  let pixelCount = 0
  const sideHits = new Set()
  for (let index = 0; index < visited.length; index += 1) {
    if (!visited[index]) continue
    const column = index % columns
    const row = Math.floor(index / columns)
    const blockWidth = Math.min(BLOCK_SIZE, width - column * BLOCK_SIZE)
    const blockHeight = Math.min(BLOCK_SIZE, height - row * BLOCK_SIZE)
    pixelCount += blockWidth * blockHeight
    if (row === 0) sideHits.add("north")
    if (row === rows - 1) sideHits.add("south")
    if (column === 0) sideHits.add("west")
    if (column === columns - 1) sideHits.add("east")
  }
  return {
    blockColumns: columns,
    blockRows: rows,
    candidateBlockCount: candidates.reduce((sum, value) => sum + value, 0),
    borderConnectedBlockCount: visited.reduce((sum, value) => sum + value, 0),
    borderConnectedPixelCount: pixelCount,
    borderConnectedMatteRatio: round(pixelCount / Math.max(1, width * height)),
    borderSideCoverageCount: sideHits.size,
    borderSides: [...sideHits].sort(),
  }
}

function selectDominantSmoothCornerCluster(corners) {
  let selected = null
  for (let anchorIndex = 0; anchorIndex < corners.length; anchorIndex += 1) {
    const anchor = corners[anchorIndex]
    if (anchor.maximumChannelStdDev > MAXIMUM_MATTE_LOCAL_STD_DEV || anchor.luminanceStdDev > MAXIMUM_MATTE_LOCAL_STD_DEV) continue
    const indexes = []
    for (let index = 0; index < corners.length; index += 1) {
      const candidate = corners[index]
      if (
        candidate.maximumChannelStdDev <= MAXIMUM_MATTE_LOCAL_STD_DEV &&
        candidate.luminanceStdDev <= MAXIMUM_MATTE_LOCAL_STD_DEV &&
        colorDistance(anchor.mean, candidate.mean) <= MAXIMUM_CORNER_COLOR_DISTANCE
      ) {
        indexes.push(index)
      }
    }
    if (!selected || indexes.length > selected.cornerCount) {
      selected = {
        cornerCount: indexes.length,
        cornerIndexes: indexes,
        mean: meanColor(indexes.map((index) => corners[index].mean)),
      }
    }
  }
  return selected?.cornerCount >= 2 ? selected : null
}

function blockStats(pixels, imageWidth, imageHeight, channels, startX, startY, blockWidth, blockHeight) {
  const sums = [0, 0, 0]
  const squareSums = [0, 0, 0]
  let luminanceSum = 0
  let luminanceSquareSum = 0
  let count = 0
  const endX = Math.min(imageWidth, startX + blockWidth)
  const endY = Math.min(imageHeight, startY + blockHeight)
  for (let y = Math.max(0, startY); y < endY; y += 1) {
    for (let x = Math.max(0, startX); x < endX; x += 1) {
      const offset = (y * imageWidth + x) * channels
      const red = pixels[offset]
      const green = pixels[offset + 1]
      const blue = pixels[offset + 2]
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
      for (const [index, value] of [red, green, blue].entries()) {
        sums[index] += value
        squareSums[index] += value * value
      }
      luminanceSum += luminance
      luminanceSquareSum += luminance * luminance
      count += 1
    }
  }
  const mean = sums.map((value) => value / Math.max(1, count))
  const channelStdDev = squareSums.map((value, index) =>
    Math.sqrt(Math.max(0, value / Math.max(1, count) - mean[index] * mean[index])),
  )
  const luminanceMean = luminanceSum / Math.max(1, count)
  const luminanceStdDev = Math.sqrt(Math.max(0, luminanceSquareSum / Math.max(1, count) - luminanceMean * luminanceMean))
  return {
    mean,
    channelStdDev,
    maximumChannelStdDev: Math.max(...channelStdDev),
    luminanceStdDev,
  }
}

function countTransparentPixels(pixels, channels) {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += channels) {
    if (pixels[offset] < 255) count += 1
  }
  return count
}

function emptyBlockAnalysis(width, height) {
  return {
    blockColumns: Math.ceil(width / BLOCK_SIZE),
    blockRows: Math.ceil(height / BLOCK_SIZE),
    candidateBlockCount: 0,
    borderConnectedBlockCount: 0,
    borderConnectedPixelCount: 0,
    borderConnectedMatteRatio: 0,
    borderSideCoverageCount: 0,
    borderSides: [],
  }
}

function compactStats(value) {
  return {
    mean: roundColor(value.mean),
    channelStdDev: value.channelStdDev.map(round),
    maximumChannelStdDev: round(value.maximumChannelStdDev),
    luminanceStdDev: round(value.luminanceStdDev),
  }
}

function meanColor(colors) {
  return [0, 1, 2].map((channel) =>
    colors.reduce((sum, color) => sum + color[channel], 0) / Math.max(1, colors.length),
  )
}

function colorDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function issue(code, message, messageZh, affectedRegion) {
  return {
    code,
    message,
    messageZh,
    affectedRegion,
    nextTrainingTarget:
      "render_full_rectangular_in_world_surface_without_backdrop_or_cutout",
  }
}

function round(value) {
  return Math.round(value * 10000) / 10000
}

function roundColor(color) {
  return color.map(round)
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (!(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`))) {
    throw new Error(`path escapes project: ${value}`)
  }
  return resolved
}
