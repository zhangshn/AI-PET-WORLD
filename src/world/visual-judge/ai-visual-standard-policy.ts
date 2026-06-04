import type { PixelWorldBufferCell } from "@/world/pixel-worldview";

import type { VisualJudgeFinding, VisualJudgeInput } from "./visual-judge-schema";

export const AI_VISUAL_STANDARD_POLICY = {
  id: "ai_visual_standard_world_first_v1",
  oversizedTraceMinTileSpan: 5,
  oversizedTraceMinCanvasAreaRatio: 0.012,
  lowerWorldBandTopRatio: 0.66,
  lowerWorldMinReadableRatio: 0.025,
  lowerWorldMinMeaningfulRatio: 0.025,
  topToLowerMeaningfulMaxRatio: 10,
  foregroundProjectionMinGroupCountForScatterAudit: 12,
  foregroundProjectionMaxIsolatedRatio: 0.38,
  foregroundProjectionClusterDistanceTileSpan: 5.5,
  foregroundProjectionSmallGroupMaxArea: 700,
  foregroundProjectionMaxSmallGroupRatio: 0.55,
  foregroundProjectionMaxGroupCountWithoutAnchors: 32,
  foregroundProjectionAnchorMinArea: 900,
  foregroundProjectionMinAnchorRatio: 0.34,
  worldStoryAnchorMinArea: 1800,
  worldStoryAnchorMinDominanceRatio: 0.32,
  worldStoryAnchorMinCanvasAreaRatio: 0.004,
  worldStoryAnchorMinWidthTileSpan: 5,
  worldStoryAnchorMinHeightTileSpan: 3.5,
  worldStoryFootprintMinCanvasAreaRatio: 0.02,
  worldStoryFootprintMinBoundingAreaRatio: 0.08,
  mvpStorySceneMinCanvasAreaRatio: 0.085,
  mvpTerrainDepthMinCanvasAreaRatio: 0.04,
  mvpNaturalFrameMinCanvasAreaRatio: 0.025,
  mvpMaterialClusterMinCanvasAreaRatio: 0.006,
  mvpFoundationAssemblyMinCanvasAreaRatio: 0.012,
  mvpForegroundPathMinCanvasAreaRatio: 0.008,
  tags: [
    "ai_visual_standard",
    "mvp_final_visual_quality_bar",
    "mvp_must_not_be_test_map",
    "public_reference_principles_to_project_rules",
    "world_first_display_gate",
    "pass_required_for_display",
  ],
} as const;

