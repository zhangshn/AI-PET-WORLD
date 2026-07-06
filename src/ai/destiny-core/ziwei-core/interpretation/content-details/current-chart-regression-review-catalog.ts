export interface ZiweiCurrentChartRegressionExpectedCore {
  lifePalace: string
  bodyPalace: string
  elementGate: string
  totalStarCount: number
  direction: "forward" | "backward"
  startAge: number
  isDaYunStarted: boolean
}

export interface ZiweiCurrentChartRegressionDynamicPalaces {
  natal: string
  daYun: string
  liuNian: string
  liuYue: string
  liuRi: string
  liuShi: string
}

export interface ZiweiCurrentChartRegressionReviewSection {
  title: string
  items: string[]
}

export interface ZiweiCurrentChartRegressionReviewProfile {
  sampleId: string
  title: string
  birthSummary: string
  dynamicSummary: string
  expectedCore: ZiweiCurrentChartRegressionExpectedCore
  expectedDynamicPalaces: ZiweiCurrentChartRegressionDynamicPalaces
  regressionPurpose: string
  paragraphTargets: string[]
  evidenceChainAssertions: string[]
  dynamicLayerAssertions: string[]
  hiddenOutputRules: string[]
  sourceBoundary: string[]
  riskReviewRules: string[]
  reviewChecklist: string[]
  nextReviewAction: string
  sections: ZiweiCurrentChartRegressionReviewSection[]
}

const COMMON_EVIDENCE_ASSERTIONS = [
  "必须生成本命宫位、星曜、同宫组合、宫位关系、动态盘和格局边界六类证据链。",
  "当前盘证据链数量必须大于等于六十条，避免只输出少量概览。",
  "每条证据链必须保留 dictionaryRefs、sourceRuleIds、evidenceLines 和 interpretationBoundary。",
  "格局边界必须明确没有命中的格局不显示，不能把总字典全量结果塞进当前盘。",
  "当前盘段落必须能回查到命中宫位、星曜、三方四正、四化来源和动态盘层级。"
]

const COMMON_HIDDEN_RULES = [
  "没有命中的格局隐藏在当前盘结果之外。",
  "没有启用的动态盘层级隐藏对应命宫、夫妻、财帛、官禄、迁移和疾厄标签。",
  "待复核格局不输出为命盘结论，只进入复核队列。",
  "资料来源冲突时降级为复核提示，不输出确定断语。",
  "现代网站资料只保留结构、栏目和项目自有摘要，不复制正文。"
]

const COMMON_SOURCE_BOUNDARY = [
  "盘例回归只校验项目内部算法、黄金样本和资料字典，不把现代网站正文写入库。",
  "样本段落只使用项目自有整理语言。",
  "外部资料仅用于结构参考、来源元信息和人工复核线索。",
  "当前阶段只做正统紫微斗数证据分析，不做人格化映射。"
]

const COMMON_RISK_RULES = [
  "疾厄、风险、关系、财务主题只做证据复核，不作恐吓式断语。",
  "短周期流月、流日、流时必须降权，不反推本命长期结论。",
  "大限和流年必须保留上层背景，不覆盖原盘结构。",
  "遇到盘例边界、时辰边界或顺逆边界时，优先写复核点而不是直接下结论。"
]

