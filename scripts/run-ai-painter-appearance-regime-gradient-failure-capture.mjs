import { initializeCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
export { closeDecision }
import { closeDecision } from "./reconcile-ai-painter-mvp256-dry-appearance-regime-review.mjs"
import { PROGRAMS as FROZEN_PROGRAMS } from "./run-ai-painter-mvp256-dry-appearance-regime-training.mjs"
import { decideMvp256DryReview } from "./lib/ai-painter-mvp256-dry-review-decision-v1.mjs"
import { decodeV17ResponsibilityArtifact } from "./lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"
import { auditProfessionalAestheticFromFrozenContract } from "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import sharp from "sharp"
// One managed V28 dry-world attempt. CPU, GPU, training, and review are distinct.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { bind, boundJson, inside, processIdentity, readBound, writeExclusive } from
  "./run-ai-painter-mvp256-dry-v24-training.mjs"
import { BUDGET, CAPABILITY, PLAN, validateActivationChain,
  validateBasePackage, addDependencyBindings, validateProgramBindings } from "./lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs"
import { replaceHeartbeatFile, heartbeatPublicationRule } from "./run-ai-painter-learning-capacity-experiment.mjs"
import { runOwnedWorker } from "./lib/ai-painter-owned-worker-v1.mjs"

const execFileAsync = promisify(execFile)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-execution-policy-v1.json"
export const PROPOSAL_PATH = null
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const WORKER = "ml/ai-painter/scripts/painter_stage4_appearance_regime_gradient_failure_capture_worker.py"
const GPU_QUALIFIER = "ml/ai-painter/scripts/qualify_stage4_appearance_regime_gradient_failure_capture_gpu.py"
const OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions"
const CLAIM_PATH = `${OUTPUT_PARENT}/single-training-attempt-claim.json`
const MODEL_CPU_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/numeric/report.json"
export const PROGRAMS = {
  ...Object.fromEntries(Object.entries(FROZEN_PROGRAMS).map(([role, logical]) => ["frozen_" + role, logical])),
  "supervisor": "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
  "packageChain": "scripts/lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs",
  "cpuAcceptance": "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
  "independentAudit": "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
  "reconciliation": "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
  "worker": "ml/ai-painter/scripts/painter_stage4_appearance_regime_gradient_failure_capture_worker.py",
  "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_appearance_regime_gradient_failure_capture_gpu.py",
  "cpuReview": "ml/ai-painter/scripts/review_stage4_appearance_regime_gradient_failure_capture_cpu.py",
  "supervisorTests": "scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs",
  "packageChainTests": "scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs",
  "reviewTests": "scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs",
  "workerTests": "ml/ai-painter/tests/test_painter_stage4_appearance_regime_gradient_failure_capture_worker.py",
  "gpuQualifierTests": "ml/ai-painter/tests/test_qualify_stage4_appearance_regime_gradient_failure_capture_gpu.py",
  "cpuReviewTests": "ml/ai-painter/tests/test_review_stage4_appearance_regime_gradient_failure_capture_cpu.py",
  "model": "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_bias_precision.py",
  "modelTests": "ml/ai-painter/tests/test_object_appearance_regime_bias_precision.py",
  "probe": "ml/ai-painter/scripts/painter_stage4_appearance_regime_probe.py",
  "probeTests": "ml/ai-painter/tests/test_painter_stage4_appearance_regime_probe.py",
  "priority": "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_priority_update.py",
  "priorityTests": "ml/ai-painter/tests/test_object_appearance_regime_priority_update.py",
  "precision": "ml/ai-painter/src/ai_painter/complete_world/rgb_bias_reduction_precision.py",
  "precisionTests": "ml/ai-painter/tests/test_rgb_bias_reduction_precision.py",
  "cpuChecker": "ml/ai-painter/scripts/check_stage4_appearance_regime_execution_cpu.py",
  "cpuCheckerTests": "ml/ai-painter/tests/test_check_stage4_appearance_regime_execution_cpu.py",
  "v24Worker": "ml/ai-painter/scripts/painter_stage4_v24_dry_single_world_checkpoint_worker.py",
  "capture": "ml/ai-painter/src/ai_painter/complete_world/appearance_regime_gradient_failure_capture.py",
  "captureTests": "ml/ai-painter/tests/test_appearance_regime_gradient_failure_capture.py",
  "v24Profile": "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"
}
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const now = () => new Date().toISOString()

export const SNAPSHOT_ANALYSIS = {
  schemaVersion: "appearance-regime-gradient-failure-analysis-dispatch-v1",
  mode: "closed-failure-cpu-analysis-v1",
  namespace: ".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-cpu-analyses-v1",
  algorithm: "appearance-regime-gradient-failure-snapshot-cpu-analysis-v1",
  limits: { cpuThreads: 2, wallSeconds: 120, outputBytes: 8388608, jsonBytes: 2097152,
    captureBytes: 67108864, failureReserveBytes: 65536, automaticRetries: 0 },
  formalSpecification: { path: "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    sha256: "7eb9495572ff0b908297f1773e1fb724196287d59cf86dd6a5878fb4b6ccee3a" },
}
const analysisFiles = [
  "ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py",
  "ml/ai-painter/tests/test_analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py",
  "ml/ai-painter/src/ai_painter/complete_world/appearance_regime_gradient_failure_capture.py",
  "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
  "scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs",
  "scripts/lib/ai-painter-owned-worker-v1.mjs", "scripts/lib/ai-painter-owned-worker-native-v1.mjs",
  "scripts/windows/ai-painter-owned-worker-owner.cs", "scripts/tests/test-ai-painter-owned-worker.mjs",
  "scripts/tests/test-ai-painter-owned-worker-native.mjs", "scripts/fixtures/ai-painter-owned-worker.mjs",
]
const ordered = value => Array.isArray(value) ? value.map(ordered)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value
export const snapshotCanonical = value => Buffer.from(JSON.stringify(ordered(value), null, 2) + "\n")
function diagnosticPath(root, logical) {
  const file = inside(root, logical)
  const parts = logical.split("/")
  const expected = parts[0] === ".runtime" && fs.existsSync(path.join(root, ".runtime"))
    ? path.join(fs.realpathSync(path.join(root, ".runtime")), ...parts.slice(1)) : path.join(fs.realpathSync(root), ...parts)
  let current = file, suffix = []
  while (!fs.existsSync(current)) { suffix.unshift(path.basename(current)); current = path.dirname(current) }
  assert.equal(path.join(fs.realpathSync(current), ...suffix).toLowerCase(), expected.toLowerCase(), "diagnostic redirect")
  return file
}
function diagnosticJson(root, binding) {
  assert.deepEqual(Object.keys(binding).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[a-f0-9]{64}$/u)
  const file = diagnosticPath(root, binding.path)
  assert.ok(fs.statSync(file).size <= SNAPSHOT_ANALYSIS.limits.jsonBytes, "diagnostic JSON over budget")
  return boundJson(root, binding)
}
export function snapshotProgramBindings(root) {
  const rows = analysisFiles.map(logical => { diagnosticPath(root, logical); return bind(root, logical) })
  assert.equal(rows[0].sha256, "61260d64d0b518e747c6924edccc79c575d90f2bca5b30f10a75fc6c20a8de3d")
  assert.equal(rows[1].sha256, "65e9468971eb56f937ad9f8a58de991447e2151759c9eec3cac78fd770eae89d")
  assert.equal(rows[2].sha256, "20dfbcd0fe87b26c7b56043dd792624d82d6ab2840cad90b13525acc9b933eef")
  return rows
}
function atomicDiagnostic(root, directory, name, value, { failure = false, maximum = 8388608 } = {}) {
  const raw = snapshotCanonical(value), logical = directory + "/" + name
  assert.ok(raw.length <= (failure && maximum === 8388608 ? 16384 : 2097152), "diagnostic JSON budget")
  const available = maximum - (failure ? 0 : 65536)
  assert.ok(outputBytes(root, directory) + raw.length * 2 <= available, "diagnostic aggregate budget")
  const target = diagnosticPath(root, logical)
  assert.equal(fs.existsSync(target), false, "immutable diagnostic exists")
  const pending = target + ".pending-" + crypto.randomBytes(16).toString("hex")
  const fd = fs.openSync(pending, "wx")
  try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  assert.ok(fs.readFileSync(pending).equals(raw))
  assert.ok(outputBytes(root, directory) + raw.length <= available, "diagnostic commit budget")
  fs.linkSync(pending, target)
  return { path: logical, sha256: sha(raw) }
}
function closedOwnedReceipt(receipt, exitCode) {
  return receipt?.cleanupConfirmed === true && receipt.liveOwnerCleanupConfirmed === true
    && receipt.ownerClosed === true && receipt.proof?.assignedBeforeResume === true
    && receipt.proof.activeProcessesAfterCleanup === 0 && receipt.proof.exitCode === exitCode
    && Number.isSafeInteger(receipt.ownerIdentity?.pid) && receipt.ownerIdentity.pid === receipt.proof.ownerPid
    && typeof receipt.proof.bindingBase64 === "string" && receipt.proof.bindingBase64.length > 0
}

export async function dispatchClosedFailureAnalysis({ root, failureBinding, runId, packageId,
  registry = productionRegistry, trainingError, signal, parentDeadlineUnixMs,
  ownedAnalysis = runOwnedWorker }) {
  let directory, failure, programs, request
  const unavailable = reason => ({ status: "dispatch_unavailable_original_training_failed", reason,
    sourceFailure: failureBinding, counts: failure ? { generator: failure.optimizerStepsGenerator,
      discriminator: failure.optimizerStepsDiscriminator } : null, trainingRetryStarted: false,
    rootCause: "unknown", qualificationGranted: false })
  try {
    failure = diagnosticJson(root, failureBinding)
    assert.equal(failureBinding.path, `${failure.executionPackage.path.slice(0, -"execution-package.json".length)}failure.json`)
    assert.equal(failure.runId, runId); assert.equal(failure.packageId, packageId)
    assert.equal(failure.executionState, "failed_closed")
    const base = diagnosticJson(root, failure.executionPackage)
    const policy = diagnosticJson(root, base.candidateContract)
    programs = []
    let reason = null
    if (!policy.failureSnapshotAnalysis) reason = "policy_production_mode_not_adopted"
    else {
      programs = snapshotProgramBindings(root)
      const adoption = { ...SNAPSHOT_ANALYSIS, programBindings: programs }
      assert.deepEqual(policy.failureSnapshotAnalysis, adoption)
      assert.deepEqual(policy.formalSpecification, SNAPSHOT_ANALYSIS.formalSpecification)
      readBound(root, SNAPSHOT_ANALYSIS.formalSpecification)
      const current = await registry.read(root)
      if (!current.ok || current.registry.activeExecution !== null || current.registry.runId !== runId
        || current.registry.latestTrainingTerminal?.sha256 !== failureBinding.sha256) reason = "same_run_registry_not_closed"
      else if (signal?.aborted) reason = "training_cancelled"
      else if (!Number.isSafeInteger(trainingError?.code) || trainingError.code !== 1
        || trainingError.killed || trainingError.signal || !closedOwnedReceipt(trainingError.ownedReceipt, 1)) reason = "normal_training_cleanup_unverified"
      else if (!Number.isSafeInteger(parentDeadlineUnixMs) || parentDeadlineUnixMs - Date.now() < 1000) reason = "parent_deadline_unavailable"
      else if (failure.status !== "experiment_failed_closed" || failure.capabilityVersion !== CAPABILITY
        || failure.executionVersion !== "appearance_regime_gradient_failure_capture_v1"
        || !failure.workerTerminal || failure.failureCapture?.captureReceipt?.status !== "failure_evidence_captured"
        || !/^actual total gradient identity differs at parameter (?:[0-9]|[1-9][0-9]|10[0-6])$/u.test(failure.failureCapture.originalError)) reason = "capture_incomplete_or_unsupported"
      if (!reason && ownedAnalysis === runOwnedWorker) reason = "production_owned_resource_budget_unverified"
      if (!reason) {
        assert.equal(base.runId, runId); assert.equal(base.packageId, packageId)
        assert.equal(base.capabilityVersion, CAPABILITY)
        assert.equal(base.outputRoot + "/failure.json", failureBinding.path)
        const worker = diagnosticJson(root, failure.workerTerminal)
        assert.equal(failure.workerTerminal.path, base.outputRoot + "/phase-terminal.json")
        assert.equal(worker.runId, runId); assert.equal(worker.packageId, packageId)
        assert.deepEqual(worker.executionPackage, failure.executionPackage)
        assert.deepEqual(worker.failureCapture, failure.failureCapture)
        const receipt = failure.failureCapture.captureReceipt
        assert.equal(receipt.executionQualified, false)
        assert.deepEqual(receipt.counts, { generator: failure.optimizerStepsGenerator, discriminator: failure.optimizerStepsDiscriminator })
        for (const value of Object.values(receipt.counts)) assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= 2304)
        for (const [role, filename] of [["manifest", "gradient-failure-manifest.json"], ["primary", "gradient-failure-primary.json"], ["tensors", "gradient-failure-tensors.pt"]]) {
          const artifact = receipt.artifacts[role], logical = base.outputRoot + "/failure-capture/" + filename
          const file = diagnosticPath(root, logical)
          assert.ok([file, fs.realpathSync(file)].includes(path.resolve(artifact.path)), "capture outside source Run")
          assert.equal(fs.statSync(file).size, artifact.bytes)
          assert.ok(artifact.bytes <= (role === "tensors" ? 67108864 : 2097152))
          if (role !== "tensors") {
            const item = diagnosticJson(root, { path: logical, sha256: artifact.sha256 })
            assert.deepEqual(item.counts, receipt.counts); assert.deepEqual(item.originalError, receipt.originalError)
            assert.deepEqual(item.location, receipt.location)
            if (role === "manifest") {
              assert.equal(item.status, "failure_evidence_captured")
              assert.deepEqual(item.executionBinding, failure.executionPackage)
            }
          }
        }
      }
    }
    request = { schemaVersion: SNAPSHOT_ANALYSIS.schemaVersion, mode: SNAPSHOT_ANALYSIS.mode,
      sourceFailure: failureBinding, sourceExecutionPackage: failure.executionPackage,
      sourceCapture: failure.failureCapture?.captureReceipt?.artifacts ?? null,
      runId, packageId, capabilityVersion: CAPABILITY, executionVersion: "appearance_regime_gradient_failure_capture_v1",
      programBindings: programs, formalSpecification: SNAPSHOT_ANALYSIS.formalSpecification,
      algorithm: SNAPSHOT_ANALYSIS.algorithm, limits: SNAPSHOT_ANALYSIS.limits }
    const identity = sha(snapshotCanonical(request))
    directory = SNAPSHOT_ANALYSIS.namespace + "/" + identity
    const target = diagnosticPath(root, directory)
    const terminalLogical = directory + "/analysis-terminal.json"
    const readTerminal = () => {
      const terminal = bind(root, terminalLogical), report = diagnosticJson(root, terminal)
      assert.deepEqual(report.dispatchSummary?.sourceFailure, failureBinding)
      assert.deepEqual(report.dispatchSummary.counts, { generator: failure.optimizerStepsGenerator, discriminator: failure.optimizerStepsDiscriminator })
      if (report.status === "snapshot_analysis_complete_diagnostic_only") {
        const intent = diagnosticJson(root, bind(root, directory + "/analysis-commit-intent.json"))
        assert.equal(intent.terminal.sha256, terminal.sha256)
        assert.equal(path.resolve(intent.terminal.path), diagnosticPath(root, terminalLogical))
        assert.equal(intent.identity, report.identity)
        assert.deepEqual(report.programBindings, programs)
        assert.deepEqual(report.terminalBinding, failureBinding)
        assert.equal(report.dispatchSummary.status, "diagnostic_complete_original_training_failed")
      } else assert.ok(["diagnostic_failed_closed_original_training_failed", "dispatch_unavailable_original_training_failed"].includes(report.dispatchSummary.status))
      return { ...report.dispatchSummary, terminal, metadataReadbackOnly: true }
    }
    if (fs.existsSync(target)) {
      assert.ok(outputBytes(root, directory) <= 8388608)
      if (fs.existsSync(diagnosticPath(root, terminalLogical))) return readTerminal()
      return unavailable("incomplete_or_unknown_identity_no_retry")
    }
    fs.mkdirSync(target, { recursive: true })
    if (reason) {
      const summary = unavailable(reason)
      const terminal = atomicDiagnostic(root, directory, "analysis-terminal.json", {
        status: "snapshot_analysis_dispatch_unavailable", dispatchSummary: summary,
        originalTrainingError: failure.failureCapture?.originalError ?? failure.originalPairError,
      }, { failure: true })
      return { ...summary, terminal }
    }
    request.dispatchIdentity = identity; request.outputRoot = directory
    const dispatch = atomicDiagnostic(root, directory, "dispatch-request.json", request)
    const deadline = Math.min(parentDeadlineUnixMs, Date.now() + 120000)
    let result, primary
    try {
      result = await ownedAnalysis(inside(root, PYTHON), ["-B", inside(root, analysisFiles[0]),
        "--dispatch", dispatch.path, "--dispatch-sha256", dispatch.sha256,
        "--parent-deadline-unix-ms", String(deadline)], { cwd: root,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", CUDA_VISIBLE_DEVICES: "",
          OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2", OPENBLAS_NUM_THREADS: "2" },
        timeout: Math.max(1, deadline - Date.now()), maxBuffer: 8388608,
        abortReason: () => signal?.aborted ? String(signal.reason ?? "cancelled") : null })
      assert.ok(closedOwnedReceipt(result.ownedReceipt, 0), "analysis owned cleanup unverified")
    } catch (error) { primary = error }
    const liveReceipt = result?.ownedReceipt ?? primary?.ownedReceipt
    if (!closedOwnedReceipt(liveReceipt, liveReceipt?.proof?.exitCode)
      || ![0,1].includes(liveReceipt?.proof?.exitCode)) {
      // An unknown live tree may still write here. Never race it with a fallback
      // terminal or call an immutable report proof of successful cleanup.
      return { ...unavailable("analysis_cleanup_unknown"), cleanupConfirmed: false,
        observedTerminal: fs.existsSync(diagnosticPath(root, terminalLogical)) ? bind(root, terminalLogical) : null }
    }
    const ownedFiles = [liveReceipt.guard?.startedEvidence, liveReceipt.guard?.terminalEvidence,
      liveReceipt.observationPath].filter(Boolean)
    const ownedEvidence = []
    for (const absolute of ownedFiles) {
      assert.ok(typeof absolute === "string" && path.isAbsolute(absolute))
      assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), "owned receipt evidence missing")
      assert.ok(fs.statSync(absolute).size <= 65536, "owned receipt metadata budget")
      ownedEvidence.push({ path: absolute, sha256: sha(fs.readFileSync(absolute)), bytes: fs.statSync(absolute).size })
    }
    const resourceAccounting = { diagnosticBytes: outputBytes(root, directory), ownedReceiptEvidence: ownedEvidence,
      ownedReceiptBytes: ownedEvidence.reduce((total,item)=>total+item.bytes,0),
      streamLimits: { eachStreamBytes:8388608, sharedStreamBudget:false },
      completeSharedResourceClosureVerified: false,
      gap: "Existing helper native-build and guard evidence uses its separate existing quota; aggregate per-stream transport/native-build accounting has not been adopted as one8MiB shared cap." }
    if (fs.existsSync(diagnosticPath(root, terminalLogical))) {
      const summary = readTerminal()
      return { ...summary, ownedReceipt: result?.ownedReceipt ?? primary?.ownedReceipt ?? null,
        transportError: primary ? String(primary.message) : null, resourceAccounting }
    }
    const summary = { ...unavailable("analysis_failed_without_committed_terminal"),
      status: "diagnostic_failed_closed_original_training_failed", error: String(primary?.message ?? "terminal absent").slice(0, 4096) }
    const terminal = atomicDiagnostic(root, directory, "analysis-terminal.json", {
      status: "snapshot_analysis_failed_closed", dispatchSummary: summary,
      originalTrainingError: failure.failureCapture.originalError,
      ownedReceipt: primary?.ownedReceipt ?? result?.ownedReceipt ?? null,
    }, { failure: true })
    return { ...summary, terminal, resourceAccounting }
  } catch (error) {
    return { ...unavailable("analysis_dispatch_boundary_failed"), error: String(error.message).slice(0,4096) }
  }
}


