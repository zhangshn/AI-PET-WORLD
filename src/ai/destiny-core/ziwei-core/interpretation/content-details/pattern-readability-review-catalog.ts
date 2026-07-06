import type { ZiweiCurrentPatternSynthesisProfileId } from "./current-pattern-synthesis-depth-catalog"

export interface ZiweiPatternReadabilityReviewSection {
  title: string
  items: string[]
}

export interface ZiweiPatternReadabilityReviewProfile {
  reviewId: string
  profileId: ZiweiCurrentPatternSynthesisProfileId
  label: string
  patternCategories: string[]
  dictionaryPurpose: string
  currentChartPurpose: string
  requiredHitEvidence: string[]
  formationReadingRules: string[]
  breakageReadingRules: string[]
  enhancementReadingRules: string[]
  dynamicLayerRules: string[]
  currentChartOutputRules: string[]
  hideRules: string[]
  readabilityChecklist: string[]
  insufficientDataPolicy: string[]
  nextReviewAction: string
  sections: ZiweiPatternReadabilityReviewSection[]
}

const REVIEW_PROFILE_DRAFTS: Array<
  Omit<ZiweiPatternReadabilityReviewProfile, "reviewId" | "sections">
> = [
  {
    profileId: "favorable-literary-assistant",
    label: "文曜辅佐吉格",
    patternCategories: ["literary", "assistant"],
    dictionaryPurpose: "总字典只解释文昌、文曲、魁钺、左右、化科等文曜辅佐结构本身，说明它们如何形成名誉、文书、学习、贵人和支援。",
    currentChartPurpose: "当前盘只解释已经命中的文曜辅佐格局，并说明它落在哪个宫位、由哪些星曜组成、是否被煞忌破坏。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须有明确 patternId、格局名称、格局分类和命中盘层。",
      "必须列出参与星曜、所在宫位、同宫或会照关系、三方四正位置。",
      "必须列出四化来源、庙旺落陷、煞忌空劫和 sourceRuleIds。",
      "必须说明它是原盘格局、大限格局、流年格局，还是短周期触发。"
    ],
    formationReadingRules: [
      "先写文曜辅佐结构为什么成立，再写它服务的是命宫、官禄、财帛、迁移还是关系宫。",
      "文曜主表达、文书、名誉和条理；辅佐主贵人、制度入口和资源承接，不能混成一句好话。",
      "若主星能承接，格局可写成名誉、文书、考试、平台或贵人助力较清楚。",
      "若主星弱，辅佐只能写成外援存在，不能直接写成高格。"
    ],
    breakageReadingRules: [
      "文昌文曲化忌、空劫同会、羊陀火铃冲破时，要写文书反复、表达压力、名誉争议或支援中断。",
      "辅曜多但主轴不清时，不写成贵人旺，只写外援多但承接不足。",
      "短周期出现文曜辅佐，只能写当期帮助或文书节点，不能写成本命长期格局。",
      "若格局未命中，文曜辅佐资料隐藏在当前盘结果之外。"
    ],
    enhancementReadingRules: [
      "化科、禄权科同会、魁钺左右夹拱可作为加吉增强，但仍需回到格局条件。",
      "三方四正文曜会照可作为辅助增强，必须标明是会照，不写成同宫。",
      "文曜辅佐与主星格同现时，先读主星骨架，再读文曜如何增加名誉、文书和贵人承接。"
    ],
    dynamicLayerRules: [
      "原盘命中看长期学习、表达、名誉和贵人结构。",
      "大限命中看十年阶段的平台、证照、文书、考试和支援。",
      "流年命中看年度申请、审核、作品、证书、名誉事件。",
      "流月、流日、流时只看短期沟通、流程、协助和文书节点。"
    ],
    currentChartOutputRules: [
      "第一段写命中的格局名称、盘层和宫位。",
      "第二段列证据：星曜、宫位、三方四正、四化、庙旺落陷和来源规则。",
      "第三段写成色：增强、承接不足、受压或待复核。",
      "第四段写边界：不把总字典解释当成当前盘结论。"
    ],
    hideRules: [
      "没有 patternId 或命中宫位时隐藏。",
      "只有单颗文曜但未形成格局时，不显示为格局结果。",
      "未启用动态层时，隐藏流月、流日、流时格局段。"
    ],
    readabilityChecklist: [
      "是否讲清楚总字典解释的是格局本身。",
      "是否讲清楚当前盘只解释已命中的格局。",
      "是否区分同宫、会照、夹拱和三方四正。",
      "是否说明文曜辅佐是增强、承接不足还是被破坏。",
      "是否避免把文曜写成必然考试成功或一定有贵人。"
    ],
    insufficientDataPolicy: [
      "资料不足时只显示待复核，不输出格局结论。",
      "缺 patternId 时隐藏当前盘格局段。",
      "缺 sourceRuleIds 时进入复核队列。",
      "缺四化来源时不写四化增强或破格。",
      "缺宫位证据时不写当前盘落宫解释。"
    ],
    nextReviewAction: "用真实盘例抽查文曜辅佐吉格是否能分清名誉、文书、贵人和主星承接。"
  },
  {
    profileId: "main-structure",
    label: "主星骨架格局",
    patternCategories: ["mainCombo"],
    dictionaryPurpose: "总字典解释主星组合格局的骨架含义，包括主轴、驱动力、宫位承接、庙旺落陷和三方四正结构。",
    currentChartPurpose: "当前盘解释这张盘中主星组合为什么成为主轴，落在哪个宫位，是否被辅曜增强或煞忌破坏。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须有明确主星组合或主星格局命中。",
      "必须列出主星所在宫位、是否同宫、是否对照、是否三方会照。",
      "必须列出庙旺落陷、四化、辅曜、煞曜和杂曜修正。",
      "必须说明当前盘层级，不把短周期主星组合写成本命格局。"
    ],
    formationReadingRules: [
      "先定主星组合的核心驱动力，再看它落入哪个宫位主题。",
      "主星骨架优先级高于杂曜细节，但不能忽略煞忌和四化修正。",
      "命宫、官禄、财帛、迁移能互相承接时，主星骨架更容易落地。",
      "主星同宫和三方会照要分开写，不能混成同一种力量。"
    ],
    breakageReadingRules: [
      "主星落陷、煞忌同宫、空劫夹耗或三方受冲时，主星优势降权。",
      "主星强但财官迁不承接时，只写主轴强，不写现实落地充分。",
      "短周期出现主星格局，只写阶段触发，不写终身格局。",
      "若没有明确格局命中，不显示主星格局结果。"
    ],
    enhancementReadingRules: [
      "左右魁钺昌曲、禄权科和庙旺可提升主星骨架层次。",
      "化科可修饰名誉和解释力，化权可加强职责，化禄可提供资源。",
      "主星格同时见文曜辅佐时，文曜只作增强，不覆盖主星骨架。"
    ],
    dynamicLayerRules: [
      "原盘主星格局看长期命盘骨架。",
      "大限主星格局看十年阶段主轴。",
      "流年主星格局看年度触发和应期。",
      "流月、流日、流时只看局部事件窗口。"
    ],
    currentChartOutputRules: [
      "先写主星骨架和所在宫位。",
      "再写三方四正、对宫和同宫组合。",
      "再写四化、庙旺落陷和动态盘层级。",
      "最后写成色、破口和复核边界。"
    ],
    hideRules: [
      "没有主星组合命中时隐藏。",
      "只有总字典存在但当前盘未触发时隐藏。",
      "没有宫位证据时不输出主星格局段。"
    ],
    readabilityChecklist: [
      "是否先讲清主星组合的骨架含义。",
      "是否说明该骨架落在哪个宫位主题。",
      "是否区分原盘、大限、流年和短周期。",
      "是否把辅曜、煞曜、四化作为修正而非替代。",
      "是否避免写成现代人格标签。"
    ],
    insufficientDataPolicy: [
      "资料不足时只保留主星入宫基础解释。",
      "缺同宫或三方证据时不写成完整格局。",
      "缺庙旺落陷时不判断层次高低。",
      "缺动态盘层级时默认按原盘解释。",
      "缺格局命中证据时隐藏当前盘结果。"
    ],
    nextReviewAction: "用真实盘例抽查主星骨架格局是否能说明主轴、落宫、承接和破口。"
  },
  {
    profileId: "wealth-power-resource",
    label: "禄马权科资源格局",
    patternCategories: ["wealthPower"],
    dictionaryPurpose: "总字典解释禄、马、权、科等资源、行动、权责、名誉和机会流动结构。",
    currentChartPurpose: "当前盘解释资源从哪里来、由哪个宫承接、是否被化忌煞曜空劫消耗，以及属于哪个盘层。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须有化禄、禄存、天马、化权、化科或相关资源格局命中。",
      "必须列出资源落宫、来源天干、目标星、目标宫和盘层。",
      "必须说明财帛、官禄、迁移、命宫是否形成承接链。",
      "必须列出化忌、空劫、煞曜或破格证据。"
    ],
    formationReadingRules: [
      "先判断资源入口，再判断行动路径，再判断权责和名誉是否能承接。",
      "禄不等于现实收益，马不等于一定迁动，权不等于一定升迁，科不等于一定名誉。",
      "财官迁命形成链条时，资源格局才容易落地。",
      "只出现单个资源信号时，先写资源倾向，不写资源结果。"
    ],
    breakageReadingRules: [
      "禄忌同见时，必须同时写资源入口和牵挂代价。",
      "权忌同见时，必须写权责压力、控制、争议或制度冲突。",
      "空劫会资源格时，要写虚耗、落空、计划变更或保存困难。",
      "短周期资源信号只写当期收付、任务、合同或机会窗口。"
    ],
    enhancementReadingRules: [
      "禄权科组合、双禄、禄马交驰可增强资源流动，但仍需主星和宫位承接。",
      "辅曜同会可增加资源入口和制度支援。",
      "庙旺主星能承接时，资源格局的现实可用性更高。"
    ],
    dynamicLayerRules: [
      "原盘资源格局看长期资源结构。",
      "大限资源格局看十年阶段资源和责任。",
      "流年资源格局看年度收支、合同、机会和行动窗口。",
      "流月以下只看短期付款、预算、出行、审批或任务节点。"
    ],
    currentChartOutputRules: [
      "先写资源格局命中名称和盘层。",
      "再写资源入口、行动路径、承接宫位。",
      "再写代价、消耗、破格和复核点。",
      "最后写不替代财务、法律或职业判断。"
    ],
    hideRules: [
      "没有资源格局命中时隐藏。",
      "只有化禄但无宫位承接时，不写成资源成功。",
      "未启用动态层时隐藏动态资源段。"
    ],
    readabilityChecklist: [
      "是否讲清资源入口和承接宫位。",
      "是否区分资源信号和现实结果。",
      "是否说明化忌、空劫、煞曜带来的代价。",
      "是否区分原盘结构和动态触发。",
      "是否避免写成投资、财务或职业建议。"
    ],
    insufficientDataPolicy: [
      "资料不足时只输出资源倾向，不输出资源结果。",
      "缺来源天干时不写四化链路。",
      "缺财官迁承接证据时不写资源落地。",
      "缺破格证据时不写消耗判断。",
      "缺盘层时默认按原盘资料解释。"
    ],
    nextReviewAction: "用真实盘例抽查资源格局是否能分清资源入口、承接链和代价。"
  },
  {
    profileId: "malefic-pressure",
    label: "煞曜压力格局",
    patternCategories: ["malefic"],
    dictionaryPurpose: "总字典解释羊陀火铃空劫化忌等煞曜压力结构，说明冲突、阻滞、惊扰、空耗和修复入口。",
    currentChartPurpose: "当前盘只解释已经命中的煞曜压力格局，并标明压力来源、受压宫位、制化条件和修复路径。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须有明确煞曜、化忌、空劫或压力格局命中。",
      "必须列出煞曜是同宫、夹宫、对宫、三方四正还是动态触发。",
      "必须说明受压宫位和影响主题。",
      "必须列出是否有吉曜、化科、庙旺主星或规则制化。"
    ],
    formationReadingRules: [
      "煞曜格局先写压力类型，再写进入哪个宫位主题。",
      "煞曜不等于直接坏结果，要看主星能否承压、吉曜能否制化。",
      "压力可转成执行、边界、修复和风险意识，但必须有承接证据。",
      "涉及疾厄、财帛、田宅、夫妻等宫时，只作风险复核，不作恐吓断语。"
    ],
    breakageReadingRules: [
      "煞忌叠加、空劫同会、主星陷弱、三方受冲时破格权重提高。",
      "煞曜冲入吉格核心条件时，要写加煞破格或层次下降。",
      "短周期煞曜只写临时冲突、疲劳、阻滞或复核点。",
      "无制化时，也要写可复核的现实边界，不写绝对灾断。"
    ],
    enhancementReadingRules: [
      "化科、魁钺、左右、天梁、庙旺主星可作为制化和修复证据。",
      "官禄、迁移、财帛等现实宫能承压时，可写高压任务而非纯阻碍。",
      "规则、文书、制度和检查可作为压力结构的修复路径。"
    ],
    dynamicLayerRules: [
      "原盘煞曜格局看长期压力来源。",
      "大限煞曜格局看十年阶段压力和修复课题。",
      "流年煞曜格局看年度风险触发。",
      "流月、流日、流时只作短周期注意事项。"
    ],
    currentChartOutputRules: [
      "先写压力来源和受压宫位。",
      "再写煞曜关系类型和三方四正。",
      "再写是否有制化、修复和承接。",
      "最后写风险提醒边界，不输出恐吓断语。"
    ],
    hideRules: [
      "没有煞曜压力格局命中时隐藏。",
      "单颗煞曜未形成结构时，不显示为格局。",
      "短周期未启用时隐藏流日流时压力段。"
    ],
    readabilityChecklist: [
      "是否先写压力类型而非直接吉凶。",
      "是否说明受压宫位和现实主题。",
      "是否写出制化与修复路径。",
      "是否区分长期结构和短期触发。",
      "是否避免灾断和恐吓。"
    ],
    insufficientDataPolicy: [
      "资料不足时只显示压力待复核。",
      "缺受压宫位时不输出当前盘结论。",
      "缺制化证据时不写可解或必凶。",
      "缺盘层时不写应期。",
      "涉及疾厄时只写提醒，不写诊断。"
    ],
    nextReviewAction: "用真实盘例抽查煞曜压力格局是否能同时给出压力来源和修复路径。"
  },
  {
    profileId: "misc-detail",
    label: "杂曜细节格局",
    patternCategories: ["misc"],
    dictionaryPurpose: "总字典解释杂曜组合的喜庆、名位、桃花、孤寡、仪态、刑耗和细节触发。",
    currentChartPurpose: "当前盘只解释已经命中的杂曜细节结构，并说明它是补充、增强、牵制还是风险提示。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须有明确杂曜组合、成对、会照或参与格局命中。",
      "必须说明杂曜属于哪个主题组。",
      "必须列出主星、宫位、同宫和三方四正承接。",
      "必须说明它不能覆盖主星和宫位主轴。"
    ],
    formationReadingRules: [
      "杂曜格局先按主题组读取，再回到主星和宫位主轴。",
      "红鸾天喜看关系气氛和喜庆触发，不直接断婚嫁。",
      "台辅封诰、龙池凤阁看名位仪态，但要看官禄和文曜承接。",
      "孤寡、哭虚、刑耗类只作细节复核，不直接下人生结论。"
    ],
    breakageReadingRules: [
      "桃花遇忌煞时，写关系边界、名声压力和纠缠成本。",
      "孤寡遇空劫化忌时，写距离感、落空和情绪消耗。",
      "刑耗遇煞忌时，写规则、修补、破口和风险提醒。",
      "杂曜不成组时，只作星曜细节，不显示为格局。"
    ],
    enhancementReadingRules: [
      "杂曜同主题成对且主星能承接时，可作为细节增强。",
      "与文曜辅曜同见时，可补名位、仪态、文书、社交和关系气氛。",
      "与动态盘同触发时，只说明当期细节气候。"
    ],
    dynamicLayerRules: [
      "原盘杂曜格局看长期细节倾向。",
      "大限杂曜格局看阶段气氛和细节主题。",
      "流年杂曜格局看年度事件气候。",
      "流月以下只看短期触发，不反推原盘。"
    ],
    currentChartOutputRules: [
      "先写杂曜主题组和命中盘层。",
      "再写落宫、同宫、三方四正和相关主星。",
      "再写它是增强、修饰、牵制还是风险提示。",
      "最后写不可覆盖主星主轴。"
    ],
    hideRules: [
      "没有杂曜组合命中时隐藏。",
      "单颗杂曜未成结构时不显示为格局。",
      "没有当前盘证据时不引用总字典杂曜格局。"
    ],
    readabilityChecklist: [
      "是否按主题组解释杂曜。",
      "是否回到主星和宫位主轴。",
      "是否避免杂曜压过主星。",
      "是否区分细节增强和风险提示。",
      "是否避免给杂曜强套庙旺落陷。"
    ],
    insufficientDataPolicy: [
      "资料不足时只显示杂曜细节待复核。",
      "缺主题组时不输出格局段。",
      "缺主星承接时不写成高格。",
      "缺三方四正时不写成结构会照。",
      "缺盘层时不写动态触发。"
    ],
    nextReviewAction: "用真实盘例抽查杂曜格局是否被正确降权为细节补充。"
  },
  {
    profileId: "adverse-breakage",
    label: "凶格破格",
    patternCategories: ["adverse"],
    dictionaryPurpose: "总字典解释凶格、破格和不良结构本身，说明煞忌、落陷、纠缠、破耗和原有好格局被打断的机制。",
    currentChartPurpose: "当前盘只解释已经命中的凶格破格，并说明它破坏什么、证据在哪里、有没有制化和修复。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须有明确 patternId、conditionText、matchedPalaces 和 sourceRuleIds。",
      "必须说明破坏对象是主星格、文曜辅佐、资源格局、关系结构还是动态层成色。",
      "必须列出煞忌、落陷、空劫、桃花忌、孤寡煞忌等具体证据。",
      "必须说明是否有吉曜制化、化科缓和或庙旺主星承压。"
    ],
    formationReadingRules: [
      "凶格破格先写结构机制，不直接写灾祸。",
      "要说明破的是哪一个格局、哪条宫线或哪个盘层的成色。",
      "破格不等于完全否定原格局，要区分核心条件被破、层次下降、短期受扰和证据不足。",
      "必须同时提供制化、缓和、修复或复核路径。"
    ],
    breakageReadingRules: [
      "煞忌叠加且无制化时，破格权重提高。",
      "主星落陷、三方受冲、空劫夹耗时，成格质量下降。",
      "化忌打到命、夫、财、官、疾等关键宫时，必须写复核。",
      "短周期破格只作临时风险提示，不写成终身定论。"
    ],
    enhancementReadingRules: [
      "吉曜制化、化科缓和、庙旺主星承接可降低破格权重。",
      "大限或流年出现修复星曜时，可写阶段性处理机会。",
      "清晰宫位任务和现实边界可作为修复路径。"
    ],
    dynamicLayerRules: [
      "原盘凶格看长期结构压力。",
      "大限凶格看十年阶段风险。",
      "流年凶格看年度触发。",
      "流月以下只写短周期风险提醒和复核点。"
    ],
    currentChartOutputRules: [
      "先写破格名称和盘层。",
      "再写破坏对象和证据。",
      "再写制化、缓和或修复条件。",
      "最后写风险提醒，避免恐吓式断语。"
    ],
    hideRules: [
      "没有明确命中证据时隐藏。",
      "只有总字典说明但当前盘未命中时隐藏。",
      "没有破坏对象时不输出破格段。"
    ],
    readabilityChecklist: [
      "是否说明破坏对象。",
      "是否列出具体证据。",
      "是否写出制化和修复路径。",
      "是否区分原盘与动态盘。",
      "是否避免恐吓和定论。"
    ],
    insufficientDataPolicy: [
      "资料不足时只显示待复核。",
      "缺破坏对象时不输出破格结论。",
      "缺 sourceRuleIds 时不输出当前盘结果。",
      "缺制化证据时不写完全不可解。",
      "缺盘层时不写应期。"
    ],
    nextReviewAction: "用真实盘例抽查凶格破格是否能说明破坏对象、证据和修复路径。"
  },
  {
    profileId: "dynamic-trigger",
    label: "动态盘触发格局",
    patternCategories: ["dynamic"],
    dictionaryPurpose: "总字典解释动态盘格局如何继承原盘、大限、流年、流月、流日和流时的盘层逻辑。",
    currentChartPurpose: "当前盘解释用户当前选择的盘层中哪些格局被触发，并保留上层背景，不改写原盘。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds，缺任何一项都不能作为当前盘命中格局输出。",
      "必须标明格局命中盘层。",
      "必须标明该层命宫、该层十二宫、该层四化和该层星曜。",
      "必须说明上层背景是否承接。",
      "必须说明有效期和降权边界。"
    ],
    formationReadingRules: [
      "动态格局先看层级，再看是否继承上层结构。",
      "大限格局不能覆盖原盘，只说明十年阶段。",
      "流年格局不能删除大限背景，只说明年度触发。",
      "流月、流日、流时只作短周期窗口。"
    ],
    breakageReadingRules: [
      "动态层冲击原盘弱点时，写阶段触发和复核，不改写原盘。",
      "大限受压而流年再触发时，年度压力加重。",
      "短周期煞忌触发只写临时阻滞。",
      "没有上层承接时，动态格局降权。"
    ],
    enhancementReadingRules: [
      "动态层与原盘结构一致时，主题集中。",
      "大限和流年同时触发同类格局时，阶段和年度主题更明显。",
      "流月以下可作为上层格局的应期点。"
    ],
    dynamicLayerRules: [
      "大限格局必须保留原盘底色。",
      "流年格局必须保留大限背景。",
      "流月格局必须保留流年背景。",
      "流日流时格局只作时段点验。"
    ],
    currentChartOutputRules: [
      "先写当前选择的动态层。",
      "再写继承了哪些上层背景。",
      "再写本层格局命中证据。",
      "最后写本层有效期和降权边界。"
    ],
    hideRules: [
      "未选择对应动态层时隐藏。",
      "没有本层格局命中时隐藏。",
      "上层背景不完整时只显示复核提示。"
    ],
    readabilityChecklist: [
      "是否保留上层背景。",
      "是否说明当前盘层。",
      "是否避免用流日流时改写原盘。",
      "是否说明有效期。",
      "是否区分触发和成格。"
    ],
    insufficientDataPolicy: [
      "资料不足时只显示动态触发待复核。",
      "缺上层背景时不写完整结论。",
      "缺本层命宫时不输出动态格局段。",
      "缺本层四化时不写四化触发。",
      "缺有效期时不写应期。"
    ],
    nextReviewAction: "用真实盘例抽查大限、流年、流月、流日、流时的格局继承是否清楚。"
  },
  {
    profileId: "pending-review",
    label: "待复核格局",
    patternCategories: ["pending"],
    dictionaryPurpose: "总字典保留待复核格局的目录位置、缺口字段和来源线索，等待规则、样例和边界闭合。",
    currentChartPurpose: "当前盘不输出待复核格局结论，只在复核队列或资料字典中提示缺什么。",
    requiredHitEvidence: [
      "必须记录 patternId、conditionText、matchedPalaces 和 sourceRuleIds；待复核资料缺任何一项都不输出当前盘结论。",
      "必须记录缺失的是条件、来源、样例、盘层还是命中证据。",
      "必须标明复核队列编号或来源规则缺口。",
      "必须禁止进入正式当前盘段落。",
      "必须说明下一步补哪个字段。"
    ],
    formationReadingRules: [
      "待复核格局不参与正式成格判断。",
      "只有补齐规则、来源和样例后，才能转为正式格局。",
      "待复核资料只服务后续校盘和资料补齐。",
      "现代资料只存元信息和自有摘要，不复制正文。"
    ],
    breakageReadingRules: [
      "来源冲突、规则不清、样例不足时继续保留待复核。",
      "无法追溯来源的断语不得进入正式字典。",
      "只在短周期触发的未验证结构不能升格为正式格局。",
      "没有命中证据时不得显示当前盘结果。"
    ],
    enhancementReadingRules: [
      "多源资料一致可提高复核优先级。",
      "人工样例验证通过后可申请进入正式目录。",
      "补齐字段、脚本和边界后再参与当前盘解释。"
    ],
    dynamicLayerRules: [
      "待复核格局不参与动态盘当前结论。",
      "动态层来源缺失时继续待复核。",
      "短周期触发不能作为正式成格依据。",
      "缺本层命宫、四化或命中宫位时不得显示。"
    ],
    currentChartOutputRules: [
      "只输出待复核原因，不把它写成当前盘已经命中的正式结论。",
      "列出缺失字段，例如 patternId、conditionText、matchedPalaces、sourceRuleIds 或盘层证据。",
      "列出下一步复核动作，说明需要补来源、补样例、补规则还是补脚本。",
      "不输出命盘结论，避免用户把未闭合资料误读成已经成立的格局。"
    ],
    hideRules: [
      "当前盘结果隐藏待复核格局。",
      "用户未打开资料字典或复核面板时隐藏。",
      "无来源编号时隐藏。"
    ],
    readabilityChecklist: [
      "是否明确这是待复核资料。",
      "是否禁止进入当前盘结论。",
      "是否列出缺失字段。",
      "是否保留来源线索。",
      "是否避免自由发挥补齐规则。"
    ],
    insufficientDataPolicy: [
      "资料不足时维持待复核状态。",
      "缺来源时不入库正文。",
      "缺样例时不转正式格局。",
      "缺脚本时不接入当前盘。",
      "缺边界时不输出结论。"
    ],
    nextReviewAction: "用复核队列逐项补规则、来源、样例和校验脚本。"
  }
]

