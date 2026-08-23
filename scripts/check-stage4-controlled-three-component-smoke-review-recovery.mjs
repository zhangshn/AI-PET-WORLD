import fs from "node:fs"
import path from "node:path"
import { validateControlledThreeComponentSourceIndex } from "./run-stage4-controlled-three-component-stage0-smoke.mjs"

const ROOT = process.cwd()
const SOURCE_INDEX = path.resolve(ROOT, "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json")
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"

function expectFailure(name, action, expectedMessage) {
  try {
    action()
  } catch (error) {
    if (String(error?.message ?? error).includes(expectedMessage)) return { name, passed: true }
    return { name, passed: false, error: String(error?.message ?? error) }
  }
  return { name, passed: false, error: "unexpected_pass" }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function runChecks() {
  const sourceIndex = JSON.parse(fs.readFileSync(SOURCE_INDEX, "utf8"))
  const positive = []
  const negative = []

  const identity = validateControlledThreeComponentSourceIndex(sourceIndex)
  positive.push({
    name: "formal_source_index_object_and_fixed_validation_sample",
    passed: identity.sample.sampleId === SAMPLE_ID && identity.sample.split === "validation",
  })
  positive.push({
    name: "source_index_and_approved_capacity_are_distinct",
    passed: sourceIndex.sampleCount === 116 && sourceIndex.v7CapacityContributionCount === 64,
  })

  negative.push(expectFailure("reject_top_level_array", () => validateControlledThreeComponentSourceIndex([]), "source_index_contract_invalid"))
  const missingSamples = clone(sourceIndex); delete missingSamples.samples
  negative.push(expectFailure("reject_missing_samples", () => validateControlledThreeComponentSourceIndex(missingSamples), "source_index_contract_invalid"))
  const duplicateSample = clone(sourceIndex); duplicateSample.samples.push(clone(identity.sample)); duplicateSample.sampleCount += 1
  negative.push(expectFailure("reject_duplicate_fixed_sample", () => validateControlledThreeComponentSourceIndex(duplicateSample), "source_index_contract_invalid"))
  const duplicateWithinDeclaredCount = clone(sourceIndex); duplicateWithinDeclaredCount.samples[0] = clone(identity.sample)
  negative.push(expectFailure("reject_duplicate_identity_without_count_change", () => validateControlledThreeComponentSourceIndex(duplicateWithinDeclaredCount), "sample_identity_invalid"))
  const wrongSplit = clone(sourceIndex); wrongSplit.samples.find((row) => row.sampleId === SAMPLE_ID).split = "train"
  negative.push(expectFailure("reject_wrong_split", () => validateControlledThreeComponentSourceIndex(wrongSplit), "sample_identity_invalid"))
  const missingContribution = clone(sourceIndex); missingContribution.v7CapacityContributions = missingContribution.v7CapacityContributions.filter((row) => row.sampleId !== SAMPLE_ID); missingContribution.v7CapacityContributionCount -= 1
  negative.push(expectFailure("reject_missing_capacity_identity", () => validateControlledThreeComponentSourceIndex(missingContribution), "source_index_contract_invalid"))

  const runnerSource = fs.readFileSync(path.resolve(ROOT, "scripts/run-stage4-controlled-three-component-smoke-review-recovery.mjs"), "utf8")
  positive.push({ name: "review_only_runner_has_no_training_process_launch", passed: !/\bspawn(?:Sync)?\s*\(/.test(runnerSource) })
  positive.push({ name: "review_only_runner_has_no_checkpoint_read", passed: !/readFileSync\([^\n]*\.pt/i.test(runnerSource) })
  positive.push({ name: "review_only_runner_has_no_optimizer_or_backward", passed: !/\.backward\s*\(|create[_A-Za-z]*optimizer|new\s+\w*Optimizer/i.test(runnerSource) })

  const checks = [...positive, ...negative]
  return {
    schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-cpu-report-v1",
    status: checks.every((row) => row.passed) ? "passed" : "failed_closed",
    positive,
    negative,
    summary: { passed: checks.filter((row) => row.passed).length, total: checks.length },
    prohibitions: {
      checkpointWeightsRead: false,
      gpuStarted: false,
      optimizerCreated: false,
      backwardExecuted: false,
      trainingStarted: false,
    },
    recordedAtUtc: new Date().toISOString(),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)))) {
  const report = runChecks()
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exit(report.status === "passed" ? 0 : 1)
}
