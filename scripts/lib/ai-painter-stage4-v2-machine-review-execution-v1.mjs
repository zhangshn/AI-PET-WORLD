import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  CURRENT_EXECUTION_REGISTRY_ROOT,
} from "../../src/server/ai-painter-current-execution-registry.mjs";
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs";
import { extractStyleFeatures } from "./ai-assisted-style-fingerprint.mjs";

export const V2_MACHINE_REVIEW_EXECUTION_SCHEMA =
  "ai-painter-stage4-v2-machine-review-execution-binding-v1";
export const V2_MACHINE_REVIEW_RESULT_SCHEMA =
  "ai-painter-stage4-v2-machine-review-execution-result-v1";
export const V2_ARCHITECTURE_ID =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
export const V2_REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30]);

const THRESHOLD_PATH =
  "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json";
const THRESHOLD_SHA256 = "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df";
const CONDITION_AUDITOR_PATH = "scripts/lib/ai-assisted-condition-alignment.mjs";
const PROFESSIONAL_AUDITOR_PATH = "scripts/lib/ai-assisted-professional-aesthetic.mjs";
const STYLE_EXTRACTOR_PATH = "scripts/lib/ai-assisted-style-fingerprint.mjs";
const OBJECT_ROLES = Object.freeze([
  "object_footprints", "object_tree", "object_rock", "object_vegetation",
]);

export async function executeStage4V2MachineReview(
  reviewExecutionBinding,
  {
    projectRoot = process.cwd(),
    conditionAudit = auditAiAssistedConditionAlignment,
    professionalAudit = auditProfessionalAestheticFromFrozenContract,
    now = () => new Date(),
  } = {},
) {
  const root = path.resolve(projectRoot);
  const validated = validateReviewExecutionBinding(reviewExecutionBinding, root);
  const rows = [];
  for (const preview of validated.previews) {
    // Recompute immediately before each audit, so replacement between initial
    // validation and execution fails closed.
    verifyBinding(root, preview, `preview_epoch_${preview.epoch}`);
    const [professional, alignment] = await Promise.all([
      executeStage4V2FrozenProfessionalAestheticAudit(validated, preview, {
        projectRoot: root,
        professionalAudit,
      }),
      executeStage4V2FrozenConditionAlignmentAudit(validated, preview, {
        projectRoot: root,
        conditionAudit,
      }),
    ]);
    verifyBinding(root, preview, `preview_epoch_${preview.epoch}_after_review`);
    verifyImmutableReviewInputs(validated, root, `epoch_${preview.epoch}_after_review`);
    const sanitizedProfessional = professional;
    const sanitizedAlignment = alignment;
    const issueCodes = [...new Set([
      ...(sanitizedProfessional.issues ?? []).map((item) => item.code),
      ...(sanitizedAlignment.issues ?? []).map((item) => item.code),
    ])].sort();
    const passed = sanitizedProfessional.passed === true && sanitizedAlignment.passed === true;
    rows.push(Object.freeze({
      epoch: preview.epoch,
      candidatePreview: { path: preview.path, sha256: preview.sha256 },
      passed,
      status: passed ? "machine_review_passed" : "machine_review_failed",
      issueCodes,
      professionalAesthetic: sanitizedProfessional,
      conditionAlignment: sanitizedAlignment,
    }));
  }
  const passCount = rows.filter((row) => row.passed).length;
  const recordedAtUtc = now().toISOString();
  return Object.freeze({
    schemaVersion: V2_MACHINE_REVIEW_RESULT_SCHEMA,
    status: passCount === rows.length
      ? "stage4_v2_machine_review_passed"
      : "stage4_v2_machine_review_failed",
    architectureId: V2_ARCHITECTURE_ID,
    executionPackageIdentity: validated.executionPackageIdentity,
    smokeRunId: validated.smokeRunId,
    reviewNodeCount: rows.length,
    previewPassCount: passCount,
    previewFailCount: rows.length - passCount,
    reviews: rows,
    immutableBindings: validated.immutableBindings,
    reviewTrainingSeparation: {
      reviewResultsUsedAsTrainingTarget: false,
      failureCodesUsedAsLoss: false,
      failedPreviewPixelsUsedAsTrainingTarget: false,
      thresholdAdaptationDuringTraining: false,
      thresholdLoweringAllowed: false,
    },
    gpuStartedByReview: false,
    optimizerCreatedByReview: false,
    backwardExecutedByReview: false,
    weightsModifiedByReview: false,
    trainingStartedByReview: false,
    recordedAtUtc,
  });
}

