import type { GameMapFrame, GameMapVisualLayer } from "./game-map-frame-schema"

export type GameMapAiPainterCandidateInput = {
  candidateId: string
  sourceKind: "project_model_generated" | "development_test_asset"
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  sourceFactIds: string[]
  canShowToPlayer: false
}

export type GameMapApprovedFrameInput = {
  frameId: string
  worldId: string
  tick: number
  sourceImageCandidateId: string
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  sourceImageSha256: string
  sourceImageByteLength: number
  sourceImagePayloadQualityPassed: boolean
  approvalScope: "approved_for_controlled_mvp" | "approved_for_game_world"
  approvedForProduction: boolean
  vj0Status: "vj_0_passed"
  vj1Status: "vj_1_passed"
  vj2Status: "vj_2_not_implemented" | "vj_2_passed"
  sourceFactIds: string[]
  tags: string[]
}

export type GameMapVisualLayerBindingStatus =
  | "candidate_bound"
  | "approved_bound"
  | "structured_fallback_bound"
  | "blocked_candidate_missing"
  | "blocked_approved_frame_missing"
  | "blocked_world_mismatch"
  | "blocked_tick_mismatch"
  | "blocked_source_facts_mismatch"
  | "blocked_candidate_visible"
  | "blocked_candidate_not_project_model"
  | "blocked_approved_not_game_world"
  | "blocked_approved_not_vj2_passed"
  | "blocked_approved_missing_composite_input_tags"
  | "blocked_approved_has_training_tags"
  | "blocked_approved_image_missing"

export type BindAiPainterCandidateVisualLayerInput = {
  frame: GameMapFrame
  candidate: GameMapAiPainterCandidateInput | null
  expectedWorldId: string
  expectedTick: number
  expectedSourceFactIds: string[]
}

export type BindApprovedFrameVisualLayerInput = {
  frame: GameMapFrame
  approvedFrame: GameMapApprovedFrameInput | null
  expectedWorldId: string
  expectedTick: number
  expectedSourceFactIds: string[]
}

export type BindStructuredFallbackVisualLayerInput = {
  frame: GameMapFrame
  expectedWorldId: string
  expectedTick: number
  expectedSourceFactIds: string[]
  width: number
  height: number
}

export type GameMapVisualLayerBindingResult = {
  status: GameMapVisualLayerBindingStatus
  passed: boolean
  frame: GameMapFrame
  visualLayer: GameMapVisualLayer
  blockedReasons: string[]
  tags: string[]
}

const COMPOSITE_REQUIRED_TAGS = [
  "formal_full_world_frame",
  "single_approved_visual_layer",
  "not_world_page_runtime",
  "requires_composite_game_map_runtime_frame",
]

const TRAINING_OR_PARTIAL_TAGS = [
  "partial_or_crop_candidate",
  "training_candidate",
  "single_direct_output",
  "single_source_overfit",
  "local_asset_preview",
  "candidate_only",
]

export function bindAiPainterCandidateVisualLayer(
  input: BindAiPainterCandidateVisualLayerInput
): GameMapVisualLayerBindingResult {
  const baseIssues = validateFrameBindingBase(input)
  if (baseIssues.length > 0) {
    return blocked(baseIssues[0], input.frame, baseIssues, ["visual_layer_candidate_blocked"])
  }
  if (!input.candidate) {
    return blocked(
      "blocked_candidate_missing",
      input.frame,
      ["candidate_missing"],
      ["visual_layer_candidate_missing"]
    )
  }
  if (input.candidate.canShowToPlayer !== false) {
    return blocked(
      "blocked_candidate_visible",
      input.frame,
      ["candidate_can_show_to_player_must_be_false"],
      ["visual_layer_candidate_blocked"]
    )
  }
  if (input.candidate.sourceKind !== "project_model_generated") {
    return blocked(
      "blocked_candidate_not_project_model",
      input.frame,
      ["candidate_source_kind_must_be_project_model_generated"],
      ["visual_layer_candidate_blocked"]
    )
  }
  if (!sameStringSet(input.candidate.sourceFactIds, input.expectedSourceFactIds)) {
    return blocked(
      "blocked_source_facts_mismatch",
      input.frame,
      ["candidate_source_fact_ids_mismatch"],
      ["visual_layer_candidate_blocked"]
    )
  }

  const visualLayer: GameMapVisualLayer = {
    status: "candidate",
    source: "ai_painter_visual_layer",
    candidateId: input.candidate.candidateId,
    approvedFrameId: null,
    imageSha256: null,
    imageWidth: input.candidate.width,
    imageHeight: input.candidate.height,
    imageFormat: input.candidate.imageFormat,
  }

  return passed("candidate_bound", input.frame, visualLayer, [
    "visual_layer_candidate_bound",
    "candidate_not_showable_to_player",
  ])
}

