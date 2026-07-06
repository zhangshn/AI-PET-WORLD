import type { SectorName, ZiweiStarId } from "../../contracts"
import { mainStarCatalog, MAIN_STAR_IDS } from "../../star-catalog"

import type {
  ZiweiContentDictionarySection,
  ZiweiMainStarPalaceCombinationContentDetail
} from "./content-detail-types"
import {
  getMainStarContentDetail,
  ZIWEI_MAIN_STAR_CONTENT_DETAILS
} from "./main-star-meaning-catalog"
import {
  getPalaceContentDetail,
  ZIWEI_PALACE_ORDER
} from "./palace-meaning-catalog"
import { buildStarPalaceCombinationSourceReferences } from "./content-source-reference-map"

export const ZIWEI_MAIN_STAR_IDS = Object.values(MAIN_STAR_IDS)

interface MainStarPalaceReadingProfile {
  palaceEntry: string
  stableUse: string
  unstableUse: string
  transformationUse: string
  relationUse: string
}

interface PalaceReadingProfile {
  domainSubjects: string[]
  palaceConversion: string
  samePalaceFocus: string
  oppositePalaceFocus: string
  trineSquareFocus: string
  transformationFocus: string
  dynamicFocus: string
  evidenceQuestions: string[]
}

const MAIN_STAR_PALACE_READING_PROFILES: Partial<
  Record<ZiweiStarId, MainStarPalaceReadingProfile>
