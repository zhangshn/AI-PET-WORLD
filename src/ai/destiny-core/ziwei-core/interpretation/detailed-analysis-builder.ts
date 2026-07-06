import type {
  FullZiweiChart,
  FullZiweiDynamicChart,
  FullZiweiDynamicFlow,
  FullZiweiDynamicTransformation,
  FullZiweiPalace,
  ZiweiChartDetailedAnalysis,
  ZiweiCurrentChartEvidenceChain,
  ZiweiDetailedAnalysisTone,
  ZiweiDetailedDynamicAnnualCycleStarAnalysis,
  ZiweiDetailedDynamicFlowAnalysis,
  ZiweiDetailedDynamicFlowingStarAnalysis,
  ZiweiDetailedDynamicTransformationAnalysis,
  ZiweiDetailedPalaceAnalysis,
  ZiweiDetailedPalaceRelationAnalysis,
  ZiweiDetailedPalaceRelationKind,
  ZiweiDetailedStarAnalysis,
  ZiweiPlacedStar,
  ZiweiStarCategory
} from "../contracts"
import {
  BRANCH_LABELS,
  DYNAMIC_FLOW_LABELS,
  SECTOR_LABELS,
  STAR_CATEGORY_LABELS,
  STEM_LABELS
} from "../page-view/labels"
import { getZiweiStarDefinition } from "../star-catalog"

import {
  getStarContentDetail,
  getStarPairCombinationContentDetail
} from "./content-details"
import { getZiweiSectorInterpretationProfile } from "./sector-profile-catalog"

const DETAILED_ANALYSIS_CATEGORIES = [
  "main",
  "assistant",
  "malefic",
  "transformation",
  "misc"
] as const satisfies readonly ZiweiStarCategory[]

const FAVORABLE_BRIGHTNESS_LEVELS = new Set(["miao", "wang", "de", "li"])
const PRESSURE_BRIGHTNESS_LEVELS = new Set(["bu", "xian"])

export function buildZiweiChartDetailedAnalysis(params: {
  chart: FullZiweiChart
  dynamicChart?: FullZiweiDynamicChart
}): ZiweiChartDetailedAnalysis {
  const chart = params.chart
  const palaceAnalyses = chart.palaces.map((palace) => {
    return buildDetailedPalaceAnalysis(palace, chart.palaces)
  })
  const dynamicFlowAnalyses = buildDetailedDynamicFlowAnalyses(
    params.dynamicChart
  )
  const currentEvidenceChains = buildCurrentChartEvidenceChains({
    chart,
    palaceAnalyses,
    dynamicFlowAnalyses
  })
  const analyzedStarCount = palaceAnalyses.reduce((sum, palace) => {
    return sum + palace.starAnalyses.length
  }, 0)
  const supportedCategoryCount = DETAILED_ANALYSIS_CATEGORIES.reduce(
    (sum, category) => sum + chart.summary.starCountsByCategory[category],
    0
  )
  const lifePalace = palaceAnalyses.find((palace) => {
    return palace.palaceRoles.includes("命宫")
  })
  const bodyPalace = palaceAnalyses.find((palace) => {
    return palace.palaceRoles.includes("身宫")
  })

  return {
    overviewLines: buildOverviewLines(chart, palaceAnalyses),
    lifePalaceLines: buildFocusPalaceLines("命宫", lifePalace),
    bodyPalaceLines: buildFocusPalaceLines("身宫", bodyPalace),
    evidenceSummaryLines: buildEvidenceSummaryLines(currentEvidenceChains),
    currentEvidenceChains,
    palaceAnalyses,
    dynamicFlowAnalyses,
    debug: {
      palaceCount: palaceAnalyses.length,
      analyzedStarCount,
      unsupportedStarCount: supportedCategoryCount - analyzedStarCount,
      evidenceChainCount: currentEvidenceChains.length,
      dynamicFlowCount: dynamicFlowAnalyses.length,
      activeDynamicFlowCount: dynamicFlowAnalyses.filter((flow) => {
        return flow.isActive
      }).length,
      supportedCategories: [...DETAILED_ANALYSIS_CATEGORIES]
    }
  }
}

function buildDetailedPalaceAnalysis(
  palace: FullZiweiPalace,
  palaces: FullZiweiPalace[]
): ZiweiDetailedPalaceAnalysis {
  const starAnalyses = DETAILED_ANALYSIS_CATEGORIES.flatMap((category) => {
    return palace.stars[category].flatMap((star) => {
      const analysis = buildDetailedStarAnalysis(star)

      return analysis ? [analysis] : []
    })
  })
  const palaceRoles = [
    palace.isLifePalace ? "命宫" : "",
    palace.isBodyPalace ? "身宫" : ""
  ].filter(Boolean)
  const relationAnalyses = buildRelationAnalyses(palace, palaces)

  return {
    branch: palace.branch,
    sectorName: palace.sectorName,
    branchLabel: BRANCH_LABELS[palace.branch],
    sectorLabel: SECTOR_LABELS[palace.sectorName],
    palaceRoles,
    starCount: starAnalyses.length,
    palaceThemeLines: buildPalaceThemeLines(palace, palaceRoles),
    categorySummaryLines: buildCategorySummaryLines(palace),
    combinationLines: buildPalaceCombinationLines(palace, starAnalyses),
    trineSquareCombinationLines: buildTrineSquareCombinationLines(
      palace,
      relationAnalyses
    ),
    mainAxisLines: buildPalaceToneLines(starAnalyses, "core"),
    supportLines: buildPalaceToneLines(starAnalyses, "support"),
    pressureLines: buildPalaceToneLines(starAnalyses, "pressure"),
    dynamicLines: buildPalaceToneLines(starAnalyses, "dynamic"),
    detailLines: buildPalaceToneLines(starAnalyses, "detail"),
    brightnessLines: buildBrightnessLines(starAnalyses),
    relationLines: buildRelationLines(relationAnalyses),
    reviewGapLines: buildReviewGapLines(palace, starAnalyses),
    relationAnalyses,
    starAnalyses
  }
}

function buildDetailedStarAnalysis(
  star: ZiweiPlacedStar
): ZiweiDetailedStarAnalysis | null {
  const detail = getStarContentDetail(star.starId)

  if (!detail) {
    return null
  }

  const targetDefinition = star.targetStarId
    ? getZiweiStarDefinition(star.targetStarId)
    : null
  const tone = getStarAnalysisTone(star)

  return {
    starId: star.starId,
    label: star.label,
    category: star.category,
    categoryLabel: STAR_CATEGORY_LABELS[star.category],
    tone,
    brightnessLevel: star.brightness?.level,
    brightnessLabel: star.brightness?.label,
    targetStarId: star.targetStarId,
    targetStarLabel: targetDefinition?.label,
    coreThemes: detail.coreThemes,
    strengths: detail.strengths,
    risks: detail.risks,
    analysisLines: buildStarAnalysisLines(star, detail.nature, tone),
    sourceRuleIds: [star.placementRuleId]
  }
}

