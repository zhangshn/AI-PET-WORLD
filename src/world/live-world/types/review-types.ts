export type ReviewType =
  | "auto"
  | "manual";

export type Reviewer =
  | "system"
  | "owner";

export type ReviewStatus =
  | "pass"
  | "fail"
  | "needs_owner_review";

export type StructureIssue =
  | "tree_count_mismatch"
  | "rock_count_mismatch"
  | "path_mask_broken"
  | "water_mask_broken"
  | "entity_position_drift"
  | "extra_interactive_resource"
  | "chunk_edge_mismatch"
  | "missing_output_image"
  | "missing_output_hash"
  | "output_hash_mismatch"
  | "output_meta_mismatch"
  | "candidate_file_missing";

export type VisualIssue =
  | "style_mismatch"
  | "low_readability"
  | "muddy_texture"
  | "broken_pixel_art"
  | "bad_depth_order"
  | "too_noisy"
  | "not_generated"
  | "repeated_texture"
  | "visible_grid_pattern"
  | "dark_border"
  | "blurred_region"
  | "water_artifact";

export interface ReviewResult {
  reviewId: string;
  candidateId: string;
  outputId: string;
  inputPayloadHash: string;

  reviewType: ReviewType;
  reviewer: Reviewer;
  status: ReviewStatus;

  structureIssues: StructureIssue[];
  visualIssues: VisualIssue[];

  candidateMetaPath: string;
  notes?: string;
  reviewedAt: string;
}

export interface ManualReviewRecord extends ReviewResult {
  reviewVersion: string;
  worldStatePayloadHash?: string | null;
  imageGenerated?: boolean;
  trainingEligibility: boolean;
  canEnterRuntime: boolean;
  decisionReason: string;
}

export type AutoStructureCheckStatus =
  | "pass"
  | "fail"
  | "blocked"
  | "skipped";

export type AutoStructureReviewConclusion =
  | "pass"
  | "fail"
  | "blocked_pending_output"
  | "needs_owner_review";

export interface AutoStructureCheckResult {
  checkId: string;
  status: AutoStructureCheckStatus;
  expected?: number | string | boolean | null;
  actual?: number | string | boolean | null;
  message: string;
}

export interface AutoStructureReviewRecord extends ReviewResult {
  reviewVersion: string;
  worldId: string | null;
  worldStatePayloadHash: string | null;
  sourceChunkStatePayloadHash: string;

  imageGenerated: boolean;
  outputImagePath: string;
  outputImageHash: string | null;

  expectedEntityCounts: Record<string, number>;
  terrainMaskSummary: Record<string, number>;
  neighborEdgeSummary: Record<string, string>;

  structureChecks: AutoStructureCheckResult[];
  conclusion: AutoStructureReviewConclusion;
  trainingEligibility: "trainable" | "not_trainable" | "pending_review";
  canEnterManualReview: boolean;
  canEnterRuntime: boolean;
  recommendedSampleDecision:
    | "positive"
    | "negative"
    | "rejected"
    | "pending_review";
  decisionReason: string;
}

export interface AutoVisualQualityMetrics {
  width: number;
  height: number;
  luminanceMean: number;
  luminanceStdDev: number;
  borderLuminanceMean: number;
  centerLuminanceMean: number;
  darkBorderRatio: number;
  horizontalGridRatio: number;
  verticalGridRatio: number;
  uniqueColorRatio: number;
}

export interface P11CandidateAutoReviewRecord extends AutoStructureReviewRecord {
  reviewVersion: "live-world-p11-auto-visual-review-v1";
  stage: "P11";
  candidateRoot: string;
  candidateMetaPath: string;
  outputMetaPath: string;
  visualQualityMetrics: AutoVisualQualityMetrics;
  manualReviewRequired: boolean;
  approvedVisualPromotionAllowed: false;
}

export interface P11AutoReviewBatchRecord {
  batchVersion: "live-world-p11-auto-visual-review-batch-v1";
  batchId: string;
  sourceCommandRunPath: string;
  status: "completed" | "failed";
  candidateCount: number;
  passCount: number;
  failCount: number;
  needsOwnerReviewCount: number;
  records: Array<{
    candidateId: string;
    chunkId: string;
    reviewPath: string;
    status: ReviewStatus;
    conclusion: AutoStructureReviewConclusion;
    structureIssues: StructureIssue[];
    visualIssues: VisualIssue[];
  }>;
  forbiddenSideEffects: {
    writesApprovedVisuals: false;
    writesTrainingSamples: false;
    bypassesRuntimePageGate: false;
  };
  createdAt: string;
}
