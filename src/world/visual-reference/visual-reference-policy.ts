import type { VisualStyleSafetyPolicy } from "./visual-reference-schema";

export const VISUAL_STYLE_SAFETY_POLICY: VisualStyleSafetyPolicy = {
  id: "visual_style_safety_policy_v1",
  forbidsDirectCopy: true,
  forbidsNamedArtistImitation: true,
  forbidsIPReplication: true,
  forbidsReferenceImageReconstruction: true,
  allowsGenericPixelArtPrinciples: true,
  allowsRealWorldObservation: true,
  requiresTransformativeOriginalExpression: true,
  forbiddenIntentTags: [
    "copy_reference_image",
    "reconstruct_reference_image",
    "named_artist_imitation",
    "named_ip_replication",
    "copyrighted_character_replication",
    "style_clone",
    "one_to_one_asset_copy",
  ],
  requiredOutputTags: [
    "original_visual_expression",
    "abstract_principle_only",
    "no_named_artist_imitation",
    "no_ip_replication",
  ],
  sourceAttributionPolicy:
    "Reference research may inform abstract visual principles, but visual output must not reproduce protected expression, named artist styles, branded IP, or one-to-one reference layouts.",
  tags: [
    "visual_style_safety_policy",
    "reference_research_allowed",
    "abstract_principles_only",
    "copyright_safety_boundary",
    "visual_judge_policy_input",
  ],
};
