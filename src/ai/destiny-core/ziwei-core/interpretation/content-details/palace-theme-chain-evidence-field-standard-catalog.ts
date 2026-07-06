import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"

interface EvidenceFieldSeed {
  fieldName: string
  label: string
  category: string
  valueShape: string
  requiredScopes: string[]
  normalizationRules: string[]
  validationRules: string[]
  mergeRules: string[]
  displayUsage: string[]
  sourceLineage: string[]
  hiddenWhen: string[]
}

const FIELD_SEEDS: EvidenceFieldSeed[] = [
  identityField("chainId", "主题链 ID", "主题链的稳定唯一标识，用于把证据、规则、门槛和段落模板串联起来。"),
  identityField("templateId", "综合解释模板 ID", "主题链综合解释模板的唯一标识，用于追溯输出结构来源。"),
  identityField("ruleId", "命中规则 ID", "主题链证据命中规则的唯一标识，用于追溯强弱、破格、修复和隐藏判断。"),
  identityField("thresholdId", "展示门槛 ID", "主题链结果展示门槛的唯一标识，用于追溯结果层级、排序和隐藏抑制。"),
  identityField("paragraphTemplateId", "段落模板 ID", "主题链输出段落模板的唯一标识，用于追溯总论、证据、受压、修复、动态盘和复核缺口段。"),
  {
    fieldName: "chartLayer",
    label: "盘层",
    category: "layer",
    valueShape: "枚举字符串：natal、daYun、liuNian、liuYue、liuRi、liuShi。",
    requiredScopes: ["命中规则", "展示门槛", "段落模板", "动态盘解释"],
    normalizationRules: [
      "统一使用项目内部 flowType / chartLayer 枚举，不写中文自由文本。",
      "本命层固定为 natal；动态层必须保留具体层级。",
      "短周期流月、流日、流时不能提升为本命或大限层。"
    ],
    validationRules: [
      "字段值必须属于允许枚举。",
      "动态盘未启用时不能出现下级动态层证据。",
      "段落输出必须能说明该证据来自哪一层。"
    ],
    mergeRules: [
      "本命层作为底盘，不被动态层覆盖。",
      "大限、流年、流月、流日、流时按层级追加。",
      "同一字段跨层冲突时保留多层并标记复核。"
    ],
    displayUsage: [
      "用于区分原盘、大限、流年、流月、流日和流时段落。",
      "用于决定短周期是否降权。",
      "用于隐藏未启用的动态层内容。"
    ],
    sourceLineage: ["dynamicFlowDetails", "chartLayer", "sourceRuleIds"],
    hiddenWhen: [
      "缺少 chartLayer 时隐藏动态段。",
      "chartLayer 与当前查看层级不一致且无继承规则时隐藏。",
      "短周期层无当前盘证据时隐藏。"
    ]
  },
  {
    fieldName: "dynamicFlowType",
    label: "动态流类型",
    category: "layer",
    valueShape: "枚举字符串：daYun、liuNian、liuYue、liuRi、liuShi。",
    requiredScopes: ["动态盘段", "盘层继承", "复核缺口"],
    normalizationRules: [
      "只记录动态层，不记录 natal。",
      "字段值必须和 chartLayer 的动态层一致。",
      "同一输出中只允许一个当前查看动态层。"
    ],
    validationRules: [
      "dynamicFlowType 存在时 chartLayer 不得为空。",
      "流年必须继承大限背景；流月、流日、流时必须继承上级背景。",
      "未启用动态盘时不得生成 dynamicFlowType。"
    ],
    mergeRules: [
      "动态层按大限、流年、流月、流日、流时顺序合并。",
      "下级动态层只追加触发，不删除上级证据。",
      "多层同时命中时以当前查看层作为输出焦点。"
    ],
    displayUsage: [
      "用于动态盘段落标题。",
      "用于筛选当前流动盘内容。",
      "用于控制短周期触发的降权表达。"
    ],
    sourceLineage: ["dynamicFlowDetails.flowType", "selectedFlowType"],
    hiddenWhen: [
      "没有选择或启用对应流层时隐藏。",
      "只有动态流类型但没有宫位或星曜证据时隐藏。",
      "dynamicFlowType 与当前按钮状态不一致时隐藏。"
    ]
  },
  palaceField("primaryPalace", "主宫", "主题链当前主宫，是总论、排序和主证据的核心宫位。"),
  palaceListField("supportingPalaces", "辅助宫列表", "主题链用于承接主宫议题的辅助宫位集合。"),
  palaceListField("palaceSequence", "宫位读取顺序", "主题链读取主宫、辅助宫、对宫、三方四正和动态层的顺序。"),
  palaceListField("evidencePalaces", "证据宫位列表", "当前盘中实际参与该主题链命中的宫位集合。"),
  starListField("evidenceStars", "证据星曜列表", "当前盘中实际参与该主题链命中的星曜集合。"),
  starListField("samePalaceStars", "同宫星曜", "与主证据同宫出现的星曜集合，用于判断协同、牵制和加压。"),
  starListField("oppositePalaceStars", "对宫星曜", "对宫冲照到主题链的星曜集合，用于判断外部牵引。"),
  starListField("trineSquareStars", "三方四正星曜", "三方四正范围内会照主题链的星曜集合。"),
  {
    fieldName: "brightness",
    label: "星曜亮度",
    category: "star-state",
    valueShape: "星曜 ID 到亮度状态的映射，亮度可为庙、旺、得、利、平、陷、不论。",
    requiredScopes: ["证据段", "强弱判断", "破格判断", "修复判断"],
    normalizationRules: [
      "亮度状态必须来自统一庙旺落陷表或不论状态。",
      "四化本身不分庙旺，只观察目标星自身状态。",
      "杂曜无固定亮度时标记为不论，不强行补亮度。"
    ],
    validationRules: [
      "亮度必须能回溯到 starId 和 sectorName。",
      "缺亮度表的星曜不得伪造庙旺落陷。",
      "陷地只能作为承接压力，不单独断凶。"
    ],
    mergeRules: [
      "同一星曜跨层出现时按盘层分别保存亮度。",
      "主星亮度优先于辅煞杂亮度。",
      "亮度与组合、四化、宫位证据合并后再判断强弱。"
    ],
    displayUsage: [
      "用于证据段展示庙旺落陷。",
      "用于强命中和破格命中分级。",
      "用于判断修复证据是否有承接力。"
    ],
    sourceLineage: ["starBrightness", "brightness.table", "sourceRuleIds"],
    hiddenWhen: [
      "星曜无亮度定义且无不论标记时隐藏亮度。",
      "只有亮度而无星曜落宫时隐藏。",
      "亮度来源缺失时进入复核缺口。"
    ]
  },
  starListField("transformationStarIds", "四化星曜列表", "当前主题链中被化禄、化权、化科、化忌触发的星曜集合。"),
  idListField("patternHitIds", "命中格局 ID 列表", "当前盘实际命中的格局 ID 集合，未命中格局不得进入该字段。"),
  idListField("breakageIds", "破格证据 ID 列表", "当前盘实际出现的破格、受压、煞忌、空劫或来源冲突证据集合。"),
  idListField("repairEvidenceIds", "修复证据 ID 列表", "当前盘实际出现的化科、化禄、辅曜、庙旺、三方补强等修复证据集合。"),
  idListField("reviewFlags", "复核标记列表", "证据不足、来源冲突、层级冲突、高风险主题和人工校验需求集合。"),
  {
    fieldName: "displayTier",
    label: "展示层级",
    category: "display",
    valueShape: "枚举字符串：strong、weak、breakage、repair、hidden。",
    requiredScopes: ["展示门槛", "段落模板", "排序规则"],
    normalizationRules: [
      "统一使用英文枚举，不写自由中文状态。",
      "hidden 命中时优先隐藏，不再输出其他段落。",
      "breakage 与 repair 可并存，但必须分别入受压段和修复段。"
    ],
    validationRules: [
      "displayTier 必须来自命中规则和展示门槛。",
      "strong 需要必要证据完整。",
      "weak 不能打开结论式段落。"
    ],
    mergeRules: [
      "同一主题链多层命中时按最高风险和当前查看层合并。",
      "hidden 优先级最高，breakage 次之，repair 与 strong/weak 共同展示。",
      "多个 tier 并存时保留数组化来源。"
    ],
    displayUsage: [
      "用于控制段落是否展示。",
      "用于排序主题链结果。",
      "用于区分完整解释、提示、受压、修复和隐藏。"
    ],
    sourceLineage: ["resultThreshold", "evidenceHitRule", "sourceRuleIds"],
    hiddenWhen: [
      "displayTier 为 hidden 时隐藏对应主题链输出。",
      "displayTier 缺失且无法由证据规则推导时隐藏。",
      "displayTier 与证据不一致时进入复核缺口。"
    ]
  },
  {
    fieldName: "paragraphType",
    label: "段落类型",
    category: "display",
    valueShape: "枚举字符串：summary、evidence、pressure、repair、dynamic、review。",
    requiredScopes: ["段落模板", "报告输出", "资料检索"],
    normalizationRules: [
      "统一使用英文枚举，不写中文自由文本。",
      "每个段落必须绑定一个 paragraphType。",
      "同一段落不得同时承担多个类型。"
    ],
    validationRules: [
      "paragraphType 必须存在于段落模板允许列表。",
      "pressure 段必须有 breakageIds 或受压证据。",
      "repair 段必须有 repairEvidenceIds。"
    ],
    mergeRules: [
      "同一主题链按 summary、evidence、pressure、repair、dynamic、review 顺序合并。",
      "缺证据的段落不占位。",
      "高风险段落优先进入 review。"
    ],
    displayUsage: [
      "用于后续报告分段。",
      "用于页面只显示盘中有证据的段落。",
      "用于资料检索定位段落来源。"
    ],
    sourceLineage: ["outputParagraphTemplate", "displayTier", "sourceRuleIds"],
    hiddenWhen: [
      "paragraphType 未知时隐藏段落。",
      "段落类型与 displayTier 不匹配时隐藏。",
      "段落无当前盘证据时隐藏。"
    ]
  },
  idListField("sourceRuleIds", "来源规则 ID 列表", "所有证据必须回溯到的规则来源 ID 集合，是字段标准化的核心追踪字段。")
]

