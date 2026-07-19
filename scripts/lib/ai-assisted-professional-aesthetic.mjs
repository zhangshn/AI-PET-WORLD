import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { extractStyleFeatures } from "./ai-assisted-style-fingerprint.mjs"

const ROOT = process.cwd()
const LATEST_FINGERPRINT = path.join(ROOT, ".runtime", "ai-painter", "style-fingerprints", "latest.json")
const MULTISCALE_TEXTURE_FEATURES = [
  "native_edge_density_004",
  "native_edge_density_008",
  "native_edge_density_014",
  "native_gradient_mean",
  "native_laplacian_mean",
  "half_edge_density_004",
  "half_edge_density_008",
  "half_edge_density_014",
  "half_gradient_mean",
  "half_laplacian_mean",
  "quarter_edge_density_004",
  "quarter_edge_density_008",
  "quarter_edge_density_014",
  "quarter_gradient_mean",
  "quarter_laplacian_mean",
]

export async function auditAiAssistedProfessionalAesthetic(imagePath) {
  const pointer = readJson(LATEST_FINGERPRINT)
  assert(pointer?.fingerprintPath, "latest owner-approved style fingerprint is missing")
  const fingerprintPath = resolveProjectPath(pointer.fingerprintPath)
  const fingerprintBytes = fs.readFileSync(fingerprintPath)
  const fingerprint = JSON.parse(fingerprintBytes.toString("utf8"))
  assert((fingerprint.positiveSamples ?? []).length >= 5, "professional aesthetic calibration requires owner-approved complete maps")
  const candidate = await extractStyleFeatures(imagePath)
  const candidateFeatures = featureMap(candidate)
  const approvedFeatures = fingerprint.positiveSamples.map((sample) => ({
    recordId: sample.recordId,
    values: featureMap(sample.features),
  }))

  const upperEnvelope = Object.fromEntries(MULTISCALE_TEXTURE_FEATURES.map((name) => {
    const maximum = Math.max(...approvedFeatures.map((sample) => sample.values[name]))
    return [name, round(maximum * 1.05 + 1e-6)]
  }))
  const textureViolations = MULTISCALE_TEXTURE_FEATURES
    .filter((name) => candidateFeatures[name] > upperEnvelope[name])
    .map((name) => ({
      feature: name,
      candidate: round(candidateFeatures[name]),
      approvedUpperEnvelope: upperEnvelope[name],
      ratio: round(candidateFeatures[name] / Math.max(upperEnvelope[name], 1e-9)),
    }))

  const quietRegionUpperEnvelope = round(Math.max(...approvedFeatures.map((sample) => sample.values.block_variance_q10)) * 1.05 + 1e-6)
  const quietRegionVariance = round(candidateFeatures.block_variance_q10)
  const hierarchyRatios = approvedFeatures.map((sample) => sample.values.block_variance_q10 / Math.max(sample.values.block_variance_q90, 1e-9))
  const textureHierarchyUpperEnvelope = round(Math.max(...hierarchyRatios) * 1.05 + 1e-6)
  const textureHierarchyRatio = round(candidateFeatures.block_variance_q10 / Math.max(candidateFeatures.block_variance_q90, 1e-9))
  const issues = []

  if (textureViolations.length >= 4) {
    issues.push(issue(
      "professional_multiscale_texture_noise_overload",
      "Fine and coarse texture energy exceeds the owner-approved complete-map envelope across multiple scales.",
      "细尺度与粗尺度纹理能量同时超出项目所有者已通过完整地图的校准上限，画面存在噪声堆积。",
      "whole_frame",
      "reduce_multiscale_texture_noise_and_restore_material_regions",
    ))
  }
  if (quietRegionVariance > quietRegionUpperEnvelope) {
    issues.push(issue(
      "professional_quiet_region_missing",
      "Even the quietest map regions are more textured than every calibrated owner-approved map.",
      "整张图最安静的区域仍比所有已通过校准图更嘈杂，缺少可读的低细节休息区。",
      "whole_frame",
      "restore_low_detail_regions_and_visual_hierarchy",
    ))
  }
  if (textureHierarchyRatio > textureHierarchyUpperEnvelope) {
    issues.push(issue(
      "professional_texture_hierarchy_collapsed",
      "Texture variance is too uniform across the frame and collapses visual hierarchy.",
      "整图纹理方差过于均匀，空间层次和材质主次发生塌缩。",
      "whole_frame",
      "increase_texture_hierarchy_between_primary_and_secondary_regions",
    ))
  }

  return {
    schemaVersion: "ai-assisted-professional-aesthetic-audit-v2",
    status: issues.length === 0 ? "professional_aesthetic_passed" : "professional_aesthetic_failed",
    passed: issues.length === 0,
    method: "owner_approved_complete_map_multiscale_texture_envelope_v2",
    calibration: {
      fingerprintId: fingerprint.fingerprintId,
      fingerprintPath: projectPath(fingerprintPath),
      fingerprintSha256: sha256(fingerprintBytes),
      approvedSampleCount: approvedFeatures.length,
      approvedRecordIds: approvedFeatures.map((sample) => sample.recordId),
      upperEnvelopeMargin: 1.05,
      minimumMultiscaleViolationCount: 4,
    },
    candidate: {
      imagePath: candidate.imagePath,
      imageSha256: candidate.imageSha256,
      multiscaleTextureValues: Object.fromEntries(MULTISCALE_TEXTURE_FEATURES.map((name) => [name, round(candidateFeatures[name])])),
      quietRegionVariance,
      textureHierarchyRatio,
    },
    thresholds: {
      multiscaleTextureUpperEnvelope: upperEnvelope,
      quietRegionUpperEnvelope,
      textureHierarchyUpperEnvelope,
    },
    textureViolations,
    issues,
  }
}

function featureMap(features) {
  return Object.fromEntries(features.featureNames.map((name, index) => [name, features.vector[index]]))
}
function issue(code, message, messageZh, affectedRegion, nextTrainingTarget) {
  return { code, severity: "error", message, messageZh, affectedRegion, nextTrainingTarget }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  return resolved
}
function round(value) { return Math.round(value * 1_000_000) / 1_000_000 }
function assert(condition, message) { if (!condition) throw new Error(message) }
