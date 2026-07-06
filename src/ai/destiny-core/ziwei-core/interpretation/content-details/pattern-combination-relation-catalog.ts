import type {
  ZiweiContentDictionarySection,
  ZiweiPatternCombinationRelationContentDetail,
  ZiweiPatternCombinationRelationRole,
  ZiweiStarPairCombinationGroup
} from "./content-detail-types"
import { buildPatternCombinationRelationSourceReferences } from "./content-source-reference-map"

const STAR_PAIR_GROUPS: readonly ZiweiStarPairCombinationGroup[] = [
  "main-main",
  "main-assistant",
  "main-malefic",
  "main-misc",
  "assistant-assistant",
  "assistant-malefic",
  "assistant-misc",
  "malefic-malefic",
  "malefic-misc",
  "misc-misc"
]

const PATTERN_CATEGORY_PROFILES = [
  {
    category: "literary",
    label: "文曜科名",
    focus: "文字、表达、考试、名誉、文书和知识秩序"
  },
  {
    category: "assistant",
    label: "辅佐贵人",
    focus: "支援系统、贵人引荐、团队协作和资源承接"
  },
  {
    category: "mainCombo",
    label: "主星组合",
    focus: "命盘骨架、主导气质、核心驱动力和双主轴结构"
  },
  {
    category: "wealthPower",
    label: "禄马权科",
    focus: "资源、行动、权责、名誉和机会流动"
  },
  {
    category: "malefic",
    label: "煞曜结构",
    focus: "冲突、阻滞、惊扰、空耗和修复入口"
  },
  {
    category: "misc",
    label: "杂曜结构",
    focus: "喜庆、名位、桃花、孤寡、仪态和细节触发"
  },
  {
    category: "adverse",
    label: "凶格破格",
    focus: "煞忌、落陷、纠缠、破耗和原有好格局被打断的机制"
  },
  {
    category: "pending",
    label: "待校准",
    focus: "尚未闭合的规则、样例、边界和来源复核"
  }
] as const

export const ZIWEI_PATTERN_COMBINATION_RELATION_DETAILS: Record<
  string,
  ZiweiPatternCombinationRelationContentDetail
> = Object.fromEntries(
  STAR_PAIR_GROUPS.flatMap((group) => {
    return PATTERN_CATEGORY_PROFILES.map((category) => {
      const detail = buildPatternCombinationRelationDetail(group, category)

      return [detail.relationId, detail]
    })
  })
)

export function getAllPatternCombinationRelationContentDetails(): ZiweiPatternCombinationRelationContentDetail[] {
  return STAR_PAIR_GROUPS.flatMap((group) => {
    return PATTERN_CATEGORY_PROFILES.map((category) => {
      const detail = getPatternCombinationRelationContentDetail(group, category.category)

      if (!detail) {
        throw new Error(`Missing pattern combination relation: ${group} ${category.category}`)
      }

      return detail
    })
  })
}

export function getPatternCombinationRelationContentDetail(
  starPairGroup: ZiweiStarPairCombinationGroup,
  patternCategory: string
): ZiweiPatternCombinationRelationContentDetail | null {
  return ZIWEI_PATTERN_COMBINATION_RELATION_DETAILS[
    buildPatternCombinationRelationId(starPairGroup, patternCategory)
  ] ?? null
}

