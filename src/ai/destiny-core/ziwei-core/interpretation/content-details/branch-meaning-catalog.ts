import type { BranchPalace } from "../../contracts"

import type {
  ZiweiBranchContentDetail,
  ZiweiBranchGroupContentDetail
} from "./content-detail-types"
import { buildBranchDictionarySourceReferences } from "./content-source-reference-map"

export const ZIWEI_BRANCH_ORDER: BranchPalace[] = [
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
  "zi",
  "chou"
]

export const ZIWEI_BRANCH_GROUP_DETAILS: Record<
  string,
  ZiweiBranchGroupContentDetail
> = {
  siMa: {
    groupId: "siMa",
    label: "四马地",
    branches: ["yin", "shen", "si", "hai"],
    aliases: ["四生地", "四长生地", "驿马位"],
    nature:
      "四马地是寅申巳亥，代表启动、流动、迁移、转换和外部牵引。紫微斗数中看迁移、变动、外出、奔波、开局和转换节奏时，要特别注意这些地支。",
    analysisUsage: [
      "用于判断宫位主题是否带流动、迁移、开端和转换性质。",
      "天马、迁移宫、动态流年和四化触发到四马地时，要看事件是否更容易表现为移动、换场、出行、奔波或资源流动。",
      "四马地不是单纯好坏，它强调动象和启动成本；星曜组合好时利开拓，煞忌重时易奔波、反复或难停。"
    ],
    cautions: [
      "不要把四马地直接断为必然出远门。",
      "要结合命宫、迁移宫、天马、动态盘层和星曜组合。"
    ]
  },
  siBai: {
    groupId: "siBai",
    label: "四败地",
    branches: ["zi", "wu", "mao", "you"],
    aliases: ["四正地", "四旺地", "桃花地"],
    nature:
      "四败地是子午卯酉，也常作为四正、四旺和桃花地使用。它们位于四方正位，外显度高，关系、人气、审美、名声、情感和欲望更容易被看见。",
    analysisUsage: [
      "用于判断宫位主题是否更外显、更容易被关系和环境牵动。",
      "桃花、咸池、红鸾、天喜、贪狼等与四败地相会时，要看人缘、感情、审美、曝光和欲望管理。",
      "四败地也可看成四正位置，利于观察冲照明显、关系对立清楚、外界反馈直接的结构。"
    ],
    cautions: [
      "四败地不是必然败坏，名称中的败更偏向散、外泄、关系牵动和欲望显露。",
      "桃花地也不等于感情结论，必须看星曜、宫位和煞忌。"
    ]
  },
  siMu: {
    groupId: "siMu",
    label: "四墓库地",
    branches: ["chen", "xu", "chou", "wei"],
    aliases: ["四库地", "四墓地", "土库"],
    nature:
      "四墓库地是辰戌丑未，代表收藏、积累、仓库、压力沉淀、旧问题和结构性承载。它们有土性收束，常用于观察资源库、责任库、债务、沉积和长期问题。",
    analysisUsage: [
      "用于判断宫位主题是否带积累、沉淀、保守、库藏或旧账性质。",
      "财帛、田宅、福德、疾厄等宫落四墓库地时，常需看资源承载、身体压力、家庭积累和内在沉淀。",
      "火贪、铃贪等格局常涉及辰戌丑未这类库地，要看爆发力是否有库可开、是否有煞忌破坏。"
    ],
    cautions: [
      "四墓库地不是只代表墓或坏事，也代表收纳、储藏和承载。",
      "库地被冲、被化忌或被煞曜牵动时，才重点看旧问题被打开或压力外显。"
    ]
  },
  sanHeWater: {
    groupId: "sanHeWater",
    label: "申子辰水局",
    branches: ["shen", "zi", "chen"],
    aliases: ["水三合"],
    nature: "申子辰为水局三合，强调流动、信息、资源循环、智性和情绪暗流。",
    analysisUsage: ["用于判断三方四正中的水性联动。", "动态盘触发时可观察资源流、情绪流和信息流。"],
    cautions: ["三合局必须看三支是否成关系范围，不能只凭单支判断。"]
  },
  sanHeWood: {
    groupId: "sanHeWood",
    label: "亥卯未木局",
    branches: ["hai", "mao", "wei"],
    aliases: ["木三合"],
    nature: "亥卯未为木局三合，强调生发、成长、关系延伸、计划和柔性扩张。",
    analysisUsage: ["用于判断成长、学习、人际延伸和长期培育。", "遇文曜、辅曜、化科时可看计划和表达成长。"],
    cautions: ["木局过旺或受煞时，要看犹豫、蔓延和方向分散。"]
  },
  sanHeFire: {
    groupId: "sanHeFire",
    label: "寅午戌火局",
    branches: ["yin", "wu", "xu"],
    aliases: ["火三合"],
    nature: "寅午戌为火局三合，强调行动、表现、声名、热度、推动和外放。",
    analysisUsage: ["用于判断行动性、曝光度、名声和推动力。", "遇太阳、火铃、权星时要看热度是否可控。"],
    cautions: ["火局强时不宜只看积极，也要复核急躁、耗损和冲突。"]
  },
  sanHeMetal: {
    groupId: "sanHeMetal",
    label: "巳酉丑金局",
    branches: ["si", "you", "chou"],
    aliases: ["金三合"],
    nature: "巳酉丑为金局三合，强调规则、执行、收敛、技术、财务和切割判断。",
    analysisUsage: ["用于判断执行力、制度、财务、技术和取舍。", "遇武曲、七杀、擎羊、陀罗时要看刚性是否过强。"],
    cautions: ["金局受煞忌时要复核冲突、损耗、冷硬和过度切割。"]
  }
}