export const CAPTURE_CPU = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/numeric/source-freeze.json"
export const NUMERIC_CPU = MODEL_CPU_PATH
export const AGGREGATION_RULE = "strict_deterministic_index_add_scoped_to_object_assembly_v1"
export const SINGLE_CHANGE = { operation: "four_independent_rgb_heads_zero_source_bound_season_branch_fp64_bias_device_v1",
  trainingAndInference: true, dropoutEnabled: false, fullV23ContextPreserved: true,
  groupCount: 5, modelParameterTensorCount: 107, modelParameterElementCount: 2240671,
  objectParameterTensorCount: 16, objectParameterElementCount: 4876,
  seasonalParameterTensorCount: 1, seasonalParameterElementCount: 1152 }
export const ARCHITECTURE = "fresh_v23_four_heads_zero_season_branch_rgb_bias_fp64_device_v1"
export function validateNumericCpuReport(report) {
  assert.equal(report.capabilityVersion, CAPABILITY)
  assert.equal(report.architecture, ARCHITECTURE)
  assert.equal(report.status, "cpu_execution_bridge_checked_not_gpu_qualified")
  assert.equal(report.synthetic, false)
  assert.deepEqual(report.callCounts, { modelForwardsAttempted: 4, modelForwardsCompleted: 4,
    generatorGradCallsAttempted: 16, generatorGradCallsCompleted: 16,
    discriminatorGradCallsAttempted: 4, discriminatorGradCallsCompleted: 4 })
  assert.equal(report.optimizerSteps, 0)
  assert.equal(report.gpuInitialized, false)
  assert.equal(report.terminalAssertionsCompleted, true)
  assert.deepEqual(report.initialState, report.finalState)
  assert.equal(report.actualGraph?.tensors, 107)
  assert.equal(report.actualGraph.elements, 2240671)
  assert.equal(report.actualGraph.seasonalElements, 1152)
  assert.equal(report.actualGraph.parameters?.length, 107)
  assert.equal(report.parameterInitialization?.originalParameterDigest, report.parameterInitialization?.successorParameterDigest)
  assert.match(report.parameterInitialization.successorParameterDigest, /^[0-9a-f]{64}$/u)
  assert.ok(report.inputBindings?.length > 0)
  return report
}
export const FROZEN_REGISTRY_INPUT = {
  "observed": {
    "path": ".runtime/ai-painter/current-execution-registry/current.json",
    "sha256": "1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa"
  },
  "transaction": {
    "path": ".runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/transaction.json",
    "sha256": "5b97e75842d4d56f0d60c25b2eeb95a54891a0f0058556d187323c1522fa1482"
  },
  "snapshot": {
    "path": ".runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/current.staged.json",
    "sha256": "1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa"
  },
  "event": {
    "path": ".runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/registry-event.staged.jsonl",
    "sha256": "5eff2a54dcab0893f299c57dbce24bebbe652bcbf8447a775ed048754fab0983"
  },
  "transactionId": "current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c",
  "registryRevision": 371
}
export const HISTORICAL_DOCUMENTS = {"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/formal-at-integration-1.44.bin", "sha256": "6dcb84f2503445eca030958a469794dcb4823e83a3591de0b5d8a75ef5cf078c"}, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/execution-guide-at-integration.bin", "sha256": "d3342653a14a95c18b81b228e07cdd666e7e27eb72d00c02e53e838a48740c5d"}}
export function readNumericInput(root, binding) {
  const historicalDocument = HISTORICAL_DOCUMENTS[binding.path]
  if (historicalDocument) { assert.equal(binding.sha256, historicalDocument.sha256); return readBound(root, historicalDocument) }
  if (binding.path !== FROZEN_REGISTRY_INPUT.observed.path) return readBound(root, binding)
  assert.deepEqual(binding, FROZEN_REGISTRY_INPUT.observed)
  const frozen = FROZEN_REGISTRY_INPUT
  const transaction = boundJson(root, frozen.transaction)
  const snapshot = boundJson(root, frozen.snapshot)
  const event = boundJson(root, frozen.event)
  assert.equal(transaction.status, "committed")
  assert.deepEqual(transaction.currentStaged, frozen.snapshot)
  assert.deepEqual(transaction.registryEventStaged, frozen.event)
  assert.equal(transaction.currentSha256, frozen.observed.sha256)
  assert.equal(event.currentSha256, frozen.observed.sha256)
  for (const record of [transaction, snapshot, event]) {
    assert.equal(record.transactionId, frozen.transactionId)
    assert.equal(record.registryRevision, frozen.registryRevision)
    assert.equal(record.eventSequence, frozen.registryRevision)
  }
  assert.equal(snapshot.activeExecution, null)
  assert.ok(Date.parse(transaction.committedAtUtc) >= Date.parse(transaction.recordedAtUtc))
  return readBound(root, frozen.snapshot)
}