/**
 * Executes the frozen professional-aesthetic auditor from immutable PNG,
 * style-fingerprint and threshold evidence.  The same helper is reused by
 * recovery and downstream evidence gates, so internally coherent persisted
 * metrics cannot certify themselves.
 */
export async function executeStage4V2FrozenProfessionalAestheticAudit(
  validated,
  preview,
  {
    projectRoot = process.cwd(),
    professionalAudit = auditProfessionalAestheticFromFrozenContract,
  } = {},
) {
  const root = path.resolve(projectRoot);
  assert.equal(preview?.executionPackageIdentity ?? validated.executionPackageIdentity,
    validated.executionPackageIdentity,
  `preview Epoch ${preview?.epoch ?? "unknown"} package identity differs`);
  verifyBinding(root, preview, `preview_epoch_${preview.epoch}_professional_audit_before`);
  verifyImmutableReviewInputs(validated, root,
    `epoch_${preview.epoch}_professional_audit_before`);
  const professional = stripTrainingHints(await professionalAudit({
    imagePath: resolveInside(root, preview.path),
    thresholdContract: validated.thresholdContractValue,
    styleFingerprintPath: resolveInside(root, validated.styleFingerprint.path),
    expectedStyleFingerprintSha256: validated.styleFingerprint.sha256,
  }));
  verifyBinding(root, preview, `preview_epoch_${preview.epoch}_professional_audit_after`);
  verifyImmutableReviewInputs(validated, root,
    `epoch_${preview.epoch}_professional_audit_after`);
  assert.equal(professional?.candidate?.imageSha256, preview.sha256,
    `professional-aesthetic Epoch ${preview.epoch} image SHA-256 differs from immutable preview`);
  return professional;
}

/**
 * Executes the exact frozen condition-alignment auditor against the immutable
 * preview and input bindings.  This helper is intentionally shared by initial
 * review execution and the later Smoke evidence gate so persisted auditor
 * output can never be trusted merely because it reports an empty issue list.
 */
export async function executeStage4V2FrozenConditionAlignmentAudit(
  validated,
  preview,
  {
    projectRoot = process.cwd(),
    conditionAudit = auditAiAssistedConditionAlignment,
  } = {},
) {
  const root = path.resolve(projectRoot);
  assert.equal(preview?.executionPackageIdentity ?? validated.executionPackageIdentity,
    validated.executionPackageIdentity,
  `preview Epoch ${preview?.epoch ?? "unknown"} package identity differs`);
  verifyBinding(root, preview, `preview_epoch_${preview.epoch}_condition_audit_before`);
  verifyImmutableReviewInputs(validated, root,
    `epoch_${preview.epoch}_condition_audit_before`);
  const record = {
    recordId: `${validated.smokeRunId}-epoch-${preview.epoch}`,
    conditionBinding: {
      conditionPackPath: validated.conditionPack.path,
      worldId: validated.conditionPackValue.worldId,
      tick: validated.conditionPackValue.tick,
    },
    rebuild64Sequence: validated.conditionPackValue.reviewSubject?.rebuild64SequenceSeriesId
      ? { seriesId: validated.conditionPackValue.reviewSubject.rebuild64SequenceSeriesId }
      : undefined,
    classification: {
      regionalLandscapeType: validated.conditionPackValue.reviewSubject?.regionalLandscapeType ?? null,
      monsoonSeason: validated.conditionPackValue.reviewSubject?.monsoonSeason ?? null,
    },
  };
  const alignment = await conditionAudit({
    record,
    imagePath: resolveInside(root, preview.path),
    referenceImagePath: resolveInside(root, validated.referenceRgb.path),
  });
  verifyBinding(root, preview, `preview_epoch_${preview.epoch}_condition_audit_after`);
  verifyImmutableReviewInputs(validated, root,
    `epoch_${preview.epoch}_condition_audit_after`);
  return stripTrainingHints(normalizeConditionAudit(
    alignment,
    validated.thresholdContractValue,
  ));
}