> = {
  [MAIN_STAR_IDS.ziwei]: {
    palaceEntry: "紫微入宫先看定序、统筹、主轴和责任归属，它会把该宫主题组织成中心议题。",
    stableUse: "会辅弼、魁钺、昌曲、禄权科或庙旺时，较容易形成名位、统筹、制度资源和可被承认的主导力。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核自尊、权责不对称、名位压力、孤立和组织失灵。",
    transformationUse: "紫微受四化牵动时，要看权责、名誉、资源和牵挂是否落到该宫主题上，而不是只看星名贵气。",
    relationUse: "紫微在三方四正中常是组织中心，必须看辅佐是否到位；无辅而煞重时，中心感会变成独撑。"
  },
  [MAIN_STAR_IDS.tianji]: {
    palaceEntry: "天机入宫先看思考、变动、谋划、调整和机巧，它会让该宫主题带有计划与变化。",
    stableUse: "会昌曲、魁钺、左右、化科或庙旺时，利分析、策划、技术、学习、调度和弹性应对。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核多虑、反复、计划变更、机会错判和执行不稳。",
    transformationUse: "天机受四化牵动时，重点看思路、方案、交通、技术和协商如何被资源、权责、名誉或牵挂触发。",
    relationUse: "天机看三方四正时，要分清是策略支援还是变动压力；会煞多时，机动性可能变成不安定。"
  },
  [MAIN_STAR_IDS.taiyang]: {
    palaceEntry: "太阳入宫先看公开、照拂、行动、名声和外放承担，它会让该宫主题需要被看见和执行。",
    stableUse: "庙旺、会吉、会禄权科时，利公开表达、承担责任、外部支持、男性缘和正面曝光。",
    unstableUse: "落陷、遇忌煞空劫时，要复核过度付出、名声压力、外强内耗和支援不足。",
    transformationUse: "太阳受四化牵动时，要看公开责任、名誉、父系或男性象、外部行动在该宫被如何触发。",
    relationUse: "太阳在对宫和三方会照时，常把该宫议题带到外部场域；日光强弱和宫位时空要一并复核。"
  },
  [MAIN_STAR_IDS.wuqu]: {
    palaceEntry: "武曲入宫先看财务、执行、规则、决断和硬资源，它会让该宫主题更重结果和成本。",
    stableUse: "庙旺、会禄权、天府、禄存或辅曜时，利资源管理、专业执行、纪律、财务结构和可量化成果。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核刚硬、压力、损耗、孤决、资源卡点和关系冷化。",
    transformationUse: "武曲受四化牵动时，重点看钱财、权责、执行指标和现实交换如何落到该宫。",
    relationUse: "武曲看三方四正时，要看财官线和资源链是否成形；有煞不一定坏，但必须有制度承接。"
  },
  [MAIN_STAR_IDS.tiantong]: {
    palaceEntry: "天同入宫先看安适、缓和、享受、情绪和福气承接，它会让该宫主题带有舒缓需求。",
    stableUse: "会吉、化禄、化科或庙旺时，利和气、缓冲、生活感、福泽、照顾和关系修复。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核依赖、拖延、享乐过度、情绪逃避和承压不足。",
    transformationUse: "天同受四化牵动时，重点看安适、关系缓冲、享受欲望和情绪牵挂被如何触发。",
    relationUse: "天同在三方四正中需要看是否有执行星承接；只见安逸而无推动时，该宫容易软弱。"
  },
  [MAIN_STAR_IDS.lianzhen]: {
    palaceEntry: "廉贞入宫先看规范、界线、欲望、审美、制度和纠葛，它会让该宫主题带有辨别与约束。",
    stableUse: "会吉、化禄、化科或庙旺时，利规则意识、审美管理、人际分寸、制度处理和资源转化。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核纠缠、争议、欲望失控、名誉压力和关系边界混乱。",
    transformationUse: "廉贞受四化牵动时，重点看制度、人情、欲望和边界如何在该宫形成资源或牵挂。",
    relationUse: "廉贞看组合时要先分清是规范力量还是欲望牵引；会煞忌时尤其要查破格和代价。"
  },
  [MAIN_STAR_IDS.tianfu]: {
    palaceEntry: "天府入宫先看府库、承载、储蓄、管理和稳定资源，它会让该宫主题强调保守与积累。",
    stableUse: "会禄存、武曲、左右、魁钺或庙旺时，利存量、资产、管理、后勤、稳定和长期承接。",
    unstableUse: "遇空劫、煞忌或库空时，要复核资源虚置、保守迟滞、坐守不动和表面稳定。",
    transformationUse: "天府受四化牵动时，重点看库存、权责、资产、资源配置和长期承载被如何调动。",
    relationUse: "天府看三方四正时，要看是否有开创星和执行星配合；只有府库而无流通时，资源会滞住。"
  },
  [MAIN_STAR_IDS.taiyin]: {
    palaceEntry: "太阴入宫先看收藏、细腻、财库、照顾、情绪和阴性资源，它会让该宫主题偏向内在与积累。",
    stableUse: "庙旺、会禄科、昌曲、魁钺或吉曜时，利财库、细致经营、照顾、审美、文书和长期积累。",
    unstableUse: "落陷、遇忌煞空劫时，要复核情绪内耗、暗中消耗、财务不明、依赖和安全感不足。",
    transformationUse: "太阴受四化牵动时，重点看财库、女性象、情绪、照护和隐性资源如何被触发。",
    relationUse: "太阴在三方四正中要看阴晴和承接环境；得吉可成细水长流，遇煞忌则暗耗明显。"
  },
  [MAIN_STAR_IDS.tanlang]: {
    palaceEntry: "贪狼入宫先看欲望、社交、才艺、变化和资源流动，它会让该宫主题出现吸引与扩张。",
    stableUse: "会禄、火铃成格、昌曲、辅曜或条件得宜时，利才艺、人际、资源交换、开拓和多元尝试。",
    unstableUse: "遇忌煞、桃花过重、空劫或落陷时，要复核欲望分散、关系纠缠、资源混杂和过度追逐。",
    transformationUse: "贪狼受四化牵动时，重点看欲望、社交、才艺、消费和机会流动如何被放大或牵制。",
    relationUse: "贪狼看三方四正时，要分清扩张是否有承接；会吉可转资源，会煞忌易成诱因和反复。"
  },
  [MAIN_STAR_IDS.jumen]: {
    palaceEntry: "巨门入宫先看语言、疑问、遮蔽、辨析和是非，它会让该宫主题需要解释、沟通和澄清。",
    stableUse: "会化科、昌曲、魁钺或庙旺时，利表达、研究、谈判、调查、教学和问题拆解。",
    unstableUse: "遇化忌、煞曜、空劫或落陷时，要复核口舌、误会、隐情、争辩和信息不透明。",
    transformationUse: "巨门受四化牵动时，重点看话语权、疑问、文书、沟通和遮蔽问题如何被触发。",
    relationUse: "巨门在三方四正中会把问题说出来；得科吉可成辨析，遇忌煞易成是非和反复质疑。"
  },
  [MAIN_STAR_IDS.tianxiang]: {
    palaceEntry: "天相入宫先看辅佐、制度、协调、公平和形象，它会让该宫主题重视规则与承接。",
    stableUse: "会紫府、左右、魁钺、昌曲或吉化时，利制度协作、公共形象、协调、公信和资源承接。",
    unstableUse: "遇煞忌、刑耗或受夹不佳时，要复核两难、被动、制度压力、形象受损和夹制。",
    transformationUse: "天相受四化牵动时，重点看协调责任、制度位置、形象资源和承接关系如何变化。",
    relationUse: "天相非常重视夹宫和三方四正，左右环境好则能成相，环境失衡则容易被夹住。"
  },
  [MAIN_STAR_IDS.tianliang]: {
    palaceEntry: "天梁入宫先看荫庇、原则、长辈、保护、医药和解厄，它会让该宫主题带有照护与规劝。",
    stableUse: "庙旺、会吉、化科或长辈贵助时，利保护、声誉、解厄、原则、教学和长期照应。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核清高、拖延、长辈压力、原则冲突和保护失效。",
    transformationUse: "天梁受四化牵动时，重点看庇护、名誉、长辈、医疗修复和原则责任如何被触发。",
    relationUse: "天梁在三方四正中常作缓冲和修复星，遇煞忌时要看是否能解压或只是增加责任。"
  },
  [MAIN_STAR_IDS.qisha]: {
    palaceEntry: "七杀入宫先看决断、竞争、开创、压力和破旧立新，它会让该宫主题带有强行动力。",
    stableUse: "庙旺、会禄权、左右魁钺或有制化时，利突破、管理危机、执行、竞争和开创新局。",
    unstableUse: "遇煞忌、空劫或无制时，要复核冲动、孤决、风险、割裂、压力过重和破坏成本。",
    transformationUse: "七杀受四化牵动时，重点看权责、突破、竞争、风险和阶段转折如何落到该宫。",
    relationUse: "七杀看三方四正必须看制化和资源承接；能制则成开创，失制则成压力和断裂。"
  },
  [MAIN_STAR_IDS.pojun]: {
    palaceEntry: "破军入宫先看破旧、重组、消耗、变革和重新分配，它会让该宫主题带有拆解与更新。",
    stableUse: "会禄权、庙旺、有府库或辅曜承接时，利改革、更新、资源重配、技术拆解和突破旧局。",
    unstableUse: "遇煞忌、空劫或落陷时，要复核破耗、失序、反复拆建、关系破裂和资源流失。",
    transformationUse: "破军受四化牵动时，重点看破旧立新、消耗、权责转换和资源重分配如何发生。",
    relationUse: "破军看三方四正时，要看拆解之后是否能重建；只破不立时，该宫主题容易反复。"
  }
}