export function readCaptureCpuProof(root, binding, programs) {
  assert.equal(binding.path, CAPTURE_CPU)
  const proof = boundJson(root, binding)
  assert.equal(proof.task, "T-Q4-37-N")
  assert.equal(proof.status, "source_frozen_for_independent_controller_review")
  assert.equal(proof.syntheticTests.passed, proof.syntheticTests.distinctTests)
  assert.ok(proof.syntheticTests.passed > 0)
  assert.equal(proof.syntheticTests.skipped, 0)
  for (const [role, source] of ["capture", "captureTests"].map(role=>[role,proof.sources.find(x=>x.path===programs[role].path)])) {
    assert.ok(source); assert.deepEqual({path:source.path,sha256:source.sha256}, programs[role]); readBound(root,programs[role])
  }
  const log = proof.syntheticTests.logs.at(-1)
  const logical = path.relative(root, log.path).replaceAll("\\", "/")
  const raw = readBound(root, {path:logical,sha256:log.sha256}).toString("utf8")
  assert.match(raw, new RegExp("Ran " + proof.syntheticTests.passed + " tests"))
  assert.match(raw, /^OK\s*$/mu)
  return proof
}

export function readNumericCpuProof(root, binding) {
  assert.equal(binding.path, NUMERIC_CPU)
  const report = validateNumericCpuReport(boundJson(root, binding))
  const claim = boundJson(root, bind(root, path.posix.dirname(NUMERIC_CPU) + "/claim.json"))
  assert.equal(claim.task, "T-Q4-36-N")
  assert.equal(claim.synthetic, false)
  assert.equal(claim.attempt, 1)
  assert.equal(claim.automaticRetries, 0)
  assert.deepEqual(claim.binding, report.binding)
  readBound(root, report.binding)
  for (const item of report.inputBindings) readNumericInput(root, item)
  return report
}

// Reachable literal local JS imports only. External package imports stay external.
// Dynamic computed imports are not represented as an exhaustive static proof.
export function javascriptDependencyClosure(root, seeds) {
  const pending = [...seeds], seen = new Set()
  while (pending.length) {
    const logical = pending.pop()
    if (seen.has(logical)) continue
    const source = fs.readFileSync(inside(root, logical), "utf8")
    seen.add(logical)
    const parsed = ts.createSourceFile(logical, source, ts.ScriptTarget.Latest, true)
    assert.equal(parsed.parseDiagnostics.length, 0, "invalid source: " + logical)
    const specifiers = []
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        specifiers.push(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]))
        specifiers.push(node.arguments[0].text)
      ts.forEachChild(node, visit)
    }
    visit(parsed)
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) continue
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(logical), specifier))
      const candidates = [next, next + ".mjs", next + ".js", next + ".ts", next + "/index.mjs"]
      const child = candidates.find(candidate => fs.existsSync(inside(root, candidate))
        && fs.statSync(inside(root, candidate)).isFile())
      assert.ok(child, "unresolved local import: " + logical + " -> " + specifier)
      pending.push(child)
    }
  }
  return [...seen].sort()
}

export async function collectProgramBindings(root, command = productionCommand) {
  const pythonSeeds = Object.values(PROGRAMS).filter(value => value.endsWith(".py"))
  const script = "import json,sys; import check_stage4_mvp256_dry_v27_v3_cpu as c; print(json.dumps(c.local_dependency_closure(json.loads(sys.argv[1]))))"
  const result = await command({ file: inside(root, PYTHON),
    args: ["-B", "-c", script, JSON.stringify(pythonSeeds)], root, timeout: 120000 })
  const python = JSON.parse(result.stdout)
  const javascript = javascriptDependencyClosure(root, Object.values(PROGRAMS).filter(value => value.endsWith(".mjs")))
  const direct = Object.fromEntries(Object.entries(PROGRAMS).map(([role, logical]) => [role, bind(root, logical)]))
  return addDependencyBindings(direct, [...python, ...javascript], logical => bind(root, logical))
}

export function validateProgramSources(root, bindings) {
  validateProgramBindings(bindings)
  for (const item of Object.values(bindings)) readBound(root, item)
  return true
}