function getStarAnalysisTone(star: ZiweiPlacedStar): ZiweiDetailedAnalysisTone {
  if (star.category === "main") {
    return "core"
  }

  if (star.category === "assistant") {
    return "support"
  }

  if (star.category === "malefic") {
    return "pressure"
  }

  if (star.category === "transformation") {
    return star.starId === "ziwei.transformation.huaji"
      ? "pressure"
      : "dynamic"
  }

  if (star.category === "misc") {
    return "detail"
  }

  return "neutral"
}

function buildStarAnalysisLines(
  star: ZiweiPlacedStar,
  nature: string,
  tone: ZiweiDetailedAnalysisTone
): string[] {
  const brightnessText = star.brightness
    ? `亮度为${star.brightness.label}，用于判断该星曜在本宫发挥是否顺畅、是否有耗弱或偏折。`
    : "当前星曜没有独立亮度表，按类别含义补充观察。"
  const targetText = star.targetStarId
    ? `四化目标为${getZiweiStarDefinition(star.targetStarId)?.label ?? "目标星"}。`
    : ""

  return [
    `${star.label}属于${STAR_CATEGORY_LABELS[star.category]}，本层定位为${getToneLabel(tone)}。`,
    nature,
    brightnessText,
    targetText,
    `读${star.label}时先看本宫主题，再看同宫星曜是否补强或牵制，最后并入对宫、三方四正和四化来源复核。`
  ].filter(Boolean)
}

function buildPalaceToneLines(
  starAnalyses: ZiweiDetailedStarAnalysis[],
  tone: ZiweiDetailedAnalysisTone
): string[] {
  return starAnalyses
    .filter((analysis) => analysis.tone === tone)
    .flatMap((analysis) => {
      return [
        `${analysis.label}：核心主题为${analysis.coreThemes.join("、")}。`,
        ...analysis.strengths.slice(0, 2).map((line) => {
          return `可用处：${line}。`
        }),
        ...analysis.risks.slice(0, 2).map((line) => {
          return `复核处：${line}。`
        })
      ]
    })
}

function buildPalaceThemeLines(
  palace: FullZiweiPalace,
  palaceRoles: string[]
): string[] {
  const sectorProfile = getZiweiSectorInterpretationProfile(palace.sectorName)
  const roleText =
    palaceRoles.length > 0 ? `本宫同时是${palaceRoles.join("、")}。` : "本宫不是命身宫。"

  return [
    `${BRANCH_LABELS[palace.branch]}${SECTOR_LABELS[palace.sectorName]}主题：${sectorProfile.focus}。`,
    sectorProfile.summary,
    roleText
  ]
}

function buildCategorySummaryLines(palace: FullZiweiPalace): string[] {
  return DETAILED_ANALYSIS_CATEGORIES.map((category) => {
    const stars = palace.stars[category]

    if (stars.length === 0) {
      return `${STAR_CATEGORY_LABELS[category]}：无。`
    }

    return `${STAR_CATEGORY_LABELS[category]}：${stars.map((star) => star.label).join("、")}。`
  })
}

function buildPalaceCombinationLines(
  palace: FullZiweiPalace,
  starAnalyses: ZiweiDetailedStarAnalysis[]
): string[] {
  const lines: string[] = []
  const mainStars = palace.stars.main
  const assistantStars = palace.stars.assistant
  const maleficStars = palace.stars.malefic
  const transformationStars = palace.stars.transformation
  const miscStars = palace.stars.misc
  const huaJiStars = transformationStars.filter(isHuaJiStar)
  const favorableBrightnessStars = starAnalyses.filter((analysis) => {
    return (
      analysis.brightnessLevel &&
      FAVORABLE_BRIGHTNESS_LEVELS.has(analysis.brightnessLevel)
    )
  })
  const pressureBrightnessStars = starAnalyses.filter((analysis) => {
    return (
      analysis.brightnessLevel &&
      PRESSURE_BRIGHTNESS_LEVELS.has(analysis.brightnessLevel)
    )
  })

  if (mainStars.length === 0) {
    lines.push(
      "本宫无主星，同宫组合不能单独定轴，需要借对宫主星、三方四正星曜和四化落点来补主轴。"
    )
  } else if (mainStars.length === 1) {
    lines.push(
      `本宫以${mainStars[0].label}为主轴，先看该星在${SECTOR_LABELS[palace.sectorName]}的宫位主题，再看同宫辅煞杂曜如何增减力量。`
    )
  } else {
    lines.push(
      `本宫主星同宫为${mainStars.map((star) => star.label).join("、")}，判断时要分清主导星、修饰星和彼此牵制，不宜把含义简单相加。`
    )
  }

  if (assistantStars.length > 0) {
    lines.push(
      `同宫辅曜为${assistantStars.map((star) => star.label).join("、")}，用于观察贵人、文书、秩序、协调、名位或资源承接；辅曜越能贴合宫位主题，主星越容易落实。`
    )
  } else {
    lines.push("同宫未见辅曜，本宫助力不宜直接放大，需要转看三方四正是否有左辅右弼、文昌文曲、天魁天钺等支援。")
  }

  if (maleficStars.length > 0 || huaJiStars.length > 0) {
    const pressureLabels = [
      ...maleficStars.map((star) => star.label),
      ...huaJiStars.map(formatTransformationLabel)
    ]
    lines.push(
      `同宫压力来自${pressureLabels.join("、")}，表示阻滞、冲突、耗损、反复或破格风险；需同时看庙旺落陷、吉曜制化和三方是否有解救。`
    )
  } else {
    lines.push("同宫未见煞曜或化忌压力线，本宫不代表完全无波折，只是压力重点需要转看对宫、三方四正和动态盘层。")
  }

  if (transformationStars.length > 0) {
    lines.push(
      `同宫四化为${transformationStars.map(formatTransformationLabel).join("、")}，用于判断资源流入、权责推动、名誉修饰或阻滞牵挂，不能当作普通杂曜处理。`
    )
  }

  if (miscStars.length > 0) {
    lines.push(
      `同宫杂曜为${miscStars.map((star) => star.label).join("、")}，主要补充事件质地、细节气候和吉凶边缘，不单独取代主星判断。`
    )
  }

  if (favorableBrightnessStars.length > 0) {
    lines.push(
      `庙旺得利星曜为${favorableBrightnessStars.map(formatDetailedStarBrightness).join("、")}，表示相应星性较有发挥空间。`
    )
  }

  if (pressureBrightnessStars.length > 0) {
    lines.push(
      `陷弱星曜为${pressureBrightnessStars.map(formatDetailedStarBrightness).join("、")}，表示相应星性需要降权或复核受制位置。`
    )
  }

  lines.push(
    `同宫组合结论：${SECTOR_LABELS[palace.sectorName]}宫先以主星定主题，辅曜看可用条件，煞忌看破损处，四化看流动方向，杂曜看细节应象。`
  )

  return lines
}

