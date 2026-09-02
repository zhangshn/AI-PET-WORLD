import type {
  WorldVisualApprovedFrame,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

export type WorldRuntimeFrameGateInput = {
  approvedFrame: WorldVisualApprovedFrame | null
  reviewReport: WorldVisualReviewReport | null
  recordWorldId: string | null
  recordTick: number | null
  recordSourceFactIds: string[]
  recordCanShowToPlayer: boolean
  currentWorldId: string
  currentTick: number
  currentSourceFactIds: string[]
  runtimeFrameReady?: boolean
  runtimeFrameId?: string | null
  runtimeFrameBlockedReasons?: string[]
}

export type WorldRuntimeFrameGate = {
  canRuntimeRender: boolean
  runtimeGameInterfaceReady: boolean
  runtimeFrameId: string | null
  hardFieldsValid: boolean
  gameWorldDisplayBoundaryPassed: boolean
  reviewReportGameWorldPassed: boolean
  ownerFinalWorldApprovalPassed: boolean
  productionDisplayAllowed: false
  currentWorldMatched: boolean
  currentTickMatched: boolean
  currentFrameWorldMatched: boolean
  currentFrameTickMatched: boolean
  currentSourceFactsMatched: boolean
  currentFrameSourceFactsMatched: boolean
  sourceImageSha256Bound: boolean
  sourceImageByteLengthBound: boolean
  sourceImageContentTypeBound: boolean
  sourceImagePayloadQualityPassed: boolean
  canShowToPlayer: boolean
  canShowToPlayerScope: "game_runtime_frame_only"
  displayRule: string
  displayRuleEn: string
  blockedReasons: string[]
  tags: string[]
}

export function buildWorldRuntimeFrameGate(
  input: WorldRuntimeFrameGateInput
): WorldRuntimeFrameGate {
  const hardFieldsValid = input.approvedFrame
    ? approvedFrameHardFieldsValid(input.approvedFrame)
    : false
  const gameWorldDisplayBoundaryPassed = input.approvedFrame
    ? approvedFrameGameWorldDisplayBoundaryPassed(input.approvedFrame)
    : false
  const reviewReportGameWorldPassed = reviewReportGameWorldPassedForRuntime(
    input.reviewReport
  )
  // Preserve the legacy-shaped field for readers, but normal /world display
  // is decided by the machine review boundary, not an Owner ledger entry.
  const ownerFinalWorldApprovalPassed = gameWorldDisplayBoundaryPassed
  const currentWorldMatched = input.recordWorldId === input.currentWorldId
  const currentTickMatched = input.recordTick === input.currentTick
  const currentFrameWorldMatched =
    input.approvedFrame?.worldId === input.currentWorldId
  const currentFrameTickMatched = input.approvedFrame?.tick === input.currentTick
  const currentSourceFactsMatched = sameStringSet(
    input.recordSourceFactIds,
    input.currentSourceFactIds
  )
  const currentFrameSourceFactsMatched = input.approvedFrame
    ? sameStringSet(input.approvedFrame.sourceFactIds, input.currentSourceFactIds)
    : false
  const sourceImageSha256Bound =
    typeof input.approvedFrame?.sourceImageSha256 === "string" &&
    input.approvedFrame.sourceImageSha256.length === 64
  const sourceImageByteLengthBound =
    typeof input.approvedFrame?.sourceImageByteLength === "number" &&
    input.approvedFrame.sourceImageByteLength > 0
  const sourceImageContentTypeBound =
    typeof input.approvedFrame?.sourceImageContentType === "string" &&
    isApprovedContentType(input.approvedFrame.sourceImageContentType)
  const sourceImagePayloadQualityPassed =
    input.approvedFrame?.sourceImagePayloadQualityPassed === true

  // Formal /world output must be a composed game RuntimeFrame, not a raw image.
  // The RuntimeFrame builder owns the game viewport, camera, interaction shell,
  // and layer-composition readiness.
  const runtimeGameInterfaceReady = input.runtimeFrameReady === true

  const blockedReasons = buildBlockedReasons({
    recordCanShowToPlayer: input.recordCanShowToPlayer,
    approvedFrameCanShowToPlayer: input.approvedFrame?.canShowToPlayer === true,
    hardFieldsValid,
    gameWorldDisplayBoundaryPassed,
    reviewReportGameWorldPassed,
    runtimeGameInterfaceReady,
    currentWorldMatched,
    currentTickMatched,
    currentFrameWorldMatched,
    currentFrameTickMatched,
    currentSourceFactsMatched,
    currentFrameSourceFactsMatched,
  })

  const canRuntimeRender =
    input.recordCanShowToPlayer === true &&
    input.approvedFrame?.canShowToPlayer === true &&
    hardFieldsValid &&
    gameWorldDisplayBoundaryPassed &&
    reviewReportGameWorldPassed &&
    runtimeGameInterfaceReady &&
    currentWorldMatched &&
    currentTickMatched &&
    currentFrameWorldMatched &&
    currentFrameTickMatched &&
    currentSourceFactsMatched &&
    currentFrameSourceFactsMatched

  return {
    canRuntimeRender,
    runtimeGameInterfaceReady,
    runtimeFrameId: input.runtimeFrameId ?? null,
    hardFieldsValid,
    gameWorldDisplayBoundaryPassed,
    reviewReportGameWorldPassed,
    ownerFinalWorldApprovalPassed,
    productionDisplayAllowed: false,
    currentWorldMatched,
    currentTickMatched,
    currentFrameWorldMatched,
    currentFrameTickMatched,
    currentSourceFactsMatched,
    currentFrameSourceFactsMatched,
    sourceImageSha256Bound,
    sourceImageByteLengthBound,
    sourceImageContentTypeBound,
    sourceImagePayloadQualityPassed,
    canShowToPlayer: canRuntimeRender,
    canShowToPlayerScope: "game_runtime_frame_only",
    displayRule:
      "/world 只能展示完整游戏 RuntimeFrame。ApprovedFrame 只是视觉层凭证，训练图、局部图、候选图、单张图片都不能直接进入主世界页面。",
    displayRuleEn:
      "/world may only display a composed game RuntimeFrame. ApprovedFrame is only a visual-layer credential; training images, local crops, candidates, and raw single images must not be rendered directly on the main world page.",
    blockedReasons: [
      ...blockedReasons,
      ...(input.runtimeFrameBlockedReasons ?? []),
    ],
    tags: [
      "world_runtime_frame_gate",
      "runtime_frame_required_for_world",
      "single_approved_frame_direct_display_blocked",
      runtimeGameInterfaceReady
        ? "runtime_game_interface_ready"
        : "runtime_game_interface_not_implemented",
      hardFieldsValid ? "hard_fields_valid" : "hard_fields_invalid",
      gameWorldDisplayBoundaryPassed
        ? "game_world_display_boundary_passed"
        : "game_world_display_boundary_failed",
      reviewReportGameWorldPassed
        ? "review_report_game_world_passed"
        : "review_report_game_world_failed",
      ownerFinalWorldApprovalPassed
        ? "autonomous_machine_review_passed"
        : "autonomous_machine_review_missing",
      currentWorldMatched ? "current_world_matched" : "current_world_mismatch",
      currentTickMatched ? "current_tick_matched" : "current_tick_mismatch",
      currentFrameWorldMatched
        ? "current_frame_world_matched"
        : "current_frame_world_mismatch",
      currentFrameTickMatched
        ? "current_frame_tick_matched"
        : "current_frame_tick_mismatch",
      currentSourceFactsMatched
        ? "current_source_facts_matched"
        : "current_source_facts_mismatch",
      currentFrameSourceFactsMatched
        ? "current_frame_source_facts_matched"
        : "current_frame_source_facts_mismatch",
      canRuntimeRender
        ? "game_runtime_frame_render_allowed"
        : "runtime_render_blocked",
      "production_display_blocked",
    ],
  }
}

function buildBlockedReasons(input: {
  recordCanShowToPlayer: boolean
  approvedFrameCanShowToPlayer: boolean
  hardFieldsValid: boolean
  gameWorldDisplayBoundaryPassed: boolean
  reviewReportGameWorldPassed: boolean
  runtimeGameInterfaceReady: boolean
  currentWorldMatched: boolean
  currentTickMatched: boolean
  currentFrameWorldMatched: boolean
  currentFrameTickMatched: boolean
  currentSourceFactsMatched: boolean
  currentFrameSourceFactsMatched: boolean
}): string[] {
  const reasons: string[] = []
  if (!input.recordCanShowToPlayer) reasons.push("approved_frame_record_blocked")
  if (!input.approvedFrameCanShowToPlayer) reasons.push("approved_frame_blocked")
  if (!input.hardFieldsValid) reasons.push("hard_fields_invalid")
  if (!input.gameWorldDisplayBoundaryPassed) {
    reasons.push("game_world_display_boundary_failed")
  }
  if (!input.reviewReportGameWorldPassed) {
    reasons.push("review_report_game_world_failed")
  }
  if (!input.runtimeGameInterfaceReady) {
    reasons.push("runtime_game_interface_not_implemented")
  }
  if (!input.currentWorldMatched) reasons.push("current_world_mismatch")
  if (!input.currentTickMatched) reasons.push("current_tick_mismatch")
  if (!input.currentFrameWorldMatched) {
    reasons.push("current_frame_world_mismatch")
  }
  if (!input.currentFrameTickMatched) {
    reasons.push("current_frame_tick_mismatch")
  }
  if (!input.currentSourceFactsMatched) {
    reasons.push("current_source_facts_mismatch")
  }
  if (!input.currentFrameSourceFactsMatched) {
    reasons.push("current_frame_source_facts_mismatch")
  }
  return reasons
}

function approvedFrameHardFieldsValid(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  return (
    approvedFrame.canShowToPlayer === true &&
    typeof approvedFrame.imageUrl === "string" &&
    approvedFrame.imageUrl.startsWith("data:image/") &&
    typeof approvedFrame.sourceImageSha256 === "string" &&
    approvedFrame.sourceImageSha256.length === 64 &&
    typeof approvedFrame.sourceImageByteLength === "number" &&
    approvedFrame.sourceImageByteLength > 0 &&
    typeof approvedFrame.sourceImageContentType === "string" &&
    isApprovedContentType(approvedFrame.sourceImageContentType) &&
    approvedFrame.sourceImagePayloadQualityPassed === true
  )
}

function approvedFrameGameWorldDisplayBoundaryPassed(
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

function reviewReportGameWorldPassedForRuntime(
  reviewReport: WorldVisualReviewReport | null
): boolean {
  return (
    reviewReport?.vj0Status === "vj_0_passed" &&
    reviewReport.vj1Status === "vj_1_passed" &&
    reviewReport.vj2Status === "vj_2_passed" &&
    reviewReport.approvalScope === "approved_for_game_world" &&
    reviewReport.productionApprovalStatus === "not_approved_for_production" &&
    reviewReport.canShowToPlayer === false
  )
}

function isApprovedContentType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpeg"
  )
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
