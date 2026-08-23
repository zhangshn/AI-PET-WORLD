import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const hotRoot = path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime")
const resolvePath = (value) => {
  const normalized = String(value).replaceAll("\\", "/")
  return normalized === ".runtime" || normalized.startsWith(".runtime/")
    ? path.join(hotRoot, normalized === ".runtime" ? "" : normalized.slice(9))
    : path.resolve(root, value)
}
const projectPath = (value) => {
  const absolute = path.resolve(value)
  const relativeHot = path.relative(hotRoot, absolute)
  if (relativeHot === "" || (!relativeHot.startsWith("..") && !path.isAbsolute(relativeHot))) {
    return relativeHot ? `.runtime/${relativeHot.replaceAll("\\", "/")}` : ".runtime"
  }
  return path.relative(root, absolute).replaceAll("\\", "/")
}
const hash = (value) => createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(resolvePath(value), "utf8"))
const bind = (value) => ({ path: projectPath(resolvePath(value)), sha256: hash(value) })
const write = (value, data) => {
  const target = resolvePath(value)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

const sourceRoot = ".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/20260823-025010362"
const sources = {
  priorCrossArmTerminal: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-050000000/phase-terminal.json",
  priorCrossArmReport: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-050000000/cross-arm-comparison-report.json",
  priorCrossArmDecision: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-050000000/cross-arm-adjudication.json",
  priorOwnerActionRequest: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-050000000/owner-action-request.json",
  supportTerminal: `${sourceRoot}/phase-terminal.json`,
  supportContract: `${sourceRoot}/model-structure-support-contract.json`,
  supportCpuReport: `${sourceRoot}/cpu-report.json`,
  fusionConfig: `${sourceRoot}/inactive-configs/condition-fusion-only-final-direct-residual-23-64-12.inactive-config.json`,
  capacityConfig: `${sourceRoot}/inactive-configs/capacity-only-base-width-64-to-existing-level1-128.inactive-config.json`,
}
const expected = {
  priorCrossArmTerminal: "4e8a60d435cc81fb94ebbd6c5a5e7dd50093c737dbc814230a21b147dcf32817",
  priorCrossArmReport: "c0637cc0339f09e1ddb8fd3c269f283762330c7f94bc53f9a1af05f9300c4c5c",
  priorCrossArmDecision: "184df72240bb57d4aa6fa49d1f4a3472a4663be72ca12d333536249e4c1f3cc1",
  priorOwnerActionRequest: "97ed0d42d53f111c2c67349668a5afa01469162dea973bf5d1ce8b52e4dc9bfa",
  supportTerminal: "0cc56de9675e304a88113528f17dceb5c417fd366cb9c3a62d2134d3426f0bda",
  supportContract: "3e68e2aae9a6e82c52e97637c3469abc3d92249a9d30a16079bd85f749f4acbf",
  supportCpuReport: "28c17dcb84bc81235108d922a6dfcf7130400aa0a7327f49ee35cb8fc1887d10",
  fusionConfig: "17872dd0e4a21f87d86a349229043ac56590e9cf300de28dce90ed92848b721d",
  capacityConfig: "3465bed7c9b01e71196b972e4831bdef7d09bc7c13fe6b4cc19c779df56d717f",
}
for (const [name, value] of Object.entries(sources)) {
  if (!fs.existsSync(resolvePath(value)) || hash(value) !== expected[name]) throw new Error(`bound source changed:${name}`)
}

const output = `.runtime/ai-painter/stage4-controlled-structure-smoke-entry-integrations/${runId}`
if (fs.existsSync(resolvePath(output))) throw new Error("integration output already exists")
const ownerRoot = `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-entry-${runId}`
const authorizationPath = `${ownerRoot}/implementation-authorization.json`
const consumptionPath = `${ownerRoot}/implementation-consumption.json`
const requestId = `owner-authorized-stage4-controlled-structure-smoke-entry-${runId}`
write(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-controlled-structure-smoke-entry-implementation-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  scope: "implement_controlled_smoke_immutable_training_resource_telemetry_then_execute_two_fresh_smokes",
  sourceCommandEvidence: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])),
  permittedChanges: ["smoke_runner", "cpu_checker", "fresh_contract_and_authorization_materialization", "immutable_training_resource_telemetry"],
  forbiddenChanges: ["trainer", "mode_registry", "model_factory", "model_structure", "loss_values", "loss_weights", "dataset", "split", "checkpoint_format", "machine_review_thresholds"],
  oneTimeConsumption: true,
})
write(consumptionPath, {
  schemaVersion: "stage4-controlled-structure-smoke-entry-implementation-consumption-v1",
  status: "implementation_authorization_atomically_consumed",
  requestId,
  commandRef: requestId,
  scope: read(authorizationPath).scope,
  authorizationPath,
  authorizationSha256: hash(authorizationPath),
  oneTimeConsumption: true,
  consumedAtUtc: new Date().toISOString(),
})

