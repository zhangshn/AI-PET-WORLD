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
export const PLAN_SCHEMA_VERSION = "ai-painter-stage4-joint-condition-local-transport-smoke-execution-plan-v1"
export const PACKAGE_CAPABILITY_VERSION = CAPABILITY_VERSION
export const FIXED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const FIXED_PREVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const FIXED_LATE_EPOCHS = Object.freeze([10, 20, 30])
export const EXPECTED_TRAINER_STATUS =
  "stage4_joint_condition_local_transport_controlled_smoke_training_completed_awaiting_automatic_machine_review"
export const ADAPTER_EXPORTS = Object.freeze({
  preflight: "preflightJointConditionLocalTransportSmoke",
  execute: "executeJointConditionLocalTransportSmoke",
  validate: "validateJointConditionLocalTransportSmoke",
  review: "reviewJointConditionLocalTransportSmoke",
  adjudicate: "adjudicateJointConditionLocalTransportSmoke",
  finalize: "finalizeJointConditionLocalTransportSmoke",
})

const PLAN_STATUS = "compiled_not_started"
const REQUIRED_PREFLIGHT_COMMAND_IDS = Object.freeze([
  "cpu-contract",
  "active-config-audit",
  "trainer-readonly-preflight",
  "cuda-resource",
  "disk-capacity",
])
const REQUIRED_EVIDENCE_ROLES = Object.freeze([
  "compiledSmokeContract",
  "datasetManifest",
  "sourceIndex",
  "frozenAutoencoder",
  "readonlyGpuTerminal",
  "readonlyGpuReport",
  "professionalAestheticProgram",
  "conditionAlignmentProgram",
  "previewNormalizationProgram",
  "lateStabilityProgram",
])
const LEGACY_IDENTITY_TOKENS = Object.freeze([
  "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
  "stage4-full-backbone-spatial-affine-controlled-smokes",
  "stage4FullBackboneSpatialAffineSmokeContract",
])

const defaultServices = Object.freeze({
  runCommand,
  normalizePreview: normalizePreviewWithWindowsSafeIo,
  auditAesthetic: auditAiAssistedProfessionalAesthetic,
  auditAlignment: auditAiAssistedConditionAlignment,
  adjudicate: adjudicateLateReviewRows,
  now: () => new Date().toISOString(),
})

export function createJointConditionLocalTransportSmokeAdapters(overrides = {}) {
  const services = Object.freeze({ ...defaultServices, ...overrides })
  return Object.freeze({
    preflight: (context) => preflightPhase(context, services),
    execute: (context) => executePhase(context, services),
    validate: (context) => validatePhase(context, services),
    review: (context) => reviewPhase(context, services),
    adjudicate: (context) => adjudicatePhase(context, services),
    finalize: (context) => finalizePhase(context, services),
  })
}

const productionAdapters = createJointConditionLocalTransportSmokeAdapters()

export async function preflightJointConditionLocalTransportSmoke(context) {
  return productionAdapters.preflight(context)
}
export async function executeJointConditionLocalTransportSmoke(context) {
  return productionAdapters.execute(context)
}
export async function validateJointConditionLocalTransportSmoke(context) {
  return productionAdapters.validate(context)
}
export async function reviewJointConditionLocalTransportSmoke(context) {
  return productionAdapters.review(context)
}
export async function adjudicateJointConditionLocalTransportSmoke(context) {
  return productionAdapters.adjudicate(context)
}
export async function finalizeJointConditionLocalTransportSmoke(context) {
  return productionAdapters.finalize(context)
}

