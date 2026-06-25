export type VisualUnitType =
  | "natural"
  | "butler"
  | "character"
  | "building"
  | "facility"
  | "item"
  | "animal"
  | "effect"

export type VisualUnitLifecycleState =
  | "seed"
  | "growing"
  | "idle"
  | "building"
  | "damaged"
  | "completed"
  | "decaying"

export type VisualUnitActionState =
  | "none"
  | "idle"
  | "walk"
  | "work"
  | "build"
  | "talk"
  | "interact"
  | "loop"

export type VisualUnitFrameKind = "static" | "loop" | "action" | "lifecycle"

export type VisualUnitTrainingStatus =
  | "not_started"
  | "schema_ready"
  | "data_preparing"
  | "training"
  | "candidate_ready"
  | "approved"

export type VisualUnitPhase = "mvp_current" | "next" | "future"

export type VisualUnitWorldFactBindingPolicy = {
  requiresWorldId: boolean
  requiresTick: boolean
  requiresSourceFactIds: boolean
  mayAddMajorWorldFact: boolean
}

export type VisualUnitFrameSpec = {
  frameId: string
  kind: VisualUnitFrameKind
  lifecycleState: VisualUnitLifecycleState
  actionState: VisualUnitActionState
  frameCount: number
  frameRate: number
  requiredConditionChannels: string[]
}

export type VisualUnitTrainingContract = {
  targetDirectories: string[]
  maskDirectories: string[]
  metadataRequired: string[]
  minimumAcceptedSamples: number
  storesRejectedSamples: boolean
}

export type VisualUnitDefinition = {
  unitId: string
  unitType: VisualUnitType
  labelZh: string
  phase: VisualUnitPhase
  trainingStatus: VisualUnitTrainingStatus
  allowedInCurrentNaturalHomeMvp: boolean
  worldFactBindingPolicy: VisualUnitWorldFactBindingPolicy
  frameSet: VisualUnitFrameSpec[]
  trainingContract: VisualUnitTrainingContract
}

export type VisualUnitV0Status = {
  schemaVersion: "visual-unit-v0"
  status: "schema_ready_registry_seeded"
  currentMvpUnitCount: number
  futureUnitCount: number
  approvedUnitCount: number
  missingForDynamicWorld: string[]
  nextModule: string
}
