import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./ai-assisted-v7-r5-stage3-preview-review.mjs"
import { adjudicateLateReviewRows } from "./ai-painter-stage4-late-convergence-qualification.mjs"

export const CAPABILITY_VERSION = "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
export const TRAINER_ARCHITECTURE_VERSION = "joint-condition-local-transport-denoiser-v1"
export const PLAN_SCHEMA_VERSION = "ai-painter-stage4-joint-condition-local-transport-24-epoch-full-data-screen-execution-plan-v1"
export const FIXED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const PREVIEW_EPOCHS = Object.freeze([5, 10, 15, 20, 24])
export const LATE_EPOCHS = Object.freeze([15, 20, 24])
export const EXPECTED_TRAINER_STATUS = "stage4_joint_condition_local_transport_full_data_screen_training_completed_awaiting_automatic_machine_review"
export const ADAPTER_EXPORTS = Object.freeze({
  preflight: "preflightJointConditionLocalTransportFullDataScreen",
  execute: "executeJointConditionLocalTransportFullDataScreen",
  validate: "validateJointConditionLocalTransportFullDataScreen",
  review: "reviewJointConditionLocalTransportFullDataScreen",
  adjudicate: "adjudicateJointConditionLocalTransportFullDataScreen",
  finalize: "finalizeJointConditionLocalTransportFullDataScreen",
})

const defaultServices = Object.freeze({
  runCommand,
  normalizePreview: normalizePreviewWithWindowsSafeIo,
  auditAesthetic: auditAiAssistedProfessionalAesthetic,
  auditAlignment: auditAiAssistedConditionAlignment,
  adjudicate: adjudicateLateReviewRows,
  now: () => new Date().toISOString(),
})

export function createJointConditionLocalTransportFullDataScreenAdapters(overrides = {}) {
  const services = Object.freeze({ ...defaultServices, ...overrides })
  return Object.freeze({
    preflight: (context) => preflight(context, services),
    execute: (context) => execute(context, services),
    validate: (context) => validate(context, services),
    review: (context) => review(context, services),
    adjudicate: (context) => adjudicate(context, services),
    finalize: (context) => finalize(context, services),
  })
}

const production = createJointConditionLocalTransportFullDataScreenAdapters()
export const preflightJointConditionLocalTransportFullDataScreen = (context) => production.preflight(context)
export const executeJointConditionLocalTransportFullDataScreen = (context) => production.execute(context)
export const validateJointConditionLocalTransportFullDataScreen = (context) => production.validate(context)
export const reviewJointConditionLocalTransportFullDataScreen = (context) => production.review(context)
export const adjudicateJointConditionLocalTransportFullDataScreen = (context) => production.adjudicate(context)
export const finalizeJointConditionLocalTransportFullDataScreen = (context) => production.finalize(context)

