import type {
  BranchPalace,
  BuildZiweiPageViewModelInput,
  FullZiweiDynamicChart,
  FullZiweiDynamicFlow,
  ZiweiDynamicAnnualCycleStarView,
  ZiweiDynamicFlowingStarView,
  FullZiweiDynamicTransformation,
  FullZiweiPalace,
  ZiweiDynamicFlowDetailView,
  ZiweiDynamicTransformationView,
  ZiweiDynamicTabView,
  ZiweiPageViewModel,
  ZiweiPalaceCellView,
  ZiweiPalaceDetailView,
  ZiweiPalaceRelationView,
  ZiweiPlacedStar,
  ZiweiStarDefinition,
  ZiweiStarCatalogRowView,
  ZiweiStarDictionaryDetailView,
  ZiweiStarDictionaryEntryView,
  ZiweiStarDictionaryPlacementView,
  ZiweiStarGroupView,
  ZiweiStarView
} from "../contracts"
import {
  buildZiweiStarContentDictionaryDetail,
  buildZiweiChartInterpretation,
} from "../interpretation"
import { getZiweiStarInterpretationProfile } from "../interpretation/star-profile-catalog"
import { moveBranch, PHYSICAL_BRANCH_ORDER } from "../shared"
import { getZiweiStarDefinition, ziweiStarCatalog } from "../star-catalog"

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
    chart: input.chart,
    dynamicChart: input.dynamicChart
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
      ? buildDynamicDebugView(input.dynamicChart, input.chart.palaces)
      : undefined,
    starCatalogRows: buildStarCatalogRows(input.chart.palaces),
    starDictionaryEntries: buildStarDictionaryEntries(input.chart.palaces),
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
    [
      ...params.flow.stars.map((star) => star.placementRuleId),
      ...params.flow.flowingStars.map((star) => star.placementRuleId),
      ...params.flow.annualCycleStars.map((star) => star.placementRuleId),
      ...params.flow.transformations.map((item) => item.placementRuleId)
    ]
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
    stem: params.flow.stem,
    stemLabel: STEM_LABELS[params.flow.stem],
    stemSource: params.flow.stemSource,
    stemSourceLabel: getDynamicStemSourceLabel(params.flow.stemSource),
    influence: params.flow.influence,
    starCount:
      params.flow.stars.length +
      params.flow.flowingStars.length +
      params.flow.annualCycleStars.length,
    flowingStarCount: params.flow.flowingStars.length,
    annualCycleStarCount: params.flow.annualCycleStars.length,
    sourceRuleCount,
    flowingStars: params.flow.flowingStars.map((star) => {
      return buildDynamicFlowingStarView(star, params.flow.type)
    }),
    annualCycleStars: params.flow.annualCycleStars.map((star) => {
      return buildDynamicAnnualCycleStarView(star, params.flow.type)
    }),
    transformations: params.flow.transformations.map((transformation) => {
      return buildDynamicTransformationView(transformation, params.flow.type)
    }),
    palaceDetail: buildPalaceDetailView(palace, params.palaces)
  }
}

function buildDynamicAnnualCycleStarView(
  star: ZiweiPlacedStar,
  flowType: FullZiweiDynamicFlow["type"]
): ZiweiDynamicAnnualCycleStarView {
  return {
    ...buildDynamicFlowingStarView(star, flowType),
    cycleLabel: getAnnualCycleLabel(star.placementRuleId)
  }
}

function buildDynamicFlowingStarView(
  star: ZiweiPlacedStar,
  flowType: FullZiweiDynamicFlow["type"]
): ZiweiDynamicFlowingStarView {
  return {
    starId: star.starId,
    label: star.label,
    displayLabel: `${DYNAMIC_FLOW_LABELS[flowType]}${star.label}`,
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    branch: star.branch,
    branchLabel: BRANCH_LABELS[star.branch],
    sectorName: star.sectorName,
    sectorLabel: SECTOR_LABELS[star.sectorName],
    placementRuleId: star.placementRuleId
  }
}

function getAnnualCycleLabel(ruleId: string): string {
  if (ruleId.includes(".boshi.")) return "博士十二神"
  if (ruleId.includes(".suiqian.")) return "岁前十二神"
  if (ruleId.includes(".jiangqian.")) return "将前十二神"
  return "年系十二神"
}

