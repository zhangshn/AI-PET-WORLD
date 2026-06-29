import type {
  HeavenlyStem,
  ZiweiCycleDirection,
  ZiweiGender
} from "../contracts"

const YANG_STEMS: HeavenlyStem[] = ["jia", "bing", "wu", "geng", "ren"]

export function resolveZiweiPlacementDirection(params: {
  yearStem: HeavenlyStem
  gender?: ZiweiGender
}): ZiweiCycleDirection {
  if (!params.gender) {
    throw new Error("Missing gender for direction-based Ziwei placement.")
  }

  const isYangStem = YANG_STEMS.includes(params.yearStem)
  const isForward =
    (isYangStem && params.gender === "male") ||
    (!isYangStem && params.gender === "female")

  return isForward ? "forward" : "backward"
}

export function getDirectionStep(direction: ZiweiCycleDirection): 1 | -1 {
  return direction === "forward" ? 1 : -1
}
