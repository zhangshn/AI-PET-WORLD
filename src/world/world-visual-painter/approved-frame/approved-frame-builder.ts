import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageGenerationRequest,
  WorldVisualApprovedFrame,
  WorldVisualFactManifest,
  WorldVisualGenerationCondition,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

const MIN_APPROVAL_SCORE = 88

const REQUIRED_REVIEW_CHECK_IDS = [
  "ai_image_candidate_metadata",
  "real_image_bytes",
  "image_byte_fingerprint",
  "image_metadata_matches_bytes",
  "mvp_image_size",
  "bitmap_payload_quality",
  "candidate_world_binding",
  "candidate_condition_binding",
  "candidate_source_kind",
  "candidate_generation_request",
  "candidate_fact_link",
  "candidate_license",
  "visual_style_quality",
  "world_structure_quality",
  "visual_artifact_rejection",
  "fact_and_rights_quality",
] as const

export function buildWorldVisualApprovedFrame(input: {
  factManifest: WorldVisualFactManifest
  generationCondition: WorldVisualGenerationCondition
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
  aiImageCandidate: WorldVisualAiImageCandidate | null
  reviewReport: WorldVisualReviewReport
}): WorldVisualApprovedFrame | null {
  if (!input.aiImageCandidate) return null
  if (input.aiImageCandidate.canShowToPlayer !== false) return null
  if (!isApprovedImageFormat(input.aiImageCandidate.imageFormat)) return null
  if (!isApprovedLicense(input.aiImageCandidate.license)) return null
  if (!input.aiImageCandidate.originalityConfirmed) return null
  if (!candidateBindsWorld(input.aiImageCandidate, input.generationCondition)) {
    return null
  }
  if (!candidateBindsGenerationCondition(input.aiImageCandidate, input.generationCondition)) {
    return null
  }
  if (!candidateUsesFormalSourceKind(input.aiImageCandidate)) return null
  if (
    !candidateBindsGenerationRequest(
      input.aiImageCandidate,
      input.generationCondition,
      input.aiImageGenerationRequest
    )
  ) {
    return null
  }
  if (!candidateKeepsFactLinks(input.aiImageCandidate, input.factManifest)) {
    return null
  }

  if (input.reviewReport.status !== "passed_candidate") return null
  if (input.reviewReport.canShowToPlayer !== false) return null
  if (input.reviewReport.score < MIN_APPROVAL_SCORE) return null
  if (!requiredReviewChecksPassed(input.reviewReport)) return null
  if (!imageInspectionSummaryCanApprove(input.reviewReport, input.aiImageCandidate)) {
    return null
  }

  const imageInspectionSummary = input.reviewReport.imageInspectionSummary

  return {
    frameId: `approved-frame-${input.factManifest.worldId}-${input.factManifest.tick}`,
    approvedAt: new Date().toISOString(),
    sourceImageCandidateId: input.aiImageCandidate.candidateId,
    reviewScore: input.reviewReport.score,
    imageUrl: input.aiImageCandidate.imageUrl,
    imageFormat: input.aiImageCandidate.imageFormat,
    width: input.aiImageCandidate.width,
    height: input.aiImageCandidate.height,
    sourceImageSha256: imageInspectionSummary.sha256,
    sourceImageByteLength: imageInspectionSummary.byteLength,
    sourceImageContentType: imageInspectionSummary.contentType,
    sourceImagePayloadQualityPassed:
      imageInspectionSummary.payloadQualityPassed,
    canShowToPlayer: true,
    approvalReason: {
      zh: "AI 位图候选图已通过 VJ-0 硬闸门，允许进入 Runtime Render 展示阶段。",
      en: "The AI bitmap candidate passed the VJ-0 hard gate and may enter Runtime Render.",
    },
    sourceFactIds: input.factManifest.sourceFactIds,
    tags: [
      "approved_frame",
      "ai_bitmap_candidate_approved",
      "runtime_render_ready",
      "world_facts_preserved",
      "visual_review_passed",
      "vj_0_hard_gate_passed",
      "image_byte_fingerprint_bound",
      "source_image_byte_length_bound",
      "source_image_content_type_bound",
      "source_image_payload_quality_passed",
      "world_generation_condition_bound",
      "formal_project_model_source_required",
      "approved_frame_display_gate_passed",
      "not_from_programmatic_renderer",
      "not_from_control_sketch",
    ],
  }
}

