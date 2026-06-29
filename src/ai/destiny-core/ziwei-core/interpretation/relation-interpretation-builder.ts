import type {
  BranchPalace,
  FullZiweiPalace,
  ZiweiInterpretationItem,
  ZiweiPlacedStar,
  ZiweiStarCategory
} from "../contracts"
import { BRANCH_LABELS, SECTOR_LABELS } from "../page-view/labels"

const RELATION_CATEGORIES = [
  "main",
  "assistant",
  "malefic",
  "transformation"
] as const satisfies readonly Exclude<ZiweiStarCategory, "empty">[]

export function buildRelationInterpretationItem(params: {
  palace: FullZiweiPalace
  palaces: FullZiweiPalace[]
}): ZiweiInterpretationItem {
  const relatedPalaces = findRelatedPalaces(params.palace, params.palaces)
  const relatedStars = relatedPalaces.flatMap((palace) => {
    return RELATION_CATEGORIES.flatMap((category) => palace.stars[category])
  })
  const relationLabels = relatedPalaces.map((palace) => {
    return `${SECTOR_LABELS[palace.sectorName]}${BRANCH_LABELS[palace.branch]}`
  })
  const mainStarLabels = relatedPalaces.flatMap((palace) => {
    return palace.stars.main.map((star) => star.label)
  })
  const transformationLabels = relatedPalaces.flatMap((palace) => {
    return palace.stars.transformation.map(formatTransformationLabel)
  })

  return {
    itemId: `${params.palace.branch}-relation-trine-opposite`,
    scope: "relation",
    title: `${SECTOR_LABELS[params.palace.sectorName]}三方四正`,
    summary: buildRelationSummary({
      relationLabels,
      mainStarLabels,
      transformationLabels,
      relatedStars
    }),
    tags: buildRelationTags(relatedStars),
    sourceRuleIds: Array.from(
      new Set(relatedStars.map((star) => star.placementRuleId))
    ),
    palaceBranch: params.palace.branch,
    sectorName: params.palace.sectorName
  }
}

function findRelatedPalaces(
  palace: FullZiweiPalace,
  palaces: FullZiweiPalace[]
): FullZiweiPalace[] {
  const branches: BranchPalace[] = [
    palace.branch,
    palace.oppositeBranch,
    ...palace.trineBranches
  ]

  return branches.map((branch) => {
    const relatedPalace = palaces.find((item) => item.branch === branch)

    if (!relatedPalace) {
      throw new Error(`Missing related palace for branch: ${branch}`)
    }

    return relatedPalace
  })
}

function formatTransformationLabel(star: ZiweiPlacedStar): string {
  const targetLabel =
    typeof star.debug?.targetStarLabel === "string"
      ? star.debug.targetStarLabel
      : "目标星"

  return `${star.label}作用${targetLabel}`
}

function buildRelationSummary(params: {
  relationLabels: string[]
  mainStarLabels: string[]
  transformationLabels: string[]
  relatedStars: ZiweiPlacedStar[]
}): string {
  const mainText =
    params.mainStarLabels.length > 0
      ? `主星：${params.mainStarLabels.join("、")}`
      : "主星：暂无"
  const transformationText =
    params.transformationLabels.length > 0
      ? `四化：${params.transformationLabels.join("、")}`
      : "四化：暂无"

  return `三方四正范围包含 ${params.relationLabels.join("、")}。当前先汇总 ${mainText}；${transformationText}；相关主星、辅曜、煞曜、四化共 ${params.relatedStars.length} 项，后续可在此基础上校准结构断语。`
}

function buildRelationTags(stars: ZiweiPlacedStar[]): string[] {
  const tags = stars.flatMap((star) => {
    if (star.category === "main") {
      return ["主星结构", star.label]
    }

    if (star.category === "assistant") {
      return ["助力结构"]
    }

    if (star.category === "malefic") {
      return ["压力结构"]
    }

    if (star.category === "transformation") {
      return ["四化结构"]
    }

    return []
  })

  return Array.from(new Set(["三方四正", ...tags]))
}