export function validateJointConditionLocalTransportSmokeExecutionPlan(plan, {
  projectRoot = process.cwd(), requireFiles = true,
} = {}) {
  assert.equal(plan?.schemaVersion, PLAN_SCHEMA_VERSION, "joint transport Smoke plan schema mismatch")
  assert.equal(plan.status, PLAN_STATUS, "joint transport Smoke plan status mismatch")
  assert.equal(plan.authority, "local_ai_pet_world_program", "joint transport Smoke authority mismatch")
  assert.equal(plan.capabilityVersion, CAPABILITY_VERSION, "joint transport Smoke capability mismatch")
  assert.equal(plan.architectureId, CAPABILITY_VERSION, "joint transport Smoke architecture mismatch")
  assert.equal(plan.ownerAuthorizationRequired, false, "joint transport Smoke cannot require Owner authorization")
  assert.equal(plan.ownerResponseRequired, false, "joint transport Smoke cannot require an Owner response")
  assert.match(plan.packageIdentity ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/u)
  assert.match(plan.runId ?? "", /^[0-9]{8}-[0-9]{6,9}-joint-condition-local-transport-smoke$/u)
  validateRuntimePath(plan.outputRoot, "outputRoot")
  assert.equal(path.posix.basename(plan.outputRoot), plan.runId, "outputRoot must terminate in the new runId")
  assert.ok(
    plan.outputRoot.includes("/stage4-joint-condition-local-transport-controlled-smokes/"),
    "outputRoot must use the joint transport controlled Smoke namespace",
  )
  assert.deepEqual(plan.fixedTrainingIdentity, {
    sampleId: FIXED_SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [...FIXED_PREVIEW_EPOCHS],
    initialization: "fixed_random_denoiser_initialization_without_checkpoint",
    autoencoderFrozen: true,
  })
  assert.equal(plan.maxInfrastructureRecoveryAttempts, 1, "only one bounded infrastructure recovery is allowed")
  assert.equal(plan.trainingRestartAllowed, false, "training restart must be forbidden")
  assert.equal(plan.automaticSecondTrainingRunAllowed, false, "a second training run must be forbidden")
  assert.equal(plan.stage0AutomaticStart, false, "Stage 0 cannot start inside the Smoke package")
  validateCommandList(plan.commands?.preflight, "preflight", { projectRoot, requireFiles })
  assert.deepEqual(
    [...new Set(plan.commands.preflight.map((command) => command.id))].sort(),
    [...REQUIRED_PREFLIGHT_COMMAND_IDS].sort(),
    "preflight command set mismatch",
  )
  validateCommand(plan.commands?.activation, "activation", { projectRoot, requireFiles })
  validateCommand(plan.commands?.trainer, "trainer", { projectRoot, requireFiles })
  assert.equal(plan.commands.activation.program.path, "ml/ai-painter/scripts/materialize_stage4_joint_condition_local_transport_controlled_smoke.py")
  assert.equal(plan.commands.trainer.program.path, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
  assert.ok(plan.commands.preflight.some((command) => (
    command.program.path === "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
    && command.arguments.includes("--preflight-only")
  )), "real Trainer read-only preflight is required")
  assert.ok(plan.commands.trainer.arguments.includes("--stage4-joint-condition-local-transport-smoke"))
  assert.ok(plan.commands.trainer.arguments.includes("--stage4-joint-condition-local-transport-smoke-contract"))
  assert.ok(!plan.commands.trainer.arguments.includes("--initial-denoiser-checkpoint"))
  assert.ok(!plan.commands.trainer.arguments.includes("--preflight-only"))
  assert.ok(plan.commands.preflight.some((command) => command.arguments.includes("--preflight-only")))

  assert.deepEqual(Object.keys(plan.evidenceBindings ?? {}).sort(), [...REQUIRED_EVIDENCE_ROLES].sort())
  for (const [role, binding] of Object.entries(plan.evidenceBindings)) {
    validateFileBinding(binding, `evidenceBindings.${role}`, { projectRoot, requireFiles })
  }
  assert.equal(plan.evidenceBindings.professionalAestheticProgram.path, "scripts/lib/ai-assisted-professional-aesthetic.mjs")
  assert.equal(plan.evidenceBindings.conditionAlignmentProgram.path, "scripts/lib/ai-assisted-condition-alignment.mjs")
  assert.equal(plan.evidenceBindings.previewNormalizationProgram.path, "scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs")
  assert.equal(plan.evidenceBindings.lateStabilityProgram.path, "scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs")
  assert.equal(plan.evidenceBindings.frozenAutoencoder.sha256, "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba")
  assert.deepEqual(plan.artifacts, {
    activeConfig: "active-config.json",
    preflightReport: "preflight-report.json",
    trainingOutput: "training-output",
    trainerManifest: "training-output/manifest.json",
    trainerProgress: "training-output/progress.json",
    resourceTelemetry: "training-output/resource-telemetry.json",
    machineReviewTimeline: "machine-review-timeline.json",
    lateStabilityQualification: "late-stability-qualification.json",
    manifest: "manifest.json",
    finalization: "finalization/finalization.json",
  })
  validateRuntimePath(plan.reviewWorkRoot, "reviewWorkRoot")
  assert.ok(plan.reviewWorkRoot.includes("joint-condition-local-transport"), "review work must use the new candidate namespace")
  assert.equal(plan.expectedTrainerManifestStatus, EXPECTED_TRAINER_STATUS)
  const serialized = JSON.stringify(plan)
  for (const token of LEGACY_IDENTITY_TOKENS) {
    assert.ok(!serialized.includes(token), `legacy candidate identity is forbidden: ${token}`)
  }
  return structuredClone(plan)
}

async function preflightPhase(context, services) {
  try {
    const plan = loadPlan(context)
    const paths = resolveArtifactPaths(context, plan)
    if (fs.existsSync(paths.trainingOutput)) {
      return failed("evidence", "training_output_exists_before_preflight", "A prior or partial training-output directory cannot be reused.")
    }
    if (fs.existsSync(paths.preflightReport)) {
      const existing = readJson(paths.preflightReport)
      if (validatePreflightReport(context.projectRoot, plan, existing, { throwOnFailure: false })) {
        context.reportProgress({ phasePercent: 100, message: "preflight_recovered_without_training" })
        return { status: "passed", decision: "preflight_passed", recovered: true, preflightReport: bindFile(context.projectRoot, paths.preflightReport) }
      }
      return failed(
        "evidence",
        "prior_failed_preflight_evidence_present",
        "This immutable run already contains a failed preflight report and cannot replay or overwrite it.",
        { preflightReport: bindFile(context.projectRoot, paths.preflightReport) },
      )
    }
    fs.mkdirSync(path.dirname(paths.outputRoot), { recursive: true })
    if (!fs.existsSync(paths.outputRoot)) fs.mkdirSync(paths.outputRoot, { recursive: false })
    const commandEvidence = []
    for (let index = 0; index < plan.commands.preflight.length; index += 1) {
      context.reportProgress({
        phasePercent: (index / plan.commands.preflight.length) * 100,
        message: `preflight_${plan.commands.preflight[index].id}`,
      })
      const result = await services.runCommand(plan.commands.preflight[index], {
        projectRoot: context.projectRoot, outputRoot: paths.outputRoot,
        trainingOutput: paths.trainingOutput, runId: plan.runId,
        onHeartbeat: () => context.heartbeat(), onProgress: context.reportProgress,
      })
      commandEvidence.push(commandResultEvidence(result))
      if (result.exitCode !== 0) {
        writeJsonAtomic(paths.preflightReport, buildPreflightReport(context.projectRoot, plan, commandEvidence, false, services.now()))
        return failed("infrastructure", "preflight_command_failed", `Preflight command ${plan.commands.preflight[index].id} exited with ${result.exitCode}.`)
      }
      assert.equal(fs.existsSync(paths.trainingOutput), false, "preflight created training-output")
    }
    if (fs.existsSync(paths.preflightReport)) writeJsonAtomic(paths.preflightReport, buildPreflightReport(context.projectRoot, plan, commandEvidence, true, services.now()))
    else writeJsonExclusive(paths.preflightReport, buildPreflightReport(context.projectRoot, plan, commandEvidence, true, services.now()))
    context.reportProgress({ phasePercent: 100, message: "preflight_completed" })
    return { status: "passed", decision: "preflight_passed", preflightReport: bindFile(context.projectRoot, paths.preflightReport) }
  } catch (error) {
    return failed("program", "joint_transport_preflight_exception", String(error?.stack ?? error))
  }
}

async function executePhase(context, services) {
  try {
    const plan = loadPlan(context)
    const paths = resolveArtifactPaths(context, plan)
    const completed = inspectCompletedTraining(context.projectRoot, plan, paths)
    if (completed.complete) {
      context.reportProgress({ phasePercent: 100, epoch: 30, epochTarget: 30, message: "training_output_recovered_without_retraining" })
      return { status: "passed", decision: "training_completed", recoveredWithoutRetraining: true, trainerManifest: completed.manifestBinding }
    }
    if (fs.existsSync(paths.trainingOutput)) {
      return failed("evidence", "partial_training_output_reuse_forbidden", "training-output exists without a valid completed Trainer manifest; retraining is forbidden.")
    }
    const existingLaunch = fs.existsSync(paths.launchIntent) ? readJson(paths.launchIntent) : null
    if (existingLaunch?.trainerProcessStarted === true) {
      return failed("evidence", "ambiguous_prior_training_launch", "A prior Trainer process started without completed immutable output; a second launch is forbidden.")
    }
    assert.ok(fs.existsSync(paths.preflightReport), "preflight report is missing")
    const preflight = readJson(paths.preflightReport)
    validatePreflightReport(context.projectRoot, plan, preflight)

    if (!fs.existsSync(paths.activeConfig)) {
      const activation = await services.runCommand(plan.commands.activation, {
        projectRoot: context.projectRoot, outputRoot: paths.outputRoot,
        trainingOutput: paths.trainingOutput, runId: plan.runId,
        onHeartbeat: () => context.heartbeat(), onProgress: context.reportProgress,
      })
      if (activation.exitCode !== 0) {
        return failed(
          "infrastructure",
          "active_config_materialization_failed",
          `Activation exited with ${activation.exitCode}; Trainer was not started.`,
          { activationEvidence: commandResultEvidence(activation) },
        )
      }
      assert.ok(fs.existsSync(paths.activeConfig), "activation did not create active-config.json")
      assert.equal(fs.existsSync(paths.trainingOutput), false, "activation created training-output")
    }

    const activeConfigValidation = await services.runCommand({
      id: "validate-active-config",
      runtime: plan.commands.activation.runtime,
      program: plan.commands.activation.program,
      arguments: ["--operation", "validate", "--config", paths.activeConfig],
      expectedExitCode: 0,
    }, {
      projectRoot: context.projectRoot, outputRoot: paths.outputRoot,
      trainingOutput: paths.trainingOutput, runId: plan.runId,
      onHeartbeat: () => context.heartbeat(), onProgress: context.reportProgress,
    })
    if (activeConfigValidation.exitCode !== 0) {
      return failed(
        "evidence",
        "active_config_validation_failed",
        `Active config validation exited with ${activeConfigValidation.exitCode}; Trainer was not started.`,
        { validationEvidence: commandResultEvidence(activeConfigValidation) },
      )
    }
    assert.equal(fs.existsSync(paths.trainingOutput), false, "active config validation created training-output")

    if (!existingLaunch) {
      writeJsonExclusive(paths.launchIntent, {
        schemaVersion: "ai-painter-stage4-joint-condition-local-transport-trainer-launch-intent-v1",
        capabilityVersion: CAPABILITY_VERSION, packageIdentity: context.packageIdentity,
        runId: plan.runId, trainingOutput: projectPath(context.projectRoot, paths.trainingOutput),
        activeConfig: bindFile(context.projectRoot, paths.activeConfig),
        activationValidated: true, trainingRestartAllowed: false,
        trainerProcessStarted: false, recordedAtUtc: services.now(),
      })
    }

    const result = await services.runCommand(plan.commands.trainer, {
      projectRoot: context.projectRoot, outputRoot: paths.outputRoot,
      trainingOutput: paths.trainingOutput, runId: plan.runId,
      onHeartbeat: () => context.heartbeat(),
      onProgress: (progress) => context.reportProgress(normalizeTrainerProgress(progress)),
      onStarted: ({ pid }) => writeJsonAtomic(paths.launchIntent, {
        ...readJson(paths.launchIntent), trainerProcessStarted: true,
        trainerPid: pid ?? null, trainerStartedAtUtc: services.now(),
      }),
    })
    writeJsonAtomic(paths.launchIntent, {
      ...readJson(paths.launchIntent), trainerProcessStarted: result.started === true,
      trainerExitCode: result.exitCode, trainerExitedAtUtc: services.now(),
    })
    if (result.exitCode !== 0) {
      return failed(result.started ? "business" : "infrastructure", result.started ? "trainer_failed_after_start" : "trainer_spawn_failed", `Trainer exited with ${result.exitCode}.`)
    }
    const post = inspectCompletedTraining(context.projectRoot, plan, paths)
    if (!post.complete) return failed("evidence", "trainer_exit_zero_without_complete_manifest", post.detail)
    writeJsonExclusive(paths.trainingCompletion, {
      schemaVersion: "ai-painter-stage4-joint-condition-local-transport-training-completion-v1",
      capabilityVersion: CAPABILITY_VERSION, runId: plan.runId,
      trainerManifest: post.manifestBinding, trainingRestartAllowed: false,
      recordedAtUtc: services.now(),
    })
    context.reportProgress({ phasePercent: 100, epoch: 30, epochTarget: 30, message: "training_completed_validation_continues_automatically" })
    return { status: "passed", decision: "training_completed", recoveredWithoutRetraining: false, trainerManifest: post.manifestBinding }
  } catch (error) {
    return failed("program", "joint_transport_execute_exception", String(error?.stack ?? error))
  }
}

async function validatePhase(context, services) {
  try {
    const plan = loadPlan(context)
    const paths = resolveArtifactPaths(context, plan)
    if (fs.existsSync(paths.validationReport)) {
      const existing = readJson(paths.validationReport)
      assert.equal(existing.status, "passed")
      assert.equal(existing.runId, plan.runId)
      context.reportProgress({ phasePercent: 100, message: "training_evidence_validation_recovered" })
      return { status: "passed", decision: "training_evidence_valid", recovered: true, validationReport: bindFile(context.projectRoot, paths.validationReport) }
    }
    const completed = inspectCompletedTraining(context.projectRoot, plan, paths)
    if (!completed.complete) return failed("evidence", "completed_training_identity_invalid", completed.detail)
    const manifest = completed.manifest
    const previews = validatePreviewArtifacts(context.projectRoot, plan, manifest)
    const progress = readJson(paths.trainerProgress)
    assert.equal(progress.status, "completed", "Trainer progress is not completed")
    const telemetry = readJson(paths.resourceTelemetry)
    assert.ok(Array.isArray(telemetry.rows) && telemetry.rows.length > 0, "training resource telemetry is empty")
    assert.ok(Number.isFinite(telemetry.peakGpuMemoryBytes) && telemetry.peakGpuMemoryBytes > 0, "training peak GPU memory is invalid")
    assert.equal(telemetry.preflightMemoryIsTrainingPeak ?? false, false, "preflight memory cannot be the training peak")
    const evidence = {
      schemaVersion: "ai-painter-stage4-joint-condition-local-transport-smoke-validation-v1",
      status: "passed", capabilityVersion: CAPABILITY_VERSION, runId: plan.runId,
      trainerManifest: completed.manifestBinding,
      trainerProgress: bindFile(context.projectRoot, paths.trainerProgress),
      resourceTelemetry: bindFile(context.projectRoot, paths.resourceTelemetry),
      fixedPreviews: previews, recordedAtUtc: services.now(),
    }
    writeJsonExclusive(paths.validationReport, evidence)
    context.reportProgress({ phasePercent: 100, message: "training_evidence_validated" })
    return { status: "passed", decision: "training_evidence_valid", validationReport: bindFile(context.projectRoot, paths.validationReport) }
  } catch (error) {
    return failed("evidence", "joint_transport_training_evidence_invalid", String(error?.stack ?? error))
  }
}

async function reviewPhase(context, services) {
  try {
    const plan = loadPlan(context)
    const paths = resolveArtifactPaths(context, plan)
    const manifest = readJson(paths.trainerManifest)
    const previews = validatePreviewArtifacts(context.projectRoot, plan, manifest)
    const source = loadReviewSource(context.projectRoot, plan)
    fs.mkdirSync(paths.reviewAssets, { recursive: true })
    fs.mkdirSync(resolveInside(context.projectRoot, plan.reviewWorkRoot), { recursive: true })
    let timeline = fs.existsSync(paths.machineReviewTimeline)
      ? readJson(paths.machineReviewTimeline)
      : buildReviewTimeline(plan, [], false, services.now())
    validateExistingTimeline(plan, timeline)
    const completedEpochs = new Set(timeline.reviews.map((row) => row.epoch))
    for (const preview of previews) {
      if (completedEpochs.has(preview.epoch)) continue
      const normalizedPath = path.join(paths.reviewAssets, `epoch-${String(preview.epoch).padStart(3, "0")}.png`)
      const normalized = await services.normalizePreview({
        sourcePath: resolveInside(context.projectRoot, preview.path),
        finalAssetPath: normalizedPath,
        workRoot: resolveInside(context.projectRoot, plan.reviewWorkRoot),
        workId: sha256(Buffer.from(plan.runId)).slice(0, 16), epoch: preview.epoch,
      })
      const [aesthetic, alignment] = await Promise.all([
        services.auditAesthetic(normalized.shortOutputPath),
        services.auditAlignment({
          record: {
            recordId: `${plan.runId}-epoch-${preview.epoch}`,
            conditionBinding: {
              conditionPackPath: source.sample.conditionPackPath,
              worldId: source.conditionPack.worldId, tick: source.conditionPack.tick,
            },
            classification: source.sample.classification,
          },
          imagePath: normalized.shortOutputPath,
          referenceImagePath: resolveInside(context.projectRoot, source.sample.imagePath),
        }),
      ])
      const issueCodes = [...new Set([
        ...(aesthetic.issues ?? []).map((item) => item.code),
        ...(alignment.issues ?? []).map((item) => item.code),
      ])].sort()
      timeline.reviews.push({
        epoch: preview.epoch, previewPath: preview.path, previewSha256: preview.sha256,
        reproductionPath: preview.reproductionPath, reproductionSha256: preview.reproductionSha256,
        byteExactReproduced: true,
        normalizedPath: projectPath(context.projectRoot, normalizedPath),
        normalizedSha256: sha256File(normalizedPath),
        passed: aesthetic.passed === true && alignment.passed === true,
        issueCodes, professionalAesthetic: aesthetic, conditionAlignment: alignment,
      })
      timeline = buildReviewTimeline(plan, timeline.reviews, false, services.now())
      writeJsonAtomic(paths.machineReviewTimeline, timeline)
      context.reportProgress({
        phasePercent: (timeline.reviews.length / FIXED_PREVIEW_EPOCHS.length) * 100,
        message: `machine_review_epoch_${preview.epoch}_completed`,
        metrics: { completedReviewCount: timeline.reviews.length, targetReviewCount: FIXED_PREVIEW_EPOCHS.length },
      })
    }
    timeline = buildReviewTimeline(plan, timeline.reviews, true, services.now())
    writeJsonAtomic(paths.machineReviewTimeline, timeline)
    return {
      status: "passed", decision: "machine_review_completed",
      reviewOutcome: timeline.status, passCount: timeline.previewPassCount,
      failCount: timeline.previewFailCount,
      machineReviewTimeline: bindFile(context.projectRoot, paths.machineReviewTimeline),
    }
  } catch (error) {
    return failed("evidence", "joint_transport_machine_review_incomplete", String(error?.stack ?? error))
  }
}

async function adjudicatePhase(context, services) {
  try {
    const plan = loadPlan(context)
    const paths = resolveArtifactPaths(context, plan)
    if (fs.existsSync(paths.lateStabilityQualification)) {
      const existing = readJson(paths.lateStabilityQualification)
      assert.equal(existing.runId, plan.runId)
      assert.equal(typeof existing.qualified, "boolean")
      context.reportProgress({ phasePercent: 100, message: existing.status })
      return { status: "passed", decision: existing.status, qualified: existing.qualified, recovered: true, lateStabilityQualification: bindFile(context.projectRoot, paths.lateStabilityQualification) }
    }
    const timeline = readJson(paths.machineReviewTimeline)
    assert.equal(timeline.completedReviewCount, FIXED_PREVIEW_EPOCHS.length)
    const decision = services.adjudicate(timeline.reviews, {
      requiredEpochs: FIXED_PREVIEW_EPOCHS, lateEpochs: FIXED_LATE_EPOCHS,
    })
    const result = {
      schemaVersion: "ai-painter-stage4-joint-condition-local-transport-smoke-late-stability-v1",
      status: decision.qualified ? "qualified" : "real_visual_failure",
      capabilityVersion: CAPABILITY_VERSION, runId: plan.runId,
      qualified: decision.qualified === true, decision,
      thresholdsChanged: false, trainingRetryAllowed: false,
      recordedAtUtc: services.now(),
    }
    writeJsonExclusive(paths.lateStabilityQualification, result)
    context.reportProgress({ phasePercent: 100, message: result.status })
    return { status: "passed", decision: result.status, qualified: result.qualified, lateStabilityQualification: bindFile(context.projectRoot, paths.lateStabilityQualification) }
  } catch (error) {
    return failed("evidence", "joint_transport_adjudication_evidence_invalid", String(error?.stack ?? error))
  }
}

async function finalizePhase(context, services) {
  try {
    const plan = loadPlan(context)
    const paths = resolveArtifactPaths(context, plan)
    if (fs.existsSync(paths.finalization)) {
      const existing = readJson(paths.finalization)
      assert.equal(existing.runId, plan.runId)
      assert.ok(["completed", "failed_closed"].includes(existing.executionState))
      context.reportProgress({ phasePercent: 100, message: existing.status })
      if (existing.executionState === "failed_closed") {
        return failed("visual", "joint_transport_smoke_real_visual_failure", "Recovered immutable visual-failure finalization.", { recovered: true, finalization: bindFile(context.projectRoot, paths.finalization) })
      }
      return { status: "passed", decision: "controlled_smoke_qualified", recovered: true, finalization: bindFile(context.projectRoot, paths.finalization) }
    }
    const trainingManifest = readJson(paths.trainerManifest)
    const review = readJson(paths.machineReviewTimeline)
    const qualification = readJson(paths.lateStabilityQualification)
    const qualified = qualification.qualified === true
    const rootManifest = {
      schemaVersion: "ai-painter-stage4-joint-condition-local-transport-controlled-smoke-manifest-v1",
      status: qualified ? "qualified" : "real_visual_failure",
      capabilityVersion: CAPABILITY_VERSION, architectureId: CAPABILITY_VERSION,
      packageIdentity: context.packageIdentity, runId: plan.runId,
      trainingManifest: bindFile(context.projectRoot, paths.trainerManifest),
      machineReviewTimeline: bindFile(context.projectRoot, paths.machineReviewTimeline),
      lateStabilityQualification: bindFile(context.projectRoot, paths.lateStabilityQualification),
      checkpoint: { path: trainingManifest.checkpointPath, sha256: trainingManifest.checkpointSha256, promotable: false },
      stage0Started: false, trainingRetryStarted: false,
      recordedAtUtc: services.now(),
    }
    if (fs.existsSync(paths.manifest)) {
      const existingManifest = readJson(paths.manifest)
      assert.equal(existingManifest.runId, plan.runId)
      assert.equal(existingManifest.status, rootManifest.status)
    } else writeJsonExclusive(paths.manifest, rootManifest)
    fs.mkdirSync(path.dirname(paths.finalization), { recursive: true })
    const finalization = {
      schemaVersion: "ai-painter-stage4-joint-condition-local-transport-controlled-smoke-finalization-v1",
      executionState: qualified ? "completed" : "failed_closed",
      status: qualified ? "controlled_smoke_qualified" : "controlled_smoke_real_visual_failure",
      capabilityVersion: CAPABILITY_VERSION, runId: plan.runId,
      manifest: bindFile(context.projectRoot, paths.manifest),
      reviewSummary: { passCount: review.previewPassCount, failCount: review.previewFailCount },
      ownerAuthorizationRequired: false, ownerResponseRequired: false,
      stage0Started: false, automaticRetryStarted: false,
      recordedAtUtc: services.now(),
    }
    writeJsonExclusive(paths.finalization, finalization)
    context.reportProgress({ phasePercent: 100, message: finalization.status })
    if (!qualified) return failed("visual", "joint_transport_smoke_real_visual_failure", "The immutable five-node machine review did not qualify the controlled Smoke.", { finalization: bindFile(context.projectRoot, paths.finalization) })
    return { status: "passed", decision: "controlled_smoke_qualified", manifest: bindFile(context.projectRoot, paths.manifest), finalization: bindFile(context.projectRoot, paths.finalization) }
  } catch (error) {
    return failed("program", "joint_transport_finalization_failed", String(error?.stack ?? error))
  }
}

function loadPlan(context) {
  const candidates = []
  for (const binding of context.inputEvidence ?? []) {
    const absolute = resolveInside(context.projectRoot, binding.path)
    assert.equal(sha256File(absolute), binding.sha256, `bound input changed: ${binding.path}`)
    if (!binding.path.endsWith(".json")) continue
    let value
    try { value = readJson(absolute) } catch { continue }
    if (value?.schemaVersion === PLAN_SCHEMA_VERSION) candidates.push(value)
  }
  assert.equal(candidates.length, 1, "exactly one joint transport execution plan must be bound")
  const plan = validateJointConditionLocalTransportSmokeExecutionPlan(candidates[0], { projectRoot: context.projectRoot, requireFiles: true })
  assert.equal(plan.packageIdentity, context.packageIdentity)
  assert.equal(plan.capabilityVersion, context.capabilityVersion)
  assert.equal(plan.outputRoot, context.outputRoot)
  for (const binding of Object.values(plan.evidenceBindings)) {
    assert.ok(context.inputEvidence.some((item) => item.path === binding.path && item.sha256 === binding.sha256), `plan evidence is not package-bound: ${binding.path}`)
  }
  return plan
}

function inspectCompletedTraining(projectRoot, plan, paths) {
  if (!fs.existsSync(paths.trainerManifest)) return { complete: false, detail: "Trainer manifest is absent." }
  try {
    const manifest = readJson(paths.trainerManifest)
    assert.equal(manifest.status, plan.expectedTrainerManifestStatus)
    assert.equal(manifest.architectureVersion, TRAINER_ARCHITECTURE_VERSION)
    const smokeIdentity = manifest.stage4JointConditionLocalTransportSmoke
    assert.ok(smokeIdentity && typeof smokeIdentity === "object", "joint transport Trainer manifest identity is missing")
    assert.equal(smokeIdentity.architectureId, CAPABILITY_VERSION)
    assert.equal(smokeIdentity.runId, plan.runId)
    assert.equal(smokeIdentity.legacySpatialAffineIdentityReused, false)
    assert.equal(smokeIdentity.compiledContract?.path, plan.evidenceBindings.compiledSmokeContract.path)
    assert.equal(smokeIdentity.compiledContract?.sha256, plan.evidenceBindings.compiledSmokeContract.sha256)
    const compiledContract = readBoundJson(projectRoot, plan.evidenceBindings.compiledSmokeContract)
    assert.equal(compiledContract.capabilityVersion, CAPABILITY_VERSION)
    assert.equal(compiledContract.architectureId, CAPABILITY_VERSION)
    assert.equal(compiledContract.executionIdentity?.runId, plan.runId)
    assert.equal(compiledContract.executionIdentity?.resolutionStage, plan.fixedTrainingIdentity.resolutionStage)
    assert.deepEqual(compiledContract.executionIdentity?.resolution, plan.fixedTrainingIdentity.resolution)
    assert.equal(manifest.trainingStage, "stage4_joint_condition_local_transport_controlled_smoke")
    assert.equal(manifest.seed, plan.fixedTrainingIdentity.seed)
    assert.deepEqual(manifest.resolutionStage, plan.fixedTrainingIdentity.resolution)
    assert.equal(manifest.singleSampleOverfitSmoke?.sampleId, FIXED_SAMPLE_ID)
    assert.equal(manifest.singleSampleOverfitSmoke?.selectedSplit, "validation")
    assert.equal(manifest.parentDenoiserCheckpointPath, null)
    assert.equal(manifest.parentDenoiserCheckpointSha256, null)
    assert.equal(manifest.machineReviewPending, true)
    assert.equal(manifest.checkpointPromotionEligible, false)
    assert.equal(manifest.stage0InitializationEligible, false)
    assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true)
    assert.match(manifest.modelStateHashEvidence?.initialDenoiserStateSha256 ?? "", /^[a-f0-9]{64}$/u)
    assert.match(manifest.modelStateHashEvidence?.finalDenoiserStateSha256 ?? "", /^[a-f0-9]{64}$/u)
    assert.notEqual(manifest.modelStateHashEvidence.initialDenoiserStateSha256, manifest.modelStateHashEvidence.finalDenoiserStateSha256)
    assert.ok(!JSON.stringify(manifest).includes("stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"), "legacy spatial-affine candidate identity is forbidden")
    validateBoundArtifact(projectRoot, { path: manifest.checkpointPath, sha256: manifest.checkpointSha256 }, "checkpoint identity")
    validateBoundArtifact(projectRoot, { path: manifest.resourceTelemetryPath, sha256: manifest.resourceTelemetrySha256 }, "resource telemetry identity")
    validatePreviewArtifacts(projectRoot, plan, manifest)
    return { complete: true, manifest, manifestBinding: bindFile(projectRoot, paths.trainerManifest) }
  } catch (error) {
    return { complete: false, detail: String(error?.stack ?? error) }
  }
}

