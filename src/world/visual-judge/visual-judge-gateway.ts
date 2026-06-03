import type { PixelWorldBufferCell } from "@/world/pixel-worldview";

import type {
  VisualJudgeFinding,
  VisualJudgeFindingCategory,
  VisualJudgeFindingSeverity,
  VisualJudgeInput,
  VisualJudgeReport,
  VisualCorrectionAction,
  VisualCorrectionActionType,
  VisualCorrectionPlan,
} from "./visual-judge-schema";
import {
  auditVisualStyleSafety,
  visualStyleSafetyPolicyTags,
} from "./visual-style-safety-policy";

const MAX_OBJECT_BLOCK_AREA_RATIO = 0.075;
const MAX_CENTER_BLOCK_AREA_RATIO = 0.035;
const MAX_OBJECT_DENSITY_PER_SCREEN = 0.00042;
const MIN_OBJECT_BLOCK_COUNT = 3;
const MIN_OBJECT_VISIBLE_AREA = 18;

export function judgePixelWorldVisual(input: VisualJudgeInput): VisualJudgeReport {
  const findings: VisualJudgeFinding[] = [
    ...judgeMigrationFallback(input),
    ...judgeOutOfBoundsBlocks(input),
    ...judgeIllegalLargeBlocks(input),
    ...judgeObjectReadability(input),
    ...judgeObjectDensity(input),
    ...judgeBusinessVisualBoundary(input),
    ...judgeStyleSafetyBoundary(input),
  ];
  const failCount = findings.filter((finding) => finding.severity === "fail").length;
  const warnCount = findings.filter((finding) => finding.severity === "warn").length;
  const score = Math.max(0, Math.min(100, 100 - failCount * 24 - warnCount * 8));

  return {
    ok: failCount === 0,
    score,
    severity: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    findings,
    tags: [
      "visual_judge_report",
      "autonomous_world_visual_review",
      "visual_judge_does_not_modify_runtime",
      "visual_reference_abstract_principles_only",
      "copyright_safety_boundary",
      ...visualStyleSafetyPolicyTags(),
      failCount === 0 ? "visual_judge_no_failures" : "visual_judge_failures",
      warnCount === 0 ? "visual_judge_no_warnings" : "visual_judge_warnings",
    ],
  };
}

export function buildVisualCorrectionPlan(report: VisualJudgeReport): VisualCorrectionPlan {
  const actions = report.findings.map((findingItem) => buildCorrectionAction(findingItem));

  return {
    shouldRegenerateVisuals: actions.length > 0,
    actionCount: actions.length,
    actions,
    tags: [
      "visual_correction_plan",
      "visual_correction_does_not_modify_runtime",
      actions.length > 0 ? "visual_correction_actions_present" : "visual_correction_no_actions",
    ],
  };
}

function judgeMigrationFallback(input: VisualJudgeInput): VisualJudgeFinding[] {
  const findings: VisualJudgeFinding[] = [];
  const markerCommands = input.renderPlan.commands.filter(
    (command) => command.kind === "place_object_recipe" && command.visible
  );
  const markerCells = visibleCells(input).filter((cell) => cell.kind === "object_marker");

  markerCommands.forEach((command) => {
    findings.push(finding({
      id: `visual_judge_marker_fallback_command_${command.sourceId}`,
      severity: "fail",
      category: "semantic",
      message: `Object ${command.sourceId} still uses marker fallback rendering.`,
      sourceId: command.sourceId,
      suggestedFix: "Add a formal VisualGeneration object recipe and emit draw_object_block commands.",
      tags: ["marker_fallback", "render_plan"],
    }));
  });

  markerCells.forEach((cell) => {
    findings.push(finding({
      id: `visual_judge_marker_fallback_cell_${cell.id}`,
      severity: "fail",
      category: "semantic",
      message: `Object marker cell ${cell.id} remains in the pixel buffer.`,
      sourceId: cell.sourceCommandId,
      suggestedFix: "Replace object_marker cells with object_block cells before presenting the world.",
      tags: ["marker_fallback", "pixel_buffer"],
    }));
  });

  if (input.visualGenerationPlan.objectMigration.markerFallbackObjectCount > 0) {
    findings.push(finding({
      id: "visual_judge_migration_summary_marker_fallback",
      severity: "fail",
      category: "semantic",
      message: "VisualGeneration migration summary still contains marker fallback objects.",
      suggestedFix: "Complete the missing object recipe migration or hide visual-only fallback objects.",
      tags: [
        "marker_fallback",
        `fallback_kinds:${input.visualGenerationPlan.objectMigration.markerFallbackKinds.join("|")}`,
      ],
    }));
  }

  return findings;
}

