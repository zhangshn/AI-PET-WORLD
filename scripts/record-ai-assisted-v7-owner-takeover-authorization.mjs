import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";

const ROOT = process.cwd();
const CONFIG_PATH =
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json";
const CAPACITY_POINTER_PATH =
  ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/ai-assisted-v7-owner-takeover-authorizations";
const AUTHORIZATION_ID =
  "owner-authorized-v7-local-training-after-mvp64-audit-20260728";
const WINDOW_SCOPE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-expanded-real-measurement-window-scope-20260728";
const OWNER_COMMAND_REF =
  "project-owner-current-task-command-20260728-accept-ai-painter-and-ai-painter-2-expand-measurement-scope-and-start-local-training";

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = `ai-assisted-v7-owner-takeover-authorization-${createdAtUtc.replace(
  /[:.]/g,
  "-",
)}`;
const runRoot = path.join(ROOT, OUTPUT_ROOT, runId);
const authorizationPath = path.join(runRoot, "authorization.json");

const config = readJson(CONFIG_PATH);
const capacityPointer = readJson(CAPACITY_POINTER_PATH);
const capacityPlan = readJson(capacityPointer.capacityPlanPath);
const gapList = readJson(capacityPointer.gapListPath);
const approvedTotal =
  config.training?.dataCapacityDecision?.totalCompleteMaps ?? null;
const approvedSplits =
  config.training?.dataCapacityDecision?.splitCounts ?? null;
const qualifiedCount =
  capacityPlan.auditSummary?.qualifiedExistingRecordCount ?? null;
const requiredNewCount = capacityPlan.gapSummary?.requiredNewRecordCount ?? null;

assert(
  approvedTotal === 64 &&
    sameJson(approvedSplits, {
      train: 48,
      validation: 8,
      challenge: 4,
      regression: 4,
    }),
  "the current owner-approved MVP training threshold is not 64 with split 48/8/4/4",
);
assert(
  qualifiedCount === capacityPointer.qualifiedExistingRecordCount &&
    requiredNewCount === capacityPointer.requiredNewRecordCount &&
    qualifiedCount + requiredNewCount === approvedTotal,
  "the current capacity plan does not close exactly to the approved 64-map threshold",
);
assert(
  gapList.plannedSlots?.[0]?.slotId === "v7-capacity-slot-123",
  "slot-123 is not the current first unresolved capacity identity",
);

appendAiPainterProgramEvent({
  action: "record_ai_assisted_v7_owner_takeover_authorization",
  runId,
  kind: "owner_authorization_recording_started",
  status: "running",
  title: "V7 owner takeover authorization recording started",
  titleZh: "V7 项目所有者接管授权记录已开始",
  detail:
    `qualified=${qualifiedCount}; required=${requiredNewCount}; approvedTotal=${approvedTotal}; ` +
    "GPU remains blocked until the immutable 64-map package and all audits pass",
  detailZh:
    `当前合格=${qualifiedCount}；仍缺=${requiredNewCount}；批准总量=${approvedTotal}；` +
    "在64张不可变数据包及全部审核通过前，GPU继续阻断",
  script: "scripts/record-ai-assisted-v7-owner-takeover-authorization.mjs",
  currentStep: "record_owner_authorization_without_starting_gpu",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  evidencePath: projectPath(capacityPointer.capacityPlanPath),
});

const trainingActivationGates = [
  "qualified_complete_map_count_equals_64",
  "split_counts_equal_48_train_8_validation_4_challenge_4_regression",
  "every_record_has_independent_world_facts_world_director_and_23_channels",
  "every_record_has_machine_review_pass",
  "every_record_has_project_owner_review_pass",
  "immutable_dataset_package_hash_and_source_lineage_audit_pass",
  "identity_hash_novelty_and_split_isolation_audit_pass",
];
const authorization = {
  schemaVersion: "ai-assisted-v7-owner-takeover-authorization-v1",
  authorizationId: AUTHORIZATION_ID,
  windowScopeAuthorizationId: WINDOW_SCOPE_AUTHORIZATION_ID,
  ownerCommandRef: OWNER_COMMAND_REF,
  reviewerRole: "project_owner",
  status: "owner_authorized_deferred_until_mvp64_dataset_and_audits_pass",
  createdAtUtc,
  createdAtAsiaShanghai,
  scope: {
    acceptAiPainterWork: true,
    acceptAiPainter2Work: true,
    expandRealMeasurementWindowScopeForSlot123: true,
    localProjectOwnedV7TrainingAuthorizedAfterGates: true,
    mvpTrainingCapacityDecisionChanged: false,
    approvedCompleteMapCount: approvedTotal,
    approvedSplitCounts: approvedSplits,
  },
  currentCapacity: {
    qualifiedCompleteMaps: qualifiedCount,
    requiredNewCompleteMaps: requiredNewCount,
    nextSlotId: gapList.plannedSlots[0].slotId,
    capacityPlanRunId: capacityPointer.runId,
    capacityPlanPath: capacityPointer.capacityPlanPath,
    capacityPlanSha256: capacityPointer.capacityPlanSha256,
    gapListPath: capacityPointer.gapListPath,
    gapListSha256: capacityPointer.gapListSha256,
  },
  activationGates: trainingActivationGates,
  currentExecutionBoundary: {
    gpuTrainingAuthorizedNow: false,
    gpuTrainingStarted: false,
    rgbBatchAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    reason: "mvp64_dataset_and_audits_not_yet_complete",
  },
  automaticStorage: true,
};