export const AI_VISUAL_PUBLIC_EVIDENCE_RULE_TABLE = [
  {
    id: "mvp_final_world_art_quality_bar",
    publicBasis:
      "User-approved final quality target requires MVP to read as a polished playable pixel-world scene, not a flat test map.",
    publicSourceUrls: [],
    abstractPrinciple:
      "MVP quality must include focal construction, scene zones, terrain depth, path guidance, natural framing, and rich readable clusters.",
    projectRule:
      "A displayed world frame must look like a composed playable world scene, even in MVP.",
    judgeSignals: [
      "active_story_focal_point",
      "construction_work_yard",
      "foundation_assembly_readability",
      "path_to_focal_area",
      "terrain_depth_variation",
      "natural_frame",
      "foreground_middle_background_rhythm",
    ],
    failureTags: [
      "mvp_must_not_be_test_map",
      "flat_green_field",
      "random_scattered_objects",
      "weak_construction_worksite",
      "weak_foundation_assembly",
    ],
  },
  {
    id: "pixel_cluster_readability",
    publicBasis:
      "Pixel-art education emphasizes readability and clear clusters over noisy detail.",
    publicSourceUrls: [
      "https://www.pixelartdaily.com/blog/what-makes-good-pixel-art",
      "https://www.pixelartdaily.com/blog/how-to-fix-messy-pixel-art",
    ],
    abstractPrinciple:
      "A pixel scene must read at game scale before detail matters.",
    projectRule:
      "Objects and terrain marks must form readable clusters, not random specks.",
    judgeSignals: [
      "semantic_block_count",
      "visible_area",
      "oversized_flat_blocks",
      "fragmented_traces",
      "micro_scatter_ratio",
      "anchor_group_ratio",
    ],
    failureTags: [
      "foreground_micro_scatter",
      "random_scattered_foreground",
      "quantity_not_quality",
    ],
  },
  {
    id: "foreground_midground_background_depth",
    publicBasis:
      "Environment composition guidance separates foreground, middleground, and background to create depth and scale.",
    publicSourceUrls: [
      "https://www.muddycolors.com/2012/08/composition-basics-value-structure/",
      "https://wiki.frozenbyte.com/index.php/Level_Art%3A_Composition",
    ],
    abstractPrinciple:
      "A world frame needs layered spatial rhythm.",
    projectRule:
      "The world canvas must have readable foreground, middle area, and upper/background area.",
    judgeSignals: [
      "meaningful_top_middle_lower_distribution",
      "dead_lower_world",
      "top_heavy_imbalance",
    ],
    failureTags: [
      "dead_empty_world_area",
      "foreground_underdeveloped",
      "band_balance",
    ],
  },
  {
    id: "environment_art_serves_world_state",
    publicBasis:
      "Game environment art should preserve gameplay function and player comprehension.",
    publicSourceUrls: [
      "https://book.leveldesignbook.com/process/env-art",
    ],
    abstractPrinciple:
      "Decoration must support what the player understands about the world.",
    projectRule:
      "Roads, traces, structures, ecology, and construction marks must explain world state.",
    judgeSignals: [
      "path_connectivity",
      "access_readability",
      "construction_stage",
      "visual_fact_manifest_coverage",
    ],
    failureTags: [
      "fragmented_trace",
      "missing_nearby_path",
      "construction_stage",
    ],
  },
  {
    id: "focal_story_and_quiet_space",
    publicBasis:
      "Game readability guidance emphasizes hierarchy, focal story, and quiet regions before detail.",
    publicSourceUrls: [
      "https://gamineai.com/blog/10-pixel-art-composition-rules-readability-in-game-2026",
    ],
    abstractPrinciple:
      "A screen needs a clear visual story and intentional silence.",
    projectRule:
      "The frame must not be uniformly busy or uniformly empty; it needs a readable focus and supporting rhythm.",
    judgeSignals: [
      "center_obstruction",
      "object_density",
      "dead_empty_area",
      "visual_only_fake_composition",
    ],
    failureTags: [
      "center_obstruction",
      "object_density",
      "dead_empty_world_area",
      "surface_texture_not_enough",
    ],
  },
  {
    id: "world_story_anchor_dominance",
    publicBasis:
      "Environment art and focal-story principles require the most important world fact to carry first-read meaning.",
    publicSourceUrls: [
      "https://book.leveldesignbook.com/process/env-art",
      "https://gamineai.com/blog/10-pixel-art-composition-rules-readability-in-game-2026",
    ],
    abstractPrinciple:
      "Decoration must not dominate the real world event, construction, road, or facility.",
    projectRule:
      "If the world has a construction/facility/event anchor, it must be visually stronger than decorative nature.",
    judgeSignals: [
      "story_anchor_area",
      "story_anchor_canvas_ratio",
      "story_anchor_width_height",
      "decorative_support_area",
      "story_anchor_dominance_ratio",
    ],
    failureTags: [
      "weak_world_story_anchor",
      "focal_story_required",
      "decoration_cannot_dominate_world_fact",
    ],
  },
  {
    id: "silhouette_contrast_shape_readability",
    publicBasis:
      "Readability guidance emphasizes silhouette, contrast, shape language, and value separation.",
    publicSourceUrls: [
      "https://coartist.net/blog/character-design-readability-silhouette-shape-language-contrast",
      "https://sandboxr.com/character-silhouettes-that-work-visual-readability-in-game-design/",
    ],
    abstractPrinciple:
      "The player should identify important forms quickly.",
    projectRule:
      "Important world objects need distinguishable silhouette, contact shadow, base/body/part separation, and contrast from ground.",
    judgeSignals: [
      "object_visible_area",
      "object_block_count",
      "structure_logic",
      "palette_contrast",
    ],
    failureTags: [
      "readability",
      "low_block_count",
      "low_visible_area",
      "structure_logic",
    ],
  },
  {
    id: "non_text_contrast_and_graphical_clarity",
    publicBasis:
      "Accessibility and UI clarity guidance treats contrast and non-text graphical clarity as important to comprehension.",
    publicSourceUrls: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html",
    ],
    abstractPrinciple:
      "Important visual information cannot rely on barely visible color differences.",
    projectRule:
      "Important world/UI graphics need enough contrast, shape redundancy, or position redundancy.",
    judgeSignals: [
      "palette_family",
      "contrast_separation",
      "critical_state_visibility",
    ],
    failureTags: [
      "style_safety",
      "visual_contrast",
      "hidden_critical_state",
    ],
  },
  {
    id: "style_safety_no_copying",
    publicBasis:
      "AI-assisted art may use general principles but must not copy protected expression.",
    publicSourceUrls: [],
    abstractPrinciple:
      "Learn principles, not expression.",
    projectRule:
      "AI-PET-WORLD uses its own palette, recipes, naming, and layout vocabulary.",
    judgeSignals: [
      "forbidden_style_tokens",
      "reference_image_storage",
      "external_asset_leakage",
    ],
    failureTags: [
      "abstract_principle_only",
      "copyright_safety_boundary",
      "visual_reference_leakage",
    ],
  },
] as const;

