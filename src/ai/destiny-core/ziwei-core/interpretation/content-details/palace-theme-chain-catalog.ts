import type { SectorName } from "../../contracts"
import { SECTOR_LABELS } from "../../page-view/labels"

import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainContentDetail
} from "./content-detail-types"
import { buildPalaceThemeChainSourceReferences } from "./content-source-reference-map"
import { ZIWEI_PALACE_ORDER } from "./palace-meaning-catalog"

type PalaceThemeChainInput = Omit<
  ZiweiPalaceThemeChainContentDetail,
  "label" | "sourceReferences" | "supportingPalaces" | "sections"
> & {
  label?: string
}

const CORE_EVIDENCE_FIELDS = [
  "chartLayer",
  "primaryPalace",
  "supportingPalaces",
  "branch",
  "mainStars",
  "assistantStars",
  "maleficStars",
  "miscStars",
  "transformations",
  "brightness",
  "trineSquarePalaces",
  "oppositePalace",
  "sourceRuleIds"
]

export const ZIWEI_PALACE_THEME_CHAIN_DETAILS: ZiweiPalaceThemeChainContentDetail[] =
  [
    chain({
      chainId: "self-career-resource",
      category: "self",
      palaceSequence: ["life", "wealth", "career", "travel"],
      primaryPalace: "life",
      coreQuestion: "命主的自我主轴如何落到资源、事业和外部发展。",
      chainReading:
        "命宫先定命盘主轴与承接方式，财帛观察资源流入和价值交换，官禄观察责任与事业路径，迁移观察外界机会、环境压力和对外表达。",
      palaceRoles: [
        "命宫是主题入口，确认主星骨架、身宫承接和本命底色。",
        "财帛宫说明资源从何而来、如何花用、是否能支持命宫主轴。",
        "官禄宫说明能力被社会角色接住的方式，判断事业是否成体系。",
        "迁移宫说明外部环境是助力、牵引、放大压力还是提供新场域。"
      ],
      starUsage: [
        "命宫主星负责定调，财帛和官禄的主星负责把命盘主轴转成现实承接。",
        "辅曜在四宫内会照时看资源、平台、贵人和学习补强。",
        "煞曜集中在财官迁时，优先复核压力来源、行动成本和破格风险。",
        "空劫在链条中出现时，不直接断弱，要复核资源虚实、承接落差和替代路径。"
      ],
      transformationUsage: [
        "化禄看资源流入点，重点确认落在命、财、官、迁哪一端。",
        "化权看责任和控制点，落官禄或迁移时常牵动阶段压力。",
        "化科看名誉、规范和可见度，可作为事业链条的缓冲证据。",
        "化忌看牵挂和反复点，必须回到对应宫位角色判断，不跨层写死结论。"
      ],
      dynamicUsage: [
        "本命层看长期结构，大限层看十年主轴是否启动该链条。",
        "流年切入时保留大限背景，再看年度命宫与四化是否落入链条。",
        "流月、流日、流时只作为短周期触发，不替代本命和大限判断。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "bodyPalace", "careerPatternHits"],
      reviewQuestions: [
        "命宫主轴是否能被财帛和官禄承接。",
        "迁移宫带来的是外界机会还是外界压力。",
        "四化的来源盘层是否清楚。",
        "煞忌是否已经复核制化和补救资源。"
      ],
      cautions: [
        "不要用单一命宫推完整事业结论。",
        "不要把财帛宫直接等同资产总量。",
        "动态盘触发不能覆盖本命底盘。"
      ]
    }),
    chain({
      chainId: "career-resource-support",
      category: "career",
      palaceSequence: ["career", "wealth", "friends", "travel"],
      primaryPalace: "career",
      coreQuestion: "事业如何依赖收入模型、团队协作和外部场域。",
      chainReading:
        "官禄定职业责任和社会角色，财帛看报酬与资源交换，交友看团队客户和协作者，迁移看外部市场与发展空间。",
      palaceRoles: [
        "官禄宫是事业问题主宫，先看主星、四化和格局命中。",
        "财帛宫说明事业成果能否变成稳定资源。",
        "交友宫说明团队、客户、下属和合作网络是否可用。",
        "迁移宫说明外部环境、异地机会和公开场域的支持度。"
      ],
      starUsage: [
        "官禄主星看职业形态，财帛主星看变现方式。",
        "交友宫辅曜多时，事业往往依赖协作、平台和人脉。",
        "迁移见动星或马星时，要看外部流动是否带来机会。",
        "煞忌冲官禄时，必须回看财帛和交友是否有承压能力。"
      ],
      transformationUsage: [
        "官禄化禄看事业资源，化权看职位责任，化科看名声证照，化忌看责任牵挂。",
        "财帛四化用于复核收入模型和成本结构。",
        "交友四化用于复核团队、客户和合作者的利弊。",
        "迁移四化用于确认外部场域的机会、曝光或奔波代价。"
      ],
      dynamicUsage: [
        "大限官禄或大限命宫落入该链条时，十年事业主题增强。",
        "流年官禄、流年财帛、流年迁移触发时，年度职业议题明显。",
        "短周期触发主要用于项目节点、会议、签约、交付和公开表现。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "careerPalace", "teamSignals"],
      reviewQuestions: [
        "事业责任是否有资源回收机制。",
        "团队和客户是助力还是消耗。",
        "外部场域是否扩大事业机会。",
        "格局命中是否被煞忌破坏。"
      ],
      cautions: [
        "不要把官禄宫直接翻译成固定职业名称。",
        "不要忽略交友宫对事业链条的影响。",
        "收入变化必须区分长期模型和短期事件。"
      ]
    }),
    chain({
      chainId: "relationship-intimacy",
      category: "relationship",
      palaceSequence: ["spouse", "fortune", "life", "travel"],
      primaryPalace: "spouse",
      coreQuestion: "亲密关系如何牵动内在满足、自我表达和外部互动。",
      chainReading:
        "夫妻宫看关系模式，福德看内在满足与情绪余裕，命宫看自我承接，迁移看外界情境和对象反馈。",
      palaceRoles: [
        "夫妻宫是伴侣、契约和一对一合作的主宫。",
        "福德宫说明关系中的精神需求、享受能力和内在缓冲。",
        "命宫说明本人如何回应关系压力或关系支持。",
        "迁移宫说明外部环境、距离、公开互动和对象镜像。"
      ],
      starUsage: [
        "夫妻主星看关系风格和对象气质，不直接断婚恋结果。",
        "福德吉曜能提供情绪缓冲，煞忌则提示消耗和修复需求。",
        "命宫星曜决定关系议题是否被本人接住。",
        "迁移星曜用于观察外界条件、距离和社会场域影响。"
      ],
      transformationUsage: [
        "夫妻化禄看关系吸引和资源互惠，化权看主导和责任。",
        "夫妻化科看关系名分、沟通修复和外界认可。",
        "夫妻化忌看牵挂、反复、投射和需要复核的卡点。",
        "福德四化用于判断关系是否消耗精神余裕。"
      ],
      dynamicUsage: [
        "大限夫妻触发时，十年关系主题加强，但仍需本命夫妻底盘复核。",
        "流年夫妻触发时，年度关系、合作和契约议题上升。",
        "流月以下只看沟通、约定、短期情绪和具体互动。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "relationshipSignals", "fortuneBuffer"],
      reviewQuestions: [
        "夫妻宫主轴是否被福德宫缓冲。",
        "命宫能否承接关系变化。",
        "迁移宫显示的是外界支持还是距离压力。",
        "四化是否来自当前选择的盘层。"
      ],
      cautions: [
        "不要用夫妻宫单宫判断婚姻成败。",
        "不要把桃花星直接等同感情好坏。",
        "关系结论必须避免恐吓式表达。"
      ]
    }),
    chain({
      chainId: "family-root",
      category: "family",
      palaceSequence: ["property", "parents", "fortune", "life"],
      primaryPalace: "property",
      coreQuestion: "家庭根基、长辈背景、精神安全感如何支撑命主。",
      chainReading:
        "田宅看家庭空间和长期承载，父母看长辈背景与制度文书，福德看安全感和精神底色，命宫看本人如何承接。",
      palaceRoles: [
        "田宅宫是家庭根基、居住环境和长期资产主宫。",
        "父母宫说明长辈、上级、文书制度和背景资源。",
        "福德宫说明家庭议题对精神状态和安全感的影响。",
        "命宫说明本人是否能从根基中获得支撑或需要独立修复。"
      ],
      starUsage: [
        "田宅主星看居住与资产承载方式。",
        "父母辅曜多时，常有文书、制度或长辈支持。",
        "福德煞忌多时，家庭议题可能转成内耗。",
        "命宫强弱用于判断是否能主动整理家庭结构。"
      ],
      transformationUsage: [
        "田宅化禄看空间、资产和家庭资源流入。",
        "田宅化权看家庭责任、产权压力或空间主导权。",
        "父母化科看文书、手续、证照和制度缓冲。",
        "福德化忌要看家庭议题是否形成长期心结。"
      ],
      dynamicUsage: [
        "大限田宅触发时，常看居住、房产、家庭责任和根基重整。",
        "流年田宅或父母触发时，看年度搬迁、装修、文书和长辈事务。",
        "短周期只作家庭沟通、文书节点和空间安排提示。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "homeSignals", "documentSignals"],
      reviewQuestions: [
        "家庭空间是支撑还是压力。",
        "长辈和制度资源是否可用。",
        "福德宫能否缓冲家庭议题。",
        "田宅四化是否落在当前盘层。"
      ],
      cautions: [
        "不要用田宅宫直接断房产数量。",
        "家庭关系不能由单宫绝对化。",
        "资产和产权问题不能替代现实法律核验。"
      ]
    }),
    chain({
      chainId: "health-mind-body",
      category: "health",
      palaceSequence: ["health", "fortune", "life", "parents"],
      primaryPalace: "health",
      coreQuestion: "身心承压、修复能力和背景压力如何形成链条。",
      chainReading:
        "疾厄看身心承压与修复入口，福德看精神余裕，命宫看个人承接，父母看背景制度、遗传语境和长辈压力。",
      palaceRoles: [
        "疾厄宫是压力、损耗、修复节律和风险提醒主宫。",
        "福德宫说明精神缓冲、休息能力和心理余裕。",
        "命宫说明本人面对压力时的行动方式。",
        "父母宫说明制度、长辈、背景和文书压力对身心的牵动。"
      ],
      starUsage: [
        "疾厄煞忌用于提示承压和修复入口，不输出医学诊断。",
        "福德吉曜可视作精神缓冲和调理资源。",
        "命宫强主星有助主动管理节奏。",
        "父母宫煞忌可能提示制度、长辈或背景压力。"
      ],
      transformationUsage: [
        "疾厄化忌看压力反复和身体信号，需要回到现实检查。",
        "疾厄化科看调理、规范、医生建议和恢复秩序。",
        "福德化禄看休息和愉悦资源。",
        "父母四化看制度、文书、长辈因素是否牵动压力。"
      ],
      dynamicUsage: [
        "大限疾厄触发时，十年要关注生活节奏和压力管理。",
        "流年疾厄触发时，看年度健康检查、作息和风险边界。",
        "流月以下只作短期疲劳、情绪和日程压力提示。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "stressSignals", "recoverySignals"],
      reviewQuestions: [
        "压力来源来自身体、工作、家庭还是制度。",
        "福德是否提供修复缓冲。",
        "命宫是否能主动调整节奏。",
        "是否避免了医学诊断式断语。"
      ],
      cautions: [
        "命理资料不能替代医生诊断。",
        "疾厄宫不能直接输出疾病名称。",
        "短周期触发不能长期化。"
      ]
    }),
    chain({
      chainId: "wealth-flow",
      category: "wealth",
      palaceSequence: ["wealth", "property", "fortune", "career"],
      primaryPalace: "wealth",
      coreQuestion: "收入、存量资产、消费欲望和事业责任如何相互牵动。",
      chainReading:
        "财帛看现金流和价值交换，田宅看长期存量，福德看消费欲望和享受能力，官禄看资源来自何种责任结构。",
      palaceRoles: [
        "财帛宫是收入模式、收支节奏和现实资源主宫。",
        "田宅宫说明资源是否沉淀成空间、资产或长期安全感。",
        "福德宫说明消费欲望、享受能力和精神满足。",
        "官禄宫说明资源背后的事业责任和职业结构。"
      ],
      starUsage: [
        "财帛主星看赚钱方式和资源处理风格。",
        "田宅吉曜说明沉淀能力，煞忌说明资产压力或变动。",
        "福德桃花或享乐星曜要看消费和满足感。",
        "官禄星曜确认资源是否来自职业、职位或项目。"
      ],
      transformationUsage: [
        "财帛化禄看进项，化权看资金主导权，化科看合规与名誉收益，化忌看现金流牵挂。",
        "田宅四化用于判断资源沉淀或空间责任。",
        "福德四化用于判断欲望和消费牵动。",
        "官禄四化用于复核事业回报来源。"
      ],
      dynamicUsage: [
        "大限财帛触发时，看十年资源模型是否改变。",
        "流年财帛触发时，看年度收支、合同、预算和投资边界。",
        "流月、流日、流时只看短期账务、支付和资源调配。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "incomeSignals", "assetSignals"],
      reviewQuestions: [
        "收入是否能沉淀成长期资产。",
        "消费和精神满足是否反过来消耗资源。",
        "事业责任是否支撑财务结构。",
        "财务判断是否保留风险边界。"
      ],
      cautions: [
        "不输出投资建议或收益承诺。",
        "不要用财帛单宫断富贵贫穷。",
        "资产结论要区分命理提示和现实财务核验。"
      ]
    }),
    chain({
      chainId: "children-creation",
      category: "relationship",
      palaceSequence: ["children", "spouse", "fortune", "life"],
      primaryPalace: "children",
      coreQuestion: "子女、作品、创造延伸如何连接关系和内在满足。",
      chainReading:
        "子女看创造延伸和照护对象，夫妻看一对一关系，福德看精神投入，命宫看本人承接与责任边界。",
      palaceRoles: [
        "子女宫是子女、作品、学生、下属和创造延伸主宫。",
        "夫妻宫说明创造或照护议题对伴侣和合作关系的影响。",
        "福德宫说明投入是否带来满足或消耗。",
        "命宫说明本人如何承担照护、教学、创作或管理责任。"
      ],
      starUsage: [
        "子女主星看创造风格和照护方式。",
        "夫妻星曜用于复核一对一关系中的协作和分工。",
        "福德吉曜看愉悦感和精神收益。",
        "煞忌在子女或福德时要看责任、反复和修复机制。"
      ],
      transformationUsage: [
        "子女化禄看成果和延伸，化权看管理和照护责任。",
        "子女化科看教学、评价和作品名声。",
        "子女化忌看牵挂、返工和照护压力。",
        "夫妻四化用于复核共同承担或关系摩擦。"
      ],
      dynamicUsage: [
        "大限子女触发时，看十年创作、子女、学生、团队延伸。",
        "流年子女触发时，看年度产出、照护和成果反馈。",
        "短周期触发主要看交付、陪伴、作品节点和临时照护。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "creationSignals", "careSignals"],
      reviewQuestions: [
        "子女宫主题是亲子、作品、学生还是下属。",
        "夫妻宫是否参与责任分工。",
        "福德宫是否能支持长期投入。",
        "是否避免把子女宫只解释为生育数量。"
      ],
      cautions: [
        "不直接断生育数量或医学结果。",
        "照护关系要避免绝对化评价。",
        "作品和子女语境需要按现实资料区分。"
      ]
    }),
    chain({
      chainId: "siblings-peer",
      category: "social",
      palaceSequence: ["siblings", "friends", "travel", "career"],
      primaryPalace: "siblings",
      coreQuestion: "同辈、朋友、团队和外部场域如何影响事业执行。",
      chainReading:
        "兄弟看近身同辈和横向协作，交友看外部团队与客户，迁移看外部场景，官禄看最终事业承接。",
      palaceRoles: [
        "兄弟宫说明手足、同学、同事和近身协作。",
        "交友宫说明团队、客户、社群、下属和外部人脉。",
        "迁移宫说明协作发生的外部场域和流动性。",
        "官禄宫说明协作是否能落成责任、项目和成果。"
      ],
      starUsage: [
        "兄弟辅曜看近身支持，煞忌看同辈竞争和沟通成本。",
        "交友星曜看组织化协作和客户质量。",
        "迁移动星看跨地域、跨圈层和对外发展。",
        "官禄星曜判断协作最终是否转为事业成果。"
      ],
      transformationUsage: [
        "兄弟化忌看同辈牵挂和沟通反复。",
        "交友化禄看人脉资源，化权看团队控制，化忌看团队消耗。",
        "迁移四化看外部场域机会和压力。",
        "官禄四化看协作成果是否被职责接住。"
      ],
      dynamicUsage: [
        "大限兄弟或交友触发时，十年协作网络变化明显。",
        "流年触发时，看年度合作、团队、客户和社群事件。",
        "短周期触发用于会议、协同、沟通和临时人际事件。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "peerSignals", "networkSignals"],
      reviewQuestions: [
        "协作是近身同辈还是外部团队。",
        "外部场域是否放大协作机会。",
        "官禄是否能承接团队成果。",
        "煞忌是否形成沟通或利益冲突。"
      ],
      cautions: [
        "不要把兄弟宫只当亲生手足。",
        "交友宫不是朋友数量清单。",
        "合作风险要结合财帛和官禄复核。"
      ]
    }),
    chain({
      chainId: "external-development",
      category: "career",
      palaceSequence: ["travel", "career", "wealth", "life"],
      primaryPalace: "travel",
      coreQuestion: "外部环境、事业责任、资源回收和自我主轴如何互相牵动。",
      chainReading:
        "迁移看外界机会和压力，官禄看外界如何转为事业，财帛看资源回收，命宫看本人是否能承接变化。",
      palaceRoles: [
        "迁移宫是外部环境、异地、公开场域和流动机会主宫。",
        "官禄宫说明外界机会是否能落成职业责任。",
        "财帛宫说明外部发展是否带来资源回收。",
        "命宫说明本人是否适应外界节奏。"
      ],
      starUsage: [
        "迁移动星、马星、化禄常提示外部机会和流动。",
        "官禄主星判断机会能否制度化、职业化。",
        "财帛星曜判断外部发展是否有稳定收益。",
        "命宫煞忌多时要看本人承压和节奏管理。"
      ],
      transformationUsage: [
        "迁移化禄看外部机会，化权看外部责任，化科看外部名声，化忌看奔波牵挂。",
        "官禄四化复核职业化程度。",
        "财帛四化复核收益与成本。",
        "命宫四化复核本人是否被外界事件牵动。"
      ],
      dynamicUsage: [
        "大限迁移触发时，十年常见外部环境变化或对外发展主轴。",
        "流年迁移触发时，看出行、换环境、公开曝光和外部合作。",
        "短周期触发只看临时移动、会面和外部沟通。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "externalSignals", "mobilitySignals"],
      reviewQuestions: [
        "外部环境是机会还是压力。",
        "官禄是否能把外部机会转成事业。",
        "财帛是否能形成回收。",
        "命宫是否能适应外界变化。"
      ],
      cautions: [
        "迁移宫不等于一定搬迁。",
        "外部机会也可能带来成本。",
        "不要脱离命宫承接判断外界好坏。"
      ]
    }),
    chain({
      chainId: "social-network",
      category: "social",
      palaceSequence: ["friends", "career", "travel", "wealth"],
      primaryPalace: "friends",
      coreQuestion: "朋友团队、事业平台、外部场域和资源交换如何形成网络。",
      chainReading:
        "交友看人脉与团队，官禄看平台责任，迁移看外界场景，财帛看合作能否形成资源。",
      palaceRoles: [
        "交友宫是朋友、团队、客户和外部协作者主宫。",
        "官禄宫说明网络是否进入正式职责和事业平台。",
        "迁移宫说明网络所处的外部场域和曝光程度。",
        "财帛宫说明合作是否能变成资源交换。"
      ],
      starUsage: [
        "交友辅曜看贵人和协作，煞忌看团队消耗。",
        "官禄主星判断网络是否服务事业目标。",
        "迁移星曜判断圈层是否跨地域或跨领域。",
        "财帛星曜判断合作收益和成本。"
      ],
      transformationUsage: [
        "交友化禄看人脉资源，化权看团队控制，化科看声誉互助，化忌看人情牵挂。",
        "官禄四化确认团队与事业责任的关系。",
        "迁移四化看外界圈层机会。",
        "财帛四化看合作分润和费用压力。"
      ],
      dynamicUsage: [
        "大限交友触发时，十年人脉和团队结构变化明显。",
        "流年交友触发时，年度团队、客户和社群议题上升。",
        "短周期触发用于聚会、会谈、客户沟通和协作节点。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "teamSignals", "clientSignals"],
      reviewQuestions: [
        "交友宫的人脉是资源还是消耗。",
        "官禄是否能承接团队力量。",
        "迁移是否提供外部曝光。",
        "财帛是否能平衡合作成本。"
      ],
      cautions: [
        "不要把交友宫简化为朋友多寡。",
        "团队支持和利益绑定要分开看。",
        "人脉结论要保留盘层和证据。"
      ]
    }),
    chain({
      chainId: "parents-documents",
      category: "family",
      palaceSequence: ["parents", "career", "property", "life"],
      primaryPalace: "parents",
      coreQuestion: "长辈、文书制度、事业责任和家庭根基如何牵动本人。",
      chainReading:
        "父母看长辈、文书、制度和背景，官禄看规则如何进入事业责任，田宅看家庭根基，命宫看本人承接。",
      palaceRoles: [
        "父母宫是长辈、上级、文书和制度主宫。",
        "官禄宫说明制度要求如何变成职业责任。",
        "田宅宫说明长辈和制度是否牵动家庭资产或空间。",
        "命宫说明本人是否能吸收背景资源或处理压力。"
      ],
      starUsage: [
        "父母辅曜多时，看文书、长辈和上级支持。",
        "父母煞忌多时，看手续、沟通和制度卡点。",
        "官禄星曜判断制度压力是否转成事业责任。",
        "田宅星曜判断家庭根基和资产承载。"
      ],
      transformationUsage: [
        "父母化科看文书、证照、审批和规范缓冲。",
        "父母化忌看长辈牵挂、手续反复和制度压力。",
        "官禄化权看职位责任，田宅化权看家庭资产责任。",
        "命宫四化用于判断本人被牵动的程度。"
      ],
      dynamicUsage: [
        "大限父母触发时，十年长辈、制度、文书和上级议题增强。",
        "流年父母触发时，看年度证照、合同、审批、长辈事务。",
        "短周期触发用于文件、沟通、手续和消息。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "documentSignals", "elderSignals"],
      reviewQuestions: [
        "父母宫主题是长辈、上级还是文书制度。",
        "官禄是否承接制度责任。",
        "田宅是否被家庭事务牵动。",
        "是否避免把父母宫只解释为父母本人。"
      ],
      cautions: [
        "父母宫不能只看亲缘。",
        "文书制度问题要保留现实核验。",
        "家庭资产不由命理直接定论。"
      ]
    }),
    chain({
      chainId: "estate-security",
      category: "wealth",
      palaceSequence: ["property", "wealth", "parents", "fortune"],
      primaryPalace: "property",
      coreQuestion: "资产、现金流、背景资源和安全感如何形成稳定结构。",
      chainReading:
        "田宅看长期资产和居住承载，财帛看现金流，父母看背景与文书，福德看安全感和精神满足。",
      palaceRoles: [
        "田宅宫是长期资产、居住和根基主宫。",
        "财帛宫说明资产维护所需现金流。",
        "父母宫说明文书、长辈、制度和产权语境。",
        "福德宫说明安全感和长期精神承载。"
      ],
      starUsage: [
        "田宅吉曜看沉淀和稳定，煞忌看维修、变动和责任。",
        "财帛星曜看资产成本与现金流。",
        "父母星曜看证件、合同、产权和上级制度。",
        "福德星曜看资产是否带来安心或牵挂。"
      ],
      transformationUsage: [
        "田宅化禄看资产资源，化权看主导权和责任。",
        "财帛化忌看现金流压力。",
        "父母化科看文书顺畅，化忌看手续反复。",
        "福德四化复核安全感和内在负担。"
      ],
      dynamicUsage: [
        "大限田宅触发时，长期资产、居住和家庭根基成为主题。",
        "流年田宅触发时，看年度搬迁、装修、置业、手续。",
        "短周期触发用于具体家务、付款、文件和沟通节点。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "assetSignals", "securitySignals"],
      reviewQuestions: [
        "田宅是否有稳定承载。",
        "财帛是否能支持资产维护。",
        "父母宫文书是否顺畅。",
        "福德是否得到安全感。"
      ],
      cautions: [
        "不输出买卖房建议。",
        "产权和合同必须现实核验。",
        "田宅好坏不能脱离财帛承接。"
      ]
    }),
    chain({
      chainId: "mental-fortune",
      category: "health",
      palaceSequence: ["fortune", "life", "health", "travel"],
      primaryPalace: "fortune",
      coreQuestion: "精神余裕、自我承接、身心压力和外部环境如何互相影响。",
      chainReading:
        "福德看精神底盘，命宫看自我承接，疾厄看压力进入身体和生活节奏，迁移看外界刺激和环境变化。",
      palaceRoles: [
        "福德宫是精神状态、享受能力和内在余裕主宫。",
        "命宫说明本人如何处理心境和选择。",
        "疾厄宫说明压力如何进入身体和作息。",
        "迁移宫说明外界环境对情绪和节奏的影响。"
      ],
      starUsage: [
        "福德吉曜看滋养、兴趣和精神缓冲。",
        "福德煞忌看焦虑、空耗和修复需求。",
        "疾厄煞忌提示压力入口，不做医学诊断。",
        "迁移星曜看环境是否帮助转换状态。"
      ],
      transformationUsage: [
        "福德化禄看享受和精神补给。",
        "福德化忌看心结、反复和内耗。",
        "疾厄化科看调理秩序，化忌看压力信号。",
        "迁移四化看换环境是否有帮助或增加奔波。"
      ],
      dynamicUsage: [
        "大限福德触发时，十年精神状态、休息方式和内在满足成为主轴。",
        "流年福德触发时，看年度心境、兴趣、休养和精神压力。",
        "短周期触发只提示情绪、睡眠、兴趣和临时状态。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "mentalSignals", "recoverySignals"],
      reviewQuestions: [
        "福德是滋养还是内耗。",
        "命宫是否能主动调整状态。",
        "疾厄是否显示压力转身体。",
        "迁移是否提供环境转换。"
      ],
      cautions: [
        "不做心理或医学诊断。",
        "精神状态不能只由福德单宫决定。",
        "短期情绪触发不能长期化。"
      ]
    }),
    chain({
      chainId: "risk-repair",
      category: "health",
      palaceSequence: ["health", "wealth", "career", "fortune"],
      primaryPalace: "health",
      coreQuestion: "风险、修复成本、工作责任和精神缓冲如何闭合。",
      chainReading:
        "疾厄看风险和修复入口，财帛看成本和资源调配，官禄看工作责任，福德看精神缓冲。",
      palaceRoles: [
        "疾厄宫是风险提醒、承压和修复主宫。",
        "财帛宫说明修复和风险管理的资源成本。",
        "官禄宫说明工作责任是否是压力来源。",
        "福德宫说明恢复和心理缓冲条件。"
      ],
      starUsage: [
        "疾厄煞曜提示风险入口和需要管理的压力。",
        "财帛星曜看成本、预算和资源。",
        "官禄星曜看责任、项目和工作负荷。",
        "福德吉曜看缓冲，福德煞忌看内耗。"
      ],
      transformationUsage: [
        "疾厄化忌看反复压力，化科看秩序修复。",
        "财帛化忌看成本牵挂，化禄看资源支持。",
        "官禄化权看责任加重，化忌看工作卡点。",
        "福德化禄或化科可作为修复资源。"
      ],
      dynamicUsage: [
        "大限疾厄或官禄触发时，长期压力管理和工作节奏需要复核。",
        "流年触发时，看年度体检、项目压力、费用和休息安排。",
        "短周期触发只看临时疲劳、开支和工作节点。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "riskSignals", "repairSignals"],
      reviewQuestions: [
        "风险来源是否明确。",
        "财帛是否提供修复资源。",
        "官禄是否造成主要压力。",
        "福德是否能缓冲长期消耗。"
      ],
      cautions: [
        "不输出疾病诊断。",
        "风险提示必须有修复路径。",
        "财务和健康现实决策不能由命理替代。"
      ]
    }),
    chain({
      chainId: "learning-reputation",
      category: "career",
      palaceSequence: ["parents", "career", "siblings", "travel"],
      primaryPalace: "parents",
      coreQuestion: "学习资质、文书名誉、同辈互动和外部评价如何影响发展。",
      chainReading:
        "父母看文书、学历、资质和上级，官禄看发展路径，兄弟看同辈竞争协作，迁移看外部评价和公开场域。",
      palaceRoles: [
        "父母宫是文书、资质、证照、上级和背景主宫。",
        "官禄宫说明学习资质如何进入事业路径。",
        "兄弟宫说明同学同辈和横向竞争。",
        "迁移宫说明外部评价、考试场域和公开表现。"
      ],
      starUsage: [
        "父母化科、文昌文曲等看文书和学习表达。",
        "官禄主星看资质能否转成职业能力。",
        "兄弟星曜看同辈竞争和协作。",
        "迁移星曜看外部考试、发表和公开评价。"
      ],
      transformationUsage: [
        "父母化科是文书名誉重要证据。",
        "官禄化科看专业评价，化权看责任和资格。",
        "兄弟化忌看同辈竞争和沟通反复。",
        "迁移化禄或化科看外部曝光和认可。"
      ],
      dynamicUsage: [
        "大限父母或官禄触发时，十年学习、证照、名誉和职业资格增强。",
        "流年触发时，看考试、审批、证件、发表和外部评价。",
        "短周期触发用于报名、提交、面试、答辩和文件。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "documentSignals", "reputationSignals"],
      reviewQuestions: [
        "文书资质是否有星曜支持。",
        "官禄能否承接学习成果。",
        "同辈环境是竞争还是协作。",
        "外部评价是否形成实质机会。"
      ],
      cautions: [
        "不把文昌文曲简单等同学历高低。",
        "考试结果不能由命理直接断定。",
        "资质和证照必须现实核验。"
      ]
    }),
    chain({
      chainId: "partnership-business",
      category: "relationship",
      palaceSequence: ["spouse", "wealth", "career", "friends"],
      primaryPalace: "spouse",
      coreQuestion: "一对一合作、资金交换、事业责任和团队网络如何配合。",
      chainReading:
        "夫妻看合伙与契约，财帛看利益交换，官禄看责任分工，交友看团队和外部协作者。",
      palaceRoles: [
        "夫妻宫是合伙、契约和一对一合作主宫。",
        "财帛宫说明利益、分润和成本。",
        "官禄宫说明责任、职责和事业目标。",
        "交友宫说明团队、客户和外围协作。"
      ],
      starUsage: [
        "夫妻主星看合作风格和契约关系。",
        "财帛星曜看利益结构和现金流。",
        "官禄星曜看职责是否明确。",
        "交友星曜看团队支持和客户压力。"
      ],
      transformationUsage: [
        "夫妻化权看合作主导权，化忌看关系牵挂和合约反复。",
        "财帛化禄看收益，化忌看费用和分账压力。",
        "官禄化权看责任边界，化科看规范和口碑。",
        "交友四化看团队和客户是否稳定。"
      ],
      dynamicUsage: [
        "大限夫妻或财帛触发时，十年合作和资源绑定增强。",
        "流年触发时，看年度签约、合伙、分润、客户和团队事件。",
        "短周期触发用于会议、谈判、付款和合约节点。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "contractSignals", "profitSignals"],
      reviewQuestions: [
        "合作关系是否有清楚利益结构。",
        "官禄责任是否明确。",
        "交友外围是否支持合伙。",
        "夫妻化忌是否已复核合约风险。"
      ],
      cautions: [
        "不输出法律或商业决策建议。",
        "合伙成败不能只看夫妻宫。",
        "利益分配必须回到现实合约。"
      ]
    }),
    chain({
      chainId: "team-execution",
      category: "social",
      palaceSequence: ["friends", "siblings", "career", "wealth"],
      primaryPalace: "friends",
      coreQuestion: "团队、同辈执行、事业责任和资源回收如何闭合。",
      chainReading:
        "交友看团队客户，兄弟看近身协作，官禄看执行目标，财帛看资源回收和成本。",
      palaceRoles: [
        "交友宫是团队、客户、社群和下属主宫。",
        "兄弟宫是近身同辈、同事和横向分工。",
        "官禄宫说明团队执行的事业目标。",
        "财帛宫说明执行成果能否形成资源回收。"
      ],
      starUsage: [
        "交友辅曜看团队支持，煞忌看组织内耗。",
        "兄弟星曜看沟通效率和分工。",
        "官禄主星看执行目标是否清楚。",
        "财帛星曜看成本、预算和收益。"
      ],
      transformationUsage: [
        "交友化权看团队控制，化忌看团队牵挂。",
        "兄弟化忌看沟通误差和同辈摩擦。",
        "官禄化权看执行压力，化科看流程规范。",
        "财帛化禄或化忌看回收和成本。"
      ],
      dynamicUsage: [
        "大限交友触发时，团队结构是十年重点。",
        "流年交友或官禄触发时，看年度项目、团队和客户事件。",
        "短周期触发用于排期、交付、协同和沟通。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "executionSignals", "teamSignals"],
      reviewQuestions: [
        "团队是助力还是内耗。",
        "近身协作是否顺畅。",
        "事业目标是否明确。",
        "资源回收是否能覆盖执行成本。"
      ],
      cautions: [
        "团队评价要避免单星定性。",
        "项目结论必须区分当前盘层。",
        "财务回收不能替代现实账目。"
      ]
    }),
    chain({
      chainId: "inner-outer-axis",
      category: "self",
      palaceSequence: ["life", "travel", "fortune", "career"],
      primaryPalace: "life",
      coreQuestion: "内在自我、外部环境、精神底盘和事业角色如何平衡。",
      chainReading:
        "命宫看内在主轴，迁移看外界镜像，福德看精神底盘，官禄看社会角色。",
      palaceRoles: [
        "命宫说明自我定位和行动风格。",
        "迁移宫说明外部环境对命宫的镜像和牵引。",
        "福德宫说明内在余裕和精神缓冲。",
        "官禄宫说明社会责任和职业角色。"
      ],
      starUsage: [
        "命宫主星定内在主轴。",
        "迁移星曜定外部环境和对外表现。",
        "福德星曜看精神余裕和心理承接。",
        "官禄星曜看现实角色是否与命宫一致。"
      ],
      transformationUsage: [
        "命宫四化看本人被触发的方向。",
        "迁移四化看外部事件如何牵引。",
        "福德化禄或化科看缓冲资源。",
        "官禄化权或化忌看社会角色的压力。"
      ],
      dynamicUsage: [
        "大限命宫或迁移触发时，十年内外关系重整。",
        "流年触发时，看年度身份、环境、职业和心境变化。",
        "短周期触发用于当下场域、表现和情绪状态。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "identitySignals", "externalSignals"],
      reviewQuestions: [
        "命宫和迁移是否互相支持。",
        "福德能否缓冲外部压力。",
        "官禄是否与自我主轴一致。",
        "动态盘是否只显示当前选择层级。"
      ],
      cautions: [
        "不要只看命宫忽略迁移。",
        "外界评价不等于自我价值。",
        "事业压力要回到福德修复。"
      ]
    }),
    chain({
      chainId: "asset-family-duty",
      category: "family",
      palaceSequence: ["property", "parents", "wealth", "children"],
      primaryPalace: "property",
      coreQuestion: "家庭资产、长辈责任、现金流和子女延伸如何互相牵动。",
      chainReading:
        "田宅看家庭资产，父母看长辈和文书，财帛看现金流，子女看延伸责任和下一代承接。",
      palaceRoles: [
        "田宅宫是家庭根基和长期资产主宫。",
        "父母宫说明长辈、产权文书和制度背景。",
        "财帛宫说明资产维护和家庭责任的现金流。",
        "子女宫说明下一代、作品或延伸责任。"
      ],
      starUsage: [
        "田宅星曜看家庭资产结构。",
        "父母星曜看长辈和文书制度。",
        "财帛星曜看成本和资源调配。",
        "子女星曜看下一代或延伸项目。"
      ],
      transformationUsage: [
        "田宅化权看资产责任和主导权。",
        "父母化科看手续规范，化忌看文书反复。",
        "财帛化忌看现金流压力。",
        "子女四化看后续延伸和照护责任。"
      ],
      dynamicUsage: [
        "大限田宅或父母触发时，家庭责任和资产结构十年内明显。",
        "流年触发时，看年度房产、长辈、文书、子女责任。",
        "短周期触发用于付款、手续、沟通和家庭安排。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "familyDutySignals", "assetSignals"],
      reviewQuestions: [
        "家庭资产是否带来责任。",
        "长辈文书是否清楚。",
        "财帛是否能支持家庭责任。",
        "子女或延伸责任是否参与。"
      ],
      cautions: [
        "不做产权和遗产法律结论。",
        "家庭责任不能用单宫判断。",
        "现实文件必须单独核验。"
      ]
    }),
    chain({
      chainId: "romance-social",
      category: "relationship",
      palaceSequence: ["spouse", "friends", "children", "fortune"],
      primaryPalace: "spouse",
      coreQuestion: "恋爱关系、社交圈、情感延伸和精神满足如何互相影响。",
      chainReading:
        "夫妻看亲密模式，交友看社交圈和人脉场域，子女看情感延伸与创造，福德看满足感和内在享受。",
      palaceRoles: [
        "夫妻宫是亲密关系和一对一互动主宫。",
        "交友宫说明社交圈、朋友和外部关系场域。",
        "子女宫说明恋爱表达、作品、娱乐和延伸成果。",
        "福德宫说明精神满足和情绪余裕。"
      ],
      starUsage: [
        "夫妻桃花或杂曜要回到关系模式，不直接断结果。",
        "交友星曜看社交圈质量和边界。",
        "子女星曜看表达、娱乐、创造和延伸。",
        "福德星曜看感情是否带来享受或内耗。"
      ],
      transformationUsage: [
        "夫妻化禄看吸引和互惠，化忌看牵挂和反复。",
        "交友化忌看社交圈压力或朋友介入。",
        "子女化禄看表达和愉悦，化忌看延伸压力。",
        "福德四化看情绪收益和消耗。"
      ],
      dynamicUsage: [
        "大限夫妻或交友触发时，十年关系与社交主题明显。",
        "流年触发时，看年度恋爱、社交、娱乐和创造事件。",
        "短周期触发用于约会、聚会、沟通和情绪波动。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "romanceSignals", "socialSignals"],
      reviewQuestions: [
        "关系议题是亲密关系还是社交圈牵动。",
        "子女宫是否代表娱乐、作品或延伸。",
        "福德是否显示满足或内耗。",
        "桃花星是否被过度绝对化。"
      ],
      cautions: [
        "不把桃花星直接等同出轨或感情好坏。",
        "感情结论要避免恐吓和绝对化。",
        "社交和亲密关系要分层。"
      ]
    }),
    chain({
      chainId: "authority-background",
      category: "career",
      palaceSequence: ["parents", "career", "travel", "wealth"],
      primaryPalace: "parents",
      coreQuestion: "背景、上级、事业平台、外部评价和资源回收如何连接。",
      chainReading:
        "父母看上级背景和制度，官禄看职业平台，迁移看外部评价，财帛看资源回收。",
      palaceRoles: [
        "父母宫是上级、制度、资质和背景支持主宫。",
        "官禄宫说明背景是否转化为职业平台。",
        "迁移宫说明外部评价、公开场域和环境反馈。",
        "财帛宫说明平台与声誉是否形成资源回收。"
      ],
      starUsage: [
        "父母辅曜看贵人、上级和制度支持。",
        "官禄星曜看职位和责任承接。",
        "迁移化科或吉曜看外部声誉。",
        "财帛星曜看平台收益和实际资源。"
      ],
      transformationUsage: [
        "父母化科看资质和文书，化权看上级权责，化忌看制度卡点。",
        "官禄化权看职位责任，化科看职业声誉。",
        "迁移化科看外部认可。",
        "财帛化禄看资源回收。"
      ],
      dynamicUsage: [
        "大限父母或官禄触发时，十年上级、资质和平台议题明显。",
        "流年触发时，看年度晋升、考试、审批、公开评价和收入反馈。",
        "短周期触发用于文件、面试、汇报和评审节点。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "authoritySignals", "platformSignals"],
      reviewQuestions: [
        "背景资源是否真实可用。",
        "官禄是否承接上级和制度支持。",
        "外部评价是否形成平台机会。",
        "财帛是否能回收实际资源。"
      ],
      cautions: [
        "不要把父母宫只看成长辈。",
        "职位与收入要分开复核。",
        "资质和审批要现实核验。"
      ]
    }),
    chain({
      chainId: "resource-loss-repair",
      category: "wealth",
      palaceSequence: ["wealth", "health", "fortune", "property"],
      primaryPalace: "wealth",
      coreQuestion: "资源损耗、身心压力、精神修复和长期承载如何互相影响。",
      chainReading:
        "财帛看资源流失和现金压力，疾厄看损耗进入身心，福德看修复余裕，田宅看长期承载。",
      palaceRoles: [
        "财帛宫是资源、现金流和成本主宫。",
        "疾厄宫说明资源压力是否变成身心损耗。",
        "福德宫说明精神修复和缓冲资源。",
        "田宅宫说明长期承载、家庭空间和存量资产。"
      ],
      starUsage: [
        "财帛煞忌看成本和资源压力。",
        "疾厄煞忌看压力进入身体和节奏。",
        "福德吉曜看修复，福德煞忌看内耗。",
        "田宅星曜看是否有长期安全垫。"
      ],
      transformationUsage: [
        "财帛化忌看现金牵挂，化禄看可用资源。",
        "疾厄化忌看损耗信号，化科看修复秩序。",
        "福德化禄看恢复和享受资源。",
        "田宅四化看长期承载和家庭责任。"
      ],
      dynamicUsage: [
        "大限财帛或疾厄触发时，长期资源和压力管理必须复核。",
        "流年触发时，看年度费用、健康检查、修复和资产压力。",
        "短周期触发用于付款、疲劳、家务和短期调整。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "lossSignals", "repairSignals"],
      reviewQuestions: [
        "资源压力来自收入、支出还是资产责任。",
        "疾厄是否显示承压信号。",
        "福德是否有修复空间。",
        "田宅是否能提供长期承载。"
      ],
      cautions: [
        "不做医疗或财务建议。",
        "损耗不等于必然灾难。",
        "短期花费不能直接写成长年贫弱。"
      ]
    }),
    chain({
      chainId: "legacy-continuity",
      category: "family",
      palaceSequence: ["children", "property", "parents", "fortune"],
      primaryPalace: "children",
      coreQuestion: "下一代、家庭根基、长辈背景和精神传承如何延续。",
      chainReading:
        "子女看下一代和创造延伸，田宅看家庭根基，父母看长辈背景，福德看精神传承和内在满足。",
      palaceRoles: [
        "子女宫是下一代、学生、作品和延伸成果主宫。",
        "田宅宫说明家庭根基和空间承载。",
        "父母宫说明长辈资源、家族背景和文书制度。",
        "福德宫说明精神传承、价值感和内在满足。"
      ],
      starUsage: [
        "子女星曜看延伸方式和照护责任。",
        "田宅星曜看家庭根基是否稳固。",
        "父母星曜看长辈背景和制度文书。",
        "福德星曜看传承议题带来的精神感受。"
      ],
      transformationUsage: [
        "子女化禄看延伸成果，化忌看照护牵挂。",
        "田宅化权看家庭责任和空间主导。",
        "父母化科看文书和长辈支持。",
        "福德四化看传承的满足或内耗。"
      ],
      dynamicUsage: [
        "大限子女或田宅触发时，十年延伸、家庭和承载主题明显。",
        "流年触发时，看年度子女、作品、家庭和长辈事件。",
        "短周期触发用于照护、家务、沟通和作品节点。"
      ],
      evidenceFields: [...CORE_EVIDENCE_FIELDS, "legacySignals", "continuitySignals"],
      reviewQuestions: [
        "子女宫代表亲子、作品还是学生下属。",
        "田宅是否提供根基。",
        "父母是否提供背景资源。",
        "福德是否承接精神传承。"
      ],
      cautions: [
        "不把子女宫固定为生育结论。",
        "传承主题不能脱离现实家庭结构。",
        "长辈和下一代议题要避免绝对化。"
      ]
    }),
    chain({
      chainId: "full-review",
      category: "review",
      palaceSequence: [...ZIWEI_PALACE_ORDER],
      primaryPalace: "life",
      coreQuestion: "全盘十二宫如何分层复核，避免把单宫资料写成最终断语。",
      chainReading:
        "全盘复核以命宫定主轴，再依次检查同辈、关系、延伸、资源、身心、外部、团队、事业、家庭、精神和背景，最后回到当前盘层。",
      palaceRoles: [
        "命宫定自我主轴和整盘承接。",
        "财帛、官禄、迁移构成现实执行和外部发展。",
        "夫妻、福德、子女构成关系、情绪和延伸。",
        "田宅、父母、疾厄构成根基、背景和身心压力。",
        "兄弟、交友构成同辈和团队网络。"
      ],
      starUsage: [
        "先看主星骨架，再看辅曜补强，煞曜压力，杂曜细节。",
        "同宫、对宫、三方四正、夹宫和动态叠盘要分层记录。",
        "亮度只用于承接层次，不替代星曜本体和组合判断。",
        "空宫必须借对宫和三方，不改变星曜原始落点。"
      ],
      transformationUsage: [
        "四化必须标明来源天干和盘层。",
        "化禄、化权、化科、化忌分别看资源、权责、名誉和牵挂。",
        "目标星和目标宫要分开记录。",
        "本命四化、大限四化、流年四化、流月流日流时四化不能混写。"
      ],
      dynamicUsage: [
        "默认先读本命底盘，再叠大限，再叠流年、流月、流日、流时。",
        "用户选择某一盘层时，只高亮该盘层命宫和三方四正线。",
        "下级流层必须保留上级背景，但不删除上级标记。",
        "短周期触发降权处理，不写成长期命运结论。"
      ],
      evidenceFields: [
        ...CORE_EVIDENCE_FIELDS,
        "natalSummary",
        "daYunSummary",
        "liuNianSummary",
        "liuYueSummary",
        "liuRiSummary",
        "liuShiSummary"
      ],
      reviewQuestions: [
        "是否按星曜本体、入宫、组合、格局、动态盘分层。",
        "是否只显示当前盘中命中的格局结果。",
        "是否保留来源规则和版权边界。",
        "是否把医学、法律、投资等高风险主题降级为提醒。"
      ],
      cautions: [
        "全盘复核不是一次性输出所有资料。",
        "资料字典不能替代当前盘命中分析。",
        "用户截图只能作布局参考，不复制外部文案和 UI 资产。"
      ]
    })
  ]

export function getPalaceThemeChainContentDetail(
  chainId: string
): ZiweiPalaceThemeChainContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_DETAILS.find((detail) => {
      return detail.chainId === chainId
    }) ?? null
  )
}

export function getAllPalaceThemeChainContentDetails(): ZiweiPalaceThemeChainContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_DETAILS]
}

function chain(input: PalaceThemeChainInput): ZiweiPalaceThemeChainContentDetail {
  const label = input.label ?? buildChainLabel(input.palaceSequence)
  const supportingPalaces = input.palaceSequence.filter((sectorName) => {
    return sectorName !== input.primaryPalace
  })
  const sourceReferences = buildPalaceThemeChainSourceReferences()

  return {
    ...input,
    label,
    supportingPalaces,
    sourceReferences,
    sections: buildSections({
      ...input,
      label,
      supportingPalaces,
      sourceReferences
    })
  }
}

function buildChainLabel(palaceSequence: SectorName[]): string {
  return `${palaceSequence.map((sectorName) => SECTOR_LABELS[sectorName]).join("·")}链`
}

function buildSections(
  detail: Omit<ZiweiPalaceThemeChainContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "主题定位",
      items: [
        `${detail.label}用于复核：${detail.coreQuestion}`,
        `主宫为${SECTOR_LABELS[detail.primaryPalace]}，辅助宫包括${detail.supportingPalaces
          .map((sectorName) => SECTOR_LABELS[sectorName])
          .join("、")}。`
      ]
    },
    {
      title: "链条总读法",
      items: [detail.chainReading]
    },
    {
      title: "宫位角色",
      items: detail.palaceRoles
    },
    {
      title: "星曜读取",
      items: detail.starUsage
    },
    {
      title: "四化读取",
      items: detail.transformationUsage
    },
    {
      title: "动态盘读取",
      items: detail.dynamicUsage
    },
    {
      title: "证据字段",
      items: detail.evidenceFields
    },
    {
      title: "复核问题",
      items: detail.reviewQuestions
    },
    {
      title: "误读边界",
      items: detail.cautions
    }
  ]
}