const normalize = (source, destination) => {
  const config = structuredClone(read(source))
  const training = config.training
  training.trainingAuthorizationStatus = "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
  training.denoiserEpochs = 30
  delete training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs
  delete training.factConditionedSemanticMixtureStage4FullTrainingContract
  delete training.factConditionedSemanticMixtureStage4SingleSampleSmokeContract
  delete training.factConditionedSemanticMixtureStage4SmokeExecution
  delete training.stage4UnifiedTrainingPreviewSamplingContract
  for (const [name, contract] of Object.entries(training)) {
    if (!contract || typeof contract !== "object" || !contract.activationGate) continue
    contract.status = name === "stage4FactConditionedSemanticMixture"
      ? "cpu_support_verified_not_active"
      : "cpu_support_verified_inactive"
    if (name === "stage4FactConditionedSemanticMixture") contract.enabled = false
    for (const gate of Object.keys(contract.activationGate)) contract.activationGate[gate] = false
  }
  training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
  training.stage4FailureDiagnostics.trainingConfigApplied = false
  training.stage4FailureDiagnostics.checkpointFileReadAuthorized = false
  training.stage4FailureDiagnostics.gpuUseAuthorized = false
  training.stage4FailureDiagnostics.trainingAuthorized = false
  training.ownerTrainingAuthorization = {
    status: "not_authorized_cpu_support_only",
    checkpointLoadingAuthorized: false, optimizerCreationAuthorized: false,
    backwardExecutionAuthorized: false, modelWeightMutationAuthorized: false,
    gpuTrainingAuthorizedNow: false, singleSampleGpuOverfitSmokeAuthorized: false,
    fullTrainingAuthorized: false, stage1Authorized: false, stage2Authorized: false,
    strictRevalidationAuthorized: false, validationAuthorized: false,
    formalInferenceAuthorized: false, checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false, worldEntryAuthorized: false,
    automaticRetryAuthorized: false,
  }
  if (
    !["condition_fusion_only_final_direct_residual_23_64_12", "capacity_only_base_width_64_to_existing_level1_128"].includes(config.stage4ControlledStructureArm)
    || training.stage4ControlledStructureThreeArm.armId !== config.stage4ControlledStructureArm
    || Object.values(training.stage4ControlledStructureThreeArm.activationGate).some(Boolean)
  ) throw new Error("controlled structure inactive identity changed")
  write(destination, config)
}
const fusion = `${output}/inactive-fusion-smoke-config.json`
const capacity = `${output}/inactive-capacity-smoke-config.json`
normalize(sources.fusionConfig, fusion)
normalize(sources.capacityConfig, capacity)
write(`${output}/preparation-terminal.json`, {
  schemaVersion: "stage4-controlled-structure-smoke-entry-preparation-terminal-v1",
  status: "stage4_controlled_structure_smoke_entry_prepared_cpu_only",
  runId,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  fusionConfig: bind(fusion),
  capacityConfig: bind(capacity),
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false,
  gpuStarted: false, trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
})
console.log(JSON.stringify({
  status: "stage4_controlled_structure_smoke_entry_prepared_cpu_only",
  output,
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  fusionConfig: bind(fusion), capacityConfig: bind(capacity),
}, null, 2))
