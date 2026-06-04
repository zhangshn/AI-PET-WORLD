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
  tags: [
    "ai_visual_standard",
    "public_reference_principles_to_project_rules",
    "world_first_display_gate",
    "pass_required_for_display",
  ],
} as const;

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