function normalizeConditionAudit(audit, thresholdContract) {
  const allowedCodes = new Set([
    ...thresholdContract.failureCodes.waterAndPath,
    ...thresholdContract.failureCodes.objects,
    ...thresholdContract.failureCodes.hydrology,
  ]);
  const issues = audit.issues ?? [];
  for (const issue of issues) {
    assert.ok(
      allowedCodes.has(issue.code) || String(issue.code).startsWith("condition_focal_area_"),
      `condition auditor emitted failure code outside the frozen V2 contract: ${issue.code}`,
    );
  }
  const formalIssues = issues.filter((issue) => allowedCodes.has(issue.code));
  return {
    ...audit,
    status: formalIssues.length === 0 ? "condition_alignment_passed" : "condition_alignment_failed",
    passed: formalIssues.length === 0,
    objectSemanticAudits: (audit.objectSemanticAudits ?? [])
      .filter((item) => OBJECT_ROLES.includes(item.channelId)),
    auxiliaryDiagnostics: (audit.objectSemanticAudits ?? [])
      .filter((item) => item.channelId === "focal_area"),
    issues: formalIssues,
  };
}

export function validateReviewExecutionBinding(binding, projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot);
  assert.equal(binding?.schemaVersion, V2_MACHINE_REVIEW_EXECUTION_SCHEMA);
  assert.equal(binding.status, "active_readonly_machine_review");
  assert.equal(binding.architectureId, V2_ARCHITECTURE_ID);
  assert.equal(binding.stage, "controlled_smoke");
  assert.match(binding.reviewBindingId ?? "", /^[a-z0-9][a-z0-9._-]{15,191}$/u, "reviewBindingId invalid");
  assert.equal(binding.bindingPolicy?.explicitArtifactsOnly, true);
  assert.equal(binding.bindingPolicy?.latestPointerAllowed, false);
  assert.equal(binding.bindingPolicy?.historicalRunSelectionAllowed, false);
  assert.equal(binding.bindingPolicy?.crossExecutionPackageEvidenceAllowed, false);
  assert.equal(binding.bindingPolicy?.thresholdOverrideAllowed, false);
  assert.equal(binding.bindingPolicy?.reviewOutputMayBecomeTrainingTarget, false);
  assertNoForbiddenSelector(binding);

  const threshold = verifyBinding(root, binding.thresholdContract, "thresholdContract");
  assert.equal(binding.thresholdContract.path, THRESHOLD_PATH);
  assert.equal(binding.thresholdContract.sha256, THRESHOLD_SHA256);
  assert.equal(threshold.schemaVersion, "ai-painter-stage4-v2-machine-review-threshold-contract-v1");
  assert.equal(threshold.status, "cpu_supported_inactive");
  assert.equal(threshold.immutable, true);
  assert.equal(threshold.architectureId, V2_ARCHITECTURE_ID);
  assert.equal(threshold.reviewTrainingSeparation?.reviewResultsUsedAsTrainingTarget, false);
  assert.equal(threshold.reviewTrainingSeparation?.thresholdLoweringAllowed, false);

  const conditionAuditor = verifyBinding(root, binding.reviewPrograms?.conditionAlignment, "conditionAlignmentProgram");
  const professionalAuditor = verifyBinding(root, binding.reviewPrograms?.professionalAesthetic, "professionalAestheticProgram");
  const styleExtractor = verifyBinding(root, binding.reviewPrograms?.styleFeatureExtractor, "styleFeatureExtractorProgram");
  assert.equal(binding.reviewPrograms.conditionAlignment.path, CONDITION_AUDITOR_PATH);
  assert.equal(binding.reviewPrograms.professionalAesthetic.path, PROFESSIONAL_AUDITOR_PATH);
  assert.equal(binding.reviewPrograms.styleFeatureExtractor.path, STYLE_EXTRACTOR_PATH);
  assert.equal(conditionAuditor, null);
  assert.equal(professionalAuditor, null);
  assert.equal(styleExtractor, null);
  assert.deepEqual(binding.reviewPrograms.conditionAlignment, threshold.implementationProvenance.conditionAlignment);
  assert.deepEqual(binding.reviewPrograms.professionalAesthetic, {
    path: threshold.implementationProvenance.professionalAesthetic.path,
    sha256: threshold.implementationProvenance.professionalAesthetic.sha256,
    role: threshold.implementationProvenance.professionalAesthetic.role,
  });
  assert.deepEqual(binding.reviewPrograms.styleFeatureExtractor, threshold.implementationProvenance.styleFeatureExtractor);

  const transaction = verifyBinding(root, binding.currentRegistryTransaction, "currentRegistryTransaction");
  const currentRegistrySnapshot = verifyBinding(root,
    binding.currentRegistrySnapshot, "currentRegistrySnapshot");
  assert.equal(transaction.schemaVersion, "ai-painter-current-execution-registry-transaction-v1");
  assert.equal(transaction.status, "committed");
  assert.match(transaction.transactionId ?? "", /^current-execution-registry-[a-z0-9-]+$/u,
    "current registry transaction identity invalid");
  const expectedTransactionPath =
    `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transaction.transactionId}/transaction.json`;
  const expectedStagedPath =
    `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transaction.transactionId}/current.staged.json`;
  assert.equal(normalizeRelative(binding.currentRegistryTransaction.path), expectedTransactionPath,
    "current registry transaction path mismatch");
  assert.equal(normalizeRelative(binding.currentRegistrySnapshot.path), expectedStagedPath,
    "current registry snapshot path mismatch");
  assert.equal(normalizeRelative(transaction.currentStaged?.path), expectedStagedPath,
    "current staged registry path mismatch");
  assert.equal(normalizeRelative(transaction.currentStaged.path),
    normalizeRelative(binding.currentRegistrySnapshot.path),
    "transaction current staged path differs from persisted immutable snapshot");
  assert.equal(transaction.currentStaged.sha256,
    binding.currentRegistrySnapshot.sha256,
    "transaction current staged SHA-256 differs from persisted immutable snapshot");
  const currentStaged = verifyBinding(root, transaction.currentStaged,
    "currentRegistryTransaction.currentStaged");
  assert.match(transaction.currentSha256 ?? "", /^[a-f0-9]{64}$/u,
    "current registry transaction SHA-256 invalid");
  assert.equal(transaction.currentSha256, transaction.currentStaged.sha256,
    "current registry transaction SHA-256 does not bind current staged bytes");
  assert.equal(transaction.currentSha256,
    binding.currentRegistrySnapshot.sha256,
    "current registry transaction SHA-256 does not bind immutable snapshot bytes");
  assert.deepEqual(currentStaged, currentRegistrySnapshot,
    "current registry transaction content differs from immutable snapshot content");
  assert.equal(currentRegistrySnapshot.schemaVersion,
    "ai-painter-current-execution-registry-v1");
  assert.equal(currentRegistrySnapshot.registryRevision, transaction.registryRevision);
  assert.equal(currentRegistrySnapshot.eventSequence, transaction.eventSequence);
  assert.equal(currentRegistrySnapshot.transactionId, transaction.transactionId);
  assert.equal(currentRegistrySnapshot.capabilityVersion, V2_ARCHITECTURE_ID);
  assert.equal(currentRegistrySnapshot.packageId, binding.executionPackageIdentity);
  assert.equal(currentRegistrySnapshot.runId, binding.smokeRunId);
  assert.equal(currentRegistrySnapshot.taskKind, "controlled_smoke");
  assert.equal(currentRegistrySnapshot.executionState, "reviewing");
  assert.equal(currentRegistrySnapshot.nextMachineAction, null);

  const smokePackage = verifyBinding(root, binding.smokePackage, "smokePackage");
  assert.equal(smokePackage.architectureId ?? smokePackage.capabilityVersion, V2_ARCHITECTURE_ID);
  assert.equal(smokePackage.packageId, binding.executionPackageIdentity);
  assert.equal(smokePackage.runId, binding.smokeRunId);
  assert.equal(smokePackage.reviewExecutionBindingId, binding.reviewBindingId);
  assert.deepEqual(smokePackage.machineReviewInputs, {
    thresholdContract: binding.thresholdContract,
    conditionPack: binding.conditionPack,
    referenceRgb: binding.referenceRgb,
    objectMasks: binding.objectMasks,
    styleFingerprint: binding.styleFingerprint,
    reviewPrograms: binding.reviewPrograms,
  }, "review execution inputs are not bound by the immutable Smoke package");

  const qualification = verifyBinding(root, binding.readonlyGpuQualificationTerminal, "readonlyGpuQualificationTerminal");
  assert.equal(qualification.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-terminal-v1");
  assert.equal(qualification.status, "stage4_v2_readonly_gpu_qualification_passed");
  assert.equal(qualification.executionState, "completed");
  assert.equal(qualification.capabilityVersion, V2_ARCHITECTURE_ID);
  assert.deepEqual(smokePackage.readonlyGpuQualificationTerminal, binding.readonlyGpuQualificationTerminal);

  const conditionPackValue = verifyBinding(root, binding.conditionPack, "conditionPack");
  assert.equal(conditionPackValue.channels?.length, 23);
  assert.equal(binding.conditionPack.channelCount, 23);
  assert.equal(new Set(conditionPackValue.channels.map((item) => item.id)).size, 23, "condition channel identities are not unique");
  for (const channel of conditionPackValue.channels) {
    assert.equal(typeof channel.id, "string", "condition channel id missing");
    verifyBinding(root, channel, `condition_channel_${channel.id}`);
  }
  const referenceRgb = verifyBinding(root, binding.referenceRgb, "referenceRgb");
  assert.equal(referenceRgb, null);
  const styleFingerprint = verifyBinding(root, binding.styleFingerprint, "styleFingerprint");
  assert.equal(styleFingerprint.schemaVersion, threshold.styleFingerprint.schemaVersion);
  assert.equal(styleFingerprint.fingerprintId, threshold.styleFingerprint.fingerprintId);
  assert.equal(binding.styleFingerprint.path, threshold.styleFingerprint.path);
  assert.equal(binding.styleFingerprint.sha256, threshold.styleFingerprint.sha256);

  assert.deepEqual(binding.objectMasks.map((item) => item.role), OBJECT_ROLES);
  for (const mask of binding.objectMasks) {
    const value = verifyBinding(root, mask, mask.role);
    assert.equal(value, null);
    const channel = conditionPackValue.channels.find((item) => item.id === mask.role);
    assert.ok(channel, `condition pack missing ${mask.role}`);
    assert.equal(normalizeRelative(channel.path), normalizeRelative(mask.path), `${mask.role} path mismatch`);
    assert.equal(channel.sha256, mask.sha256, `${mask.role} SHA-256 mismatch`);
  }

  assert.deepEqual(binding.previews.map((item) => item.epoch), V2_REVIEW_EPOCHS);
  const outputRoot = normalizeRelative(smokePackage.outputDirectory);
  for (const preview of binding.previews) {
    assert.equal(preview.executionPackageIdentity, binding.executionPackageIdentity);
    verifyBinding(root, preview, `preview_epoch_${preview.epoch}`);
    assert.ok(normalizeRelative(preview.path).startsWith(`${outputRoot}/`), `preview Epoch ${preview.epoch} is outside the Smoke package`);
  }
  return Object.freeze({
    executionPackageIdentity: binding.executionPackageIdentity,
    smokeRunId: binding.smokeRunId,
    previews: binding.previews.map((item) => ({ ...item })),
    conditionPack: { ...binding.conditionPack },
    conditionPackValue,
    referenceRgb: { ...binding.referenceRgb },
    styleFingerprint: { ...binding.styleFingerprint },
    thresholdContractValue: threshold,
    immutableBindings: {
      currentRegistryTransaction: binding.currentRegistryTransaction,
      currentRegistrySnapshot: binding.currentRegistrySnapshot,
      smokePackage: binding.smokePackage,
      readonlyGpuQualificationTerminal: binding.readonlyGpuQualificationTerminal,
      thresholdContract: binding.thresholdContract,
      conditionPack: binding.conditionPack,
      referenceRgb: binding.referenceRgb,
      objectMasks: binding.objectMasks,
      styleFingerprint: binding.styleFingerprint,
      reviewPrograms: binding.reviewPrograms,
    },
  });
}