function validatePreviewArtifacts(projectRoot, plan, manifest) {
  assert.deepEqual(manifest.previewEpochs, FIXED_PREVIEW_EPOCHS)
  assert.ok(Array.isArray(manifest.fixedPreviews))
  assert.equal(manifest.fixedPreviews.length, FIXED_PREVIEW_EPOCHS.length)
  assert.deepEqual(manifest.fixedPreviews.map((row) => row.epoch), FIXED_PREVIEW_EPOCHS)
  return manifest.fixedPreviews.map((row) => {
    validateBoundArtifact(projectRoot, { path: row.path, sha256: row.sha256 }, `Epoch ${row.epoch} preview`)
    validateBoundArtifact(projectRoot, { path: row.reproductionPath, sha256: row.reproductionSha256 }, `Epoch ${row.epoch} reproduction`)
    assert.equal(row.sha256, row.reproductionSha256, `Epoch ${row.epoch} byte reproduction mismatch`)
    assert.equal(row.byteExactReproduced ?? true, true)
    assert.ok(resolveInside(projectRoot, row.path).startsWith(resolveInside(projectRoot, plan.outputRoot) + path.sep))
    assert.ok(resolveInside(projectRoot, row.reproductionPath).startsWith(resolveInside(projectRoot, plan.outputRoot) + path.sep))
    return structuredClone(row)
  })
}