export const AI_VISUAL_RUBRIC_AXES = [
  {
    id: "composition_balance",
    principle: "A playable world frame needs intentional foreground, middle ground, and background distribution.",
    metricTags: ["meaningful_content_ratio", "band_balance", "dead_empty_area"],
  },
  {
    id: "visual_readability",
    principle: "Players should read objects, traces, terrain changes, and construction cues at a glance.",
    metricTags: ["object_block", "trace", "actor_marker", "readable_ground_detail"],
  },
  {
    id: "texture_vs_fact",
    principle: "Surface texture can support the scene, but it cannot replace meaningful world content.",
    metricTags: ["surface_texture_not_enough", "visual_fact_preserved"],
  },
  {
    id: "style_safety",
    principle: "The project may use public principles, but it must not copy external images, layouts, or IP.",
    metricTags: ["abstract_principle_only", "copyright_safety_boundary"],
  },
] as const;

export function judgeAIVisualStandard(input: VisualJudgeInput): VisualJudgeFinding[] {
  const canvas = input.pixelBufferFrame.canvas;
  const canvasArea = canvas.width * canvas.height;
  const cells = visibleCells(input);
  const semanticCells = cells.filter(isReadableWorldCell);
  const meaningfulCells = meaningfulWorldCells(cells);
  const findings: VisualJudgeFinding[] = [];
  const objectGroups = buildSourceGroups(
    meaningfulCells.filter((cell) => cell.kind === "object_block")
  );
  const oversizedTraceCells = cells.filter(
    (cell) =>
      cell.kind === "trace" &&
      !isVisualOnlyGeneratedCell(cell) &&
      cell.width >= canvas.tileSize * AI_VISUAL_STANDARD_POLICY.oversizedTraceMinTileSpan &&
      cell.height >= canvas.tileSize * AI_VISUAL_STANDARD_POLICY.oversizedTraceMinTileSpan &&
      cellArea(cell) / canvasArea >= AI_VISUAL_STANDARD_POLICY.oversizedTraceMinCanvasAreaRatio
  );

  oversizedTraceCells.slice(0, 6).forEach((cell) => {
    findings.push({
      id: `visual_judge_ai_standard_oversized_trace_block_${cell.id}`,
      severity: "fail",
      category: "composition",
      message: `Trace cell ${cell.id} is rendered as a large flat block instead of a readable road or world mark.`,
      sourceId: cell.sourceId ?? cell.sourceCommandId,
      suggestedFix: "Replace large trace squares with segmented road, worn-grass, footprint, or terrain-transition clusters.",
      tags: [
        "ai_visual_standard",
        "oversized_trace_block",
        "flat_debug_like_world_mark",
      ],
    });
  });

  if (canvas.width >= 1000 && canvas.height >= 700) {
    const lowerWorldBand = {
      left: 0,
      right: canvas.width,
      top: canvas.height * AI_VISUAL_STANDARD_POLICY.lowerWorldBandTopRatio,
      bottom: canvas.height,
    };
    const lowerBandArea =
      (lowerWorldBand.right - lowerWorldBand.left) *
      (lowerWorldBand.bottom - lowerWorldBand.top);
    const lowerSemanticArea = semanticCells.reduce(
      (sum, cell) => sum + overlapArea(cell, lowerWorldBand),
      0
    );
    const lowerMeaningfulArea = meaningfulCells.reduce(
      (sum, cell) => sum + overlapArea(cell, lowerWorldBand),
      0
    );
    const lowerSemanticRatio = lowerSemanticArea / lowerBandArea;
    const lowerMeaningfulRatio = lowerMeaningfulArea / lowerBandArea;

    if (lowerSemanticRatio < AI_VISUAL_STANDARD_POLICY.lowerWorldMinReadableRatio) {
      findings.push({
        id: "visual_judge_ai_standard_dead_empty_lower_world",
        severity: "fail",
        category: "composition",
        message: "The lower world area is mostly empty, so the frame does not read as a complete playable world.",
        suggestedFix: "Add readable terrain variation, road continuation, foreground clusters, or world-state traces without inventing runtime facts.",
        tags: [
          "ai_visual_standard",
          "dead_empty_world_area",
          "world_first_display_gate",
        ],
      });
    }

    if (lowerMeaningfulRatio < AI_VISUAL_STANDARD_POLICY.lowerWorldMinMeaningfulRatio) {
      findings.push({
        id: "visual_judge_ai_standard_thin_meaningful_foreground",
        severity: "fail",
        category: "composition",
        message:
          "The foreground has too little meaningful world content; surface texture alone cannot make the frame read as a playable world.",
        suggestedFix:
          "Add visual-only foreground composition cues from existing world facts, such as road continuation, terrain transition, construction footprint, or stronger nearby object staging.",
        tags: [
          "ai_visual_standard",
          "thin_meaningful_foreground",
          "dead_empty_world_area",
          "surface_texture_not_enough",
          "world_first_display_gate",
        ],
      });
    }

    const bandDistribution = buildMeaningfulBandDistribution({
      cells: meaningfulCells,
      width: canvas.width,
      height: canvas.height,
    });

    if (
      bandDistribution.lowerRatio > 0 &&
      bandDistribution.topRatio / bandDistribution.lowerRatio >
        AI_VISUAL_STANDARD_POLICY.topToLowerMeaningfulMaxRatio
    ) {
      findings.push({
        id: "visual_judge_ai_standard_unbalanced_world_bands",
        severity: "fail",
        category: "composition",
        message:
          "Meaningful world content is concentrated in the upper area, leaving the playable foreground visually underdeveloped.",
        suggestedFix:
          "Recompose the visual-only frame so existing traces, terrain transitions, or construction cues create a readable foreground/middle/background rhythm.",
        tags: [
          "ai_visual_standard",
          "composition_balance",
          "band_balance",
          "foreground_underdeveloped",
          "world_first_display_gate",
        ],
      });
    }

    const storyAnchorGroups = objectGroups.filter(isWorldStoryAnchorGroup);

    if (storyAnchorGroups.length > 0) {
      findings.push(...judgeMvpFinalWorldArtBar({
        cells,
        canvasArea,
      }));

      const storyFootprints = storyAnchorGroups.map((group) =>
        buildStoryAnchorFootprint({
          group,
          cells,
        })
      );
      const largestStoryAnchorArea = Math.max(...storyFootprints.map((footprint) => footprint.area));
      const largestStoryAnchor = storyFootprints.reduce((best, footprint) =>
        footprint.area > best.area ? footprint : best
      );
      const largestDecorativeArea = Math.max(
        1,
        ...objectGroups.filter(isDecorativeSupportGroup).map((group) => group.area)
      );
      const storyDominanceRatio = largestStoryAnchorArea / largestDecorativeArea;

      if (
        largestStoryAnchorArea < AI_VISUAL_STANDARD_POLICY.worldStoryAnchorMinArea ||
        storyDominanceRatio < AI_VISUAL_STANDARD_POLICY.worldStoryAnchorMinDominanceRatio
      ) {
        findings.push({
          id: "visual_judge_ai_standard_weak_world_story_anchor",
          severity: "fail",
          category: "composition",
          message:
            "The frame contains a real world-story anchor, but it is visually weaker than decorative nature and cannot carry the first-read world meaning.",
          suggestedFix:
            "Make the current construction, facility, road, or event anchor visibly readable before adding more decorative objects or surface texture.",
          tags: [
            "ai_visual_standard",
            "weak_world_story_anchor",
            "focal_story_required",
            "environment_art_serves_world_state",
            "decoration_cannot_dominate_world_fact",
            "world_first_display_gate",
          ],
        });
      }

      if (
        largestStoryAnchor.area / canvasArea <
          AI_VISUAL_STANDARD_POLICY.worldStoryAnchorMinCanvasAreaRatio ||
        largestStoryAnchor.width <
          canvas.tileSize * AI_VISUAL_STANDARD_POLICY.worldStoryAnchorMinWidthTileSpan ||
        largestStoryAnchor.height <
          canvas.tileSize * AI_VISUAL_STANDARD_POLICY.worldStoryAnchorMinHeightTileSpan
      ) {
        findings.push({
          id: "visual_judge_ai_standard_story_anchor_too_small_for_screen",
          severity: "fail",
          category: "composition",
          message:
            "The main world-story anchor is present, but it is too small for the screen and the frame still reads like a test map rather than a playable world.",
          suggestedFix:
            "Increase the readable construction/facility/event footprint, add supporting path and terrain staging, or block the frame until the world painter can compose a stronger scene.",
          tags: [
            "ai_visual_standard",
            "story_anchor_too_small_for_screen",
            "focal_story_required",
            "playable_world_not_test_map",
            "world_first_display_gate",
          ],
        });
      }

      if (
        largestStoryAnchor.area / canvasArea <
          AI_VISUAL_STANDARD_POLICY.worldStoryFootprintMinCanvasAreaRatio ||
        (largestStoryAnchor.width * largestStoryAnchor.height) / canvasArea <
          AI_VISUAL_STANDARD_POLICY.worldStoryFootprintMinBoundingAreaRatio
      ) {
        findings.push({
          id: "visual_judge_ai_standard_story_frame_too_zoomed_out",
          severity: "fail",
          category: "composition",
          message:
            "The generated frame contains a fact-backed story area, but it is still too small at player screen scale, so the world reads like a distant test map instead of an approved playable scene.",
          suggestedFix:
            "Use a player-scale world framing, enlarge the fact-backed staging footprint, or block display until the automatic painter can produce a readable scene.",
          tags: [
            "ai_visual_standard",
            "story_frame_too_zoomed_out",
            "player_scale_readability_required",
            "playable_world_not_test_map",
            "pass_required_for_display",
          ],
        });
      }
    }

    const foregroundProjectionGroups = buildSourceGroups(
      meaningfulCells.filter((cell) =>
        (cell.stateTags ?? []).includes("foreground_composition_projection")
      )
    );

    if (
      foregroundProjectionGroups.length >=
      AI_VISUAL_STANDARD_POLICY.foregroundProjectionMinGroupCountForScatterAudit
    ) {
      const maxClusterDistance =
        canvas.tileSize * AI_VISUAL_STANDARD_POLICY.foregroundProjectionClusterDistanceTileSpan;
      const isolatedGroupCount = foregroundProjectionGroups.filter((group) =>
        nearestGroupDistance(group, foregroundProjectionGroups) > maxClusterDistance
      ).length;
      const isolatedRatio = isolatedGroupCount / foregroundProjectionGroups.length;
      const smallGroupCount = foregroundProjectionGroups.filter(
        (group) => group.area <= AI_VISUAL_STANDARD_POLICY.foregroundProjectionSmallGroupMaxArea
      ).length;
      const anchorGroupCount = foregroundProjectionGroups.filter(
        (group) => group.area >= AI_VISUAL_STANDARD_POLICY.foregroundProjectionAnchorMinArea
      ).length;
      const smallGroupRatio = smallGroupCount / foregroundProjectionGroups.length;
      const anchorRatio = anchorGroupCount / foregroundProjectionGroups.length;

      if (isolatedRatio > AI_VISUAL_STANDARD_POLICY.foregroundProjectionMaxIsolatedRatio) {
        findings.push({
          id: "visual_judge_ai_standard_random_scattered_foreground",
          severity: "fail",
          category: "composition",
          message:
            "The foreground uses many small fact-derived objects, but they are scattered instead of forming readable natural clusters or world structure.",
          suggestedFix:
            "Group foreground nature into fewer readable clusters, connect it with terrain rhythm, or keep the frame blocked until the world painter can produce coherent composition.",
          tags: [
            "ai_visual_standard",
            "random_scattered_foreground",
            "foreground_projection_requires_clusters",
            "quantity_not_quality",
            "world_first_display_gate",
          ],
        });
      }

      if (
        smallGroupRatio >
          AI_VISUAL_STANDARD_POLICY.foregroundProjectionMaxSmallGroupRatio ||
        (
          foregroundProjectionGroups.length >
            AI_VISUAL_STANDARD_POLICY.foregroundProjectionMaxGroupCountWithoutAnchors &&
          anchorRatio < AI_VISUAL_STANDARD_POLICY.foregroundProjectionMinAnchorRatio
        )
      ) {
        findings.push({
          id: "visual_judge_ai_standard_foreground_micro_scatter",
          severity: "fail",
          category: "composition",
          message:
            "The foreground technically contains many fact-derived marks, but most of them are tiny isolated sprites, so the scene reads as noise rather than a composed world.",
          suggestedFix:
            "Convert foreground projection into fewer larger clusters with visible anchors, then let smaller plants support those clusters instead of replacing composition.",
          tags: [
            "ai_visual_standard",
            "foreground_micro_scatter",
            "quantity_not_quality",
            "requires_visual_anchor_groups",
            "world_first_display_gate",
          ],
        });
      }
    }
  }

  return findings;
}

