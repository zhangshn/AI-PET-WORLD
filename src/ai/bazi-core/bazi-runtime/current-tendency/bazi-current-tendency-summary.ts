/**
 * 当前文件负责：生成八字当前流动气质与行动趋向的中文摘要。
 */

import type {
  BaziCurrentEnergyTone
} from "./bazi-current-tendency-schema"

import type {
  WuXingElement
} from "../../bazi-schema"

const ELEMENT_LABELS: Record<WuXingElement, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水"
}

const ENERGY_TONE_LABELS: Record<BaziCurrentEnergyTone, string> = {
  active: "行动外放",
  warm: "情绪升温",
  stable: "稳定承托",
  sharp: "边界清晰",
  deep: "感知加深",
  balanced: "五行均衡"
}

export function getBaziElementLabel(element: WuXingElement): string {
  return ELEMENT_LABELS[element]
}

export function getBaziEnergyToneLabel(
  tone: BaziCurrentEnergyTone
): string {
  return ENERGY_TONE_LABELS[tone]
}

export function buildBaziCurrentTendencySummary(params: {
  energyTone: BaziCurrentEnergyTone
  dominantElements: WuXingElement[]
  hasHour: boolean
}): string {
  const toneLabel = getBaziEnergyToneLabel(params.energyTone)

  const elementText = params.dominantElements
    .map(getBaziElementLabel)
    .join(" / ")

  const precisionText = params.hasHour
    ? "当前使用四柱原局，并叠加动态时间场。"
    : "当前使用三柱原局，流时只作为环境场辅助，不作为原局时柱。"

  return [
    `当前八字流动气质偏向「${toneLabel}」。`,
    `动态五行主导为：${elementText || "暂不明显"}。`,
    precisionText
  ].join("")
}