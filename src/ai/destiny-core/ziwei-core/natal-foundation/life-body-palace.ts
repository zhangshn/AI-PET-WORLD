import type { BranchPalace } from "../contracts"

import { getBranchByIndex, mod12 } from "../shared"

export function calculateLifeAndBodyPalace(
  lunarMonth: number,
  timeBranchNumber: number
): {
  lifePalace: BranchPalace
  bodyPalace: BranchPalace
  lifeIndex: number
  bodyIndex: number
} {
  const monthIndex = lunarMonth - 1
  const hourIndex = timeBranchNumber - 1

  const lifeIndex = mod12(monthIndex - hourIndex)
  const bodyIndex = mod12(monthIndex + hourIndex)

  return {
    lifePalace: getBranchByIndex(lifeIndex),
    bodyPalace: getBranchByIndex(bodyIndex),
    lifeIndex,
    bodyIndex
  }
}
