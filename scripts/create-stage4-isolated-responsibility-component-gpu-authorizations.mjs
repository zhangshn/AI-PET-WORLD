import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const packageRunId = arg("--package-run-id")
const gpuEntryCpuReportArg = arg("--gpu-entry-cpu-report")
const roleRunIds = [arg("--terrain-run-id"), arg("--object-run-id"), arg("--final-run-id")]
assert.match(packageRunId ?? "", /^\d{8}-\d{9}$/)
for (const value of roleRunIds) assert.match(value ?? "", /^\d{8}-\d{9}$/)
assert.equal(new Set(roleRunIds).size, 3)
assert.ok(gpuEntryCpuReportArg)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const cpuRoot = absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115")
const roles = [
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
]
const configNames = [
  "terrain-route-hydrology-spatial-realization.inactive-config.json",
  "per-class-object-semantic-realization.inactive-config.json",
  "global-visual-harmonization-native-complete-rgb-decode.inactive-config.json",
]
const sources = {
  cpuTerminal: path.join(cpuRoot, "phase-terminal.json"),
  cpuReport: path.join(cpuRoot, "cpu-report.json"),
  componentSupportContract: path.join(cpuRoot, "component-support-contract.json"),
  parameterStructureReport: path.join(cpuRoot, "parameter-structure-difference-report.json"),
  evidenceIsolationReport: path.join(cpuRoot, "evidence-isolation-report.json"),
  ownerActionRequest: path.join(cpuRoot, "owner-action-request.json"),
  modelFactory: absolute("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: absolute("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  gpuEntryCpuReport: absolute(gpuEntryCpuReportArg),
  parameterSubsetCorrectionTerminal: absolute(".runtime/ai-painter/stage4-terrain-formal-parameter-subset-corrections/20260823-164200000/phase-terminal.json"),
  parameterGraphReport: absolute(".runtime/ai-painter/stage4-terrain-parameter-graph-boundary-adjudications/20260823-163616798/parameter-graph-report.json"),
  parameterGraphDecision: absolute(".runtime/ai-painter/stage4-terrain-parameter-graph-boundary-adjudications/20260823-163616798/decision.json"),
  parameterSubsetCpuReport: absolute(".runtime/ai-painter/stage4-terrain-formal-parameter-subset-cpu-supports/20260823-164000000/cpu-report.json"),
  parameterSubsetSupportContract: absolute(".runtime/ai-painter/stage4-terrain-formal-parameter-subset-corrections/20260823-164200000/formal-parameter-subset-support-contract.json"),
  parameterSubsetOwnerActionRequest: absolute(".runtime/ai-painter/stage4-terrain-formal-parameter-subset-corrections/20260823-164200000/owner-action-request.json"),
}
const expected = {
  cpuTerminal: "70c60698936d82e2d702e2cf86bbddf96d9358c716f2c6d5e875bca2fcd23acd",
  cpuReport: "5b9c6b3387f87285ce41bcea4524344b593d438339bdceff4d55778f200b8893",
  componentSupportContract: "fc8dcaddbcebe7b76cebe25d8f77476ff8fe93415e94f0c9016615f358b06a7d",
  parameterStructureReport: "51a0becd8454e9ef4b3ef16d0e45336e9efe0645bd6bc6f71e338351658fae89",
  evidenceIsolationReport: "1cb8edca3af762098ca1aa397a683c522e33db113ede7456c0641cac1212544c",
  ownerActionRequest: "11719c3f825ec2ca35eef8d1ff1557c2c069c48e1c3b83851e6bef6db3551a2d",
  modelFactory: "66b656e00aab1a2796c219fe85efe8331b972f674f5ce7bce2adee4d800f1527",
  modeRegistry: "54cad8a924ee12fe70777a7896b691c794e3baf9e24cf4dbcaa871dd486a8f2a",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
  parameterSubsetCorrectionTerminal: "125535109a2eb1f9fe7fedd7e3836fc370e77dd7dfa01cd227a172b98d3d91cf",
  parameterGraphReport: "f3c3e0090f304e121ee56ad11c472ac4a5a9bc4160a3116212f8d506bebe8ff0",
  parameterGraphDecision: "924210b8a4533603ed90656e497b5f5ccbf275c3ea77bcac244b076e47000ad9",
  parameterSubsetCpuReport: "53f3bc398709eb50eafeb71ef86856df8089492cadb486705ab147f207808d85",
  parameterSubsetSupportContract: "4d03f9d7b1b43b3cc939ff647a42a5754ee5b2fd0e9e254121b58cc8689df982",
  parameterSubsetOwnerActionRequest: "973c0f83554bb8143a5ed0511b15afc25927e8121f4b4614094ded8784a6fa16",
}
for (const [name, value] of Object.entries(sources)) {
  assert.equal(fs.existsSync(value), true, `${name}_missing`)
  if (name === "gpuEntryCpuReport") {
    assert.equal(JSON.parse(fs.readFileSync(value, "utf8")).status, "passed", "gpu_entry_cpu_report_not_passed")
  } else {
    assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)
  }
}
const configs = configNames.map((name) => path.join(cpuRoot, "inactive-configs", name))
const configHashes = [
  "55777458f5525f33a033008e27ae172fc4a8f06548c24ee9b669839457a06623",
  "5d6039748fa29591e15518cd83397cedbb98d5a491bbbdb1a29e5e17efdf9efb",
  "a97f28ddd695782cceca42514f6316d6e2191ba4cfa07a5d2e221539bc9b6c85",
]
configs.forEach((value, index) => assert.equal(sha(value), configHashes[index], `component_config_${index}_sha256_mismatch`))
const checkpointPath = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
assert.equal(sha(absolute(checkpointPath)), "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba")
const programs = {
  gpuRunner: absolute("ml/ai-painter/scripts/run_stage4_isolated_responsibility_component_readonly_gpu_qualification.py"),
  cpuChecker: absolute("ml/ai-painter/scripts/check_stage4_isolated_responsibility_component_gpu_entry_cpu.py"),
  authorizationMaterializer: absolute("scripts/create-stage4-isolated-responsibility-component-gpu-authorizations.mjs"),
  successRecorder: absolute("scripts/record-stage4-isolated-responsibility-component-gpu-qualification-success.mjs"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true)
assert.equal(sha(programs.gpuRunner), "626126e84ac393a4120a13097a76c2034b9893f126724abf59b1767afd589d0d")
assert.equal(sha(programs.cpuChecker), "578dcf2c65bd2d0ad84956ba386b621ca2124e03f991d3ddb4ea76178ca5296e")

const packageId = `stage4-isolated-responsibility-component-gpu-qualification-${packageRunId}`
const packageRoot = absolute(`.runtime/ai-painter/stage4-isolated-responsibility-component-gpu-authorizations/${packageId}`)
assert.equal(fs.existsSync(packageRoot), false)
fs.mkdirSync(packageRoot, { recursive: true })
const outputs = roles.map((role, index) => `.runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/${roleRunIds[index]}-${role}`)

function materialize(role, index) {
  const requestId = `owner-authorized-${packageId}-${role}`
  const roleRoot = path.join(packageRoot, `${index + 1}-${role}`)
  fs.mkdirSync(roleRoot, { recursive: false })
  const authorizationPath = path.join(roleRoot, "authorization.json")
  const consumptionPath = path.join(roleRoot, "gpu-consumption.json")
  assert.equal(fs.existsSync(absolute(outputs[index])), false)
  const predecessor = index === 0
    ? { kind: "authoritative_world_structure_binding", sameQualificationPackageRequired: true }
    : {
        roleId: roles[index - 1],
        sameQualificationPackageRequired: true,
        terminalPath: `${outputs[index - 1]}/phase-terminal.json`,
        outputEvidencePath: `${outputs[index - 1]}/output-identity.json`,
      }
  const authorization = {
    schemaVersion: "owner-authorized-stage4-isolated-responsibility-component-readonly-gpu-qualification-v1",
    status: "resolved_owner_authorized_not_consumed",
    qualificationPackageId: packageId,
    requestId,
    commandRef: requestId,
    runId: roleRunIds[index],
    scope: "one_readonly_gpu_stage4_isolated_responsibility_component_qualification",
    bindings: {
      ...Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])),
      componentConfig: bind(configs[index]),
      projectAutoencoderCheckpoint: { path: checkpointPath, sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
    },
    programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
    taskIdentity: {
      roleId: role,
      roleIndex: index,
      roleOrder: roles,
      componentConfigSha256: configHashes[index],
      seed: 20263722,
      imageSize: { width: 256, height: 192 },
      topology: "west",
      conditionChannelCount: 23,
      latentChannelCount: 12,
      trainSampleId: "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
      validationSampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    },
    predecessor,
    execution: { outputDirectory: outputs[index], consumptionPath: relative(consumptionPath) },
    oneTimeConsumption: true,
    gpuAuthorized: true,
    checkpointWeightsReadAuthorized: true,
    denoiserCheckpointReadAuthorized: false,
    optimizerAuthorized: false,
    backwardAuthorized: false,
    modelWeightModificationAuthorized: false,
    checkpointWriteAuthorized: false,
    smokeAuthorized: false,
    trainingAuthorized: false,
    stage0Authorized: false,
    stage1Authorized: false,
    stage2Authorized: false,
  }
  writeJsonAtomic(authorizationPath, authorization)
  return { roleId: role, runId: roleRunIds[index], authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputDirectory: outputs[index] }
}

const authorizations = roles.map(materialize)
const manifestPath = path.join(packageRoot, "authorization-package.json")
writeJsonAtomic(manifestPath, {
  schemaVersion: "stage4-isolated-responsibility-component-gpu-authorization-package-v1",
  status: "three_independent_readonly_gpu_authorizations_materialized_unconsumed",
  packageId,
  executionOrder: roles,
  stopOnFailure: true,
  authorizations,
  recordedAtUtc: new Date().toISOString(),
})
console.log(JSON.stringify({ status: "three_independent_readonly_gpu_authorizations_materialized_unconsumed", packageId, packageManifest: bind(manifestPath), authorizations }, null, 2))