export function validateJointConditionLocalTransportFullDataScreenExecutionPlan(plan, {
  projectRoot = process.cwd(), requireFiles = true,
} = {}) {
  assert.equal(plan?.schemaVersion, PLAN_SCHEMA_VERSION)
  assert.equal(plan.status, "compiled_not_started")
  assert.equal(plan.authority, "local_ai_pet_world_program")
  assert.equal(plan.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(plan.architectureId, CAPABILITY_VERSION)
  assert.equal(plan.ownerAuthorizationRequired, false)
  assert.equal(plan.ownerResponseRequired, false)
  assert.match(plan.packageIdentity ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/u)
  assert.match(plan.runId ?? "", /^[0-9]{8}-[0-9]{6,9}-joint-condition-local-transport-full-data-screen$/u)
  runtimePath(plan.outputRoot, "outputRoot")
  assert.ok(plan.outputRoot.includes("/stage4-joint-condition-local-transport-full-data-screens/"))
  assert.equal(path.posix.basename(plan.outputRoot), plan.runId)
  assert.deepEqual(plan.trainingIdentity, {
    seed: 20263722, resolutionStage: 0, resolution: { width: 256, height: 192 },
    epochCount: 24, trainSampleCountPerEpoch: 48, optimizerStepsPerEpoch: 48,
    optimizerStepCount: 1152, previewEpochs: [...PREVIEW_EPOCHS], lateEpochs: [...LATE_EPOCHS],
    diffusionStepCount: 1000, requiredUniqueTrainingTimestepCount: 1000,
    inferenceTimestepCount: 50, requiredExactInferenceOverlapCount: 50,
    reviewSampleId: FIXED_SAMPLE_ID, reviewSampleSplit: "validation",
    initialization: "fixed_random_denoiser_initialization_without_checkpoint", autoencoderFrozen: true,
  })
  assert.deepEqual(plan.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(plan.maxInfrastructureRecoveryAttempts, 1)
  assert.equal(plan.trainingRestartAllowed, false)
  assert.equal(plan.automaticSecondTrainingRunAllowed, false)
  assert.equal(plan.stage0AutomaticStart, false)
  validateCommands(plan, { projectRoot, requireFiles })
  for (const [role, binding] of Object.entries(plan.evidenceBindings ?? {})) fileBinding(binding, `evidenceBindings.${role}`, { projectRoot, requireFiles })
  for (const role of ["compiledScreenContract", "datasetManifest", "sourceIndex", "frozenAutoencoder", "professionalAestheticProgram", "conditionAlignmentProgram", "previewNormalizationProgram", "lateStabilityProgram"]) {
    assert.ok(plan.evidenceBindings?.[role], `missing evidence role: ${role}`)
  }
  if (requireFiles) {
    const compiled = readBound(projectRoot, plan.evidenceBindings.compiledScreenContract)
    assert.equal(compiled.schemaVersion, "stage4-joint-condition-local-transport-24-epoch-full-data-screen-execution-contract-v1")
    assert.equal(compiled.executionIdentity?.runId, plan.runId)
    assert.equal(compiled.outputNamespace?.outputRoot, plan.outputRoot)
    assert.deepEqual(compiled.executionIdentity?.previewEpochs, PREVIEW_EPOCHS)
    assert.deepEqual(compiled.executionIdentity?.lateEpochs, LATE_EPOCHS)
  }
  assert.equal(plan.evidenceBindings.frozenAutoencoder.sha256, "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba")
  assert.equal(plan.expectedTrainerManifestStatus, EXPECTED_TRAINER_STATUS)
  runtimePath(plan.reviewWorkRoot, "reviewWorkRoot")
  assert.equal(plan.reviewWorkRoot, `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-review-work/${plan.runId}`, "reviewWorkRoot must bind the current run")
  const serialized = JSON.stringify(plan)
  for (const token of ["stage4_full_backbone_spatial_affine_conditioned_denoiser_v1", "stage4-spatial-affine-full-data-screens", "--initial-denoiser-checkpoint", "--overfit-sample-id", "controlled-smoke"]) {
    assert.ok(!serialized.includes(token), `forbidden historical or Smoke execution identity: ${token}`)
  }
  return structuredClone(plan)
}

async function preflight(context, services) {
  try {
    const plan = loadPlan(context); const files = artifactPaths(context, plan)
    if (fs.existsSync(files.trainingOutput)) return fail("evidence", "training_output_exists_before_preflight", "Fresh training-output ownership was violated.")
    if (fs.existsSync(files.preflightReport)) return fail("evidence", "preflight_replay_forbidden", "Immutable preflight evidence already exists.")
    fs.mkdirSync(path.dirname(files.outputRoot), { recursive: true })
    if (!fs.existsSync(files.outputRoot)) fs.mkdirSync(files.outputRoot, { recursive: false })
    const results = []
    for (let index = 0; index < plan.commands.preflight.length; index += 1) {
      const command = plan.commands.preflight[index]
      context.reportProgress({ phasePercent: (index / plan.commands.preflight.length) * 100, message: `preflight_${command.id}` })
      const result = await services.runCommand(command, commandContext(context, plan, files))
      results.push(commandEvidence(result))
      assert.equal(fs.existsSync(files.trainingOutput), false, "preflight created training-output")
      if (result.exitCode !== 0) {
        writeExclusive(files.preflightReport, preflightReport(plan, results, false, services.now()))
        return fail("infrastructure", "preflight_command_failed", `${command.id} exited with ${result.exitCode}`)
      }
    }
    writeExclusive(files.preflightReport, preflightReport(plan, results, true, services.now()))
    context.reportProgress({ phasePercent: 100, message: "preflight_completed" })
    return { status: "passed", decision: "preflight_passed", preflightReport: bind(context.projectRoot, files.preflightReport) }
  } catch (error) { return fail("program", "joint_full_data_screen_preflight_exception", String(error?.stack ?? error)) }
}

async function execute(context, services) {
  try {
    const plan = loadPlan(context); const files = artifactPaths(context, plan)
    const completed = inspectCompleted(context.projectRoot, plan, files)
    if (completed.complete) return { status: "passed", decision: "training_completed", recoveredWithoutRetraining: true, trainerManifest: completed.binding }
    if (fs.existsSync(files.trainingOutput)) return fail("evidence", "partial_training_output_reuse_forbidden", completed.detail ?? "Partial training output cannot be reused.")
    if (fs.existsSync(files.launchIntent)) return fail("evidence", "ambiguous_prior_training_launch", "A second Trainer launch is forbidden.")
    assert.equal(readJson(files.preflightReport).status, "all_preflight_checks_passed")
    const activation = await services.runCommand(plan.commands.activation, commandContext(context, plan, files))
    if (activation.exitCode !== 0) return fail("infrastructure", "active_config_materialization_failed", `activation exited with ${activation.exitCode}`)
    assert.ok(fs.existsSync(files.activeConfig)); assert.equal(fs.existsSync(files.trainingOutput), false)
    writeExclusive(files.launchIntent, {
      schemaVersion: "ai-painter-joint-full-data-screen-launch-intent-v1", runId: plan.runId,
      packageIdentity: context.packageIdentity, activeConfig: bind(context.projectRoot, files.activeConfig),
      trainerProcessStarted: false, trainingRestartAllowed: false, recordedAtUtc: services.now(),
    })
    const result = await services.runCommand(plan.commands.trainer, {
      ...commandContext(context, plan, files),
      onStarted: ({ pid }) => writeAtomic(files.launchIntent, { ...readJson(files.launchIntent), trainerProcessStarted: true, trainerPid: pid ?? null, trainerStartedAtUtc: services.now() }),
      onProgress: (progress) => context.reportProgress(normalizeProgress(progress)),
    })
    writeAtomic(files.launchIntent, { ...readJson(files.launchIntent), trainerExitCode: result.exitCode, trainerExitedAtUtc: services.now() })
    if (result.exitCode !== 0) return fail(result.started ? "business" : "infrastructure", result.started ? "trainer_failed_after_start" : "trainer_spawn_failed", `Trainer exited with ${result.exitCode}`)
    const post = inspectCompleted(context.projectRoot, plan, files)
    if (!post.complete) return fail("evidence", "trainer_exit_zero_without_complete_manifest", post.detail)
    context.reportProgress({ phasePercent: 100, epoch: 24, epochTarget: 24, optimizerStep: 1152, optimizerStepTarget: 1152, message: "training_completed_validation_continues_automatically" })
    return { status: "passed", decision: "training_completed", trainerManifest: post.binding }
  } catch (error) { return fail("program", "joint_full_data_screen_execute_exception", String(error?.stack ?? error)) }
}

async function validate(context, services) {
  try {
    const plan = loadPlan(context); const files = artifactPaths(context, plan)
    const completed = inspectCompleted(context.projectRoot, plan, files)
    if (!completed.complete) return fail("evidence", "completed_training_identity_invalid", completed.detail)
    const previews = validatePreviews(context.projectRoot, plan, completed.manifest)
    const progress = readJson(files.trainerProgress); assert.equal(progress.status, "completed")
    const telemetry = readJson(files.resourceTelemetry)
    assert.ok(Array.isArray(telemetry.rows) && telemetry.rows.length > 0)
    assert.ok(Number.isFinite(telemetry.peakGpuMemoryBytes) && telemetry.peakGpuMemoryBytes > 0)
    assert.equal(telemetry.preflightMemoryIsTrainingPeak ?? false, false)
    writeExclusive(files.validationReport, {
      schemaVersion: "ai-painter-joint-full-data-screen-validation-v1", status: "passed", runId: plan.runId,
      trainerManifest: completed.binding, trainerProgress: bind(context.projectRoot, files.trainerProgress),
      resourceTelemetry: bind(context.projectRoot, files.resourceTelemetry), fixedPreviews: previews,
      recordedAtUtc: services.now(),
    })
    context.reportProgress({ phasePercent: 100, message: "training_evidence_validated" })
    return { status: "passed", decision: "training_evidence_valid", validationReport: bind(context.projectRoot, files.validationReport) }
  } catch (error) { return fail("evidence", "joint_full_data_screen_training_evidence_invalid", String(error?.stack ?? error)) }
}

async function review(context, services) {
  try {
    const plan = loadPlan(context); const files = artifactPaths(context, plan)
    const previews = validatePreviews(context.projectRoot, plan, readJson(files.trainerManifest))
    const source = reviewSource(context.projectRoot, plan)
    fs.mkdirSync(files.reviewAssets, { recursive: true }); fs.mkdirSync(resolveInside(context.projectRoot, plan.reviewWorkRoot), { recursive: true })
    let rows = []
    if (fs.existsSync(files.machineReviewTimeline)) {
      const existing = readJson(files.machineReviewTimeline); validateTimeline(context.projectRoot, plan, existing); rows = existing.reviews
    }
    for (const preview of previews.slice(rows.length)) {
      const normalizedPath = path.join(files.reviewAssets, `epoch-${String(preview.epoch).padStart(3, "0")}.png`)
      const normalized = await services.normalizePreview({ sourcePath: resolveInside(context.projectRoot, preview.path), finalAssetPath: normalizedPath, workRoot: resolveInside(context.projectRoot, plan.reviewWorkRoot), workId: sha256(Buffer.from(plan.runId)).slice(0, 16), epoch: preview.epoch })
      const [aesthetic, alignment] = await Promise.all([
        services.auditAesthetic(normalized.shortOutputPath),
        services.auditAlignment({ record: { recordId: `${plan.runId}-epoch-${preview.epoch}`, conditionBinding: { conditionPackPath: source.sample.conditionPackPath, worldId: source.conditionPack.worldId, tick: source.conditionPack.tick }, classification: source.sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: resolveInside(context.projectRoot, source.sample.imagePath) }),
      ])
      rows.push({ epoch: preview.epoch, previewPath: preview.path, previewSha256: preview.sha256, reproductionPath: preview.reproductionPath, reproductionSha256: preview.reproductionSha256, byteExactReproduced: true, normalizedPath: projectPath(context.projectRoot, normalizedPath), normalizedSha256: sha256File(normalizedPath), passed: aesthetic.passed === true && alignment.passed === true, issueCodes: [...new Set([...(aesthetic.issues ?? []).map((item) => item.code), ...(alignment.issues ?? []).map((item) => item.code)])].sort(), professionalAesthetic: aesthetic, conditionAlignment: alignment })
      writeAtomic(files.machineReviewTimeline, timeline(plan, rows, false, services.now()))
      context.reportProgress({ phasePercent: (rows.length / PREVIEW_EPOCHS.length) * 100, message: `machine_review_epoch_${preview.epoch}_completed`, metrics: { completedReviewCount: rows.length, targetReviewCount: PREVIEW_EPOCHS.length } })
    }
    const result = timeline(plan, rows, true, services.now()); writeAtomic(files.machineReviewTimeline, result)
    return { status: "passed", decision: "machine_review_completed", reviewOutcome: result.status, passCount: result.previewPassCount, failCount: result.previewFailCount, machineReviewTimeline: bind(context.projectRoot, files.machineReviewTimeline) }
  } catch (error) { return fail("evidence", "joint_full_data_screen_machine_review_incomplete", String(error?.stack ?? error)) }
}

async function adjudicate(context, services) {
  try {
    const plan = loadPlan(context); const files = artifactPaths(context, plan); const review = readJson(files.machineReviewTimeline)
    assert.equal(review.completedReviewCount, PREVIEW_EPOCHS.length)
    const decision = services.adjudicate(review.reviews, { requiredEpochs: PREVIEW_EPOCHS, lateEpochs: LATE_EPOCHS })
    const result = { schemaVersion: "ai-painter-joint-full-data-screen-late-stability-v1", status: decision.qualified ? "qualified" : "real_visual_failure", capabilityVersion: CAPABILITY_VERSION, runId: plan.runId, qualified: decision.qualified === true, decision, thresholdsChanged: false, trainingRetryAllowed: false, recordedAtUtc: services.now() }
    writeExclusive(files.lateStabilityQualification, result); context.reportProgress({ phasePercent: 100, message: result.status })
    return { status: "passed", decision: result.status, qualified: result.qualified, lateStabilityQualification: bind(context.projectRoot, files.lateStabilityQualification) }
  } catch (error) { return fail("evidence", "joint_full_data_screen_adjudication_invalid", String(error?.stack ?? error)) }
}

async function finalize(context, services) {
  try {
    const plan = loadPlan(context); const files = artifactPaths(context, plan)
    const training = readJson(files.trainerManifest); const review = readJson(files.machineReviewTimeline); const qualification = readJson(files.lateStabilityQualification)
    validateTimeline(context.projectRoot, plan, review)
    assert.equal(qualification.runId, plan.runId); assert.equal(qualification.capabilityVersion, CAPABILITY_VERSION)
    assert.deepEqual(qualification.decision?.lateEpochs ?? LATE_EPOCHS, LATE_EPOCHS)
    const qualified = qualification.qualified === true
    const recovery = training.evidenceRecovery ?? null
    writeExclusive(files.manifest, { schemaVersion: "ai-painter-joint-condition-local-transport-full-data-screen-manifest-v1", status: qualified ? "qualified" : "real_visual_failure", capabilityVersion: CAPABILITY_VERSION, packageIdentity: context.packageIdentity, runId: plan.runId, trainingManifest: bind(context.projectRoot, files.trainerManifest), machineReviewTimeline: bind(context.projectRoot, files.machineReviewTimeline), lateStabilityQualification: bind(context.projectRoot, files.lateStabilityQualification), checkpoint: { path: training.checkpointPath, sha256: training.checkpointSha256, promotable: false }, postCheckpointRecovery: recovery, stage0Started: false, trainingRetryStarted: false, recordedAtUtc: services.now() })
    fs.mkdirSync(path.dirname(files.finalization), { recursive: true })
    writeExclusive(files.finalization, { schemaVersion: "ai-painter-joint-condition-local-transport-full-data-screen-finalization-v1", executionState: qualified ? "completed" : "failed_closed", status: qualified ? "full_data_screen_qualified" : "full_data_screen_real_visual_failure", capabilityVersion: CAPABILITY_VERSION, runId: plan.runId, manifest: bind(context.projectRoot, files.manifest), reviewSummary: { passCount: review.previewPassCount, failCount: review.previewFailCount }, postCheckpointRecovery: recovery, ownerAuthorizationRequired: false, ownerResponseRequired: false, stage0Started: false, automaticRetryStarted: false, recordedAtUtc: services.now() })
    context.reportProgress({ phasePercent: 100, message: qualified ? "full_data_screen_qualified" : "full_data_screen_real_visual_failure" })
    if (!qualified) return fail("visual", "joint_full_data_screen_real_visual_failure", "The immutable late review did not qualify the full-data screen.", { finalization: bind(context.projectRoot, files.finalization) })
    return { status: "passed", decision: "full_data_screen_qualified", manifest: bind(context.projectRoot, files.manifest), finalization: bind(context.projectRoot, files.finalization) }
  } catch (error) { return fail("program", "joint_full_data_screen_finalization_failed", String(error?.stack ?? error)) }
}

function loadPlan(context) {
  const matches = []
  for (const binding of context.inputEvidence ?? []) {
    const absolute = resolveInside(context.projectRoot, binding.path); assert.equal(sha256File(absolute), binding.sha256)
    if (!binding.path.endsWith(".json")) continue
    try { const value = readJson(absolute); if (value?.schemaVersion === PLAN_SCHEMA_VERSION) matches.push(value) } catch {}
  }
  assert.equal(matches.length, 1)
  const plan = validateJointConditionLocalTransportFullDataScreenExecutionPlan(matches[0], { projectRoot: context.projectRoot, requireFiles: true })
  assert.equal(plan.packageIdentity, context.packageIdentity); assert.equal(plan.outputRoot, context.outputRoot)
  return plan
}

function inspectCompleted(root, plan, files) {
  if (!fs.existsSync(files.trainerManifest)) return { complete: false, detail: "Trainer manifest is absent." }
  try {
    const manifest = readJson(files.trainerManifest)
    assert.equal(manifest.status, EXPECTED_TRAINER_STATUS); assert.equal(manifest.architectureVersion, TRAINER_ARCHITECTURE_VERSION)
    assert.equal(manifest.trainingStage, "stage4_joint_condition_local_transport_full_data_screen")
    assert.equal(manifest.seed, 20263722); assert.deepEqual(manifest.resolutionStage, { width: 256, height: 192 })
    assert.equal(manifest.actualLoadedConditionalSampleCount, 64); assert.deepEqual(manifest.actualLoadedSplitCounts, plan.splitCounts)
    assert.equal(manifest.metrics?.length, 24)
    assert.equal(manifest.parentDenoiserCheckpointPath, null); assert.equal(manifest.parentDenoiserCheckpointSha256, null)
    assert.equal(manifest.checkpointPromotionEligible, false); assert.equal(manifest.stage0InitializationEligible, false)
    const identity = manifest.stage4JointConditionLocalTransportFullDataScreen
    assert.equal(identity?.architectureId, CAPABILITY_VERSION); assert.equal(identity?.runId, plan.runId)
    assert.deepEqual(identity?.inactiveContract, plan.evidenceBindings.inactiveFullDataScreenContract)
    assert.equal(identity?.optimizerStepCount, 1152)
    assert.equal(manifest.configPath, `${plan.outputRoot}/active-config.json`)
    assert.equal(manifest.configSha256, sha256File(resolveInside(root, manifest.configPath)))
    validatePreviews(root, plan, manifest)
    artifact(root, { path: manifest.checkpointPath, sha256: manifest.checkpointSha256 }, "checkpoint")
    artifact(root, { path: manifest.resourceTelemetryPath, sha256: manifest.resourceTelemetrySha256 }, "telemetry")
    assertCurrentOutput(root, plan, manifest.checkpointPath, "checkpoint")
    assertCurrentOutput(root, plan, manifest.resourceTelemetryPath, "telemetry")
    return { complete: true, manifest, binding: bind(root, files.trainerManifest) }
  } catch (error) { return { complete: false, detail: String(error?.stack ?? error) } }
}

function validatePreviews(root, plan, manifest) {
  assert.deepEqual(manifest.previewEpochs, PREVIEW_EPOCHS); assert.equal(manifest.fixedPreviews?.length, PREVIEW_EPOCHS.length)
  assert.deepEqual(manifest.fixedPreviews.map((row) => row.epoch), PREVIEW_EPOCHS)
  return manifest.fixedPreviews.map((row) => { artifact(root, row, `preview-${row.epoch}`); artifact(root, { path: row.reproductionPath, sha256: row.reproductionSha256 }, `reproduction-${row.epoch}`); assert.equal(row.sha256, row.reproductionSha256); assertCurrentOutput(root, plan, row.path, `preview-${row.epoch}`); assertCurrentOutput(root, plan, row.reproductionPath, `reproduction-${row.epoch}`); return structuredClone(row) })
}

function reviewSource(root, plan) {
  const index = readBound(root, plan.evidenceBindings.sourceIndex); assert.ok(Array.isArray(index.samples)); assert.equal(index.sampleCount, 116); assert.equal(index.samples.length, 116)
  const samples = index.samples.filter((row) => row.v7CapacityContributionRegistered === true); assert.equal(samples.length, 64)
  assert.deepEqual(Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [split, samples.filter((row) => row.split === split).length])), plan.splitCounts)
  const matches = samples.filter((row) => row.sampleId === FIXED_SAMPLE_ID && row.recordId === FIXED_SAMPLE_ID); assert.equal(matches.length, 1); assert.equal(matches[0].split, "validation")
  const conditionPack = readJson(resolveInside(root, matches[0].conditionPackPath)); assert.equal(conditionPack.channels?.length, 23)
  return { sample: matches[0], conditionPack }
}

function timeline(plan, reviews, completed, now) { return { schemaVersion: "ai-painter-joint-full-data-screen-machine-review-timeline-v1", status: completed ? (reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed") : "running", capabilityVersion: CAPABILITY_VERSION, runId: plan.runId, sampleId: FIXED_SAMPLE_ID, sampleSplit: "validation", completedReviewCount: reviews.length, targetReviewCount: PREVIEW_EPOCHS.length, previewPassCount: reviews.filter((row) => row.passed).length, previewFailCount: reviews.filter((row) => !row.passed).length, reviewThresholdsChanged: false, machineReviewResultsUsedAsTrainingTarget: false, failedPreviewPixelsUsedAsTrainingTarget: false, reviews, updatedAtUtc: now, ...(completed ? { completedAtUtc: now } : {}) } }

function validateTimeline(root, plan, value) {
  assert.equal(value.schemaVersion, "ai-painter-joint-full-data-screen-machine-review-timeline-v1")
  assert.equal(value.capabilityVersion, CAPABILITY_VERSION); assert.equal(value.runId, plan.runId)
  assert.equal(value.sampleId, FIXED_SAMPLE_ID); assert.equal(value.sampleSplit, "validation")
  assert.deepEqual(value.reviews.map((row) => row.epoch), PREVIEW_EPOCHS.slice(0, value.reviews.length))
  for (const row of value.reviews) {
    artifact(root, { path: row.previewPath, sha256: row.previewSha256 }, `review-preview-${row.epoch}`)
    artifact(root, { path: row.reproductionPath, sha256: row.reproductionSha256 }, `review-reproduction-${row.epoch}`)
    artifact(root, { path: row.normalizedPath, sha256: row.normalizedSha256 }, `review-normalized-${row.epoch}`)
    assert.equal(row.previewSha256, row.reproductionSha256); assert.equal(row.byteExactReproduced, true)
    assert.ok(row.professionalAesthetic && row.conditionAlignment, "formal auditor evidence missing")
    assertCurrentOutput(root, plan, row.previewPath, `review-preview-${row.epoch}`)
    assertCurrentOutput(root, plan, row.reproductionPath, `review-reproduction-${row.epoch}`)
    assertCurrentOutput(root, plan, row.normalizedPath, `review-normalized-${row.epoch}`)
  }
  return true
}

function validateCommands(plan, options) {
  assert.ok(Array.isArray(plan.commands?.preflight) && plan.commands.preflight.length > 0)
  for (const command of [...plan.commands.preflight, plan.commands.activation, plan.commands.trainer]) {
    assert.ok(command && ["node", "python"].includes(command.runtime)); fileBinding(command.program, `command.${command.id}`, options); assert.ok(Array.isArray(command.arguments)); assert.equal(command.expectedExitCode, 0)
  }
  const trainerArgs = plan.commands.trainer.arguments
  assert.ok(trainerArgs.includes("--stage4-joint-condition-local-transport-full-data-screen")); assert.ok(!trainerArgs.includes("--epochs"))
  assert.ok(trainerArgs.includes("--dataset-package")); assert.ok(!trainerArgs.includes("--dataset-manifest"))
  assert.ok(!trainerArgs.includes("--preflight-only")); assert.ok(plan.commands.preflight.some((row) => row.arguments.includes("--preflight-only")))
}

function artifactPaths(context, plan) { const root = resolveInside(context.projectRoot, plan.outputRoot); const result = { outputRoot: root }; for (const [key, value] of Object.entries(plan.artifacts)) result[key] = resolveInside(root, value); return { ...result, reviewAssets: result.reviewAssets ?? path.join(root, "machine-review-assets"), validationReport: result.validationReport ?? path.join(root, "validation-report.json"), launchIntent: result.launchIntent ?? path.join(root, "trainer-launch-intent.json") } }
function commandContext(context, plan, files) { return { projectRoot: context.projectRoot, outputRoot: files.outputRoot, trainingOutput: files.trainingOutput, runId: plan.runId, onHeartbeat: context.heartbeat, onProgress: context.reportProgress } }
function normalizeProgress(value = {}) { return { phasePercent: Number(value.phasePercent ?? value.percentage ?? 0), epoch: Number(value.epoch ?? 0), epochTarget: 24, optimizerStep: Number(value.optimizerStep ?? 0), optimizerStepTarget: 1152, etaSeconds: Math.max(0, Number(value.etaSeconds ?? 0)), message: String(value.message ?? value.phase ?? "training") } }

async function runCommand(command, context) {
  const executable = command.runtime === "node" ? process.execPath : resolvePython(context.projectRoot)
  const program = resolveInside(context.projectRoot, command.program.path); assert.equal(sha256File(program), command.program.sha256)
  const args = command.arguments.map((arg) => arg.replaceAll("${OUTPUT_ROOT}", context.outputRoot).replaceAll("${TRAINING_OUTPUT}", context.trainingOutput).replaceAll("${RUN_ID}", context.runId))
  const child = spawn(executable, [program, ...args], { cwd: context.projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); context.onStarted?.({ pid: child.pid })
  let stdout = "", stderr = ""; child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-65536) }); child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-65536) })
  const pollProgress = () => {
    context.onHeartbeat?.()
    const progressPath = path.join(context.trainingOutput, "progress.json")
    if (!fs.existsSync(progressPath)) return
    try { const value = readJson(progressPath); context.onProgress?.(value.liveProgress ?? value.live ?? value) } catch { /* incomplete atomic handoff; retry on the next heartbeat */ }
  }
  const timer = setInterval(pollProgress, 5000)
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve) }).finally(() => clearInterval(timer))
  return { id: command.id, exitCode, started: true, stdoutTail: stdout, stderrTail: stderr }
}

