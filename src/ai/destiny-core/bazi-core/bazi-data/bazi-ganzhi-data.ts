/**
 * 当前文件负责：定义八字干支、六十甲子、五行、阴阳与建柱工具。
 */

import type {
  BaziPillar,
  EarthlyBranch,
  HeavenlyStem,
  WuXingElement,
  YinYang,
} from "../bazi-schema"

import { safeModulo } from "../bazi-utils"
import { BAZI_HIDDEN_STEMS } from "./bazi-hidden-stems-data"

export const BAZI_HEAVENLY_STEMS: HeavenlyStem[] = [
  "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸",
]

export const BAZI_EARTHLY_BRANCHES: EarthlyBranch[] = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
]

export const BAZI_SIXTY_JIAZI = [
  "甲子", "乙丑", "丙寅", "丁卯", "戊辰", "己巳", "庚午", "辛未", "壬申", "癸酉",
  "甲戌", "乙亥", "丙子", "丁丑", "戊寅", "己卯", "庚辰", "辛巳", "壬午", "癸未",
  "甲申", "乙酉", "丙戌", "丁亥", "戊子", "己丑", "庚寅", "辛卯", "壬辰", "癸巳",
  "甲午", "乙未", "丙申", "丁酉", "戊戌", "己亥", "庚子", "辛丑", "壬寅", "癸卯",
  "甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子", "癸丑",
  "甲寅", "乙卯", "丙辰", "丁巳", "戊午", "己未", "庚申", "辛酉", "壬戌", "癸亥",
] as const

export const BAZI_STEM_ELEMENT_MAP: Record<HeavenlyStem, WuXingElement> = {
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

export const BAZI_BRANCH_ELEMENT_MAP: Record<EarthlyBranch, WuXingElement> = {
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

export const BAZI_STEM_YIN_YANG_MAP: Record<HeavenlyStem, YinYang> = {
  甲: "yang",
  乙: "yin",
  丙: "yang",
  丁: "yin",
  戊: "yang",
  己: "yin",
  庚: "yang",
  辛: "yin",
  壬: "yang",
  癸: "yin",
}

export const BAZI_BRANCH_YIN_YANG_MAP: Record<EarthlyBranch, YinYang> = {
  子: "yang",
  丑: "yin",
  寅: "yang",
  卯: "yin",
  辰: "yang",
  巳: "yin",
  午: "yang",
  未: "yin",
  申: "yang",
  酉: "yin",
  戌: "yang",
  亥: "yin",
}

function normalizeJiaZiIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0
  }

  return safeModulo(Math.trunc(index), 60)
}

export function buildBaziPillarByIndex(index: number): BaziPillar {
  const safeIndex = normalizeJiaZiIndex(index)
  const label = BAZI_SIXTY_JIAZI[safeIndex] ?? BAZI_SIXTY_JIAZI[0]
  const stem = label[0] as HeavenlyStem
  const branch = label[1] as EarthlyBranch

  return buildBaziPillarByStemBranch({
    stem,
    branch,
  })
}

export function buildBaziPillarByStemBranch(input: {
  stem: HeavenlyStem
  branch: EarthlyBranch
}): BaziPillar {
  return {
    stem: input.stem,
    branch: input.branch,
    label: `${input.stem}${input.branch}`,
    stemElement: BAZI_STEM_ELEMENT_MAP[input.stem],
    branchElement: BAZI_BRANCH_ELEMENT_MAP[input.branch],
    hiddenStems: BAZI_HIDDEN_STEMS[input.branch] ?? [],
    yinYang: BAZI_STEM_YIN_YANG_MAP[input.stem],
  }
}
