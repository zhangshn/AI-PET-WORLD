import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import assert from "node:assert/strict"
import sharp from "sharp"
import { createReader, SPLIT_COUNTS } from "./ai-painter-stage4-dataset-audit.mjs"

export const SOURCE_POLICY_PATH = "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md"
export const SOURCE_POLICY_VERSION = "AI-PAINTER-DATA-PROVENANCE-1.8"
const CURRENT_SOURCE_POLICY_VERSION = "AI-PAINTER-DATA-PROVENANCE-1.10"
const FROZEN_SOURCE_POLICIES = [
  { path: "data/ai-painter/system-governance/document-baselines/ai-painter-data-policy-1.8-b620c6ef.txt",
    sha256: "b620c6ef79f97c1854a4886d5402334b50fa3e47b7d95c6a3b282c5cd0b0a86b" },
  { path: "data/ai-painter/system-governance/document-baselines/ai-painter-data-policy-1.9-c75029b6.txt",
    sha256: "c75029b623c84cdfa5edc1af02dcd91f177ce6510d400aaea9bfa01296fb9ed4" },
]
const LIBRARY = "data/world-samples/original-image-library/natural-home-v1"
const PACKAGE_ROOT = "data/world-samples/ai-assisted-cold-start-dataset-packages"
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const identity = binding => ({ path: binding.path, sha256: binding.sha256 })
const same = (left, right, name) => assert.deepEqual(left, right, name)

function sameEditReferencePaths(root, references, expected) {
  assert(Array.isArray(references) && references.length === expected.length, "same-train edit requires exactly target and guide")
  references.forEach((reference, index) => {
    assert.equal(typeof reference, "string")
    const absolute = path.resolve(root, expected[index]).replaceAll("\\", "/")
    assert(reference === expected[index] || reference === absolute, "same-train edit reference path differs")
  })
}

// Source policy 1.8 sections 6.1 and 8.2 already cover same-train edit
// derivatives. This does not add a source lane or grant source qualification.
async function verifySameTrainEdit({ root, reader, request, input, parent, prompt }) {
  assert.equal(prompt.generationMethod, "built_in_image_edit_same_train_target_and_authoritative_guide")
  same(prompt.inputRoles, ["same_train_edit_target", "same_train_authoritative_guide"])
  assert.equal(prompt.challengeRegressionInputs, false)
  assert.equal(prompt.attempts, 1)
  assert.equal(prompt.automaticRetries, 0)
  same(input.parentCorrectionRecord, prompt.parentCorrectionRecord, "edit parent record binding differs")
  same(input.editTarget, identity(prompt.editTarget), "edit target binding differs")
  const prior = reader.bound(input.parentCorrectionRecord)
  assert.equal(prior.schemaVersion, "original-image-record-v1")
  assert.equal(prior.status, "ai_assisted_cold_start_intake")
  assert.equal(prior.recordPath, input.parentCorrectionRecord.path)
  assert.notEqual(prior.recordId, request.recordId, "edit must have a distinct source identity")
  assert.equal(prior.aiAssistedColdStart?.policyVersion, SOURCE_POLICY_VERSION)
  assert.equal(prior.aiAssistedColdStart?.trainingLane, "ai_assisted_cold_start")
  assert.equal(prior.sourceCorrection?.parentSampleId, parent.sampleId, "edit target belongs to another sample")
  assert.equal(prior.sourceCorrection?.split, "train")
  same(prior.worldBinding, request.worldBinding, "edit target world binding differs")
  same(prior.classification, request.classification, "edit target classification differs")
  const indexed = reader.json(LIBRARY + "/index.json").records.filter(row => row.recordId === prior.recordId)
  assert.equal(indexed.length, 1, "edit target must have exactly one original-library index entry")
  assert.equal(indexed[0].recordPath, input.parentCorrectionRecord.path)
  assert.equal(indexed[0].originalImage.sha256, prior.originalImage.sha256)
  const storedTarget = { path: prior.relativeDirectory + "/" + prior.originalImage.path,
    sha256: prior.originalImage.sha256 }
  same(input.editTarget, storedTarget, "edit target differs from indexed parent RGB")
  reader.bytes(storedTarget.path, storedTarget.sha256)
  sameEditReferencePaths(root, prompt.toolReferenceImages, [storedTarget.path, input.guide.path])
  const priorRequest = reader.bound(prior.sourceCorrection.intakeRequest)
  const priorPrompt = reader.bound(priorRequest.sourceCorrection.promptEvidence)
  // This compatibility scope permits one edit of a guide-only intake, not an
  // unbounded correction chain or a caller-supplied cross-sample reference.
  assert.notEqual(priorPrompt.schemaVersion, "source-object-correspondence-correction-request-v2", "nested edits are outside this compatibility scope")
  assert.equal(priorRequest.sourceCorrection.parentCorrectionRecord, undefined, "nested edit record is outside this compatibility scope")
  same(priorRequest.sourceCorrection.parentDataset, input.parentDataset, "edit target parent dataset differs")
  same(priorRequest.sourceCorrection.parentSourceRecord, input.parentSourceRecord)
  same(priorRequest.sourceCorrection.conditionPack, input.conditionPack)
  same(priorRequest.sourceCorrection.worldFacts, input.worldFacts)
  same(priorRequest.sourceCorrection.task, input.task)
  same(priorRequest.sourceCorrection.guide, input.guide)
  const priorVerification = await verifyCurrentSourceCorrection({ root, request: priorRequest })
  const priorEvidence = reader.bound(prior.sourceCorrection.intakeEvidence)
  assert.equal(priorEvidence.parentSampleId, parent.sampleId)
  assert.equal(priorEvidence.split, "train")
  assert.equal(priorEvidence.image.sha256, storedTarget.sha256)
  assert.equal(priorEvidence.image.sha256, priorVerification.receipt.image.sha256)
  assert.equal(priorEvidence.trainingQualified, false)
  for (const binding of priorVerification.receipt.immutableInputs) reader.bytes(binding.path, binding.sha256)
  priorVerification.verifyStable()
  return { kind: "same_train_edit", parentCorrectionRecord: input.parentCorrectionRecord,
    editTarget: storedTarget, authoritativeGuide: input.guide, inputRoles: prompt.inputRoles,
    sourceSplit: "train", originalTrainSampleId: parent.sampleId, sourceQualificationInherited: false }
}

