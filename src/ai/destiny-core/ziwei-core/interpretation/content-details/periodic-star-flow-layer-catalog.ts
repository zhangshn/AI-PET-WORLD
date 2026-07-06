export type ZiweiPeriodicStarFlowGroupId =
  | "lifecycle"
  | "boshi"
  | "suiqian"
  | "jiangqian"
  | "monthly"
  | "daily-hourly"

export type ZiweiDynamicFlowLayerId =
  | "natal"
  | "da-yun"
  | "liu-nian"
  | "liu-yue"
  | "liu-ri"
  | "liu-shi"

export interface ZiweiPeriodicStarFlowLayerProfile {
  groupId: ZiweiPeriodicStarFlowGroupId
  label: string
  allowedLayers: ZiweiDynamicFlowLayerId[]
  layerNature: string
  inheritanceRules: string[]
  evidenceWeight: string[]
  palaceUsage: string[]
  transformationUsage: string[]
  patternUsage: string[]
  currentChartUsage: string[]
  forbiddenUsage: string[]
}

export const ZIWEI_PERIODIC_STAR_FLOW_LAYER_PROFILES: ZiweiPeriodicStarFlowLayerProfile[] = [
  {
    groupId: "lifecycle",
    label: "长生十二神",
    allowedLayers: ["natal", "da-yun", "liu-nian", "liu-yue"],
    layerNature:
      "长生十二神用于观察气势阶段和主题成熟度。它可以服务原盘、大限、流年和流月，但不替代主星、四化、格局和三方四正。",
    inheritanceRules: [
      "原盘长生十二神看长期气势和宫位主题的基础阶段。",
      "大限长生十二神看十年阶段中该宫主题的成长、旺衰、收束或重启。",
      "流年长生十二神只解释年度成熟度，必须保留大限和原盘背景。",
      "流月长生十二神只看当月气候，不反推长期命格。"
    ],
    evidenceWeight: [
      "长生、临官、帝旺偏气势上升，但仍要看主星能否承接。",
      "病、死、绝偏气势受阻，但不等于事件失败，只提示修复、结束或换轨。",
      "墓、胎、养偏收藏、孕育和照料，适合看准备期、储备期和恢复期。"
    ],
    palaceUsage: [
      "落命宫，看主题阶段与个人当下承接方式。",
      "落财帛、官禄、迁移时，看资源、事业、外部行动处于开端、旺盛、收束还是修复。",
      "落夫妻、福德、疾厄时，要谨慎表达，只解释关系气势、内在状态和修复节奏。"
    ],
    transformationUsage: [
      "与四化同宫时，先看四化目标星，再用长生十二神补充事件处于哪个阶段。",
      "化禄遇长生、临官、帝旺，资源更容易被推动；化忌遇病、死、绝，复核阻滞和修复需求。",
      "长生十二神不产生四化，也不改变四化来源天干。"
    ],
    patternUsage: [
      "格局成败仍以主星、宫位、三方四正、四化和煞曜为主，长生十二神只补气势成色。",
      "格局命中但长生十二神偏弱时，解释为成格有阶段阻力或承接不足。",
      "格局被破但长生十二神有生扶时，可提示修复和重新培育。"
    ],
    currentChartUsage: [
      "当前盘可以引用长生十二神说明该宫主题的气势阶段。",
      "解释必须写成辅助语气，例如“该主题处于推进、收束、修复或孕育阶段”。"
    ],
    forbiddenUsage: [
      "不得用长生十二神单独断吉凶。",
      "不得用短周期长生状态覆盖原盘主星结构。",
      "不得把阶段词写成确定事件。"
    ]
  },
  {
    groupId: "boshi",
    label: "博士十二神",
    allowedLayers: ["liu-nian", "liu-yue"],
    layerNature:
      "博士十二神属于流年禄存系统，重点看年度事务、文书、执行、耗损、官府、病符等行政和事务细节。",
    inheritanceRules: [
      "博士十二神主要服务流年，必须先确认当前流年。",
      "流月引用博士十二神时，只能作为年度背景下的月度触发。",
      "博士十二神不反推本命长期结构，不替代大限主线。",
      "选择流年时，应保留大限背景，再读博士十二神。"
    ],
    evidenceWeight: [
      "博士、奏书、官府重文书流程和制度事项。",
      "力士、将军重执行、行动和承担。",
      "小耗、大耗、病符、伏兵重成本、疲劳、暗伏和风险复核。"
    ],
    palaceUsage: [
      "落官禄，看年度流程、审查、岗位事务和执行压力。",
      "落财帛，看年度预算、支出、耗损和资源进出。",
      "落疾厄，看年度疲劳、修复和健康管理提示，只作象义提醒。"
    ],
    transformationUsage: [
      "与流年四化同宫时，博士十二神说明年度事务形态，四化说明牵动来源。",
      "化忌叠加大耗、病符、官府时，需复核成本、文书、疲劳和规则压力。",
      "化禄叠加博士、青龙、喜神时，年度事务较容易获得资源或顺势推进。"
    ],
    patternUsage: [
      "博士十二神不单独构成格局，只能辅助动态盘格局成色。",
      "流年格局命中时，博士十二神用于说明年度事件是文书型、执行型、耗损型还是官府型。",
      "格局破格时，耗损和官府类博士星曜可作为复核信号。"
    ],
    currentChartUsage: [
      "当前盘选择流年后，可以显示博士十二神对应宫位的年度事务提示。",
      "未选择流年时，不应把博士十二神写成当前主层结论。"
    ],
    forbiddenUsage: [
      "不得把博士十二神作为本命常驻性格。",
      "不得脱离流年命宫、流年四化和大限背景单独断事。",
      "不得把小耗、大耗直接写成确定破财。"
    ]
  },
  {
    groupId: "suiqian",
    label: "岁前十二神",
    allowedLayers: ["liu-nian", "liu-yue"],
    layerNature:
      "岁前十二神属于太岁前后气候，重在年度外部环境、岁运压力、德助、病耗、白虎和吊客等气候信号。",
    inheritanceRules: [
      "岁前十二神必须以流年太岁为背景。",
      "流月引用岁前十二神时，只表示当月触发年度气候中的一部分。",
      "岁前十二神不能替代本命星曜，也不能替代博士、将前系统。",
      "年度解释必须保留大限阶段背景。"
    ],
    evidenceWeight: [
      "天德、龙德偏修复、缓冲和贵德。",
      "白虎、病符、吊客、丧门偏压力、疲惫、失落和外部牵挂。",
      "官符、贯索偏文书、手续、束缚和责任牵连。"
    ],
    palaceUsage: [
      "落命宫，看年度外部环境对本人状态的直接影响。",
      "落父母、田宅、疾厄时，要重视家宅、长辈、身体和环境压力的复核。",
      "落迁移、交友时，看外部人际、远方消息、环境气候和口舌牵动。"
    ],
    transformationUsage: [
      "岁前星曜与流年化忌同宫时，年度气候压力被放大，但仍需看主星和宫位承接。",
      "天德、龙德遇吉化时，可作为修复和缓和信号。",
      "白虎、病符遇煞忌时，只能提示风险复核，不输出灾断。"
    ],
    patternUsage: [
      "岁前十二神不单独成格，只辅助判断流年格局的外部气候。",
      "不良格局命中时，白虎、病符、官符等可作为风险复核。",
      "吉格命中时，天德、龙德可作为缓冲和修复条件。"
    ],
    currentChartUsage: [
      "当前盘选择流年后，可用岁前十二神解释年度外部气候。",
      "解释必须写成“环境提示”或“复核信号”，不得写成定论。"
    ],
    forbiddenUsage: [
      "不得用白虎、丧门、吊客直接断灾。",
      "不得把岁前十二神作为本命性格。",
      "不得脱离太岁和流年层级使用。"
    ]
  },
  {
    groupId: "jiangqian",
    label: "将前十二神",
    allowedLayers: ["liu-nian", "liu-yue"],
    layerNature:
      "将前十二神属于流年三合将星系统，重点看年度行动、迁动、人际暗线、桃花、灾煞、劫煞和背后评价。",
    inheritanceRules: [
      "将前十二神要以流年三合局为基础。",
      "流年使用时看年度行动和隐性人际线索。",
      "流月使用时只看月度触发，不能上升为长期命格。",
      "必须与大限、流年命宫和流年四化合看。"
    ],
    evidenceWeight: [
      "将星、攀鞍、岁驿偏行动、上升、迁动和机会。",
      "华盖偏专注、技艺、孤高和独立。",
      "劫煞、灾煞、天煞、亡神偏风险、失误、损耗和不可控压力。"
    ],
    palaceUsage: [
      "落迁移，看移动、奔波、环境转换和外部行动。",
      "落交友，看背后评价、协作、人际诱因和口舌。",
      "落官禄，看年度行动、竞争、岗位变化和项目推进。"
    ],
    transformationUsage: [
      "将前行动类星曜遇化权，行动和主导性增强。",
      "风险类将前星曜遇化忌或煞曜，应复核损耗、冲突和误判。",
      "桃花类将前星曜遇化禄或文曜，可看社交机会；遇化忌则看关系纠缠。"
    ],
    patternUsage: [
      "将前十二神不单独成格，但可以说明流年格局的行动方式。",
      "流年格局偏迁动时，岁驿、攀鞍、将星可提高行动证据。",
      "破格或不良格局中，劫煞、灾煞、天煞、亡神只能作为复核项。"
    ],
    currentChartUsage: [
      "当前盘选择流年后，可引用将前十二神说明年度行动、迁动、隐性压力和人际暗线。",
      "若只在流月出现，应写短期行动和关系诱因，不写长期结论。"
    ],
    forbiddenUsage: [
      "不得用灾煞、劫煞、亡神单独断灾。",
      "不得把将前桃花类星曜直接写成感情结论。",
      "不得脱离流年三合局和当前宫位。"
    ]
  },
  {
    groupId: "monthly",
    label: "月系星曜",
    allowedLayers: ["liu-yue", "liu-ri", "liu-shi"],
    layerNature:
      "月系星曜属于月度短周期触发，重点看当月解厄、照护、感应、阴性压力和短期情绪气候。",
    inheritanceRules: [
      "月系星曜必须继承流年主线，不能脱离流年单独解释。",
      "流日、流时引用月系星曜时，只能作为上层月度背景。",
      "月系星曜不能反推本命长期结构。",
      "解释必须标明当月、当日或当时的短周期层级。"
    ],
    evidenceWeight: [
      "月解偏短期化解、调停和缓冲。",
      "天巫、天月偏身心、照护、感应和短期修复。",
      "阴煞偏暗压、隐忧和不明朗情绪。"
    ],
    palaceUsage: [
      "落福德、疾厄时，看当月身心状态、照护和修复需求。",
      "落夫妻、交友时，看当月情绪边界、关系牵动和短期误会。",
      "落官禄、财帛时，看当月任务压力、支出、修补和临时协助。"
    ],
    transformationUsage: [
      "月系星曜与流月四化同宫时，先看流月四化，再用月系星曜补短期气候。",
      "流月化忌遇阴煞、天月时，需复核短期情绪和身心压力。",
      "月解遇吉化时，可作为短期缓冲和解厄信号。"
    ],
    patternUsage: [
      "月系星曜不单独成格，只解释格局在当月是否被触发或缓冲。",
      "原盘或流年格局命中时，月系星曜可说明当月应期和细节气候。",
      "月系星曜不能创造原盘没有的格局。"
    ],
    currentChartUsage: [
      "当前盘选择流月后，可引用月系星曜说明当月焦点。",
      "选择流日、流时时，月系星曜只能作为上层背景。"
    ],
    forbiddenUsage: [
      "不得把月系星曜写成长期命盘结论。",
      "不得脱离流年和流月命宫使用。",
      "不得用月系健康象义作医学判断。"
    ]
  },
  {
    groupId: "daily-hourly",
    label: "日时系星曜",
    allowedLayers: ["liu-ri", "liu-shi"],
    layerNature:
      "日时系星曜属于最短周期触发，重点看当天、当时的临场协助、短期名位、即时反馈和行动微调。",
    inheritanceRules: [
      "日时系星曜必须继承流月、流年和大限背景。",
      "流日使用时只看当天触发，流时使用时只看时段微调。",
      "日时系星曜不能反推长期命格，也不能改变原盘结构。",
      "解释必须使用短周期提示语气。"
    ],
    evidenceWeight: [
      "三台、八座偏短期台阶、位置、流程和承载。",
      "恩光、天贵偏短期善意、肯定、贵人和礼遇。",
      "日时系星曜只有微调权重，不能压过流年、大限和本命。"
    ],
    palaceUsage: [
      "落命宫，看当天或当时个人状态和临场承接。",
      "落官禄、迁移时，看当天办事、出行、流程和临时支援。",
      "落交友、父母时，看短期他人帮助、长辈照应和信息反馈。"
    ],
    transformationUsage: [
      "与流日或流时四化同宫时，只说明短时触发点，不写长期结论。",
      "见化禄、化科时，可看临时顺手、肯定和小范围支援。",
      "见化忌时，只提示当日当时阻力、延误和复核。"
    ],
    patternUsage: [
      "日时系星曜不参与原盘成格，只作为动态盘细节。",
      "流日流时触发原有格局时，可说明短期应事窗口。",
      "日时系星曜不能单独创造格局。"
    ],
    currentChartUsage: [
      "当前盘选择流日或流时时，可引用日时系星曜说明临场状态。",
      "页面展示应保留上层大限、流年、流月背景。"
    ],
    forbiddenUsage: [
      "不得把日时系星曜写成长期性格或命运结论。",
      "不得脱离流日、流时命宫使用。",
      "不得用短时提示替代完整盘面分析。"
    ]
  }
]

export function getAllZiweiPeriodicStarFlowLayerProfiles(): ZiweiPeriodicStarFlowLayerProfile[] {
  return ZIWEI_PERIODIC_STAR_FLOW_LAYER_PROFILES
}

export function getZiweiPeriodicStarFlowLayerProfile(
  groupId: ZiweiPeriodicStarFlowGroupId
): ZiweiPeriodicStarFlowLayerProfile | undefined {
  return ZIWEI_PERIODIC_STAR_FLOW_LAYER_PROFILES.find((profile) => profile.groupId === groupId)
}