function buildTrineSquareCombinationLines(
  palace: FullZiweiPalace,
  relationAnalyses: ZiweiDetailedPalaceRelationAnalysis[]
): string[] {
  const opposite = relationAnalyses.find((relation) => {
    return relation.kind === "opposite"
  })
  const trines = relationAnalyses.filter((relation) => {
    return relation.kind === "trine"
  })
  const trineMainLabels = trines.flatMap((relation) => {
    return relation.mainStarLabels.map((label) => {
      return `${relation.sectorLabel}${label}`
    })
  })
  const trineAssistantLabels = trines.flatMap((relation) => {
    return relation.assistantStarLabels.map((label) => {
      return `${relation.sectorLabel}${label}`
    })
  })
  const trinePressureLabels = trines.flatMap((relation) => {
    return relation.pressureStarLabels.map((label) => {
      return `${relation.sectorLabel}${label}`
    })
  })
  const trineTransformationLabels = trines.flatMap((relation) => {
    return relation.transformationLabels.map((label) => {
      return `${relation.sectorLabel}${label}`
    })
  })
  const lines: string[] = []

  if (opposite) {
    lines.push(
      `对宫为${opposite.sectorLabel}${opposite.branchLabel}，主星${formatLabels(opposite.mainStarLabels)}，用于冲照本宫、补足无主星信息，并观察外部对象与环境反馈。`
    )
    if (opposite.pressureStarLabels.length > 0) {
      lines.push(
        `对宫压力为${opposite.pressureStarLabels.join("、")}，会把拉扯、阻力或外部成本带回本宫主题，需要与本宫煞忌同看。`
      )
    }
    if (opposite.transformationLabels.length > 0) {
      lines.push(
        `对宫四化为${opposite.transformationLabels.join("、")}，代表外部条件或对象端出现资源、权责、名誉、阻滞的变化。`
      )
    }
  }

  lines.push(
    `三方宫位为${trines.map((relation) => `${relation.sectorLabel}${relation.branchLabel}`).join("、")}，共同决定${SECTOR_LABELS[palace.sectorName]}宫的资源来源、结构支撑和成败层次。`
  )

  if (trineMainLabels.length > 0) {
    lines.push(
      `三方主星会照为${trineMainLabels.join("、")}，这些主轴会参与本宫格局，不应只看本宫单点。`
    )
  } else {
    lines.push("三方未见可用主星标签，格局主轴需优先回看本宫和对宫。")
  }

  if (trineAssistantLabels.length > 0) {
    lines.push(
      `三方辅曜会照为${trineAssistantLabels.join("、")}，可形成拱照、夹助、文贵、协力或资源补强。`
    )
  }

  if (trinePressureLabels.length > 0) {
    lines.push(
      `三方煞忌会照为${trinePressureLabels.join("、")}，会影响格局成色，需复核是否形成冲破、夹煞、羊陀火铃、空劫耗损或化忌牵制。`
    )
  }

  if (trineTransformationLabels.length > 0) {
    lines.push(
      `三方四化会照为${trineTransformationLabels.join("、")}，用于判断资源流向、权责落点、名誉修饰和阻滞来源。`
    )
  }

  lines.push(
    "三方四正组合结论：本宫只定直接主题，对宫定冲照对象，三方定结构来源；吉曜成格要看是否被煞忌破坏，煞忌成压也要看是否有吉化与庙旺制解。"
  )

  return lines
}

function buildBrightnessLines(
  starAnalyses: ZiweiDetailedStarAnalysis[]
): string[] {
  return starAnalyses.flatMap((analysis) => {
    if (!analysis.brightnessLevel || !analysis.brightnessLabel) {
      return []
    }

    if (FAVORABLE_BRIGHTNESS_LEVELS.has(analysis.brightnessLevel)) {
      return [`${analysis.label}亮度为${analysis.brightnessLabel}，星性较易发挥。`]
    }

    if (PRESSURE_BRIGHTNESS_LEVELS.has(analysis.brightnessLevel)) {
      return [`${analysis.label}亮度为${analysis.brightnessLabel}，需复核受阻、耗弱或落陷表现。`]
    }

    return [`${analysis.label}亮度为${analysis.brightnessLabel}，按平稳状态观察。`]
  })
}

function buildReviewGapLines(
  palace: FullZiweiPalace,
  starAnalyses: ZiweiDetailedStarAnalysis[]
): string[] {
  const lines: string[] = []
  const mainStars = palace.stars.main
  const assistantStars = palace.stars.assistant
  const pressureStars = starAnalyses.filter((analysis) => {
    return analysis.tone === "pressure"
  })
  const transformationStars = palace.stars.transformation
  const miscStars = palace.stars.misc
  const brightnessStars = starAnalyses.filter((analysis) => {
    return Boolean(analysis.brightnessLevel)
  })

  if (mainStars.length === 0) {
    lines.push("主星缺口：本宫无主星，需结合对宫、三方四正与借宫信息复核主轴。")
  } else {
    lines.push(`主星复核：本宫主星为${mainStars.map((star) => star.label).join("、")}，先按主星主轴定调。`)
  }

  if (assistantStars.length === 0) {
    lines.push("助力缺口：本宫未见辅曜，助力来源需转看三方四正或动态流。")
  } else {
    lines.push(`助力复核：本宫辅曜为${assistantStars.map((star) => star.label).join("、")}，可观察外部支持与协作条件。`)
  }

  if (pressureStars.length === 0) {
    lines.push("压力复核：本宫未见已纳入详细分析的煞曜或化忌压力线。")
  } else {
    lines.push(`压力复核：本宫压力线来自${pressureStars.map((star) => star.label).join("、")}，需结合庙旺落陷与制化。`)
  }

  if (transformationStars.length === 0) {
    lines.push("四化缺口：本宫未见四化落点，动态变化需转看相关目标宫位。")
  } else {
    lines.push(`四化复核：本宫四化为${transformationStars.map((star) => star.label).join("、")}，需观察目标星与宫位主题。`)
  }

  if (miscStars.length === 0) {
    lines.push("杂曜缺口：本宫未见已纳入内容库的杂曜，细节补充较少。")
  } else {
    lines.push(`杂曜复核：本宫杂曜为${miscStars.map((star) => star.label).join("、")}，用于补充喜庆、桃花、孤寡、名位或耗损细节。`)
  }

  if (brightnessStars.length === 0) {
    lines.push("亮度缺口：本宫当前分析星曜没有可用庙旺落陷数据。")
  } else {
    lines.push(`亮度复核：本宫${brightnessStars.length}颗星有庙旺落陷数据，可用于判断发挥层次。`)
  }

  return lines
}

