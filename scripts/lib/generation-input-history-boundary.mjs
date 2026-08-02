import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const POLICY_VERSION =
  "all-prior-project-images-audit-only-never-generation-input-v1"
const CONDITION_GUIDE_ROLE =
  "authoritative_semantic_condition_guide"
const CONDITION_GUIDE_FILE_NAME = "condition-guide.png"
const HISTORICAL_IMAGE_PATH_PATTERN =
  /(?:^|[\\/])(?:original-image-library|complete-maps|candidates)(?:[\\/]|$)/i

export function buildAllHistoryGenerationInputBoundary() {
  return {
    policyVersion: POLICY_VERSION,
    scope: "all_prior_project_images_without_exception",
    currentConditionGuideOnly: true,
    allPriorRgbExcludedFromGenerator: true,
    allPriorConditionGuidesExcludedFromGenerator: true,
    allPriorInternalGeometryExcludedFromGenerator: true,
    allPriorCompositionSkeletonsExcludedFromGenerator: true,
    historicalImageReferenceCount: 0,
    historicalGeometryReferenceCount: 0,
    historicalEvidenceMayBeReadByAuditOnly: true,
    historicalAuditEvidenceForwardedToGenerator: false,
  }
}

export function validateGenerationInputHistoryBoundary({
  root,
  request,
  evidence,
  guideManifest,
  conditionPack,
  visualStandard,
}) {
  const issues = []
  const expectedBoundary =
    buildAllHistoryGenerationInputBoundary()

  check(
    sameJson(
      request?.allHistoryGenerationInputBoundary,
      expectedBoundary,
    ),
    issues,
    "request_all_history_generation_input_boundary_invalid",
  )
  check(
    sameJson(
      evidence?.allHistoryGenerationInputBoundary,
      expectedBoundary,
    ),
    issues,
    "evidence_all_history_generation_input_boundary_invalid",
  )
  check(
    request?.historicalCompleteMapImageReferencesUsed === false &&
      evidence?.historicalCompleteMapImageReferencesUsed === false,
    issues,
    "historical_complete_map_reference_flag_invalid",
  )
  check(
    Array.isArray(request?.referenceImagePaths) &&
      request.referenceImagePaths.length === 1,
    issues,
    "generation_must_have_exactly_one_current_condition_guide",
  )
  check(
    Array.isArray(request?.referenceImageRoles) &&
      request.referenceImageRoles.length === 1 &&
      request.referenceImageRoles[0] === CONDITION_GUIDE_ROLE,
    issues,
    "generation_reference_role_must_be_current_condition_guide",
  )
  check(
    Array.isArray(evidence?.styleReferences) &&
      evidence.styleReferences.length === 0 &&
      Array.isArray(evidence?.styleReferenceRecordIds) &&
      evidence.styleReferenceRecordIds.length === 0,
    issues,
    "historical_style_image_references_must_be_empty",
  )
  check(
    request?.preRgbConditionGuideNoveltyAudit === undefined &&
      evidence?.preRgbConditionGuideNoveltyAudit === undefined &&
      request?.preRgbConditionGuideNoveltyGate
        ?.historicalRecordIdsIncluded === false &&
      request?.preRgbConditionGuideNoveltyGate
        ?.historicalGuidePathsIncluded === false &&
      request?.preRgbConditionGuideNoveltyGate
        ?.historicalComparisonMetricsIncluded === false &&
      request?.preRgbConditionGuideNoveltyGate
        ?.auditEvidenceForwardedToGenerator === false &&
      evidence?.preRgbConditionGuideNoveltyGate
        ?.historicalRecordIdsIncluded === false &&
      evidence?.preRgbConditionGuideNoveltyGate
        ?.historicalGuidePathsIncluded === false &&
      evidence?.preRgbConditionGuideNoveltyGate
        ?.historicalComparisonMetricsIncluded === false &&
      evidence?.preRgbConditionGuideNoveltyGate
        ?.auditEvidenceForwardedToGenerator === false,
    issues,
    "historical_novelty_audit_details_forwarded_to_generator",
  )

  const conditionPackPath = resolveProjectPath(
    root,
    request?.conditionPackPath,
  )
  const expectedGuidePath = conditionPackPath
    ? path.join(
        path.dirname(conditionPackPath),
        CONDITION_GUIDE_FILE_NAME,
      )
    : null
  const requestGuidePath = resolveProjectPath(
    root,
    request?.referenceImagePaths?.[0],
  )
  const evidenceGuidePath = resolveProjectPath(
    root,
    evidence?.conditionGuidePath,
  )
  const manifestGuidePath = resolveProjectPath(
    root,
    guideManifest?.guidePath,
  )
  check(
    Boolean(expectedGuidePath) &&
      requestGuidePath === expectedGuidePath &&
      evidenceGuidePath === expectedGuidePath &&
      manifestGuidePath === expectedGuidePath,
    issues,
    "generation_reference_is_not_current_condition_pack_guide",
  )
  check(
    !HISTORICAL_IMAGE_PATH_PATTERN.test(
      request?.referenceImagePaths?.[0] ?? "",
    ),
    issues,
    "historical_project_image_path_supplied_to_generator",
  )
  check(
    guideManifest?.conditionPackId ===
      conditionPack?.conditionPackId &&
      guideManifest?.conditionPackPath ===
        request?.conditionPackPath &&
      guideManifest?.conditionPackSha256 ===
        conditionPack?.conditionPackSha256,
    issues,
    "condition_guide_not_bound_to_current_condition_pack",
  )
  check(
    guideManifest?.outputKind ===
      "semantic_condition_guide_not_training_rgb" &&
      guideManifest?.trainingTargetEligible === false &&
      guideManifest?.directWorldDisplayAllowed === false &&
      guideManifest?.programDrawnFinalArtUsed === false,
    issues,
    "condition_guide_output_boundary_invalid",
  )
  check(
    Boolean(requestGuidePath) &&
      fs.existsSync(requestGuidePath) &&
      sha256File(requestGuidePath) ===
        guideManifest?.guideSha256 &&
      guideManifest?.guideSha256 ===
        evidence?.conditionGuideSha256,
    issues,
    "current_condition_guide_hash_mismatch",
  )
  check(
    visualStandard
      ?.historicalCompleteMapRgbReferencesAllowed === false &&
      visualStandard
        ?.historicalCompleteMapRgbReferenceCount === 0 &&
      containsImageReferencePath(
        visualStandard?.generatorProfile,
      ) === false,
    issues,
    "foundational_visual_standard_is_not_aggregate_only",
  )
  const historicalRecordIds = (
    visualStandard?.sourceEvidence ?? []
  )
    .map((entry) => entry.recordId)
    .filter(Boolean)
  check(
    typeof evidence?.prompt === "string" &&
      !/(?:original-image-library|complete-maps)[^\n]*\.(?:png|jpe?g|webp|gif|bmp)/i.test(
        evidence.prompt,
      ) &&
      historicalRecordIds.every(
        (recordId) => !evidence.prompt.includes(recordId),
      ),
    issues,
    "historical_image_identity_leaked_into_generator_prompt",
  )
  return {
    passed: issues.length === 0,
    policyVersion: POLICY_VERSION,
    scope: expectedBoundary.scope,
    issues,
    generationInputImageCount:
      request?.referenceImagePaths?.length ?? 0,
    currentConditionGuidePath:
      request?.referenceImagePaths?.[0] ?? null,
    allPriorProjectImagesExcluded:
      issues.length === 0,
  }
}

export function assertGenerationInputHistoryBoundary(input) {
  const result =
    validateGenerationInputHistoryBoundary(input)
  if (!result.passed) {
    throw new Error(
      `all-history generation input boundary failed: ${result.issues.join(", ")}`,
    )
  }
  return result
}

function containsImageReferencePath(value) {
  if (Array.isArray(value)) {
    return value.some(containsImageReferencePath)
  }
  if (!value || typeof value !== "object") return false
  return Object.entries(value).some(
    ([key, child]) =>
      /(?:imagePath|referenceImage|sourceImage)/i.test(key) ||
      containsImageReferencePath(child),
  )
}

function resolveProjectPath(root, value) {
  if (typeof value !== "string" || !value) return null
  return path.resolve(root, value)
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function check(condition, issues, code) {
  if (!condition) issues.push(code)
}