export function aiVisualStandardPolicyTags(): string[] {
  return [...AI_VISUAL_STANDARD_POLICY.tags];
}

function visibleCells(input: VisualJudgeInput): PixelWorldBufferCell[] {
  return input.pixelBufferFrame.layers
    .flatMap((layer) => layer.cells)
    .filter((cell) => cell.visible && cell.opacity > 0);
}

function isReadableWorldCell(cell: PixelWorldBufferCell): boolean {
  return (
    cell.kind === "object_block" ||
    cell.kind === "trace" ||
    cell.kind === "actor_marker" ||
    isReadableGroundDetailCell(cell)
  );
}

function meaningfulWorldCells(cells: PixelWorldBufferCell[]): PixelWorldBufferCell[] {
  return cells.filter(
    (cell) =>
      !isVisualOnlyGeneratedCell(cell) &&
      (
        cell.kind === "object_block" ||
        cell.kind === "trace" ||
        cell.kind === "actor_marker"
      )
  );
}

function buildMeaningfulBandDistribution(input: {
  cells: PixelWorldBufferCell[];
  width: number;
  height: number;
}): { topRatio: number; middleRatio: number; lowerRatio: number } {
  const topBand = {
    left: 0,
    right: input.width,
    top: 0,
    bottom: input.height * 0.33,
  };
  const middleBand = {
    left: 0,
    right: input.width,
    top: input.height * 0.33,
    bottom: input.height * 0.66,
  };
  const lowerBand = {
    left: 0,
    right: input.width,
    top: input.height * 0.66,
    bottom: input.height,
  };

  return {
    topRatio: bandRatio(input.cells, topBand),
    middleRatio: bandRatio(input.cells, middleBand),
    lowerRatio: bandRatio(input.cells, lowerBand),
  };
}

