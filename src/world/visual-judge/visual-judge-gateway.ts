import type {
  PixelWorldBufferCell,
  PixelWorldBufferLayer,
  PixelWorldPixelBufferFrame,
} from "@/world/pixel-worldview";
import type { WorldViewModel, WorldViewObject } from "@/world/world-view-model";

import type {
  VisualFactManifest,
  VisualFactManifestEntry,
  VisualFactSourceKind,
  VisualCorrectionIntent,
  VisualJudgeFinding,
  VisualJudgeFindingCategory,
  VisualJudgeFindingSeverity,
  VisualJudgeInput,
  VisualJudgeReport,
  VisualCorrectionAction,
  VisualCorrectionActionType,
  VisualCorrectionApplyResult,
  VisualCorrectionPlan,
  VisualDisplayGateDecision,
  VisualDisplayGateReview,
  VisualDisplayGateReviewPhase,
} from "./visual-judge-schema";
import {
  auditVisualStyleSafety,
  visualStyleSafetyPolicyTags,
} from "./visual-style-safety-policy";
import {
  aiVisualStandardPolicyTags,
  judgeAIVisualStandard,
} from "./ai-visual-standard-policy";

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
    ...judgeWorldFactConsistency(input),
    ...judgeVisualFactManifestCoverage(input),
    ...judgeStructureLogic(input),
    ...judgeConstructionStageReadability(input),
    ...judgeStructureAccessReadability(input),
    ...judgePathConnectivity(input),
    ...judgeEcologyCoherence(input),
    ...judgeAIVisualStandard(input),
    ...judgePlayerVisualFocus(input),
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
      ...aiVisualStandardPolicyTags(),
      failCount === 0 ? "visual_judge_no_failures" : "visual_judge_failures",
      warnCount === 0 ? "visual_judge_no_warnings" : "visual_judge_warnings",
    ],
  };
}

export function buildVisualCorrectionPlan(report: VisualJudgeReport): VisualCorrectionPlan {
  const intents = report.findings.map((findingItem) => buildCorrectionIntent(findingItem));
  const actions = report.findings.map((findingItem, index) =>
    buildCorrectionAction({
      findingItem,
      intent: intents[index],
    })
  );

  return {
    shouldRegenerateVisuals: actions.length > 0,
    intentCount: intents.length,
    actionCount: actions.length,
    intents,
    actions,
    tags: [
      "visual_correction_plan",
      "structured_visual_correction_intents",
      "visual_correction_does_not_modify_runtime",
      actions.length > 0 ? "visual_correction_actions_present" : "visual_correction_no_actions",
    ],
  };
}

export function buildVisualFactManifestFromWorldViewModel(
  model: WorldViewModel
): VisualFactManifest {
  const entries: VisualFactManifestEntry[] = [
    ...model.tiles.map<VisualFactManifestEntry>((tile) => ({
      sourceId: tile.id,
      sourceKind: classifyTileFactSource(tile.kind, tile.traceSource),
      semanticKind: tile.kind,
      visualOnly: false,
      originTags: [
        "world_view_tile",
        `tile_kind:${tile.kind}`,
        `trace_source:${tile.traceSource || "none"}`,
        tile.passable ? "passable" : "blocked",
      ],
    })),
    ...model.traces.map<VisualFactManifestEntry>((trace) => ({
      sourceId: trace.id,
      sourceKind: classifyTraceFactSource(trace.visualKind),
      semanticKind: trace.visualKind,
      visualOnly: false,
      originTags: [
        "world_view_trace",
        `trace_kind:${trace.visualKind}`,
        `trace_layer:${trace.layer}`,
      ],
    })),
    ...model.objects.map<VisualFactManifestEntry>((object) => ({
      sourceId: object.id,
      sourceKind: classifyObjectFactSource(object),
      semanticKind: object.kind,
      visualOnly: object.source === "derived_visual_only",
      originTags: [
        "world_view_object",
        `object_kind:${object.kind}`,
        `object_source:${object.source}`,
        object.growthStage,
        ...object.tags,
      ],
    })),
    ...model.actors.map<VisualFactManifestEntry>((actor) => ({
      sourceId: actor.id,
      sourceKind: "actor",
      semanticKind: actor.kind,
      visualOnly: false,
      originTags: [
        "world_view_actor",
        `actor_pose:${actor.pose}`,
        `actor_layer:${actor.layer}`,
      ],
    })),
    {
      sourceId: "atmosphere_world_time_light",
      sourceKind: "atmosphere",
      semanticKind: model.atmosphere.mood,
      visualOnly: false,
      originTags: [
        "world_view_atmosphere",
        `mood:${model.atmosphere.mood}`,
        `weather:${model.atmosphere.weather}`,
      ],
    },
  ];

  return {
    worldId: model.worldId,
    tick: model.tick,
    entries,
    tags: [
      "visual_fact_manifest",
      "world_fact_source_manifest",
      "visual_judge_fact_source_input",
    ],
  };
}

export function buildVisualDisplayGateDecision(input: VisualJudgeInput): VisualDisplayGateDecision {
  const report = judgePixelWorldVisual(input);
  const correctionPlan = buildVisualCorrectionPlan(report);
  const correctionApplyResult = correctionPlan.shouldRegenerateVisuals
    ? applyVisualCorrectionPlanToPixelBufferFrame({
        pixelBufferFrame: input.pixelBufferFrame,
        correctionPlan,
      })
    : null;
  const postCorrectionReport = correctionApplyResult
    ? judgePixelWorldVisual({
        ...input,
        pixelBufferFrame: correctionApplyResult.correctedPixelBufferFrame,
      })
    : null;
  const finalReport = postCorrectionReport ?? report;
  const status =
    finalReport.severity === "fail"
      ? "block_display"
      : finalReport.severity === "warn"
        ? "requires_visual_correction"
        : "allow_display";
  const review = buildVisualDisplayGateReview({
    originalReport: report,
    finalReport,
    correctionPlan,
    correctionApplyResult,
    postCorrectionReport,
  });

  return {
    status,
    canShowToPlayer: finalReport.severity === "pass",
    reason: buildVisualDisplayGateReason(status, review),
    review,
    report,
    correctionPlan,
    correctedPixelBufferFrame: correctionApplyResult?.correctedPixelBufferFrame,
    postCorrectionReport: postCorrectionReport ?? undefined,
    correctionApplyResult: correctionApplyResult ?? undefined,
    tags: [
      "visual_display_gate_decision",
      "visual_gate_does_not_modify_runtime",
      "world_fact_preserving_gate",
      correctionApplyResult
        ? "visual_correction_applied_to_pixel_buffer"
        : "visual_correction_not_applied",
      status,
    ],
  };
}