function buildRelationAnalyses(
  palace: FullZiweiPalace,
  palaces: FullZiweiPalace[]
): ZiweiDetailedPalaceRelationAnalysis[] {
  const relationBranches: {
    kind: ZiweiDetailedPalaceRelationKind
    branch: FullZiweiPalace["branch"]
  }[] = [
    { kind: "self", branch: palace.branch },
    { kind: "opposite", branch: palace.oppositeBranch },
    ...palace.trineBranches.map((branch) => {
      return { kind: "trine" as const, branch }
    }),
    ...getAdjacentBranches(palace.branch).map((branch) => {
      return { kind: "adjacent" as const, branch }
    })
  ]

  return relationBranches.map((relation) => {
    const relatedPalace = findPalace(palaces, relation.branch)
    const mainStars = relatedPalace.stars.main
    const assistantStars = relatedPalace.stars.assistant
    const pressureStars = [
      ...relatedPalace.stars.malefic,
      ...relatedPalace.stars.transformation.filter((star) => {
        return star.starId === "ziwei.transformation.huaji"
      })
    ]
    const transformationStars = relatedPalace.stars.transformation
    const sourceRuleIds = Array.from(
      new Set(
        DETAILED_ANALYSIS_CATEGORIES.flatMap((category) => {
          return relatedPalace.stars[category].map((star) => star.placementRuleId)
        })
      )
    )

    return {
      kind: relation.kind,
      kindLabel: getRelationKindLabel(relation.kind),
      branch: relatedPalace.branch,
      branchLabel: BRANCH_LABELS[relatedPalace.branch],
      sectorName: relatedPalace.sectorName,
      sectorLabel: SECTOR_LABELS[relatedPalace.sectorName],
      starCount: DETAILED_ANALYSIS_CATEGORIES.reduce((sum, category) => {
        return sum + relatedPalace.stars[category].length
      }, 0),
      mainStarLabels: mainStars.map((star) => star.label),
      assistantStarLabels: assistantStars.map((star) => star.label),
      pressureStarLabels: pressureStars.map((star) => star.label),
      transformationLabels: transformationStars.map(formatTransformationLabel),
      summaryLines: buildRelationSummaryLines(relation.kind, relatedPalace, {
        mainStars,
        assistantStars,
        pressureStars,
        transformationStars
      }),
      sourceRuleIds
    }
  })
}

function buildRelationLines(
  relationAnalyses: ZiweiDetailedPalaceRelationAnalysis[]
): string[] {
  return relationAnalyses.flatMap((relation) => {
    return [
      `${relation.kindLabel}：${relation.sectorLabel}${relation.branchLabel}，主星 ${formatLabels(relation.mainStarLabels)}，助力 ${formatLabels(relation.assistantStarLabels)}，压力 ${formatLabels(relation.pressureStarLabels)}，四化 ${formatLabels(relation.transformationLabels)}。`,
      ...relation.summaryLines.slice(0, 1)
    ]
  })
}

function buildRelationSummaryLines(
  kind: ZiweiDetailedPalaceRelationKind,
  palace: FullZiweiPalace,
  groups: {
    mainStars: ZiweiPlacedStar[]
    assistantStars: ZiweiPlacedStar[]
    pressureStars: ZiweiPlacedStar[]
    transformationStars: ZiweiPlacedStar[]
  }
): string[] {
  return [
    `${getRelationKindLabel(kind)}${SECTOR_LABELS[palace.sectorName]}用于观察${getRelationFocus(kind)}。`,
    groups.mainStars.length > 0
      ? `主星牵动：${groups.mainStars.map((star) => star.label).join("、")}。`
      : "主星牵动：无主星，需借关系宫其它星曜复核。",
    groups.assistantStars.length > 0
      ? `助力牵动：${groups.assistantStars.map((star) => star.label).join("、")}。`
      : "助力牵动：未见辅曜。",
    groups.pressureStars.length > 0
      ? `压力牵动：${groups.pressureStars.map((star) => star.label).join("、")}。`
      : "压力牵动：未见煞曜或化忌压力线。",
    groups.transformationStars.length > 0
      ? `四化牵动：${groups.transformationStars.map(formatTransformationLabel).join("、")}。`
      : "四化牵动：未见四化落点。"
  ].concat([
    kind === "self"
      ? "本宫为直接应事位置，优先判断本宫主星、同宫辅煞杂曜和四化落点。"
      : kind === "opposite"
        ? "对宫为冲照和外部反馈位置，用来观察对象、环境、拉扯和借宫补充。"
        : kind === "trine"
          ? "三方为结构会照位置，用来判断资源来源、格局支撑、煞忌压力和成败层次。"
          : "夹宫为旁侧环境位置，用来判断左右夹持、前后牵引和辅助条件。"
  ])
}

function buildOverviewLines(
  chart: FullZiweiChart,
  palaceAnalyses: ZiweiDetailedPalaceAnalysis[]
): string[] {
  const pressurePalaces = palaceAnalyses.filter((palace) => {
    return palace.pressureLines.length > 0
  })
  const dynamicPalaces = palaceAnalyses.filter((palace) => {
    return palace.dynamicLines.length > 0
  })

  return [
    `本盘共排出${chart.summary.totalStarCount}颗星曜，详细分析层当前覆盖主星、辅曜、煞曜、四化和杂曜。`,
    `命宫在${BRANCH_LABELS[chart.summary.lifePalace]}，身宫在${BRANCH_LABELS[chart.summary.bodyPalace]}，先以命身宫作为盘面主轴。`,
    "读盘顺序：先定命身，再看十二宫主星与宫位主题，然后看同宫辅煞杂曜，再合三方四正、对宫、夹宫，最后复核四化、格局、破格和动态盘层。",
    `压力观察宫位共${pressurePalaces.length}个，主要由煞曜、化忌或落陷状态触发。`,
    `动态四化观察宫位共${dynamicPalaces.length}个，用于复核资源、权责、名誉和阻滞变化。`,
    "本阶段只做紫微斗数盘面分析：所有结论必须回到落宫、星曜、庙旺、四化、三方四正和格局证据，不做盘面外映射。"
  ]
}

function buildCurrentChartEvidenceChains(params: {
  chart: FullZiweiChart
  palaceAnalyses: ZiweiDetailedPalaceAnalysis[]
  dynamicFlowAnalyses: ZiweiDetailedDynamicFlowAnalysis[]
}): ZiweiCurrentChartEvidenceChain[] {
  return [
    ...params.chart.palaces.map(buildPalaceEvidenceChain),
    ...params.chart.palaces.flatMap(buildStarEvidenceChains),
    ...params.chart.palaces.flatMap(buildSamePalaceCombinationEvidenceChains),
    ...params.palaceAnalyses.flatMap(buildPalaceRelationEvidenceChains),
    ...params.dynamicFlowAnalyses.map(buildDynamicFlowEvidenceChain),
    buildPatternBoundaryEvidenceChain()
  ]
}

