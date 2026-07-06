import type {
  ZiweiPatternContentDetail,
  ZiweiPatternContentDetailInput,
  ZiweiPatternContentTone
} from "./content-detail-types"

type PatternCategoryProfile = Omit<
  ZiweiPatternContentDetail,
  "patternId" | "label" | "category"
>

const CATEGORY_PROFILES: Record<string, PatternCategoryProfile> = {
  literary: {
    tone: "favorable",
    nature: "文曜科名类格局，重视文字、表达、考试、名誉和知识体系的成形。",
    coreThemes: ["文采", "表达", "名誉", "秩序"],
    strengths: ["利学习整理", "利文书表达", "利规则化输出", "利名声被看见"],
    risks: ["容易停留在表达层", "遇忌煞时文书名誉受阻", "缺执行星时落地不足"],
    enhancementSignals: ["昌曲同会", "化科同会", "魁钺辅弼加会", "主星庙旺"],
    breakSignals: ["文昌文曲化忌", "火铃羊陀冲破", "空劫同会", "目标宫位陷弱"],
    personalityTendency: "倾向用知识、表达和条理处理问题，重视可说明、可记录、可被认可的成果。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["文曜格局需看是否能落入实际宫位任务。", "遇化忌时优先复核文书、表达和名誉压力。"]
  },
  assistant: {
    tone: "favorable",
    nature: "辅佐贵人类格局，重视支援系统、协作资源、贵人引荐和结构性帮助。",
    coreThemes: ["支援", "贵人", "协作", "承接"],
    strengths: ["利获得外部帮助", "利团队协作", "利补足主星短板", "利承接复杂任务"],
    risks: ["容易依赖支援", "主星弱时助力难承接", "遇煞忌时帮助伴随压力"],
    enhancementSignals: ["左右夹拱", "魁钺同会", "昌曲同会", "禄权科加会"],
    breakSignals: ["孤寡煞忌冲破", "空劫消耗支援", "羊陀火铃打断协作", "化忌牵扯人情"],
    personalityTendency: "倾向借助组织、伙伴和外部资源推进事情，也愿意成为他人的支援节点。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["辅曜格局不替代主星，只决定主结构是否有人扶。", "判断层次时要看助力是否能被命宫主轴吸收。"]
  },
  mainCombo: {
    tone: "mixed",
    nature: "主星组合类格局，重视命盘骨架、主导气质、人生驱动力和核心行为模式。",
    coreThemes: ["主轴", "驱动力", "骨架", "组合主轴"],
    strengths: ["能形成清晰命盘核心", "利稳定判断盘面主线", "便于连接宫位任务", "可作为命盘底层结构参考"],
    risks: ["组合强时容易一意孤行", "庙陷差异影响很大", "遇煞忌时主轴被扭曲"],
    enhancementSignals: ["主星庙旺", "左右魁钺加会", "禄权科同会", "三方四正清爽"],
    breakSignals: ["六煞会命", "化忌同宫或会照", "主星落陷", "空劫破耗"],
    personalityTendency: "倾向以主星组合形成稳定反应模式，外界事件会被先转译成该组合熟悉的行动逻辑。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["主星组合必须结合庙旺落陷和三方四正。", "同一组合遇加吉或破格时，表现层次差异会很大。"]
  },
  wealthPower: {
    tone: "favorable",
    nature: "禄马权科类格局，重视资源、行动、权责、名誉和机会流动的组合。",
    coreThemes: ["资源", "行动", "权责", "名誉"],
    strengths: ["利资源流动", "利行动转化", "利权责上升", "利机会被看见"],
    risks: ["容易追逐回报过急", "权责增加带来压力", "禄忌相缠时得失反复"],
    enhancementSignals: ["禄马交驰", "禄权科组合", "双禄同会", "主星能承接资源"],
    breakSignals: ["化忌同会", "空劫耗散", "火铃羊陀冲破", "行动星陷入无效奔波"],
    personalityTendency: "倾向把机会、资源和行动连接起来，遇事会思考如何获得、推进、转化和扩大。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["禄马权科格局要区分资源流入和责任加压。", "遇忌时不能只看收益，也要看反复牵挂和代价。"]
  },
  malefic: {
    tone: "adverse",
    nature: "煞曜结构类格局，重视冲突、阻滞、惊扰、空耗和必须处理的压力源。",
    coreThemes: ["压力", "冲突", "阻滞", "修复"],
    strengths: ["能暴露问题边界", "利危机处理", "利强制修复漏洞", "可形成抗压训练"],
    risks: ["冲突成本高", "容易消耗心力", "决策被惊扰打断", "问题可能反复出现"],
    enhancementSignals: ["吉曜制化", "主星庙旺承压", "化科缓和", "明确规则约束"],
    breakSignals: ["煞忌叠加", "空劫同会", "主星陷弱", "同宫或夹命形成高压"],
    personalityTendency: "倾向先感知风险和阻力，行动中带有防御、纠偏、突破或强制清障色彩。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["煞曜格局不等于直接坏结果，要看是否有制化和承接。", "煞忌叠加时优先做风险提示，不输出绝对断语。"]
  },
  misc: {
    tone: "mixed",
    nature: "杂曜结构类格局，重视喜庆、名位、桃花、孤寡、仪态和细节触发。",
    coreThemes: ["细节", "人际", "名位", "情绪"],
    strengths: ["能补充主星没有覆盖的细节", "利观察关系氛围", "利识别名位和仪态", "利捕捉隐性情绪"],
    risks: ["容易被细节放大", "桃花孤寡需分辨边界", "不宜覆盖主星和宫位主轴"],
    enhancementSignals: ["台辅封诰同会", "龙池凤阁同会", "红鸾天喜成对", "吉曜同会"],
    breakSignals: ["桃花遇忌", "孤寡遇煞", "空劫虚耗", "主结构不承接"],
    personalityTendency: "倾向在关系、仪态、名位和情绪细节中形成微妙反应，需要主星主轴来校准轻重。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["杂曜格局是细节补充，不应压过主星。", "桃花与孤寡结构要和煞忌、宫位一起判断。"]
  },
  adverse: {
    tone: "adverse",
    nature: "凶格破格类结构，重视煞忌、落陷、纠缠、破耗和原有好格局被打断的机制。",
    coreThemes: ["破格", "煞忌", "纠缠", "代价"],
    strengths: ["能指出盘面风险来源", "利提前设置边界", "利识别反复失败点", "利建立修复优先级"],
    risks: ["容易形成高压叙事", "若脱离全盘会误判", "遇多重煞忌时解释成本高"],
    enhancementSignals: ["吉曜制化", "化科缓和", "庙旺主星承接", "宫位任务清晰"],
    breakSignals: ["化忌同宫", "煞忌会命", "空劫夹耗", "桃花煞忌或孤寡煞忌叠加"],
    personalityTendency: "倾向把注意力拉向卡点、冲突、亏欠和需要修复的旧问题，容易先防守再行动。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["凶格破格必须由明确结构触发，不能用含糊数量替代。", "解释时应同时提供制化和修复路径，避免绝对化。"]
  },
  pending: {
    tone: "pending",
    nature: "待校准格局，只保留目录位置和复核入口，等待正式规则、样例和边界确认。",
    coreThemes: ["待校准", "规则缺口", "样例复核", "边界确认"],
    strengths: ["保留扩展入口", "便于后续补样例", "防止规则遗漏", "适合人工复核"],
    risks: ["当前不能作为正式判断", "条件不明时容易误导", "缺少样例时无法闭合"],
    enhancementSignals: ["补齐规则", "补齐黄金样例", "补齐来源说明", "通过一致性检查"],
    breakSignals: ["无正式条件", "无样例校验", "来源不明", "口径与现有规则冲突"],
    personalityTendency: "暂不映射稳定命盘倾向，只作为未闭合信息提示。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["待校准格局不能进入最终断语。", "必须补规则、样例和检查脚本后才能转为正式格局。"]
  }
}

