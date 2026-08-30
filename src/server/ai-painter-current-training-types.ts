export type TrainingEpochMetric = {
  epoch: number;
  recordedAtUtc: string | null;
  recordedAtAsiaShanghai: string | null;
  trainCompositeLoss: number | null;
  validationCompositeScore: number | null;
  validationCheckpointScore: number | null;
  rolloutWorstTrajectoryScore: number | null;
  bestCheckpointUpdated: boolean;
};

export type TrainingTokenAccounting = {
  schemaVersion: string;
  source: string;
  terminology: {
    localTrainingTokenUnit: string;
    isNlpToken: boolean;
    tokenizerUsed: boolean;
    noteZh: string;
  };
  externalApi: {
    providerCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCny: number;
    measurementStatus: string;
    externalAgentConversationTokensAvailableToLocalProgram: boolean;
  };
  geometry: {
    imageWidth: number;
    imageHeight: number;
    imagePixelsPerSample: number;
    latentWidth: number;
    latentHeight: number;
    latentSpatialPositionsPerSample: number;
    latentChannels: number;
    conditionChannels: number;
    latentDownsampleFactor: number;
  };
  perEpoch: TrainingComputeCounts;
  postEpochEvaluation: TrainingComputeCounts & {
    fixedGridSamplePasses: number;
    conditionEvidenceSamplePasses: number;
    latentNormalizationEncoderSamples: number;
  };
  runTotals: TrainingComputeCounts & {
    epochCount: number;
    decodedRgbPixelPredictions: number;
  };
  scope: { included: string[]; excluded: string[] };
};

export type TrainingComputeCounts = {
  trainingSamplePresentations?: number;
  optimizerSteps?: number;
  fixedValidationSamplePasses?: number;
  rolloutTrajectories?: number;
  rolloutDenoiserSteps?: number;
  decodedRgbFrames?: number;
  denoiserSampleForwardPasses: number;
  latentSpatialTokens: number;
  latentChannelValues: number;
  conditionScalarValues: number;
};

export type LocalCapabilityMigration = {
  id: string;
  nameZh: string;
  currentOwner: string;
  targetOwner: string;
  status: string;
  externalAgentRequired: boolean;
  evidence: string | null;
  nextGateZh: string | null;
};

export type AiPainterTaskCapsuleEvidence = {
  kind: string;
  labelZh: string;
  path: string;
  sha256: string | null;
  expectedSha256: string | null;
  sha256Verified: boolean;
  recordedAtUtc: string | null;
  recordedAtAsiaShanghai: string | null;
};

export type AiPainterTaskCapsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1";
  capsuleId: string;
  generatedFrom: "program_saved_evidence";
  readOnly: true;
  module: { id: string; nameZh: string };
  fixedOverallProgress: {
    completedStages: number | null;
    totalStages: number | null;
    percent: number | null;
    source: string;
  };
  currentStage: {
    number: number;
    total: number;
    labelZh: string;
    status: string;
  };
  candidateTerminal: {
    runId: string | null;
    status: "qualified" | "failed_closed" | "planned" | "unknown_or_stale";
    programStatus: string | null;
    previewMachineStatus: string | null;
    modelQualificationStatus: string;
    previewCount: number | null;
    previewPassCount: number | null;
    previewFailCount: number | null;
    checkpointWritten: boolean;
    modelWeightsModified: boolean;
    recordedAtUtc: string | null;
    recordedAtAsiaShanghai: string | null;
  };
  latestBlocker: { code: string; summaryZh: string };
  nextAllowedAction: {
    code: string;
    labelZh: string;
    ownerAuthorizationRequired: boolean;
    automaticExecutionAllowed: boolean;
    planEvidenceConfirmed: boolean;
  };
  forbiddenActions: string[];
  taskIdentity: {
    modelId: string | null;
    sampleId: string | null;
    conditionLabel: string | null;
    sampleSplit: string | null;
    seed: number | null;
    requiredBoundarySides: string[];
  };
  evidence: AiPainterTaskCapsuleEvidence[];
  integrity: {
    status: "verified" | "incomplete_or_mismatched";
    requiredEvidencePresent: boolean;
    boundEvidenceVerified: boolean;
    identityMatches: boolean;
    migrationRegistryStatus: string | null;
  };
};

