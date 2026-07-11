export type RuntimePageGateStatus =
  | "ready"
  | "blocked_no_approved_visuals"
  | "blocked_source_mismatch";

export interface ApprovedVisualManifestEntry {
  chunkId: string;
  outputId: string;
  imagePath: string;
  imageHash: string;
  approvedSampleId: string;
  approvedAt: string;
}

export interface ApprovedVisualManifest {
  manifestVersion: string;
  manifestId: string;
  worldId: string;
  sourceWorldStatePayloadHash: string;
  requiredChunkIds: string[];
  approvedVisuals: ApprovedVisualManifestEntry[];
  approvedVisualCount: number;
  missingApprovedVisualChunkIds: string[];
  readBoundary: {
    allowedVisualRoots: string[];
    forbiddenVisualRoots: string[];
    allowCandidateOutputs: false;
    allowPendingSamples: false;
    allowRejectedSamples: false;
  };
  createdAt: string;
}

export interface RuntimePageGateRecord {
  pageGateVersion: string;
  gateId: string;
  status: RuntimePageGateStatus;
  worldId: string;
  worldStatePath: string;
  runtimeSnapshotPath: string;
  approvedVisualManifestPath: string;
  worldStatePayloadHash: string;
  runtimeSnapshotSourceWorldStatePayloadHash: string;
  activeChunkCount: number;
  sleepingChunkCount: number;
  requiredVisualChunkCount: number;
  approvedVisualCount: number;
  missingApprovedVisualChunkIds: string[];
  allowedReadRoots: string[];
  forbiddenReadRoots: string[];
  canRenderWorldPage: boolean;
  blockedReasons: string[];
  nextAllowedAction: string;
  createdAt: string;
}
