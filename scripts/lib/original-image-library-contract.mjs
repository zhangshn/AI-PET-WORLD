export const ORIGINAL_IMAGE_INTAKE_SCHEMA_VERSION = "original-image-intake-request-v1"
export const ORIGINAL_IMAGE_RECORD_SCHEMA_VERSION = "original-image-record-v1"
export const ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION = "original-image-library-index-v1"
export const ORIGINAL_IMAGE_COLLECTION_ID = "natural-home-v1"

export const ORIGINAL_IMAGE_CATEGORIES = new Set([
  "complete-maps",
  "terrain",
  "vegetation",
  "natural-objects",
  "transitions",
])

export const ORIGINAL_IMAGE_SOURCE_TYPES = new Set([
  "owner_created",
  "commissioned_full_assignment",
  "local_model_generated",
  "external_unreviewed",
  "external_model_generated",
  "online_model_generated",
  "openai_generated",
  "unknown",
])

export function validateOriginalImageIntakeRequest(request) {
  const failures = []
  check(request?.schemaVersion === ORIGINAL_IMAGE_INTAKE_SCHEMA_VERSION, failures, "invalid_intake_request_schema")
  check(ORIGINAL_IMAGE_CATEGORIES.has(request?.categoryId), failures, "invalid_original_image_category")
  check(typeof request?.title === "string" && request.title.trim().length > 0, failures, "title_missing")
  check(typeof request?.imagePath === "string" && /\.(png|jpe?g|webp)$/i.test(request.imagePath), failures, "image_path_missing_or_unsupported")
  check(ORIGINAL_IMAGE_SOURCE_TYPES.has(request?.source?.sourceType), failures, "source_type_missing_or_invalid")
  check(typeof request?.source?.creationMethod === "string" && request.source.creationMethod.length > 0, failures, "creation_method_missing")
  check(typeof request?.source?.rightsHolder === "string" && request.source.rightsHolder.length > 0, failures, "rights_holder_missing")
  for (const field of ["thirdPartyContentUsed", "thirdPartyGenerativeModelUsed", "copiedFromExistingWork"]) {
    check(typeof request?.source?.[field] === "boolean", failures, `${field}_missing`)
  }
  for (const field of ["worldProfileId", "biomeType", "snapshotId"]) {
    check(isSafeOriginalImageId(request?.worldBinding?.[field]), failures, `world_binding_${field}_missing_or_invalid`)
  }
  check(typeof request?.worldBinding?.snapshotPath === "string" && request.worldBinding.snapshotPath.length > 0, failures, "world_binding_snapshot_path_missing")
  check(typeof request?.worldBinding?.snapshotIsFinal === "boolean", failures, "world_binding_snapshot_finality_missing")
  validateCategoryClassification(request, failures)
  for (const field of ["layerFiles", "conditionFiles", "rightsFiles", "reviewFiles"]) {
    check(request?.[field] === undefined || validStringArray(request[field]), failures, `${field}_invalid`)
  }
  if (request?.source?.sourceType === "openai_generated") {
    check(isOwnerAuthorizedAiAssistedColdStartSource(request), failures, "openai_cold_start_authorization_or_provenance_missing")
  }
  return failures
}

export function directorySegmentsForRequest(request) {
  const category = request.categoryId
  const classification = request.classification ?? {}
  if (category === "complete-maps") return [category]
  if (category === "terrain") return [category, classification.terrainType, classification.stateId]
  if (category === "vegetation") {
    return [category, classification.plantKind, classification.speciesId, classification.lifeStage, classification.season]
  }
  if (category === "natural-objects") return [category, classification.objectKind, classification.stateId]
  if (category === "transitions") return [category, classification.transitionKind]
  return [category]
}

export function isBlockedOriginalImageSource(request) {
  if (isOwnerAuthorizedAiAssistedColdStartSource(request)) return false
  return request?.source?.thirdPartyContentUsed === true
    || request?.source?.thirdPartyGenerativeModelUsed === true
    || request?.source?.copiedFromExistingWork === true
    || ["external_unreviewed", "external_model_generated", "online_model_generated", "openai_generated", "unknown"].includes(request?.source?.sourceType)
}

export function isOwnerAuthorizedAiAssistedColdStartSource(request) {
  const source = request?.source
  const coldStart = request?.aiAssistedColdStart
  return source?.sourceType === "openai_generated"
    && source?.thirdPartyContentUsed === false
    && source?.thirdPartyGenerativeModelUsed === true
    && source?.copiedFromExistingWork === false
    && coldStart?.policyVersion === "owner-authorized-ai-assisted-cold-start-v1"
    && coldStart?.ownerAuthorizationRef === "conversation-owner-authorization-2026-07-13"
    && coldStart?.trainingLane === "ai_assisted_cold_start"
    && typeof coldStart?.generatorProvider === "string"
    && coldStart.generatorProvider.length > 0
    && typeof coldStart?.generatorSystem === "string"
    && coldStart.generatorSystem.length > 0
    && typeof coldStart?.promptEvidencePath === "string"
    && coldStart.promptEvidencePath.length > 0
}

export function isSafeOriginalImageId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{1,95}$/.test(value)
}

function validateCategoryClassification(request, failures) {
  const classification = request?.classification ?? {}
  const required = {
    "complete-maps": ["mapScope"],
    terrain: ["terrainType", "stateId"],
    vegetation: ["plantKind", "speciesId", "lifeStage", "season"],
    "natural-objects": ["objectKind", "stateId"],
    transitions: ["transitionKind"],
  }[request?.categoryId] ?? []
  for (const field of required) {
    check(isSafeOriginalImageId(classification[field]), failures, `classification_${field}_missing_or_invalid`)
  }
}

function validStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
}

function check(condition, failures, code) {
  if (!condition && !failures.includes(code)) failures.push(code)
}
