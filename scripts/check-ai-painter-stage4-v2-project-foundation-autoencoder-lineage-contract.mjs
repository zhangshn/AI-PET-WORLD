import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SCRIPT_DIR, "..")
const CONTRACT_PATH = "data/ai-painter/system-governance/ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1.json"
const CONTRACT_SHA256 = "0bd33d11175f33e7b2fc684d84e1dc9e837d4c26d0961b4ac5f7e26c6c8534ea"
const ARCHITECTURE_ID = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const CHECKPOINT_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const CHECKPOINT_BYTES = 10137309
const MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/manifest.json"
const MANIFEST_SHA256 = "e03a7a118e3f3b550745f3a1ebeeef376cd2fbb950fb360ad2b19f64e77de0b3"
const MODEL_FACTORY_PATH = "ml/ai-painter/src/ai_painter/complete_world/model.py"
const MODEL_FACTORY_SHA256 = "22d4d980be37b2c706c6ba7dbe5deb7d0f2f7a060e11af19024f96ffd2aa6bd0"
const LOADING_PROOF_PROGRAM_PATH = "ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py"
const LOADING_PROOF_PROGRAM_SHA256 = "d331417e87f544194e3efb631f4b4ed5d187cbc75d1990bb7b4e32b5e8826adf"

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function resolveProjectFile(relativePath) {
  assert.equal(typeof relativePath, "string", "path must be a string")
  assert(relativePath.length > 0, "path must not be empty")
  assert(!path.isAbsolute(relativePath), `absolute path is forbidden: ${relativePath}`)
  assert(
    !/(^|[\\/])latest(?:\.json)?(?:[\\/]|$)/i.test(relativePath),
    `latest pointer is forbidden: ${relativePath}`,
  )
  const resolved = path.resolve(ROOT, relativePath)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project root: ${relativePath}`,
  )
  assert(fs.existsSync(resolved), `file is missing: ${relativePath}`)
  assert(fs.statSync(resolved).isFile(), `path is not a file: ${relativePath}`)
  return resolved
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveProjectFile(relativePath), "utf8"))
}

function sha256FileBytes(relativePath) {
  return sha256Bytes(fs.readFileSync(resolveProjectFile(relativePath)))
}

async function sha256FileStream(relativePath) {
  const hash = crypto.createHash("sha256")
  const stream = fs.createReadStream(resolveProjectFile(relativePath))
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest("hex")
}

function assertNoLatestArtifactPath(value, location = "contract") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLatestArtifactPath(item, `${location}[${index}]`))
    return
  }
  if (!value || typeof value !== "object") return
  for (const [key, child] of Object.entries(value)) {
    if (key === "path") {
      assert.equal(typeof child, "string", `${location}.path must be a string`)
      assert(!/(^|[\\/])latest(?:\.json)?(?:[\\/]|$)/i.test(child), `${location}.path selects latest`)
    }
    assertNoLatestArtifactPath(child, `${location}.${key}`)
  }
}

function validateManifestBinding(contract, manifest) {
  const binding = contract.sourceManifest
  assert.equal(binding.path, MANIFEST_PATH)
  assert.equal(binding.sha256, MANIFEST_SHA256)
  assert.equal(binding.sameDirectoryAsCheckpoint, true)
  assert.equal(path.dirname(binding.path), path.dirname(contract.checkpoint.path))
  for (const field of [
    "schemaVersion",
    "status",
    "ownership",
    "trainingLane",
    "modelId",
    "architectureVersion",
    "trainingStage",
    "denoiserTrained",
    "formalInferenceEligible",
    "checkpointPath",
    "checkpointSha256",
  ]) {
    assert.deepEqual(binding[field], manifest[field], `manifest binding changed: ${field}`)
  }
  assert.equal(manifest.schemaVersion, "project-owned-ai-assisted-cold-start-checkpoint-v2")
  assert.equal(manifest.status, "autoencoder_warmup_completed_conditioning_blocked")
  assert.equal(manifest.ownership, "project_owned_architecture_ai_assisted_cold_start_weights")
  assert.equal(manifest.trainingLane, "ai_assisted_cold_start")
  assert.equal(manifest.modelId, "ai-pet-world-complete-world-ai-assisted-cold-start-v2")
  assert.equal(manifest.architectureVersion, "pixel-detail-residual-autoencoder-v2")
  assert.equal(manifest.trainingStage, "autoencoder_warmup_only")
  assert.equal(manifest.denoiserTrained, false)
  assert.equal(manifest.formalInferenceEligible, false)
  assert.equal(manifest.checkpointPath, CHECKPOINT_PATH)
  assert.equal(manifest.checkpointSha256, CHECKPOINT_SHA256)
}

function validateFreezeImplementation(contract) {
  const binding = contract.freezeImplementation
  assert.equal(binding.modelFactory.path, MODEL_FACTORY_PATH)
  assert.equal(binding.modelFactory.sha256, MODEL_FACTORY_SHA256)
  assert.equal(sha256FileBytes(MODEL_FACTORY_PATH), MODEL_FACTORY_SHA256, "model factory bytes changed")
  assert.equal(binding.systemClass, "ProjectOwnedCompleteWorldSystem")
  assert.deepEqual(binding.constructionRequirements, [
    "self.autoencoder.eval()",
    "self.autoencoder.requires_grad_(False)",
  ])
  assert.deepEqual(binding.parentTrainModeRequirements, [
    "super().train(mode)",
    "self.autoencoder.eval()",
  ])
  assert.equal(binding.autoencoderTrainingModeRequired, false)
  assert.equal(binding.autoencoderParametersRequireGradRequired, false)

  const source = fs.readFileSync(resolveProjectFile(MODEL_FACTORY_PATH), "utf8")
  const classStart = source.indexOf("    class ProjectOwnedCompleteWorldSystem(nn.Module):")
  assert(classStart >= 0, "ProjectOwnedCompleteWorldSystem is missing")
  const nextClass = source.indexOf("\n    class ", classStart + 10)
  const classSource = source.slice(classStart, nextClass >= 0 ? nextClass : source.length)
  const constructorStart = classSource.indexOf("        def __init__(self):")
  const trainStart = classSource.indexOf("        def train(self, mode: bool = True):")
  assert(constructorStart >= 0 && trainStart > constructorStart, "system constructor or train override is missing")
  const constructorSource = classSource.slice(constructorStart, trainStart)
  const trainEnd = classSource.indexOf("\n        def ", trainStart + 10)
  const trainSource = classSource.slice(trainStart, trainEnd >= 0 ? trainEnd : classSource.length)
  assert(constructorSource.includes("self.autoencoder = ProjectOwnedAutoencoder()"))
  assert(constructorSource.includes("self.autoencoder.eval()"))
  assert(constructorSource.includes("self.autoencoder.requires_grad_(False)"))
  assert(trainSource.includes("super().train(mode)"))
  assert(trainSource.includes("self.autoencoder.eval()"))
}

function validateStaticQualificationAndFutureEvidence(contract) {
  const qualification = contract.staticCpuQualification
  assert.deepEqual(qualification, {
    qualificationKind: "static_lineage_and_program_binding_only",
    checkpointWeightsDeserialized: false,
    runtimeLoadProven: false,
    runtimeFreezeProven: false,
    optimizerExclusionProven: false,
    architectureProgram: {
      path: MODEL_FACTORY_PATH,
      sha256: MODEL_FACTORY_SHA256,
      requiredSystemClass: "ProjectOwnedCompleteWorldSystem",
    },
    futureLoadingProofProgram: {
      path: LOADING_PROOF_PROGRAM_PATH,
      sha256: LOADING_PROOF_PROGRAM_SHA256,
      stateIdentityAlgorithm: "sha256_sorted_tensor_bytes_v1",
      boundaryFunction: "validate_stage4_semantic_transport_v2_autoencoder_boundary",
      optimizerParameterFunction: "stage4_semantic_transport_v2_optimizer_parameters",
    },
  })
  assert.equal(sha256FileBytes(qualification.architectureProgram.path), qualification.architectureProgram.sha256)
  assert.equal(sha256FileBytes(qualification.futureLoadingProofProgram.path), qualification.futureLoadingProofProgram.sha256)
  const proofProgram = fs.readFileSync(resolveProjectFile(LOADING_PROOF_PROGRAM_PATH), "utf8")
  for (const anchor of [
    "def state_dict_sha256(state_dict: dict[str, Any])",
    "def stage4_semantic_transport_v2_optimizer_parameters(model: Any)",
    "def validate_stage4_semantic_transport_v2_autoencoder_boundary(",
    'if phase not in {"loaded", "before_training", "after_training"}:',
    "if model.autoencoder.training:",
    "if any(parameter.requires_grad for parameter in autoencoder_parameters):",
    "if autoencoder_ids & denoiser_ids:",
    '"optimizerContainsAutoencoder": False',
  ]) assert(proofProgram.includes(anchor), `future loading-proof source anchor changed: ${anchor}`)

  const future = contract.futureRuntimeEvidence
  assert.deepEqual(future, {
    evidenceSchemaVersion: "ai-painter-stage4-v2-frozen-autoencoder-runtime-evidence-v1",
    executionPackageLineageRequired: true,
    checkpointFileSha256MustEqualContract: true,
    requiredPhases: ["loaded", "before_training", "after_training"],
    requiredPerPhaseFields: [
      "stateSha256",
      "training",
      "requiresGradParameterCount",
      "optimizerContainsAutoencoder",
      "optimizerScope",
    ],
    allStateHashesMustMatch: true,
    requiredPhaseValues: {
      training: false,
      requiresGradParameterCount: 0,
      optimizerContainsAutoencoder: false,
      optimizerScope: "denoiser_trainable_parameters_only",
    },
    checkpointWeightsMayBeReadDuringStaticCpuQualification: false,
    failureCode: "stage4_v2_frozen_autoencoder_runtime_evidence_invalid",
  })
}

async function validateContract(contract, { verifyContractBytes = false } = {}) {
  assert.equal(contract.schemaVersion, "ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1")
  assert.equal(contract.contractId, "ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.equal(contract.immutable, true)
  assert.equal(contract.architectureId, ARCHITECTURE_ID)
  assert.equal(contract.assetIdentity, "ai-painter-project-foundation-autoencoder-pixel-detail-residual-v2-v1")
  assert.equal(contract.assetRole, "project_owned_cross_candidate_frozen_foundation_capability")
  assert.equal(contract.capabilityReleaseStatus, "not_released")
  assert.equal(contract.formalInferenceEligible, false)
  assert.equal(contract.activation.cpuLineageValidationAllowed, true)
  for (const [gate, value] of Object.entries(contract.activation)) {
    if (gate === "cpuLineageValidationAllowed") continue
    assert.equal(value, false, `${gate} must remain disabled`)
  }
  assertNoLatestArtifactPath(contract)
  if (verifyContractBytes) assert.equal(sha256FileBytes(CONTRACT_PATH), CONTRACT_SHA256, "lineage contract bytes changed")

  assert.equal(contract.checkpoint.path, CHECKPOINT_PATH)
  assert.equal(contract.checkpoint.sha256, CHECKPOINT_SHA256)
  assert.equal(contract.checkpoint.bytes, CHECKPOINT_BYTES)
  assert.equal(contract.checkpoint.formatRole, "project_owned_autoencoder_state_dict_container")
  assert.equal(contract.checkpoint.cpuValidationMode, "raw_file_size_and_sha256_only_no_deserialization")
  assert.equal(fs.statSync(resolveProjectFile(CHECKPOINT_PATH)).size, CHECKPOINT_BYTES, "checkpoint byte length changed")
  assert.equal(await sha256FileStream(CHECKPOINT_PATH), CHECKPOINT_SHA256, "checkpoint raw-file SHA-256 changed")

  assert.equal(sha256FileBytes(MANIFEST_PATH), MANIFEST_SHA256, "source manifest bytes changed")
  const manifest = readJson(MANIFEST_PATH)
  validateManifestBinding(contract, manifest)

  const lineage = contract.lineageInterpretation
  assert.equal(lineage.projectOwned, true)
  assert.equal(lineage.crossCandidateFoundation, true)
  for (const field of [
    "historicalRunSelection",
    "historicalCheckpointFallback",
    "failedDenoiserCheckpoint",
    "containsDenoiserTraining",
    "denoiserWeightsMayBeLoaded",
    "parentCheckpointMayBeLoaded",
    "sourceManifestGovernanceFieldsInherited",
    "sourceManifestRemainingBlockersInherited",
  ]) assert.equal(lineage[field], false, `${field} must remain false`)
  assert.equal(lineage.sourceManifestRole, "immutable_asset_provenance_only")

  const consumer = contract.consumerBoundary
  assert.deepEqual(consumer.allowedConsumerArchitectureIds, [ARCHITECTURE_ID])
  assert.equal(consumer.allowedRole, "frozen_autoencoder_foundation_dependency_only")
  for (const field of [
    "standaloneFormalInferenceAllowed",
    "crossArchitectureFallbackAllowed",
    "latestPointerAllowed",
    "directoryRecencySelectionAllowed",
    "pathOrShaOverrideAllowed",
  ]) assert.equal(consumer[field], false, `${field} must remain false`)

  assert.deepEqual(contract.currentAssetShape, {
    inputRgbChannels: 3,
    latentChannels: 12,
    spatialScaleFactor: 4,
    shapeRole: "current_version_compatibility_value_not_permanent_business_contract",
  })
  validateFreezeImplementation(contract)
  validateStaticQualificationAndFutureEvidence(contract)

  const proof = contract.executionProofRequirements
  for (const field of [
    "checkpointFileSha256BeforeLoadMustEqualContract",
    "loadedAutoencoderStateHashRequired",
    "stateHashBeforeTrainingRequired",
    "stateHashAfterTrainingRequired",
    "loadedStateHashMustEqualBeforeTrainingStateHash",
    "beforeTrainingStateHashMustEqualAfterTrainingStateHash",
    "autoencoderEvalModeRequiredThroughout",
    "autoencoderRequiresGradFalseRequiredThroughout",
    "proofMustBeBoundToCurrentExecutionPackage",
  ]) assert.equal(proof[field], true, `${field} must remain true`)
  assert.equal(proof.proofMayUseHistoricalRun, false)
  assert.equal(proof.failureCode, "stage4_v2_frozen_autoencoder_state_identity_changed")

  assert.deepEqual(contract.forbiddenUses, [
    "formal_inference_capability_release",
    "standalone_runtime_decode",
    "denoiser_initialization",
    "failed_denoiser_resume",
    "historical_candidate_checkpoint_selection",
    "checkpoint_weight_inspection_during_cpu_contract_validation",
    "training_target_generation",
    "latest_pointer_resolution",
  ])
}

async function expectFailure(label, action) {
  await assert.rejects(action, undefined, `${label} must fail closed`)
}

async function runNegativeRegressions(contract) {
  const cases = [
    ["checkpoint path", (value) => { value.checkpoint.path = ".runtime/ai-painter/latest.json" }],
    ["checkpoint SHA", (value) => { value.checkpoint.sha256 = "0".repeat(64) }],
    ["checkpoint byte length", (value) => { value.checkpoint.bytes -= 1 }],
    ["manifest path", (value) => { value.sourceManifest.path = ".runtime/ai-painter/latest/manifest.json" }],
    ["manifest status", (value) => { value.sourceManifest.status = "formal_inference_ready" }],
    ["denoiser identity", (value) => { value.sourceManifest.denoiserTrained = true }],
    ["formal inference", (value) => { value.formalInferenceEligible = true }],
    ["historical fallback", (value) => { value.lineageInterpretation.historicalCheckpointFallback = true }],
    ["parent checkpoint", (value) => { value.lineageInterpretation.parentCheckpointMayBeLoaded = true }],
    ["cross architecture", (value) => { value.consumerBoundary.allowedConsumerArchitectureIds.push("legacy_candidate") }],
    ["model factory SHA", (value) => { value.freezeImplementation.modelFactory.sha256 = "0".repeat(64) }],
    ["static qualification overclaim", (value) => { value.staticCpuQualification.runtimeLoadProven = true }],
    ["loading proof program SHA", (value) => { value.staticCpuQualification.futureLoadingProofProgram.sha256 = "0".repeat(64) }],
    ["runtime evidence phase", (value) => { value.futureRuntimeEvidence.requiredPhases.pop() }],
    ["optimizer exclusion evidence", (value) => { value.futureRuntimeEvidence.requiredPhaseValues.optimizerContainsAutoencoder = true }],
    ["state hash proof", (value) => { value.executionProofRequirements.beforeTrainingStateHashMustEqualAfterTrainingStateHash = false }],
  ]
  for (const [label, mutate] of cases) {
    const mutated = structuredClone(contract)
    mutate(mutated)
    await expectFailure(label, () => validateContract(mutated))
  }
}

const contract = readJson(CONTRACT_PATH)
await validateContract(contract, { verifyContractBytes: true })
await runNegativeRegressions(contract)

console.log(JSON.stringify({
  status: "passed",
  contractPath: CONTRACT_PATH,
  contractSha256: CONTRACT_SHA256,
  assetIdentity: contract.assetIdentity,
  checkpointPath: CHECKPOINT_PATH,
  checkpointSha256: CHECKPOINT_SHA256,
  checkpointBytes: CHECKPOINT_BYTES,
  sourceManifestPath: MANIFEST_PATH,
  sourceManifestSha256: MANIFEST_SHA256,
  modelFactoryPath: MODEL_FACTORY_PATH,
  modelFactorySha256: MODEL_FACTORY_SHA256,
  loadingProofProgramPath: LOADING_PROOF_PROGRAM_PATH,
  loadingProofProgramSha256: LOADING_PROOF_PROGRAM_SHA256,
  checkpointDeserialized: false,
  staticQualificationOnly: true,
  runtimeLoadProven: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))
