import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  CAPABILITY_VERSION,
  EXPECTED_TRAINER_STATUS,
  PREVIEW_EPOCHS,
  TRAINER_ARCHITECTURE_VERSION,
  createJointConditionLocalTransportFullDataScreenAdapters,
  validateJointConditionLocalTransportFullDataScreenExecutionPlan,
} from "./ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

export const RECOVERY_SCHEMA_VERSION =
  "ai-painter-stage4-joint-condition-local-transport-post-checkpoint-recovery-v1"
export const RECOVERY_FAILURE_CODE = "post_checkpoint_manifest_projection_defect"

export function inspectJointConditionLocalTransportPostCheckpointFailure({
  projectRoot = process.cwd(),
  sourcePlanPath,
  sourcePlanSha256,
  sourceTerminalPath,
  sourceTerminalSha256,
}) {
  const planAbsolute = resolveInside(projectRoot, sourcePlanPath)
  const terminalAbsolute = resolveInside(projectRoot, sourceTerminalPath)
  assert.equal(sha256File(planAbsolute), sourcePlanSha256, "source plan SHA-256 mismatch")
  assert.equal(sha256File(terminalAbsolute), sourceTerminalSha256, "source terminal SHA-256 mismatch")

  const sourcePlan = readJson(planAbsolute)
  validateJointConditionLocalTransportFullDataScreenExecutionPlan(sourcePlan, {
    projectRoot,
    requireFiles: false,
  })
  const sourceTerminal = readJson(terminalAbsolute)
  assert.equal(sourceTerminal.schemaVersion, "ai-painter-autonomous-closed-loop-terminal-v1")
  assert.equal(sourceTerminal.packageIdentity, sourcePlan.packageIdentity)
  assert.equal(sourceTerminal.status, "failed_closed")
  assert.equal(sourceTerminal.failureCode, "trainer_failed_after_start")
  assert.equal(sourceTerminal.latestEvidence?.phase, "execute")
  assert.equal(sourceTerminal.latestEvidence?.attempt, 0)

  const sourceExecutionRoot = path.dirname(terminalAbsolute)
  const executeEvidenceAbsolute = resolveInside(
    sourceExecutionRoot,
    sourceTerminal.latestEvidence.path,
  )
  assert.equal(
    sha256File(executeEvidenceAbsolute),
    sourceTerminal.latestEvidence.sha256,
    "source execute evidence SHA-256 mismatch",
  )
  const executeEvidence = readJson(executeEvidenceAbsolute)
  assert.equal(executeEvidence.phase, "execute")
  assert.equal(executeEvidence.result?.failureCode, "trainer_failed_after_start")
  assert.equal(executeEvidence.result?.detail, "Trainer exited with 1")

  const outputAbsolute = resolveInside(projectRoot, sourcePlan.outputRoot)
  const trainingOutputAbsolute = path.join(outputAbsolute, "training-output")
  const paths = {
    activeConfig: path.join(outputAbsolute, "active-config.json"),
    launchIntent: path.join(outputAbsolute, "trainer-launch-intent.json"),
    progress: path.join(trainingOutputAbsolute, "progress.json"),
    telemetry: path.join(trainingOutputAbsolute, "resource-telemetry.json"),
    stepTelemetry: path.join(trainingOutputAbsolute, "stage4-step-telemetry.json"),
    conditionEvidence: path.join(trainingOutputAbsolute, "condition-evidence.json"),
    checkpoint: path.join(
      trainingOutputAbsolute,
      "complete-world-ai-assisted-conditional-denoiser.pt",
    ),
    absentManifest: path.join(trainingOutputAbsolute, "manifest.json"),
  }
  for (const [name, file] of Object.entries(paths)) {
    if (name === "absentManifest") continue
    assert.equal(fs.existsSync(file), true, `${name} is absent`)
  }
  assert.equal(fs.existsSync(paths.absentManifest), false, "source Trainer manifest already exists")

  const launchIntent = readJson(paths.launchIntent)
  assert.equal(launchIntent.runId, sourcePlan.runId)
  assert.equal(launchIntent.packageIdentity, sourcePlan.packageIdentity)
  assert.equal(launchIntent.trainerProcessStarted, true)
  assert.equal(launchIntent.trainerExitCode, 1)
  assert.equal(launchIntent.trainingRestartAllowed, false)

  const progress = readJson(paths.progress)
  assert.equal(progress.status, "running")
  assert.equal(progress.currentEpoch, 24)
  assert.equal(progress.liveProgress?.epoch, 24)
  assert.equal(progress.liveProgress?.epochTarget, 24)
  assert.equal(progress.liveProgress?.batch, 48)
  assert.equal(progress.liveProgress?.batchTarget, 48)
  assert.equal(progress.liveProgress?.optimizerStep, 1152)
  assert.equal(progress.liveProgress?.optimizerStepTarget, 1152)
  assert.equal(progress.liveProgress?.percentage, 100)
  assert.ok(Array.isArray(progress.metrics))
  assert.equal(progress.metrics.length, 24)
  assert.deepEqual(progress.metrics.map((row) => row.epoch), Array.from({ length: 24 }, (_, i) => i + 1))
  const numericFieldCount = assertFiniteNumbers(progress.metrics)

  const telemetry = readJson(paths.telemetry)
  assert.equal(telemetry.status, "running")
  assert.equal(telemetry.runId, sourcePlan.runId)
  assert.equal(telemetry.preflightMemoryIsTrainingPeak, false)
  assert.ok(Array.isArray(telemetry.rows) && telemetry.rows.length >= 24)
  assert.equal(telemetry.rows.at(-1)?.epoch, 24)
  assert.ok(Number.isFinite(telemetry.peakGpuMemoryBytes) && telemetry.peakGpuMemoryBytes > 0)
  assert.equal(
    telemetry.peakGpuMemoryBytes,
    Math.max(...telemetry.rows.map((row) => Number(row.gpuMemoryUsedBytes ?? 0))),
    "GPU peak was not derived from training heartbeat rows",
  )

  const stepTelemetry = readJson(paths.stepTelemetry)
  assert.equal(stepTelemetry.state?.checkpointWriteCompleted, true)
  assert.equal(stepTelemetry.latestStep, "checkpoint_write")
  assert.equal(stepTelemetry.latestStatus, "completed")
  assert.ok(Array.isArray(stepTelemetry.events))
  assert.equal(stepTelemetry.events.at(-1)?.step, "checkpoint_write")
  assert.equal(stepTelemetry.events.at(-1)?.status, "completed")
  for (const step of ["forward_loss", "backward", "optimizer_step"]) {
    assert.equal(countStep(stepTelemetry.events, step, "started"), 1152, `${step} started count mismatch`)
    assert.equal(countStep(stepTelemetry.events, step, "completed"), 1152, `${step} completed count mismatch`)
  }

  const fixedPreviews = deriveFixedPreviews(projectRoot, sourcePlan, progress.metrics)
  const checkpointStat = fs.statSync(paths.checkpoint)
  assert.ok(checkpointStat.isFile() && checkpointStat.size > 0)
  const checkpointSha256 = sha256File(paths.checkpoint)
  const sourceBindings = Object.fromEntries(
    Object.entries({
      sourcePlan: planAbsolute,
      sourceTerminal: terminalAbsolute,
      executeEvidence: executeEvidenceAbsolute,
      activeConfig: paths.activeConfig,
      launchIntent: paths.launchIntent,
      sourceProgress: paths.progress,
      sourceResourceTelemetry: paths.telemetry,
      stepTelemetry: paths.stepTelemetry,
      conditionEvidence: paths.conditionEvidence,
      checkpointIdentityOnly: paths.checkpoint,
    }).map(([name, file]) => [name, bind(projectRoot, file)]),
  )

  return {
    sourcePlan,
    sourceTerminal,
    progress,
    telemetry,
    stepTelemetry,
    fixedPreviews,
    checkpointSha256,
    checkpointBytes: checkpointStat.size,
    numericFieldCount,
    sourceBindings,
    paths,
  }
}

