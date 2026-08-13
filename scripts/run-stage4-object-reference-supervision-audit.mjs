import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"

const ROOT = process.cwd()
export const REQUIRED_OBJECT_CLASSES = Object.freeze([
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
])
export const REQUIRED_SPLITS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })

export function validateAuthorizationContract(authorization, authorizationPath) {
  assert(!path.isAbsolute(authorizationPath), "authorization_absolute_path_rejected")
  assert(authorization.schemaVersion === "owner-authorized-stage4-object-reference-alignment-audit-v1", "authorization_schema_invalid")
  assert(authorization.status === "resolved_owner_authorized_unconsumed", "authorization_status_invalid")
  assert(authorization.requestId === authorization.ownerDecision?.commandRef, "authorization_command_ref_invalid")
  assert(authorization.ownerDecision?.scope === "one_cpu_readonly_object_to_reference_rgb_supervision_qualification_audit_for_existing_64_records", "authorization_scope_invalid")
  assert(authorization.taskIdentity?.recordCount === 64, "authorization_record_count_invalid")
  assert(sameJson(authorization.taskIdentity?.splitCounts, REQUIRED_SPLITS), "authorization_split_counts_invalid")
  assert(sameJson(authorization.taskIdentity?.requiredObjectClasses, REQUIRED_OBJECT_CLASSES), "authorization_object_classes_invalid")
  assert(authorization.executionLimits?.auditCount === 1, "authorization_audit_count_invalid")
  assert(authorization.executionLimits?.automaticRetryAuthorized === false, "authorization_retry_boundary_invalid")
  assert(authorization.executionLimits?.checkpointContentReadAuthorized === false, "authorization_checkpoint_boundary_invalid")
  assert(authorization.executionLimits?.gpuAuthorized === false, "authorization_gpu_boundary_invalid")
  assert(authorization.executionLimits?.trainingAuthorized === false, "authorization_training_boundary_invalid")
  const requiredAllowed = [
    "add_thin_batch_entry_to_existing_condition_alignment_auditor",
    "add_cpu_positive_negative_contract_checker",
    "read_existing_reference_rgb_condition_packs_masks_and_non_checkpoint_records",
    "execute_one_cpu_readonly_64_record_object_reference_alignment_audit",
    "write_immutable_cpu_report",
    "write_per_record_audit_results",
    "write_versioned_supervision_qualification_manifest",
    "write_owner_disposition_request_if_needed",
    "write_terminal_evidence",
    "synchronize_unique_plan_and_local_task_capsule",
  ]
  assert(sameJson(authorization.allowedActions, requiredAllowed), "authorization_allowed_actions_not_exact")
  for (const action of requiredAllowed) assert(authorization.allowedActions?.includes(action), `authorization_allowed_action_missing:${action}`)
  const forbidden = [
    "modify_condition_alignment_algorithm", "modify_review_thresholds", "modify_historical_machine_reviews",
    "modify_reference_rgb", "modify_condition_packs_or_masks", "modify_dataset_split",
    "read_checkpoint_weight_content", "load_checkpoint", "create_optimizer", "execute_backward",
    "modify_model_weights", "start_gpu", "start_smoke", "start_training",
    "generate_model_architecture_candidate", "generate_parameter_candidate",
    "use_failed_preview_pixels_or_review_labels_as_training_targets", "start_stage4_full_training",
    "start_stage5_strict_revalidation", "start_formal_inference", "promote_checkpoint",
    "perform_owner_final_visual_review", "create_runtime_frame", "enter_world", "automatic_retry",
  ]
  for (const action of forbidden) {
    assert(authorization.deniedActions?.includes(action), `authorization_denied_action_missing:${action}`)
    assert(!authorization.allowedActions?.includes(action), `authorization_forbidden_action_allowed:${action}`)
  }
  for (const binding of Object.values(authorization.immutableSourceBindings ?? {})) {
    const resolved = resolveProjectPath(binding.path)
    assert(fs.existsSync(resolved), `authorization_source_missing:${binding.path}`)
    assert(sha256(fs.readFileSync(resolved)) === binding.sha256, `authorization_source_hash_mismatch:${binding.path}`)
  }
  const expectedOutput = `.runtime/ai-painter/stage4-object-reference-supervision-audits/${authorization.taskIdentity.outputRunId}`
  assert(authorization.taskIdentity.outputNamespace === expectedOutput, "authorization_output_namespace_invalid")
  return authorization
}

export function selectApprovedRecords(sourceIndex) {
  const rows = (sourceIndex.samples ?? []).filter((row) => row.v7CapacityContributionRegistered === true)
  assert(rows.length === 64, "approved_record_count_invalid")
  const splits = Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length]))
  assert(sameJson(splits, REQUIRED_SPLITS), "approved_record_split_invalid")
  assert(new Set(rows.map((row) => row.sampleId)).size === 64, "approved_sample_identity_duplicate")
  assert(new Set(rows.map((row) => row.imageSha256)).size === 64, "approved_reference_rgb_duplicate")
  assert(new Set(rows.map((row) => row.conditionPackPath)).size === 64, "approved_condition_pack_duplicate")
  return rows
}

