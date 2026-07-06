import { SECTOR_LABELS } from "../../page-view/labels"

import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainCategory,
  ZiweiPalaceThemeChainSynthesisTemplateContentDetail
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"
import { getAllPalaceThemeChainContentDetails } from "./palace-theme-chain-catalog"

interface CategoryTemplateProfile {
  summaryFocus: string
  strengthFocus: string[]
  breakageFocus: string[]
  repairFocus: string[]
  riskBoundaries: string[]
}

const CATEGORY_TEMPLATE_PROFILES: Record<
  ZiweiPalaceThemeChainCategory,
  CategoryTemplateProfile
> = {
  self: {
    summaryFocus: "先说明命主主轴、现实承接、外部环境和精神底盘之间的关系，再列出可验证证据。",
    strengthFocus: [
      "主宫主星庙旺或得地，且辅助宫能承接资源、责任或外部机会时，可判为主题链承接较强。",
      "辅曜、化禄、化科进入主宫或关键辅助宫时，优先写成资源、名誉、学习和贵人补强。",
      "命宫与迁移、官禄或财帛形成清楚呼应时，可说明内外行动链条较完整。"
    ],
    breakageFocus: [
      "主宫落陷、空劫、煞忌集中且辅助宫无补强时，提示承接不稳。",
      "命宫强但财官迁断裂时，不写成无能力，而写成现实落点需要补证。",
      "动态短周期触发不能覆盖本命主轴，只能作为阶段提醒。"
    ],
    repairFocus: [
      "先寻找辅曜、化科、化禄和庙旺主星作为缓冲。",
      "再看财帛、官禄、迁移是否提供现实落点。",
      "最后用福德或父母等宫位补充精神、制度和背景资源。"
    ],
    riskBoundaries: [
      "不把命宫单宫写成全部人生定论。",
      "不把外界评价写成自我价值。",
      "不输出绝对成功或失败结论。"
    ]
  },
  career: {
    summaryFocus: "先说明事业责任、资源回收、团队网络和外部平台，再判断能否形成可持续职业结构。",
    strengthFocus: [
      "官禄、财帛、迁移或交友有主星稳固和辅曜会照时，可写成职业链条有支撑。",
      "化权落官禄或父母且有化科缓冲时，可说明责任、制度和名誉路径较清楚。",
      "财帛能承接官禄成果时，可说明事业成果有资源回收。"
    ],
    breakageFocus: [
      "官禄煞忌重而财帛无承接时，提示责任重但回收不足。",
      "交友或迁移煞忌冲入时，提示团队、客户或外部环境增加成本。",
      "只见化权无化科、化禄或辅曜时，避免写成纯粹升迁，需写责任和压力并存。"
    ],
    repairFocus: [
      "优先复核父母宫文书制度、交友宫团队和财帛宫资源回收。",
      "有化科时写规范、证照、流程和口碑修复。",
      "有辅曜会照时写协作、平台、贵人和学习补强。"
    ],
    riskBoundaries: [
      "不直接输出固定职业名称。",
      "不把化权直接写成升职。",
      "不输出投资、签约或劳动法律建议。"
    ]
  },
  relationship: {
    summaryFocus: "先说明关系模式、精神满足、互动边界和延伸责任，再区分亲密、合伙、社交或创造语境。",
    strengthFocus: [
      "夫妻宫有稳定主星且福德、命宫能承接时，可写关系互动较有缓冲。",
      "化禄、化科或辅曜进入夫妻、福德、子女时，可写吸引、沟通、名分和修复资源。",
      "子女或交友提供正向延伸时，可说明关系议题能转成作品、协作或社交支持。"
    ],
    breakageFocus: [
      "夫妻化忌或煞忌重时，写牵挂、反复、投射和边界议题，不写恐吓式结论。",
      "福德受压时，提示关系消耗精神余裕。",
      "交友干扰夫妻链条时，需区分社交压力和亲密关系本体。"
    ],
    repairFocus: [
      "先看福德是否有化禄、化科或吉曜缓冲。",
      "再看命宫能否主动调整沟通方式。",
      "最后看夫妻对宫和三方是否有辅曜或稳定主星补强。"
    ],
    riskBoundaries: [
      "不直接断结婚、离婚、出轨或具体对象。",
      "不把桃花星写成单一好坏。",
      "关系结论必须保留证据和盘层。"
    ]
  },
  family: {
    summaryFocus: "先说明家庭根基、长辈背景、文书制度、资产空间和安全感，再判断责任与支撑的比例。",
    strengthFocus: [
      "田宅、父母、福德形成正向承接时，可写家庭和背景有支撑。",
      "父母化科或辅曜多时，可写文书、制度、长辈和上级缓冲。",
      "田宅有稳定主星或化禄时，可写长期承载和空间资源较明显。"
    ],
    breakageFocus: [
      "田宅化忌或煞忌重时，提示家庭空间、资产责任或居住变动压力。",
      "父母煞忌重时，提示长辈、上级、文书或制度卡点。",
      "福德受压时，说明家庭议题可能转为长期心绪负担。"
    ],
    repairFocus: [
      "先复核父母宫化科、文昌文曲和辅曜作为文书制度补强。",
      "再看财帛是否能支持家庭责任。",
      "最后看福德是否提供安全感和精神缓冲。"
    ],
    riskBoundaries: [
      "不输出产权、继承、合同等法律结论。",
      "不直接断房产数量。",
      "不把父母宫只解释为父母本人。"
    ]
  },
  health: {
    summaryFocus: "先说明身心承压、精神缓冲、生活节律和修复资源，再把结论降级为风险提醒。",
    strengthFocus: [
      "福德有化禄、化科或吉曜时，可写精神缓冲和恢复资源较好。",
      "疾厄有化科、辅曜或稳定主星时，可写有秩序修复和调理入口。",
      "财帛或田宅能支撑修复成本和生活空间时，承压链条较容易闭合。"
    ],
    breakageFocus: [
      "疾厄化忌、煞忌集中时，只写压力、损耗和检查提醒。",
      "官禄或财帛压力冲入疾厄时，提示工作、成本或责任牵动身心。",
      "福德受压时，提示休息不足、精神内耗或修复节律不稳。"
    ],
    repairFocus: [
      "优先寻找福德、疾厄的化科和辅曜作为修复资源。",
      "再看财帛能否支持现实调理成本。",
      "最后用迁移或田宅判断换环境、作息和空间调整。"
    ],
    riskBoundaries: [
      "不输出疾病名称或医学诊断。",
      "不替代医生、体检和治疗建议。",
      "短周期触发只作为临时提醒。"
    ]
  },
  wealth: {
    summaryFocus: "先说明现金流、长期资产、成本结构和安全感，再区分收入、支出、存量和风险。",
    strengthFocus: [
      "财帛有化禄、禄存、稳定主星或辅曜时，可写资源入口较清楚。",
      "田宅能承接财帛时，可写资源有沉淀空间。",
      "官禄或事业链条能回流财帛时，可写收入模型较有来源。"
    ],
    breakageFocus: [
      "财帛化忌或空劫重时，提示现金流牵挂、虚实落差或成本压力。",
      "田宅化权化忌重时，提示长期资产责任可能消耗现金流。",
      "疾厄介入财帛链条时，提示修复成本、风险成本和节奏损耗。"
    ],
    repairFocus: [
      "先看官禄是否提供稳定收入来源。",
      "再看田宅是否能沉淀资源或形成长期承载。",
      "最后看福德是否把消费欲望和安全感拉回平衡。"
    ],
    riskBoundaries: [
      "不输出投资建议、收益承诺或财务决策。",
      "不把财帛单宫写成富贵贫穷。",
      "现实资产必须由合同、账目和法律文件核验。"
    ]
  },
  social: {
    summaryFocus: "先说明同辈、团队、客户、社群和外部协作，再判断它们如何服务事业或资源回收。",
    strengthFocus: [
      "交友或兄弟有辅曜、化禄、化科时，可写协作、人脉和团队资源。",
      "官禄能承接交友成果时，可写团队力量能进入事业结构。",
      "迁移有外部机会时，可写社交圈层带来跨域发展。"
    ],
    breakageFocus: [
      "交友化忌或煞忌重时，提示团队消耗、客户压力或人情牵挂。",
      "兄弟受压时，提示同辈竞争、沟通误差或近身协作成本。",
      "财帛受冲时，提示合作收益和成本需要分开核验。"
    ],
    repairFocus: [
      "先看官禄是否能给团队协作设定目标。",
      "再看财帛是否有清楚分润或预算边界。",
      "最后看迁移是否提供外部场域和新圈层。"
    ],
    riskBoundaries: [
      "不把交友宫写成朋友数量。",
      "不把同辈竞争写成人际灾断。",
      "合作结论不能替代现实合约和沟通。"
    ]
  },
  review: {
    summaryFocus: "先把十二宫分层扫过，再按星曜、宫位、关系、格局、动态盘和风险边界输出总论。",
    strengthFocus: [
      "主星骨架清楚、辅曜补强、四化来源明确、格局命中可追溯时，可写全盘结构较清楚。",
      "三方四正、对宫和夹宫能互相印证时，可写证据链完整。",
      "本命、大限、流年层级一致时，可写阶段主题较集中。"
    ],
    breakageFocus: [
      "煞忌、空劫、落陷和破格集中时，优先写代价、修复和降权。",
      "动态盘与本命底盘冲突时，先保留本命底盘，再说明阶段触发。",
      "证据不足时，隐藏未命中模板，不输出泛泛解释。"
    ],
    repairFocus: [
      "先找吉曜、化科、化禄和庙旺主星。",
      "再看对宫、三方四正和夹宫是否有补强。",
      "最后标记人工复核缺口和来源规则。"
    ],
    riskBoundaries: [
      "不一次性展示所有资料字典。",
      "不把模板输出写成当前盘必然结论。",
      "高风险主题只给提醒和复核路径。"
    ]
  }
}

