import type {
  BranchPalace,
  TimeBranch,
  ZiweiCycleDirection,
  ZiweiGender
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
  douJunPalace: BranchPalace
  currentLunarMonth: number
}): BranchPalace {
  const month = normalizeLunarMonth(params.currentLunarMonth)
  return moveBranch(params.douJunPalace, month - 1)
}

export function getDouJunPalace(params: {
  liuNianPalace: BranchPalace
  birthLunarMonth: number
  birthTimeBranch: TimeBranch
}): BranchPalace {
  const birthMonth = normalizeLunarMonth(params.birthLunarMonth)
  const monthBasePalace = moveBranch(params.liuNianPalace, -(birthMonth - 1))
  const birthTimeOffset = getTimeBranchOffset(params.birthTimeBranch)

  return moveBranch(monthBasePalace, birthTimeOffset)
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

const XIAO_XIAN_START_BY_BIRTH_YEAR_BRANCH: Record<BranchPalace, BranchPalace> = {
  zi: "xu",
  chou: "wei",
  yin: "chen",
  mao: "chou",
  chen: "xu",
  si: "wei",
  wu: "chen",
  wei: "chou",
  shen: "xu",
  you: "wei",
  xu: "chen",
  hai: "chou"
}

export function getXiaoXianDirection(gender: ZiweiGender): ZiweiCycleDirection {
  return gender === "male" ? "forward" : "backward"
}

export function getXiaoXianStartPalace(
  birthYearBranch: BranchPalace
): BranchPalace {
  return XIAO_XIAN_START_BY_BIRTH_YEAR_BRANCH[birthYearBranch]
}

export function getXiaoXianPalace(params: {
  birthYearBranch: BranchPalace
  gender: ZiweiGender
  currentAge: number
}): BranchPalace {
  const startPalace = getXiaoXianStartPalace(params.birthYearBranch)
  const direction = getXiaoXianDirection(params.gender)
  const ageSteps = Math.max(1, params.currentAge) - 1
  const finalSteps = direction === "forward" ? ageSteps : -ageSteps

  return moveBranch(startPalace, finalSteps)
}