function buildEvidenceSummaryLines(
  chains: ZiweiCurrentChartEvidenceChain[]
): string[] {
  const natalCount = chains.filter((chain) => chain.flowType === "natal").length
  const dynamicCount = chains.filter((chain) => chain.flowType !== "natal").length
  const palaceCount = chains.filter((chain) => {
    return chain.kind === "natal-palace"
  }).length
  const starCount = chains.filter((chain) => {
    return chain.kind === "star" || chain.kind === "transformation"
  }).length
  const transformationCount = chains.filter((chain) => {
    return chain.kind === "transformation"
  }).length
  const relationCount = chains.filter((chain) => {
    return chain.kind === "palace-relation"
  }).length
  const combinationCount = chains.filter((chain) => {
    return chain.kind === "same-palace-combination"
  }).length
  const dynamicFlowCount = chains.filter((chain) => {
    return chain.kind === "dynamic-flow"
  }).length
  const patternBoundaryCount = chains.filter((chain) => {
    return chain.kind === "pattern-boundary"
  }).length
  const dictionaryRefCount = uniqueStrings(chains.flatMap((chain) => {
    return chain.dictionaryRefs
  })).length
  const sourceRuleCount = uniqueStrings(chains.flatMap((chain) => {
    return chain.sourceRuleIds
  })).length

  return [
    `当前盘证据链共${chains.length}条，其中本命证据${natalCount}条，动态盘证据${dynamicCount}条。`,
    `宫位证据${palaceCount}条，星曜证据${starCount}条，四化证据${transformationCount}条；每一条都必须回到实际落宫，不用单星断事。`,
    `同宫组合证据${combinationCount}条，只解释当前盘真实同宫的星曜组合，不把总字典组合全部铺到当前盘。`,
    `宫位关系证据${relationCount}条，用于区分本宫、对宫、三方四正、邻宫和夹宫，不把不同关系混成同宫。`,
    `动态盘证据${dynamicFlowCount}条；大限是阶段背景，流年是年度触发，流月、流日、流时只作为短周期提醒。`,
    `格局边界证据${patternBoundaryCount}条；格局总字典只解释格局本体，当前盘只显示已命中的格局。`,
    `字典引用${dictionaryRefCount}类，规则来源${sourceRuleCount}类；解释必须保留来源线索和复核入口。`,
    "解释顺序固定为：宫位主题、星曜本体、同宫组合、对宫与三方四正、四化庙旺、动态盘层级、格局命中边界。",
    "四化解释必须标明来源天干、盘层、目标星和目标宫；四化不套庙旺落陷，只看触发方向。",
    "杂曜解释只能补充细节、气氛、触发和主题边界，不能压过主星、宫位和三方四正结构。",
    "格局结果必须由格局命中模块提供，当前证据链只承接已命中的 patternId、conditionText、matchedPalaces 和 sourceRuleIds。",
    "没有证据链的内容不得进入当前盘结论；未命中格局、未出现星曜和未触发动态层只保留在总字典。"
  ]
}

function buildPalaceEvidenceChain(
  palace: FullZiweiPalace
): ZiweiCurrentChartEvidenceChain {
  const stars = getEvidenceStars(palace)

  return {
    chainId: `current-evidence.natal-palace.${palace.branch}`,
    kind: "natal-palace",
    title: `${SECTOR_LABELS[palace.sectorName]}${BRANCH_LABELS[palace.branch]}宫位证据`,
    summary: `${SECTOR_LABELS[palace.sectorName]}宫以本宫星曜、对宫、三方四正和四化落点共同解释。`,
    flowType: "natal",
    palaceBranch: palace.branch,
    sectorName: palace.sectorName,
    starIds: stars.map((star) => star.starId),
    starLabels: stars.map((star) => star.label),
    sourceRuleIds: uniqueStrings(stars.map((star) => star.placementRuleId)),
    dictionaryRefs: [
      `palace.${palace.sectorName}`,
      ...stars.map((star) => `star.${star.starId}`)
    ],
    evidenceLines: [
      `宫位：${SECTOR_LABELS[palace.sectorName]}，地支：${BRANCH_LABELS[palace.branch]}。`,
      palace.isLifePalace ? "本宫为原盘命宫，需要作为整盘主轴证据。" : "本宫不是原盘命宫，按宫位主题进入分析。",
      palace.isBodyPalace ? "本宫同时为身宫，需要补充后天承接和行动落点。" : "本宫不是身宫，不额外承担身宫解释。",
      `本宫星曜：${formatLabels(stars.map((star) => star.label))}。`,
      `对宫地支：${BRANCH_LABELS[palace.oppositeBranch]}；三方地支：${palace.trineBranches.map((branch) => BRANCH_LABELS[branch]).join("、")}。`
    ],
    interpretationBoundary: [
      "宫位证据只说明当前宫位实际星曜和关系，不替代其它宫位结论。",
      "空宫、借宫、三方会照必须保留关系类型，不写成同宫。",
      "当前盘解释必须同时保留 sourceRuleIds 以便回查。"
    ]
  }
}

function buildStarEvidenceChains(
  palace: FullZiweiPalace
): ZiweiCurrentChartEvidenceChain[] {
  return getEvidenceStars(palace).map((star) => {
    return {
      chainId: `current-evidence.star.${palace.branch}.${star.starId}`,
      kind: star.category === "transformation" ? "transformation" : "star",
      title: `${star.label}在${SECTOR_LABELS[palace.sectorName]}${BRANCH_LABELS[palace.branch]}`,
      summary: `${star.label}属于${STAR_CATEGORY_LABELS[star.category]}，只按当前落宫和同宫关系解释。`,
      flowType: "natal",
      palaceBranch: palace.branch,
      sectorName: palace.sectorName,
      starIds: [star.starId],
      starLabels: [star.label],
      sourceRuleIds: [star.placementRuleId],
      dictionaryRefs: buildStarDictionaryRefs(star),
      evidenceLines: [
        `星曜：${star.label}，类别：${STAR_CATEGORY_LABELS[star.category]}。`,
        `落宫：${SECTOR_LABELS[palace.sectorName]}${BRANCH_LABELS[palace.branch]}。`,
        star.brightness
          ? `庙旺落陷：${star.brightness.label}；只作为该星承接强弱证据。`
          : "本星没有可用庙旺落陷资料，不硬套亮度。",
        star.targetStarId
          ? `四化目标星：${getZiweiStarDefinition(star.targetStarId)?.label ?? star.targetStarId}。`
          : "本星不是四化目标记录。",
        `同宫其它星曜：${formatLabels(getEvidenceStars(palace).filter((item) => item.starId !== star.starId).map((item) => item.label))}。`
      ],
      interpretationBoundary: [
        "单颗星不能独立推出整盘结论，必须回到宫位主题、同宫组合和三方四正。",
        "四化必须标明来源盘层和目标星，不当成星曜庙旺。",
        "杂曜与周期星只作细节或时间提示，不替代主星。"
      ]
    }
  })
}

