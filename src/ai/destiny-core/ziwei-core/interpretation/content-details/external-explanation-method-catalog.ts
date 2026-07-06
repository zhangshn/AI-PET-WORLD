export type ZiweiDictionaryExplanationLayerId =
  | "foundation"
  | "star-body"
  | "star-palace"
  | "palace-system"
  | "relation-structure"
  | "transformation-flow"
  | "dynamic-flow"
  | "chart-synthesis"

export interface ZiweiExternalExplanationReferenceSourceProfile {
  sourceId: string
  title: string
  locator: string
  storageBoundary: string[]
  observedExplanationLayers: ZiweiDictionaryExplanationLayerId[]
  adoptedMethodRules: string[]
  forbiddenUse: string[]
}

export interface ZiweiDictionaryExplanationLayerProfile {
  layerId: ZiweiDictionaryExplanationLayerId
  label: string
  sourceObservation: string
  dictionaryTargetLayer: string
  requiredFields: string[]
  outputRules: string[]
  currentChartBoundary: string[]
}

export const ZIWEI_EXTERNAL_EXPLANATION_REFERENCE_SOURCES: ZiweiExternalExplanationReferenceSourceProfile[] =
  [
    {
      sourceId: "p36.reference-method.ziwei-my",
      title: "ziwei.my 紫微斗数资料站解释结构参考",
      locator: "https://www.ziwei.my/",
      storageBoundary: [
        "只登记网址、页面标题、栏目结构、主题标签、实体标签、访问日期和项目自有摘要。",
        "不复制现代网站正文，不复制页面排版，不复制图片和截图。",
        "可参考其资料组织方式，例如基础概念、星曜专论、星曜入十二宫、三方四正、四化和排盘解释入口。",
        "所有进入项目字典的正文必须用项目自有语言重写，并保留 sourceId、主题标签和复核状态。"
      ],
      observedExplanationLayers: [
        "foundation",
        "star-body",
        "star-palace",
        "palace-system",
        "relation-structure",
        "transformation-flow",
        "dynamic-flow",
        "chart-synthesis"
      ],
      adoptedMethodRules: [
        "先建立紫微斗数基础概念，再解释单颗星曜本体。",
        "星曜本体之后必须进入星曜入十二宫，说明同一颗星在不同人事宫位的转换。",
        "宫位解释不能只看本宫，必须继续纳入对宫、三方四正、两邻夹宫和会照关系。",
        "四化必须说明来源天干和盘层，区分本命、大限、流年、流月、流日、流时。",
        "动态盘解释必须保留上层背景，不得把流月、流日、流时放大为终身结论。",
        "最终当前盘解释只能显示命中内容，未命中字典资料留在总字典。"
      ],
      forbiddenUse: [
        "不得复制正文段落进入项目字典。",
        "不得把现代网站的一家说法直接升为硬规则。",
        "不得把参考站点的排版、按钮、截图或视觉布局作为项目资产。",
        "不得脱离星曜、宫位、四化、三方四正和当前盘证据链输出断语。"
      ]
    }
  ]