function bandRatio(
  cells: PixelWorldBufferCell[],
  band: { left: number; right: number; top: number; bottom: number }
): number {
  const bandArea = (band.right - band.left) * (band.bottom - band.top);

  if (bandArea <= 0) return 0;

  return cells.reduce((sum, cell) => sum + overlapArea(cell, band), 0) / bandArea;
}

function judgeMvpFinalWorldArtBar(input: {
  cells: PixelWorldBufferCell[];
  canvasArea: number;
}): VisualJudgeFinding[] {
  const storySceneAreaRatio = taggedAreaRatio({
    cells: input.cells,
    tag: "story_scene_composition",
    canvasArea: input.canvasArea,
  });
  const terrainDepthAreaRatio = taggedAreaRatio({
    cells: input.cells,
    tag: "terrain_depth_variation",
    canvasArea: input.canvasArea,
  });
  const naturalFrameAreaRatio = taggedAreaRatio({
    cells: input.cells,
    tag: "story_natural_frame",
    canvasArea: input.canvasArea,
  });
  const materialClusterAreaRatio = taggedAreaRatio({
    cells: input.cells,
    tag: "story_material_cluster",
    canvasArea: input.canvasArea,
  });
  const foundationAssemblyAreaRatio = taggedAreaRatio({
    cells: input.cells,
    tag: "story_foundation_assembly",
    canvasArea: input.canvasArea,
  });
  const foregroundPathAreaRatio = taggedAreaRatio({
    cells: input.cells,
    tag: "story_foreground_path",
    canvasArea: input.canvasArea,
  });
  const findings: VisualJudgeFinding[] = [];

  if (
    storySceneAreaRatio <
      AI_VISUAL_STANDARD_POLICY.mvpStorySceneMinCanvasAreaRatio
  ) {
    findings.push({
      id: "visual_judge_ai_standard_mvp_story_scene_underbuilt",
      severity: "fail",
      category: "composition",
      message:
        "The MVP world frame still lacks a developed composed scene around the active story focus.",
      suggestedFix:
        "Generate a larger fact-backed scene composition with construction yard, path, terrain depth, material support, and natural framing before display.",
      tags: [
        "ai_visual_standard",
        "mvp_final_visual_quality_bar",
        "mvp_must_not_be_test_map",
        "flat_green_field",
        "story_scene_underbuilt",
      ],
    });
  }

  if (
    terrainDepthAreaRatio <
      AI_VISUAL_STANDARD_POLICY.mvpTerrainDepthMinCanvasAreaRatio
  ) {
    findings.push({
      id: "visual_judge_ai_standard_mvp_terrain_depth_insufficient",
      severity: "fail",
      category: "composition",
      message:
        "The terrain still reads as a flat green field instead of layered playable ground.",
      suggestedFix:
        "Add larger clustered grass, soil, edge, and terrain-depth zones around the active scene.",
      tags: [
        "ai_visual_standard",
        "mvp_final_visual_quality_bar",
        "terrain_depth_insufficient",
        "flat_green_field",
      ],
    });
  }

  if (
    naturalFrameAreaRatio <
      AI_VISUAL_STANDARD_POLICY.mvpNaturalFrameMinCanvasAreaRatio
  ) {
    findings.push({
      id: "visual_judge_ai_standard_mvp_natural_frame_missing",
      severity: "fail",
      category: "composition",
      message:
        "The frame does not have enough natural boundary mass to read like a polished world scene.",
      suggestedFix:
        "Generate readable clustered natural framing at the scene edges, using project-owned trees, bushes, stones, and terrain masses.",
      tags: [
        "ai_visual_standard",
        "mvp_final_visual_quality_bar",
        "natural_frame_missing",
        "random_scattered_objects",
      ],
    });
  }

  if (
    materialClusterAreaRatio <
      AI_VISUAL_STANDARD_POLICY.mvpMaterialClusterMinCanvasAreaRatio
  ) {
    findings.push({
      id: "visual_judge_ai_standard_mvp_material_cluster_too_weak",
      severity: "fail",
      category: "composition",
      message:
        "The construction site does not show enough material support to read as a work yard.",
      suggestedFix:
        "Make material piles, stone stacks, wood stacks, and work-yard props readable around the construction fact.",
      tags: [
        "ai_visual_standard",
        "mvp_final_visual_quality_bar",
        "weak_construction_worksite",
        "material_cluster_too_weak",
      ],
    });
  }

  if (
    foundationAssemblyAreaRatio <
      AI_VISUAL_STANDARD_POLICY.mvpFoundationAssemblyMinCanvasAreaRatio
  ) {
    findings.push({
      id: "visual_judge_ai_standard_mvp_foundation_assembly_too_weak",
      severity: "fail",
      category: "composition",
      message:
        "The central construction foundation is still too weak to read as a polished playable world focal point.",
      suggestedFix:
        "Generate a stronger object-block foundation assembly: walls, floor, scaffold posts, beams, entry steps, and readable material staging.",
      tags: [
        "ai_visual_standard",
        "mvp_final_visual_quality_bar",
        "weak_construction_worksite",
        "weak_foundation_assembly",
        "foundation_assembly_readability",
      ],
    });
  }

  if (
    foregroundPathAreaRatio <
      AI_VISUAL_STANDARD_POLICY.mvpForegroundPathMinCanvasAreaRatio
  ) {
    findings.push({
      id: "visual_judge_ai_standard_mvp_foreground_path_too_weak",
      severity: "fail",
      category: "composition",
      message:
        "The foreground path does not guide the player into the active construction scene strongly enough.",
      suggestedFix:
        "Create a broader readable worn path from foreground into the focal construction area.",
      tags: [
        "ai_visual_standard",
        "mvp_final_visual_quality_bar",
        "foreground_path_too_weak",
        "path_to_focal_area",
      ],
    });
  }

  return findings;
}

