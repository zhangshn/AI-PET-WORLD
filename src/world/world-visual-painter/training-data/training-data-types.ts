import type {
  WorldVisualAuthorizedDataItem,
  WorldVisualBilingualText,
} from "../world-visual-painter-schema"

export type WorldVisualTrainingDataStage = "paired_dataset_v0"

export type WorldVisualTrainingDataStatus =
  | "paired_dataset_missing"
  | "paired_dataset_insufficient"
  | "paired_dataset_ready"

export type WorldVisualTrainingDataRequirement = {
  id: string
  title: WorldVisualBilingualText
  required: boolean
  fulfilled: boolean
  tags: string[]
}

export type WorldVisualTrainingDataManifest = {
  manifestId: string
  version: "world-visual-training-data-v2"
  stage: WorldVisualTrainingDataStage
  status: WorldVisualTrainingDataStatus
  requiredMinSampleCount: number
  targetSampleCount: number
  acceptedPairedSampleCount: number
  missingSampleCount: number
  readyForTraining: boolean
  trainableItems: WorldVisualAuthorizedDataItem[]
  blockedItems: WorldVisualAuthorizedDataItem[]
  requirements: WorldVisualTrainingDataRequirement[]
  policy: WorldVisualBilingualText
  tags: string[]
}
