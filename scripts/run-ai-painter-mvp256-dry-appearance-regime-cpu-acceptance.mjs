// CPU acceptance and isolated package admission. Never creates a production policy.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { pathToFileURL } from "node:url"
import { PROGRAMS, NUMERIC_CPU, POLICY_PATH, collectProgramBindings, describePolicy,
  readNumericCpuProof, buildBasePackage, FROZEN_REGISTRY_INPUT } from "./run-ai-painter-mvp256-dry-appearance-regime-training.mjs"
import { CAPABILITY } from "./lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs"
import { bind, boundJson, inside, readBound, writeExclusive, processIdentity } from "./run-ai-painter-mvp256-dry-v24-training.mjs"
import { initializeCurrentExecutionRegistry, advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
const exec = promisify(execFile)
const hash = value => crypto.createHash("sha256").update(value).digest("hex")
export function directoryIdentity(directory) {
  const stat = fs.statSync(directory, { bigint: true })
  assert.equal(stat.isDirectory(), true, "directory identity requires a directory")
  assert.ok(stat.dev > 0n && stat.ino > 0n, "directory identity unavailable")
  return { device: stat.dev.toString(), fileId: stat.ino.toString() }
}
export function requireSameDirectory(actual, expected) {
  const identity = directoryIdentity(expected)
  assert.deepEqual(directoryIdentity(actual), identity, "different directory identity")
  return identity
}
export const PYTHON_TESTS = ["test_painter_stage4_appearance_regime_checkpoint_worker",
  "test_qualify_stage4_appearance_regime_gpu", "test_review_stage4_appearance_regime_cpu"]
export const NODE_TESTS = [PROGRAMS.supervisorTests, PROGRAMS.packageChainTests, PROGRAMS.reviewTests]
export async function command({ file, args, root, timeout = 180000, signal }) {
  return exec(file, args, { cwd: root, windowsHide: true, timeout, signal, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8",
      OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
      PYTHONPATH: ["ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests"]
        .map(p => path.join(root, p)).join(path.delimiter) } })
}
export function pythonTestRunnerSource() {
  return [
    "import json,sys,unittest,torch", "torch.set_num_threads(2)",
    "suite=unittest.defaultTestLoader.loadTestsFromNames(json.loads(sys.argv[1]))",
    "result=unittest.TextTestRunner(verbosity=2).run(suite)",
    "print(json.dumps(dict(testsRun=result.testsRun,failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),gpuInitialized=torch.cuda.is_initialized(),syntheticOptimizerSteps=dict(generator=0,discriminator=0))))",
    "sys.exit(0 if result.wasSuccessful() and not torch.cuda.is_initialized() else 1)"
  ].join(";")
}
export function testCounts(python, nodeOutput) {
  for (const name of ["failures", "errors", "skipped"]) assert.equal(python[name], 0)
  assert.equal(python.gpuInitialized, false)
  assert.deepEqual(python.syntheticOptimizerSteps, { generator: 0, discriminator: 0 })
  const tap = name => {
    const match = nodeOutput.match(new RegExp("^# " + name + " (\\d+)\\s*$", "mu"))
    assert.ok(match, "missing actual TAP count " + name)
    return Number(match[1])
  }
  for (const name of ["fail", "cancelled", "skipped"]) assert.equal(tap(name), 0)
  assert.equal(tap("tests"), tap("pass"))
  assert.ok(tap("pass") > 0 && python.testsRun > 0)
  return { passedTests: python.testsRun + tap("pass"), failedTests: 0, skippedTests: 0,
    pythonTests: python.testsRun, nodeTests: tap("pass") }
}
export async function initializeIsolatedRegistry(root) {
  const out = ".runtime/fixture/initial"
  const candidate = writeExclusive(root, out + "/candidate.json", {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1", status: "cpu_inactive_candidate_planned_not_implemented" })
  const terminal = writeExclusive(root, out + "/terminal.json", {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1", executionState: "completed",
    status: "bounded_candidate_planning_completed", planningRunId: "fixture-plan", nextAction: "fixture_initial_task",
    candidate, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  const capsule = writeExclusive(root, out + "/capsule.json", { schemaVersion: "ai-painter-local-task-capsule-v2", latestTerminal: terminal })
  const training = writeExclusive(root, out + "/formal/phase-terminal.json", {
    schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1", executionState: "completed",
    status: "post_decode_object_rgb_stage0_real_visual_failure", runId: "fixture-formal" })
  writeExclusive(root, out + "/formal/execution-state.json", { status: "completed", phase: "machine_review_completed", updatedAtUtc: new Date().toISOString() })
  writeExclusive(root, out + "/formal/machine-review.json", { previewCount: 6, previewPassCount: 2, previewFailCount: 4 })
  writeExclusive(root, out + "/formal/training-output/progress.json", { phase: "training_completed", epoch: 40, epochTarget: 40 })
  const initialized = await initializeCurrentExecutionRegistry({ projectRoot: root,
    currentTaskCapsulePath: capsule.path, currentTaskTerminalPath: terminal.path,
    currentCandidatePath: candidate.path, latestTrainingTerminalPath: training.path,
    archivedEvidenceNamespaces: [".runtime/fixture/archive"] })
  assert.equal(initialized.ok, true)
  return readCurrentExecutionRegistry(root)
}
export async function commitIsolatedPackage(root, baseBinding, programs) {
  const base = boundJson(root, baseBinding)
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true)
  const identity = { capabilityVersion: CAPABILITY, runId: base.runId, packageId: base.packageId,
    processId: process.pid, processStartIdentity: processIdentity(process.pid) }
  const lock = writeExclusive(root, base.outputRoot + "/execution-lock.json", {
    schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity })
  writeExclusive(root, base.outputRoot + "/heartbeat.json", {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity,
    executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 })
  const dispatched = writeExclusive(root, base.outputRoot + "/training-dispatched.json", {
    schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1", ...identity,
    status: "base_package_dispatched_gpu_gate_pending", executionState: "completed",
    executionPackage: baseBinding, trainingStarted: false, gpuQualificationStarted: false })
  const capsule = writeExclusive(root, base.outputRoot + "/begin-capsule.json", {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: base.runId,
    integrity: { status: "verified" }, evidence: [{ ...dispatched, kind: "isolated_cpu_admission", sha256Verified: true }] })
  const committed = await advanceCurrentExecutionRegistry({ projectRoot: root,
    capabilityVersion: CAPABILITY, packageId: base.packageId, taskId: base.runId,
    taskKind: "mvp256_dry_v28_bounded_training", taskGoal: "Isolated CPU package admission; no GPU or training.",
    priority: 5, queueStatus: "running", nextMachineAction: null, queuedAtUtc: new Date().toISOString(),
    runId: base.runId, lifecycleStage: "dry_single_world_256x192", executionState: "executing",
    activity: "gpu_qualification_pending", taskCapsulePath: capsule.path, terminalEvidencePath: dispatched.path,
    activeExecution: { schemaVersion: "ai-painter-current-active-execution-v1", ...identity,
      executionState: "executing", programLineage: programs, lock,
      heartbeat: { path: base.outputRoot + "/heartbeat.json", ttlSeconds: 120 } },
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256 })
  assert.equal(committed.ok, true)
  const readback = await readCurrentExecutionRegistry(root)
  assert.equal(readback.ok, true)
  assert.equal(readback.registry.runId, base.runId)
  assert.deepEqual(readback.registry.activeExecution.programLineage, programs)
  return { committed, readback, dispatched, capsule, identity }
}
export function validateIsolationParent(sourceRoot, fixtureRoot, acceptanceBinding) {
  const evidenceRoot = path.posix.dirname(NUMERIC_CPU).replace(/\/numeric$/u, "/lifecycle")
  const receiptRelative = path.posix.relative(evidenceRoot, acceptanceBinding.path)
  assert.match(receiptRelative, /^acceptance-[0-9a-f]{24}\/synthetic-tests-receipt\.json$/u,
    "receipt must be bound inside this task acceptance directory")
  assert.equal(path.basename(fixtureRoot), "isolated-project")
  const expectedParent = inside(sourceRoot, path.posix.dirname(acceptanceBinding.path))
  const evidenceIdentity = requireSameDirectory(path.dirname(path.dirname(fixtureRoot)), inside(sourceRoot, evidenceRoot))
  const parentIdentity = requireSameDirectory(path.dirname(fixtureRoot), expectedParent)
  readBound(sourceRoot, acceptanceBinding)
  return { evidenceRoot, expectedParent, parentIdentity, evidenceIdentity }
}
export async function isolatedAdmission(sourceRoot, fixtureRoot, acceptanceBinding) {
  const { evidenceRoot, expectedParent, parentIdentity, evidenceIdentity } = validateIsolationParent(sourceRoot, fixtureRoot, acceptanceBinding)
  assert.equal(fs.existsSync(fixtureRoot), false, "isolated attempt already exists")
  fs.mkdirSync(fixtureRoot)
  const cpu = boundJson(sourceRoot, acceptanceBinding)
  const policy = describePolicy({ root: sourceRoot, cpuAcceptance: acceptanceBinding, programBindings: cpu.programBindings })
  const numeric = readNumericCpuProof(sourceRoot, policy.modelCpuEvidence)
  const readonlyInputs = numeric.inputBindings.filter(binding =>
    !/\.(?:py|mjs|md)$/u.test(binding.path) && binding.path !== FROZEN_REGISTRY_INPUT.observed.path)
  const readonly = new Map(readonlyInputs.map(binding => [binding.path, binding]))
  const readonlyManifest = writeExclusive(fixtureRoot,
    "data/ai-painter/system-governance/isolated-cpu-readonly-inputs.json", {
      schemaVersion: "ai-painter-v28-isolated-readonly-inputs-v1", capabilityVersion: CAPABILITY,
      sourceRoot: sourceRoot.replaceAll("\\", "/"), inputs: readonlyInputs.map(binding => {
        readBound(sourceRoot, binding)
        return { binding, resolvedPath: fs.realpathSync(inside(sourceRoot, binding.path)).replaceAll("\\", "/") }
      }) })
  policy.cpuAdmissionReadOnlyInputs = readonlyManifest
  const copied = new Set()
  let copiedBytes = 0
  function copy(binding, force = false) {
    if (binding.path === FROZEN_REGISTRY_INPUT.observed.path) {
      assert.deepEqual(binding, FROZEN_REGISTRY_INPUT.observed)
      walk([FROZEN_REGISTRY_INPUT.transaction, FROZEN_REGISTRY_INPUT.snapshot, FROZEN_REGISTRY_INPUT.event])
      return
    }
    readBound(sourceRoot, binding)
    if (!force && readonly.has(binding.path)) {
      assert.deepEqual(binding, readonly.get(binding.path))
      return
    }
    if (copied.has(binding.path)) return
    copiedBytes += readBound(sourceRoot, binding).length
    assert.ok(copiedBytes <= 14 * 1024 * 1024, "isolated prerequisite byte budget exhausted")
    copied.add(binding.path)
    const target = inside(fixtureRoot, binding.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(inside(sourceRoot, binding.path), target)
  }
  function walk(value) {
    if (!value || typeof value !== "object") return
    if (value.path && value.sha256) copy({ path: value.path, sha256: value.sha256 })
    for (const child of Object.values(value)) walk(child)
  }
  // Copy explicit prerequisite bindings only, never enumerate dataset content.
  for (const record of [{ ...policy, cpuAdmissionReadOnlyInputs: undefined }, cpu, boundJson(sourceRoot, cpu.claim),
    numeric, boundJson(sourceRoot, policy.predecessorCandidate)]) walk(record)
  walk([FROZEN_REGISTRY_INPUT.transaction, FROZEN_REGISTRY_INPUT.snapshot, FROZEN_REGISTRY_INPUT.event])
  copy(acceptanceBinding)
  copy(policy.predecessorCandidate, true)
  const parent = boundJson(fixtureRoot, policy.predecessorCandidate)
  const policyBinding = writeExclusive(fixtureRoot, POLICY_PATH, policy)
  const outputRoot = ".runtime/ai-painter/stage4-mvp256-dry-v28-executions/isolated-cpu"
  const base = buildBasePackage({ policy, parent, policyBinding, runId: "v28-isolated-cpu-run",
    packageId: "v28-isolated-cpu-package", outputRoot, programBindings: policy.programBindings })
  const baseBinding = writeExclusive(fixtureRoot, outputRoot + "/execution-package.json", base)
  await initializeIsolatedRegistry(fixtureRoot)
  const registryProof = await commitIsolatedPackage(fixtureRoot, baseBinding, policy.programBindings)
  assert.deepEqual(requireSameDirectory(path.dirname(fixtureRoot), expectedParent), parentIdentity)
  const specification = { file: path.join(sourceRoot, "ml/ai-painter/.venv/Scripts/python.exe"),
    args: ["-B", inside(fixtureRoot, PROGRAMS.gpuQualifier), "--admission-preflight",
      "--package", baseBinding.path, "--sha256", baseBinding.sha256], root: fixtureRoot, timeout: 180000 }
  let result
  try {
    result = await command(specification)
    const admission = JSON.parse(result.stdout)
    assert.deepEqual(requireSameDirectory(path.dirname(fixtureRoot), expectedParent), parentIdentity)
    assert.deepEqual(requireSameDirectory(path.dirname(path.dirname(fixtureRoot)), inside(sourceRoot, evidenceRoot)), evidenceIdentity)
    assert.equal(admission.status, "managed_package_admission_passed_gpu_not_initialized")
    assert.equal(admission.gpuInitialized, false)
    assert.equal(admission.qualificationClaimCreated, false)
    assert.equal(admission.trainingStarted, false)
    return { specification, result, admission, baseBinding, registryRevision: registryProof.readback.registry.registryRevision,
      registrySha256: registryProof.readback.registrySha256, copiedFiles: copied.size,
      copiedBytes, readonlyInputCount: readonlyInputs.length, readonlyManifest, parentIdentity, evidenceIdentity }
  } catch (error) {
    error.isolatedAdmissionDiagnostic = { specification,
      result: result ?? { stdout: error.stdout ?? null, stderr: error.stderr ?? null } }
    throw error
  }
}
export async function accept(root = process.cwd()) {
  root = fs.realpathSync(root)
  const modelCpuEvidence = bind(root, NUMERIC_CPU)
  readNumericCpuProof(root, modelCpuEvidence)
  const programBindings = await collectProgramBindings(root)
  const formalSpecification = bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md")
  const executionGuide = bind(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const identity = hash(JSON.stringify({ programBindings, modelCpuEvidence, formalSpecification, executionGuide }))
  const evidenceRoot = path.posix.dirname(NUMERIC_CPU).replace(/\/numeric$/u, "/lifecycle")
  const out = evidenceRoot + "/acceptance-" + identity.slice(0, 24)
  const registryBefore = fs.readFileSync(inside(root, ".runtime/ai-painter/current-execution-registry/current.json"))
  const claim = writeExclusive(root, out + "/claim.json", {
    schemaVersion: "ai-painter-mvp256-dry-v28-lifecycle-cpu-claim-v1", capabilityVersion: CAPABILITY,
    programBindings, modelCpuEvidence, formalSpecification, executionGuide, attempt: 1, automaticRetries: 0 })
  const commands = []
  try {
    const python = { file: inside(root, "ml/ai-painter/.venv/Scripts/python.exe"),
      args: ["-B", "-c", pythonTestRunnerSource(), JSON.stringify(PYTHON_TESTS)], root, timeout: 180000 }
    const node = { file: process.execPath, args: ["--test", "--test-reporter=tap", ...NODE_TESTS], root, timeout: 180000 }
    const outputs = {}
    for (const [label, specification] of [["python", python], ["node", node]]) {
      commands.push(specification)
      writeExclusive(root, out + "/" + label + "-started.json", { specification, claim, processId: process.pid })
      outputs[label] = await command(specification)
    }
    const counts = testCounts(JSON.parse(outputs.python.stdout.trim()), outputs.node.stdout)
    const testOutputs = Object.fromEntries(Object.entries(outputs).map(([label, value]) =>
      [label, writeExclusive(root, out + "/" + label + "-output.json", value)]))
    const partial = { schemaVersion: "ai-painter-mvp256-dry-v28-lifecycle-cpu-acceptance-v1",
      status: "v28_lifecycle_cpu_acceptance_passed", capabilityVersion: CAPABILITY,
      modelCpuEvidence, programBindings, formalSpecification, executionGuide, claim, ...counts,
      testOutputs, syntheticOptimizerSteps: { generator: 0, discriminator: 0 },
      optimizerSteps: 0, gpuInitialized: false, trainingStarted: false,
      scope: "synthetic_cpu_tests_prerequisite_not_managed_admission" }
    const prerequisite = writeExclusive(root, out + "/synthetic-tests-receipt.json", partial)
    const alias = process.env.AI_PAINTER_TEST_EVIDENCE_ROOT
    if (alias) requireSameDirectory(alias, inside(root, evidenceRoot))
    const isolatedParent = alias ? path.join(alias, path.posix.basename(out)) : inside(root, out)
    fs.mkdirSync(isolatedParent, { recursive: true })
    const isolated = await isolatedAdmission(root, path.join(isolatedParent, "isolated-project"), prerequisite)
    assert.deepEqual(await collectProgramBindings(root), programBindings, "source changed during acceptance")
    assert.ok(fs.readFileSync(inside(root, ".runtime/ai-painter/current-execution-registry/current.json")).equals(registryBefore))
    const report = writeExclusive(root, out + "/report.json", { ...partial, isolatedAdmission: isolated,
      scope: "synthetic_cpu_tests_and_real_isolated_registry_package_admission_not_gpu_qualification",
      productionRegistryUnchanged: true, productionPolicyWritten: false, commands,
      recordedAtUtc: new Date().toISOString() })
    return { status: partial.status, report, ...counts, policyWritten: false }
  } catch (error) {
    const failure = writeExclusive(root, out + "/failure.json", { status: "lifecycle_cpu_failed_closed", claim,
      commands, error: String(error.stack ?? error), stdout: error.stdout ?? null, stderr: error.stderr ?? null,
      isolatedAdmissionDiagnostic: error.isolatedAdmissionDiagnostic ?? null,
      automaticRetries: 0, gpuInitialized: false, trainingStarted: false })
    return { status: "lifecycle_cpu_failed_closed", failure }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const mode = process.argv[2]
  assert.equal(mode, "--execute")
  const result = await accept()
  process.stdout.write(JSON.stringify(result) + "\n")
  if (result.status !== "v28_lifecycle_cpu_acceptance_passed") process.exitCode = 1
}