function loadReviewSource(projectRoot, plan) {
  const sourceIndex = readBoundJson(projectRoot, plan.evidenceBindings.sourceIndex)
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.ok(Array.isArray(sourceIndex.samples), "formal source-index samples are missing")
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length, "formal source-index count changed")
  const approvedSamples = sourceIndex.samples.filter(
    (row) => row.v7CapacityContributionRegistered === true,
  )
  assert.equal(approvedSamples.length, 64, "formal approved 64-record selection changed")
  assert.deepEqual(
    Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [
      split,
      approvedSamples.filter((row) => row.split === split).length,
    ])),
    { train: 48, validation: 8, challenge: 4, regression: 4 },
    "formal approved split identity changed",
  )
  assert.equal(
    new Set(approvedSamples.map((row) => row.recordId ?? row.sampleId)).size,
    64,
    "formal approved sample identity is duplicated",
  )
  const matches = approvedSamples.filter((row) => (
    row.sampleId === FIXED_SAMPLE_ID && row.recordId === FIXED_SAMPLE_ID
  ))
  assert.equal(matches.length, 1)
  const sample = matches[0]
  assert.equal(sample.split, "validation")
  assert.equal(sample.conditionBound, true)
  assert.equal(sample.formalConditionalTrainingEligible, true)
  const compiledContract = readBoundJson(
    projectRoot,
    plan.evidenceBindings.compiledSmokeContract,
  )
  const sourceEvidence = Array.isArray(compiledContract.sourceEvidence)
    ? compiledContract.sourceEvidence
    : []
  const fixedCondition = sourceEvidence.find(
    (binding) => binding.role === "fixed-validation-condition-pack",
  )
  const fixedReference = sourceEvidence.find(
    (binding) => binding.role === "fixed-validation-reference-rgb",
  )
  assert.ok(fixedCondition, "fixed validation condition-pack binding is missing")
  assert.ok(fixedReference, "fixed validation reference RGB binding is missing")
  validateBoundArtifact(projectRoot, fixedCondition, "fixed validation condition-pack")
  validateBoundArtifact(projectRoot, fixedReference, "fixed validation reference RGB")
  assert.equal(sample.conditionPackPath, fixedCondition.path)
  assert.equal(sample.imagePath, fixedReference.path)
  assert.equal(sample.imageSha256, fixedReference.sha256)
  const conditionPack = readJson(resolveInside(projectRoot, fixedCondition.path))
  assert.equal(conditionPack.channels?.length, 23)
  return { sourceIndex, sample, conditionPack }
}

