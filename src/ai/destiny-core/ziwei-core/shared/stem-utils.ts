import type { HeavenlyStem } from "../contracts"

import { mod10 } from "./mod-utils"

export const HEAVENLY_STEM_ORDER = [
  "jia",
  "yi",
  "bing",
  "ding",
  "wu",
  "ji",
  "geng",
  "xin",
  "ren",
  "gui"
] as const satisfies readonly HeavenlyStem[]

export function getStemIndex(stem: HeavenlyStem): number {
  const index = HEAVENLY_STEM_ORDER.indexOf(stem)

  if (index < 0) {
    throw new Error(`Unknown heavenly stem: ${stem}`)
  }

  return index
}

export function getStemByIndex(index: number): HeavenlyStem {
  return HEAVENLY_STEM_ORDER[mod10(index)]
}