const REVIEW_DRAFTS: Array<Omit<ZiweiCurrentChartRegressionReviewProfile, "sections">> = [
  {
    sampleId: "1988-male-hai-hour-boundary",
    title: "亥时边界男命回归样本",
    birthSummary: "阳历 1988 年 8 月 8 日 22:30，男命，亥时边界样本。",
    dynamicSummary: "当前年龄 38 岁，流年 2026 年，农历七月初一，流时亥。",
    expectedCore: {
      lifePalace: "shen",
      bodyPalace: "wu",
      elementGate: "wood_3",
      totalStarCount: 103,
      direction: "forward",
      startAge: 3,
      isDaYunStarted: true
    },
    expectedDynamicPalaces: {
      natal: "shen",
      daYun: "hai",
      liuNian: "wu",
      liuYue: "wu",
      liuRi: "wu",
      liuShi: "si"
    },
    regressionPurpose: "复核亥时边界是否稳定落盘，避免子时换日逻辑误入亥时样本。",
    paragraphTargets: [
      "原盘命宫段必须落在申宫，不能被子时样本污染。",
      "身宫段必须落在午宫，命身分离时要分别输出证据。",
      "动态盘段必须显示大限亥、流年午、流月午、流日午、流时巳。",
      "当前盘段落要提示这是时辰边界样本，需要保留复核意识。",
      "格局段只显示盘中命中的格局，不显示未命中格局。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "大限亥宫必须跟随顺行方向和三岁起运结果。",
      "流年、流月、流日同落午宫时，要写成多层动态叠加，不写成三条互相覆盖的结论。",
      "流时巳宫只作短期窗口，不改写流年午宫主题。",
      "动态盘段必须保留原盘申命宫作为底层背景。"
    ],
    hiddenOutputRules: COMMON_HIDDEN_RULES,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: COMMON_RISK_RULES,
    reviewChecklist: [
      "亥时样本必须保持亥时边界，不得被子时换日逻辑改写。",
      "命宫申、身宫午必须和黄金样本一致，命身分离时分别保留证据。",
      "动态宫位必须和黄金样本一致，尤其大限亥和流时巳不能漂移。",
      "流月流日同宫时必须合并说明短周期叠加，避免重复堆叠废话。",
      "段落必须保留时辰边界复核提示，不能输出过度确定的断语。"
    ],
    nextReviewAction: "用页面当前盘段落抽查亥时边界样本，确认命身、动态层和隐藏格局稳定。"
  },
  {
    sampleId: "1988-male-zi-hour-boundary",
    title: "子时边界男命回归样本",
    birthSummary: "阳历 1988 年 8 月 8 日 23:30，男命，子时边界样本。",
    dynamicSummary: "当前年龄 38 岁，流年 2026 年，农历七月初一，流时子。",
    expectedCore: {
      lifePalace: "wei",
      bodyPalace: "wei",
      elementGate: "fire_6",
      totalStarCount: 103,
      direction: "forward",
      startAge: 6,
      isDaYunStarted: true
    },
    expectedDynamicPalaces: {
      natal: "wei",
      daYun: "xu",
      liuNian: "wu",
      liuYue: "wei",
      liuRi: "wei",
      liuShi: "wei"
    },
    regressionPurpose: "复核子时边界是否独立成盘，避免与亥时样本共用命宫和五行局。",
    paragraphTargets: [
      "原盘命宫和身宫同落未宫时，段落要说明命身同宫，不重复输出两套互斥结论。",
      "大限戌宫必须保留为十年阶段背景。",
      "流月、流日、流时同落未宫时，要写成短周期叠加。",
      "子时边界必须保留时辰复核提示。",
      "格局、四化、星曜解释都必须从当前盘证据链读取。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "命身同宫时，本命主轴和身宫行动线可以合并说明，但证据字段不能丢失。",
      "流月、流日、流时同宫时，只说明短期窗口加重，不反推长期。",
      "大限戌宫和流年午宫必须同时保留。",
      "动态标签取消后应回到原盘未宫状态。"
    ],
    hiddenOutputRules: COMMON_HIDDEN_RULES,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: COMMON_RISK_RULES,
    reviewChecklist: [
      "子时样本必须触发独立命盘，不能沿用亥时命宫和五行局。",
      "命身同宫必须合并说明主轴和行动线，同时保留两类证据字段。",
      "起运年龄六岁必须稳定，不得被亥时样本的三岁起运污染。",
      "流月、流日、流时同宫时必须降权为短周期叠加。",
      "当前盘必须隐藏未命中格局，只显示本样本真实命中的结果。"
    ],
    nextReviewAction: "用页面当前盘段落抽查子时边界样本，确认命身同宫、起运和短周期叠加稳定。"
  },
  {
    sampleId: "1990-male-solar",
    title: "阳男顺行标准回归样本",
    birthSummary: "阳历 1990 年 5 月 17 日 09:00，男命。",
    dynamicSummary: "当前年龄 36 岁，流年 2026 年，农历五月十三，流时巳。",
    expectedCore: {
      lifePalace: "zi",
      bodyPalace: "xu",
      elementGate: "fire_6",
      totalStarCount: 103,
      direction: "forward",
      startAge: 6,
      isDaYunStarted: true
    },
    expectedDynamicPalaces: {
      natal: "zi",
      daYun: "mao",
      liuNian: "wu",
      liuYue: "zi",
      liuRi: "zi",
      liuShi: "si"
    },
    regressionPurpose: "复核阳男顺行标准样本，作为当前盘段落和证据链的主基准。",
    paragraphTargets: [
      "原盘命宫子宫是主基准，当前盘段落必须从子宫起读。",
      "大限卯宫和流年午宫要同时显示，不能选择流年后删除大限背景。",
      "流月、流日回到子宫时，要写成短周期回照本命主轴。",
      "流时巳宫只看当下短窗口，不覆盖流月流日。",
      "证据链必须包含动态盘证据和格局边界证据。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "顺行方向必须稳定为 forward。",
      "大限卯宫是十年阶段，不被流年午宫覆盖。",
      "流月和流日子宫可以提示短周期回照原盘命宫。",
      "流时巳宫必须降权。"
    ],
    hiddenOutputRules: COMMON_HIDDEN_RULES,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: COMMON_RISK_RULES,
    reviewChecklist: [
      "阳男样本必须稳定顺行，作为标准回归盘例的主基准。",
      "命宫子、身宫戌必须稳定，并作为当前盘段落的本命背景。",
      "大限卯和流年午必须同时保留，不能互相覆盖。",
      "流月流日回照子宫时必须降权为短周期触发。",
      "当前盘段落必须能回查 sourceRuleIds 和证据链来源。"
    ],
    nextReviewAction: "把该样本作为主回归盘例，后续页面和字典改动都优先用它复核。"
  },
  {
    sampleId: "1990-female-yang-year-backward",
    title: "阳女逆行对照回归样本",
    birthSummary: "阳历 1990 年 5 月 17 日 09:00，女命。",
    dynamicSummary: "当前年龄 36 岁，流年 2026 年，农历五月十三，流时巳。",
    expectedCore: {
      lifePalace: "zi",
      bodyPalace: "xu",
      elementGate: "fire_6",
      totalStarCount: 103,
      direction: "backward",
      startAge: 6,
      isDaYunStarted: true
    },
    expectedDynamicPalaces: {
      natal: "zi",
      daYun: "you",
      liuNian: "wu",
      liuYue: "zi",
      liuRi: "zi",
      liuShi: "si"
    },
    regressionPurpose: "复核同年同日同时辰下，性别导致大限顺逆改变，当前盘段落必须跟着大限命宫转动。",
    paragraphTargets: [
      "原盘命宫仍为子宫，说明性别不改写本命命宫。",
      "大限从顺行卯宫变为逆行酉宫，段落必须跟随大限命宫移动。",
      "流年午宫和大限酉宫要同时保留。",
      "流月流日子宫仍只作短周期回照。",
      "解释里必须写清顺逆来自盘例规则，不可自由发挥。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "逆行方向必须稳定为 backward。",
      "大限酉宫必须与阳男顺行样本的大限卯宫形成对照。",
      "切换流年时不能删除大限酉宫背景。",
      "短周期仍按流月、流日、流时降权。"
    ],
    hiddenOutputRules: COMMON_HIDDEN_RULES,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: COMMON_RISK_RULES,
    reviewChecklist: [
      "阳女样本必须稳定逆行，体现阴阳男女顺逆规则。",
      "大限酉宫必须稳定，并和阳男顺行样本的大限卯宫形成对照。",
      "同盘例对照只能改变动态方向，不能改写原盘命宫和身宫。",
      "当前盘必须同时保留大限酉和流年午两层背景。",
      "逆行只能作为算法和盘层规则，不得解释成人格化结论。"
    ],
    nextReviewAction: "用该样本复核阴阳男女顺逆规则和动态线条、动态命宫标签是否同步。"
  },
  {
    sampleId: "1991-female-yin-year-forward",
    title: "阴女顺行对照回归样本",
    birthSummary: "阳历 1991 年 5 月 17 日 09:00，女命。",
    dynamicSummary: "当前年龄 36 岁，流年 2026 年，农历五月十三，流时巳。",
    expectedCore: {
      lifePalace: "zi",
      bodyPalace: "xu",
      elementGate: "earth_5",
      totalStarCount: 103,
      direction: "forward",
      startAge: 5,
      isDaYunStarted: true
    },
    expectedDynamicPalaces: {
      natal: "zi",
      daYun: "mao",
      liuNian: "wu",
      liuYue: "zi",
      liuRi: "zi",
      liuShi: "si"
    },
    regressionPurpose: "复核阴女顺行规则，并确认五行局和起运年龄变化不会破坏当前盘证据链。",
    paragraphTargets: [
      "命宫子、身宫戌保持稳定，但五行局为土五局。",
      "起运年龄五岁必须进入段落复核资料。",
      "大限卯宫作为顺行结果，需和阴男逆行样本对照。",
      "当前盘段落必须保留五行局变化对大限节奏的影响。",
      "动态盘只解释阶段和短周期，不做人格化。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "阴女顺行必须稳定为 forward。",
      "起运年龄必须为五岁。",
      "大限卯宫要和阳男顺行样本一致，但来源规则不同。",
      "流年、流月、流日、流时仍按层级降权。"
    ],
    hiddenOutputRules: COMMON_HIDDEN_RULES,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: COMMON_RISK_RULES,
    reviewChecklist: [
      "阴女样本必须稳定顺行，和阴男逆行样本形成对照。",
      "土五局必须稳定，不能沿用 1990 年样本的火六局。",
      "五岁起运必须稳定，并进入动态盘段落复核资料。",
      "大限卯宫必须正确，说明顺行方向已经进入动态宫位。",
      "当前盘段落必须解释顺逆和起运差异，不得只输出宫位结果。"
    ],
    nextReviewAction: "用该样本复核阴年女命顺行和起运年龄对当前盘段落的影响。"
  },
  {
    sampleId: "1991-male-yin-year-backward",
    title: "阴男逆行对照回归样本",
    birthSummary: "阳历 1991 年 5 月 17 日 09:00，男命。",
    dynamicSummary: "当前年龄 36 岁，流年 2026 年，农历五月十三，流时巳。",
    expectedCore: {
      lifePalace: "zi",
      bodyPalace: "xu",
      elementGate: "earth_5",
      totalStarCount: 103,
      direction: "backward",
      startAge: 5,
      isDaYunStarted: true
    },
    expectedDynamicPalaces: {
      natal: "zi",
      daYun: "you",
      liuNian: "wu",
      liuYue: "zi",
      liuRi: "zi",
      liuShi: "si"
    },
    regressionPurpose: "复核阴男逆行规则，和阴女顺行、阳女逆行形成顺逆交叉校验。",
    paragraphTargets: [
      "命宫子、身宫戌和土五局必须稳定。",
      "大限酉宫必须跟随逆行规则。",
      "流年午宫必须保留，不因大限酉宫而隐藏。",
      "当前盘段落必须说明大限只是阶段背景，不改写原盘。",
      "短周期仍只能作为事件窗口。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "阴男逆行必须稳定为 backward。",
      "大限酉宫必须与阴女顺行样本的大限卯宫对照。",
      "起运年龄五岁必须稳定。",
      "流年午宫和大限酉宫必须同时存在。"
    ],
    hiddenOutputRules: COMMON_HIDDEN_RULES,
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: COMMON_RISK_RULES,
    reviewChecklist: [
      "阴男样本必须稳定逆行，和阴女顺行样本形成交叉校验。",
      "大限酉宫必须稳定，不能被顺行卯宫结果污染。",
      "起运年龄五岁必须稳定，并和土五局资料一致。",
      "流年午宫不能覆盖大限酉宫，两个盘层必须同时保留。",
      "当前盘段落必须保留原盘、大限、流年和短周期层级边界。"
    ],
    nextReviewAction: "用该样本复核阴男逆行、大限酉宫、流年午宫和短周期降权是否能同时稳定显示。"
  },
  {
    sampleId: "1995-female-not-started",
    title: "大限未起运女命回归样本",
    birthSummary: "阳历 1995 年 2 月 4 日 23:00，女命。",
    dynamicSummary: "当前年龄 1 岁，流年 2026 年，农历十二月三十，流时子。",
    expectedCore: {
      lifePalace: "yin",
      bodyPalace: "yin",
      elementGate: "earth_5",
      totalStarCount: 103,
      direction: "forward",
      startAge: 5,
      isDaYunStarted: false
    },
    expectedDynamicPalaces: {
      natal: "yin",
      daYun: "yin",
      liuNian: "wu",
      liuYue: "si",
      liuRi: "xu",
      liuShi: "xu"
    },
    regressionPurpose: "复核大限未起运时，当前盘不能强行输出已起运的大限结论。",
    paragraphTargets: [
      "命宫和身宫同落寅宫时，段落要合并但保留两类证据。",
      "大限未起运时，大限宫仍回到本命寅宫，但必须标明未起运。",
      "流年午、流月巳、流日戌、流时戌只作动态窗口。",
      "当前盘不能把未起运大限写成十年阶段结论。",
      "涉及幼年样本时，只做算法回归，不做现实断语。"
    ],
    evidenceChainAssertions: COMMON_EVIDENCE_ASSERTIONS,
    dynamicLayerAssertions: [
      "isDaYunStarted 必须为 false。",
      "大限未起运时，大限宫位等于本命命宫寅宫。",
      "流日和流时同落戌宫时，只写短周期叠加。",
      "动态盘段落必须明确未起运降权。"
    ],
    hiddenOutputRules: [
      ...COMMON_HIDDEN_RULES,
      "大限未起运时隐藏十年阶段结论，只保留未起运提示。"
    ],
    sourceBoundary: COMMON_SOURCE_BOUNDARY,
    riskReviewRules: [
      ...COMMON_RISK_RULES,
      "幼年样本只用于算法和资料回归，不输出现实人生判断。"
    ],
    reviewChecklist: [
      "大限未起运状态必须稳定，不能强行输出十年阶段结论。",
      "大限宫必须回到本命寅宫，并标明这是未起运处理。",
      "命身同宫必须正确处理，合并说明但不丢失命宫和身宫字段。",
      "幼年样本只用于算法回归，不得输出现实人生断语。",
      "短周期必须按流年、流月、流日、流时逐层降权。"
    ],
    nextReviewAction: "用该样本复核未起运状态下的大限显示、当前盘段落和隐藏规则。"
  }
]

