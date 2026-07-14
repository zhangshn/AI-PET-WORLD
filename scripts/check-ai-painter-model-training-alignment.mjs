import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import {
  REQUIRED_DIRECTOR_OUTPUT_FIELDS,
  REQUIRED_TASK_PACKAGE_FIELDS,
  loadWorldVisualDictionaryContract,
} from "./lib/world-visual-dictionary-contract.mjs"

const ROOT = process.cwd()
const REQUIRED_SENTENCE = "不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。"
const ALIGNMENT_DOC = "docs/ai-painter-progress/AI_MODEL_TRAINING_ARCHITECTURE_ALIGNMENT.md"
const PERSISTENCE_DOC = "docs/ai-painter-progress/TRAINING_DATA_PERSISTENCE_LOCKED_SPEC.md"
const PAGE_LOCK_DOC = "docs/ai-painter-progress/GENERATED_RESULTS_PAGE_LOCKED_SPEC.md"
const packageJson = readJson("package.json") ?? { scripts: {} }
const failures = []

const contract = loadWorldVisualDictionaryContract()
check(contract.passed === true, "world visual dictionary contract must pass")
check(contract.activeScope === "single_complete_map_visual", "active scope must be single_complete_map_visual")
check(contract.summary.unregisteredHardFailureCodeCount === 0, "hard failure codes must all be registered")

const alignmentText = readText(ALIGNMENT_DOC)
const persistenceText = readText(PERSISTENCE_DOC)
const pageLockText = readText(PAGE_LOCK_DOC)
for (const [file, text] of [
  [ALIGNMENT_DOC, alignmentText],
  [PERSISTENCE_DOC, persistenceText],
  [PAGE_LOCK_DOC, pageLockText],
]) {
  check(text.includes(REQUIRED_SENTENCE), `${file}: required no-freeform sentence missing`)
}

for (const field of REQUIRED_TASK_PACKAGE_FIELDS) {
  check(alignmentText.includes(field), `${ALIGNMENT_DOC}: missing task package field ${field}`)
}
for (const field of REQUIRED_DIRECTOR_OUTPUT_FIELDS) {
  check(alignmentText.includes(field), `${ALIGNMENT_DOC}: missing director output field ${field}`)
}

check(pageLockText.includes("/ai-painter-progress/generated-results"), "generated results page lock must name the page")

const taskManifest = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const taskPackage = taskManifest?.taskPath ? readJson(taskManifest.taskPath) : null
const directorOutput = taskManifest?.directorPath ? readJson(taskManifest.directorPath) : null
const visualFactPointer = readJson(".runtime/ai-painter/world-visual-fact-manifests/latest.json")
const visualFactManifest = visualFactPointer?.manifestPath ? readJson(visualFactPointer.manifestPath) : null
const conditionManifestPath = taskManifest?.taskPath
  ? path.join(path.dirname(taskManifest.taskPath), "compiled-conditions", "manifest.json")
  : null
const conditionManifest = conditionManifestPath ? readJson(conditionManifestPath) : null
const conditionPack = conditionManifest?.conditionPackPath ? readJson(conditionManifest.conditionPackPath) : null
const inferencePointer = readJson(".runtime/ai-painter/complete-world-visual-inference/latest.json")
const inferenceManifest = inferencePointer?.manifestPath ? readJson(inferencePointer.manifestPath) : null
const bootstrapPointer = readJson(".runtime/ai-painter/complete-world-visual-bootstrap-inference/latest.json")
const bootstrapManifest = bootstrapPointer?.manifestPath ? readJson(bootstrapPointer.manifestPath) : null
const bootstrapReview = readJson(".runtime/ai-painter/complete-world-visual-machine-reviews/latest.json")
const datasetPackagePointer = readJson("data/world-samples/dataset-packages/latest.json")
const datasetPackage = datasetPackagePointer?.manifestPath ? readJson(datasetPackagePointer.manifestPath) : null
const projectOwnedModelConfig = readJson("ml/ai-painter/config/complete-world-independent-v1.json")

