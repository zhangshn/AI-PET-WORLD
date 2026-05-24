/**
 * 当前文件负责：定义宠物通过领养审查进入世界前使用的类型。
 */

import type { PetGenderPerspective } from "@/types/pet"

export type PetAdoptionGenderSeedInput = {
  petName: string
  adoptionReviewInput: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
  }
  tick: number
  worldTime: {
    day: number
    hour: number
    period?: string
  }
}

export type PetAdoptionGenderResult = {
  genderPerspective: PetGenderPerspective
  seed: string
  score: number
  reason: string
}