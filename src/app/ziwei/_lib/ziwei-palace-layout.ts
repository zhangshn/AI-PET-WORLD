import type { BranchPalace } from "@/ai/destiny-core/ziwei-core/contracts"

export const ZIWEI_PHYSICAL_BRANCH_ORDER = [
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

export const ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS = [
  "si wu wei shen",
  "chen center center you",
  "mao center center xu",
  "yin chou zi hai"
] as const

export const ZIWEI_MOBILE_GRID_TEMPLATE_ROWS = [
  "center",
  "si",
  "wu",
  "wei",
  "shen",
  "chen",
  "you",
  "mao",
  "xu",
  "yin",
  "chou",
  "zi",
  "hai"
] as const

export const ZIWEI_PALACE_GRID_AREA_BY_BRANCH: Record<BranchPalace, string> = {
  si: "si",
  wu: "wu",
  wei: "wei",
  shen: "shen",
  chen: "chen",
  you: "you",
  mao: "mao",
  xu: "xu",
  yin: "yin",
  chou: "chou",
  zi: "zi",
  hai: "hai"
}

export function getZiweiPalaceGridArea(branch: BranchPalace): string {
  return ZIWEI_PALACE_GRID_AREA_BY_BRANCH[branch]
}

export function moveZiweiPhysicalBranch(
  branch: BranchPalace,
  offset: number
): BranchPalace {
  const index = ZIWEI_PHYSICAL_BRANCH_ORDER.indexOf(branch)
  const nextIndex = ((index + offset) % 12 + 12) % 12

  return ZIWEI_PHYSICAL_BRANCH_ORDER[nextIndex]
}
