import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import test from "node:test"
import sharp from "sharp"
import { fixture, runIntake, COUNTS } from "./helpers/original-image-source-fixture.mjs"
import { validateOriginalImageIntakeRequest, isOwnerAuthorizedAiAssistedColdStartSource,
  isCurrentPolicyAiAssistedColdStartSource } from "../lib/original-image-library-contract.mjs"
import { verifyCurrentSourceCorrection, buildSourceCorrectionDatasetCandidate } from "../lib/ai-painter-source-correction-intake-v1.mjs"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

test("v2 recognizes current source provenance without historical approval; v1 behavior remains", async t => {
  const f = await fixture(t)
  assert.deepEqual(validateOriginalImageIntakeRequest(f.request), [])
  assert(isCurrentPolicyAiAssistedColdStartSource(f.request))
  assert.equal(isOwnerAuthorizedAiAssistedColdStartSource(f.request), false)
  const old = structuredClone(f.request)
  old.schemaVersion = "original-image-intake-request-v1"
  old.aiAssistedColdStart = { policyVersion: "owner-authorized-ai-assisted-cold-start-v1", ownerAuthorizationRef: "conversation-owner-authorization-2026-07-13",
    trainingLane: "ai_assisted_cold_start", generatorProvider: "openai", generatorSystem: "built_in", promptEvidencePath: "data/prompt.json" }
  assert.deepEqual(validateOriginalImageIntakeRequest(old), [])
  assert(isOwnerAuthorizedAiAssistedColdStartSource(old))
  old.schemaVersion = "original-image-intake-request-v2"
  assert(validateOriginalImageIntakeRequest(old).includes("current_intake_legacy_approval_field_forbidden"))
})

test("current intake recomputes real byte and normalization bindings, never grants qualification", async t => {
  const f = await fixture(t)
  const result = await verifyCurrentSourceCorrection({ root: f.root, request: f.request })
  assert.equal(result.receipt.normalizedPixelsReproduced, true)
  assert.equal(result.receipt.trainingQualified, false)
  assert.equal(Object.hasOwn(result.receipt, "sourceSemanticQualified"), false)
  assert.equal(Object.hasOwn(result.receipt, "sourceLicenseQualified"), false)
  assert.equal(result.receipt.externalGeneratorTransportIndependentlyVerified, false)
  result.verifyStable()
  fs.appendFileSync(path.join(f.root, f.image.path), "changed")
  assert.throws(result.verifyStable, /SHA mismatch/)
})

test("frozen 1.8 intake provenance remains verifiable under current rules without rewriting the request", async t => {
  const f = await fixture(t)
  const legacyPath = "data/ai-painter/system-governance/document-baselines/ai-painter-data-policy-1.8-b620c6ef.txt"
  const legacy = f.put(legacyPath, fs.readFileSync(path.join(REPO, legacyPath)))
  f.request.sourceCorrection.sourcePolicy.sha256 = legacy.sha256
  const before = structuredClone(f.request)
  const result = await verifyCurrentSourceCorrection({ root: f.root, request: f.request })
  assert(result.receipt.immutableInputs.some(item => item.path === legacyPath && item.sha256 === legacy.sha256))
  assert.deepEqual(f.request, before)
  result.verifyStable()
  fs.appendFileSync(path.join(f.root, legacyPath), "changed")
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }), /SHA mismatch/)
})

test("stale SHA, wrong facts, forged world binding, source policy and changed channel order reject", async t => {
  const f = await fixture(t)
  for (const mutate of [
    r => { r.sourceCorrection.image.sha256 = "0".repeat(64) },
    r => { r.sourceCorrection.worldFacts.path = "data/task.json" },
    r => { r.worldBinding.snapshotId = "changed" },
    r => { r.conditionBinding.worldId = "another-world" },
    r => { r.sourceCorrection.sourcePolicy.path = "data/task.json" },
    r => { r.sourceCorrection.sourcePolicy.sha256 = "f".repeat(64) }
  ]) {
    const request = structuredClone(f.request); mutate(request)
    await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request }))
  }
  const pack = JSON.parse(fs.readFileSync(path.join(f.root, f.pack.path)))
  pack.channels.reverse(); const request = structuredClone(f.request)
  request.sourceCorrection.conditionPack = f.put("data/pack.json", pack)
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request }))
})