export const ZIWEI_DICTIONARY_EXPLANATION_LAYER_PROFILES: ZiweiDictionaryExplanationLayerProfile[] =
  [
    {
      layerId: "foundation",
      label: "基础体系层",
      sourceObservation: "参考资料通常先说明紫微斗数的天文象征、阴阳五行、南北斗、中天星、十二宫和基本推盘概念。",
      dictionaryTargetLayer: "foundation.dictionary",
      requiredFields: ["术语名称", "基础定义", "所属体系", "与排盘关系", "误读边界", "来源线索"],
      outputRules: [
        "用来回答这个概念是什么、为什么会进入紫微斗数体系。",
        "只能作为读盘前置说明，不直接输出个人命盘结论。",
        "涉及古籍术语时必须保留版本或来源索引。",
        "涉及现代资料时只保留栏目结构和项目自有摘要。"
      ],
      currentChartBoundary: [
        "当前盘解释中只可引用为背景说明。",
        "不得用基础体系层直接判断吉凶。",
        "不得替代星曜、宫位和格局证据。"
      ]
    },
    {
      layerId: "star-body",
      label: "星曜本体层",
      sourceObservation: "参考资料会先写星曜属五行、阴阳、化气、主事、象义、性情、优点、风险和常见误读。",
      dictionaryTargetLayer: "star.dictionary",
      requiredFields: ["星曜名称", "星曜分类", "五行阴阳", "化气或主事", "核心象义", "优势", "风险", "喜忌边界", "来源线索"],
      outputRules: [
        "先解释这颗星本身代表什么，再解释它落入宫位后如何转换。",
        "本体解释不等于当前盘结论，只是该星的基础语义。",
        "主星、辅曜、煞曜、杂曜和周期流系星曜必须分层。",
        "杂曜不能被写成主星同等权重。"
      ],
      currentChartBoundary: [
        "当前盘只显示命中星曜。",
        "本体解释必须结合落宫、同宫、对宫、三方四正和四化后再进入结论。",
        "短周期星曜不能反推长期命格。"
      ]
    },
    {
      layerId: "star-palace",
      label: "星曜入宫层",
      sourceObservation: "参考资料会把同一颗星的入十二宫含义拆到命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母分别解释。",
      dictionaryTargetLayer: "star-palace.dictionary",
      requiredFields: ["星曜", "宫位", "落宫转换", "本宫含义", "对宫牵引", "三方四正", "同宫组合", "四化修正", "庙旺落陷修正", "动态盘边界"],
      outputRules: [
        "必须回答这颗星在这个宫位为什么这样解释。",
        "同一颗星入不同宫位时，解释重点必须随宫位主题转换。",
        "入宫解释要保留对宫、三方四正和同宫组合入口。",
        "庙旺落陷只修正星曜承接力，不给四化本身使用。"
      ],
      currentChartBoundary: [
        "当前盘只显示盘中真实落宫。",
        "未出现的星曜入宫解释不显示。",
        "动态盘入宫必须标明本命、大限、流年、流月、流日或流时。"
      ]
    },
    {
      layerId: "palace-system",
      label: "十二宫系统层",
      sourceObservation: "参考资料会把十二宫作为人事领域系统，说明每个宫的观察主题和宫位之间的互动关系。",
      dictionaryTargetLayer: "palace.dictionary",
      requiredFields: ["宫位", "人事主题", "观察问题", "对宫关系", "三方四正宫组", "空宫借对宫", "动态宫名", "复核边界"],
      outputRules: [
        "宫位不是标签，必须能提出读盘问题。",
        "夫妻宫不能只写感情，还要看关系对象、互动方式、承诺成本、对宫福德和三方财官迁移。",
        "财帛宫不能只写钱，还要看资源方式、承接能力、对宫福德和三方命官迁。",
        "疾厄宫只做身心状态和压力结构提示，不做医学诊断。"
      ],
      currentChartBoundary: [
        "当前盘宫位解释必须带本宫星曜证据。",
        "空宫必须借对宫和三方四正。",
        "流年宫位必须标注流年宫名，不得混同原盘宫名。"
      ]
    },
    {
      layerId: "relation-structure",
      label: "关系结构层",
      sourceObservation: "参考资料会强调三方四正、两邻夹宫、同宫、对宫、会照，而不是用单宫一两颗星直接判断。",
      dictionaryTargetLayer: "relationship.dictionary",
      requiredFields: ["关系类型", "参与宫位", "参与星曜", "主从权重", "吉曜支援", "煞曜压力", "组合边界", "证据链"],
      outputRules: [
        "同宫表示主题直接混合，对宫表示对象面和外部反馈，三方四正表示结构支援或结构压力。",
        "夹宫和会照只能作为增强或复核证据，不能单独生成结论。",
        "吉曜不一定全吉，煞曜不一定全凶，必须看承接宫位和星曜组合。",
        "关系结构必须服务当前选中宫位。"
      ],
      currentChartBoundary: [
        "当前盘必须先选定中心宫位，再输出关系结构。",
        "未参与当前盘命中的关系不显示。",
        "动态盘只显示当前盘层对应的三方四正线和关系标签。"
      ]
    },
    {
      layerId: "transformation-flow",
      label: "四化层",
      sourceObservation: "参考资料会把四化视为由天干触发的星曜变化，而不是独立星曜，并区分先天、大限和流年等层级。",
      dictionaryTargetLayer: "transformation.dictionary",
      requiredFields: ["四化类型", "来源天干", "来源盘层", "目标星", "目标宫", "叠加关系", "强弱边界", "误读边界"],
      outputRules: [
        "必须写清楚是谁的四化。",
        "化禄、化权、化科、化忌只说明触发主题，不单独断现实结果。",
        "同一颗星被多层四化触发时必须分层显示。",
        "四化不标庙旺落陷。"
      ],
      currentChartBoundary: [
        "未选择对应盘层时不显示该层四化解释。",
        "流年四化必须保留大限和本命背景。",
        "流月、流日、流时四化只能做短周期触发。"
      ]
    },
    {
      layerId: "dynamic-flow",
      label: "动态盘层",
      sourceObservation: "参考资料和排盘工具会把大限、流年、流月作为不同时间尺度，不把它们混成同一层结论。",
      dictionaryTargetLayer: "dynamic-flow.dictionary",
      requiredFields: ["盘层", "时间尺度", "起盘来源", "动态命宫", "动态十二宫", "上层继承", "下层清空", "输出边界"],
      outputRules: [
        "原盘是底盘，大限是十年阶段，流年是年度主题，流月、流日、流时逐层缩短。",
        "切换下层时必须保留上层背景。",
        "取消上层时必须清空下层选择。",
        "短周期只能解释触发和提醒，不能放大成命格。"
      ],
      currentChartBoundary: [
        "默认进入原盘状态。",
        "选中大限后显示大限命宫和大限十二宫。",
        "选中流年后仍保留大限标签，并叠加流年命宫和流年十二宫。"
      ]
    },
    {
      layerId: "chart-synthesis",
      label: "当前盘综合层",
      sourceObservation: "参考资料的排盘入口最终会把基础资料、星曜、宫位、四化、动态盘结合到当前盘，但有效解释必须回到证据链。",
      dictionaryTargetLayer: "current-chart.analysis",
      requiredFields: ["当前盘层", "命中宫位", "命中星曜", "命中格局", "四化证据", "三方四正证据", "地支空间证据", "输出段落", "隐藏理由"],
      outputRules: [
        "当前盘只显示命中的内容。",
        "先写证据，再写解释，不得直接跳断语。",
        "总字典解释只说明资料本身，当前盘解释才说明这张盘为什么命中。",
        "资料不足时隐藏或进入复核队列。"
      ],
      currentChartBoundary: [
        "不得显示未命中的格局。",
        "不得把总字典全文塞进当前盘。",
        "不得做行为映射和人格化分析。"
      ]
    }
  ]