function buildPatternCombinationRelationDetail(
  starPairGroup: ZiweiStarPairCombinationGroup,
  patternCategory: (typeof PATTERN_CATEGORY_PROFILES)[number]
): ZiweiPatternCombinationRelationContentDetail {
  const groupProfile = getStarPairGroupPatternProfile(starPairGroup)
  const role = resolveRelationRole(starPairGroup, patternCategory.category)
  const relationId = buildPatternCombinationRelationId(starPairGroup, patternCategory.category)
  const sourceReferences = buildPatternCombinationRelationSourceReferences()
  const coreReading =
    `${groupProfile.label}参与${patternCategory.label}格局时，先确认该组合是成格核心、加吉补强、加煞破格，还是弱承接复核。` +
    `该资料只说明星曜组合和格局类别的关系，不替代具体格局的命中条件，也不重新定义格局算法。`
  const formationUsage = [
    `${groupProfile.label}若正好落在格局条件要求的同宫、对宫、三方四正或夹宫范围内，可作为${patternCategory.label}的成格证据。`,
    `成格时必须回到具体 patternId、conditionText、matchedPalaces 和 sourceRuleIds，不用组合资料替代原始条件。`,
    `${patternCategory.label}重${patternCategory.focus}，因此要把${groupProfile.focus}转译到该类格局的主题上。`
  ]
  const enhancementUsage = [
    `${groupProfile.enhancement}若与${patternCategory.label}核心条件同向，可作为加吉、补强或层次提升证据。`,
    `增强只说明格局更容易被承接，不表示自动成格；仍需看主星、宫位、庙旺、四化和关系范围。`,
    `若组合在三方四正会照而非同宫，要标明其为会照增强，不写成同宫成格。`
  ]
  const breakageUsage = [
    `${groupProfile.breakage}若冲入${patternCategory.label}核心条件，要优先复核破格、加煞、代价和落空风险。`,
    `破格不等于完全否定原格局；需分核心条件被破、层次下降、短周期受扰和证据不足四类。`,
    `煞忌、空劫、落陷、化忌和动态叠盘重复触发时，必须给复核路径，不输出绝对断语。`
  ]
  const weakBearingUsage = [
    `若${groupProfile.label}只在外围会照、夹宫或短周期动态出现，先标为弱承接，不写成完整格局。`,
    `若组合与${patternCategory.label}主题同向但缺主星或宫位承接，可作为待人工复核的辅助证据。`,
    `若格局未命中，组合资料只保留为资料检索和后续对照，不在页面当成命中结果展示。`
  ]
  const evidenceFields = [
    "patternId",
    "patternCategory",
    "conditionText",
    "starPairGroup",
    "starAId",
    "starBId",
    "relationType",
    "matchedPalaces",
    "brightnessA",
    "brightnessB",
    "transformationStarIds",
    "flowType",
    "sourceRuleIds"
  ]
  const reviewQuestions = [
    `这组星曜组合是否出现在${patternCategory.label}的核心成格范围，而不是外围气氛？`,
    "它是成格核心、加吉补强、加煞破格，还是弱承接？",
    "同宫、对宫、三方四正、夹宫和动态叠盘的权重是否被区分？",
    "是否保留 patternId、conditionText 和 sourceRuleIds 以便回查？"
  ]
  const cautions = [
    `不要用${groupProfile.label}直接改写${patternCategory.label}格局条件；格局条件仍以格局目录为准。`,
    "不要把未命中的组合资料展示成盘中结果。",
    "不要把流年、流月、流日、流时的短周期组合写成本命格局。",
    "不要复制外部格局断语或口诀，只存项目内结构化解释和复核路径。"
  ]

  return {
    relationId,
    sourceReferences,
    starPairGroup,
    patternCategory: patternCategory.category,
    patternCategoryLabel: patternCategory.label,
    role,
    coreReading,
    formationUsage,
    enhancementUsage,
    breakageUsage,
    weakBearingUsage,
    evidenceFields,
    reviewQuestions,
    cautions,
    sections: buildSections({
      coreReading,
      formationUsage,
      enhancementUsage,
      breakageUsage,
      weakBearingUsage,
      evidenceFields,
      reviewQuestions,
      cautions
    })
  }
}

