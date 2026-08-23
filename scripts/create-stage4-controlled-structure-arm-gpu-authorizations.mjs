import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const fusionRunId = arg("--fusion-run-id")
const capacityRunId = arg("--capacity-run-id")
assert.match(fusionRunId ?? "", /^\d{8}-\d{9}$/)
assert.match(capacityRunId ?? "", /^\d{8}-\d{9}$/)
assert.notEqual(fusionRunId, capacityRunId)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const cpuRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/20260823-025010362")
const sources = {
  cpuTerminal: path.join(cpuRoot, "phase-terminal.json"),
  cpuReport: path.join(cpuRoot, "cpu-report.json"),
  modelStructureSupportContract: path.join(cpuRoot, "model-structure-support-contract.json"),
  parameterStructureDifferenceReport: path.join(cpuRoot, "parameter-structure-difference-report.json"),
  ownerActionRequest: path.join(cpuRoot, "owner-action-request.json"),
  baselineConfig: path.join(cpuRoot, "inactive-configs/baseline-current-formal-structure.inactive-config.json"),
  fusionConfig: path.join(cpuRoot, "inactive-configs/condition-fusion-only-final-direct-residual-23-64-12.inactive-config.json"),
  capacityConfig: path.join(cpuRoot, "inactive-configs/capacity-only-base-width-64-to-existing-level1-128.inactive-config.json"),
  modelFactory: absolute("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: absolute("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
}
const expected = {
  cpuTerminal: "0cc56de9675e304a88113528f17dceb5c417fd366cb9c3a62d2134d3426f0bda",
  cpuReport: "28c17dcb84bc81235108d922a6dfcf7130400aa0a7327f49ee35cb8fc1887d10",
  modelStructureSupportContract: "3e68e2aae9a6e82c52e97637c3469abc3d92249a9d30a16079bd85f749f4acbf",
  parameterStructureDifferenceReport: "15aaf2f577dcbab333d4f6cf09ac11ca3c5be91f76d730373d114274910f6076",
  ownerActionRequest: "2c9c0d8f41bdf566d5abe6615ac08cda7a81abb9986ed7fe8cce75ae02857ce2",
  baselineConfig: "91308d3eba4696b7229015b3045f60b84c02cf9b45abb9b8822c40fabb763ecc",
  fusionConfig: "17872dd0e4a21f87d86a349229043ac56590e9cf300de28dce90ed92848b721d",
  capacityConfig: "3465bed7c9b01e71196b972e4831bdef7d09bc7c13fe6b4cc19c779df56d717f",
  modelFactory: "6af8503ed89c49a470fc64767287a66e3c46c877587f0c14f1b7847ad116aeb5",
  modeRegistry: "ac7aa0ff10ae9dff0959cfd030314d70ed80c481d7093f1bfe336a59a1d8ea03",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
}
for (const [name, value] of Object.entries(sources)) {
  assert.equal(fs.existsSync(value), true, `${name}_missing`)
  assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)
}
const programs = {
  gpuRunner: absolute("ml/ai-painter/scripts/run_stage4_controlled_structure_arm_readonly_gpu_qualification.py"),
  cpuChecker: absolute("ml/ai-painter/scripts/check_stage4_controlled_structure_arm_gpu_entry_cpu.py"),
  authorizationMaterializer: absolute("scripts/create-stage4-controlled-structure-arm-gpu-authorizations.mjs"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true)

const checkpointPath = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
assert.equal(fs.existsSync(absolute(checkpointPath)), true)

function materialize(arm, runId, configName) {
  const requestId = `owner-authorized-stage4-controlled-structure-${arm}-${runId}`
  const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
  const consumptionPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/gpu-consumption.json`)
  const outputDirectory = `.runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/${runId}-${arm}`
  assert.equal(fs.existsSync(authorizationPath), false)
  assert.equal(fs.existsSync(consumptionPath), false)
  assert.equal(fs.existsSync(absolute(outputDirectory)), false)
  const authorization = {
    schemaVersion: "owner-authorized-stage4-controlled-structure-arm-readonly-gpu-qualification-v1",
    status: "resolved_owner_authorized_not_consumed",
    requestId,
    commandRef: requestId,
    runId,
    scope: "one_readonly_gpu_stage4_controlled_structure_arm_qualification",
    bindings: {
      cpuTerminal: bind(sources.cpuTerminal),
      cpuReport: bind(sources.cpuReport),
      modelStructureSupportContract: bind(sources.modelStructureSupportContract),
      parameterStructureDifferenceReport: bind(sources.parameterStructureDifferenceReport),
      ownerActionRequest: bind(sources.ownerActionRequest),
      baselineConfig: bind(sources.baselineConfig),
      armConfig: bind(sources[configName]),
      modelFactory: bind(sources.modelFactory),
      modeRegistry: bind(sources.modeRegistry),
      sourceIndex: bind(sources.sourceIndex),
      projectAutoencoderCheckpoint: { path: checkpointPath, sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
    },
    programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
    taskIdentity: {
      arm,
      armConfigSha256: sha(sources[configName]),
      seed: 20263722,
      imageSize: { width: 256, height: 192 },
      topology: "west",
      conditionChannelCount: 23,
      latentChannelCount: 12,
      sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
      sampleSplit: "validation",
    },
    execution: { outputDirectory, consumptionPath: relative(consumptionPath) },
    oneTimeConsumption: true,
    gpuAuthorized: true,
    checkpointWeightsReadAuthorized: true,
    denoiserCheckpointReadAuthorized: false,
    optimizerAuthorized: false,
    backwardAuthorized: false,
    trainingAuthorized: false,
    checkpointWriteAuthorized: false,
  }
  writeJsonAtomic(authorizationPath, authorization)
  return { arm, authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputDirectory }
}

const fusion = materialize("condition_fusion_only_final_direct_residual_23_64_12", fusionRunId, "fusionConfig")
const capacity = materialize("capacity_only_base_width_64_to_existing_level1_128", capacityRunId, "capacityConfig")
console.log(JSON.stringify({ status: "two_independent_readonly_gpu_authorizations_materialized", executionOrder: [fusion.arm, capacity.arm], fusion, capacity }, null, 2))
