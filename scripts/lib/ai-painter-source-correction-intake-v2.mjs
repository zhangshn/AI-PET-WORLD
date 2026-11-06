import assert from "node:assert/strict"
import path from "node:path"
import sharp from "sharp"
import { createReader, sha256 } from "./ai-painter-stage4-dataset-audit.mjs"
import { verifyPublishedCorrectionParent } from "./ai-painter-corrected-parent-replay.mjs"
import { isCurrentPolicyAiAssistedColdStartSource } from "./original-image-library-contract.mjs"

const policyPath = "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md"
const conditionContract = { path: "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json",
  sha256: "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2" }
const identity = ({ path, sha256 }) => ({ path, sha256 })

function parentArtifacts(reader, record) {
  if (record.sourceCorrection) {
    const prior = reader.bound(record.sourceCorrection.intakeEvidence)
    assert.equal(prior.split, "train")
    return { task: prior.task, guide: prior.guide }
  }
  const facts = record.conditionBinding
  return { taskPath: facts.taskPackagePath, taskPayloadSha256: facts.taskSha256,
    guide: { path: facts.guidePath, sha256: facts.guideSha256 } }
}

async function normalizedPixels(reader, input) {
  const normalization = reader.bound(input.normalization)
  assert.equal(normalization.candidateId, input.candidateId)
  assert.deepEqual(identity(normalization.raw), input.rawSource)
  assert.deepEqual(identity(normalization.normalized), input.image)
  assert.equal(normalization.sourceCrop, null)
  assert.equal(normalization.resampling.crop, false)
  assert.equal(normalization.resampling.kernel, "nearest")
  assert.equal(normalization.resampling.fit, "fill_exact_four_three_no_crop")
  const raw = reader.bytes(input.rawSource.path, input.rawSource.sha256)
  const normalized = reader.bytes(input.image.path, input.image.sha256)
  const source = sharp(raw, { failOn: "error", limitInputPixels: 64 * 1024 * 1024 })
  const target = sharp(normalized, { failOn: "error", limitInputPixels: 1024 * 768 })
  const sourceMeta = await source.metadata(), targetMeta = await target.metadata()
  assert(sourceMeta.width >= 1024 && sourceMeta.width * 3 === sourceMeta.height * 4 && !sourceMeta.hasAlpha, "opaque native 4:3 raw source required")
  assert(targetMeta.format === "png" && targetMeta.channels === 3 && targetMeta.width === 1024 && targetMeta.height === 768, "opaque 1024x768 RGB PNG required")
  assert.deepEqual(normalization.rawSize, { width: sourceMeta.width, height: sourceMeta.height })
  assert.deepEqual(normalization.normalizedSize, { width: 1024, height: 768 })
  const reproduced = await source.resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).removeAlpha().raw().toBuffer()
  assert(reproduced.equals(await target.raw().toBuffer()), "normalization did not reproduce actual target pixels")
}