export function applyVisualCorrectionPlanToPixelBufferFrame(input: {
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  correctionPlan: VisualCorrectionPlan;
}): VisualCorrectionApplyResult {
  const actionByTarget = new Map(
    input.correctionPlan.actions
      .filter(
        (action) =>
          action.type !== "generate_visual_cue" &&
          action.type !== "crop_to_story_viewport"
      )
      .map((action) => [action.targetId, action])
  );
  const intentById = new Map(
    input.correctionPlan.intents.map((intent) => [intent.id, intent])
  );
  const appliedActionIds = new Set<string>();
  const skippedActionIds = new Set(input.correctionPlan.actions.map((action) => action.id));
  const changedCellIds = new Set<string>();
  const generatedCellIds = new Set<string>();
  let correctedLayers = input.pixelBufferFrame.layers.map<PixelWorldBufferLayer>((layer) => {
    const cells = layer.cells.map((cell) => {
      const action = resolveActionForCell(cell, actionByTarget);

      if (!action) return cell;

      appliedActionIds.add(action.id);
      skippedActionIds.delete(action.id);
      changedCellIds.add(cell.id);

      return applyCorrectionActionToCell({
        cell,
        actionType: action.type,
        canvas: input.pixelBufferFrame.canvas,
      });
    });

    return {
      ...layer,
      cells,
      visibleCount: cells.filter((cell) => cell.visible).length,
      hiddenCount: cells.filter((cell) => !cell.visible).length,
    };
  });

  input.correctionPlan.actions.forEach((action) => {
    const intent = intentById.get(action.intentId);
    if (!intent) return;

    const generatedCells = buildVisualOnlyGeneratedCellsForIntent({
      pixelBufferFrame: input.pixelBufferFrame,
      intent,
      action,
    });

    if (generatedCells.length === 0) return;

    appliedActionIds.add(action.id);
    skippedActionIds.delete(action.id);
    generatedCells.forEach((cell) => {
      changedCellIds.add(cell.id);
      generatedCellIds.add(cell.id);
    });
    correctedLayers = addGeneratedCellsToLayers(correctedLayers, generatedCells);
  });

  let correctedPixelBufferFrame: PixelWorldPixelBufferFrame = {
    ...input.pixelBufferFrame,
    bufferId: `${input.pixelBufferFrame.bufferId}_visual_corrected`,
    layers: correctedLayers,
    cellCount: correctedLayers.reduce((sum, layer) => sum + layer.cells.length, 0),
  };
  const cropActions = input.correctionPlan.actions.filter(
    (action) => action.type === "crop_to_story_viewport"
  );

  cropActions.forEach((action) => {
    const croppedFrame = cropPixelBufferFrameToStoryViewport(correctedPixelBufferFrame);
    if (!croppedFrame) return;

    correctedPixelBufferFrame = croppedFrame;
    appliedActionIds.add(action.id);
    skippedActionIds.delete(action.id);
    correctedPixelBufferFrame.layers
      .flatMap((layer) => layer.cells)
      .forEach((cell) => changedCellIds.add(cell.id));
  });

  return {
    correctedPixelBufferFrame,
    appliedActionIds: Array.from(appliedActionIds).sort(),
    skippedActionIds: Array.from(skippedActionIds).sort(),
    changedCellIds: Array.from(changedCellIds).sort(),
    generatedCellIds: Array.from(generatedCellIds).sort(),
    affectsRuntimeFacts: false,
    tags: [
      "visual_correction_apply_result",
      "pixel_buffer_only",
      "runtime_facts_unchanged",
      generatedCellIds.size > 0
        ? "visual_only_cells_generated"
        : "visual_only_cells_not_generated",
      cropActions.length > 0
        ? "story_viewport_crop_requested"
        : "story_viewport_crop_not_requested",
      appliedActionIds.size > 0
        ? "visual_correction_applied"
        : "visual_correction_no_matching_cells",
    ],
  };
}

function buildVisualDisplayGateReview(input: {
  originalReport: VisualJudgeReport;
  finalReport: VisualJudgeReport;
  correctionPlan: VisualCorrectionPlan;
  correctionApplyResult: VisualCorrectionApplyResult | null;
  postCorrectionReport: VisualJudgeReport | null;
}): VisualDisplayGateReview {
  const originalFindingIds = new Set(input.originalReport.findings.map((finding) => finding.id));
  const remainingFindingIds = new Set(input.finalReport.findings.map((finding) => finding.id));
  const resolvedFindingCount = Array.from(originalFindingIds).filter(
    (findingId) => !remainingFindingIds.has(findingId)
  ).length;
  const remainingFailCount = input.finalReport.findings.filter(
    (finding) => finding.severity === "fail"
  ).length;
  const correctionApplied =
    (input.correctionApplyResult?.appliedActionIds.length ?? 0) > 0 ||
    (input.correctionApplyResult?.generatedCellIds.length ?? 0) > 0;
  const phases = buildVisualDisplayGateReviewPhases({
    originalReport: input.originalReport,
    finalReport: input.finalReport,
    correctionPlan: input.correctionPlan,
    correctionApplyResult: input.correctionApplyResult,
    postCorrectionReport: input.postCorrectionReport,
  });
  const blockReasons = buildVisualDisplayGateBlockReasons(input.finalReport);

  return {
    originalSeverity: input.originalReport.severity,
    finalSeverity: input.finalReport.severity,
    correctionApplied,
    generatedVisualOnlyCellCount: input.correctionApplyResult?.generatedCellIds.length ?? 0,
    remainingFindingCount: input.finalReport.findings.length,
    remainingFailCount,
    resolvedFindingCount,
    phases,
    blockReasons,
    tags: [
      "visual_display_gate_review",
      correctionApplied ? "correction_applied" : "correction_not_applied",
      input.postCorrectionReport ? "post_correction_review_present" : "post_correction_review_absent",
      input.finalReport.ok ? "final_visual_review_passed" : "final_visual_review_not_passed",
      remainingFailCount > 0 ? "remaining_failures" : "no_remaining_failures",
    ],
  };
}

function buildVisualDisplayGateReviewPhases(input: {
  originalReport: VisualJudgeReport;
  finalReport: VisualJudgeReport;
  correctionPlan: VisualCorrectionPlan;
  correctionApplyResult: VisualCorrectionApplyResult | null;
  postCorrectionReport: VisualJudgeReport | null;
}): VisualDisplayGateReviewPhase[] {
  const phases: VisualDisplayGateReviewPhase[] = [];

  if (input.originalReport.ok) phases.push("original_passed");
  if (!input.correctionPlan.shouldRegenerateVisuals) phases.push("correction_not_needed");

  if (input.correctionPlan.shouldRegenerateVisuals) {
    const appliedCount = input.correctionApplyResult?.appliedActionIds.length ?? 0;
    const skippedCount = input.correctionApplyResult?.skippedActionIds.length ?? 0;

    if (appliedCount === 0) {
      phases.push("correction_failed");
    } else if (skippedCount > 0) {
      phases.push("correction_partially_applied");
    } else {
      phases.push("correction_applied");
    }
  }

  if (input.postCorrectionReport) {
    if (input.postCorrectionReport.severity === "pass") phases.push("post_correction_passed");
    if (input.postCorrectionReport.severity === "warn") phases.push("post_correction_warned");
    if (input.postCorrectionReport.severity === "fail") phases.push("post_correction_failed");
  }

  if (phases.length === 0 && input.finalReport.severity === "fail") {
    phases.push("post_correction_failed");
  }

  return Array.from(new Set(phases));
}

function buildVisualDisplayGateBlockReasons(report: VisualJudgeReport): string[] {
  return report.findings
    .filter((finding) => finding.severity === "fail")
    .slice(0, 5)
    .map((finding) => `${finding.category}:${finding.id}`);
}