test("validation parent and declared cross-sample image reference cannot enter a train correction", async t => {
  const f = await fixture(t)
  const request = structuredClone(f.request)
  request.sourceCorrection.parentSampleId = "validation-0"
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request }), /parent train/)
  const prompt = { ...f.prompt, toolReferenceImages: [f.prompt.spatialReference.path, "data/validation.png"] }
  request.sourceCorrection = { ...f.request.sourceCorrection, promptEvidence: f.put("data/prompt.json", prompt) }
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request }), /same-sample guide/)
})

test("actual pixels must match normalization even if caller supplies consistent file hashes", async t => {
  const f = await fixture(t)
  const other = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "red" } }).png().toBuffer()
  f.request.sourceCorrection.image = f.put(f.image.path, other)
  const norm = JSON.parse(fs.readFileSync(path.join(f.root, "data/normalization.json")))
  norm.normalized = f.request.sourceCorrection.image
  f.request.sourceCorrection.normalization = f.put("data/normalization.json", norm)
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }), /actual target pixels/)
})

test("legacy v1 intake CLI retains its historical record shape without current qualification", async t => {
  const f = await fixture(t)
  f.request.schemaVersion = "original-image-intake-request-v1"
  delete f.request.sourceCorrection
  f.request.aiAssistedColdStart = { policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
    ownerAuthorizationRef: "conversation-owner-authorization-2026-07-13", trainingLane: "ai_assisted_cold_start",
    generatorProvider: "openai", generatorSystem: "built_in", promptEvidencePath: "data/prompt.json" }
  const run = runIntake(f)
  assert.equal(run.status, 0, run.stderr)
  const record = JSON.parse(fs.readFileSync(path.join(f.root, JSON.parse(run.stdout).recordPath)))
  assert.equal(record.schemaVersion, "original-image-record-v1")
  assert.equal(record.status, "ai_assisted_cold_start_intake")
  assert.equal(record.reviews.ownerReviewStatus, "pending_review")
  assert.equal(record.aiAssistedColdStartEligible, false)
  assert.equal(Object.hasOwn(record, "sourceCorrection"), false)
})

test("existing intake CLI writes an indexed unqualified v1 record with no Owner wait state; exact repeat is read-only", async t => {
  const f = await fixture(t)
  const first = runIntake(f)
  assert.equal(first.status, 0, first.stderr)
  const result = JSON.parse(first.stdout)
  assert.equal(result.formalTrainingSampleCreated, false)
  const record = JSON.parse(fs.readFileSync(path.join(f.root, result.recordPath)))
  assert.equal(record.schemaVersion, "original-image-record-v1")
  assert.equal(record.status, "ai_assisted_cold_start_intake")
  assert.equal(record.aiAssistedColdStartEligible, false)
  assert.equal(record.independentTrainingEligible, false)
  assert.equal(Object.hasOwn(record.reviews, "ownerReviewStatus"), false)
  assert.equal(record.reviews.machineReviewStatus, "not_started")
  const before = fs.readFileSync(path.join(f.root, f.library, "index.json"))
  const again = runIntake(f)
  assert.equal(again.status, 0, again.stderr)
  assert.equal(JSON.parse(again.stdout).status, "already_intaked")
  assert(before.equals(fs.readFileSync(path.join(f.root, f.library, "index.json"))))
})

test("indexed source creates an unreleased 64-row draft without obsolete source-review blockers", async t => {
  const f = await fixture(t)
  const intaked = runIntake(f)
  assert.equal(intaked.status, 0, intaked.stderr)
  const recordPath = JSON.parse(intaked.stdout).recordPath
  const intakeRecord = { path: recordPath, sha256: sha(fs.readFileSync(path.join(f.root, recordPath))) }
  const request = { schemaVersion: "source-correction-dataset-request-v1", intakeRecord }
  const result = await buildSourceCorrectionDatasetCandidate({ root: f.root, request })
  assert.equal(result.datasetReleaseIdentity, null)
  assert.equal(result.trainingEligible, false)
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, result.manifest.path)))
  assert.equal(manifest.status, "draft_not_released")
  assert.deepEqual(manifest.blockingGates, ["dataset_release_not_created"])
  assert.equal(manifest.canStartFormalTraining, false)
  assert.equal(manifest.inheritedRows, 63)
  const source = JSON.parse(fs.readFileSync(path.join(f.root, manifest.sourceIndex.path)))
  const replacement = source.samples.find(row => row.sampleId === f.request.recordId)
  assert.equal(replacement.split, "train")
  assert.equal(Object.hasOwn(replacement, "contribution"), false)
  assert.equal(replacement.parentSampleId, "train-0")
  assert.equal(replacement.useQualification, "draft_not_released")
  for (const [split, count] of Object.entries(COUNTS)) {
    const membership = JSON.parse(fs.readFileSync(path.join(f.root, manifest.splits[split].path)))
    assert.equal(membership.sampleIds.length, count)
    if (split !== "train") assert.deepEqual(membership.sampleIds, f.rows.filter(row => row.split === split).map(row => row.sampleId))
  }
  await assert.rejects(buildSourceCorrectionDatasetCandidate({ root: f.root, request }), /never overwrite/)
  assert.equal(fs.existsSync(path.join(f.root, "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")), false)
})

