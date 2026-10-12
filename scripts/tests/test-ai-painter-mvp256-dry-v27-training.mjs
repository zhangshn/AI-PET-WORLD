import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { CAPABILITY } from "../lib/ai-painter-mvp256-dry-v27-package-chain-v1.mjs"
import { pythonTestRunnerSource, testCounts } from "../run-ai-painter-mvp256-dry-v27-cpu-acceptance.mjs"
import { buildBasePackage, run, runReviewPipeline, PROGRAMS, updateHeartbeat,
  readNumericCpuProof, NUMERIC_CPU, HISTORICAL_SPECIFICATION, collectProgramBindings,
  readPredecessorProof, PREDECESSOR_MANIFEST, PREDECESSOR_V2_MANIFEST, PREDECESSOR_V2_CLAIM,
  HISTORICAL_REGISTRY_OBSERVATION, validateHistoricalRegistryRecords,
  readHistoricalRegistryObservation, readExecutionPredecessorProof, describePolicy, validatePolicy } from
  "../run-ai-painter-mvp256-dry-v27-training.mjs"
import { bind, boundJson, writeExclusive, processIdentity } from "../run-ai-painter-mvp256-dry-v24-training.mjs"
import { initializeCurrentExecutionRegistry, advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry, CURRENT_EXECUTION_REGISTRY_PATH } from
  "../../src/server/ai-painter-current-execution-registry.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const protectedPaths = [CURRENT_EXECUTION_REGISTRY_PATH,
  ".runtime/ai-painter/stage4-mvp256-dry-v27-executions/single-training-attempt-claim.json",
  "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-execution-policy-v1.json",
  PREDECESSOR_MANIFEST.path, PREDECESSOR_V2_MANIFEST.path, PREDECESSOR_V2_CLAIM.path,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-execution-policy-v2.json",
  HISTORICAL_REGISTRY_OBSERVATION.transaction.path, HISTORICAL_REGISTRY_OBSERVATION.snapshot.path,
  HISTORICAL_REGISTRY_OBSERVATION.event.path, NUMERIC_CPU,
  ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/controller-acceptance.json",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_priority_v27.py",
  "ml/ai-painter/tests/test_object_head_shared_hidden_priority_v27.py"]
