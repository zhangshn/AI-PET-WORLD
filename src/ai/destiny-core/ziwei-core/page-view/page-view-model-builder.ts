import type {
  BranchPalace,
  BuildZiweiPageViewModelInput,
  FullZiweiDynamicChart,
  FullZiweiDynamicFlow,
  FullZiweiPalace,
  ZiweiDynamicFlowDetailView,
  ZiweiDynamicTabView,
  ZiweiPageViewModel,
  ZiweiPalaceCellView,
  ZiweiPalaceDetailView,
  ZiweiPalaceRelationView,
  ZiweiPlacedStar,
  ZiweiStarCatalogRowView,
  ZiweiStarGroupView,
  ZiweiStarView
} from "../contracts"
import { buildZiweiChartInterpretation } from "../interpretation"
import { moveBranch, PHYSICAL_BRANCH_ORDER } from "../shared"
import { getZiweiStarDefinition } from "../star-catalog"

import {
  BRANCH_LABELS,
  DYNAMIC_DIRECTION_LABELS,
  DYNAMIC_FLOW_LABELS,
  SECTOR_LABELS,
  STAR_CATEGORY_DISPLAY_ORDER,
  STAR_CATEGORY_LABELS,
  STEM_LABELS
} from "./labels"

export function buildZiweiPageViewModel(
  input: BuildZiweiPageViewModelInput
): ZiweiPageViewModel {
  const selectedBranch = input.selectedBranch ?? input.chart.foundation.lifePalace
  const interpretation = buildZiweiChartInterpretation({
    chart: input.chart
  })
  const palaceGrid = PHYSICAL_BRANCH_ORDER.map((branch) => {
    const palace = findPalace(input.chart.palaces, branch)
    return buildPalaceCellView(palace)
  })
  const palaceDetails = PHYSICAL_BRANCH_ORDER.map((branch) => {
    const palace = findPalace(input.chart.palaces, branch)
    return buildPalaceDetailView(palace, input.chart.palaces)
  })
  const selectedPalace = input.chart.palaces.find((palace) => {
    return palace.branch === selectedBranch
  })
  const dynamicFlowDetails = buildDynamicFlowDetails({
    dynamicChart: input.dynamicChart,
    palaces: input.chart.palaces
  })

  return {
    chartMeta: {
      title: "紫微斗数完整盘",
      inputSummary: buildInputSummary(input),
      ruleSetVersion: input.chart.ruleSetVersion
    },
    palaceGrid,
    palaceDetails,
    selectedPalace: selectedPalace
      ? buildPalaceDetailView(selectedPalace, input.chart.palaces)
      : undefined,
    dynamicTabs: dynamicFlowDetails.map(buildDynamicTabView),
    dynamicFlowDetails,
    dynamicDebug: input.dynamicChart
      ? buildDynamicDebugView(input.dynamicChart)
      : undefined,
    starCatalogRows: buildStarCatalogRows(input.chart.palaces),
    interpretation,
    debugJson: {
      chart: input.chart,
      dynamicChart: input.dynamicChart ?? null
    }
  }
}

function buildDynamicFlowDetails(params: {
  dynamicChart?: FullZiweiDynamicChart
  palaces: FullZiweiPalace[]
}): ZiweiDynamicFlowDetailView[] {
  return (params.dynamicChart?.flows ?? []).map((flow) => {
    return buildDynamicFlowDetailView({
      flow,
      palaces: params.palaces
    })
  })
}

function buildDynamicFlowDetailView(params: {
  flow: FullZiweiDynamicFlow
  palaces: FullZiweiPalace[]
}): ZiweiDynamicFlowDetailView {
  const palace = findPalace(params.palaces, params.flow.palace)
  const sourceRuleCount = new Set(
    params.flow.stars.map((star) => star.placementRuleId)
  ).size

  return {
    type: params.flow.type,
    label: DYNAMIC_FLOW_LABELS[params.flow.type],
    palace: params.flow.palace,
    isActive: params.flow.isActive,
    palaceLabel: `${BRANCH_LABELS[params.flow.palace]} · ${SECTOR_LABELS[params.flow.sectorName]}`,
    inactiveReason: params.flow.inactiveReason,
    sectorName: params.flow.sectorName,
    sectorLabel: SECTOR_LABELS[params.flow.sectorName],
    branchLabel: BRANCH_LABELS[params.flow.palace],
    influence: params.flow.influence,
    starCount: params.flow.stars.length,
    sourceRuleCount,
    palaceDetail: buildPalaceDetailView(palace, params.palaces)
  }
}

function buildDynamicTabView(
  detail: ZiweiDynamicFlowDetailView
): ZiweiDynamicTabView {
  return {
    type: detail.type,
    label: detail.label,
    palace: detail.palace,
    isActive: detail.isActive,
    palaceLabel: detail.palaceLabel,
    inactiveReason: detail.inactiveReason
  }
}

function buildDynamicDebugView(dynamicChart: FullZiweiDynamicChart) {
  const activeFlowCount = dynamicChart.flows.filter((flow) => flow.isActive).length

  return {
    direction: dynamicChart.debug.direction,
    directionLabel: DYNAMIC_DIRECTION_LABELS[dynamicChart.debug.direction],
    startAge: dynamicChart.debug.startAge,
    currentAge: dynamicChart.debug.currentAge,
    isDaYunStarted: dynamicChart.debug.isDaYunStarted,
    activeFlowCount,
    totalFlowCount: dynamicChart.flows.length
  }
}

