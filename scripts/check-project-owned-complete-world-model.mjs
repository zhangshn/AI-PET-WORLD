import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const config = readJson("ml/ai-painter/config/complete-world-independent-v1.json")
const modelSource = readText("ml/ai-painter/src/ai_painter/complete_world/model.py")
const diffusionSource = readText("ml/ai-painter/src/ai_painter/complete_world/diffusion.py")
const datasetSource = readText("ml/ai-painter/src/ai_painter/complete_world/dataset.py")
const trainerSource = readText("ml/ai-painter/scripts/train_project_owned_complete_world.py")
const samplerSource = readText("ml/ai-painter/scripts/infer_project_owned_complete_world.py")
const runnerSource = readText("scripts/run-current-world-visual-inference.mjs")
const checkpoint = readJson(".runtime/ai-painter/project-owned-complete-world-model/latest.json")
const failures = []

check(config?.schemaVersion === "project-owned-complete-world-model-config-v1", "model config schema invalid")
check(config?.ownership === "project_owned_independent_weights", "model ownership must be project owned")
check(config?.initialization === "random_initialization_only", "model must require independent initialization")
check(Array.isArray(config?.upstreamModelIds) && config.upstreamModelIds.length === 0, "upstream model list must be empty")
check(config?.thirdPartyGeneratedTrainingOutputsAllowed === false, "third-party generated training output must be forbidden")
check(config?.conditionChannels === 23, "model must consume 23 condition channels")
check(config?.imageSize?.width === 1024 && config?.imageSize?.height === 768, "formal model must generate a native 1024x768 high-resolution pixel-style complete map")
check(config?.training?.resolutionStages?.length === 3 && config.training.resolutionStages[2]?.width === 1024 && config.training.resolutionStages[2]?.height === 768, "training must finish at the native high-resolution pixel-style canvas")
check(modelSource.includes("ProjectOwnedConditionEncoder"), "project-owned condition encoder missing")
check(modelSource.includes("ProjectOwnedAutoencoder"), "project-owned autoencoder missing")
check(modelSource.includes("ProjectOwnedDenoiser"), "project-owned denoiser missing")
check(!/(from_pretrained|StableDiffusion|ControlNet|diffusers)/.test(modelSource), "project-owned model imports third-party generation weights")
check(diffusionSource.includes("deterministic_step"), "project-owned diffusion sampler math missing")
check(datasetSource.includes("IndependentCompleteWorldDataset"), "independent complete-world dataset loader missing")
check(trainerSource.includes("train_autoencoder") && trainerSource.includes("train_denoiser"), "two-stage project-owned trainer missing")
check(samplerSource.includes("project_owned_independent_weights"), "project-owned sampler provenance gate missing")
check(samplerSource.includes("Image.Resampling.NEAREST") && samplerSource.includes("Image.Resampling.BILINEAR"), "sampler must resize discrete and continuous conditions correctly")
for (const [label, source] of [["model", modelSource], ["diffusion", diffusionSource], ["trainer", trainerSource], ["sampler", samplerSource]]) {
  check(!/(from_pretrained|StableDiffusionPipeline|ControlNetModel|diffusers)/.test(source), `${label} source imports third-party generation weights`)
}
check(runnerSource.includes("project_owned_independent_weights"), "formal runner ownership gate missing")
check(runnerSource.includes("project_owned_checkpoint_missing"), "formal runner missing checkpoint blocker")
check(runnerSource.includes("metadata.width !== 1024") && runnerSource.includes("high_resolution_pixel_style"), "formal runner high-resolution pixel-style output contract missing")

const checkpointValid = checkpoint?.schemaVersion === "project-owned-complete-world-checkpoint-v1"
  && checkpoint?.status === "training_completed"
  && checkpoint?.ownership === "project_owned_independent_weights"
  && Array.isArray(checkpoint?.upstreamModelIds)
  && checkpoint.upstreamModelIds.length === 0
  && checkpoint?.thirdPartyWeightsLoaded === false
  && checkpoint?.thirdPartyGeneratedTrainingOutputUsed === false

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "project_owned_complete_world_model_contract_passed" : "project_owned_complete_world_model_contract_failed",
  architectureStatus: config?.status ?? null,
  trainingProgramStatus: "implemented_blocked_until_independent_data_ready",
  samplerStatus: "implemented_blocked_until_project_owned_checkpoint_ready",
  checkpointStatus: checkpointValid ? "valid" : checkpoint ? "present_invalid" : "missing",
  formalInferenceReady: checkpointValid,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, value), "utf8")) } catch { return null } }
function readText(value) { try { return fs.readFileSync(path.join(ROOT, value), "utf8") } catch { return "" } }
function check(condition, message) { if (!condition) failures.push(message) }