const ID_HINTS: {
  includes: string
  themes: string[]
  note: string
  tone?: ZiweiPatternContentTone
}[] = [
  {
    includes: "hua-ji",
    themes: ["化忌", "阻滞", "反复"],
    note: "含化忌结构时，重点看目标星被牵挂、阻滞和反复修复的位置。",
    tone: "adverse"
  },
  {
    includes: "malefic-ji",
    themes: ["煞忌", "压力叠加", "破格"],
    note: "煞忌同会或会命时，优先判断压力是否超出主星承接力。",
    tone: "adverse"
  },
  {
    includes: "same-palace",
    themes: ["同宫", "集中触发"],
    note: "同宫结构代表主题集中触发，力量更直接，也更需要看同宫星曜能否互相承接。"
  },
  {
    includes: "adjacent",
    themes: ["夹拱", "邻宫牵引"],
    note: "夹拱或邻宫结构代表外侧牵引，力量不一定直冲，但会持续塑造命宫边界。"
  },
  {
    includes: "bright",
    themes: ["庙旺", "亮度"],
    note: "涉及庙旺亮度时，要把星曜状态作为格局层次的重要条件。"
  },
  {
    includes: "clean",
    themes: ["清格", "避煞忌"],
    note: "清格强调主结构少受煞忌干扰，若后续见煞忌，应转入破格复核。"
  },
  {
    includes: "assisted",
    themes: ["加吉", "辅佐"],
    note: "加吉结构表示主格局获得支援，但仍要看主星是否能承接。"
  },
  {
    includes: "lu-ji",
    themes: ["禄忌", "得失纠缠"],
    note: "禄忌结构要同时看资源入口和代价回流，不能只按收益判断。",
    tone: "adverse"
  },
  {
    includes: "quan-ji",
    themes: ["权忌", "权责压力"],
    note: "权忌结构常见权责、控制和阻滞纠缠，需要看是否有规则化出口。",
    tone: "adverse"
  },
  {
    includes: "ke-ji",
    themes: ["科忌", "名誉文书压力"],
    note: "科忌结构重名誉、表达、文书和解释成本，需要看化科是否能缓和化忌。",
    tone: "adverse"
  },
  {
    includes: "romance",
    themes: ["桃花", "关系边界"],
    note: "桃花结构要同时判断吸引力、关系边界和是否被煞忌牵动。"
  },
  {
    includes: "solitary",
    themes: ["孤寡", "距离感"],
    note: "孤寡结构提示关系距离和情绪收束，不应直接绝对化为孤苦。"
  }
]

