import type {
  BranchPalace,
  ElementGate,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { LIFECYCLE_STAR_IDS } from "../../star-catalog"
import {
  getDirectionStep,
  resolveZiweiPlacementDirection
} from "../cycle-direction"

import { createLifecyclePlacedStar } from "./lifecycle-placement-utils"

const CHANGSHENG_START_BY_ELEMENT_GATE: Record<ElementGate, BranchPalace> = {
  water_2: "shen",
  wood_3: "hai",
  metal_4: "si",
  earth_5: "shen",
  fire_6: "yin"
}

const CHANGSHENG_SEQUENCE = [
  LIFECYCLE_STAR_IDS.changsheng,
  LIFECYCLE_STAR_IDS.muyu,
  LIFECYCLE_STAR_IDS.guandai,
  LIFECYCLE_STAR_IDS.linguan,
  LIFECYCLE_STAR_IDS.diwang,
  LIFECYCLE_STAR_IDS.shuai,
  LIFECYCLE_STAR_IDS.bing,
  LIFECYCLE_STAR_IDS.si,
  LIFECYCLE_STAR_IDS.mu,
  LIFECYCLE_STAR_IDS.jue,
  LIFECYCLE_STAR_IDS.tai,
  LIFECYCLE_STAR_IDS.yang
]

export function placeChangshengCycleStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const direction = resolveZiweiPlacementDirection({
    yearStem: context.lunarInfo.yearStem,
    gender: context.input.gender
  })
  const step = getDirectionStep(direction)
  const startBranch =
    CHANGSHENG_START_BY_ELEMENT_GATE[context.foundation.elementGate]

  return CHANGSHENG_SEQUENCE.map((starId, index) => {
    return createLifecyclePlacedStar({
      context,
      starId,
      branch: moveBranch(startBranch, index * step),
      placementRuleId: "lifecycle.changsheng.element-gate-direction",
      debug: {
        elementGate: context.foundation.elementGate,
        startBranch,
        direction,
        sequenceIndex: index
      }
    })
  })
}