export async function auditOneRecord(row) {
  verifyBoundFile(row.imagePath, row.imageSha256, "reference_rgb")
  verifyBoundFile(row.sourceRecordPath, row.sourceRecordSha256, "source_record")
  verifyBoundFile(row.machineReviewPath, row.machineReviewSha256, "historical_machine_review")
  verifyBoundFile(row.ownerReviewPath, row.ownerReviewSha256, "historical_owner_review")
  const sourceRecord = readJson(resolveProjectPath(row.sourceRecordPath))
  const historicalMachineReview = readJson(resolveProjectPath(row.machineReviewPath))
  assert(sourceRecord.recordId === row.recordId, "source_record_identity_mismatch")
  assert(sourceRecord.conditionBinding?.conditionPackPath === row.conditionPackPath, "condition_pack_path_mismatch")
  assert(sourceRecord.conditionBinding?.formalConditionalTrainingEligible === true, "v7_capacity_registration_not_formally_eligible")
  const conditionPackPath = resolveProjectPath(row.conditionPackPath)
  const conditionPackBytes = fs.readFileSync(conditionPackPath)
  const conditionPack = JSON.parse(conditionPackBytes.toString("utf8"))
  assert(historicalMachineReview.semanticConditionAudit?.conditionPackPath === row.conditionPackPath, "historical_condition_pack_path_mismatch")
  assert(historicalMachineReview.semanticConditionAudit?.conditionPackFileSha256 === sha256(conditionPackBytes), "historical_condition_pack_hash_mismatch")
  assert(sourceRecord.conditionBinding?.conditionPackSha256 === conditionPack.conditionPackSha256, "semantic_condition_pack_identity_mismatch")
  assert(conditionPack.channels?.length === 23, "condition_channel_count_invalid")
  const channels = Object.fromEntries(conditionPack.channels.map((channel) => [channel.id, channel]))
  for (const classId of REQUIRED_OBJECT_CLASSES) {
    const channel = channels[classId]
    assert(channel, `required_object_channel_missing:${classId}`)
    assert(channel.statistics?.nonZeroCount > 0, `required_object_channel_empty:${classId}`)
    verifyBoundFile(channel.path, channel.sha256, `object_mask:${classId}`)
  }
  const result = await auditAiAssistedConditionAlignment({
    record: sourceRecord,
    imagePath: row.imagePath,
    referenceImagePath: row.imagePath,
  })
  const objects = Object.fromEntries((result.objectSemanticAudits ?? []).filter((item) => REQUIRED_OBJECT_CLASSES.includes(item.channelId)).map((item) => [item.channelId, item]))
  assert(Object.keys(objects).length === REQUIRED_OBJECT_CLASSES.length, "object_audit_count_invalid")
  const classResults = REQUIRED_OBJECT_CLASSES.map((classId) => {
    const item = objects[classId]
    return {
      classId,
      maskPath: item.expectedChannelPath,
      maskSha256: item.expectedChannelSha256,
      expectedNonZeroRatio: item.expectedNonZeroRatio,
      visibleSemanticPresence: item.localResponsePassed === true,
      spatialAlignmentResult: item.passed ? "machine_alignment_passed" : "machine_alignment_failed",
      referenceComparisonMode: item.referenceComparisonMode,
      referenceResponse: item.referenceResponse,
      localVisualResponse: {
        inside: item.inside,
        surroundingRing: item.surroundingRing,
        colorDistance: item.colorDistance,
        edgeDifference: item.edgeDifference,
        edgeRatio: item.edgeRatio,
      },
      issueCodes: (item.issues ?? []).map((issue) => issue.code),
      passed: item.passed === true,
      ownerDispositionRequired: item.passed !== true,
    }
  })
  const passed = classResults.every((item) => item.passed)
  const objectInstanceTable = Array.isArray(conditionPack.objectInstanceTable) ? conditionPack.objectInstanceTable : []
  return {
    schemaVersion: "stage4-object-reference-supervision-record-audit-v1",
    sampleId: row.sampleId,
    recordId: row.recordId,
    split: row.split,
    status: passed ? "object_reference_alignment_qualified" : "owner_disposition_required",
    passed,
    referenceRgb: { path: row.imagePath, sha256: row.imageSha256 },
    conditionPack: { path: row.conditionPackPath, sha256: sha256(conditionPackBytes) },
    sourceRecord: { path: row.sourceRecordPath, sha256: row.sourceRecordSha256 },
    historicalMachineReview: { path: row.machineReviewPath, sha256: row.machineReviewSha256, modified: false },
    historicalOwnerReview: { path: row.ownerReviewPath, sha256: row.ownerReviewSha256, modified: false },
    objectInstanceTable: {
      instanceCount: objectInstanceTable.length,
      sha256: sha256(Buffer.from(JSON.stringify(objectInstanceTable))),
    },
    classResults,
    ambiguityOrOcclusionResult: passed ? "no_machine_detected_alignment_ambiguity" : "owner_disposition_required_for_failed_machine_alignment",
    failedPreviewPixelsUsed: false,
    reviewLabelsUsedAsTrainingTargets: false,
  }
}