export const ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_FIELD_STANDARD_DETAILS: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail[] =
  FIELD_SEEDS.map((seed) => {
    const sourceReferences = buildPalaceThemeRuleSourceReferences()
    const detail: Omit<
      ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
      "sections"
    > = {
      fieldId: `palace-theme-chain-evidence-field.${seed.fieldName}`,
      sourceReferences,
      ...seed
    }

    return {
      ...detail,
      sections: buildSections(detail)
    }
  })

export function getPalaceThemeChainEvidenceFieldStandardContentDetail(
  fieldName: string
): ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_FIELD_STANDARD_DETAILS.find((detail) => {
      return detail.fieldName === fieldName || detail.fieldId === fieldName
    }) ?? null
  )
}

export function getAllPalaceThemeChainEvidenceFieldStandardContentDetails(): ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_FIELD_STANDARD_DETAILS]
}

function identityField(
  fieldName: string,
  label: string,
  summary: string
): EvidenceFieldSeed {
  return {
    fieldName,
    label,
    category: "identity",
    valueShape: "稳定字符串 ID。",
    requiredScopes: ["资料仓库", "命中规则", "展示门槛", "段落模板"],
    normalizationRules: [
      summary,
      "字段值必须由上游资料层生成，不允许页面临时拼接。",
      "同一对象在不同模块中必须使用同一个 ID。"
    ],
    validationRules: [
      "字段不能为空。",
      "字段必须能反查到对应资料记录。",
      "字段变化必须同步执行表和检查脚本。"
    ],
    mergeRules: [
      "同一 ID 只保留一次。",
      "跨层引用时保留上游 ID，不复制上游对象。",
      "无法匹配上游记录时进入复核缺口。"
    ],
    displayUsage: [
      "用于资料追踪。",
      "用于调试和人工复核。",
      "不直接作为用户解释正文。"
    ],
    sourceLineage: ["content-details", "content-knowledge-repository"],
    hiddenWhen: [
      "字段缺失时隐藏依赖该 ID 的段落。",
      "字段无法反查时隐藏当前结论。",
      "字段冲突时进入复核缺口。"
    ]
  }
}

