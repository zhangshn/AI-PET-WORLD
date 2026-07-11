export type SampleDecision =
  | "positive"
  | "negative"
  | "rejected"
  | "pending_review"
  | "reference_only";

export type SampleSourceType =
  | "generated"
  | "manual_reference"
  | "external_reference";

export type LicenseStatus =
  | "owned"
  | "generated_by_us"
  | "unknown"
  | "do_not_train";

export type TrainingEligibility =
  | "trainable"
  | "not_trainable"
  | "pending_review";

export interface SampleRecord {
  sampleId: string;

  outputId: string;
  inputPayloadHash: string;
  linkedRunId: string;

  decision: SampleDecision;
  sourceType: SampleSourceType;
  sourcePath: string;
  licenseStatus: LicenseStatus;

  createdAt: string;
}

export interface SampleDecisionRecord {
  sampleDecisionVersion: string;
  sampleId: string;
  candidateId: string;
  outputId: string;

  worldId: string | null;
  worldStatePayloadHash: string | null;
  chunkId: string;
  inputPayloadHash: string;

  decision: SampleDecision;
  trainingEligibility: TrainingEligibility;
  sourceType: SampleSourceType;
  sourcePath: string;
  licenseStatus: LicenseStatus;

  positiveSamplePath: string | null;
  negativeSamplePath: string | null;
  rejectedSamplePath: string | null;
  pendingReviewPath: string | null;

  candidateArchivePath: string;
  manualReviewPath: string;
  outputMetaPath: string;
  outputImagePath: string;
  outputImageHash: string | null;

  decisionReason: string;
  decidedAt: string;
}