export function describePolicy({ root, cpuAcceptance, programBindings }) {
  const predecessorCandidate = bind(root, "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")
  const parent = boundJson(root, predecessorCandidate)
  return { schemaVersion: "stage4-mvp256-dry-appearance-regime-gradient-failure-capture-execution-policy-v1",
    status: "cpu_accepted_not_gpu_qualified", capabilityVersion: CAPABILITY,
    executionVersion: "appearance_regime_gradient_failure_capture_v1", predecessorCandidate,
    modelCpuEvidence: bind(root, MODEL_CPU_PATH),
    modelCpuClaim: bind(root, path.posix.dirname(MODEL_CPU_PATH) + "/claim.json"), cpuAcceptance, programBindings,
    formalSpecification: bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),
    executionGuide: bind(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
    aggregationRule: AGGREGATION_RULE, historicalQualificationMayBeReused: false,
    historicalCheckpointMayInitialize: false, executionCeiling: structuredClone(BUDGET),
    scope: parent.scope, dataUse: parent.dataUse, checkpointSelection: parent.checkpointSelection,
    singleChange: structuredClone(SINGLE_CHANGE),
    numericSuccessGate: { maximumValidationRgbMae: 0.06140733743086457,
      minimumExclusiveWorstApplicableObjectCorrelation: -0.08459185063838959,
      preselectedSampleId: parent.scope.subjectSampleId, allOriginalReviewsRequired: true },
    baseline: {
      trainingTerminal: { path: ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/training-finalize.json",
        sha256: "2f2b7a3ff091f54e511e7bad9ab2a53fabbe2fc626f5bd91e49db7c1ade33a26" },
      failedVisualAudit: { path: ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/dry-review/independent-audit.json",
        sha256: "c3c4db62221412523349ea57d8e925e13d49039903e6adffd2d4e10ce2556ae8" } },
    captureCpuEvidence: bind(root, CAPTURE_CPU),
    captureProgram: programBindings.capture,
    failureCapture: { maxCaptureBytes: 67108864, maxCombinedBytes: 134217728, terminalReserveBytes: 1048576, callAfterOriginalPairFailureOnly: true },
    historicalDocuments: structuredClone(HISTORICAL_DOCUMENTS),
    activation: { cpuAcceptanceCompleted: true, gpuQualificationAllowed: true,
      trainingAllowed: false, formalStage4QualificationAllowed: false, runtimePublicationAllowed: false } }
}

export function validatePolicy({ root, policy, policyBinding, parent }) {
  assert.equal(policyBinding.path, POLICY_PATH)
  validateProgramSources(root, policy.programBindings)
  assert.deepEqual(policy, describePolicy({ root, cpuAcceptance: policy.cpuAcceptance,
    programBindings: policy.programBindings }))
  readCaptureCpuProof(root, policy.captureCpuEvidence, policy.programBindings)
  readNumericCpuProof(root, policy.modelCpuEvidence)
  const cpu = boundJson(root, policy.cpuAcceptance)
  assert.equal(cpu.status, "v28_lifecycle_cpu_acceptance_passed")
  assert.equal(cpu.schemaVersion, "ai-painter-mvp256-dry-v28-lifecycle-cpu-acceptance-v1")
  assert.equal(cpu.scope, "synthetic_cpu_tests_and_real_isolated_registry_package_admission_not_gpu_qualification")
  assert.equal(cpu.isolatedAdmission?.admission?.status, "managed_package_admission_passed_gpu_not_initialized")
  assert.equal(cpu.isolatedAdmission.admission.capabilityVersion, CAPABILITY)
  assert.equal(cpu.isolatedAdmission.admission.gpuInitialized, false)
  assert.equal(cpu.isolatedAdmission.admission.qualificationClaimCreated, false)
  assert.equal(cpu.productionRegistryUnchanged, true)
  assert.equal(cpu.productionPolicyWritten, false)
  assert.equal(cpu.capabilityVersion, CAPABILITY)
  assert.deepEqual(cpu.modelCpuEvidence, policy.modelCpuEvidence)
  assert.deepEqual(cpu.formalSpecification, policy.formalSpecification)
  assert.deepEqual(cpu.executionGuide, policy.executionGuide)
  assert.equal(cpu.failedTests, 0)
  assert.equal(cpu.skippedTests, 0)
  assert.ok(cpu.passedTests > 0)
  assert.equal(cpu.optimizerSteps, 0)
  assert.deepEqual(cpu.syntheticOptimizerSteps, { generator: 0, discriminator: 0 })
  assert.equal(cpu.gpuInitialized, false)
  assert.equal(cpu.trainingStarted, false)
  assert.equal("candidateContract" in cpu, false)
  const claim = boundJson(root, cpu.claim)
  assert.equal(claim.schemaVersion, "ai-painter-mvp256-dry-v28-lifecycle-cpu-claim-v1")
  assert.equal(claim.capabilityVersion, CAPABILITY)
  assert.equal(claim.attempt, 1)
  assert.equal(claim.automaticRetries, 0)
  for (const key of ["programBindings", "modelCpuEvidence", "formalSpecification", "executionGuide",
    ])
    assert.deepEqual(claim[key], cpu[key])
  const pyResult = JSON.parse(boundJson(root, cpu.testOutputs.python).stdout.trim())
  const nodeOutput = boundJson(root, cpu.testOutputs.node).stdout
  const tapCount = name => {
    const match = nodeOutput.match(new RegExp("^# " + name + " (\\d+)\\s*$", "mu"))
    assert.ok(match, "missing actual CPU test count: " + name)
    return Number(match[1])
  }
  for (const key of ["failures", "errors", "skipped"]) assert.equal(pyResult[key], 0)
  assert.equal(pyResult.gpuInitialized, false)
  assert.deepEqual(pyResult.syntheticOptimizerSteps, { generator: 0, discriminator: 0 })
  for (const key of ["fail", "cancelled", "skipped"]) assert.equal(tapCount(key), 0)
  assert.equal(tapCount("tests"), tapCount("pass"))
  assert.equal(pyResult.testsRun + tapCount("pass"), cpu.passedTests)
  assert.deepEqual(cpu.programBindings, policy.programBindings)
  for (const item of Object.values(cpu.programBindings)) readBound(root, item)
  for (const [role, logical] of Object.entries(PROGRAMS))
    assert.deepEqual(cpu.programBindings[role], bind(root, logical))
  assert.match(readBound(root, policy.formalSpecification).toString("utf8"), /AI-PAINTER-SPEC-1\.45/u)
  for (const item of Object.values(parent.frozenBindings)) readBound(root, item)
  for (const item of Object.values(policy.baseline)) readBound(root, item)
  return cpu
}

export function buildBasePackage({ policy, parent, policyBinding, runId,
  packageId, outputRoot, programBindings }) {
  const base = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v28-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: CAPABILITY,
    executionVersion: "appearance_regime_gradient_failure_capture_v1",
    runId, packageId, outputRoot, candidateContract: policyBinding,
    sourceDataCandidate: policy.predecessorCandidate,
    cpuAcceptance: policy.cpuAcceptance,
    modelCpuEvidence: policy.modelCpuEvidence,
    datasetManifest: parent.frozenBindings.datasetManifest,
    trainSplit: parent.frozenBindings.trainSplit,
    validationSplit: parent.frozenBindings.validationSplit,
    resourceBudget: structuredClone(BUDGET), trainingPlan: structuredClone(PLAN),
    programBindings, trainingIntent: "bounded_once", trainingAllowed: false,
    managedExecutionRequired: "javascript_managed_orchestration",
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
    execution: { reviewPlan: { boundedDryReviewAllowed: true,
      formalStage4QualificationAllowed: false,
      runtimePublicationAllowed: false,
      numericThresholdContract: parent.frozenBindings.numericReview,
      detailThresholdContract: parent.frozenBindings.detailReview } },
  }
  validateBasePackage({ base, policy, parent, policyBinding })
  return base
}

export function validateWorkerTerminal(root, terminal, base, ticketBinding) {
  assert.equal(terminal.executionVersion, "appearance_regime_gradient_failure_capture_v1")
  assert.equal(terminal.failureCapture?.failureCaptureTriggered, false)
  assert.equal(terminal.schemaVersion,
    "ai-painter-stage4-mvp256-dry-v28-worker-terminal-v1")
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.capabilityVersion, CAPABILITY)
  assert.equal(terminal.runId, base.runId)
  assert.equal(terminal.packageId, base.packageId)
  assert.equal(terminal.optimizerStepsGenerator, 2304)
  assert.equal(terminal.optimizerStepsDiscriminator, 2304)
  assert.deepEqual(terminal.eligibleCheckpointEpochs, [24, 36, 48])
  assert.deepEqual(terminal.checkpoints?.map(row => row.epoch), [24, 36, 48])
  for (const row of terminal.checkpoints) {
    assert.equal(row.validation?.length, 8)
    assert.deepEqual(row.selection?.rank,
      [row.selection.worstApplicableObjectCorrelation,
        -row.selection.meanValidationRgbMae, -row.epoch])
    assert.deepEqual(row.checkpoint,
      { path: row.checkpoint.path, sha256: row.checkpointSha256 })
    readBound(root, row.checkpoint)
  }
  const selected = terminal.checkpoints.find(row => row.epoch === terminal.selectedEpoch)
  assert.ok(selected)
  assert.deepEqual(terminal.selectedCheckpoint, selected.checkpoint)
  assert.deepEqual(terminal.selectedRank, selected.selection.rank)
  assert.equal(terminal.selectedModelStateSha256, selected.stateSha256.Model)
  assert.equal(terminal.selectedCriticStateSha256, selected.stateSha256.Critic)
  assert.equal(terminal.checkpointReloadVerified, true)
  assert.equal(terminal.checkpointPromotable, false)
  assert.equal(terminal.challengeContentRead, false)
  assert.equal(terminal.regressionContentRead, false)
  assert.equal(terminal.historicalCheckpointLoaded, false)
  assert.equal(terminal.formalStage4QualificationAllowed, false)
  assert.equal(terminal.stage4QualificationGranted, false)
  assert.equal(terminal.runtimePublicationAllowed, false)
  const claim = boundJson(root, terminal.trainingTicketConsumption)
  assert.equal(claim.schemaVersion,
    "ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
  assert.deepEqual(claim.trainingTicket, ticketBinding)
  assert.equal(claim.optimizerCreatedAtConsumption, false)
  assert.equal(claim.gpuInitializedAtConsumption, false)
  return selected
}

