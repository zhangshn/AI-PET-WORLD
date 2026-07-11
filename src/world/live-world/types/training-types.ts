export type TrainingRunStatus =
  | "planned"
  | "blocked_no_trainable_samples"
  | "ready"
  | "running"
  | "completed"
  | "failed";

export type TrainingSamplePolarity =
  | "positive"
  | "negative";

export interface TrainingSampleManifestEntry {
  sampleId: string;
  candidateId: string;
  outputId: string;
  polarity: TrainingSamplePolarity;
  inputPayloadHash: string;
  outputImagePath: string;
  outputImageHash: string;
  sampleDecisionPath: string;
  sourcePath: string;
}

export interface TrainingSampleManifest {
  manifestVersion: string;
  manifestId: string;
  trainingRunId: string;
  entries: TrainingSampleManifestEntry[];
  positiveCount: number;
  negativeCount: number;
  totalTrainableSamples: number;
  blockedSampleCounts: {
    pending: number;
    rejected: number;
  };
  readBoundary: {
    allowedSampleRoots: string[];
    forbiddenSampleRoots: string[];
    allowPending: false;
    allowRejected: false;
  };
  createdAt: string;
}

export interface TrainingConfigSnapshot {
  configVersion: string;
  modelFamily: "ai-painter-natural-home";
  trainingMode:
    | "blocked-plan-only"
    | "structure-guided-refiner"
    | "local-detail-repair";
  command: string | null;
  datasetRoot: string | null;
  outputRoot: string;
  seed: number;
  maxEpochs: number | null;
  reason: string;
}

export interface TrainingOutputArchivePlan {
  outputRoot: string;
  checkpointPath: string | null;
  metricsPath: string | null;
  logPath: string | null;
  generatedCandidateRoot: string | null;
  canWriteModelArtifact: boolean;
}

export interface TrainingRunRecord {
  trainingRunVersion: string;
  trainingRunId: string;
  status: TrainingRunStatus;
  sampleManifestPath: string;
  configSnapshot: TrainingConfigSnapshot;
  outputArchivePlan: TrainingOutputArchivePlan;
  blockedReasons: string[];
  nextAllowedAction: string;
  createdAt: string;
}
