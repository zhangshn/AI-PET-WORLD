// Immutable CPU-only V25 acceptance; does not issue a GPU or training ticket.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const CANDIDATE = "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1.json"
const PARENT = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
const SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
const TESTS = [
  "ml/ai-painter/tests/test_object_head_train_dropout_v25_cpu.py",
  "ml/ai-painter/tests/test_object_head_train_dropout_v25_integration_cpu.py",
  "ml/ai-painter/tests/test_stage4_v25_dry_single_world_checkpoint_worker.py",
  "ml/ai-painter/tests/test_qualify_stage4_mvp256_dry_v25_gpu.py",
]
const PROGRAMS = [
  "ml/ai-painter/src/ai_painter/complete_world/object_head_train_dropout_v25_cpu.py",
  "ml/ai-painter/src/ai_painter/complete_world/object_head_train_dropout_v25_probe.py",
  "ml/ai-painter/scripts/painter_stage4_v25_dry_single_world_checkpoint_worker.py",
  "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v25_gpu.py",
  "ml/ai-painter/scripts/painter_stage4_v24_dry_single_world_checkpoint_worker.py",
  "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py",
  "scripts/run-ai-painter-mvp256-dry-v25-cpu-acceptance.mjs",
]
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

function within(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".."))
  const absolute = path.resolve(root, logical)
  assert.ok(absolute.startsWith(`${root}${path.sep}`))
  return absolute
}

const binding = (root, logical) => ({ path: logical,
  sha256: sha(fs.readFileSync(within(root, logical))) })

export function acceptedInputs(root = ROOT) {
  const base = fs.realpathSync(root)
  const candidate = binding(base, CANDIDATE)
  const parent = binding(base, PARENT)
  const specification = binding(base, SPEC)
  const proposal = JSON.parse(fs.readFileSync(within(base, CANDIDATE)))
  assert.equal(proposal.status, "cpu_only_inactive_not_execution_qualified")
  assert.deepEqual(proposal.predecessor.candidateContract, parent)
  assert.match(fs.readFileSync(within(base, SPEC), "utf8"),
    /^文档版本：`AI-PAINTER-SPEC-1\.33`$/mu)
  const tests = TESTS.map(logical => binding(base, logical))
  const programs = PROGRAMS.map(logical => binding(base, logical))
  return { root: base, candidate, parent, specification, tests, programs }
}

export function run({ root = ROOT, execute = false,
  command = spawnSync } = {}) {
  const inputs = acceptedInputs(root)
  const identity = sha(Buffer.from(JSON.stringify({
    candidate: inputs.candidate, parent: inputs.parent,
    specification: inputs.specification,
    tests: inputs.tests, programs: inputs.programs })))
  const output = `.runtime/ai-painter/stage4-mvp256-dry-v25-cpu-acceptance/${identity}/report.json`
  if (!execute) return { status: "v25_cpu_acceptance_pending",
    trainingStarted: false, gpuInitialized: false, output }
  const target = within(inputs.root, output)
  if (fs.existsSync(target)) {
    const bytes = fs.readFileSync(target)
    const report = JSON.parse(bytes)
    assert.equal(report.status, "v25_cpu_acceptance_passed")
    assert.deepEqual(report.policyCandidate, inputs.candidate)
    assert.deepEqual(report.specification, inputs.specification)
    assert.deepEqual(report.tests, inputs.tests)
    assert.deepEqual(report.programs, inputs.programs)
    return { status: report.status, report: { path: output, sha256: sha(bytes) },
      alreadyRecorded: true }
  }
  const result = command(within(inputs.root, PYTHON),
    ["-B", "-m", "unittest", ...TESTS, "-v"], {
      cwd: inputs.root, windowsHide: true, timeout: 120_000,
      encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PYTHONPATH: path.join(inputs.root, "ml/ai-painter/src"),
        PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8",
        OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2" },
    })
  assert.equal(result.error, undefined, String(result.error))
  assert.equal(result.status, 0, String(result.stderr ?? result.stdout))
  const summary = /Ran (\d+) tests? in [\d.]+s[\s\S]*\bOK\b/u.exec(result.stderr)
  assert.ok(summary, "V25 CPU unittest summary missing")
  assert.equal(Number(summary[1]), 11, "V25 CPU test count differs")
  const report = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v25-cpu-acceptance-v1",
    status: "v25_cpu_acceptance_passed",
    capabilityVersion: "stage4_mvp256_dry_object_head_train_dropout_v25_v1",
    policyCandidate: inputs.candidate, sourceDataCandidate: inputs.parent,
    specification: inputs.specification, tests: inputs.tests,
    programs: inputs.programs, testModules: TESTS.length, testsPassed: 11,
    optimizerSteps: 0, gpuInitialized: false, trainingStarted: false,
    checkpointLoaded: false, checkpointWritten: false,
    challengeContentRead: false, regressionContentRead: false,
    currentGpuQualificationGranted: false, stage4Advanced: false,
    recordedAtUtc: new Date().toISOString(),
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const encoded = Buffer.from(`${JSON.stringify(report, null, 2)}\n`)
  assert.ok(encoded.length <= 2 * 1024 * 1024)
  const descriptor = fs.openSync(target, "wx")
  try { fs.writeFileSync(descriptor, encoded); fs.fsyncSync(descriptor) }
  finally { fs.closeSync(descriptor) }
  return { status: report.status, report: { path: output, sha256: sha(encoded) },
    alreadyRecorded: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const execute = process.argv.slice(2).includes("--execute")
  assert.deepEqual(process.argv.slice(2), execute ? ["--execute"] : [])
  process.stdout.write(`${JSON.stringify(run({ execute }))}\n`)
}
