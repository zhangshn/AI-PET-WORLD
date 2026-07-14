import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { STRICT_PROJECT_OWNED_IP_POLICY_VERSION } from "./lib/complete-map-training-sample-contract.mjs"

const ROOT = process.cwd()
const failures = []
const pointer = readJson("data/world-samples/dataset-packages/latest.json")
const manifest = pointer?.manifestPath ? readJson(pointer.manifestPath) : null
const sourceIndex = pointer?.sourceIndexPath ? readJson(pointer.sourceIndexPath) : null
const dictionaryPointer = readJson("data/world-visual-data-dictionary/latest.json")

check(Boolean(pointer), "dataset_package_pointer_missing")
check(Boolean(manifest), "dataset_package_manifest_missing")
check(Boolean(sourceIndex), "dataset_package_source_index_missing")
if (pointer && manifest && sourceIndex) {
  check(manifest.schemaVersion === "complete-map-dataset-package-v1", "dataset_package_schema_invalid")
  check(manifest.packageId === pointer.packageId, "dataset_package_identity_mismatch")
  check(manifest.dictionaryVersionId === dictionaryPointer?.dictionaryVersionId, "dataset_package_dictionary_not_current")
  check(manifest.immutable === true, "dataset_package_not_immutable")
  check(manifest.automaticStorage === true, "dataset_package_not_program_saved")
  check(manifest.ipPolicyVersion === STRICT_PROJECT_OWNED_IP_POLICY_VERSION, "dataset_package_ip_policy_invalid")
  check(sourceIndex.packageId === manifest.packageId, "dataset_source_index_identity_mismatch")
  check(sourceIndex.ipPolicyVersion === STRICT_PROJECT_OWNED_IP_POLICY_VERSION, "dataset_source_index_ip_policy_invalid")
  check(sourceIndex.sampleCount === manifest.sampleCount, "dataset_sample_count_mismatch")
  check(Array.isArray(manifest.splitIsolationFailures) && manifest.splitIsolationFailures.length === 0, "dataset_split_isolation_failed")
  for (const snapshot of Object.values(manifest.snapshots ?? {}).filter(Boolean)) checkSnapshot(snapshot)
  for (const split of ["train", "validation", "challenge", "regression"]) {
    const splitPath = path.join(pointer.packagePath, "splits", `${split}.json`)
    const record = readJson(splitPath)
    check(record?.split === split, `dataset_split_missing:${split}`)
    check(record?.packageId === manifest.packageId, `dataset_split_identity_mismatch:${split}`)
  }
  for (const sample of sourceIndex.samples ?? []) {
    check(fs.existsSync(resolveProjectPath(sample.imagePath)), `dataset_source_image_missing:${sample.sampleId}`)
    check(fs.existsSync(resolveProjectPath(sample.recordPath)), `dataset_source_record_missing:${sample.sampleId}`)
    if (sample.independentTrainingEligible === true) {
      check(sample.ipProvenance?.policyVersion === STRICT_PROJECT_OWNED_IP_POLICY_VERSION, `dataset_source_ip_provenance_invalid:${sample.sampleId}`)
      check(sample.ipProvenanceVerifiedByProgram === true, `dataset_source_ip_program_verification_missing:${sample.sampleId}`)
      check(Array.isArray(sample.ipEvidenceHashes) && sample.ipEvidenceHashes.length > 0, `dataset_source_ip_evidence_missing:${sample.sampleId}`)
      check(/^[a-f0-9]{64}$/i.test(sample.sourceFileSha256 ?? ""), `dataset_source_original_hash_missing:${sample.sampleId}`)
      check(/^[a-f0-9]{64}$/i.test(sample.conditionPackFileSha256 ?? ""), `dataset_source_condition_pack_hash_missing:${sample.sampleId}`)
    }
  }
  if (manifest.canStartFormalTraining === true) {
    check(manifest.dataAuditStatus === "training_data_sufficient", "training_ready_without_sufficient_audit")
    check((manifest.blockingGates ?? []).length === 0, "training_ready_with_blocking_gates")
  }
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "complete_map_dataset_package_check_passed" : "complete_map_dataset_package_check_failed",
  packageId: manifest?.packageId ?? null,
  packageStatus: manifest?.status ?? null,
  dictionaryVersionId: manifest?.dictionaryVersionId ?? null,
  sampleCount: manifest?.sampleCount ?? 0,
  splitCounts: manifest?.splitCounts ?? {},
  canStartFormalTraining: manifest?.canStartFormalTraining ?? false,
  blockingGates: manifest?.blockingGates ?? [],
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function checkSnapshot(snapshot) {
  const filePath = resolveProjectPath(snapshot.path)
  check(fs.existsSync(filePath), `dataset_snapshot_missing:${snapshot.path}`)
  if (!fs.existsSync(filePath)) return
  const bytes = fs.readFileSync(filePath)
  check(sha256(bytes) === snapshot.sha256, `dataset_snapshot_hash_mismatch:${snapshot.path}`)
}

function readJson(value) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
  } catch {
    return null
  }
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${value}`)
  return resolved
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function check(condition, message) {
  if (!condition) failures.push(message)
}
