import { SECTOR_LABELS } from "../../page-view/labels"

import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainCategory,
  ZiweiPalaceThemeChainEvidenceHitRuleContentDetail
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"
import { getAllPalaceThemeChainSynthesisTemplateContentDetails } from "./palace-theme-chain-synthesis-template-catalog"

interface CategoryEvidenceProfile {
  strongHitRules: string[]
  weakHitRules: string[]
  breakageHitRules: string[]
  repairHitRules: string[]
  scoringNotes: string[]
}

const CATEGORY_EVIDENCE_PROFILES: Record<
  ZiweiPalaceThemeChainCategory,
  CategoryEvidenceProfile
> = {
  self: {
    strongHitRules: [
      "主宫有主星、亮度不弱，且辅助宫至少两宫有主星、辅曜、化禄、化权或化科承接。",
      "命宫、财帛、官禄、迁移或对应链条中的关键宫位形成同向证据，且煞忌没有集中破坏主宫。",
      "本命、大限或流年同一主题重复命中时，可判为阶段性强命中。"
    ],
    weakHitRules: [
      "主宫有证据但辅助宫只有一处可用承接，或证据主要来自短周期流层。",
      "主题链有辅曜或四化提示，但主星、亮度或三方四正证据不足。",
      "对宫和三方有提示但主宫自身偏弱时，只能写弱承接。"
    ],
    breakageHitRules: [
      "主宫落陷、空劫、煞忌集中，且辅助宫无化科、辅曜或庙旺主星补强。",
      "命中证据与破格、化忌或多重煞曜同时出现，先写受压和待修复。",
      "短周期煞忌冲入不能写成长期破格，只能写即时压力。"
    ],
    repairHitRules: [
      "存在化科、化禄、辅曜、庙旺主星或三方四正补强时，必须输出修复路径。",
      "辅助宫能承接主宫问题时，优先写现实落点和补救资源。",
      "缺少补强时，只保留复核缺口，不硬写解决方案。"
    ],
    scoringNotes: [
      "强命中需要主宫和辅助宫同时有证据。",
      "弱命中只允许输出提示，不输出结论。",
      "破格命中优先级高于强命中，但需要同时展示补救证据。"
    ]
  },
  career: {
    strongHitRules: [
      "官禄、财帛、迁移、交友或父母等关键宫位至少三处形成事业、资源、平台或制度证据。",
      "官禄有主星承接，且财帛或迁移有化禄、化科、辅曜或稳定主星回流。",
      "大限或流年官禄、财帛、迁移命中同一主题时，可判为阶段事业强命中。"
    ],
    weakHitRules: [
      "只有官禄单宫强而财帛、迁移或交友缺少承接时，写事业方向有提示但落点不足。",
      "证据主要来自交友或迁移而官禄不明时，只写外部机会或团队提示。",
      "短周期工作节点只能写事件触发，不能写长期职业结构。"
    ],
    breakageHitRules: [
      "官禄煞忌重且财帛无回收，判断为事业责任重、资源承接不足。",
      "交友或迁移煞忌冲入官禄链条，写团队、客户、外部环境带来成本。",
      "化权强但无化科、化禄或辅曜缓冲时，写责任和压力并存。"
    ],
    repairHitRules: [
      "父母化科、文书证照、交友辅曜和财帛回收是事业链优先补救证据。",
      "官禄有煞忌时先找化科、辅曜和流程规范。",
      "财帛有承接时输出资源回收路径；没有承接时只输出待复核。"
    ],
    scoringNotes: [
      "事业强命中至少需要责任宫和资源宫同时成立。",
      "外部机会不等同职业成功，要看官禄承接。",
      "破格段只在煞忌、落陷、空劫或破格证据存在时展示。"
    ]
  },
  relationship: {
    strongHitRules: [
      "夫妻、福德、命宫、子女或交友等关系链至少三处形成同向证据。",
      "夫妻有稳定主星或辅曜，且福德或命宫能承接关系压力时，可判为强命中。",
      "化禄、化科、辅曜进入夫妻或福德，并与三方四正呼应时，输出关系缓冲和修复资源。"
    ],
    weakHitRules: [
      "只有桃花、杂曜或短周期流层触发时，只写关系气氛或互动提示。",
      "夫妻宫有提示但福德或命宫无承接时，写关系议题存在但稳定度待复核。",
      "交友或子女介入但夫妻证据不足时，只写社交或延伸议题。"
    ],
    breakageHitRules: [
      "夫妻化忌、煞忌重且福德受压时，写牵挂、反复、边界和精神消耗。",
      "交友煞忌介入夫妻链时，写社交压力或外部关系干扰。",
      "短周期争执不能写成长期关系破局。"
    ],
    repairHitRules: [
      "福德化禄、化科、辅曜和命宫承接是关系链优先修复证据。",
      "夫妻有煞忌时先看对宫、三方四正是否有辅曜或稳定主星。",
      "没有修复证据时只输出边界和复核问题。"
    ],
    scoringNotes: [
      "关系强命中必须同时看夫妻和承接宫。",
      "桃花不单独构成强命中。",
      "高风险关系判断必须降级为复核提示。"
    ]
  },
  family: {
    strongHitRules: [
      "田宅、父母、福德、财帛或子女等家庭链至少三处有同向证据。",
      "田宅有稳定主星或化禄，父母有化科、辅曜或文书证据时，可判为家庭根基强命中。",
      "财帛能支持田宅或家庭责任时，输出承载较完整。"
    ],
    weakHitRules: [
      "田宅单宫强但父母、财帛或福德缺少承接时，只写家庭主题明显。",
      "父母宫有文书或长辈提示但田宅不明时，只写背景或制度提示。",
      "短周期家务、文书或长辈消息只作为事件触发。"
    ],
    breakageHitRules: [
      "田宅化忌、煞忌或空劫重，且财帛无承接时，写家庭资产或空间责任压力。",
      "父母煞忌重时，写长辈、上级、手续或制度卡点。",
      "福德受压时，写家庭议题转成精神负担。"
    ],
    repairHitRules: [
      "父母化科、文书顺畅、田宅稳定主星和财帛承接是家庭链优先补救证据。",
      "田宅受压时先找财帛资源和父母文书制度缓冲。",
      "无补强时不输出资产判断，只保留待核验。"
    ],
    scoringNotes: [
      "家庭强命中必须区分空间、长辈、文书、资产和精神安全感。",
      "产权和法律现实不由命理资料决定。",
      "田宅单宫不构成完整家庭链结论。"
    ]
  },
  health: {
    strongHitRules: [
      "疾厄、福德、命宫、财帛或田宅等身心链至少三处有压力和修复证据。",
      "疾厄有压力提示且福德有修复资源时，可判为身心主题命中。",
      "化科、辅曜或稳定主星落在疾厄、福德时，输出修复和调理入口。"
    ],
    weakHitRules: [
      "只有短周期流月、流日或流时触发时，只写临时疲劳或节奏提醒。",
      "疾厄有提示但福德、财帛或田宅无承接时，写压力存在但修复路径待复核。",
      "只有财帛成本提示而疾厄不明时，不输出健康主题强命中。"
    ],
    breakageHitRules: [
      "疾厄化忌、煞忌集中且福德受压时，写压力、损耗和检查提醒。",
      "官禄、财帛压力进入疾厄链时，写工作、成本或责任牵动身心。",
      "所有健康类破格都必须降级为风险提醒。"
    ],
    repairHitRules: [
      "福德化禄、化科、疾厄辅曜和财帛资源是优先修复证据。",
      "田宅或迁移能改善空间和节奏时，可输出环境调整路径。",
      "无现实修复证据时只提示复核和现实检查。"
    ],
    scoringNotes: [
      "健康主题不输出诊断。",
      "强命中表示主题明显，不表示疾病成立。",
      "短周期只给即时提醒。"
    ]
  },
  wealth: {
    strongHitRules: [
      "财帛、田宅、官禄、福德或疾厄等财务链至少三处形成资源、回收或成本证据。",
      "财帛有化禄、禄存、稳定主星或辅曜，且官禄或田宅能承接时，可判为强命中。",
      "资源入口和沉淀宫同时成立时，输出现金流与长期承载并行。"
    ],
    weakHitRules: [
      "财帛单宫有提示但官禄、田宅或福德无承接时，只写资源议题明显。",
      "只有消费、福德或短周期付款提示时，不写财富结构。",
      "田宅有资产提示但财帛无现金流证据时，只写存量责任待复核。"
    ],
    breakageHitRules: [
      "财帛化忌、空劫或煞忌重时，写现金流牵挂、虚实落差和成本压力。",
      "田宅责任消耗财帛时，写长期资产责任压住现金流。",
      "疾厄介入时，写修复成本和风险成本，不写财务灾断。"
    ],
    repairHitRules: [
      "官禄稳定、田宅沉淀、福德节制和化科规范是财富链优先修复证据。",
      "财帛受压时先找收入来源、成本边界和长期承载。",
      "缺少现实证据时不输出投资或资产判断。"
    ],
    scoringNotes: [
      "财务强命中不等于投资建议。",
      "收入、支出、存量和成本必须分开。",
      "破格段不得输出恐吓式贫富判断。"
    ]
  },
  social: {
    strongHitRules: [
      "交友、兄弟、官禄、迁移或财帛等社交链至少三处形成协作、团队、客户或外部场域证据。",
      "交友或兄弟有辅曜、化禄、化科，且官禄能承接时，可判为协作强命中。",
      "迁移提供外部场域且财帛有回收时，输出圈层机会。"
    ],
    weakHitRules: [
      "只有交友或兄弟单宫触发时，只写协作提示。",
      "团队证据存在但官禄或财帛无承接时，不写成果，只写关系资源待落地。",
      "短周期聚会、会议或沟通只作为事件触发。"
    ],
    breakageHitRules: [
      "交友化忌、煞忌重时，写团队消耗、客户压力或人情牵挂。",
      "兄弟受压时，写沟通误差、同辈竞争或近身协作成本。",
      "财帛受冲时，写合作收益和成本需要核验。"
    ],
    repairHitRules: [
      "官禄目标、财帛分润、迁移外部场域和辅曜协作是优先修复证据。",
      "交友受压时先看制度、角色和预算边界。",
      "无承接时只输出人际提示，不输出合作结论。"
    ],
    scoringNotes: [
      "社交强命中要能落到事业、资源或外部场域。",
      "朋友数量不是证据。",
      "合作结果必须回到现实沟通和合约。"
    ]
  },
  review: {
    strongHitRules: [
      "十二宫中主轴、资源、关系、身心、家庭和动态盘至少多类证据可追溯时，可判为全盘复核强命中。",
      "本命、大限和流年在同一主题重复指向，且来源规则完整时，输出阶段主题集中。",
      "格局命中、组合关系和主题链证据互相印证时，输出综合总论。"
    ],
    weakHitRules: [
      "只有单一宫位、单一星曜或短周期触发时，只输出局部提示。",
      "证据链有缺口时，标记待复核，不输出全盘判断。",
      "资料字典命中但当前盘没有对应证据时，不展示该段。"
    ],
    breakageHitRules: [
      "煞忌、空劫、落陷、破格集中且补强不足时，优先输出受压结构。",
      "本命和动态盘指向冲突时，写阶段触发，不覆盖本命底盘。",
      "来源规则缺失时，输出校准缺口而不是结论。"
    ],
    repairHitRules: [
      "吉曜、化科、化禄、庙旺主星和三方四正补强是全盘优先修复证据。",
      "动态盘受压时回到本命底盘和大限背景找承接。",
      "无法闭合时保留人工复核字段。"
    ],
    scoringNotes: [
      "全盘强命中必须跨多个主题链。",
      "未命中资料不展示。",
      "高风险主题只输出提醒和证据路径。"
    ]
  }
}

