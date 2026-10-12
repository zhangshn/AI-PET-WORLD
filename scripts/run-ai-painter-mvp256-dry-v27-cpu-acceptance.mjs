// CPU evidence only. The controller owns the normative policy.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { pathToFileURL } from "node:url"
import { collectProgramBindings, describePolicy, readNumericCpuProof, readExecutionPredecessorProof, NUMERIC_CPU, PROGRAMS } from "./run-ai-painter-mvp256-dry-v27-training.mjs"
import { CAPABILITY } from "./lib/ai-painter-mvp256-dry-v27-package-chain-v1.mjs"
import { bind, boundJson, inside, readBound, writeExclusive } from "./run-ai-painter-mvp256-dry-v24-training.mjs"
const executeFile = promisify(execFile)
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
export const PYTHON_TESTS = ["test_object_head_shared_hidden_priority_v27",
  "test_stage4_v27_dry_single_world_checkpoint_worker",
  "test_qualify_stage4_mvp256_dry_v27_gpu", "test_review_stage4_mvp256_dry_v27_cpu"]
export const NODE_TESTS = Object.values(PROGRAMS).filter(value => value.startsWith("scripts/tests/"))
const productionCommand = async ({ file, args, root, timeout }) => executeFile(file, args, {
  cwd: root, timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8",
    OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
    PYTHONPATH: ["ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests"]
      .map(value => path.join(root, value)).join(path.delimiter) } })
export function testCounts(python, nodeOutput) {
  assert.equal(python.gpuInitialized, false)
  assert.deepEqual(python.syntheticOptimizerSteps, { generator: 1, discriminator: 1 })
  assert.equal(python.failures, 0)
  assert.equal(python.errors, 0)
  assert.equal(python.skipped, 0)
  assert.ok(python.testsRun > 0)
  const count = name => {
    const match = nodeOutput.match(new RegExp("^# " + name + " (\\d+)\\s*$", "mu"))
    assert.ok(match, "missing actual TAP count: " + name)
    return Number(match[1])
  }
  assert.equal(count("fail"), 0)
  assert.equal(count("skipped"), 0)
  assert.equal(count("cancelled"), 0)
  assert.equal(count("tests"), count("pass"))
  assert.ok(count("pass") > 0)
  return { passedTests: python.testsRun + count("pass"), failedTests: 0, skippedTests: 0,
    pythonTests: python.testsRun, nodeTests: count("tests") }
}
export function pythonTestRunnerSource() {
  return [
      "import json,sys,unittest,torch",
      "import check_stage4_mvp256_dry_v27_v3_cpu as c",
      "torch.set_num_threads(2)",
      "steps=dict(generator=0,discriminator=0)",
      "original_step=torch.optim.AdamW.step",
      "exec('def measured_step(optimizer,*args,**kwargs):\\n phase=\\\"generator\\\" if len(optimizer.param_groups[0][\\\"params\\\"])==100 else \\\"discriminator\\\"\\n result=original_step(optimizer,*args,**kwargs)\\n steps[phase]+=1\\n return result')",
      "torch.optim.AdamW.step=measured_step",
      "suite=unittest.defaultTestLoader.loadTestsFromNames(json.loads(sys.argv[1]))",
      "result=unittest.TextTestRunner(verbosity=2).run(suite)",
      "bindings=[c.bind(p) for p in sorted(set(json.loads(sys.argv[2])))]",
      "c.verify_loaded_programs(c.data.BoundReader(c.ROOT),bindings)",
      "print(json.dumps(dict(testsRun=result.testsRun,failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),gpuInitialized=torch.cuda.is_initialized(),syntheticOptimizerSteps=steps)))",
      "sys.exit(0 if result.wasSuccessful() and not torch.cuda.is_initialized() else 1)",
    ].join(";")
}

const commandIdentity = ({ file, args, root, timeout }) => ({
  executable: file, arguments: args, cwd: root, timeoutMs: timeout })

function writeRawExclusive(root, logical, bytes) {
  const target = inside(root, logical)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const descriptor = fs.openSync(target, "wx")
  try {
    fs.writeFileSync(descriptor, bytes)
    fs.fsyncSync(descriptor)
  } finally { fs.closeSync(descriptor) }
  return { path: logical, sha256: sha(bytes) }
}