const components = [
  component("world_visual_dictionary", {
    implemented: contract.passed === true,
    command: "check:world-visual-data-dictionary",
    file: "scripts/check-world-visual-data-dictionary.mjs",
    artifact: contract.dictionaryPath,
  }),
  component("complete_map_dataset_package", {
    implemented:
      hasScript("register:complete-map-training-sample") &&
      hasScript("check:complete-map-training-sample-registry") &&
      hasScript("check:project-owned-training-data-ip-policy") &&
      hasScript("build:current-complete-map-dataset-package") &&
      hasScript("check:current-complete-map-dataset-package") &&
      exists("scripts/register-complete-map-training-sample.mjs") &&
      exists("scripts/build-current-complete-map-dataset-package.mjs") &&
      exists("scripts/check-project-owned-training-data-ip-policy.mjs") &&
      datasetPackage?.schemaVersion === "complete-map-dataset-package-v1" &&
      datasetPackage?.dictionaryVersionId === contract.dictionaryVersionId &&
      datasetPackage?.automaticStorage === true,
    command: "build:current-complete-map-dataset-package",
    file: "scripts/build-current-complete-map-dataset-package.mjs",
    artifact: datasetPackagePointer?.manifestPath ?? null,
  }),
  component("world_visual_task_package", {
    implemented:
      hasScript("build:current-world-visual-task-package") &&
      exists("scripts/build-current-world-visual-generation-task-package.mjs") &&
      Boolean(taskPackage) &&
      Boolean(directorOutput) &&
      Boolean(visualFactManifest?.passed) &&
      taskPackage?.sourceBindings?.visualFactManifestId === visualFactManifest?.manifestId &&
      hasFields(taskPackage, REQUIRED_TASK_PACKAGE_FIELDS) &&
      hasFields(directorOutput, REQUIRED_DIRECTOR_OUTPUT_FIELDS),
    command: "build:current-world-visual-task-package",
    file: "scripts/build-current-world-visual-generation-task-package.mjs",
    artifact: taskManifest?.taskPath ?? null,
  }),
  component("world_visual_condition_compiler", {
    implemented:
      hasScript("compile:current-world-visual-conditions") &&
      hasScript("check:current-world-visual-conditions") &&
      exists("scripts/compile-current-world-visual-conditions.mjs") &&
      exists("scripts/check-current-world-visual-conditions.mjs") &&
      conditionManifest?.schemaVersion === "complete-world-visual-condition-manifest-v1" &&
      conditionManifest?.status === "compiled_conditions_ready" &&
      conditionManifest?.taskId === taskManifest?.taskId &&
      conditionManifest?.dictionaryVersionId === taskManifest?.dictionaryVersionId &&
      conditionManifest?.outputKind === "model_condition_only_no_rgb" &&
      conditionManifest?.generatesPlayerFacingPixels === false &&
      conditionPack?.taskId === taskManifest?.taskId &&
      Array.isArray(conditionPack?.channels) &&
      conditionPack.channels.length > 0,
    command: "compile:current-world-visual-conditions",
    file: "scripts/compile-current-world-visual-conditions.mjs",
    artifact: conditionManifestPath?.replace(/\\/g, "/") ?? null,
  }),
  component("complete_world_visual_inference", {
    implemented:
      hasScript("run:current-world-visual-inference") &&
      exists("scripts/run-current-world-visual-inference.mjs") &&
      exists("ml/ai-painter/scripts/infer_project_owned_complete_world.py") &&
      exists("ml/ai-painter/src/ai_painter/complete_world/diffusion.py"),
    operationalReady: validateInferenceEvidence(inferencePointer, inferenceManifest, taskManifest),
    waitingReason: inferenceManifest ? null : "project_owned_checkpoint_or_inference_evidence_missing",
    command: "run:current-world-visual-inference",
    file: "scripts/run-current-world-visual-inference.mjs",
    artifact: inferencePointer?.manifestPath ?? null,
  }),
  component("project_owned_complete_world_model_architecture", {
    implemented:
      hasScript("check:project-owned-complete-world-model") &&
      hasScript("train:project-owned-complete-world-model") &&
      exists("scripts/check-project-owned-complete-world-model.mjs") &&
      exists("scripts/train-project-owned-complete-world-model.mjs") &&
      exists("ml/ai-painter/src/ai_painter/complete_world/model.py") &&
      exists("ml/ai-painter/src/ai_painter/complete_world/dataset.py") &&
      exists("ml/ai-painter/scripts/train_project_owned_complete_world.py") &&
      projectOwnedModelConfig?.ownership === "project_owned_independent_weights" &&
      projectOwnedModelConfig?.initialization === "random_initialization_only" &&
      Array.isArray(projectOwnedModelConfig?.upstreamModelIds) &&
      projectOwnedModelConfig.upstreamModelIds.length === 0,
    command: "check:project-owned-complete-world-model",
    file: "ml/ai-painter/src/ai_painter/complete_world/model.py",
    artifact: "ml/ai-painter/config/complete-world-independent-v1.json",
  }),
  component("historical_third_party_bootstrap_isolated", {
    implemented:
      hasScript("run:current-world-foundation-bootstrap-inference") &&
      hasScript("run:current-world-foundation-candidate-batch") &&
      hasScript("check:current-world-bootstrap-inference") &&
      hasScript("review:current-world-bootstrap-candidate") &&
      hasScript("check:current-world-bootstrap-machine-review") &&
      exists("scripts/run-current-world-foundation-bootstrap-inference.mjs") &&
      exists("scripts/run-current-world-foundation-candidate-batch.mjs") &&
      exists("scripts/review-current-world-bootstrap-candidate.mjs") &&
      validateBootstrapEvidence(bootstrapPointer, bootstrapManifest) &&
      bootstrapReview?.schemaVersion === "complete-world-visual-machine-review-v1" &&
      bootstrapReview?.candidate?.imageSha256 === bootstrapManifest?.outputImageSha256 &&
      bootstrapReview?.canEnterWorld === false,
    command: "run:current-world-foundation-bootstrap-inference",
    file: "scripts/run-current-world-foundation-bootstrap-inference.mjs",
    artifact: bootstrapPointer?.manifestPath ?? null,
    required: false,
  }),
  component("automatic_review_failure_learning_consumer", {
    implemented:
      hasScript("consume:game-map-visual-learning-feedback") &&
      exists("scripts/consume-game-map-visual-learning-feedback.mjs") &&
      Boolean(readJson(".runtime/ai-painter/visual-learning-feedback-consumption/latest.json")),
    command: "consume:game-map-visual-learning-feedback",
    file: "scripts/consume-game-map-visual-learning-feedback.mjs",
    artifact: ".runtime/ai-painter/visual-learning-feedback-consumption/latest.json",
  }),
]