function verifyImmutableReviewInputs(validated, root, suffix) {
  verifyBinding(root, validated.immutableBindings.currentRegistryTransaction,
    `currentRegistryTransaction_${suffix}`);
  verifyBinding(root, validated.immutableBindings.currentRegistrySnapshot,
    `currentRegistrySnapshot_${suffix}`);
  verifyBinding(root, validated.immutableBindings.thresholdContract, `thresholdContract_${suffix}`);
  verifyBinding(root, validated.immutableBindings.conditionPack, `conditionPack_${suffix}`);
  verifyBinding(root, validated.immutableBindings.referenceRgb, `referenceRgb_${suffix}`);
  verifyBinding(root, validated.immutableBindings.styleFingerprint, `styleFingerprint_${suffix}`);
  for (const mask of validated.immutableBindings.objectMasks) {
    verifyBinding(root, mask, `${mask.role}_${suffix}`);
  }
  for (const program of Object.values(validated.immutableBindings.reviewPrograms)) {
    verifyBinding(root, program, `review_program_${suffix}`);
  }
}

export async function auditProfessionalAestheticFromFrozenContract({
  imagePath,
  thresholdContract,
  styleFingerprintPath,
  expectedStyleFingerprintSha256,
}) {
  assert.equal(sha256File(styleFingerprintPath), expectedStyleFingerprintSha256, "style fingerprint changed before review");
  const fingerprint = JSON.parse(fs.readFileSync(styleFingerprintPath, "utf8"));
  assert.equal(fingerprint.fingerprintId, thresholdContract.styleFingerprint.fingerprintId);
  assert.ok((fingerprint.positiveSamples ?? []).length >= 5, "professional aesthetic calibration sample count is insufficient");
  const extracted = await extractStyleFeatures(imagePath);
  const values = Object.fromEntries(extracted.featureNames.map((name, index) => [name, extracted.vector[index]]));
  const professional = thresholdContract.professionalAestheticThresholds;
  const axes = professional.multiscaleTextureUpperEnvelope.axes;
  const textureViolations = Object.entries(axes)
    .filter(([name, maximum]) => Number(values[name]) > maximum)
    .map(([name, maximum]) => ({ feature: name, candidate: round(values[name]), frozenMaximum: maximum }));
  const quietRegionVariance = round(values.block_variance_q10);
  const hierarchyRatio = round(values.block_variance_q10 / Math.max(values.block_variance_q90, professional.textureHierarchyUpperEnvelope.denominatorFloor.value));
  const issues = [];
  if (textureViolations.length >= professional.multiscaleTextureUpperEnvelope.failureViolationCount.value) {
    issues.push({ code: "professional_multiscale_texture_noise_overload", severity: "error", affectedRegion: "whole_frame" });
  }
  if (quietRegionVariance > professional.quietRegionUpperEnvelope.value) {
    issues.push({ code: "professional_quiet_region_missing", severity: "error", affectedRegion: "whole_frame" });
  }
  if (hierarchyRatio > professional.textureHierarchyUpperEnvelope.value) {
    issues.push({ code: "professional_texture_hierarchy_collapsed", severity: "error", affectedRegion: "whole_frame" });
  }
  return {
    schemaVersion: "ai-painter-stage4-v2-professional-aesthetic-audit-v1",
    status: issues.length === 0 ? "professional_aesthetic_passed" : "professional_aesthetic_failed",
    passed: issues.length === 0,
    method: "explicit_frozen_style_fingerprint_multiscale_texture_envelope_v2",
    styleFingerprint: { fingerprintId: fingerprint.fingerprintId, sha256: expectedStyleFingerprintSha256 },
    candidate: {
      imageSha256: sha256File(imagePath),
      multiscaleTextureValues: Object.fromEntries(
        Object.keys(axes).map((name) => [name, round(values[name])]),
      ),
      quietRegionVariance,
      textureHierarchyRatio: hierarchyRatio,
    },
    textureViolations,
    issues,
  };
}