const productionRegistry = {
  read: root => readCurrentExecutionRegistry(root),
  advance: options => advanceCurrentExecutionRegistry(options),
}
const productionCommand = async ({ file, args, root, timeout, signal }) =>
  execFileAsync(file, args, { cwd: root, windowsHide: true, timeout, signal,
    maxBuffer: 262144, encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
      PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter) } })

export async function managedChild(specification, { root, outputRoot, label, execute = productionCommand }) {
  assert.match(label, /^[a-z][a-z-]{1,40}$/u)
  const textEvidence = value => {
    const raw = Buffer.from(String(value ?? ""), "utf8")
    return { text: raw.subarray(0, 4096).toString("utf8"), bytes: raw.length,
      sha256: sha(raw), truncated: raw.length > 4096 }
  }
  let result, primary
  try { result = await execute(specification) } catch (error) { primary = error }
  const record = { specification, stdout: textEvidence(result?.stdout ?? primary?.stdout),
    stderr: textEvidence(result?.stderr ?? primary?.stderr),
    error: primary ? textEvidence(primary.stack ?? primary) : null }
  try {
    assert.ok(Buffer.byteLength(JSON.stringify(record)) <= 65536, "child diagnostic log exceeds reserve")
    assert.ok(outputBytes(root, outputRoot) + Buffer.byteLength(JSON.stringify(record)) + 1 <= 128 * 1024**2,
      "child log exceeds combined output budget")
    writeExclusive(root, `${outputRoot}/child-${label}.json`, record)
  } catch (secondary) {
    if (!primary) throw secondary
    primary.childLogPublicationError = String(secondary.message ?? secondary)
  }
  if (primary) throw primary
  return result
}

function outputBytes(root, logical) {
  const directory = inside(root, logical)
  let total = 0
  for (const row of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, row.name)
    assert.equal(row.isSymbolicLink(), false, "output contains unexpected redirection")
    total += row.isDirectory() ? outputBytes(root, path.posix.join(logical, row.name)) : fs.statSync(target).size
  }
  return total
}

export async function preflight({ projectRoot = ROOT, registry = productionRegistry,
  command = productionCommand } = {}) {
  const root = fs.realpathSync(projectRoot)


  const policyBinding = bind(root, POLICY_PATH)
  const policy = boundJson(root, policyBinding)
  const proposal = null
  const parent = boundJson(root, policy.predecessorCandidate)
  validatePolicy({ root, policy, policyBinding, parent, proposal })
  const programBindings = await collectProgramBindings(root, command)
  assert.deepEqual(programBindings, policy.programBindings)
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  assert.equal(current.registry.activeExecution, null,
    "another managed execution is active")
  assert.equal(current.registry.activeExecution, null)

  const worker = JSON.parse((await command({ file: inside(root, PYTHON),
    args: ["-B", inside(root, WORKER), "--cpu-preflight"], root,
    timeout: 120_000 })).stdout)
  const qualifier = JSON.parse((await command({ file: inside(root, PYTHON),
    args: ["-B", inside(root, GPU_QUALIFIER)], root,
    timeout: 120_000 })).stdout)
  assert.equal(worker.status, "cpu_preflight_passed_training_not_started")
  assert.equal(worker.capabilityVersion, CAPABILITY)
  assert.equal(worker.gpuInitialized, false)
  assert.equal(worker.trainingStarted, false)
  assert.equal(qualifier.status, "cpu_preflight_only_gpu_not_initialized")
  return { root, policy, policyBinding, proposal, parent, programBindings,
    registryRevision: current.registry.registryRevision,
    registrySha256: current.registrySha256 }
}

function identityFor(ready) {
  const digest = sha(Buffer.from(JSON.stringify({ capabilityVersion: CAPABILITY,
    policy: ready.policyBinding, sourceData: ready.policy.predecessorCandidate,
    cpuAcceptance: ready.policy.cpuAcceptance,
    programBindings: ready.programBindings, resourceBudget: BUDGET,
    trainingPlan: PLAN })))
  return { runId: `mvp256-dry-capture-v1-${digest.slice(0, 48)}`,
    packageId: `mvp256-dry-capture-v1-package-${digest.slice(0, 40)}` }
}

