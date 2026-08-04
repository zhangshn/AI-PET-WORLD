import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const overlay = readJson("data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json")
const training = overlay.patch.training
const trainerSource = readText("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const alignmentSource = readText("scripts/lib/ai-assisted-condition-alignment.mjs")
const stageRunnerSource = readText("scripts/run-ai-assisted-v7-bounded-repair-r1-full-training.mjs")
const smokeRunnerSource = readText("scripts/run-ai-assisted-v7-bounded-repair-r2-overfit-smoke.mjs")
const reconciliationSource = readText("scripts/reconcile-ai-assisted-v7-r2-smoke-record-closure.mjs")
const reconciledFinalization = readJson(".runtime/ai-painter/v7-bounded-repair-r2-overfit-smoke-finalizations/ai-assisted-v7-r2-overfit-smoke-finalization-reconciled-20260803/finalization-report.json")
const reconciledPreviewReview = readJson(reconciledFinalization.previewReviewPath)
const checks = []

check(training.boundedRepairVersion === "v7_bounded_repair_r2", "R2 bounded repair identity is locked")
check(training.timestepSampling === "deterministic_full_schedule_cover_v2", "R2 timestep sampler identity is locked")
check(gcd(training.timestepCoverageStride, 1000) === 1, "R2 timestep stride is coprime with 1000 diffusion steps")
const timesteps = []
for (let epoch = 0; epoch < 40; epoch += 1) {
  for (let batch = 0; batch < 48; batch += 1) {
    const position = epoch * 48 + batch
    timesteps.push((20260722 % 1000 + position * training.timestepCoverageStride) % 1000)
  }
}
const unique = new Set(timesteps)
check(unique.size === 1000, "40x48 training presentations cover all 1000 diffusion timesteps")
const inference = Array.from({ length: 50 }, (_, index) => Math.round(999 - index * 999 / 49))
check(inference.every((value) => unique.has(value)), "all 50 deterministic rollout timesteps are covered by training")
check(training.shortTrajectorySupervision?.enabled === true && training.shortTrajectorySupervision.steps >= 2, "short trajectory supervision is enabled with at least two predictions")
check(trainerSource.includes("def short_trajectory_supervision") && trainerSource.includes("deterministic_velocity_step"), "trainer contains differentiable short trajectory supervision")
check(trainerSource.includes("single_sample_overfit_smoke") && trainerSource.includes("formalModelPromotionEligible\": False"), "single-sample overfit mode is explicitly nonformal")
check(stageRunnerSource.includes("stage_${stageIndex}_preview_machine_gate_failed"), "failed Stage previews hard-stop the progressive chain")
check(alignmentSource.includes("post_generation_held_out_masked_rgb_edge_correlation_v1") && alignmentSource.includes("reference_semantic_mismatch"), "object semantic review compares post-generation output with held-out masked reference evidence")
for (const channel of ["object_footprints", "object_tree", "object_rock", "object_vegetation", "focal_area"]) {
  check(alignmentSource.includes(`[\"${channel}\"`) && alignmentSource.includes(`condition_\${channelId}_visual_response_missing`), `${channel} participates in object semantic review`)
}
check(smokeRunnerSource.includes("fullTrainingStarted: false") && smokeRunnerSource.includes("strictRevalidationStarted: false") && smokeRunnerSource.includes("worldEntryStarted: false"), "R2 Smoke runner preserves all prohibited downstream boundaries")
check(smokeRunnerSource.includes("run-start-registration.json") && smokeRunnerSource.includes("run-terminal-registration.json"), "R2 Smoke runner automatically registers start and terminal records")
check(smokeRunnerSource.includes("`e${epoch}.png`") && !smokeRunnerSource.includes("-1024x768-nearest.png"), "R2 preview review assets use Windows-safe short epoch identities")
check(reconciliationSource.includes("existing_saved_previews_only_no_retraining") && reconciliationSource.includes("writeTerminalRegistration"), "existing R2 previews have a no-retraining record closure reconciler")
check(reconciledFinalization.automaticStorage === true && reconciledFinalization.previewCount === 7 && reconciledFinalization.retrainingStarted === false, "existing seven R2 previews are automatically stored without retraining")
check(reconciledPreviewReview.sourcePreviewCount === 7 && reconciledPreviewReview.reviews.every((review) => review.recordedAtUtc && review.recordedAtAsiaShanghai), "all seven R2 previews preserve detailed UTC and Asia/Shanghai timestamps")
check(reconciledFinalization.previewPassCount === 1 && reconciledFinalization.previewFailCount === 6 && reconciledFinalization.status === "r2_single_sample_overfit_smoke_failed_stopped", "R2 preview hard gate failure is durably closed instead of disappearing")
check(fileExists(overlay.authorizationPath) && fileExists(overlay.authorizationConsumptionPath), "immutable R2 authorization and atomic consumption evidence exist")

console.log(JSON.stringify({
  ok: true,
  assertionCount: checks.length,
  uniqueTrainingTimestepCount: unique.size,
  exactInferenceOverlapCount: inference.filter((value) => unique.has(value)).length,
  checks,
}, null, 2))

function check(condition, label) {
  if (!condition) throw new Error(label)
  checks.push(label)
}
function gcd(left, right) { let a = left; let b = right; while (b) [a, b] = [b, a % b]; return Math.abs(a) }
function resolve(value) { return path.resolve(ROOT, value) }
function fileExists(value) { return fs.existsSync(resolve(value)) }
function readText(value) { return fs.readFileSync(resolve(value), "utf8") }
function readJson(value) { return JSON.parse(readText(value)) }