function parentSelection(reader, binding) {
  const manifest = reader.bound(binding)
  assert(["ai-painter-stage4-v2-mvp64-denoiser-dataset-release-v1", "ai-painter-stage4-v2-independent-split-package-v1"].includes(manifest.schemaVersion), "unsupported parent dataset schema")
  const source = reader.bound(manifest.sourceIndex)
  assert.equal(manifest.sampleCount, 64)
  assert.equal(source.sampleCount, 64)
  assert.equal(source.samples.length, 64)
  assert.equal(new Set(source.samples.map(row => row.sampleId)).size, 64)
  for (const [split, count] of Object.entries(SPLIT_COUNTS)) {
    const membership = reader.bound(manifest.splits[split])
    const expected = source.samples.filter(row => row.split === split).map(row => row.sampleId)
    assert.equal(manifest.splitCounts[split], count)
    assert.equal(expected.length, count)
    assert.equal(membership.split, split)
    same(membership.sampleIds, expected, "parent split membership differs")
  }
  return { manifest, source }
}

export async function verifyCurrentSourceCorrection({ root, request }) {
  assert.equal(request.schemaVersion, "original-image-intake-request-v2")
  const reader = createReader(root)
  const input = request.sourceCorrection
  assert.equal(input?.schemaVersion, "source-correction-intake-evidence-request-v1")
  assert.equal(input.sourcePolicy.path, SOURCE_POLICY_PATH)
  // Keep the original intake provenance identity; use current review rules.
  const currentPolicy = reader.bytes(SOURCE_POLICY_PATH).toString("utf8")
  assert(currentPolicy.includes("文档版本：`" + CURRENT_SOURCE_POLICY_VERSION + "`"), "current source policy version differs")
  const frozen = FROZEN_SOURCE_POLICIES.find(item => item.sha256 === input.sourcePolicy.sha256)
  if (frozen) {
    reader.bytes(frozen.path, frozen.sha256)
  } else {
    reader.bytes(input.sourcePolicy.path, input.sourcePolicy.sha256)
  }
  const { manifest, source } = parentSelection(reader, input.parentDataset)
  const parent = source.samples.find(row => row.sampleId === input.parentSampleId)
  assert(parent && parent.split === "train", "correction requires its own parent train sample")
  assert.notEqual(request.recordId, parent.sampleId, "new source must have a new identity")
  same(parent.sourceRecord, input.parentSourceRecord, "parent source record differs")
  same(parent.conditionPack, input.conditionPack, "authoritative condition differs")
  const oldRecord = reader.bound(parent.sourceRecord)
  const pack = reader.bound(input.conditionPack)
  const conditionContract = { path: "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json",
    sha256: "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2" }
  const contract = reader.bound(conditionContract)
  same(pack.channels.map(item => item.id), contract.tensorContract.channelOrder, "condition channel order differs")
  assert.equal(pack.worldId, parent.grouping.worldId)
  assert.equal(request.conditionBinding?.conditionPackPath, input.conditionPack.path)
  assert.equal(request.conditionBinding?.worldId, pack.worldId)
  assert.equal(request.conditionBinding?.tick, pack.tick)
  assert.equal(request.conditionBinding?.taskId, pack.taskId)
  same(request.worldBinding, oldRecord.worldBinding, "world profile changed")
  same(request.classification, oldRecord.classification, "source classification changed")
  assert.equal(input.task.path, pack.sourceBindings.taskPackagePath)
  const task = reader.bound(input.task)
  assert.equal(task.taskId, pack.taskId)
  assert.equal(task.worldId, pack.worldId)
  assert.equal(task.tick, pack.tick)
  same(input.worldFacts, { path: task.sourceBindings.naturalizedWorldFactsPath, sha256: task.sourceBindings.naturalizedWorldFactsSha256 }, "WorldFacts differs")
  reader.bound(input.worldFacts)
  same(pack.objectInstanceTable.map(({ objectId, kind, footprint, blocksMovement }) => ({ objectId, kind, footprint, blocksMovement })),
    task.spatialLayers.objectFootprints.map(({ objectId, kind, footprint, blocksMovement }) => ({ objectId, kind, footprint, blocksMovement })), "object facts differ")
  assert.equal(pack.channels.length, 23)
  for (const channel of pack.channels) {
    const bytes = reader.bytes(channel.path, channel.sha256)
    const meta = await sharp(bytes).metadata()
    assert.equal(meta.width, 1024); assert.equal(meta.height, 768)
    assert.equal(meta.channels, 1, "condition channel is not grayscale")
  }
  const guideManifest = reader.bound(input.guideManifest)
  assert.equal(guideManifest.conditionPackPath, input.conditionPack.path)
  assert.equal(guideManifest.conditionPackSha256, pack.conditionPackSha256)
  same(input.guide, { path: guideManifest.guidePath, sha256: guideManifest.guideSha256 })
  reader.bytes(input.guide.path, input.guide.sha256)
  const prompt = reader.bound(input.promptEvidence)
  assert.equal(prompt.sourceSampleId, parent.sampleId)
  assert.equal(prompt.split, "train")
  same(prompt.spatialReference, input.guide)
  let sourceDerivation = null
  if (prompt.schemaVersion === "source-object-correspondence-correction-request-v2") {
    sourceDerivation = await verifySameTrainEdit({ root, reader, request, input, parent, prompt })
  } else {
    assert.equal(input.parentCorrectionRecord, undefined, "edit input requires explicit same-train edit provenance")
    assert.equal(input.editTarget, undefined, "edit target requires explicit same-train edit provenance")
    same(prompt.toolReferenceImages, [input.guide.path], "only the same-sample guide can be declared as reference")
  }
  assert.equal(prompt.validationImagesUsed, false)
  assert.equal(prompt.validationGeometryUsed, false)
  assert(typeof prompt.prompt === "string" && prompt.prompt.length > 0)
  assert.equal(request.aiAssistedColdStart.generatorProvider, "openai")
  assert.equal(request.aiAssistedColdStart.generatorSystem, "built_in_image_generation")
  for (const field of ["layerFiles", "conditionFiles", "rightsFiles", "reviewFiles"]) {
    for (const logical of request[field] ?? []) reader.bytes(logical)
  }
  if (prompt.priorSourceCorrection) {
    const prior = reader.bound(prompt.priorSourceCorrection)
    assert.equal(prior.originalSource.path, parent.image.path)
    assert.equal(prior.originalSource.sha256, parent.image.sha256)
    assert.equal(prompt.priorSourceCorrection.sourceFailedRgbUsedAsReference, false)
  }
  const raw = reader.bytes(input.rawSource.path, input.rawSource.sha256)
  const normalized = reader.bytes(input.image.path, input.image.sha256)
  assert.equal(request.imagePath, input.image.path)
  const normalization = reader.bound(input.normalization)
  same(identity(normalization.raw), input.rawSource)
  same(identity(normalization.normalized), input.image)
  assert.equal(normalization.sourceCrop, null)
  assert.equal(normalization.resampling.crop, false)
  assert.equal(normalization.resampling.kernel, "nearest")
  assert.equal(normalization.resampling.fit, "fill_exact_four_three_no_crop")
  const rawMeta = await sharp(raw).metadata()
  const meta = await sharp(normalized).metadata()
  assert.equal(rawMeta.width * 3, rawMeta.height * 4)
  assert(rawMeta.width >= 1024 && rawMeta.height >= 768)
  assert.equal(meta.width, 1024); assert.equal(meta.height, 768)
  const reproduced = await sharp(raw).resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).removeAlpha().raw().toBuffer()
  const pixels = await sharp(normalized).removeAlpha().raw().toBuffer()
  assert(reproduced.equals(pixels), "normalization did not reproduce actual target pixels")
  reader.verifyStable()
  return { verifyStable: () => reader.verifyStable(), receipt: {
    schemaVersion: "source-correction-intake-evidence-v1", checkedAtUtc: new Date().toISOString(),
    sourcePolicy: input.sourcePolicy, conditionContract, parentDataset: input.parentDataset, parentSampleId: parent.sampleId,
    parentSourceRecord: input.parentSourceRecord, parentRgb: parent.image, conditionPack: input.conditionPack,
    task: input.task, worldFacts: input.worldFacts, guide: input.guide, promptEvidence: input.promptEvidence,
    ...(sourceDerivation ? { sourceDerivation } : {}),
    rawSource: input.rawSource, image: input.image, normalization: input.normalization,
    capacitySlotId: parent.capacitySlotId, split: "train", immutableInputs: reader.receipts(),
    parentDatasetId: manifest.packageId, byteBindingsVerified: true, normalizedPixelsReproduced: true,
    externalGeneratorTransportIndependentlyVerified: false,
    machineReviewStatus: "not_started", trainingQualified: false,
    qualificationNote: "Intake binds file and derivation identities only; component review and dataset publication are separate steps."
  } }
}

