export type VisualCandidateStatus =
  | "generation_pending"
  | "generation_failed"
  | "pending_structure_review"
  | "pending_owner_review"
  | "owner_approved"
  | "owner_rejected"
  | "promoted_to_sample"
  | "rejected";

export type CandidateStage =
  | "P1"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P10";

export interface VisualOutputFileRef {
  imagePath: string;
  imageHash: string | null;
  width: number | null;
  height: number | null;
  generatedAt: string | null;
  imageGenerated: boolean;
}

export interface VisualCandidate {
  candidateId: string;
  outputId: string;
  inputPayloadHash: string;

  chunkId: string;
  imagePath: string;
  metaPath: string;

  status: VisualCandidateStatus;
  createdAt: string;
}

export interface VisualCandidateArchiveRecord {
  archiveVersion: string;
  candidateId: string;
  outputId: string;
  stage: CandidateStage;

  worldId: string | null;
  worldStatePayloadHash: string | null;
  chunkId: string;
  inputPayloadHash: string;
  sourceChunkStatePayloadHash: string;

  candidateMetaPath: string;
  candidateInputPath: string;
  outputMetaPath: string;
  manualReviewPath: string;
  sampleDecisionPath: string;

  outputFile: VisualOutputFileRef;

  status: VisualCandidateStatus;
  trainingEligibility: false;
  canEnterRuntime: false;

  createdAt: string;
  notes: string;
}