export type TrainingStagePreview = {
  epoch: number;
  recordedAtUtc: string | null;
  recordedAtAsiaShanghai: string | null;
  imagePath: string;
  imageSha256: string | null;
  normalizedReviewImagePath: string | null;
  normalizedReviewImageSha256: string | null;
  machineReviewPassed: boolean | null;
  machineReviewIssueCodes: string[];
};

export type TrainingLiveProgress = {
  schemaVersion: string;
  recordedAtUtc: string | null;
  recordedAtAsiaShanghai: string | null;
  phase: string | null;
  epoch: number | null;
  epochTarget: number | null;
  batch: number | null;
  batchTarget: number | null;
  optimizerStep: number | null;
  optimizerStepTarget: number | null;
  percentage: number | null;
  elapsedSeconds: number | null;
  etaSeconds: number | null;
  optimizerStepsPerSecond: number | null;
  batchLoss: number | null;
  rollingEpochLoss: number | null;
  lastBatchDurationSeconds: number | null;
  samplesInBatch: number | null;
  validationCompositeScore: number | null;
  checkpointSelectionScore: number | null;
  localDenoiserSampleForwardPasses: number | null;
  localTrainingTokenCount: number | null;
  localTrainingTokenUnit: string | null;
};

export type TrainingStageDetail = {
  runId: string;
  kind: "failure" | "smoke" | "stage";
  status: string;
  verdict:
    "failed" | "passed" | "running" | "pending_validation" | "quarantined";
  resolutionStage: number | null;
  resolution: { width: number; height: number } | null;
  createdAtUtc: string | null;
  createdAtAsiaShanghai: string | null;
  updatedAtUtc: string | null;
  updatedAtAsiaShanghai: string | null;
  durationSeconds: number | null;
  device: string | null;
  epochCount: number;
  bestEpoch: number | null;
  bestValidationMetric: number | null;
  checkpointPath: string | null;
  checkpointSha256: string | null;
  parentCheckpointPath: string | null;
  parentCheckpointSha256: string | null;
  manifestPath: string;
  manifestSha256: string | null;
  conditionBoundSampleCount: number | null;
  actualLoadedConditionalSampleCount: number | null;
  actualLoadedV7CapacityCount: number | null;
  actualLoadedSplitCounts: Record<string, number>;
  tokenLedgerPath: string | null;
  tokenLedgerSha256: string | null;
  tokenAccounting: TrainingTokenAccounting | null;
  liveProgress: TrainingLiveProgress | null;
  splitMetrics: Record<
    string,
    { sampleCount: number | null; status: string | null }
  >;
  blockers: string[];
  metrics: TrainingEpochMetric[];
  previewReviewPath: string | null;
  previewReviewSha256: string | null;
  previewGateStatus: string | null;
  previews: TrainingStagePreview[];
  error: string | null;
};

export type CurrentExecutionActivity = {
  actor:
    | "local_ai_model"
    | "local_program"
    | "owner"
    | "codex"
    | "idle";
  actorLabelZh: string;
  lifecycle:
    | "idle"
    | "waiting_authorization"
    | "initializing"
    | "running"
    | "reviewing"
    | "completed"
    | "failed"
    | "blocked"
    | "stalled";
  lifecycleLabelZh: string;
  localAiProcessActive: boolean;
  taskId: string | null;
  taskKind: string | null;
  taskLabelZh: string;
  detailZh: string;
  source: string;
  sourcePath: string | null;
  startedAtUtc: string | null;
  startedAtAsiaShanghai: string | null;
  lastHeartbeatAtUtc: string | null;
  lastHeartbeatAtAsiaShanghai: string | null;
  heartbeatAgeSeconds: number | null;
  staleAfterSeconds: number;
  stalled: boolean;
  process: {
    controllerPid: number | null;
    controllerAlive: boolean;
    childPid: number | null;
    childAlive: boolean;
    commandIdentity: string | null;
  };
  progress: {
    runId: string | null;
    phase: string | null;
    stageIndex: number | null;
    stageLabel: string | null;
    resolution: string | null;
    epoch: number | null;
    epochTarget: number | null;
    batch: number | null;
    batchTarget: number | null;
    optimizerStep: number | null;
    optimizerStepTarget: number | null;
    percentage: number | null;
    elapsedSeconds: number | null;
    etaSeconds: number | null;
    optimizerStepsPerSecond: number | null;
    lastBatchDurationSeconds: number | null;
    samplesInBatch: number | null;
    trainCompositeLoss: number | null;
    validationCompositeScore: number | null;
    checkpointScore: number | null;
    latestPreviewPath: string | null;
    latestPreviewRecordedAtUtc: string | null;
    latestPreviewRecordedAtAsiaShanghai: string | null;
  };
  accounting: {
    localModel: {
      available: boolean;
      unit: string;
      total: number | null;
      source: string | null;
    };
    externalApi: {
      available: boolean;
      providerCalls: number | null;
      totalTokens: number | null;
      source: string | null;
    };
    codex: {
      availability: "unavailable_to_local_program" | "reported";
      totalTokens: number | null;
      noteZh: string;
    };
  };
};