const COMMON_OUTPUT_STRUCTURE = [
  "一句话总论：先说明该主题链当前看的是哪一个问题，不直接给绝对吉凶。",
  "证据摘要：列出主宫、辅助宫、三方四正、对宫、星曜类别、四化和亮度。",
  "承接判断：区分强承接、弱承接、受压、破格和待复核。",
  "动态盘说明：标明本命、大限、流年、流月、流日或流时来源。",
  "边界提醒：隐藏未命中结果，保留人工复核和风险语言。"
]

const COMMON_EVIDENCE_ORDER = [
  "先看主宫：宫位主题、主星、亮度、四化、煞忌和空劫。",
  "再看辅助宫：辅助宫是否能承接主宫问题。",
  "再看对宫：对象、外部牵引、压力来源和镜像反馈。",
  "再看三方四正：资源、事业、关系或环境是否形成会照。",
  "再看动态盘层：本命为底，大限为阶段，流年为年度，流月流日流时降权。"
]

const COMMON_DYNAMIC_LAYER_RULES = [
  "本命模板输出长期结构，只引用本命星曜、宫位、亮度和本命四化。",
  "大限模板输出十年阶段，必须保留本命底盘，不删除原盘标记。",
  "流年模板输出年度触发，必须保留大限背景和流年来源天干。",
  "流月、流日、流时模板只输出短周期提醒，不写长期命格。",
  "同一主题链如果当前盘没有命中证据，只隐藏该模板结果，不展示空泛说明。"
]

