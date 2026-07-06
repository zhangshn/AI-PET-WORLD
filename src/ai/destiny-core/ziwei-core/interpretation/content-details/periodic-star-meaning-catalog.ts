import type { ZiweiStarId } from "../../contracts"
import {
  DAILY_HOURLY_STAR_IDS,
  LIFECYCLE_STAR_IDS,
  MONTHLY_STAR_IDS,
  YEARLY_STAR_IDS
} from "../../star-catalog"

import type { ZiweiStarContentDetail } from "./content-detail-types"

interface PeriodicStarMeaningSeed {
  starId: ZiweiStarId
  label: string
  group: "lifecycle" | "boshi" | "suiqian" | "jiangqian" | "monthly" | "dailyHourly"
  nature: string
  themes: string[]
  strengths: string[]
  risks: string[]
  palaceFocus: string
  readingNotes: string[]
}

const GROUP_CONTEXT: Record<
  PeriodicStarMeaningSeed["group"],
  {
    nature: string
    strengths: string[]
    risks: string[]
    favorableSignals: string[]
    unfavorableSignals: string[]
    personalityTendency: string
    worldBehaviorHint: string
    readingNotes: string[]
  }
> = {
  lifecycle: {
    nature: "长生十二神属于气势阶段星曜，用来描述宫位主题从发生、成长、旺盛、衰退到收藏再孕育的生命周期。",
    strengths: ["能补充宫位气势强弱", "能帮助判断事件成熟度", "适合观察长期议题的阶段变化"],
    risks: ["不能单独决定吉凶", "不能替代主星、四化和三方四正", "阶段词容易被误读成固定结果"],
    favorableSignals: ["与主星庙旺同宫时阶段承接更清楚", "与吉曜同会时发展更顺", "落入用事宫位时阶段提示更明显"],
    unfavorableSignals: ["与煞忌同宫时阶段压力加重", "落入空劫重处时气势容易虚耗", "被破格牵动时阶段表现会偏折"],
    personalityTendency: "用于以阶段、节奏和成熟度解释宫位主题，不直接给出绝对断语。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["先把长生十二神翻译成阶段，再放回宫位主题。", "长生十二神只辅助判断气势，不替代星曜本身。"]
  },
  boshi: {
    nature: "博士十二神属于流年禄存系星曜，用来观察年度资源、行动、喜庆、耗损、病符、官符等行政式细节。",
    strengths: ["适合补充流年层面的资源和事务线索", "能区分年度助力、消耗和文书压力", "可辅助动态盘的短中期解释"],
    risks: ["不能作为本命长期结论", "必须保留流年层级", "不能脱离流年命宫和流年四化"],
    favorableSignals: ["与流年吉化同看时年度助力更明显", "落入关键宫位时提示该宫年度事务", "与主星承接良好时事件更容易落地"],
    unfavorableSignals: ["与流年化忌或煞曜叠加时压力变重", "落入弱宫时提示事务阻滞", "耗损类星曜同会时要看成本"],
    personalityTendency: "用于提示年度事务如何被推动、消耗、记录或牵动。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["博士十二神从流年禄存系统看，不要混成岁前或将前。", "只在动态流年语境中放大解释。"]
  },
  suiqian: {
    nature: "岁前十二神属于太岁前后气候星曜，用来观察年度气氛、岁运压力、喜德、病符、白虎等外部环境触发。",
    strengths: ["适合补充年度环境气候", "能提示外部阻力、贵德和病耗信息", "有助于区分流年风险来源"],
    risks: ["容易被绝对化为吉凶", "不能脱离宫位和主星承接", "需要和博士、将前分开解释"],
    favorableSignals: ["遇天德龙德时有缓和与修复", "与吉化同宫时环境支援更强", "主星稳时能承接外部气候"],
    unfavorableSignals: ["遇白虎、病符、吊客等时要看压力源", "与煞忌叠加时风险信号提高", "弱宫受冲时容易放大外部阻力"],
    personalityTendency: "用于把年度外部气候转译成盘面提醒、边界和修复路径。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["岁前十二神看岁运气候，不是本命常驻星。", "遇不利星曜时要给复核路径，不直接做灾断。"]
  },
  jiangqian: {
    nature: "将前十二神属于流年三合将星系统，用来观察年度行动、迁动、孤高、桃花、灾煞和背后议题。",
    strengths: ["能补充年度行动方向", "适合观察迁动、人际和隐性压力", "可帮助拆分事件性质"],
    risks: ["不宜脱离将前起法", "桃花孤寡煞类不能绝对化", "必须结合宫位和流年主线"],
    favorableSignals: ["将星、攀鞍、岁驿等与动能宫位相合时行动力强", "华盖与文曜同会时利专注和技艺", "有吉曜制化时煞象可转成警觉"],
    unfavorableSignals: ["劫煞、灾煞、天煞、亡神同会时要查风险层级", "指背提示口舌和背后评价", "咸池月煞要看关系边界"],
    personalityTendency: "用于把年度行动与隐性人际、迁动和风险线索联系起来。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["将前十二神要按三合局理解。", "煞类条目必须结合制化和宫位，不输出绝对断语。"]
  },
  monthly: {
    nature: "月系星曜属于月度短周期触发，用来观察当月解厄、巫仪、月度牵动和阴性压力。",
    strengths: ["适合生成月度提醒", "能补充短期情绪和事件气氛", "有助于区分月度层级与流年层级"],
    risks: ["周期较短，不能放大为长期结论", "必须服从流年主线", "不能替代本命星曜解释"],
    favorableSignals: ["与流月吉化同看时短期助力增强", "落入用事宫位时当月主题明显", "与解厄类星曜同见时有缓冲"],
    unfavorableSignals: ["与流月忌煞同宫时短期压力提高", "落入关系宫位时注意情绪边界", "弱宫受冲时短期波动加大"],
    personalityTendency: "用于提示当月状态、短期协助、短期压力和流月宫位触发。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["月系星曜只在月度语境中加权。", "解释时要同时看流年背景和流月命宫。"]
  },
  dailyHourly: {
    nature: "日时系星曜属于日、时微周期触发，用来观察当下行动、临场协助、即时名位和细节反馈。",
    strengths: ["适合即时提醒", "能补充当天或当时的细节气氛", "可用于短周期应事提示"],
    risks: ["影响周期极短", "不能上升为长期命格", "不能脱离流日流时命宫"],
    favorableSignals: ["与流日流时吉化同见时短期顺手", "落入行动宫位时适合推进小任务", "与贵人文曜同会时利处理细节"],
    unfavorableSignals: ["与流日流时忌煞同宫时要降速", "短期空耗重时不宜过度承诺", "弱宫受冲时容易出现临时干扰"],
    personalityTendency: "用于把即时盘面转译成临场事项和短周期注意点。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["日时系星曜只做短周期提示。", "不能把短时触发解释成长期命盘结论。"]
  }
}

