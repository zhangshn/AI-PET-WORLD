import { SECTOR_LABELS } from "../../page-view/labels"

import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainCategory,
  ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"
import { getAllPalaceThemeChainResultThresholdContentDetails } from "./palace-theme-chain-result-threshold-catalog"

interface OutputParagraphProfile {
  summaryParagraphRules: string[]
  evidenceParagraphRules: string[]
  pressureParagraphRules: string[]
  repairParagraphRules: string[]
  dynamicParagraphRules: string[]
  reviewParagraphRules: string[]
}

const COMMON_PARAGRAPH_TYPES = [
  "summary：总论段，只在 strong 或 weak 有当前盘证据时展示，不能直接写绝对吉凶。",
  "evidence：证据段，列出主宫、辅助宫、对宫、三方四正、星曜、四化、格局和来源规则。",
  "pressure：受压段，只在 breakage 或 suppression 证据存在时展示。",
  "repair：修复段，只在 repair 证据存在时展示，不能无证据硬写补救。",
  "dynamic：动态盘段，只在大限、流年、流月、流日或流时启用并命中时展示。",
  "review：复核缺口段，只在证据不足、来源冲突或高风险主题需要人工核对时展示。"
]

const COMMON_TONE_RULES = [
  "输出语言必须是证据说明和复核提示，不写恐吓、绝对、宿命化断语。",
  "强命中可以写主题明显，但仍要回到宫位、星曜、四化和来源字段。",
  "弱命中只能写提示、倾向和待复核，不能写成结论。",
  "高风险主题必须使用现实核验、边界提醒和资料缺口表达。",
  "短周期流月、流日、流时只能写触发和提醒，不写长期命格。"
]

const COMMON_SOURCE_FIELDS = [
  "paragraphTemplateId",
  "thresholdId",
  "ruleId",
  "chainId",
  "templateId",
  "chartLayer",
  "paragraphType",
  "displayTier",
  "primaryPalace",
  "evidencePalaces",
  "evidenceStars",
  "transformationStarIds",
  "patternHitIds",
  "breakageIds",
  "repairEvidenceIds",
  "dynamicFlowType",
  "reviewFlags",
  "sourceRuleIds"
]

const CATEGORY_PARAGRAPH_PROFILES: Record<
  ZiweiPalaceThemeChainCategory,
  OutputParagraphProfile
