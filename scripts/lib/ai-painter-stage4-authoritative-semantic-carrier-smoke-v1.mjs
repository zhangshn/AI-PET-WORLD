import assert from "node:assert/strict"

export const SMOKE_SCHEMA = "stage4-authoritative-semantic-carrier-controlled-smoke-contract-v1"
export const ARCHITECTURE = "stage4_authoritative_visual_semantic_carrier_decoder_v1"
export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const PREVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30])

export function buildControlledSmokeContract({ capabilityVersion, evidence }) {
  const contract = {
    schemaVersion: SMOKE_SCHEMA,
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion,
    architecture: ARCHITECTURE,
    executionIdentity: {
      kind: "controlled_single_sample_model_smoke",
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
      resolutionStage: 0,
      resolution: { width: 256, height: 192 },
      epochCount: 30,
      previewEpochs: [...PREVIEW_EPOCHS],
      initialization: "fixed_project_random_initialization",
    },
    frozenBoundaries: {
      approvedSampleCount: 64,
      split: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannels: 23,
      autoencoderFrozen: true,
      lossValuesAndWeightsUnchanged: true,
      checkpointFormatUnchanged: true,
      machineReviewThresholdsUnchanged: true,
    },
    closedLoop: [
      "cpu_positive_negative_gate",
      "node_trainer_readonly_preflight",
      "python_cuda_disk_resource_preflight",
      "internal_capability_ticket_atomic_consumption",
      "controlled_training",
      "fixed_preview_byte_reproduction",
      "automatic_machine_review",
      "late_stability_qualification",
      "terminal_recording",
      "plan_capsule_event_sqlite_sync",
    ],
    internalCapability: {
      issueAuthority: "local_ai_pet_world_program",
      singleUse: true,
      persistedReplayProtection: true,
      cannotExpandParentContract: true,
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
    },
    stopConditions: [
      "authorization_or_identity_conflict",
      "resource_gate_failure",
      "trainer_or_evidence_failure",
      "real_visual_failure",
      "late_stability_not_qualified",
    ],
    prohibited: [
      "historical_or_failed_denoiser_checkpoint",
      "automatic_retry",
      "free_hyperparameter_search",
      "loss_data_or_threshold_change",
      "stage0_stage1_stage2",
      "formal_inference_runtime_frame_or_world_entry",
    ],
    sourceEvidence: evidence,
  }
  validateControlledSmokeContract(contract)
  return contract
}

export function validateControlledSmokeContract(value) {
  assert.equal(value.schemaVersion, SMOKE_SCHEMA)
  assert.equal(value.status, "compiled_not_started")
  assert.equal(value.authority, "local_ai_pet_world_program")
  assert.equal(value.architecture, ARCHITECTURE)
  assert.match(value.capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/)
  assert.deepEqual(value.executionIdentity, {
    kind: "controlled_single_sample_model_smoke",
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    requiredBoundarySides: ["west"],
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [...PREVIEW_EPOCHS],
    initialization: "fixed_project_random_initialization",
  })
  assert.deepEqual(value.frozenBoundaries.split, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(value.frozenBoundaries.approvedSampleCount, 64)
  assert.equal(value.frozenBoundaries.conditionChannels, 23)
  for (const key of ["autoencoderFrozen", "lossValuesAndWeightsUnchanged", "checkpointFormatUnchanged", "machineReviewThresholdsUnchanged"]) assert.equal(value.frozenBoundaries[key], true)
  assert.equal(value.internalCapability.ownerAuthorizationRequired, false)
  assert.equal(value.internalCapability.ownerResponseRequired, false)
  assert.equal(value.internalCapability.singleUse, true)
  assert.equal(value.internalCapability.persistedReplayProtection, true)
  assert.equal(value.internalCapability.cannotExpandParentContract, true)
  for (const required of ["controlled_training", "automatic_machine_review", "late_stability_qualification", "terminal_recording"]) assert.ok(value.closedLoop.includes(required))
  for (const prohibited of ["automatic_retry", "loss_data_or_threshold_change", "stage0_stage1_stage2"]) assert.ok(value.prohibited.includes(prohibited))
  assert.ok(Array.isArray(value.sourceEvidence) && value.sourceEvidence.length >= 4)
  for (const binding of value.sourceEvidence) {
    assert.match(binding.path, /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/)
    assert.match(binding.sha256, /^[a-f0-9]{64}$/)
  }
  return true
}
