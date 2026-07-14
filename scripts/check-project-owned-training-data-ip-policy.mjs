import fs from "node:fs"
import path from "node:path"
import {
  REGISTRATION_REQUEST_SCHEMA_VERSION,
  STRICT_PROJECT_OWNED_IP_POLICY_VERSION,
  validateRegistrationRequest,
  validateRegisteredSampleRecord,
} from "./lib/complete-map-training-sample-contract.mjs"

const ROOT = process.cwd()
const dictionary = readJson("data/world-visual-data-dictionary/latest.json")
const dictionaryVersionId = dictionary.dictionaryVersionId
const failures = []
const valid = validIndependentRequest(dictionaryVersionId)

check(validateRegistrationRequest(valid, dictionaryVersionId).length === 0, "strict_project_owned_valid_contract_rejected")
check(hasFailure({ ...valid, sourceType: "owner_authorized" }, "independent_sample_source_not_strictly_project_owned"), "owner_authorized_source_not_blocked")
check(hasFailure({ ...valid, ipProvenance: { ...valid.ipProvenance, thirdPartyContentUsed: true } }, "ip_third_party_content_must_be_false"), "third_party_content_not_blocked")
check(hasFailure({ ...valid, ipProvenance: { ...valid.ipProvenance, thirdPartyGenerativeModelUsed: true } }, "ip_third_party_generative_model_must_be_false"), "third_party_model_output_not_blocked")
check(hasFailure({ ...valid, ipProvenance: { ...valid.ipProvenance, evidencePaths: [] } }, "ip_evidence_paths_missing"), "missing_ip_evidence_not_blocked")

const registryRoot = path.join(ROOT, "data", "world-samples", "registry", dictionaryVersionId, "records")
let recordCount = 0
let independentEligibleCount = 0
for (const recordPath of walkJson(registryRoot)) {
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"))
  recordCount += 1
  if (record.independentTrainingEligible !== true) continue
  independentEligibleCount += 1
  for (const failure of validateRegisteredSampleRecord(record, dictionaryVersionId)) {
    failures.push(`${record.sampleId}:${failure}`)
  }
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "strict_project_owned_training_data_ip_policy_passed" : "strict_project_owned_training_data_ip_policy_failed",
  policyVersion: STRICT_PROJECT_OWNED_IP_POLICY_VERSION,
  dictionaryVersionId,
  registeredRecordCount: recordCount,
  independentEligibleCount,
  historicalOrNonIndependentCount: recordCount - independentEligibleCount,
  rule: "only project-owner original, commissioned full-assignment, or project-owned independent-model output may claim independent training eligibility",
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function validIndependentRequest(currentDictionaryVersion) {
  const hash = "a".repeat(64)
  return {
    schemaVersion: REGISTRATION_REQUEST_SCHEMA_VERSION,
    sampleType: "complete_map_positive",
    sourceType: "owner_created",
    imagePath: "data/example.png",
    sourcePath: "data/example.psd",
    sourceLicense: { status: "project_owned", rightsHolderId: "project-owner" },
    dictionaryVersionId: currentDictionaryVersion,
    split: "train",
    blueprintHash: hash,
    conditionHashes: [hash],
    conditionPackPath: "data/condition-pack.json",
    directorPlanId: "director-plan",
    taskPackageId: "task-package",
    trainingUsage: "positive",
    machineReviewStatus: "passed",
    ownerReviewStatus: "approved",
    ownerApproval: { status: "approved" },
    visualTags: ["complete-map"],
    qualityTags: ["owner-approved"],
    independentTrainingEligible: true,
    trainingDataProvenance: "independent-training-eligible",
    ipProvenance: {
      policyVersion: STRICT_PROJECT_OWNED_IP_POLICY_VERSION,
      rightsHolderId: "project-owner",
      creationMethod: "project_owner_original_human_created",
      thirdPartyContentUsed: false,
      thirdPartyGenerativeModelUsed: false,
      copiedFromExistingWork: false,
      worldwideCommercialRights: true,
      modelTrainingRights: true,
      derivativeWorksRights: true,
      transferAndSublicenseRights: true,
      evidencePaths: ["data/original-evidence.file"],
      reviewStatus: "approved",
      reviewedBy: "project-owner",
      reviewedAtUtc: "2026-07-12T00:00:00.000Z",
    },
  }
}

function hasFailure(request, expected) {
  return validateRegistrationRequest(request, dictionaryVersionId).includes(expected)
}

function walkJson(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const value = path.join(directory, entry.name)
    if (entry.isDirectory()) return walkJson(value)
    return entry.isFile() && entry.name.endsWith(".json") ? [value] : []
  })
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8"))
}

function check(condition, message) {
  if (!condition) failures.push(message)
}
