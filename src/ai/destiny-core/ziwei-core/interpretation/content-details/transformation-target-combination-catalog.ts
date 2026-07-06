import type { HeavenlyStem, ZiweiStarId } from "../../contracts"
import {
  getZiweiStarDefinition,
  TRANSFORMATION_STAR_IDS
} from "../../star-catalog"
import {
  NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM,
  type TransformationKind
} from "../../star-placement/transformations"

import type {
  ZiweiContentDictionarySection,
  ZiweiTransformationTargetCombinationContentDetail
} from "./content-detail-types"
import { buildTransformationTopicSourceReferences } from "./content-source-reference-map"

const STEM_ORDER: HeavenlyStem[] = [
  "jia",
  "yi",
  "bing",
  "ding",
  "wu",
  "ji",
  "geng",
  "xin",
  "ren",
  "gui"
]

const TRANSFORMATION_ORDER: TransformationKind[] = [
  TRANSFORMATION_STAR_IDS.hualu,
  TRANSFORMATION_STAR_IDS.huaquan,
  TRANSFORMATION_STAR_IDS.huake,
  TRANSFORMATION_STAR_IDS.huaji
]

const STEM_LABELS: Record<HeavenlyStem, string> = {
  jia: "甲",
  yi: "乙",
  bing: "丙",
  ding: "丁",
  wu: "戊",
  ji: "己",
  geng: "庚",
  xin: "辛",
  ren: "壬",
  gui: "癸"
}

export const ZIWEI_TRANSFORMATION_TARGET_COMBINATION_DETAILS =
  buildTransformationTargetCombinationDetails()

export function getAllTransformationTargetCombinationContentDetails(): ZiweiTransformationTargetCombinationContentDetail[] {
  return ZIWEI_TRANSFORMATION_TARGET_COMBINATION_DETAILS
}

export function getTransformationTargetCombinationContentDetail(
  combinationId: string
): ZiweiTransformationTargetCombinationContentDetail | undefined {
  return ZIWEI_TRANSFORMATION_TARGET_COMBINATION_DETAILS.find(
    (detail) => detail.combinationId === combinationId
  )
}

function buildTransformationTargetCombinationDetails(): ZiweiTransformationTargetCombinationContentDetail[] {
  const combinations = new Map<
    string,
    {
      transformationStarId: TransformationKind
      targetStarId: ZiweiStarId
      sourceStems: HeavenlyStem[]
    }
  >()

  STEM_ORDER.forEach((stem) => {
    NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM[stem].forEach((rule) => {
      const combinationId = buildCombinationId(rule.transformationStarId, rule.targetStarId)
      const existing = combinations.get(combinationId)

      if (existing) {
        existing.sourceStems.push(stem)
        return
      }

      combinations.set(combinationId, {
        transformationStarId: rule.transformationStarId,
        targetStarId: rule.targetStarId,
        sourceStems: [stem]
      })
    })
  })

  return Array.from(combinations.values()).sort(compareCombination).map(buildDetail)
}

function buildDetail(input: {
  transformationStarId: TransformationKind
  targetStarId: ZiweiStarId
  sourceStems: HeavenlyStem[]
}): ZiweiTransformationTargetCombinationContentDetail {
  const transformationLabel = starLabel(input.transformationStarId)
  const targetLabel = starLabel(input.targetStarId)
  const sourceStemLabels = input.sourceStems.map((stem) => STEM_LABELS[stem])
  const combinationId = buildCombinationId(input.transformationStarId, input.targetStarId)
  const profile = transformationProfile(input.transformationStarId)
  const targetProfile = targetStarProfile(input.targetStarId)
  const sourceReferences = buildTransformationTopicSourceReferences()

  const sourceUsage = [
    `${sourceStemLabels.join("、")}干触发${targetLabel}${transformationLabel}。`,
    "来源天干必须来自统一四化目标表，不在资料层重新定义目标规则。",
    "同一个目标星在不同盘层出现时，要同时标明本命、大限、流年、流月、流日或流时来源。"
  ]

  const transformationEffect = [
    `${targetLabel}被${transformationLabel}触发时，先保留${targetProfile.core}，再叠加${profile.theme}。`,
    profile.effect(targetLabel),
    "解释时先读目标星本体，再读目标宫位，最后看同宫、对宫和三方四正是否能承接。"
  ]

  const palaceReading = [
    `${targetLabel}${transformationLabel}落入不同宫位时，主题必须转译到该宫位的人事范围。`,
    "命宫看主体倾向，财帛看资源与价值交换，官禄看职责与职业表达，夫妻看关系互动。",
    "不能只凭目标星和四化就输出最终结论，必须回到宫位、盘层和关系证据。"
  ]

  const flowReading = [
    "本命四化属于长期底盘，大限四化属于十年阶段，流年以下属于短周期触发。",
    `${targetLabel}${transformationLabel}在动态盘出现时，要保留上级盘层背景和来源天干。`,
    "越短周期的盘层越要降权，流日、流时只作即时提示和复核入口。"
  ]

  const relationReading = [
    "同宫优先看直接混合，对宫看外部牵引，三方四正看资源或压力从哪里会入。",
    `${targetLabel}${transformationLabel}若被夹宫、会照或动态叠盘重复触发，要记录证据链而不是放大断语。`,
    "目标星所在宫与命宫、身宫、大限命宫、流年命宫的关系会影响解释权重。"
  ]

  const patternReading = [
    `${targetLabel}${transformationLabel}可作为格局加成、破格、补救或代价证据之一。`,
    profile.pattern(targetLabel),
    "进入格局分析时必须引用格局规则命中证据，资料字典只提供解释素材。"
  ]

  const cautions = [
    "四化目标组合不是独立断语。",
    "不要把来源天干、目标星、目标宫和盘层混写。",
    "不要复制外部口诀或软件断语，资料层只保存自有结构化解释。"
  ]

  return {
    combinationId,
    sourceReferences,
    transformationStarId: input.transformationStarId,
    targetStarId: input.targetStarId,
    label: `${targetLabel}${transformationLabel}`,
    sourceStems: input.sourceStems,
    sourceUsage,
    targetRole: targetProfile.role,
    transformationEffect,
    palaceReading,
    flowReading,
    relationReading,
    patternReading,
    evidenceFields: [
      "sourceStem",
      "transformationStarId",
      "targetStarId",
      "targetPalace",
      "flowType",
      "sourceRuleId",
      "samePalaceStars",
      "oppositePalaceStars",
      "trineSquareStars"
    ],
    cautions,
    sections: [
      section("组合身份", [`${combinationId} 是四化目标星组合资料。`, `${sourceStemLabels.join("、")}干触发。`, targetProfile.role]),
      section("来源天干", sourceUsage),
      section("目标星承接", transformationEffect),
      section("目标宫读法", palaceReading),
      section("动态盘层", flowReading),
      section("关系结构", relationReading),
      section("格局用法", patternReading),
      section("证据字段", [
        "必须保留 sourceStem、transformationStarId、targetStarId、targetPalace、flowType 和 sourceRuleId。",
        "需要复核同宫、对宫、三方四正、夹宫和动态叠盘证据。",
        "后续分析可以调用这些字段，不需要重新判断四化目标表。"
      ]),
      section("误读边界", cautions)
    ]
  }
}

