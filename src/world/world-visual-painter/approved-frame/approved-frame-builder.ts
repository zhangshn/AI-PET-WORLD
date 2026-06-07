import type {
  WorldVisualAiImageCandidate,
  WorldVisualApprovedFrame,
  WorldVisualFactManifest,
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
  "candidate_fact_link",
  "candidate_license",
  "visual_style_quality",
  "world_structure_quality",
  "visual_artifact_rejection",
  "fact_and_rights_quality",
] as const

export function buildWorldVisualApprovedFrame(input: {
  factManifest: WorldVisualFactManifest
  aiImageCandidate: WorldVisualAiImageCandidate | null
  reviewReport: WorldVisualReviewReport
}): WorldVisualApprovedFrame | null {
  if (!input.aiImageCandidate) return null
  if (input.aiImageCandidate.canShowToPlayer !== false) return null
  if (!isApprovedImageFormat(input.aiImageCandidate.imageFormat)) return null
  if (!isApprovedLicense(input.aiImageCandidate.license)) return null
  if (!input.aiImageCandidate.originalityConfirmed) return null
  if (!candidateKeepsFactLinks(input.aiImageCandidate, input.factManifest)) {
    return null
  }

  if (input.reviewReport.status !== "passed_candidate") return null
  if (input.reviewReport.canShowToPlayer !== false) return null
  if (input.reviewReport.score < MIN_APPROVAL_SCORE) return null
  if (!requiredReviewChecksPassed(input.reviewReport)) return null

  return {
    frameId: `approved-frame-${input.factManifest.worldId}-${input.factManifest.tick}`,
    approvedAt: new Date().toISOString(),
    sourceImageCandidateId: input.aiImageCandidate.candidateId,
    reviewScore: input.reviewReport.score,
    imageUrl: input.aiImageCandidate.imageUrl,
    imageFormat: input.aiImageCandidate.imageFormat,
    width: input.aiImageCandidate.width,
    height: input.aiImageCandidate.height,
    canShowToPlayer: true,
    approvalReason: {
      zh: "AI 位图候选图已通过完整 VisualJudge 硬闸门：真实图片本体、格式尺寸、事实链、授权原创、视觉质量与污染排除均通过，允许进入 Runtime Render 展示阶段。",
      en: "The AI bitmap candidate passed the full VisualJudge hard gate: real image bytes, format and size, fact links, license and originality, visual quality, and artifact rejection all passed. It may enter Runtime Render.",
    },
    sourceFactIds: input.factManifest.sourceFactIds,
    tags: [
      "approved_frame",
      "ai_bitmap_candidate_approved",
      "runtime_render_ready",
      "world_facts_preserved",
      "visual_review_passed",
      "hard_gate_passed",
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

function candidateKeepsFactLinks(
  candidate: WorldVisualAiImageCandidate,
  factManifest: WorldVisualFactManifest
): boolean {
  if (candidate.promptPackageId.length === 0) return false
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