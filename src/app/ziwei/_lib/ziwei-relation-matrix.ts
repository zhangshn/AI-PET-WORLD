import type {
  ZiweiPalaceDetailView,
  ZiweiPalaceRelationKind
} from "@/ai/destiny-core/ziwei-core/contracts"

import {
  countSourceRules,
  countStars
} from "./ziwei-star-group-filters"

export interface ZiweiRelationMatrixTarget {
  kind: ZiweiPalaceRelationKind
  kindLabel: string
  branch: ZiweiPalaceDetailView["branch"]
  branchLabel: string
  note: string
  sectorLabel: string
  starCount: number
  sourceRuleCount: number
}

export interface ZiweiRelationMatrixRow {
  branch: ZiweiPalaceDetailView["branch"]
  branchLabel: string
  sectorLabel: string
  targets: ZiweiRelationMatrixTarget[]
  relatedStarCount: number
  relatedSourceRuleCount: number
}

export function buildRelationMatrixRows(
  palaces: ZiweiPalaceDetailView[]
): ZiweiRelationMatrixRow[] {
  return palaces.map((palace) => {
    const targets = palace.relations
      .filter((relation) => relation.kind !== "self")
      .map((relation) => {
        const targetPalace = findPalace(palaces, relation.branch)

        return {
          kind: relation.kind,
          kindLabel: relation.kindLabel,
          branch: relation.branch,
          branchLabel: relation.branchLabel,
          note: relation.note,
          sectorLabel: relation.sectorLabel,
          starCount: countStars(targetPalace.starGroups),
          sourceRuleCount: countSourceRules(targetPalace.starGroups)
        }
      })

    return {
      branch: palace.branch,
      branchLabel: palace.branchLabel,
      sectorLabel: palace.sectorLabel,
      targets,
      relatedStarCount: targets.reduce((sum, target) => {
        return sum + target.starCount
      }, 0),
      relatedSourceRuleCount: countRelatedSourceRules(palaces, targets)
    }
  })
}

function countRelatedSourceRules(
  palaces: ZiweiPalaceDetailView[],
  targets: ZiweiRelationMatrixTarget[]
): number {
  return new Set(
    targets.flatMap((target) => {
      const palace = findPalace(palaces, target.branch)

      return palace.starGroups.flatMap((group) => {
        return group.stars.map((star) => star.placementRuleId)
      })
    })
  ).size
}

function findPalace(
  palaces: ZiweiPalaceDetailView[],
  branch: ZiweiPalaceDetailView["branch"]
): ZiweiPalaceDetailView {
  const palace = palaces.find((item) => item.branch === branch)

  if (!palace) {
    throw new Error(`Missing palace relation target: ${branch}`)
  }

  return palace
}
