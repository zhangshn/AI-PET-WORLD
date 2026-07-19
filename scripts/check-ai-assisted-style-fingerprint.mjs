import fs from "node:fs"
import path from "node:path"
import { auditStyleFeatures } from "./lib/ai-assisted-style-fingerprint.mjs"

const ROOT = process.cwd()
const failures = []
const pointer = readJson(".runtime/ai-painter/style-fingerprints/latest.json")
check(pointer?.fingerprintPath, "style fingerprint latest pointer is missing")
const fingerprint = pointer?.fingerprintPath ? readJson(pointer.fingerprintPath) : null
check(fingerprint?.schemaVersion === "ai-assisted-project-style-fingerprint-v1", "style fingerprint schema is invalid")
check(fingerprint?.positiveSampleCount >= 5, "approved style reference count is insufficient")
check(fingerprint?.negativeSampleCount >= 1, "owner-rejected style pattern is missing")
check(fingerprint?.model?.calibration?.allApprovedSamplesPassCalibration === true, "approved style leave-one-out calibration failed")

if (fingerprint) {
  for (const sample of fingerprint.positiveSamples) {
    const audit = auditStyleFeatures(sample.features, { ...fingerprint, negativeSamples: [] })
    check(audit.issues.every((issue) => issue.code !== "style_fingerprint_outside_approved_envelope"), `approved style sample fell outside envelope: ${sample.recordId}`)
  }
  for (const sample of fingerprint.negativeSamples) {
    const audit = auditStyleFeatures(sample.features, fingerprint)
    check(audit.passed === false, `owner-rejected style pattern was not blocked: ${sample.recordId}`)
    check(audit.issues.some((issue) => issue.code === "style_fingerprint_matches_owner_rejected_pattern"), `owner-rejected pattern did not trigger contrast gate: ${sample.recordId}`)
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, status: "ai_assisted_style_fingerprint_check_failed", failures }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({
  ok: true,
  status: "ai_assisted_style_fingerprint_check_passed",
  fingerprintId: fingerprint.fingerprintId,
  positiveSampleCount: fingerprint.positiveSampleCount,
  negativeSampleCount: fingerprint.negativeSampleCount,
  approvedEnvelopeRadius: fingerprint.model.calibration.approvedEnvelopeRadius,
  rejectedPatternSeparationRatio: fingerprint.model.calibration.rejectedPatternSeparationRatio,
}, null, 2))

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function check(condition, message) { if (!condition) failures.push(message) }