const PERIODIC_STAR_SEEDS: PeriodicStarMeaningSeed[] = [
  seed(LIFECYCLE_STAR_IDS.changsheng, "长生", "lifecycle", "气机初生，主题开始有生发能力。", ["生发", "开始", "恢复"], ["利开端", "利培养新主题"], ["怕根基不足", "怕过早放大"], "看该宫主题是否进入新的生长起点。"),
  seed(LIFECYCLE_STAR_IDS.muyu, "沐浴", "lifecycle", "气机洗炼，主题进入感受、试探和形象整理阶段。", ["洗炼", "感受", "试探"], ["利调整状态", "利修饰形象"], ["怕情绪摇摆", "怕沉迷表象"], "看该宫主题是否需要整理情绪、外观或适应环境。"),
  seed(LIFECYCLE_STAR_IDS.guandai, "冠带", "lifecycle", "气机成形，主题开始具备身份、包装和上场条件。", ["成形", "包装", "身份"], ["利建立姿态", "利进入正式流程"], ["怕只重形式", "怕承接不足"], "看该宫主题是否进入准备亮相或正式化阶段。"),
  seed(LIFECYCLE_STAR_IDS.linguan, "临官", "lifecycle", "气机就位，主题进入可执行、可承担、可任事阶段。", ["就位", "任事", "执行"], ["利承担职责", "利启动事务"], ["怕压力过早", "怕职责过重"], "看该宫主题是否已经能进入实际承担。"),
  seed(LIFECYCLE_STAR_IDS.diwang, "帝旺", "lifecycle", "气机最盛，主题达到高峰、主导和强势表达阶段。", ["旺盛", "高峰", "主导"], ["利发挥力量", "利扩大影响"], ["怕过旺失衡", "怕强势压迫"], "看该宫主题是否处在最强势、最容易放大的位置。"),
  seed(LIFECYCLE_STAR_IDS.shuai, "衰", "lifecycle", "气机转弱，主题开始从高峰回落，需要收束和调整。", ["回落", "收束", "降温"], ["利复盘", "利降低消耗"], ["怕气势不足", "怕拖延衰退"], "看该宫主题是否需要降速、复盘和重新分配力量。"),
  seed(LIFECYCLE_STAR_IDS.bing, "病", "lifecycle", "气机受损，主题出现疲态、缺口和需要修复的状态。", ["疲态", "缺口", "修复"], ["利发现问题", "利做保养"], ["怕问题累积", "怕忽视小病"], "看该宫主题哪里出现消耗、病灶或修复需求。"),
  seed(LIFECYCLE_STAR_IDS.si, "死", "lifecycle", "气机停滞，主题进入终止、断点或旧结构不再运作的阶段。", ["停滞", "终止", "断点"], ["利结束旧事", "利切断无效结构"], ["怕僵死不变", "怕拒绝转型"], "看该宫主题是否需要结束、止损或重新定义。"),
  seed(LIFECYCLE_STAR_IDS.mu, "墓", "lifecycle", "气机收藏，主题进入沉淀、封存、归档和内部积累阶段。", ["收藏", "归档", "沉淀"], ["利收纳成果", "利保留资源"], ["怕封闭", "怕难以流通"], "看该宫主题是否处在储藏、归档或内化阶段。"),
  seed(LIFECYCLE_STAR_IDS.jue, "绝", "lifecycle", "气机断绝，主题旧缘分或旧路径断开，等待重新孕育。", ["断开", "清空", "转折"], ["利清理旧缘", "利摆脱无效路径"], ["怕孤绝", "怕资源断线"], "看该宫主题是否出现断点、清空或必须换轨。"),
  seed(LIFECYCLE_STAR_IDS.tai, "胎", "lifecycle", "气机内孕，主题尚未显形但已有重新成形的胚胎。", ["孕育", "未显", "准备"], ["利酝酿计划", "利内部培育"], ["怕时机未熟", "怕过早公开"], "看该宫主题是否正在暗中准备新阶段。"),
  seed(LIFECYCLE_STAR_IDS.yang, "养", "lifecycle", "气机滋养，主题需要维护、照料、补给和耐心培育。", ["滋养", "维护", "补给"], ["利养成", "利稳定恢复"], ["怕依赖", "怕养而不动"], "看该宫主题是否需要持续补给和温和推进。"),

  seed(YEARLY_STAR_IDS.boshi, "博士", "boshi", "年度文书、知识、说明和制度化能力被点亮。", ["文书", "知识", "制度"], ["利学习整理", "利说明规则"], ["怕纸上谈兵", "怕文书压力"], "看该宫本年是否有学习、文书、资格或说明事务。"),
  seed(YEARLY_STAR_IDS.lishi, "力士", "boshi", "年度行动力、执行支撑和体力承担被点亮。", ["执行", "体力", "支撑"], ["利推动事务", "利承担重活"], ["怕用力过猛", "怕只靠硬扛"], "看该宫本年是否需要实际行动和体力支撑。"),
  seed(YEARLY_STAR_IDS.qinglong, "青龙", "boshi", "年度喜庆、生机、顺势推动和关系润色被点亮。", ["喜庆", "生机", "顺势"], ["利喜事", "利关系缓和"], ["怕好事虚浮", "怕只看表面"], "看该宫本年是否有喜讯、生机或顺利展开。"),
  seed(YEARLY_STAR_IDS.xiaohao, "小耗", "boshi", "年度小额消耗、零碎支出和细节漏损被点亮。", ["小耗", "支出", "漏损"], ["利发现小成本", "利整理开销"], ["怕琐碎消耗", "怕小洞变大"], "看该宫本年是否有零碎支出和小型损耗。"),
  seed(YEARLY_STAR_IDS.jiangjun, "将军", "boshi", "年度主导、发令、带队和行动决断被点亮。", ["主导", "带队", "决断"], ["利发号施令", "利推进计划"], ["怕强势冲突", "怕独断"], "看该宫本年是否需要主动掌控和推进。"),
  seed(YEARLY_STAR_IDS.zoushu, "奏书", "boshi", "年度陈述、申报、沟通、上呈和文案反馈被点亮。", ["申报", "陈述", "反馈"], ["利提交资料", "利表达诉求"], ["怕文案反复", "怕沟通不清"], "看该宫本年是否有报告、申请、沟通和反馈。"),
  seed(YEARLY_STAR_IDS.feilian, "飞廉", "boshi", "年度快速移动、突发风声、消息传播和小型扰动被点亮。", ["快速", "风声", "扰动"], ["利快速反应", "利消息流通"], ["怕仓促", "怕流言扰动"], "看该宫本年是否有快速变化或消息扰动。"),
  seed(YEARLY_STAR_IDS.xishen, "喜神", "boshi", "年度喜悦、庆贺、人情和顺心气氛被点亮。", ["喜悦", "庆贺", "人情"], ["利喜事", "利人情往来"], ["怕乐极生耗", "怕只喜不实"], "看该宫本年是否有令人舒展的喜庆和人情。"),
  seed(YEARLY_STAR_IDS.bingfu, "病符", "boshi", "年度病耗、疲劳、修复和健康警讯被点亮。", ["病耗", "疲劳", "修复"], ["利早发现问题", "利保养"], ["怕拖延病灶", "怕过劳"], "看该宫本年是否有疲劳、修复或健康管理议题。"),
  seed(YEARLY_STAR_IDS.dahao, "大耗", "boshi", "年度大额消耗、资源流出和明显成本被点亮。", ["大耗", "成本", "流出"], ["利看清成本", "利做预算"], ["怕破耗过大", "怕投入失衡"], "看该宫本年是否有大笔支出或资源外流。"),
  seed(YEARLY_STAR_IDS.fubing, "伏兵", "boshi", "年度暗伏问题、隐藏阻力和未明因素被点亮。", ["暗伏", "隐藏", "阻力"], ["利预先排雷", "利查隐患"], ["怕暗中反复", "怕低估阻力"], "看该宫本年是否存在尚未浮出的风险。"),
  seed(YEARLY_STAR_IDS.guanfu, "官府", "boshi", "年度规则、行政、契约、官非和制度压力被点亮。", ["规则", "行政", "契约"], ["利走流程", "利制度化"], ["怕官非文书", "怕规则压迫"], "看该宫本年是否有流程、法规、契约或公权事项。"),

  seed(YEARLY_STAR_IDS.suijian, "岁建", "suiqian", "太岁气口落入该宫，年度外部主题被建立。", ["太岁", "建立", "年度气口"], ["利确立年度重点", "利启动主题"], ["怕外部压力集中", "怕主题过重"], "看该宫是否成为年度外部环境的重点入口。"),
  seed(YEARLY_STAR_IDS.huiqi, "晦气", "suiqian", "年度低迷、遮蔽、郁结和不明朗气氛被点亮。", ["低迷", "遮蔽", "郁结"], ["利低调修整", "利排除阴影"], ["怕误会", "怕气势不明"], "看该宫本年是否有低调、遮蔽或不顺气氛。"),
  seed(YEARLY_STAR_IDS.sangmen, "丧门", "suiqian", "年度哀耗、失落、家宅牵挂和情绪压力被点亮。", ["哀耗", "失落", "牵挂"], ["利处理遗留问题", "利安顿情绪"], ["怕悲观放大", "怕家事牵动"], "看该宫本年是否有失落、告别或家庭情绪议题。"),
  seed(YEARLY_STAR_IDS.guansuo, "贯索", "suiqian", "年度束缚、牵连、手续纠缠和关系绑缚被点亮。", ["束缚", "牵连", "纠缠"], ["利整理手续", "利厘清责任"], ["怕被拖住", "怕连带责任"], "看该宫本年是否有手续、责任或关系牵制。"),
  seed(YEARLY_STAR_IDS.suiGuanfu, "官符", "suiqian", "年度文书规则、申诉争议和行政审查被点亮。", ["官符", "文书", "审查"], ["利按章处理", "利补齐文件"], ["怕争议", "怕流程卡顿"], "看该宫本年是否有公文、申诉、审查或争议。"),
  seed(YEARLY_STAR_IDS.suiXiaohao, "小耗", "suiqian", "岁前小耗强调年度环境中的零碎消耗。", ["小耗", "零碎", "成本"], ["利控小支出", "利查漏补缺"], ["怕细碎流失", "怕消耗累积"], "看该宫本年是否因外部环境产生小成本。"),
  seed(YEARLY_STAR_IDS.suiDahao, "大耗", "suiqian", "岁前大耗强调年度环境中的大额破耗和资源外流。", ["大耗", "外耗", "破费"], ["利提前预算", "利止损"], ["怕大额破耗", "怕资源失衡"], "看该宫本年是否因外部环境出现大支出。"),
  seed(YEARLY_STAR_IDS.longde, "龙德", "suiqian", "年度德助、缓和、贵气修复和转圜空间被点亮。", ["德助", "修复", "缓和"], ["利化解冲突", "利得人助"], ["怕只靠贵人", "怕忽略实际行动"], "看该宫本年是否有缓和、修复和贵人德助。"),
  seed(YEARLY_STAR_IDS.baihu, "白虎", "suiqian", "年度锐气、伤损、冲突、惊扰和强硬压力被点亮。", ["锐气", "伤损", "惊扰"], ["利警觉风险", "利快速处理"], ["怕冲突伤损", "怕急躁"], "看该宫本年是否有冲突、伤损或惊扰风险。"),
  seed(YEARLY_STAR_IDS.tiande, "天德", "suiqian", "年度天德贵气、修复、缓冲和善缘保护被点亮。", ["德泽", "缓冲", "保护"], ["利化解", "利得善缘"], ["怕过度依赖", "怕只等外援"], "看该宫本年是否有修复和保护性资源。"),
  seed(YEARLY_STAR_IDS.diaoke, "吊客", "suiqian", "年度吊唁、远客、失落消息和外部牵挂被点亮。", ["吊客", "远讯", "牵挂"], ["利处理外部消息", "利收束情绪"], ["怕失落消息", "怕外事牵动"], "看该宫本年是否有远方、客事或情绪牵挂。"),
  seed(YEARLY_STAR_IDS.suiBingfu, "病符", "suiqian", "岁前病符强调年度外部环境带来的健康、疲惫和修复议题。", ["病符", "疲惫", "修复"], ["利保养", "利检查"], ["怕病耗", "怕拖延"], "看该宫本年是否受外部环境引发疲劳或修复需求。"),

  seed(YEARLY_STAR_IDS.jiangxing, "将星", "jiangqian", "年度将令、行动主轴、组织动员和竞争力被点亮。", ["将令", "行动", "竞争"], ["利统筹行动", "利竞争"], ["怕强硬", "怕过度压迫"], "看该宫本年是否需要主动出击和调度。"),
  seed(YEARLY_STAR_IDS.panan, "攀鞍", "jiangqian", "年度攀升、借势、台阶和外部机会被点亮。", ["攀升", "借势", "台阶"], ["利上台阶", "利借力"], ["怕攀附", "怕基础不足"], "看该宫本年是否有借势上升的机会。"),
  seed(YEARLY_STAR_IDS.suiyi, "岁驿", "jiangqian", "年度驿动、迁移、奔走和环境转换被点亮。", ["迁动", "奔走", "转换"], ["利移动", "利换环境"], ["怕奔波", "怕计划不稳"], "看该宫本年是否有迁动、出行或变换场景。"),
  seed(YEARLY_STAR_IDS.xishenRest, "息神", "jiangqian", "年度收息、休整、停顿和内在恢复被点亮。", ["休整", "停顿", "恢复"], ["利休养", "利降速"], ["怕停滞", "怕消极"], "看该宫本年是否需要暂停、恢复或降低节奏。"),
  seed(YEARLY_STAR_IDS.huagai, "华盖", "jiangqian", "年度孤高、技艺、宗教性、审美和专注封闭被点亮。", ["孤高", "技艺", "专注"], ["利技艺研究", "利独处沉淀"], ["怕孤僻", "怕脱离现实"], "看该宫本年是否有专业、审美或独处议题。"),
  seed(YEARLY_STAR_IDS.jiesha, "劫煞", "jiangqian", "年度突发劫夺、资源受损和被迫应变被点亮。", ["劫夺", "突发", "损失"], ["利警觉", "利止损"], ["怕突发损耗", "怕被动失控"], "看该宫本年是否有突发损耗或需要防抢防失。"),
  seed(YEARLY_STAR_IDS.zaisha, "灾煞", "jiangqian", "年度灾扰、事故压力和环境破坏信号被点亮。", ["灾扰", "事故", "破坏"], ["利防范", "利建立预案"], ["怕事故", "怕环境冲击"], "看该宫本年是否需要建立风险预案。"),
  seed(YEARLY_STAR_IDS.tiansha, "天煞", "jiangqian", "年度天外压力、不可控因素和高位冲击被点亮。", ["外压", "不可控", "冲击"], ["利敬畏风险", "利留余地"], ["怕高压突发", "怕无准备"], "看该宫本年是否有外部不可控压力。"),
  seed(YEARLY_STAR_IDS.zhibei, "指背", "jiangqian", "年度背后评价、口舌暗议和人际误解被点亮。", ["背议", "口舌", "误解"], ["利留证据", "利澄清"], ["怕背后是非", "怕误会累积"], "看该宫本年是否有背后评价或隐性口舌。"),
  seed(YEARLY_STAR_IDS.xianchi, "咸池", "jiangqian", "年度桃花、吸引、关系欲望和社交牵动被点亮。", ["桃花", "吸引", "社交"], ["利魅力", "利人际活络"], ["怕关系越界", "怕沉迷"], "看该宫本年是否有桃花、人际吸引或关系边界议题。"),
  seed(YEARLY_STAR_IDS.yuesha, "月煞", "jiangqian", "年度阴性压力、女性缘分牵动和情绪暗耗被点亮。", ["阴性压力", "情绪", "暗耗"], ["利觉察情绪", "利处理细腻关系"], ["怕情绪暗耗", "怕关系牵制"], "看该宫本年是否有情绪化或阴性关系压力。"),
  seed(YEARLY_STAR_IDS.wangshen, "亡神", "jiangqian", "年度失神、疏忽、遗落和精神分散被点亮。", ["失神", "遗落", "分散"], ["利查漏", "利收心"], ["怕遗失", "怕注意力涣散"], "看该宫本年是否有疏忽、遗落或精神不聚。"),

  seed(MONTHLY_STAR_IDS.yuejie, "月解", "monthly", "月度解厄、缓冲、调停和短期修复被点亮。", ["解厄", "缓冲", "调停"], ["利化解当月压力", "利短期修复"], ["怕只解表面", "怕依赖缓冲"], "看该宫当月是否有可调停、可缓解的空间。"),
  seed(MONTHLY_STAR_IDS.tianwu, "天巫", "monthly", "月度仪式、感应、疗愈、祝祷和非理性支持被点亮。", ["仪式", "感应", "疗愈"], ["利疗愈", "利仪式感"], ["怕迷信化", "怕脱离现实"], "看该宫当月是否需要仪式、安顿或心理支持。"),
  seed(MONTHLY_STAR_IDS.tianyue, "天月", "monthly", "月度身体感受、病弱提示、情绪牵挂和照护需求被点亮。", ["身体", "照护", "牵挂"], ["利照护", "利觉察身体"], ["怕病弱放大", "怕情绪内耗"], "看该宫当月是否出现身体、照护或情绪需求。"),
  seed(MONTHLY_STAR_IDS.yinsha, "阴煞", "monthly", "月度暗压、隐忧、阴性阻力和不明情绪被点亮。", ["暗压", "隐忧", "阴性阻力"], ["利识别暗处问题", "利降低风险"], ["怕猜疑", "怕暗耗"], "看该宫当月是否有隐藏压力或不明朗因素。"),

  seed(DAILY_HOURLY_STAR_IDS.santai, "三台", "dailyHourly", "日时层面的台阶、秩序、辅助位阶和临场抬升被点亮。", ["台阶", "位阶", "辅助"], ["利临场被托举", "利进入流程"], ["怕架子大于内容", "怕只重形式"], "看该宫当下是否有临时助阶或流程支撑。"),
  seed(DAILY_HOURLY_STAR_IDS.bazuo, "八座", "dailyHourly", "日时层面的座次、承载、名位和支撑场景被点亮。", ["座次", "承载", "名位"], ["利稳定场面", "利获得位置"], ["怕位置空置", "怕虚名"], "看该宫当下是否有短期名位、席位或承载需求。"),
  seed(DAILY_HOURLY_STAR_IDS.enguang, "恩光", "dailyHourly", "日时层面的恩惠、光照、肯定和临时善意被点亮。", ["恩惠", "肯定", "善意"], ["利获得肯定", "利短期缓和"], ["怕期待过高", "怕只看表扬"], "看该宫当下是否有短期帮助、赞许或善意。"),
  seed(DAILY_HOURLY_STAR_IDS.tiangui, "天贵", "dailyHourly", "日时层面的贵气、礼遇、临时贵人和关键照应被点亮。", ["贵气", "礼遇", "照应"], ["利遇到帮手", "利处理正式事项"], ["怕过度依赖", "怕错估资源"], "看该宫当下是否有短期贵人、礼遇或关键照应。")
]

