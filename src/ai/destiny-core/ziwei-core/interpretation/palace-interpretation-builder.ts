import type {
  FullZiweiPalace,
  ZiweiInterpretationItem,
  ZiweiPalaceInterpretation,
  ZiweiPlacedStar,
  ZiweiStarCategory
} from "../contracts"
import {
  BRANCH_LABELS,
  SECTOR_LABELS,
  STAR_CATEGORY_LABELS
} from "../page-view/labels"
import { getZiweiStarDefinition } from "../star-catalog"

import { getStarCategoryInterpretationProfile } from "./star-keywords"
import { buildRelationInterpretationItem } from "./relation-interpretation-builder"
import { buildStarPalaceCombinationItem } from "./star-palace-combination-builder"
import { getZiweiStarInterpretationProfile } from "./star-profile-catalog"
import { buildTransformationInterpretationItem } from "./transformation-interpretation-builder"

const INTERPRETED_CATEGORIES = [
  "main",
  "assistant",
  "malefic",
  "transformation",
  "misc",
  "lifecycle",
  "yearly",
  "monthly",
  "dailyHourly"
] as const satisfies readonly Exclude<ZiweiStarCategory, "empty">[]

export function buildPalaceInterpretation(params: {
  palace: FullZiweiPalace
  palaces: FullZiweiPalace[]
}): ZiweiPalaceInterpretation {
  const items = [
    buildRelationInterpretationItem(params),
    ...buildPalaceItems(params.palace)
  ]

  return {
    branch: params.palace.branch,
    sectorName: params.palace.sectorName,
    branchLabel: BRANCH_LABELS[params.palace.branch],
    sectorLabel: SECTOR_LABELS[params.palace.sectorName],
    items
  }
}

function buildPalaceItems(palace: FullZiweiPalace): ZiweiInterpretationItem[] {
  return INTERPRETED_CATEGORIES.flatMap((category) => {
    const stars = palace.stars[category]

    if (stars.length === 0) {
      return []
    }

    return [
      buildCategoryItem(palace, category, stars),
      ...stars.flatMap((star) => {
        return [
          buildStarItem(palace, star),
          buildStarPalaceCombinationItem(palace, star),
          ...(star.category === "transformation"
            ? [buildTransformationInterpretationItem(palace, star)]
            : [])
        ]
      })
    ]
  })
}

function buildStarItem(
  palace: FullZiweiPalace,
  star: ZiweiPlacedStar
): ZiweiInterpretationItem {
  const profile = getZiweiStarInterpretationProfile(star.starId)
  const categoryLabel = STAR_CATEGORY_LABELS[star.category]
  const targetDefinition = star.targetStarId
    ? getZiweiStarDefinition(star.targetStarId)
    : null
  const targetText = targetDefinition ? `，作用星曜：${targetDefinition.label}` : ""

  return {
    itemId: `${palace.branch}-${star.starId}`,
    scope: "star",
    title: `${star.label}（${categoryLabel}）`,
    summary: `${profile?.summary ?? `${star.label} 用于补充${categoryLabel}层面的细节。`} 当前落入 ${SECTOR_LABELS[palace.sectorName]}${targetText}。`,
    tags: profile?.tags ?? [categoryLabel],
    sourceRuleIds: [star.placementRuleId],
    palaceBranch: palace.branch,
    sectorName: palace.sectorName,
    starId: star.starId,
    category: star.category
  }
}

function buildCategoryItem(
  palace: FullZiweiPalace,
  category: Exclude<ZiweiStarCategory, "empty">,
  stars: ZiweiPlacedStar[]
): ZiweiInterpretationItem {
  const profile = getStarCategoryInterpretationProfile(category)
  const starLabels = stars.map((star) => star.label).join("、")

  return {
    itemId: `${palace.branch}-${category}`,
    scope: category === "transformation" ? "dynamic" : "palace",
    title: `${STAR_CATEGORY_LABELS[category]}：${starLabels}`,
    summary: `${profile.summary} 当前落入 ${SECTOR_LABELS[palace.sectorName]}，先按「${starLabels}」记录，详细断语后续按规则来源逐条校准。`,
    tags: profile.tags,
    sourceRuleIds: Array.from(new Set(stars.map((star) => star.placementRuleId))),
    palaceBranch: palace.branch,
    sectorName: palace.sectorName,
    category
  }
}