const PALACE_READING_PROFILES: Record<SectorName, PalaceReadingProfile> = {
  life: {
    domainSubjects: ["自我主轴", "决策方式", "命身承接", "长期底色"],
    palaceConversion: "要把星曜象义转成自我定位、判断习惯、行动入口和整盘承接能力。",
    samePalaceFocus: "同宫星曜会直接改变本人的表达方式，辅曜看支援，煞曜看压力入口，杂曜看细节气氛。",
    oppositePalaceFocus: "对宫迁移代表外部环境，命宫解释必须同时看外界反馈和人在外的表现。",
    trineSquareFocus: "三方四正重点看财帛、官禄等现实执行领域如何支撑命宫主轴。",
    transformationFocus: "四化入命或会命时，要看欲望、权责、名誉和牵挂是否直接落到本人主轴。",
    dynamicFocus: "动态命宫落此时，该时间层以本人状态、决策和阶段主轴为入口。",
    evidenceQuestions: ["主星是否能承接三方资源？", "身宫是否补命宫不足？", "命迁线是支援还是拉扯？"]
  },
  siblings: {
    domainSubjects: ["手足", "同辈", "近身协作", "横向支持"],
    palaceConversion: "要把星曜象义转成同辈互动、竞争互助、近身协作和横向资源。",
    samePalaceFocus: "同宫星曜看手足同辈的实际气氛，辅曜主支持，煞曜主摩擦，桃花杂曜主圈层变化。",
    oppositePalaceFocus: "对宫交友代表外部社群，兄弟宫要和团队、人脉、客户及朋友网络合看。",
    trineSquareFocus: "三方四正重点看同辈是否参与财务、事业、家庭或压力承接。",
    transformationFocus: "四化触发兄弟宫时，要看同辈、团队分工、利益往来和沟通牵挂。",
    dynamicFocus: "动态触发时，多应在合作、同学同事、手足事务和近距离沟通。",
    evidenceQuestions: ["同辈是助力还是竞争？", "是否有利益或沟通牵挂？", "团队资源是否回到命宫？"]
  },
  spouse: {
    domainSubjects: ["伴侣", "一对一合作", "契约关系", "亲密互动"],
    palaceConversion: "要把星曜象义转成伴侣类型、关系互动、承诺成本和一对一合作模式。",
    samePalaceFocus: "同宫星曜看关系中的直接表现，桃花看吸引，辅曜看协调，煞忌看冲突和修复课题。",
    oppositePalaceFocus: "对宫官禄代表事业责任，夫妻宫常受职业身份、责任分配和公共角色影响。",
    trineSquareFocus: "三方四正重点看福德、迁移、命宫等是否支持关系稳定和内在满足。",
    transformationFocus: "四化触发夫妻宫时，要看关系中的资源、权责、名誉和牵挂落点。",
    dynamicFocus: "动态触发时，常看伴侣、合作、合同、关系边界和阶段互动。",
    evidenceQuestions: ["关系吸引和压力各来自哪里？", "事业责任是否压到关系？", "福德能否承接关系情绪？"]
  },
  children: {
    domainSubjects: ["子女", "作品", "创造延伸", "照护对象"],
    palaceConversion: "要把星曜象义转成子女缘、作品产出、教学照护、下属和创造力外放。",
    samePalaceFocus: "同宫星曜看成果延伸的方式，辅曜看助力，煞忌看照护压力、作品反复和责任牵挂。",
    oppositePalaceFocus: "对宫田宅代表家庭根基，子女宫要和居住环境、长期承载及家族资源合看。",
    trineSquareFocus: "三方四正重点看成果能否变成资源、名声、项目和稳定结构。",
    transformationFocus: "四化触发子女宫时，要看作品、子女、下属或创作项目中的得失牵动。",
    dynamicFocus: "动态触发时，常看子女、创作、学生下属、成果交付和照护事务。",
    evidenceQuestions: ["该宫代表子女还是作品项目？", "成果能否被承接？", "照护责任是否过重？"]
  },
  wealth: {
    domainSubjects: ["收入", "现金流", "资源配置", "价值交换"],
    palaceConversion: "要把星曜象义转成赚钱方式、资源流动、消费习惯、现金流和价值交换。",
    samePalaceFocus: "同宫星曜看财务模式，禄存化禄看资源，煞忌空劫看成本、波动和风险控制。",
    oppositePalaceFocus: "对宫福德代表内在满足，财帛宫要看欲望、享受和资源使用是否平衡。",
    trineSquareFocus: "三方四正重点看命宫、官禄、迁移是否能把能力变成收入和资源。",
    transformationFocus: "四化触发财帛宫时，要看资源进入、权责支出、名誉换利和牵挂损耗。",
    dynamicFocus: "动态触发时，常看收入结构、付款、预算、合同、资源机会和财务压力。",
    evidenceQuestions: ["财源从哪里来？", "能否守成？", "消耗和机会是否同时出现？"]
  },
  health: {
    domainSubjects: ["身体状态", "压力承接", "隐患", "修复节奏"],
    palaceConversion: "要把星曜象义转成身心承压、生活习惯、疲劳来源、修复资源和风险提醒。",
    samePalaceFocus: "同宫星曜看压力形态，吉曜看调理缓冲，煞忌看过载、损耗和应复核处。",
    oppositePalaceFocus: "对宫父母代表背景制度和长辈牵动，疾厄宫要看外部规范如何形成压力。",
    trineSquareFocus: "三方四正重点看工作、家庭、精神状态和行动节奏是否共同加压。",
    transformationFocus: "四化触发疾厄宫时，要看压力、牵挂、修复资源和作息结构的变化。",
    dynamicFocus: "动态触发时，只作身心状态提醒和生活节奏复核，不输出医疗诊断。",
    evidenceQuestions: ["压力从哪条宫线进入？", "是否有修复资源？", "是否需要现实健康检查？"]
  },
  travel: {
    domainSubjects: ["外部环境", "迁动", "出行", "对外发展"],
    palaceConversion: "要把星曜象义转成外部场域、异地机会、出行迁动、对外策略和社会表现。",
    samePalaceFocus: "同宫星曜看人在外的表现，天马四马看动象，煞忌看奔波、风险和环境压力。",
    oppositePalaceFocus: "对宫命宫代表本人，迁移宫必须和自我主轴互相校验。",
    trineSquareFocus: "三方四正重点看外部机会如何连接事业、财务、关系和行动结果。",
    transformationFocus: "四化触发迁移宫时，要看外部资源、外界权责、名声曝光和出行牵挂。",
    dynamicFocus: "动态触发时，常看出行、搬迁、环境变化、外地资源和对外合作。",
    evidenceQuestions: ["外部环境是助力还是压力？", "动象是否有承接？", "命迁线是否一致？"]
  },
  friends: {
    domainSubjects: ["朋友", "团队", "社群", "外部协作"],
    palaceConversion: "要把星曜象义转成团队结构、人脉资源、客户下属、社群关系和协作风险。",
    samePalaceFocus: "同宫星曜看社群气氛，辅曜看团队支援，煞忌看内耗、背压和合作成本。",
    oppositePalaceFocus: "对宫兄弟代表近身同辈，交友宫要和外部团队及近身协作合看。",
    trineSquareFocus: "三方四正重点看人脉是否影响事业、财务、迁移和阶段机会。",
    transformationFocus: "四化触发交友宫时，要看朋友团队中的资源、权责、名誉和牵挂。",
    dynamicFocus: "动态触发时，常看合作对象、客户、团队变动、社群活动和外部支持。",
    evidenceQuestions: ["团队能否帮事？", "人脉是否带成本？", "朋友和同辈是否相互印证？"]
  },
  career: {
    domainSubjects: ["事业定位", "职责", "职业路径", "公共表现"],
    palaceConversion: "要把星曜象义转成职业方式、责任结构、项目角色、公共表现和长期成就。",
    samePalaceFocus: "同宫星曜看事业主轴，辅曜看平台和贵人，煞忌看竞争、转型和压力成本。",
    oppositePalaceFocus: "对宫夫妻代表一对一关系，官禄宫要看事业责任如何牵动伴侣与合作。",
    trineSquareFocus: "三方四正重点看命宫、财帛、迁移是否共同支撑事业落地。",
    transformationFocus: "四化触发官禄宫时，要看职务、权责、名誉、考核和事业牵挂。",
    dynamicFocus: "动态触发时，常看职位、项目、升迁、转型、考试、会议和交付。",
    evidenceQuestions: ["事业靠什么能力承接？", "财官线是否成形？", "责任是否压到关系？"]
  },
  property: {
    domainSubjects: ["家庭根基", "居住环境", "不动产", "长期承载"],
    palaceConversion: "要把星曜象义转成家宅、资产存量、生活空间、家族资源和安全感基础。",
    samePalaceFocus: "同宫星曜看长期承载，府库禄星看积累，破耗煞忌看修缮、搬动和压力。",
    oppositePalaceFocus: "对宫子女代表创造延伸，田宅宫要看家庭根基如何承接作品、子女和成果。",
    trineSquareFocus: "三方四正重点看家宅是否影响财务、福德、事业和长期稳定。",
    transformationFocus: "四化触发田宅宫时，要看房产、家事、长期资产和家庭责任的流向。",
    dynamicFocus: "动态触发时，常看搬家、装修、家中事务、不动产、长期资产和居住安排。",
    evidenceQuestions: ["根基是否稳定？", "资产是实还是虚？", "家庭事务是否牵动其他宫线？"]
  },
  fortune: {
    domainSubjects: ["精神状态", "内在满足", "享受能力", "长期福分"],
    palaceConversion: "要把星曜象义转成精神余裕、休息方式、享受能力、信念和内在缓冲。",
    samePalaceFocus: "同宫星曜看内在状态，吉曜看舒展和修复，煞忌空劫看内耗、焦虑和落空。",
    oppositePalaceFocus: "对宫财帛代表现实资源，福德宫要看欲望、消费和精神满足是否平衡。",
    trineSquareFocus: "三方四正重点看命宫、夫妻、迁移等外部压力如何影响内在稳定。",
    transformationFocus: "四化触发福德宫时，要看享受、信念、情绪、资源欲望和精神牵挂。",
    dynamicFocus: "动态触发时，常看休息、心理状态、兴趣、信念、睡眠和修复节奏。",
    evidenceQuestions: ["内在是否有余裕？", "财福是否互相拉扯？", "压力是否有修复路径？"]
  },
  parents: {
    domainSubjects: ["父母长辈", "背景支持", "文书制度", "上级关系"],
    palaceConversion: "要把星曜象义转成长辈、上级、背景资源、文书证照、制度流程和早年支持。",
    samePalaceFocus: "同宫星曜看背景与规范，辅曜化科看文书贵助，煞忌看制度卡点和长辈牵挂。",
    oppositePalaceFocus: "对宫疾厄代表承压方式，父母宫要看背景制度如何影响身心压力。",
    trineSquareFocus: "三方四正重点看长辈资源、文书制度、事业、田宅和福德的互相牵动。",
    transformationFocus: "四化触发父母宫时，要看上级、文件、长辈、制度责任和背景资源的变化。",
    dynamicFocus: "动态触发时，常看父母长辈、上级反馈、审批证件、合同文书和制度流程。",
    evidenceQuestions: ["背景是助力还是压力？", "文书制度是否顺畅？", "长辈议题是否转为身心压力？"]
  }
}

