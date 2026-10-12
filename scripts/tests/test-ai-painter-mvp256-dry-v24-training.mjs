import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { BUDGET, CAPABILITY, CONTRACT, OUTPUT_PARENT, REQUIRED_PROGRAMS,
  bind, buildBasePackage, boundJson, run, validateWorkerTerminal,
  writeExclusive } from "../run-ai-painter-mvp256-dry-v24-training.mjs"

const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

function logicalWrite(root, logical, value) {
  const target = path.join(root, ...logical.split("/"))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const bytes = Buffer.isBuffer(value) ? value
    : Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  fs.writeFileSync(target, bytes, { flag: "wx" })
  return { path: logical, sha256: hash(bytes) }
}

function candidateFixture(root) {
  const trainIds = Array.from({ length: 48 }, (_, index) => `train-${index}`)
  const trainSplit = logicalWrite(root, "evidence/train.json",
    { split: "train", sampleIds: trainIds })
  const validationSplit = logicalWrite(root, "evidence/validation.json",
    { split: "validation", sampleIds: Array.from({ length: 8 }, (_, i) => `val-${i}`) })
  const datasetManifest = logicalWrite(root, "evidence/manifest.json",
    { splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 } })
  const numericReview = logicalWrite(root, "evidence/numeric.json", { status: "inactive" })
  const detailReview = logicalWrite(root, "evidence/detail.json", { status: "inactive" })
  const dryScope = logicalWrite(root, "evidence/dry-scope.json", { water: false })
  const sourcePolicy = logicalWrite(root, "evidence/source-policy.json", { version: 5 })
  const candidate = {
    schemaVersion: "stage4-mvp256-dry-v24-closed-loop-candidate-v1",
    status: "cpu_candidate_not_execution_qualified", capabilityVersion: CAPABILITY,
    frozenBindings: { dryScope, sourcePolicy, datasetManifest, trainSplit,
      validationSplit, numericReview, detailReview },
    executionCeiling: structuredClone(BUDGET),
    activation: { cpuPreflightAllowed: true, gpuQualificationAllowed: false,
      trainingAllowed: false },
  }
  const candidateBinding = logicalWrite(root, CONTRACT, candidate)
  return { candidate, candidateBinding, trainIds }
}

function programFixture(root) {
  const result = {}
  for (const [role, logical] of Object.entries(REQUIRED_PROGRAMS)) {
    const target = path.join(root, ...logical.split("/"))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const bytes = Buffer.from(`fixture:${role}:${logical}\n`)
    fs.writeFileSync(target, bytes, { flag: "wx" })
    result[role] = { path: logical, sha256: hash(bytes) }
  }
  return result
}

function fakeRegistry() {
  let value = { registryRevision: 9, activeExecution: null }
  let digest = "9".repeat(64)
  const advances = []
  return {
    advances,
    async read() { return { ok: true, registry: structuredClone(value), registrySha256: digest } },
    async advance(options) {
      assert.equal(options.expectedPreviousRegistryRevision, value.registryRevision)
      assert.equal(options.expectedPreviousRegistrySha256, digest)
      const terminal = JSON.parse(fs.readFileSync(path.join(
        options.projectRoot, ...options.terminalEvidencePath.split("/")), "utf8"))
      assert.ok(["completed", "failed_closed", "blocked_policy_boundary"]
        .includes(terminal.executionState), "advanced terminal must be terminal")
      for (const evidence of Object.values(options.latestTrainingTerminal?.evidence ?? {})) {
        assert.deepEqual(Object.keys(evidence ?? {}).sort(), ["path", "sha256"])
        assert.match(evidence.sha256, /^[0-9a-f]{64}$/u)
      }
      value = { registryRevision: value.registryRevision + 1,
        activeExecution: structuredClone(options.activeExecution),
        latestTrainingTerminal: options.latestTrainingTerminal ?? value.latestTrainingTerminal }
      digest = crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
      advances.push(structuredClone(options))
      return { ok: true, registry: structuredClone(value), registrySha256: digest }
    },
  }
}

