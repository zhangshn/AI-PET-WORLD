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
  "candidate_source_fact_expression_channels",
  "candidate_license_metadata",
  "candidate_tags_not_used_as_quality_evidence",
] as const

type RuntimeBoundCandidate = WorldVisualAiImageCandidate & {
  worldId?: unknown
  tick?: unknown
}

type RuntimeBoundApprovedFrame = WorldVisualApprovedFrame & {
  worldId: string
  tick: number
}

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
  if (!factManifestBindsGenerationCondition(input.factManifest, input.generationCondition)) return null
  if (!candidateBindsWorld(input.aiImageCandidate, input.generationCondition)) return null
  if (!candidateBindsGenerationCondition(input.aiImageCandidate, input.generationCondition)) return null
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
  if (
    !candidateKeepsFactLinks(
      input.aiImageCandidate,
      input.factManifest,
      input.generationCondition
    )
  ) {
    return null
  }

  if (input.reviewReport.status !== "vj_1_passed") return null
  if (input.reviewReport.vj0Status !== "vj_0_passed") return null
  if (input.reviewReport.vj1Status !== "vj_1_passed") return null
  if (input.reviewReport.vj2Status !== "vj_2_not_implemented") return null
  if (input.reviewReport.approvalScope !== "approved_for_controlled_mvp") return null
  if (input.reviewReport.productionApprovalStatus !== "not_approved_for_production") return null
  if (input.reviewReport.canShowToPlayer !== false) return null
  if (input.reviewReport.score < MIN_APPROVAL_SCORE) return null
  if (!requiredReviewChecksPassed(input.reviewReport)) return null
  if (!vj2NotImplementedCheckPresent(input.reviewReport)) return null
  if (!imageInspectionSummaryCanApprove(input.reviewReport, input.aiImageCandidate)) return null

  const imageInspectionSummary = input.reviewReport.imageInspectionSummary
  const approvedFrame: RuntimeBoundApprovedFrame = {
    frameId: `approved-frame-${input.factManifest.worldId}-${input.factManifest.tick}`,
    worldId: input.factManifest.worldId,
    tick: input.factManifest.tick,
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
    sourceImagePayloadQualityPassed: imageInspectionSummary.payloadQualityPassed,
    approvalScope: "approved_for_controlled_mvp",
    productionApprovalStatus: "not_approved_for_production",
    approvedForProduction: false,
    vj0Status: "vj_0_passed",
    vj1Status: "vj_1_passed",
    vj2Status: "vj_2_not_implemented",
    canShowToPlayer: true,
    approvalReason: {
      zh: "AI 位图候选图已通过 VJ-0 文件/事实硬闸门和 VJ-1 确定性视觉质量检查；VJ-2 尚未实现，因此该帧仅作为受控 MVP ApprovedFrame。",
      en: "The AI bitmap candidate passed VJ-0 file/fact gates and VJ-1 deterministic visual-quality checks; VJ-2 is not implemented, so this remains a controlled MVP ApprovedFrame.",
    },
    sourceFactIds: input.factManifest.sourceFactIds,
    tags: [
      "approved_frame",
      `world_id:${input.factManifest.worldId}`,
      `tick:${input.factManifest.tick}`,
      "controlled_mvp_approved_frame",
      "approved_for_controlled_mvp",
      "not_approved_for_production",
      "approved_for_production_false",
      "runtime_render_ready_for_controlled_mvp",
      "world_facts_preserved",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_not_implemented",
      "image_byte_fingerprint_bound",
      "source_image_byte_length_bound",
      "source_image_content_type_bound",
      "source_image_payload_quality_passed",
      "world_generation_condition_bound",
      "runtime_bound_candidate_required",
      "formal_project_model_source_required",
      "candidate_tags_metadata_only",
      "candidate_tags_not_visual_quality_evidence",
      "approved_frame_display_gate_passed_for_controlled_mvp",
      "not_from_programmatic_renderer",
      "world_generation_condition_source",
    ],
  }

  return approvedFrame
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

function vj2NotImplementedCheckPresent(
  reviewReport: WorldVisualReviewReport
): boolean {
  const checkMap = new Map(reviewReport.checks.map((check) => [check.id, check]))
  const vj2 = checkMap.get("vj_2_not_implemented")

  return vj2?.passed === false && vj2.tags.includes("not_implemented")
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

function factManifestBindsGenerationCondition(
  factManifest: WorldVisualFactManifest,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  return (
    factManifest.worldId === generationCondition.worldId &&
    factManifest.tick === generationCondition.tick &&
    sameStringSet(factManifest.sourceFactIds, generationCondition.sourceFactIds)
  )
}

function candidateBindsWorld(
  candidate: WorldVisualAiImageCandidate,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  const runtimeCandidate = candidate as RuntimeBoundCandidate

  return (
    generationCondition.worldId.length > 0 &&
    Number.isInteger(generationCondition.tick) &&
    generationCondition.tick >= 0 &&
    runtimeCandidate.worldId === generationCondition.worldId &&
    runtimeCandidate.tick === generationCondition.tick &&
    candidate.tags.includes(`world_id:${generationCondition.worldId}`) &&
    candidate.tags.includes(`tick:${generationCondition.tick}`) &&
    candidate.tags.includes("runtime_bound_candidate")
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
    generationCondition.safetyCondition.preserveWorldFacts === true &&
    generationCondition.safetyCondition.requireVisualJudge === true &&
    generationCondition.safetyCondition.forbidProgrammaticFinalFrame === true &&
    generationCondition.safetyCondition.forbidPlaceholderFrame === true &&
    generationCondition.safetyCondition.forbidUnlicensedCopy === true
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
    request.condition.modelVersion === generationCondition.modelVersion &&
    request.condition.canShowToPlayer === false &&
    sameStringSet(request.condition.sourceFactIds, generationCondition.sourceFactIds) &&
    request.output.width === candidate.width &&
    request.output.height === candidate.height &&
    request.output.imageFormat === candidate.imageFormat
  )
}

function candidateKeepsFactLinks(
  candidate: WorldVisualAiImageCandidate,
  factManifest: WorldVisualFactManifest,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  if (candidate.conditionId.length === 0) return false
  if (!sameStringSet(candidate.sourceFactIds, factManifest.sourceFactIds)) return false
  if (!sameStringSet(candidate.sourceFactIds, generationCondition.sourceFactIds)) return false

  return true
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

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
