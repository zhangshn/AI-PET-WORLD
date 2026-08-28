import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { selectAuthoritativeTrainingEvidence } from "../src/server/ai-painter-training-status-projection.mjs";
import {
  projectAutonomousStage4TaskCapsule,
  projectPostDecodeObjectRgbSmokeTaskCapsule,
  projectR5Stage4TaskCapsule,
} from "../src/server/ai-painter-task-capsule-projection.mjs";
import { deriveSelectedRunValidationSummary } from "../src/app/ai-painter-progress/_lib/selected-run-validation-summary.mjs";

const root = process.cwd();
const files = {
  entry: "src/app/ai-painter-progress/progress-client.tsx",
  page: "src/app/ai-painter-progress/current-training/current-training-dashboard.tsx",
  controls:
    "src/app/ai-painter-progress/current-training/training-dashboard-controls.tsx",
  runDetail:
    "src/app/ai-painter-progress/current-training/runs/[runId]/training-run-detail.tsx",
  parameterCatalog:
    "src/app/ai-painter-progress/_lib/training-parameter-catalog.ts",
  parameterDictionary:
    "data/ai-painter/system-governance/local-ai-model-data-dictionary-v1.json",
  styles: "src/app/ai-painter-progress/current-training/page.module.css",
  api: "src/app/api/ai-painter/current-training/route.ts",
  imageApi: "src/app/api/ai-painter/training-data-image/route.ts",
  server: "src/server/ai-painter-current-training.ts",
  liveProjection: "src/server/ai-painter-live-activity-projection.mjs",
  taskCapsuleProjection: "src/server/ai-painter-task-capsule-projection.mjs",
  types: "src/app/ai-painter-progress/_lib/current-training-dashboard-types.ts",
  contract:
    "data/ai-painter/system-governance/ai-painter-current-training-dashboard-contract-v1.json",
  migration:
    "data/ai-painter/system-governance/local-ai-capability-migration-registry-v1.json",
  plan: "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  resourceUsage: "src/server/ai-painter-resource-usage.ts",
  validationRunner: "scripts/run-ai-assisted-v7-post-training-validation.mjs",
  singleValidationRunner:
    "scripts/run-ai-assisted-conditional-inference-validation.mjs",
  trainingRunner:
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  formalStageRunner:
    "scripts/run-ai-painter-stage4-authoritative-semantic-carrier-stage0.mjs",
  r2SmokeRunner:
    "scripts/run-ai-assisted-v7-bounded-repair-r2-overfit-smoke.mjs",
  r2SmokeReconciliation:
    "scripts/reconcile-ai-assisted-v7-r2-smoke-record-closure.mjs",
  ownerRequestStore: "scripts/lib/ai-painter-owner-action-request-store.mjs",
  pointer:
    "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json",
};
const source = Object.fromEntries(
  Object.entries(files).map(([key, value]) => [
    key,
    fs.readFileSync(path.join(root, value), "utf8"),
  ]),
);
const pointer = JSON.parse(source.pointer);
const contract = JSON.parse(source.contract);
const parameterDictionary = JSON.parse(source.parameterDictionary);
const migration = JSON.parse(source.migration);
const sha256File = (relativePath) =>
  createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
const r5Stage4FinalizationRoot = path.join(
  root,
  ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations",
);
const r5Stage4TerminalCandidates = fs
  .readdirSync(r5Stage4FinalizationRoot, {
    withFileTypes: true,
  })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const terminalPath = `.runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations/${entry.name}/phase-terminal.json`;
    if (!fs.existsSync(path.join(root, terminalPath))) return null;
    return {
      path: terminalPath,
      value: JSON.parse(fs.readFileSync(path.join(root, terminalPath), "utf8")),
    };
  })
  .filter(Boolean)
  .sort(
    (left, right) =>
      Date.parse(right.value.recordedAtUtc ?? "") -
      Date.parse(left.value.recordedAtUtc ?? ""),
  );
const r5Stage4TerminalRecord = r5Stage4TerminalCandidates[0];
const r5Stage4Terminal = r5Stage4TerminalRecord.value;
const r5Stage4Finalization = JSON.parse(
  fs.readFileSync(
    path.join(root, r5Stage4Terminal.finalizationReportPath),
    "utf8",
  ),
);
const r5Stage4Review = JSON.parse(
  fs.readFileSync(
    path.join(root, r5Stage4Finalization.review.reviewPath),
    "utf8",
  ),
);
const r5Stage4Authorization = JSON.parse(
  fs.readFileSync(
    path.join(root, r5Stage4Finalization.authorizationPath),
    "utf8",
  ),
);
const r5TaskCapsuleEvidence = [
  ["stage4_terminal", r5Stage4TerminalRecord.path, null],
  [
    "stage4_finalization",
    r5Stage4Terminal.finalizationReportPath,
    r5Stage4Terminal.finalizationReportSha256,
  ],
  [
    "machine_review",
    r5Stage4Finalization.review.reviewPath,
    r5Stage4Finalization.review.reviewSha256,
  ],
  [
    "owner_authorization",
    r5Stage4Finalization.authorizationPath,
    r5Stage4Finalization.authorizationSha256,
  ],
  [
    "owner_implementation_consumption",
    r5Stage4Finalization.implementationConsumptionPath,
    r5Stage4Finalization.implementationConsumptionSha256,
  ],
  [
    "owner_gpu_execution_consumption",
    r5Stage4Finalization.executionConsumptionPath,
    r5Stage4Finalization.executionConsumptionSha256,
  ],
  ["unique_module_plan", files.plan, null],
  ["migration_registry", files.migration, null],
].map(([kind, evidencePath, expectedSha256]) => ({
  kind,
  labelZh: kind,
  path: evidencePath,
  sha256: sha256File(evidencePath),
  expectedSha256,
}));
const r5TaskCapsule = projectR5Stage4TaskCapsule({
  terminal: r5Stage4Terminal,
  finalization: r5Stage4Finalization,
  review: r5Stage4Review,
  authorization: r5Stage4Authorization,
  evidence: r5TaskCapsuleEvidence,
  migrationRegistryStatus: migration.status,
  planEvidenceConfirmed:
    source.plan.includes("固定总进度为3/5（60%）") &&
    source.plan.includes("新的分析、候选或执行均需独立明确授权"),
});
const r5TaskCapsulePreviewEvidenceMatches =
  (r5Stage4Terminal.status ===
    "stage4_continuous_closure_candidate_route_failed_closed" &&
    r5TaskCapsule.candidateTerminal.previewPassCount === 0 &&
    r5TaskCapsule.candidateTerminal.previewCount === 0) ||
  (r5Stage4Terminal.status ===
    "stage4_bounded_repair_single_sample_gpu_smoke_failed_stopped" &&
    r5TaskCapsule.candidateTerminal.previewPassCount === 1 &&
    r5TaskCapsule.candidateTerminal.previewCount === 5);
