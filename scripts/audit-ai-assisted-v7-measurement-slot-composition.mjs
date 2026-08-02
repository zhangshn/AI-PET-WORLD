import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { auditAiAssistedCompositionNovelty } from "./lib/ai-assisted-composition-novelty.mjs";
import { auditPreRgbConditionGuideNovelty } from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs";

const ROOT = process.cwd();
const INDEX_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "original-image-library",
  "natural-home-v1",
  "index.json",
);
const AUDIT_ROOT =
  ".runtime/ai-painter/ai-assisted-v7-measurement-slot-composition-audits";
const SLOT_PATTERN =
  /v7-capacity-slot-(10[8-9]|1[01][0-9]|12[0-2])(?:-|$)/;
const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = `ai-assisted-v7-measurement-slot-composition-audit-${createdAtUtc.replace(
  /[:.]/g,
  "-",
)}`;

const index = readJson(INDEX_PATH);
const records = (index.records ?? []).filter(
  (record) =>
    record.categoryId === "complete-maps" &&
    SLOT_PATTERN.test(record.recordId) &&
    isOwnerApproved(record),
);
assert(
  records.length === 15,
  `expected 15 owner-approved records for slots 108-122, found ${records.length}`,
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_measurement_slot_composition_reaudit_started",
  runId,
  kind: "composition_reaudit",
  status: "running",
  title:
    "V7 measurement slots 108-122 retrospective composition audit started",
  titleZh: "V7测量槽位108至122历史构图复核已启动",
  detail:
    "The audit is read-only for original records and compares RGB plus condition guides against approved and owner-rejected duplicate references.",
  detailZh:
    "本次复核不修改原图记录，同时比较RGB和条件引导图，并纳入已通过记录及因构图重复被项目所有者拒绝的记录。",
  script:
    "scripts/audit-ai-assisted-v7-measurement-slot-composition.mjs",
  currentStep: "retrospective_composition_audit",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const results = [];
for (const record of records) {
  const imagePath = resolveRecordImagePath(record);
  const guidePath = resolveProjectPath(
    record.conditionBinding?.guidePath,
  );
  assert(
    fs.existsSync(imagePath),
    `approved record image is missing: ${record.recordId}`,
  );
  assert(
    fs.existsSync(guidePath),
    `approved record condition guide is missing: ${record.recordId}`,
  );
  const rgbAudit = await auditAiAssistedCompositionNovelty({
    record,
    imagePath,
  });
  const conditionGuideAudit =
    await auditPreRgbConditionGuideNovelty({
      sourceRecordId: slotIdFor(record.recordId),
      guidePath,
      candidateRecordId: record.recordId,
    });
  results.push({
    slotId: slotIdFor(record.recordId),
    recordId: record.recordId,
    originalOwnerReviewStatus:
      record.reviews?.ownerReviewStatus ?? null,
    originalCapacityContributionRunId:
      record.v7CapacityContribution?.runId ??
      record.capacityContribution?.runId ??
      null,
    rgbAudit,
    conditionGuideAudit,
    requiresOwnerReview:
      !rgbAudit.passed || !conditionGuideAudit.passed,
  });
}

const recordsRequiringReview = results.filter(
  (entry) => entry.requiresOwnerReview,
);
const report = {
  schemaVersion:
    "ai-assisted-v7-measurement-slot-composition-retrospective-audit-v1",
  runId,
  status:
    recordsRequiringReview.length === 0
      ? "retrospective_composition_audit_passed"
      : "retrospective_composition_audit_completed_with_findings",
  createdAtUtc,
  createdAtAsiaShanghai,
  scope: {
    firstSlotId: "v7-capacity-slot-108",
    lastSlotId: "v7-capacity-slot-122",
    ownerApprovedRecordCount: records.length,
    sourceIndexPath: projectPath(INDEX_PATH),
    sourceIndexSha256: sha256File(INDEX_PATH),
  },
  method: {
    rgbAudit:
      "existing_sha256_dhash_low_frequency_water_route_and_owner_rejected_composition_audit",
    conditionGuideAudit:
      "existing_water_route_macro_composition_gate_plus_exact_composite_guide_hash",
    thresholdsChanged: false,
    originalRecordsModified: false,
    ownerReviewsModified: false,
    capacityContributionsModified: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
  algorithmEvidence: {
    rgbAuditPath:
      "scripts/lib/ai-assisted-composition-novelty.mjs",
    rgbAuditSha256: sha256File(
      path.join(
        ROOT,
        "scripts",
        "lib",
        "ai-assisted-composition-novelty.mjs",
      ),
    ),
    conditionGuideAuditPath:
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    conditionGuideAuditSha256: sha256File(
      path.join(
        ROOT,
        "scripts",
        "lib",
        "ai-assisted-pre-rgb-condition-guide-novelty.mjs",
      ),
    ),
  },
  summary: {
    auditedRecordCount: results.length,
    rgbAuditFailureCount: results.filter(
      (entry) => !entry.rgbAudit.passed,
    ).length,
    conditionGuideAuditFailureCount: results.filter(
      (entry) => !entry.conditionGuideAudit.passed,
    ).length,
    recordsRequiringReviewCount: recordsRequiringReview.length,
    recordsRequiringReview: recordsRequiringReview.map((entry) => ({
      slotId: entry.slotId,
      recordId: entry.recordId,
      rgbIssueCodes: entry.rgbAudit.issues.map(
        (issue) => issue.code,
      ),
      conditionGuideIssueCodes:
        entry.conditionGuideAudit.issues.map(
          (issue) => issue.code,
        ),
      rgbMatchedRecordIds: [
        ...entry.rgbAudit.exactMatches,
        ...entry.rgbAudit.rejectedCompositionMatches,
      ].map((match) => match.recordId),
      conditionGuideMatchedRecordIds:
        entry.conditionGuideAudit.approvedMacroCompositionMatches.map(
          (match) => match.recordId,
        ),
    })),
  },
  results,
  evidenceBoundary: {
    historicalRgbReadForAuditOnly: true,
    historicalConditionGuidesReadForAuditOnly: true,
    historicalRgbProvidedToGenerator: false,
    historicalGeometryCopied: false,
    promptModified: false,
    worldFactsModified: false,
    conditionsModified: false,
    reviewThresholdsModified: false,
    capacityCountRewritten: false,
  },
};

const stored = writeImmutableProgramRun({
  root: AUDIT_ROOT,
  runId,
  fileName: "audit-report.json",
  record: report,
  latest: {
    auditedRecordCount: report.summary.auditedRecordCount,
    recordsRequiringReviewCount:
      report.summary.recordsRequiringReviewCount,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportPath = path.join(ROOT, stored.runPath);
const reportSha256 = sha256File(reportPath);
appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action: "v7_measurement_slot_composition_reaudit_completed",
  runId,
  kind: "composition_reaudit",
  status:
    recordsRequiringReview.length === 0 ? "success" : "blocked",
  title:
    recordsRequiringReview.length === 0
      ? "V7 measurement slots 108-122 retrospective composition audit passed"
      : "V7 measurement slots 108-122 retrospective composition audit found records requiring review",
  titleZh:
    recordsRequiringReview.length === 0
      ? "V7测量槽位108至122历史构图复核通过"
      : "V7测量槽位108至122历史构图复核发现需要重新确认的记录",
  detail: `audited=${results.length}; requiringReview=${recordsRequiringReview.length}; reportSha256=${reportSha256}`,
  detailZh: `已复核=${results.length}；需重新确认=${recordsRequiringReview.length}；报告SHA-256=${reportSha256}`,
  script:
    "scripts/audit-ai-assisted-v7-measurement-slot-composition.mjs",
  currentStep: "retrospective_composition_audit_complete",
  evidencePath: stored.runPath,
  evidence: [stored.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      runId,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      summary: report.summary,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function isOwnerApproved(record) {
  if (record.reviews?.ownerReviewStatus === "owner_approved") {
    return true;
  }
  const reviewPath = record.reviews?.ownerReviewPath;
  if (!reviewPath) return false;
  const resolved = resolveProjectPath(reviewPath);
  return (
    fs.existsSync(resolved) &&
    readJson(resolved).decision === "owner_approved"
  );
}

function slotIdFor(recordId) {
  const match = recordId.match(/v7-capacity-slot-\d{3}/);
  assert(match, `slot identity is missing from record: ${recordId}`);
  return match[0];
}

function resolveRecordImagePath(record) {
  return resolveProjectPath(
    path.join(record.relativeDirectory, record.originalImage.path),
  );
}

function resolveProjectPath(value) {
  assert(value, "required project path is missing");
  const resolved = path.resolve(ROOT, value);
  assert(
    resolved === ROOT ||
      resolved.startsWith(`${path.resolve(ROOT)}${path.sep}`),
    `path escapes project: ${value}`,
  );
  return resolved;
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"));
}

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(value))
    .digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