> = {
  self: {
    summaryParagraphRules: [
      "总论先写命宫、身宫或命财官迁链正在承接的自我主轴。",
      "强命中时可写命盘主轴、行动方式和现实承接；弱命中只写主题提示。",
      "不得把短周期触发写成本命结论定论。"
    ],
    evidenceParagraphRules: [
      "证据段按命宫、身宫、财帛、官禄、迁移和三方四正顺序列出。",
      "必须保留主星、辅曜、煞忌、亮度、四化和 sourceRuleIds。",
      "缺少主宫证据时，证据段只能写外围提示。"
    ],
    pressureParagraphRules: [
      "受压段写命宫或主轴受煞忌、落陷、空劫、破格牵制的具体来源。",
      "压力描述后必须给出承接不足或待复核字段。",
      "不写定性贬损式判断。"
    ],
    repairParagraphRules: [
      "修复段优先写化科、化禄、辅曜、庙旺主星和三方四正补强。",
      "修复路径必须落到可见宫位或现实承接点。",
      "无修复证据时隐藏修复段。"
    ],
    dynamicParagraphRules: [
      "动态段按本命底盘、大限背景、流年触发、流月流日流时提醒排序。",
      "流年自我主题不能覆盖本命主轴，只写阶段触发。",
      "短周期触发必须标注当前流层。"
    ],
    reviewParagraphRules: [
      "命宫、身宫、官禄、迁移方向冲突时输出复核缺口。",
      "来源规则缺失时列出缺失字段。",
      "命盘长期判断需要本命与大限证据同时复核。"
    ]
  },
  career: {
    summaryParagraphRules: [
      "总论先写官禄链的责任、资源、平台和外部场域。",
      "强命中时写事业阶段主题；弱命中只写工作议题被触发。",
      "不得把机会提示写成职业成败。"
    ],
    evidenceParagraphRules: [
      "证据段按官禄、财帛、迁移、交友、父母和三方四正顺序列出。",
      "必须区分责任证据、资源证据、平台证据和文书制度证据。",
      "只见交友或迁移时，证据段要标注外部机会而非事业结论。"
    ],
    pressureParagraphRules: [
      "受压段写官禄煞忌、财帛不承接、团队或客户压力。",
      "化权强而资源不足时写责任偏重。",
      "不输出职场失败式断语。"
    ],
    repairParagraphRules: [
      "修复段优先写父母化科、文书证照、财帛回收和交友辅曜。",
      "修复路径要落到制度、流程、资源或团队边界。",
      "无财帛或官禄承接时隐藏成果类修复。"
    ],
    dynamicParagraphRules: [
      "动态段写大限事业背景、流年任务、流月节点和流日流时提醒。",
      "流年命中必须保留大限事业背景。",
      "短周期会议、沟通或项目节点不得写成长期职业结构。"
    ],
    reviewParagraphRules: [
      "官禄与财帛方向不一致时输出复核缺口。",
      "事业、合同、团队责任涉及现实承诺时升级人工复核。",
      "sourceRuleIds 不完整时隐藏成果结论。"
    ]
  },
  relationship: {
    summaryParagraphRules: [
      "总论先写夫妻、福德、命宫或交友链承接的关系议题。",
      "强命中写互动模式和承接资源；弱命中只写关系气氛。",
      "不得输出分合、婚恋结果或道德判断。"
    ],
    evidenceParagraphRules: [
      "证据段按夫妻、福德、命宫、子女、交友和三方四正顺序列出。",
      "桃花、杂曜和短周期互动只能作为辅助证据。",
      "必须列出修复宫位或承接宫位是否存在。"
    ],
    pressureParagraphRules: [
      "受压段写夫妻化忌、福德受压、交友干扰或边界消耗。",
      "关系压力必须写成互动和证据，不写定性归咎。",
      "短周期争执只能写临时触发。"
    ],
    repairParagraphRules: [
      "修复段优先写福德化科、化禄、辅曜和命宫承接。",
      "修复路径写沟通边界、精神缓冲和现实承接。",
      "无修复证据时只输出复核问题。"
    ],
    dynamicParagraphRules: [
      "动态段按本命关系底盘、大限关系背景、流年关系触发和短周期互动排序。",
      "流月流日流时只写气氛、沟通和即时事件。",
      "动态关系触发不得覆盖本命夫妻宫。"
    ],
    reviewParagraphRules: [
      "夫妻、福德、命宫证据冲突时输出复核缺口。",
      "涉及婚姻结果、法律关系或现实选择时升级复核。",
      "只有桃花证据时隐藏关系结论。"
    ]
  },
  family: {
    summaryParagraphRules: [
      "总论先写田宅、父母、福德或财帛链承接的家庭根基。",
      "强命中写空间、长辈、文书、资产或安全感主题；弱命中只写家庭议题提示。",
      "不得输出产权、继承或家庭结果断语。"
    ],
    evidenceParagraphRules: [
      "证据段按田宅、父母、财帛、福德、子女和三方四正顺序列出。",
      "必须区分空间证据、文书证据、长辈证据和资源承接。",
      "田宅单宫命中时标注辅助证据缺口。"
    ],
    pressureParagraphRules: [
      "受压段写田宅化忌、父母煞忌、财帛承接不足或福德压力。",
      "资产和文书压力必须写成复核提示。",
      "不写家庭不可改变的结论。"
    ],
    repairParagraphRules: [
      "修复段优先写父母化科、文书顺畅、田宅稳定主星和财帛承接。",
      "修复路径写现实手续、资源边界和空间调整。",
      "无现实证据时隐藏资产类修复。"
    ],
    dynamicParagraphRules: [
      "动态段写大限家庭背景、流年家宅文书、流月流日短期事务。",
      "流年家庭主题必须保留本命田宅和父母背景。",
      "短周期只写事件提醒。"
    ],
    reviewParagraphRules: [
      "产权、法律、继承、长辈健康相关内容升级现实复核。",
      "田宅强而财帛弱时输出承载缺口。",
      "文书来源缺失时隐藏结论。"
    ]
  },
  health: {
    summaryParagraphRules: [
      "总论先写疾厄、福德、命宫或田宅链承接的身心压力。",
      "强命中只表示身心主题明显，不表示疾病成立。",
      "不得输出诊断、治疗或病名。"
    ],
    evidenceParagraphRules: [
      "证据段按疾厄、福德、命宫、田宅、财帛和三方四正顺序列出。",
      "必须区分压力来源、修复资源和短周期触发。",
      "只有短周期小星时只写即时提醒。"
    ],
    pressureParagraphRules: [
      "受压段写疾厄煞忌、福德受压、责任或成本牵动身心。",
      "压力表达必须转为现实检查和节奏提醒。",
      "不写恐吓式健康断语。"
    ],
    repairParagraphRules: [
      "修复段优先写福德化禄化科、疾厄辅曜、田宅环境和财帛资源。",
      "修复路径写休整、节奏、环境和现实检查。",
      "无修复证据时隐藏修复段。"
    ],
    dynamicParagraphRules: [
      "动态段写大限身心背景、流年压力、流月流日流时即时提醒。",
      "流日流时不得写长期健康结论。",
      "短周期触发必须降权。"
    ],
    reviewParagraphRules: [
      "涉及疾病、治疗、用药、医疗选择时升级现实专业复核。",
      "疾厄压力重且福德无修复时输出复核缺口。",
      "来源字段缺失时隐藏健康结论。"
    ]
  },
  wealth: {
    summaryParagraphRules: [
      "总论先写财帛、官禄、田宅或福德链承接的资源主题。",
      "强命中写资源入口、回收路径和长期承载；弱命中只写财务议题提示。",
      "不得输出投资建议或贫富定论。"
    ],
    evidenceParagraphRules: [
      "证据段按财帛、官禄、田宅、福德、疾厄和三方四正顺序列出。",
      "必须分开收入、支出、存量资产、责任成本和风险成本。",
      "只有禄象而无财帛承接时标注证据不足。"
    ],
    pressureParagraphRules: [
      "受压段写财帛化忌、空劫、现金流牵挂、田宅责任或成本压力。",
      "财务压力必须写成复核提示和边界提醒。",
      "不写投资亏赢结论。"
    ],
    repairParagraphRules: [
      "修复段优先写官禄稳定、田宅沉淀、福德节制和化科规范。",
      "修复路径写收入来源、成本边界和长期承载。",
      "无现实证据时隐藏投资资产判断。"
    ],
    dynamicParagraphRules: [
      "动态段写大限资源背景、流年财务主题、流月流日流时付款或成本提醒。",
      "流年财务触发必须保留大限资源背景。",
      "短周期付款不能写成长期财富结构。"
    ],
    reviewParagraphRules: [
      "投资、借贷、买卖、税务、法律财产类内容升级现实复核。",
      "财帛和田宅方向冲突时输出承载缺口。",
      "sourceRuleIds 不完整时隐藏财务结论。"
    ]
  },
  social: {
    summaryParagraphRules: [
      "总论先写交友、兄弟、官禄或迁移链承接的协作主题。",
      "强命中写团队资源、外部场域和落地宫位；弱命中只写社交提示。",
      "不得把朋友数量或短期聚会写成圈层结论。"
    ],
    evidenceParagraphRules: [
      "证据段按交友、兄弟、官禄、迁移、财帛和三方四正顺序列出。",
      "必须区分协作资源、沟通气氛、外部场域和成果承接。",
      "成果判断必须回到官禄或财帛。"
    ],
    pressureParagraphRules: [
      "受压段写交友化忌、兄弟受压、人情牵挂、角色边界或成本冲突。",
      "团队压力必须写清来源宫位和证据字段。",
      "不写人际绝对评价。"
    ],
    repairParagraphRules: [
      "修复段优先写官禄目标、财帛分润、迁移场域和辅曜协作。",
      "修复路径写角色、预算、合约和沟通边界。",
      "无官禄或财帛承接时隐藏合作成果。"
    ],
    dynamicParagraphRules: [
      "动态段写大限协作背景、流年团队主题、流月流日沟通节点。",
      "短周期只写会议、联络、沟通和临时协作。",
      "流年社交命中不得覆盖本命交友底盘。"
    ],
    reviewParagraphRules: [
      "合约、客户、团队责任和利益分配升级现实复核。",
      "交友强但官禄财帛弱时输出落地缺口。",
      "只有聚会小星时隐藏合作结论。"
    ]
  },
  review: {
    summaryParagraphRules: [
      "总论只汇总盘中实际命中的主题链，不展示未命中资料。",
      "强命中写全盘主轴和阶段重点；弱命中写局部提示。",
      "不得把资料仓库中所有条目都写成当前盘结论。"
    ],
    evidenceParagraphRules: [
      "证据段按主题链、主宫、辅助宫、格局、四化和动态层级归并。",
      "每条综合证据都必须回溯 sourceRuleIds。",
      "未命中的格局和主题链不进入证据段。"
    ],
    pressureParagraphRules: [
      "受压段只展示盘中确有煞忌、破格、落陷、空劫或来源冲突的主题。",
      "高风险压力必须写成证据路径和现实复核。",
      "不写全盘恐吓式总结。"
    ],
    repairParagraphRules: [
      "修复段只展示盘中确有化科、化禄、辅曜、庙旺或三方补强的主题。",
      "修复路径必须跟受压结构一一对应。",
      "无修复证据时输出复核缺口而非补救断语。"
    ],
    dynamicParagraphRules: [
      "动态段按本命、大限、流年、流月、流日、流时逐层组织。",
      "下级流层不能删除上级背景。",
      "动态段只展示当前选择或启用层级。"
    ],
    reviewParagraphRules: [
      "跨主题冲突、来源缺失、层级覆盖和高风险主题进入复核缺口。",
      "全盘总论必须保留未闭合字段。",
      "无法闭合时不输出结论。"
    ]
  }
}