export function bindApprovedFrameVisualLayer(
  input: BindApprovedFrameVisualLayerInput
): GameMapVisualLayerBindingResult {
  const baseIssues = validateFrameBindingBase(input)
  if (baseIssues.length > 0) {
    return blocked(baseIssues[0], input.frame, baseIssues, ["visual_layer_approved_blocked"])
  }
  if (!input.approvedFrame) {
    return blocked(
      "blocked_approved_frame_missing",
      input.frame,
      ["approved_frame_missing"],
      ["visual_layer_approved_missing"]
    )
  }

  const approvedFrame = input.approvedFrame
  if (approvedFrame.worldId !== input.expectedWorldId) {
    return blocked(
      "blocked_world_mismatch",
      input.frame,
      ["approved_frame_world_id_mismatch"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (approvedFrame.tick !== input.expectedTick) {
    return blocked(
      "blocked_tick_mismatch",
      input.frame,
      ["approved_frame_tick_mismatch"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (!sameStringSet(approvedFrame.sourceFactIds, input.expectedSourceFactIds)) {
    return blocked(
      "blocked_source_facts_mismatch",
      input.frame,
      ["approved_frame_source_fact_ids_mismatch"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (
    approvedFrame.approvalScope !== "approved_for_game_world" ||
    approvedFrame.approvedForProduction !== false
  ) {
    return blocked(
      "blocked_approved_not_game_world",
      input.frame,
      ["approved_frame_must_be_game_world_scope"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (
    approvedFrame.vj0Status !== "vj_0_passed" ||
    approvedFrame.vj1Status !== "vj_1_passed" ||
    approvedFrame.vj2Status !== "vj_2_passed"
  ) {
    return blocked(
      "blocked_approved_not_vj2_passed",
      input.frame,
      ["approved_frame_must_pass_vj0_vj1_vj2"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (!hasRequiredCompositeInputTags(approvedFrame.tags)) {
    return blocked(
      "blocked_approved_missing_composite_input_tags",
      input.frame,
      ["approved_frame_missing_composite_input_tags"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (hasTrainingOrPartialTags(approvedFrame.tags)) {
    return blocked(
      "blocked_approved_has_training_tags",
      input.frame,
      ["approved_frame_has_training_or_partial_tags"],
      ["visual_layer_approved_blocked"]
    )
  }
  if (
    !approvedFrame.sourceImagePayloadQualityPassed ||
    approvedFrame.sourceImageSha256.length !== 64 ||
    approvedFrame.sourceImageByteLength <= 0
  ) {
    return blocked(
      "blocked_approved_image_missing",
      input.frame,
      ["approved_frame_image_payload_invalid"],
      ["visual_layer_approved_blocked"]
    )
  }

  const visualLayer: GameMapVisualLayer = {
    status: "approved",
    source: "ai_painter_visual_layer",
    candidateId: approvedFrame.sourceImageCandidateId,
    approvedFrameId: approvedFrame.frameId,
    imageUrl: approvedFrame.imageUrl,
    imageSha256: approvedFrame.sourceImageSha256,
    imageWidth: approvedFrame.width,
    imageHeight: approvedFrame.height,
    imageFormat: approvedFrame.imageFormat,
  }

  return passed("approved_bound", input.frame, visualLayer, [
    "visual_layer_approved_bound",
    "approved_frame_game_world_scope",
    "approved_frame_vj2_passed",
  ])
}

export function bindStructuredFallbackVisualLayer(
  input: BindStructuredFallbackVisualLayerInput
): GameMapVisualLayerBindingResult {
  const baseIssues = validateFrameBindingBase(input)
  if (baseIssues.length > 0) {
    return blocked(baseIssues[0], input.frame, baseIssues, [
      "visual_layer_structured_fallback_blocked",
    ])
  }

  const visualLayer: GameMapVisualLayer = {
    status: "structured_fallback",
    source: "structured_fallback_skin",
    candidateId: null,
    approvedFrameId: null,
    imageSha256: null,
    imageWidth: input.width,
    imageHeight: input.height,
    imageFormat: null,
  }

  return passed("structured_fallback_bound", input.frame, visualLayer, [
    "visual_layer_structured_fallback_bound",
    "structured_fallback_runtime_safe",
    "not_ai_generated_image",
    "not_training_image",
  ])
}

function validateFrameBindingBase(input: {
  frame: GameMapFrame
  expectedWorldId: string
  expectedTick: number
  expectedSourceFactIds: string[]
}): GameMapVisualLayerBindingStatus[] {
  const issues: GameMapVisualLayerBindingStatus[] = []
  if (input.frame.worldId !== input.expectedWorldId) {
    issues.push("blocked_world_mismatch")
  }
  if (input.frame.tick !== input.expectedTick) {
    issues.push("blocked_tick_mismatch")
  }
  if (!sameStringSet(input.frame.sourceFactIds, input.expectedSourceFactIds)) {
    issues.push("blocked_source_facts_mismatch")
  }
  return issues
}

function passed(
  status: GameMapVisualLayerBindingStatus,
  frame: GameMapFrame,
  visualLayer: GameMapVisualLayer,
  tags: string[]
): GameMapVisualLayerBindingResult {
  return {
    status,
    passed: true,
    frame: withVisualLayer(frame, visualLayer, tags),
    visualLayer,
    blockedReasons: [],
    tags,
  }
}

function blocked(
  status: GameMapVisualLayerBindingStatus,
  frame: GameMapFrame,
  blockedReasons: string[],
  tags: string[]
): GameMapVisualLayerBindingResult {
  return {
    status,
    passed: false,
    frame,
    visualLayer: frame.visualLayer,
    blockedReasons,
    tags,
  }
}

function withVisualLayer(
  frame: GameMapFrame,
  visualLayer: GameMapVisualLayer,
  tags: string[]
): GameMapFrame {
  return {
    ...frame,
    visualLayer,
    tags: unique([...frame.tags, ...tags]),
  }
}

function hasRequiredCompositeInputTags(tags: string[]): boolean {
  const tagSet = new Set(tags)
  return COMPOSITE_REQUIRED_TAGS.every((tag) => tagSet.has(tag))
}

function hasTrainingOrPartialTags(tags: string[]): boolean {
  const tagSet = new Set(tags)
  return TRAINING_OR_PARTIAL_TAGS.some((tag) => tagSet.has(tag))
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
