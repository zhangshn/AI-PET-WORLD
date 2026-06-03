/**
 * 褰撳墠鏂囦欢璐熻矗锛氬畾涔夐€氱敤鐢熷懡浜烘牸妗ｆ鏍稿績绫诲瀷銆? */

import type { BaziProfile } from "../../destiny-core/bazi-core/bazi-gateway"
import type { ZiweiConsciousnessKernel } from "../../consciousness-core/consciousness/consciousness-gateway"
import type {
  GenderAwareBehaviorBias,
  GenderPerspective,
  PersonalityInterpretationMode,
  PersonalityInterpretationProfile,
} from "../personality-interpretation-core/interpretation-gateway"
import type { PublicPersonalityView } from "../../destiny-core/ziwei-core/public-view"
import type { PersonalityProfile } from "../../destiny-core/ziwei-core/ziwei-core-schema"

export type LifeProfileSubjectType =
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

  personalityInterpretationProfile: PersonalityInterpretationProfile
  genderAwareBehaviorBias: GenderAwareBehaviorBias

  consciousnessProfile: ZiweiConsciousnessKernel | null

  debug: {
    source: "life_profile_core"
    note: string
  }
}