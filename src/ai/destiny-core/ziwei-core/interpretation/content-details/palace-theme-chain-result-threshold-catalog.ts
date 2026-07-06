import { SECTOR_LABELS } from "../../page-view/labels"

import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainCategory,
  ZiweiPalaceThemeChainResultThresholdContentDetail
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"
import { getAllPalaceThemeChainEvidenceHitRuleContentDetails } from "./palace-theme-chain-evidence-hit-rule-catalog"

interface ResultThresholdProfile {
  rankingRules: string[]
  sectionOutputRules: string[]
  reviewEscalationRules: string[]
}

const COMMON_DISPLAY_TIERS = [
  "strong：必要证据完整、主宫和辅助宫同时承接，可输出主题链总论、证据、修复和边界。",
  "weak：只有局部证据、短周期触发或辅助宫不足，只输出提示和待复核，不输出结论。",
  "breakage：煞忌、落陷、空劫、破格或来源冲突明显，优先输出受压结构和补救证据。",
  "repair：存在化科、化禄、辅曜、庙旺主星或三方四正补强，可输出修复路径。",
  "hidden：盘中没有可追溯证据、来源字段不足或只有字典泛化内容时隐藏。"
]

const COMMON_VISIBILITY_THRESHOLDS = [
  "必须先通过必要证据检查，缺少 ruleId、chainId、templateId、chartLayer 或 sourceRuleIds 时隐藏。",
  "至少需要主宫、辅助宫、对宫、三方四正、四化、格局或动态盘中的一类当前盘证据。",
  "只有资料字典解释而当前盘无星曜、宫位、四化、亮度或格局命中时隐藏。",
  "强命中、弱命中、破格和修复可以并存，但隐藏条件命中时优先隐藏。",
  "短周期流月、流日、流时只能打开短周期段落，不能打开长期本命段落。"
]

const COMMON_EVIDENCE_MERGE_RULES = [
  "同一主题链多层命中时，先保留本命底盘，再叠加大限、流年、流月、流日和流时。",
  "下级流层不能删除上级证据，只能追加当前层触发和降权说明。",
  "主宫证据优先，辅助宫、对宫、三方四正和邻近关系作为承接、修复或破格证据。",
  "格局证据只在盘中实际命中时合并；未命中的格局资料不得进入输出。",
  "四化证据必须保留来源天干、来源盘层、目标星和目标宫，不能只显示化象名称。"
]

const COMMON_LAYER_INHERITANCE_RULES = [
  "本命层只展示本命证据，不自动展示大限、流年、流月、流日或流时。",
  "大限层展示本命底盘和大限新增证据，并标记大限命宫或大限主宫。",
  "流年层展示本命、大限和流年新增证据，不能把大限标签删掉。",
  "流月层展示上级背景和流月触发，结论必须降权为月份气候。",
  "流日、流时层只展示即时触发、提醒和复核点，不写长期定性。"
]

const COMMON_SUPPRESSION_RULES = [
  "未命中的格局、未落宫的星曜、未启用的流层和缺 sourceRuleId 的证据必须隐藏。",
  "只有单颗杂曜、单个桃花标签或单个短周期小星时，不打开强命中段落。",
  "医疗、法律、投资、婚姻结果等高风险主题不得输出确定断语。",
  "来源冲突时不展示最终结论，只展示复核缺口和需要核验的字段。",
  "当前盘没有证据时，不展示为“可能有”，只保留资料字典本体。"
]

const COMMON_SOURCE_FIELDS = [
  "thresholdId",
  "ruleId",
  "chainId",
  "templateId",
  "chartLayer",
  "displayTier",
  "primaryPalace",
  "supportingPalaces",
  "evidencePalaces",
  "evidenceStars",
  "samePalaceStars",
  "oppositePalaceStars",
  "trineSquareStars",
  "brightness",
  "transformationStarIds",
  "patternHitIds",
  "breakageIds",
  "repairEvidenceIds",
  "dynamicFlowType",
  "sourceRuleIds"
]

const CATEGORY_THRESHOLD_PROFILES: Record<
  ZiweiPalaceThemeChainCategory,
  ResultThresholdProfile
