/**
 * 当前文件负责：定义天干、地支、六十甲子与五行映射。
 */

import type {
  BaziPillar,
  EarthlyBranch,
  HeavenlyStem,
  WuXingElement,
} from "./bazi-types"

export const HEAVENLY_STEMS: HeavenlyStem[] = [
  "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸",
]

export const EARTHLY_BRANCHES: EarthlyBranch[] = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
]

export const SIXTY_JIAZI = [
  "甲子", "乙丑", "丙寅", "丁卯", "戊辰", "己巳", "庚午", "辛未", "壬申", "癸酉",
  "甲戌", "乙亥", "丙子", "丁丑", "戊寅", "己卯", "庚辰", "辛巳", "壬午", "癸未",
  "甲申", "乙酉", "丙戌", "丁亥", "戊子", "己丑", "庚寅", "辛卯", "壬辰", "癸巳",
  "甲午", "乙未", "丙申", "丁酉", "戊戌", "己亥", "庚子", "辛丑", "壬寅", "癸卯",
  "甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子", "癸丑",
  "甲寅", "乙卯", "丙辰", "丁巳", "戊午", "己未", "庚申", "辛酉", "壬戌", "癸亥",
] as const

export const STEM_ELEMENT_MAP: Record<HeavenlyStem, WuXingElement> = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
}

export const BRANCH_ELEMENT_MAP: Record<EarthlyBranch, WuXingElement> = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
}

export function normalizeCycleIndex(index: number, cycleLength: number): number {
  return ((index % cycleLength) + cycleLength) % cycleLength
}

export function buildPillarByIndex(index: number): BaziPillar {
  const safeIndex = normalizeCycleIndex(index, 60)
  const label = SIXTY_JIAZI[safeIndex]
  const stem = label[0] as HeavenlyStem
  const branch = label[1] as EarthlyBranch

  return {
    stem,
    branch,
    label,
    stemElement: STEM_ELEMENT_MAP[stem],
    branchElement: BRANCH_ELEMENT_MAP[branch],
  }
}

export function buildPillarByStemBranch(input: {
  stem: HeavenlyStem
  branch: EarthlyBranch
}): BaziPillar {
  return {
    stem: input.stem,
    branch: input.branch,
    label: `${input.stem}${input.branch}`,
    stemElement: STEM_ELEMENT_MAP[input.stem],
    branchElement: BRANCH_ELEMENT_MAP[input.branch],
  }
}