function verifyBinding(root, binding, role) {
  assert.ok(binding && typeof binding === "object" && !Array.isArray(binding), `${role} binding missing`);
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`);
  const absolute = resolveInside(root, binding.path);
  assert.equal(fs.existsSync(absolute), true, `${role} file missing`);
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`);
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`);
  if (absolute.endsWith(".json")) return JSON.parse(fs.readFileSync(absolute, "utf8"));
  return null;
}

function resolveInside(root, logicalPath) {
  const normalized = normalizeRelative(logicalPath);
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, ...normalized.split("/"));
  assert.ok(absolute.startsWith(`${absoluteRoot}${path.sep}`), "path escapes project root");
  return absolute;
}

function normalizeRelative(value) {
  assert.equal(typeof value, "string", "project path must be a string");
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  assert.equal(path.posix.isAbsolute(normalized), false, "absolute path forbidden");
  assert.equal(/^[A-Za-z]:\//u.test(normalized), false, "drive path forbidden");
  assert.equal(normalized === ".." || normalized.startsWith("../"), false, "parent path forbidden");
  assert.equal(/(^|\/)latest(?:\.json)?(?:\/|$)/iu.test(normalized), false, "latest selector forbidden");
  assert.equal(/(^|\/)(?:history|historical-runs?)(?:\/|$)/iu.test(normalized), false, "historical selector forbidden");
  return normalized;
}

function assertNoForbiddenSelector(value, location = "reviewExecutionBinding") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenSelector(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(/^latest(?:Path|Pointer|Record)?$/iu.test(key), false, `${location}.${key} latest selector forbidden`);
    assert.equal(/^historicalRun(?:Id|Path|Selector)?$/iu.test(key), false, `${location}.${key} historical selector forbidden`);
    assertNoForbiddenSelector(child, `${location}.${key}`);
  }
}

function stripTrainingHints(value) {
  if (Array.isArray(value)) return value.map(stripTrainingHints);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["nextTrainingTarget", "trainingTarget", "lossTarget"].includes(key))
    .map(([key, child]) => [key, stripTrainingHints(child)]));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function round(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}
