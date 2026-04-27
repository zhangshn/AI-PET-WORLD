/**
 * 当前文件负责：定义 AI-PET-WORLD 通用人格向量类型。
 */

import type { BaziProfile } from "../bazi-core/bazi-types"
import type { PersonalityProfile } from "../ziwei-core/schema"

export type PersonalitySourceMode =
  | "bazi_only"
  | "ziwei_only"
  | "ziwei_bazi_combined"

export type FinalPersonalityVector = {
  curiosity: number
  activity: number
  stability: number
  sensitivity: number
  discipline: number
  attachment: number
  control: number
  explorationDrive: number
  reactionSpeed: number
  persistence: number
  adaptability: number
  sensoryDepth: number
  restPreference: number
}

export type FinalPersonalityBias = {
  petBehaviorBias: {
    newbornActivity: number
    observationNeed: number
    attachmentNeed: number
    explorationRange: number
    restNeed: number
  }
  butlerBehaviorBias: {
    carePriority: number
    constructionDrive: number
    routinePreference: number
    riskTolerance: number
    responseSpeed: number
  }
  buildingBias: {
    expansionPreference: number
    stabilityPreference: number
    comfortPreference: number
    orderPreference: number
    adaptabilityPreference: number
  }
}

export type FinalPersonalityProfile = {
  mode: PersonalitySourceMode
  vector: FinalPersonalityVector
  bias: FinalPersonalityBias
  sources: {
    ziwei?: PersonalityProfile | null
    bazi?: BaziProfile | null
  }
  labels: string[]
  summary: string
  debug: {
    usedZiwei: boolean
    usedBazi: boolean
    note: string
  }
}

export type BuildFinalPersonalityInput = {
  ziweiProfile?: PersonalityProfile | null
  baziProfile?: BaziProfile | null
}