async function main() {
  const authorizationArgument = argumentValue("--authorization")
  const consumptionArgument = argumentValue("--consumption")
  assert(authorizationArgument, "--authorization is required")
  assert(consumptionArgument, "--consumption is required")
  const authorizationPath = resolveProjectPath(authorizationArgument)
  const consumptionPath = resolveProjectPath(consumptionArgument)
  const authorizationBytes = fs.readFileSync(authorizationPath)
  const authorization = validateAuthorizationContract(JSON.parse(authorizationBytes.toString("utf8")), authorizationArgument)
  const consumption = readJson(consumptionPath)
  assert(consumption.status === "cpu_readonly_object_reference_alignment_audit_authorization_atomically_consumed", "consumption_status_invalid")
  assert(consumption.requestId === authorization.requestId, "consumption_request_id_invalid")
  assert(consumption.authorizationPath === authorizationArgument, "consumption_authorization_path_invalid")
  assert(consumption.authorizationSha256 === sha256(authorizationBytes), "consumption_authorization_hash_invalid")
  assert(consumption.oneTimeConsumption === true && consumption.auditOrdinal === 1, "consumption_ordinal_invalid")
  const outputDirectory = resolveProjectPath(authorization.taskIdentity.outputNamespace)
  assert(fs.existsSync(outputDirectory), "output_namespace_missing")
  assert(fs.readdirSync(outputDirectory).length === 0, "output_namespace_not_empty")
  const sourceIndexBinding = authorization.immutableSourceBindings.datasetSourceIndex
  const sourceIndex = readJson(resolveProjectPath(sourceIndexBinding.path))
  const rows = selectApprovedRecords(sourceIndex)
  const recordDirectory = path.join(outputDirectory, "records")
  fs.mkdirSync(recordDirectory)
  const summaries = []
  for (const row of rows) {
    const result = await auditOneRecord(row)
    const recordPath = path.join(recordDirectory, `${safeName(row.sampleId)}.json`)
    writeJson(recordPath, result)
    summaries.push({
      sampleId: row.sampleId,
      split: row.split,
      status: result.status,
      passed: result.passed,
      path: projectPath(recordPath),
      sha256: sha256(fs.readFileSync(recordPath)),
      failedClassIds: result.classResults.filter((item) => !item.passed).map((item) => item.classId),
    })
  }
  const failed = summaries.filter((item) => !item.passed)
  const manifest = {
    schemaVersion: "stage4-object-reference-supervision-qualification-manifest-v1",
    status: failed.length === 0 ? "supervision_alignment_qualification_completed" : "supervision_data_gap_confirmed_owner_disposition_required",
    runId: authorization.taskIdentity.outputRunId,
    recordedAtUtc: new Date().toISOString(),
    recordCount: summaries.length,
    qualifiedRecordCount: summaries.length - failed.length,
    ownerDispositionRequiredCount: failed.length,
    splitCounts: REQUIRED_SPLITS,
    requiredObjectClasses: REQUIRED_OBJECT_CLASSES,
    auditor: authorization.immutableSourceBindings.frozenConditionAlignmentAuditor,
    acceptanceThresholdsChanged: false,
    historicalMachineReviewsModified: false,
    sourceDataModified: false,
    records: summaries,
  }
  writeJson(path.join(outputDirectory, "supervision-qualification-manifest.json"), manifest)
  if (failed.length > 0) writeJson(path.join(outputDirectory, "owner-disposition-request.json"), {
    schemaVersion: "stage4-object-reference-owner-disposition-request-v1",
    status: "owner_decision_required_not_authorized",
    runId: authorization.taskIdentity.outputRunId,
    failedRecordCount: failed.length,
    allowedOwnerDecisions: ["retain_after_owner_visual_confirmation", "correct_source_supervision", "exclude_record", "replace_record"],
    automaticDecisionAllowed: false,
    failedRecords: failed,
  })
  console.log(JSON.stringify({ status: manifest.status, recordCount: summaries.length, qualifiedRecordCount: summaries.length - failed.length, ownerDispositionRequiredCount: failed.length }, null, 2))
}

function verifyBoundFile(filePath, expectedSha256, label) {
  const resolved = resolveProjectPath(filePath)
  assert(fs.existsSync(resolved), `${label}_missing`)
  assert(sha256(fs.readFileSync(resolved)) === expectedSha256, `${label}_hash_mismatch`)
}
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path_escapes_project:${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJson(filePath, value) { fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function safeName(value) { return value.replace(/[^a-zA-Z0-9._-]/g, "_") }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function assert(condition, message) { if (!condition) throw new Error(message) }

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main()
