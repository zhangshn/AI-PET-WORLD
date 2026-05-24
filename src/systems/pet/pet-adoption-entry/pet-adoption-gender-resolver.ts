/**
 * 当前文件负责：为通过领养审查进入世界的宠物生成稳定的性别视角。
 */

import type {
  PetAdoptionGenderResult,
  PetAdoptionGenderSeedInput,
} from "./pet-adoption-entry-types"

function buildSeed(input: PetAdoptionGenderSeedInput): string {
  return [
    input.petName,
    input.adoptionReviewInput.year,
    input.adoptionReviewInput.month,
    input.adoptionReviewInput.day,
    input.adoptionReviewInput.hour,
    input.adoptionReviewInput.minute,
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

export function resolvePetAdoptionGender(
  input: PetAdoptionGenderSeedInput
): PetAdoptionGenderResult {
  const seed = buildSeed(input)
  const score = hashSeed(seed) % 100

  const genderPerspective = score < 50 ? "male" : "female"

  return {
    genderPerspective,
    seed,
    score,
    reason:
      "Pet adoption gender perspective is derived from observation name, adoption review input, world tick, and world time; the same adoption input produces the same result.",
  }
}