function buildSamePalaceCombinationEvidenceChains(
  palace: FullZiweiPalace
): ZiweiCurrentChartEvidenceChain[] {
  const stars = [
    ...palace.stars.main,
    ...palace.stars.assistant,
    ...palace.stars.malefic,
    ...palace.stars.misc
  ]

  return stars.flatMap((starA, starAIndex) => {
    return stars.slice(starAIndex + 1).map((starB) => {
      const pairDetail = getStarPairCombinationContentDetail(starA.starId, starB.starId)
      const pairRef =
        pairDetail?.combinationId ?? `star-pair.${starA.starId}.${starB.starId}`

      return {
        chainId: `current-evidence.same-palace.${palace.branch}.${starA.starId}.${starB.starId}`,
        kind: "same-palace-combination",
        title: `${starA.label}${starB.label}同宫组合`,
        summary: `${starA.label}与${starB.label}同落${SECTOR_LABELS[palace.sectorName]}${BRANCH_LABELS[palace.branch]}，按同宫组合进入当前盘证据。`,
        flowType: "natal",
        palaceBranch: palace.branch,
        sectorName: palace.sectorName,
        starIds: [starA.starId, starB.starId],
        starLabels: [starA.label, starB.label],
        sourceRuleIds: uniqueStrings([starA.placementRuleId, starB.placementRuleId]),
        dictionaryRefs: [pairRef, `palace.${palace.sectorName}`],
        evidenceLines: [
          `组合：${starA.label}、${starB.label}。`,
          `关系：同宫，位置：${SECTOR_LABELS[palace.sectorName]}${BRANCH_LABELS[palace.branch]}。`,
          pairDetail
            ? `组合类别：${pairDetail.groupRole}`
            : "组合字典未补专条，按两星本体和同宫关系复核。",
          "同宫权重高于会照，但仍需看对宫、三方四正、四化和庙旺是否支援或破坏。"
        ],
        interpretationBoundary: [
          "同宫组合只能解释该宫主题，不自动扩展到整盘所有宫位。",
          "辅曜、煞曜、杂曜组合必须降权依附主星和宫位主题。",
          "若该组合参与格局，仍需格局命中模块提供 patternId 和 conditionText。"
        ]
      } satisfies ZiweiCurrentChartEvidenceChain
    })
  })
}

function buildPalaceRelationEvidenceChains(
  palace: ZiweiDetailedPalaceAnalysis
): ZiweiCurrentChartEvidenceChain[] {
  return palace.relationAnalyses
    .filter((relation) => relation.kind !== "self")
    .map((relation) => {
      return {
        chainId: `current-evidence.relation.${palace.branch}.${relation.kind}.${relation.branch}`,
        kind: "palace-relation",
        title: `${palace.sectorLabel}${palace.branchLabel}与${relation.kindLabel}${relation.sectorLabel}${relation.branchLabel}`,
        summary: `${relation.kindLabel}用于说明本宫与${relation.sectorLabel}之间的牵引、支援或压力。`,
        flowType: "natal",
        palaceBranch: palace.branch,
        sectorName: palace.sectorName,
        relationKind: relation.kind,
        starIds: [],
        starLabels: [
          ...relation.mainStarLabels,
          ...relation.assistantStarLabels,
          ...relation.pressureStarLabels,
          ...relation.transformationLabels
        ],
        sourceRuleIds: relation.sourceRuleIds,
        dictionaryRefs: [
          `palace.${palace.sectorName}`,
          `palace.${relation.sectorName}`,
          `relation.${relation.kind}`
        ],
        evidenceLines: [
          `本宫：${palace.sectorLabel}${palace.branchLabel}。`,
          `关系宫：${relation.kindLabel}${relation.sectorLabel}${relation.branchLabel}。`,
          `主星：${formatLabels(relation.mainStarLabels)}；助力：${formatLabels(relation.assistantStarLabels)}；压力：${formatLabels(relation.pressureStarLabels)}。`,
          `四化：${formatLabels(relation.transformationLabels)}。`
        ],
        interpretationBoundary: [
          "对宫、三方四正和夹宫不能写成同宫。",
          "关系宫只提供结构支援或压力，最终仍要回到本宫主题。",
          "三方四正若同时有加吉和加煞，必须进入冲突复核。"
        ]
      }
    })
}

function buildDynamicFlowEvidenceChain(
  flow: ZiweiDetailedDynamicFlowAnalysis
): ZiweiCurrentChartEvidenceChain {
  const starIds = [
    ...flow.flowingStars.map((star) => star.starId),
    ...flow.annualCycleStars.map((star) => star.starId),
    ...flow.transformations.map((transformation) => transformation.transformationStarId)
  ]
  const starLabels = [
    ...flow.flowingStars.map((star) => star.label),
    ...flow.annualCycleStars.map((star) => star.label),
    ...flow.transformations.map((transformation) => {
      return `${transformation.transformationLabel}${transformation.targetStarLabel}`
    })
  ]

  return {
    chainId: `current-evidence.dynamic-flow.${flow.type}`,
    kind: "dynamic-flow",
    title: `${flow.typeLabel}动态盘证据`,
    summary: `${flow.typeLabel}落${flow.sectorLabel}${flow.branchLabel}，只解释该动态层级的时间触发。`,
    flowType: flow.type,
    palaceBranch: flow.palace,
    sectorName: flow.sectorName,
    starIds,
    starLabels,
    sourceRuleIds: flow.sourceRuleIds,
    dictionaryRefs: [
      `dynamic-flow.${flow.type}`,
      `palace.${flow.sectorName}`,
      ...flow.transformations.map((transformation) => {
        return `transformation-target.${transformation.transformationStarId}.${transformation.targetStarId}`
      })
    ],
    evidenceLines: [
      `盘层：${flow.typeLabel}；状态：${flow.isActive ? "启用" : "未启用"}。`,
      `动态命宫：${flow.sectorLabel}${flow.branchLabel}。`,
      `流曜：${formatLabels(flow.flowingStars.map((star) => star.label))}。`,
      `年系星：${formatLabels(flow.annualCycleStars.map((star) => star.label))}。`,
      `四化：${formatLabels(flow.transformations.map((item) => `${item.transformationLabel}${item.targetStarLabel}`))}。`
    ],
    interpretationBoundary: [
      "动态盘必须继承本命和上级盘层，不反推为本命固定结构。",
      "大限为十年阶段，流年为年度触发，流月、流日、流时只作短周期提示。",
      "动态四化必须保留来源天干、目标星和盘层。"
    ]
  }
}