export const ZIWEI_BRANCH_CONTENT_DETAILS: Record<
  BranchPalace,
  ZiweiBranchContentDetail
> = {
  yin: branch({
    branch: "yin",
    label: "寅",
    yinYang: "yang",
    element: "wood",
    direction: "东北偏东",
    season: "初春",
    monthHint: "农历正月",
    timeHint: "寅时，约 03:00-05:00",
    groupIds: ["siMa", "sanHeFire"],
    hiddenStems: ["甲", "丙", "戊"],
    nature: "寅为阳木，带初生、开端、行动、开拓和外出之象，是四马地之一，也是火局长生发动处。",
    symbolicMeanings: ["启动", "开拓", "行动", "外出", "成长初始", "竞争意识"],
    palaceUsage: ["宫位落寅时，先看该宫主题是否需要主动开局、移动、突破或进入新环境。", "寅宫带马地动象，迁移、官禄、财帛等宫遇动星时更重开拓。"],
    starInteraction: ["主星入寅常带行动和开端语境。", "天马、七杀、破军、太阳、火铃等会寅时，要看开拓力和风险边界。"],
    dynamicUsage: ["流年、大限或流月命宫到寅，常提示该阶段需要启动、试探和对外行动。"],
    relationshipUsage: ["寅午戌火局中，寅是发动点；寅申冲时，常看内外拉扯、移动与变动。"],
    cautions: ["不要只因寅为马地就断奔波，仍要看星曜和动态层级。", "寅木过强或遇煞时，要复核急躁和开局成本。"]
  }),
  mao: branch({
    branch: "mao",
    label: "卯",
    yinYang: "yin",
    element: "wood",
    direction: "正东",
    season: "仲春",
    monthHint: "农历二月",
    timeHint: "卯时，约 05:00-07:00",
    groupIds: ["siBai", "sanHeWood"],
    hiddenStems: ["乙"],
    nature: "卯为阴木，主生长、关系、审美、柔性连接和外显的人际气场，是四败桃花地之一。",
    symbolicMeanings: ["人缘", "审美", "成长", "柔和", "关系牵动", "表达气质"],
    palaceUsage: ["宫位落卯时，常看关系互动、审美表达、成长节奏和外界反馈。", "卯为桃花正位，遇桃花星或文曜时要细看情感、人缘与表达。"],
    starInteraction: ["贪狼、咸池、红鸾、天喜、文昌文曲入卯时，关系与审美主题会更明显。", "煞忌入卯时要看关系困扰和外界评价。"],
    dynamicUsage: ["动态命宫到卯，阶段主题容易落在人际、表达、合作和情绪柔性处理。"],
    relationshipUsage: ["亥卯未木局中，卯是旺点；卯酉冲时，常看关系对立、审美冲突和表达被挑战。"],
    cautions: ["卯为桃花地不等于一定有感情事件。", "要区分人缘、审美、名声、欲望和真实关系承诺。"]
  }),
  chen: branch({
    branch: "chen",
    label: "辰",
    yinYang: "yang",
    element: "earth",
    direction: "东南偏东",
    season: "春末",
    monthHint: "农历三月",
    timeHint: "辰时，约 07:00-09:00",
    groupIds: ["siMu", "sanHeWater"],
    hiddenStems: ["戊", "乙", "癸"],
    nature: "辰为湿土、水库，带收纳、转换、旧事沉淀和资源蓄积之象，是四墓库地之一。",
    symbolicMeanings: ["库藏", "沉淀", "转换", "湿土", "旧问题", "资源蓄积"],
    palaceUsage: ["宫位落辰时，要看该宫主题是否有积累、旧账、资源库或尚未完全打开的问题。", "辰宫遇财星、田宅星、化禄时，常需看资源是否能真正流动。"],
    starInteraction: ["武曲、天府、禄存入辰时重资源承载。", "火贪、铃贪等涉及辰戌丑未时，要看库地是否被打开。"],
    dynamicUsage: ["动态盘触发辰时，常提示积累问题、资源库存或旧结构被重新处理。"],
    relationshipUsage: ["申子辰水局中，辰为水库；辰戌冲时，常看库冲、旧事翻动和结构冲突。"],
    cautions: ["辰不是单纯阻滞，也可能是资源仓库。", "库地判断必须看是否有冲、化、煞或禄来打开。"]
  }),
  si: branch({
    branch: "si",
    label: "巳",
    yinYang: "yin",
    element: "fire",
    direction: "东南偏南",
    season: "初夏",
    monthHint: "农历四月",
    timeHint: "巳时，约 09:00-11:00",
    groupIds: ["siMa", "sanHeMetal"],
    hiddenStems: ["丙", "戊", "庚"],
    nature: "巳为阴火，带热度、技术、变化、暗中运作和快速转化之象，是四马地之一。",
    symbolicMeanings: ["转化", "技术", "热度", "暗动", "变化", "资源炼化"],
    palaceUsage: ["宫位落巳时，先看该宫主题是否带技术处理、暗中变化、快速转化或移动性质。", "巳宫遇火铃、武曲、七杀、化权时，要看执行热度与压力。"],
    starInteraction: ["巳酉丑金局中，巳是金局发动处，遇武曲、廉贞、七杀等星曜时重规则和执行。", "桃花与煞忌同入巳时，要复核欲望和隐性风险。"],
    dynamicUsage: ["动态流到巳，常提示事情开始升温、技术处理、暗中推进或环境转换。"],
    relationshipUsage: ["巳亥冲时，常看明暗冲突、移动变化和内外方向相反。"],
    cautions: ["巳火不等于单纯外放，它也有暗中酝酿和复杂转化。", "遇煞忌时要看隐性消耗。"]
  }),
  wu: branch({
    branch: "wu",
    label: "午",
    yinYang: "yang",
    element: "fire",
    direction: "正南",
    season: "仲夏",
    monthHint: "农历五月",
    timeHint: "午时，约 11:00-13:00",
    groupIds: ["siBai", "sanHeFire"],
    hiddenStems: ["丁", "己"],
    nature: "午为阳火正位，主明亮、表现、名声、外放、热度和公开可见，是四败桃花地之一。",
    symbolicMeanings: ["曝光", "名声", "热度", "行动", "礼仪", "外显"],
    palaceUsage: ["宫位落午时，该宫主题更容易公开化、被看见、被评价。", "午宫遇太阳、天梁、化科、化权时，名声、责任和外部表现更明显。"],
    starInteraction: ["太阳在午重光明与外显。", "火铃、擎羊等入午时，要看急躁、冲突和过度消耗。"],
    dynamicUsage: ["动态盘触发午时，常提示事情走向台前、热度上升或责任被看见。"],
    relationshipUsage: ["寅午戌火局中，午是旺点；子午冲时，常看情绪与表现、内外冷热冲突。"],
    cautions: ["午火强不一定好，要看是否过热、过劳或声名压力。", "桃花地与曝光地要分开判断。"]
  }),
  wei: branch({
    branch: "wei",
    label: "未",
    yinYang: "yin",
    element: "earth",
    direction: "西南偏南",
    season: "夏末",
    monthHint: "农历六月",
    timeHint: "未时，约 13:00-15:00",
    groupIds: ["siMu", "sanHeWood"],
    hiddenStems: ["己", "丁", "乙"],
    nature: "未为燥土、木库，带收纳、培育、生活积累、照护和未尽之事，是四墓库地之一。",
    symbolicMeanings: ["培育", "积累", "照护", "生活感", "未尽", "土中藏木"],
    palaceUsage: ["宫位落未时，要看该宫主题是否需要长期培养、照护、储备或整理未完成的部分。", "未宫在田宅、福德、子女等主题中，常看生活基础和内在承接。"],
    starInteraction: ["天同、太阴、天府等入未时，生活感和积累主题更明显。", "煞忌入未时，要看闷压、拖延和内耗。"],
    dynamicUsage: ["动态盘到未，常提示阶段进入整理、养成、收纳和修复。"],
    relationshipUsage: ["亥卯未木局中，未为木库；丑未冲时，常看资源、家庭、责任和身体压力。"],
    cautions: ["未不是单纯迟滞，也代表培养和承接。", "库地要看是否被打开、是否有资源进入。"]
  }),
  shen: branch({
    branch: "shen",
    label: "申",
    yinYang: "yang",
    element: "metal",
    direction: "西南偏西",
    season: "初秋",
    monthHint: "农历七月",
    timeHint: "申时，约 15:00-17:00",
    groupIds: ["siMa", "sanHeWater"],
    hiddenStems: ["庚", "壬", "戊"],
    nature: "申为阳金，带规则、技术、变动、外部系统和资源流转，是四马地之一。",
    symbolicMeanings: ["规则", "技术", "移动", "系统", "资源流", "外部压力"],
    palaceUsage: ["宫位落申时，要看该宫主题是否与制度、技术、外部系统、移动转换有关。", "申宫遇迁移、官禄、财帛主题时，常看外部机会与规则压力。"],
    starInteraction: ["武曲、七杀、天机、天马入申时，技术、执行和移动性增强。", "煞忌入申时，要看规则冲突和外部压力。"],
    dynamicUsage: ["动态盘触发申时，常提示外部系统介入、规则变化、行动转场或资源重新流动。"],
    relationshipUsage: ["申子辰水局中，申为水局发动点；寅申冲时，常看动象冲突和方向转折。"],
    cautions: ["申金动而不一定稳，要看是否有主星承接。", "四马地受煞时，奔波和规则压力会更明显。"]
  }),
  you: branch({
    branch: "you",
    label: "酉",
    yinYang: "yin",
    element: "metal",
    direction: "正西",
    season: "仲秋",
    monthHint: "农历八月",
    timeHint: "酉时，约 17:00-19:00",
    groupIds: ["siBai", "sanHeMetal"],
    hiddenStems: ["辛"],
    nature: "酉为阴金正位，主审美、修饰、规则、收束、精致和外部评价，是四败桃花地之一。",
    symbolicMeanings: ["审美", "修饰", "评价", "规则", "精致", "收敛"],
    palaceUsage: ["宫位落酉时，要看该宫主题是否与审美、评价、规制、精细处理和关系显露有关。", "酉宫遇桃花星、文曜、太阴、贪狼时，审美和关系气场更明显。"],
    starInteraction: ["文昌文曲入酉常重表达与修饰。", "擎羊陀罗等入酉时，要看关系中的冷硬、挑剔或切割。"],
    dynamicUsage: ["动态命宫到酉，常提示整理、曝光、评价、收束和关系选择。"],
    relationshipUsage: ["巳酉丑金局中，酉为旺点；卯酉冲时，常看关系冲突、审美分歧和价值对立。"],
    cautions: ["酉为桃花地不等于只有感情，也可能是审美、名声和社会评价。", "金气过重时要看冷感和切割。"]
  }),
  xu: branch({
    branch: "xu",
    label: "戌",
    yinYang: "yang",
    element: "earth",
    direction: "西北偏西",
    season: "秋末",
    monthHint: "农历九月",
    timeHint: "戌时，约 19:00-21:00",
    groupIds: ["siMu", "sanHeFire"],
    hiddenStems: ["戊", "辛", "丁"],
    nature: "戌为燥土、火库，带规则收束、旧火余温、责任沉淀和防守边界，是四墓库地之一。",
    symbolicMeanings: ["责任库", "防守", "收束", "旧事", "边界", "燥土"],
    palaceUsage: ["宫位落戌时，要看该宫主题是否有责任沉淀、边界防守、旧问题收束和压力积累。", "戌宫遇火性星曜时，要看热度是否被收藏或形成内压。"],
    starInteraction: ["廉贞、武曲、七杀、火铃入戌时，责任、规则和冲突边界更明显。", "天梁入戌时可看修复和道义责任。"],
    dynamicUsage: ["动态盘到戌，常提示收束、复核旧结构、处理责任边界和沉积问题。"],
    relationshipUsage: ["寅午戌火局中，戌为火库；辰戌冲时，常看库冲和旧结构震动。"],
    cautions: ["戌库不一定坏，也可能是责任承接。", "被冲或会煞忌时才更像旧问题爆出。"]
  }),
  hai: branch({
    branch: "hai",
    label: "亥",
    yinYang: "yin",
    element: "water",
    direction: "西北偏北",
    season: "初冬",
    monthHint: "农历十月",
    timeHint: "亥时，约 21:00-23:00",
    groupIds: ["siMa", "sanHeWood"],
    hiddenStems: ["壬", "甲"],
    nature: "亥为阴水，带远方、隐性流动、潜意识、资源暗流和生发前的蓄势，是四马地之一。",
    symbolicMeanings: ["远方", "暗流", "潜藏", "流动", "蓄势", "精神性"],
    palaceUsage: ["宫位落亥时，要看该宫主题是否带远方、隐性资源、精神感受或未显露的流动。", "亥宫在迁移、福德、命身等主题中，常看远方牵引和内在感受。"],
    starInteraction: ["太阴、天同、天机入亥时，感受、智慧和流动性更明显。", "空劫煞忌入亥时，要看虚耗、迷茫和暗中压力。"],
    dynamicUsage: ["动态盘触发亥时，常提示事情进入暗流、远方、准备期或精神层面的牵动。"],
    relationshipUsage: ["亥卯未木局中，亥为木局生处；巳亥冲时，常看明暗冲突和远近转换。"],
    cautions: ["亥水隐而动，不宜只看静态。", "四马地加水象时，要特别区分流动、逃避和远方机会。"]
  }),
  zi: branch({
    branch: "zi",
    label: "子",
    yinYang: "yang",
    element: "water",
    direction: "正北",
    season: "仲冬",
    monthHint: "农历十一月",
    timeHint: "子时，约 23:00-01:00",
    groupIds: ["siBai", "sanHeWater"],
    hiddenStems: ["癸"],
    nature: "子为阳水正位，主深水、智慧、情绪、流动、隐秘和夜中发动，是四败桃花地之一。",
    symbolicMeanings: ["智慧", "情绪", "隐秘", "流动", "夜象", "关系牵引"],
    palaceUsage: ["宫位落子时，要看该宫主题是否带深层情绪、信息流、隐性资源或关系牵引。", "子宫遇太阴、天同、巨门等星时，内在感受和语言暗流更明显。"],
    starInteraction: ["桃花星入子，要看关系吸引、情绪牵挂和隐性互动。", "化忌或煞曜入子时，要复核情绪、误解和暗耗。"],
    dynamicUsage: ["动态命宫到子，常提示阶段主题进入内在、信息、关系暗流或夜间发动状态。"],
    relationshipUsage: ["申子辰水局中，子为旺点；子午冲时，常看内外、冷热、情绪与表现的冲突。"],
    cautions: ["子为桃花地不等于单纯感情，也可能是信息、人气、暗流和情绪。", "水旺时要看流动是否有边界。"]
  }),
  chou: branch({
    branch: "chou",
    label: "丑",
    yinYang: "yin",
    element: "earth",
    direction: "东北偏北",
    season: "冬末",
    monthHint: "农历十二月",
    timeHint: "丑时，约 01:00-03:00",
    groupIds: ["siMu", "sanHeMetal"],
    hiddenStems: ["己", "癸", "辛"],
    nature: "丑为寒湿土、金库，带收纳、冷藏、耐力、现实压力和迟缓发酵，是四墓库地之一。",
    symbolicMeanings: ["冷藏", "耐力", "现实", "资源库", "迟缓", "压力沉积"],
    palaceUsage: ["宫位落丑时，要看该宫主题是否需要耐心积累、现实承接、资源保存或处理沉积压力。", "丑宫遇财星、田宅星、武曲天府时，常看资源库和现实安全。"],
    starInteraction: ["武曲、天府、太阴入丑时，资源、积累和现实承接更明显。", "煞忌入丑时，要看压抑、拖延、寒湿和沉重感。"],
    dynamicUsage: ["动态盘触发丑时，常提示阶段进入收尾、储备、现实压力和旧账整理。"],
    relationshipUsage: ["巳酉丑金局中，丑为金库；丑未冲时，常看家庭、资源和身体承接的冲突。"],
    cautions: ["丑库不等于停滞，也可能是耐力和资源保存。", "被冲开时要看旧问题、旧资源或现实压力外显。"]
  })
}

