import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";

const ROOT = process.cwd();
const LIBRARY_INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json";
const FRAMEWORK_AUDIT_LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/legacy-v7-capacity-rgb-failed-group-archives";
const REVIEW_SCRIPT = path.join(
  ROOT,
  "scripts",
  "record-ai-assisted-cold-start-owner-review.mjs",
);
const NEW_REFERENCE_RECORD_ID =
  "ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v3";
const OWNER_COMMAND_REF =
  "owner-command-archive-legacy-v7-capacity-rgb-to-failed-group-20260731";
const REASON_CODE = "owner_rejected_duplicate_macro_structure";
const REASON_ZH = "旧数据共用重复的完整地图宏观构图与通用构建语法";
const NEXT_TRAINING_TARGET =
  "rebuild_each_slot_from_its_own_thailand_measurement_package_with_explicit_unique_complete_composition_architecture";
const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const archiveId =
  `legacy-v7-capacity-rgb-failed-group-archive-` +
  createdAtUtc.replace(/[:.]/g, "-");

const frameworkAuditLatest = readJson(FRAMEWORK_AUDIT_LATEST_PATH);
const frameworkAudit = readJson(frameworkAuditLatest.runPath);
assert(
  frameworkAudit.summary?.rebuildRequiredPackageCount === 63 &&
    frameworkAudit.summary?.new198ReferencePassed === true,
  "the current 63-package complete-framework audit is not the required archive basis",
);

const initialIndex = readJson(LIBRARY_INDEX_PATH);
const targets = (initialIndex.records ?? [])
  .filter(isLegacyCurrent64RgbRecord)
  .sort((left, right) =>
    slotNumber(left.recordId) - slotNumber(right.recordId) ||
    left.recordId.localeCompare(right.recordId),
  );
assert(targets.length === 54, `expected 54 legacy RGB records, found ${targets.length}`);
assert(
  !targets.some((entry) => entry.recordId === NEW_REFERENCE_RECORD_ID),
  "new slot-198 V3 was included in the legacy archive target set",
);
const newReferenceBefore = (initialIndex.records ?? []).find(
  (entry) => entry.recordId === NEW_REFERENCE_RECORD_ID,
);
assert(newReferenceBefore, "new slot-198 V3 record is missing");
const recordsRequiringFormalOwnerRejection = new Set(
  targets
    .filter((entry) => entry.status !== "rejected")
    .map((entry) => entry.recordId),
);

const plan = {
  schemaVersion: "legacy-v7-capacity-rgb-failed-group-archive-plan-v1",
  archiveId,
  status: "archive_plan_frozen_before_mutation",
  createdAtUtc,
  createdAtAsiaShanghai,
  ownerCommandRef: OWNER_COMMAND_REF,
  ownerInstruction:
    "previously generated legacy content is no longer needed as positive data; preserve it without deletion and classify it under failed records; the rebuilt 64-package cohort is the success lane",
  scope: {
    legacySlotRange: "v7-capacity-slot-146..v7-capacity-slot-197",
    legacySlot198Versions: ["v1", "v2"],
    targetRecordCount: targets.length,
    excludedNewRecordId: NEW_REFERENCE_RECORD_ID,
    deleteFiles: false,
    moveDirectories: false,
    preserveImages: true,
    preserveMachineReviews: true,
    preserveOwnerReviewHistory: true,
    withdrawPositiveTrainingEligibility: true,
    withdrawRegisteredCapacityContributions: true,
    gpuTrainingStarted: false,
  },
  auditBasis: {
    runId: frameworkAudit.runId,
    path: frameworkAuditLatest.runPath,
    rebuildRequiredPackageCount:
      frameworkAudit.summary.rebuildRequiredPackageCount,
    sharedGenericConstructionGrammarPairCount:
      frameworkAudit.summary.sharedGenericConstructionGrammarPairCount,
  },
  targets: targets.map((entry) => ({
    recordId: entry.recordId,
    slotId: `v7-capacity-slot-${String(slotNumber(entry.recordId)).padStart(3, "0")}`,
    statusBefore: entry.status,
    ownerReviewStatusBefore: entry.reviews?.ownerReviewStatus ?? null,
    capacityContributionStatusBefore:
      entry.v7CapacityContribution?.status ?? null,
    alreadyInFailedGroup: entry.status === "rejected",
  })),
  automaticStorage: true,
};
const storedPlan = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: `${archiveId}-plan`,
  fileName: "archive-plan.json",
  record: plan,
  latest: {
    archiveId,
    phase: "plan",
    targetRecordCount: targets.length,
    excludedNewRecordId: NEW_REFERENCE_RECORD_ID,
    imageFilesDeleted: 0,
    gpuTrainingStarted: false,
  },
});