test("unindexed record cannot be packaged, and caller qualification flags cannot qualify a draft", async t => {
  const f = await fixture(t)
  const response = runIntake(f)
  assert.equal(response.status, 0, response.stderr)
  const recordPath = JSON.parse(response.stdout).recordPath
  const intakeRecord = { path: recordPath, sha256: sha(fs.readFileSync(path.join(f.root, recordPath))) }
  f.put(f.library + "/index.json", { records: [] })
  await assert.rejects(buildSourceCorrectionDatasetCandidate({ root: f.root,
    request: { schemaVersion: "source-correction-dataset-request-v1", intakeRecord, trainingEligible: true } }), /formal original-library index/)
})

test("same RGB with a different source identity is rejected without rewriting the accepted index", async t => {
  const f = await fixture(t)
  const first = runIntake(f)
  assert.equal(first.status, 0, first.stderr)
  const before = fs.readFileSync(path.join(f.root, f.library, "index.json"))
  f.request.recordId = "another-source-identity"
  const conflict = runIntake(f)
  assert.equal(conflict.status, 1)
  assert(conflict.stderr.includes("different source identity"))
  assert(before.equals(fs.readFileSync(path.join(f.root, f.library, "index.json"))))
})

test("altered split order and legacy approval aliases fail closed", async t => {
  const f = await fixture(t)
  for (const key of ["ownerApprovalRequired", "ownerReviewPath", "waiting_owner_review"]) {
    const request = structuredClone(f.request); request.aiAssistedColdStart[key] = true
    assert(validateOriginalImageIntakeRequest(request).includes("current_intake_legacy_approval_field_forbidden"))
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.parentDataset.path)))
  const membership = JSON.parse(fs.readFileSync(path.join(f.root, manifest.splits.train.path)))
  membership.sampleIds.reverse()
  manifest.splits.train = f.put("data/splits/train.json", membership)
  f.request.sourceCorrection.parentDataset = f.put("data/parent-manifest.json", manifest)
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }), /membership/)
})

test("existing package CLI dispatches before legacy latest-pointer/configuration reads", async t => {
  const f = await fixture(t)
  const first = runIntake(f)
  assert.equal(first.status, 0, first.stderr)
  const recordPath = JSON.parse(first.stdout).recordPath
  f.put("data/package-request.json", { schemaVersion: "source-correction-dataset-request-v1",
    intakeRecord: { path: recordPath, sha256: sha(fs.readFileSync(path.join(f.root, recordPath))) }, trainingEligible: true })
  const response = spawnSync(process.execPath, [path.join(REPO, "scripts/build-ai-assisted-cold-start-dataset-package.mjs"),
    "--source-correction", "data/package-request.json"], { cwd: f.root, encoding: "utf8", timeout: 20000 })
  assert.equal(response.status, 0, response.stderr)
  assert.equal(JSON.parse(response.stdout).trainingEligible, false)
  assert.equal(JSON.parse(response.stdout).datasetReleaseIdentity, null)
})

test("current intake rejects an original-library category junction escaping its declared library", async t => {
  const f = await fixture(t), other = await fixture(t)
  const directory = path.join(f.root, f.library, "complete-maps")
  fs.rmdirSync(directory)
  fs.symlinkSync(path.join(other.root, other.library, "complete-maps"), directory, "junction")
  const response = runIntake(f)
  assert.equal(response.status, 1)
  assert(response.stderr.includes("output escaped the original library"), response.stderr)
  assert.equal(fs.readdirSync(path.join(other.root, other.library, "complete-maps")).length, 0)
})