const protectedBefore = protectedPaths.map(logical => fs.readFileSync(path.join(root, logical)))
const parent = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
test("historical observation uses exact committed revision366 bytes after current registry advances", () => {
  const proof = readHistoricalRegistryObservation(root, HISTORICAL_REGISTRY_OBSERVATION.observed)
  assert.equal(proof.snapshot.sha256, proof.observed.sha256)
  assert.notEqual(bind(root, CURRENT_EXECUTION_REGISTRY_PATH).sha256, proof.snapshot.sha256)
  for (const changed of [
    { ...proof.observed, path: proof.snapshot.path },
    { ...proof.observed, sha256: bind(root, CURRENT_EXECUTION_REGISTRY_PATH).sha256 },
    { ...proof.observed, registryRevision: 368 },
  ]) assert.throws(() => readHistoricalRegistryObservation(root, changed))
})
test("historical commit validator rejects changed revision, path, transaction, event and commit semantics", () => {
  const proof = HISTORICAL_REGISTRY_OBSERVATION
  const original = [boundJson(root, proof.transaction), boundJson(root, proof.snapshot), boundJson(root, proof.event)]
  assert.equal(validateHistoricalRegistryRecords(...original), true)
  for (const alter of [
    ([transaction]) => { transaction.status = "prepared" },
    ([transaction]) => { transaction.committedAtUtc = "2026-01-01T00:00:00Z" },
    ([transaction]) => { transaction.currentStaged.path = CURRENT_EXECUTION_REGISTRY_PATH },
    ([transaction]) => { transaction.transactionId = "wrong" },
    ([, snapshot]) => { snapshot.registryRevision = 368 },
    ([, snapshot]) => { snapshot.supersedes.currentSha256 = "0".repeat(64) },
    ([,, event]) => { event.eventSequence = 365 },
    ([,, event]) => { event.transactionId = "wrong" },
    ([,, event]) => { event.currentSha256 = "0".repeat(64) },
    ([,, event]) => { event.runId = "foreign" },
  ]) {
    const records = structuredClone(original)
    alter(records)
    assert.throws(() => validateHistoricalRegistryRecords(...records))
  }
})
test("numeric proof binds real CPU report, original data and exact historical specification", () => {
  const proof = readNumericCpuProof(root, bind(root, NUMERIC_CPU), parent)
  assert.equal(proof.realCallCounts.autogradGradCallsCompleted, 8)
  assert.equal(proof.boundary.optimizerSteps, 0)
  assert.equal(HISTORICAL_SPECIFICATION.sha256,
    "aa28b9617b85df7c5f50b47f02f328eb9267f5c6a72e1c5fa7ca9e6e83d9527c")
})
test("old or fabricated CPU evidence is rejected rather than inherited", () => {
  for (const binding of [
    bind(root, ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/report.json"),
    { path: NUMERIC_CPU, sha256: "0".repeat(64) },
  ]) assert.throws(() => readNumericCpuProof(root, binding, parent))
})
const fake = name => ({ path: `fixture/${name}`, sha256: "a".repeat(64) })
function ready(directory) {
  const programs = Object.fromEntries(Object.keys(PROGRAMS).map(role => {
    const logical = `fixture/${role}`
    fs.mkdirSync(path.dirname(path.join(directory, logical)), { recursive: true })
    fs.writeFileSync(path.join(directory, logical), "synthetic source " + role)
    return [role, bind(directory, logical)]
  }))
  return { root: directory, registryRevision: 1, registrySha256: "b".repeat(64),
    parent, policyBinding: fake("policy"), policy: { predecessorCandidate: fake("parent"),
      cpuAcceptance: fake("cpu"), modelCpuEvidence: fake("model-cpu"), predecessorReviewTerminal: fake("prior-review"), programBindings: programs },
    programBindings: programs }
}
function temporary(body) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aip-v27-cpu-"))
  return Promise.resolve().then(() => body(directory)).finally(() => {
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`))
    fs.rmSync(directory, { recursive: true })
  })
}

test("V27-v3 acyclic base remains inactive with all review components bound", () => temporary(directory => {
  const value = ready(directory)
  const base = buildBasePackage({ policy: value.policy, parent,
    policyBinding: value.policyBinding, runId: "v27-fixture-run", packageId: "v27-fixture-package",
    outputRoot: ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/fixture",
    programBindings: value.programBindings })
  assert.equal(base.trainingAllowed, false)
  assert.equal("trainingTicket" in base, false)
  assert.ok(base.programBindings.reconciliation)
}))

test("duplicate V27 claim cannot launch any command", () => temporary(async directory => {
  const output = path.join(directory, ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions")
  fs.mkdirSync(output, { recursive: true })
  const file = path.join(output, "single-training-attempt-claim.json")
  fs.writeFileSync(file, '{"fixture":"consumed"}\n', { flag: "wx" })
  const before = fs.readFileSync(file)
  await assert.rejects(run({ execute: true, preflightReady: ready(directory),
    registry: { read: async () => ({ ok: true, registry: { activeExecution: null, registryRevision: 1 },
      registrySha256: "b".repeat(64) }), advance: async () => assert.fail("duplicate changed registry") },
    command: async () => assert.fail("duplicate launched command") }), { code: "EEXIST" })
  assert.deepEqual(fs.readFileSync(file), before)
}))

test("persistent heartbeat error closes GPU preflight without retry or training", () => temporary(async directory => {
  let state = { activeExecution: null, registryRevision: 1 }, callback, calls = 0
  const original = Object.assign(new Error("heartbeat publication failed"), { code: "EPERM" })
  const registry = {
    read: async () => ({ ok: true, registry: state, registrySha256: "b".repeat(64) }),
    advance: async options => { state = { ...state, ...options,
      registryRevision: state.registryRevision + 1 }; return { ok: true } },
  }
  const result = await run({ execute: true, preflightReady: ready(directory), registry,
    processIdentityReader: () => "fixture-identity",
    intervalFactory: value => { callback = value; return 1 }, intervalClear: () => {},
    heartbeatUpdater: () => { throw original },
    command: async ({ signal }) => {
      calls += 1; callback(); assert.equal(signal.reason, original)
      throw new Error("child stopped")
    } })
  assert.equal(calls, 1)
  assert.equal(result.status, "failed_closed")
  const failure = boundJson(directory, result.failure)
  assert.equal(failure.abortReason.code, "EPERM")
  assert.equal(failure.trainingStarted, false)
  assert.equal(failure.automaticRetryStarted, false)
  assert.equal(state.activeExecution, null)
}))

test("review pipeline orders CPU comparison, audit, reconciliation without a GPU command", () =>
  temporary(async directory => {
    fs.mkdirSync(path.join(directory, "run"))
    const terminalBinding = writeExclusive(directory, "run/training.json", { fixture: true })
    const compared = writeExclusive(directory, "run/comparison.json", { fixture: true })
    const audit = writeExclusive(directory, "run/audit.json", { fixture: true })
    const end = writeExclusive(directory, "run/end.json", { fixture: true })
    const calls = []
    const result = await runReviewPipeline({ root: directory, terminalBinding,
      outputRoot: "run", runId: "v27-fixture", packageId: "v27-package", programBindings: {},
      command: async ({ args }) => {
        calls.push(args)
        if (calls.length === 1) return { stdout: JSON.stringify(compared) }
        if (calls.length === 2) return { stdout: JSON.stringify({ report: audit }) }
        return { stdout: JSON.stringify({ status: "dry_single_world_review_failed_closed", terminal: end }) }
      } })
    assert.equal(result.status, "dry_single_world_review_failed_closed")
    assert.equal(calls.length, 3)
    assert.ok(calls[0][1].replaceAll("\\", "/").endsWith(PROGRAMS.cpuReview))
    assert.ok(calls[1][0].replaceAll("\\", "/").endsWith(PROGRAMS.independentAudit))
    assert.ok(calls[2][0].replaceAll("\\", "/").endsWith(PROGRAMS.reconciliation))
    assert.ok(calls.every(args => !args.includes("--run") && !args.includes("--package")))
  }))

test("review failure preserves successful training identity and terminates once", () =>
  temporary(async directory => {
    fs.mkdirSync(path.join(directory, "run"))
    const terminalBinding = writeExclusive(directory, "run/training.json", { fixture: true })
    const before = fs.readFileSync(path.join(directory, terminalBinding.path))
    let state = { activeExecution: null, runId: "v27-fixture", registryRevision: 2,
      latestTrainingTerminal: terminalBinding }, calls = 0
    const registry = {
      read: async () => ({ ok: true, registry: state, registrySha256: "c".repeat(64) }),
      advance: async options => { assert.equal("latestTrainingTerminal" in options, false)
        state = { ...state, ...options }; return { ok: true } },
    }
    const result = await runReviewPipeline({ root: directory, terminalBinding, registry,
      outputRoot: "run", runId: "v27-fixture", packageId: "v27-package", programBindings: {},
      command: async () => { calls += 1; throw new Error("CPU review failed") } })
    assert.equal(result.status, "review_execution_failed_closed")
    assert.equal(calls, 1)
    assert.equal(state.activity, result.status)
    assert.deepEqual(state.latestTrainingTerminal, terminalBinding)
    assert.deepEqual(fs.readFileSync(path.join(directory, terminalBinding.path)), before)
  }))

test("foreign heartbeat cannot be overwritten", () => temporary(directory => {
  fs.mkdirSync(path.join(directory, "run"))
  const file = path.join(directory, "run/heartbeat.json")
  fs.writeFileSync(file, '{"runId":"foreign","processId":1}\n')
  const before = fs.readFileSync(file)
  assert.throws(() => updateHeartbeat(directory, "run", { runId: "v27-owned", processId: 1 }))
  assert.deepEqual(fs.readFileSync(file), before)
}))

test("real registry advance reaches complete Python admission and 18 strict counterexamples before simulated GPU/training/review", { timeout: 180000 }, () =>
  temporary(async directory => {
    const value = await admissionReady(directory)
    // Real orchestration, registry transitions, immutable artifacts, activation validation.
    // CUDA, the 48-epoch terminal and external auditors are deliberately mocked here.
    const split = parent.frozenBindings.trainSplit
    fs.mkdirSync(path.dirname(path.join(directory, split.path)), { recursive: true })
    fs.writeFileSync(path.join(directory, split.path), fs.readFileSync(path.join(root, split.path)))
    const trainIds = boundJson(directory, split).sampleIds
    let state, phases = [], activeObserved = 0, advances = 0
    const registry = productionAdapter(directory, current => { state = current }, current => {
      advances++; state = current
      if (current.activeExecution) {
        activeObserved++
        assert.deepEqual(current.activeExecution.programLineage, value.programBindings)
        assert.equal(current.activeExecution.processId, process.pid)
        assert.equal(current.activeExecution.processStartIdentity, processIdentity(process.pid))
        const lock = boundJson(directory, current.activeExecution.lock)
        assert.equal(lock.processStartIdentity, current.activeExecution.processStartIdentity)
        const heartbeat = JSON.parse(fs.readFileSync(path.join(directory, current.activeExecution.heartbeat.path)))
        assert.equal(heartbeat.processStartIdentity, current.activeExecution.processStartIdentity)
        assert.equal(heartbeat.executionState, "executing")
      }
    })
    const command = async ({ args }) => {
      if (args.includes("--admission-preflight")) {
        phases.push("actual_python_admission")
        assert.ok(state.registryRevision > value.registryRevision)
        const options = { args, root: directory }
        const admitted = await actualAdmission(options)
        assert.equal(await admissionCounterexamples(options), 18)
        const after = await registry.read(directory)
        assert.equal(after.registry.activeExecution.runId, state.runId)
        return admitted
      }
      const logical = args[1]?.replaceAll("\\", "/") ?? ""
      if (args.includes("--package")) {
        phases.push("gpu_boundary")
        const baseBinding = { path: args[args.indexOf("--package") + 1],
          sha256: args[args.indexOf("--sha256") + 1] }
        const base = boundJson(directory, baseBinding)
        const hashes = { Model: "1".repeat(64), Critic: "2".repeat(64) }
        const gpu = { schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-zero-update-gpu-gate-v1",
          status: "current_candidate_zero_update_gpu_qualification_passed",
          capabilityVersion: base.capabilityVersion, runId: base.runId, packageId: base.packageId,
          executionPackage: baseBinding, candidateContract: base.candidateContract,
          historicalV24QualificationReused: false, trainingModeDeterminismObserved: true,
          aggregationRule: "strict_deterministic_index_add_scoped_to_object_assembly_v1",
          gpuInitialized: true, optimizerCreated: false,
          optimizerSteps: { generator: 0, discriminator: 0 }, checkpointLoaded: false,
          checkpointWritten: false, weightsModified: false,
          initialStateSha256: hashes, finalStateSha256: hashes,
          generatorAutogradGradCalls: 192, discriminatorAutogradGradCalls: 48, caseCount: 48,
          trainingAllowedByThisArtifact: false, cases: trainIds.map((sampleId, trainOrdinal) => ({
            passed: true, trainingModeRepeatBytesEqual: true, objectInstancesUnchanged: true,
            case: { sampleId, trainOrdinal, split: "train" },
            contextIsolationRule: "full_v23_terrain_context_private_global_xy_zero_v1",
            aggregationRule: "strict_deterministic_index_add_scoped_to_object_assembly_v1",
            autogradGradCalls: 4, discriminatorAutogradGradCalls: 1, optimizerCreated: false,
            optimizerSteps: { generator: 0, discriminator: 0 }, sourceTensorsUnchanged: true,
            rngRestored: true, gradFieldsCleared: true, initialStateSha256: hashes, finalStateSha256: hashes,
            sourceTensorHashesBeforeAndAfter: { image: "3".repeat(64), conditions: "4".repeat(64) } })) }
        writeExclusive(directory, base.outputRoot + "/zero-update-gpu-qualification.json", gpu)
        return { stdout: JSON.stringify({ status: gpu.status }) }
      }
      if (args.includes("--run")) {
        phases.push("training_boundary")
        const ticketBinding = { path: args[args.indexOf("--training-ticket") + 1],
          sha256: args[args.indexOf("--training-ticket-sha256") + 1] }
        const ticket = boundJson(directory, ticketBinding)
        const base = boundJson(directory, ticket.executionPackage)
        const consumption = writeExclusive(directory, ticket.consumptionClaimPath, {
          schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-ticket-consumption-v1",
          trainingTicket: ticketBinding, optimizerCreatedAtConsumption: false, gpuInitializedAtConsumption: false })
        const checkpoints = [24, 36, 48].map(epoch => {
          const target = base.outputRoot + "/checkpoint-" + epoch + ".json"
          const checkpoint = writeExclusive(directory, target, { mockedCheckpointBytes: epoch })
          const selection = { epoch, worstApplicableObjectCorrelation: .1,
            meanValidationRgbMae: .05, rank: [.1, -.05, -epoch] }
          return { epoch, checkpoint, checkpointSha256: checkpoint.sha256, selection,
            validation: Array.from({ length: 8 }, () => ({})),
            stateSha256: { Model: "1".repeat(64), Critic: "2".repeat(64) } }
        })
        const terminal = { schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-worker-terminal-v1",
          status: "training_completed_review_pending", executionState: "completed",
          capabilityVersion: base.capabilityVersion, runId: base.runId, packageId: base.packageId,
          optimizerStepsGenerator: 2304, optimizerStepsDiscriminator: 2304,
          eligibleCheckpointEpochs: [24, 36, 48], checkpoints, selectedEpoch: 24,
          selectedCheckpoint: checkpoints[0].checkpoint, selectedRank: checkpoints[0].selection.rank,
          selectedModelStateSha256: "1".repeat(64), selectedCriticStateSha256: "2".repeat(64),
          checkpointReloadVerified: true, checkpointPromotable: false, challengeContentRead: false,
          regressionContentRead: false, historicalCheckpointLoaded: false,
          formalStage4QualificationAllowed: false, stage4QualificationGranted: false,
          runtimePublicationAllowed: false, trainingTicketConsumption: consumption }
        writeExclusive(directory, base.outputRoot + "/phase-terminal.json", terminal)
        writeExclusive(directory, base.outputRoot + "/progress.json", { fixture: true })
        return { stdout: JSON.stringify({ status: terminal.status }) }
      }
      const out = state.latestTrainingTerminal.path.replace("/training-finalize.json", "")
      if (logical.endsWith(PROGRAMS.cpuReview)) {
        phases.push("cpu_review_boundary")
        return { stdout: JSON.stringify(writeExclusive(directory, out + "/comparison.json", { fixture: true })) }
      }
      if (args[0].replaceAll("\\", "/").endsWith(PROGRAMS.independentAudit)) {
        phases.push("audit_boundary")
        return { stdout: JSON.stringify({ report: writeExclusive(directory, out + "/audit.json", { fixture: true }) }) }
      }
      phases.push("decision_boundary")
      const decision = writeExclusive(directory, out + "/review-terminal.json", {
        schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-review-reconciliation-terminal-v1",
        status: "dry_single_world_review_failed_closed", executionState: "completed" })
      const capsule = writeExclusive(directory, out + "/review-capsule.json", {
        schemaVersion: "ai-painter-local-task-capsule-v1", integrity: { status: "verified" },
        evidence: [{ ...decision, kind: "fixture_review", sha256Verified: true }] })
      const current = await registry.read(directory)
      await registry.advance({ projectRoot: directory, capabilityVersion: state.capabilityVersion,
        packageId: state.packageId, runId: state.runId, taskId: state.runId + "-review",
        taskKind: "cpu_isolated_review", taskGoal: "Publish synthetic review boundary",
        priority: 5, queueStatus: "completed", nextMachineAction: null,
        queuedAtUtc: new Date().toISOString(), lifecycleStage: "dry_single_world_256x192",
        executionState: "completed", activity: "dry_single_world_review_failed_closed",
        taskCapsulePath: capsule.path, terminalEvidencePath: decision.path, activeExecution: null,
        expectedPreviousRegistryRevision: current.registry.registryRevision,
        expectedPreviousRegistrySha256: current.registrySha256 })
      return { stdout: JSON.stringify({ status: "dry_single_world_review_failed_closed",
        terminal: decision }) }
    }
    const result = await run({ execute: true, preflightReady: value, registry, command,
      intervalFactory: () => 1, intervalClear: () => {} })
    assert.equal(result.trainingStatus, "completed")
    assert.equal(result.status, "dry_single_world_review_failed_closed")
    assert.deepEqual(phases, ["actual_python_admission", "gpu_boundary", "training_boundary", "cpu_review_boundary", "audit_boundary", "decision_boundary"])
    assert.equal(state.activeExecution, null)
    assert.equal(activeObserved, 1)
    assert.equal(advances, 3)
    assert.equal(state.executionState, "completed")
    assert.equal(state.latestTrainingTerminal.runId, result.runId)
  }))
async function initializeProduction(directory) {
  const plan = ".runtime/fixture/plan", formal = ".runtime/fixture/formal"
  const candidate = writeExclusive(directory, plan + "/candidate.json", {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1",
    status: "cpu_inactive_candidate_planned_not_implemented" })
  const terminal = writeExclusive(directory, plan + "/terminal.json", {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed", status: "bounded_candidate_planning_completed",
    planningRunId: "fixture-plan", nextAction: "fixture_initial_task", candidate,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  const capsule = writeExclusive(directory, plan + "/capsule.json", {
    schemaVersion: "ai-painter-local-task-capsule-v2", latestTerminal: terminal })
  const training = writeExclusive(directory, formal + "/phase-terminal.json", {
    schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1",
    executionState: "completed", status: "post_decode_object_rgb_stage0_real_visual_failure",
    runId: "fixture-formal" })
  writeExclusive(directory, formal + "/execution-state.json", { status: "completed",
    phase: "machine_review_completed", updatedAtUtc: new Date().toISOString() })
  writeExclusive(directory, formal + "/machine-review.json", {
    previewCount: 6, previewPassCount: 2, previewFailCount: 4 })
  writeExclusive(directory, formal + "/training-output/progress.json", {
    phase: "training_completed", epoch: 40, epochTarget: 40 })
  const result = await initializeCurrentExecutionRegistry({ projectRoot: directory,
    currentTaskCapsulePath: capsule.path, currentTaskTerminalPath: terminal.path,
    currentCandidatePath: candidate.path, latestTrainingTerminalPath: training.path,
    archivedEvidenceNamespaces: [".runtime/fixture/archive"] })
  assert.equal(result.ok, true)
  return result
}
async function admissionCounterexamples(options) {
  const directory = options.root
  const pointer = CURRENT_EXECUTION_REGISTRY_PATH
  const current = JSON.parse(fs.readFileSync(path.join(directory, pointer)))
  const basePath = options.args[options.args.indexOf("--package") + 1]
  const base = JSON.parse(fs.readFileSync(path.join(directory, basePath)))
  const history = HISTORICAL_REGISTRY_OBSERVATION
  const jsonMutation = (logical, change) => {
    const value = JSON.parse(fs.readFileSync(path.join(directory, logical)))
    change(value)
    fs.writeFileSync(path.join(directory, logical), JSON.stringify(value) + "\n")
  }
  const currentMutation = change => jsonMutation(pointer, change)
  const cases = [
    ["missing historical snapshot", [history.snapshot.path], () => fs.unlinkSync(path.join(directory, history.snapshot.path))],
    ["historical snapshot SHA", [history.snapshot.path], () => fs.appendFileSync(path.join(directory, history.snapshot.path), " ")],
    ["historical revision", [history.snapshot.path], () => jsonMutation(history.snapshot.path, value => { value.registryRevision = 365 })],
    ["historical transaction identity", [history.transaction.path], () => jsonMutation(history.transaction.path, value => { value.transactionId = "wrong" })],
    ["historical commit state", [history.transaction.path], () => jsonMutation(history.transaction.path, value => { value.status = "prepared" })],
    ["historical event identity", [history.event.path], () => jsonMutation(history.event.path, value => { value.eventSequence = 365 })],
    ["missing historical transaction", [history.transaction.path], () => fs.unlinkSync(path.join(directory, history.transaction.path))],
    ["missing historical event", [history.event.path], () => fs.unlinkSync(path.join(directory, history.event.path))],
    ["V2 frozen source manifest SHA", [PREDECESSOR_V2_MANIFEST.path], () => fs.appendFileSync(path.join(directory, PREDECESSOR_V2_MANIFEST.path), " ")],
    ["current source SHA", [PROGRAMS.workerTests], () => fs.appendFileSync(path.join(directory, PROGRAMS.workerTests), "\n# tampered copied test source\n")],
    ["current outer run", [pointer], () => currentMutation(value => { value.runId = "foreign-run" })],
    ["current active package", [pointer], () => currentMutation(value => { value.activeExecution.packageId = "foreign-package" })],
    ["current lineage", [pointer], () => currentMutation(value => { value.activeExecution.programLineage.worker.sha256 = "0".repeat(64) })],
    ["current lock", [current.activeExecution.lock.path], () => jsonMutation(current.activeExecution.lock.path, value => { value.runId = "foreign-run" })],
    ["current stale heartbeat", [current.activeExecution.heartbeat.path], () => jsonMutation(current.activeExecution.heartbeat.path, value => { value.heartbeatAtUtc = "1970-01-01T00:00:00Z" })],
    ["current heartbeat identity", [current.activeExecution.heartbeat.path], () => jsonMutation(current.activeExecution.heartbeat.path, value => { value.processStartIdentity = "foreign-start" })],
    ["current PID start mismatch", [pointer, current.activeExecution.lock.path, current.activeExecution.heartbeat.path], () => {
      const wrong = current.activeExecution.processStartIdentity + ":reused"
      jsonMutation(current.activeExecution.lock.path, value => { value.processStartIdentity = wrong })
      jsonMutation(current.activeExecution.heartbeat.path, value => { value.processStartIdentity = wrong })
      currentMutation(value => {
        value.activeExecution.processStartIdentity = wrong
        value.activeExecution.lock = bind(directory, current.activeExecution.lock.path)
      })
    }],
    ["qualification claim already consumed", [base.outputRoot + "/zero-update-gpu-qualification-claim.json"], () =>
      fs.writeFileSync(path.join(directory, base.outputRoot, "zero-update-gpu-qualification-claim.json"), '{"attempt":1}\n')],
  ]
  for (const [label, paths, alter] of cases) {
    updateHeartbeat(directory, base.outputRoot, {
      capabilityVersion: base.capabilityVersion, runId: base.runId, packageId: base.packageId,
      processId: current.activeExecution.processId, processStartIdentity: current.activeExecution.processStartIdentity })
    const saved = paths.map(logical => {
      const target = path.resolve(directory, logical)
      assert.ok(target.startsWith(path.resolve(directory) + path.sep), "counterexample escaped fixture")
      return fs.existsSync(target) ? fs.readFileSync(target) : null
    })
    try {
      alter()
      await assert.rejects(actualAdmission(options), error => {
        assert.match(String(error.stderr), /v27_gpu_preflight_failed_closed/u, label)
        const failed = JSON.parse(String(error.stderr).trim())
        assert.equal(failed.gpuInitialized, false, label)
        assert.equal(failed.optimizerCreated, false, label)
        assert.equal(failed.qualificationClaimCreated, false, label)
        assert.equal(failed.trainingStarted, false, label)
        return true
      })
      assert.equal(fs.existsSync(path.join(directory, base.outputRoot, "zero-update-gpu-qualification.json")), false)
      assert.equal(fs.existsSync(path.join(directory, base.outputRoot, "training-ticket.json")), false)
      if (label !== "qualification claim already consumed")
        assert.equal(fs.existsSync(path.join(directory, base.outputRoot, "zero-update-gpu-qualification-claim.json")), false)
      console.log("# admission-counterexample " + JSON.stringify({ label, passed: true,
        gpuInitialized: false, optimizerCreated: false, qualificationClaimCreated: false }))
    } finally {
      paths.forEach((logical, index) => {
        const target = path.join(directory, logical)
        if (saved[index] === null) fs.unlinkSync(target)
        else fs.writeFileSync(target, saved[index])
      })
    }
  }
  return cases.length
}
const executeFile = promisify(execFile)
const realCommand = async ({ file, args, root: directory, timeout = 120000, signal }) =>
  executeFile(file, args, { cwd: directory, timeout, signal, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8",
      OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
      PYTHONPATH: ["ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests"]
        .map(logical => path.join(directory, logical)).join(path.delimiter) } })
    .then(result => {
      console.log("# real-command " + JSON.stringify({ file, args, root: directory, exitCode: 0, ...result }))
      return result
    }, error => {
      console.log("# real-command " + JSON.stringify({ file, args, root: directory,
        exitCode: error.code, stdout: error.stdout, stderr: error.stderr }))
      throw error
    })
function copyAdmissionEvidence(directory, bindings) {
  const v1 = boundJson(root, PREDECESSOR_MANIFEST), v2 = boundJson(root, PREDECESSOR_V2_MANIFEST)
  const accepted = JSON.parse(fs.readFileSync(path.join(root,
    ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/controller-acceptance.json")))
  const mapped = new Map()
  for (const row of [...v1.sources, ...v2.sources])
    mapped.set(row.originalPath + ":" + row.snapshot.sha256, row.snapshot)
  for (const [original, snapshot] of [
    ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", accepted.checkedFormalSpecificationSnapshot],
    ["docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md", accepted.checkedExecutionGuideSnapshot],
  ]) mapped.set(original + ":" + snapshot.sha256, snapshot)
  const copy = item => {
    const observation = HISTORICAL_REGISTRY_OBSERVATION.observed
    if (item.path === observation.path && item.sha256 === observation.sha256)
      item = HISTORICAL_REGISTRY_OBSERVATION.snapshot
    else item = mapped.get(item.path + ":" + item.sha256) ?? item
    assert.deepEqual(bind(root, item.path), { path: item.path, sha256: item.sha256 }, item.path)
    const target = path.join(directory, item.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(root, item.path), target)
  }
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === "object") {
      if (typeof value.path === "string" && typeof value.sha256 === "string") copy(value)
      Object.values(value).forEach(walk)
    }
  }
  walk(bindings)
  walk(HISTORICAL_REGISTRY_OBSERVATION)
  const proof = readExecutionPredecessorProof(root)
  walk(proof)
  const records = [
    { path: NUMERIC_CPU, sha256: bind(root, NUMERIC_CPU).sha256 },
    accepted.contract, accepted.claim,
    bind(root, ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/controller-acceptance.json"),
    v1.predecessorPolicy, v1.predecessorCpuAcceptance, v1.predecessorClaim, v1.predecessorFailure,
    v1.predecessorExecutionPackage, v2.predecessorPolicy, v2.predecessorCpuAcceptance,
    v2.predecessorFailure, PREDECESSOR_V2_CLAIM,
  ]
  for (let index = 0; index < records.length; index++) {
    const item = records[index], record = boundJson(root, item)
    copy(item); walk(record)
    if (record.claim && [v1.predecessorCpuAcceptance.path, v2.predecessorCpuAcceptance.path].includes(item.path))
      records.push(record.claim)
    if (record.executionPackage && item.path === v2.predecessorFailure.path)
      records.push(record.executionPackage)
  }
  walk(v1); walk(v2)
  walk(parent)
  return proof
}
let fixtureCpuPromise
async function measuredFixtureCpu(bindings) {
  fixtureCpuPromise ??= Promise.all([
    realCommand({ file: path.join(root, "ml/ai-painter/.venv/Scripts/python.exe"), root,
      args: ["-B", "-c", pythonTestRunnerSource(), JSON.stringify(["test_object_head_shared_hidden_priority_v27"]),
        JSON.stringify(Object.values(bindings).map(item => item.path).filter(logical => logical.endsWith(".py")))] }),
    realCommand({ file: process.execPath, root,
      args: ["--test", "--test-reporter=tap", "scripts/tests/test-ai-painter-mvp256-dry-v27-package-chain-v1.mjs"] }),
  ]).then(([python, node]) => ({ python, node, counts: testCounts(JSON.parse(python.stdout.trim()), node.stdout) }))
  return fixtureCpuPromise
}
async function admissionReady(directory) {
  const value = await productionReady(directory)
  const proof = copyAdmissionEvidence(directory, value.programBindings)
  const measured = await measuredFixtureCpu(value.programBindings)
  const formalSpecification = bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md")
  const executionGuide = bind(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  for (const item of [formalSpecification, executionGuide]) {
    fs.mkdirSync(path.dirname(path.join(directory, item.path)), { recursive: true })
    fs.copyFileSync(path.join(root, item.path), path.join(directory, item.path))
  }
  const modelCpuEvidence = bind(root, NUMERIC_CPU), out = ".runtime/fixture/current-cpu"
  const claim = writeExclusive(directory, out + "/claim.json", {
    schemaVersion: "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-claim-v1",
    capabilityVersion: CAPABILITY, programBindings: value.programBindings, modelCpuEvidence,
    formalSpecification, executionGuide, ...proof, attempt: 1, automaticRetries: 0,
    executionScope: "isolated_admission_fixture_actual_bridge_and_role_tests_not_formal_acceptance" })
  const python = writeExclusive(directory, out + "/python.json", measured.python)
  const node = writeExclusive(directory, out + "/node.json", measured.node)
  const cpuAcceptance = writeExclusive(directory, out + "/report.json", {
    schemaVersion: "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-acceptance-v1",
    status: "v27_v3_lifecycle_cpu_acceptance_passed", capabilityVersion: CAPABILITY,
    modelCpuEvidence, formalSpecification, executionGuide, programBindings: value.programBindings,
    claim, ...proof, ...measured.counts, testOutputs: { python, node }, optimizerSteps: 0,
    syntheticOptimizerSteps: JSON.parse(measured.python.stdout.trim()).syntheticOptimizerSteps,
    gpuInitialized: false, trainingStarted: false,
    executionScope: "isolated_admission_fixture_actual_bridge_and_role_tests_not_formal_acceptance" })
  value.policy = describePolicy({ root, cpuAcceptance, programBindings: value.programBindings })
  value.policyBinding = writeExclusive(directory,
    "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-execution-policy-v3.json", value.policy)
  // These are actual measured fixture tests and exact bound source/data bytes.
  // Formal acceptance of the entire lifecycle remains the controller's separate run.
  for (const item of Object.values(value.policy.baseline)) {
    fs.mkdirSync(path.dirname(path.join(directory, item.path)), { recursive: true })
    fs.copyFileSync(path.join(root, item.path), path.join(directory, item.path))
  }
  validatePolicy({ root: directory, policy: value.policy, policyBinding: value.policyBinding, parent })
  return value
}
async function actualAdmission(options) {
  assert.equal(options.args.includes("--admission-preflight"), true)
  const originalExecutable = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe")
  const result = await realCommand({ ...options, file: originalExecutable })
  const admission = JSON.parse(result.stdout)
  assert.equal(admission.gpuInitialized, false)
  assert.equal(admission.qualificationClaimCreated, false)
  assert.equal(admission.historicalRegistryRevision, 366)
  return result
}
let closurePromise
async function productionReady(directory) {
  const value = ready(directory)
  closurePromise ??= collectProgramBindings(root)
  value.programBindings = await closurePromise
  assert.equal(Object.keys(value.programBindings).length, 133)
  assert.equal(new Set(Object.values(value.programBindings).map(item => item.path)).size, 110)
  for (const item of Object.values(value.programBindings)) {
    const target = path.join(directory, item.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, fs.readFileSync(path.join(root, item.path)))
    assert.deepEqual(bind(directory, item.path), item)
  }
  value.policy.programBindings = value.programBindings
  const initialized = await initializeProduction(directory)
  value.registryRevision = initialized.registry.registryRevision
  value.registrySha256 = initialized.registrySha256
  return value
}
function productionAdapter(directory, onRead = () => {}, onAdvance = () => {}) {
  return {
    read: async location => {
      assert.equal(location, directory)
      const result = await readCurrentExecutionRegistry(location)
      assert.equal(result.ok, true, result.errorCode)
      onRead(result.registry)
      return result
    },
    advance: async options => {
      const result = await advanceCurrentExecutionRegistry(options)
      assert.equal(result.ok, true, result.errorCode)
      const readback = await readCurrentExecutionRegistry(directory)
      assert.equal(readback.ok, true, readback.errorCode)
      onAdvance(readback.registry, options)
      return result
    },
  }
}
test("illegal role or tampered source fails before claim, registry or GPU even with injected preflight", () =>
  temporary(async directory => {
    for (const alter of [
      value => { value.programBindings["dependency:scripts/a.mjs"] = fake("illegal") },
      value => { value.programBindings.worker.sha256 = "0".repeat(64) },
      value => { value.programBindings["dependency_" + "0".repeat(64)] = value.programBindings.worker },
    ]) {
      const value = ready(directory)
      alter(value)
      let calls = 0
      await assert.rejects(run({ execute: true, preflightReady: value,
        registry: { read: () => { calls++; assert.fail("invalid source reached registry") } },
        command: () => { calls++; assert.fail("invalid source reached GPU") } }))
      assert.equal(calls, 0)
      assert.equal(fs.existsSync(path.join(directory,
        ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/single-training-attempt-claim.json")), false)
    }
  }))
test("production registry rejects invalid roles, source SHA, process identity and duplicate revision", {
  timeout: 180000 }, () => temporary(async directory => {
    const value = await productionReady(directory)
    const original = await readCurrentExecutionRegistry(directory)
    const identity = { capabilityVersion: "stage4_mvp256_dry_object_head_shared_hidden_v27_v3",
      packageId: "fixture-package", runId: "fixture-run", processId: process.pid,
      processStartIdentity: processIdentity(process.pid) }
    const active = badIdentity => {
      const id = { ...identity, ...(badIdentity ? { processStartIdentity: identity.processStartIdentity + ":wrong" } : {}) }
      const suffix = badIdentity ? "wrong" : "valid"
      const lock = writeExclusive(directory, ".runtime/fixture/" + suffix + "-lock.json", {
        schemaVersion: "ai-painter-current-active-execution-lock-v1", ...id })
      const heartbeat = ".runtime/fixture/" + suffix + "-heartbeat.json"
      writeExclusive(directory, heartbeat, {
        schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...id,
        executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 })
      return { schemaVersion: "ai-painter-current-active-execution-v1", ...id,
        executionState: "executing", programLineage: value.programBindings, lock,
        heartbeat: { path: heartbeat, ttlSeconds: 120 } }
    }
    const terminal = writeExclusive(directory, ".runtime/fixture/dispatch.json", {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-training-lifecycle-v1",
      status: "base_package_dispatched_gpu_gate_pending", executionState: "completed" })
    const capsule = writeExclusive(directory, ".runtime/fixture/dispatch-capsule.json", {
      schemaVersion: "ai-painter-local-task-capsule-v1", integrity: { status: "verified" },
      evidence: [{ ...terminal, kind: "fixture_dispatch", sha256Verified: true }] })
    const options = { projectRoot: directory, capabilityVersion: identity.capabilityVersion,
      packageId: identity.packageId, runId: identity.runId, taskId: "fixture-task",
      taskKind: "cpu_isolated_registry_fixture", taskGoal: "Verify production registration",
      priority: 5, queueStatus: "running", nextMachineAction: null,
      queuedAtUtc: new Date().toISOString(), lifecycleStage: "dry_single_world_256x192",
      executionState: "executing", activity: "gpu_qualification_pending",
      taskCapsulePath: capsule.path, terminalEvidencePath: terminal.path,
      expectedPreviousRegistryRevision: original.registry.registryRevision,
      expectedPreviousRegistrySha256: original.registrySha256, activeExecution: active(false) }
    const role = Object.keys(value.programBindings).find(key => key.startsWith("dependency_"))
    const invalidRole = structuredClone(options)
    invalidRole.activeExecution.programLineage["dependency:" + value.programBindings[role].path] =
      invalidRole.activeExecution.programLineage[role]
    delete invalidRole.activeExecution.programLineage[role]
    const wrongSha = structuredClone(options)
    wrongSha.activeExecution.programLineage[role].sha256 = "0".repeat(64)
    const wrongProcess = { ...options, activeExecution: active(true) }
    const pointer = path.join(directory, CURRENT_EXECUTION_REGISTRY_PATH)
    for (const [candidate, code] of [
      [invalidRole, "registry_active_execution_program_role_invalid"],
      [wrongSha, "registry_active_execution_program_" + role + "_hash_mismatch"],
      [wrongProcess, "registry_active_execution_process_start_identity_mismatch"],
    ]) {
      const before = fs.readFileSync(pointer)
      await assert.rejects(advanceCurrentExecutionRegistry(candidate), error => {
        assert.equal(error.message, code); return true
      })
      assert.deepEqual(fs.readFileSync(pointer), before)
    }
    const registered = await advanceCurrentExecutionRegistry(options)
    assert.equal(registered.ok, true)
    const activeReadback = await readCurrentExecutionRegistry(directory)
    assert.equal(activeReadback.ok, true)
    assert.deepEqual(activeReadback.registry.activeExecution.programLineage, value.programBindings)
    const beforeDuplicate = fs.readFileSync(pointer)
    await assert.rejects(advanceCurrentExecutionRegistry(options))
    assert.deepEqual(fs.readFileSync(pointer), beforeDuplicate)
    // Close the isolated active record using the production transaction API.
    const failed = writeExclusive(directory, ".runtime/fixture/failure.json", {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-training-failure-v1",
      status: "failed_closed", executionState: "failed_closed",
      optimizerStepsGenerator: 0, optimizerStepsDiscriminator: 0, trainingStarted: false })
    const failedCapsule = writeExclusive(directory, ".runtime/fixture/failure-capsule.json", {
      schemaVersion: "ai-painter-local-task-capsule-v1", integrity: { status: "verified" },
      evidence: [{ ...failed, kind: "fixture_failure", sha256Verified: true }] })
    await advanceCurrentExecutionRegistry({ ...options, activeExecution: null,
      executionState: "failed_closed", queueStatus: "failed_closed", activity: "failed_closed",
      taskCapsulePath: failedCapsule.path, terminalEvidencePath: failed.path,
      expectedPreviousRegistryRevision: activeReadback.registry.registryRevision,
      expectedPreviousRegistrySha256: activeReadback.registrySha256 })
    const closed = await readCurrentExecutionRegistry(directory)
    assert.equal(closed.ok, true)
    assert.equal(closed.registry.activeExecution, null)
    assert.equal(closed.registry.executionState, "failed_closed")
    assert.equal(fs.existsSync(path.join(directory,
      ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/single-training-attempt-claim.json")), false)
  }))
test("real supervisor closes production registry after GPU boundary failure with G/D zero", {
  timeout: 180000 }, () => temporary(async directory => {
    const value = await admissionReady(directory)
    let calls = 0, activeObserved = false
    const registry = productionAdapter(directory, current => {
      if (current.activeExecution) activeObserved = true
    })
    const result = await run({ execute: true, preflightReady: value, registry,
      intervalFactory: () => 1, intervalClear: () => {},
      command: async options => {
        if (options.args.includes("--admission-preflight")) return actualAdmission(options)
        calls++; throw new Error("synthetic GPU boundary failure")
      } })
    assert.equal(calls, 1)
    assert.equal(activeObserved, true)
    assert.equal(result.status, "failed_closed")
    const failure = boundJson(directory, result.failure)
    assert.match(failure.error, /synthetic GPU boundary failure/u)
    assert.equal(failure.optimizerStepsGenerator, 0)
    assert.equal(failure.optimizerStepsDiscriminator, 0)
    assert.equal(failure.trainingStarted, false)
    const current = await readCurrentExecutionRegistry(directory)
    assert.equal(current.ok, true)
    assert.equal(current.registry.activeExecution, null)
    assert.equal(current.registry.executionState, "failed_closed")
    assert.deepEqual(current.registry.latestTrainingTerminal.path, result.failure.path)
  }))
test("frozen predecessor is a registration failure with G/D zero and cannot qualify current execution", () => {
  const proof = readPredecessorProof(root)
  const failure = boundJson(root, proof.predecessorRegistrationFailure)
  assert.equal(failure.trainingStarted, false)
  assert.equal(failure.optimizerStepsGenerator, 0)
  assert.equal(failure.optimizerStepsDiscriminator, 0)
  assert.equal(boundJson(root, proof.predecessorExecutionPolicy).capabilityVersion,
    "stage4_mvp256_dry_object_head_shared_hidden_v27")
  assert.throws(() => readPredecessorProof(root, { ...PREDECESSOR_MANIFEST, sha256: "0".repeat(64) }))
})
test("isolated production registry tests preserve project registry, predecessor claim, policy and archive", () => {
  protectedPaths.forEach((logical, index) =>
    assert.deepEqual(fs.readFileSync(path.join(root, logical)), protectedBefore[index], logical))
})
