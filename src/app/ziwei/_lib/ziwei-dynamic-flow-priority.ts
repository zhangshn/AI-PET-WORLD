import type {
  BranchPalace,
  ZiweiDynamicFlowDetailView
} from "@/ai/destiny-core/ziwei-core/contracts"

export interface ZiweiDynamicFlowPriorityRow {
  branch: BranchPalace
  branchLabel: string
  sectorLabel: string
  score: number
  landingFlowLabels: string[]
  transformationLabels: string[]
  jiPressureLabels: string[]
  flowingStarLabels: string[]
  annualCycleLabels: string[]
  relationFlowLabels: string[]
  starCount: number
  sourceRuleCount: number
  isSelected: boolean
  reasons: string[]
}

export interface ZiweiDynamicFlowPrioritySummary {
  rows: ZiweiDynamicFlowPriorityRow[]
  topRows: ZiweiDynamicFlowPriorityRow[]
  selectedRow?: ZiweiDynamicFlowPriorityRow
  maxScore: number
  pressureRowCount: number
  transformationRowCount: number
}

interface MutablePriorityRow {
  branch: BranchPalace
  branchLabel: string
  sectorLabel: string
  landingFlowLabels: string[]
  transformationLabels: string[]
  jiPressureLabels: string[]
  flowingStarLabels: string[]
  annualCycleLabels: string[]
  relationFlowLabels: string[]
  starCount: number
  sourceRuleCount: number
}

export function buildDynamicFlowPrioritySummary(params: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedBranch: BranchPalace
}): ZiweiDynamicFlowPrioritySummary {
  const rowMap = new Map<BranchPalace, MutablePriorityRow>()

  for (const flow of params.flows) {
    const landingRow = getOrCreateRow(rowMap, {
      branch: flow.palace,
      branchLabel: flow.branchLabel,
      sectorLabel: flow.sectorLabel
    })
    landingRow.landingFlowLabels.push(flow.label)
    landingRow.starCount +=
      flow.starCount - flow.flowingStarCount - flow.annualCycleStarCount
    landingRow.sourceRuleCount +=
      flow.sourceRuleCount - flow.flowingStarCount - flow.annualCycleStarCount

    for (const star of flow.flowingStars) {
      const flowingStarRow = getOrCreateRow(rowMap, {
        branch: star.branch,
        branchLabel: star.branchLabel,
        sectorLabel: star.sectorLabel
      })
      flowingStarRow.flowingStarLabels.push(star.displayLabel)
      flowingStarRow.starCount += 1
      flowingStarRow.sourceRuleCount += 1
    }

    for (const star of flow.annualCycleStars) {
      const annualCycleRow = getOrCreateRow(rowMap, {
        branch: star.branch,
        branchLabel: star.branchLabel,
        sectorLabel: star.sectorLabel
      })
      annualCycleRow.annualCycleLabels.push(`${star.cycleLabel}${star.label}`)
      annualCycleRow.starCount += 1
      annualCycleRow.sourceRuleCount += 1
    }

    for (const transformation of flow.transformations) {
      const transformationRow = getOrCreateRow(rowMap, {
        branch: transformation.branch,
        branchLabel: transformation.branchLabel,
        sectorLabel: transformation.sectorLabel
      })
      transformationRow.transformationLabels.push(transformation.displayLabel)

      if (transformation.transformationLabel.includes("忌")) {
        transformationRow.jiPressureLabels.push(transformation.displayLabel)
      }
    }

    for (const relation of flow.palaceDetail?.relations ?? []) {
      if (relation.kind === "self") {
        continue
      }

      const relationRow = getOrCreateRow(rowMap, {
        branch: relation.branch,
        branchLabel: relation.branchLabel,
        sectorLabel: relation.sectorLabel
      })
      relationRow.relationFlowLabels.push(`${flow.label}${relation.kindLabel}`)
    }
  }

  const rows = Array.from(rowMap.values())
    .map((row) => finalizePriorityRow(row, params.selectedBranch))
    .sort(comparePriorityRows)

  return {
    rows,
    topRows: rows.slice(0, 5),
    selectedRow: rows.find((row) => row.branch === params.selectedBranch),
    maxScore: rows[0]?.score ?? 0,
    pressureRowCount: rows.filter((row) => row.jiPressureLabels.length > 0).length,
    transformationRowCount: rows.filter((row) => row.transformationLabels.length > 0).length
  }
}

