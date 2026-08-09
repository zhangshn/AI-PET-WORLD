const STEP_STATE_FIELDS = {
  model_device_placement: "modelDevicePlacement",
  autoencoder_checkpoint_read: "autoencoderCheckpointRead",
  autoencoder_state_load: "autoencoderStateLoad",
  denoiser_checkpoint_read: "denoiserCheckpointRead",
  denoiser_state_load: "denoiserStateLoad",
  optimizer_creation: "optimizerCreation",
  batch_device_transfer: "batchDeviceTransfer",
  forward_loss: "forwardLoss",
  backward: "backward",
  optimizer_step: "optimizerStep",
  checkpoint_write: "checkpointWrite",
}

export function deriveStage4ExecutionBoundaries({ executionConsumed = false, telemetry = null, manifest = null, checkpointPath = null } = {}) {
  const state = telemetry?.state ?? {}
  const completed = (name) => state[`${STEP_STATE_FIELDS[name]}Completed`] === true
  const started = (name) => state[`${STEP_STATE_FIELDS[name]}Started`] === true
  const checkpointFileRead = completed("autoencoder_checkpoint_read") || completed("denoiser_checkpoint_read")
  const checkpointLoaded = completed("autoencoder_state_load") && completed("denoiser_state_load")
  const optimizerCreated = completed("optimizer_creation")
  const backwardExecuted = completed("backward")
  const optimizerStepCompleted = completed("optimizer_step")
  const checkpointWritten = completed("checkpoint_write") && Boolean(checkpointPath)
  return {
    gpuExecutionAuthorizationConsumed: Boolean(executionConsumed),
    checkpointFileRead,
    checkpointLoaded,
    optimizerCreated,
    backwardExecuted,
    modelWeightsModified: optimizerStepCompleted || manifest?.modelStateHashEvidence?.weightsChanged === true,
    gpuTrainingStarted: started("forward_loss"),
    smokeCheckpointWritten: checkpointWritten,
    automaticRetryStarted: false,
    stage4FullTrainingStarted: false,
    stage1Started: false,
    stage2Started: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointFormallyPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
  }
}

export function validateStage4StepTelemetry(telemetry) {
  const issues = []
  if (telemetry?.schemaVersion !== "stage4-bounded-repair-smoke-step-telemetry-v1") issues.push("step_telemetry_schema_invalid")
  if (!Array.isArray(telemetry?.events)) issues.push("step_telemetry_events_missing")
  const events = Array.isArray(telemetry?.events) ? telemetry.events : []
  let previousSequence = 0
  const seen = new Map()
  for (const event of events) {
    if (!Number.isInteger(event?.sequence) || event.sequence !== previousSequence + 1) issues.push("step_telemetry_sequence_invalid")
    previousSequence = Number.isInteger(event?.sequence) ? event.sequence : previousSequence
    if (!Object.hasOwn(STEP_STATE_FIELDS, event?.step)) issues.push("step_telemetry_step_invalid")
    if (!new Set(["started", "completed", "failed"]).has(event?.status)) issues.push("step_telemetry_status_invalid")
    const key = `${event?.step}:${event?.status}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
    if (event?.status === "completed" && !seen.has(`${event.step}:started`)) issues.push("step_telemetry_completed_without_started")
  }
  const state = telemetry?.state ?? {}
  for (const [step, prefix] of Object.entries(STEP_STATE_FIELDS)) {
    if (state[`${prefix}Completed`] === true && state[`${prefix}Started`] !== true) issues.push(`step_telemetry_state_completed_without_started:${step}`)
  }
  return {
    valid: issues.length === 0,
    issues: [...new Set(issues)],
    eventCount: events.length,
    latestStep: telemetry?.latestStep ?? null,
    latestStatus: telemetry?.latestStatus ?? null,
  }
}

export const STAGE4_STEP_STATE_FIELDS = Object.freeze({ ...STEP_STATE_FIELDS })