function buildDynamicTransformationView(
  transformation: FullZiweiDynamicTransformation,
  flowType: FullZiweiDynamicFlow["type"]
): ZiweiDynamicTransformationView {
  const sourceLabel = DYNAMIC_FLOW_LABELS[flowType]

  return {
    transformationStarId: transformation.transformationStarId,
    transformationLabel: transformation.transformationLabel,
    displayLabel: `${sourceLabel}${transformation.transformationLabel} ${transformation.targetStarLabel}`,
    sourceLabel,
    targetStarId: transformation.targetStarId,
    targetStarLabel: transformation.targetStarLabel,
    branch: transformation.branch,
    branchLabel: BRANCH_LABELS[transformation.branch],
    sectorName: transformation.sectorName,
    sectorLabel: SECTOR_LABELS[transformation.sectorName],
    placementRuleId: transformation.placementRuleId
  }
}

function getDynamicStemSourceLabel(
  source: FullZiweiDynamicFlow["stemSource"]
): string {
  if (source === "birthYearStem") return "本命年干"
  if (source === "currentYearStem") return "流年年干"
  if (source === "currentMonthStem") return "流月月干"
  if (source === "currentDayStem") return "流日日干"
  if (source === "currentTimeStem") return "流时时干"
  return "动态宫干"
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

function buildDynamicDebugView(
  dynamicChart: FullZiweiDynamicChart,
  palaces: FullZiweiPalace[]
) {
  const activeFlowCount = dynamicChart.flows.filter((flow) => flow.isActive).length
  const xiaoXianStartPalace = findPalace(
    palaces,
    dynamicChart.debug.xiaoXianStartPalace
  )
  const xiaoXianPalace = findPalace(palaces, dynamicChart.debug.xiaoXianPalace)
  const douJunPalace = findPalace(palaces, dynamicChart.debug.douJunPalace)

  return {
    direction: dynamicChart.debug.direction,
    directionLabel: DYNAMIC_DIRECTION_LABELS[dynamicChart.debug.direction],
    startAge: dynamicChart.debug.startAge,
    currentAge: dynamicChart.debug.currentAge,
    isDaYunStarted: dynamicChart.debug.isDaYunStarted,
    xiaoXianDirection: dynamicChart.debug.xiaoXianDirection,
    xiaoXianDirectionLabel:
      DYNAMIC_DIRECTION_LABELS[dynamicChart.debug.xiaoXianDirection],
    xiaoXianStartPalace: dynamicChart.debug.xiaoXianStartPalace,
    xiaoXianStartPalaceLabel: `${BRANCH_LABELS[dynamicChart.debug.xiaoXianStartPalace]} · ${SECTOR_LABELS[xiaoXianStartPalace.sectorName]}`,
    xiaoXianPalace: dynamicChart.debug.xiaoXianPalace,
    xiaoXianPalaceLabel: `${BRANCH_LABELS[dynamicChart.debug.xiaoXianPalace]} · ${SECTOR_LABELS[xiaoXianPalace.sectorName]}`,
    douJunPalace: dynamicChart.debug.douJunPalace,
    douJunPalaceLabel: `${BRANCH_LABELS[dynamicChart.debug.douJunPalace]} · ${SECTOR_LABELS[douJunPalace.sectorName]}`,
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
  const targetStarLabel = star.targetStarId
    ? getZiweiStarDefinition(star.targetStarId)?.label
    : undefined
  const sourceLabel = getPlacementSourceLabel(star.source)

  return {
    starId: star.starId,
    label: star.label,
    displayLabel: formatPlacedStarDisplayLabel({
      label: star.label,
      sourceLabel,
      targetStarLabel,
      category: star.category
    }),
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    source: star.source,
    sourceLabel,
    placementRuleId: star.placementRuleId,
    brightness: star.brightness,
    targetStarId: star.targetStarId,
    targetStarLabel,
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
    displayLabel: formatPlacedStarDisplayLabel({
      label: star.label,
      sourceLabel: getPlacementSourceLabel(star.source),
      targetStarLabel: star.targetStarId
        ? getZiweiStarDefinition(star.targetStarId)?.label
        : undefined,
      category: star.category
    }),
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    sourceLabel: getPlacementSourceLabel(star.source),
    palaceLabel: BRANCH_LABELS[palace.branch],
    sectorLabel: SECTOR_LABELS[palace.sectorName],
    placementRuleId: star.placementRuleId,
    brightness: star.brightness,
    targetStarId: star.targetStarId,
    targetStarLabel: star.targetStarId
      ? getZiweiStarDefinition(star.targetStarId)?.label
      : undefined
  }
}

function buildStarDictionaryEntries(
  palaces: FullZiweiPalace[]
): ZiweiStarDictionaryEntryView[] {
  const placementsByStarId = new Map<string, ZiweiStarDictionaryPlacementView[]>()

  palaces.forEach((palace) => {
    Object.values(palace.stars).flat().forEach((star) => {
      const placement = buildStarDictionaryPlacement(palace, star, palaces)
      const existing = placementsByStarId.get(star.starId)

      if (existing) {
        existing.push(placement)
        return
      }

      placementsByStarId.set(star.starId, [placement])
    })
  })

  return ziweiStarCatalog
    .map((definition) => {
      return buildStarDictionaryEntry(
        definition,
        placementsByStarId.get(definition.starId) ?? []
      )
    })
    .sort(compareStarDictionaryEntries)
}

function buildStarDictionaryPlacement(
  palace: FullZiweiPalace,
  star: ZiweiPlacedStar,
  palaces: FullZiweiPalace[]
): ZiweiStarDictionaryPlacementView {
  const samePalaceStarLabels = getPalaceStarLabels(palace).filter((label) => {
    return label !== star.label
  })
  const oppositePalace = findPalace(palaces, palace.oppositeBranch)
  const trinePalaces = palace.trineBranches.map((branch) => {
    return findPalace(palaces, branch)
  })
  const oppositePalaceStarLabels = getPalaceStarLabels(oppositePalace)
  const trineSquareStarLabels = uniqueLabels(
    trinePalaces.flatMap((item) => getPalaceStarLabels(item))
  )
  const sectorLabel = SECTOR_LABELS[palace.sectorName]
  const branchLabel = BRANCH_LABELS[palace.branch]
  const brightnessLabel =
    star.category === "transformation" ? undefined : star.brightness?.label

  return {
    palaceLabel: branchLabel,
    sectorLabel,
    brightnessLabel,
    placementRuleId: star.placementRuleId,
    palaceMeaning: `${star.label}落在${branchLabel}宫的${sectorLabel}，解释时先把${star.label}的本体含义转换成${sectorLabel}主题；这一宫负责承接该星曜在当前盘里的具体表现位置。`,
    starMeaning: `${star.label}在此处主要看${STAR_CATEGORY_LABELS[star.category]}性质、${brightnessLabel ? `${brightnessLabel}状态、` : ""}同宫星曜和三方四正会照。不能只看它出现在哪个宫，还要看该宫是否有主星承接、是否被辅曜补强、是否被煞曜或化忌牵动。`,
    samePalaceStarLabels,
    oppositePalaceStarLabels,
    trineSquareStarLabels,
    combinationMeaning: buildPlacementCombinationMeaning({
      star,
      samePalaceStarLabels,
      oppositePalaceStarLabels,
      trineSquareStarLabels
    }),
    relationMeaning: `${sectorLabel}的三方四正需要合看对宫${SECTOR_LABELS[oppositePalace.sectorName]}，以及三方${trinePalaces.map((item) => SECTOR_LABELS[item.sectorName]).join("、")}。对宫表示外部牵引和对照面，三方表示结构资源、压力来源和格局证据；这些星曜会共同修饰${star.label}在${sectorLabel}里的发挥。`,
    readingBoundary: `盘中位置解释只说明${star.label}在当前盘的证据位置，不等于完整断语。最终仍要回到命身、宫位职责、庙旺落陷、同宫组合、三方四正、四化和格局命中后再综合。`
  }
}

function getPalaceStarLabels(palace: FullZiweiPalace): string[] {
  return uniqueLabels(
    Object.values(palace.stars)
      .flat()
      .sort((left, right) => {
        const leftDefinition = getZiweiStarDefinition(left.starId)
        const rightDefinition = getZiweiStarDefinition(right.starId)

        return (
          (leftDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER) -
            (rightDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.label.localeCompare(right.label)
        )
      })
      .map((star) => {
        if (star.category !== "transformation") {
          return star.label
        }

        const targetStarLabel = star.targetStarId
          ? getZiweiStarDefinition(star.targetStarId)?.label
          : undefined

        return targetStarLabel ? `${star.label}${targetStarLabel}` : star.label
      })
  )
}

function buildPlacementCombinationMeaning(params: {
  star: ZiweiPlacedStar
  samePalaceStarLabels: string[]
  oppositePalaceStarLabels: string[]
  trineSquareStarLabels: string[]
}): string {
  const sameText =
    params.samePalaceStarLabels.length > 0
      ? `同宫见${params.samePalaceStarLabels.join("、")}，这些星曜会直接和${params.star.label}混合，优先判断是补强、牵制、引动还是增加压力。`
      : `本宫没有其他星曜与${params.star.label}直接同宫，解释时更要借对宫和三方四正补足结构。`
  const oppositeText =
    params.oppositePalaceStarLabels.length > 0
      ? `对宫见${params.oppositePalaceStarLabels.join("、")}，代表外部对象、反馈面和冲照力量，会影响${params.star.label}的表现方式。`
      : "对宫没有明显星曜证据时，对照面的解释权重降低。"
  const trineText =
    params.trineSquareStarLabels.length > 0
      ? `三方四正见${params.trineSquareStarLabels.join("、")}，这些星曜是结构层证据；辅曜和吉化多看支援，煞曜、空劫、化忌多看压力和破格复核，杂曜则补充细节气氛。`
      : "三方四正缺少星曜证据时，不能硬判格局，需要回到本宫和对宫。"

  return `${sameText}${oppositeText}${trineText}`
}

function uniqueLabels(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function formatPlacedStarDisplayLabel(params: {
  label: string
  sourceLabel: string
  targetStarLabel?: string
  category: ZiweiStarView["category"]
}): string {
  if (params.category !== "transformation") {
    return params.label
  }

  return params.targetStarLabel
    ? `${params.sourceLabel}${params.label} ${params.targetStarLabel}`
    : `${params.sourceLabel}${params.label}`
}

function getPlacementSourceLabel(source: ZiweiPlacedStar["source"]): string {
  return DYNAMIC_FLOW_LABELS[source]
}

function buildStarDictionaryEntry(
  star: ZiweiStarDefinition,
  placements: ZiweiStarDictionaryPlacementView[]
): ZiweiStarDictionaryEntryView {
  const profile = getZiweiStarInterpretationProfile(star.starId)
  const detail = buildZiweiStarContentDictionaryDetail(star)

  return {
    starId: star.starId,
    label: star.label,
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    summary:
      profile?.summary ??
      `${star.label} 属于${STAR_CATEGORY_LABELS[star.category]}，用于建立星曜本体资料。`,
    tags: profile?.tags ?? [star.label, STAR_CATEGORY_LABELS[star.category]],
    placements,
    detail: buildStarDictionaryDetail(detail)
  }
}

function buildStarDictionaryDetail(detail: ReturnType<typeof buildZiweiStarContentDictionaryDetail>): ZiweiStarDictionaryDetailView {
  return {
    sourceLabel: detail.source === "manual" ? "逐星细节" : "分类兜底",
    aliases: detail.aliases,
    extendedOverview: detail.extendedOverview,
    yinYangLabel: formatContentYinYangLabel(detail.yinYang),
    elementLabel: formatContentElementLabel(detail.element),
    nature: detail.nature,
    identity: detail.identity,
    symbolicMeanings: detail.symbolicMeanings,
    functionalRole: detail.functionalRole,
    coreThemes: detail.coreThemes,
    strengths: detail.strengths,
    risks: detail.risks,
    favorableSignals: detail.favorableSignals,
    unfavorableSignals: detail.unfavorableSignals,
    palaceFocus: detail.palaceFocus,
    palaceUsage: detail.palaceUsage,
    brightnessUsage: detail.brightnessUsage,
    combinationUsage: detail.combinationUsage,
    interpretationSteps: detail.interpretationSteps,
    cautions: detail.cautions,
    reusableScenes: detail.reusableScenes,
    extendedSections: detail.extendedSections,
    personalityTendency: detail.personalityTendency,
    worldBehaviorHint: detail.worldBehaviorHint,
    readingNotes: detail.readingNotes
  }
}

function formatContentYinYangLabel(value: string): string {
  if (value === "yang") return "阳"
  if (value === "yin") return "阴"
  return "阴阳混合"
}

function formatContentElementLabel(value: string): string {
  if (value === "wood") return "木"
  if (value === "fire") return "火"
  if (value === "earth") return "土"
  if (value === "metal") return "金"
  if (value === "water") return "水"
  return "五行混合"
}

function compareStarDictionaryEntries(
  left: ZiweiStarDictionaryEntryView,
  right: ZiweiStarDictionaryEntryView
): number {
  const leftDefinition = getZiweiStarDefinition(left.starId)
  const rightDefinition = getZiweiStarDefinition(right.starId)
  const leftOrder = leftDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = rightDefinition?.displayOrder ?? Number.MAX_SAFE_INTEGER

  return leftOrder - rightOrder || left.label.localeCompare(right.label)
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
