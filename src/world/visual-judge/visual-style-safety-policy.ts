import { VISUAL_STYLE_SAFETY_POLICY } from "@/world/visual-reference";

import type { VisualJudgeFinding } from "./visual-judge-schema";

export function auditVisualStyleSafety(input: {
  searchableTags: string[];
}): VisualJudgeFinding[] {
  const hits = VISUAL_STYLE_SAFETY_POLICY.forbiddenIntentTags.filter((tag) =>
    input.searchableTags.includes(tag)
  );

  return hits.map((tag) => ({
    id: `visual_judge_style_safety_${tag}`,
    severity: "fail",
    category: "style_safety",
    message: `Unsafe visual reference intent detected: ${tag}.`,
    suggestedFix:
      "Use only abstract visual principles from references; do not copy protected expression, named artist styles, or branded IP.",
    tags: [
      "visual_style_safety",
      "copyright_safety_boundary",
      "abstract_principles_only_required",
      tag,
    ],
  }));
}

export function visualStyleSafetyPolicyTags(): string[] {
  return VISUAL_STYLE_SAFETY_POLICY.tags;
}