async function advance(registry, root, { runId, packageId, outputRoot,
  evidence, programBindings, activeExecution, activity, state,
  latestTrainingTerminal = null }) {
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  if (activeExecution) assert.equal(current.registry.activeExecution, null)
  else if (current.registry.activeExecution)
    assert.equal(current.registry.activeExecution.runId, runId)
  const capsule = writeExclusive(root,
    `${outputRoot}/${activeExecution ? "begin" : state === "completed"
      ? "training-complete" : "training-failed"}-capsule.json`, {
      schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId,
      integrity: { status: "verified" },
      evidence: [{ ...evidence, kind: "mvp256_dry_v28_bounded_training",
        sha256Verified: true }],
    })
  const result = await registry.advance({ projectRoot: root,
    capabilityVersion: CAPABILITY, packageId, taskId: runId,
    taskKind: "mvp256_dry_v28_bounded_training",
    taskGoal: "One bounded V28 256x192 dry-world train/validation comparison.",
    priority: 5, queueStatus: activeExecution ? "running" : state,
    nextMachineAction: null, queuedAtUtc: now(), runId,
    lifecycleStage: "dry_single_world_256x192",
    executionState: state, activity, taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path, activeExecution,
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "V28 current registry advance failed")
  return result
}

export function updateHeartbeat(root, outputRoot, identity, publicationOptions) {
  const target = inside(root, `${outputRoot}/heartbeat.json`)
  const heartbeat = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(heartbeat.runId, identity.runId)
  assert.equal(heartbeat.processId, identity.processId)
  heartbeat.heartbeatAtUtc = now()
  const temporary = `${target}.staged-${process.pid}-${crypto.randomBytes(6).toString("hex")}`
  const descriptor = fs.openSync(temporary, "wx")
  try { fs.writeFileSync(descriptor, `${JSON.stringify(heartbeat, null, 2)}\n`)
    fs.fsyncSync(descriptor) }
  finally { fs.closeSync(descriptor) }
  return replaceHeartbeatFile(temporary, target, publicationOptions)
}

export function heartbeatFailureEvidence(reason) {
  if (!reason) return null
  return {
    name: reason.name ?? null,
    message: String(reason.message ?? reason),
    stack: String(reason.stack ?? reason),
    code: reason.code ?? null,
    errno: reason.errno ?? null,
    syscall: reason.syscall ?? null,
    path: reason.path ?? null,
    dest: reason.dest ?? null,
    heartbeatPublication: reason.heartbeatPublication ?? null,
  }
}

export async function runReviewPipeline({ root, terminalBinding, command,
  registry = productionRegistry, programBindings, outputRoot, runId, packageId }) {
  // Review has its own failure boundary: never rewrite a successful training
  // terminal or register a review error as an optimizer failure.
  try {
    for (const item of Object.values(programBindings)) readBound(root, item)
    const compared = JSON.parse((await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, PROGRAMS.cpuReview), "--terminal", terminalBinding.path,
        "--sha256", terminalBinding.sha256, "--execute"], root, timeout: 180_000 })).stdout)
    readBound(root, compared)
    const reviewed = JSON.parse((await command({ file: process.execPath,
      args: [inside(root, PROGRAMS.independentAudit), "--audit", compared.path,
        compared.sha256], root, timeout: 180_000 })).stdout)
    readBound(root, reviewed.report)
    const closed = JSON.parse((await command({ file: process.execPath,
      args: [inside(root, PROGRAMS.reconciliation), "--reconcile", reviewed.report.path,
        reviewed.report.sha256], root, timeout: 120_000 })).stdout)
    assert.ok(["dry_single_world_review_failed_closed",
      "dry_single_world_numeric_passed_visual_approval_pending"].includes(closed.status))
    readBound(root, closed.terminal)
    return { ...closed, cpuComparison: compared, audit: reviewed.report }
  } catch (error) {
    const failure = writeExclusive(root, `${outputRoot}/review-pipeline-failure.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v28-review-pipeline-failure-v1",
      status: "review_execution_failed_closed", executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY, trainingTerminal: terminalBinding,
      error: String(error.stack ?? error), optimizerStepsStartedByReview: 0,
      automaticRetryStarted: false, formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    const current = await registry.read(root)
    assert.equal(current.ok, true)
    assert.equal(current.registry.activeExecution, null)
    assert.equal(current.registry.runId, runId)
    assert.equal(current.registry.latestTrainingTerminal.sha256, terminalBinding.sha256)
    const capsule = writeExclusive(root, `${outputRoot}/review-failed-capsule.json`, {
      schemaVersion: "ai-painter-local-task-capsule-v1", taskId: `${runId}-review`,
      integrity: { status: "verified" }, evidence: [
        { ...failure, kind: "bounded_review_failure", sha256Verified: true },
        { ...terminalBinding, kind: "completed_training_terminal", sha256Verified: true },
      ],
    })
    const result = await registry.advance({ projectRoot: root,
      capabilityVersion: CAPABILITY, packageId, taskId: `${runId}-review`,
      taskKind: "mvp256_dry_v28_review_failure", taskGoal: "Close a failed bounded review; do not retrain.",
      priority: 5, queueStatus: "failed_closed", nextMachineAction: null,
      queuedAtUtc: now(), runId, lifecycleStage: "dry_single_world_256x192",
      executionState: "failed_closed", activity: "review_execution_failed_closed",
      taskCapsulePath: capsule.path, terminalEvidencePath: failure.path, activeExecution: null,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
    })
    assert.equal(result.ok, true)
    return { status: "review_execution_failed_closed", failure, stage4Advanced: false }
  }
}

export async function run({ projectRoot = ROOT, execute = false,
  registry = productionRegistry, command = productionCommand,
  processIdentityReader = processIdentity, preflightReady = null,
  intervalFactory = setInterval, intervalClear = clearInterval,
  heartbeatUpdater = updateHeartbeat, parentDeadlineUnixMs = null,
  ownedAnalysis = runOwnedWorker } = {}) {

  assert.ok(preflightReady === null || process.env.NODE_TEST_CONTEXT, "preflightReady is a test-only boundary")
  const ready = preflightReady ?? await preflight({ projectRoot, registry, command })
  validateProgramSources(ready.root, ready.programBindings)
  if (!execute) return { status: "cpu_preflight_passed_training_not_started",
    registryRevision: ready.registryRevision, trainingStarted: false,
    gpuInitialized: false }
  const root = ready.root
  const before = await registry.read(root)
  assert.equal(before.ok, true)
  assert.equal(before.registry.registryRevision, ready.registryRevision)
  assert.equal(before.registrySha256, ready.registrySha256)
  assert.equal(before.registry.activeExecution, null)
  const { runId, packageId } = identityFor(ready)
  const outputRoot = `${OUTPUT_PARENT}/${runId}`
  const childLabels = ["admission", "gpu", "training", "cpu-review", "audit", "reconcile"]
  let childIndex = 0
  const childCommand = specification => managedChild(specification, {
    root, outputRoot, label: childLabels[childIndex++], execute: command })
  fs.mkdirSync(inside(root, OUTPUT_PARENT), { recursive: true })
  const claim = writeExclusive(root, CLAIM_PATH, {
    schemaVersion: "ai-painter-mvp256-dry-v28-single-training-attempt-claim-v1",
    capabilityVersion: CAPABILITY, candidateContract: ready.policyBinding,
    executionVersion: "appearance_regime_gradient_failure_capture_v1",
    modelCpuEvidence: ready.policy.modelCpuEvidence,
    runId, packageId, automaticRetries: 0, claimedAtUtc: now(),
  })
  fs.mkdirSync(inside(root, outputRoot))
  let base = null
  let baseBinding = null
  let heartbeatTimer = null
  let activeRegistered = false
  let workerCommandStarted = false
  const abort = new AbortController()
  try {
    base = buildBasePackage({ policy: ready.policy, parent: ready.parent,
      policyBinding: ready.policyBinding, runId, packageId, outputRoot,
      programBindings: ready.programBindings })
    baseBinding = writeExclusive(root, `${outputRoot}/execution-package.json`, base)
    const processIdentityValue = { capabilityVersion: CAPABILITY,
      runId, packageId, processId: process.pid,
      processStartIdentity: processIdentityReader(process.pid) }
    const registryLock = writeExclusive(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1",
      ...processIdentityValue })
    writeExclusive(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
      ...processIdentityValue, executionState: "executing",
      heartbeatAtUtc: now(), ttlSeconds: 120 })
    const activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1",
      ...processIdentityValue, executionState: "executing",
      programLineage: ready.programBindings, lock: registryLock,
      heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
    const dispatch = writeExclusive(root, `${outputRoot}/training-dispatched.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
      status: "base_package_dispatched_gpu_gate_pending",
      executionState: "completed", runId, packageId,
      capabilityVersion: CAPABILITY, singleAttemptClaim: claim,
      executionPackage: baseBinding, trainingStarted: false,
      gpuQualificationStarted: false,
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    await advance(registry, root, { runId, packageId, outputRoot,
      evidence: dispatch, programBindings: ready.programBindings,
      activeExecution, activity: "gpu_qualification_pending", state: "executing" })
    activeRegistered = true
    heartbeatTimer = intervalFactory(() => {
      try { heartbeatUpdater(root, outputRoot, processIdentityValue) }
      catch (error) { abort.abort(error) }
    }, 10_000)
    const admissionResult = await childCommand({ file: inside(root, PYTHON),
      args: ["-B", inside(root, GPU_QUALIFIER), "--admission-preflight",
        "--package", baseBinding.path, "--sha256", baseBinding.sha256], root,
      timeout: 120_000, signal: abort.signal })
    const admission = JSON.parse(admissionResult.stdout)
    assert.equal(admission.status, "managed_package_admission_passed_gpu_not_initialized")
    assert.equal(admission.capabilityVersion, CAPABILITY)
    assert.deepEqual(admission.executionPackage, baseBinding)
    assert.equal(admission.gpuInitialized, false)
    assert.equal(admission.optimizerCreated, false)
    assert.equal(admission.qualificationClaimCreated, false)
    const qualifierResult = await childCommand({ file: inside(root, PYTHON),
      args: ["-B", inside(root, GPU_QUALIFIER), "--package", baseBinding.path,
        "--sha256", baseBinding.sha256, "--execute"], root,
      timeout: 600_000, signal: abort.signal })
    assert.equal(JSON.parse(qualifierResult.stdout).status,
      "current_candidate_zero_update_gpu_qualification_passed")
    const gpuBinding = bind(root, `${outputRoot}/zero-update-gpu-qualification.json`)
    const gpu = boundJson(root, gpuBinding)
    assert.equal(gpu.executionVersion, "appearance_regime_gradient_failure_capture_v1")
    const managedLock = writeExclusive(root, `${outputRoot}/managed-training-lock.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v28-managed-lock-v1",
      status: "active_bound_single_attempt", runId, packageId,
      executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET) })
    const launch = writeExclusive(root, `${outputRoot}/supervisor-launch-identity.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v28-launch-identity-v1",
      status: "managed_supervisor_identity_verified", runId, packageId,
      executionPackage: baseBinding, managedLock,
      processId: processIdentityValue.processId,
      processStartIdentity: processIdentityValue.processStartIdentity })
    const ticket = {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v28-training-ticket-v1",
      executionVersion: "appearance_regime_gradient_failure_capture_v1",
      status: "issued_single_use", capabilityVersion: CAPABILITY,
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, managedLock, launchIdentity: launch,
      consumptionClaimPath: `${outputRoot}/training-ticket-consumed.json`,
      trainingAllowed: true, automaticRetries: 0,
      formalStage4QualificationAllowed: false,
      runtimePublicationAllowed: false,
    }
    const ticketBinding = writeExclusive(root, `${outputRoot}/training-ticket.json`, ticket)
    const trainIds = boundJson(root, ready.parent.frozenBindings.trainSplit).sampleIds
    validateActivationChain({ base, baseBinding, gpu, gpuBinding,
      lock: boundJson(root, managedLock), lockBinding: managedLock,
      launch: boundJson(root, launch), launchBinding: launch,
      ticket, ticketBinding, trainIds })
    const activation = writeExclusive(root, `${outputRoot}/training-activated.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
      status: "single_use_training_ticket_issued", executionState: "executing",
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, trainingTicket: ticketBinding,
      trainingStarted: false, recordedAtUtc: now(),
    })
    readBound(root, activation)
    workerCommandStarted = true
    await childCommand({ file: inside(root, PYTHON),
      args: ["-B", inside(root, WORKER), "--run",
        "--training-ticket", ticketBinding.path,
        "--training-ticket-sha256", ticketBinding.sha256,
        "--output", `${outputRoot}/phase-terminal.json`], root,
      timeout: BUDGET.maxWallSeconds * 1000,
      signal: abort.signal })
    const workerBinding = bind(root, `${outputRoot}/phase-terminal.json`)
    const worker = boundJson(root, workerBinding)
    const selected = validateWorkerTerminal(root, worker, base, ticketBinding)
    if (heartbeatTimer) intervalClear(heartbeatTimer)
    heartbeatTimer = null
    const final = writeExclusive(root, `${outputRoot}/training-finalize.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
      status: "training_completed_review_pending", executionState: "completed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, gpuQualification: gpuBinding,
      trainingTicket: ticketBinding, workerTerminal: workerBinding,
      selectedEpoch: worker.selectedEpoch, selectedRank: worker.selectedRank,
      selectedCheckpoint: selected.checkpoint,
      checkpointReloadVerified: true, checkpointPromotable: false,
      trainingProgress: bind(root, `${outputRoot}/progress.json`),
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    await advance(registry, root, { runId, packageId, outputRoot,
      evidence: final, programBindings: ready.programBindings,
      activeExecution: null, activity: "training_completed_review_pending",
      state: "completed", latestTrainingTerminal: { runId,
        path: final.path, sha256: final.sha256,
        status: "training_completed_review_pending", evidence: {
          workerTerminal: workerBinding,
          trainingProgress: bind(root, `${outputRoot}/progress.json`) } } })
    activeRegistered = false
    const review = await runReviewPipeline({ root, terminalBinding: final, command: childCommand,
      registry, programBindings: ready.programBindings, outputRoot, runId, packageId })
    return { status: review.status, runId, packageId, trainingStatus: "completed",
      executionPackage: baseBinding, workerTerminal: workerBinding,
      selectedCheckpoint: selected.checkpoint, review }
  } catch (error) {
    if (heartbeatTimer) intervalClear(heartbeatTimer)
    heartbeatTimer = null
    const available = {}
    for (const [key, logical] of [
      ["workerTerminal", `${outputRoot}/phase-terminal.json`],
      ["progress", `${outputRoot}/progress.json`],
      ["captureStarted", `${outputRoot}/failure-capture-started.json`],
      ["gpuFailure", `${outputRoot}/zero-update-gpu-qualification-failure.json`],
    ]) {
      try { if (fs.existsSync(inside(root, logical))) available[key] = bind(root, logical) }
      catch { /* the failure record below preserves the causal error */ }
    }
    const diagnosticErrors = []
    const diagnostic = (binding, name) => {
      if (!binding) return null
      try {
        const value = boundJson(root, binding)
        assert.equal(value.runId, runId)
        assert.equal(value.packageId, packageId)
        assert.equal(value.capabilityVersion, CAPABILITY)
        return value
      } catch (secondary) {
        diagnosticErrors.push({ name, binding, error: String(secondary.stack ?? secondary) })
        return null
      }
    }
    const worker = diagnostic(available.workerTerminal, "workerTerminal")
    const progress = diagnostic(available.progress, "progress")
    const captureStarted = diagnostic(available.captureStarted, "captureStarted")
    const boundedCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 2304 ? value : null
    const generatorSteps = boundedCount(worker?.optimizerStepsGenerator)
      ?? boundedCount(captureStarted?.optimizerStepsGenerator)
      ?? boundedCount(progress?.optimizerStepsGenerator) ?? (workerCommandStarted ? null : 0)
    const discriminatorSteps = boundedCount(worker?.optimizerStepsDiscriminator)
      ?? boundedCount(captureStarted?.optimizerStepsDiscriminator)
      ?? boundedCount(progress?.optimizerStepsDiscriminator) ?? (workerCommandStarted ? null : 0)
    const optimizerCountsKnown = generatorSteps !== null && discriminatorSteps !== null
    const failureStatus = worker?.status ?? "failed_closed"
    const failure = atomicDiagnostic(root, outputRoot, "failure.json", {
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
      status: failureStatus, executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, error: String(error.stack ?? error),
      abortReason: heartbeatFailureEvidence(abort.signal.reason),
      executionVersion: "appearance_regime_gradient_failure_capture_v1",
      failureCapture: worker?.failureCapture ?? captureStarted ?? null,
      originalPairError: captureStarted?.originalError ?? null,
      diagnosticErrors, diagnosticEvidence: available, optimizerCountsKnown,
      workerTerminal: worker ? available.workerTerminal : null,
      progress: progress ? available.progress : null,
      trainingProgress: progress ? available.progress : null,
      gpuQualificationFailure: available.gpuFailure ?? null,
      optimizerStepsGenerator: generatorSteps,
      optimizerStepsDiscriminator: discriminatorSteps,
      completedEpochs: worker?.completedEpochs ?? progress?.completedEpochs ?? (optimizerCountsKnown ? Math.floor(Math.min(generatorSteps, discriminatorSteps) / 48) : null),
      trainingStarted: workerCommandStarted,
      automaticRetryStarted: false, checkpointPromotable: false,
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    }, { failure: true, maximum: 128 * 1024**2 })
    if (activeRegistered) {
      try {
        const current = await registry.read(root)
        if (current.ok && current.registry.activeExecution?.runId === runId) {
          const evidence = {}
          if (worker) evidence.workerTerminal = available.workerTerminal
          if (progress) evidence.trainingProgress = available.progress
          if (captureStarted) evidence.gradientFailureCaptureStarted = available.captureStarted
          await advance(registry, root, { runId, packageId, outputRoot,
            evidence: failure, programBindings: ready.programBindings,
            activeExecution: null, activity: "failed_closed", state: "failed_closed",
            latestTrainingTerminal: { runId, path: failure.path,
              sha256: failure.sha256, status: failureStatus, evidence } })
          activeRegistered = false
        }
      } catch (registryError) {
        writeExclusive(root, `${outputRoot}/registry-finalization-failure.json`, {
          schemaVersion: "ai-painter-mvp256-dry-v28-registry-finalization-failure-v1",
          status: "failed_closed", runId, packageId,
          error: String(registryError.stack ?? registryError),
          recordedAtUtc: now(),
        })
      }
    }
    const analysis = await dispatchClosedFailureAnalysis({ root, failureBinding: failure, runId, packageId,
      registry, trainingError: workerCommandStarted ? error : null, signal: abort.signal,
      parentDeadlineUnixMs, ownedAnalysis })
    return { status: "failed_closed", runId, packageId,
      failure, error: String(error.message ?? error), analysis }
  }
}


