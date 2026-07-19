import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  AXIS_FAILURE_CODES,
  CONNECTIVITY_COVERAGE_AXES,
  canonicalSha256,
  validateCoverageScenario,
} from "./lib/world-connectivity-coverage.mjs"

const ROOT = process.cwd()
const failures = []
const pointer = readJson("data/world-samples/world-connectivity/coverage/latest.json")
const manifest = pointer?.manifestPath ? readJson(pointer.manifestPath) : null
const contract = readJson("data/world-samples/world-connectivity/world-connectivity-contract-v1.json")
const blueprint = readJson("data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json")

check(Boolean(pointer), "connectivity_coverage_pointer_missing")
check(Boolean(manifest), "connectivity_coverage_manifest_missing")
if (pointer && manifest) {
  check(pointer.datasetId === manifest.datasetId, "connectivity_coverage_dataset_identity_mismatch")
  check(pointer.manifestSha256 === fileSha256(pointer.manifestPath), "connectivity_coverage_manifest_hash_mismatch")
  check(manifest.schemaVersion === "world-connectivity-coverage-dataset-v1", "connectivity_coverage_schema_invalid")
  check(manifest.status === "machine_verified_threshold_met", "connectivity_coverage_status_invalid")
  check(manifest.recordCount === 54, "connectivity_coverage_record_count_invalid")
  check(manifest.positiveRecordCount === 27, "connectivity_positive_count_invalid")
  check(manifest.negativeRecordCount === 27, "connectivity_negative_count_invalid")
  check(manifest.thresholdMet === true, "connectivity_coverage_threshold_not_met")
  check(manifest.runtimeTick === 3, "connectivity_runtime_tick_invalid")
  check(manifest.trainingUseContract?.rgbTrainingTarget === false, "connectivity_records_must_not_be_rgb_targets")
  check(manifest.trainingUseContract?.changesRuntimeWorldFacts === false, "connectivity_records_changed_runtime_facts")
  check(sameJson(Object.keys(manifest.axisCounts ?? {}), CONNECTIVITY_COVERAGE_AXES), "connectivity_axis_order_or_identity_invalid")
  for (const axis of CONNECTIVITY_COVERAGE_AXES) {
    check(manifest.axisCounts?.[axis]?.positive === 3, `connectivity_positive_axis_count_invalid:${axis}`)
    check(manifest.axisCounts?.[axis]?.negative === 3, `connectivity_negative_axis_count_invalid:${axis}`)
  }
  const signatures = new Set()
  for (const summary of manifest.records ?? []) {
    const record = readJson(summary.recordPath)
    check(Boolean(record), `connectivity_record_missing:${summary.recordId}`)
    if (!record) continue
    check(summary.recordSha256 === fileSha256(summary.recordPath), `connectivity_record_hash_mismatch:${summary.recordId}`)
    check(record.recordId === summary.recordId, `connectivity_record_identity_mismatch:${summary.recordId}`)
    check(record.datasetId === manifest.datasetId, `connectivity_record_dataset_mismatch:${summary.recordId}`)
    check(CONNECTIVITY_COVERAGE_AXES.includes(record.axis), `connectivity_record_axis_invalid:${summary.recordId}`)
    check(["positive", "negative"].includes(record.polarity), `connectivity_record_polarity_invalid:${summary.recordId}`)
    check(record.scenarioSha256 === canonicalSha256(record.scenario), `connectivity_scenario_hash_mismatch:${summary.recordId}`)
    check(record.authorityBoundary?.sourceWorldFactsMutated === false, `connectivity_source_fact_mutation_detected:${summary.recordId}`)
    check(record.authorityBoundary?.runtimeWorldFactsChanged === false, `connectivity_runtime_fact_mutation_detected:${summary.recordId}`)
    check(record.authorityBoundary?.imagesGenerated === 0, `connectivity_unexpected_image_generation:${summary.recordId}`)
    const review = validateCoverageScenario(record.scenario)
    if (record.polarity === "positive") {
      check(review.passed === true, `connectivity_positive_revalidation_failed:${summary.recordId}`)
      check(record.machineReview?.observedPassed === true, `connectivity_positive_review_invalid:${summary.recordId}`)
    } else {
      check(review.passed === false, `connectivity_negative_revalidation_passed:${summary.recordId}`)
      check(review.failureCode === AXIS_FAILURE_CODES[record.axis], `connectivity_negative_failure_code_invalid:${summary.recordId}`)
      check(record.machineReview?.observedFailureCode === review.failureCode, `connectivity_negative_review_mismatch:${summary.recordId}`)
    }
    const signature = `${record.axis}:${record.polarity}:${record.sourceConditionLabel}:${record.scenarioSha256}`
    check(!signatures.has(signature), `connectivity_duplicate_record:${summary.recordId}`)
    signatures.add(signature)
  }
}

check(contract?.coverageEvidence?.thresholdMet === true, "connectivity_contract_coverage_evidence_missing")
check(contract?.coverageEvidence?.manifestSha256 === pointer?.manifestSha256, "connectivity_contract_manifest_mismatch")
check(blueprint?.connectivityCoverage?.thresholdMet === true, "connectivity_blueprint_threshold_not_met")
check(blueprint?.connectivityCoverage?.coverageManifestSha256 === pointer?.manifestSha256, "connectivity_blueprint_manifest_mismatch")

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "world_connectivity_coverage_check_passed" : "world_connectivity_coverage_check_failed",
  checkedAtUtc: new Date().toISOString(),
  datasetId: manifest?.datasetId ?? null,
  positiveRecordCount: manifest?.positiveRecordCount ?? 0,
  negativeRecordCount: manifest?.negativeRecordCount ?? 0,
  axisCounts: manifest?.axisCounts ?? {},
  thresholdMet: manifest?.thresholdMet === true,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(value) {
  if (!value) return null
  const filePath = path.resolve(ROOT, value)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function fileSha256(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex")
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
