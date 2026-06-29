import type { TimeBranch } from "../contracts"
import { TIME_BRANCH_ORDER } from "../shared"

export function normalizeLunarMonth(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  const month = Math.trunc(value)

  if (month < 1) {
    return 1
  }

  if (month > 12) {
    return 12
  }

  return month
}

export function normalizeLunarDay(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  const day = Math.trunc(value)

  if (day < 1) {
    return 1
  }

  if (day > 30) {
    return 30
  }

  return day
}

export function getTimeBranchOffset(timeBranch: TimeBranch): number {
  const index = TIME_BRANCH_ORDER.indexOf(timeBranch)

  if (index < 0) {
    return 0
  }

  return index
}
