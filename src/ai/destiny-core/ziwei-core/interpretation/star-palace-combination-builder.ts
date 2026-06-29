import type {
  FullZiweiPalace,
  ZiweiInterpretationItem,
  ZiweiPlacedStar
} from "../contracts"
import { SECTOR_LABELS, STAR_CATEGORY_LABELS } from "../page-view/labels"

import { getZiweiSectorInterpretationProfile } from "./sector-profile-catalog"
import { getZiweiStarInterpretationProfile } from "./star-profile-catalog"

export function buildStarPalaceCombinationItem(
  palace: FullZiweiPalace,
  star: ZiweiPlacedStar
): ZiweiInterpretationItem {
  const sectorProfile = getZiweiSectorInterpretationProfile(palace.sectorName)
  const starProfile = getZiweiStarInterpretationProfile(star.starId)
  const categoryLabel = STAR_CATEGORY_LABELS[star.category]

  return {
    itemId: `${palace.branch}-${star.starId}-combination`,
    scope: "combination",
    title: `${star.label} 入 ${SECTOR_LABELS[palace.sectorName]}`,
    summary: buildCombinationSummary(
      star.label,
      categoryLabel,
      starProfile?.tags ?? [categoryLabel],
      sectorProfile.focus
    ),
    tags: Array.from(new Set([
      ...sectorProfile.tags,
      ...(starProfile?.tags ?? [categoryLabel])
    ])),
    sourceRuleIds: [star.placementRuleId],
    palaceBranch: palace.branch,
    sectorName: palace.sectorName,
    starId: star.starId,
    category: star.category
  }
}

function buildCombinationSummary(
  starLabel: string,
  categoryLabel: string,
  starTags: string[],
  sectorFocus: string
): string {
  return `${starLabel} 作为${categoryLabel}落入此宫，先以「${starTags.join("、")}」观察星性，再映射到「${sectorFocus}」；当前为组合提示，后续可按规则来源补充细断。`
}