async function editFixture(t) {
  const f = await fixture(t)
  const first = runIntake(f)
  assert.equal(first.status, 0, first.stderr)
  const recordPath = JSON.parse(first.stdout).recordPath
  const parent = JSON.parse(fs.readFileSync(path.join(f.root, recordPath)))
  const parentCorrectionRecord = { path: recordPath, sha256: sha(fs.readFileSync(path.join(f.root, recordPath))) }
  const editTarget = { path: parent.relativeDirectory + "/" + parent.originalImage.path, sha256: parent.originalImage.sha256 }
  const rgb = await sharp({ create: { width: 1024, height: 768, channels: 3,
    background: { r: 95, g: 98, b: 65 } } }).png().toBuffer()
  const image = f.put("data/edit-candidate.png", rgb), raw = f.put("data/edit-raw.png", rgb)
  const prompt = { ...f.prompt, schemaVersion: "source-object-correspondence-correction-request-v2",
    generationMethod: "built_in_image_edit_same_train_target_and_authoritative_guide",
    inputRoles: ["same_train_edit_target", "same_train_authoritative_guide"],
    toolReferenceImages: [editTarget.path, f.request.sourceCorrection.guide.path],
    editTarget, parentCorrectionRecord, challengeRegressionInputs: false, attempts: 1, automaticRetries: 0 }
  f.request = { ...f.request, recordId: "source-corrected-edit", imagePath: image.path,
    sourceCorrection: { ...f.request.sourceCorrection, parentCorrectionRecord, editTarget, image, rawSource: raw,
      promptEvidence: f.put("data/edit-prompt.json", prompt),
      normalization: f.put("data/edit-normalization.json", { raw, normalized: image, sourceCrop: null,
        resampling: { crop: false, kernel: "nearest", fit: "fill_exact_four_three_no_crop" } }) } }
  return { ...f, editPrompt: prompt, editParent: parent, editParentPath: recordPath }
}

test("same-train edit recomputes indexed parent provenance without inheriting qualification", async t => {
  const f = await editFixture(t)
  // The real tool records absolute paths; both allowed spellings identify the
  // same explicitly bound file. They are not arbitrary reference lookup paths.
  f.editPrompt.toolReferenceImages = f.editPrompt.toolReferenceImages.map(file => path.resolve(f.root, file).replaceAll("\\", "/"))
  f.request.sourceCorrection.promptEvidence = f.put("data/edit-prompt.json", f.editPrompt)
  const verified = await verifyCurrentSourceCorrection({ root: f.root, request: f.request })
  assert.equal(verified.receipt.sourceDerivation.kind, "same_train_edit")
  assert.equal(verified.receipt.sourceDerivation.originalTrainSampleId, "train-0")
  assert.equal(verified.receipt.sourceDerivation.sourceQualificationInherited, false)
  assert.equal(Object.hasOwn(verified.receipt, "sourceLicenseQualified"), false)
  assert.equal(Object.hasOwn(verified.receipt, "sourceSemanticQualified"), false)
  assert.equal(verified.receipt.trainingQualified, false)
  verified.verifyStable()
  fs.appendFileSync(path.join(f.root, f.editParentPath), " ")
  assert.throws(verified.verifyStable, /SHA mismatch/)
})

test("same-train edit rejects a different original train sample and every non-train parent", async t => {
  for (const id of ["train-1", "validation-0", "challenge-0", "regression-0"]) {
    const f = await editFixture(t)
    f.editParent.sourceCorrection.parentSampleId = id
    const changed = f.put(f.editParentPath, f.editParent)
    f.request.sourceCorrection.parentCorrectionRecord = changed
    f.editPrompt.parentCorrectionRecord = changed
    f.request.sourceCorrection.promptEvidence = f.put("data/edit-prompt.json", f.editPrompt)
    await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }), /belongs to another sample/)
  }
})

test("same-train edit rejects changed RGB, reordered inputs, extra references and false isolation declarations", async t => {
  const f = await editFixture(t)
  for (const mutate of [
    prompt => { prompt.toolReferenceImages.reverse() },
    prompt => { prompt.toolReferenceImages.push("data/validation.png") },
    prompt => { prompt.toolReferenceImages[0] = "data/other-train.png" },
    prompt => { prompt.challengeRegressionInputs = true },
    prompt => { prompt.validationImagesUsed = true },
    prompt => { prompt.inputRoles.reverse() },
    prompt => { prompt.editTarget.sha256 = "0".repeat(64) }
  ]) {
    const request = structuredClone(f.request), prompt = structuredClone(f.editPrompt)
    mutate(prompt)
    request.sourceCorrection.promptEvidence = f.put("data/edit-prompt.json", prompt)
    await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request }))
  }
})