export const ZIWEI_DICTIONARY_REFERENCE_METHOD_CHECKLIST: string[] = [
  "是否先区分总字典解释和当前盘命中解释。",
  "是否先写星曜本体，再写星曜入宫。",
  "是否把十二宫作为人事主题系统，而不是只当宫名标签。",
  "是否纳入同宫、对宫、三方四正、夹宫和会照。",
  "是否写清四化来源盘层、来源天干、目标星和目标宫。",
  "是否保留大限、流年、流月、流日、流时的继承边界。",
  "是否只显示当前盘真实命中的内容。",
  "是否避免复制现代网站正文。",
  "是否保留 sourceId、主题标签、复核状态和项目自有摘要。",
  "是否把资料不足的内容隐藏或送入复核队列。"
]

export function getAllZiweiExternalExplanationReferenceSourceProfiles():
  ZiweiExternalExplanationReferenceSourceProfile[] {
  return ZIWEI_EXTERNAL_EXPLANATION_REFERENCE_SOURCES
}

export function getAllZiweiDictionaryExplanationLayerProfiles():
  ZiweiDictionaryExplanationLayerProfile[] {
  return ZIWEI_DICTIONARY_EXPLANATION_LAYER_PROFILES
}

export function getZiweiDictionaryExplanationLayerProfile(
  layerId: ZiweiDictionaryExplanationLayerId
): ZiweiDictionaryExplanationLayerProfile | undefined {
  return ZIWEI_DICTIONARY_EXPLANATION_LAYER_PROFILES.find((profile) => profile.layerId === layerId)
}
