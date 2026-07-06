import type { ZiweiStarId } from "../../contracts"
import { MISC_STAR_IDS } from "../../star-catalog"

import type { ZiweiMiscStarContentDetail } from "./content-detail-types"

export const ZIWEI_MISC_STAR_CONTENT_DETAILS: Record<
  (typeof MISC_STAR_IDS)[keyof typeof MISC_STAR_IDS],
  ZiweiMiscStarContentDetail
> = {
  [MISC_STAR_IDS.hongluan]: {
    starId: MISC_STAR_IDS.hongluan,
    label: "红鸾",
    yinYang: "yin",
    element: "fire",
    nature: "喜庆、姻缘、情感触发之星，重视关系开启、情绪回应和人际靠近。",
    coreThemes: ["姻缘", "喜庆", "情感触发", "关系开启"],
    strengths: ["容易带来亲近感", "能软化紧张关系", "适合推动关系修复与情感表达"],
    risks: ["容易因情绪起伏而判断过快", "对关系期待偏高", "遇煞忌时喜事中夹杂压力"],
    favorableSignals: ["与天喜同会时喜庆感增强", "会吉曜时关系推进较顺", "入夫妻、命、福德时情感主题明显"],
    unfavorableSignals: ["会煞忌时情感容易受阻", "与咸池、天姚过重时易生暧昧纠缠", "落空劫时期待容易落空"],
    palaceFocus: "看该宫的关系开启、喜庆事件、情感回应、亲密需求和人际牵引。",
    personalityTendency: "倾向以情感回应世界，愿意靠近他人，也较容易被关系气氛影响。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["红鸾重在关系被触发，不等同于必然成婚。", "与天喜同看可判断喜庆强弱，与煞忌同看可判断关系压力。"]
  },
  [MISC_STAR_IDS.tianxi]: {
    starId: MISC_STAR_IDS.tianxi,
    label: "天喜",
    yinYang: "yang",
    element: "fire",
    nature: "喜悦、庆贺、和合之星，重视愉快气氛、好消息和关系缓冲。",
    coreThemes: ["喜悦", "庆贺", "和合", "好消息"],
    strengths: ["能提升场域愉悦感", "适合缓和冲突", "有利仪式、庆典和正向反馈"],
    risks: ["容易只看表面喜气", "对问题深层压力反应不足", "遇空耗时喜而不实"],
    favorableSignals: ["与红鸾同会时喜庆和关系主题加强", "会昌曲时表达更讨喜", "会魁钺辅弼时更易获得祝福和帮助"],
    unfavorableSignals: ["会空劫时喜讯容易虚化", "会化忌时喜中有阻", "会煞曜时庆事需要防突发干扰"],
    palaceFocus: "看该宫的喜讯、庆祝、和合机会、气氛改善和情绪提振。",
    personalityTendency: "倾向用乐观和善意回应环境，容易成为缓冲冲突的人。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天喜偏喜气和气氛，不一定代表长期稳定。", "红鸾看关系触发，天喜看喜悦兑现，两者需要分开判断。"]
  },
  [MISC_STAR_IDS.xianchi]: {
    starId: MISC_STAR_IDS.xianchi,
    label: "咸池",
    yinYang: "yin",
    element: "water",
    nature: "桃花、吸引、感官流动之星，重视魅力、社交牵引和欲望波动。",
    coreThemes: ["桃花", "吸引力", "感官", "社交牵引"],
    strengths: ["能增强亲和与魅力", "适合艺术、审美和社交场景", "对情绪氛围感知敏锐"],
    risks: ["容易被欲望和气氛带走", "关系边界易模糊", "遇煞忌时容易卷入纠缠"],
    favorableSignals: ["会文曜时可转为审美表达", "会吉曜时社交魅力较易被善用", "入迁移、交友时人际吸引力明显"],
    unfavorableSignals: ["会天姚时暧昧与情绪波动加重", "会化忌时关系牵扯难清", "会煞曜时桃花容易带来冲突或损耗"],
    palaceFocus: "看该宫的吸引力、欲望牵引、社交曝光、情感边界和人际诱因。",
    personalityTendency: "倾向被气氛、审美和亲密感牵动，善于感受但需要边界。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["咸池不是单纯吉凶，重点在吸引力是否有边界。", "与化忌、煞曜同会时要看关系代价与情绪消耗。"]
  },
  [MISC_STAR_IDS.tianyao]: {
    starId: MISC_STAR_IDS.tianyao,
    label: "天姚",
    yinYang: "yin",
    element: "water",
    nature: "魅惑、才情、表现欲之星，重视风情、表演、感性表达和情绪波纹。",
    coreThemes: ["魅力", "才情", "表现", "暧昧"],
    strengths: ["具备表现与感染力", "适合艺术、表达和形象经营", "能捕捉微妙情绪"],
    risks: ["容易形成暧昧不明", "情绪信号可能过度放大", "遇忌煞时易有名声或关系困扰"],
    favorableSignals: ["会昌曲时才情表达增强", "会天喜红鸾时关系吸引力明显", "会吉曜时魅力较易转为正向资源"],
    unfavorableSignals: ["会咸池时桃花气过重", "会化忌时暧昧变成压力", "会煞曜时易因情感或形象产生冲突"],
    palaceFocus: "看该宫的魅力呈现、表演欲、暧昧信号、审美才情和情绪波动。",
    personalityTendency: "倾向用感性、姿态和表达影响环境，容易在关系中释放复杂信号。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天姚要和咸池区分，天姚更重表现与风情。", "入命身或夫妻时要同时看边界、声誉和情绪稳定度。"]
  },
  [MISC_STAR_IDS.taifu]: {
    starId: MISC_STAR_IDS.taifu,
    label: "台辅",
    yinYang: "yang",
    element: "earth",
    nature: "辅佐、台阶、制度支持之星，重视平台、引荐、助力和位置抬升。",
    coreThemes: ["辅佐", "平台", "引荐", "位置抬升"],
    strengths: ["容易获得结构性帮助", "适合进入平台与组织", "能把个人能力接到外部资源"],
    risks: ["容易依赖平台认可", "助力不足时显得空有位置", "遇空耗时支持不稳"],
    favorableSignals: ["与封诰同会时名位支持增强", "会魁钺辅弼时贵人链条清晰", "入官禄、迁移时平台效应明显"],
    unfavorableSignals: ["会空劫时平台承诺易落空", "会煞忌时组织支持伴随压力", "落陷主星同宫时助力难完全发挥"],
    palaceFocus: "看该宫是否有平台、引荐、组织背书、上升台阶和辅助资源。",
    personalityTendency: "倾向借助秩序和平台成长，愿意在结构中获得位置。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["台辅重实际台阶，不宜只作抽象贵人看。", "要看同宫主星能否承接平台资源。"]
  },
  [MISC_STAR_IDS.fenggao]: {
    starId: MISC_STAR_IDS.fenggao,
    label: "封诰",
    yinYang: "yin",
    element: "earth",
    nature: "封赏、名分、正式认可之星，重视资格、称号、文书和荣誉确认。",
    coreThemes: ["认可", "名分", "资格", "荣誉"],
    strengths: ["有利正式认证和名誉积累", "能增强身份感", "适合文书、表彰和制度性确认"],
    risks: ["容易重形式而轻实质", "名分压力可能限制行动", "遇忌时称号变成负担"],
    favorableSignals: ["与台辅同会时平台与名分互相支撑", "会昌曲时文书名誉更明显", "会魁钺时认可来源较正"],
    unfavorableSignals: ["会化忌时文书或名分有瑕疵", "会空劫时认可容易虚名化", "会煞曜时名誉伴随争议"],
    palaceFocus: "看该宫的资格、名誉、文书确认、正式身份和外部评价。",
    personalityTendency: "倾向重视正当性和被认可，做事希望有名分、有凭据。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["封诰偏正式认可，不等于实际执行力。", "与台辅同看可判断是否既有平台又有名分。"]
  },
  [MISC_STAR_IDS.longchi]: {
    starId: MISC_STAR_IDS.longchi,
    label: "龙池",
    yinYang: "yang",
    element: "water",
    nature: "仪表、声望、文采装饰之星，重视形象、气度、名声和外在呈现。",
    coreThemes: ["形象", "声望", "气度", "装饰"],
    strengths: ["能提升外在观感", "有利名声与审美包装", "适合形象、礼仪和文化表达"],
    risks: ["容易重外观包装", "真实能力不足时会显虚饰", "遇忌煞时名声易被挑剔"],
    favorableSignals: ["与凤阁同会时仪态与审美增强", "会文曜时文采形象突出", "会吉曜时声望较稳定"],
    unfavorableSignals: ["会空劫时形象有虚浮感", "会煞忌时外部评价波动", "与破碎同会时形象容易被打断"],
    palaceFocus: "看该宫的形象管理、名声曝光、礼仪表现、审美包装和外界观感。",
    personalityTendency: "倾向重视体面和呈现方式，希望让行为看起来有气度。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["龙池重外在观感和体面，不宜直接等同权力。", "与凤阁同看可判断审美与仪态的完整度。"]
  },
  [MISC_STAR_IDS.fengge]: {
    starId: MISC_STAR_IDS.fengge,
    label: "凤阁",
    yinYang: "yin",
    element: "wood",
    nature: "雅致、才艺、阁台表达之星，重视审美、文艺、修饰和柔性声名。",
    coreThemes: ["雅致", "才艺", "审美", "柔性声名"],
    strengths: ["有利艺术气质与表达", "能提升细腻度", "适合文艺、设计和礼貌沟通"],
    risks: ["容易过度修饰", "行动力不足时停留在观感", "遇忌时审美变成敏感挑剔"],
    favorableSignals: ["与龙池同会时形象和仪态完整", "会昌曲时才艺与文字表达增强", "会吉曜时审美能转为资源"],
    unfavorableSignals: ["会空劫时才艺难落地", "会煞曜时表达易被打断", "会化忌时名声或作品受挑剔"],
    palaceFocus: "看该宫的审美表达、才艺包装、礼貌风格、文艺气息和柔性名声。",
    personalityTendency: "倾向用雅致、修饰和细腻表达影响环境，重视体验和风格。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["凤阁偏雅致与才艺，龙池偏体面与形象。", "若同宫缺执行星，需要另看实际落地能力。"]
  },
  [MISC_STAR_IDS.tianwu]: {
    starId: MISC_STAR_IDS.tianwu,
    label: "天巫",
    yinYang: "yin",
    element: "wood",
    nature: "感应、疗愈、转化之星，重视直觉、祈愿、身心连接和隐性调节。",
    coreThemes: ["感应", "疗愈", "转化", "身心连接"],
    strengths: ["直觉感知较强", "适合安抚、疗愈和转化场景", "能观察隐性情绪与需求"],
    risks: ["容易把直觉当事实", "界限不足时受他人情绪影响", "遇空忌时判断容易虚化"],
    favorableSignals: ["会吉曜时感应可转为助人能力", "入疾厄、福德时身心调节主题明显", "会文曜时适合表达心理与灵感"],
    unfavorableSignals: ["会空劫时信号难落地", "会化忌时容易疑神疑虑", "会煞曜时情绪与身体压力互相牵动"],
    palaceFocus: "看该宫的直觉感应、疗愈需求、身心转化、隐性情绪和非理性判断。",
    personalityTendency: "倾向凭感受捕捉环境变化，能安抚他人，但需要事实校验。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天巫内容适合做心理与感应层，不应替代客观判断。", "入疾厄时要谨慎表达，只作身心观察，不作医疗结论。"]
  },
  [MISC_STAR_IDS.guchen]: {
    starId: MISC_STAR_IDS.guchen,
    label: "孤辰",
    yinYang: "yang",
    element: "earth",
    nature: "孤立、独行、自持之星，重视距离感、独立性和不易依附。",
    coreThemes: ["孤立", "独行", "自持", "距离感"],
    strengths: ["适合独立判断", "能在无人支持时坚持", "边界感较强"],
    risks: ["容易疏离他人", "不善求助", "关系中显得冷硬或难靠近"],
    favorableSignals: ["会吉曜时可转为独立专注", "入官禄时适合独立职能", "入福德时有自我沉淀能力"],
    unfavorableSignals: ["与寡宿同会时孤寂感加重", "会空劫时孤立变成空耗", "会忌煞时容易因不沟通而积压问题"],
    palaceFocus: "看该宫的独处、距离、分离、独立判断和难以依附的倾向。",
    personalityTendency: "倾向先靠自己解决问题，情感表达克制，关系上保留空间。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["孤辰不等于必然孤苦，也可代表独立专注。", "与寡宿、空劫、忌曜同看时才重点判断疏离代价。"]
  },
  [MISC_STAR_IDS.guasu]: {
    starId: MISC_STAR_IDS.guasu,
    label: "寡宿",
    yinYang: "yin",
    element: "earth",
    nature: "寡合、冷清、情感收束之星，重视情绪降温、关系空位和内在封闭。",
    coreThemes: ["寡合", "冷清", "情感收束", "关系空位"],
    strengths: ["能减少无效社交", "适合沉静反省", "对关系质量有筛选能力"],
    risks: ["容易情绪封闭", "亲密关系有冷感", "遇忌煞时孤寂与失落加重"],
    favorableSignals: ["会吉曜时可转为安静稳定", "入福德时适合内省修养", "与稳重主星同宫时少言而可靠"],
    unfavorableSignals: ["与孤辰同会时疏离感增强", "会化忌时情绪不易舒展", "会空劫时关系空位更明显"],
    palaceFocus: "看该宫的寡合、冷清、关系缺口、情绪封闭和亲密度下降。",
    personalityTendency: "倾向收敛情绪，不轻易表达需要，常把关系压力放在心里。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["寡宿偏情感收束，孤辰偏独立距离。", "夫妻、福德、命宫见之时要看是否有吉曜提供温度。"]
  },
  [MISC_STAR_IDS.tianxing]: {
    starId: MISC_STAR_IDS.tianxing,
    label: "天刑",
    yinYang: "yang",
    element: "metal",
    nature: "刑法、规训、边界之星，重视规则、惩戒、手术切割和制度约束。",
    coreThemes: ["规则", "刑罚", "边界", "切割"],
    strengths: ["能建立明确边界", "适合纪律、法务和纠偏", "处理违规问题较果断"],
    risks: ["容易过度严厉", "关系中有惩罚感", "遇煞忌时易有法务、伤损或冲突压力"],
    favorableSignals: ["会吉曜时规则能转为秩序", "入官禄时适合制度、审查、纪律工作", "与稳重主星同宫时边界更可控"],
    unfavorableSignals: ["会擎羊、火星时刑伤感增强", "会化忌时规则纠纷加重", "入疾厄时需谨慎观察伤病与手术象"],
    palaceFocus: "看该宫的规则、惩戒、边界、纠错、法律压力和必须切割的问题。",
    personalityTendency: "倾向讲规则、讲责任，遇到越界行为会直接处理。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天刑可为秩序，也可为伤刑，要看同宫组合。", "涉及疾厄时只做象义提示，不做医学判断。"]
  },
  [MISC_STAR_IDS.posui]: {
    starId: MISC_STAR_IDS.posui,
    label: "破碎",
    yinYang: "yin",
    element: "metal",
    nature: "破裂、零散、缺口之星，重视损坏、断裂、不完整和结构松散。",
    coreThemes: ["破裂", "零散", "缺口", "不完整"],
    strengths: ["能暴露结构裂缝", "适合拆解旧问题", "提醒系统需要修补"],
    risks: ["容易半途破局", "成果不完整", "遇煞忌时损耗与断裂更明显"],
    favorableSignals: ["会吉曜时可转为拆解重组", "入田宅时提醒空间或资产维护", "入官禄时适合检查漏洞"],
    unfavorableSignals: ["会空劫时破而难补", "会煞曜时损坏更急", "会化忌时缺口反复扩大"],
    palaceFocus: "看该宫的破损、断裂、漏洞、碎片化、未完成和需要修补之处。",
    personalityTendency: "倾向先看到问题裂缝，容易对不完整之处敏感。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["破碎并非只能看坏事，也可指拆开重组。", "与空劫同会时要重点看资源落空和结构缺口。"]
  },
  [MISC_STAR_IDS.tianku]: {
    starId: MISC_STAR_IDS.tianku,
    label: "天哭",
    yinYang: "yin",
    element: "water",
    nature: "哭泣、忧伤、情绪释放之星，重视悲感、压力宣泄和共情反应。",
    coreThemes: ["忧伤", "哭泣", "宣泄", "共情"],
    strengths: ["能感受他人痛点", "适合情绪释放和共情陪伴", "对悲伤主题有敏锐度"],
    risks: ["容易陷入低落", "对负面信息反应过深", "遇忌煞时忧思变成压力"],
    favorableSignals: ["会吉曜时可转为同理心", "入福德时情绪净化主题明显", "会文曜时适合表达悲悯与故事"],
    unfavorableSignals: ["与天虚同会时虚耗悲感加重", "会化忌时情绪难以排解", "会煞曜时悲伤伴随冲突或惊扰"],
    palaceFocus: "看该宫的忧伤、哭泣、情绪宣泄、共情反应和心理压力出口。",
    personalityTendency: "倾向深度感受情绪，对他人痛苦敏感，也容易被悲伤气氛牵动。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天哭适合做情绪层解释，不能直接断为灾祸。", "与天虚同看时要判断是真实伤感还是空耗失落。"]
  },
  [MISC_STAR_IDS.tianxu]: {
    starId: MISC_STAR_IDS.tianxu,
    label: "天虚",
    yinYang: "yin",
    element: "water",
    nature: "虚耗、空感、落差之星，重视期待落空、心理空洞和不实之象。",
    coreThemes: ["虚耗", "空感", "落差", "不实"],
    strengths: ["能识别虚假承诺", "适合反省期待与现实差距", "提醒系统补足空白"],
    risks: ["容易失落和怀疑", "行动感不足", "遇忌煞时虚耗变成持续压力"],
    favorableSignals: ["会吉曜时可转为反思与校正", "入福德时心理空感主题明显", "会文曜时适合写作、想象和虚构表达"],
    unfavorableSignals: ["与天哭同会时忧伤与空感叠加", "会空劫时虚耗更明显", "会化忌时期待反复落空"],
    palaceFocus: "看该宫的期待落空、虚耗、不实承诺、心理空洞和需要补足的现实缺口。",
    personalityTendency: "倾向感受落差和不确定，容易先怀疑再投入。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天虚重虚与落差，不等于实际损坏。", "与破碎、空劫、化忌同看时要区分心理空感与现实破耗。"]
  }
}

export function getMiscStarContentDetail(
  starId: ZiweiStarId
): ZiweiMiscStarContentDetail | null {
  return ZIWEI_MISC_STAR_CONTENT_DETAILS[
    starId as keyof typeof ZIWEI_MISC_STAR_CONTENT_DETAILS
  ] ?? null
}

export function getAllMiscStarContentDetails(): ZiweiMiscStarContentDetail[] {
  return Object.values(ZIWEI_MISC_STAR_CONTENT_DETAILS)
}

