/**
 * 当前文件负责：定义紫微当前流动人格与行动趋向的数据结构。
 */

import type {
  BranchPalace,
  CorePersonality,
  PersonalityProfile,
  PersonalityTraits,
  SectorName,
  StarId
} from "../../schema"

import type {
  ZiweiDynamicInfluence,
  ZiweiFlowResult,
  ZiweiFlowType
} from "../dynamic-schema"

export type CurrentDynamicBiases = Pick<
  ZiweiDynamicInfluence,
  | "careBias"
  | "observeBias"
  | "protectBias"
  | "exploreBias"
  | "recordBias"
  | "routineBias"
  | "repairBias"
  | "boundaryBias"
>

export interface CurrentDynamicFlowSummary {
  type: ZiweiFlowType
  palace: BranchPalace
  sectorName: SectorName
  stars: StarId[]
  pairIds: string[]
  influence: number
  isActive: boolean
  inactiveReason?: string
}

export interface CurrentDynamicPreference {
  positionBias: ZiweiDynamicInfluence["positionBias"]
  observationDistance: ZiweiDynamicInfluence["observationDistance"]
  toneBias: ZiweiDynamicInfluence["toneBias"]
}

export interface CurrentDynamicTendencies {
  exploreTendency: number
  observeTendency: number
  approachTendency: number
  recoverTendency: number
  careTendency: number
  protectTendency: number
  boundaryTendency: number
  routineTendency: number
  repairTendency: number
  recordTendency: number
}

export interface CurrentDynamicLabels {
  phase: string
  focus: string
  summary: string
}

export interface CurrentDynamicProfile {
  baseProfile: PersonalityProfile

  currentCorePersonality: CorePersonality
  currentTraits: PersonalityTraits
  currentBiases: CurrentDynamicBiases
  currentTendencies: CurrentDynamicTendencies
  currentPreference: CurrentDynamicPreference

  dominantFlow: CurrentDynamicFlowSummary
  temporalDominantFlow: CurrentDynamicFlowSummary | null

  labels: CurrentDynamicLabels

  debug: {
    activeFlows: ZiweiFlowResult[]
    topBiases: string[]
  }
}