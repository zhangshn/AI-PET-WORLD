export type ZiweiCurrentChartParagraphSampleLayer =
  | "原盘"
  | "大限"
  | "流年"
  | "流月"
  | "流日"
  | "流时"

export interface ZiweiCurrentChartParagraphSampleSection {
  title: string
  items: string[]
}

export interface ZiweiCurrentChartParagraphSampleReviewProfile {
  sampleId: string
  title: string
  layer: ZiweiCurrentChartParagraphSampleLayer
  targetPalace: string
  topic: string
  coreQuestion: string
  requiredEvidence: string[]
  paragraphOrder: string[]
  sampleParagraph: string
  interpretationRules: string[]
  hiddenRules: string[]
  downgradeRules: string[]
  sourceBoundary: string[]
  reviewChecklist: string[]
  nextReviewAction: string
  sections: ZiweiCurrentChartParagraphSampleSection[]
}

const SAMPLE_DRAFTS: Array<
  Omit<ZiweiCurrentChartParagraphSampleReviewProfile, "sampleId" | "sections">
> = [
  {
    title: "原盘命宫主轴段落样例",
    layer: "原盘",
    targetPalace: "命宫",
    topic: "主星、同宫、三方四正与格局主轴",
    coreQuestion: "这张盘的命宫主轴能否由本宫主星、同宫星曜、三方四正和命中格局共同说明。",
    requiredEvidence: [
      "必须有原盘命宫、身宫、命主身主、宫干、地支和本宫星曜。",
      "必须列出主星、辅曜、煞曜、杂曜、庙旺落陷和同宫关系。",
      "必须列出对宫、三方四正、夹宫会照和参与格局的 patternId。",
      "必须列出四化来源、目标星、目标宫、sourceRuleIds 和资料来源层级。",
      "必须保留资料不足标记，不能用空泛断语补齐缺口。"
    ],
    paragraphOrder: [
      "先写盘层和宫位，不先写结论。",
      "再写本宫主星和同宫结构。",
      "再写对宫、三方四正和参与格局。",
      "再写四化、庙旺落陷、煞曜压力和吉曜修复。",
      "最后写当前盘证据边界和待复核内容。"
    ],
    sampleParagraph:
      "原盘命宫先以本宫主星定主轴，再看同宫辅曜、煞曜和杂曜如何修正。若三方四正同时引入官禄、财帛、迁移的承接，且命中主星骨架格局，则可说明此命宫不是单颗星独断，而是由本宫、对宫和会照宫共同形成判断入口。若四化来源指向命宫主星，需要写清来源天干和目标宫；若煞忌或落陷同时出现，则只能写成主轴受压或需要复核，不能直接写成高格结论。",
    interpretationRules: [
      "原盘命宫只论长期主轴，不把大限或流年短期触发写成本命定论。",
      "主星优先，但必须接受辅曜、煞曜、杂曜、四化和庙旺落陷修正。",
      "格局命中必须回到本宫、对宫和三方四正证据，不复制总字典全文。",
      "涉及身心、健康和灾厄时只作风险复核，不作医学诊断。"
    ],
    hiddenRules: [
      "没有命宫本宫星曜时隐藏主轴段。",
      "没有 patternId 的格局不进入当前盘格局段。",
      "没有四化来源时不输出四化结论。"
    ],
    downgradeRules: [
      "同宫证据完整但三方四正缺失时降为本宫观察。",
      "主星落陷且煞忌重时把高格降为受压结构。",
      "资料来源冲突时进入复核，不输出定论。"
    ],
    sourceBoundary: [
      "古籍和公开可用资料用于来源索引和规则复核。",
      "现代网站只参考栏目结构、主题标签和解释层级，不复制正文。",
      "当前盘段落只使用项目自有整理语言。",
      "当前阶段不做人格化映射，只做正统紫微斗数证据分析。",
      "动态盘只能作为层级继承和短期触发，不能反推或改写原盘命宫。"
    ],
    reviewChecklist: [
      "是否先写盘层和宫位。",
      "是否同时包含主星、辅曜、煞曜和杂曜。",
      "是否写清三方四正而不是只写本宫。",
      "是否区分总字典解释和当前盘命中结论。",
      "是否避免人格化、恐吓式和医学式断语。"
    ],
    nextReviewAction: "用真实盘例抽查命宫段落是否能把主星、宫位、三方四正、格局和四化合成一段可读分析。"
  },
  {
    title: "原盘夫妻宫关系段落样例",
    layer: "原盘",
    targetPalace: "夫妻宫",
    topic: "伴侣关系、对宫牵引、同宫组合与桃花杂曜",
    coreQuestion: "夫妻宫能否同时说明伴侣关系、合作契约、对宫牵引和桃花杂曜的边界。",
    requiredEvidence: [
      "必须有夫妻宫本宫主星、宫干、地支和同宫星曜。",
      "必须列出官禄对宫、福德财帛迁移等三方四正关系。",
      "必须区分主星关系结构、桃花杂曜、煞忌压力和吉曜修复。",
      "必须列出四化来源、目标星、目标宫和当前盘层。",
      "必须标明是否命中关系格局、破格或待复核格局。"
    ],
    paragraphOrder: [
      "先写夫妻宫讨论的是一对一关系和契约承诺。",
      "再写本宫主星的关系表达方式。",
      "再写对宫官禄和三方四正如何牵引关系现实。",
      "再写桃花、煞忌、辅曜和四化如何修正。",
      "最后写当前盘只呈现命中证据，不替用户下关系定论。"
    ],
    sampleParagraph:
      "原盘夫妻宫要先看本宫主星如何处理亲密关系、承诺和协作，再看对宫官禄是否把事业、责任或外界评价带入关系。若同宫见桃花杂曜，只能说明关系氛围、吸引力或社交牵动增强；若同时见煞忌、空劫或巨门类口舌结构，则要写成沟通成本、边界压力或复核点。三方四正若有禄权科和辅曜承接，可写关系有资源或协调入口，但不能把单颗桃花星直接写成婚姻结论。",
    interpretationRules: [
      "夫妻宫不只论婚恋，也论一对一合作、契约和互相承诺。",
      "桃花杂曜只作关系氛围和吸引力提示，不能单独定吉凶。",
      "对宫官禄和三方四正必须参与解释，避免只看本宫。",
      "动态盘触发夫妻宫时，只解释该期关系议题，不改写原盘关系结构。"
    ],
    hiddenRules: [
      "没有夫妻宫本宫证据时隐藏关系段。",
      "没有命中桃花格局时不显示桃花格局结果。",
      "没有动态盘选择时隐藏流年夫妻、流月夫妻等短周期标签。"
    ],
    downgradeRules: [
      "桃花见煞忌时降为关系边界复核。",
      "辅曜多但主星承接弱时降为外援存在但关系主轴不稳。",
      "短周期只作阶段触发，不反推长期婚恋结论。"
    ],
    sourceBoundary: [
      "关系解释使用项目自有整理语言。",
      "现代资料站只作为解释结构参考，不复制正文。",
      "高风险关系内容必须保留复核和降权边界。",
      "动态盘只说明阶段关系议题，不替代原盘夫妻宫结构。"
    ],
    reviewChecklist: [
      "是否把夫妻宫解释为关系和契约，而不只写婚姻。",
      "是否区分桃花氛围、主星结构和煞忌压力。",
      "是否写到对宫和三方四正。",
      "是否隐藏未命中的关系格局。",
      "是否避免替用户作现实关系决定。"
    ],
    nextReviewAction: "用真实盘例抽查夫妻宫段落是否能把关系结构、桃花杂曜、煞忌压力和三方四正分开写清。"
  },
  {
    title: "原盘财帛宫资源段落样例",
    layer: "原盘",
    targetPalace: "财帛宫",
    topic: "收入结构、资源承接、禄马权科与消耗边界",
    coreQuestion: "财帛宫能否说明资源从哪里来、如何承接、哪里消耗和是否能转为现实收益。",
    requiredEvidence: [
      "必须有财帛宫本宫星曜、宫干、地支和庙旺落陷。",
      "必须列出官禄、命宫、迁移和福德的三方四正承接。",
      "必须列出禄存、天马、四化来源、化禄、化权、化科和资源格局命中证据。",
      "必须列出化忌、空劫、煞曜、破格和消耗来源。",
      "必须标明资源信号是原盘长期结构还是动态盘短期触发。"
    ],
    paragraphOrder: [
      "先写财帛宫讨论的是资源流动和收入结构。",
      "再写本宫星曜如何取财、守财或耗财。",
      "再写财官迁命能否形成承接链。",
      "再写禄马权科、煞忌空劫和格局成色。",
      "最后写只说明资源倾向，不直接承诺收入结果。"
    ],
    sampleParagraph:
      "原盘财帛宫要先看本宫星曜代表的资源方式，再看官禄、迁移和命宫是否能把资源变成行动和承接。禄、马、权、科出现时，需要写清它们来自哪一层、落在哪个星和哪个宫；若财官迁命形成链条，可说明资源有流动和落地路径。若同时见化忌、空劫或煞曜，必须写成消耗、牵挂或成本上升，不可只写有财；若只是流年短期触发，也只能写该年资源议题被打开。",
    interpretationRules: [
      "财帛宫不等于现金数字，只论资源方式、收入结构和承接能力。",
      "禄不等于必然得财，马不等于必然迁动，权科也要看承接宫位。",
      "财官迁命链条完整时才可提高资源落地权重。",
      "破格或消耗证据存在时必须同时写成本和复核。"
    ],
    hiddenRules: [
      "没有财帛宫本宫证据时隐藏资源段。",
      "没有禄马权科命中时不显示资源格局。",
      "只有单颗财星但没有承接链时不输出高收益结论。"
    ],
    downgradeRules: [
      "禄忌同见时降为资源入口伴随牵挂。",
      "财帛见空劫时降为流动不稳或成本复核。",
      "动态盘资源信号不能覆盖原盘财帛结构。"
    ],
    sourceBoundary: [
      "资源解释只用项目自有整理语言。",
      "现代资料站只参考分类结构，不复制财运断语。",
      "当前盘财帛段只输出盘中真实命中的资源证据。",
      "涉及现实收益时必须保持倾向和证据边界。",
      "动态盘资源信号只作阶段触发，不承诺现实收益。"
    ],
    reviewChecklist: [
      "是否写清资源从哪里来。",
      "是否写清财官迁命承接链。",
      "是否区分资源信号和现实收益。",
      "是否同时写消耗和破格证据。",
      "是否避免承诺收入或投资结果。"
    ],
    nextReviewAction: "用真实盘例抽查财帛宫段落是否能把资源、承接、消耗和动态触发分开说明。"
  },
  {
    title: "大限官禄宫阶段段落样例",
    layer: "大限",
    targetPalace: "官禄宫",
    topic: "十年阶段事业主题、原盘继承与流年触发",
    coreQuestion: "大限官禄宫能否说明十年阶段的事业主题，同时保留原盘背景，不覆盖本命结构。",
    requiredEvidence: [
      "必须有大限命宫、大限官禄宫、大限十二宫和大限四化。",
      "必须保留原盘命宫、原盘官禄和原盘格局作为背景。",
      "必须列出大限官禄本宫星曜、三方四正和格局命中证据。",
      "必须列出流年是否触发该大限主题，但不得删除大限背景。",
      "必须标明大限只是十年阶段，不是原盘定论。"
    ],
    paragraphOrder: [
      "先写大限盘层和十年阶段。",
      "再写大限官禄宫本宫和三方四正。",
      "再写它继承或触发原盘哪些主题。",
      "再写流年如何在大限背景上打开事件窗口。",
      "最后写阶段边界和降权规则。"
    ],
    sampleParagraph:
      "切到大限时，官禄宫段落要先说明这是十年阶段的事业主题，而不是改写原盘事业结构。大限官禄本宫的主星和同宫星曜用于判断阶段职责、压力和发展方式；三方四正若能承接原盘命宫、财帛或迁移，则说明该阶段更容易把原盘潜在结构推到现实层。若流年再触发大限官禄，只能写成年度事件窗口打开，仍需保留大限背景和原盘底盘。",
    interpretationRules: [
      "大限段落必须写清十年阶段，不写成本命永久结论。",
      "大限解释必须继承原盘背景。",
      "流年触发大限时只作年度加重或打开窗口。",
      "大限格局显示时要同时保留原盘格局和当前选中层级。"
    ],
    hiddenRules: [
      "没有启用大限时隐藏大限官禄段。",
      "没有大限官禄本宫证据时不输出阶段事业段。",
      "只选原盘时隐藏大限、流年、流月等动态宫位标签。"
    ],
    downgradeRules: [
      "大限有触发但原盘承接弱时降为阶段压力。",
      "流年有事件但大限不承接时降为短期事项。",
      "来源冲突时进入复核，不输出明确阶段判断。"
    ],
    sourceBoundary: [
      "动态盘解释只取正统盘层逻辑。",
      "现代资料站只参考结构，不复制年度断语。",
      "当前盘大限段只输出当前选中大限命中的证据。",
      "动态段落必须保留原盘、大限、流年的层级边界。"
    ],
    reviewChecklist: [
      "是否写清大限是十年阶段。",
      "是否保留原盘背景。",
      "是否没有用流年覆盖大限。",
      "是否写清大限三方四正。",
      "是否隐藏未选择盘层的动态标签。"
    ],
    nextReviewAction: "用真实盘例抽查大限官禄段落是否能保留原盘背景，并把流年触发写成阶段内事件。"
  },
  {
    title: "流年迁移宫事件段落样例",
    layer: "流年",
    targetPalace: "迁移宫",
    topic: "年度外部环境、移动变化、上层盘继承与事件窗口",
    coreQuestion: "流年迁移宫能否说明年度外部环境变化，同时保留原盘和大限背景。",
    requiredEvidence: [
      "必须有流年命宫、流年迁移宫、流年四化和流年星曜。",
      "必须保留原盘迁移和大限迁移的上层背景。",
      "必须列出流年迁移本宫、对宫、三方四正和四化来源。",
      "必须说明是否命中动态格局、资源格局或煞曜压力格局。",
      "必须标明流年只管年度窗口，不反推本命结论。"
    ],
    paragraphOrder: [
      "先写流年盘层和年度外部议题。",
      "再写流年迁移本宫星曜和对宫牵引。",
      "再写原盘和大限背景如何被年度触发。",
      "再写四化、格局、煞曜和修复条件。",
      "最后写年度边界。"
    ],
    sampleParagraph:
      "流年迁移宫段落先说明这一年外部环境、出行、变动和异地议题被打开。流年迁移本宫星曜决定年度外界压力或机会的表现方式，对宫命宫说明本人如何回应；三方四正若连到财帛、官禄或福德，要写外部变化如何牵动资源、工作和心态。若原盘或大限迁移已有底层结构，流年只是在这一年触发它；若见煞忌或空劫，则写成出行、沟通、资源流动的复核点，不写成长期结论。",
    interpretationRules: [
      "流年迁移只管年度外部环境和移动变化。",
      "必须继承原盘和大限背景。",
      "流年四化必须写来源天干、目标星和目标宫。",
      "短周期流月、流日、流时只能进一步缩小事件窗口。"
    ],
    hiddenRules: [
      "没有选择流年时隐藏流年迁移标签。",
      "没有流年迁移本宫证据时隐藏年度迁移段。",
      "没有动态格局命中时不显示动态格局结果。"
    ],
    downgradeRules: [
      "流年触发但原盘和大限都不承接时降为短期外部事项。",
      "煞忌空劫重时降为风险复核。",
      "资料不足时只保留年度提示，不输出结论。"
    ],
    sourceBoundary: [
      "年度解释用项目自有语言，不复制现代网站流年断语。",
      "当前盘流年段只输出当前选中流年命中的证据。",
      "动态层级按原盘、大限、流年、流月、流日、流时降权。",
      "出行和风险内容只作复核提醒，不作保证或恐吓。"
    ],
    reviewChecklist: [
      "是否写清这是流年。",
      "是否保留大限和原盘背景。",
      "是否写清迁移对宫和三方四正。",
      "是否把四化来源讲清楚。",
      "是否避免把年度事件写成本命结论。"
    ],
    nextReviewAction: "用真实盘例抽查流年迁移段落是否能把年度事件窗口、上层继承和风险复核讲清。"
  },
  {
    title: "流月疾厄宫短期复核段落样例",
    layer: "流月",
    targetPalace: "疾厄宫",
    topic: "短期承压、作息节奏、修复资源与医学边界",
    coreQuestion: "流月疾厄宫能否只做短期身心承压和作息复核，不越界成医学诊断。",
    requiredEvidence: [
      "必须有流月命宫、流月疾厄宫、流月星曜和流月四化。",
      "必须保留原盘疾厄、大限疾厄和流年疾厄背景。",
      "必须列出本宫星曜、煞忌压力、修复星曜和三方四正。",
      "必须说明这是短期窗口，不反推长期健康结论。",
      "必须写明不做医学诊断。"
    ],
    paragraphOrder: [
      "先写流月盘层和短期复核。",
      "再写疾厄宫本宫星曜和承压主题。",
      "再写三方四正和修复资源。",
      "再写上层盘是否已有同类压力。",
      "最后写医学边界和资料不足处理。"
    ],
    sampleParagraph:
      "流月疾厄宫只看本月短期承压、作息节奏和修复资源。若本宫见煞忌、空劫或落陷，要写成压力、消耗或需要调整的复核点；若三方四正有化科、化禄、辅曜或庙旺主星承接，可写有缓和和修复入口。这个段落必须保留原盘、大限和流年的上层背景，不能用一个流月信号反推长期健康结论，更不能替代医学诊断。",
    interpretationRules: [
      "疾厄宫解释只作承压、作息、修复和风险复核。",
      "流月只管短期窗口。",
      "三方四正有修复资源时必须同时写缓和入口。",
      "涉及健康时必须写明不做医学诊断。"
    ],
    hiddenRules: [
      "没有选择流月时隐藏流月疾厄标签。",
      "没有流月疾厄本宫证据时隐藏短期疾厄段。",
      "没有健康相关证据时不输出疾厄复核段。"
    ],
    downgradeRules: [
      "单一流月煞曜只降为短期提醒。",
      "上层盘不承接时不得写长期问题。",
      "证据不足时只提示复核，不给结论。"
    ],
    sourceBoundary: [
      "疾厄资料只作传统命理语境下的承压复核。",
      "不使用也不复制现代网站的健康断语正文。",
      "当前盘流月段只输出当前选中流月命中的证据。",
      "动态盘疾厄信号只作短期复核，不反推长期身心结论。",
      "任何健康相关输出都必须保留医学边界。"
    ],
    reviewChecklist: [
      "是否写清流月短期窗口。",
      "是否保留原盘、大限和流年背景。",
      "是否把煞忌压力和修复资源分开。",
      "是否明确不做医学诊断。",
      "是否避免恐吓式断语。"
    ],
    nextReviewAction: "用真实盘例抽查流月疾厄段落是否能在短期复核和医学边界之间保持清楚。"
  }
]