export const ZIWEI_PALACE_THEME_CHAIN_OUTPUT_PARAGRAPH_TEMPLATE_DETAILS: ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail[] =
  getAllPalaceThemeChainResultThresholdContentDetails().map((threshold) => {
    const profile = CATEGORY_PARAGRAPH_PROFILES[threshold.category]
    const label = `${threshold.label}段落模板`
    const sourceReferences = buildPalaceThemeRuleSourceReferences()
    const template: Omit<
      ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail,
      "sections"
    > = {
      paragraphTemplateId: `palace-theme-chain-output-paragraph.${threshold.chainId}`,
      thresholdId: threshold.thresholdId,
      ruleId: threshold.ruleId,
      chainId: threshold.chainId,
      templateId: threshold.templateId,
      label,
      sourceReferences,
      category: threshold.category,
      primaryPalace: threshold.primaryPalace,
      paragraphTypes: COMMON_PARAGRAPH_TYPES,
      summaryParagraphRules: profile.summaryParagraphRules,
      evidenceParagraphRules: profile.evidenceParagraphRules,
      pressureParagraphRules: profile.pressureParagraphRules,
      repairParagraphRules: profile.repairParagraphRules,
      dynamicParagraphRules: profile.dynamicParagraphRules,
      reviewParagraphRules: profile.reviewParagraphRules,
      toneRules: COMMON_TONE_RULES,
      sourceFields: COMMON_SOURCE_FIELDS
    }

    return {
      ...template,
      sections: buildSections(template)
    }
  })