export function getBranchContentDetail(
  branch: BranchPalace
): ZiweiBranchContentDetail | null {
  return ZIWEI_BRANCH_CONTENT_DETAILS[branch] ?? null
}

export function getAllBranchContentDetails(): ZiweiBranchContentDetail[] {
  return ZIWEI_BRANCH_ORDER.map((branch) => ZIWEI_BRANCH_CONTENT_DETAILS[branch])
}

export function getBranchGroupContentDetail(
  groupId: string
): ZiweiBranchGroupContentDetail | null {
  return ZIWEI_BRANCH_GROUP_DETAILS[groupId] ?? null
}

export function getAllBranchGroupContentDetails(): ZiweiBranchGroupContentDetail[] {
  return Object.values(ZIWEI_BRANCH_GROUP_DETAILS)
}

function branch(
  input: Omit<ZiweiBranchContentDetail, "sections" | "sourceReferences">
): ZiweiBranchContentDetail {
  const sourceReferences = buildBranchDictionarySourceReferences()
  const dynamicUsage = [
    ...input.dynamicUsage,
    `${input.label}在动态盘中只作为空间语境和触发位置使用：大限看阶段落点，流年看年度落点，流月、流日、流时只看短周期提醒，不能脱离本宫星曜和三方四正单独断事。`
  ]

  return {
    ...input,
    dynamicUsage,
    sourceReferences,
    sections: [
      {
        title: "地支本体",
        items: [
          `${input.label}的本体性质：${input.nature}`,
          `${input.label}的基本象义包括${input.symbolicMeanings.join("、")}。`
        ]
      },
      {
        title: "所属分组",
        items: input.groupIds.map((groupId) => {
          const group = ZIWEI_BRANCH_GROUP_DETAILS[groupId]
          return group ? `${group.label}：${group.nature}` : `未登记分组：${groupId}`
        })
      },
      {
        title: "入宫用法",
        items: input.palaceUsage
      },
      {
        title: "星曜互动",
        items: input.starInteraction
      },
      {
        title: "动态盘用法",
        items: dynamicUsage
      },
      {
        title: "关系结构",
        items: input.relationshipUsage
      },
      {
        title: "误读边界",
        items: input.cautions
      }
    ]
  }
}
