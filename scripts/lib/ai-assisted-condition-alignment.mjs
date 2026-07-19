import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const GRID_COLUMNS = 8
const GRID_ROWS = 6

export async function auditAiAssistedConditionAlignment({ record, imagePath }) {
  if (!record.conditionBinding?.conditionPackPath) {
    return {
      schemaVersion: "ai-assisted-condition-alignment-audit-v1",
      status: "not_applicable_no_condition_binding",
      passed: false,
      formalConditionalTrainingEligible: false,
      issues: [issue("condition_pack_binding_missing", "The candidate has no 23-channel condition-pack binding.", "候选图没有绑定23通道条件包。", "record_contract")],
    }
  }

  const conditionPackPath = resolveProjectPath(record.conditionBinding.conditionPackPath)
  assert(fs.existsSync(conditionPackPath), "condition pack is missing")
  const conditionPackBytes = fs.readFileSync(conditionPackPath)
  const conditionPack = JSON.parse(conditionPackBytes.toString("utf8"))
  assert(conditionPack.channels?.length === 23, "condition pack must contain 23 channels")
  assert(conditionPack.worldId === record.conditionBinding.worldId, "condition pack worldId mismatch")
  assert(conditionPack.tick === record.conditionBinding.tick, "condition pack tick mismatch")

  const image = await sharp(imagePath, { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert(image.info.width === conditionPack.canvas.width && image.info.height === conditionPack.canvas.height, "candidate and condition-pack canvas mismatch")
  const pathClassifier = selectPathClassifier(record)

  const audits = []
  audits.push(await auditChannel({
    conditionPack,
    image,
    channelId: "terrain_water",
    classify: classifyWater,
    minimumSpatialIntersection: 0.5,
    maximumCentroidDistance: 0.12,
    minimumCoverageRatio: 0.35,
    maximumCoverageRatio: 2.5,
    maximumAbsentSignalRatio: 0.005,
  }))
  audits.push(await auditChannel({
    conditionPack,
    image,
    channelId: "terrain_path_ground",
    classify: pathClassifier.classify,
    minimumSpatialIntersection: 0.25,
    maximumCentroidDistance: 0.25,
    minimumCoverageRatio: 0.25,
    maximumCoverageRatio: 3.0,
  }))

  const issues = audits.flatMap((audit) => audit.issues)
  return {
    schemaVersion: "ai-assisted-condition-alignment-audit-v1",
    status: issues.length === 0 ? "condition_alignment_passed" : "condition_alignment_failed",
    passed: issues.length === 0,
    formalConditionalTrainingEligible: false,
    conditionPackId: conditionPack.conditionPackId,
    conditionPackPath: projectPath(conditionPackPath),
    conditionPackFileSha256: sha256(conditionPackBytes),
    canvas: conditionPack.canvas,
    method: "season_aware_local_color_signal_plus_8x6_spatial_mass_and_centroid_v2",
    pathClassifier: {
      mode: pathClassifier.mode,
      season: record.classification?.monsoonSeason ?? null,
      source: "record.classification.monsoonSeason",
      acceptanceThresholdsChanged: false,
    },
    channelAudits: audits,
    issues,
  }
}

async function auditChannel({ conditionPack, image, channelId, classify, minimumSpatialIntersection, maximumCentroidDistance, minimumCoverageRatio, maximumCoverageRatio, maximumAbsentSignalRatio = 0 }) {
  const channel = conditionPack.channels.find((item) => item.id === channelId)
  assert(channel, `required condition channel missing: ${channelId}`)
  const channelPath = resolveProjectPath(channel.path)
  const expectedImage = await sharp(channelPath, { failOn: "error" }).raw().toBuffer({ resolveWithObject: true })
  const expected = new Uint8Array(image.info.width * image.info.height)
  const actual = new Uint8Array(expected.length)
  for (let index = 0; index < expected.length; index += 1) {
    expected[index] = expectedImage.data[index * expectedImage.info.channels] > 0 ? 1 : 0
    const offset = index * image.info.channels
    actual[index] = classify(image.data[offset], image.data[offset + 1], image.data[offset + 2]) ? 1 : 0
  }

  const expectedDistribution = spatialDistribution(expected, image.info.width, image.info.height)
  const actualDistribution = spatialDistribution(actual, image.info.width, image.info.height)
  const absenceExpected = expectedDistribution.nonZeroRatio === 0
  const spatialIntersection = expectedDistribution.cells.reduce((sum, value, index) => sum + Math.min(value, actualDistribution.cells[index]), 0)
  const centroidDistance = Math.hypot(
    expectedDistribution.centroid.x - actualDistribution.centroid.x,
    expectedDistribution.centroid.y - actualDistribution.centroid.y,
  )
  const coverageRatio = actualDistribution.nonZeroRatio / Math.max(expectedDistribution.nonZeroRatio, 1e-9)
  const issues = []
  if (absenceExpected && actualDistribution.nonZeroRatio > maximumAbsentSignalRatio) {
    issues.push(issue(
      `condition_${channelId}_unexpected_signal`,
      `${channelId} visual signal is present although the selected condition channel is empty.`,
      `${channelId} visual signal exceeds the allowed noise floor for an empty condition channel.`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  if (!absenceExpected && spatialIntersection < minimumSpatialIntersection) {
    issues.push(issue(
      `condition_${channelId}_spatial_distribution_mismatch`,
      `${channelId} visual distribution does not match the selected condition channel.`,
      `${channelId} 的视觉空间分布与所选条件通道不一致。`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  if (!absenceExpected && centroidDistance > maximumCentroidDistance) {
    issues.push(issue(
      `condition_${channelId}_centroid_drift`,
      `${channelId} visual centroid is too far from the selected condition channel.`,
      `${channelId} 的视觉中心与所选条件通道偏离过大。`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  if (!absenceExpected && (coverageRatio < minimumCoverageRatio || coverageRatio > maximumCoverageRatio)) {
    issues.push(issue(
      `condition_${channelId}_coverage_mismatch`,
      `${channelId} visual coverage is outside the selected condition range.`,
      `${channelId} 的视觉覆盖量超出所选条件范围。`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }

  return {
    channelId,
    expectedChannelPath: projectPath(channelPath),
    expectedChannelSha256: channel.sha256,
    expectedNonZeroRatio: round(expectedDistribution.nonZeroRatio),
    actualSignalRatio: round(actualDistribution.nonZeroRatio),
    absenceExpected,
    coverageRatio: absenceExpected ? null : round(coverageRatio),
    spatialIntersection: absenceExpected ? null : round(spatialIntersection),
    centroidDistance: absenceExpected ? null : round(centroidDistance),
    expectedCentroid: roundPoint(expectedDistribution.centroid),
    actualCentroid: roundPoint(actualDistribution.centroid),
    thresholds: { minimumSpatialIntersection, maximumCentroidDistance, minimumCoverageRatio, maximumCoverageRatio, maximumAbsentSignalRatio },
    passed: issues.length === 0,
    issues,
  }
}

function spatialDistribution(mask, width, height) {
  const cells = new Array(GRID_COLUMNS * GRID_ROWS).fill(0)
  let total = 0
  let xSum = 0
  let ySum = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      const column = Math.min(GRID_COLUMNS - 1, Math.floor(x / width * GRID_COLUMNS))
      const row = Math.min(GRID_ROWS - 1, Math.floor(y / height * GRID_ROWS))
      cells[row * GRID_COLUMNS + column] += 1
      total += 1
      xSum += x
      ySum += y
    }
  }
  return {
    cells: cells.map((value) => value / Math.max(total, 1)),
    nonZeroRatio: total / (width * height),
    centroid: { x: xSum / Math.max(total, 1) / width, y: ySum / Math.max(total, 1) / height },
  }
}

function classifyWater(red, green, blue) {
  return blue > red * 1.12 && green > red * 1.08 && blue > green * 0.72 && blue >= 55
}

function classifyWetSeasonPath(red, green, blue) {
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  return red > green * 1.03 && green > blue * 1.12 && red > 80 && red < 230 && green > 55 && green < 190 && blue < 135 && luminance > 70
}

function classifyDrySeasonPath(red, green, blue) {
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const redLead = red - green
  const greenLead = green - blue
  return red > green * 1.4
    && green > blue * 1.12
    && redLead > greenLead
    && red > 80
    && red < 230
    && green > 55
    && green < 190
    && blue < 135
    && luminance > 70
}

function selectPathClassifier(record) {
  if (record.classification?.monsoonSeason === "dry_season") {
    return { mode: "dry_season_red_brown_route_separated_from_straw_grass_v1", classify: classifyDrySeasonPath }
  }
  return { mode: "humid_and_transition_season_warm_earth_route_v1", classify: classifyWetSeasonPath }
}

function issue(code, message, messageZh, affectedRegion) {
  return { code, message, messageZh, affectedRegion, nextTrainingTarget: "repair_selected_blueprint_condition_alignment" }
}
function round(value) { return Math.round(value * 10000) / 10000 }
function roundPoint(point) { return { x: round(point.x), y: round(point.y) } }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  return resolved
}
function assert(condition, message) { if (!condition) throw new Error(message) }
