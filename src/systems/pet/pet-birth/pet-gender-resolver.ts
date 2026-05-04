/**
 * 当前文件负责：为正式出生的宠物生成稳定的性别视角。
 */

import type {
  PetBirthGenderResult,
  PetBirthGenderSeedInput,
} from "./pet-birth-types"

function buildSeed(input: PetBirthGenderSeedInput): string {
  return [
    input.petName,
    input.birthInput.year,
    input.birthInput.month,
    input.birthInput.day,
    input.birthInput.hour,
    input.birthInput.minute,
    input.tick,
    input.worldTime.day,
    input.worldTime.hour,
    input.worldTime.period ?? "unknown_period",
  ].join("|")
}

function hashSeed(seed: string): number {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return hash
}

export function resolvePetBirthGender(
  input: PetBirthGenderSeedInput
): PetBirthGenderResult {
  const seed = buildSeed(input)
  const score = hashSeed(seed) % 100

  const genderPerspective = score < 50 ? "male" : "female"

  return {
    genderPerspective,
    seed,
    score,
    reason:
      "宠物出生性别视角由宠物名、真实出生时间、世界 Tick 与世界时间共同生成；同一出生输入会得到稳定结果。",
  }
}