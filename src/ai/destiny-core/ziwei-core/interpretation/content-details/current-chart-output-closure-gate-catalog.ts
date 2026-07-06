export type ZiweiCurrentChartOutputGateDecision =
  | "allow-current-output"
  | "dictionary-only"
  | "hide"
  | "review-required"
  | "prohibited"

export interface ZiweiCurrentChartOutputClosureGateSection {
  title: string
  items: string[]
}

export interface ZiweiCurrentChartOutputClosureGateProfile {
  gateId: string
  label: string
  decision: ZiweiCurrentChartOutputGateDecision
  purpose: string
  admissionConditions: string[]
  requiredEvidenceFields: string[]
  outputRules: string[]
  dictionaryOnlyRules: string[]
  hideRules: string[]
  reviewTriggers: string[]
  downgradeRules: string[]
  prohibitedOutputs: string[]
  sourceBoundary: string[]
  validationChecklist: string[]
  nextAction: string
  sections: ZiweiCurrentChartOutputClosureGateSection[]
}

const COMMON_REQUIRED_EVIDENCE = [
  "必须有当前盘命中证据，不能只引用总字典通用解释。",
  "必须有 dictionaryRefs、sourceRuleIds、evidenceLines 和 interpretationBoundary。",
  "必须写清盘层、本宫、对宫、三方四正、四化来源和动态盘层级。",
  "必须能回查到星曜、宫位、格局或动态盘的具体来源规则。"
]

const COMMON_SOURCE_BOUNDARY = [
  "现代网站只参考结构、栏目、主题标签和来源元信息，不复制正文。",
  "当前盘输出只使用项目自有整理语言。",
  "资料不足时进入复核，不用自由发挥补齐结论。",
  "当前阶段不做人格化映射，只做正统紫微斗数证据分析。"
]

const COMMON_PROHIBITED_OUTPUTS = [
  "禁止把总字典全文复制到当前盘结果。",
  "禁止显示未命中的格局、组合、四化或动态盘标签。",
  "禁止用流年、流月、流日、流时反推本命长期结论。",
  "禁止在疾厄、风险、关系、财务主题输出恐吓式或保证式断语。",
  "禁止复制现代网站或现代书籍正文。"
]