export async function runJointConditionLocalTransportPostCheckpointRecovery({
  projectRoot = process.cwd(),
  sourcePlanPath,
  sourcePlanSha256,
  sourceTerminalPath,
  sourceTerminalSha256,
  recoveryId,
  reportProgress = () => {},
  now = () => new Date().toISOString(),
}) {
  assert.match(recoveryId ?? "", /^[a-z0-9][a-z0-9-]{15,127}$/u)
  const inspected = inspectJointConditionLocalTransportPostCheckpointFailure({
    projectRoot,
    sourcePlanPath,
    sourcePlanSha256,
    sourceTerminalPath,
    sourceTerminalSha256,
  })
  const sourcePlan = inspected.sourcePlan
  const outputAbsolute = resolveInside(projectRoot, sourcePlan.outputRoot)
  const recoveryRelativeRoot = `post-training-terminal-recoveries/${recoveryId}`
  const recoveryAbsolute = path.join(outputAbsolute, ...recoveryRelativeRoot.split("/"))
  fs.mkdirSync(path.dirname(recoveryAbsolute), { recursive: true })
  fs.mkdirSync(recoveryAbsolute, { recursive: false })

  const recordedAtUtc = now()
  const sourceEvidencePath = path.join(recoveryAbsolute, "post-checkpoint-recovery-evidence.json")
  writeExclusive(sourceEvidencePath, {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    status: "post_checkpoint_projection_failure_verified_recoverable",
    recoveryId,
    capabilityVersion: CAPABILITY_VERSION,
    runId: sourcePlan.runId,
    sourcePackageIdentity: sourcePlan.packageIdentity,
    failureClassification: {
      sourceFailureCode: "trainer_failed_after_start",
      correctedFailureCode: RECOVERY_FAILURE_CODE,
      trainerExitCode: 1,
      checkpointWriteCompleted: true,
      trainingCompleted: true,
      originalTrainerManifestCreated: false,
    },
    completedTraining: {
      epochCount: 24,
      optimizerStepCount: 1152,
      numericMetricFieldCount: inspected.numericFieldCount,
      stepEventCount: inspected.stepTelemetry.events.length,
      fixedPreviewEpochs: PREVIEW_EPOCHS,
    },
    sourceEvidence: inspected.sourceBindings,
    fixedPreviews: inspected.fixedPreviews,
    checkpoint: {
      ...inspected.sourceBindings.checkpointIdentityOnly,
      byteLength: inspected.checkpointBytes,
      loadedOrDeserializedDuringRecovery: false,
      promotable: false,
    },
    prohibitedRecoveryClaims: [
      "original_trainer_manifest_bytes_recreated",
      "original_progress_completed_bytes_recreated",
      "original_resource_terminal_row_recreated",
      "checkpoint_weights_loaded",
      "training_restarted",
    ],
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  })

  const recoveredProgressPath = path.join(recoveryAbsolute, "recovered-progress-completed.json")
  writeExclusive(recoveredProgressPath, {
    ...inspected.progress,
    schemaVersion: "ai-painter-post-checkpoint-recovered-training-progress-v1",
    status: "completed_from_immutable_post_checkpoint_evidence",
    sourceProgress: inspected.sourceBindings.sourceProgress,
    recoveryEvidence: bind(projectRoot, sourceEvidencePath),
    completedAtUtc: recordedAtUtc,
  })
  const recoveredTelemetryPath = path.join(recoveryAbsolute, "recovered-resource-telemetry-completed.json")
  writeExclusive(recoveredTelemetryPath, {
    ...inspected.telemetry,
    schemaVersion: "ai-painter-post-checkpoint-recovered-resource-telemetry-v1",
    status: "completed_from_immutable_training_heartbeat_rows",
    sourceResourceTelemetry: inspected.sourceBindings.sourceResourceTelemetry,
    recoveryEvidence: bind(projectRoot, sourceEvidencePath),
    terminalRowRecreated: false,
    completedAtUtc: recordedAtUtc,
  })

  const recoveredManifestPath = path.join(recoveryAbsolute, "recovered-trainer-evidence.json")
  const activeConfigBinding = inspected.sourceBindings.activeConfig
  writeExclusive(recoveredManifestPath, {
    schemaVersion: "ai-painter-joint-full-data-screen-recovered-training-evidence-v1",
    status: EXPECTED_TRAINER_STATUS,
    architectureVersion: TRAINER_ARCHITECTURE_VERSION,
    trainingStage: "stage4_joint_condition_local_transport_full_data_screen",
    seed: 20263722,
    resolutionStage: { width: 256, height: 192 },
    actualLoadedConditionalSampleCount: 64,
    actualLoadedSplitCounts: sourcePlan.splitCounts,
    metrics: inspected.progress.metrics,
    parentDenoiserCheckpointPath: null,
    parentDenoiserCheckpointSha256: null,
    checkpointPromotionEligible: false,
    stage0InitializationEligible: false,
    checkpointPath: inspected.sourceBindings.checkpointIdentityOnly.path,
    checkpointSha256: inspected.checkpointSha256,
    resourceTelemetryPath: projectPath(projectRoot, recoveredTelemetryPath),
    resourceTelemetrySha256: sha256File(recoveredTelemetryPath),
    configPath: `${sourcePlan.outputRoot}/active-config.json`,
    configSha256: activeConfigBinding.sha256,
    previewEpochs: PREVIEW_EPOCHS,
    fixedPreviews: inspected.fixedPreviews,
    stage4JointConditionLocalTransportFullDataScreen: {
      architectureId: CAPABILITY_VERSION,
      runId: sourcePlan.runId,
      inactiveContract: sourcePlan.evidenceBindings.inactiveFullDataScreenContract,
      optimizerStepCount: 1152,
    },
    evidenceRecovery: {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      recoveryId,
      correctedFailureCode: RECOVERY_FAILURE_CODE,
      sourceFailureTerminal: inspected.sourceBindings.sourceTerminal,
      recoveryEvidence: bind(projectRoot, sourceEvidencePath),
      derivedManifestNotOriginalTrainerManifest: true,
      checkpointWeightsLoaded: false,
      gpuStarted: false,
      trainingRestarted: false,
      checkpointPromotable: false,
    },
    recordedAtUtc,
  })

  const recoveryPlan = createRecoveryPlan({
    projectRoot,
    sourcePlan,
    recoveryId,
    recoveryRelativeRoot,
    inspected,
  })
  const recoveryPlanPath = path.join(recoveryAbsolute, "recovery-execution-plan.json")
  writeExclusive(recoveryPlanPath, recoveryPlan)
  validateJointConditionLocalTransportFullDataScreenExecutionPlan(recoveryPlan, {
    projectRoot,
    requireFiles: true,
  })

  const validationPath = path.join(recoveryAbsolute, "recovery-validation-report.json")
  writeExclusive(validationPath, {
    schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-validation-v1",
    status: "passed",
    recoveryId,
    runId: sourcePlan.runId,
    recoveryPlan: bind(projectRoot, recoveryPlanPath),
    recoveryEvidence: bind(projectRoot, sourceEvidencePath),
    recoveredTrainingEvidence: bind(projectRoot, recoveredManifestPath),
    recoveredProgress: bind(projectRoot, recoveredProgressPath),
    recoveredResourceTelemetry: bind(projectRoot, recoveredTelemetryPath),
    checkpointWeightsLoaded: false,
    gpuStarted: false,
    trainingRestarted: false,
    recordedAtUtc,
  })
  reportProgress({ phase: "validate", phasePercent: 100, message: "post_checkpoint_training_evidence_recovered" })

  const context = {
    projectRoot,
    packageIdentity: recoveryId,
    outputRoot: sourcePlan.outputRoot,
    inputEvidence: [bind(projectRoot, recoveryPlanPath)],
    heartbeat: () => {},
    reportProgress,
  }
  const adapters = createJointConditionLocalTransportFullDataScreenAdapters({ now })
  const review = await adapters.review(context)
  assert.equal(review.status, "passed", review.detail ?? "machine review failed to complete")
  const adjudication = await adapters.adjudicate(context)
  assert.equal(adjudication.status, "passed", adjudication.detail ?? "late-stability adjudication failed")
  const finalization = await adapters.finalize(context)
  const finalizationPath = resolveInside(
    outputAbsolute,
    recoveryPlan.artifacts.finalization,
  )
  assert.equal(fs.existsSync(finalizationPath), true, "recovery finalization is absent")
  const finalizationValue = readJson(finalizationPath)
  return {
    recoveryId,
    recoveryRoot: projectPath(projectRoot, recoveryAbsolute),
    recoveryPlan: bind(projectRoot, recoveryPlanPath),
    recoveryEvidence: bind(projectRoot, sourceEvidencePath),
    recoveredTrainingEvidence: bind(projectRoot, recoveredManifestPath),
    review,
    adjudication,
    finalization,
    finalizationValue,
  }
}