export const ZIWEI_MAIN_STAR_PALACE_COMBINATION_DETAILS: Record<
  string,
  ZiweiMainStarPalaceCombinationContentDetail
> = Object.fromEntries(
  ZIWEI_MAIN_STAR_IDS.flatMap((starId) => {
    return ZIWEI_PALACE_ORDER.map((sectorName) => {
      const detail = buildMainStarPalaceCombinationDetail(starId, sectorName)

      return [detail.combinationId, detail]
    })
  })
)

export function getMainStarPalaceCombinationContentDetail(
  starId: ZiweiStarId,
  sectorName: SectorName
): ZiweiMainStarPalaceCombinationContentDetail | null {
  return ZIWEI_MAIN_STAR_PALACE_COMBINATION_DETAILS[
    buildMainStarPalaceCombinationId(starId, sectorName)
  ] ?? null
}

export function getAllMainStarPalaceCombinationContentDetails(): ZiweiMainStarPalaceCombinationContentDetail[] {
  return ZIWEI_MAIN_STAR_IDS.flatMap((starId) => {
    return ZIWEI_PALACE_ORDER.map((sectorName) => {
      const detail = getMainStarPalaceCombinationContentDetail(starId, sectorName)

      if (!detail) {
        throw new Error(`Missing main star palace combination: ${starId} ${sectorName}`)
      }

      return detail
    })
  })
}