for (const item of components) {
  if (item.required) check(item.implemented, `${item.id}: implementation evidence missing`)
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "ai_painter_model_training_alignment_check_passed"
    : "ai_painter_model_training_alignment_check_failed",
  dictionaryVersionId: contract.dictionaryVersionId,
  activeScope: contract.activeScope,
  verificationMode: "documentation_plus_real_code_and_artifact_evidence",
  components,
  failures,
}

console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function component(id, details) {
  const operationalReady = details.operationalReady ?? details.implemented
  return {
    id,
    status: details.implemented
      ? operationalReady
        ? "implemented"
        : "implemented_waiting_required_artifact"
      : "not_implemented",
    implemented: details.implemented,
    operationalReady,
    waitingReason: operationalReady ? null : details.waitingReason ?? null,
    requiredCommand: details.command,
    implementationFile: details.file,
    latestArtifact: details.artifact,
    required: details.required !== false,
  }
}

function hasScript(name) {
  return typeof packageJson.scripts?.[name] === "string" && packageJson.scripts[name].length > 0
}

function hasFields(value, fields) {
  return Boolean(value) && fields.every((field) => Object.hasOwn(value, field))
}

function validateInferenceEvidence(pointer, manifest, latestTask) {
  if (!pointer || !manifest || !latestTask) return false
  if (manifest.schemaVersion !== "complete-world-visual-inference-manifest-v1") return false
  if (manifest.status !== "completed_candidate_generated") return false
  if (manifest.taskId !== latestTask.taskId) return false
  if (manifest.worldId !== latestTask.worldId || manifest.tick !== latestTask.tick) return false
  if (manifest.dictionaryVersionId !== latestTask.dictionaryVersionId) return false
  if (!manifest.modelVersion || !manifest.modelCheckpointPath || !manifest.seed) return false
  if (manifest.outputSource !== "fresh_local_model_inference" || manifest.reusedExistingImage !== false) return false
  if (!manifest.outputImagePath || !/^[a-f0-9]{64}$/i.test(manifest.outputImageSha256 ?? "")) return false
  const outputPath = path.resolve(ROOT, manifest.outputImagePath)
  if (!fs.existsSync(outputPath)) return false
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(outputPath)).digest("hex")
  if (actualHash !== manifest.outputImageSha256.toLowerCase()) return false
  if (pointer.taskId !== manifest.taskId || pointer.outputImageSha256 !== manifest.outputImageSha256) return false
  return true
}

function validateBootstrapEvidence(pointer, manifest) {
  if (!pointer || !manifest) return false
  if (manifest.schemaVersion !== "complete-world-visual-bootstrap-inference-manifest-v1") return false
  if (manifest.status !== "completed_bootstrap_candidate_generated") return false
  if (!manifest.taskId || !manifest.worldId || !Number.isInteger(manifest.tick)) return false
  if (manifest.dictionaryVersionId !== contract.dictionaryVersionId) return false
  if (!["fresh_local_model_inference", "fresh_local_foundation_inference"].includes(manifest.outputSource)) return false
  if (manifest.onlineInferenceApiUsed !== false || manifest.localFilesOnly !== true) return false
  if (manifest.reusedExistingImage !== false || manifest.targetImageUsed !== false || manifest.programDrawnRgbUsed !== false) return false
  if (manifest.canEnterWorld !== false || manifest.canCountAsPositiveSample !== false) return false
  if (!manifest.outputImagePath || !/^[a-f0-9]{64}$/i.test(manifest.outputImageSha256 ?? "")) return false
  const outputPath = path.resolve(ROOT, manifest.outputImagePath)
  if (!fs.existsSync(outputPath)) return false
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(outputPath)).digest("hex")
  return actualHash === manifest.outputImageSha256.toLowerCase() && pointer.runId === manifest.runId
}

function exists(relativePath) {
  return fs.existsSync(path.resolve(ROOT, relativePath))
}

function readText(relativePath) {
  try {
    return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8")
  } catch {
    failures.push(`${relativePath}: file missing or unreadable`)
    return ""
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"))
  } catch {
    return null
  }
}

function check(condition, message) {
  if (!condition) failures.push(message)
}