> = {
  self: {
    rankingRules: [
      "命宫、身宫、命财官迁链和本命主轴证据优先于短周期触发。",
      "主宫强命中排在辅助宫强命中之前；破格证据紧随强命中展示。",
      "自我主题出现修复证据时，必须排在风险段之后，避免只写压力。"
    ],
    sectionOutputRules: [
      "强命中输出命盘主轴、现实承接和证据宫位。",
      "弱命中只输出方向提示、证据缺口和后续复核字段。",
      "破格输出受压来源、承接不足和可核验的修复入口。"
    ],
    reviewEscalationRules: [
      "命宫、身宫、官禄和迁移互相冲突时升级人工复核。",
      "本命与大限、流年判断方向相反时标记层级冲突。",
      "只有短周期触发却要求长期命盘结论时必须拦截。"
    ]
  },
  career: {
    rankingRules: [
      "官禄、财帛、迁移、交友和父母链证据优先排序。",
      "责任、资源、平台和外部机会同时成立时排为强命中。",
      "官禄煞忌或财帛不承接时，破格段优先于机会段。"
    ],
    sectionOutputRules: [
      "强命中输出事业角色、资源来源、外部场域和阶段层级。",
      "弱命中输出工作提示和缺少的承接宫位。",
      "破格输出责任、制度、团队、客户或资源压力。"
    ],
    reviewEscalationRules: [
      "事业与财务证据方向不一致时升级复核。",
      "只见化权而无资源承接时不得输出事业成功结论。",
      "短周期工作节点不得覆盖长期职业结构。"
    ]
  },
  relationship: {
    rankingRules: [
      "夫妻、福德、命宫、子女和交友链证据优先排序。",
      "关系破格、高风险牵挂和修复证据必须相邻展示。",
      "桃花、杂曜和短周期互动提示排在稳定关系证据之后。"
    ],
    sectionOutputRules: [
      "强命中输出关系模式、承接宫位和互动资源。",
      "弱命中只输出关系气氛、互动提示和待复核字段。",
      "破格输出边界、牵挂、反复和修复资源，不输出关系结果。"
    ],
    reviewEscalationRules: [
      "夫妻、福德和命宫互相冲突时升级复核。",
      "交友煞忌介入夫妻链时标记外部关系压力。",
      "婚恋结果、分合断语和道德判断必须拦截。"
    ]
  },
  family: {
    rankingRules: [
      "田宅、父母、财帛、福德和子女证据优先排序。",
      "资产、文书、长辈和家庭空间要分段展示。",
      "田宅或父母受压时，破格段排在资产机会段之前。"
    ],
    sectionOutputRules: [
      "强命中输出家庭根基、文书制度和资源承载。",
      "弱命中输出家庭主题提示和缺证字段。",
      "破格输出空间、长辈、手续、资产责任或精神负担。"
    ],
    reviewEscalationRules: [
      "涉及产权、法律、继承和医疗照护时升级现实复核。",
      "田宅强而财帛弱时标记长期承载不足。",
      "父母文书证据缺 sourceRuleId 时隐藏结论。"
    ]
  },
  health: {
    rankingRules: [
      "疾厄、福德、命宫、田宅和财帛证据优先排序。",
      "健康压力段必须排在修复段之前，但不得输出诊断。",
      "短周期疲劳或事件触发排在长期身心结构之后。"
    ],
    sectionOutputRules: [
      "强命中输出身心主题明显、压力来源和修复入口。",
      "弱命中只输出节奏提醒和复核字段。",
      "破格输出风险提醒、压力链和现实检查建议，不输出疾病判断。"
    ],
    reviewEscalationRules: [
      "所有具体疾病、治疗和诊断类表达必须拦截。",
      "疾厄压力重且福德无修复时升级人工复核。",
      "流日流时触发不得写成长期健康结论。"
    ]
  },
  wealth: {
    rankingRules: [
      "财帛、官禄、田宅、福德和疾厄证据优先排序。",
      "收入、支出、存量资产和风险成本必须分开排序。",
      "财帛化忌、空劫或煞忌重时，破格段排在收益段之前。"
    ],
    sectionOutputRules: [
      "强命中输出资源入口、回收路径和长期承载。",
      "弱命中输出财务议题提示，不输出资产判断。",
      "破格输出现金流、成本、虚实落差和复核字段。"
    ],
    reviewEscalationRules: [
      "投资、借贷、买卖、法律财产类结论必须升级现实复核。",
      "田宅强而财帛弱时标记存量责任和现金流冲突。",
      "只有禄象而无财帛承接时不得输出财运结论。"
    ]
  },
  social: {
    rankingRules: [
      "交友、兄弟、官禄、迁移和财帛证据优先排序。",
      "协作资源要排在社交气氛之前，成果证据要看官禄和财帛。",
      "交友煞忌或兄弟受压时，破格段排在合作机会之前。"
    ],
    sectionOutputRules: [
      "强命中输出协作结构、团队资源、外部场域和落地宫位。",
      "弱命中输出社交提示、沟通气氛和待复核字段。",
      "破格输出人情牵挂、角色边界、成本和冲突来源。"
    ],
    reviewEscalationRules: [
      "合作结果没有官禄或财帛承接时不得输出成果结论。",
      "客户、合约和团队责任冲突时升级现实复核。",
      "只有聚会或短周期沟通触发时不得写长期圈层判断。"
    ]
  },
  review: {
    rankingRules: [
      "跨主题链命中数、主宫证据完整度、格局证据和动态层级一致性共同决定排序。",
      "破格、修复和高风险主题优先于普通提示。",
      "未命中资料不得进入全盘总论，只能留在资料字典。"
    ],
    sectionOutputRules: [
      "强命中输出全盘主轴、证据链和阶段重点。",
      "弱命中输出局部提示和缺口清单。",
      "破格输出受压结构、修复资源和人工复核入口。"
    ],
    reviewEscalationRules: [
      "跨主题证据冲突、来源缺失或动态层级互相覆盖时升级复核。",
      "高风险主题只输出证据路径和提醒。",
      "用户盘结论必须能回溯到来源规则和当前盘证据。"
    ]
  }
}

