import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const LATEST_PATH = path.join(ROOT, ".runtime", "ai-painter", "style-fingerprints", "latest.json")

export async function extractStyleFeatures(imagePath) {
  const resolved = path.resolve(ROOT, imagePath)
  const native = await readRgb(resolved)
  const half = await readRgb(resolved, 512, 384)
  const quarter = await readRgb(resolved, 256, 192)
  const featureMap = {
    ...basicFeatures(native, "native"),
    ...edgeFeatures(native, "native"),
    ...edgeFeatures(half, "half"),
    ...edgeFeatures(quarter, "quarter"),
    ...colorHistogram(native),
    ...gradientOrientation(native),
    ...blockVarianceFeatures(quarter),
  }
  const featureNames = Object.keys(featureMap).sort()
  return {
    imagePath: projectPath(resolved),
    imageSha256: sha256(fs.readFileSync(resolved)),
    width: native.width,
    height: native.height,
    featureVersion: "project-style-feature-vector-v1",
    featureNames,
    vector: featureNames.map((name) => round(featureMap[name], 8)),
  }
}

export function buildStyleFingerprintModel(positiveSamples, negativeSamples) {
  assert(positiveSamples.length >= 5, "at least five owner-approved style samples are required")
  const featureNames = positiveSamples[0].features.featureNames
  for (const sample of [...positiveSamples, ...negativeSamples]) {
    assert(sameArray(sample.features.featureNames, featureNames), `style feature schema mismatch: ${sample.recordId}`)
  }
  const dimensions = featureNames.length
  const mean = Array.from({ length: dimensions }, (_, index) => average(positiveSamples.map((sample) => sample.features.vector[index])))
  const scale = Array.from({ length: dimensions }, (_, index) => {
    const values = positiveSamples.map((sample) => sample.features.vector[index])
    const deviation = Math.sqrt(average(values.map((value) => (value - mean[index]) ** 2)))
    return Math.max(deviation, Math.abs(mean[index]) * 0.05, 0.005)
  })
  const normalizedPositive = positiveSamples.map((sample) => normalize(sample.features.vector, mean, scale))
  const normalizedNegative = negativeSamples.map((sample) => normalize(sample.features.vector, mean, scale))
  const leaveOneOut = normalizedPositive.map((vector, index) => nearestMeanDistance(vector, normalizedPositive.filter((_, candidate) => candidate !== index), 3))
  const approvedEnvelopeRadius = Math.max(...leaveOneOut) * 1.1
  const positiveNegativeRatios = normalizedNegative.length
    ? normalizedPositive.map((vector, index) => {
        const positiveDistance = nearestMeanDistance(vector, normalizedPositive.filter((_, candidate) => candidate !== index), 3)
        const negativeDistance = nearestMeanDistance(vector, normalizedNegative, 1)
        return negativeDistance / Math.max(positiveDistance, 1e-9)
      })
    : []
  const rejectedPatternSeparationRatio = positiveNegativeRatios.length
    ? Math.max(0.25, Math.min(...positiveNegativeRatios) * 0.8)
    : null
  return {
    featureVersion: "project-style-feature-vector-v1",
    featureNames,
    normalization: { mean: mean.map((value) => round(value, 8)), scale: scale.map((value) => round(value, 8)) },
    calibration: {
      method: "owner_approved_leave_one_out_plus_owner_rejected_contrast_v1",
      nearestApprovedNeighborCount: 3,
      approvedLeaveOneOutDistances: leaveOneOut.map((value) => round(value, 6)),
      approvedEnvelopeRadius: round(approvedEnvelopeRadius, 6),
      rejectedPatternSeparationRatio: rejectedPatternSeparationRatio == null ? null : round(rejectedPatternSeparationRatio, 6),
      allApprovedSamplesPassCalibration: leaveOneOut.every((distance) => distance <= approvedEnvelopeRadius),
    },
  }
}

