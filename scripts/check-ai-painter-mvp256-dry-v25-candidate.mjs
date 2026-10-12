// Read-only V25 CPU candidate boundary; never grants GPU or training access.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CONTRACT = "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1.json"
const REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
const ACTIVE_SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
const HISTORICAL_SPEC = ".runtime/ai-painter/stage4-mvp-v25-successor-binding/frozen-v24-1.31/formal-spec-1.31.md"
const HISTORICAL_SPEC_SHA = "06a3b8db7b4bed22ef1b2ebbaa219b2d87688efeea36d31fb1af5bc146489dcc"
const HISTORICAL_PROGRAMS = Object.freeze({
  "v24-supervisor.mjs": "4860f0a80484476d846cfb95833b8e9d5207d8da10e8cc9fb6dc7fce6473d6a5",
  "v24-worker.py": "ef53eb6656c17c607146e3b74e7dcdc92cc7857568e109e78c5d01eebe0adb0e",
  "v24-gpu-qualifier.py": "8c5ddacc21d0c6b43d515132b5cca637bbe223cce5d17f0b91343aefd36c85bf",
  "v24-package-chain.mjs": "659ae6c326738dfada3b2ff7441282d36606358960db230b5735c7f48b2a53d7",
})
const RUN = "mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2"
const EVIDENCE_ROOT = `.runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/${RUN}`
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest" && part !== "latest.json"),
  "unsafe candidate binding path")
  const resolved = path.resolve(root, logical)
  assert.ok(resolved.startsWith(`${root}${path.sep}`), "candidate binding escaped project")
  return resolved
}

function verified(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const bytes = fs.readFileSync(inside(root, binding.path))
  assert.equal(sha(bytes), binding.sha256, `candidate binding changed: ${binding.path}`)
  return bytes
}