function taggedAreaRatio(input: {
  cells: PixelWorldBufferCell[];
  tag: string;
  canvasArea: number;
}): number {
  if (input.canvasArea <= 0) return 0;

  return (
    input.cells
      .filter((cell) => (cell.stateTags ?? []).includes(input.tag))
      .reduce((sum, cell) => sum + cellArea(cell), 0) / input.canvasArea
  );
}

function buildSourceGroups(cells: PixelWorldBufferCell[]): Array<{
  sourceId: string;
  centerX: number;
  centerY: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  area: number;
  width: number;
  height: number;
  cellCount: number;
  tags: string[];
}> {
  const groups = new Map<string, PixelWorldBufferCell[]>();

  cells.forEach((cell) => {
    const sourceId = cell.sourceId ?? cell.sourceCommandId;
    groups.set(sourceId, [...(groups.get(sourceId) ?? []), cell]);
  });

  return Array.from(groups.entries()).map(([sourceId, groupCells]) => {
    const minX = Math.min(...groupCells.map((cell) => cell.x));
    const minY = Math.min(...groupCells.map((cell) => cell.y));
    const maxX = Math.max(...groupCells.map((cell) => cell.x + cell.width));
    const maxY = Math.max(...groupCells.map((cell) => cell.y + cell.height));

    return {
      sourceId,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      area: groupCells.reduce((sum, cell) => sum + cellArea(cell), 0),
      width: maxX - minX,
      height: maxY - minY,
      cellCount: groupCells.length,
      tags: [...new Set(groupCells.flatMap((cell) => cell.stateTags ?? []))],
    };
  });
}

