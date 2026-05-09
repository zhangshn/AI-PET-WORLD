/**
 * 当前文件负责：定义五行局对应的起运岁数。
 */

import type { ElementGate } from "../schema"

export const ELEMENT_GATE_START_AGE: Record<ElementGate, number> = {
  water_2: 2,
  wood_3: 3,
  metal_4: 4,
  earth_5: 5,
  fire_6: 6
}

export const ELEMENT_GATE_LABELS: Record<ElementGate, string> = {
  water_2: "水二局",
  wood_3: "木三局",
  metal_4: "金四局",
  earth_5: "土五局",
  fire_6: "火六局"
}

export function getElementGateStartAge(elementGate: ElementGate): number {
  return ELEMENT_GATE_START_AGE[elementGate]
}

export function getElementGateLabel(elementGate: ElementGate): string {
  return ELEMENT_GATE_LABELS[elementGate]
}