function buildInputSummary(input: BuildZiweiPageViewModelInput): string {
  const birth = input.chart.input
  const genderLabel =
    birth.gender === "male"
      ? "男"
      : birth.gender === "female"
        ? "女"
        : "未填性别"

  return `${birth.year}-${birth.month}-${birth.day} ${birth.hour}:${String(
    birth.minute
  ).padStart(2, "0")} · ${genderLabel} · ${input.chart.lunarInfo.lunarYear}年农历${input.chart.lunarInfo.lunarMonth}月${input.chart.lunarInfo.lunarDay}日`
}

function findPalace(
  palaces: FullZiweiPalace[],
  branch: BranchPalace
): FullZiweiPalace {
  const palace = palaces.find((item) => item.branch === branch)

  if (!palace) {
    throw new Error(`Missing palace for branch: ${branch}`)
  }

  return palace
}

function buildPalaceCellView(palace: FullZiweiPalace): ZiweiPalaceCellView {
  return {
    branch: palace.branch,
    sectorName: palace.sectorName,
    sectorLabel: SECTOR_LABELS[palace.sectorName],
    branchLabel: BRANCH_LABELS[palace.branch],
    palaceStemLabel: STEM_LABELS[palace.palaceStem],
    isLifePalace: palace.isLifePalace,
    isBodyPalace: palace.isBodyPalace,
    starGroups: buildStarGroups(palace)
  }
}

function buildPalaceDetailView(
  palace: FullZiweiPalace,
  palaces: FullZiweiPalace[]
): ZiweiPalaceDetailView {
  return {
    ...buildPalaceCellView(palace),
    oppositeBranchLabel: BRANCH_LABELS[palace.oppositeBranch],
    trineBranchLabels: palace.trineBranches.map((branch) => BRANCH_LABELS[branch]),
    relations: buildPalaceRelations(palace, palaces),
    detailLines: palace.detailLines
  }
}

function buildPalaceRelations(
  palace: FullZiweiPalace,
  palaces: FullZiweiPalace[]
): ZiweiPalaceRelationView[] {
  const previousBranch = moveBranch(palace.branch, -1)
  const nextBranch = moveBranch(palace.branch, 1)

  return [
    buildPalaceRelation({
      palace: findPalace(palaces, palace.branch),
      kind: "self",
      kindLabel: "本宫",
      note: "当前查看宫位"
    }),
    buildPalaceRelation({
      palace: findPalace(palaces, palace.oppositeBranch),
      kind: "opposite",
      kindLabel: "对宫",
      note: "对照参看宫位"
    }),
    ...palace.trineBranches.map((branch) => {
      return buildPalaceRelation({
        palace: findPalace(palaces, branch),
        kind: "trine",
        kindLabel: "三方",
        note: "三方四正宫位"
      })
    }),
    buildPalaceRelation({
      palace: findPalace(palaces, previousBranch),
      kind: "adjacent",
      kindLabel: "邻宫",
      note: "逆时针相邻宫"
    }),
    buildPalaceRelation({
      palace: findPalace(palaces, nextBranch),
      kind: "adjacent",
      kindLabel: "邻宫",
      note: "顺时针相邻宫"
    })
  ]
}

function buildPalaceRelation(params: {
  palace: FullZiweiPalace
  kind: ZiweiPalaceRelationView["kind"]
  kindLabel: string
  note: string
}): ZiweiPalaceRelationView {
  return {
    kind: params.kind,
    kindLabel: params.kindLabel,
    branch: params.palace.branch,
    branchLabel: BRANCH_LABELS[params.palace.branch],
    sectorName: params.palace.sectorName,
    sectorLabel: SECTOR_LABELS[params.palace.sectorName],
    note: params.note
  }
}

function buildStarGroups(palace: FullZiweiPalace): ZiweiStarGroupView[] {
  const groups: ZiweiStarGroupView[] = []

  STAR_CATEGORY_DISPLAY_ORDER.forEach((category) => {
    const stars = palace.stars[category]

    if (stars.length === 0) {
      return
    }

    groups.push({
      category,
      label: STAR_CATEGORY_LABELS[category],
      stars: stars.map(buildStarView)
    })
  })

  return groups
}

function buildStarView(star: ZiweiPlacedStar): ZiweiStarView {
  const definition = getZiweiStarDefinition(star.starId)

  return {
    starId: star.starId,
    label: star.label,
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    placementRuleId: star.placementRuleId,
    displayOrder: definition?.displayOrder ?? Number.MAX_SAFE_INTEGER
  }
}

function buildStarCatalogRows(
  palaces: FullZiweiPalace[]
): ZiweiStarCatalogRowView[] {
  return palaces.flatMap((palace) => {
    return Object.values(palace.stars).flat().map((star) => {
      return buildStarCatalogRow(palace, star)
    })
  }).sort(compareStarCatalogRows)
}

function buildStarCatalogRow(
  palace: FullZiweiPalace,
  star: ZiweiPlacedStar
): ZiweiStarCatalogRowView {
  return {
    starId: star.starId,
    label: star.label,
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    palaceLabel: BRANCH_LABELS[palace.branch],
    sectorLabel: SECTOR_LABELS[palace.sectorName],
    placementRuleId: star.placementRuleId
  }
}

function compareStarCatalogRows(
  left: ZiweiStarCatalogRowView,
  right: ZiweiStarCatalogRowView
): number {
  const leftDefinition = getZiweiStarDefinition(left.starId)
  const rightDefinition = getZiweiStarDefinition(right.starId)
  const leftOrder = leftDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = rightDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER

  return leftOrder - rightOrder || left.label.localeCompare(right.label)
}
