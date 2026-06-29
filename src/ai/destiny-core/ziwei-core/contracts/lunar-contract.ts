import type { BranchPalace, TimeBranch } from "./branch-contract"
import type { HeavenlyStem } from "./stem-contract"

export interface LunarBirthInfo {
  solarYear: number
  solarMonth: number
  solarDay: number
  solarHour: number
  solarMinute: number

  lunarYear: number
  lunarMonth: number
  lunarDay: number
  lunarIsLeapMonth?: boolean

  yearStem: HeavenlyStem
  yearBranch?: BranchPalace
  monthStem?: HeavenlyStem
  monthBranch?: BranchPalace
  dayStem?: HeavenlyStem
  dayBranch?: BranchPalace
  timeStem?: HeavenlyStem
  timeBranch: TimeBranch

  timeBranchIndex: number
  timeBranchNumber: number
  formulaTimeIndex: number
}
