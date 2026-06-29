import type {
  WorldVisualApprovedFrame,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

export type WorldGameRuntimeFrameViewport = {
  width: 1024
  height: 768
  aspectRatio: "4:3"
  camera: "top_down_pixel_scene"
  scaleMode: "contain"
}

export type WorldGameRuntimeFrameVisualLayer = {
  layerId: string
  layerKind: "approved_static_world_visual"
  sourceApprovedFrameId: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  sourceImageSha256: string
  directPageRenderAllowed: false
  role: "visual_background_input"
}

export type WorldGameRuntimeFrameShell = {
  hasGameViewport: boolean
  hasCamera: boolean
  hasInteractionLayer: boolean
  hasDynamicLayerSlot: boolean
  hasPPhoneSlot: boolean
  hasButlerSlot: boolean
  shellVersion: "world-runtime-frame-shell-v0"
}

export type WorldGameRuntimeFrame = {
  version: "world-runtime-frame-v0"
  frameId: string
  worldId: string
  ownerId: string
  tick: number
  createdAt: string
  sourceFactIds: string[]
  approvedFrameId: string
  reviewReportStatus: WorldVisualReviewReport["status"]
  viewport: WorldGameRuntimeFrameViewport
  shell: WorldGameRuntimeFrameShell
  visualLayers: WorldGameRuntimeFrameVisualLayer[]
  canShowToPlayer: true
  productionDisplayAllowed: false
  tags: string[]
}

export type WorldGameRuntimeFrameBuildResult = {
  status:
    | "runtime_frame_ready"
    | "approved_frame_missing"
    | "approved_frame_not_game_world"
    | "review_report_not_game_world"
    | "owner_final_world_approval_missing"
    | "runtime_binding_mismatch"
  runtimeFrame: WorldGameRuntimeFrame | null
  runtimeFrameReady: boolean
  blockedReasons: string[]
  tags: string[]
}

export type BuildWorldGameRuntimeFrameInput = {
  ownerId: string
  currentWorldId: string
  currentTick: number
  currentSourceFactIds: string[]
  approvedFrame: WorldVisualApprovedFrame | null
  reviewReport: WorldVisualReviewReport | null
  recordWorldId: string | null
  recordTick: number | null
  recordSourceFactIds: string[]
}
