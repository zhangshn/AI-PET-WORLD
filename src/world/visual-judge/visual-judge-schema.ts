import type { PixelWorldPixelBufferFrame } from "@/world/pixel-worldview";
import type { PixelWorldRenderPlan } from "@/world/pixel-worldview";
import type { VisualGenerationPlan } from "@/world/visual-generation";

export type VisualJudgeSeverity = "pass" | "warn" | "fail";

export type VisualJudgeFindingSeverity = "info" | "warn" | "fail";

export type VisualJudgeFindingCategory =
  | "illegal_debug_visual"
  | "readability"
  | "density"
  | "composition"
  | "semantic"
  | "world_fact_consistency"
  | "structure_logic"
  | "construction_stage"
  | "access_readability"
  | "path_connectivity"
  | "ecology_coherence"
  | "player_focus"
  | "business_rule"
  | "style_safety";

export type VisualJudgeFinding = {
  id: string;
  severity: VisualJudgeFindingSeverity;
  category: VisualJudgeFindingCategory;
  message: string;
  sourceId?: string;
  suggestedFix: string;
  tags: string[];
};

export type VisualJudgeReport = {
  ok: boolean;
  score: number;
  severity: VisualJudgeSeverity;
  findings: VisualJudgeFinding[];
  tags: string[];
};

export type VisualCorrectionActionType =
  | "remove_visual_block"
  | "reduce_visual_density"
  | "resize_visual_object"
  | "replace_visual_recipe"
  | "reposition_visual_object"
  | "generate_visual_cue"
  | "promote_actor_sprite"
  | "remove_forbidden_visual_token";

export type VisualCorrectionIntentType =
  | "hide_invalid_visual"
  | "reduce_visual_density"
  | "resize_for_readability"
  | "replace_visual_recipe"
  | "reposition_within_canvas"
  | "add_construction_stage_cue"
  | "add_access_trace_cue"
  | "reconnect_path_visuals"
  | "cluster_ecology_transition"
  | "protect_player_focus_area"
  | "remove_forbidden_visual_token";

export type VisualCorrectionIntentPriority = "low" | "medium" | "high";

export type VisualCorrectionIntent = {
  id: string;
  type: VisualCorrectionIntentType;
  targetId: string;
  sourceFindingId: string;
  priority: VisualCorrectionIntentPriority;
  visualOnly: true;
  preservesRuntimeFacts: true;
  parameters: {
    preferredLayer?: string;
    preferredCue?: string;
    densityMultiplier?: number;
    opacityMultiplier?: number;
    scaleMultiplier?: number;
    moveStrategy?: string;
  };
  tags: string[];
};

export type VisualCorrectionAction = {
  id: string;
  type: VisualCorrectionActionType;
  targetId: string;
  intentId: string;
  reason: string;
  sourceFindingId: string;
  affectsRuntimeFacts: false;
  tags: string[];
};

export type VisualCorrectionPlan = {
  shouldRegenerateVisuals: boolean;
  intentCount: number;
  actionCount: number;
  intents: VisualCorrectionIntent[];
  actions: VisualCorrectionAction[];
  tags: string[];
};

export type VisualFactSourceKind =
  | "construction"
  | "ecology"
  | "terrain"
  | "trace"
  | "event"
  | "butler"
  | "actor"
  | "ui"
  | "atmosphere"
  | "derived_visual_only"
  | "unknown";

export type VisualFactManifestEntry = {
  sourceId: string;
  sourceKind: VisualFactSourceKind;
  semanticKind: string;
  visualOnly: boolean;
  originTags: string[];
};

export type VisualFactManifest = {
  worldId: string;
  tick: number;
  entries: VisualFactManifestEntry[];
  tags: string[];
};

export type VisualCorrectionApplyResult = {
  correctedPixelBufferFrame: PixelWorldPixelBufferFrame;
  appliedActionIds: string[];
  skippedActionIds: string[];
  changedCellIds: string[];
  generatedCellIds: string[];
  affectsRuntimeFacts: false;
  tags: string[];
};

export type VisualDisplayGateStatus =
  | "allow_display"
  | "block_display"
  | "requires_visual_correction";

export type VisualDisplayGateReviewPhase =
  | "original_passed"
  | "correction_not_needed"
  | "correction_applied"
  | "correction_partially_applied"
  | "correction_failed"
  | "post_correction_passed"
  | "post_correction_warned"
  | "post_correction_failed";

export type VisualDisplayGateReview = {
  originalSeverity: VisualJudgeSeverity;
  finalSeverity: VisualJudgeSeverity;
  correctionApplied: boolean;
  generatedVisualOnlyCellCount: number;
  remainingFindingCount: number;
  remainingFailCount: number;
  resolvedFindingCount: number;
  phases: VisualDisplayGateReviewPhase[];
  blockReasons: string[];
  tags: string[];
};

export type VisualDisplayGateDecision = {
  status: VisualDisplayGateStatus;
  canShowToPlayer: boolean;
  reason: string;
  review: VisualDisplayGateReview;
  report: VisualJudgeReport;
  correctionPlan: VisualCorrectionPlan;
  correctedPixelBufferFrame?: PixelWorldPixelBufferFrame;
  postCorrectionReport?: VisualJudgeReport;
  correctionApplyResult?: VisualCorrectionApplyResult;
  tags: string[];
};

export type VisualJudgeInput = {
  visualGenerationPlan: VisualGenerationPlan;
  renderPlan: PixelWorldRenderPlan;
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  visualFactManifest?: VisualFactManifest;
};
