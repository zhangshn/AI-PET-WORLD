import type {
  BuildWorldGameRuntimeFrameInput,
  WorldGameRuntimeFrame,
  WorldGameRuntimeFrameBuildResult,
} from "./runtime-frame-schema"

export function buildWorldGameRuntimeFrame(
  input: BuildWorldGameRuntimeFrameInput
): WorldGameRuntimeFrameBuildResult {
  if (!input.approvedFrame) {
    return blocked("approved_frame_missing", ["approved_frame_missing"])
  }

  if (!approvedFrameIsGameWorld(input.approvedFrame)) {
    return blocked("approved_frame_not_game_world", [
      "approved_frame_not_game_world",
    ])
  }

  if (!reviewReportIsGameWorld(input.reviewReport)) {
    return blocked("review_report_not_game_world", [
      "review_report_not_game_world",
    ])
  }
  const reviewReport = input.reviewReport!

  if (
    input.recordWorldId !== input.currentWorldId ||
    input.recordTick !== input.currentTick ||
    input.approvedFrame.worldId !== input.currentWorldId ||
    input.approvedFrame.tick !== input.currentTick ||
    !sameStringSet(input.recordSourceFactIds, input.currentSourceFactIds) ||
    !sameStringSet(input.approvedFrame.sourceFactIds, input.currentSourceFactIds)
  ) {
    return blocked("runtime_binding_mismatch", ["runtime_binding_mismatch"])
  }

  const runtimeFrame: WorldGameRuntimeFrame = {
    version: "world-runtime-frame-v0",
    frameId: `runtime-frame-${input.currentWorldId}-${input.currentTick}`,
    worldId: input.currentWorldId,
    ownerId: input.ownerId,
    tick: input.currentTick,
    createdAt: new Date().toISOString(),
    sourceFactIds: [...input.currentSourceFactIds],
    approvedFrameId: input.approvedFrame.frameId,
    reviewReportStatus: reviewReport.status,
    viewport: {
      width: 1024,
      height: 768,
      aspectRatio: "4:3",
      camera: "top_down_pixel_scene",
      scaleMode: "contain",
    },
    shell: {
      hasGameViewport: true,
      hasCamera: true,
      hasInteractionLayer: true,
      hasDynamicLayerSlot: true,
      hasPPhoneSlot: true,
      hasButlerSlot: true,
      shellVersion: "world-runtime-frame-shell-v0",
    },
    visualLayers: [
      {
        layerId: `visual-layer-${input.approvedFrame.frameId}`,
        layerKind: "approved_static_world_visual",
        sourceApprovedFrameId: input.approvedFrame.frameId,
        imageUrl: input.approvedFrame.imageUrl,
        imageWidth: input.approvedFrame.width,
        imageHeight: input.approvedFrame.height,
        sourceImageSha256: input.approvedFrame.sourceImageSha256,
        directPageRenderAllowed: false,
        role: "visual_background_input",
      },
    ],
    canShowToPlayer: true,
    productionDisplayAllowed: false,
    tags: [
      "world_runtime_frame",
      "game_runtime_frame_ready",
      "approved_frame_is_visual_layer_input",
      "not_raw_single_image_page",
      "production_display_blocked",
    ],
  }

  return {
    status: "runtime_frame_ready",
    runtimeFrame,
    runtimeFrameReady: true,
    blockedReasons: [],
    tags: [
      "world_runtime_frame_build_result",
      "runtime_frame_ready",
      ...runtimeFrame.tags,
    ],
  }
}

function blocked(
  status: Exclude<WorldGameRuntimeFrameBuildResult["status"], "runtime_frame_ready">,
  reasons: string[]
): WorldGameRuntimeFrameBuildResult {
  return {
    status,
    runtimeFrame: null,
    runtimeFrameReady: false,
    blockedReasons: reasons,
    tags: [
      "world_runtime_frame_build_result",
      "runtime_frame_blocked",
      ...reasons,
    ],
  }
}

function approvedFrameIsGameWorld(
  approvedFrame: BuildWorldGameRuntimeFrameInput["approvedFrame"]
): boolean {
  if (!approvedFrame) return false
  const tags = new Set(approvedFrame.tags)

  return (
    approvedFrame.approvalScope === "approved_for_game_world" &&
    approvedFrame.productionApprovalStatus === "not_approved_for_production" &&
    approvedFrame.approvedForProduction === false &&
    approvedFrame.vj0Status === "vj_0_passed" &&
    approvedFrame.vj1Status === "vj_1_passed" &&
    approvedFrame.vj2Status === "vj_2_passed" &&
    approvedFrame.width >= 1024 &&
    approvedFrame.height >= 768 &&
    tags.has("game_world_ready_for_player") &&
    tags.has("formal_full_world_frame") &&
    !tags.has("training_candidate") &&
    !tags.has("partial_or_crop_candidate")
  )
}

function reviewReportIsGameWorld(
  reviewReport: BuildWorldGameRuntimeFrameInput["reviewReport"]
): boolean {
  return (
    reviewReport?.status === "vj_1_passed" &&
    reviewReport.vj0Status === "vj_0_passed" &&
    reviewReport.vj1Status === "vj_1_passed" &&
    reviewReport.vj2Status === "vj_2_passed" &&
    reviewReport.approvalScope === "approved_for_game_world" &&
    reviewReport.productionApprovalStatus === "not_approved_for_production" &&
    reviewReport.canShowToPlayer === false
  )
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
