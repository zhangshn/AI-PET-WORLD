import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  CAPABILITY_VERSION,
  FIXED_SAMPLE_ID,
  LATE_EPOCHS,
  PREVIEW_EPOCHS,
  validateJointConditionLocalTransportFullDataScreenExecutionPlan,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

const args = process.argv.slice(2)
const planArgument = argumentValue("--plan")
assert.ok(planArgument, "--plan is required")

const projectRoot = process.cwd()
const planPath = resolveInside(projectRoot, planArgument)
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"))
validateJointConditionLocalTransportFullDataScreenExecutionPlan(plan, {
  projectRoot,
  requireFiles: true,
})

let positiveChecks = 0
let negativeChecks = 0

check(plan.capabilityVersion === CAPABILITY_VERSION, "current capability identity")
check(plan.trainingIdentity.epochCount === 24, "24 epochs")
check(plan.trainingIdentity.trainSampleCountPerEpoch === 48, "48 train samples per epoch")
check(plan.trainingIdentity.optimizerStepsPerEpoch === 48, "48 optimizer steps per epoch")
check(plan.trainingIdentity.optimizerStepCount === 24 * 48, "24 x 48 = 1152 optimizer steps")
check(plan.trainingIdentity.diffusionStepCount === 1000, "1000 diffusion timesteps")
check(plan.trainingIdentity.requiredUniqueTrainingTimestepCount === 1000, "1000 unique training timesteps")
check(plan.trainingIdentity.inferenceTimestepCount === 50, "50 inference timesteps")
check(plan.trainingIdentity.requiredExactInferenceOverlapCount === 50, "50 exact inference overlaps")
check(equal(plan.trainingIdentity.previewEpochs, PREVIEW_EPOCHS), "fixed review epochs")
check(equal(plan.trainingIdentity.lateEpochs, LATE_EPOCHS), "fixed late epochs")
check(plan.trainingIdentity.reviewSampleId === FIXED_SAMPLE_ID, "fixed sample 194 review")
check(plan.trainingIdentity.reviewSampleSplit === "validation", "sample 194 validation split")
check(plan.ownerAuthorizationRequired === false && plan.ownerResponseRequired === false, "no Owner wait")
check(plan.trainingRestartAllowed === false && plan.automaticSecondTrainingRunAllowed === false, "no automatic retraining")
check(plan.stage0AutomaticStart === false, "no Stage 0 start")
check(plan.outputRoot.endsWith(`/${plan.runId}`), "run-owned output root")
check(plan.reviewWorkRoot.endsWith(`/${plan.runId}`), "run-owned review root")

const trainerArguments = plan.commands.trainer.arguments
const requiredTrainerArguments = [
  "--config",
  "--dataset-package",
  "--autoencoder-checkpoint",
  "--output-dir",
  "--stage4-joint-condition-local-transport-full-data-screen",
  "--stage4-joint-condition-local-transport-full-data-screen-contract",
]
for (const argument of requiredTrainerArguments) {
  check(trainerArguments.includes(argument), `Trainer argument ${argument}`)
}
for (const forbidden of ["--dataset-manifest", "--source-index", "--initial-denoiser-checkpoint", "--overfit-sample-id"]) {
  check(!trainerArguments.includes(forbidden), `Trainer excludes ${forbidden}`)
}

const sourceIndex = readBound(projectRoot, plan.evidenceBindings.sourceIndex)
const sourceRows = Array.isArray(sourceIndex.samples)
  ? sourceIndex.samples
  : Array.isArray(sourceIndex.records)
    ? sourceIndex.records
    : []
check(sourceIndex.sampleCount === 116, "authority index contains 116 records")
check(sourceRows.length === 116, "authority index materializes 116 records")
const approvedRows = sourceRows.filter((row) => row.v7CapacityContributionRegistered === true)
check(approvedRows.length === 64, "authority index contains exactly 64 approved records")
check(equal(countSplits(approvedRows), plan.splitCounts), "approved split is 48/8/4/4")
const fixedReviewRows = approvedRows.filter((row) => row.sampleId === FIXED_SAMPLE_ID && row.recordId === FIXED_SAMPLE_ID)
check(fixedReviewRows.length === 1 && fixedReviewRows[0].split === "validation", "sample 194 is unique validation evidence")

