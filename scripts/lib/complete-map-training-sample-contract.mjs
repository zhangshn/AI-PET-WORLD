export const SAMPLE_SCHEMA_VERSION = "complete-map-training-sample-v1"
export const REGISTRATION_REQUEST_SCHEMA_VERSION = "complete-map-sample-registration-request-v1"
export const STRICT_PROJECT_OWNED_IP_POLICY_VERSION = "strict-project-owned-training-data-v1"
export const ALLOWED_SAMPLE_TYPES = new Set([
  "complete_map_positive",
  "negative_sample",
  "machine_negative",
  "transition_sample",
  "judge_gap_record",
])
export const ALLOWED_SOURCE_TYPES = new Set([
  "owner_created",
  "owner_authorized",
  "commissioned_full_assignment",
  "local_model_generated",
  "program_structure",
])
export const BLOCKED_SOURCE_TYPES = new Set([
  "external_unreviewed",
  "external_model_generated",
  "online_model_generated",
  "openai_generated",
  "unknown",
])
export const ALLOWED_SPLITS = new Set(["train", "validation", "challenge", "regression"])
export const ALLOWED_TRANSITIONS = new Set(["grass_to_path", "grass_to_water", "object_to_ground"])

export function validateRegistrationRequest(request, currentDictionaryVersion) {
  const failures = []
  check(request?.schemaVersion === REGISTRATION_REQUEST_SCHEMA_VERSION, failures, "invalid_registration_request_schema")
  check(ALLOWED_SAMPLE_TYPES.has(request?.sampleType), failures, "unsupported_sample_type")
  check(ALLOWED_SOURCE_TYPES.has(request?.sourceType), failures, "source_type_not_allowed")
  check(!BLOCKED_SOURCE_TYPES.has(request?.sourceType), failures, "blocked_source_type")
  check(typeof request?.imagePath === "string" && /\.(png|jpe?g)$/i.test(request.imagePath), failures, "image_path_missing_or_not_supported")
  check(request?.dictionaryVersionId === currentDictionaryVersion, failures, "dictionary_version_not_current")
  check(ALLOWED_SPLITS.has(request?.split), failures, "dataset_split_missing_or_invalid")
  check(typeof request?.sourcePath === "string" && request.sourcePath.length > 0, failures, "source_path_missing")
  check(validLicense(request), failures, "source_license_missing_or_not_allowed")
  check(typeof request?.blueprintHash === "string" && /^[a-f0-9]{64}$/i.test(request.blueprintHash), failures, "blueprint_hash_missing_or_invalid")
  check(nonEmpty(request?.conditionHashes) && request.conditionHashes.every(isSha256), failures, "condition_hashes_missing_or_invalid")
  check(typeof request?.directorPlanId === "string" && request.directorPlanId.length > 0, failures, "director_plan_id_missing")
  check(typeof request?.taskPackageId === "string" && request.taskPackageId.length > 0, failures, "task_package_id_missing")
  check(typeof request?.trainingUsage === "string" && request.trainingUsage.length > 0, failures, "training_usage_missing")
  check(typeof request?.machineReviewStatus === "string" && request.machineReviewStatus.length > 0, failures, "machine_review_status_missing")
  check(typeof request?.ownerReviewStatus === "string" && request.ownerReviewStatus.length > 0, failures, "owner_review_status_missing")
  validateTypeSpecific(request, failures)
  validateSourceSpecific(request, failures)
  validateIndependentTrainingClaim(request, failures)
  return failures
}