function getStarPairGroupPatternProfile(group: ZiweiStarPairCombinationGroup): {
  label: string
  focus: string
  enhancement: string
  breakage: string
} {
  const profiles: Record<
    ZiweiStarPairCombinationGroup,
    {
      label: string
      focus: string
      enhancement: string
      breakage: string
    }
  > = {
    "main-main": {
      label: "主星双星组合",
      focus: "双主轴、命盘骨架、核心驱动力和宫位主线",
      enhancement: "双主星庙旺、同向、会辅曜或得禄权科",
      breakage: "双主星同陷、互相牵制、会煞忌或核心主题被打断"
    },
    "main-assistant": {
      label: "主星辅曜组合",
      focus: "主轴承接、贵人资源、文书协作和补强条件",
      enhancement: "辅曜能补强主星、夹拱主宫或进入三方四正",
      breakage: "主星弱而辅曜无承接，或助力被煞忌空劫冲散"
    },
    "main-malefic": {
      label: "主星煞曜组合",
      focus: "主轴承压、冲突代价、执行硬度和修复入口",
      enhancement: "强主星能制压煞曜、压力转为边界和执行",
      breakage: "煞曜冲破主星、化忌叠加或落陷导致格局受损"
    },
    "main-misc": {
      label: "主星杂曜组合",
      focus: "主轴旁边的细节气氛、关系触发和特殊象义",
      enhancement: "杂曜与主星主题同向，补充名位、喜庆、仪态或细节证据",
      breakage: "杂曜细节被煞忌放大，造成关系纠缠、孤寡桃花或名声压力"
    },
    "assistant-assistant": {
      label: "辅曜双星组合",
      focus: "助力叠加、贵人文书、资源窗口和协作条件",
      enhancement: "双辅曜夹拱、会照或同宫，形成明显加吉和补强",
      breakage: "辅曜缺主星承接，助力分散或被空劫煞忌耗散"
    },
    "assistant-malefic": {
      label: "辅曜煞曜组合",
      focus: "助力制压、资源受阻、风险缓冲和修复方法",
      enhancement: "辅曜能制化煞曜，提供解决方法、贵人或文书出口",
      breakage: "煞曜重而辅曜弱，助力不足以抵消冲突和代价"
    },
    "assistant-misc": {
      label: "辅曜杂曜组合",
      focus: "辅助资源、细节机会、名位气氛和关系触发",
      enhancement: "辅曜把杂曜细节落地，形成可用机会或文书名位补充",
      breakage: "杂曜牵制辅曜，助力变成气氛、关系或文书反复"
    },
    "malefic-malefic": {
      label: "煞曜双星组合",
      focus: "压力叠加、冲突链、损耗链和高优先级风险入口",
      enhancement: "压力集中后被强主星和吉曜制化，转为突破、止损和警觉",
      breakage: "煞曜叠加、空劫化忌同会或夹宫高压，容易形成破格"
    },
    "malefic-misc": {
      label: "煞曜杂曜组合",
      focus: "压力事件中的情绪、名声、刑耗、桃花或孤寡细节",
      enhancement: "杂曜提供风险线索和修复提醒，使压力更容易被识别",
      breakage: "煞曜把杂曜细节风险化，形成纠缠、落空或情绪负担"
    },
    "misc-misc": {
      label: "杂曜双星组合",
      focus: "细节气氛、关系触发、名声文书、孤寡桃花和特殊象义",
      enhancement: "杂曜细节彼此呼应，补足格局的气氛和特殊证据",
      breakage: "细节被过度放大，脱离主星和宫位主轴造成误读"
    }
  }

  return profiles[group]
}

function resolveRelationRole(
  group: ZiweiStarPairCombinationGroup,
  patternCategory: string
): ZiweiPatternCombinationRelationRole {
  if (patternCategory === "adverse" || patternCategory === "malefic") {
    return group.includes("malefic") ? "breakage" : "weak-bearing"
  }

  if (patternCategory === "pending") {
    return "weak-bearing"
  }

  if (group === "main-main" || group === "main-assistant" || group === "assistant-assistant") {
    return "formation"
  }

  if (group.includes("malefic")) {
    return "breakage"
  }

  return "enhancement"
}

function buildPatternCombinationRelationId(
  starPairGroup: ZiweiStarPairCombinationGroup,
  patternCategory: string
): string {
  return `pattern-combination.${starPairGroup}.${patternCategory}`
}

function buildSections(input: {
  coreReading: string
  formationUsage: string[]
  enhancementUsage: string[]
  breakageUsage: string[]
  weakBearingUsage: string[]
  evidenceFields: string[]
  reviewQuestions: string[]
  cautions: string[]
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "关系本体",
      items: [input.coreReading]
    },
    {
      title: "成格用法",
      items: input.formationUsage
    },
    {
      title: "加吉增强",
      items: input.enhancementUsage
    },
    {
      title: "加煞破格",
      items: input.breakageUsage
    },
    {
      title: "弱承接",
      items: input.weakBearingUsage
    },
    {
      title: "证据字段",
      items: input.evidenceFields
    },
    {
      title: "复核问题",
      items: input.reviewQuestions
    },
    {
      title: "误读边界",
      items: input.cautions
    }
  ]
}