export function validateCandidate(candidate, facts) {
  assert.equal(candidate.schemaVersion, "stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1")
  assert.equal(candidate.status, "cpu_only_inactive_not_execution_qualified")
  assert.equal(candidate.hypothesisStatus,
    "unproven_train_fit_vs_validation_gap_not_causal_proof")
  assert.equal(candidate.capabilityVersion,
    "stage4_mvp256_dry_object_head_train_dropout_v25_cpu_candidate")
  assert.deepEqual(candidate.scope, { resolution: [256, 192], worldCount: 1,
    subjectSampleId: "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2",
    waterFactPresent: false, buildingsRequired: false,
    artificialRoadNetworkRequired: false, personalityRequired: false,
    formalStage4Qualification: false, runtimePublication: false })
  assert.equal(candidate.predecessor.candidateContract.path,
    "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")
  assert.equal(candidate.predecessor.trainingTerminal.path,
    `${EVIDENCE_ROOT}/training-finalize.json`)
  assert.equal(candidate.predecessor.failedVisualAudit.path,
    `${EVIDENCE_ROOT}/dry-review/independent-audit.json`)
  assert.equal(candidate.predecessor.trainFitDiagnostic.path,
    `${EVIDENCE_ROOT}/dry-review/selected-checkpoint-48-train-fit.json`)
  assert.deepEqual(Object.keys(candidate.candidateProgram ?? {}).sort(), ["model", "tests"])
  assert.equal(candidate.candidateProgram.model.path,
    "ml/ai-painter/src/ai_painter/complete_world/object_head_train_dropout_v25_cpu.py")
  assert.equal(candidate.candidateProgram.tests.path,
    "ml/ai-painter/tests/test_object_head_train_dropout_v25_cpu.py")
  assert.equal(candidate.predecessor.checkpointMayInitializeV25, false)
  assert.equal(candidate.predecessor.historicalGpuQualificationMayBeReused, false)
  assert.equal(facts.parent.schemaVersion, "stage4-mvp256-dry-v24-closed-loop-candidate-v1")
  assert.deepEqual(facts.parent.scope.resolution, candidate.scope.resolution)
  assert.equal(facts.parent.scope.subjectSampleId, candidate.scope.subjectSampleId)
  assert.deepEqual(facts.parent.dataUse, { train: 48, validation: 8, challenge: 4,
    regression: 4, weightUpdatesFrom: ["train"], checkpointSelectionFrom: ["validation"],
    challengeAndRegressionContentRead: false, sourceImageOrSplitMutation: false })
  assert.deepEqual(facts.parent.executionCeiling, candidate.proposedExecutionCeiling)
  assert.equal(facts.parent.review.numericThresholdOverridesAllowed, false)
  assert.equal(facts.parent.review.reviewScoresMayTrainWeightsOrChooseCheckpoint, false)
  assert.equal(facts.terminal.runId, RUN)
  assert.equal(facts.terminal.status, "training_completed_review_pending")
  assert.equal(facts.terminal.executionState, "completed")
  assert.equal(facts.terminal.selectedEpoch, 36)
  assert.equal(facts.terminal.checkpointReloadVerified, true)
  assert.equal(facts.terminal.checkpointPromotable, false)
  assert.equal(facts.terminal.formalStage4QualificationGranted, false)
  assert.equal(facts.audit.runId, RUN)
  assert.equal(facts.audit.status, "dry_single_world_review_failed_closed")
  assert.deepEqual(facts.audit.issueCodes, [
    "condition_object_rock_reference_semantic_mismatch",
    "condition_object_vegetation_reference_semantic_mismatch"])
  assert.equal(facts.audit.visualApprovalGranted, false)
  assert.equal(facts.audit.formalStage4QualificationGranted, false)
  assert.equal(facts.fit.runId, RUN)
  assert.equal(facts.fit.status, "train_fit_diagnostic_not_formal_qualified")
  assert.deepEqual(facts.fit.selectedCheckpoint, facts.terminal.selectedCheckpoint)
  assert.equal(facts.fit.boundary?.cpuOnly, true)
  assert.equal(facts.fit.boundary?.trainOnly, true)
  assert.equal(facts.fit.boundary?.optimizerSteps, 0)
  assert.equal(facts.fit.boundary?.stage4Advanced, false)
  for (const role of ["object_footprints", "object_tree", "object_rock",
                      "object_vegetation"]) {
    const summary = facts.fit.summary?.[role]
    assert.equal(summary?.applicableCount, 48)
    assert.equal(summary?.negativeOrZeroCount, 0)
    assert.ok(summary.medianCorrelation > 0 && summary.medianCorrelation <= 1)
  }
  assert.deepEqual(candidate.singleChange, {
    trainingOnly: true,
    affectedModules: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    operation: "dropout2d_on_hidden_16_channels_between_silu_and_final_conv",
    probability: 0.1, inferenceByteEquivalentToV23AtSameWeights: true,
    stateDictionaryKeysAndParameterCountUnchanged: true })
  assert.deepEqual(candidate.inheritWithoutChange, {
    datasetReleaseAndSplit: "predecessor_candidate_frozen_bindings_64_train48_validation8_challenge4_regression4",
    conditionChannels: 23, worldFactsAuthority: true, lossAndCoefficients: "v24_unchanged",
    gradientProjection: "v24_unchanged", critic: "v24_unchanged",
    checkpointSelection: "v24_unchanged", numericAndSemanticReviewThresholds: "v24_unchanged",
    sourceRgbOrConditionsModified: false })
  assert.equal(candidate.formalSpecificationStatus, "successor_section_not_yet_registered")
  assert.deepEqual(candidate.activation, {
    cpuInspectionAllowed: true, gpuQualificationAllowed: false,
    trainingAllowed: false, reviewExecutionAllowed: false,
    checkpointPromotionAllowed: false, stage4AdvancementAllowed: false,
    runtimePublicationAllowed: false })
  assert.equal(candidate.decisionRule,
    "compare_frozen_v24_and_one_v25_run_on_same_validation_and_preselected_dry_world;_if_semantics_or_fixed_validation_not_improved_close_regularization_route_without_retry")
  assert.equal(candidate.historicallyViewedValidationIsIndependentChallenge, false)
  return { status: candidate.status, gpuQualified: false, trainingStarted: false,
    stage4Advanced: false,
    activationBlockedBy: ["v25_managed_package_not_bound",
      "v25_gpu_qualifier_not_bound", "v25_training_worker_not_bound",
      "current_candidate_gpu_qualification_missing"] }
}