let newlyRejectedCount = 0;
let alreadyRejectedCount = 0;
for (let index = 0; index < targets.length; index += 1) {
  const target = targets[index];
  if (target.status === "rejected") {
    alreadyRejectedCount += 1;
    console.log(
      `[${index + 1}/${targets.length}] already failed: ${target.recordId}`,
    );
    continue;
  }
  assert(
    target.reviews?.machineReviewStatus ===
      "machine_contract_passed_waiting_owner_visual_review",
    `legacy record cannot use the formal owner-rejection path: ${target.recordId}`,
  );
  execFileSync(
    process.execPath,
    [
      REVIEW_SCRIPT,
      "--record-id",
      target.recordId,
      "--category-id",
      "complete-maps",
      "--decision",
      "rejected",
      "--owner-command-ref",
      `${OWNER_COMMAND_REF}:${target.recordId}`,
      "--comment",
      "旧版本数据包使用重复或近似的宏观构图与通用构建语法；保留为失败学习证据，不再作为新64组正样本。",
      "--reason-codes",
      REASON_CODE,
      "--reason-codes-zh",
      REASON_ZH,
      "--affected-regions",
      "full_map_composition",
      "--next-training-target",
      NEXT_TRAINING_TARGET,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
  newlyRejectedCount += 1;
  console.log(
    `[${index + 1}/${targets.length}] archived to failed group: ${target.recordId}`,
  );
}

const finalIndex = readJson(LIBRARY_INDEX_PATH);
const finalTargets = (finalIndex.records ?? []).filter(
  isLegacyCurrent64RgbRecord,
);
assert(finalTargets.length === targets.length, "legacy archive target count changed");
const failedArchiveIssues = [];
for (const target of finalTargets) {
  if (target.status !== "rejected") {
    failedArchiveIssues.push(`${target.recordId}:status_not_rejected`);
  }
  if (
    recordsRequiringFormalOwnerRejection.has(target.recordId) &&
    target.trainingEligibility !== "owner_rejected"
  ) {
    failedArchiveIssues.push(
      `${target.recordId}:positive_training_eligibility_not_withdrawn`,
    );
  }
  if (target.aiAssistedColdStartEligible === true) {
    failedArchiveIssues.push(
      `${target.recordId}:ai_assisted_positive_flag_not_withdrawn`,
    );
  }
  if (target.v7CapacityContribution?.status === "registered") {
    failedArchiveIssues.push(
      `${target.recordId}:capacity_contribution_still_registered`,
    );
  }
  const recordPath = resolveProjectPath(target.recordPath);
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const imagePath = path.resolve(
    path.dirname(recordPath),
    record.originalImage?.path ?? "",
  );
  if (!record.originalImage?.path || !fs.existsSync(imagePath)) {
    failedArchiveIssues.push(`${target.recordId}:preserved_image_missing`);
  }
}
assert(
  failedArchiveIssues.length === 0,
  `legacy failed-group archive verification failed: ${failedArchiveIssues.join(", ")}`,
);

const newReferenceAfter = (finalIndex.records ?? []).find(
  (entry) => entry.recordId === NEW_REFERENCE_RECORD_ID,
);
assert(newReferenceAfter, "new slot-198 V3 disappeared during legacy archive");
assert(
  newReferenceAfter.status === newReferenceBefore.status &&
    newReferenceAfter.reviews?.ownerReviewStatus ===
      newReferenceBefore.reviews?.ownerReviewStatus &&
    newReferenceAfter.trainingEligibility ===
      newReferenceBefore.trainingEligibility,
  "new slot-198 V3 state changed during legacy archive",
);

const completedAtUtc = new Date().toISOString();
const completion = {
  schemaVersion: "legacy-v7-capacity-rgb-failed-group-archive-result-v1",
  archiveId,
  status: "legacy_rgb_preserved_and_classified_as_failed",
  createdAtUtc,
  completedAtUtc,
  completedAtAsiaShanghai: formatShanghai(completedAtUtc),
  ownerCommandRef: OWNER_COMMAND_REF,
  planPath: storedPlan.runPath,
  summary: {
    targetRecordCount: finalTargets.length,
    newlyRejectedCount,
    alreadyRejectedCount,
    finalFailedRecordCount: finalTargets.filter(
      (entry) => entry.status === "rejected",
    ).length,
    preservedImageCount: finalTargets.length,
    deletedImageCount: 0,
    movedDirectoryCount: 0,
    registeredCapacityContributionCount: finalTargets.filter(
      (entry) => entry.v7CapacityContribution?.status === "registered",
    ).length,
    newReferenceRecordId: NEW_REFERENCE_RECORD_ID,
    newReferenceStatusUnchanged: true,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
  records: finalTargets.map((entry) => ({
    recordId: entry.recordId,
    status: entry.status,
    ownerReviewStatus: entry.reviews?.ownerReviewStatus ?? null,
    trainingEligibility: entry.trainingEligibility,
    aiAssistedColdStartEligible: entry.aiAssistedColdStartEligible,
    capacityContributionStatus:
      entry.v7CapacityContribution?.status ?? null,
    recordPath: entry.recordPath,
  })),
  automaticStorage: true,
};
const storedCompletion = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: `${archiveId}-completed`,
  fileName: "archive-result.json",
  record: completion,
  latest: {
    archiveId,
    phase: "completed",
    targetRecordCount: finalTargets.length,
    finalFailedRecordCount: completion.summary.finalFailedRecordCount,
    preservedImageCount: completion.summary.preservedImageCount,
    deletedImageCount: 0,
    excludedNewRecordId: NEW_REFERENCE_RECORD_ID,
    newReferenceStatusUnchanged: true,
    gpuTrainingStarted: false,
  },
});

appendAiPainterProgramEvent({
  timestamp: completedAtUtc,
  action: "archive_legacy_v7_capacity_rgb_to_failed_group",
  runId: archiveId,
  kind: "owner_authorized_training_data_reclassification",
  status: "success",
  title:
    "Legacy V7 capacity RGB records were preserved and classified under failed records",
  titleZh: "旧版V7容量RGB原图已保留并归入失败记录组",
  detail:
    `targets=${finalTargets.length}; newlyRejected=${newlyRejectedCount}; alreadyRejected=${alreadyRejectedCount}; deleted=0; newReference=${NEW_REFERENCE_RECORD_ID}:unchanged`,
  detailZh:
    `目标=${finalTargets.length}；本次新增失败=${newlyRejectedCount}；原已失败=${alreadyRejectedCount}；删除=0；新参考记录${NEW_REFERENCE_RECORD_ID}保持不变`,
  script: "scripts/archive-legacy-v7-capacity-rgb-to-failed-group.mjs",
  currentStep: "legacy_v7_capacity_rgb_failed_group_archive_complete",
  evidencePath: storedCompletion.runPath,
  evidence: [storedPlan.runPath, storedCompletion.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      status: completion.status,
      archiveId,
      planPath: storedPlan.runPath,
      resultPath: storedCompletion.runPath,
      summary: completion.summary,
    },
    null,
    2,
  ),
);

function isLegacyCurrent64RgbRecord(record) {
  const slot = slotNumber(record.recordId);
  if (slot >= 146 && slot <= 197) return true;
  return slot === 198 && record.recordId !== NEW_REFERENCE_RECORD_ID;
}

function slotNumber(recordId) {
  const match = /^ai-cold-start-v7-v7-capacity-slot-(\d{3})-/.exec(
    recordId ?? "",
  );
  return match ? Number(match[1]) : -1;
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"));
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value);
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${value}`,
  );
  assert(fs.existsSync(resolved), `file is missing: ${value}`);
  return resolved;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