function readyFixture(root) {
  const { candidate, candidateBinding, trainIds } = candidateFixture(root)
  const programBindings = programFixture(root)
  return { ready: { root, candidate, candidateBinding, programBindings,
    registryRevision: 9, registrySha256: "9".repeat(64) }, trainIds }
}

function gpuReport(base, baseBinding, trainIds) {
  const state = { Model: "c".repeat(64), Critic: "d".repeat(64) }
  return { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1",
    status: "current_candidate_zero_update_gpu_qualification_passed",
    capabilityVersion: CAPABILITY, runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, candidateContract: base.candidateContract,
    historicalV24QualificationReused: false, gpuInitialized: true,
    optimizerCreated: false, optimizerSteps: { generator: 0, discriminator: 0 },
    checkpointLoaded: false, checkpointWritten: false, weightsModified: false,
    generatorAutogradGradCalls: 192, discriminatorAutogradGradCalls: 48,
    trainingAllowedByThisArtifact: false, caseCount: 48,
    initialStateSha256: state, finalStateSha256: state,
    cases: trainIds.map((sampleId, trainOrdinal) => ({ passed: true,
      case: { sampleId, split: "train", trainOrdinal },
      generatorCandidate: { autogradGradCalls: 4 },
      discriminatorAutogradGradCalls: 1, optimizerCreated: false,
      optimizerSteps: { generator: 0, discriminator: 0 },
      sourceTensorsUnchanged: true, rngRestored: true,
      initialStateSha256: state, finalStateSha256: state,
      sourceTensorHashesBeforeAndAfter: { image: "e".repeat(64),
        conditions: "f".repeat(64) } })),
  }
}

function writeWorkerSuccess(root, base, ticketBinding) {
  const claim = writeExclusive(root, `${base.outputRoot}/training-ticket-consumed.json`, {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v24-ticket-consumption-v1",
    status: "consumed_no_retry", capabilityVersion: CAPABILITY,
    runId: base.runId, packageId: base.packageId,
    executionPackage: bind(root, `${base.outputRoot}/execution-package.json`),
    trainingTicket: ticketBinding, optimizerCreatedAtConsumption: false,
    gpuInitializedAtConsumption: false,
  })
  const checkpoints = [24, 36, 48].map((epoch, index) => {
    const checkpoint = logicalWrite(root,
      `${base.outputRoot}/checkpoints/epoch-${epoch}.pt`, Buffer.from(`checkpoint-${epoch}`))
    const selection = { epoch, worstApplicableObjectCorrelation: 0.2 - index * 0.01,
      meanValidationRgbMae: 0.3 + index * 0.01,
      applicableImageCounts: { object_footprints: 2, object_tree: 2,
        object_rock: 2, object_vegetation: 2 },
      rank: [0.2 - index * 0.01, -(0.3 + index * 0.01), -epoch],
      qualificationGranted: false, checkpointPromotionEligible: false }
    return { epoch, selection, checkpoint, checkpointSha256: checkpoint.sha256,
      stateSha256: { Model: `${index + 1}`.repeat(64),
        Critic: `${index + 4}`.repeat(64) },
      validation: Array.from({ length: 8 }, (_, ordinal) => ({
        sampleId: `val-${ordinal}`, split: "validation", epoch,
        fullRgbMae: 0.3, objectCorrelations: {
          object_footprints: 0.2, object_tree: 0.2,
          object_rock: 0.2, object_vegetation: 0.2 } })) }
  })
  const selected = checkpoints[0]
  logicalWrite(root, `${base.outputRoot}/progress.json`, {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v24-progress-v1",
    status: "bounded_training_progress_not_formal_qualified",
    executionState: "checkpoint_selected_review_pending",
    capabilityVersion: CAPABILITY, runId: base.runId, packageId: base.packageId,
    actualEpoch: 48, completedEpochs: 48,
    optimizerStepsGenerator: 2304, optimizerStepsDiscriminator: 2304,
    selectedCheckpoint: selected.checkpoint,
    formalStage4QualificationAllowed: false, stage4QualificationGranted: false,
    runtimePublicationAllowed: false,
  })
  return writeExclusive(root, `${base.outputRoot}/phase-terminal.json`, {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v24-worker-terminal-v1",
    status: "training_completed_review_pending", executionState: "completed",
    capabilityVersion: CAPABILITY, runId: base.runId, packageId: base.packageId,
    trainingTicketConsumption: claim,
    optimizerStepsGenerator: 2304, optimizerStepsDiscriminator: 2304,
    eligibleCheckpointEpochs: [24, 36, 48], checkpoints,
    selectedEpoch: 24, selectedRank: selected.selection.rank,
    selectedCheckpoint: selected.checkpoint,
    selectedModelStateSha256: selected.stateSha256.Model,
    selectedCriticStateSha256: selected.stateSha256.Critic,
    checkpointReloadVerified: true, checkpointPromotable: false,
    challengeContentRead: false, regressionContentRead: false,
    historicalCheckpointLoaded: false, formalStage4QualificationAllowed: false,
    stage4QualificationGranted: false, runtimePublicationAllowed: false,
  })
}

