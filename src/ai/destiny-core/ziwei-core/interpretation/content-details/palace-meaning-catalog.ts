import type { SectorName } from "../../contracts"
import { SECTOR_ORDER } from "../../shared"
import { SECTOR_LABELS } from "../../page-view/labels"

import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceContentDetail
} from "./content-detail-types"
import { buildPalaceDictionarySourceReferences } from "./content-source-reference-map"

export const ZIWEI_PALACE_ORDER: SectorName[] = [...SECTOR_ORDER]

export const ZIWEI_PALACE_CONTENT_DETAILS: Record<
  SectorName,
  ZiweiPalaceContentDetail
> = {
  life: palace({
    sectorName: "life",
    aliases: ["命", "本命命宫", "命身主轴"],
    corePosition: "整盘自我主轴和判断入口",
    nature: "命宫是紫微盘中观察本人基础气质、自我定位、决策习惯、主观意识和整盘承接能力的核心宫位。它不是单独决定全部命运，而是把主星、辅煞、四化、三方四正和动态流层组织成可读主轴。",
    primaryQuestions: ["这个人如何理解自己和世界？", "遇事先用什么方式判断和行动？", "命宫主星是否能承接三方四正的资源与压力？", "身宫、福德、迁移和官禄如何补充命宫主轴？"],
    starReadingUsage: ["主星入命先看命盘骨架和决策方式，辅曜看资源与协作，煞曜看压力入口，四化看欲望、权责、名誉和牵挂流向。", "命宫无主星时，不把空宫直接断弱，要借对宫和三方四正看主轴来源。"],
    relationUsage: ["命宫对宫为迁移，常看内在自我与外部环境的互相牵引。", "命宫三方常连到财帛、官禄等现实执行领域，用来观察自我主轴如何落到资源与事业。"],
    dynamicUsage: ["大限、流年、流月、流日、流时命宫切换时，要以当前层级命宫作为该时间段观察入口。", "动态命宫不是删除本命命宫，而是在本命底盘上加一层时间焦点。"],
    commonMisreads: ["不要只凭命宫单宫断全部人生。", "不要把命宫强弱和命盘价值混为一谈。", "不要忽略身宫与三方四正对命宫的补充。"],
    reportUsage: ["整盘总论", "命盘主轴", "命身宫分析", "动态流层入口"]
  }),
  siblings: palace({
    sectorName: "siblings",
    aliases: ["兄弟", "手足宫", "同辈宫"],
    corePosition: "同辈、手足、近身协作和横向支持",
    nature: "兄弟宫用于观察手足、同辈、同学、同行、近身协作关系以及横向资源。它也可反映一个人与平级对象相处时的竞争、互助、距离和分工方式。",
    primaryQuestions: ["同辈关系是支持、竞争还是疏离？", "近身协作能否帮命宫分担压力？", "兄弟宫星曜是否带来口舌、利益、助力或距离？", "该宫动态触发时是否出现团队和同辈议题？"],
    starReadingUsage: ["辅曜入兄弟常看协作和支持，煞忌入兄弟要看同辈压力、利益纠葛或沟通阻滞。", "桃花、人际类杂曜入兄弟时，要看社交圈层和横向关系气氛。"],
    relationUsage: ["兄弟宫对宫为交友，常看近身同辈与外部社群之间的映照。", "三方关系可协助判断同辈是否参与资源、事业或家庭承接。"],
    dynamicUsage: ["大限或流年兄弟被触发时，常看同辈合作、团队分工、手足事务、近距离人际变化。", "短周期流月流日触发时，多作为沟通、协作或同辈事件提示。"],
    commonMisreads: ["不要把兄弟宫只解释为亲生兄弟姐妹。", "没有兄弟姐妹的人也可以用它观察同辈和协作网络。", "兄弟宫不直接代表朋友全貌，外部社群还要看交友宫。"],
    reportUsage: ["同辈关系", "协作网络", "团队压力", "横向支持"]
  }),
  spouse: palace({
    sectorName: "spouse",
    aliases: ["夫妻", "配偶宫", "伴侣宫"],
    corePosition: "伴侣关系、一对一合作和亲密互动",
    nature: "夫妻宫用于观察伴侣类型、亲密关系模式、一对一合作、契约关系以及关系中的投射与磨合。它不是婚姻结论本身，而是关系语境的观察宫。",
    primaryQuestions: ["关系中最重视什么样的互动？", "伴侣关系带来支持、压力、吸引还是拉扯？", "夫妻宫与命宫、福德、迁移如何互相影响？", "动态触发时关系议题是否成为阶段重点？"],
    starReadingUsage: ["主星入夫妻看关系模式和伴侣气质，辅曜看协调与支持，煞忌看冲突、距离、压力或修复课题。", "桃花星入夫妻不等于一定感情好坏，要看主星、四化、煞忌和三方关系。"],
    relationUsage: ["夫妻宫对宫为官禄，常看亲密关系与事业责任、社会角色之间的互相牵动。", "三方关系可观察伴侣议题如何影响福德、迁移或命宫承接。"],
    dynamicUsage: ["大限或流年夫妻被触发时，观察伴侣、合作、合同、一对一关系和关系边界。", "流月流日触发时，多看沟通气氛、约定、互动状态和临时摩擦。"],
    commonMisreads: ["不要用夫妻宫单独判断是否结婚、离婚或具体对象。", "夫妻宫差不等于不能建立关系，关键看修复资源和关系边界。", "桃花和煞忌都要回到证据，不做恐吓式断语。"],
    reportUsage: ["亲密关系", "一对一合作", "关系边界", "情感复核"]
  }),
  children: palace({
    sectorName: "children",
    aliases: ["子女", "子息宫", "作品宫"],
    corePosition: "子女、作品、创造延伸和照护对象",
    nature: "子女宫用于观察子女缘、作品产出、创造延伸、教学照护、下属中的延伸关系以及一个人把生命力向外传递的方式。",
    primaryQuestions: ["创造力如何向外延伸？", "对子女、作品或照护对象的投入方式是什么？", "该宫星曜是否带来成果、压力、牵挂或责任？", "动态触发时是否出现生产、创作、照护或下属议题？"],
    starReadingUsage: ["吉辅入子女常看支持和成果延伸，煞忌入子女要看照护压力、作品反复或关系牵挂。", "主星强时，子女宫也可代表项目、作品、学生、下属或创造产物。"],
    relationUsage: ["子女宫对宫为田宅，常看创造延伸与家庭根基、居住环境、长期承载之间的关系。", "三方关系可协助判断成果是否能变成资源、名声或生活结构。"],
    dynamicUsage: ["大限或流年子女被触发时，观察子女、作品、产出、教学、下属和创造项目。", "流月流日触发时，多看短期作品推进、照护事务或成果反馈。"],
    commonMisreads: ["不要把子女宫只看成生育数量。", "没有子女的人也可以用它观察作品、学生、下属和创造延伸。", "健康、生育等现实判断不能由命理直接输出。"],
    reportUsage: ["创造力", "作品成果", "照护关系", "子女议题"]
  }),
  wealth: palace({
    sectorName: "wealth",
    aliases: ["财帛", "财宫", "资源宫"],
    corePosition: "收入、现金流、资源配置和价值交换",
    nature: "财帛宫用于观察收入方式、现金流、资源使用、消费习惯、价值交换和对现实资源的处理能力。它不是财富总额结论，而是财务模式的观察入口。",
    primaryQuestions: ["资源从哪里来、如何流动、如何保存？", "赚钱方式偏稳定、流动、技术、关系还是风险？", "财帛宫是否被命宫和官禄承接？", "动态触发时是否出现收支、合同、资源变化？"],
    starReadingUsage: ["武曲、天府、禄存、化禄等入财帛要看资源承接，煞忌入财帛要看成本、损耗、压力和风险控制。", "空劫入财帛不直接断贫，要看资源虚实、波动和是否有稳定承接。"],
    relationUsage: ["财帛宫对宫为福德，常看现实资源和内在满足、消费欲望、享受能力之间的关系。", "三方关系可观察财务如何连接命宫、官禄和迁移等现实行动。"],
    dynamicUsage: ["大限或流年财帛被触发时，观察收入结构、支出压力、资源机会、合同和价值交换。", "短周期触发时，适合看临时收支、付款、预算和资源调配。"],
    commonMisreads: ["不要只凭财帛宫判断富贵贫穷。", "财帛宫有禄也要看能否守住，有煞也要看是否代表高成本高回报。", "现实投资和财务建议不能由命理直接替代。"],
    reportUsage: ["财务模式", "资源配置", "现金流", "价值交换"]
  }),
  health: palace({
    sectorName: "health",
    aliases: ["疾厄", "身体宫", "承压宫"],
    corePosition: "身体状态、压力承接、隐患和修复节奏",
    nature: "疾厄宫用于观察身体承压方式、心理压力、隐性损耗、修复能力、生活习惯和风险提醒。它只能作为身心状态观察，不输出医疗诊断。",
    primaryQuestions: ["压力最容易从哪里累积？", "身体和心理如何提示过载？", "疾厄宫星曜是急性、慢性、空耗还是修复型？", "动态触发时是否需要调整节奏和生活结构？"],
    starReadingUsage: ["煞忌入疾厄要看压力、耗损和修复入口，吉辅入疾厄可看调理资源、缓冲和恢复条件。", "主星入疾厄要转换为身心承压方式，不直接当疾病名称。"],
    relationUsage: ["疾厄宫对宫为父母，常看身体承压与遗传背景、长辈关系、文书制度之间的牵动。", "三方关系可观察工作、家庭、精神状态对身心压力的影响。"],
    dynamicUsage: ["大限或流年疾厄被触发时，观察压力管理、作息、修复、健康检查和风险边界。", "流月流日触发时，多作为短期疲劳、压力和生活节奏提示。"],
    commonMisreads: ["不要用疾厄宫输出疾病诊断。", "煞忌入疾厄也不是必然严重问题，要看制化、吉曜和现实体检。", "命理提示不能替代医生意见。"],
    reportUsage: ["身心压力", "修复节奏", "风险提醒", "生活结构"]
  }),
  travel: palace({
    sectorName: "travel",
    aliases: ["迁移", "外出宫", "外部环境宫"],
    corePosition: "外部环境、迁动、出行和对外发展",
    nature: "迁移宫用于观察外部环境、出行迁动、社会场域、异地机会、对外发展和人在外界中的表现。它与命宫对照，是内外关系的重要轴线。",
    primaryQuestions: ["外部环境对本人是助力还是压力？", "出门、异地、迁动和对外发展如何展开？", "迁移宫是否能补命宫不足或放大命宫压力？", "动态触发时是否出现环境变化？"],
    starReadingUsage: ["天马、四马地、化禄、辅曜入迁移常看外部机会，煞忌入迁移要看奔波、风险和环境压力。", "主星入迁移代表人在外的表现方式和对外策略。"],
    relationUsage: ["迁移宫对宫为命宫，内在自我和外部环境必须合看。", "三方关系可观察外部机会如何影响财务、事业和关系。"],
    dynamicUsage: ["大限或流年迁移被触发时，观察出行、搬迁、换环境、对外合作、外地资源。", "流月流日触发时，多看短期出门、外部沟通、临场变化。"],
    commonMisreads: ["不要把迁移宫直接断为必然搬家或远行。", "迁移宫好坏不能脱离命宫承接。", "外部机会也可能带成本和风险。"],
    reportUsage: ["外部环境", "迁动出行", "社会场域", "异地机会"]
  }),
  friends: palace({
    sectorName: "friends",
    aliases: ["交友", "仆役宫", "奴仆宫", "团队宫"],
    corePosition: "朋友、团队、社群、下属和外部协作",
    nature: "交友宫用于观察朋友、团队、社群、下属、客户、协作者和外部人脉资源。它与兄弟宫不同，更偏社会化、组织化和外部协作网络。",
    primaryQuestions: ["外部人脉是助力、压力还是消耗？", "团队协作是否稳定？", "交友宫星曜显示怎样的社群环境？", "动态触发时是否出现团队、客户、下属或朋友议题？"],
    starReadingUsage: ["辅曜入交友看贵人和团队支持，煞忌入交友要看朋友压力、团队内耗、合作风险。", "桃花和人际星入交友时，要看社交曝光、人缘和边界。"],
    relationUsage: ["交友宫对宫为兄弟，常看近身同辈与外部团队之间的互相映照。", "三方关系可观察团队是否影响事业、财务和迁移机会。"],
    dynamicUsage: ["大限或流年交友被触发时，观察团队变化、人脉资源、合作对象、客户和社群关系。", "短周期触发时，多看聚会、协作、群体沟通和临时支持。"],
    commonMisreads: ["不要把交友宫只解释成朋友数量。", "交友宫有煞不等于无人可用，可能代表团队要求高或协作成本大。", "下属和客户也可纳入交友宫语境。"],
    reportUsage: ["社群关系", "团队协作", "外部人脉", "合作风险"]
  }),
  career: palace({
    sectorName: "career",
    aliases: ["官禄", "事业宫", "职务宫"],
    corePosition: "事业定位、职责、职业路径和公共表现",
    nature: "官禄宫用于观察事业方向、职务责任、职业能力、社会角色、公共表现和长期成就结构。它不是职业名称清单，而是事业运作方式。",
    primaryQuestions: ["适合用什么方式承担社会责任？", "事业发展靠专业、管理、资源、关系还是变化？", "官禄宫能否承接命宫主轴？", "动态触发时是否出现职务和方向变化？"],
    starReadingUsage: ["主星入官禄看事业主轴，辅曜看平台和贵人，煞忌看竞争压力、改革成本和风险。", "化权、化科、化禄入官禄要看责任、名誉和资源是否可承接。"],
    relationUsage: ["官禄宫对宫为夫妻，常看事业责任与亲密关系、一对一合作之间的互相影响。", "三方关系可观察事业如何连接命宫、财帛和迁移。"],
    dynamicUsage: ["大限或流年官禄被触发时，观察职位、职责、项目、考试、升迁、转型和公共表现。", "流月流日触发时，多看工作节点、会议、交付和评价。"],
    commonMisreads: ["不要把官禄宫单独断职业类别。", "事业好坏要看命宫、财帛、迁移和实际环境。", "煞曜在官禄可能是竞争力，也可能是压力，需看制化。"],
    reportUsage: ["事业定位", "职业路径", "责任结构", "公共表现"]
  }),
  property: palace({
    sectorName: "property",
    aliases: ["田宅", "家宅宫", "资产宫"],
    corePosition: "家庭根基、居住环境、不动产和长期承载",
    nature: "田宅宫用于观察家庭根基、居住环境、不动产、资产承载、家族资源、生活空间和安全感基础。它也可看长期存量和后方支撑。",
    primaryQuestions: ["家庭和居住环境如何影响本人？", "长期资产和存量资源是否稳定？", "田宅宫星曜是积累、变动、压力还是修复？", "动态触发时是否出现搬家、装修、家事或资产议题？"],
    starReadingUsage: ["天府、太阴、禄存等入田宅常看存量与承载，破军、七杀、煞忌入田宅要看变动、修缮和压力。", "空劫入田宅要看空间虚耗、期待落差或资源不实。"],
    relationUsage: ["田宅宫对宫为子女，常看家庭根基与子女、作品、创造延伸之间的承接。", "三方关系可观察家宅是否影响财务、福德和事业稳定。"],
    dynamicUsage: ["大限或流年田宅被触发时，观察居住、房产、家庭事务、装修、搬迁和长期资产。", "短周期触发时，多看家中安排、空间整理和家庭沟通。"],
    commonMisreads: ["不要用田宅宫直接断买房数量。", "田宅宫也代表安全感和长期承载，不只是房产。", "现实资产判断不能由命理替代财务和法律核验。"],
    reportUsage: ["家庭根基", "居住环境", "长期资产", "安全感"]
  }),
  fortune: palace({
    sectorName: "fortune",
    aliases: ["福德", "精神宫", "享受宫"],
    corePosition: "精神状态、内在满足、享受能力和长期福分",
    nature: "福德宫用于观察精神余裕、内在满足、休息方式、享受能力、潜意识状态、长期福分和面对压力时的内在缓冲。它是命宫之外的重要心理底盘。",
    primaryQuestions: ["这个人如何获得内在满足？", "精神状态是舒展、紧绷、空耗还是沉淀？", "福德宫能否缓冲命宫和事业压力？", "动态触发时是否出现休息、享受、心理和信念议题？"],
    starReadingUsage: ["天同、太阴、天梁、化科等入福德可看缓冲和涵养，煞忌空劫入福德要看内耗、焦虑、落空和修复需求。", "福德宫星曜不能直接替代心理诊断，只能提供状态观察。"],
    relationUsage: ["福德宫对宫为财帛，常看内在满足与现实资源、消费欲望之间的互相牵动。", "三方关系可观察精神状态如何影响命宫、夫妻和迁移。"],
    dynamicUsage: ["大限或流年福德被触发时，观察休息、信念、享受、心理压力、长期满足和精神修复。", "流月流日触发时，多看情绪、睡眠、兴趣和短期心境。"],
    commonMisreads: ["不要把福德宫单独断幸福或不幸福。", "福德差不等于人生无福，要看修复资源和现实结构。", "心理和医疗议题不能由命理直接诊断。"],
    reportUsage: ["精神状态", "内在满足", "休息修复", "长期福分"]
  }),
  parents: palace({
    sectorName: "parents",
    aliases: ["父母", "长辈宫", "文书宫", "相貌宫"],
    corePosition: "父母、长辈、背景支持、文书制度和上级关系",
    nature: "父母宫用于观察父母长辈、上级、背景资源、文书制度、证件契约、早年支持和外在形象的一部分。它也与疾厄宫对照，提示背景与承压的关系。",
    primaryQuestions: ["长辈和背景资源是支持、压力还是距离？", "文书制度、证照、上级关系是否顺畅？", "父母宫星曜如何影响早年支持和现实规范？", "动态触发时是否出现长辈、文书、制度或上级事务？"],
    starReadingUsage: ["辅曜、化科入父母常看文书、贵人、长辈支持和制度缓冲，煞忌入父母要看沟通压力、制度卡点或长辈牵挂。", "主星入父母要转换为背景、上级、规范和文书语境。"],
    relationUsage: ["父母宫对宫为疾厄，常看背景压力、长辈关系、制度要求与身心承压之间的关系。", "三方关系可观察父母宫如何影响事业、田宅和福德。"],
    dynamicUsage: ["大限或流年父母被触发时，观察父母长辈、上级、合同、文书、证件、制度流程。", "短周期触发时，多看文件、审批、沟通、长辈消息和上级反馈。"],
    commonMisreads: ["不要把父母宫只解释为父母本人。", "父母宫也可看文书制度、上级和背景资源。", "家庭关系结论必须谨慎，不能用单宫绝对化。"],
    reportUsage: ["长辈关系", "背景资源", "文书制度", "上级支持"]
  })
}