test("an unindexed correction parent cannot be used as an edit source", async t => {
  const f = await editFixture(t)
  f.put(f.library + "/index.json", { records: [] })
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }), /original-library index/)
})

test("edit parent receipt or underlying archived provenance cannot be forged", async t => {
  const f = await editFixture(t)
  const evidence = JSON.parse(fs.readFileSync(path.join(f.root, f.editParent.sourceCorrection.intakeEvidence.path)))
  evidence.image.sha256 = "0".repeat(64)
  f.editParent.sourceCorrection.intakeEvidence = f.put(f.editParent.sourceCorrection.intakeEvidence.path, evidence)
  const changed = f.put(f.editParentPath, f.editParent)
  f.request.sourceCorrection.parentCorrectionRecord = changed
  f.editPrompt.parentCorrectionRecord = changed
  f.request.sourceCorrection.promptEvidence = f.put("data/edit-prompt.json", f.editPrompt)
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }))
})

test("two-input provenance cannot masquerade as guide-only input or an unbounded edit chain", async t => {
  const f = await editFixture(t)
  const disguised = structuredClone(f.request), prompt = structuredClone(f.editPrompt)
  delete prompt.schemaVersion
  disguised.sourceCorrection.promptEvidence = f.put("data/disguised-prompt.json", prompt)
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: disguised }), /explicit same-train edit/)
  const parentRequest = JSON.parse(fs.readFileSync(path.join(f.root, f.editParent.sourceCorrection.intakeRequest.path)))
  const priorPrompt = JSON.parse(fs.readFileSync(path.join(f.root, parentRequest.sourceCorrection.promptEvidence.path)))
  priorPrompt.schemaVersion = "source-object-correspondence-correction-request-v2"
  parentRequest.sourceCorrection.promptEvidence = f.put("data/forged-parent-prompt.json", priorPrompt)
  f.editParent.sourceCorrection.intakeRequest = f.put("data/forged-parent-request.json", parentRequest)
  const changed = f.put(f.editParentPath, f.editParent)
  f.request.sourceCorrection.parentCorrectionRecord = changed
  f.editPrompt.parentCorrectionRecord = changed
  f.request.sourceCorrection.promptEvidence = f.put("data/edit-prompt.json", f.editPrompt)
  await assert.rejects(verifyCurrentSourceCorrection({ root: f.root, request: f.request }), /nested edits/)
})

test("the existing intake and package CLIs accept real same-train edits only as pending drafts", async t => {
  const f = await editFixture(t)
  const response = runIntake(f)
  assert.equal(response.status, 0, response.stderr)
  const recordPath = JSON.parse(response.stdout).recordPath
  const record = JSON.parse(fs.readFileSync(path.join(f.root, recordPath)))
  assert.equal(record.status, "ai_assisted_cold_start_intake")
  assert.equal(record.aiAssistedColdStartEligible, false)
  assert.equal(Object.hasOwn(record.reviews, "ownerReviewStatus"), false)
  const receipt = JSON.parse(fs.readFileSync(path.join(f.root, record.sourceCorrection.intakeEvidence.path)))
  assert.equal(receipt.sourceDerivation.kind, "same_train_edit")
  const before = fs.readFileSync(path.join(f.root, f.library, "index.json"))
  assert.equal(runIntake(f).status, 0)
  assert(before.equals(fs.readFileSync(path.join(f.root, f.library, "index.json"))))
  const result = await buildSourceCorrectionDatasetCandidate({ root: f.root,
    request: { schemaVersion: "source-correction-dataset-request-v1", intakeRecord: {
      path: recordPath, sha256: sha(fs.readFileSync(path.join(f.root, recordPath))) } } })
  assert.equal(result.trainingEligible, false)
  assert.equal(result.datasetReleaseIdentity, null)
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, result.manifest.path)))
  assert.equal(manifest.inheritedRows, 63)
  assert.equal(manifest.replacedSample, "train-0")
})