export const ZIWEI_PALACE_THEME_CHAIN_RESULT_THRESHOLD_DETAILS: ZiweiPalaceThemeChainResultThresholdContentDetail[] =
  getAllPalaceThemeChainEvidenceHitRuleContentDetails().map((rule) => {
    const profile = CATEGORY_THRESHOLD_PROFILES[rule.category]
    const label = `${rule.label}展示门槛`
    const sourceReferences = buildPalaceThemeRuleSourceReferences()
    const threshold: Omit<
      ZiweiPalaceThemeChainResultThresholdContentDetail,
      "sections"
    > = {
      thresholdId: `palace-theme-chain-result-threshold.${rule.chainId}`,
      ruleId: rule.ruleId,
      chainId: rule.chainId,
      templateId: rule.templateId,
      label,
      sourceReferences,
      category: rule.category,
      primaryPalace: rule.primaryPalace,
      displayTiers: COMMON_DISPLAY_TIERS,
      visibilityThresholds: [
        ...COMMON_VISIBILITY_THRESHOLDS,
        ...rule.hiddenWhen
      ],
      rankingRules: profile.rankingRules,
      sectionOutputRules: profile.sectionOutputRules,
      evidenceMergeRules: COMMON_EVIDENCE_MERGE_RULES,
      layerInheritanceRules: COMMON_LAYER_INHERITANCE_RULES,
      suppressionRules: COMMON_SUPPRESSION_RULES,
      reviewEscalationRules: profile.reviewEscalationRules,
      sourceFields: COMMON_SOURCE_FIELDS
    }

    return {
      ...threshold,
      sections: buildSections(threshold)
    }
  })

export function getPalaceThemeChainResultThresholdContentDetail(
  thresholdId: string
): ZiweiPalaceThemeChainResultThresholdContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_RESULT_THRESHOLD_DETAILS.find((detail) => {
      return detail.thresholdId === thresholdId
    }) ?? null
  )
}

export function getAllPalaceThemeChainResultThresholdContentDetails(): ZiweiPalaceThemeChainResultThresholdContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_RESULT_THRESHOLD_DETAILS]
}

function buildSections(
  detail: Omit<ZiweiPalaceThemeChainResultThresholdContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "展示门槛定位",
      items: [
        `${detail.label}用于判断${SECTOR_LABELS[detail.primaryPalace]}为主宫的主题链结果何时展示、如何排序、何时隐藏。`,
        `对应命中规则：${detail.ruleId}，对应模板：${detail.templateId}。`
      ]
    },
    {
      title: "结果层级",
      items: detail.displayTiers
    },
    {
      title: "展示阈值",
      items: detail.visibilityThresholds
    },
    {
      title: "排序规则",
      items: detail.rankingRules
    },
    {
      title: "段落输出",
      items: detail.sectionOutputRules
    },
    {
      title: "证据合并",
      items: detail.evidenceMergeRules
    },
    {
      title: "盘层继承",
      items: detail.layerInheritanceRules
    },
    {
      title: "隐藏抑制",
      items: detail.suppressionRules
    },
    {
      title: "复核升级",
      items: detail.reviewEscalationRules
    },
    {
      title: "来源字段",
      items: detail.sourceFields
    }
  ]
}