function judgeOutOfBoundsBlocks(input: VisualJudgeInput): VisualJudgeFinding[] {
  return visibleCells(input)
    .filter((cell) => cell.kind === "object_block")
    .filter(
      (cell) =>
        cell.x < 0 ||
        cell.y < 0 ||
        cell.x + cell.width > input.pixelBufferFrame.canvas.width ||
        cell.y + cell.height > input.pixelBufferFrame.canvas.height
    )
    .map((cell) =>
      finding({
        id: `visual_judge_out_of_bounds_${cell.id}`,
        severity: "fail",
        category: "composition",
        message: `Visual block ${cell.id} is outside the canvas.`,
        sourceId: cell.sourceCommandId,
        suggestedFix: "Reposition or resize the visual recipe before rendering.",
        tags: ["out_of_bounds", "pixel_buffer"],
      })
    );
}

function judgeIllegalLargeBlocks(input: VisualJudgeInput): VisualJudgeFinding[] {
  const canvasArea = input.pixelBufferFrame.canvas.width * input.pixelBufferFrame.canvas.height;
  const center = {
    left: input.pixelBufferFrame.canvas.width * 0.33,
    right: input.pixelBufferFrame.canvas.width * 0.67,
    top: input.pixelBufferFrame.canvas.height * 0.33,
    bottom: input.pixelBufferFrame.canvas.height * 0.74,
  };

  return visibleCells(input)
    .filter((cell) => cell.kind === "object_block" || cell.kind === "trace")
    .flatMap((cell) => {
      const areaRatio = cellArea(cell) / canvasArea;
      const findings: VisualJudgeFinding[] = [];

      if (cell.kind === "object_block" && areaRatio > MAX_OBJECT_BLOCK_AREA_RATIO) {
        findings.push(finding({
          id: `visual_judge_illegal_large_block_${cell.id}`,
          severity: "fail",
          category: "illegal_debug_visual",
          message: `Visual block ${cell.id} is too large for a single drawable object block.`,
          sourceId: cell.sourceCommandId,
          suggestedFix: "Split the block into semantic parts or remove a leaked debug/placeholder rectangle.",
          tags: ["large_block", "possible_debug_visual"],
        }));
      }

      if (intersectsCenter(cell, center) && areaRatio > MAX_CENTER_BLOCK_AREA_RATIO && cell.opacity >= 0.28) {
        findings.push(finding({
          id: `visual_judge_center_obstruction_${cell.id}`,
          severity: "warn",
          category: "composition",
          message: `Large block ${cell.id} obstructs the central reading area.`,
          sourceId: cell.sourceCommandId,
          suggestedFix: "Reduce opacity, resize the block, or move it away from the central visual focus.",
          tags: ["center_obstruction", "composition"],
        }));
      }

      return findings;
    });
}

function judgeObjectReadability(input: VisualJudgeInput): VisualJudgeFinding[] {
  return input.visualGenerationPlan.objectRecipes.flatMap((recipe) => {
    const visibleRecipeCells = visibleCells(input).filter(
      (cell) =>
        cell.kind === "object_block" &&
        cell.sourceCommandId.includes(`render_object_block_${recipe.sourceObjectId}`)
    );
    const visibleArea = visibleRecipeCells.reduce((sum, cell) => sum + cellArea(cell), 0);
    const findings: VisualJudgeFinding[] = [];

    if (visibleRecipeCells.length < MIN_OBJECT_BLOCK_COUNT) {
      findings.push(finding({
        id: `visual_judge_low_block_count_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "readability",
        message: `Object ${recipe.sourceObjectId} has too few visible blocks to be readable.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Add enough semantic parts, shadow, body and highlight blocks to the recipe.",
        tags: ["readability", "low_block_count", recipe.kind],
      }));
    }

    if (visibleArea < MIN_OBJECT_VISIBLE_AREA) {
      findings.push(finding({
        id: `visual_judge_low_visible_area_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "readability",
        message: `Object ${recipe.sourceObjectId} has too little visible area.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Increase object scale or simplify the recipe into larger readable pixel clusters.",
        tags: ["readability", "low_visible_area", recipe.kind],
      }));
    }

    return findings;
  });
}

function judgeObjectDensity(input: VisualJudgeInput): VisualJudgeFinding[] {
  const canvasArea = input.pixelBufferFrame.canvas.width * input.pixelBufferFrame.canvas.height;
  const density = input.visualGenerationPlan.objectRecipes.length / canvasArea;

  if (density <= MAX_OBJECT_DENSITY_PER_SCREEN) return [];

  return [
    finding({
      id: "visual_judge_object_density_high",
      severity: "warn",
      category: "density",
      message: "Object density is high for the visible screen area.",
      suggestedFix: "Reduce visual-only derived object density or cluster small natural objects into groups.",
      tags: ["density", "autonomous_world_visual_balance"],
    }),
  ];
}

