/**
 * 当前文件负责：定义天干阴阳属性。
 */

import type { HeavenlyStem } from "../schema"

export type HeavenlyStemPolarity = "yang" | "yin"

export const YANG_HEAVENLY_STEMS: HeavenlyStem[] = [
  "jia",
  "bing",
  "wu",
  "geng",
  "ren"
]

export const YIN_HEAVENLY_STEMS: HeavenlyStem[] = [
  "yi",
  "ding",
  "ji",
  "xin",
  "gui"
]

export const HEAVENLY_STEM_LABELS: Record<HeavenlyStem, string> = {
  jia: "甲",
  yi: "乙",
  bing: "丙",
  ding: "丁",
  wu: "戊",
  ji: "己",
  geng: "庚",
  xin: "辛",
  ren: "壬",
  gui: "癸"
}

export function getHeavenlyStemPolarity(
  stem: HeavenlyStem
): HeavenlyStemPolarity {
  if (YANG_HEAVENLY_STEMS.includes(stem)) {
    return "yang"
  }

  return "yin"
}

export function getHeavenlyStemLabel(stem: HeavenlyStem): string {
  return HEAVENLY_STEM_LABELS[stem]
}