export function writeAcceptanceObservations(root, out, { registry, registryBefore,
  registryObservedAtUtc, predecessorClaims, programBindings, modelCpuEvidence,
  formalSpecification, executionGuide, plannedCommands, sourceClosureCommands }) {
  for (const item of [...Object.values(programBindings), modelCpuEvidence,
    formalSpecification, executionGuide]) readBound(root, item)
  const registrySnapshot = writeRawExclusive(root, out + "/observations/registry-before.bin", registryBefore)
  const claims = predecessorClaims.map(({ binding, bytes }, index) => {
    assert.equal(sha(bytes), binding.sha256, "predecessor observation changed")
    const snapshot = writeRawExclusive(root, out + "/observations/predecessor-claim-" + index + ".bin", bytes)
    return { binding, snapshot }
  })
  return writeExclusive(root, out + "/observations.json", {
    claim: bind(root, out + "/claim.json"),
    registryBefore: { path: registry, sha256: sha(registryBefore), snapshot: registrySnapshot,
      observedAtUtc: registryObservedAtUtc },
    predecessorClaims: claims, programBindings, modelCpuEvidence, formalSpecification, executionGuide,
    plannedCommands: Object.fromEntries(Object.entries(plannedCommands).map(([stage, specification]) => {
      const identity = commandIdentity(specification)
      return [stage, { ...identity, sha256: sha(Buffer.from(JSON.stringify(identity))) }]
    })), sourceClosureCommands, processId: process.pid, nodeVersion: process.version,
    recordedAtUtc: new Date().toISOString() })
}

export async function runRecordedStage(root, out, stage, specification,
  { command = productionCommand, claim, observations, evidence = {} } = {}) {
  assert.ok(["python", "node", "source-recheck"].includes(stage))
  const identity = commandIdentity(specification)
  const started = writeExclusive(root, out + "/" + stage + "-started.json", {
    stage, claim, observations, command: identity,
    commandSha256: sha(Buffer.from(JSON.stringify(identity))),
    state: "started", outcome: "unknown", processId: process.pid,
    recordedAtUtc: new Date().toISOString() })
  evidence[stage] = { started }
  // A hard interruption leaves only started evidence. It is neither a pass nor a failure.
  let result, commandError
  try { result = await command(specification) } catch (error) { commandError = error }
  const output = writeExclusive(root, out + "/" + stage + "-test-output.json", {
    stdout: commandError ? commandError.stdout ?? null : result.stdout,
    stderr: commandError ? commandError.stderr ?? null : result.stderr })
  evidence[stage].output = output
  const completed = writeExclusive(root, out + "/" + stage + "-completed.json", {
    stage, claim, observations, started, output, state: "completed",
    outcome: commandError ? "command_error" : "command_returned_successfully",
    exitCode: commandError ? Number.isInteger(commandError.code) ? commandError.code : null : 0,
    signal: commandError?.signal ?? null, killed: commandError?.killed ?? false,
    error: commandError ? String(commandError.stack ?? commandError) : null,
    recordedAtUtc: new Date().toISOString() })
  evidence[stage].completed = completed
  if (commandError) throw commandError
  return { result, output }
}