function judgeBusinessVisualBoundary(input: VisualJudgeInput): VisualJudgeFinding[] {
  const forbiddenTokens = [
    "unplanned_life_default",
    "createUnplannedLife",
    "debug_placeholder",
    "debug_block",
  ];
  const searchableText = [
    ...input.visualGenerationPlan.tags,
    ...input.visualGenerationPlan.objectRecipes.flatMap((recipe) => [
      recipe.recipeId,
      recipe.kind,
      ...recipe.stateTags,
      ...recipe.blocks.flatMap((block) => [block.id, ...block.stateTags]),
    ]),
    ...input.renderPlan.commands.flatMap((command) => [
      command.id,
      command.kind,
      command.sourceId,
      command.recipeId ?? "",
      ...(command.stateTags ?? []),
    ]),
    ...visibleCells(input).flatMap((cell) => [
      cell.id,
      cell.kind,
      cell.sourceCommandId,
      cell.recipeId ?? "",
      ...(cell.stateTags ?? []),
    ]),
  ].join("\n");

  return forbiddenTokens
    .filter((token) => searchableText.includes(token))
    .map((token) =>
      finding({
        id: `visual_judge_forbidden_visual_token_${token}`,
        severity: "fail",
        category: "business_rule",
        message: `Forbidden visual/runtime token appears in visual output: ${token}.`,
        suggestedFix: "Remove unplanned life or debug visual tokens from the visual generation path.",
        tags: ["business_rule", "forbidden_token", token],
      })
    );
}

function judgeStyleSafetyBoundary(input: VisualJudgeInput): VisualJudgeFinding[] {
  return auditVisualStyleSafety({
    searchableTags: collectSearchableVisualTags(input),
  });
}

function collectSearchableVisualTags(input: VisualJudgeInput): string[] {
  return [
    ...input.visualGenerationPlan.tags,
    ...input.visualGenerationPlan.objectRecipes.flatMap((recipe) => [
      recipe.recipeId,
      recipe.kind,
      ...recipe.stateTags,
      ...recipe.blocks.flatMap((block) => [block.id, ...block.stateTags]),
    ]),
    ...input.renderPlan.commands.flatMap((command) => [
      command.id,
      command.kind,
      command.sourceId,
      command.recipeId ?? "",
      ...(command.stateTags ?? []),
    ]),
    ...visibleCells(input).flatMap((cell) => [
      cell.id,
      cell.kind,
      cell.sourceCommandId,
      cell.recipeId ?? "",
      ...(cell.stateTags ?? []),
    ]),
  ];
}

function visibleCells(input: VisualJudgeInput): PixelWorldBufferCell[] {
  return input.pixelBufferFrame.layers
    .flatMap((layer) => layer.cells)
    .filter((cell) => cell.visible && cell.opacity > 0);
}

function cellArea(cell: PixelWorldBufferCell): number {
  return Math.max(0, cell.width) * Math.max(0, cell.height);
}

function intersectsCenter(
  cell: PixelWorldBufferCell,
  center: { left: number; right: number; top: number; bottom: number }
): boolean {
  return (
    cell.x < center.right &&
    cell.x + cell.width > center.left &&
    cell.y < center.bottom &&
    cell.y + cell.height > center.top
  );
}

function finding(input: {
  id: string;
  severity: VisualJudgeFindingSeverity;
  category: VisualJudgeFindingCategory;
  message: string;
  sourceId?: string;
  suggestedFix: string;
  tags: string[];
}): VisualJudgeFinding {
  return input;
}

function buildCorrectionAction(findingItem: VisualJudgeFinding): VisualCorrectionAction {
  const type = correctionTypeForFinding(findingItem);
  const targetId = findingItem.sourceId ?? findingItem.id;

  return {
    id: `visual_correction_${findingItem.id}`,
    type,
    targetId,
    reason: findingItem.suggestedFix,
    sourceFindingId: findingItem.id,
    affectsRuntimeFacts: false,
    tags: [
      "visual_correction_action",
      "visual_only",
      `category:${findingItem.category}`,
      `severity:${findingItem.severity}`,
    ],
  };
}

function correctionTypeForFinding(findingItem: VisualJudgeFinding): VisualCorrectionActionType {
  if (findingItem.category === "illegal_debug_visual") return "remove_visual_block";
  if (findingItem.category === "density") return "reduce_visual_density";
  if (findingItem.category === "readability") return "resize_visual_object";
  if (findingItem.category === "semantic") return "replace_visual_recipe";
  if (findingItem.category === "business_rule") return "remove_forbidden_visual_token";
  if (findingItem.category === "style_safety") return "remove_forbidden_visual_token";

  return "reposition_visual_object";
}
