/**
 * 当前文件负责：定义宠物出生阶段使用的类型。
 */

import type { PetGenderPerspective } from "@/types/pet"

export type PetBirthGenderSeedInput = {
  petName: string
  birthInput: {
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

export type PetBirthGenderResult = {
  genderPerspective: PetGenderPerspective
  seed: string
  score: number
  reason: string
}