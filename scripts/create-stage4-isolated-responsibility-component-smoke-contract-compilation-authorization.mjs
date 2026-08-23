import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId, /^\d{8}-\d{9}$/, "run_id_invalid")
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const sources = {
  combinedTerminal: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualification-successes/20260823-165500000/phase-terminal.json"),
  qualificationPackage: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-authorizations/stage4-isolated-responsibility-component-gpu-qualification-20260823-165100000/authorization-package.json"),
  gpuEntryCpuReport: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-entry-cpu/20260823-165000000/cpu-report.json"),
  compilationOwnerActionRequest: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualification-successes/20260823-165500000/controlled-three-component-stage0-smoke-owner-action-request.json"),
  componentSupportContract: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115/component-support-contract.json"),
  evidenceIsolationReport: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115/evidence-isolation-report.json"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  terrainConfig: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115/inactive-configs/terrain-route-hydrology-spatial-realization.inactive-config.json"),
  terrainTerminal: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100001-terrain_route_hydrology_spatial_realization/phase-terminal.json"),
  terrainReport: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100001-terrain_route_hydrology_spatial_realization/gpu-report.json"),
  terrainCuda: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100001-terrain_route_hydrology_spatial_realization/cuda-telemetry.json"),
  terrainOutputIdentity: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100001-terrain_route_hydrology_spatial_realization/output-identity.json"),
  terrainParameterNamespaceIdentity: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100001-terrain_route_hydrology_spatial_realization/parameter-namespace-identity.json"),
  objectConfig: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115/inactive-configs/per-class-object-semantic-realization.inactive-config.json"),
  objectTerminal: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100002-per_class_object_semantic_realization/phase-terminal.json"),
  objectReport: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100002-per_class_object_semantic_realization/gpu-report.json"),
  objectCuda: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100002-per_class_object_semantic_realization/cuda-telemetry.json"),
  objectOutputIdentity: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100002-per_class_object_semantic_realization/output-identity.json"),
  objectParameterNamespaceIdentity: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100002-per_class_object_semantic_realization/parameter-namespace-identity.json"),
  finalConfig: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115/inactive-configs/global-visual-harmonization-native-complete-rgb-decode.inactive-config.json"),
  finalTerminal: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100003-global_visual_harmonization_and_native_complete_rgb_decode/phase-terminal.json"),
  finalReport: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100003-global_visual_harmonization_and_native_complete_rgb_decode/gpu-report.json"),
  finalCuda: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100003-global_visual_harmonization_and_native_complete_rgb_decode/cuda-telemetry.json"),
  finalOutputIdentity: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100003-global_visual_harmonization_and_native_complete_rgb_decode/output-identity.json"),
  finalParameterNamespaceIdentity: absolute(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-165100003-global_visual_harmonization_and_native_complete_rgb_decode/parameter-namespace-identity.json"),
}
const expected = {
  combinedTerminal: "4ba30bde5b34dd03509807fcea6b1fe0a8c29698bf0d22978deb931e9a653b53",
  qualificationPackage: "a5f4e74ad37df7306014c5342ec19279bf96ee6a8435c5aa6fc28483e1c9e2f2",
  gpuEntryCpuReport: "53f3bc398709eb50eafeb71ef86856df8089492cadb486705ab147f207808d85",
  compilationOwnerActionRequest: "1ccaf0c44847c141434909a5237f52d5b78565036319848e5f7722eeef0b49fb",
  componentSupportContract: "fc8dcaddbcebe7b76cebe25d8f77476ff8fe93415e94f0c9016615f358b06a7d",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
  terrainConfig: "55777458f5525f33a033008e27ae172fc4a8f06548c24ee9b669839457a06623",
  terrainTerminal: "ca36a90cc437247842abef3b9ffe04a168fdb5089b4a582ab37a721cca51371c",
  terrainReport: "378b78390d39aea42d9d52dc70748595ad0ed137ad74bacb23afaaa357857648",
  terrainCuda: "b27d397dfb80a8f6601bceed06f346584c8c5b90e2a4cf6584e9cb0b86abc6d0",
  objectConfig: "5d6039748fa29591e15518cd83397cedbb98d5a491bbbdb1a29e5e17efdf9efb",
  objectTerminal: "5144e3bc5bda0adbdcab56e0dc053ff6a04ddeb1a379ef3d4273780b6f94f9e7",
  objectReport: "a23814eb155d63e6026d50f1b02ff7fda13d007b38811bd108a9f10d6c9e037e",
  objectCuda: "56a6df9e98ba6f4eabc0d9851c6491c842cd78b4ad6df2f9a29c36c2b9cc6da4",
  finalConfig: "a97f28ddd695782cceca42514f6316d6e2191ba4cfa07a5d2e221539bc9b6c85",
  finalTerminal: "4603de96c167e6f1a225285ab4de686dfeaefcdc1344a06fbbb57b0be51e578e",
  finalReport: "fb5960d23eb963349f979d422d4e891eb39706f803e1ed0ef4a8519340795a2f",
  finalCuda: "f82c23ef56872575f938f7a0e129b0e6fc47c678398b00453a330808ad79d822",
}
for (const [name, target] of Object.entries(sources)) {
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (expected[name]) assert.equal(sha(target), expected[name], `${name}_sha256_mismatch`)
}

const programs = {
  runner: absolute("scripts/run-stage4-isolated-responsibility-component-smoke-contract-compilation.mjs"),
  checker: absolute("scripts/check-stage4-isolated-responsibility-component-smoke-contract-compilation.mjs"),
  contractLibrary: absolute("scripts/lib/ai-painter-stage4-isolated-responsibility-component-smoke-contracts.mjs"),
  materializer: absolute("scripts/create-stage4-isolated-responsibility-component-smoke-contract-compilation-authorization.mjs"),
}
for (const target of Object.values(programs)) assert.equal(fs.existsSync(target), true)

const requestId = `owner-authorized-stage4-controlled-three-component-stage0-smoke-contract-compilation-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
const consumptionPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/consumption.json`)
const outputDirectory = `.runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-contract-compilations/${runId}`
assert.equal(fs.existsSync(authorizationPath), false, "authorization_already_exists")
assert.equal(fs.existsSync(consumptionPath), false, "consumption_already_exists")
assert.equal(fs.existsSync(absolute(outputDirectory)), false, "output_directory_already_exists")

const authorization = {
  schemaVersion: "owner-authorized-stage4-controlled-three-component-stage0-smoke-contract-compilation-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "compile_one_unsigned_unexecuted_controlled_three_component_stage0_smoke_contract_only",
  bindings: Object.fromEntries(Object.entries(sources).map(([name, target]) => [name, bind(target)])),
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  taskIdentity: {
    responsibilityOrder: [
      "terrain_route_hydrology_spatial_realization",
      "per_class_object_semantic_realization",
      "global_visual_harmonization_and_native_complete_rgb_decode",
    ],
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
  gpuAuthorizationCreationAuthorized: false,
  gpuAuthorizationConsumptionAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  optimizerAuthorized: false,
  backwardAuthorized: false,
  modelWeightModificationAuthorized: false,
  smokeAuthorized: false,
  stage0Authorized: false,
  stage1Authorized: false,
  stage2Authorized: false,
  trainingAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization)
console.log(JSON.stringify({ status: "stage4_controlled_three_component_stage0_smoke_contract_compilation_authorization_materialized", authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputDirectory }, null, 2))
