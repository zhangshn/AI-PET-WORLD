export { sameSourceFactIds as sameStringSet } from "../../runtime-core/source-fact-identity"
import type { WorldVisualApprovedFrame } from "../world-visual-painter-schema"

// Shared field and display-boundary projection. Actual image bytes, source
// identity and Runtime readiness still require the existing callers' checks.
export function approvedFrameHardFieldsValid(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  return (
    approvedFrame.canShowToPlayer === true &&
    typeof approvedFrame.sourceImageSha256 === "string" &&
    approvedFrame.sourceImageSha256.length === 64 &&
    typeof approvedFrame.sourceImageByteLength === "number" &&
    approvedFrame.sourceImageByteLength > 0 &&
    typeof approvedFrame.sourceImageContentType === "string" &&
    isApprovedContentType(approvedFrame.sourceImageContentType) &&
    approvedFrame.sourceImagePayloadQualityPassed === true
  )
}

export function approvedFrameGameWorldDisplayBoundaryPassed(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  const tags = new Set(approvedFrame.tags)

  return (
    approvedFrame.approvalScope === "approved_for_game_world" &&
    approvedFrame.productionApprovalStatus === "not_approved_for_production" &&
    approvedFrame.approvedForProduction === false &&
    approvedFrame.vj0Status === "vj_0_passed" &&
    approvedFrame.vj1Status === "vj_1_passed" &&
    String(approvedFrame.vj2Status) === "vj_2_passed" &&
    tags.has("game_world_ready_for_player") &&
    tags.has("formal_full_world_frame") &&
    !tags.has("controlled_mvp_player_visible_allowed") &&
    !tags.has("training_candidate") &&
    !tags.has("partial_or_crop_candidate")
  )
}

export function isApprovedContentType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpeg"
  )
}

