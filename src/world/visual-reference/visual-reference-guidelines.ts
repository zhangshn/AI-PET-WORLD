import type { VisualReferenceGuideline } from "./visual-reference-schema";

export const VISUAL_REFERENCE_GUIDELINES: VisualReferenceGuideline[] = [
  {
    id: "composition_clear_focal_area_v1",
    category: "composition",
    principle:
      "Keep the main reading area legible by avoiding large opaque blocks, over-clustering, or high-contrast noise in the center of the screen.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "Do not copy the layout of a specific screenshot, map, game scene, or reference image.",
      "Do not reconstruct a protected composition from memory or reference.",
    ],
    enforcementTags: ["composition", "center_obstruction", "abstract_principle_only"],
  },
  {
    id: "pixel_readability_silhouette_v1",
    category: "readability",
    principle:
      "Small pixel objects need readable silhouettes, contact shadows, and a clear body/highlight separation.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "Do not copy a specific sprite silhouette from an existing game or artist.",
      "Do not imitate named character shapes or branded iconography.",
    ],
    enforcementTags: ["readability", "silhouette", "no_ip_replication"],
  },
  {
    id: "natural_density_grouping_v1",
    category: "density",
    principle:
      "Natural objects should form readable clusters and breathing space instead of being evenly scattered as visual noise.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "Do not replicate a known map pattern from a commercial game.",
      "Do not copy object placement from a reference image.",
    ],
    enforcementTags: ["density", "natural_cluster", "original_visual_expression"],
  },
  {
    id: "color_palette_role_separation_v1",
    category: "color",
    principle:
      "Use color and value contrast to separate ground, objects, actors, structures, traces, and UI.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "Do not sample or duplicate a proprietary palette as a recognizable style clone.",
      "Do not request a named artist or named franchise color identity.",
    ],
    enforcementTags: ["color", "value_contrast", "no_named_artist_imitation"],
  },
  {
    id: "real_world_observation_not_copy_v1",
    category: "object_shape",
    principle:
      "Real-world observation may inform generic structure, such as trees having trunks and crowns or houses having bases, walls, and roofs.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "Do not copy a photographer's composition or a specific artwork's expressive details.",
      "Do not turn a single reference image into a matching asset.",
    ],
    enforcementTags: ["real_world_observation", "object_shape", "no_reference_reconstruction"],
  },
  {
    id: "autonomous_world_visual_consistency_v1",
    category: "world_consistency",
    principle:
      "Visuals must express autonomous world facts and visual-only derivations without inventing unbuilt towns, cities, actors, or story facts.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "Do not draw complex buildings or city content before the world facts justify them.",
      "Do not use visual correction to change runtime facts.",
    ],
    enforcementTags: ["world_consistency", "visual_only_boundary", "does_not_modify_runtime"],
  },
  {
    id: "copyright_safe_reference_use_v1",
    category: "copyright_safety",
    principle:
      "Reference material can guide general rules, but output must be original and must not target substantial similarity to protected expression.",
    allowedUse: "abstract_principle_only",
    forbiddenUse: [
      "No direct copying.",
      "No named artist imitation.",
      "No IP replication.",
      "No one-to-one reference image reconstruction.",
    ],
    enforcementTags: ["copyright_safety", "substantial_similarity_guard", "original_visual_expression"],
  },
];

export function listVisualReferenceGuidelines(): VisualReferenceGuideline[] {
  return VISUAL_REFERENCE_GUIDELINES;
}
