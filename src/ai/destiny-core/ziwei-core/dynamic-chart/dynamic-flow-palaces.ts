import type {
  BranchPalace,
  TimeBranch,
  ZiweiCycleDirection
} from "../contracts"
import { getYearBranch } from "../birth"
import { moveBranch } from "../shared"

import {
  getTimeBranchOffset,
  normalizeLunarDay,
  normalizeLunarMonth
} from "./dynamic-normalizers"

export function getDynamicStartAge(elementBase: number): number {
  return elementBase
}

export function getDaYunPalace(params: {
  lifePalace: BranchPalace
  direction: ZiweiCycleDirection
  startAge: number
  currentAge: number
}): BranchPalace {
  if (params.currentAge < params.startAge) {
    return params.lifePalace
  }

  const movedSteps = Math.floor(
    (params.currentAge - params.startAge) / 10
  )
  const finalSteps =
    params.direction === "forward"
      ? movedSteps
      : -movedSteps

  return moveBranch(params.lifePalace, finalSteps)
}

export function getLiuNianPalace(currentYear: number): BranchPalace {
  return getYearBranch(currentYear)
}

export function getLiuYuePalace(params: {
  liuNianPalace: BranchPalace
  currentLunarMonth: number
}): BranchPalace {
  const month = normalizeLunarMonth(params.currentLunarMonth)
  return moveBranch(params.liuNianPalace, month - 1)
}

export function getLiuRiPalace(params: {
  liuYuePalace: BranchPalace
  currentLunarDay: number
}): BranchPalace {
  const day = normalizeLunarDay(params.currentLunarDay)
  return moveBranch(params.liuYuePalace, day - 1)
}

export function getLiuShiPalace(params: {
  liuRiPalace: BranchPalace
  currentTimeBranch: TimeBranch
}): BranchPalace {
  const offset = getTimeBranchOffset(params.currentTimeBranch)
  return moveBranch(params.liuRiPalace, offset)
}