writeJsonAtomic(authorizationPath, authorization);
indexFile(authorizationPath);
const authorizationSha256 = sha256File(authorizationPath);

const nextConfig = {
  ...config,
  status:
    "repair_implemented_cpu_verified_mvp64_owner_training_authorized_pending_dataset_and_audits",
  training: {
    ...config.training,
    trainingAuthorizationStatus:
      "owner_authorized_pending_mvp64_dataset_and_audits",
    ownerTrainingAuthorization: {
      authorizationId: AUTHORIZATION_ID,
      authorizationPath: projectPath(authorizationPath),
      authorizationSha256,
      status:
        "owner_authorized_deferred_until_mvp64_dataset_and_audits_pass",
      activationGates: trainingActivationGates,
      gpuTrainingAuthorizedNow: false,
    },
  },
};
writeJsonAtomic(path.join(ROOT, CONFIG_PATH), nextConfig);
indexFile(path.join(ROOT, CONFIG_PATH));

const latestPath = path.join(ROOT, OUTPUT_ROOT, "latest.json");
writeJsonAtomic(latestPath, {
  ...authorization,
  authorizationPath: projectPath(authorizationPath),
  authorizationSha256,
  configPath: CONFIG_PATH,
  configSha256: sha256File(path.join(ROOT, CONFIG_PATH)),
});
indexFile(latestPath);

appendAiPainterProgramEvent({
  action: "record_ai_assisted_v7_owner_takeover_authorization",
  runId,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "V7 owner takeover and deferred local-training authorization recorded",
  titleZh: "V7 项目所有者接管及延后生效的本地训练授权已记录",
  detail:
    `authorizationId=${AUTHORIZATION_ID}; windowScopeAuthorizationId=${WINDOW_SCOPE_AUTHORIZATION_ID}; ` +
    `qualified=${qualifiedCount}; required=${requiredNewCount}; gpuTrainingStarted=false`,
  detailZh:
    `授权ID=${AUTHORIZATION_ID}；测量窗口扩展授权ID=${WINDOW_SCOPE_AUTHORIZATION_ID}；` +
    `当前合格=${qualifiedCount}；仍缺=${requiredNewCount}；GPU训练未启动`,
  script: "scripts/record-ai-assisted-v7-owner-takeover-authorization.mjs",
  currentStep: "owner_authorized_pending_mvp64_dataset_and_audits",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: projectPath(authorizationPath),
  nextAction:
    "expand_slot_123_real_measurement_window_scope_and_build_new_no_rgb_condition",
  nextActionZh:
    "扩展slot-123真实测量窗口范围并构建新的无RGB完整地图条件",
});

console.log(
  JSON.stringify(
    {
      status: authorization.status,
      runId,
      authorizationId: AUTHORIZATION_ID,
      windowScopeAuthorizationId: WINDOW_SCOPE_AUTHORIZATION_ID,
      authorizationPath: projectPath(authorizationPath),
      authorizationSha256,
      qualifiedCompleteMaps: qualifiedCount,
      requiredNewCompleteMaps: requiredNewCount,
      gpuTrainingAuthorizedNow: false,
      gpuTrainingStarted: false,
      nextSlotId: gapList.plannedSlots[0].slotId,
    },
    null,
    2,
  ),
);

function readJson(value) {
  const absolute = path.resolve(ROOT, value);
  assert(
    absolute === ROOT || absolute.startsWith(`${ROOT}${path.sep}`),
    `path escapes project root: ${value}`,
  );
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function indexFile(filePath) {
  const stats = fs.statSync(filePath);
  indexArtifact({
    logicalPath: projectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(filePath),
  });
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, filePath)))
    .digest("hex");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
