// Build inactive execution policy from actual CPU results; never launches CUDA.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { pathToFileURL } from "node:url"
import { PROGRAMS, PROPOSAL_PATH, validatePolicy, readNumericCpuProof,
  HISTORICAL_SPECIFICATION, PREDECESSOR_FAILURE, AGGREGATION_RULE } from "./run-ai-painter-mvp256-dry-v26-v2-training.mjs"
import { BUDGET, CAPABILITY } from "./lib/ai-painter-mvp256-dry-v26-v2-package-chain-v1.mjs"
import { bind, boundJson, readBound, inside, writeExclusive } from "./run-ai-painter-mvp256-dry-v24-training.mjs"

const execFileAsync = promisify(execFile)
const POLICY = "data/ai-painter/system-governance/stage4-mvp256-dry-v26-v2-context-isolation-execution-policy-v2.json"
const MODEL_CPU = ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/deterministic-aggregation-v2/v26-assembly-v2-cpu-1a1496dd1e3c721b38de2d59/report.json"
const CONTROLLER_CPU = ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/controller-acceptance.json"
const PARENT = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
const REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
const sha = value => crypto.createHash("sha256").update(value).digest("hex")
const TESTS = ["scripts/tests/test-ai-painter-mvp256-dry-v26-v2-package-chain-v1.mjs",
  "scripts/tests/test-ai-painter-mvp256-dry-v26-v2-independent-audit.mjs",
  "scripts/tests/test-ai-painter-mvp256-dry-v26-v2-review-closure.mjs",
  "scripts/tests/test-ai-painter-mvp256-dry-v26-v2-training.mjs"]

function javascriptClosure(root, seeds) {
  const result = new Map()
  const visit = logical => {
    if (result.has(logical)) return
    const binding = bind(root, logical)
    result.set(logical, binding)
    const text = readBound(root, binding).toString("utf8")
    for (const match of text.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/gu)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(logical), match[1]))
      assert.ok(!target.startsWith("../") && !target.includes("\\"))
      assert.ok(fs.existsSync(inside(root, target)), `unresolved import ${target}`)
      if (/\.(?:mjs|js|ts)$/u.test(target)) visit(target)
    }
  }
  seeds.forEach(visit)
  return [...result.values()]
}