function requiredReviewChecksPassed(
  reviewReport: WorldVisualReviewReport
): boolean {
  const checkMap = new Map(
    reviewReport.checks.map((check) => [check.id, check.passed])
  )

  return REQUIRED_REVIEW_CHECK_IDS.every(
    (checkId) => checkMap.get(checkId) === true
  )
}

function imageInspectionSummaryCanApprove(
  reviewReport: WorldVisualReviewReport,
  candidate: WorldVisualAiImageCandidate
): reviewReport is WorldVisualReviewReport & {
  imageInspectionSummary: WorldVisualReviewReport["imageInspectionSummary"] & {
    sha256: string
    contentType: string
  }
} {
  const summary = reviewReport.imageInspectionSummary

  return (
    summary.ok === true &&
    summary.payloadQualityPassed === true &&
    typeof summary.sha256 === "string" &&
    summary.sha256.length === 64 &&
    typeof summary.byteLength === "number" &&
    summary.byteLength > 0 &&
    typeof summary.contentType === "string" &&
    isApprovedContentType(summary.contentType, candidate.imageFormat) &&
    summary.format === candidate.imageFormat &&
    summary.width === candidate.width &&
    summary.height === candidate.height
  )
}

function candidateBindsWorld(
  candidate: WorldVisualAiImageCandidate,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  return (
    generationCondition.worldId.length > 0 &&
    Number.isInteger(generationCondition.tick) &&
    generationCondition.tick >= 0 &&
    candidate.tags.includes(`world_id:${generationCondition.worldId}`) &&
    candidate.tags.includes(`tick:${generationCondition.tick}`)
  )
}

function candidateBindsGenerationCondition(
  candidate: WorldVisualAiImageCandidate,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  return (
    candidate.conditionId === generationCondition.conditionId &&
    candidate.modelVersion === generationCondition.modelVersion &&
    generationCondition.canShowToPlayer === false &&
    generationCondition.safetyCondition.requireVisualJudge === true &&
    generationCondition.safetyCondition.forbidProgrammaticFinalFrame === true &&
    generationCondition.safetyCondition.forbidPlaceholderFrame === true
  )
}

function candidateUsesFormalSourceKind(
  candidate: WorldVisualAiImageCandidate
): boolean {
  return (
    candidate.sourceKind === "project_model_generated" &&
    typeof candidate.modelVersion === "string" &&
    candidate.modelVersion.length > 0 &&
    !candidate.tags.includes("development_test_asset")
  )
}

function candidateBindsGenerationRequest(
  candidate: WorldVisualAiImageCandidate,
  generationCondition: WorldVisualGenerationCondition,
  request: WorldVisualAiImageGenerationRequest | null
): boolean {
  return (
    request !== null &&
    request.canShowToPlayer === false &&
    request.modelVersion === candidate.modelVersion &&
    request.condition.conditionId === generationCondition.conditionId &&
    request.condition.worldId === generationCondition.worldId &&
    request.condition.tick === generationCondition.tick &&
    request.output.width === candidate.width &&
    request.output.height === candidate.height &&
    request.output.imageFormat === candidate.imageFormat
  )
}

function candidateKeepsFactLinks(
  candidate: WorldVisualAiImageCandidate,
  factManifest: WorldVisualFactManifest
): boolean {
  if (candidate.conditionId.length === 0) return false
  if (candidate.sourceFactIds.length !== factManifest.sourceFactIds.length) {
    return false
  }

  const candidateFactIds = new Set(candidate.sourceFactIds)

  return factManifest.sourceFactIds.every((sourceFactId) =>
    candidateFactIds.has(sourceFactId)
  )
}

function isApprovedImageFormat(
  imageFormat: WorldVisualAiImageCandidate["imageFormat"]
): boolean {
  return imageFormat === "png" || imageFormat === "webp" || imageFormat === "jpg"
}

function isApprovedLicense(
  license: WorldVisualAiImageCandidate["license"]
): boolean {
  return (
    license === "self_owned" ||
    license === "cc0" ||
    license === "commercial_license"
  )
}

function isApprovedContentType(
  contentType: string,
  imageFormat: WorldVisualAiImageCandidate["imageFormat"]
): boolean {
  if (imageFormat === "png") return contentType === "image/png"
  if (imageFormat === "webp") return contentType === "image/webp"
  return contentType === "image/jpeg"
}