function validateExistingTimeline(plan, timeline) {
  assert.equal(timeline.schemaVersion, "ai-painter-stage4-joint-condition-local-transport-machine-review-timeline-v1")
  assert.equal(timeline.runId, plan.runId)
  assert.ok(Array.isArray(timeline.reviews))
  assert.deepEqual(timeline.reviews.map((row) => row.epoch), FIXED_PREVIEW_EPOCHS.slice(0, timeline.reviews.length))
}

function buildReviewTimeline(plan, reviews, completed, recordedAtUtc) {
  return {
    schemaVersion: "ai-painter-stage4-joint-condition-local-transport-machine-review-timeline-v1",
    status: completed ? (reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed") : "running",
    capabilityVersion: CAPABILITY_VERSION, runId: plan.runId,
    sampleId: FIXED_SAMPLE_ID, sampleSplit: "validation",
    completedReviewCount: reviews.length, targetReviewCount: FIXED_PREVIEW_EPOCHS.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
    reviewThresholdsChanged: false, machineReviewResultsUsedAsTrainingTarget: false,
    failedPreviewPixelsUsedAsTrainingTarget: false, reviews,
    updatedAtUtc: recordedAtUtc, ...(completed ? { completedAtUtc: recordedAtUtc } : {}),
  }
}

function resolveArtifactPaths(context, plan) {
  const outputRoot = resolveInside(context.projectRoot, plan.outputRoot)
  const result = { outputRoot }
  for (const [key, relative] of Object.entries(plan.artifacts)) {
    result[key] = resolveInside(outputRoot, relative)
  }
  result.reviewAssets = resolveInside(outputRoot, "machine-review-assets")
  result.validationReport = resolveInside(outputRoot, "validation-report.json")
  result.launchIntent = resolveInside(outputRoot, "trainer-launch-intent.json")
  result.trainingCompletion = resolveInside(outputRoot, "training-completion.json")
  return result
}

function validateCommandList(commands, label, options) {
  assert.ok(Array.isArray(commands) && commands.length > 0, `${label} commands are required`)
  assert.equal(new Set(commands.map((item) => item.id)).size, commands.length, `${label} command ids must be unique`)
  commands.forEach((command, index) => validateCommand(command, `${label}[${index}]`, options))
}

function validateCommand(command, label, { projectRoot, requireFiles }) {
  assert.ok(command && typeof command === "object", `${label} command is required`)
  assert.match(command.id ?? "", /^[a-z][a-z0-9-]{2,63}$/u)
  assert.ok(["node", "python"].includes(command.runtime), `${label} runtime is invalid`)
  validateFileBinding(command.program, `${label}.program`, { projectRoot, requireFiles })
  assert.ok(Array.isArray(command.arguments), `${label} arguments are required`)
  for (const argument of command.arguments) {
    assert.equal(typeof argument, "string")
    assert.ok(argument.length > 0 && argument.length <= 1024)
    assert.ok(!argument.includes(".."), `${label} argument contains parent traversal`)
  }
  assert.equal(command.expectedExitCode, 0)
}

function validateFileBinding(binding, label, { projectRoot, requireFiles }) {
  assert.ok(binding && typeof binding === "object", `${label} is required`)
  validateProjectRelativePath(binding.path, `${label}.path`)
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u)
  if (requireFiles) assert.equal(sha256File(resolveInside(projectRoot, binding.path)), binding.sha256, `${label} SHA-256 mismatch`)
}