function palaceField(
  fieldName: string,
  label: string,
  summary: string
): EvidenceFieldSeed {
  return {
    fieldName,
    label,
    category: "palace",
    valueShape: "十二宫位 SectorName 枚举。",
    requiredScopes: ["主题链", "证据段", "展示门槛"],
    normalizationRules: [
      summary,
      "统一使用 SectorName，不使用中文宫名作为内部字段值。",
      "中文宫名只在展示层由 label 映射生成。"
    ],
    validationRules: [
      "字段必须属于十二宫枚举。",
      "字段必须能映射到盘面宫位。",
      "缺少宫位时不得输出宫位结论。"
    ],
    mergeRules: [
      "主宫优先于辅助宫。",
      "动态层宫位必须保留对应 chartLayer。",
      "同一宫位跨层重复时按盘层分组。"
    ],
    displayUsage: [
      "用于输出主题链主轴。",
      "用于排序和段落标题。",
      "用于复核三方四正和对宫证据。"
    ],
    sourceLineage: ["palace-theme-chain", "chart.palaces", "sourceRuleIds"],
    hiddenWhen: [
      "宫位不存在时隐藏。",
      "宫位和当前盘层不匹配时隐藏。",
      "宫位只有字典资料但无当前盘证据时隐藏。"
    ]
  }
}