function buildMainStarPalaceCombinationDetail(
  starId: ZiweiStarId,
  sectorName: SectorName
): ZiweiMainStarPalaceCombinationContentDetail {
  const star = getMainStarContentDetail(starId)
  const palace = getPalaceContentDetail(sectorName)
  const starDefinition = mainStarCatalog.find((item) => item.starId === starId)

  if (!star || !palace || !starDefinition) {
    throw new Error(`Cannot build main star palace combination: ${starId} ${sectorName}`)
  }

  const combinationId = buildMainStarPalaceCombinationId(starId, sectorName)
  const sourceReferences = buildStarPalaceCombinationSourceReferences()
  const starProfile = getMainStarPalaceReadingProfile(starId)
  const palaceProfile = PALACE_READING_PROFILES[sectorName]
  const coreReading =
    `${star.label}入${palace.label}时，先把${star.label}的${star.coreThemes.join("、")}转入${palace.corePosition}。` +
    `${starProfile.palaceEntry}${palaceProfile.palaceConversion}` +
    `这一条资料只说明星曜入宫的通用读法，不直接等于当前盘结论；当前盘还要看同宫、对宫、三方四正、四化、庙旺落陷、格局和动态层级。`
  const analysisFocus = [
    `${star.palaceFocus}放在${palace.label}时，要先回答：${palace.primaryQuestions[0]}`,
    `${palace.label}的主题范围包括${palaceProfile.domainSubjects.join("、")}，解释时必须把${star.label}的象义落到这些具体议题。`,
    `看${star.label}的优势是否能服务${palace.label}：${star.strengths.join("、")}。`,
    `看${star.label}的风险是否会成为${palace.label}的压力：${star.risks.join("、")}。`,
    `${palaceProfile.samePalaceFocus}`,
    `${palaceProfile.oppositePalaceFocus}`,
    `${palaceProfile.trineSquareFocus}`,
    `把${palace.label}的核心问题逐条套回星曜、宫干、地支、四化、庙旺落陷和动态盘层。`
  ]
  const favorableSignals = [
    starProfile.stableUse,
    ...star.favorableSignals.map((signal) => `${star.label}入${palace.label}时，${signal}。`),
    `${palace.label}得到辅曜、禄权科、庙旺或三方吉会时，${star.label}较容易把${palace.corePosition}组织成可用资源。`,
    `若同宫星曜能补${star.label}不足，对宫不强烈冲击，三方四正又能形成支援，则此组合更容易转成稳定可用的宫位能力。`
  ]
  const riskSignals = [
    starProfile.unstableUse,
    ...star.unfavorableSignals.map((signal) => `${star.label}入${palace.label}时，${signal}。`),
    `${palace.label}遇煞忌、空劫、落陷或关系线冲击时，要复核${star.label}是否把该宫主题推向过度、卡顿、耗损或反复。`,
    `若同宫、对宫和三方同时出现压力信号，应先降低单星吉凶判断，改看该宫是否有修复资源和现实承接。`
  ]
  const relationUsage = [
    `${palace.relationUsage[0]}因此${star.label}入${palace.label}不能只看本宫，还要看对宫是否承接或反向牵制。`,
    `${palace.relationUsage[1]}若${star.label}所在宫的三方四正有禄权科或辅曜，组合层级上升；若有煞忌空劫，优先查破格和修复路径。`,
    `${starProfile.relationUse}`,
    `${palaceProfile.samePalaceFocus}`,
    `${palaceProfile.trineSquareFocus}`
  ]
  const dynamicUsage = [
    `${palace.dynamicUsage[0]}当动态命宫或重点宫位落到${palace.label}并见${star.label}时，这条组合成为该时间层的解释入口。`,
    `${palace.dynamicUsage[1]}短周期只作为事件气候和注意力提示，不上升为本命长期结论。`,
    `${starProfile.transformationUse}`,
    `${palaceProfile.dynamicFocus}`,
    `原盘见${star.label}入${palace.label}看长期底色；大限看十年阶段；流年看年度触发；流月、流日、流时只看短周期变化和临场提示。`
  ]
  const cautions = [
    `不要把“${star.label}入${palace.label}”直接写成单句断语，要先看同宫、对宫、三方四正、四化和庙旺。`,
    `${palaceProfile.transformationFocus}`,
    `${starProfile.transformationUse}`,
    ...palaceProfile.evidenceQuestions.map((question) => `当前盘复核问题：${question}`),
    ...star.readingNotes,
    ...palace.commonMisreads.slice(0, 2)
  ]

  return {
    combinationId,
    sourceReferences,
    starId,
    starLabel: star.label,
    sectorName,
    palaceLabel: palace.label,
    coreReading,
    analysisFocus,
    favorableSignals,
    riskSignals,
    relationUsage,
    dynamicUsage,
    cautions,
    sections: buildSections({
      starLabel: star.label,
      palaceLabel: palace.label,
      coreReading,
      analysisFocus,
      favorableSignals,
      riskSignals,
      relationUsage,
      dynamicUsage,
      cautions,
      starProfile,
      palaceProfile
    })
  }
}