const COMMON_HIDDEN_RESULT_RULES = [
  "没有落入该主题链的星曜、四化、格局或动态证据时，不输出该段解释。",
  "格局未命中时不展示格局模板，只保留可追溯的复核缺口。",
  "破格条件不存在时不展示破格段，避免把资料字典当成当前盘结论。",
  "短周期没有启用时不展示流月、流日、流时模板。",
  "来源规则缺失时只标记待复核，不生成断语。"
]

const COMMON_SOURCE_FIELDS = [
  "templateId",
  "chainId",
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
  "sourceRuleIds"
]

export const ZIWEI_PALACE_THEME_CHAIN_SYNTHESIS_TEMPLATE_DETAILS: ZiweiPalaceThemeChainSynthesisTemplateContentDetail[] =
  getAllPalaceThemeChainContentDetails().map((chain) => {
    const profile = CATEGORY_TEMPLATE_PROFILES[chain.category]
    const label = `${chain.label}综合解释模板`
    const sourceReferences = buildPalaceThemeRuleSourceReferences()

    return {
      templateId: `palace-theme-chain-template.${chain.chainId}`,
      chainId: chain.chainId,
      label,
      sourceReferences,
      category: chain.category,
      primaryPalace: chain.primaryPalace,
      palaceSequence: chain.palaceSequence,
      summaryTemplate: `${label}：${profile.summaryFocus}${chain.chainReading}`,
      outputStructure: COMMON_OUTPUT_STRUCTURE,
      evidenceOrder: [
        `主宫先读${SECTOR_LABELS[chain.primaryPalace]}，再按${chain.palaceSequence
          .map((sectorName) => SECTOR_LABELS[sectorName])
          .join("、")}顺序展开。`,
        ...COMMON_EVIDENCE_ORDER
      ],
      strengthRules: profile.strengthFocus,
      breakageRules: profile.breakageFocus,
      repairRules: profile.repairFocus,
      dynamicLayerRules: COMMON_DYNAMIC_LAYER_RULES,
      hiddenResultRules: COMMON_HIDDEN_RESULT_RULES,
      riskBoundaries: profile.riskBoundaries,
      sourceFields: COMMON_SOURCE_FIELDS,
      sections: buildSections({
        templateId: `palace-theme-chain-template.${chain.chainId}`,
        chainId: chain.chainId,
        label,
        sourceReferences,
        category: chain.category,
        primaryPalace: chain.primaryPalace,
        palaceSequence: chain.palaceSequence,
        summaryTemplate: `${label}：${profile.summaryFocus}${chain.chainReading}`,
        outputStructure: COMMON_OUTPUT_STRUCTURE,
        evidenceOrder: [
          `主宫先读${SECTOR_LABELS[chain.primaryPalace]}，再按${chain.palaceSequence
            .map((sectorName) => SECTOR_LABELS[sectorName])
            .join("、")}顺序展开。`,
          ...COMMON_EVIDENCE_ORDER
        ],
        strengthRules: profile.strengthFocus,
        breakageRules: profile.breakageFocus,
        repairRules: profile.repairFocus,
        dynamicLayerRules: COMMON_DYNAMIC_LAYER_RULES,
        hiddenResultRules: COMMON_HIDDEN_RESULT_RULES,
        riskBoundaries: profile.riskBoundaries,
        sourceFields: COMMON_SOURCE_FIELDS,
        sections: []
      })
    }
  })