export const ZIWEI_PATTERN_READABILITY_REVIEW_PROFILES: ZiweiPatternReadabilityReviewProfile[] =
  REVIEW_PROFILE_DRAFTS.map((profile) => ({
    ...profile,
    reviewId: `p36-h7.pattern-readability.${profile.profileId}`,
    sections: buildSections(profile)
  }))

function buildSections(
  profile: Omit<ZiweiPatternReadabilityReviewProfile, "reviewId" | "sections">
): ZiweiPatternReadabilityReviewSection[] {
  return [
    { title: "总字典边界", items: [profile.dictionaryPurpose] },
    { title: "当前盘边界", items: [profile.currentChartPurpose] },
    { title: "命中证据", items: profile.requiredHitEvidence },
    { title: "成格解释", items: profile.formationReadingRules },
    { title: "破格解释", items: profile.breakageReadingRules },
    { title: "加吉增强", items: profile.enhancementReadingRules },
    { title: "动态盘层级", items: profile.dynamicLayerRules },
    { title: "当前盘输出", items: profile.currentChartOutputRules },
    { title: "隐藏规则", items: profile.hideRules },
    { title: "可读性检查", items: profile.readabilityChecklist },
    { title: "资料不足处理", items: profile.insufficientDataPolicy },
    { title: "下一步复核", items: [profile.nextReviewAction] }
  ]
}

export function getAllZiweiPatternReadabilityReviewProfiles():
  ZiweiPatternReadabilityReviewProfile[] {
  return ZIWEI_PATTERN_READABILITY_REVIEW_PROFILES
}

export function getZiweiPatternReadabilityReviewProfile(
  profileId: ZiweiCurrentPatternSynthesisProfileId
): ZiweiPatternReadabilityReviewProfile | undefined {
  return ZIWEI_PATTERN_READABILITY_REVIEW_PROFILES.find((profile) => {
    return profile.profileId === profileId
  })
}