export function getPatternContentDetail(
  input: ZiweiPatternContentDetailInput
): ZiweiPatternContentDetail {
  const base = CATEGORY_PROFILES[input.category] ?? CATEGORY_PROFILES.pending
  const hints = ID_HINTS.filter((hint) => input.id.includes(hint.includes))
  const tone = resolveTone(base.tone, hints)

  return {
    patternId: input.id,
    label: input.label,
    category: input.category,
    tone,
    nature: `${input.label}：${base.nature}`,
    coreThemes: unique([
      ...base.coreThemes,
      ...hints.flatMap((hint) => hint.themes)
    ]),
    strengths: base.strengths,
    risks: base.risks,
    enhancementSignals: base.enhancementSignals,
    breakSignals: base.breakSignals,
    personalityTendency: base.personalityTendency,
    worldBehaviorHint: base.worldBehaviorHint,
    readingNotes: unique([
      `原始判定条件：${input.conditionText}`,
      ...base.readingNotes,
      ...hints.map((hint) => hint.note)
    ])
  }
}

export function getPatternCategoryContentProfile(
  category: string
): PatternCategoryProfile {
  return CATEGORY_PROFILES[category] ?? CATEGORY_PROFILES.pending
}

function resolveTone(
  baseTone: ZiweiPatternContentTone,
  hints: typeof ID_HINTS
): ZiweiPatternContentTone {
  const hintedTone = hints.find((hint) => hint.tone)?.tone

  if (hintedTone) {
    return hintedTone
  }

  return baseTone
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