export function getPalaceThemeChainOutputParagraphTemplateContentDetail(
  paragraphTemplateId: string
): ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_OUTPUT_PARAGRAPH_TEMPLATE_DETAILS.find((detail) => {
      return detail.paragraphTemplateId === paragraphTemplateId
    }) ?? null
  )
}

export function getAllPalaceThemeChainOutputParagraphTemplateContentDetails(): ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_OUTPUT_PARAGRAPH_TEMPLATE_DETAILS]
}

function buildSections(
  detail: Omit<ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "段落模板定位",
      items: [
        `${detail.label}用于组织${SECTOR_LABELS[detail.primaryPalace]}为主宫的主题链输出段落。`,
        `对应展示门槛：${detail.thresholdId}，对应命中规则：${detail.ruleId}。`
      ]
    },
    {
      title: "段落类型",
      items: detail.paragraphTypes
    },
    {
      title: "总论段",
      items: detail.summaryParagraphRules
    },
    {
      title: "证据段",
      items: detail.evidenceParagraphRules
    },
    {
      title: "受压段",
      items: detail.pressureParagraphRules
    },
    {
      title: "修复段",
      items: detail.repairParagraphRules
    },
    {
      title: "动态盘段",
      items: detail.dynamicParagraphRules
    },
    {
      title: "复核缺口段",
      items: detail.reviewParagraphRules
    },
    {
      title: "语气边界",
      items: detail.toneRules
    },
    {
      title: "来源字段",
      items: detail.sourceFields
    }
  ]
}