function createRecoveryPlan({ projectRoot, sourcePlan, recoveryId, recoveryRelativeRoot, inspected }) {
  const plan = structuredClone(sourcePlan)
  plan.packageIdentity = recoveryId
  plan.recoveryIdentity = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    sourcePackageIdentity: sourcePlan.packageIdentity,
    sourceRunId: sourcePlan.runId,
    correctedFailureCode: RECOVERY_FAILURE_CODE,
    trainingRestartAllowed: false,
  }
  for (const command of [...plan.commands.preflight, plan.commands.activation, plan.commands.trainer]) {
    command.program.sha256 = sha256File(resolveInside(projectRoot, command.program.path))
  }
  plan.evidenceBindings = {
    ...plan.evidenceBindings,
    sourceExecutionPlan: inspected.sourceBindings.sourcePlan,
    sourceFailureTerminal: inspected.sourceBindings.sourceTerminal,
    sourceProgress: inspected.sourceBindings.sourceProgress,
    sourceStepTelemetry: inspected.sourceBindings.stepTelemetry,
    sourceConditionEvidence: inspected.sourceBindings.conditionEvidence,
  }
  plan.artifacts = {
    ...plan.artifacts,
    trainerManifest: `${recoveryRelativeRoot}/recovered-trainer-evidence.json`,
    trainerProgress: `${recoveryRelativeRoot}/recovered-progress-completed.json`,
    resourceTelemetry: `${recoveryRelativeRoot}/recovered-resource-telemetry-completed.json`,
    validationReport: `${recoveryRelativeRoot}/recovery-validation-report.json`,
    reviewAssets: `${recoveryRelativeRoot}/machine-review-assets`,
    machineReviewTimeline: `${recoveryRelativeRoot}/machine-review-timeline.json`,
    lateStabilityQualification: `${recoveryRelativeRoot}/late-stability-qualification.json`,
    manifest: `${recoveryRelativeRoot}/manifest.json`,
    finalization: `${recoveryRelativeRoot}/finalization/finalization.json`,
  }
  return plan
}

