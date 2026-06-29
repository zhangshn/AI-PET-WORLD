import type { BranchPalace } from "../contracts"

export const PHYSICAL_BRANCH_ORDER = [
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
  "zi",
  "chou"
] as const satisfies readonly BranchPalace[]

export const TIME_BRANCH_ORDER = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai"
] as const satisfies readonly BranchPalace[]