function buildPatternBoundaryEvidenceChain(): ZiweiCurrentChartEvidenceChain {
  return {
    chainId: "current-evidence.pattern-boundary",
    kind: "pattern-boundary",
    title: "格局命中边界",
    summary: "格局总字典只解释格局本身；当前盘只显示命中的格局，并用命中证据链解释。",
    flowType: "natal",
    starIds: [],
    starLabels: [],
    sourceRuleIds: ["project.pattern-catalog"],
    dictionaryRefs: ["pattern.dictionary", "pattern.condition", "pattern.hit-only-display"],
    evidenceLines: [
      "格局命中必须来自 patternId、conditionText、matchedPalaces 和 sourceRuleIds。",
      "未命中的格局隐藏在当前盘结果之外，只保留总字典和复核资料。",
      "格局解释要结合本命盘、宫位、星曜组合、四化、三方四正和动态层级。"
    ],
    interpretationBoundary: [
      "不把总字典中的格局说明当成当前盘命中结果。",
      "不显示未命中格局。",
      "不做人格化或行为映射。"
    ]
  }
}

function getEvidenceStars(palace: FullZiweiPalace): ZiweiPlacedStar[] {
  return DETAILED_ANALYSIS_CATEGORIES.flatMap((category) => palace.stars[category])
}