const mismatchedCapsule = projectR5Stage4TaskCapsule({
  terminal: r5Stage4Terminal,
  finalization: r5Stage4Finalization,
  review: r5Stage4Review,
  authorization: r5Stage4Authorization,
  evidence: r5TaskCapsuleEvidence.map((item) =>
    item.kind === "machine_review"
      ? { ...item, expectedSha256: "0".repeat(64) }
      : item,
  ),
  migrationRegistryStatus: migration.status,
  planEvidenceConfirmed: true,
});
const autonomousEvidence = Array.from({ length: 9 }, (_, index) => ({
  kind: `autonomous-${index}`,
  labelZh: `自治证据${index}`,
  path: `evidence/${index}.json`,
  sha256: String(index).padStart(64, "0"),
  expectedSha256: String(index).padStart(64, "0"),
}));
const autonomousTaskCapsule = projectAutonomousStage4TaskCapsule({
  pointer: { runId: "stage4-post-carrier-current" },
  terminal: {
    executionState: "completed",
    status: "failed_closed_candidate_space_exhausted",
    selectedOutcome: "no_unique_bounded_candidate_remaining",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc: "2026-08-24T20:40:01.291Z",
  },
  savedCapsule: {
    runId: "stage4-post-carrier-current",
    status: "failed_closed_candidate_space_exhausted",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
  },
  evidence: autonomousEvidence,
  previewCount: 6,
  previewPassCount: 0,
});
const postDecodeEvidence = Array.from({ length: 7 }, (_, index) => ({
  kind: `post-decode-${index}`,
  labelZh: `解码后对象RGB证据${index}`,
  path: `evidence/post-decode-${index}.json`,
  sha256: String(index + 1).padStart(64, "0"),
  expectedSha256: String(index + 1).padStart(64, "0"),
}));
const postDecodeQualifiedCapsule = projectPostDecodeObjectRgbSmokeTaskCapsule({
  terminal: {
    executionState: "completed",
    status: "post_decode_object_rgb_controlled_smoke_qualified",
    capabilityVersion: "stage4-post-decode-object-rgb-current",
    attemptId: "stage4-post-decode-object-rgb-current-smoke",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc: "2026-08-25T04:47:57.581Z",
  },
  finalization: {
    status: "post_decode_object_rgb_controlled_smoke_qualified",
    capabilityVersion: "stage4-post-decode-object-rgb-current",
    checkpoint: { path: "smoke/non-promotable.pt", promotable: false },
  },
  review: {
    status: "machine_reviews_failed",
    previewCount: 5,
    previewPassCount: 2,
    previewFailCount: 3,
  },
  qualification: {
    status: "qualified",
    qualified: true,
    terminalRegression: false,
  },
  lifecycle: {
    capabilityVersion: "stage4-post-decode-object-rgb-current",
    state: "controlled_smoke_completed",
  },
  evidence: postDecodeEvidence,
  planEvidenceConfirmed: true,
});
const postDecodeTamperedCapsule = projectPostDecodeObjectRgbSmokeTaskCapsule({
  terminal: {
    executionState: "completed",
    status: "post_decode_object_rgb_controlled_smoke_qualified",
    capabilityVersion: "stage4-post-decode-object-rgb-current",
    attemptId: "stage4-post-decode-object-rgb-current-smoke",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  },
  finalization: {
    status: "post_decode_object_rgb_controlled_smoke_qualified",
    capabilityVersion: "stage4-post-decode-object-rgb-current",
    checkpoint: { path: "smoke/non-promotable.pt", promotable: false },
  },
  review: {
    status: "machine_reviews_failed",
    previewCount: 5,
    previewPassCount: 2,
    previewFailCount: 3,
  },
  qualification: {
    status: "qualified",
    qualified: true,
    terminalRegression: false,
  },
  lifecycle: {
    capabilityVersion: "stage4-post-decode-object-rgb-current",
    state: "controlled_smoke_completed",
  },
  evidence: postDecodeEvidence.map((item, index) =>
    index === 2 ? { ...item, expectedSha256: "f".repeat(64) } : item,
  ),
  planEvidenceConfirmed: true,
});
const selectedRunValidationSummary = deriveSelectedRunValidationSummary({
  stage: {
    runId: "latest-formal-stage0",
    previews: Array.from({ length: 6 }, () => ({
      machineReviewPassed: false,
    })),
  },
  candidateTerminal: {
    runId: "older-controlled-smoke",
    previewCount: 5,
    previewPassCount: 2,
    previewFailCount: 3,
  },
});
const reconciliationPointer = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".runtime/ai-painter/v7-post-training-validation-reconciliations/latest.json",
    ),
    "utf8",
  ),
);
const reconciliation = JSON.parse(
  fs.readFileSync(path.join(root, reconciliationPointer.reportPath), "utf8"),
);
const fullTrainingFinalizationPointer = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".runtime/ai-painter/v7-bounded-repair-r1-full-training-finalizations/latest.json",
    ),
    "utf8",
  ),
);
const fullTrainingFinalization = JSON.parse(
  fs.readFileSync(
    path.join(root, fullTrainingFinalizationPointer.reportPath),
    "utf8",
  ),
);
const strictValidationPointer = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".runtime/ai-painter/v7-repair-r1-strict-revalidations/latest.json",
    ),
    "utf8",
  ),
);
const strictValidationReport = JSON.parse(
  fs.readFileSync(path.join(root, strictValidationPointer.runPath), "utf8"),
);
const latestRepairStage2 = fullTrainingFinalization.stageResults?.find(
  (stage) => stage.stageIndex === 2,
);
const ownerRequestPointer = JSON.parse(
  fs.readFileSync(
    path.join(root, ".runtime/ai-painter/owner-action-requests/latest.json"),
    "utf8",
  ),
);
const ownerRequest = JSON.parse(
  fs.readFileSync(path.join(root, ownerRequestPointer.runPath), "utf8"),
);
const stage2Ledger = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".runtime/ai-painter/training-token-ledgers/ai-assisted-conditional-denoiser-v7-stage-2-2026-08-02T05-20-16-111Z/ledger.json",
    ),
    "utf8",
  ),
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, pointer.manifestPath), "utf8"),
);
const sourceIndex = JSON.parse(
  fs.readFileSync(path.join(root, manifest.sourceIndexPath), "utf8"),
);
const v7Rows = sourceIndex.samples.filter(
  (row) => row.v7CapacityContributionRegistered === true,
);
const loadedRows = sourceIndex.samples.filter(
  (row) =>
    row.categoryId === "complete-maps" &&
    row.trainingRoles?.includes("conditional_denoiser") &&
    row.formalConditionalTrainingEligible === true &&
    row.conditionBound === true &&
    row.v7CapacityContributionRegistered === true &&
    row.ownerReviewStatus === "owner_approved" &&
    row.machineReviewStatus === "passed" &&
    row.aiAssistedColdStartEligible === true &&
    row.independentTrainingEligible === false,
);
const projectionTask = {
  modelId: "model-current",
  datasetPackageId: "dataset-current",
  checkpointSha256: "checkpoint-current",
};
const newerTerminalProjection = selectAuthoritativeTrainingEvidence(
  [
    {
      code: "running",
      label: "running",
      summary: "old live",
      source: "heartbeat",
      occurredAtUtc: "2026-08-02T08:00:00.000Z",
      terminalPriority: 10,
      taskIdentity: projectionTask,
    },
    {
      code: "resource_blocked",
      label: "blocked",
      summary: "new terminal",
      source: "finalization",
      occurredAtUtc: "2026-08-02T09:00:00.000Z",
      terminalPriority: 80,
      taskIdentity: projectionTask,
    },
  ],
  projectionTask,
);
const mismatchedTaskProjection = selectAuthoritativeTrainingEvidence(
  [
    {
      code: "validation_failed",
      label: "wrong task",
      summary: "wrong task",
      source: "reconciliation",
      occurredAtUtc: "2026-08-02T10:00:00.000Z",
      terminalPriority: 90,
      taskIdentity: { ...projectionTask, datasetPackageId: "dataset-old" },
    },
    {
      code: "awaiting_validation",
      label: "current task",
      summary: "current task",
      source: "stage",
      occurredAtUtc: "2026-08-02T09:00:00.000Z",
      terminalPriority: 60,
      taskIdentity: projectionTask,
    },
  ],
  projectionTask,
);
const sameTimeTerminalProjection = selectAuthoritativeTrainingEvidence(
  [
    {
      code: "running",
      label: "running",
      summary: "running",
      source: "heartbeat",
      occurredAtUtc: "2026-08-02T09:00:00.000Z",
      terminalPriority: 10,
      taskIdentity: projectionTask,
    },
    {
      code: "validation_failed",
      label: "failed",
      summary: "failed",
      source: "reconciliation",
      occurredAtUtc: "2026-08-02T09:00:00.000Z",
      terminalPriority: 90,
      taskIdentity: projectionTask,
    },
  ],
  projectionTask,
);
const missingIdentityProjection = selectAuthoritativeTrainingEvidence(
  [
    {
      code: "validation_failed",
      label: "identity missing",
      summary: "identity missing",
      source: "legacy-pointer",
      occurredAtUtc: "2026-08-02T11:00:00.000Z",
      terminalPriority: 90,
      taskIdentity: {},
    },
    {
      code: "awaiting_validation",
      label: "current task",
      summary: "current task",
      source: "stage",
      occurredAtUtc: "2026-08-02T09:00:00.000Z",
      terminalPriority: 60,
      taskIdentity: projectionTask,
    },
  ],
  projectionTask,
);
const partialIdentityProjection = selectAuthoritativeTrainingEvidence(
  [
    {
      code: "resource_blocked",
      label: "dataset missing",
      summary: "dataset missing",
      source: "legacy-finalization",
      occurredAtUtc: "2026-08-02T11:00:00.000Z",
      terminalPriority: 80,
      taskIdentity: { modelId: projectionTask.modelId },
    },
    {
      code: "awaiting_validation",
      label: "current task",
      summary: "current task",
      source: "stage",
      occurredAtUtc: "2026-08-02T09:00:00.000Z",
      terminalPriority: 60,
      taskIdentity: projectionTask,
    },
  ],
  projectionTask,
);
const checks = [
  [
    "homepage_current_run_link",
    source.entry.includes('href="/ai-painter-progress/current-training"'),
  ],
  [
    "dashboard_route_get_only",
    source.api.includes("export async function GET") &&
      !source.api.includes("export async function POST"),
  ],
  [
    "r5_stage4_task_capsule_positive_projection",
    r5TaskCapsule.schemaVersion === "ai-painter-local-task-capsule-v1" &&
      r5TaskCapsule.integrity.status === "verified" &&
      r5TaskCapsule.fixedOverallProgress.percent === 60 &&
      r5TaskCapsule.currentStage.number === 4 &&
      r5TaskCapsule.candidateTerminal.status === "failed_closed" &&
      r5TaskCapsulePreviewEvidenceMatches &&
      r5TaskCapsule.taskIdentity.seed === 20263722 &&
      r5TaskCapsule.taskIdentity.requiredBoundarySides.join(",") === "west",
  ],
  [
    "r5_stage4_task_capsule_negative_hash_gate",
    mismatchedCapsule.integrity.status === "incomplete_or_mismatched" &&
      mismatchedCapsule.integrity.boundEvidenceVerified === false &&
      mismatchedCapsule.candidateTerminal.status === "unknown_or_stale",
  ],
  [
    "unique_current_execution_registry_is_in_existing_read_only_api",
    source.server.includes("readCurrentExecutionRegistry(root)") &&
      !between(
        source.server,
        "async function buildSnapshot()",
        "async function readCurrentR5Stage4TaskCapsule()",
      ).includes("readCurrentR5Stage4TaskCapsule()") &&
      source.server.includes("taskCapsule,") &&
      source.api.includes("readCurrentTrainingDashboard") &&
      !source.api.includes("export async function POST"),
  ],
  [
    "r5_stage4_task_capsule_frontend_fields_visible",
    source.page.includes('data-testid="local-task-capsule"') &&
      source.page.includes("固定总进度") &&
      source.page.includes("当前阶段") &&
      source.page.includes("候选终态") &&
      source.page.includes("证据完整性") &&
      source.page.includes("forbiddenActions"),
  ],
  [
    "server_aggregator_read_only",
    !/\b(writeFile|appendFile|mkdir|rm|unlink|rename)\b/.test(source.server),
  ],
  [
    "locked_contract_is_read_only",
    contract.status === "active_locked" &&
      contract.ownerAuthorization?.writeAuthorizationGranted === false,
  ],
  [
    "locked_contract_is_self_developed",
    contract.implementationOwnership?.selfDeveloped === true &&
      contract.implementationOwnership?.externalDashboardTemplateUsed ===
        false &&
      contract.implementationOwnership?.externalChartLibraryUsed === false,
  ],
  [
    "dashboard_uses_searchable_record_selector",
    source.page.includes("TrainingRecordSelector") &&
      source.controls.includes("training-record-search"),
  ],
  [
    "dashboard_has_fixed_current_training_mission",
    source.page.includes("TrainingMission") &&
      source.page.includes("当前执行主体") &&
      source.page.includes("本地AI正在工作") &&
      source.page.includes("本地AI未运行") &&
      source.page.includes("当前任务实时进度"),
  ],
  [
    "stage_selector_is_top_level_and_switches_inline",
    source.page.includes("topRecordSelector") &&
      source.page.includes("onSelectRun={selectRun}") &&
      source.page.includes('setActiveView("runs")'),
  ],
  [
    "dashboard_uses_single_lower_workspace",
    source.page.includes("workspaceFrame") &&
      source.page.includes("workspaceContent") &&
      source.page.includes("workspace-tab-${item.id}"),
  ],
  [
    "run_evidence_opens_alertdialog_without_navigation",
    source.page.includes('role="alertdialog"') &&
      source.page.includes("run-evidence-dialog-open") &&
      source.page.includes("查看完整证据") &&
      !source.page.includes("打开独立证据页") &&
      !source.page.includes("current-training/runs/${encodeURIComponent"),
  ],
  [
    "run_evidence_dialog_is_closable",
    source.page.includes("run-evidence-dialog-close") &&
      source.page.includes("关闭完整训练证据弹窗") &&
      source.styles.includes(".evidenceDialogBackdrop"),
  ],
  [
    "r2_smoke_previews_are_registered_inline_and_open_alertdialog",
    source.server.includes(
      "project-owned-complete-world-conditional-denoiser-v7-repair-r2",
    ) &&
      source.server.includes("fixed-epoch-previews") &&
      source.page.includes('data-testid="run-preview-section"') &&
      source.page.includes('data-testid="run-preview-dialog"') &&
      source.page.includes("stage.previews.map") &&
      source.styles.includes(".runPreviewGrid"),
  ],
  [
    "r2_smoke_record_closure_is_automatic_and_failure_safe",
    source.r2SmokeRunner.includes("run-start-registration.json") &&
      source.r2SmokeRunner.includes("run-terminal-registration.json") &&
      source.r2SmokeRunner.includes("previewReviewStatus") &&
      source.r2SmokeReconciliation.includes(
        "existing_saved_previews_only_no_retraining",
      ) &&
      source.r2SmokeReconciliation.includes("automaticStorage: true"),
  ],
  [
    "dashboard_rejects_question_mark_corrupted_human_text",
    source.server.includes("function readableHumanText") &&
      source.server.includes("questionMarkCount / candidate.length >= 0.25"),
  ],
  [
    "all_monitor_data_has_detailed_timestamp_contract",
    contract.timestampContract?.displayTimezone === "Asia/Shanghai" &&
      contract.timestampContract?.preserveUtcOriginal === true &&
      source.page.includes("formatDetailedTimestamp") &&
      source.page.includes("详细时间戳") &&
      source.page.includes("UTC原值") &&
      source.page.includes("未记录"),
  ],
  [
    "future_epochs_save_detailed_timestamps",
    source.trainingRunner.includes('"recordedAtUtc": utc_now()') &&
      source.trainingRunner.includes(
        '"recordedAtAsiaShanghai": asia_shanghai_now()',
      ) &&
      source.server.includes(
        "recordedAtAsiaShanghai: text(row.recordedAtAsiaShanghai)",
      ),
  ],
  [
    "capacity_rows_read_source_record_timestamps",
    source.server.includes("sourceRecords") &&
      source.server.includes("createdAtAsiaShanghai") &&
      source.page.includes("创建时间（北京时间）") &&
      source.page.includes("更新时间（北京时间）"),
  ],
  [
    "record_finder_is_closable_viewport_panel",
    source.controls.includes("关闭训练记录查询") &&
      source.styles.includes("position: fixed") &&
      source.styles.includes("z-index: 900"),
  ],
  [
    "stage_records_have_dedicated_detail_route",
    source.runDetail.includes("STAGE TRAINING RECORD") &&
      source.runDetail.includes("全部 ${stage.metrics.length} 个Epoch"),
  ],
  [
    "stage_detail_shows_epoch_metrics",
    source.runDetail.includes("训练综合损失") &&
      source.runDetail.includes("Checkpoint选择分"),
  ],
  [
    "parameter_dictionary_is_searchable",
    source.controls.includes("parameter-help-search") &&
      source.parameterCatalog.includes("fuzzyParameterMatch"),
  ],
  [
    "parameter_dictionary_has_plain_language_coverage",
    parameterDictionary.schemaVersion === "local-ai-model-data-dictionary-v1" &&
      parameterDictionary.entries.length >= 70 &&
      parameterDictionary.entries.every(
        (entry) =>
          entry.name &&
          entry.code &&
          entry.category &&
          entry.dataType &&
          entry.plainLanguage &&
          entry.interpretation &&
          entry.readingRule &&
          entry.source,
      ),
  ],
  [
    "parameter_dictionary_covers_model_lifecycle",
    [
      "模型身份",
      "数据与条件",
      "训练过程",
      "Checkpoint与产物",
      "严格复验",
      "机器审核",
      "Token与计算量",
      "硬件与运行环境",
      "Owner授权与治理",
    ].every((category) => parameterDictionary.categories.includes(category)),
  ],
  [
    "parameter_dictionary_covers_strict_validation_and_issue_codes",
    [
      "conditionLabel",
      "seed",
      "outputImagePath",
      "machineReviewPath",
      "machineReviewIssueCodes",
      "outputImageSha256",
      "validationTokenAccounting",
      "condition_terrain_path_ground_coverage_mismatch",
      "condition_terrain_path_ground_required_boundary_contact_missing",
      "condition_terrain_path_ground_uncontracted_boundary_contact",
      "complete_map_composition_diversity_failed",
      "professional_multiscale_texture_noise_overload",
      "professional_texture_hierarchy_collapsed",
    ].every((code) =>
      parameterDictionary.entries.some((entry) => entry.code === code),
    ),
  ],
  [
    "parameter_dictionary_covers_batch_live_progress",
    [
      "liveProgress.phase",
      "liveProgress.epoch",
      "liveProgress.epochTarget",
      "liveProgress.batch",
      "liveProgress.batchTarget",
      "liveProgress.optimizerStep",
      "liveProgress.optimizerStepTarget",
      "liveProgress.percentage",
      "liveProgress.elapsedSeconds",
      "liveProgress.etaSeconds",
      "liveProgress.optimizerStepsPerSecond",
      "liveProgress.batchLoss",
      "liveProgress.rollingEpochLoss",
      "liveProgress.lastBatchDurationSeconds",
      "liveProgress.samplesInBatch",
      "liveProgress.localDenoiserSampleForwardPasses",
      "liveProgress.localTrainingTokenCount",
      "liveProgress.localTrainingTokenUnit",
      "liveProgress.recordedAtUtc",
      "liveProgress.recordedAtAsiaShanghai",
    ].every((code) =>
      parameterDictionary.entries.some((entry) => entry.code === code),
    ),
  ],
  [
    "parameter_dictionary_ui_shows_reading_rule_and_source",
    source.controls.includes("trainingParameterDictionaryMetadata") &&
      source.controls.includes("item.readingRule") &&
      source.controls.includes("item.source") &&
      source.controls.includes("本地自研AI模型数据字典"),
  ],
  [
    "strict_validation_visual_workspace_is_inline",
    source.page.includes('id: "validation"') &&
      source.page.includes("ValidationWorkspace") &&
      source.page.includes("strict-validation-workspace") &&
      source.page.includes("strict-validation-batch-selector"),
  ],
  [
    "strict_validation_trajectory_detail_is_alertdialog",
    source.page.includes("strict-validation-trajectory-card-") &&
      source.page.includes("strict-validation-trajectory-dialog") &&
      source.page.includes('role="alertdialog"') &&
      source.page.includes("machineReviewIssueCodes") &&
      source.page.includes("validationTokenAccounting"),
  ],
  [
    "strict_validation_images_use_existing_read_only_api",
    source.page.includes("/api/ai-painter/training-data-image?path=") &&
      source.imageApi.includes("export async function GET") &&
      !source.imageApi.includes("export async function POST"),
  ],
  [
    "server_reads_strict_validation_batches_and_reviews",
    source.server.includes("v7-repair-r1-strict-revalidations") &&
      source.server.includes("readStrictValidationBatches") &&
      source.server.includes("trajectory.machineReviewPath") &&
      source.types.includes("StrictValidationBatch") &&
      source.types.includes("StrictValidationTrajectory"),
  ],
  [
    "latest_strict_validation_has_eight_unique_visual_trajectories",
    strictValidationReport.completedTrajectoryCount === 8 &&
      strictValidationReport.trajectories.length === 8 &&
      strictValidationReport.trajectories.every(
        (trajectory) =>
          trajectory.outputImagePath &&
          trajectory.outputImageSha256 &&
          trajectory.machineReviewPath &&
          trajectory.machineReviewIssueCodes?.length,
      ) &&
      new Set(
        strictValidationReport.trajectories.map(
          (trajectory) => trajectory.outputImageSha256,
        ),
      ).size === 8,
  ],
  [
    "monitor_uses_fixed_viewport_and_internal_scroll",
    source.styles.includes("height: 100vh") &&
      source.styles.includes("overflow: clip") &&
      source.styles.includes(".workspaceContent") &&
      source.styles.includes("overflow: auto"),
  ],
  [
    "monitor_uses_full_available_width",
    source.styles.includes(".monitorGrid") &&
      source.styles.includes(".runDetailShell") &&
      source.styles.includes("width: 100%") &&
      source.styles.includes("max-width: none"),
  ],
  [
    "dashboard_shows_capacity_rows",
    source.page.includes("64组绑定") &&
      source.page.includes("selectedByCurrentPythonDataset"),
  ],
  ["dashboard_shows_program_events", source.page.includes("PROGRAM EVENTS")],
  [
    "dashboard_shows_local_ai_token_accounting",
    source.page.includes("LOCAL AI ACCOUNTING") &&
      source.page.includes("本地潜空间Token") &&
      source.page.includes("外部API Token"),
  ],
  [
    "stage_detail_shows_per_run_token_ledger",
    source.runDetail.includes("Token Ledger") &&
      source.runDetail.includes("本地模型训练计算账本") &&
      source.runDetail.includes('initialTopic="localTrainingTokens"'),
  ],
  [
    "server_reads_immutable_token_ledgers",
    source.server.includes("training-token-ledgers") &&
      source.server.includes("normalizeTokenAccounting"),
  ],
  [
    "server_reads_capability_migration_registry",
    source.server.includes("local-ai-capability-migration-registry-v1.json") &&
      source.page.includes("能力迁移"),
  ],
  [
    "stage2_token_ledger_uses_locked_real_unit",
    stage2Ledger.trainingTokenAccounting?.terminology?.isNlpToken === false &&
      stage2Ledger.trainingTokenAccounting?.terminology?.tokenizerUsed ===
        false &&
      stage2Ledger.trainingTokenAccounting?.runTotals?.latentSpatialTokens ===
        1779892224,
  ],
  [
    "stage2_external_provider_tokens_are_zero_not_estimated",
    stage2Ledger.trainingTokenAccounting?.externalApi?.totalTokens === 0 &&
      stage2Ledger.trainingTokenAccounting?.externalApi?.measurementStatus ===
        "not_applicable_local_pytorch_training",
  ],
  [
    "legacy_gpu_seconds_proxy_is_deprecated",
    source.resourceUsage.includes("deprecated_not_authoritative") &&
      source.resourceUsage.includes("localComputeTokens: 0"),
  ],
  [
    "migration_target_is_codex_monitor_only",
    migration.externalAgentBoundary?.targetRole ===
      "read_only_monitor_and_verification_only",
  ],
  [
    "dashboard_shows_complete_local_hardware",
    [
      "本机硬件",
      "CPU负载",
      "内存占用",
      "固定磁盘",
      "物理网卡",
      "操作系统",
      "运行时长",
    ].every((term) => source.page.includes(term)),
  ],
  [
    "hardware_kpis_use_self_developed_gauges",
    source.page.includes("GaugeMetric") &&
      source.page.includes('role="meter"') &&
      source.styles.includes(".gaugeDial") &&
      !/recharts|chart\.js|echarts/i.test(source.page + source.styles),
  ],
  [
    "hardware_kpi_gauges_are_fixed_in_header_middle",
    source.page.includes('data-testid="header-hardware-dashboard"') &&
      source.page.indexOf("headerHardwareDashboard") >
        source.page.indexOf("<header className={styles.header}>") &&
      source.page.indexOf("headerHardwareDashboard") <
        source.page.indexOf("<div className={styles.headerTools}>") &&
      source.styles.includes(".headerHardwareDashboard") &&
      source.contract.includes(
        "fixed_in_header_middle_between_title_and_status_tools",
      ),
  ],
  [
    "server_collects_hardware_read_only",
    source.server.includes("Get-CimInstance Win32_Processor") &&
      source.server.includes("Get-CimInstance Win32_LogicalDisk") &&
      source.server.includes("Get-NetAdapter -Physical"),
  ],
  [
    "hardware_snapshot_is_typed",
    source.types.includes("hardware:") &&
      source.types.includes("networkAdapters:") &&
      source.types.includes("uptimeSeconds:"),
  ],
  [
    "live_actor_board_is_prominent_and_machine_testable",
    source.page.includes('data-testid="execution-actor-board"') &&
      source.page.includes('data-testid="local-ai-active-indicator"') &&
      source.page.includes('data-testid="execution-heartbeat"') &&
      source.page.includes('data-testid="execution-progress"') &&
      source.page.includes('data-testid="training-continuation-notice"') &&
      source.page.includes('data-testid="live-training-output-dialog"') &&
      source.page.includes('data-testid="live-training-output-stream"') &&
      source.page.includes('aria-haspopup="dialog"') &&
      source.page.includes("本窗口约每2秒读取本地进度证据") &&
      source.page.includes("本次运行输出历史") &&
      source.page.includes("回到最新") &&
      source.page.includes("output.scrollTop = output.scrollHeight") &&
      source.page.includes("训练持续执行中｜请勿重复启动") &&
      source.page.includes("刷新或关闭本页面不会中断训练") &&
      source.page.includes("聊天定时推送已关闭"),
  ],
  [
    "live_activity_reads_current_formal_stage4_training_output",
    source.server.includes("stage4-semantic-mixture-formal-training") &&
      source.server.includes(
        "stage4-authoritative-semantic-carrier-formal-stage0",
      ) &&
      source.server.includes(
        "stage4-post-decode-full-condition-responsibility-formal-stage0",
      ) &&
      source.server.includes('artifactDirectory: "training-output"') &&
      source.server.includes("relativeArtifactRoot"),
  ],
  [
    "dashboard_projects_latest_autonomous_stage4_terminal",
    source.server.includes(
      "stage4-post-carrier-bounded-candidate-recalculations/latest.json",
    ) &&
      source.server.includes("projectAutonomousStage4TaskCapsule") &&
      autonomousTaskCapsule.integrity.status === "verified" &&
      autonomousTaskCapsule.candidateTerminal.status === "failed_closed" &&
      autonomousTaskCapsule.candidateTerminal.previewPassCount === 0 &&
      autonomousTaskCapsule.candidateTerminal.previewCount === 6 &&
      autonomousTaskCapsule.nextAllowedAction.ownerAuthorizationRequired ===
        false,
  ],
  [
    "dashboard_projects_formal_stage0_training_review_and_terminal_states",
    source.server.includes("readLatestPostDecodeFormalExecution") &&
      source.server.includes("projectPostDecodeFormalExecutionActivity") &&
      source.server.includes('code: "formal_stage0_running"') &&
      source.server.includes('code: "formal_stage0_reviewing"') &&
      source.server.includes('code: "formal_stage0_real_visual_failure"') &&
      source.server.includes("review-progress.json") &&
      source.server.includes("automatic_machine_review") &&
      source.formalStageRunner.includes("completedPreviewCount") &&
      source.formalStageRunner.includes("writeReviewProgress") &&
      source.formalStageRunner.includes('status: "automatic_machine_review"') ===
        false,
  ],
  [
    "formal_stage0_terminal_projection_supports_all_registered_profiles",
    source.server.includes("isFormalStage0TerminalStatus") &&
      source.server.includes('"post_decode_full_condition_responsibility"') &&
      source.server.includes('"post_decode_object_rgb"') &&
      source.server.includes('"authoritative_semantic_carrier"') &&
      source.server.includes(
        'source: "current_execution_registry_latest_training_terminal"',
      ),
  ],
  [
    "formal_stage0_does_not_project_manual_waiting_validation",
    !source.server.includes('code: "awaiting_validation"') &&
      !source.server.includes("训练完成，等待验证") &&
      !source.server.includes("独立的训练后验证授权") &&
      !source.types.includes('"awaiting_validation"') &&
      source.server.includes(
        "stage.runId === latestTrainingRunId",
      ),
  ],
  [
    "formal_stage0_runner_atomically_registers_terminal_and_profile_identity",
    source.formalStageRunner.includes("synchronizeCurrentExecutionRegistry") &&
      source.formalStageRunner.includes("advanceCurrentExecutionRegistry") &&
      source.formalStageRunner.includes(
        "post_decode_full_condition_responsibility_multisample_semantic_capacity_insufficient_confirmed",
      ) &&
      source.formalStageRunner.includes("PROFILE.reviewWorkRoot") &&
      source.formalStageRunner.includes("PROFILE.bestReviewWorkRoot"),
  ],
  [
    "validation_workspace_follows_current_activity_run_identity",
    source.page.includes("const activityStage = useMemo(") &&
      source.page.includes("stage.runId === snapshot.activity.taskId") &&
      source.page.includes(
        "const currentStage = activityStage ?? activeStage ?? latestStage",
      ),
  ],
  [
    "validation_workspace_counts_only_the_selected_run",
    selectedRunValidationSummary.source === "selected_training_run" &&
      selectedRunValidationSummary.expectedPreviewCount === 6 &&
      selectedRunValidationSummary.completedPreviewCount === 6 &&
      selectedRunValidationSummary.passedPreviewCount === 0 &&
      selectedRunValidationSummary.failedPreviewCount === 6 &&
      selectedRunValidationSummary.selectedRunMatchesCapsule === false &&
      source.page.includes("deriveSelectedRunValidationSummary") &&
      source.page.includes("event.runId === reviewRunId"),
  ],
  [
    "execution_notice_distinguishes_training_reviewing_and_review_terminal",
    source.page.includes("机器验证持续执行中｜无需人工操作") &&
      source.page.includes("机器验证已完成｜候选失败关闭") &&
      source.page.includes("机器验证已完成｜候选通过") &&
      source.page.includes('data-reviewing={isReviewing}') &&
      source.page.includes("const validationTerminal ="),
  ],
  [
    "dashboard_excludes_archived_smoke_from_current_and_default_records",
    !between(source.server, "const modelSources = [", "] as const;").includes(
      "stage4-post-decode-object-rgb-controlled-smokes",
    ) &&
      source.server.includes('code: "candidate_planned"') &&
      source.server.includes('code: "current_registry_unknown_or_stale"') &&
      source.server.includes("readCurrentExecutionRegistry(root)") &&
      postDecodeQualifiedCapsule.integrity.status === "verified" &&
      postDecodeQualifiedCapsule.candidateTerminal.status === "qualified" &&
      postDecodeQualifiedCapsule.candidateTerminal.previewMachineStatus ===
        "late_stability_qualified" &&
      postDecodeQualifiedCapsule.candidateTerminal.previewPassCount === 2 &&
      postDecodeQualifiedCapsule.candidateTerminal.previewFailCount === 3 &&
      postDecodeQualifiedCapsule.nextAllowedAction.ownerAuthorizationRequired ===
        false &&
      postDecodeQualifiedCapsule.nextAllowedAction.automaticExecutionAllowed ===
        true,
  ],
  [
    "dashboard_rejects_tampered_post_decode_smoke_evidence",
    postDecodeTamperedCapsule.integrity.status ===
      "incomplete_or_mismatched" &&
      postDecodeTamperedCapsule.candidateTerminal.status ===
        "unknown_or_stale",
  ],
  [
    "dashboard_does_not_present_owner_as_normal_next_action",
    source.page.includes("业务终态 / LOCAL AI ACTION") &&
      !source.page.includes("业务终态 / OWNER ACTION"),
  ],
  [
    "terminal_status_opens_live_and_historical_validation_workspace",
    source.page.includes('data-testid="validation-status-entry"') &&
      source.page.includes("openValidationWorkspace") &&
      source.page.includes('data-testid="validation-live-monitor"') &&
      source.page.includes("机器验证过程与终态") &&
      source.page.includes("验证完成后证据不会消失"),
  ],
  [
    "current_candidate_machine_review_is_projected_into_preview_history",
    source.server.includes("/machine-review.json") &&
      source.server.includes("review?.normalizedPath") &&
      source.server.includes("review?.normalizedSha256"),
  ],
  [
    "dashboard_quarantines_historical_running_without_live_process",
    source.server.includes("stale_historical_record_no_active_process") &&
      source.server.includes("当前不存在对应训练进程") &&
      source.server.includes("executionTerminal?.recordedAtUtc"),
  ],
  [
    "live_activity_uses_heartbeat_pid_and_process_table",
    source.server.includes("selectLiveActivityState") &&
      source.server.includes("readRelevantLocalProcesses") &&
      source.server.includes("process.kill(pid, 0)") &&
      source.server.includes("Get-CimInstance Win32_Process"),
  ],
  [
    "live_activity_never_fakes_codex_tokens",
    source.types.includes('"unavailable_to_local_program"') &&
      source.page.includes("本地程序不可读取") &&
      source.server.includes("当前不得估算或伪造"),
  ],
  [
    "live_activity_refreshes_faster_only_while_active",
    source.page.includes("activeRefreshDelayMs = 2_000") &&
      source.page.includes("idleRefreshDelayMs = 5_000"),
  ],
  [
    "live_projection_has_idle_running_failed_and_stalled_states",
    ["idle", "running", "failed", "stalled"].every((state) =>
      source.liveProjection.includes(`\"${state}\"`),
    ),
  ],
  [
    "hardware_inventory_excludes_sensitive_ids",
    !/macAddress|serialNumber|biosSerial/i.test(
      source.types + source.server + source.page,
    ),
  ],
  ["registered_v7_capacity_is_64", v7Rows.length === 64],
  ["current_python_filter_loads_exactly_64", loadedRows.length === 64],
  [
    "current_python_filter_loads_all_64_v7_rows",
    loadedRows.filter((row) => row.v7CapacityContributionRegistered === true)
      .length === 64,
  ],
  [
    "current_python_filter_split_is_48_8_4_4",
    JSON.stringify(
      Object.fromEntries(
        ["train", "validation", "challenge", "regression"].map((split) => [
          split,
          loadedRows.filter((row) => row.split === split).length,
        ]),
      ),
    ) ===
      JSON.stringify({ train: 48, validation: 8, challenge: 4, regression: 4 }),
  ],
  [
    "server_preserves_post_training_validation_failed_state",
    source.server.includes('"validation_failed"') &&
      source.server.includes('"post_training_validation_failed_nonformal"'),
  ],
  [
    "server_projects_status_by_task_time_and_terminal_priority",
    source.server.includes("selectAuthoritativeTrainingEvidence") &&
      newerTerminalProjection.code === "resource_blocked" &&
      mismatchedTaskProjection.code === "awaiting_validation" &&
      sameTimeTerminalProjection.code === "validation_failed",
  ],
  [
    "server_rejects_missing_or_partial_task_identity",
    missingIdentityProjection.code === "awaiting_validation" &&
      partialIdentityProjection.code === "awaiting_validation",
  ],
  [
    "latest_full_training_completion_is_machine_readable",
    fullTrainingFinalization.status ===
      "full_stage0_stage1_stage2_training_completed_pending_strict_revalidation" &&
      fullTrainingFinalization.completedStageCount === 3 &&
      latestRepairStage2?.checkpointSha256 ===
        "572c59f75d55419f7e59bc57546891abfd47665eaa29598ee7acc64516e5164b",
  ],
  [
    "server_reads_latest_r1_training_records",
    source.server.includes(
      "project-owned-complete-world-conditional-denoiser-v7-repair-r1",
    ) && source.server.includes("ai-assisted-v7-repair-r1-stage-"),
  ],
  [
    "server_reads_latest_r2_smoke_record_and_preview_review",
    source.server.includes(
      "project-owned-complete-world-conditional-denoiser-v7-repair-r2",
    ) &&
      source.server.includes("fixed-preview-hard-gate-review.json") &&
      source.server.includes("readStagePreviews"),
  ],
  [
    "server_recovers_from_stale_owner_request_pointer",
    source.server.includes(
      "owner-action-requests/${directory.name}/request.json",
    ) && source.server.includes("recordedAtUtc"),
  ],
  [
    "server_reads_program_generated_current_pointers",
    source.server.includes("owner-action-requests/latest.json") &&
      source.server.includes(
        "v7-post-training-validation-reconciliations/latest.json",
      ) &&
      source.server.includes(
        "v7-bounded-repair-r1-full-training-finalizations/latest.json",
      ),
  ],
  [
    "validation_program_automatically_records_owner_request",
    source.validationRunner.includes("recordAiPainterOwnerActionRequest") &&
      source.ownerRequestStore.includes("record.generatedBy") &&
      source.ownerRequestStore.includes("normalizeOwnerActionRequest"),
  ],
  [
    "validation_program_prevents_concurrent_and_reused_authorization",
    source.validationRunner.includes("acquireValidationLock") &&
      source.validationRunner.includes(
        "v7_post_training_validation_authorization_already_consumed",
      ),
  ],
  [
    "validation_trajectory_root_is_initialized_after_read_only_preflight",
    source.singleValidationRunner.includes(
      "fs.mkdirSync(OUTPUT_ROOT, { recursive: true })",
    ) &&
      source.singleValidationRunner.indexOf(
        "fs.mkdirSync(OUTPUT_ROOT, { recursive: true })",
      ) > source.singleValidationRunner.indexOf("if (args.preflightOnly)") &&
      source.singleValidationRunner.indexOf(
        "fs.mkdirSync(OUTPUT_ROOT, { recursive: true })",
      ) <
        source.singleValidationRunner.indexOf(
          "fs.mkdirSync(runDir, { recursive: false })",
        ),
  ],
  [
    "validation_program_writes_per_trajectory_token_accounting",
    source.validationRunner.includes("validationTokenAccounting") &&
      reconciliation.validationTokenAccounting
        ?.authoritativeUniqueValidationWork?.latentSpatialTokens === 19660800,
  ],
  [
    "latest_owner_request_is_local_program_generated",
    ownerRequest.generatedBy === "local_ai_pet_world_program" &&
      ownerRequest.systemOfRecord === "local_immutable_files_plus_sqlite_index",
  ],
];
const failed = checks.filter(([, passed]) => !passed).map(([id]) => id);
if (failed.length)
  throw new Error(
    `current training dashboard check failed: ${failed.join(", ")}`,
  );
console.log(
  JSON.stringify(
    {
      ok: true,
      status: "ai_painter_current_training_dashboard_check_passed",
      checks: checks.map(([id, passed]) => ({ id, passed })),
      registeredV7CapacityCount: v7Rows.length,
      actualLoadedConditionalSampleCount: loadedRows.length,
      actualLoadedV7CapacityCount: loadedRows.filter(
        (row) => row.v7CapacityContributionRegistered === true,
      ).length,
      readOnly: true,
      selfDevelopedUi: true,
    },
    null,
    2,
  ),
);

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = value.indexOf(end, startIndex + start.length);
  if (endIndex < 0) return "";
  return value.slice(startIndex, endIndex);
}