function buildVisualDisplayGateReason(
  status: VisualDisplayGateDecision["status"],
  review: VisualDisplayGateReview
): string {
  if (status === "allow_display") {
    if (review.correctionApplied) {
      return `Visual output passed after visual-only correction; resolved ${review.resolvedFindingCount} findings and generated ${review.generatedVisualOnlyCellCount} visual-only cells.`;
    }

    return "Visual output passed the display gate without correction.";
  }

  if (status === "requires_visual_correction") {
    return `Visual output is blocked with ${review.remainingFindingCount} warning-level finding(s); test-stage display requires a full pass.`;
  }

  return `Visual output is blocked with ${review.remainingFailCount} remaining fail findings: ${review.blockReasons.join(", ") || "unknown"}.`;
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
  const storyViewportFrame = isStoryViewportFrame(input.pixelBufferFrame);

  return input.visualGenerationPlan.objectRecipes.flatMap((recipe) => {
    const visibleRecipeCells = visibleCells(input).filter(
      (cell) =>
        cell.kind === "object_block" &&
        objectSourceIdForCell(cell) === recipe.sourceObjectId
    );

    if (
      storyViewportFrame &&
      !visibleRecipeCells.some(isStoryViewportAnchorCell)
    ) {
      return [];
    }

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

function judgeWorldFactConsistency(input: VisualJudgeInput): VisualJudgeFinding[] {
  const sourceObjectIds = new Set(
    input.visualGenerationPlan.objectRecipes.map((recipe) => recipe.sourceObjectId)
  );
  const recipeIds = new Set(
    input.visualGenerationPlan.objectRecipes.map((recipe) => recipe.recipeId)
  );
  const findings: VisualJudgeFinding[] = [];

  input.renderPlan.commands
    .filter((command) => command.visible)
    .forEach((command) => {
      if (
        command.kind === "draw_object_block" &&
        !sourceObjectIds.has(command.sourceId)
      ) {
        findings.push(finding({
          id: `visual_judge_unknown_render_source_${command.id}`,
          severity: "fail",
          category: "world_fact_consistency",
          message: `Render command ${command.id} references an object that is not present in VisualGenerationPlan.`,
          sourceId: command.sourceId,
          suggestedFix: "Remove the visual command or regenerate it from an existing world-view object recipe.",
          tags: ["world_fact_consistency", "unknown_render_source"],
        }));
      }

      if (
        command.kind === "draw_object_block" &&
        command.recipeId &&
        command.recipeId !== "smoke_recipe" &&
        !recipeIds.has(command.recipeId)
      ) {
        findings.push(finding({
          id: `visual_judge_unknown_render_recipe_${command.id}`,
          severity: "fail",
          category: "world_fact_consistency",
          message: `Render command ${command.id} references recipe ${command.recipeId}, but no matching visual recipe exists.`,
          sourceId: command.sourceId,
          suggestedFix: "Regenerate render commands from the matching VisualGeneration object recipe.",
          tags: ["world_fact_consistency", "unknown_render_recipe"],
        }));
      }
    });

  visibleCells(input)
    .filter((cell) => cell.kind === "object_block")
    .filter((cell) => !isVisualOnlyGeneratedCell(cell))
    .forEach((cell) => {
      const sourceId = objectSourceIdForCell(cell);

      if (!sourceId || !sourceObjectIds.has(sourceId)) {
        findings.push(finding({
          id: `visual_judge_unknown_buffer_source_${cell.id}`,
          severity: "fail",
          category: "world_fact_consistency",
          message: `Pixel buffer cell ${cell.id} cannot be traced back to an existing visual object recipe.`,
          sourceId: cell.sourceCommandId,
          suggestedFix: "Remove the orphan visual cell or rebuild the pixel buffer from the render plan.",
          tags: ["world_fact_consistency", "unknown_buffer_source"],
        }));
      }
    });

  return findings;
}

function judgeVisualFactManifestCoverage(input: VisualJudgeInput): VisualJudgeFinding[] {
  if (!input.visualFactManifest) return [];

  const manifestBySourceId = new Map(
    input.visualFactManifest.entries.map((entry) => [entry.sourceId, entry])
  );
  const findings: VisualJudgeFinding[] = [];

  input.visualGenerationPlan.objectRecipes.forEach((recipe) => {
    const manifestEntry = manifestBySourceId.get(recipe.sourceObjectId);

    if (!manifestEntry) {
      findings.push(finding({
        id: `visual_judge_missing_fact_manifest_recipe_${recipe.sourceObjectId}`,
        severity: "fail",
        category: "world_fact_consistency",
        message: `Visual recipe ${recipe.sourceObjectId} has no source entry in the visual fact manifest.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Rebuild the visual fact manifest from the current WorldViewModel before rendering.",
        tags: ["world_fact_manifest", "missing_recipe_source"],
      }));

      return;
    }

    if (recipe.kind === "structure" && manifestEntry.sourceKind !== "construction") {
      findings.push(finding({
        id: `visual_judge_structure_without_construction_source_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "world_fact_consistency",
        message: `Structure ${recipe.sourceObjectId} is not linked to a construction source in the visual fact manifest.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Attach construction provenance tags before treating this structure as an autonomous build result.",
        tags: ["world_fact_manifest", "structure_source_mismatch"],
      }));
    }

    if (manifestEntry.visualOnly && !recipe.stateTags.includes("derived_visual_only")) {
      findings.push(finding({
        id: `visual_judge_visual_only_source_missing_tag_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "world_fact_consistency",
        message: `Visual recipe ${recipe.sourceObjectId} comes from a visual-only source but is not tagged as visual-only.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Propagate derived_visual_only into the visual recipe state tags.",
        tags: ["world_fact_manifest", "visual_only_tag_missing"],
      }));
    }
  });

  input.renderPlan.commands
    .filter((command) => command.visible)
    .forEach((command) => {
      if (command.kind === "draw_overlay_label") return;

      const manifestEntry = manifestBySourceId.get(command.sourceId);

      if (!manifestEntry) {
        findings.push(finding({
          id: `visual_judge_missing_fact_manifest_command_${command.id}`,
          severity: "fail",
          category: "world_fact_consistency",
          message: `Render command ${command.id} has no source entry in the visual fact manifest.`,
          sourceId: command.sourceId,
          suggestedFix: "Remove orphan render commands or rebuild them from a current world fact source.",
          tags: ["world_fact_manifest", "missing_render_source"],
        }));
      }
    });

  visibleCells(input)
    .filter((cell) => !isVisualOnlyGeneratedCell(cell))
    .forEach((cell) => {
      const sourceId =
        cell.kind === "object_block"
          ? objectSourceIdForCell(cell)
          : sourceIdForCell(cell);

      if (!sourceId || sourceId.startsWith("overlay_")) return;

      if (!manifestBySourceId.has(sourceId)) {
        findings.push(finding({
          id: `visual_judge_missing_fact_manifest_cell_${cell.id}`,
          severity: "fail",
          category: "world_fact_consistency",
          message: `Pixel buffer cell ${cell.id} has no source entry in the visual fact manifest.`,
          sourceId,
          suggestedFix: "Remove orphan visual cells or regenerate the pixel buffer from the current render plan.",
          tags: ["world_fact_manifest", "missing_buffer_source"],
        }));
      }
    });

  return findings;
}

function judgeStructureLogic(input: VisualJudgeInput): VisualJudgeFinding[] {
  const structureRecipes = input.visualGenerationPlan.objectRecipes.filter(
    (recipe) => recipe.kind === "structure" || recipe.kind === "facility"
  );

  return structureRecipes.flatMap((recipe) => {
    const cells = visibleObjectCellsForSource(input, recipe.sourceObjectId);
    const findings: VisualJudgeFinding[] = [];

    if (cells.length === 0) return findings;

    const bounds = boundsForCells(cells);
    const lowerBandTop = bounds.y + bounds.height * 0.58;
    const hasReadableBase = cells.some(
      (cell) =>
        cell.y >= lowerBandTop &&
        cell.width >= Math.max(6, bounds.width * 0.28) &&
        cell.height >= 4
    );
    const hasVerticalMass = cells.some(
      (cell) => cell.height >= Math.max(8, bounds.height * 0.28)
    );

    if (!hasReadableBase) {
      findings.push(finding({
        id: `visual_judge_structure_missing_base_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "structure_logic",
        message: `Structure ${recipe.sourceObjectId} does not have a readable base or footprint.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Add or strengthen the lower visual base so the building reads as placed on the ground.",
        tags: ["structure_logic", "missing_base", recipe.kind],
      }));
    }

    if (!hasVerticalMass) {
      findings.push(finding({
        id: `visual_judge_structure_missing_vertical_mass_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "structure_logic",
        message: `Structure ${recipe.sourceObjectId} lacks enough vertical mass to read as a buildable object.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Add wall, post, roof, or body blocks to make the autonomous construction readable.",
        tags: ["structure_logic", "missing_vertical_mass", recipe.kind],
      }));
    }

    return findings;
  });
}

function judgeConstructionStageReadability(input: VisualJudgeInput): VisualJudgeFinding[] {
  const constructionRecipes = input.visualGenerationPlan.objectRecipes.filter((recipe) =>
    recipe.stateTags.some((tag) =>
      ["under_construction", "construction_stage", "planned", "scaffold"].some((token) =>
        tag.includes(token)
      )
    )
  );

  return constructionRecipes.flatMap((recipe) => {
    const cells = visibleObjectCellsForSource(input, recipe.sourceObjectId);
    if (cells.length === 0) return [];

    const hasConstructionCue = cells.some((cell) =>
      (cell.stateTags ?? []).some((tag) =>
        ["scaffold", "frame", "foundation", "under_construction", "construction_stage"].some(
          (token) => tag.includes(token)
        )
      )
    );

    if (hasConstructionCue) return [];

    return [
      finding({
        id: `visual_judge_construction_stage_missing_cue_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "construction_stage",
        message: `Construction object ${recipe.sourceObjectId} is staged but has no readable construction cue.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Add visual-only scaffold, foundation, frame, or unfinished-edge cues without changing runtime facts.",
        tags: ["construction_stage", "missing_stage_cue", recipe.kind],
      }),
    ];
  });
}

function judgeStructureAccessReadability(input: VisualJudgeInput): VisualJudgeFinding[] {
  const structureRecipes = input.visualGenerationPlan.objectRecipes.filter(
    (recipe) => recipe.kind === "structure" || recipe.kind === "facility"
  );
  const traceCells = visibleCells(input).filter((cell) => cell.kind === "trace");

  if (structureRecipes.length === 0 || traceCells.length === 0) return [];

  return structureRecipes.flatMap((recipe) => {
    const cells = visibleObjectCellsForSource(input, recipe.sourceObjectId);
    if (cells.length === 0) return [];

    const bounds = boundsForCells(cells);
    const entrancePoint = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height,
    };
    const nearestTraceDistance = Math.min(
      ...traceCells.map((cell) => pointToCellCenterDistance(entrancePoint, cell))
    );
    const maxReadableDistance = input.pixelBufferFrame.canvas.tileSize * 2.4;

    if (nearestTraceDistance <= maxReadableDistance) return [];

    return [
      finding({
        id: `visual_judge_structure_access_not_readable_${recipe.sourceObjectId}`,
        severity: "warn",
        category: "access_readability",
        message: `Structure ${recipe.sourceObjectId} has no nearby path or trace cue, so its entrance is hard to read.`,
        sourceId: recipe.sourceObjectId,
        suggestedFix: "Add or reposition visual-only path, worn grass, or maintenance trace near the structure entrance.",
        tags: ["access_readability", "missing_nearby_path", recipe.kind],
      }),
    ];
  });
}

function judgePathConnectivity(input: VisualJudgeInput): VisualJudgeFinding[] {
  const traceCells = visibleCells(input).filter((cell) => cell.kind === "trace");

  if (traceCells.length < 3) return [];

  const clusters = countCellClusters(traceCells, input.pixelBufferFrame.canvas.tileSize * 1.75);
  const maxExpectedClusters = Math.max(1, Math.ceil(traceCells.length / 4));

  if (clusters <= maxExpectedClusters) return [];

  return [
    finding({
      id: "visual_judge_trace_path_fragmented",
      severity: "warn",
      category: "path_connectivity",
      message: "Trace or road-like visual patches are too fragmented to read as a connected world change.",
      suggestedFix: "Reconnect nearby trace patches or reduce isolated visual fragments before display.",
      tags: ["path_connectivity", "fragmented_trace", "autonomous_world_visual_review"],
    }),
  ];
}

function judgeEcologyCoherence(input: VisualJudgeInput): VisualJudgeFinding[] {
  const naturalRecipes = input.visualGenerationPlan.objectRecipes.filter((recipe) =>
    isNaturalRecipeKind(recipe.kind)
  );
  const ecologyTaggedCells = visibleCells(input).filter((cell) =>
    (cell.stateTags ?? []).some((tag) =>
      ["ecology", "recovery", "growth", "stressed", "natural"].some((token) =>
        tag.includes(token)
      )
    )
  );

  if (naturalRecipes.length === 0 && ecologyTaggedCells.length === 0) return [];

  const naturalCells = naturalRecipes.flatMap((recipe) =>
    visibleObjectCellsForSource(input, recipe.sourceObjectId)
  );
  const allNaturalCellsHaveColor = naturalCells.every((cell) =>
    isEcologyCompatibleColor(cell.colorHint)
  );
  const ecologyTintCommands = input.renderPlan.commands.filter(
    (command) =>
      command.kind === "apply_atmosphere_tint" &&
      command.visible &&
      (command.sourceId.includes("ecology") ||
        (command.stateTags ?? []).some((tag) => tag.includes("ecology")))
  );
  const ecologyTintCells = visibleCells(input).filter(
    (cell) =>
      cell.layer === "atmosphere" &&
      (cell.stateTags ?? []).some((tag) => tag.includes("ecology_tint_signal"))
  );

  const findings: VisualJudgeFinding[] = [];

  if (naturalCells.length > 0 && !allNaturalCellsHaveColor) {
    findings.push(finding({
      id: "visual_judge_ecology_color_mismatch",
      severity: "warn",
      category: "ecology_coherence",
      message: "Natural objects include colors that do not match the current ecology-safe palette.",
      suggestedFix: "Shift natural object colors back to soil, leaf, moss, flower, or soft shadow tokens.",
      tags: ["ecology_coherence", "palette_mismatch", "natural_visual"],
    }));
  }

  if (
    ecologyTaggedCells.length > 0 &&
    ecologyTintCommands.length === 0 &&
    ecologyTintCells.length === 0
  ) {
    findings.push(finding({
      id: "visual_judge_ecology_signal_without_atmosphere",
      severity: "warn",
      category: "ecology_coherence",
      message: "Ecology-tagged visuals are present without an ecology atmosphere or tint signal.",
      suggestedFix: "Add a subtle ecology tint or remove unsupported ecology tags from the visual-only output.",
      tags: ["ecology_coherence", "missing_ecology_tint"],
    }));
  }

  if (ecologyTaggedCells.length >= 3) {
    const ecologyClusters = countCellClusters(
      ecologyTaggedCells,
      input.pixelBufferFrame.canvas.tileSize * 2.2
    );

    if (ecologyClusters > Math.max(1, Math.ceil(ecologyTaggedCells.length / 3))) {
      findings.push(finding({
        id: "visual_judge_ecology_transition_fragmented",
        severity: "warn",
        category: "ecology_coherence",
        message: "Ecology visuals are too fragmented to read as a coherent natural transition.",
        suggestedFix: "Cluster ecology visuals into readable transition patches or reduce isolated ecology fragments.",
        tags: ["ecology_coherence", "fragmented_ecology_transition"],
      }));
    }
  }

  return findings;
}

function judgePlayerVisualFocus(input: VisualJudgeInput): VisualJudgeFinding[] {
  const canvas = input.pixelBufferFrame.canvas;
  const centralWindow = {
    left: canvas.width * 0.24,
    right: canvas.width * 0.76,
    top: canvas.height * 0.22,
    bottom: canvas.height * 0.78,
  };
  const highOpacityCentralCells = visibleCells(input).filter(
    (cell) =>
      (cell.kind === "object_block" || cell.kind === "trace") &&
      cell.opacity >= 0.72 &&
      intersectsCenter(cell, centralWindow)
  );
  const occupiedArea = highOpacityCentralCells.reduce((sum, cell) => {
    const overlap = overlapArea(cell, centralWindow);
    return sum + overlap;
  }, 0);
  const centralArea =
    (centralWindow.right - centralWindow.left) *
    (centralWindow.bottom - centralWindow.top);
  const occupiedRatio = occupiedArea / centralArea;

  if (occupiedRatio <= 0.38) return [];

  return [
    finding({
      id: "visual_judge_player_focus_overcrowded",
      severity: "warn",
      category: "player_focus",
      message: "The player reading focus area is overcrowded by high-opacity visual cells.",
      suggestedFix: "Reduce density, opacity, or reposition visual-only details around the central player focus area.",
      tags: ["player_focus", "central_focus_overcrowded"],
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

function isStoryViewportFrame(frame: PixelWorldPixelBufferFrame): boolean {
  return (
    frame.bufferId.includes("story_viewport_corrected") ||
    frame.layers.some((layer) =>
      layer.cells.some((cell) =>
        (cell.stateTags ?? []).includes("story_viewport_crop_projection")
      )
    )
  );
}

function isVisualOnlyGeneratedCell(cell: PixelWorldBufferCell): boolean {
  const tags = cell.stateTags ?? [];

  return tags.includes("visual_only") || tags.includes("visual_correction_generated");
}

function sourceIdForCell(cell: PixelWorldBufferCell): string | null {
  return cell.sourceId ?? sourceIdFromNonObjectCommandId(cell.sourceCommandId);
}

function objectSourceIdForCell(cell: PixelWorldBufferCell): string | null {
  return cell.sourceId ?? extractObjectSourceIdFromCommandId(cell.sourceCommandId);
}

function visibleObjectCellsForSource(
  input: VisualJudgeInput,
  sourceObjectId: string
): PixelWorldBufferCell[] {
  return visibleCells(input).filter(
    (cell) =>
      cell.kind === "object_block" &&
      objectSourceIdForCell(cell) === sourceObjectId
  );
}

function cellArea(cell: PixelWorldBufferCell): number {
  return Math.max(0, cell.width) * Math.max(0, cell.height);
}

function boundsForCells(cells: PixelWorldBufferCell[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const left = Math.min(...cells.map((cell) => cell.x));
  const top = Math.min(...cells.map((cell) => cell.y));
  const right = Math.max(...cells.map((cell) => cell.x + cell.width));
  const bottom = Math.max(...cells.map((cell) => cell.y + cell.height));

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function countCellClusters(cells: PixelWorldBufferCell[], maxGap: number): number {
  const remaining = new Set(cells.map((cell) => cell.id));
  const cellById = new Map(cells.map((cell) => [cell.id, cell]));
  let clusters = 0;

  while (remaining.size > 0) {
    const [startId] = remaining;
    const stack = [startId];
    remaining.delete(startId);
    clusters += 1;

    while (stack.length > 0) {
      const current = cellById.get(stack.pop() ?? "");
      if (!current) continue;

      Array.from(remaining).forEach((candidateId) => {
        const candidate = cellById.get(candidateId);

        if (candidate && cellDistance(current, candidate) <= maxGap) {
          remaining.delete(candidateId);
          stack.push(candidateId);
        }
      });
    }
  }

  return clusters;
}

function cellDistance(left: PixelWorldBufferCell, right: PixelWorldBufferCell): number {
  const leftCenter = {
    x: left.x + left.width / 2,
    y: left.y + left.height / 2,
  };
  const rightCenter = {
    x: right.x + right.width / 2,
    y: right.y + right.height / 2,
  };

  return Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
}

function pointToCellCenterDistance(
  point: { x: number; y: number },
  cell: PixelWorldBufferCell
): number {
  const cellCenter = {
    x: cell.x + cell.width / 2,
    y: cell.y + cell.height / 2,
  };

  return Math.hypot(point.x - cellCenter.x, point.y - cellCenter.y);
}

function isNaturalRecipeKind(kind: string): boolean {
  return ["tree", "bush", "flower", "mushroom", "stone", "insect_signal"].includes(kind);
}

function classifyTileFactSource(
  kind: string,
  traceSource: string
): VisualFactSourceKind {
  if (kind.includes("ecology") || kind.includes("recovery")) return "ecology";
  if (traceSource && traceSource !== "none") return "trace";
  if (kind === "built") return "construction";
  return "terrain";
}

function classifyTraceFactSource(visualKind: string): VisualFactSourceKind {
  if (visualKind.includes("maintain")) return "butler";
  if (visualKind.includes("recover")) return "ecology";
  if (visualKind.includes("foot") || visualKind.includes("wait")) return "trace";
  return "event";
}

function classifyObjectFactSource(object: WorldViewObject): VisualFactSourceKind {
  if (object.source === "derived_visual_only") return "derived_visual_only";
  if (object.kind === "structure" || object.kind === "facility") return "construction";
  if (
    object.kind === "tree" ||
    object.kind === "bush" ||
    object.kind === "flower" ||
    object.kind === "mushroom" ||
    object.kind === "insect_signal"
  ) {
    return "ecology";
  }
  if (object.kind === "stone") return "terrain";

  return "unknown";
}

function isEcologyCompatibleColor(color: string | undefined): boolean {
  if (!color) return true;

  const normalized = color.toLowerCase();
  const rgb = parseHexColor(normalized);

  if (!rgb) return false;

  const { r, g, b } = rgb;
  const isLeafOrMoss = g >= r * 0.82 && g >= b * 0.78;
  const isSoilOrWood = r >= g * 0.72 && g >= b * 0.62 && r - b >= 12;
  const isStoneOrSoftShadow = Math.max(r, g, b) - Math.min(r, g, b) <= 36;
  const isSoftFlowerAccent = r >= 110 && b >= 80 && g >= 70;

  return isLeafOrMoss || isSoilOrWood || isStoneOrSoftShadow || isSoftFlowerAccent;
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  if (!/^#[0-9a-f]{6}$/.test(color)) return null;

  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
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

function buildCorrectionIntent(findingItem: VisualJudgeFinding): VisualCorrectionIntent {
  const targetId = findingItem.sourceId ?? findingItem.id;
  const intentType = correctionIntentTypeForFinding(findingItem);

  return {
    id: `visual_intent_${findingItem.id}`,
    type: intentType,
    targetId,
    sourceFindingId: findingItem.id,
    priority: correctionPriorityForFinding(findingItem),
    visualOnly: true,
    preservesRuntimeFacts: true,
    parameters: correctionParametersForIntent(intentType),
    tags: [
      "visual_correction_intent",
      "visual_only",
      "runtime_facts_preserved",
      `category:${findingItem.category}`,
      `severity:${findingItem.severity}`,
      `intent:${intentType}`,
    ],
  };
}

function buildCorrectionAction(input: {
  findingItem: VisualJudgeFinding;
  intent: VisualCorrectionIntent;
}): VisualCorrectionAction {
  const findingItem = input.findingItem;
  const type = correctionTypeForFinding(findingItem);

  return {
    id: `visual_correction_${findingItem.id}`,
    type,
    targetId: input.intent.targetId,
    intentId: input.intent.id,
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

function correctionIntentTypeForFinding(
  findingItem: VisualJudgeFinding
): VisualCorrectionIntent["type"] {
  if (isStoryFrameTooZoomedOutFinding(findingItem)) return "crop_to_story_viewport";
  if (findingItem.category === "illegal_debug_visual") return "hide_invalid_visual";
  if (findingItem.category === "density") return "reduce_visual_density";
  if (findingItem.category === "readability") return "resize_for_readability";
  if (findingItem.category === "semantic") return "replace_visual_recipe";
  if (findingItem.category === "world_fact_consistency") return "hide_invalid_visual";
  if (findingItem.category === "structure_logic") return "resize_for_readability";
  if (findingItem.category === "construction_stage") return "add_construction_stage_cue";
  if (findingItem.category === "access_readability") return "add_access_trace_cue";
  if (findingItem.category === "path_connectivity") return "reconnect_path_visuals";
  if (findingItem.category === "ecology_coherence") return "cluster_ecology_transition";
  if (
    findingItem.category === "composition" &&
    findingItem.tags.includes("ai_visual_standard")
  ) {
    return "strengthen_world_composition";
  }
  if (findingItem.category === "player_focus") return "protect_player_focus_area";
  if (findingItem.category === "business_rule") return "remove_forbidden_visual_token";
  if (findingItem.category === "style_safety") return "remove_forbidden_visual_token";

  return "reposition_within_canvas";
}

function correctionPriorityForFinding(
  findingItem: VisualJudgeFinding
): VisualCorrectionIntent["priority"] {
  if (findingItem.severity === "fail") return "high";
  if (
    findingItem.category === "construction_stage" ||
    findingItem.category === "access_readability" ||
    findingItem.category === "player_focus"
  ) {
    return "medium";
  }

  return findingItem.severity === "warn" ? "medium" : "low";
}

function correctionParametersForIntent(
  intentType: VisualCorrectionIntent["type"]
): VisualCorrectionIntent["parameters"] {
  if (intentType === "reduce_visual_density") {
    return { densityMultiplier: 0.62, opacityMultiplier: 0.62 };
  }
  if (intentType === "resize_for_readability") {
    return { scaleMultiplier: 1.18 };
  }
  if (intentType === "reposition_within_canvas") {
    return { moveStrategy: "clamp_to_canvas" };
  }
  if (intentType === "add_construction_stage_cue") {
    return {
      preferredLayer: "object",
      preferredCue: "foundation_or_scaffold_visual_only",
    };
  }
  if (intentType === "add_access_trace_cue") {
    return {
      preferredLayer: "trace",
      preferredCue: "worn_grass_or_maintenance_path_visual_only",
      moveStrategy: "toward_structure_entrance",
    };
  }
  if (intentType === "reconnect_path_visuals") {
    return {
      preferredLayer: "trace",
      preferredCue: "bridge_isolated_trace_patches_visual_only",
      moveStrategy: "connect_nearest_trace_clusters",
    };
  }
  if (intentType === "cluster_ecology_transition") {
    return {
      preferredLayer: "trace",
      preferredCue: "cluster_ecology_patch_visual_only",
      moveStrategy: "cluster_near_ecology_source",
    };
  }
  if (intentType === "strengthen_world_composition") {
    return {
      preferredLayer: "trace",
      preferredCue: "foreground_worn_grass_and_terrain_transition_visual_only",
      moveStrategy: "rebalance_foreground_middle_background",
    };
  }
  if (intentType === "crop_to_story_viewport") {
    return {
      moveStrategy: "crop_read_only_pixel_buffer_to_player_story_viewport",
      preferredCue: "story_viewport",
    };
  }
  if (intentType === "protect_player_focus_area") {
    return {
      opacityMultiplier: 0.62,
      moveStrategy: "reduce_or_move_from_central_focus",
    };
  }

  return {};
}

function correctionTypeForFinding(findingItem: VisualJudgeFinding): VisualCorrectionActionType {
  if (isStoryFrameTooZoomedOutFinding(findingItem)) return "crop_to_story_viewport";
  if (findingItem.category === "illegal_debug_visual") return "remove_visual_block";
  if (findingItem.category === "density") return "reduce_visual_density";
  if (findingItem.category === "readability") return "resize_visual_object";
  if (findingItem.category === "semantic") return "replace_visual_recipe";
  if (findingItem.category === "world_fact_consistency") return "remove_visual_block";
  if (findingItem.category === "structure_logic") return "resize_visual_object";
  if (findingItem.category === "construction_stage") return "generate_visual_cue";
  if (findingItem.category === "access_readability") return "generate_visual_cue";
  if (findingItem.category === "path_connectivity") return "generate_visual_cue";
  if (findingItem.category === "ecology_coherence") return "generate_visual_cue";
  if (
    findingItem.category === "composition" &&
    findingItem.tags.includes("ai_visual_standard")
  ) {
    return "generate_visual_cue";
  }
  if (findingItem.category === "player_focus") return "reduce_visual_density";
  if (findingItem.category === "business_rule") return "remove_forbidden_visual_token";
  if (findingItem.category === "style_safety") return "remove_forbidden_visual_token";

  return "reposition_visual_object";
}

function isStoryFrameTooZoomedOutFinding(findingItem: VisualJudgeFinding): boolean {
  return (
    findingItem.id === "visual_judge_ai_standard_story_frame_too_zoomed_out" ||
    findingItem.tags.includes("story_frame_too_zoomed_out")
  );
}

function resolveActionForCell(
  cell: PixelWorldBufferCell,
  actionByTarget: Map<string, VisualCorrectionAction>
): VisualCorrectionAction | null {
  return (
    actionByTarget.get(cell.id) ??
    actionByTarget.get(cell.sourceCommandId) ??
    (cell.recipeId ? actionByTarget.get(cell.recipeId) : undefined) ??
    actionByTarget.get(objectSourceIdForCell(cell) ?? "") ??
    null
  );
}

function buildVisualOnlyGeneratedCellsForIntent(input: {
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  intent: VisualCorrectionIntent;
  action: VisualCorrectionAction;
}): PixelWorldBufferCell[] {
  if (input.intent.type === "add_construction_stage_cue") {
    return buildConstructionStageCueCells(input);
  }
  if (input.intent.type === "add_access_trace_cue") {
    return buildAccessTraceCueCells(input);
  }
  if (input.intent.type === "reconnect_path_visuals") {
    return buildTraceConnectorCueCells(input);
  }
  if (input.intent.type === "cluster_ecology_transition") {
    return buildEcologyClusterCueCells(input);
  }

  return [];
}

function buildConstructionStageCueCells(input: {
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  intent: VisualCorrectionIntent;
  action: VisualCorrectionAction;
}): PixelWorldBufferCell[] {
  const objectCells = objectCellsForSourceInFrame(
    input.pixelBufferFrame,
    input.intent.targetId
  );

  if (objectCells.length === 0) return [];

  const bounds = boundsForCells(objectCells);
  const baseY = clampNumber(
    Math.round(bounds.y + bounds.height - 5),
    0,
    Math.max(0, input.pixelBufferFrame.canvas.height - 3)
  );
  const leftX = clampNumber(
    Math.round(bounds.x + bounds.width * 0.16),
    0,
    Math.max(0, input.pixelBufferFrame.canvas.width - 4)
  );
  const rightX = clampNumber(
    Math.round(bounds.x + bounds.width * 0.72),
    0,
    Math.max(0, input.pixelBufferFrame.canvas.width - 4)
  );
  const foundationWidth = clampNumber(
    Math.round(bounds.width * 0.72),
    4,
    Math.max(4, input.pixelBufferFrame.canvas.width - leftX)
  );

  return [
    createVisualOnlyCell({
      id: `visual_only_stage_foundation_${input.intent.targetId}`,
      layer: "object",
      kind: "object_block",
      x: leftX,
      y: baseY,
      width: foundationWidth,
      height: 3,
      sourceCommandId: `render_object_block_${input.intent.targetId}_block_visual_correction_stage_foundation`,
      recipeId: `visual_only_stage_cue_${input.intent.targetId}`,
      colorHint: "#6f5f46",
      opacity: 0.86,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "under_construction",
        "foundation",
        "construction_stage",
        input.intent.id,
        input.action.id,
      ],
    }),
    createVisualOnlyCell({
      id: `visual_only_stage_scaffold_left_${input.intent.targetId}`,
      layer: "object",
      kind: "object_block",
      x: leftX,
      y: clampNumber(baseY - 18, 0, input.pixelBufferFrame.canvas.height - 5),
      width: 3,
      height: 18,
      sourceCommandId: `render_object_block_${input.intent.targetId}_block_visual_correction_stage_scaffold_left`,
      recipeId: `visual_only_stage_cue_${input.intent.targetId}`,
      colorHint: "#8a6d45",
      opacity: 0.72,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "scaffold",
        "construction_stage",
        input.intent.id,
        input.action.id,
      ],
    }),
    createVisualOnlyCell({
      id: `visual_only_stage_scaffold_right_${input.intent.targetId}`,
      layer: "object",
      kind: "object_block",
      x: rightX,
      y: clampNumber(baseY - 18, 0, input.pixelBufferFrame.canvas.height - 5),
      width: 3,
      height: 18,
      sourceCommandId: `render_object_block_${input.intent.targetId}_block_visual_correction_stage_scaffold_right`,
      recipeId: `visual_only_stage_cue_${input.intent.targetId}`,
      colorHint: "#8a6d45",
      opacity: 0.72,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "scaffold",
        "construction_stage",
        input.intent.id,
        input.action.id,
      ],
    }),
  ];
}

function buildAccessTraceCueCells(input: {
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  intent: VisualCorrectionIntent;
  action: VisualCorrectionAction;
}): PixelWorldBufferCell[] {
  const objectCells = objectCellsForSourceInFrame(
    input.pixelBufferFrame,
    input.intent.targetId
  );

  if (objectCells.length === 0) return [];

  const bounds = boundsForCells(objectCells);
  const entrance = {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height + 4),
  };
  const tileSize = input.pixelBufferFrame.canvas.tileSize;

  return [0, 1, 2].map((index) =>
    createVisualOnlyCell({
      id: `visual_only_access_trace_${input.intent.targetId}_${index}`,
      layer: "trace",
      kind: "trace",
      x: clampNumber(
        entrance.x - 5 - index * Math.round(tileSize * 0.42),
        0,
        input.pixelBufferFrame.canvas.width - 7
      ),
      y: clampNumber(
        entrance.y + index * 3,
        0,
        input.pixelBufferFrame.canvas.height - 5
      ),
      width: 7,
      height: 5,
      sourceCommandId: `render_trace_visual_correction_access_${input.intent.targetId}_${index}`,
      colorHint: "#6f7f52",
      opacity: 0.56,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "access_trace",
        "maintenance_trace",
        "worn_grass",
        input.intent.id,
        input.action.id,
      ],
    })
  );
}

function buildTraceConnectorCueCells(input: {
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  intent: VisualCorrectionIntent;
  action: VisualCorrectionAction;
}): PixelWorldBufferCell[] {
  const traceCells = input.pixelBufferFrame.layers
    .flatMap((layer) => layer.cells)
    .filter((cell) => cell.visible && cell.opacity > 0 && cell.kind === "trace");

  if (traceCells.length < 2) return [];

  const sorted = [...traceCells].sort((left, right) => left.x + left.y - (right.x + right.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const steps = clampNumber(
    Math.ceil(cellDistance(first, last) / (input.pixelBufferFrame.canvas.tileSize * 0.8)),
    4,
    18
  );

  return Array.from({ length: steps }, (_, index) => {
    const progress = steps === 1 ? 0 : index / (steps - 1);
    const x = Math.round(first.x + (last.x - first.x) * progress);
    const y = Math.round(first.y + (last.y - first.y) * progress);

    return createVisualOnlyCell({
      id: `visual_only_trace_connector_${input.intent.id}_${index}`,
      layer: "trace",
      kind: "trace",
      x: clampNumber(x, 0, input.pixelBufferFrame.canvas.width - 14),
      y: clampNumber(y, 0, input.pixelBufferFrame.canvas.height - 8),
      width: 14,
      height: 8,
      sourceId: `visual_only_trace_connector_${input.intent.id}`,
      sourceCommandId: `render_trace_visual_correction_connector_${input.intent.id}_${index}`,
      colorHint: index % 2 === 0 ? "#66774d" : "#70845a",
      opacity: 0.5,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "trace_connector",
        "path_connectivity",
        "worn_grass",
        input.intent.id,
        input.action.id,
      ],
    });
  });
}

function buildEcologyClusterCueCells(input: {
  pixelBufferFrame: PixelWorldPixelBufferFrame;
  intent: VisualCorrectionIntent;
  action: VisualCorrectionAction;
}): PixelWorldBufferCell[] {
  const ecologyCells = input.pixelBufferFrame.layers
    .flatMap((layer) => layer.cells)
    .filter((cell) =>
      cell.visible &&
      cell.opacity > 0 &&
      (cell.stateTags ?? []).some((tag) =>
        ["ecology", "recovery", "growth", "natural"].some((token) => tag.includes(token))
      )
    );

  if (ecologyCells.length === 0) return [];

  const bounds = boundsForCells(ecologyCells);
  const center = {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
  };

  return [
    createVisualOnlyCell({
      id: `visual_only_ecology_tint_${input.intent.id}`,
      layer: "atmosphere",
      kind: "atmosphere",
      x: 0,
      y: 0,
      width: input.pixelBufferFrame.canvas.width,
      height: input.pixelBufferFrame.canvas.height,
      sourceId: `visual_only_ecology_tint_${input.intent.id}`,
      sourceCommandId: `render_atmosphere_visual_correction_ecology_tint_${input.intent.id}`,
      colorHint: "#6aa36a",
      opacity: 0.08,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "ecology_tint_signal",
        "ecology_coherence",
        input.intent.id,
        input.action.id,
      ],
    }),
    createVisualOnlyCell({
      id: `visual_only_ecology_cluster_${input.intent.id}`,
      layer: "trace",
      kind: "trace",
      x: clampNumber(center.x - 8, 0, input.pixelBufferFrame.canvas.width - 16),
      y: clampNumber(center.y - 5, 0, input.pixelBufferFrame.canvas.height - 10),
      width: 16,
      height: 10,
      sourceCommandId: `render_trace_visual_correction_ecology_cluster_${input.intent.id}`,
      colorHint: "#5f8f5a",
      opacity: 0.36,
      stateTags: [
        "visual_only",
        "visual_correction_generated",
        "ecology_transition",
        "ecology_cluster",
        input.intent.id,
        input.action.id,
      ],
    }),
  ];
}

function createVisualOnlyCell(input: {
  id: string;
  layer: PixelWorldBufferCell["layer"];
  kind: PixelWorldBufferCell["kind"];
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId?: string;
  sourceCommandId: string;
  colorHint: string;
  opacity: number;
  stateTags: string[];
  recipeId?: string;
}): PixelWorldBufferCell {
  return {
    id: input.id,
    layer: input.layer,
    kind: input.kind,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    sourceId: input.sourceId,
    sourceCommandId: input.sourceCommandId,
    visible: true,
    opacity: input.opacity,
    colorHint: input.colorHint,
    recipeId: input.recipeId,
    stateTags: input.stateTags,
  };
}

function addGeneratedCellsToLayers(
  layers: PixelWorldBufferLayer[],
  generatedCells: PixelWorldBufferCell[]
): PixelWorldBufferLayer[] {
  const layerKinds = new Set(layers.map((layer) => layer.layer));
  const missingLayers = Array.from(new Set(generatedCells.map((cell) => cell.layer)))
    .filter((layer) => !layerKinds.has(layer))
    .map<PixelWorldBufferLayer>((layer) => ({
      layer,
      cells: [],
      visibleCount: 0,
      hiddenCount: 0,
    }));

  return [...layers, ...missingLayers].map((layer) => {
    const cellsToAdd = generatedCells.filter((cell) => cell.layer === layer.layer);
    if (cellsToAdd.length === 0) return layer;

    const cells = [...layer.cells, ...cellsToAdd];

    return {
      ...layer,
      cells,
      visibleCount: cells.filter((cell) => cell.visible).length,
      hiddenCount: cells.filter((cell) => !cell.visible).length,
    };
  });
}

function cropPixelBufferFrameToStoryViewport(
  frame: PixelWorldPixelBufferFrame
): PixelWorldPixelBufferFrame | null {
  const visibleFrameCells = frame.layers
    .flatMap((layer) => layer.cells)
    .filter((cell) => cell.visible && cell.opacity > 0);
  const primaryStoryCells = visibleFrameCells.filter(isPrimaryStoryViewportAnchorCell);
  const activeStoryCells =
    primaryStoryCells.length > 0
      ? primaryStoryCells
      : visibleFrameCells.filter(isActiveStoryViewportAnchorCell);
  const storyCells =
    activeStoryCells.length > 0
      ? activeStoryCells
      : visibleFrameCells.filter(isStoryViewportAnchorCell);

  if (storyCells.length === 0) return null;

  const storyBounds = boundsForCells(storyCells);
  const viewport = buildStoryViewportBounds({
    frame,
    storyBounds,
  });
  const croppedLayers = frame.layers.map<PixelWorldBufferLayer>((layer) => {
    const cells = layer.cells
      .map((cell) => cropCellToViewport(cell, viewport))
      .filter((cell): cell is PixelWorldBufferCell => Boolean(cell));

    return {
      ...layer,
      cells,
      visibleCount: cells.filter((cell) => cell.visible).length,
      hiddenCount: cells.filter((cell) => !cell.visible).length,
    };
  });

  return {
    ...frame,
    bufferId: `${frame.bufferId}_story_viewport_corrected`,
    canvas: {
      ...frame.canvas,
      width: viewport.width,
      height: viewport.height,
    },
    layers: croppedLayers,
    cellCount: croppedLayers.reduce((sum, layer) => sum + layer.cells.length, 0),
  };
}

function buildStoryViewportBounds(input: {
  frame: PixelWorldPixelBufferFrame;
  storyBounds: { x: number; y: number; width: number; height: number };
}): { x: number; y: number; width: number; height: number } {
  const canvas = input.frame.canvas;
  const padding = canvas.tileSize * 7;
  const minWidth = Math.min(canvas.width, 1024);
  const minHeight = Math.min(canvas.height, 720);
  const maxWidth = Math.min(canvas.width, 1280);
  const maxHeight = Math.min(canvas.height, 768);
  const desiredWidth = clampNumber(
    Math.round(input.storyBounds.width + padding * 2),
    minWidth,
    maxWidth
  );
  const desiredHeight = clampNumber(
    Math.round(input.storyBounds.height + padding * 2),
    minHeight,
    maxHeight
  );
  const centerX = input.storyBounds.x + input.storyBounds.width / 2;
  const centerY = input.storyBounds.y + input.storyBounds.height / 2;
  const x = clampNumber(
    Math.round(centerX - desiredWidth / 2),
    0,
    Math.max(0, canvas.width - desiredWidth)
  );
  const y = clampNumber(
    Math.round(centerY - desiredHeight / 2),
    0,
    Math.max(0, canvas.height - desiredHeight)
  );

  return {
    x,
    y,
    width: desiredWidth,
    height: desiredHeight,
  };
}

function cropCellToViewport(
  cell: PixelWorldBufferCell,
  viewport: { x: number; y: number; width: number; height: number }
): PixelWorldBufferCell | null {
  const left = Math.max(cell.x, viewport.x);
  const top = Math.max(cell.y, viewport.y);
  const right = Math.min(cell.x + cell.width, viewport.x + viewport.width);
  const bottom = Math.min(cell.y + cell.height, viewport.y + viewport.height);

  if (right <= left || bottom <= top) return null;

  return {
    ...cell,
    id: `${cell.id}_story_viewport`,
    x: left - viewport.x,
    y: top - viewport.y,
    width: right - left,
    height: bottom - top,
    stateTags: [...(cell.stateTags ?? []), "story_viewport_crop_projection"],
  };
}

function isStoryViewportAnchorCell(cell: PixelWorldBufferCell): boolean {
  const tags = cell.stateTags ?? [];
  const sourceTokens = [
    cell.id,
    cell.sourceId ?? "",
    cell.sourceCommandId,
    cell.recipeId ?? "",
    ...tags,
  ];

  return sourceTokens.some((token) =>
    [
      "story_staging_trace",
      "story_trace_role",
      "construction",
      "under_construction",
      "foundation",
      "scaffold",
      "story_anchor",
    ].some((storyToken) => token.includes(storyToken))
  );
}

function isActiveStoryViewportAnchorCell(cell: PixelWorldBufferCell): boolean {
  const tags = cell.stateTags ?? [];
  const sourceTokens = [
    cell.id,
    cell.sourceId ?? "",
    cell.sourceCommandId,
    cell.recipeId ?? "",
    ...tags,
  ];

  return sourceTokens.some((token) =>
    [
      "story_staging_trace",
      "construction",
      "under_construction",
      "foundation",
      "scaffold",
      "worked_ground",
      "access_path",
    ].some((storyToken) => token.includes(storyToken))
  );
}

function isPrimaryStoryViewportAnchorCell(cell: PixelWorldBufferCell): boolean {
  const tags = cell.stateTags ?? [];
  const sourceTokens = [
    cell.id,
    cell.sourceId ?? "",
    cell.sourceCommandId,
    cell.recipeId ?? "",
    ...tags,
  ];

  return sourceTokens.some((token) =>
    [
      "foundation",
      "scaffold",
      "under_construction",
      "worked_ground",
      "story_work_yard",
      "story_material_cluster",
      "construction_material_readability",
    ].some((storyToken) => token.includes(storyToken))
  );
}

function objectCellsForSourceInFrame(
  frame: PixelWorldPixelBufferFrame,
  sourceObjectId: string
): PixelWorldBufferCell[] {
  return frame.layers
    .flatMap((layer) => layer.cells)
    .filter(
      (cell) =>
        cell.visible &&
        cell.opacity > 0 &&
        cell.kind === "object_block" &&
        objectSourceIdForCell(cell) === sourceObjectId
    );
}

function applyCorrectionActionToCell(input: {
  cell: PixelWorldBufferCell;
  actionType: VisualCorrectionActionType;
  canvas: PixelWorldPixelBufferFrame["canvas"];
}): PixelWorldBufferCell {
  const cell = input.cell;

  if (
    input.actionType === "remove_visual_block" ||
    input.actionType === "remove_forbidden_visual_token" ||
    input.actionType === "replace_visual_recipe"
  ) {
    return {
      ...cell,
      visible: false,
      opacity: 0,
      stateTags: [...(cell.stateTags ?? []), "visual_correction_hidden"],
    };
  }

  if (input.actionType === "reduce_visual_density") {
    return {
      ...cell,
      opacity: Math.max(0, Number((cell.opacity * 0.62).toFixed(3))),
      stateTags: [...(cell.stateTags ?? []), "visual_correction_density_reduced"],
    };
  }

  if (input.actionType === "resize_visual_object") {
    return {
      ...cell,
      width: Math.max(1, Math.round(cell.width * 1.18)),
      height: Math.max(1, Math.round(cell.height * 1.18)),
      stateTags: [...(cell.stateTags ?? []), "visual_correction_resized"],
    };
  }

  if (input.actionType === "reposition_visual_object") {
    return {
      ...cell,
      x: clampNumber(cell.x, 0, Math.max(0, input.canvas.width - cell.width)),
      y: clampNumber(cell.y, 0, Math.max(0, input.canvas.height - cell.height)),
      stateTags: [...(cell.stateTags ?? []), "visual_correction_repositioned"],
    };
  }

  return {
    ...cell,
    stateTags: [...(cell.stateTags ?? []), "visual_correction_noop"],
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractObjectSourceIdFromCommandId(commandId: string): string | null {
  const prefix = "render_object_block_";
  if (!commandId.startsWith(prefix)) return null;

  const withoutPrefix = commandId.slice(prefix.length);
  const blockIndex = withoutPrefix.lastIndexOf("_block_");
  if (blockIndex <= 0) return null;

  return withoutPrefix.slice(0, blockIndex);
}

function sourceIdFromNonObjectCommandId(commandId: string): string | null {
  const knownPrefixes = [
    "render_tile_",
    "render_trace_",
    "render_actor_",
    "render_atmosphere_",
    "render_overlay_",
  ];
  const prefix = knownPrefixes.find((item) => commandId.startsWith(item));

  if (!prefix) return null;

  return commandId.slice(prefix.length);
}