function buildStarDictionaryRefs(star: ZiweiPlacedStar): string[] {
  const refs = [`star.${star.starId}`]

  if (star.category === "transformation" && star.targetStarId) {
    refs.push(`transformation-target.${star.starId}.${star.targetStarId}`)
  }

  return refs
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function buildDetailedDynamicFlowAnalyses(
  dynamicChart: FullZiweiDynamicChart | undefined
): ZiweiDetailedDynamicFlowAnalysis[] {
  return (dynamicChart?.flows ?? []).map(buildDetailedDynamicFlowAnalysis)
}

function buildDetailedDynamicFlowAnalysis(
  flow: FullZiweiDynamicFlow
): ZiweiDetailedDynamicFlowAnalysis {
  const transformations = flow.transformations.map(
    buildDetailedDynamicTransformationAnalysis
  )
  const flowingStars = flow.flowingStars.map(buildDetailedDynamicFlowingStarAnalysis)
  const annualCycleStars = flow.annualCycleStars.map(
    buildDetailedDynamicAnnualCycleStarAnalysis
  )
  const sourceRuleIds = Array.from(
    new Set([
      ...flow.stars.map((star) => star.placementRuleId),
      ...flow.flowingStars.map((star) => star.placementRuleId),
      ...flow.annualCycleStars.map((star) => star.placementRuleId),
      ...flow.transformations.map((item) => item.placementRuleId)
    ])
  )

  return {
    type: flow.type,
    typeLabel: DYNAMIC_FLOW_LABELS[flow.type],
    palace: flow.palace,
    branchLabel: BRANCH_LABELS[flow.palace],
    sectorName: flow.sectorName,
    sectorLabel: SECTOR_LABELS[flow.sectorName],
    stem: flow.stem,
    stemLabel: STEM_LABELS[flow.stem],
    stemSource: flow.stemSource,
    stemSourceLabel: getDynamicStemSourceLabel(flow.stemSource),
    influence: flow.influence,
    isActive: flow.isActive,
    inactiveReason: flow.inactiveReason,
    starCount:
      flow.stars.length + flow.flowingStars.length + flow.annualCycleStars.length,
    flowingStarCount: flowingStars.length,
    annualCycleStarCount: annualCycleStars.length,
    transformationCount: transformations.length,
    sourceRuleIds,
    overviewLines: buildDynamicOverviewLines(flow),
    palaceLines: buildDynamicPalaceLines(flow),
    flowingStarLines: buildDynamicFlowingStarLines(flow),
    annualCycleLines: buildDynamicAnnualCycleLines(flow),
    transformationLines: buildDynamicTransformationLines(transformations),
    reviewLines: buildDynamicReviewLines(flow, transformations),
    flowingStars,
    annualCycleStars,
    transformations
  }
}

function buildDetailedDynamicAnnualCycleStarAnalysis(
  star: ZiweiPlacedStar
): ZiweiDetailedDynamicAnnualCycleStarAnalysis {
  return {
    ...buildDetailedDynamicFlowingStarAnalysis(star),
    cycleLabel: getAnnualCycleLabel(star.placementRuleId)
  }
}

function buildDetailedDynamicFlowingStarAnalysis(
  star: ZiweiPlacedStar
): ZiweiDetailedDynamicFlowingStarAnalysis {
  return {
    starId: star.starId,
    label: star.label,
    branch: star.branch,
    branchLabel: BRANCH_LABELS[star.branch],
    sectorName: star.sectorName,
    sectorLabel: SECTOR_LABELS[star.sectorName],
    category: star.category,
    sourceRuleId: star.placementRuleId
  }
}

function buildDetailedDynamicTransformationAnalysis(
  transformation: FullZiweiDynamicTransformation
): ZiweiDetailedDynamicTransformationAnalysis {
  return {
    transformationStarId: transformation.transformationStarId,
    transformationLabel: transformation.transformationLabel,
    targetStarId: transformation.targetStarId,
    targetStarLabel: transformation.targetStarLabel,
    branch: transformation.branch,
    branchLabel: BRANCH_LABELS[transformation.branch],
    sectorName: transformation.sectorName,
    sectorLabel: SECTOR_LABELS[transformation.sectorName],
    summaryLines: [
      `${transformation.transformationLabel}作用于${transformation.targetStarLabel}，落在${BRANCH_LABELS[transformation.branch]}${SECTOR_LABELS[transformation.sectorName]}。`,
      "四化解释需回到目标星、落宫主题、原盘承接和当前动态层共同判断。"
    ],
    sourceRuleIds: [transformation.placementRuleId]
  }
}

function buildDynamicOverviewLines(flow: FullZiweiDynamicFlow): string[] {
  const activeText = flow.isActive
    ? "当前启用，可纳入本期盘面复核。"
    : `当前未启用，原因：${flow.inactiveReason ?? "未满足启用条件"}。`

  return [
    `${DYNAMIC_FLOW_LABELS[flow.type]}落${BRANCH_LABELS[flow.palace]}${SECTOR_LABELS[flow.sectorName]}，影响权重为${flow.influence.toFixed(2)}。`,
    `${DYNAMIC_FLOW_LABELS[flow.type]}流干为${STEM_LABELS[flow.stem]}，来源为${getDynamicStemSourceLabel(flow.stemSource)}。`,
    activeText
  ]
}

function buildDynamicPalaceLines(flow: FullZiweiDynamicFlow): string[] {
  const starLabels = flow.stars.map((star) => star.label)

  return [
    starLabels.length > 0
      ? `${DYNAMIC_FLOW_LABELS[flow.type]}落宫可见星曜：${starLabels.join("、")}。`
      : `${DYNAMIC_FLOW_LABELS[flow.type]}落宫当前无额外星曜。`,
    `本流落宫主题为${SECTOR_LABELS[flow.sectorName]}，需回看本命同宫、对宫和三方四正承接。`,
    `${DYNAMIC_FLOW_LABELS[flow.type]}只说明当前时间层触发，不覆盖原盘；大限看阶段，流年看年度，流月流日流时看短期应事。`
  ]
}

function buildDynamicFlowingStarLines(flow: FullZiweiDynamicFlow): string[] {
  if (flow.flowingStars.length === 0) {
    return [`${DYNAMIC_FLOW_LABELS[flow.type]}暂无额外流星落点。`]
  }

  return flow.flowingStars.map((star) => {
    return `${DYNAMIC_FLOW_LABELS[flow.type]}${star.label}落${BRANCH_LABELS[star.branch]}${SECTOR_LABELS[star.sectorName]}，用于补充该时间层的宫位触发。`
  })
}

function buildDynamicAnnualCycleLines(flow: FullZiweiDynamicFlow): string[] {
  if (flow.annualCycleStars.length === 0) {
    return [`${DYNAMIC_FLOW_LABELS[flow.type]}暂无年系十二神落点。`]
  }

  return flow.annualCycleStars.map((star) => {
    return `${DYNAMIC_FLOW_LABELS[flow.type]}${getAnnualCycleLabel(star.placementRuleId)}${star.label}落${BRANCH_LABELS[star.branch]}${SECTOR_LABELS[star.sectorName]}，用于判断岁运、事务气候和短期触发。`
  })
}

function getAnnualCycleLabel(ruleId: string): string {
  if (ruleId.includes(".boshi.")) return "博士十二神"
  if (ruleId.includes(".suiqian.")) return "岁前十二神"
  if (ruleId.includes(".jiangqian.")) return "将前十二神"
  return "年系十二神"
}

function buildDynamicTransformationLines(
  transformations: ZiweiDetailedDynamicTransformationAnalysis[]
): string[] {
  if (transformations.length === 0) {
    return ["本流未形成四化明细，动态变化以落宫和流干来源为主。"]
  }

  return transformations.flatMap((transformation) => {
    return transformation.summaryLines
  })
}

function buildDynamicReviewLines(
  flow: FullZiweiDynamicFlow,
  transformations: ZiweiDetailedDynamicTransformationAnalysis[]
): string[] {
  const huaJi = transformations.find((transformation) => {
    return transformation.transformationStarId === "ziwei.transformation.huaji"
  })
  const activeLine = flow.isActive
    ? "启用复核：本流已进入当前动态层，可与本命盘详细分析同看。"
    : "启用复核：本流暂未启用，只保留落宫、流干和四化资料，不作为当前重点。"

  return [
    activeLine,
    transformations.length > 0
      ? `四化复核：本流共有${transformations.length}条四化，需要分别看目标星和目标宫位。`
      : "四化复核：本流暂无四化目标星，后续需确认流干是否可触发。",
    huaJi
      ? `化忌复核：${huaJi.targetStarLabel}在${huaJi.branchLabel}${huaJi.sectorLabel}受化忌牵动，优先看阻滞、牵挂和修复成本。`
      : "化忌复核：本流未见化忌明细，压力重点转向煞曜、落陷和原局结构。"
  ]
}

function buildFocusPalaceLines(
  role: string,
  palace: ZiweiDetailedPalaceAnalysis | undefined
): string[] {
  if (!palace) {
    return [`${role}未定位，需要回查基础盘。`]
  }

  return [
    `${role}落${palace.branchLabel}${palace.sectorLabel}，本宫已分析${palace.starCount}颗核心内容星曜。`,
    ...palace.palaceThemeLines.slice(0, 2),
    ...palace.categorySummaryLines.slice(0, 3),
    ...palace.mainAxisLines.slice(0, 2),
    ...palace.supportLines.slice(0, 2),
    ...palace.pressureLines.slice(0, 2),
    ...palace.dynamicLines.slice(0, 2),
    ...palace.relationLines.slice(0, 2),
    ...palace.brightnessLines.slice(0, 2),
    ...palace.reviewGapLines.slice(0, 2)
  ]
}

function getToneLabel(tone: ZiweiDetailedAnalysisTone): string {
  const labels: Record<ZiweiDetailedAnalysisTone, string> = {
    core: "主轴",
    support: "助力",
    pressure: "压力",
    dynamic: "动态",
    detail: "细节",
    neutral: "补充"
  }

  return labels[tone]
}

function findPalace(
  palaces: FullZiweiPalace[],
  branch: FullZiweiPalace["branch"]
): FullZiweiPalace {
  const palace = palaces.find((item) => item.branch === branch)

  if (!palace) {
    throw new Error(`Missing detailed relation palace: ${branch}`)
  }

  return palace
}

function getAdjacentBranches(branch: FullZiweiPalace["branch"]): FullZiweiPalace["branch"][] {
  const branches: FullZiweiPalace["branch"][] = [
    "yin",
    "mao",
    "chen",
    "si",
    "wu",
    "wei",
    "shen",
    "you",
    "xu",
    "hai",
    "zi",
    "chou"
  ]
  const index = branches.indexOf(branch)
  const previous = branches[(index - 1 + branches.length) % branches.length]
  const next = branches[(index + 1) % branches.length]

  return [previous, next]
}

function getRelationKindLabel(
  kind: ZiweiDetailedPalaceRelationKind
): string {
  const labels: Record<ZiweiDetailedPalaceRelationKind, string> = {
    self: "本宫",
    opposite: "对宫",
    trine: "三方",
    adjacent: "夹宫"
  }

  return labels[kind]
}

function getRelationFocus(kind: ZiweiDetailedPalaceRelationKind): string {
  const focuses: Record<ZiweiDetailedPalaceRelationKind, string> = {
    self: "本宫直接发生的主题",
    opposite: "外部对照、拉扯和补充条件",
    trine: "三方四正范围内的结构支援或压力",
    adjacent: "左右夹拱带来的旁侧牵引"
  }

  return focuses[kind]
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

function formatTransformationLabel(star: ZiweiPlacedStar): string {
  const targetLabel =
    typeof star.debug?.targetStarLabel === "string"
      ? star.debug.targetStarLabel
      : star.targetStarId
        ? getZiweiStarDefinition(star.targetStarId)?.label ?? "目标星"
        : "目标星"

  return `${star.label}作用${targetLabel}`
}

function formatDetailedStarBrightness(
  analysis: ZiweiDetailedStarAnalysis
): string {
  return `${analysis.label}${analysis.brightnessLabel ?? ""}`
}

function isHuaJiStar(star: ZiweiPlacedStar): boolean {
  return star.starId === "ziwei.transformation.huaji"
}

function formatLabels(labels: string[]): string {
  return labels.length > 0 ? labels.join("、") : "无"
}