export function inspectSpecification(root = ROOT) {
  const historicalBytes = verified(fs.realpathSync(root),
    { path: HISTORICAL_SPEC, sha256: HISTORICAL_SPEC_SHA })
  const historicalPrograms = Object.fromEntries(Object.entries(HISTORICAL_PROGRAMS)
    .map(([name, sha256]) => {
      const binding = { path: `${path.posix.dirname(HISTORICAL_SPEC)}/${name}`, sha256 }
      verified(root, binding)
      return [name, binding]
    }))
  assert.match(historicalBytes.toString("utf8"), /^文档版本：`AI-PAINTER-SPEC-1\.31`$/mu)
  const currentBytes = fs.readFileSync(inside(root, ACTIVE_SPEC))
  const current = currentBytes.toString("utf8")
  assert.match(current, /^文档版本：`AI-PAINTER-SPEC-1\.33`$/mu)
  assert.match(current, /^替代版本：`AI-PAINTER-SPEC-1\.32`$/mu)
  assert.match(current, /^#### 9\.6\.16 单世界对象头训练态正则化后继候选$/mu)
  assert.match(current, /dropout2d\(p=0\.10\)/u)
  assert.match(current, /历史1\.31规格原字节快照/u)
  assert.match(current, /^#### 9\.6\.17 V25心跳执行故障的单次独立恢复$/mu)
  return { current: { path: ACTIVE_SPEC, sha256: sha(currentBytes) },
    historical: { path: HISTORICAL_SPEC, sha256: HISTORICAL_SPEC_SHA },
    historicalPrograms,
    registered: true, executionQualifiedByDocument: false }
}

export function inspectCandidate(root = ROOT, { checkCurrent = true } = {}) {
  const base = fs.realpathSync(root)
  const specification = inspectSpecification(base)
  const bytes = fs.readFileSync(inside(base, CONTRACT))
  const candidate = JSON.parse(bytes)
  const facts = {
    parent: JSON.parse(verified(base, candidate.predecessor.candidateContract)),
    terminal: JSON.parse(verified(base, candidate.predecessor.trainingTerminal)),
    audit: JSON.parse(verified(base, candidate.predecessor.failedVisualAudit)),
    fit: JSON.parse(verified(base, candidate.predecessor.trainFitDiagnostic)),
  }
  for (const binding of Object.values(candidate.candidateProgram)) verified(base, binding)
  const result = validateCandidate(candidate, facts)
  if (checkCurrent) {
    const registry = JSON.parse(fs.readFileSync(inside(base, REGISTRY)))
    assert.equal(registry.activeExecution, null, "active execution requires coordination")
    assert.equal(registry.latestTrainingTerminal?.runId, RUN)
    assert.deepEqual({ path: registry.latestTrainingTerminal.path,
      sha256: registry.latestTrainingTerminal.sha256 },
    candidate.predecessor.trainingTerminal)
    result.currentRegistryReviewProjection = {
      revision: registry.registryRevision,
      nextMachineAction: registry.nextMachineAction,
      auditRecordedButRegistryStillTrainingReviewPending:
        registry.activity === "training_completed_review_pending"
        && registry.nextMachineAction === "materialize_mvp256_dry_v24_selected_candidate",
    }
  }
  return { ...result, specification,
    candidateContract: { path: CONTRACT, sha256: sha(bytes) },
    predecessorRun: RUN, currentRegistryChecked: checkCurrent }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.deepEqual(process.argv.slice(2), ["--check"])
  process.stdout.write(`${JSON.stringify(inspectCandidate())}\n`)
}