export function validateRegisteredSampleRecord(record, currentDictionaryVersion) {
  const failures = []
  check(record?.schemaVersion === SAMPLE_SCHEMA_VERSION, failures, "invalid_sample_schema")
  check(typeof record?.sampleId === "string" && record.sampleId.length > 0, failures, "sample_id_missing")
  check(ALLOWED_SAMPLE_TYPES.has(record?.sampleType), failures, "unsupported_sample_type")
  check(ALLOWED_SOURCE_TYPES.has(record?.sourceType), failures, "source_type_not_allowed")
  check(!BLOCKED_SOURCE_TYPES.has(record?.sourceType), failures, "blocked_source_type")
  check(typeof record?.imagePath === "string" && /\.(png|jpe?g)$/i.test(record.imagePath), failures, "image_path_missing_or_not_supported")
  check(isSha256(record?.imageSha256), failures, "image_sha256_missing_or_invalid")
  check(record?.dictionaryVersionId === currentDictionaryVersion, failures, "dictionary_version_not_current")
  check(ALLOWED_SPLITS.has(record?.split), failures, "dataset_split_missing_or_invalid")
  check(typeof record?.sourcePath === "string" && record.sourcePath.length > 0, failures, "source_path_missing")
  check(validLicense(record), failures, "source_license_missing_or_not_allowed")
  check(isSha256(record?.blueprintHash), failures, "blueprint_hash_missing_or_invalid")
  check(nonEmpty(record?.conditionHashes) && record.conditionHashes.every(isSha256), failures, "condition_hashes_missing_or_invalid")
  check(typeof record?.directorPlanId === "string" && record.directorPlanId.length > 0, failures, "director_plan_id_missing")
  check(typeof record?.taskPackageId === "string" && record.taskPackageId.length > 0, failures, "task_package_id_missing")
  check(typeof record?.trainingUsage === "string" && record.trainingUsage.length > 0, failures, "training_usage_missing")
  check(typeof record?.createdAtUtc === "string" && !Number.isNaN(Date.parse(record.createdAtUtc)), failures, "created_at_utc_missing_or_invalid")
  check(typeof record?.createdAtAsiaShanghai === "string" && record.createdAtAsiaShanghai.endsWith("+08:00"), failures, "created_at_shanghai_missing_or_invalid")
  check(typeof record?.recordPath === "string" && record.recordPath.length > 0, failures, "record_path_missing")
  validateTypeSpecific(record, failures)
  validateSourceSpecific(record, failures)
  validateIndependentTrainingClaim(record, failures)
  return failures
}

function validateIndependentTrainingClaim(value, failures) {
  if (value?.independentTrainingEligible !== true) return
  check(value.trainingDataProvenance === "independent-training-eligible", failures, "independent_training_provenance_missing")
  check(typeof value.conditionPackPath === "string" && value.conditionPackPath.length > 0, failures, "independent_sample_condition_pack_missing")
  check(["owner_created", "commissioned_full_assignment", "local_model_generated"].includes(value.sourceType), failures, "independent_sample_source_not_strictly_project_owned")
  validateStrictProjectOwnedIpProvenance(value, failures)
  if (value.sourceType === "local_model_generated") {
    check(value.modelOwnership === "project_owned_independent_weights", failures, "independent_sample_model_ownership_invalid")
    check(Array.isArray(value.upstreamModelIds) && value.upstreamModelIds.length === 0, failures, "independent_sample_upstream_model_dependency_present")
    check(value.thirdPartyGeneratedTrainingOutputUsed === false, failures, "independent_sample_third_party_output_status_invalid")
  }
}