function validateBoundArtifact(projectRoot, binding, label) {
  validateProjectRelativePath(binding.path, `${label}.path`)
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u)
  assert.equal(sha256File(resolveInside(projectRoot, binding.path)), binding.sha256, `${label} SHA-256 mismatch`)
}

async function runCommand(command, { projectRoot, outputRoot, trainingOutput, runId, onHeartbeat, onProgress, onStarted }) {
  const executable = resolveRuntime(projectRoot, command.runtime)
  const program = resolveInside(projectRoot, command.program.path)
  assert.equal(sha256File(program), command.program.sha256, `program changed before execution: ${command.id}`)
  const argumentsList = command.arguments.map((argument) => interpolateArgument(argument, {
    PROJECT_ROOT: projectRoot, OUTPUT_ROOT: outputRoot, TRAINING_OUTPUT: trainingOutput, RUN_ID: runId,
  }))
  const child = spawn(executable, [program, ...argumentsList], {
    cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PYTHONPATH: [path.join(projectRoot, "ml", "ai-painter", "src"), path.join(projectRoot, "ml", "ai-painter", "scripts"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
  })
  if (child.pid !== undefined) onStarted?.({ pid: child.pid })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk) => { stdout = boundedAppend(stdout, chunk) })
  child.stderr.on("data", (chunk) => { stderr = boundedAppend(stderr, chunk) })
  const interval = setInterval(() => {
    onHeartbeat?.()
    const progressPath = path.join(trainingOutput, "progress.json")
    if (fs.existsSync(progressPath)) {
      try { onProgress?.(readJson(progressPath).live ?? readJson(progressPath)) } catch { /* next heartbeat retries */ }
    }
  }, 10_000)
  const exitCode = await new Promise((resolve) => {
    child.once("error", () => resolve(-1))
    child.once("exit", (code) => resolve(code ?? -1))
  })
  clearInterval(interval)
  return { id: command.id, started: child.pid !== undefined, pid: child.pid ?? null, exitCode, stdout, stderr }
}