function resolvePython(root) { for (const candidate of [process.env.AI_PAINTER_PYTHON, process.platform === "win32" ? path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe") : path.join(root, "ml", "ai-painter", ".venv", "bin", "python"), "python"]) if (candidate && (candidate === "python" || fs.existsSync(candidate))) return candidate; throw new Error("python runtime unavailable") }
function commandEvidence(value) { return { id: value.id, exitCode: value.exitCode, started: value.started === true, stdoutTail: value.stdoutTail ?? "", stderrTail: value.stderrTail ?? "" } }
function preflightReport(plan, results, passed, recordedAtUtc) { const passedIds = new Set(results.filter((row) => row.exitCode === 0).map((row) => row.id)); return { schemaVersion: "stage4-joint-condition-local-transport-full-data-screen-preflight-v1", status: passed ? "all_preflight_checks_passed" : "failed_closed", runId: plan.runId, outputNamespace: plan.outputRoot, checks: { cpuContract: passedIds.has("cpu-contract"), activeConfigAudit: passedIds.has("active-config-audit"), trainerReadonlyPreflight: passedIds.has("trainer-readonly-preflight"), cudaResource: passedIds.has("cuda-resource"), diskCapacity: passedIds.has("disk-capacity"), trainingOutputAbsent: true }, commandEvidence: results, gpuStarted: false, trainingStarted: false, recordedAtUtc } }
function fileBinding(binding, label, { projectRoot, requireFiles }) { assert.ok(binding && typeof binding.path === "string"); assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u); if (requireFiles) assert.equal(sha256File(resolveInside(projectRoot, binding.path)), binding.sha256, `${label} SHA mismatch`) }
function artifact(root, binding, label) { fileBinding(binding, label, { projectRoot: root, requireFiles: true }) }
function readBound(root, binding) { artifact(root, binding, binding.path); return readJson(resolveInside(root, binding.path)) }
function runtimePath(value, label) { assert.ok(typeof value === "string" && value.startsWith(".runtime/ai-painter/") && !value.includes("..") && !value.includes("\\"), `${label} invalid`) }
function resolveInside(root, relative) { const base = path.resolve(root); const target = path.resolve(base, relative); assert.ok(target.startsWith(`${base}${path.sep}`), `path escapes project: ${relative}`); return target }
function projectPath(root, absolute) { return path.relative(path.resolve(root), absolute).replaceAll("\\", "/") }
function assertCurrentOutput(root, plan, relative, label) { const output = resolveInside(root, plan.outputRoot); const target = resolveInside(root, relative); assert.ok(target.startsWith(`${output}${path.sep}`), `${label} is outside the current run output`) }
function bind(root, absolute) { return { path: projectPath(root, absolute), sha256: sha256File(absolute) } }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }) }
function writeAtomic(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const temporary = `${file}.tmp-${process.pid}`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temporary, file) }
function sha256File(file) { return sha256(fs.readFileSync(file)) }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function fail(failureKind, failureCode, detail, extra = {}) { return { status: "failed", failureKind, failureCode, detail, ...extra } }