const audit_PROGRAM = "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs"
const audit_sha = audit_bytes => crypto.createHash("sha256").update(audit_bytes).digest("hex")
function audit_inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && ![".", "..", "latest", "latest.json"].includes(part)), "unsafe evidence path")
  const target = path.resolve(root, logical)
  assert.ok(target.startsWith(`${root}${path.sep}`), "evidence escaped root")
  return target
}
function audit_bytes(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const value = fs.readFileSync(audit_inside(root, binding.path))
  assert.equal(audit_sha(value), binding.sha256, `changed evidence: ${binding.path}`)
  return value
}
const audit_json = (root, binding) => JSON.parse(audit_bytes(root, binding))
const audit_bind = (root, logical) => ({ path: logical, sha256: audit_sha(fs.readFileSync(audit_inside(root, logical))) })

export function validateV28Review({ report, execution, terminal, worker, registry, policy, parent, scope }) {
  assert.equal(report.schemaVersion, "ai-painter-mvp256-dry-v28-cpu-review-v1")
  assert.equal(report.status, "cpu_comparison_completed_visual_review_pending")
  for (const record of [report, execution, terminal, worker]) {
    assert.equal(record.capabilityVersion, CAPABILITY)
    assert.equal(record.runId, execution.runId)
    assert.equal(record.packageId, execution.packageId)
  }
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(worker.status, terminal.status)
  assert.equal(worker.completedEpochs, 48)
  assert.equal(worker.optimizerStepsGenerator, 2304)
  assert.equal(worker.optimizerStepsDiscriminator, 2304)
  assert.equal(worker.checkpointReloadVerified, true)
  assert.deepEqual(report.selectedCheckpoint, worker.selectedCheckpoint)
  assert.equal(report.selectedEpoch, worker.selectedEpoch)
  assert.deepEqual(report.candidateContract, execution.candidateContract)
  assert.deepEqual(report.sourceDataCandidate, policy.predecessorCandidate)
  assert.deepEqual(execution.sourceDataCandidate, report.sourceDataCandidate)
  assert.equal(policy.executionVersion, "appearance_regime_gradient_failure_capture_v1")
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.latestTrainingTerminal?.runId, execution.runId)
  assert.deepEqual({ path: registry.latestTrainingTerminal.path,
    sha256: registry.latestTrainingTerminal.sha256 }, report.trainingTerminal)
  assert.deepEqual(terminal.workerTerminal, report.workerTerminal)
  assert.deepEqual(terminal.executionPackage, report.executionPackage)
  assert.equal(report.subject.sampleId, scope.preselectedSubject.sampleId)
  for (const key of ["worldId", "regionId", "tick", "factHash", "conditionPack"])
    assert.deepEqual(report.subject[key], scope.preselectedSubject[key])
  assert.equal(report.subject.split, "validation")
  assert.equal(report.optimizerSteps, 0)
  for (const key of ["gpuStarted", "weightsModified", "challengeContentRead", "regressionContentRead",
    "formalStage4QualificationGranted", "runtimePublicationGranted"])
    assert.equal(report[key], false)
  assert.equal(report.validationSampleIds.length, 8)
  assert.equal(new Set(report.validationSampleIds).size, 8)
  for (const label of ["v24", "v28"])
    assert.deepEqual(report.measurements[label].rows.map(row => row.sampleId), report.validationSampleIds)
  assert.deepEqual(execution.execution.reviewPlan, {
    boundedDryReviewAllowed: true, formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false, numericThresholdContract: parent.frozenBindings.numericReview,
    detailThresholdContract: parent.frozenBindings.detailReview,
  })
  return true
}