function resolveRuntime(projectRoot, runtime) {
  if (runtime === "node") return process.execPath
  const candidates = process.platform === "win32"
    ? ["ml/ai-painter/.venv/Scripts/python.exe"]
    : ["ml/ai-painter/.venv/bin/python", "ml/ai-painter/.venv/bin/python3"]
  const match = candidates.map((item) => resolveInside(projectRoot, item)).find((item) => fs.existsSync(item))
  assert.ok(match, "project Python runtime is missing")
  return match
}

function normalizeTrainerProgress(value) {
  return {
    phasePercent: finiteOr(value.phasePercent, finiteOr(value.percent, 0)),
    epoch: finiteOr(value.epoch, 0), epochTarget: finiteOr(value.epochTarget, 30),
    optimizerStep: finiteOr(value.optimizerStep, 0),
    optimizerStepTarget: finiteOr(value.optimizerStepTarget, value.targetOptimizerSteps),
    etaSeconds: finiteOr(value.etaSeconds, 0), message: String(value.phase ?? value.status ?? "training"),
  }
}

function buildPreflightReport(projectRoot, plan, commandEvidence, passed, recordedAtUtc) {
  const passedCommandIds = new Set(commandEvidence.filter((row) => row.exitCode === 0).map((row) => row.id))
  const compiledContract = compiledContractBinding(projectRoot, plan)
  return {
    schemaVersion: "stage4-joint-condition-local-transport-controlled-smoke-preflight-v1",
    status: passed ? "all_preflight_checks_passed" : "preflight_checks_failed",
    capabilityVersion: CAPABILITY_VERSION, runId: plan.runId,
    outputNamespace: plan.outputRoot, compiledContract,
    checks: {
      cpuContract: passedCommandIds.has("cpu-contract"),
      activeConfigAudit: passedCommandIds.has("active-config-audit"),
      trainerReadonlyPreflight: passedCommandIds.has("trainer-readonly-preflight"),
      cudaResource: passedCommandIds.has("cuda-resource"),
      diskCapacity: passedCommandIds.has("disk-capacity"),
      trainingOutputAbsent: true,
    },
    commandEvidence, trainingOutputCreated: false,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    gpuStarted: false, trainingStarted: false, recordedAtUtc,
  }
}

