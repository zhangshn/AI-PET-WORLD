import type {
  FullZiweiPalace,
  ZiweiInterpretationItem,
  ZiweiPlacedStar
} from "../contracts"
import { SECTOR_LABELS } from "../page-view/labels"
import { getZiweiStarDefinition } from "../star-catalog"

import { getZiweiSectorInterpretationProfile } from "./sector-profile-catalog"
import { getZiweiStarInterpretationProfile } from "./star-profile-catalog"

const TRANSFORMATION_VERBS: Record<string, string> = {
  "ziwei.transformation.hualu": "资源流入、机会打开",
  "ziwei.transformation.huaquan": "主动推动、权责加重",
  "ziwei.transformation.huake": "名声修饰、秩序缓和",
  "ziwei.transformation.huaji": "执着阻滞、反复牵挂"
}

export function buildTransformationInterpretationItem(
  palace: FullZiweiPalace,
  transformation: ZiweiPlacedStar
): ZiweiInterpretationItem {
  const targetDefinition = transformation.targetStarId
    ? getZiweiStarDefinition(transformation.targetStarId)
    : null
  const transformationProfile = getZiweiStarInterpretationProfile(
    transformation.starId
  )
  const targetProfile = transformation.targetStarId
    ? getZiweiStarInterpretationProfile(transformation.targetStarId)
    : null
  const sectorProfile = getZiweiSectorInterpretationProfile(palace.sectorName)
  const targetLabel = targetDefinition?.label ?? "目标星"
  const transformationVerb =
    TRANSFORMATION_VERBS[transformation.starId] ?? "动态触发"

  return {
    itemId: `${palace.branch}-${transformation.starId}-target-${transformation.targetStarId ?? "unknown"}`,
    scope: "dynamic",
    title: `${transformation.label} 作用 ${targetLabel}`,
    summary: `${transformation.label} 让 ${targetLabel} 的星性产生「${transformationVerb}」的变化，当前落入 ${SECTOR_LABELS[palace.sectorName]}，重点映射到「${sectorProfile.focus}」。${targetProfile ? `目标星提示：${targetProfile.summary}` : ""}`,
    tags: Array.from(new Set([
      ...(transformationProfile?.tags ?? [transformation.label]),
      ...(targetProfile?.tags ?? []),
      ...sectorProfile.tags
    ])),
    sourceRuleIds: [transformation.placementRuleId],
    palaceBranch: palace.branch,
    sectorName: palace.sectorName,
    starId: transformation.starId,
    category: transformation.category
  }
}