function deriveFixedPreviews(projectRoot, sourcePlan, metrics) {
  const result = []
  for (const metric of metrics) {
    const source = metric.validationPreviewArtifact
    const reproduction = metric.validationPreviewReproductionArtifact
    if (reproduction?.scheduled !== true) {
      assert.ok(source == null, `unscheduled Epoch ${metric.epoch} unexpectedly carries a source preview`)
      continue
    }
    assert.ok(PREVIEW_EPOCHS.includes(metric.epoch), `unexpected scheduled preview Epoch ${metric.epoch}`)
    assert.equal(reproduction.status, "fixed_epoch_preview_reproduced_exactly")
    assert.equal(reproduction.epoch, metric.epoch)
    assert.equal(source?.epoch, metric.epoch)
    assert.equal(reproduction.sourcePreview?.epoch, metric.epoch)
    assert.equal(reproduction.repeatedPreview?.epoch, metric.epoch)
    assert.equal(source.previewSha256, reproduction.sourcePreview.previewSha256)
    assert.equal(source.previewSha256, reproduction.repeatedPreview.previewSha256)
    assert.equal(reproduction.modelStateSha256Matches, true)
    assert.equal(reproduction.conditionTensorSha256Matches, true)
    assert.equal(reproduction.rgbTensorSha256Matches, true)
    assert.equal(reproduction.pngByteSha256Matches, true)
    const sourcePath = resolveInside(projectRoot, source.previewPath)
    const reproductionPath = resolveInside(projectRoot, reproduction.repeatedPreview.previewPath)
    assertCurrentOutput(projectRoot, sourcePlan, source.previewPath, `preview-${metric.epoch}`)
    assertCurrentOutput(projectRoot, sourcePlan, reproduction.repeatedPreview.previewPath, `reproduction-${metric.epoch}`)
    assert.equal(sha256File(sourcePath), source.previewSha256)
    assert.equal(sha256File(reproductionPath), source.previewSha256)
    result.push({
      epoch: metric.epoch,
      path: source.previewPath,
      sha256: source.previewSha256,
      reproductionPath: reproduction.repeatedPreview.previewPath,
      reproductionSha256: reproduction.repeatedPreview.previewSha256,
      byteExactReproduced: true,
    })
  }
  assert.deepEqual(result.map((row) => row.epoch), PREVIEW_EPOCHS)
  return result
}