export const ZIWEI_CURRENT_CHART_REGRESSION_REVIEW_PROFILES:
  ZiweiCurrentChartRegressionReviewProfile[] = REVIEW_DRAFTS.map((profile) => ({
    ...profile,
    sections: buildSections(profile)
  }))

function buildSections(
  profile: Omit<ZiweiCurrentChartRegressionReviewProfile, "sections">
): ZiweiCurrentChartRegressionReviewSection[] {
  return [
    { title: "盘例定位", items: [profile.regressionPurpose] },
    { title: "出生资料", items: [profile.birthSummary] },
    { title: "动态时间", items: [profile.dynamicSummary] },
    { title: "核心预期", items: formatExpectedCore(profile.expectedCore) },
    { title: "动态宫位预期", items: formatDynamicPalaces(profile.expectedDynamicPalaces) },
    { title: "段落目标", items: profile.paragraphTargets },
    { title: "证据链断言", items: profile.evidenceChainAssertions },
    { title: "动态层级断言", items: profile.dynamicLayerAssertions },
    { title: "隐藏规则", items: profile.hiddenOutputRules },
    { title: "来源边界", items: profile.sourceBoundary },
    { title: "风险复核", items: profile.riskReviewRules },
    { title: "复核清单", items: profile.reviewChecklist },
    { title: "下一步复核", items: [profile.nextReviewAction] }
  ]
}