const GATE_DRAFTS: Array<Omit<ZiweiCurrentChartOutputClosureGateProfile, "sections">> = [
  {
    gateId: "current-output.natal-palace-core",
    label: "本命宫位主轴输出门禁",
    decision: "allow-current-output",
    purpose: "规定命宫、身宫和十二宫本宫资料进入当前盘段落的最低条件。",
    admissionConditions: [
      "必须存在本宫宫位、宫干、地支、命身标记和本宫星曜。",
      "必须能区分命宫、身宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母的宫位议题。",
      "必须说明本宫只是入口，还要看对宫、三方四正、同宫组合和四化来源。",
      "命身同宫时可以合并段落，但不能丢失命宫和身宫两类证据。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "先写盘层和宫位，再写本宫星曜和宫位主题。",
      "再写对宫牵引、三方四正承接和夹宫会照。",
      "再写四化、庙旺落陷、煞曜压力和吉曜修复。",
      "最后写证据边界和待复核内容。"
    ],
    dictionaryOnlyRules: [
      "宫位总义、十二宫通论和宫位主题链只留在总字典。",
      "没有当前盘命中宫位时，不把该宫通论写进当前盘。",
      "总字典可保留完整解释，当前盘只摘取命中证据对应的段落。"
    ],
    hideRules: [
      "缺本宫宫位或本宫星曜时隐藏本宫主轴段。",
      "未选中动态盘层时隐藏对应的大限、流年、流月、流日、流时宫位标签。",
      "没有命中证据的宫位专题隐藏在当前盘结果之外。"
    ],
    reviewTriggers: [
      "命身同宫但段落重复输出时进入复核。",
      "对宫或三方四正缺失时进入复核。",
      "宫位主题和星曜解释冲突时进入复核。"
    ],
    downgradeRules: [
      "只有本宫证据、没有三方四正时降为本宫观察。",
      "本宫主星落陷且煞忌重时降为受压结构。",
      "资料来源冲突时降为复核提示。"
    ],
    prohibitedOutputs: COMMON_PROHIBITED_OUTPUTS,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否先写盘层和宫位。",
      "是否包含本宫、对宫、三方四正和四化。",
      "是否没有把总字典宫位通论整段复制进当前盘。",
      "是否隐藏未选中盘层的动态标签。",
      "是否保留 sourceRuleIds 和 dictionaryRefs。"
    ],
    nextAction: "作为当前盘宫位段落的最终门禁，后续宫位资料必须先通过本项检查。"
  },
  {
    gateId: "current-output.star-body",
    label: "星曜本体输出门禁",
    decision: "dictionary-only",
    purpose: "规定星曜本体解释默认只属于总字典，只有落入当前盘宫位并有证据时才进入当前盘。",
    admissionConditions: [
      "必须存在星曜在当前盘某宫的实际落点。",
      "必须有星曜类别、庙旺落陷、同宫星曜和 placementRuleId。",
      "必须结合所在宫位议题，不得只输出单颗星曜本体。",
      "辅曜、煞曜、杂曜必须说明是增强、牵制、细节还是复核提示。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "当前盘只输出这颗星在本宫的作用。",
      "主星先定主轴，辅曜和杂曜只能修正主轴。",
      "煞曜和化忌必须写清压力来源和修复边界。",
      "短周期动态星曜必须降权为事件窗口。"
    ],
    dictionaryOnlyRules: [
      "星曜本体象义、完整性格词、传统别称和宽泛解释只留在总字典。",
      "星曜没有落入当前盘宫位时不进入当前盘。",
      "星曜组合未命中时只保留在总字典组合资料中。"
    ],
    hideRules: [
      "没有当前盘落点时隐藏该星曜解释。",
      "只有星曜本体、没有宫位和同宫证据时隐藏当前盘段落。",
      "四化星未标明来源天干和目标宫时隐藏四化结论。"
    ],
    reviewTriggers: [
      "主星和辅曜解释互相冲突时复核。",
      "杂曜覆盖主星主轴时复核。",
      "四化来源不清时复核。"
    ],
    downgradeRules: [
      "单颗辅曜只作辅助，不升级成主结论。",
      "单颗杂曜只作细节，不覆盖宫位主题。",
      "流月、流日、流时见星曜时只作短期触发。"
    ],
    prohibitedOutputs: COMMON_PROHIBITED_OUTPUTS,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否有当前盘落宫。",
      "是否结合宫位主题解释。",
      "是否区分主星、辅曜、煞曜、杂曜。",
      "是否没有把星曜本体通论写成当前盘结论。",
      "是否保留庙旺落陷和四化来源。"
    ],
    nextAction: "后续补星曜资料时，先进入总字典；只有命中当前盘并满足证据字段才进入当前盘输出。"
  },
  {
    gateId: "current-output.star-combination",
    label: "星曜组合输出门禁",
    decision: "allow-current-output",
    purpose: "规定同宫、对宫、三方四正、夹宫会照等组合进入当前盘的条件。",
    admissionConditions: [
      "必须有两颗或多颗星曜在同宫、对宫、三方四正或夹宫会照中真实出现。",
      "必须标明组合关系类型，不能把会照写成同宫。",
      "必须说明主次分工、承接宫位和是否有四化牵动。",
      "必须有 sourceRuleIds 和组合字典引用。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "先写组合关系类型，再写参与星曜。",
      "再写组合落在哪个宫位主题上。",
      "再写三方四正和四化如何增强或破坏。",
      "最后写组合成色、降权和复核点。"
    ],
    dictionaryOnlyRules: [
      "星曜两两组合全集留在总字典。",
      "没有在当前盘出现的组合不得进入当前盘。",
      "只存在理论组合、没有盘中关系时只保留索引。"
    ],
    hideRules: [
      "缺少组合关系类型时隐藏。",
      "缺少任一参与星曜实际落点时隐藏。",
      "缺少 sourceRuleIds 时隐藏当前盘组合结论。"
    ],
    reviewTriggers: [
      "同宫、对宫、三方四正、夹宫会照被混写时复核。",
      "组合主次不清时复核。",
      "组合与格局命中冲突时复核。"
    ],
    downgradeRules: [
      "会照组合弱于同宫组合。",
      "短周期组合弱于原盘和大限组合。",
      "煞忌重或主星承接弱时降权。"
    ],
    prohibitedOutputs: COMMON_PROHIBITED_OUTPUTS,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否写清组合关系类型。",
      "是否没有把会照写成同宫。",
      "是否包含三方四正和四化。",
      "是否只显示当前盘真实组合。",
      "是否保留组合来源规则。"
    ],
    nextAction: "用星曜组合资料进入当前盘前，必须先通过组合关系类型和命中证据检查。"
  },
  {
    gateId: "current-output.transformation-source",
    label: "四化来源输出门禁",
    decision: "allow-current-output",
    purpose: "规定四化进入当前盘时必须写清谁的四化、来自哪层盘、落到哪颗星和哪一宫。",
    admissionConditions: [
      "必须有来源天干、来源盘层、四化名称、目标星、目标宫和 placementRuleId。",
      "必须说明这是原盘四化、大限四化、流年四化、流月四化、流日四化还是流时四化。",
      "必须禁止给四化本身标庙旺落陷，庙旺落陷只属于目标星或主星状态。",
      "必须说明四化是增强、权责、名誉还是牵挂阻滞。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "先写来源盘层和来源天干。",
      "再写四化名称、目标星和目标宫。",
      "再写它影响哪个宫位主题。",
      "最后写短周期四化降权和复核边界。"
    ],
    dictionaryOnlyRules: [
      "四化表、天干四化规则和完整理论留在总字典。",
      "没有目标星落点时不进入当前盘。",
      "没有来源盘层时只进入复核，不输出结论。"
    ],
    hideRules: [
      "缺来源天干时隐藏。",
      "缺目标星或目标宫时隐藏。",
      "四化与当前选中盘层不一致时隐藏。"
    ],
    reviewTriggers: [
      "四化来源盘层不明时复核。",
      "四化目标星不存在时复核。",
      "四化被错误标庙旺落陷时复核。"
    ],
    downgradeRules: [
      "流月、流日、流时四化只作短周期触发。",
      "目标宫没有承接时降为提示。",
      "化忌遇修复证据时不作单向负面结论。"
    ],
    prohibitedOutputs: [
      ...COMMON_PROHIBITED_OUTPUTS,
      "禁止给四化本身标庙旺落陷。",
      "禁止省略来源盘层直接输出化禄、化权、化科、化忌结论。"
    ],
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否写清谁的四化。",
      "是否写清来源天干和来源盘层。",
      "是否写清目标星和目标宫。",
      "是否没有给四化本身标庙旺落陷。",
      "是否按动态盘层级降权。"
    ],
    nextAction: "四化资料进入当前盘前，必须通过来源盘层、目标星和目标宫三项门禁。"
  },
  {
    gateId: "current-output.pattern-hit",
    label: "格局命中输出门禁",
    decision: "allow-current-output",
    purpose: "规定格局只有真实命中时才能进入当前盘，未命中格局必须隐藏。",
    admissionConditions: [
      "必须有 patternId、conditionText、matchedPalaces 和 sourceRuleIds。",
      "必须说明格局命中盘层是原盘、大限、流年、流月、流日还是流时。",
      "必须列出成格条件、破格条件、加吉加煞和复核证据。",
      "必须说明当前盘只解释这张盘为什么成格或破格，不复制总字典全文。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "先写格局名称、盘层和命中宫位。",
      "再写成格证据和参与星曜。",
      "再写破格、加吉、加煞和降权。",
      "最后写总字典和当前盘的边界。"
    ],
    dictionaryOnlyRules: [
      "195 条格局总字典留在总字典。",
      "未命中的格局不进入当前盘结果。",
      "待复核格局只进入复核队列，不进入命盘结论。"
    ],
    hideRules: [
      "缺 patternId 时隐藏。",
      "缺 matchedPalaces 时隐藏。",
      "缺 sourceRuleIds 时隐藏。"
    ],
    reviewTriggers: [
      "成格和破格证据同时存在但权重不清时复核。",
      "动态格局层级不明时复核。",
      "格局解释复制总字典全文时复核。"
    ],
    downgradeRules: [
      "短周期命中格局降为事件窗口。",
      "主星承接弱时格局降权。",
      "煞忌破格重时先写破格和复核。"
    ],
    prohibitedOutputs: COMMON_PROHIBITED_OUTPUTS,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否具备 patternId。",
      "是否具备 conditionText。",
      "是否具备 matchedPalaces。",
      "是否具备 sourceRuleIds。",
      "是否没有显示未命中格局。"
    ],
    nextAction: "格局输出必须以命中证据为门禁，不能以总字典存在为显示条件。"
  },
  {
    gateId: "current-output.dynamic-layer",
    label: "动态盘层级输出门禁",
    decision: "allow-current-output",
    purpose: "规定大限、流年、流月、流日、流时进入当前盘时必须逐层继承和降权。",
    admissionConditions: [
      "必须有当前选中 flowType 和对应动态命宫。",
      "必须保留原盘背景，并在流年时保留大限背景。",
      "必须说明大限看十年阶段，流年看年度窗口，流月、流日、流时看短周期事件。",
      "大限未起运时只能输出未起运提示，不输出十年阶段结论。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "先写当前选中盘层。",
      "再写该层命宫和对应十二宫。",
      "再写该层四化、流曜和动态星曜。",
      "最后写继承上层背景和短周期降权。"
    ],
    dictionaryOnlyRules: [
      "动态盘规则总表留在总字典。",
      "未选中的动态层不进入当前盘主结果。",
      "动态层没有宫位证据时只进入复核。"
    ],
    hideRules: [
      "未选中大限时隐藏大限标签。",
      "未选中流年时隐藏流年标签。",
      "未选中流月、流日、流时时隐藏短周期标签。"
    ],
    reviewTriggers: [
      "切流年后大限背景丢失时复核。",
      "流月、流日、流时覆盖原盘时复核。",
      "未起运样本输出大限结论时复核。"
    ],
    downgradeRules: [
      "大限低于原盘，只能说明十年阶段，不能改写本命结构。",
      "流年低于大限，只能说明年度窗口，不能删除大限背景。",
      "流月、流日、流时低于流年，只作短周期触发和事件提醒。"
    ],
    prohibitedOutputs: [
      ...COMMON_PROHIBITED_OUTPUTS,
      "禁止用流年删除大限背景。",
      "禁止用流月、流日、流时改写原盘。"
    ],
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否写清当前 flowType。",
      "是否保留原盘和上层动态背景。",
      "是否短周期降权。",
      "是否处理未起运状态。",
      "是否未选中层级被隐藏。"
    ],
    nextAction: "动态盘输出必须以当前选中层级为入口，同时保留上层背景和降权边界。"
  },
  {
    gateId: "current-output.risk-topic",
    label: "高风险主题输出门禁",
    decision: "review-required",
    purpose: "规定疾厄、关系、财务、灾厄、法律风险等主题必须降级和复核。",
    admissionConditions: [
      "必须有明确宫位、星曜、煞忌、四化或格局证据。",
      "必须以复核和倾向表达，不输出恐吓式、保证式或现实替代决策。",
      "疾厄主题必须明确不做医学诊断。",
      "财务主题必须明确不做投资或收益承诺。"
    ],
    requiredEvidenceFields: COMMON_REQUIRED_EVIDENCE,
    outputRules: [
      "先写证据，不先写风险结论。",
      "再写压力来源和修复资源。",
      "再写复核边界和资料不足。",
      "最后写不替代现实专业判断。"
    ],
    dictionaryOnlyRules: [
      "高风险主题的完整解释留在总字典和复核资料。",
      "没有当前盘证据时不进入当前盘。",
      "现代资料的风险断语不得复制。"
    ],
    hideRules: [
      "没有风险证据时隐藏风险段。",
      "缺修复或复核边界时隐藏确定性风险结论。",
      "缺医学边界时隐藏疾厄结论。"
    ],
    reviewTriggers: [
      "出现医学、财务、法律、关系决策式语言时复核。",
      "风险段缺少修复资源时复核。",
      "短周期风险被写成长期结论时复核。"
    ],
    downgradeRules: [
      "高风险主题默认降权为复核提示。",
      "短周期风险只作短期提醒。",
      "证据不足时只显示资料不足。"
    ],
    prohibitedOutputs: [
      ...COMMON_PROHIBITED_OUTPUTS,
      "禁止输出任何医学诊断、治疗建议或替代专业医疗判断的文字。",
      "禁止输出投资收益承诺、确定性获利判断或财务决策指令。",
      "禁止替用户做关系、法律或财务决定。"
    ],
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否先写盘中证据，再写风险主题和承压方向。",
      "是否写明复核边界，并保留资料不足时的降级处理。",
      "是否明确不做医学诊断、投资收益承诺或现实决策替代。",
      "是否没有恐吓式断语、保证式断语和替用户决策的语气。",
      "是否把短周期风险降权为阶段提醒，而不是长期结论。"
    ],
    nextAction: "高风险主题进入当前盘前必须通过复核门禁，默认不输出确定性断语。"
  },
  {
    gateId: "current-output.source-boundary",
    label: "来源与版权输出门禁",
    decision: "prohibited",
    purpose: "规定外部资料和现代资料不得直接进入当前盘正文，只能作为元信息、结构参考和复核线索。",
    admissionConditions: [
      "必须区分公版古籍、现代网站、现代书籍、项目自有整理和算法规则。",
      "现代网站只能存标题、网址、栏目、主题标签、访问日期和自有摘要。",
      "现代书籍暂不入正文，只能保留元信息或人工复核线索。",
      "当前盘输出必须使用项目自有整理语言。"
    ],
    requiredEvidenceFields: [
      "sourceId",
      "sourceType",
      "sourceRuleIds",
      "dictionaryRefs",
      "projectOwnedSummary",
      "storageBoundary"
    ],
    outputRules: [
      "当前盘正文只输出项目自有整理后的证据分析。",
      "来源只作为引用线索和复核字段。",
      "现代资料不进入当前盘原文展示。",
      "资料不足时显示复核，不显示外部原文。"
    ],
    dictionaryOnlyRules: [
      "来源目录、采集规则、去重规则和复核队列留在数据字典。",
      "现代网站结构可以用于栏目参考，不复制正文。",
      "现代书籍暂不进入内容字典正文。"
    ],
    hideRules: [
      "没有来源边界时隐藏该资料。",
      "疑似复制现代正文时隐藏并复核。",
      "缺项目自有摘要时不进入当前盘。"
    ],
    reviewTriggers: [
      "来源类型不明时复核。",
      "摘要和原文过近时复核。",
      "现代资料被直接展示时复核。"
    ],
    downgradeRules: [
      "来源不足时降为线索。",
      "单一来源时降为待复核。",
      "来源冲突时不输出结论。"
    ],
    prohibitedOutputs: [
      ...COMMON_PROHIBITED_OUTPUTS,
      "禁止把现代网站正文写入当前盘。",
      "禁止把现代书籍正文写入当前盘。",
      "禁止绕过来源边界直接展示外部内容。"
    ],
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    validationChecklist: [
      "是否有 sourceId。",
      "是否有来源类型。",
      "是否有项目自有摘要。",
      "是否没有复制现代正文。",
      "是否只在当前盘展示自有分析。"
    ],
    nextAction: "所有资料进入当前盘前必须先通过来源边界检查，不满足则隐藏或进入复核。"
  }
]

