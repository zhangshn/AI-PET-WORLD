import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createReader } from "./ai-painter-stage4-dataset-audit.mjs"
import { verifyCurrentSourceCorrection } from "./ai-painter-source-correction-intake-v1.mjs"
import { REVIEW_RULES, THRESHOLD } from "./ai-painter-source-correction-review-v1.mjs"
import { extractStyleFeatures, auditStyleFeatures } from "./ai-assisted-style-fingerprint.mjs"
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { auditCompleteMapWorldFrameIntegrity } from "./complete-map-world-frame-integrity.mjs"
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs"
import { appendAiPainterProgramEvent } from "./ai-painter-program-event-store.mjs"

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const LIBRARY = "data/world-samples/original-image-library/natural-home-v1/complete-maps/"

export async function verifySourceCorrectionPublication({ root, request }) {
  assert.equal(path.resolve(root), process.cwd(), "publication root differs from current project")
  assert.equal(request.schemaVersion, "source-correction-dataset-release-request-v1")
  assert(["verify", "publish"].includes(request.operation), "publication operation must be explicit")
  const reader = createReader(root)
  const candidate = reader.bound(request.candidateManifest)
  assert.equal(candidate.schemaVersion, "source-correction-dataset-candidate-v1")
  assert.equal(candidate.status, "draft_not_released")
  assert.equal(candidate.datasetReleaseIdentity, null)
  const record = reader.bound(candidate.replacementRecord)
  assert.equal(candidate.replacementRecord.path, LIBRARY + record.recordId + "/record.json")
  const intakeRequest = reader.bound(record.sourceCorrection.intakeRequest)
  const verified = await verifyCurrentSourceCorrection({ root, request: intakeRequest })
  for (const input of verified.receipt.immutableInputs) reader.bytes(input.path, input.sha256)
  assert.deepEqual(candidate.parentDataset, intakeRequest.sourceCorrection.parentDataset)
  assert.equal(candidate.replacedSample, verified.receipt.parentSampleId)
  assert.equal(record.originalImage.sha256, verified.receipt.image.sha256)
  assert(request.sourceReview.path.startsWith(record.relativeDirectory + "/reviews/machine/"), "foreign source review path")
  const review = reader.bound(request.sourceReview)
  assert.equal(review.recordId, record.recordId)
  assert.equal(review.inputImageSha256, record.originalImage.sha256)
  assert.equal(review.reviewerVersion, "source-correction-mvp-components-v2")
  assert.deepEqual(review.identityPayload.record, reader.receipts().find(item => item.path === candidate.replacementRecord.path))
  assert.deepEqual(review.identityPayload.reviewRules, REVIEW_RULES)
  assert.deepEqual(review.identityPayload.thresholdContract, THRESHOLD)
  reader.bytes(REVIEW_RULES.path, REVIEW_RULES.sha256)
  for (const input of review.evidencePaths) reader.bytes(input.path, input.sha256)
  assert.equal(review.reviewId, "source-correction-review-" + sha(Buffer.from(JSON.stringify(review.identityPayload))))
  const threshold = reader.bound(THRESHOLD)
  const fingerprint = reader.bound(threshold.styleFingerprint)
  const imagePath = record.relativeDirectory + "/" + record.originalImage.path
  const features = await extractStyleFeatures(imagePath)
  assert.equal(features.imageSha256, record.originalImage.sha256)
  const actual = [auditStyleFeatures(features, fingerprint),
    await auditAiAssistedConditionAlignment({ record, imagePath }), await auditCompleteMapWorldFrameIntegrity({ record, imagePath })]
  assert(actual.every(item => item.passed === true && item.issues.length === 0), "retained source component check failed")
  assert.deepEqual(actual, [review.styleFingerprintAudit, review.semanticConditionAudit, review.worldFrameIntegrityAudit], "source review does not reproduce actual measurements")
  assert.equal(review.status, "review_passed")
  assert.equal(review.passed, true)
  assert.deepEqual(review.issues, [])
  verified.verifyStable()
  reader.verifyStable()
  return { schemaVersion: "source-correction-publication-verification-v1", candidateManifest: request.candidateManifest,
    sourceReview: request.sourceReview, replacementRecord: candidate.replacementRecord,
    parentDataset: candidate.parentDataset, parentSampleId: candidate.replacedSample,
    imageSha256: record.originalImage.sha256, inputBindings: reader.receipts(),
    reviewScope: "retained_mvp_source_components_only", omittedAuditsClaimedPassed: false }
}

export async function publishSourceCorrectionDataset({ root, request }) {
  assert.equal(request.operation, "publish")
  await verifySourceCorrectionPublication({ root, request })
  const verificationRequest = { schemaVersion: request.schemaVersion, operation: "verify",
    candidateManifest: request.candidateManifest, sourceReview: request.sourceReview }
  const bytes = Buffer.from(JSON.stringify(verificationRequest, null, 2) + "\n")
  const directory = ".runtime/ai-painter/source-correction-publications/" + sha(bytes)
  fs.mkdirSync(path.join(root, directory), { recursive: true })
  const relative = path.relative(fs.realpathSync(path.join(root, ".runtime")), fs.realpathSync(path.join(root, directory)))
  assert(relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), "publication output escaped runtime storage")
  const requestPath = directory + "/verification-request.json"
  if (fs.existsSync(path.join(root, requestPath))) assert(fs.readFileSync(path.join(root, requestPath)).equals(bytes), "immutable publication request conflict")
  else fs.writeFileSync(path.join(root, requestPath), bytes, { flag: "wx" })
  const python = process.platform === "win32" ? "ml/ai-painter/.venv/Scripts/python.exe" : "ml/ai-painter/.venv/bin/python"
  const result = spawnSync(path.join(root, python), ["-B", "ml/ai-painter/scripts/publish_source_correction_dataset_v1.py",
    "--request", requestPath, "--sha256", sha(bytes)], { cwd: root, encoding: "utf8", timeout: 120000,
    maxBuffer: 2 * 1024 * 1024, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2" } })
  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  const published = JSON.parse(result.stdout)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, published.path)))
  assert.equal(sha(fs.readFileSync(path.join(root, published.path))), published.sha256)
  for (const binding of [published, manifest.sourceIndex, ...Object.values(manifest.splits)]) {
    const file = path.join(root, binding.path), saved = fs.readFileSync(file)
    assert.equal(sha(saved), binding.sha256)
    indexArtifact({ logicalPath: binding.path, physicalUri: fs.realpathSync(file), storageLayer: "hot",
      runId: manifest.packageId, artifactType: "dataset_release", byteSize: saved.length,
      modifiedAtUtc: fs.statSync(file).mtime.toISOString(), sha256: binding.sha256 })
  }
  const event = appendAiPainterProgramEvent({ id: manifest.packageId, runId: manifest.packageId,
    action: "publish_source_correction_dataset_v1", kind: "review_completed", status: "info",
    title: "Corrected MVP64 dataset published", titleZh: "单条纠错MVP64数据版本已发布",
    detail: "One train replacement; other 63 rows unchanged. No execution or GPU qualification inherited.",
    detailZh: "仅替换一条train来源，其余63条和四份用途保持；未继承执行或GPU资格，未启动训练。",
    script: "scripts/build-ai-assisted-cold-start-dataset-package.mjs", evidencePath: published.path,
    finalGameMapSuccess: false, canEnterWorld: false })
  return { status: manifest.status, manifest: published, datasetReleaseIdentity: manifest.datasetReleaseIdentity,
    ledgerEventId: event.id, currentDatasetSelected: false, trainingStarted: false }
}