function nearestGroupDistance(
  group: { sourceId: string; centerX: number; centerY: number },
  groups: Array<{ sourceId: string; centerX: number; centerY: number }>
): number {
  const distances = groups
    .filter((candidate) => candidate.sourceId !== group.sourceId)
    .map((candidate) =>
      Math.hypot(candidate.centerX - group.centerX, candidate.centerY - group.centerY)
    );

  return distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}

function buildStoryAnchorFootprint(input: {
  group: {
    sourceId: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    area: number;
    tags: string[];
  };
  cells: PixelWorldBufferCell[];
}): {
  sourceId: string;
  area: number;
  width: number;
  height: number;
  tags: string[];
} {
  const stagingCells = input.cells.filter(
    (cell) =>
      cell.kind === "trace" &&
      cell.sourceId === input.group.sourceId &&
      (cell.stateTags ?? []).includes("story_staging_trace")
  );
  const allCells = [
    {
      x: input.group.left,
      y: input.group.top,
      width: input.group.right - input.group.left,
      height: input.group.bottom - input.group.top,
    },
    ...stagingCells,
  ];
  const left = Math.min(...allCells.map((cell) => cell.x));
  const top = Math.min(...allCells.map((cell) => cell.y));
  const right = Math.max(...allCells.map((cell) => cell.x + cell.width));
  const bottom = Math.max(...allCells.map((cell) => cell.y + cell.height));
  const stagingArea = stagingCells.reduce((sum, cell) => sum + cellArea(cell), 0);

  return {
    sourceId: input.group.sourceId,
    area: input.group.area + stagingArea,
    width: right - left,
    height: bottom - top,
    tags: input.group.tags,
  };
}

