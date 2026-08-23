import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const successRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualification-successes/20260823-030433697")
const fusionRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123742-condition_fusion_only_final_direct_residual_23_64_12")
const capacityRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123743-capacity_only_base_width_64_to_existing_level1_128")
const cpuRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/20260823-025010362")
const sources = {
  priorFailureTerminal: absolute(".runtime/ai-painter/stage4-controlled-structure-smoke-contract-compilation-failures/20260823-032204189/phase-terminal.json"),
  priorFailureReport: absolute(".runtime/ai-painter/stage4-controlled-structure-smoke-contract-compilation-failures/20260823-032204189/failure-report.json"),
  closedAuthorization: absolute(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-contract-compilation-20260823-032204189/authorization.json"),
  closedConsumption: absolute(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-contract-compilation-20260823-032204189/consumption.json"),
  combinedTerminal: path.join(successRoot, "phase-terminal.json"),
  compilationOwnerRequest: path.join(successRoot, "controlled-smoke-compilation-owner-action-request.json"),
  fusionTerminal: path.join(fusionRoot, "phase-terminal.json"),
  fusionReport: path.join(fusionRoot, "gpu-report.json"),
  fusionCuda: path.join(fusionRoot, "cuda-telemetry.json"),
  fusionGradient: path.join(fusionRoot, "condition-gradient-evidence.json"),
  capacityTerminal: path.join(capacityRoot, "phase-terminal.json"),
  capacityReport: path.join(capacityRoot, "gpu-report.json"),
  capacityCuda: path.join(capacityRoot, "cuda-telemetry.json"),
  capacityGradient: path.join(capacityRoot, "condition-gradient-evidence.json"),
  baselineConfig: path.join(cpuRoot, "inactive-configs/baseline-current-formal-structure.inactive-config.json"),
  fusionConfig: path.join(cpuRoot, "inactive-configs/condition-fusion-only-final-direct-residual-23-64-12.inactive-config.json"),
  capacityConfig: path.join(cpuRoot, "inactive-configs/capacity-only-base-width-64-to-existing-level1-128.inactive-config.json"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
}
const expected = {
  priorFailureTerminal: "d2448852d6aceb4a7a33cc2c1381ebe488c95376dd6f32fa741cfbd534559640",
  priorFailureReport: "054070f80e7eb71d69717aab5d2c3aef07e4f97bec80b67189c0ddd3531a8e34",
  closedAuthorization: "26b6385e0f1a9617270392a64479875a1465dfb794d94e035dcd50784ba1c243",
  closedConsumption: "7b71ab5ed58ba3d8a16534b7561f0bd67fc9891f1b43c949aca881edc9c73474",
  combinedTerminal: "a204f06f7239ed8b953fa502dea5a358e3de60ada2532d37fc41381845bf8d78",
  fusionTerminal: "39df8b125ab6db8a4e526dfb3e2bded9ebe96987ca7e66ba514c182b99eacef7",
  fusionReport: "5baff67931aa3d18a3241947842b3fa2370db700bb908d715fe59327142da8b5",
  fusionCuda: "7cbc0a904b87ba64bcfcc4cd45ef938236ff24dfa1715ee53466ca5dc8c5b83b",
  fusionGradient: "c25cfdc30f774a573bea1de3efe55d080e3cf2f5f24bc04286dc1428a1e87bb7",
  capacityTerminal: "20dc6860b963aa07ab6ff57a6f1dcfb4790a296afb5bf75dfb2a9b8ba85ec3b3",
  capacityReport: "d039ccc1b2a6ea02ee594ded4c6a8d071688c428a45deee2c9d50171acbdb28f",
  capacityCuda: "baf79803e73ba8f92ec4530cb23c7bb0a3b24d324edbf7718a3c30121166d31a",
  capacityGradient: "f42d69faf8ce34c4291e28e3c8dcaeddbfb986cbd73a6f418ff3ceb6d704ddf9",
  baselineConfig: "91308d3eba4696b7229015b3045f60b84c02cf9b45abb9b8822c40fabb763ecc",
  fusionConfig: "17872dd0e4a21f87d86a349229043ac56590e9cf300de28dce90ed92848b721d",
  capacityConfig: "3465bed7c9b01e71196b972e4831bdef7d09bc7c13fe6b4cc19c779df56d717f",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
}
for (const [name, target] of Object.entries(sources)) {
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (expected[name]) assert.equal(sha(target), expected[name], `${name}_sha256_mismatch`)
}
assert.equal(sha(sources.compilationOwnerRequest), "fa70ff67b4d7a52b9ac41b7777ec99c0b8493f2ee99fc3f8754d1c3ac3729539")
const programs = {
  runner: absolute("scripts/run-stage4-controlled-structure-smoke-contract-compilation.mjs"),
  checker: absolute("scripts/check-stage4-controlled-structure-smoke-contract-compilation.mjs"),
  decisionLibrary: absolute("scripts/lib/ai-painter-stage4-controlled-structure-smoke-contracts.mjs"),
  materializer: absolute("scripts/create-stage4-controlled-structure-smoke-contract-compilation-authorization.mjs"),
}
for (const target of Object.values(programs)) assert.equal(fs.existsSync(target), true)
const requestId = `owner-authorized-stage4-controlled-structure-smoke-contract-compilation-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
const consumptionPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/consumption.json`)
const outputDirectory = `.runtime/ai-painter/stage4-controlled-structure-smoke-contract-compilations/${runId}`
assert.equal(fs.existsSync(authorizationPath), false)
assert.equal(fs.existsSync(consumptionPath), false)
assert.equal(fs.existsSync(absolute(outputDirectory)), false)
const authorization = {
  schemaVersion: "owner-authorized-stage4-controlled-structure-smoke-contract-compilation-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "compile_two_unsigned_unexecuted_controlled_smoke_contracts_and_cross_arm_adjudication_only",
  bindings: Object.fromEntries(Object.entries(sources).map(([name, target]) => [name, bind(target)])),
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  taskIdentity: {
    arms: ["condition_fusion_only_final_direct_residual_23_64_12", "capacity_only_base_width_64_to_existing_level1_128"],
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [1, 5, 10, 20, 30],
  },
  execution: { outputDirectory, consumptionPath: relative(consumptionPath) },
  oneTimeConsumption: true,
  contractCompilationAuthorized: true,
  ownerPrivateKeyReadAuthorized: false,
  signatureAuthorized: false,
  gpuAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  optimizerAuthorized: false,
  backwardAuthorized: false,
  smokeAuthorized: false,
  trainingAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization)
console.log(JSON.stringify({ status: "controlled_structure_smoke_contract_compilation_authorization_materialized", authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputDirectory }, null, 2))
