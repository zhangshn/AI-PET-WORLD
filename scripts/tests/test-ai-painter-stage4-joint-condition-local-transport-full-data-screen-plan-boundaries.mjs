import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"

import { validateJointConditionLocalTransportFullDataScreenExecutionPlan as validate } from "../lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

const planPath = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-contract-compilations/stage4-joint-full-data-screen-compilation-20260830022124154/execution-plan.json"
const historical = JSON.parse(fs.readFileSync(planPath, "utf8"))
validate(historical, { projectRoot: process.cwd(), requireFiles: false })
const source = rebindCurrentPrograms(structuredClone(historical))
validate(source, { projectRoot: process.cwd(), requireFiles: true })

const mutations = [
  ["late_epoch_drift", (plan) => { plan.trainingIdentity.lateEpochs = [10, 20, 24] }],
  ["preview_epoch_drift", (plan) => { plan.trainingIdentity.previewEpochs = [1, 5, 10, 20, 24] }],
  ["foreign_review_root", (plan) => { plan.reviewWorkRoot = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-review-work/foreign-run" }],
  ["foreign_output_root", (plan) => { plan.outputRoot = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/foreign-run" }],
  ["incomplete_training_timestep_coverage", (plan) => { plan.trainingIdentity.requiredUniqueTrainingTimestepCount = 999 }],
  ["incomplete_inference_overlap", (plan) => { plan.trainingIdentity.requiredExactInferenceOverlapCount = 49 }],
  ["invented_epochs_cli", (plan) => { plan.commands.trainer.arguments.push("--epochs", "24") }],
  ["retired_dataset_manifest_cli", (plan) => { plan.commands.trainer.arguments[plan.commands.trainer.arguments.indexOf("--dataset-package")] = "--dataset-manifest" }],
]

const rejected = []
for (const [name, mutate] of mutations) {
  const candidate = structuredClone(source)
  mutate(candidate)
  assert.throws(() => validate(candidate, { projectRoot: process.cwd(), requireFiles: true }), undefined, `${name} was accepted`)
  rejected.push(name)
}

process.stdout.write(`${JSON.stringify({ status: "passed", positive: 1, negative: rejected.length, rejected, gpuStarted: false, trainingStarted: false }, null, 2)}\n`)

function rebindCurrentPrograms(plan) {
  for (const command of [...plan.commands.preflight, plan.commands.activation, plan.commands.trainer]) {
    command.program.sha256 = crypto.createHash("sha256").update(fs.readFileSync(command.program.path)).digest("hex")
  }
  return plan
}