const COMMON_REQUIRED_EVIDENCE = [
  "chainId",
  "chartLayer",
  "primaryPalace",
  "palaceSequence",
  "samePalaceStars",
  "oppositePalaceStars",
  "trineSquareStars",
  "brightness",
  "transformationStarIds",
  "sourceRuleIds"
]

const COMMON_HIDDEN_WHEN = [
  "缺少 chainId、chartLayer、primaryPalace 或 sourceRuleIds 时隐藏整段。",
  "主宫、辅助宫、对宫和三方四正均无星曜、四化、亮度或格局证据时隐藏整段。",
  "只有资料字典模板但当前盘没有命中证据时隐藏整段。",
  "格局未命中时隐藏格局解释，只保留复核缺口。",
  "动态流未启用时隐藏该流层解释。"
]

const COMMON_DYNAMIC_LAYER_HIT_RULES = [
  "本命命中必须来自本命宫位、星曜、亮度、本命四化和本命格局。",
  "大限命中必须保留本命底盘，并标明大限命宫、大限流干和大限来源规则。",
  "流年命中必须保留大限背景，并标明流年命宫、流年流干和年度星曜。",
  "流月、流日、流时命中只作为短周期触发，不能提升为长期结论。",
  "下级流层命中不能删除上级命中，只能在当前层追加。"
]

