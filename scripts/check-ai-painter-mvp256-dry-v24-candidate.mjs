// CPU-only candidate boundary check. This never activates training or review.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const CONTRACT = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
const SOURCE_RUN = "v24-resource-bound-core-priority-049a77d0f96ffff8eb1ee4b2363e28f1802ab0bf4fbd6a15"
const SOURCE_TERMINAL = `.runtime/ai-painter/learning-capacity-experiments/${SOURCE_RUN}/terminal.json`
const CURRENT = ".runtime/ai-painter/current-execution-registry/current.json"
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest" && part !== "latest.json"),
  "unsafe project-relative binding")
  const resolved = path.resolve(root, logical)
  assert.ok(resolved.startsWith(`${root}${path.sep}`), "binding escaped project")
  return resolved
}

function verified(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const bytes = fs.readFileSync(inside(root, binding.path))
  assert.equal(hash(bytes), binding.sha256, `binding changed: ${binding.path}`)
  return JSON.parse(bytes.toString("utf8"))
}

export function validateCandidate(contract, inputs) {
  assert.equal(contract.schemaVersion, "stage4-mvp256-dry-v24-closed-loop-candidate-v1")
  assert.equal(contract.status, "cpu_candidate_not_execution_qualified")
  assert.equal(contract.capabilityVersion, "stage4_mvp256_dry_v24_closed_loop_candidate_v1")
  assert.deepEqual(contract.scope.resolution, [256, 192])
  assert.equal(contract.scope.worldCount, 1)
  assert.equal(contract.scope.subjectSampleId, inputs.dryScope.preselectedSubject.sampleId)
  assert.equal(contract.scope.subjectSplit, "validation")
  assert.equal(contract.scope.waterFactPresent, false)
  assert.equal(inputs.dryScope.preselectedSubject.worldFactHasWater, false)
  assert.equal(inputs.dryScope.preselectedSubject.conditionWaterPixelCount, 0)
  assert.equal(inputs.dryScope.preselectedSubject.conditionShorelinePixelCount, 0)
  for (const key of ["buildingsRequired", "artificialRoadNetworkRequired", "personalityRequired",
    "formalStage4Qualification", "runtimePublication"])
    assert.equal(contract.scope[key], false, `${key} escaped dry MVP scope`)
  assert.deepEqual(inputs.manifest.splitCounts,
    { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(inputs.manifest.qualification.dataQualifiedForTraining, true)
  assert.equal(inputs.manifest.qualification.executionQualified, false)
  assert.equal(inputs.manifest.qualification.trainingAllowed, false)
  assert.deepEqual(contract.frozenBindings.trainSplit, inputs.manifest.splits.train)
  assert.deepEqual(contract.frozenBindings.validationSplit, inputs.manifest.splits.validation)
  assert.equal(inputs.train.sampleIds.length, 48)
  assert.equal(inputs.validation.sampleIds.length, 8)
  assert.equal(new Set([...inputs.train.sampleIds, ...inputs.validation.sampleIds]).size, 56)
  assert.ok(inputs.validation.sampleIds.includes(contract.scope.subjectSampleId))
  assert.equal(inputs.sourcePolicy.status, "active_single_bounded_train_only_exposure_experiment")
  assert.deepEqual(contract.dataUse,
    { train: 48, validation: 8, challenge: 4, regression: 4,
      weightUpdatesFrom: ["train"], checkpointSelectionFrom: ["validation"],
      challengeAndRegressionContentRead: false, sourceImageOrSplitMutation: false })
  assert.deepEqual(contract.checkpointSelection.eligibleEpochs, [24, 36, 48])
  assert.equal(contract.checkpointSelection.validationRowsPerEligibleEpoch, 8)
  assert.equal(contract.checkpointSelection.firstCriterion,
    "maximum_worst_applicable_object_class_masked_luminance_correlation")
  assert.equal(contract.checkpointSelection.secondCriterion, "minimum_mean_validation_rgb_mae")
  assert.equal(contract.checkpointSelection.thirdCriterion, "earliest_epoch")
  assert.equal(contract.checkpointSelection.allFourNaturalObjectClassesMustHaveValidationCoverage, true)
  for (const key of ["validationMayUpdateWeights", "historicalV24CheckpointMayInitializeTraining"])
    assert.equal(contract.checkpointSelection[key], false)
  assert.equal(contract.checkpointSelection.selectedCheckpointMustReloadExactly, true)
  assert.deepEqual(contract.executionCeiling,
    { trainingAttempts: 1, automaticRetries: 0, epochs: 48,
      generatorOptimizerSteps: 2304, discriminatorOptimizerSteps: 2304,
      maxWallSeconds: 2700, maxGpuMemoryFraction: 0.7, maximumTemperatureC: 85,
      minimumFreeVramMiB: 2048, minimumFreeDiskMiB: 2048, maxOutputMiB: 128,
      cpuThreads: 2 })
  assert.equal(contract.review.candidateCount, 1)
  assert.equal(contract.review.subjectMustBePreselected, true)
  assert.deepEqual(contract.review.required, [
    "source_and_world_fact_identity",
    "native_256x192_complete_rgb_from_selected_checkpoint",
    "seven_responsibility_outputs_bound_to_same_candidate",
    "applicable_terrain_and_natural_object_semantics",
    "absence_of_hallucinated_water",
    "professional_aesthetic",
    "minimum_detail",
  ])
  assert.equal(contract.review.positiveWaterAndShorelineCapability, "unverified_not_passed")
  assert.equal(contract.review.numericThresholdOverridesAllowed, false)
  assert.equal(contract.review.numericPassIsVisualApproval, false)
  assert.equal(contract.review.historicallyViewedValidationIsIndependentChallenge, false)
  assert.equal(contract.review.reviewScoresMayTrainWeightsOrChooseCheckpoint, false)
  for (const value of Object.values(contract.activation))
    assert.equal(typeof value, "boolean")
  assert.equal(contract.activation.cpuPreflightAllowed, true)
  for (const key of ["gpuQualificationAllowed", "trainingAllowed", "reviewExecutionAllowed",
    "checkpointPromotionAllowed", "formalStageAdvancementAllowed", "runtimePublicationAllowed"])
    assert.equal(contract.activation[key], false, `${key} granted prematurely`)
  assert.equal(inputs.numericReview.status, "cpu_supported_inactive")
  assert.equal(inputs.detailReview.status, "active_readonly_false_positive_safety_gate")
  assert.equal(inputs.terminal.runId, SOURCE_RUN)
  assert.equal(inputs.terminal.status, "experiment_completed_not_formal_qualified")
  assert.equal(inputs.terminal.checkpointPromotable, false)
  assert.equal(contract.historicalV24,
    "diagnostic_predecessor_only_not_parent_checkpoint_or_qualification")
  return { status: "cpu_candidate_boundary_valid_not_execution_qualified",
    capabilityVersion: contract.capabilityVersion, drySubject: contract.scope.subjectSampleId,
    splitCounts: inputs.manifest.splitCounts, checkpointEpochs: contract.checkpointSelection.eligibleEpochs,
    gpuStarted: false, trainingStarted: false, stage4Advanced: false }
}

export function inspectCandidate(root, { checkCurrent = true } = {}) {
  const base = fs.realpathSync(root)
  const contractBytes = fs.readFileSync(inside(base, CONTRACT))
  const contract = JSON.parse(contractBytes.toString("utf8"))
  const b = contract.frozenBindings
  const inputs = {
    dryScope: verified(base, b.dryScope),
    sourcePolicy: verified(base, b.sourcePolicy),
    manifest: verified(base, b.datasetManifest),
    train: verified(base, b.trainSplit),
    validation: verified(base, b.validationSplit),
    numericReview: verified(base, b.numericReview),
    detailReview: verified(base, b.detailReview),
    terminal: JSON.parse(fs.readFileSync(inside(base, SOURCE_TERMINAL), "utf8")),
  }
  const result = validateCandidate(contract, inputs)
  if (checkCurrent) {
    const registry = JSON.parse(fs.readFileSync(inside(base, CURRENT), "utf8"))
    assert.equal(registry.activeExecution, null, "active run requires separate coordination")
    assert.equal(registry.latestTrainingTerminal?.runId, SOURCE_RUN,
      "V24 is not the latest registered training terminal")
    assert.equal(registry.latestTrainingTerminal?.sha256,
      hash(fs.readFileSync(inside(base, SOURCE_TERMINAL))), "registered V24 terminal changed")
  }
  return { ...result, contract: { path: CONTRACT, sha256: hash(contractBytes) },
    currentRegistryChecked: checkCurrent }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.deepEqual(process.argv.slice(2), ["--check"])
  process.stdout.write(`${JSON.stringify(inspectCandidate(process.cwd()))}\n`)
}