export function auditStyleFeatures(features, fingerprint) {
  assert(sameArray(features.featureNames, fingerprint.model.featureNames), "candidate style feature schema mismatch")
  const normalized = normalize(features.vector, fingerprint.model.normalization.mean, fingerprint.model.normalization.scale)
  const positives = fingerprint.positiveSamples.map((sample) => normalize(sample.features.vector, fingerprint.model.normalization.mean, fingerprint.model.normalization.scale))
  const negatives = fingerprint.negativeSamples.map((sample) => normalize(sample.features.vector, fingerprint.model.normalization.mean, fingerprint.model.normalization.scale))
  const positiveDistances = positives.map((vector, index) => ({ index, distance: rmsDistance(normalized, vector) })).sort((a, b) => a.distance - b.distance)
  const negativeDistances = negatives.map((vector, index) => ({ index, distance: rmsDistance(normalized, vector) })).sort((a, b) => a.distance - b.distance)
  const nearestApprovedDistance = average(positiveDistances.slice(0, 3).map((entry) => entry.distance))
  const nearestRejectedDistance = negativeDistances[0]?.distance ?? null
  const rejectedSeparationRatio = nearestRejectedDistance == null ? null : nearestRejectedDistance / Math.max(nearestApprovedDistance, 1e-9)
  const issues = []
  if (nearestApprovedDistance > fingerprint.model.calibration.approvedEnvelopeRadius) {
    issues.push(styleIssue(
      "style_fingerprint_outside_approved_envelope",
      "Candidate style lies outside the calibrated owner-approved style envelope.",
      "候选图风格超出项目所有者已批准原图的校准范围。",
      "complete_frame",
      "move_candidate_toward_owner_approved_style_envelope",
    ))
  }
  const requiredRatio = fingerprint.model.calibration.rejectedPatternSeparationRatio
  if (requiredRatio != null && rejectedSeparationRatio != null && rejectedSeparationRatio < requiredRatio) {
    issues.push(styleIssue(
      "style_fingerprint_matches_owner_rejected_pattern",
      "Candidate style is closer to an owner-rejected style pattern than the calibrated separation allows.",
      "候选图风格过于接近项目所有者已拒绝的风格模式。",
      "complete_frame",
      "increase_distance_from_owner_rejected_style_patterns",
    ))
  }
  return {
    schemaVersion: "ai-assisted-style-fingerprint-audit-v1",
    fingerprintId: fingerprint.fingerprintId,
    fingerprintPath: fingerprint.fingerprintPath,
    candidateImagePath: features.imagePath,
    candidateImageSha256: features.imageSha256,
    passed: issues.length === 0,
    metrics: {
      nearestApprovedDistance: round(nearestApprovedDistance, 6),
      approvedEnvelopeRadius: fingerprint.model.calibration.approvedEnvelopeRadius,
      nearestApprovedRecordIds: positiveDistances.slice(0, 3).map((entry) => fingerprint.positiveSamples[entry.index].recordId),
      nearestRejectedDistance: nearestRejectedDistance == null ? null : round(nearestRejectedDistance, 6),
      nearestRejectedRecordId: negativeDistances[0] ? fingerprint.negativeSamples[negativeDistances[0].index].recordId : null,
      rejectedSeparationRatio: rejectedSeparationRatio == null ? null : round(rejectedSeparationRatio, 6),
      requiredRejectedSeparationRatio: requiredRatio,
    },
    issues,
  }
}

export async function auditImageAgainstLatestStyleFingerprint(imagePath) {
  const pointer = readJson(LATEST_PATH)
  assert(pointer?.fingerprintPath, "latest project style fingerprint is missing")
  const fingerprint = readJson(path.resolve(ROOT, pointer.fingerprintPath))
  const features = await extractStyleFeatures(imagePath)
  return auditStyleFeatures(features, fingerprint)
}

export function fingerprintLatestPath() { return projectPath(LATEST_PATH) }

async function readRgb(imagePath, width, height) {
  let pipeline = sharp(imagePath, { failOn: "error" }).removeAlpha()
  if (width && height) pipeline = pipeline.resize(width, height, { fit: "fill", kernel: sharp.kernel.nearest })
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function basicFeatures(image, prefix) {
  const luminance = new Float32Array(image.width * image.height)
  const saturation = new Float32Array(luminance.length)
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * image.channels
    const red = image.data[offset] / 255
    const green = image.data[offset + 1] / 255
    const blue = image.data[offset + 2] / 255
    luminance[index] = red * 0.2126 + green * 0.7152 + blue * 0.0722
    const maximum = Math.max(red, green, blue)
    const minimum = Math.min(red, green, blue)
    saturation[index] = maximum === 0 ? 0 : (maximum - minimum) / maximum
  }
  const sortedLuminance = Array.from(luminance).sort((a, b) => a - b)
  const sortedSaturation = Array.from(saturation).sort((a, b) => a - b)
  return {
    [`${prefix}_luminance_mean`]: average(luminance),
    [`${prefix}_luminance_std`]: standardDeviation(luminance),
    [`${prefix}_luminance_q10`]: quantile(sortedLuminance, 0.1),
    [`${prefix}_luminance_q50`]: quantile(sortedLuminance, 0.5),
    [`${prefix}_luminance_q90`]: quantile(sortedLuminance, 0.9),
    [`${prefix}_saturation_mean`]: average(saturation),
    [`${prefix}_saturation_std`]: standardDeviation(saturation),
    [`${prefix}_saturation_q50`]: quantile(sortedSaturation, 0.5),
  }
}