// A replacement draft is NOT a released dataset and cannot be read by old
// training schemas. It keeps parent uses without inventing review blockers.
export async function buildSourceCorrectionDatasetCandidate({ root, request }) {
  assert.equal(request.schemaVersion, "source-correction-dataset-request-v1")
  const reader = createReader(root)
  const record = reader.bound(request.intakeRecord)
  assert.equal(record.schemaVersion, "original-image-record-v1")
  assert.equal(record.status, "ai_assisted_cold_start_intake")
  assert.equal(record.aiAssistedColdStart.policyVersion, SOURCE_POLICY_VERSION)
  const index = reader.json(LIBRARY + "/index.json")
  const indexed = index.records.filter(item => item.recordId === record.recordId)
  assert.equal(indexed.length, 1, "source must be in the formal original-library index")
  assert.equal(indexed[0].recordPath, request.intakeRecord.path)
  assert.equal(indexed[0].originalImage.sha256, record.originalImage.sha256)
  const originalRequest = reader.bound(record.sourceCorrection.intakeRequest)
  const verified = await verifyCurrentSourceCorrection({ root, request: originalRequest })
  const intakeEvidence = reader.bound(record.sourceCorrection.intakeEvidence)
  assert.equal(intakeEvidence.parentSampleId, verified.receipt.parentSampleId)
  assert.equal(intakeEvidence.image.sha256, record.originalImage.sha256)
  assert.equal(intakeEvidence.trainingQualified, false)
  const parentBinding = originalRequest.sourceCorrection.parentDataset
  const { manifest, source } = parentSelection(reader, parentBinding)
  const parent = source.samples.find(row => row.sampleId === verified.receipt.parentSampleId)
  assert(parent && parent.split === "train")
  const storedImage = { path: record.relativeDirectory + "/" + record.originalImage.path, sha256: record.originalImage.sha256 }
  reader.bytes(storedImage.path, storedImage.sha256)
  assert.equal(storedImage.sha256, verified.receipt.image.sha256)
  assert(source.samples.every(row => row.sampleId === parent.sampleId || row.image.sha256 !== storedImage.sha256), "replacement duplicates another sample")
  const replacement = { ...parent, sampleId: record.recordId, image: storedImage, sourceRecord: request.intakeRecord,
    sourceCorrection: record.sourceCorrection.intakeEvidence, parentSampleId: parent.sampleId,
    parentContributionForLineageOnly: parent.contribution, useQualification: "draft_not_released" }
  delete replacement.contribution
  delete replacement.sourceSampleIndex
  delete replacement.sourceContributionIndex
  const rows = source.samples.map(row => row.sampleId === parent.sampleId ? replacement : row)
  const payload = { parentDataset: parentBinding, intakeRecord: request.intakeRecord, samples: rows }
  const candidateIdentity = "source-correction64-" + sha(Buffer.from(JSON.stringify(payload)))
  const packageRoot = PACKAGE_ROOT + "/" + candidateIdentity
  const directory = path.join(root, packageRoot)
  const physicalRoot = fs.realpathSync(root)
  const physicalPackages = fs.realpathSync(path.join(root, PACKAGE_ROOT))
  assert(!path.relative(physicalRoot, physicalPackages).startsWith("..") && !path.isAbsolute(path.relative(physicalRoot, physicalPackages)), "package output root escaped project")
  assert(!fs.existsSync(directory), "candidate already exists; never overwrite an immutable package")
  reader.verifyStable(); verified.verifyStable()
  fs.mkdirSync(directory, { recursive: false })
  const write = (logical, value) => {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n")
    const filename = path.join(root, logical)
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, bytes, { flag: "wx" })
    return { path: logical, sha256: sha(bytes) }
  }
  const sourceIndex = write(packageRoot + "/source-index.json", {
    schemaVersion: "source-correction-dataset-source-index-v1", packageId: candidateIdentity,
    sampleCount: 64, parentSourceIndex: manifest.sourceIndex, samples: rows
  })
  const splits = Object.fromEntries(Object.keys(SPLIT_COUNTS).map(split => [split,
    write(packageRoot + "/splits/" + split + ".json", { schemaVersion: "source-correction-dataset-membership-v1",
      packageId: candidateIdentity, split, sampleIds: rows.filter(row => row.split === split).map(row => row.sampleId) })]))
  const result = { schemaVersion: "source-correction-dataset-candidate-v1", packageId: candidateIdentity,
    candidateIdentity, datasetReleaseIdentity: null, createdAtUtc: new Date().toISOString(),
    status: "draft_not_released", immutable: true, sampleCount: 64, splitCounts: SPLIT_COUNTS,
    parentDataset: parentBinding, sourceIndex, splits, replacedSample: parent.sampleId,
    replacementRecord: request.intakeRecord, inheritedRows: 63,
    blockingGates: ["dataset_release_not_created"],
    canStartFormalTraining: false, trainingEligible: false, capabilityReleased: false,
    original64Modified: false, originalSplitsModified: false, currentDatasetSelected: false }
  const manifestBinding = write(packageRoot + "/manifest.json", result)
  reader.verifyStable(); verified.verifyStable()
  return { status: result.status, packageId: candidateIdentity, manifest: manifestBinding,
    datasetReleaseIdentity: null, trainingStarted: false, trainingEligible: false }
}