function formatExpectedCore(core: ZiweiCurrentChartRegressionExpectedCore): string[] {
  return [
    `命宫必须为 ${core.lifePalace}。`,
    `身宫必须为 ${core.bodyPalace}。`,
    `五行局必须为 ${core.elementGate}。`,
    `总星曜数量必须为 ${core.totalStarCount}。`,
    `大限方向必须为 ${core.direction}，起运年龄必须为 ${core.startAge}。`,
    `大限起运状态必须为 ${core.isDaYunStarted ? "已起运" : "未起运"}。`
  ]
}

function formatDynamicPalaces(
  palaces: ZiweiCurrentChartRegressionDynamicPalaces
): string[] {
  return [
    `原盘命宫为 ${palaces.natal}。`,
    `大限命宫为 ${palaces.daYun}。`,
    `流年命宫为 ${palaces.liuNian}。`,
    `流月命宫为 ${palaces.liuYue}。`,
    `流日命宫为 ${palaces.liuRi}。`,
    `流时命宫为 ${palaces.liuShi}。`
  ]
}

export function getAllZiweiCurrentChartRegressionReviewProfiles():
  ZiweiCurrentChartRegressionReviewProfile[] {
  return ZIWEI_CURRENT_CHART_REGRESSION_REVIEW_PROFILES
}

export function getZiweiCurrentChartRegressionReviewProfile(
  sampleId: string
): ZiweiCurrentChartRegressionReviewProfile | undefined {
  return ZIWEI_CURRENT_CHART_REGRESSION_REVIEW_PROFILES.find((profile) => {
    return profile.sampleId === sampleId
  })
}