function edgeFeatures(image, prefix) {
  const luminance = buildLuminance(image)
  const thresholds = [0.04, 0.08, 0.14]
  const counts = thresholds.map(() => 0)
  let comparisons = 0
  let gradientSum = 0
  let laplacianSum = 0
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const index = y * image.width + x
      const horizontal = Math.abs(luminance[index + 1] - luminance[index - 1]) * 0.5
      const vertical = Math.abs(luminance[index + image.width] - luminance[index - image.width]) * 0.5
      const gradient = Math.hypot(horizontal, vertical)
      thresholds.forEach((threshold, thresholdIndex) => { if (gradient >= threshold) counts[thresholdIndex] += 1 })
      gradientSum += gradient
      laplacianSum += Math.abs(luminance[index - 1] + luminance[index + 1] + luminance[index - image.width] + luminance[index + image.width] - 4 * luminance[index])
      comparisons += 1
    }
  }
  return {
    [`${prefix}_edge_density_004`]: counts[0] / comparisons,
    [`${prefix}_edge_density_008`]: counts[1] / comparisons,
    [`${prefix}_edge_density_014`]: counts[2] / comparisons,
    [`${prefix}_gradient_mean`]: gradientSum / comparisons,
    [`${prefix}_laplacian_mean`]: laplacianSum / comparisons,
  }
}

function colorHistogram(image) {
  const bins = Array.from({ length: 64 }, () => 0)
  const count = image.width * image.height
  for (let index = 0; index < count; index += 1) {
    const offset = index * image.channels
    const bin = (image.data[offset] >> 6) * 16 + (image.data[offset + 1] >> 6) * 4 + (image.data[offset + 2] >> 6)
    bins[bin] += 1
  }
  return Object.fromEntries(bins.map((value, index) => [`color_hist_${String(index).padStart(2, "0")}`, value / count]))
}

function gradientOrientation(image) {
  const luminance = buildLuminance(image)
  const bins = Array.from({ length: 8 }, () => 0)
  let total = 0
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const index = y * image.width + x
      const dx = luminance[index + 1] - luminance[index - 1]
      const dy = luminance[index + image.width] - luminance[index - image.width]
      const magnitude = Math.hypot(dx, dy)
      if (magnitude < 0.025) continue
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)
      bins[Math.min(7, Math.floor(angle * 8))] += magnitude
      total += magnitude
    }
  }
  return Object.fromEntries(bins.map((value, index) => [`gradient_orientation_${index}`, total ? value / total : 0]))
}

function blockVarianceFeatures(image) {
  const luminance = buildLuminance(image)
  const values = []
  const block = 16
  for (let top = 0; top < image.height; top += block) {
    for (let left = 0; left < image.width; left += block) {
      const samples = []
      for (let y = top; y < Math.min(top + block, image.height); y += 1) {
        for (let x = left; x < Math.min(left + block, image.width); x += 1) samples.push(luminance[y * image.width + x])
      }
      values.push(standardDeviation(samples))
    }
  }
  values.sort((a, b) => a - b)
  return {
    block_variance_q10: quantile(values, 0.1),
    block_variance_q50: quantile(values, 0.5),
    block_variance_q90: quantile(values, 0.9),
  }
}

function buildLuminance(image) {
  const output = new Float32Array(image.width * image.height)
  for (let index = 0; index < output.length; index += 1) {
    const offset = index * image.channels
    output[index] = (image.data[offset] * 0.2126 + image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722) / 255
  }
  return output
}

function styleIssue(code, message, messageZh, affectedRegion, nextTrainingTarget) {
  return { code, message, messageZh, affectedRegion, nextTrainingTarget }
}
function normalize(vector, mean, scale) { return vector.map((value, index) => (value - mean[index]) / scale[index]) }
function nearestMeanDistance(vector, candidates, count) { return average(candidates.map((candidate) => rmsDistance(vector, candidate)).sort((a, b) => a - b).slice(0, Math.min(count, candidates.length))) }
function rmsDistance(left, right) { return Math.sqrt(average(left.map((value, index) => (value - right[index]) ** 2))) }
function average(values) { return Array.from(values).reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }
function standardDeviation(values) { const mean = average(values); return Math.sqrt(average(Array.from(values).map((value) => (value - mean) ** 2))) }
function quantile(sorted, ratio) { const index = (sorted.length - 1) * ratio; const lower = Math.floor(index); const upper = Math.ceil(index); return sorted[lower] * (upper - index) + sorted[upper] * (index - lower) }
function sameArray(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]) }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function round(value, precision = 6) { const factor = 10 ** precision; return Math.round(value * factor) / factor }
function assert(condition, message) { if (!condition) throw new Error(message) }
