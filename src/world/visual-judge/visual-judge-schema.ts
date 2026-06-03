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
  | "promote_actor_sprite"
  | "remove_forbidden_visual_token";

export type VisualCorrectionAction = {
  id: string;
  type: VisualCorrectionActionType;
  targetId: string;
  reason: string;
  sourceFindingId: string;
  affectsRuntimeFacts: false;
  tags: string[];
};

export type VisualCorrectionPlan = {
  shouldRegenerateVisuals: boolean;
  actionCount: number;
  actions: VisualCorrectionAction[];
  tags: string[];
};

export type VisualJudgeInput = {
  visualGenerationPlan: VisualGenerationPlan;
  renderPlan: PixelWorldRenderPlan;
  pixelBufferFrame: PixelWorldPixelBufferFrame;
};
