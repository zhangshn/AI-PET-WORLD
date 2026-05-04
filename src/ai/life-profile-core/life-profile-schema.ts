/**
 * 当前文件负责：定义通用生命人格档案核心类型。
 */

import type { BaziProfile } from "../bazi-core/bazi-types"
import type { ZiweiConsciousnessKernel } from "../consciousness/consciousness-gateway"
import type { FinalPersonalityProfile } from "../personality-vector/vector-gateway"
import type {
  GenderAwareBehaviorBias,
  GenderPerspective,
  PersonalityInterpretationMode,
  PersonalityInterpretationProfile,
} from "../personality-interpretation-core/interpretation-gateway"
import type { PublicPersonalityView } from "../ziwei-core/mapper"
import type { PersonalityProfile } from "../ziwei-core/schema"

export type LifeProfileSubjectType =
  | "pet"
  | "butler"
  | "player"
  | "npc"

export type LifeProfileBirthInput = {
  year: number
  month: number
  day: number
  hour?: number | null
  minute?: number | null
}

export type BuildLifePersonalityProfileInput = {
  subjectType: LifeProfileSubjectType
  birthInput: LifeProfileBirthInput
  genderPerspective: GenderPerspective
  hasBirthHour: boolean
}

export type LifePersonalityProfileBundle = {
  subjectType: LifeProfileSubjectType

  mode: PersonalityInterpretationMode
  genderPerspective: GenderPerspective
  hasBirthHour: boolean

  ziweiProfile: PersonalityProfile | null
  publicPersonalityView: PublicPersonalityView | null

  baziProfile: BaziProfile

  basePersonalityProfile: FinalPersonalityProfile
  personalityInterpretationProfile: PersonalityInterpretationProfile
  genderAwareBehaviorBias: GenderAwareBehaviorBias

  consciousnessProfile: ZiweiConsciousnessKernel | null

  debug: {
    source: "life_profile_core"
    note: string
  }
}