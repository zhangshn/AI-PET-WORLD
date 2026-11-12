export type OperatorSession = {
  csrfToken: string
  actorIdentity: string
  role: string
  expiresAtUtc: string
}

export type CommandServiceStatus = {
  serviceStatus: "ready" | "failed_closed"
  currentRegistryRevision: number | null
  executorIdentity: string
  executionBoundary: string
  failureCode: string | null
}

export type CommandReceipt = {
  commandId: string
  executionStatus: string
  resultTerminalId: string
  resultEvidencePath: string | null
  resultEvidenceSha256: string | null
  receiptSha256: string
  failureCode: string | null
}

export type ReceiptResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: "verified"
  receiptLogicalPath?: string
  eventLedgerStatus?: string
  eventLedgerLogicalPath?: string
  eventBinding?: ControlEventBinding | null
  transactionStoreStatus?: string
  transactionStoreLogicalPath?: string
  transactionBinding?: ControlTransactionBinding | null
  receipt?: CommandReceipt
  errorCode?: string
}

export type ControlEventBinding = {
  eventId: string
  eventSequence: number
  transactionId: string
  targetState: string
  eventSha256: string
}

export type ControlTransactionBinding = {
  transactionId: string
  transactionSequence: number
  commitStatus: string
  recoveryStatus: string
  transactionRecordSha256: string
}

export type TaskServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  taskCount: number
  queuedTasks: readonly {
    taskId: string
    taskGoal: string
    capabilityDomain: string
    priority: number
    taskRevision: number
    queuedAtUtc: string
  }[]
}

export type TaskCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  task?: { taskId: string; taskGoal: string; priority: number; lifecycleStatus: string; taskRecordSha256: string } | null
  event?: { taskEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

export type CapabilityServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  candidateCount: number
  qualificationCount: number
  releaseCount: number
  candidates: readonly {
    capabilityVersionId: string
    capabilityDomain: string
    modelIdentity: string
    datasetReleaseIdentity: string
    qualificationStage: string
    candidateStatus: string
    candidateRevision: number
  }[]
  releases: readonly {
    capabilityReleaseIdentity: string
    capabilityDomain: string
    capabilityVersionId: string
    releaseStatus: string
  }[]
}

export type CapabilityCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  candidate?: { capabilityVersionId: string; candidateStatus: string; candidateRecordSha256: string } | null
  qualification?: { qualificationResultId: string; qualificationGateId: string; qualificationRecordSha256: string } | null
  release?: { capabilityReleaseIdentity: string; releaseStatus: string; releaseRecordSha256: string } | null
  event?: { lifecycleEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

export type TrainingDesignServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  modelStructureCount: number
  trainingPlanCount: number
  modelStructures: readonly {
    modelStructureId: string
    capabilityDomain: string
    modelFamily: string
    parameterCount: number
    modelStructureStatus: string
  }[]
  trainingPlans: readonly {
    trainingPlanId: string
    capabilityDomain: string
    modelStructureId: string
    datasetReleaseIdentity: string
    planStatus: string
  }[]
}

export type TrainingDesignCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  modelStructure?: { modelStructureId: string; modelStructureStatus: string; modelStructureRecordSha256: string } | null
  trainingPlan?: { trainingPlanId: string; planStatus: string; trainingPlanRecordSha256: string } | null
  event?: { designEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

export type ReviewAdjudicationServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  decisionBoundary: string
  registryRevision: number
  reviewContractCount: number
  reviewResultCount: number
  reviewContracts: readonly {
    reviewContractId: string
    capabilityDomain: string
    reviewerIdentity: string
    reviewerVersion: string
    metricDefinitionId: string
    thresholdOperator: "greater_or_equal" | "less_or_equal"
    thresholdValue: number
    thresholdUnit: string
    failureCode: string
    contractStatus: string
  }[]
  reviewResults: readonly {
    reviewResultId: string
    reviewRunId: string
    reviewContractId: string
    reviewNodeId: string
    reviewerIdentity: string
    metricValue: number
    reviewStatus: "passed" | "failed"
    resultTerminalStatus: string
  }[]
}

export type ReviewAdjudicationCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  reviewContract?: { reviewContractId: string; contractStatus: string; reviewContractRecordSha256: string } | null
  reviewResult?: { reviewResultId: string; reviewStatus: "passed" | "failed"; resultTerminalStatus: string; reviewResultRecordSha256: string } | null
  event?: { adjudicationEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

export type RuntimeReleaseServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  activationCount: number
  candidateCount: number
  publicationCount: number
  qualifiedReleases: readonly { capabilityReleaseIdentity: string; capabilityDomain: string; capabilityVersionId: string; releaseStatus: string }[]
  activations: readonly { activationId: string; capabilityDomain: string; capabilityReleaseIdentity: string; activationStatus: "active" | "superseded"; activatedAtUtc: string }[]
  candidates: readonly { runtimeFrameCandidateIdentity: string; activationId: string; capabilityDomain: string; capabilityReleaseIdentity: string; worldId: string; tick: number; candidateStatus: string }[]
  reviewResults: readonly { reviewResultId: string; validationInputIdentity: string; capabilityDomain: string; reviewStatus: "passed" | "failed" }[]
  publications: readonly { publishIdentity: string; runtimeFrameIdentity: string; runtimeFrameCandidateIdentity: string; worldId: string; tick: number; runtimeFrameStatus: string }[]
}

export type RuntimeReleaseCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: { commandId: string; commandType: string; resultTerminalId: string; resultingRegistryRevision: number; failureCode: string | null; commandReceiptSha256: string }
  activation?: { activationId: string; capabilityReleaseIdentity: string; activationRecordSha256: string } | null
  candidate?: { runtimeFrameCandidateIdentity: string; candidateStatus: string; candidateRecordSha256: string } | null
  publication?: { publishIdentity: string; runtimeFrameIdentity: string; runtimeFrameStatus: string; publicationRecordSha256: string } | null
  event?: { runtimeReleaseEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

export type WorldControlState = {
  worldStateRevisionId: string
  worldId: string
  worldRevision: number
  activeRuntimeFrameIdentity: string
  activeFrameTick: number
  publishControlStatus: "publishing" | "paused"
  visualUpdateStatus: "enabled" | "frozen"
  transitionType: string
}

export type WorldControlServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: "new_ai_console_only"
  registryRevision: number
  worldCount: number
  worldStateCount: number
  commandCount: number
  eventCount: number
  currentWorldStates: readonly WorldControlState[]
  stateHistory: readonly WorldControlState[]
  publications: readonly {
    publishIdentity: string
    runtimeFrameIdentity: string
    previousRuntimeFrameIdentity: string | null
    worldId: string
    tick: number
    runtimeFrameStatus: string
  }[]
}

export type WorldControlCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    resultingWorldRevision: number | null
    failureCode: string | null
  }
  worldState?: WorldControlState | null
  errorCode?: string
}
