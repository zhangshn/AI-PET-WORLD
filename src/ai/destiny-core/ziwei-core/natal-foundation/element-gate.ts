import type {
  BranchPalace,
  ElementBase,
  ElementGate,
  HeavenlyStem
} from "../contracts"

import { buildPalaceStemMap } from "./palace-stems"

const NAYIN_ELEMENT_GATE_MAP: Record<string, ElementGate> = {
  "jia-zi": "metal_4",
  "yi-chou": "metal_4",
  "bing-yin": "fire_6",
  "ding-mao": "fire_6",
  "wu-chen": "wood_3",
  "ji-si": "wood_3",
  "geng-wu": "earth_5",
  "xin-wei": "earth_5",
  "ren-shen": "metal_4",
  "gui-you": "metal_4",
  "jia-xu": "fire_6",
  "yi-hai": "fire_6",
  "bing-zi": "water_2",
  "ding-chou": "water_2",
  "wu-yin": "earth_5",
  "ji-mao": "earth_5",
  "geng-chen": "metal_4",
  "xin-si": "metal_4",
  "ren-wu": "wood_3",
  "gui-wei": "wood_3",
  "jia-shen": "water_2",
  "yi-you": "water_2",
  "bing-xu": "earth_5",
  "ding-hai": "earth_5",
  "wu-zi": "fire_6",
  "ji-chou": "fire_6",
  "geng-yin": "wood_3",
  "xin-mao": "wood_3",
  "ren-chen": "water_2",
  "gui-si": "water_2",
  "jia-wu": "metal_4",
  "yi-wei": "metal_4",
  "bing-shen": "fire_6",
  "ding-you": "fire_6",
  "wu-xu": "wood_3",
  "ji-hai": "wood_3",
  "geng-zi": "earth_5",
  "xin-chou": "earth_5",
  "ren-yin": "metal_4",
  "gui-mao": "metal_4",
  "jia-chen": "fire_6",
  "yi-si": "fire_6",
  "bing-wu": "water_2",
  "ding-wei": "water_2",
  "wu-shen": "earth_5",
  "ji-you": "earth_5",
  "geng-xu": "metal_4",
  "xin-hai": "metal_4",
  "ren-zi": "wood_3",
  "gui-chou": "wood_3",
  "jia-yin": "water_2",
  "yi-mao": "water_2",
  "bing-chen": "earth_5",
  "ding-si": "earth_5",
  "wu-wu": "fire_6",
  "ji-wei": "fire_6",
  "geng-shen": "wood_3",
  "xin-you": "wood_3",
  "ren-xu": "water_2",
  "gui-hai": "water_2"
}

const ELEMENT_BASE_MAP: Record<ElementGate, ElementBase> = {
  water_2: 2,
  wood_3: 3,
  metal_4: 4,
  earth_5: 5,
  fire_6: 6
}

export function calculateElementGate(
  yearStem: HeavenlyStem,
  lifePalace: BranchPalace
): {
  elementGate: ElementGate
  elementBase: ElementBase
  palaceStem: HeavenlyStem
} {
  const palaceStemMap = buildPalaceStemMap(yearStem)
  const palaceStem = palaceStemMap[lifePalace]
  const key = `${palaceStem}-${lifePalace}`
  const elementGate = NAYIN_ELEMENT_GATE_MAP[key]

  if (!elementGate) {
    throw new Error(`Unable to calculate element gate: ${key}`)
  }

  return {
    elementGate,
    elementBase: ELEMENT_BASE_MAP[elementGate],
    palaceStem
  }
}
