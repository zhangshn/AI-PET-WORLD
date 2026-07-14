import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const failures = []
const pointer = readJson(".runtime/ai-painter/complete-world-visual-bootstrap-inference/latest.json")
const manifest = pointer?.manifestPath ? readJson(pointer.manifestPath) : null
const taskPointer = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const conditionManifest = taskPointer?.taskPath
  ? readJson(path.join(path.dirname(taskPointer.taskPath), "compiled-conditions", "manifest.json"))
  : null

check(Boolean(pointer), "bootstrap_inference_pointer_missing")
check(Boolean(manifest), "bootstrap_inference_manifest_missing")
if (pointer && manifest && taskPointer && conditionManifest) {
  check(manifest.schemaVersion === "complete-world-visual-bootstrap-inference-manifest-v1", "bootstrap_manifest_schema_invalid")
  check(manifest.status === "completed_bootstrap_candidate_generated", "bootstrap_candidate_not_completed")
  check(manifest.taskId === taskPointer.taskId, "bootstrap_task_identity_mismatch")
  check(manifest.conditionPackId === conditionManifest.conditionPackId, "bootstrap_condition_identity_mismatch")
  check(manifest.dictionaryVersionId === taskPointer.dictionaryVersionId, "bootstrap_dictionary_identity_mismatch")
  check(["fresh_local_model_inference", "fresh_local_foundation_inference"].includes(manifest.outputSource), "bootstrap_output_source_invalid")
  check(manifest.reusedExistingImage === false, "bootstrap_reused_existing_image")
  check(manifest.targetImageUsed === false, "bootstrap_used_target_image")
  check(manifest.programDrawnRgbUsed === false, "bootstrap_used_program_drawn_rgb")
  check(
    (manifest.nativeModelOutputSize?.width === 256 && manifest.nativeModelOutputSize?.height === 192) ||
      (manifest.nativeModelOutputSize?.width === 768 && manifest.nativeModelOutputSize?.height === 576) ||
      (manifest.nativeModelOutputSize?.width === 1024 && manifest.nativeModelOutputSize?.height === 768),
    "bootstrap_native_model_size_missing",
  )
  check(
    (manifest.reviewOutputResample?.method === "lanczos" && manifest.reviewOutputResample?.formalNativeResolution === false) ||
      (manifest.reviewOutputResample?.method === "none" && manifest.reviewOutputResample?.formalNativeResolution === true),
    "bootstrap_resample_disclosure_missing",
  )
  check(["seeded_rgb_base_noise", "stable_diffusion_seeded_latent"].includes(manifest.latentInput?.kind) && manifest.latentInput?.seed === manifest.seed, "bootstrap_seeded_latent_missing")
  check(manifest.canEnterWorld === false, "bootstrap_candidate_must_not_enter_world")
  check(manifest.canCountAsPositiveSample === false, "bootstrap_candidate_must_not_auto_count_positive")
  check(manifest.requiresOwnerReview === true, "bootstrap_owner_review_requirement_missing")
  check(manifest.automaticStorage === true, "bootstrap_candidate_not_program_saved")
  const imagePath = resolveProjectPath(manifest.outputImagePath)
  check(fs.existsSync(imagePath), "bootstrap_candidate_image_missing")
  if (fs.existsSync(imagePath)) {
    const bytes = fs.readFileSync(imagePath)
    check(sha256(bytes) === manifest.outputImageSha256, "bootstrap_candidate_image_hash_mismatch")
    const metadata = await sharp(bytes, { failOn: "error" }).metadata()
    check(metadata.width === 1024 && metadata.height === 768, "bootstrap_candidate_size_invalid")
    check(metadata.channels === 3, "bootstrap_candidate_not_rgb")
  }
  check(fs.existsSync(resolveProjectPath(manifest.modelReportPath)), "bootstrap_model_report_missing")
  const nativeImagePath = resolveProjectPath(manifest.nativeOutputImagePath)
  check(fs.existsSync(nativeImagePath), "bootstrap_native_output_missing")
  if (fs.existsSync(nativeImagePath)) check(sha256(fs.readFileSync(nativeImagePath)) === manifest.nativeOutputImageSha256, "bootstrap_native_output_hash_mismatch")
  for (const checkpoint of Object.values(manifest.modelCheckpoints ?? {})) {
    const checkpointPath = resolveProjectPath(checkpoint.path)
    check(fs.existsSync(checkpointPath), `bootstrap_checkpoint_missing:${checkpoint.path}`)
    if (fs.existsSync(checkpointPath)) check(sha256(fs.readFileSync(checkpointPath)) === checkpoint.sha256, `bootstrap_checkpoint_hash_mismatch:${checkpoint.path}`)
  }
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "current_world_bootstrap_inference_check_passed" : "current_world_bootstrap_inference_check_failed",
  runId: manifest?.runId ?? null,
  taskId: manifest?.taskId ?? null,
  imagePath: manifest?.outputImagePath ?? null,
  imageSha256: manifest?.outputImageSha256 ?? null,
  outputSize: manifest?.outputSize ?? null,
  candidateStatus: manifest?.candidateStatus ?? null,
  requiresOwnerReview: manifest?.requiresOwnerReview ?? null,
  canEnterWorld: manifest?.canEnterWorld ?? null,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(value) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
  } catch {
    return null
  }
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${value}`)
  return resolved
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function check(condition, message) {
  if (!condition) failures.push(message)
}