const serialized = JSON.stringify(plan)
for (const forbidden of [
  "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
  "stage4-spatial-affine-full-data-screens",
  "controlled-smoke",
  "waiting_owner",
  "owner-action-request",
]) {
  check(!serialized.includes(forbidden), `plan excludes ${forbidden}`)
}

const mutations = [
  ["old capability", (value) => { value.capabilityVersion = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1" }],
  ["old output root", (value) => { value.outputRoot = `.runtime/ai-painter/stage4-spatial-affine-full-data-screens/${value.runId}` }],
  ["cross-run output", (value) => { value.outputRoot = value.outputRoot.replace(value.runId, "20260830-000000000-joint-condition-local-transport-full-data-screen") }],
  ["missing preview", (value) => { value.trainingIdentity.previewEpochs = [5, 10, 15, 20] }],
  ["duplicate preview", (value) => { value.trainingIdentity.previewEpochs = [5, 10, 15, 20, 20] }],
  ["wrong late epochs", (value) => { value.trainingIdentity.lateEpochs = [10, 20, 24] }],
  ["wrong review sample", (value) => { value.trainingIdentity.reviewSampleId = "sample-193" }],
  ["Owner wait", (value) => { value.ownerResponseRequired = true }],
  ["automatic retry", (value) => { value.automaticSecondTrainingRunAllowed = true }],
  ["training restart", (value) => { value.trainingRestartAllowed = true }],
  ["Stage 0", (value) => { value.stage0AutomaticStart = true }],
  ["wrong optimizer total", (value) => { value.trainingIdentity.optimizerStepCount = 1151 }],
  ["wrong unique timestep coverage", (value) => { value.trainingIdentity.requiredUniqueTrainingTimestepCount = 999 }],
  ["wrong inference overlap", (value) => { value.trainingIdentity.requiredExactInferenceOverlapCount = 49 }],
  ["Smoke checkpoint CLI", (value) => { value.commands.trainer.arguments.push("--initial-denoiser-checkpoint", "old-smoke.pt") }],
  ["old dataset CLI", (value) => { value.commands.trainer.arguments = value.commands.trainer.arguments.map((item) => item === "--dataset-package" ? "--dataset-manifest" : item) }],
  ["cross-run review root", (value) => { value.reviewWorkRoot = value.reviewWorkRoot.replace(value.runId, "foreign-run") }],
]

for (const [label, mutate] of mutations) {
  const changed = structuredClone(plan)
  mutate(changed)
  let rejected = false
  try {
    validateJointConditionLocalTransportFullDataScreenExecutionPlan(changed, {
      projectRoot,
      requireFiles: true,
    })
  } catch {
    rejected = true
  }
  assert.equal(rejected, true, `${label} mutation was accepted`)
  negativeChecks += 1
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  runId: plan.runId,
  positiveChecks,
  negativeChecks,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`)

function argumentValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

function check(condition, label) {
  assert.ok(condition, label)
  positiveChecks += 1
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function countSplits(rows) {
  return Object.fromEntries(
    ["train", "validation", "challenge", "regression"].map((split) => [
      split,
      rows.filter((row) => row.split === split).length,
    ]),
  )
}

function resolveInside(root, relative) {
  assert.ok(typeof relative === "string" && !path.isAbsolute(relative) && !relative.includes(".."))
  const base = path.resolve(root)
  const target = path.resolve(base, relative)
  assert.ok(target.startsWith(`${base}${path.sep}`))
  return target
}

function readBound(root, binding) {
  const absolute = resolveInside(root, binding.path)
  assert.equal(sha256File(absolute), binding.sha256)
  return JSON.parse(fs.readFileSync(absolute, "utf8"))
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}