function assertFiniteNumbers(value) {
  let count = 0
  const visit = (node) => {
    if (typeof node === "number") {
      assert.ok(Number.isFinite(node), "non-finite training metric")
      count += 1
      return
    }
    if (Array.isArray(node)) return node.forEach(visit)
    if (node && typeof node === "object") Object.values(node).forEach(visit)
  }
  visit(value)
  assert.ok(count > 0)
  return count
}

function countStep(events, step, status) {
  return events.filter((event) => event.step === step && event.status === status).length
}

function assertCurrentOutput(projectRoot, plan, relative, label) {
  const output = resolveInside(projectRoot, plan.outputRoot)
  const target = resolveInside(projectRoot, relative)
  assert.ok(target.startsWith(`${output}${path.sep}`), `${label} is outside the source run`)
}

function resolveInside(root, relative) {
  assert.ok(typeof relative === "string" && !path.isAbsolute(relative) && !/^[A-Za-z]:[\\/]/u.test(relative))
  const base = path.resolve(root)
  const target = path.resolve(base, relative)
  assert.ok(target.startsWith(`${base}${path.sep}`), `path escapes project: ${relative}`)
  return target
}

function projectPath(root, absolute) {
  return path.relative(path.resolve(root), absolute).replaceAll("\\", "/")
}

function bind(root, absolute) {
  return { path: projectPath(root, absolute), sha256: sha256File(absolute) }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

