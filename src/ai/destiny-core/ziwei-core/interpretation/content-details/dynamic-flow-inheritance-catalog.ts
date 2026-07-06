import type { ZiweiDynamicFlowLayerId } from "./periodic-star-flow-layer-catalog"

export interface ZiweiDynamicFlowInheritanceProfile {
  layerId: ZiweiDynamicFlowLayerId
  label: string
  role: string
  inheritedLayers: ZiweiDynamicFlowLayerId[]
  visibleMarkers: string[]
  palaceUsage: string[]
  patternUsage: string[]
  transformationUsage: string[]
  paragraphEvidenceOrder: string[]
  resetRules: string[]
  cautions: string[]
}

export const ZIWEI_DYNAMIC_FLOW_INHERITANCE_PROFILES: ZiweiDynamicFlowInheritanceProfile[] = [
  {
    layerId: "natal",
    label: "原盘",
    role: "原盘是所有动态盘的底盘，用来观察长期结构、命身承接、十二宫基础关系、主星格局和生年四化。",
    inheritedLayers: [],
    visibleMarkers: ["原命", "身宫", "本命十二宫", "生年四化", "原盘格局"],
    palaceUsage: [
      "解释原盘时先看命宫、身宫、命迁线和十二宫主星，再看三方四正、对宫、夹宫和四化。",
      "原盘宫位名称不随大限和流年改变，是后续所有动态解释的承接基础。",
      "原盘中没有被动态层触发的内容，仍然作为底色保留，但不强行写成当前事件。"
    ],
    patternUsage: [
      "原盘格局看长期结构和基础格局，不受点击流动时间而消失。",
      "动态盘格局必须回头看原盘是否承接，不能脱离原盘独立成结论。",
      "原盘破格或不良格局要区分长期结构问题和短期流动触发。"
    ],
    transformationUsage: [
      "原盘四化来自生年天干，是长期底盘中的资源、权责、名誉和牵挂结构。",
      "切换到大限、流年、流月、流日、流时时，原盘四化仍保留为底层承接。",
      "原盘四化不显示庙旺落陷，也不被流年四化覆盖。"
    ],
    paragraphEvidenceOrder: [
      "先写命身与本宫主题。",
      "再写主星、辅曜、煞曜、杂曜和周期星在本宫的分工。",
      "再写对宫、三方四正、四化和格局。",
      "最后写复核边界，不做动态盘事件判断。"
    ],
    resetRules: [
      "默认进入页面时为原盘状态。",
      "取消大限选择后，应清空大限、流年、流月、流日、流时层级，回到原盘。",
      "原盘状态下不显示流年命、流月命、流日命、流时命等动态标签。"
    ],
    cautions: [
      "原盘解释不是现实事件断语，只是长期结构分析。",
      "不能因为短期流层出现某星，就反向改写原盘。"
    ]
  },
  {
    layerId: "da-yun",
    label: "大限",
    role: "大限是十年阶段层，用来观察阶段命宫、阶段十二宫、阶段四化、阶段格局和原盘承接。",
    inheritedLayers: ["natal"],
    visibleMarkers: ["原命", "大限命", "大限十二宫", "大限四化", "大限格局"],
    palaceUsage: [
      "点击大限后，宫位解释从原盘底色叠加到十年阶段主题。",
      "大限命宫是阶段视角入口，大限夫妻、大限财帛、大限官禄等标签要随大限命宫旋转。",
      "大限宫位解释必须说明它如何承接原盘本宫和原盘三方四正。"
    ],
    patternUsage: [
      "大限格局说明十年阶段的结构主题，不等于永久命格。",
      "大限格局命中时，要说明原盘是否有承接、是否有破格、是否有四化引动。",
      "大限不良格局只写阶段风险和复核路径，不写绝对结论。"
    ],
    transformationUsage: [
      "大限四化来自大限层来源，解释十年阶段被推到前台的资源、责任、名誉和牵挂。",
      "大限四化必须与原盘四化分层展示，不覆盖生年四化。",
      "取消大限后，大限四化应退出当前层解释。"
    ],
    paragraphEvidenceOrder: [
      "先写原盘底色。",
      "再写大限命宫、大限十二宫和大限四化。",
      "再写大限三方四正、格局命中和破格信号。",
      "最后写阶段性边界，说明这是十年阶段而非终身断语。"
    ],
    resetRules: [
      "再次点击同一个大限，应取消大限选择并回到原盘。",
      "取消大限时，流年、流月、流日、流时必须同步清空。",
      "切换到另一个大限时，下层流动选择应重新按新大限背景计算。"
    ],
    cautions: [
      "大限是阶段层，不是原盘。",
      "不能只看大限命宫而忽略原盘承接。"
    ]
  },
  {
    layerId: "liu-nian",
    label: "流年",
    role: "流年是年度主题层，用来观察一年内被触发的宫位、四化、岁运星曜、格局应期和大限背景。",
    inheritedLayers: ["natal", "da-yun"],
    visibleMarkers: ["原命", "大限命", "流年命", "流年十二宫", "流年四化", "流年格局"],
    palaceUsage: [
      "点击流年后，大限标记不能消失，流年宫位是在大限阶段上叠加年度主题。",
      "流年夫妻、流年财帛、流年官禄等标签要围绕流年命宫旋转。",
      "流年解释必须说明该年度触发的是哪个原盘宫、哪个大限宫和哪个流年宫。"
    ],
    patternUsage: [
      "流年格局只说明年度触发，不替代原盘格局和大限格局。",
      "流年格局命中时，要写清是原盘已有结构被触发，还是年度形成的短期结构。",
      "未命中的流年格局不显示在当前盘结果。"
    ],
    transformationUsage: [
      "流年四化来自流年天干，表示年度资源入口、责任压力、名誉文书和牵挂卡点。",
      "流年四化必须保留大限背景，不应把大限四化隐藏掉。",
      "流年四化不写成永久结构，也不显示庙旺落陷。"
    ],
    paragraphEvidenceOrder: [
      "先写原盘底色和大限阶段。",
      "再写流年命宫、流年十二宫、流年四化和流年星曜。",
      "再写流年格局、破格、岁前、将前、博士系统。",
      "最后写年度边界，说明只代表本年触发。"
    ],
    resetRules: [
      "再次点击同一个流年，应取消流年选择，保留大限层并清空流月、流日、流时。",
      "切换大限时，流年选择必须重新校验。",
      "未选择大限但选择流年时，也应明确原盘底色与年度层级，不显示不存在的大限命。"
    ],
    cautions: [
      "流年不是原盘，不得把年度触发写成终身结构。",
      "流年有大限背景时，大限标记和解释都不能被删掉。"
    ]
  },
  {
    layerId: "liu-yue",
    label: "流月",
    role: "流月是月度焦点层，用来观察当月被触发的宫位、短期星曜、月度四化和年度主题中的局部推进。",
    inheritedLayers: ["natal", "da-yun", "liu-nian"],
    visibleMarkers: ["原命", "大限命", "流年命", "流月命", "流月四化", "月系星曜"],
    palaceUsage: [
      "点击流月后，流年和大限背景应继续保留。",
      "流月夫妻、流月财帛等标签围绕流月命宫旋转，只解释当月焦点。",
      "流月解释要说明它是流年主题下的短期推进，不独立生成长期结论。"
    ],
    patternUsage: [
      "流月不单独改写原盘格局，只提示原盘、大限或流年格局在当月是否被触发。",
      "流月格局说明短期应期、焦点和临时成色。",
      "流月破格只写短期阻力，不写终局。"
    ],
    transformationUsage: [
      "流月四化只代表当月资源、责任、名誉和牵挂的局部触发。",
      "流月四化必须继承流年和大限，不覆盖上层四化。",
      "流月四化适合看月度推进、情绪、任务和短期压力。"
    ],
    paragraphEvidenceOrder: [
      "先写原盘、大限和流年背景。",
      "再写流月命宫、流月四化、月系星曜和当月触发宫位。",
      "再写与流年主题的关系。",
      "最后写月度边界，说明不可放大为长期结论。"
    ],
    resetRules: [
      "再次点击同一个流月，应取消流月选择，保留流年和大限。",
      "取消流年时，流月、流日、流时必须同步清空。",
      "切换流月时，流日和流时需要重新校验。"
    ],
    cautions: [
      "流月只看月度气候和局部触发。",
      "不能脱离流年主线解释流月。"
    ]
  },
  {
    layerId: "liu-ri",
    label: "流日",
    role: "流日是日度触发层，用来观察当天事件提醒、短期阻力、办事顺逆和月度主题中的临时触发。",
    inheritedLayers: ["natal", "da-yun", "liu-nian", "liu-yue"],
    visibleMarkers: ["原命", "大限命", "流年命", "流月命", "流日命", "流日四化"],
    palaceUsage: [
      "点击流日后，上层原盘、大限、流年、流月背景都应保留。",
      "流日宫位只解释当天触发，不改变流月和流年主题。",
      "流日解释适合看办事、沟通、出行、短期关系和临时压力。"
    ],
    patternUsage: [
      "流日不创造长期格局，只提示原有格局当天是否被触发。",
      "流日格局只作为应期窗口，不作为命盘结构。",
      "流日破格只说明当天阻滞和复核点。"
    ],
    transformationUsage: [
      "流日四化只看当天触发点、临时资源、即时责任和短时牵挂。",
      "流日四化必须保留流月、流年、大限和原盘背景。",
      "流日四化不写长期结论。"
    ],
    paragraphEvidenceOrder: [
      "先写上层背景。",
      "再写流日命宫、流日四化和日度触发星曜。",
      "再写当天可复核的宫位主题。",
      "最后写日度边界和不放大原则。"
    ],
    resetRules: [
      "再次点击同一个流日，应取消流日选择，保留流月、流年和大限。",
      "取消流月时，流日和流时必须同步清空。",
      "切换流日时，流时需要重新校验。"
    ],
    cautions: [
      "流日只做当天触发和提醒。",
      "不能用流日解释终身结构或年度结论。"
    ]
  },
  {
    layerId: "liu-shi",
    label: "流时",
    role: "流时是时段微调层，用来观察当下状态、临场阻力、即时资源和短促反馈。",
    inheritedLayers: ["natal", "da-yun", "liu-nian", "liu-yue", "liu-ri"],
    visibleMarkers: ["原命", "大限命", "流年命", "流月命", "流日命", "流时命", "流时四化"],
    palaceUsage: [
      "点击流时后，所有上层背景都应保留。",
      "流时宫位只解释当下和时段内的微调，不改变流日以上主题。",
      "流时适合看临场动作、沟通窗口、短时支援和即时卡点。"
    ],
    patternUsage: [
      "流时不构成长期格局，只提示当下是否触发上层格局。",
      "流时格局只能作为临场应期和短时观察。",
      "流时破格只说明当下阻力，不作长期判断。"
    ],
    transformationUsage: [
      "流时四化只代表时辰层即时资源、责任、名誉和牵挂。",
      "流时四化必须降权处理，并保留流日、流月、流年、大限和原盘背景。",
      "流时四化不显示庙旺落陷，不写长期结论。"
    ],
    paragraphEvidenceOrder: [
      "先写原盘到流日的上层背景。",
      "再写流时命宫、流时四化和日时系星曜。",
      "再写当下微调建议和复核点。",
      "最后写时段边界。"
    ],
    resetRules: [
      "再次点击同一个流时，应取消流时选择，保留流日以上层级。",
      "取消流日时，流时必须清空。",
      "流时不能在没有上层日期背景时单独解释。"
    ],
    cautions: [
      "流时是最短周期，只能微调。",
      "不能把流时提示写成命运结论。"
    ]
  }
]

export function getAllZiweiDynamicFlowInheritanceProfiles(): ZiweiDynamicFlowInheritanceProfile[] {
  return ZIWEI_DYNAMIC_FLOW_INHERITANCE_PROFILES
}

export function getZiweiDynamicFlowInheritanceProfile(
  layerId: ZiweiDynamicFlowLayerId
): ZiweiDynamicFlowInheritanceProfile | undefined {
  return ZIWEI_DYNAMIC_FLOW_INHERITANCE_PROFILES.find((profile) => profile.layerId === layerId)
}