export function getPalaceThemeChainSynthesisTemplateContentDetail(
  templateId: string
): ZiweiPalaceThemeChainSynthesisTemplateContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_SYNTHESIS_TEMPLATE_DETAILS.find((detail) => {
      return detail.templateId === templateId
    }) ?? null
  )
}

export function getAllPalaceThemeChainSynthesisTemplateContentDetails(): ZiweiPalaceThemeChainSynthesisTemplateContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_SYNTHESIS_TEMPLATE_DETAILS]
}

function buildSections(
  detail: ZiweiPalaceThemeChainSynthesisTemplateContentDetail
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "模板定位",
      items: [detail.summaryTemplate]
    },
    {
      title: "输出结构",
      items: detail.outputStructure
    },
    {
      title: "证据顺序",
      items: detail.evidenceOrder
    },
    {
      title: "强承接规则",
      items: detail.strengthRules
    },
    {
      title: "破格与受压规则",
      items: detail.breakageRules
    },
    {
      title: "修复与补强规则",
      items: detail.repairRules
    },
    {
      title: "动态盘层级",
      items: detail.dynamicLayerRules
    },
    {
      title: "隐藏未命中结果",
      items: detail.hiddenResultRules
    },
    {
      title: "风险边界",
      items: detail.riskBoundaries
    },
    {
      title: "来源字段",
      items: detail.sourceFields
    }
  ]
}