export async function audit(projectRoot, input) {
  const root = fs.realpathSync(projectRoot)
  const report = audit_json(root, input)
  const execution = audit_json(root, report.executionPackage)
  const terminal = audit_json(root, report.trainingTerminal)
  const worker = audit_json(root, report.workerTerminal)
  const policy = audit_json(root, report.candidateContract)
  const parent = audit_json(root, report.sourceDataCandidate)
  const scope = audit_json(root, parent.frozenBindings.dryScope)
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode)
  validateV28Review({ report, execution, terminal, worker, registry: current.registry, policy, parent, scope })
  for (const binding of Object.values(execution.programBindings)) audit_bytes(root, binding)
  audit_bytes(root, report.program)
  const dataset = audit_json(root, execution.datasetManifest)
  const source = audit_json(root, dataset.sourceIndex)
  const split = audit_json(root, execution.validationSplit)
  assert.deepEqual(split.sampleIds, report.validationSampleIds)
  const row = source.samples.find(value => value.sampleId === report.subject.sampleId)
  assert.equal(row.split, "validation")
  assert.deepEqual(row.image, report.subject.referenceRgb)
  const pack = audit_json(root, report.subject.conditionPack)
  assert.equal(pack.worldId, report.subject.worldId)
  assert.equal(pack.tick, report.subject.tick)
  assert.equal(pack.channels.length, 23)
  for (const channel of pack.channels) audit_bytes(root, { path: channel.path, sha256: channel.sha256 })
  for (const binding of [report.candidateRgb, report.subject.referenceRgb, report.selectedCheckpoint]) audit_bytes(root, binding)
  const metadata = await sharp(audit_inside(root, report.candidateRgb.path)).metadata()
  assert.deepEqual([metadata.width, metadata.height], [256, 192])
  const roles = decodeV17ResponsibilityArtifact({ archiveBytes: audit_bytes(root, report.responsibility.archive),
    evidence: report.responsibility.evidence, expectedIdentity: {
      worldId: report.subject.worldId, regionId: report.subject.regionId, tick: report.subject.tick,
      factHash: report.subject.factHash, visualFactManifestSha256: report.subject.visualFactManifestSha256,
      conditionPackSha256: report.subject.conditionPack.sha256,
      modelStateSha256: worker.selectedModelStateSha256,
    }, schemaBytes: audit_bytes(root, report.responsibility.interface),
    schemaSha256: report.responsibility.interface.sha256,
    candidatePackSchemaVersion: audit_json(root, report.responsibility.interface).candidatePackSchemaVersion })
  const out = path.posix.dirname(input.path)
  const resultPath = `${out}/independent-audit.json`
  const projectionPath = `${out}/condition-audit-input-1024.png`
  assert.equal(fs.existsSync(audit_inside(root, resultPath)), false, "audit already consumed")
  assert.equal(fs.existsSync(audit_inside(root, projectionPath)), false, "projection already exists")
  const projection = await sharp(audit_bytes(root, report.candidateRgb)).resize(1024, 768, { kernel: "nearest" }).png().toBuffer()
  fs.writeFileSync(audit_inside(root, projectionPath), projection, { flag: "wx" })
  const thresholds = audit_json(root, parent.frozenBindings.numericReview)
  const [detail, aesthetic, alignment] = await Promise.all([
    auditMvp256DetailSufficiency({ candidatePath: audit_inside(root, report.candidateRgb.path),
      referencePath: audit_inside(root, row.image.path), contract: audit_json(root, parent.frozenBindings.detailReview) }),
    auditProfessionalAestheticFromFrozenContract({ imagePath: audit_inside(root, report.candidateRgb.path),
      thresholdContract: thresholds, styleFingerprintPath: audit_inside(root, thresholds.styleFingerprint.path),
      expectedStyleFingerprintSha256: thresholds.styleFingerprint.sha256 }),
    auditAiAssistedConditionAlignment({ record: { recordId: `${report.runId}-dry-independent-review`,
      conditionBinding: { conditionPackPath: report.subject.conditionPack.path,
        worldId: report.subject.worldId, tick: report.subject.tick },
      classification: { monsoonSeason: row.monsoonSeason, regionalLandscapeType: null } },
      imagePath: audit_inside(root, projectionPath), referenceImagePath: audit_inside(root, row.image.path) }),
  ])
  const decision = decideMvp256DryReview({ scope: scope.preselectedSubject,
    candidate: { sampleId: report.subject.sampleId, split: "validation", resolution: [256, 192] },
    detail, aesthetic, alignment, responsibilityRoleCount: roles.roleOrder.length })
  const value = { schemaVersion: "ai-painter-mvp256-dry-v28-independent-audit-v1", ...decision,
    runId: report.runId, sampleId: report.subject.sampleId, selectedEpoch: report.selectedEpoch,
    input, selectedCheckpoint: report.selectedCheckpoint, candidateRgb: report.candidateRgb,
    program: audit_bind(root, audit_PROGRAM), projection: audit_bind(root, projectionPath),
    numericContract: parent.frozenBindings.numericReview, detailContract: parent.frozenBindings.detailReview,
    detail, aesthetic, alignment, recordedAtUtc: new Date().toISOString() }
  const encoded = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  assert.ok(encoded.length + projection.length <= 8 * 1024 * 1024)
  audit_bytes(root, input)
  audit_bytes(root, report.candidateRgb)
  fs.writeFileSync(audit_inside(root, resultPath), encoded, { flag: "wx" })
  return { status: value.status, issueCodes: value.issueCodes, report: audit_bind(root, resultPath), stage4Advanced: false }
}


export async function reconcile(root, auditBinding, execute = false) {
  root = fs.realpathSync(root)
  const audit = audit_json(root, auditBinding)
  const report = audit_json(root, audit.input)
  const execution = audit_json(root, report.executionPackage)
  const terminal = audit_json(root, report.trainingTerminal)
  const worker = audit_json(root, report.workerTerminal)
  const policy = audit_json(root, report.candidateContract)
  const parent = audit_json(root, report.sourceDataCandidate)
  const scope = audit_json(root, parent.frozenBindings.dryScope)
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode)
  validateV28Review({ report, execution, terminal, worker, registry: current.registry, policy, parent, scope })
  assert.equal(current.registry.runId, report.runId)
  for (const binding of Object.values(execution.programBindings)) audit_bytes(root, binding)
  for (const binding of [report.program, report.selectedCheckpoint, report.candidateRgb,
    report.responsibility.archive, audit.program, audit.numericContract, audit.detailContract]) audit_bytes(root, binding)
  assert.deepEqual(audit.numericContract, parent.frozenBindings.numericReview)
  assert.deepEqual(audit.detailContract, parent.frozenBindings.detailReview)
  const decision = closeDecision(report, audit, audit_json(root, report.baselineAudit))
  if (current.registry.activity === decision.status) {
    assert.equal(current.registry.nextMachineAction, null)
    assert.equal(current.currentTaskTerminal.routeDecision, decision.routeDecision)
    return { status: "already_reconciled", stage4Advanced: false }
  }
  assert.equal(current.registry.activity, "training_completed_review_pending")
  assert.equal(current.registry.terminalEvidence.sha256, report.trainingTerminal.sha256)
  if (!execute) return { status: "review_closure_preflight_passed", decision, registryWritten: false }
  const out = path.posix.dirname(auditBinding.path)
  assert.equal(out, `${execution.outputRoot}/dry-review`)
  const writeOrVerify = (name, value) => {
    const logical = `${out}/${name}`
    const payload = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
    const target = audit_inside(root, logical)
    if (fs.existsSync(target)) assert.ok(fs.readFileSync(target).equals(payload), "closure record differs")
    else {
      const fd = fs.openSync(target, "wx")
      try { fs.writeFileSync(fd, payload); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    }
    return { path: logical, sha256: audit_sha(payload) }
  }
  const end = writeOrVerify("review-terminal.json", {
    schemaVersion: "ai-painter-mvp256-dry-v28-review-terminal-v1", ...decision,
    executionState: decision.executionState, runId: report.runId, packageId: report.packageId,
    audit: auditBinding, cpuComparison: audit.input, trainingTerminal: report.trainingTerminal,
    selectedCheckpoint: report.selectedCheckpoint, trainingStartedByReconciliation: false,
  })
  const capsule = writeOrVerify("review-capsule.json", {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: `${report.runId}-review-closure`,
    integrity: { status: "verified" }, evidence: [
      { ...auditBinding, kind: "dry_single_world_review_audit", sha256Verified: true },
      { ...audit.input, kind: "cpu_validation_comparison", sha256Verified: true },
    ],
  })
  const result = await advanceCurrentExecutionRegistry({ projectRoot: root,
    capabilityVersion: current.registry.capabilityVersion, packageId: current.registry.packageId,
    taskId: `${report.runId}-review-closure`, taskKind: "mvp256_dry_v28_review_closure",
    taskGoal: "Close the V28 context isolation comparison after its frozen validation and dry-world review.",
    priority: current.registry.priority, queueStatus: decision.executionState, nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc, runId: report.runId,
    lifecycleStage: current.registry.lifecycleStage, executionState: decision.executionState, activity: decision.status,
    taskCapsulePath: capsule.path, terminalEvidencePath: end.path, activeExecution: null,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256 })
  assert.equal(result.ok, true)
  return { status: decision.status, terminal: end, stage4Advanced: false }
}


const cpuExec = promisify(execFile)
const hash = sha
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
export const PYTHON_TESTS = ["test_painter_stage4_appearance_regime_gradient_failure_capture_worker",
  "test_qualify_stage4_appearance_regime_gradient_failure_capture_gpu", "test_review_stage4_appearance_regime_gradient_failure_capture_cpu"]
export const NODE_TESTS = [PROGRAMS.supervisorTests]
export async function acceptanceCommand({ file, args, root, timeout = 180000, signal }) {
  return cpuExec(file, args, { cwd: root, windowsHide: true, timeout, signal, maxBuffer: 262144,
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
  const evidenceRoot = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/lifecycle"
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
  const captureProof = readCaptureCpuProof(sourceRoot, policy.captureCpuEvidence, policy.programBindings)
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
    if (HISTORICAL_DOCUMENTS[binding.path] && binding.sha256 === HISTORICAL_DOCUMENTS[binding.path].sha256) { copy(HISTORICAL_DOCUMENTS[binding.path]); return }
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
  walk(HISTORICAL_DOCUMENTS)
  copy(policy.captureCpuEvidence)
  const captureLog = captureProof.syntheticTests.logs.at(-1)
  copy({path:path.relative(sourceRoot,captureLog.path).replaceAll("\\", "/"),sha256:captureLog.sha256})
  copy(acceptanceBinding)
  copy(policy.predecessorCandidate, true)
  const parent = boundJson(fixtureRoot, policy.predecessorCandidate)
  const policyBinding = writeExclusive(fixtureRoot, POLICY_PATH, policy)
  const outputRoot = ".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions/isolated-cpu"
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
    result = await acceptanceCommand(specification)
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
  const evidenceRoot = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/lifecycle"
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
      outputs[label] = await acceptanceCommand(specification)
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
  const [mode, logical, digest] = process.argv.slice(2)
  let result
  if (mode === "--cpu-acceptance") { assert.equal(logical, undefined); result = await accept() }
  else if (mode === "--describe-policy") {
    assert.ok(logical && digest)
    result = describePolicy({ root: process.cwd(), cpuAcceptance: {path:logical,sha256:digest},
      programBindings: await collectProgramBindings(process.cwd()) })
  } else if (mode === "--audit") result = await audit(process.cwd(), {path:logical,sha256:digest})
  else if (mode === "--reconcile") result = await reconcile(process.cwd(), {path:logical,sha256:digest}, true)
  else { assert.ok(["--cpu-preflight", "--execute"].includes(mode)); assert.equal(logical,undefined);
    result = await run({execute:mode === "--execute"}) }
  process.stdout.write(JSON.stringify(result)+"\n")
}
