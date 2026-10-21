import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fixture, runIntake } from "./helpers/original-image-source-fixture.mjs"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
function run(f, request) {
  f.put("data/publication.json", request)
  return spawnSync(process.execPath, [path.join(REPO, "scripts/build-ai-assisted-cold-start-dataset-package.mjs"),
    "--source-correction", "data/publication.json"], { cwd: f.root, encoding: "utf8", timeout: 10000 })
}

test("existing publication entry requires explicit verify or publish operation", async t => {
  const f = await fixture(t)
  const result = run(f, { schemaVersion: "source-correction-dataset-release-request-v1", operation: "train" })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /publish/)
  assert.equal(fs.existsSync(path.join(f.root, ".runtime")), false)
})

test("publication rejects a changed draft without writing a release or request", async t => {
  const f = await fixture(t)
  const binding = f.put("data/draft.json", { schemaVersion: "source-correction-dataset-candidate-v1" })
  fs.appendFileSync(path.join(f.root, binding.path), "changed")
  const result = run(f, { schemaVersion: "source-correction-dataset-release-request-v1", operation: "verify",
    candidateManifest: binding })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /SHA|sha256|digest|mismatch/)
  assert.equal(fs.existsSync(path.join(f.root, ".runtime")), false)
})

test("caller flags cannot publish an unreleased draft without an actual source review", async t => {
  const f = await fixture(t)
  const intake = runIntake(f)
  assert.equal(intake.status, 0, intake.stderr)
  const recordPath = JSON.parse(intake.stdout).recordPath
  const request = { schemaVersion: "source-correction-dataset-request-v1", intakeRecord: f.put(recordPath,
    JSON.parse(fs.readFileSync(path.join(f.root, recordPath)))) }
  f.put("data/draft-request.json", request)
  const draft = spawnSync(process.execPath, [path.join(REPO, "scripts/build-ai-assisted-cold-start-dataset-package.mjs"),
    "--source-correction", "data/draft-request.json"], { cwd: f.root, encoding: "utf8", timeout: 10000 })
  assert.equal(draft.status, 0, draft.stderr)
  const output = JSON.parse(draft.stdout)
  const result = run(f, { schemaVersion: "source-correction-dataset-release-request-v1", operation: "verify",
    candidateManifest: output.manifest, sourceReview: { path: "data/fake-review.json", sha256: "a".repeat(64) },
    passed: true, trainingAllowed: true })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /foreign source review path/)
  assert.equal(fs.existsSync(path.join(f.root, ".runtime")), false)
})