function buildMainStarPalaceCombinationId(
  starId: ZiweiStarId,
  sectorName: SectorName
): string {
  return `main-star-palace.${starId}.${sectorName}`
}

function buildSections(input: {
  starLabel: string
  palaceLabel: string
  coreReading: string
  analysisFocus: string[]
  favorableSignals: string[]
  riskSignals: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  cautions: string[]
  starProfile: MainStarPalaceReadingProfile
  palaceProfile: PalaceReadingProfile
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "组合本体",
      items: [input.coreReading]
    },
    {
      title: "落宫转换",
      items: [
        `${input.starLabel}进入${input.palaceLabel}时，先保留星曜本体，再把本体转成${input.palaceProfile.domainSubjects.join("、")}这些宫位议题。`,
        input.palaceProfile.palaceConversion,
        input.starProfile.palaceEntry
      ]
    },
    {
      title: "分析重点",
      items: input.analysisFocus
    },
    {
      title: "有利信号",
      items: input.favorableSignals
    },
    {
      title: "风险信号",
      items: input.riskSignals
    },
    {
      title: "同宫与对宫",
      items: [
        input.palaceProfile.samePalaceFocus,
        input.palaceProfile.oppositePalaceFocus,
        `同宫看直接混合，对宫看对象、外部反馈和互相牵制；${input.starLabel}入${input.palaceLabel}不能只看本宫一句话。`
      ]
    },
    {
      title: "三方四正",
      items: [
        input.palaceProfile.trineSquareFocus,
        input.starProfile.relationUse,
        `三方四正用于判断${input.palaceLabel}是否有结构支援、结构压力、成格条件或破格条件。`
      ]
    },
    {
      title: "四化与庙旺",
      items: [
        input.starProfile.transformationUse,
        input.palaceProfile.transformationFocus,
        `庙旺落陷只修正${input.starLabel}在${input.palaceLabel}的发挥顺逆，不能脱离同宫、对宫和三方四正单独定吉凶。`
      ]
    },
    {
      title: "宫位关系",
      items: input.relationUsage
    },
    {
      title: "动态盘层级",
      items: input.dynamicUsage
    },
    {
      title: "当前盘证据",
      items: input.palaceProfile.evidenceQuestions.map((question) => {
        return `当前盘解释${input.starLabel}入${input.palaceLabel}时需要复核：${question}`
      })
    },
    {
      title: "误读边界",
      items: input.cautions
    }
  ]
}

export function isMainStarId(starId: ZiweiStarId): boolean {
  return Object.prototype.hasOwnProperty.call(ZIWEI_MAIN_STAR_CONTENT_DETAILS, starId)
}

function getMainStarPalaceReadingProfile(
  starId: ZiweiStarId
): MainStarPalaceReadingProfile {
  const profile = MAIN_STAR_PALACE_READING_PROFILES[starId]

  if (!profile) {
    throw new Error(`Missing main star palace reading profile: ${starId}`)
  }

  return profile
}