const COMMON_SOURCE_FIELDS = [
  "ruleId",
  "chainId",
  "templateId",
  "chartLayer",
  "primaryPalace",
  "supportingPalaces",
  "palaceSequence",
  "samePalaceStars",
  "oppositePalaceStars",
  "trineSquareStars",
  "brightness",
  "transformationStarIds",
  "patternHitIds",
  "breakageIds",
  "dynamicFlowType",
  "sourceRuleIds"
]

export const ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_HIT_RULE_DETAILS: ZiweiPalaceThemeChainEvidenceHitRuleContentDetail[] =
  getAllPalaceThemeChainSynthesisTemplateContentDetails().map((template) => {
    const profile = CATEGORY_EVIDENCE_PROFILES[template.category]
    const label = `${template.label}命中规则`
    const sourceReferences = buildPalaceThemeRuleSourceReferences()
    const rule: Omit<
      ZiweiPalaceThemeChainEvidenceHitRuleContentDetail,
      "sections"
    > = {
      ruleId: `palace-theme-chain-hit-rule.${template.chainId}`,
      chainId: template.chainId,
      templateId: template.templateId,
      label,
      sourceReferences,
      category: template.category,
      primaryPalace: template.primaryPalace,
      palaceSequence: template.palaceSequence,
      requiredEvidence: [
        ...COMMON_REQUIRED_EVIDENCE,
        ...template.sourceFields.filter((field) => {
          return !COMMON_REQUIRED_EVIDENCE.includes(field)
        })
      ],
      strongHitRules: profile.strongHitRules,
      weakHitRules: profile.weakHitRules,
      breakageHitRules: profile.breakageHitRules,
      repairHitRules: profile.repairHitRules,
      hiddenWhen: COMMON_HIDDEN_WHEN,
      dynamicLayerHitRules: COMMON_DYNAMIC_LAYER_HIT_RULES,
      scoringNotes: profile.scoringNotes,
      sourceFields: COMMON_SOURCE_FIELDS
    }

    return {
      ...rule,
      sections: buildSections(rule)
    }
  })

