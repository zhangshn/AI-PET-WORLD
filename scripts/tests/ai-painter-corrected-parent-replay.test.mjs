import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { verifyPublishedCorrectionParent } from "../lib/ai-painter-corrected-parent-replay.mjs"

const root = process.cwd()
const binding = {
  path: "data/world-samples/ai-assisted-cold-start-dataset-packages/stage4-src64-4c32aee371b5fcaaa36b316199c7e7560892af7c0a5b908cfd6a6d44b4f0e6f7/manifest.json",
  sha256: "499daf40061da91ce1e367ee5c4e3493491b5e5c1701806d8c4246502e73cd23",
  bytes: 26756,
}

test("the original parent is reproduced with its review scope, all splits and one replacement", async () => {
  const originalRead = fs.readFileSync
  const docs = ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
    "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md"]
  const current = docs.map(file => originalRead(file))
  const previous = process.env.NODE_OPTIONS
  process.env.NODE_OPTIONS = "--import=./caller-selected-module-does-not-exist.mjs"
  try {
    const {manifest, source} = await verifyPublishedCorrectionParent({root, binding})
    assert.deepEqual(manifest.splitCounts, {train: 48, validation: 8, challenge: 4, regression: 4})
    assert.equal(source.samples.length, 64)
    const parent = JSON.parse(originalRead(manifest.identityPayload.parentDatasetRelease.path))
    const original = JSON.parse(originalRead(parent.sourceIndex.path)).samples
    const replaced = source.samples.filter((row, i) => {
      if (row.sampleId !== original[i].sampleId) return true
      assert.deepEqual(row, original[i])
      return false
    })
    assert.deepEqual(replaced.map(row => [row.sampleId, row.split]), [["mvp64-slot164-objects-v5-20261020", "train"]])
    assert.equal(manifest.identityPayload.verification.omittedAuditsClaimedPassed, false)
    assert.equal(manifest.qualification.trainingAllowed, false)
    assert.equal(fs.readFileSync, originalRead)
    assert.deepEqual(docs.map(file => fs.readFileSync(file)), current)
  } finally {
    if (previous === undefined) delete process.env.NODE_OPTIONS
    else process.env.NODE_OPTIONS = previous
  }
})

test("other packages, path aliases, caller-supplied SHA, size and root are rejected", async () => {
  for (const [other, pattern] of [
    [{...binding, path: binding.path.replace("manifest.json", "../manifest.json")}, /parent path/],
    [{...binding, path: "data/otherwise-qualified.json"}, /parent path/],
    [{...binding, sha256: "0".repeat(64)}, /parent SHA/],
    [{...binding, bytes: 1}, /size differs/],
  ]) await assert.rejects(verifyPublishedCorrectionParent({root, binding: other}), pattern)
  await assert.rejects(verifyPublishedCorrectionParent({root: path.join(root, "scripts"), binding}), /original repository/)
})

// Alter only an isolated test reader's returned bytes. Never modify the live
// index, program, document or publication. The production binding must reject it.
for (const logical of [
  "scripts/lib/ai-painter-source-correction-publication-v1.mjs",
  "data/ai-painter/system-governance/document-baselines/ai-painter-data-policy-1.10-66c537ce.txt",
  "data/ai-painter/system-governance/document-baselines/review-storage-1.25-48d9b177.txt",
  ".runtime/ai-painter/source-correction-publications/9840bc46c6e63484e458b6e76e757b107438ffca1e3c521d5965a24c2d883812/original-library-index-a9092022.json",
  ".runtime/ai-painter/source-correction-publications/9840bc46c6e63484e458b6e76e757b107438ffca1e3c521d5965a24c2d883812/review-entry-ea46241f.mjs",
  ".runtime/ai-painter/source-correction-publications/9840bc46c6e63484e458b6e76e757b107438ffca1e3c521d5965a24c2d883812/pipeline-entry-3206698a.mjs",
]) {
  test("fails closed on tampered " + path.basename(logical), async t => {
    const file = fs.realpathSync(logical)
    const read = fs.readFileSync.bind(fs)
    t.mock.method(fs, "readFileSync", function(fileName, ...args) {
      const bytes = read(fileName, ...args)
      return fileName === file ? Buffer.concat([bytes, Buffer.from("x")]) : bytes
    })
    const {verifyPublishedCorrectionParent: verify} = await import(
      "../lib/ai-painter-corrected-parent-replay.mjs?test=" + encodeURIComponent(logical))
    await assert.rejects(verify({root, binding}), /historical binding differs/)
  })
}
