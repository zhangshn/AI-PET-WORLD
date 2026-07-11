export type VisualGenerationRequestStatus =
  | "waiting_for_ai_painter"
  | "generated"
  | "failed"
  | "cancelled";

export interface VisualGenerationBatchEntry {
  requestId: string;
  candidateId: string;
  chunkId: string;
  chunkX: number;
  chunkY: number;
  inputPayloadHash: string;
  visualInputPath: string;
  expectedCandidateRoot: string;
  expectedOutputImagePath: string;
  status: VisualGenerationRequestStatus;
}

export interface VisualGenerationBatchManifest {
  batchVersion: string;
  batchId: string;
  status: "ready_for_ai_painter" | "completed" | "blocked";
  sourceWorldStatePayloadHash: string;
  sourceRuntimeSnapshotPath: string;
  sourceRuntimePageGatePath: string;
  activeChunkCount: number;
  requestCount: number;
  entries: VisualGenerationBatchEntry[];
  readBoundary: {
    allowedReadRoots: string[];
    forbiddenReadRoots: string[];
    canWriteCandidates: true;
    canWriteApprovedVisuals: false;
    canWriteTrainingSamples: false;
    canBypassRuntimePageGate: false;
  };
  nextRequiredPipelines: {
    aiPainterGeneration: boolean;
    autoStructureReview: boolean;
    ownerReview: boolean;
    approvedVisualPromotion: boolean;
    runtimePageGateRefresh: boolean;
  };
  createdAt: string;
}

export type VisualGenerationDispatchStatus =
  | "blocked_missing_ai_painter_command"
  | "ready_to_execute"
  | "executed"
  | "failed";

export interface VisualGenerationDispatchEntry {
  requestId: string;
  candidateId: string;
  chunkId: string;
  inputPayloadHash: string;
  candidateRoot: string;
  candidateInputPath: string;
  candidateMetaPath: string;
  outputMetaPath: string;
  expectedOutputImagePath: string;
  status: VisualGenerationRequestStatus;
  blockedReason: string | null;
}

export interface VisualGenerationDispatchRecord {
  dispatchVersion: string;
  dispatchId: string;
  batchId: string;
  status: VisualGenerationDispatchStatus;
  aiPainterCommand: string | null;
  entries: VisualGenerationDispatchEntry[];
  candidateCount: number;
  imageGeneratedCount: number;
  readBoundary: {
    sourceBatchPath: string;
    allowedWriteRoots: string[];
    forbiddenWriteRoots: string[];
    canWriteCandidates: true;
    canWriteApprovedVisuals: false;
    canWriteTrainingSamples: false;
    canBypassRuntimePageGate: false;
  };
  nextRequiredPipelines: {
    aiPainterCommandConfiguration: boolean;
    aiPainterGeneration: boolean;
    autoStructureReview: boolean;
    ownerReview: boolean;
    approvedVisualPromotion: boolean;
    runtimePageGateRefresh: boolean;
  };
  createdAt: string;
}

export type VisualGenerationCommandRunStatus =
  | "blocked_missing_ai_painter_command"
  | "completed"
  | "partial_failed"
  | "failed";

export interface VisualGenerationCommandRunEntry {
  candidateId: string;
  chunkId: string;
  inputPath: string;
  outputImagePath: string;
  outputMetaPath: string;
  status:
    | "blocked"
    | "generated"
    | "failed";
  exitCode: number | null;
  imageGenerated: boolean;
  imageHash: string | null;
  errorMessage: string | null;
}

export interface VisualGenerationCommandRunRecord {
  runVersion: string;
  runId: string;
  dispatchId: string;
  status: VisualGenerationCommandRunStatus;
  aiPainterCommand: string | null;
  entries: VisualGenerationCommandRunEntry[];
  generatedCount: number;
  failedCount: number;
  blockedCount: number;
  commandProtocol: {
    inputEnv: string[];
    outputFiles: string[];
    successCriteria: string[];
  };
  forbiddenSideEffects: {
    writesApprovedVisuals: false;
    writesTrainingSamples: false;
    bypassesRuntimePageGate: false;
  };
  createdAt: string;
}

export type VisualGenerationLocalAdapterStatus =
  | "ready_to_run"
  | "blocked_missing_dispatch"
  | "blocked_missing_adapter_script"
  | "blocked_missing_model_assets"
  | "blocked_missing_live_world_inference_bridge";

export interface VisualGenerationLocalAdapterModelAsset {
  modelId: string;
  modelRoot: string;
  checkpointPath: string;
  exists: boolean;
  role:
    | "structure_checkpoint"
    | "rgb_refiner_checkpoint"
    | "current_mvp_checkpoint"
    | "formal_world_checkpoint";
}

export interface VisualGenerationLocalAdapterReadinessRecord {
  readinessVersion: string;
  readinessId: string;
  dispatchId: string | null;
  status: VisualGenerationLocalAdapterStatus;
  adapterCommand: string;
  adapterScriptPath: string;
  inferenceBridgeScriptPath: string;
  recommendedInnerInferenceCommand: string;
  candidateCount: number;
  modelAssets: VisualGenerationLocalAdapterModelAsset[];
  selectedModelRoot: string | null;
  selectedCheckpointPath: string | null;
  missingReasons: string[];
  commandProtocol: {
    outerCommandEnv: string;
    innerInferenceCommandEnv: string;
    requiredCandidateEnv: string[];
    outputFiles: string[];
  };
  bridgeContract: {
    readsChunkVisualInput: true;
    convertsTileAndEntityDataToModelCondition: boolean;
    callsLocalModelRuntime: boolean;
    writesCandidateImageOnly: true;
    writesApprovedVisuals: false;
    writesTrainingSamples: false;
    bypassesRuntimePageGate: false;
  };
  nextActions: string[];
  createdAt: string;
}
