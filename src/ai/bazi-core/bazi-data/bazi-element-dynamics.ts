/**
 * 当前文件负责：定义五行到 AI 动力含义的映射说明。
 */

import type { WuXingElement } from "../bazi-schema"

export type BaziElementDynamicMeaning = {
  label: string
  meaning: string
  behaviorKeywords: string[]
}

export const BAZI_ELEMENT_DYNAMICS: Record<
  WuXingElement,
  BaziElementDynamicMeaning
> = {
  wood: {
    label: "木",
    meaning: "生长、探索、恢复、扩张、好奇。",
    behaviorKeywords: ["探索", "成长", "恢复", "伸展"],
  },
  fire: {
    label: "火",
    meaning: "表达、兴奋、外显、反应速度、情绪热度。",
    behaviorKeywords: ["兴奋", "表达", "快速反应", "外显"],
  },
  earth: {
    label: "土",
    meaning: "稳定、依附、秩序、耐受、恢复节奏。",
    behaviorKeywords: ["稳定", "依附", "秩序", "耐受"],
  },
  metal: {
    label: "金",
    meaning: "边界、判断、规则、警觉、收敛。",
    behaviorKeywords: ["边界", "警觉", "规则", "判断"],
  },
  water: {
    label: "水",
    meaning: "感知、记忆、观察、适应、深层情绪。",
    behaviorKeywords: ["观察", "记忆", "感知", "适应"],
  },
}