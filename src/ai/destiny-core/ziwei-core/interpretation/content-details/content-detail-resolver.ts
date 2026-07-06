import type { ZiweiStarId } from "../../contracts"

import type {
  ZiweiPatternContentDetail,
  ZiweiPatternContentDetailInput,
  ZiweiStarContentDetail
} from "./content-detail-types"
import { getAssistantStarContentDetail } from "./assistant-star-meaning-catalog"
import { getMainStarContentDetail } from "./main-star-meaning-catalog"
import { getMaleficStarContentDetail } from "./malefic-star-meaning-catalog"
import { getMiscStarContentDetail } from "./misc-star-meaning-catalog"
import { getPatternContentDetail } from "./pattern-meaning-catalog"
import { getPeriodicStarContentDetail } from "./periodic-star-meaning-catalog"
import { getTransformationContentDetail } from "./transformation-meaning-catalog"

export type ZiweiResolvedContentDetail =
  | {
      kind: "star"
      detail: ZiweiStarContentDetail
    }
  | {
      kind: "pattern"
      detail: ZiweiPatternContentDetail
    }

export type ZiweiContentDetailRequest =
  | {
      kind: "star"
      starId: ZiweiStarId
    }
  | {
      kind: "pattern"
      pattern: ZiweiPatternContentDetailInput
    }

const STAR_DETAIL_GETTERS = [
  getMainStarContentDetail,
  getAssistantStarContentDetail,
  getMaleficStarContentDetail,
  getMiscStarContentDetail,
  getTransformationContentDetail,
  getPeriodicStarContentDetail
]

export function getStarContentDetail(
  starId: ZiweiStarId
): ZiweiStarContentDetail | null {
  for (const getter of STAR_DETAIL_GETTERS) {
    const detail = getter(starId)

    if (detail) {
      return detail
    }
  }

  return null
}

export function resolveZiweiContentDetail(
  request: ZiweiContentDetailRequest
): ZiweiResolvedContentDetail | null {
  if (request.kind === "pattern") {
    return {
      kind: "pattern",
      detail: getPatternContentDetail(request.pattern)
    }
  }

  const detail = getStarContentDetail(request.starId)

  if (!detail) {
    return null
  }

  return {
    kind: "star",
    detail
  }
}