export type V7CapacityRow = {
  recordId: string;
  slotId: string | null;
  split: string;
  conditionLabel: string | null;
  conditionBound: boolean;
  currentConditionIdentityMatches: boolean;
  capacityRegistered: boolean;
  selectedByCurrentPythonDataset: boolean;
  createdAtUtc: string | null;
  createdAtAsiaShanghai: string | null;
  updatedAtUtc: string | null;
  updatedAtAsiaShanghai: string | null;
};

export type StrictValidationIssue = {
  code: string;
  message: string | null;
  messageZh: string | null;
  affectedRegion: string | null;
  nextTrainingTarget: string | null;
};

export type StrictValidationGate = {
  gate: string;
  passed: boolean;
  issueCodes: string[];
};

export type StrictValidationTokenAccounting = {
  schemaVersion: string | null;
  denoiserSampleForwardPasses: number;
  latentSpatialTokens: number;
  latentChannelValues: number;
  conditionScalarValues: number;
  decodedRgbFrames: number;
  decodedRgbPixelPredictions: number;
  externalApiTokens: number;
};

export type StrictValidationTrajectory = {
  recordId: string;
  conditionLabel: string;
  split: string;
  seedIndex: number;
  seed: number;
  status: string;
  durationMs: number;
  runId: string;
  manifestPath: string | null;
  outputImagePath: string | null;
  outputImageSha256: string | null;
  machineReviewPath: string | null;
  machineReviewSha256: string | null;
  machineReviewIssueCodes: string[];
  reviewedAtUtc: string | null;
  reviewedAtAsiaShanghai: string | null;
  gates: StrictValidationGate[];
  issues: StrictValidationIssue[];
  validationTokenAccounting: StrictValidationTokenAccounting;
};

export type StrictValidationBatch = {
  batchId: string;
  status: string;
  createdAtUtc: string | null;
  createdAtAsiaShanghai: string | null;
  completedAtUtc: string | null;
  completedAtAsiaShanghai: string | null;
  reportPath: string;
  reportSha256: string | null;
  checkpointSha256: string | null;
  plannedTrajectoryCount: number;
  completedTrajectoryCount: number;
  machinePassedCount: number;
  machineRejectedCount: number;
  duplicateOutputHashes: string[];
  issueCodes: string[];
  trainingWeightsModified: boolean;
  automaticRetryCount: number;
  formalInferenceEligible: boolean;
  runtimeFrameEligible: boolean;
  canEnterWorld: boolean;
  validationTokenAccounting: StrictValidationTokenAccounting;
  trajectories: StrictValidationTrajectory[];
};

