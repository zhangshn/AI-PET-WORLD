import type { TimeBranch } from "../contracts"

import { TIME_BRANCH_ORDER } from "../shared"

export function getTimeBranchFromHour(hour: number): TimeBranch {
  if (hour === 23 || hour === 0) return "zi"
  if (hour === 1 || hour === 2) return "chou"
  if (hour === 3 || hour === 4) return "yin"
  if (hour === 5 || hour === 6) return "mao"
  if (hour === 7 || hour === 8) return "chen"
  if (hour === 9 || hour === 10) return "si"
  if (hour === 11 || hour === 12) return "wu"
  if (hour === 13 || hour === 14) return "wei"
  if (hour === 15 || hour === 16) return "shen"
  if (hour === 17 || hour === 18) return "you"
  if (hour === 19 || hour === 20) return "xu"
  return "hai"
}

export function getTimeBranchIndex(branch: TimeBranch): number {
  const index = TIME_BRANCH_ORDER.indexOf(branch)

  if (index < 0) {
    throw new Error(`Unknown time branch: ${branch}`)
  }

  return index + 1
}

export function getTimeBranchNumber(branch: TimeBranch): number {
  return getTimeBranchIndex(branch)
}

export function getFormulaTimeIndex(branch: TimeBranch): number {
  const indexMap: Record<TimeBranch, number> = {
    yin: 0,
    mao: 1,
    chen: 2,
    si: 3,
    wu: 4,
    wei: 5,
    shen: 6,
    you: 7,
    xu: 8,
    hai: 9,
    zi: 10,
    chou: 11
  }

  return indexMap[branch]
}