export async function verifyGuideOnlySourceCorrection({ root, request }) {
  assert(isCurrentPolicyAiAssistedColdStartSource(request), "invalid generator declaration")
  assert.equal(request.aiAssistedColdStart.generatorProvider, "openai")
  assert.equal(request.aiAssistedColdStart.generatorSystem, "built_in_image_generation")
  const reader = createReader(root), input = request.sourceCorrection
  assert.equal(input.schemaVersion, "source-correction-intake-evidence-request-v2")
  assert.equal(input.sourcePolicy.path, policyPath)
  const document = reader.bytes(policyPath, input.sourcePolicy.sha256).toString("utf8")
  const version = /^文档版本：`(AI-PAINTER-DATA-PROVENANCE-\d+\.\d+)`$/m.exec(document)?.[1]
  assert(version && version === request.aiAssistedColdStart.policyVersion, "current source policy version differs")
  assert.equal(input.parentCorrectionRecord, undefined, "guide-only request cannot take an edit target")
  assert.equal(input.editTarget, undefined, "guide-only request cannot take an edit target")
  for (const field of ["conditionFiles","layerFiles","reviewFiles","rightsFiles"]) {
    assert(!request[field]?.length, "guide-only intake does not accept auxiliary attachments")
  }
  const { manifest, source } = await verifyPublishedCorrectionParent({ root, binding: input.parentDataset })
  assert.deepEqual(reader.bound(input.parentDataset), manifest, "parent bytes changed during verification")
  assert.deepEqual(reader.bound(manifest.sourceIndex), source, "parent index changed during verification")
  const parent = source.samples.find(row => row.sampleId === input.parentSampleId)
  assert(parent && parent.split === "train", "same train sample required")
  assert(!source.samples.some(row => row.sampleId === request.recordId), "new correction requires a new identity")
  assert.deepEqual(input.parentSourceRecord, parent.sourceRecord, "parent source record differs")
  assert.deepEqual(input.conditionPack, parent.conditionPack, "parent condition differs")
  const oldRecord = reader.bound(parent.sourceRecord), pack = reader.bound(parent.conditionPack)
  assert.equal(oldRecord.recordId, parent.sampleId)
  assert.equal(pack.worldId, parent.grouping.worldId)
  assert.deepEqual(request.worldBinding, oldRecord.worldBinding)
  assert.deepEqual(request.classification, oldRecord.classification)
  const original = parentArtifacts(reader, oldRecord)
  if (original.task) assert.deepEqual(input.task, original.task, "task file differs from published correction")
  else assert.equal(input.task.path, original.taskPath, "task path differs from published source")
  assert.deepEqual(input.guide, original.guide, "guide differs from published source")
  const task = reader.bound(input.task)
  const { taskSha256, ...taskPayload } = task
  assert.equal(sha256(Buffer.from(JSON.stringify(taskPayload))), taskSha256, "canonical task payload differs")
  assert.equal(taskSha256, pack.taskSha256, "canonical task differs from bound conditions")
  if (original.taskPayloadSha256) assert.equal(taskSha256, original.taskPayloadSha256, "canonical task differs from published source")
  assert.equal(task.worldId, pack.worldId); assert.equal(task.tick, pack.tick); assert.equal(task.taskId, pack.taskId)
  assert.equal(pack.sourceBindings.taskPackagePath, input.task.path)
  assert.equal(request.conditionBinding?.worldId, pack.worldId)
  assert.equal(request.conditionBinding.tick, pack.tick)
  assert.equal(request.conditionBinding.taskId, pack.taskId)
  assert.equal(request.conditionBinding.conditionPackPath, parent.conditionPack.path)
  assert.deepEqual(input.worldFacts, { path: task.sourceBindings.naturalizedWorldFactsPath, sha256: task.sourceBindings.naturalizedWorldFactsSha256 }, "WorldFacts differ")
  reader.bound(input.worldFacts)
  const objects = rows => rows.map(({ objectId, kind, footprint, blocksMovement }) => ({ objectId, kind, footprint, blocksMovement }))
  assert.deepEqual(objects(pack.objectInstanceTable), objects(task.spatialLayers.objectFootprints))
  const order = reader.bound(conditionContract).tensorContract.channelOrder
  assert.equal(order.length, 23); assert.deepEqual(pack.channels.map(c => c.id), order)
  for (const c of pack.channels) {
    const meta = await sharp(reader.bytes(c.path, c.sha256)).metadata()
    assert(meta.format === "png" && meta.width === 1024 && meta.height === 768 && meta.channels === 1, "invalid condition channel")
  }
  const guideManifestPath = path.posix.join(path.posix.dirname(parent.conditionPack.path), "condition-guide-manifest.json")
  assert.equal(input.guideManifest.path, guideManifestPath)
  const guide = reader.bound(input.guideManifest)
  assert.equal(guide.conditionPackPath, parent.conditionPack.path); assert.equal(guide.conditionPackSha256, pack.conditionPackSha256)
  assert.equal(guide.worldId, pack.worldId); assert.equal(guide.taskId, pack.taskId); assert.equal(guide.tick, pack.tick)
  assert.deepEqual(input.guide, { path: guide.guidePath, sha256: guide.guideSha256 })
  reader.bytes(input.guide.path, input.guide.sha256)
  const prompt = reader.bound(input.promptEvidence)
  if (prompt.candidateId !== undefined) assert.equal(prompt.candidateId, request.recordId)
  assert.equal(prompt.sourceSampleId, parent.sampleId)
  assert.deepEqual(identity(prompt.parentDataset), identity(input.parentDataset), "generation parent differs")
  assert.deepEqual(identity(prompt.parentSourceRecord), identity(input.parentSourceRecord))
  assert.equal(prompt.split, "train"); assert.equal(prompt.validationImagesUsed, false); assert.equal(prompt.validationGeometryUsed, false)
  assert.equal(prompt.editTarget, undefined); assert.equal(prompt.parentCorrectionRecord, undefined)
  assert(prompt.priorSourceCorrection == null && prompt.challengeRegressionInputs === false, "only the same-sample guide is permitted")
  assert.deepEqual(prompt.conditionPack, input.conditionPack); assert.deepEqual(prompt.spatialReference, input.guide)
  assert.deepEqual(prompt.toolReferenceImages, [input.guide.path], "only the same-sample guide can be referenced")
  assert.equal(prompt.generationMethod, "built_in_image_generation_authoritative_guide_only")
  assert(typeof prompt.prompt === "string" && prompt.prompt.trim(), "explicit generation instructions required")
  assert.equal(request.imagePath, input.image.path)
  const dir = path.posix.dirname(input.promptEvidence.path)
  assert(dir.startsWith(".runtime/ai-painter/") && dir.endsWith("/"+request.recordId), "artifacts require a candidate-specific runtime directory")
  for (const key of ["rawSource","image","normalization"]) assert.equal(path.posix.dirname(input[key].path), dir)
  assert(!source.samples.some(row => [input.image.sha256,input.rawSource.sha256].includes(row.image.sha256)), "candidate reuses an existing source RGB")
  await normalizedPixels(reader, { ...input, candidateId: request.recordId })
  const programs = ["scripts/intake-original-image.mjs", "scripts/lib/original-image-library-contract.mjs",
    "scripts/lib/ai-painter-source-correction-intake-v2.mjs", "scripts/lib/ai-painter-corrected-parent-replay.mjs",
    "scripts/lib/ai-painter-stage4-dataset-audit.mjs"]
  for (const logical of programs) reader.bytes(logical)
  reader.verifyStable()
  return { verifyStable: () => reader.verifyStable(), receipt: {
    schemaVersion: "source-correction-intake-evidence-v2", checkedAtUtc: new Date().toISOString(),
    sourcePolicy: input.sourcePolicy, policyVersion: version, conditionContract, parentDataset: input.parentDataset,
    parentDatasetId: manifest.packageId, parentSampleId: parent.sampleId, parentSourceRecord: parent.sourceRecord,
    parentRgb: parent.image, conditionPack: parent.conditionPack, task: input.task, worldFacts: input.worldFacts,
    guideManifest: input.guideManifest, guide: input.guide, promptEvidence: input.promptEvidence, rawSource: input.rawSource,
    image: input.image, normalization: input.normalization, capacitySlotId: parent.capacitySlotId, split: "train",
    immutableInputs: reader.receipts(), programBindings: reader.receipts().filter(r => programs.includes(r.path)),
    normalizedPixelsReproduced: true, byteBindingsVerified: true,
    externalGeneratorTransportIndependentlyVerified: false, machineReviewStatus: "not_started", trainingQualified: false
  } }
}