export type CurrentTrainingDashboardSnapshot = {
  schemaVersion: "ai-painter-current-training-dashboard-v1";
  generatedAtUtc: string;
  readOnly: true;
  taskCapsule: AiPainterTaskCapsule;
  activity: CurrentExecutionActivity;
  status: {
    code:
      | "blocked_dataset_binding"
      | "current_registry_unknown_or_stale"
      | "candidate_planned"
      | "running"
      | "resource_blocked"
      | "validation_failed"
      | "candidate_failed_closed"
      | "controlled_smoke_qualified"
      | "formal_stage0_real_visual_failure"
      | "formal_stage0_completed"
      | "formal_stage0_reviewing"
      | "formal_stage0_running"
      | "idle";
    label: string;
    summary: string;
    currentStep: string | null;
    source: string;
    occurredAtUtc: string | null;
    terminalPriority: number;
    taskIdentity: {
      modelId: string | null;
      datasetPackageId: string | null;
      checkpointSha256: string | null;
      trainingChainId: string | null;
    };
  };
  model: {
    modelId: string | null;
    architectureVersion: string | null;
    denoiserArchitecture: string | null;
    predictionTarget: string | null;
    conditionChannels: number | null;
    conditionChannelOrder: string[];
    resolutionStages: Array<{ width: number; height: number }>;
    batchSize: number | null;
    epochTargetPerStage: number | null;
    authorizationStatus: string | null;
  };
  dataset: {
    packageId: string | null;
    manifestPath: string;
    manifestSha256: string | null;
    createdAtUtc: string | null;
    createdAtAsiaShanghai: string | null;
    registeredCapacityCount: number;
    expectedCapacityCount: number;
    loadedConditionalSampleCount: number;
    loadedV7CapacityCount: number;
    expectedSplits: Record<string, number>;
    actualSplits: Record<string, number>;
    capacitySplits: Record<string, number>;
    mismatchReasons: string[];
    rows: V7CapacityRow[];
  };
  execution: {
    stages: TrainingStageDetail[];
    totalEpochsExecuted: number;
    checkpointLineageValid: boolean;
    formalInferenceEligible: false;
    checkpointDisposition: string;
  };
  validation: {
    latestBatchId: string | null;
    issueCounts: Record<string, number>;
    batches: StrictValidationBatch[];
  };
  gpu: {
    available: boolean;
    name: string;
    memoryTotalMiB: number;
    memoryUsedMiB: number;
    utilizationPercent: number;
    temperatureCelsius: number;
    driver: string;
    activeComputeProcessCount: number;
  };
  hardware: {
    capturedAtUtc: string;
    cpu: {
      model: string;
      loadPercent: number | null;
      physicalCoreCount: number;
      logicalProcessorCount: number;
      currentClockMhz: number | null;
      maxClockMhz: number | null;
      packageCount: number;
    };
    memory: {
      totalMiB: number;
      usedMiB: number;
      availableMiB: number;
      usagePercent: number;
    };
    disks: Array<{
      name: string;
      volumeName: string | null;
      fileSystem: string | null;
      totalGiB: number;
      usedGiB: number;
      freeGiB: number;
      usagePercent: number;
    }>;
    networkAdapters: Array<{
      name: string;
      status: string;
      linkSpeed: string | null;
      interfaceDescription: string | null;
    }>;
    system: {
      osCaption: string;
      version: string;
      buildNumber: string;
      architecture: string;
      hostname: string;
      uptimeSeconds: number;
    };
  };
  authorization: {
    requestId: string | null;
    status: string | null;
    blockerCode: string | null;
    ownerMessage: string | null;
    minimumRequestedAction: string | null;
    requestPath: string | null;
    requestSha256: string | null;
    recordedAtUtc: string | null;
    recordedAtAsiaShanghai: string | null;
  };
  migration: {
    registryId: string | null;
    status: string | null;
    objectiveZh: string | null;
    currentExternalAgentRole: string | null;
    targetExternalAgentRole: string | null;
    registryPath: string;
    registrySha256: string | null;
    capabilities: LocalCapabilityMigration[];
  };
  events: Array<{
    id: string;
    timestamp: string;
    runId: string;
    action: string;
    kind: string;
    status: string;
    title: string;
    detail: string | null;
    currentStep: string | null;
    evidencePath: string | null;
  }>;
  evidence: Array<{
    label: string;
    path: string;
    sha256: string | null;
    recordedAtUtc: string | null;
    recordedAtAsiaShanghai: string | null;
  }>;
};

