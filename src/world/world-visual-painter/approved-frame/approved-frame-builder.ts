import type {
  WorldVisualAiImageCandidate,
  WorldVisualApprovedFrame,
  WorldVisualFactManifest,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

const MIN_APPROVAL_SCORE = 88

export function buildWorldVisualApprovedFrame(input: {
  factManifest: WorldVisualFactManifest
  aiImageCandidate: WorldVisualAiImageCandidate | null
  reviewReport: WorldVisualReviewReport
}): WorldVisualApprovedFrame | null {
  if (!input.aiImageCandidate) return null
  if (input.reviewReport.status !== "passed_candidate") return null
  if (input.reviewReport.score < MIN_APPROVAL_SCORE) return null

  return {
    frameId: `approved-frame-${input.factManifest.worldId}-${input.factManifest.tick}`,
    approvedAt: `tick-${input.factManifest.tick}`,
    sourceImageCandidateId: input.aiImageCandidate.candidateId,
    reviewScore: input.reviewReport.score,
    imageUrl: input.aiImageCandidate.imageUrl,
    imageFormat: input.aiImageCandidate.imageFormat,
    width: input.aiImageCandidate.width,
    height: input.aiImageCandidate.height,
    canShowToPlayer: true,
    approvalReason: {
      zh: "AI 位图候选图已通过视觉审核，事实来源链完整，允许进入 Runtime Render 展示阶段。",
      en: "The AI bitmap candidate passed visual review with an intact fact source chain and may enter Runtime Render.",
    },
    sourceFactIds: input.factManifest.sourceFactIds,
    tags: [
      "approved_frame",
      "ai_bitmap_candidate_approved",
      "runtime_render_ready",
      "world_facts_preserved",
      "visual_review_passed",
    ],
  }
}