export async function accept(root = process.cwd(), { command = productionCommand } = {}) {
  root = fs.realpathSync(root)
  const modelCpuEvidence = bind(root, NUMERIC_CPU)
  readNumericCpuProof(root, modelCpuEvidence)
  const predecessor = readExecutionPredecessorProof(root)
  const predecessorClaimBefore = readBound(root, predecessor.predecessorExecutionClaim)
  const predecessorV2ClaimBefore = readBound(root, predecessor.predecessorV2ExecutionClaim)
  const formalSpecification = bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md")
  const executionGuide = bind(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const registry = ".runtime/ai-painter/current-execution-registry/current.json"
  const registryBefore = fs.readFileSync(inside(root, registry))
  const registryObservedAtUtc = new Date().toISOString()
  // Source discovery precedes the existing deterministic identity and exclusive claim.
  const sourceClosureCommands = []
  const programBindings = await collectProgramBindings(root, async specification => {
    const result = await command(specification)
    sourceClosureCommands.push(commandIdentity(specification))
    return result
  })
  const identity = sha(Buffer.from(JSON.stringify({ programBindings, modelCpuEvidence,
    formalSpecification, executionGuide })))
  const out = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-lifecycle-cpu/" + identity.slice(0, 32)
  fs.mkdirSync(inside(root, out), { recursive: true })
  const claim = writeExclusive(root, out + "/claim.json", {
    schemaVersion: "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-claim-v1",
    capabilityVersion: CAPABILITY, programBindings, modelCpuEvidence, ...predecessor,
    formalSpecification, executionGuide, attempt: 1, automaticRetries: 0,
    executionScope: "isolated_synthetic_tests_no_real_training_claim",
    recordedAtUtc: new Date().toISOString() })
  const commands = []
  const stageEvidence = {}
  let observations
  try {
    const runner = pythonTestRunnerSource()
    const python = { file: inside(root, "ml/ai-painter/.venv/Scripts/python.exe"),
      args: ["-B", "-c", runner, JSON.stringify(PYTHON_TESTS),
        JSON.stringify(Object.values(programBindings).map(item => item.path).filter(p => p.endsWith(".py")))],
      root, timeout: 180000 }
    const node = { file: process.execPath, args: ["--test", "--test-reporter=tap", ...NODE_TESTS],
      root, timeout: 180000 }
    observations = writeAcceptanceObservations(root, out, { registry, registryBefore, registryObservedAtUtc,
      predecessorClaims: [
        { binding: predecessor.predecessorExecutionClaim, bytes: predecessorClaimBefore },
        { binding: predecessor.predecessorV2ExecutionClaim, bytes: predecessorV2ClaimBefore }],
      programBindings, modelCpuEvidence, formalSpecification, executionGuide,
      plannedCommands: { python, node }, sourceClosureCommands })
    commands.push({ executable: "ml/ai-painter/.venv/Scripts/python.exe", arguments: python.args })
    const { result: py, output: pythonOutput } = await runRecordedStage(root, out, "python", python,
      { command, claim, observations, evidence: stageEvidence })
    commands.push({ executable: process.execPath, arguments: node.args })
    const { result: js, output: nodeOutput } = await runRecordedStage(root, out, "node", node,
      { command, claim, observations, evidence: stageEvidence })
    const counts = testCounts(JSON.parse(py.stdout.trim()), js.stdout)
    const currentBindings = await collectProgramBindings(root, async specification => {
      const { result } = await runRecordedStage(root, out, "source-recheck", specification,
        { command, claim, observations, evidence: stageEvidence })
      return result
    })
    assert.deepEqual(currentBindings, programBindings, "tested source changed")
    assert.ok(fs.readFileSync(inside(root, registry)).equals(registryBefore), "CPU acceptance changed registry")
    assert.ok(readBound(root, predecessor.predecessorExecutionClaim).equals(predecessorClaimBefore),
      "CPU acceptance changed predecessor claim")
    assert.ok(readBound(root, predecessor.predecessorV2ExecutionClaim).equals(predecessorV2ClaimBefore),
      "CPU acceptance changed V2 predecessor claim")
    assert.deepEqual(readExecutionPredecessorProof(root), predecessor)
    for (const item of [formalSpecification, executionGuide, modelCpuEvidence]) readBound(root, item)
    const report = { schemaVersion: "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-acceptance-v1",
      status: "v27_v3_lifecycle_cpu_acceptance_passed", capabilityVersion: CAPABILITY,
      modelCpuEvidence, formalSpecification, executionGuide, programBindings, claim, ...predecessor,
      ...counts, commands, observations, stageEvidence,
      optimizerSteps: 0, testOutputs: { python: pythonOutput, node: nodeOutput },
      syntheticOptimizerSteps: JSON.parse(py.stdout.trim()).syntheticOptimizerSteps,
      syntheticScope: "temporary_dirs_real_network_loss_gradients_pair_checkpoint",
      mockedLifecycleBoundary: "full_training_terminal_and_external_review_command_results",
      gpuInitialized: false, trainingStarted: false, executionRegistryWritten: false,
      checkpointPromotable: false, formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: new Date().toISOString() }
    const evidence = writeExclusive(root, out + "/report.json", report)
    return { status: report.status, evidence, ...counts, policyWritten: false }
  } catch (error) {
    const failure = writeExclusive(root, out + "/failure.json", {
      status: "v27_v3_lifecycle_cpu_acceptance_failed_closed", claim, commands, observations, stageEvidence,
      error: String(error.stack ?? error), stdout: error.stdout ?? null,
      stderr: error.stderr ?? null, automaticRetries: 0,
      trainingStarted: false, policyWritten: false, recordedAtUtc: new Date().toISOString() })
    return { status: "v27_v3_lifecycle_cpu_acceptance_failed_closed", failure }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, logical, digest] = process.argv.slice(2)
  if (mode === "--describe-policy") {
    const root = fs.realpathSync(process.cwd())
    const cpuAcceptance = { path: logical, sha256: digest }
    const report = boundJson(root, cpuAcceptance)
    assert.equal(report.status, "v27_v3_lifecycle_cpu_acceptance_passed")
    process.stdout.write(JSON.stringify(describePolicy({ root, cpuAcceptance,
      programBindings: report.programBindings }), null, 2) + "\n")
  } else if (mode === "--check") {
    const root = fs.realpathSync(process.cwd())
    readNumericCpuProof(root, bind(root, NUMERIC_CPU))
    readExecutionPredecessorProof(root)
    const programs = await collectProgramBindings(root)
    process.stdout.write(JSON.stringify({ status: "source_preflight_only", sourceCount: Object.keys(programs).length,
      trainingStarted: false, gpuInitialized: false, policyWritten: false }) + "\n")
  } else {
    assert.equal(mode, "--execute")
    assert.equal(logical, undefined)
    const result = await accept()
    process.stdout.write(JSON.stringify(result) + "\n")
    if (result.status !== "v27_v3_lifecycle_cpu_acceptance_passed") process.exitCode = 1
  }
}
