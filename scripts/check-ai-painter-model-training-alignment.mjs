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
const inferencePointer = readJson(".runtime/ai-painter/complete-world-visual-inference/latest.json")
const inferenceManifest = inferencePointer?.manifestPath ? readJson(inferencePointer.manifestPath) : null

const components = [
  component("world_visual_dictionary", {
    implemented: contract.passed === true,
    command: "check:world-visual-data-dictionary",
    file: "scripts/check-world-visual-data-dictionary.mjs",
    artifact: contract.dictionaryPath,
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
  component("complete_world_visual_inference", {
    implemented:
      hasScript("run:current-world-visual-inference") &&
      exists("scripts/run-current-world-visual-inference.mjs") &&
      validateInferenceEvidence(inferencePointer, inferenceManifest, taskManifest),
    command: "run:current-world-visual-inference",
    file: "scripts/run-current-world-visual-inference.mjs",
    artifact: inferencePointer?.manifestPath ?? null,
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
  check(item.implemented, `${item.id}: implementation evidence missing`)
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
  return {
    id,
    status: details.implemented ? "implemented" : "not_implemented",
    implemented: details.implemented,
    requiredCommand: details.command,
    implementationFile: details.file,
    latestArtifact: details.artifact,
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
