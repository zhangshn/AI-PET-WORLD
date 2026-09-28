import fs from "node:fs"
import sharp from "sharp"

export async function auditMvp256DetailSufficiency({ candidatePath, referencePath, contract }) {
  assert(contract?.schemaVersion === "stage4-mvp-256-detail-sufficiency-review-contract-v1", "detail contract schema invalid")
  assert(contract?.status === "active_readonly_false_positive_safety_gate", "detail contract inactive")
  const measurement = contract.measurement
  assert(measurement?.width === 256 && measurement?.height === 192, "detail measurement size invalid")
  assert(measurement?.resizeKernel === "nearest", "detail resize kernel invalid")
  assert(measurement?.edgeGradientThreshold === 0.04, "detail edge threshold invalid")
  const candidate = await measureImage(candidatePath, measurement)
  const reference = await measureImage(referencePath, measurement)
  const ratios = {
    gradientMean: ratio(candidate.gradientMean, reference.gradientMean),
    laplacianMean: ratio(candidate.laplacianMean, reference.laplacianMean),
    edgeDensity004: ratio(candidate.edgeDensity004, reference.edgeDensity004),
  }
  const minimums = contract.minimumCandidateToReferenceRatios
  const checks = Object.fromEntries(Object.entries(ratios).map(([name, value]) => [name, {
    value,
    minimum: minimums[name],
    passed: value >= minimums[name],
  }]))
  const passed = Object.values(checks).every((check) => check.passed)
  return {
    schemaVersion: "stage4-mvp-256-detail-sufficiency-audit-v1",
    status: passed ? "detail_sufficiency_passed" : "detail_sufficiency_failed",
    passed,
    measurement: {
      width: measurement.width,
      height: measurement.height,
      resizeKernel: measurement.resizeKernel,
      edgeGradientThreshold: measurement.edgeGradientThreshold,
    },
    candidate,
    reference,
    ratios,
    checks,
    issueCodes: passed ? [] : [contract.failureCode],
  }
}

async function measureImage(imagePath, measurement) {
  const bytes = fs.readFileSync(imagePath)
  const { data, info } = await sharp(bytes, { failOn: "error" })
    .removeAlpha()
    .resize(measurement.width, measurement.height, { fit: "fill", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert(info.width === measurement.width && info.height === measurement.height, "detail measurement dimensions invalid")
  assert(info.channels >= 3, "detail measurement RGB channels missing")
  const [redWeight, greenWeight, blueWeight] = measurement.luminanceCoefficients
  const luminance = new Float64Array(info.width * info.height)
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * info.channels
    luminance[index] = (
      data[offset] * redWeight
      + data[offset + 1] * greenWeight
      + data[offset + 2] * blueWeight
    ) / 255
  }
  let gradientSum = 0
  let laplacianSum = 0
  let edgeCount = 0
  let sampleCount = 0
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const index = y * info.width + x
      const horizontal = Math.abs(luminance[index + 1] - luminance[index - 1]) * 0.5
      const vertical = Math.abs(luminance[index + info.width] - luminance[index - info.width]) * 0.5
      const gradient = Math.hypot(horizontal, vertical)
      gradientSum += gradient
      laplacianSum += Math.abs(
        luminance[index - 1] + luminance[index + 1]
        + luminance[index - info.width] + luminance[index + info.width]
        - 4 * luminance[index]
      )
      if (gradient >= measurement.edgeGradientThreshold) edgeCount += 1
      sampleCount += 1
    }
  }
  return {
    gradientMean: round(gradientSum / sampleCount),
    laplacianMean: round(laplacianSum / sampleCount),
    edgeDensity004: round(edgeCount / sampleCount),
  }
}

function ratio(candidate, reference) {
  return round(candidate / Math.max(reference, 1e-12))
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