function compiledContractBinding(projectRoot, plan) {
  const contract = readBoundJson(projectRoot, plan.evidenceBindings.compiledSmokeContract)
  return {
    path: plan.evidenceBindings.compiledSmokeContract.path,
    sha256: plan.evidenceBindings.compiledSmokeContract.sha256,
    schemaVersion: contract.schemaVersion,
    status: contract.status,
    compilationRunId: contract.compilationRunId,
  }
}

function validatePreflightReport(projectRoot, plan, report, { throwOnFailure = true } = {}) {
  try {
    assert.equal(report.schemaVersion, "stage4-joint-condition-local-transport-controlled-smoke-preflight-v1")
    assert.equal(report.status, "all_preflight_checks_passed")
    assert.equal(report.runId, plan.runId)
    assert.equal(report.outputNamespace, plan.outputRoot)
    assert.deepEqual(report.compiledContract, compiledContractBinding(projectRoot, plan))
    for (const key of [
      "cpuContract", "activeConfigAudit", "trainerReadonlyPreflight",
      "cudaResource", "diskCapacity", "trainingOutputAbsent",
    ]) assert.equal(report.checks?.[key], true, `preflight check did not pass: ${key}`)
    assert.equal(report.ownerAuthorizationRequired, false)
    assert.equal(report.ownerResponseRequired, false)
    assert.equal(report.gpuStarted, false)
    assert.equal(report.trainingStarted, false)
    return true
  } catch (error) {
    if (throwOnFailure) throw error
    return false
  }
}

function commandResultEvidence(result) {
  return {
    id: result.id, started: result.started === true, exitCode: result.exitCode,
    stdoutSha256: sha256(Buffer.from(result.stdout ?? "")), stderrSha256: sha256(Buffer.from(result.stderr ?? "")),
    stdoutTail: boundedEvidenceText(result.stdout),
    stderrTail: boundedEvidenceText(result.stderr),
  }
}

function boundedEvidenceText(value) {
  const text = String(value ?? "")
  return text.length <= 16_384 ? text : text.slice(-16_384)
}

function failed(failureKind, failureCode, detail, extra = {}) {
  return { status: "failed", failureKind, failureCode, detail, ...extra }
}

function readBoundJson(projectRoot, binding) {
  validateBoundArtifact(projectRoot, binding, binding.path)
  return readJson(resolveInside(projectRoot, binding.path))
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function bindFile(projectRoot, filePath) { return { path: projectPath(projectRoot, filePath), sha256: sha256File(filePath) } }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)) }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function projectPath(projectRoot, filePath) { return path.relative(path.resolve(projectRoot), path.resolve(filePath)).replaceAll("\\", "/") }

function resolveInside(root, relativePath) {
  assert.equal(typeof relativePath, "string")
  assert.ok(!path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/u.test(relativePath), `absolute path is forbidden: ${relativePath}`)
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, relativePath)
  assert.ok(resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`), `path escapes root: ${relativePath}`)
  return resolved
}

function validateProjectRelativePath(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`)
  assert.ok(value.length > 0 && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/u.test(value), `${label} must be project-relative`)
  assert.ok(!value.includes("\\") && !value.split("/").includes(".."), `${label} must be normalized`)
}

function validateRuntimePath(value, label) {
  validateProjectRelativePath(value, label)
  assert.ok(value.startsWith(".runtime/ai-painter/"), `${label} must be inside AI Painter runtime`)
}

function interpolateArgument(value, replacements) {
  let result = value
  for (const [name, replacement] of Object.entries(replacements)) result = result.replaceAll(`\${${name}}`, replacement)
  assert.ok(!result.includes("${"), `unknown command argument placeholder: ${value}`)
  return result
}

function boundedAppend(current, chunk) {
  const next = current + chunk.toString("utf8")
  return next.length <= 1_048_576 ? next : next.slice(-1_048_576)
}

function finiteOr(value, fallback) { return Number.isFinite(value) && value >= 0 ? value : (Number.isFinite(fallback) && fallback >= 0 ? fallback : 0) }

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "w" })
  fs.renameSync(temporary, filePath)
}

function writeJsonExclusive(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}