function getOrCreateRow(
  rows: Map<BranchPalace, MutablePriorityRow>,
  params: {
    branch: BranchPalace
    branchLabel: string
    sectorLabel: string
  }
): MutablePriorityRow {
  const existing = rows.get(params.branch)

  if (existing) {
    return existing
  }

  const row = {
    branch: params.branch,
    branchLabel: params.branchLabel,
    sectorLabel: params.sectorLabel,
    landingFlowLabels: [],
    transformationLabels: [],
    jiPressureLabels: [],
    flowingStarLabels: [],
    annualCycleLabels: [],
    relationFlowLabels: [],
    starCount: 0,
    sourceRuleCount: 0
  }
  rows.set(params.branch, row)

  return row
}

function finalizePriorityRow(
  row: MutablePriorityRow,
  selectedBranch: BranchPalace
): ZiweiDynamicFlowPriorityRow {
  const landingFlowLabels = unique(row.landingFlowLabels)
  const transformationLabels = unique(row.transformationLabels)
  const jiPressureLabels = unique(row.jiPressureLabels)
  const flowingStarLabels = unique(row.flowingStarLabels)
  const annualCycleLabels = unique(row.annualCycleLabels)
  const relationFlowLabels = unique(row.relationFlowLabels)
  const score =
    landingFlowLabels.length * 18 +
    transformationLabels.length * 10 +
    jiPressureLabels.length * 14 +
    flowingStarLabels.length * 6 +
    annualCycleLabels.length * 3 +
    relationFlowLabels.length * 4 +
    row.starCount * 2 +
    row.sourceRuleCount

  return {
    branch: row.branch,
    branchLabel: row.branchLabel,
    sectorLabel: row.sectorLabel,
    score,
    landingFlowLabels,
    transformationLabels,
    jiPressureLabels,
    flowingStarLabels,
    annualCycleLabels,
    relationFlowLabels,
    starCount: row.starCount,
    sourceRuleCount: row.sourceRuleCount,
    isSelected: row.branch === selectedBranch,
    reasons: buildPriorityReasons({
      landingFlowLabels,
      transformationLabels,
      jiPressureLabels,
      flowingStarLabels,
      annualCycleLabels,
      relationFlowLabels,
      starCount: row.starCount,
      sourceRuleCount: row.sourceRuleCount
    })
  }
}

function buildPriorityReasons(params: {
  landingFlowLabels: string[]
  transformationLabels: string[]
  jiPressureLabels: string[]
  flowingStarLabels: string[]
  annualCycleLabels: string[]
  relationFlowLabels: string[]
  starCount: number
  sourceRuleCount: number
}): string[] {
  const reasons: string[] = []

  if (params.landingFlowLabels.length > 0) {
    reasons.push(`流命落宫：${params.landingFlowLabels.join("、")}`)
  }

  if (params.transformationLabels.length > 0) {
    reasons.push(`四化落点：${params.transformationLabels.length} 项`)
  }

  if (params.jiPressureLabels.length > 0) {
    reasons.push(`化忌压力：${params.jiPressureLabels.join("、")}`)
  }

  if (params.flowingStarLabels.length > 0) {
    reasons.push(`流星落点：${params.flowingStarLabels.join("、")}`)
  }

  if (params.annualCycleLabels.length > 0) {
    reasons.push(`流年十二神：${params.annualCycleLabels.length} 项`)
  }

  if (params.relationFlowLabels.length > 0) {
    reasons.push(`关系牵动：${params.relationFlowLabels.length} 项`)
  }

  if (params.starCount > 0 || params.sourceRuleCount > 0) {
    reasons.push(`${params.starCount} 星 · ${params.sourceRuleCount} 规则`)
  }

  return reasons
}

function comparePriorityRows(
  left: ZiweiDynamicFlowPriorityRow,
  right: ZiweiDynamicFlowPriorityRow
): number {
  return (
    right.score - left.score ||
    right.jiPressureLabels.length - left.jiPressureLabels.length ||
    right.transformationLabels.length - left.transformationLabels.length ||
    right.landingFlowLabels.length - left.landingFlowLabels.length ||
    left.branch.localeCompare(right.branch)
  )
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