export const ZIWEI_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW_PROFILES:
  ZiweiCurrentChartParagraphSampleReviewProfile[] = SAMPLE_DRAFTS.map((sample, index) => ({
    ...sample,
    sampleId: `p36-h8.current-chart-paragraph.${String(index + 1).padStart(2, "0")}`,
    sections: buildSections(sample)
  }))

function buildSections(
  sample: Omit<ZiweiCurrentChartParagraphSampleReviewProfile, "sampleId" | "sections">
): ZiweiCurrentChartParagraphSampleSection[] {
  return [
    { title: "核心问题", items: [sample.coreQuestion] },
    { title: "命中证据", items: sample.requiredEvidence },
    { title: "段落顺序", items: sample.paragraphOrder },
    { title: "样例段落", items: [sample.sampleParagraph] },
    { title: "解释规则", items: sample.interpretationRules },
    { title: "隐藏规则", items: sample.hiddenRules },
    { title: "降权规则", items: sample.downgradeRules },
    { title: "来源边界", items: sample.sourceBoundary },
    { title: "复核清单", items: sample.reviewChecklist },
    { title: "下一步复核", items: [sample.nextReviewAction] }
  ]
}

export function getAllZiweiCurrentChartParagraphSampleReviewProfiles():
  ZiweiCurrentChartParagraphSampleReviewProfile[] {
  return ZIWEI_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW_PROFILES
}

export function getZiweiCurrentChartParagraphSampleReviewProfile(
  sampleId: string
): ZiweiCurrentChartParagraphSampleReviewProfile | undefined {
  return ZIWEI_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW_PROFILES.find((sample) => {
    return sample.sampleId === sampleId
  })
}