function commandFixture({ root, trainIds, failWorker = false }) {
  const calls = []
  return { calls, async run({ args }) {
    calls.push([...args])
    if (args.includes("--execute") && args.includes("--package")) {
      const packagePath = args[args.indexOf("--package") + 1]
      const baseBinding = bind(root, packagePath)
      const base = boundJson(root, baseBinding)
      logicalWrite(root, `${base.outputRoot}/zero-update-gpu-qualification.json`,
        gpuReport(base, baseBinding, trainIds))
      return { stdout: JSON.stringify({
        status: "current_candidate_zero_update_gpu_qualification_passed" }), stderr: "" }
    }
    if (args.includes("--run")) {
      if (failWorker) throw new Error("mock worker failure")
      const ticketPath = args[args.indexOf("--training-ticket") + 1]
      const ticketBinding = bind(root, ticketPath)
      const ticket = boundJson(root, ticketBinding)
      const base = boundJson(root, ticket.executionPackage)
      writeWorkerSuccess(root, base, ticketBinding)
      return { stdout: JSON.stringify({ status: "training_completed_review_pending" }), stderr: "" }
    }
    throw new Error(`unexpected mock command: ${args.join(" ")}`)
  } }
}

test("base package stays inactive and contains no descendant evidence bindings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dry-v24-base-"))
  try {
    const { ready } = readyFixture(root)
    const base = buildBasePackage({ candidate: ready.candidate,
      candidateBinding: ready.candidateBinding, runId: "dry-run-0001",
      packageId: "dry-package-0001", outputRoot: `${OUTPUT_PARENT}/dry-run-0001`,
      programBindings: ready.programBindings })
    assert.equal(base.trainingAllowed, false)
    assert.equal("gpuQualification" in base, false)
    assert.equal("managedExecution" in base, false)
    assert.equal("trainingTicket" in base, false)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("registry-facing fixtures reject executing dispatch terminals and numeric latest evidence", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dry-v24-registry-schema-"))
  try {
    const registry = fakeRegistry()
    const executing = logicalWrite(root, "evidence/executing.json",
      { executionState: "executing" })
    const common = { projectRoot: root, terminalEvidencePath: executing.path,
      expectedPreviousRegistryRevision: 9,
      expectedPreviousRegistrySha256: "9".repeat(64), activeExecution: null }
    await assert.rejects(registry.advance(common), /advanced terminal must be terminal/u)
    const terminal = logicalWrite(root, "evidence/completed.json",
      { executionState: "completed" })
    await assert.rejects(registry.advance({ ...common,
      terminalEvidencePath: terminal.path,
      latestTrainingTerminal: { evidence: { selectedEpoch: 24 } } }))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("mocked managed run builds GPU gate, ticket, worker terminal and clears active registry", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dry-v24-success-"))
  try {
    const { ready, trainIds } = readyFixture(root)
    const registry = fakeRegistry()
    const command = commandFixture({ root, trainIds })
    const result = await run({ projectRoot: root, execute: true,
      preflightReady: ready, registry, command: command.run,
      processIdentityReader: pid => `${pid}:2026-09-30T00:00:00.000Z`,
      intervalFactory: () => ({ fake: true }), intervalClear: () => {} })
    assert.equal(result.status, "training_completed_review_pending")
    assert.equal(command.calls.length, 2)
    assert.ok(command.calls[0].includes("--execute"))
    assert.ok(command.calls[1].includes("--run"))
    assert.equal(registry.advances.length, 2)
    assert.ok(registry.advances[0].activeExecution)
    assert.equal(boundJson(root, { path: registry.advances[0].terminalEvidencePath,
      sha256: hash(fs.readFileSync(path.join(root,
        ...registry.advances[0].terminalEvidencePath.split("/")))) }).executionState,
    "completed")
    assert.equal(registry.advances[1].activeExecution, null)
    assert.deepEqual(Object.keys(registry.advances[1].latestTrainingTerminal.evidence).sort(),
      ["trainingProgress", "workerTerminal"])
    assert.equal((await registry.read()).registry.activeExecution, null)
    assert.equal(fs.existsSync(path.join(root, ...`${OUTPUT_PARENT}/single-training-attempt-claim.json`.split("/"))), true)
    const latest = registry.advances[1].latestTrainingTerminal
    assert.equal(boundJson(root, { path: latest.path, sha256: latest.sha256 }).status,
      "training_completed_review_pending")
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("worker failure writes immutable failure, clears active registry and never retries", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dry-v24-failure-"))
  try {
    const { ready, trainIds } = readyFixture(root)
    const registry = fakeRegistry()
    const command = commandFixture({ root, trainIds, failWorker: true })
    const result = await run({ projectRoot: root, execute: true,
      preflightReady: ready, registry, command: command.run,
      processIdentityReader: pid => `${pid}:2026-09-30T00:00:00.000Z`,
      intervalFactory: () => ({ fake: true }), intervalClear: () => {} })
    assert.equal(result.status, "failed_closed")
    assert.equal(command.calls.length, 2, "no automatic retry")
    assert.equal(registry.advances.length, 2)
    assert.equal(registry.advances[1].activeExecution, null)
    const failure = boundJson(root, result.failure)
    assert.equal(failure.automaticRetryStarted, false)
    assert.equal(failure.optimizerStepsGenerator, 0)
    assert.equal(failure.optimizerStepsDiscriminator, 0)
    assert.equal((await registry.read()).registry.activeExecution, null)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("terminal validation rejects missing validation row and promotable checkpoint", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dry-v24-terminal-"))
  try {
    const { ready } = readyFixture(root)
    const base = buildBasePackage({ candidate: ready.candidate,
      candidateBinding: ready.candidateBinding, runId: "dry-run-0002",
      packageId: "dry-package-0002", outputRoot: `${OUTPUT_PARENT}/dry-run-0002`,
      programBindings: ready.programBindings })
    fs.mkdirSync(path.join(root, ...base.outputRoot.split("/")), { recursive: true })
    const baseBinding = writeExclusive(root, `${base.outputRoot}/execution-package.json`, base)
    const ticket = writeExclusive(root, `${base.outputRoot}/training-ticket.json`, { baseBinding })
    const terminalBinding = writeWorkerSuccess(root, base, ticket)
    const terminal = boundJson(root, terminalBinding)
    terminal.checkpoints[0].validation.pop()
    assert.throws(() => validateWorkerTerminal({ root, terminal, base, ticketBinding: ticket }))
    const terminal2 = boundJson(root, terminalBinding)
    terminal2.checkpointPromotable = true
    assert.throws(() => validateWorkerTerminal({ root, terminal: terminal2,
      base, ticketBinding: ticket }))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