function palaceListField(
  fieldName: string,
  label: string,
  summary: string
): EvidenceFieldSeed {
  return {
    ...palaceField(fieldName, label, summary),
    valueShape: "SectorName 数组。",
    mergeRules: [
      "数组去重后按主题链定义顺序排序。",
      "主宫、辅助宫、对宫、三方四正不得混成同一角色。",
      "动态层宫位必须保留层级来源。"
    ]
  }
}

function starListField(
  fieldName: string,
  label: string,
  summary: string
): EvidenceFieldSeed {
  return {
    fieldName,
    label,
    category: "star",
    valueShape: "ZiweiStarId 数组，必要时附带 chartLayer 和 sectorName。",
    requiredScopes: ["证据段", "强弱判断", "破格判断", "修复判断"],
    normalizationRules: [
      summary,
      "统一使用 starId，不使用中文星名作为内部字段值。",
      "同名星、流动星和固定星必须保留来源层级。"
    ],
    validationRules: [
      "starId 必须存在于星曜目录。",
      "星曜必须能回溯到落宫或动态层。",
      "未落宫星曜不得进入当前盘证据。"
    ],
    mergeRules: [
      "同宫、对宫、三方四正分组保存。",
      "同一星曜跨层出现时按 chartLayer 分组。",
      "固定星和流系星曜不得混淆。"
    ],
    displayUsage: [
      "用于证据段列出星曜。",
      "用于判断主星、辅曜、煞曜、杂曜的角色。",
      "用于后续星曜字典弹层反查。"
    ],
    sourceLineage: ["star-catalog", "chart.palaces", "dynamicFlowDetails", "sourceRuleIds"],
    hiddenWhen: [
      "starId 不存在时隐藏。",
      "星曜没有当前盘落点时隐藏。",
      "只有资料字典星曜而无盘中证据时隐藏。"
    ]
  }
}

function idListField(
  fieldName: string,
  label: string,
  summary: string
): EvidenceFieldSeed {
  return {
    fieldName,
    label,
    category: "trace",
    valueShape: "字符串 ID 数组。",
    requiredScopes: ["证据追踪", "复核缺口", "资料检索"],
    normalizationRules: [
      summary,
      "ID 必须使用稳定来源，不允许自由文本描述代替。",
      "数组必须去重并保留原始来源。"
    ],
    validationRules: [
      "每个 ID 必须能反查来源或复核缺口。",
      "空数组不得打开对应段落。",
      "未知 ID 必须进入 reviewFlags。"
    ],
    mergeRules: [
      "同类 ID 去重合并。",
      "跨层 ID 按 chartLayer 分组。",
      "冲突 ID 保留并进入复核缺口。"
    ],
    displayUsage: [
      "用于资料追踪和人工复核。",
      "用于决定段落是否显示。",
      "通常不直接显示给最终用户。"
    ],
    sourceLineage: ["sourceRuleIds", "content-knowledge-repository", "check-content-knowledge-repository"],
    hiddenWhen: [
      "ID 列表为空时隐藏依赖段落。",
      "ID 无法反查时隐藏结论。",
      "ID 来源冲突时只展示复核缺口。"
    ]
  }
}

function buildSections(
  detail: Omit<
    ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
    "sections"
  >
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "字段定位",
      items: [
        `${detail.label}（${detail.fieldName}）属于 ${detail.category} 类证据字段。`,
        `值结构：${detail.valueShape}`
      ]
    },
    {
      title: "适用范围",
      items: detail.requiredScopes
    },
    {
      title: "标准化规则",
      items: detail.normalizationRules
    },
    {
      title: "校验规则",
      items: detail.validationRules
    },
    {
      title: "合并规则",
      items: detail.mergeRules
    },
    {
      title: "展示用途",
      items: detail.displayUsage
    },
    {
      title: "来源链路",
      items: detail.sourceLineage
    },
    {
      title: "隐藏条件",
      items: detail.hiddenWhen
    }
  ]
}
