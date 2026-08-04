export type TrainingTaskIdentity = {
  modelId?: string | null
  datasetPackageId?: string | null
  checkpointSha256?: string | null
  trainingChainId?: string | null
}

export type TrainingStatusEvidence = {
  code: "blocked_dataset_binding" | "running" | "resource_blocked" | "awaiting_validation" | "validation_failed" | "idle"
  label: string
  summary: string
  currentStep?: string | null
  source: string
  occurredAtUtc?: string | null
  terminalPriority: number
  taskIdentity?: TrainingTaskIdentity
  valid?: boolean
}

export type ProjectedTrainingStatus = Omit<TrainingStatusEvidence, "valid" | "taskIdentity"> & {
  occurredAtUtc: string | null
  taskIdentity: {
    modelId: string | null
    datasetPackageId: string | null
    checkpointSha256: string | null
    trainingChainId: string | null
  }
}

export function selectAuthoritativeTrainingEvidence(
  candidates: TrainingStatusEvidence[],
  activeTask: TrainingTaskIdentity,
): ProjectedTrainingStatus