function validateStrictProjectOwnedIpProvenance(value, failures) {
  const provenance = value?.ipProvenance
  check(provenance?.policyVersion === STRICT_PROJECT_OWNED_IP_POLICY_VERSION, failures, "ip_policy_version_missing_or_invalid")
  check(typeof provenance?.rightsHolderId === "string" && provenance.rightsHolderId.length > 0, failures, "ip_rights_holder_missing")
  check(provenance?.thirdPartyContentUsed === false, failures, "ip_third_party_content_must_be_false")
  check(provenance?.thirdPartyGenerativeModelUsed === false, failures, "ip_third_party_generative_model_must_be_false")
  check(provenance?.copiedFromExistingWork === false, failures, "ip_copy_status_must_be_false")
  check(provenance?.worldwideCommercialRights === true, failures, "ip_worldwide_commercial_rights_missing")
  check(provenance?.modelTrainingRights === true, failures, "ip_model_training_rights_missing")
  check(provenance?.derivativeWorksRights === true, failures, "ip_derivative_rights_missing")
  check(provenance?.transferAndSublicenseRights === true, failures, "ip_transfer_rights_missing")
  check(validStringArray(provenance?.evidencePaths), failures, "ip_evidence_paths_missing")
  check(provenance?.reviewStatus === "approved", failures, "ip_review_not_approved")
  check(typeof provenance?.reviewedBy === "string" && provenance.reviewedBy.length > 0, failures, "ip_reviewer_missing")
  check(typeof provenance?.reviewedAtUtc === "string" && !Number.isNaN(Date.parse(provenance.reviewedAtUtc)), failures, "ip_review_time_missing_or_invalid")
  check(value?.sourceLicense?.rightsHolderId === provenance?.rightsHolderId, failures, "ip_rights_holder_mismatch")

  const expectedMethod = {
    owner_created: "project_owner_original_human_created",
    commissioned_full_assignment: "commissioned_original_full_assignment",
    local_model_generated: "project_owned_independent_model",
  }[value?.sourceType]
  check(provenance?.creationMethod === expectedMethod, failures, "ip_creation_method_invalid")
  if (value?.sourceType === "commissioned_full_assignment") {
    check(typeof provenance?.assignmentAgreementPath === "string" && provenance.assignmentAgreementPath.length > 0, failures, "ip_assignment_agreement_missing")
  }
  if (value?.registeredByProgram === true) {
    check(isSha256(value.sourceFileSha256), failures, "ip_source_file_hash_missing")
    check(isSha256(value.conditionPackFileSha256), failures, "ip_condition_pack_file_hash_missing")
    check(Array.isArray(value.ipEvidenceHashes) && value.ipEvidenceHashes.length > 0, failures, "ip_evidence_hashes_missing")
    check(value.ipEvidenceHashes?.every((item) => typeof item?.path === "string" && isSha256(item?.sha256) && Number.isInteger(item?.bytes) && item.bytes > 0), failures, "ip_evidence_hash_record_invalid")
    check(value.ipProvenanceVerifiedByProgram === true, failures, "ip_provenance_program_verification_missing")
  }
}