export const ZIWEI_PERIODIC_STAR_CONTENT_DETAILS: Record<
  ZiweiStarId,
  ZiweiStarContentDetail
> = Object.fromEntries(
  PERIODIC_STAR_SEEDS.map((item) => {
    const group = GROUP_CONTEXT[item.group]

    return [
      item.starId,
      {
        starId: item.starId,
        label: item.label,
        yinYang: "mixed",
        element: "mixed",
        nature: `${item.label}：${item.nature} ${group.nature}`,
        coreThemes: unique([...item.themes, ...group.readingNotes.slice(0, 1)]),
        strengths: unique([...item.strengths, ...group.strengths]),
        risks: unique([...item.risks, ...group.risks]),
        favorableSignals: group.favorableSignals,
        unfavorableSignals: group.unfavorableSignals,
        palaceFocus: item.palaceFocus,
        personalityTendency: group.personalityTendency,
        worldBehaviorHint: group.worldBehaviorHint,
        readingNotes: unique([...item.readingNotes, ...group.readingNotes])
      }
    ]
  })
)

export function getPeriodicStarContentDetail(
  starId: ZiweiStarId
): ZiweiStarContentDetail | null {
  return ZIWEI_PERIODIC_STAR_CONTENT_DETAILS[starId] ?? null
}

export function getAllPeriodicStarContentDetails(): ZiweiStarContentDetail[] {
  return Object.values(ZIWEI_PERIODIC_STAR_CONTENT_DETAILS)
}

function seed(
  starId: ZiweiStarId,
  label: string,
  group: PeriodicStarMeaningSeed["group"],
  nature: string,
  themes: string[],
  strengths: string[],
  risks: string[],
  palaceFocus: string,
  readingNotes: string[] = []
): PeriodicStarMeaningSeed {
  return {
    starId,
    label,
    group,
    nature,
    themes,
    strengths,
    risks,
    palaceFocus,
    readingNotes: [
      `${label} 要按${getGroupLabel(group)}层级解释。`,
      ...readingNotes
    ]
  }
}

function getGroupLabel(group: PeriodicStarMeaningSeed["group"]): string {
  if (group === "lifecycle") return "长生十二神"
  if (group === "boshi") return "博士十二神"
  if (group === "suiqian") return "岁前十二神"
  if (group === "jiangqian") return "将前十二神"
  if (group === "monthly") return "月系星曜"
  return "日时系星曜"
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