export const ZIWEI_CURRENT_CHART_OUTPUT_CLOSURE_GATE_PROFILES:
  ZiweiCurrentChartOutputClosureGateProfile[] = GATE_DRAFTS.map((profile) => ({
    ...profile,
    sections: buildSections(profile)
  }))

function buildSections(
  profile: Omit<ZiweiCurrentChartOutputClosureGateProfile, "sections">
): ZiweiCurrentChartOutputClosureGateSection[] {
  return [
    { title: "门禁定位", items: [profile.purpose] },
    { title: "准入条件", items: profile.admissionConditions },
    { title: "必需证据字段", items: profile.requiredEvidenceFields },
    { title: "当前盘输出规则", items: profile.outputRules },
    { title: "总字典保留规则", items: profile.dictionaryOnlyRules },
    { title: "隐藏规则", items: profile.hideRules },
    { title: "复核触发", items: profile.reviewTriggers },
    { title: "降权规则", items: profile.downgradeRules },
    { title: "禁止输出", items: profile.prohibitedOutputs },
    { title: "来源边界", items: profile.sourceBoundary },
    { title: "校验清单", items: profile.validationChecklist },
    { title: "下一步动作", items: [profile.nextAction] }
  ]
}

export function getAllZiweiCurrentChartOutputClosureGateProfiles():
  ZiweiCurrentChartOutputClosureGateProfile[] {
  return ZIWEI_CURRENT_CHART_OUTPUT_CLOSURE_GATE_PROFILES
}

export function getZiweiCurrentChartOutputClosureGateProfile(
  gateId: string
): ZiweiCurrentChartOutputClosureGateProfile | undefined {
  return ZIWEI_CURRENT_CHART_OUTPUT_CLOSURE_GATE_PROFILES.find((profile) => {
    return profile.gateId === gateId
  })
}