function validateTypeSpecific(value, failures) {
  if (value?.sampleType === "complete_map_positive") {
    check(value.ownerReviewStatus === "approved", failures, "positive_requires_owner_approved")
    check(value.ownerApproval?.status === "approved", failures, "positive_owner_approval_record_missing")
    check(nonEmpty(value.visualTags), failures, "positive_visual_tags_missing")
    check(nonEmpty(value.qualityTags), failures, "positive_quality_tags_missing")
    check(value.trainingUsage === "positive", failures, "positive_training_usage_invalid")
    check(value.sourceType !== "program_structure", failures, "program_structure_cannot_be_positive_rgb")
  }
  if (value?.sampleType === "negative_sample") {
    check(value.sampleScope === "complete_map", failures, "negative_sample_scope_invalid")
    check(value.ownerReviewStatus === "rejected", failures, "negative_requires_owner_rejected")
    check(typeof value.rejectedBy === "string" && value.rejectedBy.length > 0, failures, "negative_rejected_by_missing")
    check(value.mustNotTrainAsPositive === true, failures, "negative_positive_training_block_missing")
    check(nonEmpty(value.failureCodes), failures, "negative_failure_codes_missing")
    check(nonEmpty(value.failureRegions), failures, "negative_failure_regions_missing")
    check(nonEmpty(value.rootCauses), failures, "negative_root_causes_missing")
    check(typeof value.nextTrainingTask === "string" && value.nextTrainingTask.length > 0, failures, "negative_next_training_task_missing")
    check(value.trainingUsage === "negative", failures, "negative_training_usage_invalid")
  }
  if (value?.sampleType === "machine_negative") {
    check(value.sampleScope === "complete_map", failures, "machine_negative_sample_scope_invalid")
    check(value.machineReviewStatus === "machine_rejected", failures, "machine_negative_requires_machine_rejected")
    check(value.ownerReviewStatus === "not_reached_machine_failed", failures, "machine_negative_owner_status_invalid")
    check(value.rejectedBy === "complete_map_machine_review", failures, "machine_negative_rejected_by_invalid")
    check(value.mustNotTrainAsPositive === true, failures, "machine_negative_positive_training_block_missing")
    check(nonEmpty(value.failureCodes), failures, "machine_negative_failure_codes_missing")
    check(nonEmpty(value.failureRegions), failures, "machine_negative_failure_regions_missing")
    check(nonEmpty(value.rootCauses), failures, "machine_negative_root_causes_missing")
    check(typeof value.nextTrainingTask === "string" && value.nextTrainingTask.length > 0, failures, "machine_negative_next_training_task_missing")
    check(value.trainingUsage === "negative", failures, "machine_negative_training_usage_invalid")
  }
  if (value?.sampleType === "transition_sample") {
    check(ALLOWED_TRANSITIONS.has(value.transitionId), failures, "transition_id_invalid")
    check(["positive", "negative"].includes(value.polarity), failures, "transition_polarity_invalid")
    check(["approved", "rejected"].includes(value.reviewStatus), failures, "transition_review_status_invalid")
    check(nonEmpty(value.failureCodes ?? value.qualityTags), failures, "transition_labels_missing")
    check(value.trainingUsage === `transition_${value.polarity}`, failures, "transition_training_usage_invalid")
  }
  if (value?.sampleType === "judge_gap_record") {
    check(value.machineDecision === "passed", failures, "judge_gap_machine_decision_invalid")
    check(value.ownerDecision === "rejected", failures, "judge_gap_owner_decision_invalid")
    check(nonEmpty(value.failureCodes), failures, "judge_gap_failure_codes_missing")
    check(typeof value.sourceReviewRecordId === "string" && value.sourceReviewRecordId.length > 0, failures, "judge_gap_source_review_missing")
    check(value.trainingUsage === "judge_gap_negative", failures, "judge_gap_training_usage_invalid")
  }
}

function validateSourceSpecific(value, failures) {
  if (value?.sourceType === "local_model_generated") {
    check(typeof value.modelVersion === "string" && value.modelVersion.length > 0, failures, "local_model_version_missing")
    check(typeof value.checkpoint === "string" && value.checkpoint.length > 0, failures, "local_model_checkpoint_missing")
    check(Number.isInteger(value.seed) || (typeof value.seed === "string" && value.seed.length > 0), failures, "local_model_seed_missing")
  }
  if (value?.sourceType === "program_structure") {
    check(value.sampleType !== "complete_map_positive", failures, "program_structure_cannot_be_positive_rgb")
    check(value.sourceLicense?.status === "structure_only", failures, "program_structure_license_invalid")
  }
  if (value?.sourceType === "commissioned_full_assignment") {
    check(typeof value.sourceLicense?.assignmentAgreementRef === "string" && value.sourceLicense.assignmentAgreementRef.length > 0, failures, "commissioned_assignment_reference_missing")
  }
}

function validLicense(value) {
  const status = value?.sourceLicense?.status
  if (value?.sourceType === "owner_created") return status === "project_owned"
  if (value?.sourceType === "owner_authorized") {
    return status === "owner_authorized_for_training" && typeof value.sourceLicense?.authorizationRef === "string" && value.sourceLicense.authorizationRef.length > 0
  }
  if (value?.sourceType === "commissioned_full_assignment") {
    return status === "project_owned_by_assignment"
      && typeof value.sourceLicense?.assignmentAgreementRef === "string"
      && value.sourceLicense.assignmentAgreementRef.length > 0
  }
  if (value?.sourceType === "local_model_generated") return status === "project_generated"
  if (value?.sourceType === "program_structure") return status === "structure_only"
  return false
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)
}

function nonEmpty(value) {
  return Array.isArray(value) && value.length > 0
}

function validStringArray(value) {
  return nonEmpty(value) && value.every((item) => typeof item === "string" && item.length > 0)
}

function check(condition, failures, code) {
  if (!condition && !failures.includes(code)) failures.push(code)
}
