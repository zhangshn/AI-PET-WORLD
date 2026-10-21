import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { createReader } from "./ai-painter-stage4-dataset-audit.mjs"
import { verifyCurrentSourceCorrection, SOURCE_POLICY_VERSION } from "./ai-painter-source-correction-intake-v1.mjs"
import { extractStyleFeatures, auditStyleFeatures } from "./ai-assisted-style-fingerprint.mjs"
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { auditCompleteMapWorldFrameIntegrity } from "./complete-map-world-frame-integrity.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./ai-painter-program-event-store.mjs"
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs"

const LIBRARY = "data/world-samples/original-image-library/natural-home-v1"
export const THRESHOLD = { path: "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
  sha256: "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df" }
export const REVIEW_RULES = { path: "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
  sha256: "48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909" }
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

export function isCurrentSourceCorrectionRecord(record) {
  return record?.aiAssistedColdStart?.policyVersion === SOURCE_POLICY_VERSION
    && record?.sourceCorrection?.schemaVersion === "source-correction-original-record-v1"
}

// Review only the retained MVP components; never claim omitted audits ran.
export async function reviewCurrentSourceCorrection({ root = process.cwd(), recordPath, parentReview = null }) {
  assert.equal(path.resolve(root), path.resolve(process.cwd()), "source review must run in its declared project")
  const started = new Date()
  const reader = createReader(root)
  const record = reader.json(recordPath)
  assert(isCurrentSourceCorrectionRecord(record), "current source correction record required")
  assert.equal(record.categoryId, "complete-maps")
  assert.equal(recordPath, LIBRARY + "/complete-maps/" + record.recordId + "/record.json")
  assert.equal(record.recordPath, recordPath)
  assert.equal(record.relativeDirectory, LIBRARY + "/complete-maps/" + record.recordId)
  assert.equal(record.status, "ai_assisted_cold_start_intake")
  assert.equal(record.aiAssistedColdStartEligible, false)
  assert.equal(record.independentTrainingEligible, false)
  const indexed = reader.json(LIBRARY + "/index.json").records.filter(item => item.recordId === record.recordId)
  assert.equal(indexed.length, 1, "source must have one original-library identity")
  assert.equal(indexed[0].recordPath, recordPath)
  assert.equal(indexed[0].originalImage.sha256, record.originalImage.sha256)
  const request = reader.bound(record.sourceCorrection.intakeRequest)
  const receipt = reader.bound(record.sourceCorrection.intakeEvidence)
  const verified = await verifyCurrentSourceCorrection({ root, request })
  for (const binding of verified.receipt.immutableInputs) reader.bytes(binding.path, binding.sha256)
  assert.equal(request.recordId, record.recordId)
  assert.equal(receipt.parentSampleId, verified.receipt.parentSampleId)
  assert.equal(receipt.image.sha256, verified.receipt.image.sha256)
  assert.equal(receipt.trainingQualified, false)
  assert.deepEqual(record.worldBinding, request.worldBinding)
  assert.deepEqual(record.classification, request.classification)
  assert.deepEqual(record.conditionBinding, request.conditionBinding)
  const imagePath = record.relativeDirectory + "/" + record.originalImage.path
  reader.bytes(imagePath, record.originalImage.sha256)
  assert.equal(record.originalImage.sha256, verified.receipt.image.sha256)
  reader.bytes(REVIEW_RULES.path, REVIEW_RULES.sha256)
  let parentReviewId = null
  if (parentReview) {
    assert(parentReview.path.startsWith(record.relativeDirectory + "/reviews/machine/"), "parent review belongs outside this source")
    const prior = reader.bound(parentReview)
    assert.equal(prior.recordId, record.recordId, "parent review record differs")
    assert.equal(prior.inputImageSha256, record.originalImage.sha256, "parent review RGB differs")
    assert(typeof prior.reviewId === "string" && prior.reviewId.length > 0, "parent review identity missing")
    parentReviewId = prior.reviewId
  }
  const threshold = reader.bound(THRESHOLD)
  assert.equal(threshold.activation.formalReviewExecutionAllowed, false)
  const fingerprint = reader.bound(threshold.styleFingerprint)
  for (const key of ["conditionAlignment", "styleFeatureExtractor"]) reader.bytes(
    threshold.implementationProvenance[key].path, threshold.implementationProvenance[key].sha256)
  const programs = ["scripts/lib/ai-painter-source-correction-review-v1.mjs",
    "scripts/lib/ai-painter-source-correction-intake-v1.mjs", "scripts/lib/complete-map-world-frame-integrity.mjs",
    "scripts/review-ai-assisted-cold-start-image.mjs", "scripts/run-ai-assisted-cold-start-review-pipeline.mjs"]
  assert.equal(sha(reader.bytes(programs[0])), sha(fs.readFileSync(fileURLToPath(import.meta.url))), "executed source-review program differs")
  for (const program of programs) reader.bytes(program)
  const features = await extractStyleFeatures(imagePath)
  assert.equal(features.imageSha256, record.originalImage.sha256)
  const style = auditStyleFeatures(features, fingerprint)
  const condition = await auditAiAssistedConditionAlignment({ record, imagePath })
  const frame = await auditCompleteMapWorldFrameIntegrity({ record, imagePath })
  const componentIssues = [...style.issues, ...condition.issues, ...frame.issues]
  const passed = style.passed && condition.passed && frame.passed && componentIssues.length === 0
  const programBindings = reader.receipts().filter(item => programs.includes(item.path))
  const identityPayload = { record: reader.receipts().find(item => item.path === recordPath),
    intakeRequest: record.sourceCorrection.intakeRequest, intakeEvidence: record.sourceCorrection.intakeEvidence,
    thresholdContract: THRESHOLD, reviewRules: REVIEW_RULES, parentReview, programBindings }
  const reviewId = "source-correction-review-" + sha(Buffer.from(JSON.stringify(identityPayload)))
  const reviewPath = record.relativeDirectory + "/reviews/machine/" + reviewId + ".json"
  const ended = new Date()
  const report = { schemaVersion: "ai-assisted-cold-start-machine-review-v1", reviewId, runId: reviewId, recordId: record.recordId,
    status: passed ? "review_passed" : "review_failed", passed,
    reviewerType: "local_deterministic_program", reviewMode: "source_component_evidence_not_formal_stage4_qualification",
    reviewerVersion: "source-correction-mvp-components-v2", reviewerProgramPath: programs[0],
    reviewerProgramSha256: programBindings.find(item => item.path === programs[0]).sha256,
    identityPayload, parentReviewId, inputImagePath: imagePath, inputImageSha256: record.originalImage.sha256,
    imagePath, imageSha256: record.originalImage.sha256,
    taskPackageId: record.worldBinding.taskPackageId, conditionPackId: record.worldBinding.conditionPackId,
    reviewThresholdContractPath: THRESHOLD.path, reviewThresholdContractSha256: THRESHOLD.sha256,
    styleFingerprintAudit: style, semanticConditionAudit: condition, worldFrameIntegrityAudit: frame,
    scores: { existingComponentsPassed: passed },
    thresholds: { contract: THRESHOLD, styleFingerprint: threshold.styleFingerprint, unchanged: true },
    issues: componentIssues, issueCodes: [...new Set(componentIssues.map(item => item.code))],
    affectedRegions: [...new Set(componentIssues.map(item => item.affectedRegion))],
    evidencePaths: reader.receipts(),
    trainingEligibility: passed ? "source_review_passed_dataset_release_pending" : "source_review_failed",
    trainingEligible: false, runtimeEligibility: false,
    aiAssistedColdStartEligible: passed, independentTrainingEligible: false, formalQualificationGranted: false,
    manualVisualInspectionPerformed: false, externalVisualOpinionUsedForQualification: false,
    accountTypeRequestedOrUsed: false, originalRecordModified: false, datasetReleased: false,
    trainingStarted: false, newImageGenerated: false, automaticStorage: true,
    startedAtUtc: started.toISOString(), endedAtUtc: ended.toISOString(), elapsedMilliseconds: ended - started,
    createdAtUtc: ended.toISOString(), createdAtAsiaShanghai: formatShanghai(ended.toISOString()) }
  reader.verifyStable()
  verified.verifyStable()
  const physicalRecordRoot = fs.realpathSync(path.join(root, record.relativeDirectory))
  for (const folder of ["reviews", "reviews/machine"]) {
    const target = path.join(root, record.relativeDirectory, folder)
    fs.mkdirSync(target, { recursive: true })
    const relative = path.relative(physicalRecordRoot, fs.realpathSync(target))
    assert(relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), "review output escaped original record")
  }
  fs.writeFileSync(path.join(root, reviewPath), JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  const storedBytes = fs.readFileSync(path.join(root, reviewPath))
  indexArtifact({ logicalPath: reviewPath, physicalUri: fs.realpathSync(path.join(root, reviewPath)),
    storageLayer: "hot", runId: reviewId, artifactType: "source_machine_review", byteSize: storedBytes.length,
    modifiedAtUtc: fs.statSync(path.join(root, reviewPath)).mtime.toISOString(), sha256: sha(storedBytes) })
  const event = appendAiPainterProgramEvent({ id: reviewId, action: "review_ai_assisted_cold_start_image", runId: reviewId,
    kind: passed ? "review_completed" : "step_failed", status: passed ? "info" : "failed",
    title: passed ? "MVP source component review passed" : "MVP source component review failed",
    titleZh: passed ? "MVP来源分项核验通过" : "MVP来源分项核验失败",
    detail: "Retained style, condition-response and frame checks completed. No dataset release or training performed.",
    detailZh: "已完成保留的风格、条件响应和画幅检查；未发布数据或启动训练，不冒称已执行移除的审核。",
    script: programs[0], currentStep: "reviewing", archiveId: record.recordId, evidencePath: reviewPath,
    error: passed ? null : componentIssues[0]?.code, finalGameMapSuccess: false, canEnterWorld: false })
  reader.verifyStable()
  verified.verifyStable()
  return { ...report, reviewPath, reviewSha256: sha(fs.readFileSync(path.join(root, reviewPath))), ledgerEventId: event.id }
}
