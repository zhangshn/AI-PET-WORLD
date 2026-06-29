import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { getZiweiStarDefinition } from "../../star-catalog"

import {
  NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM,
  type TransformationRule
} from "./transformation-rules"

export function placeNatalTransformations(params: {
  context: ZiweiPlacementContext
  placedStars: ZiweiPlacedStar[]
}): ZiweiPlacedStar[] {
  const rules =
    NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM[
      params.context.lunarInfo.yearStem
    ]

  return rules.map((rule) => {
    return createTransformationPlacedStar({
      context: params.context,
      placedStars: params.placedStars,
      rule
    })
  })
}

function createTransformationPlacedStar(params: {
  context: ZiweiPlacementContext
  placedStars: ZiweiPlacedStar[]
  rule: TransformationRule
}): ZiweiPlacedStar {
  const transformationDefinition = getZiweiStarDefinition(
    params.rule.transformationStarId
  )
  const targetStar = params.placedStars.find((star) => {
    return star.starId === params.rule.targetStarId
  })

  if (!transformationDefinition) {
    throw new Error(
      `Unknown transformation star id: ${params.rule.transformationStarId}`
    )
  }

  if (!targetStar) {
    throw new Error(
      `Missing transformation target star: ${params.rule.targetStarId}`
    )
  }

  return {
    starId: transformationDefinition.starId,
    label: transformationDefinition.label,
    category: transformationDefinition.category,
    branch: targetStar.branch,
    sectorName: targetStar.sectorName,
    source: "natal",
    placementRuleId: "transformation.natal.year-stem",
    targetStarId: targetStar.starId,
    debug: {
      yearStem: params.context.lunarInfo.yearStem,
      targetStarId: targetStar.starId,
      targetStarLabel: targetStar.label
    }
  }
}
