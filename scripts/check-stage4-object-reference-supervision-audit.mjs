import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  REQUIRED_OBJECT_CLASSES,
  REQUIRED_SPLITS,
  auditOneRecord,
  selectApprovedRecords,
  validateAuthorizationContract,
} from "./run-stage4-object-reference-supervision-audit.mjs"

const ROOT = process.cwd()
const authorizationArgument = argumentValue("--authorization")
assert(authorizationArgument, "--authorization is required")
const authorizationPath = resolveProjectPath(authorizationArgument)
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const positive = {}
const negative = {}

validateAuthorizationContract(authorization, authorizationArgument)
positive.authorizationContractAccepted = true
const sourceIndex = JSON.parse(fs.readFileSync(resolveProjectPath(authorization.immutableSourceBindings.datasetSourceIndex.path), "utf8"))
const rows = selectApprovedRecords(sourceIndex)
positive.exact64ApprovedRecords = rows.length === 64
positive.exactSplitCounts = sameJson(Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])), REQUIRED_SPLITS)
positive.objectClassOrderShared = sameJson(authorization.taskIdentity.requiredObjectClasses, REQUIRED_OBJECT_CLASSES)
const sample194 = rows.find((row) => row.sampleId.includes("slot-194"))
assert(sample194, "sample194_missing")
const sampleResult = await auditOneRecord(sample194)
positive.realSample194UsesExistingAuditor = sampleResult.classResults.length === 4 && sampleResult.classResults.every((item) => item.passed)
positive.historicalReviewsRemainReadOnly = sampleResult.historicalMachineReview.modified === false && sampleResult.historicalOwnerReview.modified === false

negative.absoluteAuthorizationPathRejected = rejects(() => validateAuthorizationContract(structuredClone(authorization), authorizationPath), "authorization_absolute_path_rejected")
negative.hashMismatchRejected = rejects(() => { const value = structuredClone(authorization); value.immutableSourceBindings.datasetManifest.sha256 = "0".repeat(64); validateAuthorizationContract(value, authorizationArgument) }, "authorization_source_hash_mismatch")
negative.scopeMismatchRejected = rejects(() => { const value = structuredClone(authorization); value.ownerDecision.scope = "wrong"; validateAuthorizationContract(value, authorizationArgument) }, "authorization_scope_invalid")
negative.unknownOrMissingObjectClassRejected = rejects(() => { const value = structuredClone(authorization); value.taskIdentity.requiredObjectClasses = [...REQUIRED_OBJECT_CLASSES, "unknown"]; validateAuthorizationContract(value, authorizationArgument) }, "authorization_object_classes_invalid")
negative.splitChangeRejected = rejects(() => { const value = structuredClone(authorization); value.taskIdentity.splitCounts.train = 49; validateAuthorizationContract(value, authorizationArgument) }, "authorization_split_counts_invalid")
negative.forbiddenActionActivationRejected = rejects(() => { const value = structuredClone(authorization); value.allowedActions.push("start_gpu"); validateAuthorizationContract(value, authorizationArgument) }, "authorization_allowed_actions_not_exact")
negative.unknownAllowedActionRejected = rejects(() => { const value = structuredClone(authorization); value.allowedActions.push("unknown_action"); validateAuthorizationContract(value, authorizationArgument) }, "authorization_allowed_actions_not_exact")
negative.failedPreviewOrReviewLabelTrainingTargetRejected = rejects(() => { const value = structuredClone(authorization); value.allowedActions.push("use_failed_preview_pixels_or_review_labels_as_training_targets"); validateAuthorizationContract(value, authorizationArgument) }, "authorization_allowed_actions_not_exact")
negative.missingRecordRejected = rejects(() => selectApprovedRecords({ samples: sourceIndex.samples.filter((row) => row.sampleId !== rows[0].sampleId) }), "approved_record_count_invalid")
negative.duplicateReferenceRejected = rejects(() => { const copy = structuredClone(sourceIndex); const selected = copy.samples.filter((row) => row.v7CapacityContributionRegistered === true); selected[1].imageSha256 = selected[0].imageSha256; selectApprovedRecords(copy) }, "approved_reference_rgb_duplicate")
negative.maskExchangeRejected = await rejectsAsync(async () => { const value = structuredClone(sample194); const record = JSON.parse(fs.readFileSync(resolveProjectPath(value.sourceRecordPath), "utf8")); const pack = JSON.parse(fs.readFileSync(resolveProjectPath(value.conditionPackPath), "utf8")); const tree = pack.channels.find((item) => item.id === "object_tree"); value.conditionPackPath = value.sourceRecordPath; await auditOneRecord(value); void record; void tree }, "condition_pack_path_mismatch")
negative.conditionPackClassIdentityMismatchRejected = await rejectsAsync(async () => {
  const value = structuredClone(sample194)
  const review = JSON.parse(fs.readFileSync(resolveProjectPath(value.machineReviewPath), "utf8"))
  review.semanticConditionAudit.conditionPackFileSha256 = "0".repeat(64)
  const temporaryReview = resolveProjectPath(`.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-alignment-audit-20260812-144400508/cpu-negative-machine-review.json`)
  fs.writeFileSync(temporaryReview, `${JSON.stringify(review, null, 2)}\n`, "utf8")
  value.machineReviewPath = path.relative(ROOT, temporaryReview).replace(/\\/g, "/")
  value.machineReviewSha256 = sha256(fs.readFileSync(temporaryReview))
  try { await auditOneRecord(value) } finally { fs.unlinkSync(temporaryReview) }
}, "historical_condition_pack_hash_mismatch")

const failedPositiveKeys = Object.entries(positive).filter(([, value]) => !value).map(([key]) => key)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => !value).map(([key]) => key)
const report = {
  schemaVersion: "stage4-object-reference-supervision-audit-cpu-regression-v1",
  status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? "passed" : "failed",
  positive,
  negative,
  failedPositiveKeys,
  failedNegativeKeys,
  auditorSha256: sha256(fs.readFileSync(resolveProjectPath("scripts/lib/ai-assisted-condition-alignment.mjs"))),
  runnerSha256: sha256(fs.readFileSync(resolveProjectPath("scripts/run-stage4-object-reference-supervision-audit.mjs"))),
}
console.log(JSON.stringify(report, null, 2))
if (report.status !== "passed") process.exitCode = 1

function rejects(fn, message) { try { fn(); return false } catch (error) { return String(error.message).includes(message) } }
async function rejectsAsync(fn, message) { try { await fn(); return false } catch (error) { return String(error.message).includes(message) } }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path_escapes_project:${value}`); return resolved }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function assert(condition, message) { if (!condition) throw new Error(message) }