export function getPalaceContentDetail(
  sectorName: SectorName
): ZiweiPalaceContentDetail | null {
  return ZIWEI_PALACE_CONTENT_DETAILS[sectorName] ?? null
}

export function getAllPalaceContentDetails(): ZiweiPalaceContentDetail[] {
  return ZIWEI_PALACE_ORDER.map((sectorName) => {
    return ZIWEI_PALACE_CONTENT_DETAILS[sectorName]
  })
}

function palace(
  input: Omit<ZiweiPalaceContentDetail, "label" | "sections" | "sourceReferences">
): ZiweiPalaceContentDetail {
  const label = SECTOR_LABELS[input.sectorName]
  const sourceReferences = buildPalaceDictionarySourceReferences()

  return {
    ...input,
    label,
    sourceReferences,
    sections: buildPalaceSections({ ...input, label, sourceReferences })
  }
}

function buildPalaceSections(
  detail: Omit<ZiweiPalaceContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "宫位本体",
      items: [
        `${detail.label}的核心位置是${detail.corePosition}。${detail.nature}`,
        `别名和延伸称呼包括：${detail.aliases.join("、")}。`
      ]
    },
    {
      title: "核心问题",
      items: detail.primaryQuestions
    },
    {
      title: "星曜入宫读法",
      items: detail.starReadingUsage
    },
    {
      title: "宫位关系",
      items: detail.relationUsage
    },
    {
      title: "动态盘用法",
      items: detail.dynamicUsage
    },
    {
      title: "误读边界",
      items: detail.commonMisreads
    },
    {
      title: "报告用途",
      items: detail.reportUsage
    }
  ]
}