function transformationProfile(transformationStarId: TransformationKind): {
  theme: string
  effect: (targetLabel: string) => string
  pattern: (targetLabel: string) => string
} {
  const profiles: Record<TransformationKind, {
    theme: string
    effect: (targetLabel: string) => string
    pattern: (targetLabel: string) => string
  }> = {
    [TRANSFORMATION_STAR_IDS.hualu]: {
      theme: "资源、机会、润泽和欲望流入",
      effect: (targetLabel) => `${targetLabel}的能力被资源化，容易出现机会、获得感、关系润滑或欲望牵引。`,
      pattern: (targetLabel) => `${targetLabel}化禄多作资源和加吉证据，但遇空劫、煞忌或弱承接时要看落空和代价。`
    },
    [TRANSFORMATION_STAR_IDS.huaquan]: {
      theme: "权责、推动、主导和压力上升",
      effect: (targetLabel) => `${targetLabel}的能力被推到前台，容易表现为执行、掌控、承担、竞争或责任压力。`,
      pattern: (targetLabel) => `${targetLabel}化权可增强主导力，也可能成为强压、冲突和破格压力。`
    },
    [TRANSFORMATION_STAR_IDS.huake]: {
      theme: "名誉、文书、规范和缓和修饰",
      effect: (targetLabel) => `${targetLabel}的能力被文书化、名誉化或规范化，适合观察解释、评价、体面和缓和机制。`,
      pattern: (targetLabel) => `${targetLabel}化科可作为名誉和缓和证据，但不能替代实际资源或完全化解强煞。`
    },
    [TRANSFORMATION_STAR_IDS.huaji]: {
      theme: "牵挂、阻滞、执念和修复成本",
      effect: (targetLabel) => `${targetLabel}的能力出现卡点、牵挂、亏欠或反复，需要找出来源、落点和修复路径。`,
      pattern: (targetLabel) => `${targetLabel}化忌可作为破格、代价和复核重点，但不能直接写成灾祸结论。`
    }
  }

  return profiles[transformationStarId]
}

function targetStarProfile(targetStarId: ZiweiStarId): {
  core: string
  role: string
} {
  const label = starLabel(targetStarId)
  const star = getZiweiStarDefinition(targetStarId)
  const category = star?.category ?? "unknown"

  return {
    core: `${label}原本的星性、类别和宫位承接`,
    role: `${label}属于${category}类星曜，作为四化目标时负责承接化象，不等同于四化本身。`
  }
}

function compareCombination(
  left: {
    transformationStarId: TransformationKind
    targetStarId: ZiweiStarId
  },
  right: {
    transformationStarId: TransformationKind
    targetStarId: ZiweiStarId
  }
): number {
  const transformationDiff =
    TRANSFORMATION_ORDER.indexOf(left.transformationStarId) -
    TRANSFORMATION_ORDER.indexOf(right.transformationStarId)

  if (transformationDiff !== 0) {
    return transformationDiff
  }

  return starLabel(left.targetStarId).localeCompare(starLabel(right.targetStarId), "zh-Hans-CN")
}

function buildCombinationId(
  transformationStarId: TransformationKind,
  targetStarId: ZiweiStarId
): string {
  return `transformation-target.${transformationStarId}.${targetStarId}`
}

function starLabel(starId: ZiweiStarId): string {
  return getZiweiStarDefinition(starId)?.label ?? starId
}

function section(
  title: string,
  items: string[]
): ZiweiContentDictionarySection {
  return { title, items }
}