export async function accept(root = process.cwd()) {
  root = fs.realpathSync(root)
  assert.equal(fs.existsSync(inside(root, POLICY)), false, "V26 execution policy already exists; do not regenerate")
  const registryBinding = bind(root, REGISTRY)
  const registry = boundJson(root, registryBinding)
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.activity, "failed_closed")
  const predecessorReviewTerminal = bind(root, PREDECESSOR_FAILURE)
  assert.equal(registry.terminalEvidence.sha256, predecessorReviewTerminal.sha256)
  const modelBinding = bind(root, MODEL_CPU), model = boundJson(root, modelBinding)
  readNumericCpuProof(root, modelBinding, boundJson(root, bind(root, PARENT)))
  const formalSpecification = bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md")
  const controller = boundJson(root, bind(root, CONTROLLER_CPU))
  const programBindings = Object.fromEntries(Object.entries(PROGRAMS).map(([role, logical]) =>
    [role, bind(root, logical)]))
  for (const item of controller.cpuImportClosure) {
    readBound(root, item)
    programBindings[`pythonClosure:${item.path}`] = item
  }
  for (const item of javascriptClosure(root,
    Object.values(PROGRAMS).filter(logical => logical.endsWith(".mjs"))))
    programBindings[`javascriptClosure:${item.path}`] = item
  for (const item of Object.values(model.programBindings)) {
    readBound(root, item)
    programBindings[`inheritedProof:${item.path}`] = item
  }
  const digest = sha(Buffer.from(JSON.stringify(programBindings)))
  const out = `.runtime/ai-painter/stage4-mvp256-dry-v26-v2-lifecycle-cpu/${digest}`
  assert.equal(fs.existsSync(inside(root, out)), false, "CPU acceptance identity already consumed")
  fs.mkdirSync(inside(root, out), { recursive: true })
  const logs = []
  const command = async (file, args) => {
    const result = await execFileAsync(file, args, { cwd: root, windowsHide: true, timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024, encoding: "utf8",
      env: { ...process.env, PYTHONPATH: path.join(root, "ml/ai-painter/src"),
        PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8",
        OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2" } })
    logs.push({ file: path.relative(root, file).replaceAll("\\", "/"), args,
      stdout: result.stdout, stderr: result.stderr, exitCode: 0 })
    return result
  }
  try {
    const node = await command(process.execPath, ["--test", ...TESTS])
    const nodePassed = Number(node.stdout.match(/(?:ℹ |# )pass (\d+)/u)?.[1])
    assert.ok(nodePassed > 0)
    assert.match(node.stdout, /(?:ℹ |# )fail 0/u)
    const python = inside(root, "ml/ai-painter/.venv/Scripts/python.exe")
    const py = await command(python, ["-B", "-m", "unittest", "discover",
      "-s", "ml/ai-painter/tests", "-p", "*v26_v2*.py"])
    const pyPassed = Number(py.stderr.match(/Ran (\d+) tests/u)?.[1])
    assert.ok(pyPassed > 0)
    assert.match(py.stderr, /\nOK(?:\r?\n|$)/u)
    const worker = JSON.parse((await command(python,
      ["-B", PROGRAMS.worker, "--cpu-preflight"])).stdout)
    const gpu = JSON.parse((await command(python, ["-B", PROGRAMS.gpuQualifier])).stdout)
    assert.equal(worker.gpuInitialized, false)
    assert.equal(worker.optimizerCreated, false)
    assert.equal(worker.trainingStarted, false)
    assert.equal(worker.capabilityVersion, CAPABILITY)
    assert.equal(gpu.status, "cpu_preflight_only_gpu_not_initialized")
    for (const binding of Object.values(programBindings)) readBound(root, binding)
    readBound(root, registryBinding)
    const evidence = writeExclusive(root, `${out}/report.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v26-v2-lifecycle-cpu-acceptance-v1",
      status: "v26_v2_lifecycle_cpu_acceptance_passed", capabilityVersion: CAPABILITY,
      modelCpuEvidence: modelBinding, formalSpecification,
      programBindings, passedTests: nodePassed + pyPassed, failedTests: 0,
      nodeTestsPassed: nodePassed, pythonTestsPassed: pyPassed,
      optimizerSteps: 0, gpuInitialized: false, trainingStarted: false,
      actual48RowGpuCheckCompleted: false, registryBeforeAndAfter: registryBinding,
      testEvidence: "current_successor_identity_failure_paths_real_train_zero_update_and_fresh_checkpoint_roundtrip",
      logs, recordedAtUtc: new Date().toISOString(),
    })
    const oldProposal = boundJson(root, bind(root,
      "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1.json"))
    const parentBinding = bind(root, PARENT), parent = boundJson(root, parentBinding)
    const policy = {
      schemaVersion: "stage4-mvp256-dry-v26-v2-context-isolation-execution-policy-v2",
      status: "cpu_accepted_not_gpu_qualified", capabilityVersion: CAPABILITY,
      executionVersion: "context_isolation_deterministic_aggregation_v2", cpuProposal: bind(root, PROPOSAL_PATH),
      predecessorCandidate: parentBinding, modelCpuEvidence: modelBinding, cpuAcceptance: evidence,
      formalSpecification, historicalFormalSpecification: HISTORICAL_SPECIFICATION,
      aggregationRule: AGGREGATION_RULE, predecessorReviewTerminal,
      historicalQualificationMayBeReused: false, historicalCheckpointMayInitialize: false,
      baseline: { trainingTerminal: oldProposal.predecessor.trainingTerminal,
        failedVisualAudit: oldProposal.predecessor.failedVisualAudit },
      scope: parent.scope, dataUse: parent.dataUse, checkpointSelection: parent.checkpointSelection,
      executionCeiling: structuredClone(BUDGET),
      singleChange: { operation: "zero_private_learned_terrain_patches_keep_local_facts_v1",
        trainingAndInference: true, dropoutEnabled: false, terrainUnchangedAtSameInitialWeights: true,
        stateDictionaryKeysAndParameterCountUnchanged: true },
      activation: { cpuAcceptanceCompleted: true, gpuQualificationAllowed: true, trainingAllowed: false,
        formalStage4QualificationAllowed: false, runtimePublicationAllowed: false },
    }
    validatePolicy({ root, policy, policyBinding: { path: POLICY, sha256: "0".repeat(64) },
      parent, proposal: boundJson(root, policy.cpuProposal) })
    const policyBinding = writeExclusive(root, POLICY, policy)
    return { status: policy.status, cpuAcceptance: evidence, policy: policyBinding,
      testsPassed: nodePassed + pyPassed, gpuInitialized: false, trainingStarted: false }
  } catch (error) {
    writeExclusive(root, `${out}/failure.json`, {
      status: "v26_v2_lifecycle_cpu_acceptance_failed_closed", error: String(error.stack ?? error),
      programBindings, logs, optimizerSteps: 0, gpuInitialized: false, trainingStarted: false,
      recordedAtUtc: new Date().toISOString(),
    })
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.deepEqual(process.argv.slice(2), [])
  process.stdout.write(`${JSON.stringify(await accept())}\n`)
}