export function getPalaceThemeChainEvidenceHitRuleContentDetail(
  ruleId: string
): ZiweiPalaceThemeChainEvidenceHitRuleContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_HIT_RULE_DETAILS.find((detail) => {
      return detail.ruleId === ruleId
    }) ?? null
  )
}

export function getAllPalaceThemeChainEvidenceHitRuleContentDetails(): ZiweiPalaceThemeChainEvidenceHitRuleContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_HIT_RULE_DETAILS]
}

function buildSections(
  detail: Omit<ZiweiPalaceThemeChainEvidenceHitRuleContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "命中规则定位",
      items: [
        `${detail.label}用于判断${SECTOR_LABELS[detail.primaryPalace]}为主宫的主题链何时可以输出解释。`,
        `对应主题链：${detail.chainId}，对应模板：${detail.templateId}。`
      ]
    },
    {
      title: "必要证据",
      items: detail.requiredEvidence
    },
    {
      title: "强命中",
      items: detail.strongHitRules
    },
    {
      title: "弱命中",
      items: detail.weakHitRules
    },
    {
      title: "破格命中",
      items: detail.breakageHitRules
    },
    {
      title: "修复命中",
      items: detail.repairHitRules
    },
    {
      title: "隐藏条件",
      items: detail.hiddenWhen
    },
    {
      title: "动态盘层级",
      items: detail.dynamicLayerHitRules
    },
    {
      title: "评分备注",
      items: detail.scoringNotes
    },
    {
      title: "来源字段",
      items: detail.sourceFields
    }
  ]
}
