import type {
  BranchPalace,
  ZiweiDynamicFlowDetailView
} from "@/ai/destiny-core/ziwei-core/contracts"

export interface ZiweiDynamicFlowPalaceOverlay {
  branch: BranchPalace
  branchLabel: string
  sectorLabel: string
  flowLabels: string[]
  activeFlowLabels: string[]
  starCount: number
  transformationCount: number
  sourceRuleCount: number
  isSelected: boolean
}

export interface ZiweiDynamicFlowTransformationOverlay {
  branch: BranchPalace
  branchLabel: string
  sectorLabel: string
  transformationLabels: string[]
  targetStarLabels: string[]
  flowLabels: string[]
  isSelected: boolean
}

export interface ZiweiDynamicFlowJiPressure {
  flowLabel: string
  transformationLabel: string
  targetStarLabel: string
  branch: BranchPalace
  branchLabel: string
  sectorLabel: string
  isSelected: boolean
}

export interface ZiweiSelectedBranchDynamicImpact {
  sourceLabel: string
  impactKind: string
  detail: string
  flowType: ZiweiDynamicFlowDetailView["type"]
  branch: BranchPalace
}

export interface ZiweiDynamicFlowImpactSummary {
  totalFlowCount: number
  activeFlowCount: number
  samePalaceOverlayCount: number
  transformationTargetCount: number
  jiPressureCount: number
  selectedBranchImpactCount: number
  palaceOverlays: ZiweiDynamicFlowPalaceOverlay[]
  transformationOverlays: ZiweiDynamicFlowTransformationOverlay[]
  jiPressures: ZiweiDynamicFlowJiPressure[]
  selectedBranchImpacts: ZiweiSelectedBranchDynamicImpact[]
}

export function buildDynamicFlowImpactSummary(params: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedBranch: BranchPalace
}): ZiweiDynamicFlowImpactSummary {
  const palaceOverlays = buildPalaceOverlays(params.flows, params.selectedBranch)
  const transformationOverlays = buildTransformationOverlays(
    params.flows,
    params.selectedBranch
  )
  const jiPressures = buildJiPressures(params.flows, params.selectedBranch)
  const selectedBranchImpacts = buildSelectedBranchImpacts(
    params.flows,
    params.selectedBranch
  )

  return {
    totalFlowCount: params.flows.length,
    activeFlowCount: params.flows.filter((flow) => flow.isActive).length,
    samePalaceOverlayCount: palaceOverlays.length,
    transformationTargetCount: transformationOverlays.length,
    jiPressureCount: jiPressures.length,
    selectedBranchImpactCount: selectedBranchImpacts.length,
    palaceOverlays,
    transformationOverlays,
    jiPressures,
    selectedBranchImpacts
  }
}

function buildPalaceOverlays(
  flows: ZiweiDynamicFlowDetailView[],
  selectedBranch: BranchPalace
): ZiweiDynamicFlowPalaceOverlay[] {
  return Array.from(groupFlowsByBranch(flows).entries())
    .filter(([, branchFlows]) => branchFlows.length > 1)
    .map(([branch, branchFlows]) => {
      const firstFlow = branchFlows[0]

      return {
        branch,
        branchLabel: firstFlow.branchLabel,
        sectorLabel: firstFlow.sectorLabel,
        flowLabels: branchFlows.map((flow) => flow.label),
        activeFlowLabels: branchFlows
          .filter((flow) => flow.isActive)
          .map((flow) => flow.label),
        starCount: branchFlows.reduce((total, flow) => {
          return total + flow.starCount
        }, 0),
        transformationCount: branchFlows.reduce((total, flow) => {
          return total + flow.transformations.length
        }, 0),
        sourceRuleCount: branchFlows.reduce((total, flow) => {
          return total + flow.sourceRuleCount
        }, 0),
        isSelected: branch === selectedBranch
      }
    })
}

