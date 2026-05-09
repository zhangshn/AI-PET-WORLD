/**
 * 当前文件负责：根据管家记忆 / 关系状态生成照看与教育策略。
 *
 * education strategy 不直接控制宠物行为。
 * 它只调整管家提供机会的方式，让机会继续进入宠物自主判断链。
 */

import type {
  ButlerOpportunityType,
  ButlerRelationState,
} from "../../butler-gateway"

export type ButlerEducationStrategy = {
  foodIntensityOffset: number
  restIntensityOffset: number
  approachIntensityOffset: number
  posture: "observe_first" | "gentle_offer" | "steady_care" | "cautious_distance"
  reason: string
  tags: string[]
}

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(-18, Math.min(18, Math.round(value)))
}

function getLatestFeedbackType(
  relation: ButlerRelationState
): ButlerOpportunityType | null {
  return relation.latestOpportunityFeedback?.type ?? null
}

function getLatestFeedbackAccepted(
  relation: ButlerRelationState
): boolean | null {
  if (!relation.latestOpportunityFeedback) return null

  return relation.latestOpportunityFeedback.accepted
}

function buildPosture(
  relation: ButlerRelationState
): ButlerEducationStrategy["posture"] {
  if (relation.tone === "guarded") return "cautious_distance"

  if (relation.rejectedOffers >= relation.successfulOffers + 3) {
    return "observe_first"
  }

  if (relation.trustEstimate >= 55 && relation.successfulOffers >= 4) {
    return "steady_care"
  }

  return "gentle_offer"
}

function buildReason(input: {
  relation: ButlerRelationState
  posture: ButlerEducationStrategy["posture"]
  latestType: ButlerOpportunityType | null
  latestAccepted: boolean | null
}): string {
  if (input.posture === "cautious_distance") {
    return "宠物对管家的关系状态偏谨慎，管家需要降低靠近强度并优先保持边界。"
  }

  if (input.posture === "observe_first") {
    return "近期拒绝反馈较多，管家需要先观察，再提供更克制的机会。"
  }

  if (input.posture === "steady_care") {
    return "宠物对管家的接受经验较稳定，管家可以维持稳定照看方式。"
  }

  if (input.latestType && input.latestAccepted === false) {
    return `最近一次 ${input.latestType} 未被接受，管家需要调整下一次机会强度。`
  }

  return "管家以温和方式提供照看机会，等待宠物自主回应。"
}

export function buildButlerEducationStrategy(
  relation: ButlerRelationState
): ButlerEducationStrategy {
  const latestType = getLatestFeedbackType(relation)
  const latestAccepted = getLatestFeedbackAccepted(relation)
  const posture = buildPosture(relation)

  let foodIntensityOffset = 0
  let restIntensityOffset = 0
  let approachIntensityOffset = 0

  if (relation.trustEstimate >= 45) {
    foodIntensityOffset += 2
    restIntensityOffset += 2
  }

  if (relation.trustEstimate >= 60) {
    approachIntensityOffset += 2
  }

  if (relation.successfulOffers >= 4) {
    foodIntensityOffset += 2
    restIntensityOffset += 2
  }

  if (relation.rejectedOffers >= 3) {
    foodIntensityOffset -= 2
    restIntensityOffset -= 2
    approachIntensityOffset -= 4
  }

  if (relation.tone === "guarded") {
    approachIntensityOffset -= 8
  }

  if (latestType === "food_offer" && latestAccepted === false) {
    foodIntensityOffset -= 3
  }

  if (latestType === "rest_offer" && latestAccepted === false) {
    restIntensityOffset -= 3
  }

  if (latestType === "approach_offer" && latestAccepted === false) {
    approachIntensityOffset -= 6
  }

  if (latestType === "food_offer" && latestAccepted === true) {
    foodIntensityOffset += 2
  }

  if (latestType === "rest_offer" && latestAccepted === true) {
    restIntensityOffset += 2
  }

  if (latestType === "approach_offer" && latestAccepted === true) {
    approachIntensityOffset += 2
  }

  const tags = [
    `relation_tone_${relation.tone}`,
    `successful_offers_${relation.successfulOffers}`,
    `rejected_offers_${relation.rejectedOffers}`,
    `posture_${posture}`,
  ]

  if (latestType) {
    tags.push(`latest_${latestType}`)
  }

  if (latestAccepted !== null) {
    tags.push(latestAccepted ? "latest_accepted" : "latest_rejected")
  }

  return {
    foodIntensityOffset: clampOffset(foodIntensityOffset),
    restIntensityOffset: clampOffset(restIntensityOffset),
    approachIntensityOffset: clampOffset(approachIntensityOffset),
    posture,
    reason: buildReason({
      relation,
      posture,
      latestType,
      latestAccepted,
    }),
    tags,
  }
}