function isWorldStoryAnchorGroup(group: { sourceId: string; tags: string[] }): boolean {
  return group.tags.some(
    (tag) =>
      tag === "butler_construction_result" ||
      tag === "construction_plan_add_diff" ||
      tag.startsWith("construction_stage:") ||
      tag.startsWith("construction_project:") ||
      tag.includes("facility") ||
      tag.includes("care_station") ||
      tag.includes("structure") ||
      tag.includes("event")
  );
}

function isDecorativeSupportGroup(group: { tags: string[] }): boolean {
  return group.tags.some(
    (tag) =>
      tag === "derived_visual_only" ||
      tag === "not_world_fact" ||
      tag === "nature_boundary" ||
      tag === "surface_decoration" ||
      tag === "natural_detail" ||
      tag === "rule_asset_projection"
  );
}

function isReadableGroundDetailCell(cell: PixelWorldBufferCell): boolean {
  const tags = cell.stateTags ?? [];

  return (
    cell.kind === "tile" &&
    !tags.includes("ground_base") &&
    tags.some((tag) =>
      tag === "ground_detail" ||
      tag === "ground_pressure_trace" ||
      tag === "world_surface_texture"
    )
  );
}

function isVisualOnlyGeneratedCell(cell: PixelWorldBufferCell): boolean {
  const tags = cell.stateTags ?? [];

  return tags.includes("visual_only") || tags.includes("visual_correction_generated");
}

function cellArea(cell: PixelWorldBufferCell): number {
  return Math.max(0, cell.width) * Math.max(0, cell.height);
}

function overlapArea(
  cell: PixelWorldBufferCell,
  box: { left: number; right: number; top: number; bottom: number }
): number {
  const left = Math.max(cell.x, box.left);
  const right = Math.min(cell.x + cell.width, box.right);
  const top = Math.max(cell.y, box.top);
  const bottom = Math.min(cell.y + cell.height, box.bottom);

  return Math.max(0, right - left) * Math.max(0, bottom - top);
}