function buildTransformationOverlays(
  flows: ZiweiDynamicFlowDetailView[],
  selectedBranch: BranchPalace
): ZiweiDynamicFlowTransformationOverlay[] {
  const transformationsByBranch = new Map<
    BranchPalace,
    Array<{
      flow: ZiweiDynamicFlowDetailView
      transformation: ZiweiDynamicFlowDetailView["transformations"][number]
    }>
  >()

  for (const flow of flows) {
    for (const transformation of flow.transformations) {
      const items = transformationsByBranch.get(transformation.branch) ?? []
      items.push({ flow, transformation })
      transformationsByBranch.set(transformation.branch, items)
    }
  }

  return Array.from(transformationsByBranch.entries()).map(([branch, items]) => {
    const firstItem = items[0]

    return {
      branch,
      branchLabel: firstItem.transformation.branchLabel,
      sectorLabel: firstItem.transformation.sectorLabel,
      transformationLabels: items.map((item) => {
        return item.transformation.displayLabel
      }),
      targetStarLabels: unique(items.map((item) => item.transformation.targetStarLabel)),
      flowLabels: unique(items.map((item) => item.flow.label)),
      isSelected: branch === selectedBranch
    }
  })
}

function buildJiPressures(
  flows: ZiweiDynamicFlowDetailView[],
  selectedBranch: BranchPalace
): ZiweiDynamicFlowJiPressure[] {
  return flows.flatMap((flow) => {
    return flow.transformations
      .filter((transformation) => transformation.transformationLabel.includes("忌"))
      .map((transformation) => {
        return {
          flowLabel: flow.label,
          transformationLabel: transformation.displayLabel,
          targetStarLabel: transformation.targetStarLabel,
          branch: transformation.branch,
          branchLabel: transformation.branchLabel,
          sectorLabel: transformation.sectorLabel,
          isSelected: transformation.branch === selectedBranch
        }
      })
  })
}

function buildSelectedBranchImpacts(
  flows: ZiweiDynamicFlowDetailView[],
  selectedBranch: BranchPalace
): ZiweiSelectedBranchDynamicImpact[] {
  return flows.flatMap((flow) => {
    const palaceImpacts: ZiweiSelectedBranchDynamicImpact[] =
      flow.palace === selectedBranch
        ? [
            {
              sourceLabel: flow.label,
              impactKind: "流命落宫",
              detail: `${flow.branchLabel} · ${flow.sectorLabel}`,
              flowType: flow.type,
              branch: flow.palace
            }
          ]
        : []
    const transformationImpacts = flow.transformations
      .filter((transformation) => transformation.branch === selectedBranch)
      .map((transformation) => {
        return {
          sourceLabel: flow.label,
          impactKind: transformation.displayLabel,
          detail: transformation.targetStarLabel,
          flowType: flow.type,
          branch: transformation.branch
        }
      })
    const flowingStarImpacts = flow.flowingStars
      .filter((star) => star.branch === selectedBranch)
      .map((star) => {
        return {
          sourceLabel: flow.label,
          impactKind: star.displayLabel,
          detail: star.placementRuleId,
          flowType: flow.type,
          branch: star.branch
        }
      })
    const annualCycleImpacts = flow.annualCycleStars
      .filter((star) => star.branch === selectedBranch)
      .map((star) => {
        return {
          sourceLabel: flow.label,
          impactKind: star.displayLabel,
          detail: star.cycleLabel,
          flowType: flow.type,
          branch: star.branch
        }
      })
    const relationImpacts = (flow.palaceDetail?.relations ?? [])
      .filter((relation) => {
        return relation.kind !== "self" && relation.branch === selectedBranch
      })
      .map((relation) => {
        return {
          sourceLabel: flow.label,
          impactKind: relation.kindLabel,
          detail: relation.note,
          flowType: flow.type,
          branch: relation.branch
        }
      })

    return [
      ...palaceImpacts,
      ...transformationImpacts,
      ...flowingStarImpacts,
      ...annualCycleImpacts,
      ...relationImpacts
    ]
  })
}

function groupFlowsByBranch(
  flows: ZiweiDynamicFlowDetailView[]
): Map<BranchPalace, ZiweiDynamicFlowDetailView[]> {
  const groups = new Map<BranchPalace, ZiweiDynamicFlowDetailView[]>()

  for (const flow of flows) {
    const branchFlows = groups.get(flow.palace) ?? []
    branchFlows.push(flow)
    groups.set(flow.palace, branchFlows)
  }

  return groups
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
