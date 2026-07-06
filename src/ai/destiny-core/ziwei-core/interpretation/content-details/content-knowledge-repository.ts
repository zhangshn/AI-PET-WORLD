import type { ZiweiStarCategory, ZiweiStarDefinition } from "../../contracts"

import type {
  ZiweiContentSourceReference,
  ZiweiPatternContentDetailInput
} from "./content-detail-types"
import type {
  ZiweiKnowledgeFacet,
  ZiweiKnowledgeAnalysisDimension,
  ZiweiBranchKnowledgeRecord,
  ZiweiElementGateKnowledgeRecord,
  ZiweiKnowledgeCalibrationField,
  ZiweiKnowledgeIntakePack,
  ZiweiKnowledgeRepositorySnapshot,
  ZiweiKnowledgeSource,
  ZiweiKnowledgeTerm,
  ZiweiMainStarPalaceCombinationKnowledgeRecord,
  ZiweiNonMainStarPalaceCombinationKnowledgeRecord,
  ZiweiPalaceKnowledgeRecord,
  ZiweiPalaceThemeChainEvidenceDomainCrossReferenceKnowledgeRecord,
  ZiweiPalaceThemeChainEvidenceHitRuleKnowledgeRecord,
  ZiweiPalaceThemeChainEvidenceFieldStandardKnowledgeRecord,
  ZiweiPalaceThemeChainKnowledgeRecord,
  ZiweiPalaceThemeChainFieldParagraphReviewMatrixKnowledgeRecord,
  ZiweiPalaceThemeChainOutputParagraphTemplateKnowledgeRecord,
  ZiweiPalaceThemeChainResultThresholdKnowledgeRecord,
  ZiweiPalaceThemeChainSynthesisTemplateKnowledgeRecord,
  ZiweiPatternCombinationRelationKnowledgeRecord,
  ZiweiPeriodicStarPalaceCombinationKnowledgeRecord,
  ZiweiPatternKnowledgeRecord,
  ZiweiRelationshipStructureKnowledgeRecord,
  ZiweiStarPairCombinationKnowledgeRecord,
  ZiweiStarKnowledgeRecord,
  ZiweiStemKnowledgeRecord,
  ZiweiTheorySourceReferenceKnowledgeRecord,
  ZiweiTransformationTargetCombinationKnowledgeRecord,
  ZiweiTransformationTopicKnowledgeRecord
} from "./content-knowledge-types"
import { getAllBranchContentDetails } from "./branch-meaning-catalog"
import { getAllElementGateContentDetails } from "./element-gate-meaning-catalog"
import { getAllMainStarPalaceCombinationContentDetails } from "./main-star-palace-combination-catalog"
import { getAllNonMainStarPalaceCombinationContentDetails } from "./non-main-star-palace-combination-catalog"
import { getAllPalaceContentDetails } from "./palace-meaning-catalog"
import { getAllPalaceThemeChainEvidenceHitRuleContentDetails } from "./palace-theme-chain-evidence-hit-rule-catalog"
import { getAllPalaceThemeChainEvidenceDomainCrossReferenceContentDetails } from "./palace-theme-chain-evidence-domain-cross-reference-catalog"
import { getAllPalaceThemeChainEvidenceFieldStandardContentDetails } from "./palace-theme-chain-evidence-field-standard-catalog"
import { getAllPalaceThemeChainFieldParagraphReviewMatrixContentDetails } from "./palace-theme-chain-field-paragraph-review-matrix-catalog"
import { getAllPalaceThemeChainOutputParagraphTemplateContentDetails } from "./palace-theme-chain-output-paragraph-template-catalog"
import { getAllPalaceThemeChainResultThresholdContentDetails } from "./palace-theme-chain-result-threshold-catalog"
import { getAllPalaceThemeChainContentDetails } from "./palace-theme-chain-catalog"
import { getAllPalaceThemeChainSynthesisTemplateContentDetails } from "./palace-theme-chain-synthesis-template-catalog"
import { getAllPatternCombinationRelationContentDetails } from "./pattern-combination-relation-catalog"
import { getAllPeriodicStarPalaceCombinationContentDetails } from "./periodic-star-palace-combination-catalog"
import { getAllRelationshipStructureContentDetails } from "./relationship-structure-catalog"
import { getAllStarPairCombinationContentDetails } from "./star-pair-combination-catalog"
import { getAllStemContentDetails } from "./stem-meaning-catalog"
import { getAllTheorySourceReferenceContentDetails } from "./theory-source-reference-catalog"
import { getAllTransformationTargetCombinationContentDetails } from "./transformation-target-combination-catalog"
import { getAllTransformationTopicContentDetails } from "./transformation-topic-catalog"
import {
  buildZiweiPatternContentDictionaryDetail,
  buildZiweiStarContentDictionaryDetail
} from "./content-dictionary-builder"

export const ZIWEI_KNOWLEDGE_SOURCES: ZiweiKnowledgeSource[] = [
  {
    id: "ziwei-star-catalog",
    label: "紫微星曜目录",
    kind: "internal-contract",
    copyrightPolicy: "original-content",
    usageBoundary: "只作为星曜 ID、分类、显示名和别名的唯一项目来源。",
    storageRule: "只存结构化参数，不存外部断语。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-content-dictionary",
    label: "紫微内容数据字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存放项目内原创整理的星曜、格局、读盘步骤和复用场景。",
    storageRule: "允许长期复用到页面、报告、知识检索和知识检索。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-pattern-catalog",
    label: "紫微格局目录",
    kind: "internal-contract",
    copyrightPolicy: "original-content",
    usageBoundary: "只作为格局 ID、分类和可判定条件的唯一项目来源。",
    storageRule: "解释层只能引用条件文本，不能重写成格算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-brightness-table",
    label: "星曜庙旺落陷表",
    kind: "internal-contract",
    copyrightPolicy: "original-content",
    usageBoundary: "只用于读取项目内已经整理的亮度等级。",
    storageRule: "后续新增亮度资料要先进入星曜亮度表，再进入解释层。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-dynamic-flow-rules",
    label: "动态盘算法规则",
    kind: "internal-contract",
    copyrightPolicy: "original-content",
    usageBoundary: "只存大限、流年、流月、流日、流时的项目内算法入口和来源规则。",
    storageRule: "动态资料必须保留盘层，不混入本命固定结论。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-golden-samples",
    label: "紫微黄金样例",
    kind: "golden-sample",
    copyrightPolicy: "original-content",
    usageBoundary: "用于回归测试、人工校盘和后续分析对照。",
    storageRule: "样例只存结构化盘面与项目内分析结果，不存第三方截图文案。",
    reviewStatus: "ready"
  },
  {
    id: "human-calibration-notes",
    label: "人工校准笔记",
    kind: "manual-calibration",
    copyrightPolicy: "metadata-only",
    usageBoundary: "用于记录人工复核结论、差异点和待校准标签。",
    storageRule: "只存自己的观察、索引、页码或来源元信息，不摘录受保护长文。",
    reviewStatus: "needs-human-review"
  },
  {
    id: "external-reference-index",
    label: "外部资料索引",
    kind: "modern-reference-metadata",
    copyrightPolicy: "metadata-only",
    usageBoundary: "只登记书名、版本、主题、页码范围和复核状态。",
    storageRule: "不复制外部软件文案、截图、成套断语或受版权保护段落。",
    reviewStatus: "needs-source-check"
  },
  {
    id: "public-domain-classic-index",
    label: "公版古籍索引",
    kind: "public-domain-reference",
    copyrightPolicy: "public-domain-summary",
    usageBoundary: "只在确认公版状态后存主题摘要和自有解释。",
    storageRule: "优先存结构化摘要；原文摘录必须短、可追溯并单独复核。",
    reviewStatus: "needs-source-check"
  },
  {
    id: "derived-analysis-index",
    label: "派生分析索引",
    kind: "derived-analysis",
    copyrightPolicy: "original-content",
    usageBoundary: "用于存储由当前结构化盘面推导出的统计、标签和后续模型特征。",
    storageRule: "只存可追溯的派生字段，不覆盖原始 catalog 和算法合同。",
    reviewStatus: "ready"
  },
  {
    id: "structured-term-index",
    label: "结构化术语索引",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "用于存储术语、别名、适用范围和后续检索标签。",
    storageRule: "只存自有定义和索引标签，不复制外部辞典原文。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-branch-dictionary",
    label: "十二地支资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储十二地支、四马地、四败地、四墓库地、三合局和盘面空间语义。",
    storageRule: "只存地支语义和分析规则，不重复定义排盘算法中的地支类型。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-stem-dictionary",
    label: "十天干资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储甲乙丙丁戊己庚辛壬癸的阴阳五行、四化语境、宫干语境和动态流干语义。",
    storageRule: "只存天干解释和分析边界，不重新定义天干类型或四化目标表。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-element-gate-dictionary",
    label: "五行局资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储水二局、木三局、金四局、土五局、火六局的局数语义、紫微起例边界和大限节律。",
    storageRule: "只存五行局解释和分析边界，不重新定义五行局算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-dictionary",
    label: "十二宫位资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母的本体语义、关系语义和动态用法。",
    storageRule: "只存宫位解释和分析边界，不重新定义宫位枚举、宫位顺序或排盘算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-main-star-palace-combination-dictionary",
    label: "主星入十二宫组合资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储十四主星进入十二宫位的组合解释、关系复核、动态用法和误读边界。",
    storageRule: "只存组合解释资料，不把组合资料写成当前盘断语或重新定义安星算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-non-main-star-palace-combination-dictionary",
    label: "辅曜煞曜杂曜入十二宫组合资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储辅曜、煞曜、杂曜进入十二宫后的组合解释、助力压力、关系复核、动态盘用法和误读边界。",
    storageRule: "只存非主星入宫解释资料，不把辅曜、煞曜、杂曜写成该宫主轴或重新定义星曜落宫算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-periodic-star-palace-combination-dictionary",
    label: "周期流系星曜入十二宫组合资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储长生十二神、博士十二神、岁前十二神、将前十二神、月系和日时系星曜进入十二宫后的时间层级解释资料。",
    storageRule: "只存周期流系星曜入宫解释资料，必须保留盘层，不把短周期触发写成本命长期结论。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-star-pair-combination-dictionary",
    label: "紫微星曜两两组合资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主星、辅曜、煞曜、杂曜之间的两两组合解释、关系范围、助力压力、动态盘用法和误读边界。",
    storageRule: "只存星曜组合解释资料，不重新定义星曜落宫、格局判定或当前盘断语。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-pattern-combination-relation-dictionary",
    label: "星曜组合与格局关系资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储星曜组合如何参与成格、加吉、加煞、破格和弱承接的资料层。",
    storageRule: "只存组合与格局类别之间的解释边界，不重写具体格局判定条件，不替代当前盘命中结果。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-relationship-structure-dictionary",
    label: "紫微关系结构资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储同宫、对宫、三方四正、邻宫、夹宫、会照、借宫、动态叠盘、宫位链和证据追踪的解释资料。",
    storageRule: "只存关系结构解释和分析边界，不重新定义宫位索引、三方四正算法或动态盘算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-chain-dictionary",
    label: "紫微宫位主题链资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储命财官迁、夫妻福德、田宅父母、疾厄福德等主题链的宫位顺序、证据字段、动态盘读取和误读边界。",
    storageRule: "只存主题链解释资料，不重新定义十二宫位、三方四正算法或当前盘综合断语。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-synthesis-template-dictionary",
    label: "紫微宫位主题链综合解释模板字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链综合解释的输出结构、证据顺序、强弱判断、破格补救、动态盘层级和隐藏未命中规则。",
    storageRule: "只存解释模板和输出边界，不生成当前盘断语，不重新定义宫位链、四化、格局或动态盘算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-hit-rule-dictionary",
    label: "紫微宫位主题链证据命中规则字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链强命中、弱命中、破格命中、修复命中、隐藏条件和动态盘层级命中规则。",
    storageRule: "只存命中规则资料，不直接计算当前盘命中结果，不重新定义星曜、四化、格局或动态盘算法。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-result-threshold-dictionary",
    label: "紫微宫位主题链结果展示门槛字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链结果层级、展示阈值、排序规则、段落输出、证据合并、盘层继承、隐藏抑制和复核升级规则。",
    storageRule: "只存结果展示门槛资料，不直接生成当前盘结论，不替代主题链命中规则或页面展示实现。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-output-paragraph-template-dictionary",
    label: "紫微宫位主题链输出段落模板字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链总论段、证据段、受压段、修复段、动态盘段、复核缺口段和语气边界资料。",
    storageRule: "只存段落组织模板和证据边界，不生成当前盘结论，不替代页面组件或报告渲染实现。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-evidence-field-standard-dictionary",
    label: "紫微宫位主题链证据字段标准字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链证据字段的标准名称、值结构、标准化规则、校验规则、合并规则、展示用途、来源链路和隐藏条件。",
    storageRule: "只存字段标准和证据边界，不重新定义排盘算法、页面实现或当前盘结论。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-field-paragraph-review-matrix-dictionary",
    label: "紫微宫位主题链字段段落复核矩阵字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链证据字段在总论段、证据段、受压段、修复段、动态盘段和复核缺口段中的必需、条件、可选、隐藏和复核规则。",
    storageRule: "只存字段与段落职责关系，不重新定义字段标准、段落模板、页面实现或当前盘结论。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-palace-theme-evidence-domain-cross-reference-dictionary",
    label: "紫微宫位主题链证据域对照字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储主题链证据字段与格局、四化、宫位关系证据域之间的直接、辅助、抑制、复核和上下文关系。",
    storageRule: "只存字段与证据域的对照关系，不重新定义格局判定、四化目标表、宫位关系算法、页面实现或当前盘结论。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-theory-source-reference-dictionary",
    label: "紫微理论来源索引字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储古籍、公版索引、项目算法、项目字典、项目归纳、人工校验和现代资料元信息的来源字段标准。",
    storageRule: "只存来源索引、引用边界和复核状态，不复制现代资料正文、外部软件文案或截图。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-transformation-topic-dictionary",
    label: "紫微四化专题资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储化禄、化权、化科、化忌、十干触发、本命/大限/流年/流月/流日/流时四化和目标星目标宫解释边界。",
    storageRule: "只存四化解释资料和证据字段，不重新定义四化目标表、天干表、动态流算法或星曜落宫。",
    reviewStatus: "ready"
  },
  {
    id: "ziwei-transformation-target-combination-dictionary",
    label: "紫微四化目标星组合资料字典",
    kind: "internal-original-note",
    copyrightPolicy: "original-content",
    usageBoundary: "存储某颗目标星被化禄、化权、化科、化忌触发时的组合解释、宫位读法、盘层读法和证据字段。",
    storageRule: "目标星组合必须由统一四化目标表生成，不手写第二套目标规则，不把组合资料写成当前盘断语。",
    reviewStatus: "ready"
  },
  {
    id: "user-chart-review-notes",
    label: "用户盘面复核笔记",
    kind: "manual-calibration",
    copyrightPolicy: "metadata-only",
    usageBoundary: "用于存储用户确认的盘面差异、时间校验和人工验盘状态。",
    storageRule: "只存结构化复核字段和用户自有输入，不存第三方内容。",
    reviewStatus: "needs-human-review"
  }
]

export const ZIWEI_KNOWLEDGE_TERMS: ZiweiKnowledgeTerm[] = [
  term("term-ming-gong", "命宫", "palace", ["本命命宫"], "本命盘核心观察宫位，用于承接命盘主轴、命格结构和三方四正判断。"),
  term("term-shen-gong", "身宫", "palace", ["身宫"], "行动承接宫位，用于观察后天实践、身体投入和现实执行方式。"),
  term("term-san-fang-si-zheng", "三方四正", "term", ["三方", "四正"], "以本宫、对宫和三合宫位构成的关系范围，是星曜会照和格局复核的重要证据。"),
  term("term-si-ma", "四马地", "branch", ["四生地", "四长生地", "驿马位", "寅申巳亥"], "寅申巳亥四支组成的动象空间，用于观察迁移、启动、奔波、转换、远方牵引和资源流动。"),
  term("term-si-bai", "四败地", "branch", ["四正地", "四旺地", "桃花地", "子午卯酉"], "子午卯酉四支组成的外显空间，用于观察人缘、名声、审美、情感、欲望、曝光和关系牵动。"),
  term("term-si-mu", "四墓库地", "branch", ["四库地", "四墓地", "辰戌丑未"], "辰戌丑未四支组成的收藏空间，用于观察积累、仓库、责任、旧事沉淀、资源承载和长期压力。"),
  term("term-san-he-water", "申子辰水局", "branch", ["水三合"], "申子辰三支组成的水局关系，用于观察流动、信息、智性、情绪暗流和资源循环。"),
  term("term-san-he-wood", "亥卯未木局", "branch", ["木三合"], "亥卯未三支组成的木局关系，用于观察生发、成长、计划、关系延伸和柔性扩张。"),
  term("term-san-he-fire", "寅午戌火局", "branch", ["火三合"], "寅午戌三支组成的火局关系，用于观察行动、表现、热度、声名、推动和外放。"),
  term("term-san-he-metal", "巳酉丑金局", "branch", ["金三合"], "巳酉丑三支组成的金局关系，用于观察规则、执行、收敛、技术、财务和取舍判断。"),
  term("term-ten-stems", "十天干", "stem", ["天干", "甲乙丙丁戊己庚辛壬癸"], "甲乙丙丁戊己庚辛壬癸十个天干，用于承接阴阳五行、四化触发、宫干语境和动态流干分析。"),
  term("term-stem-wood", "甲乙木", "stem", ["木干"], "甲乙同属木，甲偏阳木主干和开端，乙偏阴木主柔性和协调。"),
  term("term-stem-fire", "丙丁火", "stem", ["火干"], "丙丁同属火，丙偏阳火主公开和热度，丁偏阴火主灵感和细火。"),
  term("term-stem-earth", "戊己土", "stem", ["土干"], "戊己同属土，戊偏阳土主平台和边界，己偏阴土主土壤和细密承载。"),
  term("term-stem-metal", "庚辛金", "stem", ["金干"], "庚辛同属金，庚偏阳金主决断和规则，辛偏阴金主标准和精修。"),
  term("term-stem-water", "壬癸水", "stem", ["水干"], "壬癸同属水，壬偏阳水主大流和远方，癸偏阴水主潜流和滋润。"),
  term("term-element-gate", "五行局", "element-gate", ["局数", "水二木三金四土五火六"], "紫微斗数排盘基础之一，水二局、木三局、金四局、土五局、火六局用于紫微起例和大限起龄。"),
  term("term-water-two-gate", "水二局", "element-gate", ["二局"], "五行局之一，以二为局数，带流动、信息、资源循环和柔性变化语义。"),
  term("term-wood-three-gate", "木三局", "element-gate", ["三局"], "五行局之一，以三为局数，带生发、成长、学习、规划和关系延伸语义。"),
  term("term-metal-four-gate", "金四局", "element-gate", ["四局"], "五行局之一，以四为局数，带规则、执行、技术、标准和取舍判断语义。"),
  term("term-earth-five-gate", "土五局", "element-gate", ["五局"], "五行局之一，以五为局数，带承载、整合、平台、责任和长期积累语义。"),
  term("term-fire-six-gate", "火六局", "element-gate", ["六局"], "五行局之一，以六为局数，带表现、热度、行动、名声和推动语义。"),
  term("term-twelve-palaces", "十二宫位", "palace", ["十二宫", "十二人事宫"], "命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母组成的盘面人事主题体系。"),
  term("term-main-star-palace-combination", "主星入十二宫", "combination", ["主星入宫", "星曜入宫组合"], "十四主星进入十二宫位后的组合语义，用于把星曜本体转换到具体宫位主题，但不替代当前盘综合解释。"),
  term("term-non-main-star-palace-combination", "辅煞杂入十二宫", "non-main-combination", ["辅曜入宫", "煞曜入宫", "杂曜入宫"], "辅曜、煞曜、杂曜进入十二宫位后的组合语义，用于补充助力、压力、气氛和细节，不替代主星主轴。"),
  term("term-assistant-star-palace-combination", "辅曜入十二宫", "non-main-combination", ["辅曜入宫", "吉辅入宫"], "左辅、右弼、文昌、文曲、天魁、天钺、禄存、天马进入十二宫后的助力和资源承接资料。"),
  term("term-malefic-star-palace-combination", "煞曜入十二宫", "non-main-combination", ["煞曜入宫", "压力星入宫"], "擎羊、陀罗、火星、铃星、地空、地劫进入十二宫后的压力、阻滞、损耗和修复入口资料。"),
  term("term-misc-star-palace-combination", "杂曜入十二宫", "non-main-combination", ["杂曜入宫", "小星入宫"], "红鸾、天喜、咸池、天姚等杂曜进入十二宫后的细节气氛、关系触发、名声文书和特殊语义资料。"),
  term("term-periodic-star-palace-combination", "周期流系星曜入十二宫", "periodic-combination", ["流系星曜入宫", "周期星入宫"], "长生十二神、博士十二神、岁前十二神、将前十二神、月系和日时系星曜进入十二宫后的时间层级组合资料。"),
  term("term-lifecycle-star-palace-combination", "长生十二神入十二宫", "periodic-combination", ["长生系入宫", "气势阶段入宫"], "长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养进入十二宫后的气势阶段资料。"),
  term("term-yearly-star-palace-combination", "年系星曜入十二宫", "periodic-combination", ["博士岁前将前入宫", "年度星曜入宫"], "博士十二神、岁前十二神和将前十二神进入十二宫后的年度事务、岁运气候和行动风险资料。"),
  term("term-monthly-daily-hourly-palace-combination", "月日时系星曜入十二宫", "periodic-combination", ["月系入宫", "日时系入宫"], "月系、日时系星曜进入十二宫后的短周期和微周期提示资料。"),
  term("term-periodic-flow-layer", "周期流系盘层", "periodic-combination", ["时间层级", "周期层级"], "周期流系星曜所属的本命气势、流年、流月、流日或流时层级，解释时必须保留。"),
  term("term-star-pair-combination", "星曜两两组合", "star-pair-combination", ["星曜组合", "双星组合"], "主星、辅曜、煞曜、杂曜之间两两组合后的可复用解释资料，用于同宫、对宫、三方四正、夹宫和动态叠盘复核。"),
  term("term-main-main-star-combination", "主星双星组合", "star-pair-combination", ["主星同宫", "双主星"], "两个主星之间的组合资料，用于判断宫位主轴的复合结构、互补与牵制。"),
  term("term-main-support-star-combination", "主星辅煞杂组合", "star-pair-combination", ["主辅组合", "主煞组合", "主杂组合"], "主星与辅曜、煞曜、杂曜之间的组合资料，用于判断主轴如何获得助力、承压或出现细节触发。"),
  term("term-support-pressure-star-combination", "辅煞组合", "star-pair-combination", ["辅曜煞曜组合", "助力压力组合"], "辅曜与煞曜之间的组合资料，用于判断助力是否能制化压力，或资源是否被冲突损耗牵制。"),
  term("term-misc-star-pair-combination", "杂曜组合", "star-pair-combination", ["杂曜双星", "小星组合"], "杂曜与主星、辅曜、煞曜或杂曜之间的组合资料，用于补充气氛、关系触发和特殊细节。"),
  term("term-pattern-combination-relation", "星曜组合与格局关系", "pattern-combination-relation", ["组合格局关系", "组合参与格局"], "星曜两两组合如何参与成格、加吉、加煞、破格和弱承接的资料层。"),
  term("term-pattern-formation-support", "组合成格证据", "pattern-combination-relation", ["成格证据", "组合成格"], "当星曜组合落入具体格局要求的同宫、对宫、三方四正或夹宫范围内，可作为成格证据。"),
  term("term-pattern-enhancement-support", "组合加吉增强", "pattern-combination-relation", ["加吉增强", "组合补强"], "星曜组合与格局核心条件同向时，可作为格局层次提升、补强和可承接证据。"),
  term("term-pattern-breakage-pressure", "组合加煞破格", "pattern-combination-relation", ["加煞破格", "组合破格"], "星曜组合冲入格局核心条件时，用于复核破格、代价、阻滞和弱化机制。"),
  term("term-pattern-weak-bearing", "组合弱承接", "pattern-combination-relation", ["弱承接", "外围证据"], "星曜组合只在外围会照、夹宫或短周期动态出现时，作为弱承接和人工复核资料。"),
  term("term-dui-gong", "对宫", "palace", ["冲宫"], "与本宫相对的宫位，用于观察外部牵引、镜像关系和冲照影响。"),
  term("term-jia-gong", "夹宫", "term", ["左右夹"], "左右邻宫对目标宫位形成夹持或辅助的结构，用于复核夹拱、夹煞和贵助格局。"),
  term("term-miao-wang", "庙旺落陷", "brightness", ["庙旺", "落陷"], "星曜在不同地支的发挥稳定度，用于判断主星、部分辅曜和煞曜的承接层次。"),
  term("term-si-hua", "四化", "star", ["化禄", "化权", "化科", "化忌"], "由天干触发的动态星曜属性，用于观察资源、权责、名誉和牵挂的流向。"),
  term("term-da-yun", "大限", "dynamic-flow", ["大运"], "十年层级的动态盘，用于观察阶段性命宫、宫位主题和流动星曜。"),
  term("term-liu-nian", "流年", "dynamic-flow", ["太岁年"], "年度层级的动态盘，用于观察一年内的重点宫位、四化和年系星曜。"),
  term("term-liu-yue", "流月", "dynamic-flow", ["月限"], "月份层级的动态盘，用于观察短周期事件气候和流月命宫。"),
  term("term-liu-ri", "流日", "dynamic-flow", ["日盘"], "日层级的动态盘，用于观察日内触发和短期注意点。"),
  term("term-liu-shi", "流时", "dynamic-flow", ["时盘"], "时辰层级的动态盘，用于观察即时触发和临场状态。"),
  term("term-ji-ge", "吉格", "pattern", ["佳格"], "由主星、辅曜、四化、庙旺和三方四正形成的有利结构。"),
  term("term-xiong-ge", "凶格", "pattern", ["恶格"], "由煞曜、化忌、落陷、空劫或不利组合形成的风险结构。"),
  term("term-po-ge", "破格", "pattern", ["格局受破"], "原有结构被煞忌、空劫、落陷、冲破或证据不足削弱的状态。"),
  term("term-jia-ji", "加吉", "pattern", ["加会吉曜"], "吉曜、禄权科、庙旺或辅佐结构对格局形成增强。"),
  term("term-jia-sha", "加煞", "pattern", ["煞曜加会"], "羊陀火铃空劫等压力星进入结构，增加代价、阻力或破格风险。"),
  term("term-tong-gong", "同宫", "palace", ["同度"], "多个星曜落在同一宫位，优先判断彼此性质是否协同或冲突。"),
  term("term-hui-zhao", "会照", "term", ["会合", "照会"], "星曜在三方四正范围内对目标宫位产生支援、牵制或触发。"),
  term("term-source-rule", "来源规则", "term", ["sourceRuleId"], "项目内用于追溯星曜落点、亮度、格局或动态盘计算来源的规则标识。"),
  term("term-calibration-gap", "校准缺口", "term", ["待复核"], "资料、算法、样例或人工验盘中尚未闭合的复核项。"),
  term("term-no-direct-copy", "版权边界", "term", ["侵权边界"], "资料库只存自有整理、结构化事实、来源元信息和短摘要，不复制外部成套表达。"),
  term("term-xiong-di", "兄弟宫", "palace", ["兄弟"], "观察手足、同辈、协作网络和横向关系承接的宫位。"),
  term("term-fu-qi", "夫妻宫", "palace", ["配偶宫"], "观察伴侣关系、亲密互动、婚恋模式和关系承接的宫位。"),
  term("term-zi-nv", "子女宫", "palace", ["子息宫"], "观察子女、作品、创造延伸和照护关系的宫位。"),
  term("term-cai-bo", "财帛宫", "palace", ["财宫"], "观察收入方式、资源流动、财务承接和价值交换的宫位。"),
  term("term-ji-e", "疾厄宫", "palace", ["疾厄"], "观察身心压力、健康倾向、风险承接和修复路径的宫位。"),
  term("term-qian-yi", "迁移宫", "palace", ["迁移"], "观察外部环境、出行、发展空间和社会场域的宫位。"),
  term("term-jiao-you", "交友宫", "palace", ["仆役宫", "奴仆宫"], "观察朋友、团队、下属、社群和协作对象的宫位。"),
  term("term-guan-lu", "官禄宫", "palace", ["事业宫"], "观察事业路径、职能角色、责任结构和社会成就的宫位。"),
  term("term-tian-zhai", "田宅宫", "palace", ["田宅"], "观察家庭根基、不动产、居住环境和长期积累的宫位。"),
  term("term-fu-de", "福德宫", "palace", ["福德"], "观察精神状态、享受能力、内在满足和长期福分的宫位。"),
  term("term-fu-mu", "父母宫", "palace", ["相貌宫"], "观察父母、长辈、文书、背景支持和上级关系的宫位。"),
  term("term-main-star", "主星", "star", ["甲级主星"], "盘面核心骨架星曜，用于判断宫位主轴和人生议题。"),
  term("term-assistant-star", "辅曜", "star", ["吉辅"], "用于补强、润色、协作和贵人结构的星曜类别。"),
  term("term-malefic-star", "煞曜", "star", ["煞星"], "用于提示压力、冲突、代价和修复入口的星曜类别。"),
  term("term-misc-star", "杂曜", "star", ["小星"], "用于补充气氛、细节、关系触发和特殊结构的星曜类别。"),
  term("term-lifecycle-star", "长生十二神", "star", ["长生系"], "描述气势从发生、旺盛、衰退到收藏再孕育的周期星曜。"),
  term("term-yearly-star", "年系星曜", "dynamic-flow", ["博士岁前将前"], "流年层级使用的博士、岁前、将前等年度触发星曜。"),
  term("term-monthly-star", "月系星曜", "dynamic-flow", ["月曜"], "流月层级用于补充短周期情绪、环境和事件气候的星曜。"),
  term("term-daily-hourly-star", "日时系星曜", "dynamic-flow", ["日时曜"], "流日、流时层级用于描述即时触发和临场状态的星曜。"),
  term("term-miao", "庙", "brightness", ["入庙"], "星曜在该地支发挥稳固、承接力较强的亮度状态。"),
  term("term-wang", "旺", "brightness", ["旺地"], "星曜在该地支气势较足、发挥较顺的亮度状态。"),
  term("term-de", "得", "brightness", ["得地"], "星曜在该地支有一定承接，表现相对可用的亮度状态。"),
  term("term-li", "利", "brightness", ["利益"], "星曜在该地支仍有发挥空间，但需要结合组合判断的亮度状态。"),
  term("term-ping", "平", "brightness", ["平地"], "星曜在该地支表现中性，需要更多依赖同宫和三方四正判断。"),
  term("term-xian", "陷", "brightness", ["落陷"], "星曜在该地支发挥费力、偏折或需要补救的亮度状态。"),
  term("term-bu-lun", "不论", "brightness", ["无固定表"], "该星曜当前不按固定庙旺落陷表解释，需看组合、宫位和盘层。"),
  term("term-liu-lu", "流禄", "dynamic-flow", ["流年禄"], "动态盘中按流干触发的禄星或化禄类资源信号。"),
  term("term-liu-yang", "流羊", "dynamic-flow", ["流擎羊"], "动态盘中按流干触发的羊刃压力信号。"),
  term("term-liu-tuo", "流陀", "dynamic-flow", ["流陀罗"], "动态盘中按流干触发的拖延、阻滞或牵制信号。"),
  term("term-liu-ma", "流马", "dynamic-flow", ["流天马"], "动态盘中按流支触发的移动、变动和外出信号。"),
  term("term-golden-sample", "黄金样例", "sample", ["golden sample"], "用于回归测试、算法校准和页面验收的结构化样例盘。"),
  term("term-human-review", "人工复核", "calibration", ["人工校准"], "由人工对算法、页面、样例或资料来源进行确认和标注的过程。"),
  term("term-source-metadata", "来源元信息", "source", ["source metadata"], "只记录来源名称、主题、版本、页码范围、链接和复核状态，不存受保护正文。"),
  term("term-chong-zhao", "冲照", "relationship", ["对宫照会", "对照"], "目标宫位与对宫之间形成的相对照应关系，用于观察外部牵引、对象反馈和压力来源。"),
  term("term-jie-gong", "借宫", "relationship", ["借对宫", "空宫借星"], "当目标宫位主轴不足或空宫时，从对宫和三方四正补充观察，但不改变星曜原始落宫。"),
  term("term-dynamic-overlay", "动态叠盘", "relationship", ["流盘叠本命", "盘层叠加"], "本命、大限、流年、流月、流日、流时之间的层级叠加关系，必须保留当前查看盘层。"),
  term("term-palace-chain", "宫位链", "relationship", ["主题链", "关系链"], "围绕同一问题把多个宫位组织成复核路径，用于报告和后续分析，不替代排盘算法。"),
  term("term-palace-theme-chain", "宫位主题链", "palace-theme-chain", ["主题链", "问题链", "宫位复核链"], "围绕事业、关系、家庭、财务、身心、社交等主题，把多个宫位按证据路径组织起来的资料层。"),
  term("term-ming-cai-guan-qian-chain", "命财官迁链", "palace-theme-chain", ["命财官迁", "自我事业资源链"], "以命宫、财帛、官禄、迁移为核心，复核自我主轴、资源、事业和外部发展的主题链。"),
  term("term-fu-qi-fu-de-chain", "夫妻福德链", "palace-theme-chain", ["夫妻福德", "关系内在链"], "以夫妻、福德、命宫、迁移等宫位复核亲密关系、内在满足、自我承接和外部反馈的主题链。"),
  term("term-tian-zhai-fu-mu-chain", "田宅父母链", "palace-theme-chain", ["家庭根基链", "田宅父母福德"], "以田宅、父母、福德、命宫等宫位复核家庭根基、长辈背景、文书制度和安全感的主题链。"),
  term("term-ji-e-fu-de-chain", "疾厄福德链", "palace-theme-chain", ["身心修复链", "压力修复链"], "以疾厄、福德、命宫、父母等宫位复核身心承压、精神缓冲、背景压力和修复路径的主题链。"),
  term("term-palace-theme-synthesis-template", "主题链综合解释模板", "palace-theme-template", ["主题链模板", "综合解释模板"], "把宫位主题链转换为可输出解释的结构，包含总论、证据顺序、强弱判断、破格补救、动态盘层级和隐藏未命中规则。"),
  term("term-theme-evidence-order", "主题链证据顺序", "palace-theme-template", ["证据顺序", "输出顺序"], "主题链解释时先看主宫，再看辅助宫、对宫、三方四正、动态盘层和来源规则的顺序。"),
  term("term-theme-strength-rule", "主题链强弱规则", "palace-theme-template", ["强承接", "弱承接"], "判断主题链是否形成强承接、弱承接、受压、破格或待复核的模板规则。"),
  term("term-theme-hidden-result-rule", "主题链隐藏规则", "palace-theme-template", ["隐藏未命中", "只显示命中"], "当前盘没有命中证据时隐藏对应解释段，避免把资料字典内容展示成盘中结果。"),
  term("term-theme-dynamic-template", "主题链动态模板", "palace-theme-template", ["动态盘模板", "盘层模板"], "主题链在本命、大限、流年、流月、流日和流时中的输出层级和降权规则。"),
  term("term-palace-theme-hit-rule", "主题链命中规则", "palace-theme-hit-rule", ["命中规则", "证据命中"], "判断主题链是否可以输出解释的资料层，区分强命中、弱命中、破格命中、修复命中和隐藏条件。"),
  term("term-theme-strong-hit", "主题链强命中", "palace-theme-hit-rule", ["强命中", "强承接命中"], "主宫和辅助宫同时有可追溯证据，且动态盘层级明确时，主题链可以输出较强承接解释。"),
  term("term-theme-weak-hit", "主题链弱命中", "palace-theme-hit-rule", ["弱命中", "弱承接命中"], "主题链只有单宫、外围或短周期证据时，只能输出提示，不输出完整结论。"),
  term("term-theme-breakage-hit", "主题链破格命中", "palace-theme-hit-rule", ["破格命中", "受压命中"], "主题链出现煞忌、空劫、落陷、破格或承接断裂证据时，优先输出受压和修复路径。"),
  term("term-theme-hidden-hit", "主题链隐藏未命中", "palace-theme-hit-rule", ["未命中隐藏", "隐藏条件"], "当前盘缺少主题链必要证据、来源规则或动态流未启用时，隐藏对应解释段。"),
  term("term-palace-theme-result-threshold", "主题链展示门槛", "palace-theme-result-threshold", ["结果门槛", "展示阈值"], "判断主题链结果是否显示、显示到哪个层级、如何排序和何时隐藏的资料层。"),
  term("term-palace-theme-display-tier", "主题链结果层级", "palace-theme-result-threshold", ["displayTier", "结果层级"], "主题链结果的 strong、weak、breakage、repair、hidden 等展示层级。"),
  term("term-palace-theme-ranking-rule", "主题链排序规则", "palace-theme-result-threshold", ["排序规则", "结果排序"], "多个主题链结果同时存在时，按主宫、证据完整度、破格风险、修复证据和动态层级排序的规则。"),
  term("term-palace-theme-layer-inheritance", "主题链盘层继承", "palace-theme-result-threshold", ["盘层继承", "层级继承"], "大限、流年、流月、流日、流时结果展示时保留上级盘层背景并降权短周期的规则。"),
  term("term-palace-theme-suppression", "主题链隐藏抑制", "palace-theme-result-threshold", ["隐藏抑制", "未命中抑制"], "未命中、缺来源、未启用流层、高风险断语或只有泛化资料时抑制输出的规则。"),
  term("term-palace-theme-output-paragraph-template", "主题链段落模板", "palace-theme-paragraph-template", ["输出段落模板", "段落模板"], "主题链结果进入输出后，组织总论、证据、受压、修复、动态盘和复核缺口段落的资料层。"),
  term("term-palace-theme-summary-paragraph", "主题链总论段", "palace-theme-paragraph-template", ["总论段", "summary"], "主题链命中后用于概括当前主题的段落，只能基于盘中证据输出。"),
  term("term-palace-theme-evidence-paragraph", "主题链证据段", "palace-theme-paragraph-template", ["证据段", "evidence"], "列出主宫、辅助宫、星曜、四化、格局、动态盘和 sourceRuleIds 的段落。"),
  term("term-palace-theme-pressure-paragraph", "主题链受压段", "palace-theme-paragraph-template", ["受压段", "pressure"], "只在破格、煞忌、落陷、空劫或来源冲突存在时展示的风险段落。"),
  term("term-palace-theme-repair-paragraph", "主题链修复段", "palace-theme-paragraph-template", ["修复段", "repair"], "只在化科、化禄、辅曜、庙旺或三方四正补强存在时展示的修复段落。"),
  term("term-palace-theme-dynamic-paragraph", "主题链动态盘段", "palace-theme-paragraph-template", ["动态盘段", "dynamic"], "按本命、大限、流年、流月、流日、流时组织动态触发和盘层继承的段落。"),
  term("term-palace-theme-review-paragraph", "主题链复核缺口段", "palace-theme-paragraph-template", ["复核缺口段", "review"], "证据不足、来源冲突、层级冲突或高风险主题需要人工核对时展示的段落。"),
  term("term-palace-theme-evidence-field-standard", "主题链证据字段标准", "palace-theme-evidence-field", ["字段标准", "证据字段"], "主题链证据字段的统一定义层，用于约束字段名、值结构、标准化、校验、合并、展示、来源和隐藏条件。"),
  term("term-palace-theme-evidence-palaces", "主题链证据宫位", "palace-theme-evidence-field", ["evidencePalaces", "证据宫位"], "主题链中实际提供证据的宫位集合，必须保留本宫、对宫、三方四正和盘层来源。"),
  term("term-palace-theme-evidence-stars", "主题链证据星曜", "palace-theme-evidence-field", ["evidenceStars", "证据星曜"], "主题链中实际参与判断的星曜集合，必须保留星曜 ID、宫位、亮度和盘层来源。"),
  term("term-palace-theme-source-rule-ids", "主题链来源规则", "palace-theme-evidence-field", ["sourceRuleIds", "来源规则"], "主题链每条证据反查命中规则、展示门槛、段落模板和资料来源的稳定 ID 列表。"),
  term("term-palace-theme-display-tier-field", "主题链展示层级字段", "palace-theme-evidence-field", ["displayTier", "展示层级字段"], "主题链结果进入 strong、weak、breakage、repair、hidden 等展示层级时使用的字段标准。"),
  term("term-palace-theme-paragraph-type-field", "主题链段落类型字段", "palace-theme-evidence-field", ["paragraphType", "段落类型字段"], "主题链总论、证据、受压、修复、动态盘和复核缺口段的字段标准。"),
  term("term-palace-theme-chart-layer-field", "主题链盘层字段", "palace-theme-evidence-field", ["chartLayer", "盘层字段"], "主题链证据所属本命、大限、流年、流月、流日或流时层级的字段标准。"),
  term("term-palace-theme-review-flags", "主题链复核标记", "palace-theme-evidence-field", ["reviewFlags", "复核标记"], "主题链证据缺失、来源冲突、层级冲突或高风险主题进入人工复核时使用的字段标准。"),
  term("term-palace-theme-field-paragraph-matrix", "主题链字段段落矩阵", "palace-theme-field-paragraph-matrix", ["字段段落矩阵", "段落复核矩阵"], "主题链证据字段在不同段落中的必需、条件、可选、隐藏和复核关系资料层。"),
  term("term-palace-theme-summary-field-rule", "总论段字段规则", "palace-theme-field-paragraph-matrix", ["summary 字段规则", "总论字段"], "总论段只能读取主宫、展示层级、来源规则和当前盘核心证据，不展开未命中资料。"),
  term("term-palace-theme-evidence-field-rule", "证据段字段规则", "palace-theme-field-paragraph-matrix", ["evidence 字段规则", "证据字段"], "证据段必须列出当前盘真实存在的宫位、星曜、四化、亮度、格局和来源字段。"),
  term("term-palace-theme-pressure-field-rule", "受压段字段规则", "palace-theme-field-paragraph-matrix", ["pressure 字段规则", "受压字段"], "受压段只在破格、煞忌、落陷、空劫、来源冲突或承接不足存在时打开。"),
  term("term-palace-theme-repair-field-rule", "修复段字段规则", "palace-theme-field-paragraph-matrix", ["repair 字段规则", "修复字段"], "修复段只在化科、化禄、辅曜、庙旺、三方四正补强或可承接证据存在时打开。"),
  term("term-palace-theme-dynamic-field-rule", "动态盘段字段规则", "palace-theme-field-paragraph-matrix", ["dynamic 字段规则", "动态字段"], "动态盘段必须保留本命、大限、流年、流月、流日、流时的盘层继承和短周期降权。"),
  term("term-palace-theme-review-field-rule", "复核缺口段字段规则", "palace-theme-field-paragraph-matrix", ["review 字段规则", "复核字段"], "复核缺口段用于承接字段缺失、来源冲突、层级冲突、展示层级冲突和高风险主题。"),
  term("term-palace-theme-requirement-level", "字段要求等级", "palace-theme-field-paragraph-matrix", ["required", "conditional", "optional", "hidden", "review"], "字段在某个段落中的 required、conditional、optional、hidden 或 review 等级。"),
  term("term-palace-theme-evidence-domain-cross-reference", "主题链证据域对照", "palace-theme-evidence-domain-cross-reference", ["证据域对照", "字段证据域"], "主题链字段与格局、四化、宫位关系证据域之间的关系资料层。"),
  term("term-palace-theme-pattern-domain", "主题链格局证据域", "palace-theme-evidence-domain-cross-reference", ["格局证据域", "pattern domain"], "主题链字段参与格局命中、破格、加吉、加煞和弱承接时的证据域。"),
  term("term-palace-theme-transformation-domain", "主题链四化证据域", "palace-theme-evidence-domain-cross-reference", ["四化证据域", "transformation domain"], "主题链字段承接化禄、化权、化科、化忌、来源天干、目标星和目标宫时的证据域。"),
  term("term-palace-theme-palace-relation-domain", "主题链宫位关系证据域", "palace-theme-evidence-domain-cross-reference", ["宫位关系证据域", "palace relation domain"], "主题链字段承接主宫、辅助宫、对宫、三方四正、同宫、夹宫和动态叠盘时的证据域。"),
  term("term-palace-theme-direct-evidence-role", "直接证据角色", "palace-theme-evidence-domain-cross-reference", ["direct evidence", "直接字段"], "字段在证据域中能直接打开该域判断，但仍必须有当前盘证据和 sourceRuleIds。"),
  term("term-palace-theme-support-evidence-role", "辅助证据角色", "palace-theme-evidence-domain-cross-reference", ["support evidence", "辅助字段"], "字段在证据域中只能补充判断，不能单独打开结论。"),
  term("term-palace-theme-suppression-evidence-role", "抑制证据角色", "palace-theme-evidence-domain-cross-reference", ["suppression evidence", "抑制字段"], "字段命中时用于抑制泛化结论，优先进入受压、隐藏或复核路径。"),
  term("term-palace-theme-review-evidence-role", "复核证据角色", "palace-theme-evidence-domain-cross-reference", ["review evidence", "复核字段"], "字段命中时需要说明复核原因，不直接生成格局、四化或宫位关系结论。"),
  term("term-theory-source-reference", "理论来源索引", "theory-source-reference", ["sourceReferences", "来源索引"], "数据字典条目用于标明古籍、公版索引、项目算法、项目字典、项目归纳、人工校验或现代资料元信息来源的结构化索引。"),
  term("term-classic-source", "古籍来源", "theory-source-reference", ["classic source", "古籍索引"], "已知古籍或公版古籍影印条目的来源类型，只能作为理论线索或版本索引，不能直接复制长段原文。"),
  term("term-project-algorithm-source", "项目算法来源", "theory-source-reference", ["algorithm source", "算法来源"], "项目代码中稳定定义的排盘、四化、亮度、动态流或格局判定来源，是运行时规则的高可信来源。"),
  term("term-project-dictionary-source", "项目字典来源", "theory-source-reference", ["dictionary source", "字典来源"], "项目原创整理的数据字典来源，用于解释星曜、宫位、组合、格局和主题链资料。"),
  term("term-internal-synthesis-source", "项目归纳来源", "theory-source-reference", ["internal synthesis", "归纳来源"], "项目根据结构化资料归纳出的读盘顺序、优先级、降权和复核边界，必须标明不是古籍原文。"),
  term("term-manual-calibration-source", "人工校验来源", "theory-source-reference", ["manual calibration", "人工复核来源"], "人工校盘、样例复核、争议项确认和资料差异记录的来源类型。"),
  term("term-modern-reference-metadata-source", "现代资料元信息", "theory-source-reference", ["metadata-only", "现代资料索引"], "现代书籍、课程、网站或软件资料只登记书名、版本、页码、主题、链接和复核状态，不复制正文或截图。"),
  term("term-citation-usage-boundary", "引用边界", "theory-source-reference", ["citation boundary", "引用规则"], "每条资料必须说明可引用范围、禁止复制内容、版权策略和复核要求。"),
  term("term-evidence-trace", "证据追踪", "relationship", ["来源追踪", "规则追踪"], "解释内容回到 starId、sectorName、patternId、sourceRuleId 或动态盘层的追溯机制。"),
  term("term-transformation-topic", "四化专题", "transformation-topic", ["禄权科忌专题", "四化资料层"], "把化禄、化权、化科、化忌、十干触发、盘层来源、目标星和目标宫拆开存储的资料层。"),
  term("term-transformation-source-stem", "四化来源天干", "transformation-topic", ["sourceStem", "触发天干"], "触发四化目标表的天干来源，解释时必须区分本命年干和动态流干。"),
  term("term-transformation-target-star", "四化目标星", "transformation-topic", ["targetStarId", "目标星曜"], "被化禄、化权、化科或化忌标记的目标星曜，是四化解释的第一承接对象。"),
  term("term-transformation-target-palace", "四化目标宫", "transformation-topic", ["targetPalace", "落宫主题"], "四化目标星所在宫位，决定四化进入哪一个人事主题。"),
  term("term-transformation-flow-layer", "四化盘层", "transformation-topic", ["本命四化", "大限四化", "流年四化", "流月四化", "流日四化", "流时四化"], "四化所属时间层级，用于区分长期底盘、十年阶段、年度触发和短周期提示。"),
  term("term-transformation-target-combination", "四化目标星组合", "transformation-target", ["目标星化象", "星曜四化组合"], "某颗星被化禄、化权、化科或化忌触发后的组合资料，用于解释目标星如何承接化象。"),
  term("term-transformation-target-bearing", "目标星承接", "transformation-target", ["承接星", "被化承接"], "目标星保留自身星性、类别和落宫语境，再承接四化带来的资源、权责、名誉或牵挂。"),
  term("term-transformation-stem-target-map", "十干目标映射", "transformation-target", ["四化目标表", "天干四化映射"], "甲乙丙丁戊己庚辛壬癸触发四化目标星的唯一映射来源，资料层只引用不重写。")
]

export const ZIWEI_KNOWLEDGE_INTAKE_PACKS: ZiweiKnowledgeIntakePack[] = [
  intakePack("intake-star-core", "星曜基础资料包", "存储星曜身份、别名、分类、阴阳五行和核心象义。", ["星曜 ID", "显示名", "别名", "分类", "自有摘要"], ["外部整段星曜断语", "截图说明"], ["ziwei-star-catalog", "ziwei-content-dictionary"], ["star.dictionary", "search.index"]),
  intakePack("intake-branch-space", "十二地支空间资料包", "存储子丑寅卯辰巳午未申酉戌亥、四马地、四败地、四墓库地、三合局和空间语义。", ["地支 ID", "地支中文", "分组", "方位", "季节", "入宫语义"], ["把地支资料写成排盘算法"], ["ziwei-branch-dictionary"], ["branch.dictionary", "palace.space"]),
  intakePack("intake-stem-space", "十天干资料包", "存储甲乙丙丁戊己庚辛壬癸、阴阳五行、四化语境、宫干用法和动态流干语义。", ["天干 ID", "天干中文", "阴阳", "五行", "四化用法", "宫干语义"], ["把天干资料写成四化目标算法"], ["ziwei-stem-dictionary"], ["stem.dictionary", "search.index"]),
  intakePack("intake-element-gate", "五行局资料包", "存储水二局、木三局、金四局、土五局、火六局的局数、象义、紫微起例边界和大限节律。", ["五行局 ID", "局数", "五行", "紫微起例边界", "大限节律"], ["把五行局资料写成紫微起星算法"], ["ziwei-element-gate-dictionary"], ["element-gate.dictionary", "chart.foundation"]),
  intakePack("intake-palace-core", "十二宫位本体资料包", "存储十二宫位的本体定位、核心问题、星曜入宫读法、宫位关系、动态盘用法和误读边界。", ["宫位 ID", "宫位中文", "本体定位", "观察问题", "动态用法"], ["把宫位资料写成排盘算法"], ["ziwei-palace-dictionary"], ["palace.dictionary", "palace.relation"]),
  intakePack("intake-main-star-palace-combination", "主星入宫组合资料包", "存储十四主星进入十二宫位后的组合解释、分析重点、有利信号、风险信号和动态用法。", ["主星 ID", "宫位 ID", "组合解释", "关系复核", "误读边界"], ["把组合资料写成当前盘最终断语"], ["ziwei-main-star-palace-combination-dictionary"], ["star-palace-combination.dictionary", "star.palace"]),
  intakePack("intake-non-main-star-palace-combination", "辅煞杂入宫组合资料包", "存储辅曜、煞曜、杂曜进入十二宫位后的组合解释、助力信号、压力信号、关系复核和动态用法。", ["星曜 ID", "星曜类别", "宫位 ID", "组合解释", "证据字段", "误读边界"], ["把非主星资料写成当前盘最终断语", "把辅曜煞曜杂曜写成该宫主轴"], ["ziwei-non-main-star-palace-combination-dictionary", "ziwei-star-catalog", "ziwei-palace-dictionary"], ["non-main-star-palace-combination.dictionary", "star.palace", "search.index"]),
  intakePack("intake-periodic-star-palace-combination", "周期流系星曜入宫组合资料包", "存储长生十二神、博士十二神、岁前十二神、将前十二神、月系和日时系星曜进入十二宫后的时间层级解释资料。", ["星曜 ID", "周期分组", "宫位 ID", "盘层", "组合解释", "证据字段", "误读边界"], ["把短周期星曜写成本命长期结论", "混淆博士、岁前、将前、月系和日时系"], ["ziwei-periodic-star-palace-combination-dictionary", "ziwei-star-catalog", "ziwei-palace-dictionary", "ziwei-dynamic-flow-rules"], ["periodic-star-palace-combination.dictionary", "dynamic-flow.dictionary", "search.index"]),
  intakePack("intake-star-palace", "星曜入宫资料包", "存储星曜进入十二宫时的观察维度和分析标签。", ["宫位名", "星曜 ID", "入宫主题", "复核问题"], ["外部逐宫整段断语"], ["ziwei-content-dictionary"], ["star.palace", "analysis.feature-source"]),
  intakePack("intake-star-brightness", "庙旺落陷资料包", "存储星曜亮度等级、来源规则和亮度解释边界。", ["星曜 ID", "地支", "亮度等级", "sourceRuleId"], ["无来源的亮度表"], ["ziwei-brightness-table"], ["brightness.table", "analysis.feature-source"]),
  intakePack("intake-star-combination", "星曜组合资料包", "存储主星、辅曜、煞曜、杂曜之间的两两组合、同宫、会照、夹拱、加吉、加煞和复核路径。", ["组合 ID", "星曜 A", "星曜 B", "组合分类", "关系范围", "助力压力", "证据字段", "误读边界"], ["外部成套组合口诀", "把组合资料写成当前盘最终断语"], ["ziwei-star-pair-combination-dictionary", "ziwei-star-catalog", "ziwei-content-dictionary"], ["star-pair-combination.dictionary", "star.combination", "pattern.dictionary"]),
  intakePack("intake-pattern-combination-relation", "星曜组合与格局关系资料包", "存储星曜组合如何参与成格、加吉、加煞、破格、弱承接和格局复核。", ["关系 ID", "星曜组合分组", "格局类别", "关系角色", "成格用法", "破格用法", "证据字段"], ["重写具体格局判定条件", "把未命中组合写成命中格局"], ["ziwei-pattern-combination-relation-dictionary", "ziwei-star-pair-combination-dictionary", "ziwei-pattern-catalog"], ["pattern-combination-relation.dictionary", "pattern.dictionary", "star.combination"]),
  intakePack("intake-pattern-formation", "格局成格资料包", "存储格局核心条件、证据清单和相关宫位。", ["patternId", "conditionText", "证据字段", "范围"], ["重写算法条件"], ["ziwei-pattern-catalog"], ["pattern.dictionary", "pattern.condition"]),
  intakePack("intake-pattern-breakage", "格局破格资料包", "存储破格、弱化、反复、风险和复核字段。", ["破格信号", "煞忌字段", "庙陷字段", "人工备注"], ["恐吓式断语"], ["ziwei-content-dictionary", "human-calibration-notes"], ["pattern.breakage", "calibration.queue"]),
  intakePack("intake-dynamic-flow", "动态盘资料包", "存储大限、流年、流月、流日、流时的盘层数据。", ["flowType", "流干", "流支", "动态命宫", "动态星曜"], ["混入本命固定结论"], ["ziwei-dynamic-flow-rules"], ["dynamic-flow.dictionary", "analysis.feature-source"]),
  intakePack("intake-palace-relation", "宫位关系资料包", "存储本宫、对宫、三方四正、夹宫和邻宫资料。", ["宫位", "关系类型", "目标宫位", "星曜摘要"], ["无盘面证据的关系结论"], ["derived-analysis-index"], ["palace.relation", "search.index"]),
  intakePack("intake-relationship-structure", "关系结构资料包", "存储同宫、对宫、三方四正、邻宫、夹宫、会照、借宫、动态叠盘、宫位链和证据追踪资料。", ["关系 ID", "关系名称", "证据用法", "算法边界", "动态盘边界"], ["把关系解释写成宫位算法"], ["ziwei-relationship-structure-dictionary"], ["relationship.dictionary", "palace.relation", "search.index"]),
  intakePack("intake-palace-theme-chain", "宫位主题链资料包", "存储事业、关系、家庭、身心、财务、社交等主题链的宫位顺序、主宫、辅助宫、星曜读取、四化读取、动态盘读取和证据字段。", ["主题链 ID", "主题分类", "主宫", "辅助宫", "宫位顺序", "星曜读取", "四化读取", "动态盘读取", "证据字段"], ["把主题链写成当前盘最终断语", "重新定义十二宫位和三方四正算法"], ["ziwei-palace-theme-chain-dictionary", "ziwei-palace-dictionary", "ziwei-relationship-structure-dictionary"], ["palace-theme-chain.dictionary", "palace.relation", "search.index"]),
  intakePack("intake-palace-theme-synthesis-template", "宫位主题链综合解释模板资料包", "存储主题链综合解释的总论模板、输出结构、证据顺序、强弱规则、破格规则、修复规则、动态盘层级、隐藏未命中规则和来源字段。", ["模板 ID", "主题链 ID", "输出结构", "证据顺序", "强弱规则", "破格规则", "修复规则", "动态盘层级", "隐藏规则", "来源字段"], ["把模板输出写成当前盘断语", "没有命中证据也展示模板段落"], ["ziwei-palace-theme-synthesis-template-dictionary", "ziwei-palace-theme-chain-dictionary"], ["palace-theme-template.dictionary", "palace-theme-chain.dictionary", "search.index"]),
  intakePack("intake-palace-theme-hit-rule", "宫位主题链证据命中规则资料包", "存储主题链必要证据、强命中、弱命中、破格命中、修复命中、隐藏条件、动态盘层级命中规则和来源字段。", ["规则 ID", "主题链 ID", "模板 ID", "必要证据", "强命中", "弱命中", "破格命中", "修复命中", "隐藏条件", "动态盘命中", "来源字段"], ["把命中规则直接写成当前盘命中结果", "无证据仍展示解释段"], ["ziwei-palace-theme-hit-rule-dictionary", "ziwei-palace-theme-synthesis-template-dictionary", "ziwei-palace-theme-chain-dictionary"], ["palace-theme-hit-rule.dictionary", "palace-theme-template.dictionary", "search.index"]),
  intakePack("intake-palace-theme-result-threshold", "宫位主题链结果展示门槛资料包", "存储主题链结果层级、展示阈值、排序、段落输出、证据合并、盘层继承、隐藏抑制和复核升级规则。", ["门槛 ID", "规则 ID", "主题链 ID", "模板 ID", "结果层级", "展示阈值", "排序规则", "段落输出", "证据合并", "盘层继承", "隐藏抑制", "复核升级", "来源字段"], ["把展示门槛写成页面实现", "把门槛规则写成当前盘结论", "没有盘中证据仍打开段落"], ["ziwei-palace-theme-result-threshold-dictionary", "ziwei-palace-theme-hit-rule-dictionary", "ziwei-palace-theme-synthesis-template-dictionary"], ["palace-theme-result-threshold.dictionary", "palace-theme-hit-rule.dictionary", "search.index"]),
  intakePack("intake-palace-theme-output-paragraph-template", "宫位主题链输出段落模板资料包", "存储主题链总论段、证据段、受压段、修复段、动态盘段、复核缺口段、语气边界和来源字段。", ["段落模板 ID", "门槛 ID", "规则 ID", "主题链 ID", "段落类型", "总论段", "证据段", "受压段", "修复段", "动态盘段", "复核缺口段", "语气边界", "来源字段"], ["把段落模板写成当前盘结论", "没有命中证据仍输出段落", "把页面排版规则混入资料字典"], ["ziwei-palace-theme-output-paragraph-template-dictionary", "ziwei-palace-theme-result-threshold-dictionary"], ["palace-theme-paragraph-template.dictionary", "palace-theme-result-threshold.dictionary", "search.index"]),
  intakePack("intake-palace-theme-evidence-field-standard", "宫位主题链证据字段标准资料包", "存储主题链字段名称、值结构、适用范围、标准化规则、校验规则、合并规则、展示用途、来源链路和隐藏条件。", ["字段 ID", "字段名", "字段分类", "值结构", "适用范围", "标准化规则", "校验规则", "合并规则", "展示用途", "来源链路", "隐藏条件"], ["把字段标准写成页面实现", "重复定义已有参数", "用中文自由文本替代稳定枚举"], ["ziwei-palace-theme-evidence-field-standard-dictionary", "ziwei-palace-theme-output-paragraph-template-dictionary"], ["palace-theme-evidence-field.dictionary", "palace-theme-paragraph-template.dictionary", "search.index"]),
  intakePack("intake-palace-theme-field-paragraph-review-matrix", "宫位主题链字段段落复核矩阵资料包", "存储主题链字段在六类段落中的要求等级、必需条件、可选条件、隐藏条件、复核触发、合并规则、展示规则和来源链路。", ["矩阵 ID", "字段 ID", "字段名", "段落类型", "要求等级", "必需条件", "可选条件", "隐藏条件", "复核触发", "合并规则", "展示规则", "来源链路"], ["把矩阵写成当前盘结论", "重复定义字段标准", "把页面排版规则写入资料字典"], ["ziwei-palace-theme-field-paragraph-review-matrix-dictionary", "ziwei-palace-theme-evidence-field-standard-dictionary", "ziwei-palace-theme-output-paragraph-template-dictionary"], ["palace-theme-field-paragraph-matrix.dictionary", "palace-theme-evidence-field.dictionary", "search.index"]),
  intakePack("intake-palace-theme-evidence-domain-cross-reference", "宫位主题链证据域对照资料包", "存储主题链字段与格局、四化、宫位关系证据域之间的关系角色、证据用途、必要证据、排除条件、冲突复核、合并规则、展示规则和来源链路。", ["对照 ID", "字段 ID", "字段名", "证据域", "关系角色", "证据用途", "必要证据", "排除条件", "冲突复核", "合并规则", "展示规则", "来源链路"], ["把对照资料写成当前盘结论", "重新定义格局判定", "重新定义四化目标表", "重新定义宫位关系算法"], ["ziwei-palace-theme-evidence-domain-cross-reference-dictionary", "ziwei-palace-theme-evidence-field-standard-dictionary", "ziwei-pattern-catalog", "ziwei-transformation-topic-dictionary", "ziwei-relationship-structure-dictionary"], ["palace-theme-evidence-domain-cross-reference.dictionary", "palace-theme-evidence-field.dictionary", "search.index"]),
  intakePack("intake-theory-source-reference", "理论来源索引资料包", "存储紫微数据字典所需的古籍、公版索引、项目算法、项目字典、项目归纳、人工校验和现代资料元信息。", ["sourceId", "书名或模块名", "来源类型", "作者或整理者", "版本或位置", "访问地址", "可信度", "版权策略", "用途范围", "引用规则", "存储边界", "复核备注"], ["复制现代资料正文", "复制外部软件截图或文案", "把项目归纳伪装成古籍原文"], ["ziwei-theory-source-reference-dictionary", "external-reference-index", "public-domain-classic-index"], ["theory-source.reference", "source.metadata", "search.index"]),
  intakePack("intake-transformation-topic", "四化专题资料包", "存储化禄、化权、化科、化忌、十干触发、盘层来源、目标星、目标宫和证据字段资料。", ["四化类型", "来源天干", "盘层", "目标星", "目标宫", "sourceRuleId"], ["重新定义四化目标表或动态流算法"], ["ziwei-transformation-topic-dictionary", "ziwei-dynamic-flow-rules"], ["transformation.topic", "dynamic-flow.dictionary", "search.index"]),
  intakePack("intake-transformation-target-combination", "四化目标星组合资料包", "存储目标星被化禄、化权、化科、化忌触发后的解释资料、来源天干、盘层读法和关系复核。", ["组合 ID", "来源天干", "四化类型", "目标星", "目标宫", "盘层", "关系证据"], ["手写第二套四化目标规则", "把组合资料写成当前盘最终断语"], ["ziwei-transformation-target-combination-dictionary", "ziwei-dynamic-flow-rules"], ["transformation.target", "star.transformation", "search.index"]),
  intakePack("intake-term-index", "术语词条资料包", "存储术语、别名、适用范围和检索标签。", ["术语 ID", "中文名", "别名", "自有定义"], ["外部辞典原文"], ["structured-term-index"], ["term.index", "search.index"]),
  intakePack("intake-source-metadata", "外部来源元信息包", "只存外部资料的来源元信息和复核状态。", ["书名", "版本", "主题", "页码范围", "复核状态"], ["外部正文", "外部截图"], ["external-reference-index"], ["source.metadata", "calibration.queue"]),
  intakePack("intake-public-domain", "公版资料索引包", "确认公版后存主题摘要和自有解释。", ["公版状态", "主题", "短摘要", "复核人"], ["未确认版权的全文"], ["public-domain-classic-index"], ["source.public-domain", "term.index"]),
  intakePack("intake-golden-sample", "黄金样例资料包", "存储样例盘结构、关键输出和回归测试标签。", ["样例 ID", "出生参数", "关键宫位", "格局摘要"], ["第三方样例截图"], ["ziwei-golden-samples"], ["sample.golden", "regression"]),
  intakePack("intake-human-calibration", "人工校盘资料包", "存储人工验盘结果、差异点和后续待办。", ["校盘字段", "差异说明", "确认状态", "责任模块"], ["无法追溯的主观断语"], ["human-calibration-notes", "user-chart-review-notes"], ["calibration.queue", "sample.review"]),
  intakePack("intake-page-feedback", "页面验收反馈包", "存储页面点击、展示、布局和用户验收反馈。", ["页面模块", "验收项", "截图路径", "处理状态"], ["外部软件 UI 资产"], ["user-chart-review-notes"], ["page.feedback", "calibration.queue"]),
  intakePack("intake-analysis-feature", "分析特征资料包", "存储从盘面派生的可检索特征和模型标签。", ["featureId", "输入桶", "输出标签", "复核问题"], ["覆盖原始算法的派生结论"], ["derived-analysis-index"], ["analysis.feature-source", "model.feature"]),
  intakePack("intake-risk-boundary", "风险与边界资料包", "存储高风险主题边界、禁用断语和复核提醒。", ["风险类型", "禁用表达", "替代表达", "复核状态"], ["医疗法律财务结论"], ["ziwei-content-dictionary"], ["safety.boundary", "review.rule"])
]

export const ZIWEI_KNOWLEDGE_ANALYSIS_DIMENSIONS: ZiweiKnowledgeAnalysisDimension[] = [
  analysisDimension("dimension-star-identity", "星曜身份", "star", "星曜 ID、名称、别名和分类是否清晰。", ["star.dictionary"], ["dimension:star.identity"], ["是否存在重复定义？", "是否引用唯一 catalog？"]),
  analysisDimension("dimension-branch-space", "地支空间", "branch", "十二地支、四马地、四败地、四墓库地和三合局的盘面空间语义。", ["branch.dictionary", "palace.space"], ["dimension:branch.space"], ["地支解释是否独立于星曜解释？", "是否误把地支语义当成最终断语？"]),
  analysisDimension("dimension-stem-space", "天干语义", "stem", "十天干的阴阳五行、四化语境、宫干用法和动态流干语义。", ["stem.dictionary"], ["dimension:stem.space"], ["天干解释是否独立于四化目标表？", "是否误把天干五行当成最终断语？"]),
  analysisDimension("dimension-element-gate", "五行局语义", "element-gate", "水二局、木三局、金四局、土五局、火六局的基础局数、紫微起例边界和大限节律。", ["element-gate.dictionary", "chart.foundation"], ["dimension:element.gate"], ["是否只解释五行局而不重写算法？", "是否保留局数和大限起龄边界？"]),
  analysisDimension("dimension-palace-core", "宫位本体", "palace", "十二宫位各自的人事主题、本体定位、星曜入宫语境和动态盘用法。", ["palace.dictionary", "palace.relation"], ["dimension:palace.core"], ["宫位解释是否独立于当前盘断语？", "是否误把宫位主题当成固定结果？"]),
  analysisDimension("dimension-main-star-palace-combination", "主星入宫组合", "combination", "十四主星进入十二宫位后的组合解释、证据复核、动态盘用法和误读边界。", ["star-palace-combination.dictionary", "star.palace"], ["dimension:main-star.palace"], ["是否保持星曜本体、宫位本体和当前盘解释分层？", "是否避免单星单宫绝对断语？"]),
  analysisDimension("dimension-non-main-star-palace-combination", "辅煞杂入宫组合", "non-main-combination", "辅曜、煞曜、杂曜进入十二宫后的助力、压力、气氛、细节、动态盘用法和误读边界。", ["non-main-star-palace-combination.dictionary", "star.palace"], ["dimension:non-main-star.palace"], ["是否保持非主星降权读取？", "是否区分辅曜助力、煞曜压力和杂曜细节？", "是否避免单星单宫断语？"]),
  analysisDimension("dimension-periodic-star-palace-combination", "周期流系星曜入宫组合", "periodic-combination", "长生十二神、博士十二神、岁前十二神、将前十二神、月系和日时系星曜进入十二宫后的时间层级、助力压力和误读边界。", ["periodic-star-palace-combination.dictionary", "dynamic-flow.dictionary"], ["dimension:periodic-star.palace"], ["是否保留周期分组？", "是否保留盘层来源？", "是否避免把短周期触发写成本命结论？"]),
  analysisDimension("dimension-star-symbol", "星曜象义", "star", "星曜核心象义、主题和可复用关键词。", ["star.dictionary"], ["dimension:star.symbol"], ["是否为自有整理？", "是否可用于检索？"]),
  analysisDimension("dimension-star-palace", "星曜入宫", "star", "星曜进入不同宫位后的语境转换。", ["star.palace"], ["dimension:star.palace"], ["是否脱离宫位主题？", "是否过度单星断语？"]),
  analysisDimension("dimension-star-brightness", "星曜亮度", "brightness", "庙旺落陷或不论亮度的承接层次。", ["brightness.table"], ["dimension:brightness"], ["是否读取亮度表？", "是否保留 sourceRuleId？"]),
  analysisDimension("dimension-star-combination", "星曜组合", "star-pair-combination", "主星、辅曜、煞曜、杂曜之间的两两组合、同宫、会照、夹拱、加吉、加煞和动态叠盘判断。", ["star-pair-combination.dictionary", "star.combination"], ["dimension:star.combination"], ["是否保留两颗星的原始星性？", "是否有关系范围？", "是否说明证据？", "是否避免把组合写成当前盘断语？"]),
  analysisDimension("dimension-pattern-combination-relation", "组合格局关系", "pattern-combination-relation", "星曜组合如何参与成格、加吉增强、加煞破格和弱承接复核。", ["pattern-combination-relation.dictionary", "pattern.dictionary", "star.combination"], ["dimension:pattern.combination"], ["是否仍以格局目录为唯一判定条件？", "是否区分成格、加吉、破格和弱承接？", "是否隐藏未命中的资料？"]),
  analysisDimension("dimension-pattern-formation", "格局成格", "pattern", "格局核心条件、命中证据和盘层范围。", ["pattern.condition"], ["dimension:pattern.formation"], ["是否保留原始 conditionText？", "是否只显示命中结果？"]),
  analysisDimension("dimension-pattern-breakage", "格局破格", "pattern", "破格、弱化、风险和复核路径。", ["pattern.breakage"], ["dimension:pattern.breakage"], ["是否给出复核路径？", "是否避免恐吓式断语？"]),
  analysisDimension("dimension-palace-axis", "宫位主轴", "palace", "十二宫各自的主题、主星承接和重点事项。", ["palace.relation"], ["dimension:palace.axis"], ["宫位主题是否明确？"]),
  analysisDimension("dimension-palace-relation", "宫位关系", "palace", "本宫、对宫、三方四正、夹宫和邻宫关系。", ["palace.relation"], ["dimension:palace.relation"], ["关系目标是否可追溯？"]),
  analysisDimension("dimension-relationship-structure", "关系结构", "relationship", "同宫、对宫、三方四正、邻宫、夹宫、会照、借宫、动态叠盘、宫位链和证据追踪的解释边界。", ["relationship.dictionary", "palace.relation"], ["dimension:relationship.structure"], ["关系解释是否独立于宫位算法？", "动态盘层是否清楚？"]),
  analysisDimension("dimension-palace-theme-chain", "宫位主题链", "palace-theme-chain", "事业、关系、家庭、身心、财务、社交等主题下的宫位链条、证据字段、动态盘读取和误读边界。", ["palace-theme-chain.dictionary", "palace.relation"], ["dimension:palace.theme-chain"], ["主题链是否只做复核路径？", "主宫和辅助宫是否清楚？", "是否避免把主题链写成当前盘最终断语？"]),
  analysisDimension("dimension-palace-theme-template", "主题链综合解释模板", "palace-theme-template", "宫位主题链输出时的总论结构、证据顺序、强弱判断、破格补救、动态盘降权和隐藏未命中规则。", ["palace-theme-template.dictionary", "palace-theme-chain.dictionary"], ["dimension:palace.theme-template"], ["模板是否只组织解释？", "未命中内容是否隐藏？", "动态盘层级是否清楚？"]),
  analysisDimension("dimension-palace-theme-hit-rule", "主题链证据命中规则", "palace-theme-hit-rule", "主题链是否强命中、弱命中、破格命中、修复命中或隐藏的证据规则。", ["palace-theme-hit-rule.dictionary", "palace-theme-template.dictionary"], ["dimension:palace.theme-hit-rule"], ["强弱命中是否有必要证据？", "隐藏条件是否明确？", "是否避免把规则直接写成当前盘结论？"]),
  analysisDimension("dimension-palace-theme-result-threshold", "主题链结果展示门槛", "palace-theme-result-threshold", "主题链结果是否展示、展示层级、排序、证据合并、盘层继承、隐藏抑制和复核升级规则。", ["palace-theme-result-threshold.dictionary", "palace-theme-hit-rule.dictionary"], ["dimension:palace.theme-result-threshold"], ["展示门槛是否依赖命中证据？", "未命中是否隐藏？", "大限、流年、流月、流日、流时是否保留层级继承？"]),
  analysisDimension("dimension-palace-theme-output-paragraph", "主题链输出段落模板", "palace-theme-paragraph-template", "主题链总论段、证据段、受压段、修复段、动态盘段、复核缺口段和语气边界资料。", ["palace-theme-paragraph-template.dictionary", "palace-theme-result-threshold.dictionary"], ["dimension:palace.theme-output-paragraph"], ["段落是否只基于盘中证据？", "未命中段落是否隐藏？", "是否避免把段落模板写成页面实现？"]),
  analysisDimension("dimension-palace-theme-evidence-field-standard", "主题链证据字段标准", "palace-theme-evidence-field", "主题链字段标准名称、值结构、标准化、校验、合并、展示和隐藏规则。", ["palace-theme-evidence-field.dictionary", "palace-theme-paragraph-template.dictionary"], ["dimension:palace.theme-evidence-field"], ["字段是否只定义一次？", "字段是否保留 sourceRuleIds？", "字段缺失时是否隐藏或进入复核？"]),
  analysisDimension("dimension-palace-theme-field-paragraph-matrix", "主题链字段段落矩阵", "palace-theme-field-paragraph-matrix", "主题链字段在总论、证据、受压、修复、动态盘和复核缺口段中的要求等级、隐藏条件和复核触发。", ["palace-theme-field-paragraph-matrix.dictionary", "palace-theme-evidence-field.dictionary"], ["dimension:palace.theme-field-paragraph-matrix"], ["字段在该段落是否有明确要求等级？", "字段隐藏时是否说明原因？", "字段冲突是否进入复核？"]),
  analysisDimension("dimension-palace-theme-evidence-domain-cross-reference", "主题链证据域对照", "palace-theme-evidence-domain-cross-reference", "主题链字段与格局、四化、宫位关系证据域之间的直接、辅助、抑制、复核和上下文关系。", ["palace-theme-evidence-domain-cross-reference.dictionary", "palace-theme-evidence-field.dictionary"], ["dimension:palace.theme-evidence-domain-cross-reference"], ["字段是否只对照已有证据域？", "未命中格局/四化/宫位关系是否隐藏？", "冲突证据是否进入 reviewFlags？"]),
  analysisDimension("dimension-theory-source-reference", "理论来源索引", "theory-source-reference", "数据字典每条理论所引用的古籍、项目算法、项目归纳、人工校验和现代资料元信息边界。", ["theory-source.reference", "source.metadata"], ["dimension:theory.source-reference"], ["来源类型是否明确？", "是否区分古籍原文、项目归纳和现代资料元信息？", "是否避免复制受版权保护内容？"]),
  analysisDimension("dimension-transformation-topic", "四化专题", "transformation-topic", "化禄、化权、化科、化忌、十干触发、本命/大限/流年/流月/流日/流时盘层、目标星和目标宫的解释边界。", ["transformation.topic", "dynamic-flow.dictionary"], ["dimension:transformation.topic"], ["是否保留来源天干？", "是否区分目标星和目标宫？", "是否避免重写四化目标表？"]),
  analysisDimension("dimension-transformation-target-combination", "四化目标星组合", "transformation-target", "目标星被化禄、化权、化科、化忌触发后的承接方式、宫位转译、盘层权重和关系证据。", ["transformation.target", "star.transformation"], ["dimension:transformation.target"], ["是否来自统一四化目标表？", "是否保留目标星本体？", "是否避免写成当前盘断语？"]),
  analysisDimension("dimension-dynamic-da-yun", "大限层级", "dynamic-flow", "十年阶段的动态命宫、流干和动态星曜。", ["dynamic-flow.dictionary"], ["dimension:flow.daYun"], ["是否保留上级/下级盘层？"]),
  analysisDimension("dimension-dynamic-liu-nian", "流年层级", "dynamic-flow", "年度层级的命宫、四化、年系和流星曜。", ["dynamic-flow.dictionary"], ["dimension:flow.liuNian"], ["是否按当前流年重算？"]),
  analysisDimension("dimension-dynamic-liu-yue", "流月层级", "dynamic-flow", "月度层级的短周期触发。", ["dynamic-flow.dictionary"], ["dimension:flow.liuYue"], ["是否降权为短周期？"]),
  analysisDimension("dimension-dynamic-liu-ri", "流日层级", "dynamic-flow", "日层级的临时事件气候。", ["dynamic-flow.dictionary"], ["dimension:flow.liuRi"], ["是否避免长期化？"]),
  analysisDimension("dimension-dynamic-liu-shi", "流时层级", "dynamic-flow", "时辰层级的即时触发。", ["dynamic-flow.dictionary"], ["dimension:flow.liuShi"], ["是否只做即时提示？"]),
  analysisDimension("dimension-source-lineage", "来源追踪", "source", "每条资料的来源 ID、来源类型和存储边界。", ["source.metadata"], ["dimension:source.lineage"], ["是否存在未知 sourceId？"]),
  analysisDimension("dimension-copyright", "版权边界", "source", "是否只存结构化资料、元信息和自有摘要。", ["source.metadata", "safety.boundary"], ["dimension:copyright"], ["是否包含外部原文或截图？"]),
  analysisDimension("dimension-term-search", "术语检索", "term", "术语、别名、标签和适用对象。", ["term.index"], ["dimension:term.search"], ["是否有别名？", "是否能进入搜索？"]),
  analysisDimension("dimension-sample-regression", "样例回归", "sample", "黄金样例的输入、输出、重点校验和回归标签。", ["sample.golden", "regression"], ["dimension:sample.regression"], ["样例是否可复现？"]),
  analysisDimension("dimension-human-review", "人工复核", "calibration", "人工校盘、资料核对和差异处理状态。", ["calibration.queue"], ["dimension:human.review"], ["是否有待办状态？"]),
  analysisDimension("dimension-page-feedback", "页面验收", "calibration", "页面模块、交互、展示和截图验收。", ["page.feedback"], ["dimension:page.feedback"], ["是否影响算法？"]),
  analysisDimension("dimension-model-feature", "模型特征", "chart", "从盘面提取给后续分析或模型使用的结构化标签。", ["model.feature"], ["dimension:model.feature"], ["是否可追溯到原始盘面？"]),
  analysisDimension("dimension-risk-language", "风险语言", "term", "高风险主题禁用断语、替代表达和免责声明边界。", ["safety.boundary"], ["dimension:risk.language"], ["是否输出医疗法律财务结论？"]),
  analysisDimension("dimension-calibration-gap", "校准缺口", "calibration", "资料缺失、样例缺失、算法待复核和页面待验收。", ["calibration.queue"], ["dimension:calibration.gap"], ["是否能形成后续任务？"]),
  analysisDimension("dimension-storage-bucket", "存储分桶", "source", "资料应进入的索引桶、检索桶和分析桶。", ["source.metadata"], ["dimension:storage.bucket"], ["桶名是否稳定？"])
]

export const ZIWEI_KNOWLEDGE_CALIBRATION_FIELDS: ZiweiKnowledgeCalibrationField[] = [
  calibrationField("cal-birth-solar-date", "公历出生日期", "sample", "样例或用户盘的公历年月日。", true, ["ziwei-golden-samples", "user-chart-review-notes"]),
  calibrationField("cal-birth-time", "出生时辰", "sample", "样例或用户盘的出生时辰和边界状态。", true, ["ziwei-golden-samples", "user-chart-review-notes"]),
  calibrationField("cal-gender", "性别", "sample", "顺逆行、大限和部分算法所需的性别字段。", true, ["ziwei-golden-samples", "user-chart-review-notes"]),
  calibrationField("cal-lunar-date", "农历日期", "sample", "换算后的农历年月日和闰月状态。", true, ["ziwei-golden-samples"]),
  calibrationField("cal-ming-branch", "命宫地支", "palace", "本命命宫所在地支。", true, ["ziwei-golden-samples"]),
  calibrationField("cal-shen-branch", "身宫地支", "palace", "身宫所在的十二地支位置。", true, ["ziwei-golden-samples"]),
  calibrationField("cal-five-element-class", "五行局", "chart", "排盘基础中的五行局。", true, ["ziwei-golden-samples"]),
  calibrationField("cal-da-yun-direction", "大限顺逆", "dynamic-flow", "阳男阴女顺行、阴男阳女逆行的行限方向。", true, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-da-yun-start-age", "起运年龄", "dynamic-flow", "大限起始年龄和页面按钮展示。", true, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-ziwei-star-branch", "紫微星落宫", "star", "紫微星所在宫位，作为主星安星关键校验。", true, ["ziwei-star-catalog"]),
  calibrationField("cal-tianfu-star-branch", "天府星落宫", "star", "天府星所在宫位，作为南斗主星校验。", true, ["ziwei-star-catalog"]),
  calibrationField("cal-major-star-placement", "十四主星落宫", "star", "十四主星完整落宫校验。", true, ["ziwei-star-catalog"]),
  calibrationField("cal-assistant-stars", "辅曜落宫", "star", "左右昌曲魁钺禄马等辅曜落宫校验。", true, ["ziwei-star-catalog"]),
  calibrationField("cal-malefic-stars", "煞曜落宫", "star", "羊陀火铃空劫等煞曜落宫校验。", true, ["ziwei-star-catalog"]),
  calibrationField("cal-misc-stars", "杂曜落宫", "star", "杂曜、桃花、孤寡、哭虚等落宫校验。", false, ["ziwei-star-catalog"]),
  calibrationField("cal-brightness", "庙旺落陷", "brightness", "星曜亮度等级与不论状态校验。", true, ["ziwei-brightness-table"]),
  calibrationField("cal-transformations", "四化目标", "star", "化禄、化权、化科、化忌目标星曜校验。", true, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-pattern-hit", "格局命中", "pattern", "盘中命中的格局结果和证据校验。", true, ["ziwei-pattern-catalog"]),
  calibrationField("cal-pattern-breakage", "格局破格", "pattern", "破格、弱化和不良结构校验。", false, ["ziwei-pattern-catalog"]),
  calibrationField("cal-da-yun-palace", "大限命宫", "dynamic-flow", "当前大限命宫落点校验。", true, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-liu-nian-palace", "流年命宫", "dynamic-flow", "当前流年命宫落点校验。", true, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-liu-yue-palace", "流月命宫", "dynamic-flow", "当前流月命宫落点校验。", false, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-liu-ri-palace", "流日命宫", "dynamic-flow", "当前流日命宫落点校验。", false, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-liu-shi-palace", "流时命宫", "dynamic-flow", "当前流时命宫落点校验。", false, ["ziwei-dynamic-flow-rules"]),
  calibrationField("cal-non-main-star-palace-combination", "辅煞杂入宫组合", "non-main-combination", "辅曜、煞曜、杂曜入十二宫组合的星曜类别、宫位、证据字段和误读边界校验。", false, ["ziwei-non-main-star-palace-combination-dictionary", "ziwei-star-catalog", "ziwei-palace-dictionary"]),
  calibrationField("cal-periodic-star-palace-combination", "周期流系星曜入宫组合", "periodic-combination", "周期流系星曜入十二宫组合的周期分组、宫位、盘层、证据字段和误读边界校验。", false, ["ziwei-periodic-star-palace-combination-dictionary", "ziwei-star-catalog", "ziwei-palace-dictionary", "ziwei-dynamic-flow-rules"]),
  calibrationField("cal-star-pair-combination", "星曜两两组合", "star-pair-combination", "主星、辅曜、煞曜、杂曜两两组合的组合分类、关系范围、助力压力、动态盘用法和误读边界校验。", false, ["ziwei-star-pair-combination-dictionary", "ziwei-star-catalog", "ziwei-content-dictionary"]),
  calibrationField("cal-pattern-combination-relation", "组合格局关系", "pattern-combination-relation", "星曜组合参与成格、加吉、加煞、破格和弱承接的证据字段与复核路径校验。", false, ["ziwei-pattern-combination-relation-dictionary", "ziwei-star-pair-combination-dictionary", "ziwei-pattern-catalog"]),
  calibrationField("cal-relation-lines", "三方四正线条", "palace", "当前查看盘层的本宫、对宫、三方关系线校验。", false, ["derived-analysis-index"]),
  calibrationField("cal-relationship-structure", "关系结构证据", "relationship", "同宫、对宫、三方四正、邻宫、夹宫、会照、借宫和动态叠盘的证据字段校验。", false, ["ziwei-relationship-structure-dictionary"]),
  calibrationField("cal-palace-theme-chain", "宫位主题链证据", "palace-theme-chain", "宫位主题链的主题分类、主宫、辅助宫、宫位顺序、动态盘读取和证据字段校验。", false, ["ziwei-palace-theme-chain-dictionary", "ziwei-palace-dictionary", "ziwei-relationship-structure-dictionary"]),
  calibrationField("cal-palace-theme-template", "主题链综合解释模板证据", "palace-theme-template", "主题链综合解释模板的输出结构、证据顺序、强弱规则、动态盘层级、隐藏未命中规则和来源字段校验。", false, ["ziwei-palace-theme-synthesis-template-dictionary", "ziwei-palace-theme-chain-dictionary"]),
  calibrationField("cal-palace-theme-hit-rule", "主题链证据命中规则", "palace-theme-hit-rule", "主题链必要证据、强命中、弱命中、破格命中、修复命中、隐藏条件和动态盘层级命中规则校验。", false, ["ziwei-palace-theme-hit-rule-dictionary", "ziwei-palace-theme-synthesis-template-dictionary"]),
  calibrationField("cal-palace-theme-result-threshold", "主题链结果展示门槛", "palace-theme-result-threshold", "主题链结果层级、展示阈值、排序、盘层继承、隐藏抑制和复核升级规则校验。", false, ["ziwei-palace-theme-result-threshold-dictionary", "ziwei-palace-theme-hit-rule-dictionary"]),
  calibrationField("cal-palace-theme-output-paragraph", "主题链输出段落模板", "palace-theme-paragraph-template", "主题链总论段、证据段、受压段、修复段、动态盘段、复核缺口段、语气边界和来源字段校验。", false, ["ziwei-palace-theme-output-paragraph-template-dictionary", "ziwei-palace-theme-result-threshold-dictionary"]),
  calibrationField("cal-palace-theme-evidence-field-standard", "主题链证据字段标准", "palace-theme-evidence-field", "主题链证据字段名称、值结构、标准化规则、校验规则、合并规则、来源链路和隐藏条件校验。", false, ["ziwei-palace-theme-evidence-field-standard-dictionary", "ziwei-palace-theme-output-paragraph-template-dictionary"]),
  calibrationField("cal-palace-theme-field-paragraph-matrix", "主题链字段段落矩阵", "palace-theme-field-paragraph-matrix", "主题链字段在总论、证据、受压、修复、动态盘和复核缺口段中的要求等级、隐藏条件、复核触发和来源链路校验。", false, ["ziwei-palace-theme-field-paragraph-review-matrix-dictionary", "ziwei-palace-theme-evidence-field-standard-dictionary"]),
  calibrationField("cal-palace-theme-evidence-domain-cross-reference", "主题链证据域对照", "palace-theme-evidence-domain-cross-reference", "主题链字段与格局、四化、宫位关系证据域之间的关系角色、必要证据、排除条件、冲突复核和来源链路校验。", false, ["ziwei-palace-theme-evidence-domain-cross-reference-dictionary", "ziwei-palace-theme-evidence-field-standard-dictionary"]),
  calibrationField("cal-theory-source-reference", "理论来源索引", "theory-source-reference", "理论来源的 sourceId、来源类型、引用边界、版权策略、用途范围和复核状态校验。", false, ["ziwei-theory-source-reference-dictionary", "external-reference-index"]),
  calibrationField("cal-transformation-topic", "四化专题证据", "transformation-topic", "四化来源天干、盘层、目标星、目标宫和 sourceRuleId 字段校验。", false, ["ziwei-transformation-topic-dictionary"]),
  calibrationField("cal-transformation-target-combination", "四化目标星组合", "transformation-target", "四化目标星组合的来源天干、四化类型、目标星、目标宫、盘层和关系证据校验。", false, ["ziwei-transformation-target-combination-dictionary", "ziwei-dynamic-flow-rules"]),
  calibrationField("cal-source-rule", "来源规则", "source", "sourceRuleId 是否完整、可追溯。", true, ["derived-analysis-index"]),
  calibrationField("cal-copyright-policy", "版权策略", "source", "资料是否只存元信息、自有摘要和结构化字段。", true, ["external-reference-index"]),
  calibrationField("cal-human-note", "人工备注", "calibration", "人工复核结论、差异点和后续处理状态。", false, ["human-calibration-notes", "user-chart-review-notes"])
]

export function buildZiweiStarKnowledgeRecord(
  star: ZiweiStarDefinition
): ZiweiStarKnowledgeRecord {
  const detail = buildZiweiStarContentDictionaryDetail(star)

  return {
    id: `star-knowledge.${star.starId}`,
    entity: {
      kind: "star",
      id: star.starId,
      label: star.label
    },
    starCategory: star.category,
    sourceIds: [
      "ziwei-star-catalog",
      "ziwei-content-dictionary",
      sourceForStarCategory(star.category)
    ],
    copyrightPolicy: "original-content",
    confidence: detail.source === "manual" ? "high" : "medium",
    reviewStatus: detail.source === "manual" ? "ready" : "needs-human-review",
    analysisTags: unique([
      `star:${star.starId}`,
      `category:${star.category}`,
      ...detail.coreThemes.map((theme) => `theme:${theme}`),
      ...detail.reusableScenes.map((scene) => `scene:${scene}`),
      ...detail.sourceReferences.map((source) => `sourceReference:${source.sourceId}`)
    ]),
    facets: [
      facet("identity", "身份定位", detail.identity, [star.label, star.category]),
      facet("symbol", "通用象义", detail.symbolicMeanings, detail.coreThemes),
      facet("palace", "入宫用法", detail.palaceUsage, ["入宫", "宫位"]),
      facet("brightness", "庙旺用法", detail.brightnessUsage, ["庙旺", "落陷"]),
      facet("combination", "组合用法", detail.combinationUsage, ["同宫", "三方四正"]),
      facet("reading", "读盘步骤", detail.interpretationSteps, ["读盘", "步骤"]),
      facet("risk", "注意事项", detail.cautions, ["误区", "风险"]),
      facet("sourceReferences", "理论来源", detail.sourceReferences.map((source) => `${source.sourceId}: ${source.usage}`), ["sourceReferences", "理论来源"])
    ],
    storageBuckets: [
      "star.dictionary",
      `star.category.${star.category}`,
      "analysis.feature-source",
      "search.index"
    ],
    applicableScopes: detail.reusableScenes,
    relatedEntityIds: unique([
      ...(star.aliases ?? []),
      ...detail.aliases,
      ...detail.sourceReferences.map((source) => source.sourceId)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiPatternKnowledgeRecord(
  input: ZiweiPatternContentDetailInput
): ZiweiPatternKnowledgeRecord {
  const detail = buildZiweiPatternContentDictionaryDetail(input)

  return {
    id: `pattern-knowledge.${detail.patternId}`,
    entity: {
      kind: "pattern",
      id: detail.patternId,
      label: detail.label
    },
    patternCategory: detail.category,
    sourceIds: [
      "ziwei-pattern-catalog",
      "ziwei-content-dictionary",
      "derived-analysis-index"
    ],
    copyrightPolicy: "original-content",
    confidence: "medium",
    reviewStatus: "ready",
    analysisTags: unique([
      `pattern:${detail.patternId}`,
      `category:${detail.category}`,
      `tone:${detail.tone}`,
      ...detail.coreThemes.map((theme) => `theme:${theme}`),
      ...detail.reusableScenes.map((scene) => `scene:${scene}`),
      ...detail.sourceReferences.map((source) => `sourceReference:${source.sourceId}`)
    ]),
    facets: [
      facet("identity", "格局身份", detail.identity, [detail.label, detail.category]),
      facet("formation", "成格逻辑", detail.formationLogic, ["成格", "条件"]),
      facet("evidence", "证据清单", detail.evidenceChecklist, ["证据", "复核"]),
      facet("strength", "强化清单", detail.strengthChecklist, ["加吉", "强化"]),
      facet("breakage", "破格清单", detail.breakageChecklist, ["破格", "风险"]),
      facet("reading", "读盘步骤", detail.interpretationSteps, ["读盘", "步骤"]),
      facet("caution", "注意事项", detail.cautions, ["版权", "复核"]),
      facet("sourceReferences", "理论来源", detail.sourceReferences.map((source) => `${source.sourceId}: ${source.usage}`), ["sourceReferences", "理论来源"])
    ],
    storageBuckets: [
      "pattern.dictionary",
      `pattern.category.${detail.category}`,
      "analysis.feature-source",
      "search.index"
    ],
    applicableScopes: detail.reusableScenes,
    relatedEntityIds: unique([
      input.id,
      ...detail.sourceReferences.map((source) => source.sourceId)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiBranchKnowledgeRecord(
  detail: ReturnType<typeof getAllBranchContentDetails>[number]
): ZiweiBranchKnowledgeRecord {
  return {
    id: `branch-knowledge.${detail.branch}`,
    entity: {
      kind: "branch",
      id: detail.branch,
      label: detail.label
    },
    branchGroups: detail.groupIds,
    sourceIds: ["ziwei-branch-dictionary", "structured-term-index"],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `branch:${detail.branch}`,
      `element:${detail.element}`,
      `yinYang:${detail.yinYang}`,
      ...detail.groupIds.map((groupId) => `branchGroup:${groupId}`),
      ...detail.symbolicMeanings.map((meaning) => `branchMeaning:${meaning}`),
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "地支身份", [`${detail.label}，${detail.direction}，${detail.season}`], [detail.label, detail.branch]),
      facet("group", "所属分组", detail.groupIds, detail.groupIds),
      facet("symbol", "空间象义", detail.symbolicMeanings, detail.symbolicMeanings),
      facet("palace", "入宫用法", detail.palaceUsage, ["地支", "宫位"]),
      facet("star", "星曜互动", detail.starInteraction, ["星曜", "地支"]),
      facet("dynamic", "动态用法", detail.dynamicUsage, ["动态盘", "流年"]),
      facet("relation", "关系结构", detail.relationshipUsage, ["三合", "冲照"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["branch.dictionary", "palace.space", "search.index"],
    applicableScopes: ["地支解释", "宫位空间", "动态盘", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      ...detail.groupIds,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiStemKnowledgeRecord(
  detail: ReturnType<typeof getAllStemContentDetails>[number]
): ZiweiStemKnowledgeRecord {
  return {
    id: `stem-knowledge.${detail.stem}`,
    entity: {
      kind: "stem",
      id: detail.stem,
      label: detail.label
    },
    pairGroup: detail.pairGroup,
    sourceIds: ["ziwei-stem-dictionary", "structured-term-index"],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `stem:${detail.stem}`,
      `element:${detail.element}`,
      `yinYang:${detail.yinYang}`,
      `stemPair:${detail.pairGroup}`,
      ...detail.symbolicMeanings.map((meaning) => `stemMeaning:${meaning}`),
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "天干身份", [`${detail.label}，${detail.pairGroup}，${detail.yinYang === "yang" ? "阳" : "阴"}${elementLabel(detail.element)}`], [detail.label, detail.stem, detail.pairGroup]),
      facet("symbol", "天干象义", detail.symbolicMeanings, detail.symbolicMeanings),
      facet("transformation", "四化语境", detail.transformationUsage, ["四化", "流干"]),
      facet("palaceStem", "宫干用法", detail.palaceStemUsage, ["宫干", "十二宫"]),
      facet("dynamic", "动态流干", detail.dynamicUsage, ["大限", "流年", "流月", "流日", "流时"]),
      facet("combination", "组合边界", detail.combinationUsage, ["五行", "组合"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["stem.dictionary", "search.index", "analysis.feature-source"],
    applicableScopes: ["天干解释", "四化语境", "宫干解释", "动态盘", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.pairGroup,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiElementGateKnowledgeRecord(
  detail: ReturnType<typeof getAllElementGateContentDetails>[number]
): ZiweiElementGateKnowledgeRecord {
  return {
    id: `element-gate-knowledge.${detail.gate}`,
    entity: {
      kind: "element-gate",
      id: detail.gate,
      label: detail.label
    },
    baseNumber: detail.baseNumber,
    sourceIds: ["ziwei-element-gate-dictionary", "structured-term-index"],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `elementGate:${detail.gate}`,
      `element:${detail.element}`,
      `baseNumber:${detail.baseNumber}`,
      ...detail.symbolicMeanings.map((meaning) => `gateMeaning:${meaning}`),
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "五行局身份", [`${detail.label}，局数 ${detail.baseNumber}，五行属${elementLabel(detail.element)}`], [detail.label, detail.gate]),
      facet("symbol", "局数象义", detail.symbolicMeanings, detail.symbolicMeanings),
      facet("ziweiPlacement", "紫微起例边界", detail.ziweiPlacementUsage, ["紫微起例", "局数"]),
      facet("daYun", "大限节律", detail.daYunUsage, ["大限", "起龄"]),
      facet("star", "星曜互动", detail.starInteraction, ["星曜", "五行局"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["element-gate.dictionary", "chart.foundation", "search.index"],
    applicableScopes: ["五行局解释", "紫微起例边界", "大限节律", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      `base:${detail.baseNumber}`,
      `element:${detail.element}`,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiPalaceKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceContentDetails>[number]
): ZiweiPalaceKnowledgeRecord {
  return {
    id: `palace-knowledge.${detail.sectorName}`,
    entity: {
      kind: "palace",
      id: detail.sectorName,
      label: detail.label
    },
    corePosition: detail.corePosition,
    sourceIds: ["ziwei-palace-dictionary", "structured-term-index"],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palace:${detail.sectorName}`,
      `palaceLabel:${detail.label}`,
      `palaceCore:${detail.corePosition}`,
      ...detail.reportUsage.map((usage) => `palaceUsage:${usage}`),
      ...detail.sourceReferences.map((source) => `sourceReference:${source.sourceId}`)
    ]),
    facets: [
      facet("identity", "宫位身份", [`${detail.label}，${detail.corePosition}`], [detail.label, detail.sectorName]),
      facet("question", "核心问题", detail.primaryQuestions, ["核心问题", "观察重点"]),
      facet("star", "星曜入宫", detail.starReadingUsage, ["星曜入宫", "宫位语境"]),
      facet("relation", "宫位关系", detail.relationUsage, ["对宫", "三方四正"]),
      facet("dynamic", "动态用法", detail.dynamicUsage, ["大限", "流年", "流月", "流日", "流时"]),
      facet("caution", "误读边界", detail.commonMisreads, ["误读", "边界"]),
      facet("sourceReferences", "理论来源", detail.sourceReferences.map((source) => `${source.sourceId}: ${source.usage}`), ["sourceReferences", "理论来源"])
    ],
    storageBuckets: ["palace.dictionary", "palace.relation", "search.index"],
    applicableScopes: ["宫位解释", "星曜入宫", "动态盘", "详细分析", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      ...detail.aliases,
      ...detail.sourceReferences.map((source) => source.sourceId)
    ]),
    cautionFlags: detail.commonMisreads
  }
}

export function buildZiweiMainStarPalaceCombinationKnowledgeRecord(
  detail: ReturnType<typeof getAllMainStarPalaceCombinationContentDetails>[number]
): ZiweiMainStarPalaceCombinationKnowledgeRecord {
  return {
    id: `main-star-palace-combination-knowledge.${detail.combinationId}`,
    entity: {
      kind: "combination",
      id: detail.combinationId,
      label: `${detail.starLabel}入${detail.palaceLabel}`
    },
    starId: detail.starId,
    sectorName: detail.sectorName,
    sourceIds: [
      "ziwei-main-star-palace-combination-dictionary",
      "ziwei-star-catalog",
      "ziwei-palace-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `combination:${detail.combinationId}`,
      `star:${detail.starId}`,
      `palace:${detail.sectorName}`,
      `starLabel:${detail.starLabel}`,
      `palaceLabel:${detail.palaceLabel}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "组合身份", [detail.coreReading], [detail.starLabel, detail.palaceLabel]),
      facet("focus", "分析重点", detail.analysisFocus, ["分析重点", "入宫"]),
      facet("favorable", "有利信号", detail.favorableSignals, ["有利", "加吉"]),
      facet("risk", "风险信号", detail.riskSignals, ["风险", "煞忌"]),
      facet("relation", "关系复核", detail.relationUsage, ["对宫", "三方四正"]),
      facet("dynamic", "动态用法", detail.dynamicUsage, ["大限", "流年", "流月", "流日", "流时"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["star-palace-combination.dictionary", "star.palace", "search.index"],
    applicableScopes: ["星曜入宫解释", "详细分析", "动态盘", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.starId,
      detail.sectorName,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiNonMainStarPalaceCombinationKnowledgeRecord(
  detail: ReturnType<typeof getAllNonMainStarPalaceCombinationContentDetails>[number]
): ZiweiNonMainStarPalaceCombinationKnowledgeRecord {
  return {
    id: `non-main-star-palace-combination-knowledge.${detail.combinationId}`,
    entity: {
      kind: "non-main-combination",
      id: detail.combinationId,
      label: `${detail.starLabel}入${detail.palaceLabel}`
    },
    starId: detail.starId,
    sectorName: detail.sectorName,
    starCategory: detail.category,
    sourceIds: [
      "ziwei-non-main-star-palace-combination-dictionary",
      "ziwei-star-catalog",
      "ziwei-palace-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `nonMainCombination:${detail.combinationId}`,
      `star:${detail.starId}`,
      `starCategory:${detail.category}`,
      `palace:${detail.sectorName}`,
      `starLabel:${detail.starLabel}`,
      `palaceLabel:${detail.palaceLabel}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "组合身份", [detail.coreReading, detail.categoryRole], [detail.starLabel, detail.palaceLabel, detail.category]),
      facet("focus", "分析重点", detail.analysisFocus, ["分析重点", "入宫"]),
      facet("supportive", "助力信号", detail.supportiveSignals, ["助力", "补强"]),
      facet("pressure", "压力信号", detail.pressureSignals, ["压力", "风险"]),
      facet("relation", "关系复核", detail.relationUsage, ["同宫", "对宫", "三方四正"]),
      facet("dynamic", "动态用法", detail.dynamicUsage, ["大限", "流年", "流月", "流日", "流时"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "证据"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["non-main-star-palace-combination.dictionary", "star.palace", "search.index"],
    applicableScopes: ["辅曜入宫解释", "煞曜入宫解释", "杂曜入宫解释", "详细分析", "动态盘", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.starId,
      detail.sectorName,
      detail.category,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiPeriodicStarPalaceCombinationKnowledgeRecord(
  detail: ReturnType<typeof getAllPeriodicStarPalaceCombinationContentDetails>[number]
): ZiweiPeriodicStarPalaceCombinationKnowledgeRecord {
  return {
    id: `periodic-star-palace-combination-knowledge.${detail.combinationId}`,
    entity: {
      kind: "periodic-combination",
      id: detail.combinationId,
      label: `${detail.starLabel}入${detail.palaceLabel}`
    },
    starId: detail.starId,
    sectorName: detail.sectorName,
    periodicGroup: detail.group,
    sourceIds: [
      "ziwei-periodic-star-palace-combination-dictionary",
      "ziwei-star-catalog",
      "ziwei-palace-dictionary",
      "ziwei-dynamic-flow-rules"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `periodicCombination:${detail.combinationId}`,
      `periodicGroup:${detail.group}`,
      `star:${detail.starId}`,
      `palace:${detail.sectorName}`,
      `starLabel:${detail.starLabel}`,
      `palaceLabel:${detail.palaceLabel}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "组合身份", [detail.coreReading, detail.groupRole], [detail.starLabel, detail.palaceLabel, detail.group]),
      facet("timing", "时间层级", detail.timingUsage, ["盘层", "周期", "动态"]),
      facet("focus", "分析重点", detail.analysisFocus, ["分析重点", "入宫"]),
      facet("supportive", "助力信号", detail.supportiveSignals, ["助力", "缓冲"]),
      facet("pressure", "压力信号", detail.pressureSignals, ["压力", "风险"]),
      facet("relation", "关系复核", detail.relationUsage, ["同宫", "对宫", "三方四正"]),
      facet("dynamic", "动态用法", detail.dynamicUsage, ["大限", "流年", "流月", "流日", "流时"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "flowType", "证据"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["periodic-star-palace-combination.dictionary", "dynamic-flow.dictionary", "search.index"],
    applicableScopes: ["周期流系入宫解释", "动态盘", "详细分析", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.starId,
      detail.sectorName,
      detail.group,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiStarPairCombinationKnowledgeRecord(
  detail: ReturnType<typeof getAllStarPairCombinationContentDetails>[number]
): ZiweiStarPairCombinationKnowledgeRecord {
  return {
    id: `star-pair-combination-knowledge.${detail.combinationId}`,
    entity: {
      kind: "star-pair-combination",
      id: detail.combinationId,
      label: `${detail.starALabel}${detail.starBLabel}组合`
    },
    starAId: detail.starAId,
    starBId: detail.starBId,
    combinationGroup: detail.group,
    sourceIds: [
      "ziwei-star-pair-combination-dictionary",
      "ziwei-star-catalog",
      "ziwei-content-dictionary",
      "ziwei-relationship-structure-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `starPairCombination:${detail.combinationId}`,
      `starPairGroup:${detail.group}`,
      `star:${detail.starAId}`,
      `star:${detail.starBId}`,
      `starCategory:${detail.starACategory}`,
      `starCategory:${detail.starBCategory}`,
      `starLabel:${detail.starALabel}`,
      `starLabel:${detail.starBLabel}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "组合身份", [detail.coreReading, detail.groupRole, detail.interactionMode], [detail.starALabel, detail.starBLabel, detail.group]),
      facet("reading", "读盘顺序", detail.readingOrder, ["读盘", "同宫", "会照", "夹宫"]),
      facet("supportive", "助力信号", detail.supportiveSignals, ["助力", "加吉", "补强"]),
      facet("pressure", "压力信号", detail.pressureSignals, ["压力", "加煞", "破格"]),
      facet("relation", "宫位关系", detail.palaceRelationUsage, ["同宫", "对宫", "三方四正", "夹宫"]),
      facet("dynamic", "动态用法", detail.dynamicUsage, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "flowType", "证据"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["star-pair-combination.dictionary", "star.combination", "search.index"],
    applicableScopes: ["星曜组合解释", "星曜字典", "格局复核", "详细分析", "动态盘", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.starAId,
      detail.starBId,
      detail.group,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiPatternCombinationRelationKnowledgeRecord(
  detail: ReturnType<typeof getAllPatternCombinationRelationContentDetails>[number]
): ZiweiPatternCombinationRelationKnowledgeRecord {
  return {
    id: `pattern-combination-relation-knowledge.${detail.relationId}`,
    entity: {
      kind: "pattern-combination-relation",
      id: detail.relationId,
      label: `${detail.starPairGroup} 与 ${detail.patternCategoryLabel}`
    },
    starPairGroup: detail.starPairGroup,
    patternCategory: detail.patternCategory,
    relationRole: detail.role,
    sourceIds: [
      "ziwei-pattern-combination-relation-dictionary",
      "ziwei-star-pair-combination-dictionary",
      "ziwei-pattern-catalog"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `patternCombinationRelation:${detail.relationId}`,
      `starPairGroup:${detail.starPairGroup}`,
      `patternCategory:${detail.patternCategory}`,
      `relationRole:${detail.role}`,
      `patternCategoryLabel:${detail.patternCategoryLabel}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "关系身份", [detail.coreReading], [detail.starPairGroup, detail.patternCategory, detail.role]),
      facet("formation", "成格用法", detail.formationUsage, ["成格", "证据"]),
      facet("enhancement", "加吉增强", detail.enhancementUsage, ["加吉", "增强"]),
      facet("breakage", "加煞破格", detail.breakageUsage, ["加煞", "破格"]),
      facet("weak-bearing", "弱承接", detail.weakBearingUsage, ["弱承接", "复核"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "patternId", "证据"]),
      facet("review", "复核问题", detail.reviewQuestions, ["人工复核", "边界"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["pattern-combination-relation.dictionary", "pattern.dictionary", "star.combination", "search.index"],
    applicableScopes: ["格局复核", "星曜组合解释", "详细分析", "动态盘", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.starPairGroup,
      detail.patternCategory,
      detail.role,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiRelationshipStructureKnowledgeRecord(
  detail: ReturnType<typeof getAllRelationshipStructureContentDetails>[number]
): ZiweiRelationshipStructureKnowledgeRecord {
  return {
    id: `relationship-structure-knowledge.${detail.relationId}`,
    entity: {
      kind: "relationship",
      id: detail.relationId,
      label: detail.label
    },
    relationScope: detail.scope,
    sourceIds: ["ziwei-relationship-structure-dictionary", "structured-term-index"],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `relationship:${detail.relationId}`,
      `relationshipLabel:${detail.label}`,
      ...detail.aliases.map((alias) => `alias:${alias}`),
      ...detail.patternUsage.map((usage) => `patternUsage:${usage}`),
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "关系身份", [detail.nature, `适用范围：${detail.scope}`], [detail.label, detail.relationId]),
      facet("boundary", "算法边界", detail.calculationBoundary, ["算法边界", "不重复排盘"]),
      facet("evidence", "证据用法", detail.evidenceUsage, ["证据", "复核"]),
      facet("star", "星曜用法", detail.starUsage, ["星曜", "四化", "煞曜", "辅曜"]),
      facet("palace", "宫位用法", detail.palaceUsage, ["宫位", "宫位关系"]),
      facet("dynamic", "动态盘用法", detail.dynamicUsage, ["大限", "流年", "流月", "流日", "流时"]),
      facet("pattern", "格局用法", detail.patternUsage, ["格局", "破格", "成格"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["relationship.dictionary", "palace.relation", "search.index"],
    applicableScopes: ["关系结构解释", "三方四正", "动态盘", "格局复核", "详细分析", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      ...detail.aliases,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiPalaceThemeChainKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainContentDetails>[number]
): ZiweiPalaceThemeChainKnowledgeRecord {
  return {
    id: `palace-theme-chain-knowledge.${detail.chainId}`,
    entity: {
      kind: "palace-theme-chain",
      id: detail.chainId,
      label: detail.label
    },
    chainCategory: detail.category,
    primaryPalace: detail.primaryPalace,
    palaceSequence: detail.palaceSequence,
    sourceIds: [
      "ziwei-palace-theme-chain-dictionary",
      "ziwei-palace-dictionary",
      "ziwei-relationship-structure-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeChain:${detail.chainId}`,
      `chainCategory:${detail.category}`,
      `primaryPalace:${detail.primaryPalace}`,
      ...detail.palaceSequence.map((sectorName) => `chainPalace:${sectorName}`),
      ...detail.sourceReferences.map((source) => `sourceReference:${source.sourceId}`)
    ]),
    facets: [
      facet("identity", "主题链身份", [detail.coreQuestion, detail.chainReading], [detail.label, detail.chainId]),
      facet("palace", "宫位角色", detail.palaceRoles, ["主宫", "辅助宫", "宫位链"]),
      facet("star", "星曜读取", detail.starUsage, ["主星", "辅曜", "煞曜", "杂曜"]),
      facet("transformation", "四化读取", detail.transformationUsage, ["化禄", "化权", "化科", "化忌"]),
      facet("dynamic", "动态盘读取", detail.dynamicUsage, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "证据", "盘层"]),
      facet("review", "复核问题", detail.reviewQuestions, ["人工复核", "主题复核"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      facet("sourceReferences", "理论来源", detail.sourceReferences.map((source) => `${source.sourceId}: ${source.usage}`), ["sourceReferences", "理论来源"])
    ],
    storageBuckets: [
      "palace-theme-chain.dictionary",
      "palace.relation",
      "search.index"
    ],
    applicableScopes: [
      "主题链解释",
      "宫位综合复核",
      "动态盘",
      "详细分析",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.primaryPalace,
      ...detail.supportingPalaces,
      detail.category,
      ...detail.sourceReferences.map((source) => source.sourceId)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiPalaceThemeChainSynthesisTemplateKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainSynthesisTemplateContentDetails>[number]
): ZiweiPalaceThemeChainSynthesisTemplateKnowledgeRecord {
  return {
    id: `palace-theme-template-knowledge.${detail.templateId}`,
    entity: {
      kind: "palace-theme-template",
      id: detail.templateId,
      label: detail.label
    },
    chainId: detail.chainId,
    templateCategory: detail.category,
    primaryPalace: detail.primaryPalace,
    sourceIds: [
      "ziwei-palace-theme-synthesis-template-dictionary",
      "ziwei-palace-theme-chain-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeTemplate:${detail.templateId}`,
      `palaceThemeChain:${detail.chainId}`,
      `templateCategory:${detail.category}`,
      `primaryPalace:${detail.primaryPalace}`,
      ...detail.palaceSequence.map((sectorName) => `templatePalace:${sectorName}`),
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "模板身份", [detail.summaryTemplate], [detail.label, detail.templateId, detail.chainId]),
      facet("output", "输出结构", detail.outputStructure, ["总论", "证据", "动态盘", "边界"]),
      facet("evidence", "证据顺序", detail.evidenceOrder, ["主宫", "辅助宫", "对宫", "三方四正"]),
      facet("strength", "强承接规则", detail.strengthRules, ["强承接", "补强"]),
      facet("breakage", "破格与受压", detail.breakageRules, ["破格", "受压", "煞忌"]),
      facet("repair", "修复与补救", detail.repairRules, ["补救", "化科", "辅曜"]),
      facet("dynamic", "动态盘层级", detail.dynamicLayerRules, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("hidden", "隐藏未命中", detail.hiddenResultRules, ["隐藏未命中", "只显示命中"]),
      facet("source", "来源字段", detail.sourceFields, ["sourceRuleId", "证据字段"]),
      facet("caution", "风险边界", detail.riskBoundaries, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-template.dictionary",
      "palace-theme-chain.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链综合解释",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.chainId,
      detail.primaryPalace,
      ...detail.palaceSequence,
      detail.category,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.riskBoundaries
  }
}

export function buildZiweiPalaceThemeChainEvidenceHitRuleKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainEvidenceHitRuleContentDetails>[number]
): ZiweiPalaceThemeChainEvidenceHitRuleKnowledgeRecord {
  return {
    id: `palace-theme-hit-rule-knowledge.${detail.ruleId}`,
    entity: {
      kind: "palace-theme-hit-rule",
      id: detail.ruleId,
      label: detail.label
    },
    chainId: detail.chainId,
    templateId: detail.templateId,
    ruleCategory: detail.category,
    primaryPalace: detail.primaryPalace,
    sourceIds: [
      "ziwei-palace-theme-hit-rule-dictionary",
      "ziwei-palace-theme-synthesis-template-dictionary",
      "ziwei-palace-theme-chain-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeHitRule:${detail.ruleId}`,
      `palaceThemeTemplate:${detail.templateId}`,
      `palaceThemeChain:${detail.chainId}`,
      `ruleCategory:${detail.category}`,
      `primaryPalace:${detail.primaryPalace}`,
      ...detail.palaceSequence.map((sectorName) => `hitRulePalace:${sectorName}`),
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "命中规则身份", [`${detail.label}，主宫 ${detail.primaryPalace}`], [detail.ruleId, detail.chainId, detail.templateId]),
      facet("required", "必要证据", detail.requiredEvidence, ["必要证据", "sourceRuleId"]),
      facet("strong", "强命中", detail.strongHitRules, ["强命中", "强承接"]),
      facet("weak", "弱命中", detail.weakHitRules, ["弱命中", "弱承接"]),
      facet("breakage", "破格命中", detail.breakageHitRules, ["破格", "煞忌", "受压"]),
      facet("repair", "修复命中", detail.repairHitRules, ["修复", "补强"]),
      facet("hidden", "隐藏条件", detail.hiddenWhen, ["隐藏未命中", "只显示命中"]),
      facet("dynamic", "动态盘层级", detail.dynamicLayerHitRules, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("score", "评分备注", detail.scoringNotes, ["强弱", "降权"]),
      facet("source", "来源字段", detail.sourceFields, ["sourceRuleId", "证据字段"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-hit-rule.dictionary",
      "palace-theme-template.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链命中复核",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.ruleId,
      detail.chainId,
      detail.templateId,
      detail.primaryPalace,
      ...detail.palaceSequence,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.hiddenWhen
  }
}

export function buildZiweiPalaceThemeChainResultThresholdKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainResultThresholdContentDetails>[number]
): ZiweiPalaceThemeChainResultThresholdKnowledgeRecord {
  return {
    id: `palace-theme-result-threshold-knowledge.${detail.thresholdId}`,
    entity: {
      kind: "palace-theme-result-threshold",
      id: detail.thresholdId,
      label: detail.label
    },
    chainId: detail.chainId,
    ruleId: detail.ruleId,
    templateId: detail.templateId,
    thresholdCategory: detail.category,
    primaryPalace: detail.primaryPalace,
    sourceIds: [
      "ziwei-palace-theme-result-threshold-dictionary",
      "ziwei-palace-theme-hit-rule-dictionary",
      "ziwei-palace-theme-synthesis-template-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeResultThreshold:${detail.thresholdId}`,
      `palaceThemeHitRule:${detail.ruleId}`,
      `palaceThemeTemplate:${detail.templateId}`,
      `palaceThemeChain:${detail.chainId}`,
      `thresholdCategory:${detail.category}`,
      `primaryPalace:${detail.primaryPalace}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "展示门槛身份", [`${detail.label}，主宫 ${detail.primaryPalace}`], [detail.thresholdId, detail.ruleId, detail.chainId, detail.templateId]),
      facet("tier", "结果层级", detail.displayTiers, ["strong", "weak", "breakage", "repair", "hidden"]),
      facet("visibility", "展示阈值", detail.visibilityThresholds, ["展示阈值", "隐藏条件"]),
      facet("ranking", "排序规则", detail.rankingRules, ["排序", "优先级"]),
      facet("section", "段落输出", detail.sectionOutputRules, ["段落", "输出"]),
      facet("merge", "证据合并", detail.evidenceMergeRules, ["证据合并", "sourceRuleId"]),
      facet("layer", "盘层继承", detail.layerInheritanceRules, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("suppression", "隐藏抑制", detail.suppressionRules, ["隐藏", "抑制"]),
      facet("review", "复核升级", detail.reviewEscalationRules, ["人工复核", "高风险"]),
      facet("source", "来源字段", detail.sourceFields, ["sourceRuleId", "displayTier"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-result-threshold.dictionary",
      "palace-theme-hit-rule.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链结果展示",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.thresholdId,
      detail.ruleId,
      detail.chainId,
      detail.templateId,
      detail.primaryPalace,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.suppressionRules
  }
}

export function buildZiweiPalaceThemeChainOutputParagraphTemplateKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainOutputParagraphTemplateContentDetails>[number]
): ZiweiPalaceThemeChainOutputParagraphTemplateKnowledgeRecord {
  return {
    id: `palace-theme-output-paragraph-knowledge.${detail.paragraphTemplateId}`,
    entity: {
      kind: "palace-theme-paragraph-template",
      id: detail.paragraphTemplateId,
      label: detail.label
    },
    chainId: detail.chainId,
    thresholdId: detail.thresholdId,
    ruleId: detail.ruleId,
    templateId: detail.templateId,
    paragraphCategory: detail.category,
    primaryPalace: detail.primaryPalace,
    sourceIds: [
      "ziwei-palace-theme-output-paragraph-template-dictionary",
      "ziwei-palace-theme-result-threshold-dictionary",
      "ziwei-palace-theme-hit-rule-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeOutputParagraph:${detail.paragraphTemplateId}`,
      `palaceThemeResultThreshold:${detail.thresholdId}`,
      `palaceThemeHitRule:${detail.ruleId}`,
      `palaceThemeChain:${detail.chainId}`,
      `paragraphCategory:${detail.category}`,
      `primaryPalace:${detail.primaryPalace}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "段落模板身份", [`${detail.label}，主宫 ${detail.primaryPalace}`], [detail.paragraphTemplateId, detail.thresholdId, detail.ruleId, detail.chainId]),
      facet("type", "段落类型", detail.paragraphTypes, ["summary", "evidence", "pressure", "repair", "dynamic", "review"]),
      facet("summary", "总论段", detail.summaryParagraphRules, ["总论", "summary"]),
      facet("evidence", "证据段", detail.evidenceParagraphRules, ["证据", "sourceRuleId"]),
      facet("pressure", "受压段", detail.pressureParagraphRules, ["受压", "破格"]),
      facet("repair", "修复段", detail.repairParagraphRules, ["修复", "补强"]),
      facet("dynamic", "动态盘段", detail.dynamicParagraphRules, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("review", "复核缺口段", detail.reviewParagraphRules, ["复核", "缺口"]),
      facet("tone", "语气边界", detail.toneRules, ["风险语言", "边界"]),
      facet("source", "来源字段", detail.sourceFields, ["sourceRuleId", "paragraphType"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-paragraph-template.dictionary",
      "palace-theme-result-threshold.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链段落组织",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.paragraphTemplateId,
      detail.thresholdId,
      detail.ruleId,
      detail.chainId,
      detail.templateId,
      detail.primaryPalace,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.toneRules
  }
}

export function buildZiweiPalaceThemeChainEvidenceFieldStandardKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainEvidenceFieldStandardContentDetails>[number]
): ZiweiPalaceThemeChainEvidenceFieldStandardKnowledgeRecord {
  return {
    id: `palace-theme-evidence-field-knowledge.${detail.fieldName}`,
    entity: {
      kind: "palace-theme-evidence-field",
      id: detail.fieldId,
      label: detail.label
    },
    fieldName: detail.fieldName,
    fieldCategory: detail.category,
    sourceIds: [
      "ziwei-palace-theme-evidence-field-standard-dictionary",
      "ziwei-palace-theme-output-paragraph-template-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeEvidenceField:${detail.fieldName}`,
      `fieldName:${detail.fieldName}`,
      `fieldCategory:${detail.category}`,
      `fieldId:${detail.fieldId}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "字段身份", [`${detail.label}（${detail.fieldName}）`, `值结构：${detail.valueShape}`], [detail.fieldName, detail.category]),
      facet("scope", "适用范围", detail.requiredScopes, ["适用范围", "字段"]),
      facet("normalize", "标准化规则", detail.normalizationRules, ["标准化", "字段"]),
      facet("validate", "校验规则", detail.validationRules, ["校验", "字段"]),
      facet("merge", "合并规则", detail.mergeRules, ["合并", "盘层"]),
      facet("display", "展示用途", detail.displayUsage, ["展示", "段落"]),
      facet("source", "来源链路", detail.sourceLineage, ["sourceRuleId", "来源"]),
      facet("hidden", "隐藏条件", detail.hiddenWhen, ["隐藏", "复核"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-evidence-field.dictionary",
      "palace-theme-paragraph-template.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链字段标准",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.fieldId,
      detail.fieldName,
      detail.category,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.hiddenWhen
  }
}

export function buildZiweiPalaceThemeChainFieldParagraphReviewMatrixKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainFieldParagraphReviewMatrixContentDetails>[number]
): ZiweiPalaceThemeChainFieldParagraphReviewMatrixKnowledgeRecord {
  return {
    id: `palace-theme-field-paragraph-matrix-knowledge.${detail.paragraphType}.${detail.fieldName}`,
    entity: {
      kind: "palace-theme-field-paragraph-matrix",
      id: detail.matrixId,
      label: `${detail.paragraphLabel}-${detail.fieldLabel}`
    },
    fieldName: detail.fieldName,
    paragraphType: detail.paragraphType,
    requirementLevel: detail.requirementLevel,
    sourceIds: [
      "ziwei-palace-theme-field-paragraph-review-matrix-dictionary",
      "ziwei-palace-theme-evidence-field-standard-dictionary",
      "ziwei-palace-theme-output-paragraph-template-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeFieldParagraphMatrix:${detail.matrixId}`,
      `fieldName:${detail.fieldName}`,
      `paragraphType:${detail.paragraphType}`,
      `requirementLevel:${detail.requirementLevel}`,
      `fieldCategory:${detail.fieldCategory}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "矩阵身份", [`${detail.fieldLabel} 在 ${detail.paragraphLabel} 中为 ${detail.requirementLevel}`], [detail.matrixId, detail.fieldName, detail.paragraphType]),
      facet("required", "必需条件", detail.requiredWhen, ["必需", "字段", "段落"]),
      facet("optional", "可选条件", detail.optionalWhen, ["可选", "补充"]),
      facet("hidden", "隐藏条件", detail.hiddenWhen, ["隐藏", "未命中"]),
      facet("review", "复核触发", detail.reviewTriggers, ["复核", "冲突"]),
      facet("merge", "合并规则", detail.mergeRules, ["合并", "盘层"]),
      facet("display", "展示规则", detail.displayRules, ["展示", "段落"]),
      facet("source", "来源链路", detail.sourceLineage, ["sourceRuleId", "来源"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-field-paragraph-matrix.dictionary",
      "palace-theme-evidence-field.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链字段段落矩阵",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.matrixId,
      detail.fieldId,
      detail.fieldName,
      detail.paragraphType,
      detail.requirementLevel,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.hiddenWhen
  }
}

export function buildZiweiPalaceThemeChainEvidenceDomainCrossReferenceKnowledgeRecord(
  detail: ReturnType<typeof getAllPalaceThemeChainEvidenceDomainCrossReferenceContentDetails>[number]
): ZiweiPalaceThemeChainEvidenceDomainCrossReferenceKnowledgeRecord {
  return {
    id: `palace-theme-evidence-domain-cross-reference-knowledge.${detail.evidenceDomain}.${detail.fieldName}`,
    entity: {
      kind: "palace-theme-evidence-domain-cross-reference",
      id: detail.crossRefId,
      label: `${detail.domainLabel}-${detail.fieldLabel}`
    },
    fieldName: detail.fieldName,
    evidenceDomain: detail.evidenceDomain,
    relationRole: detail.relationRole,
    sourceIds: [
      "ziwei-palace-theme-evidence-domain-cross-reference-dictionary",
      "ziwei-palace-theme-evidence-field-standard-dictionary",
      "ziwei-palace-theme-field-paragraph-review-matrix-dictionary"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `palaceThemeEvidenceDomainCrossReference:${detail.crossRefId}`,
      `fieldName:${detail.fieldName}`,
      `evidenceDomain:${detail.evidenceDomain}`,
      `relationRole:${detail.relationRole}`,
      `fieldCategory:${detail.fieldCategory}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "对照身份", [`${detail.fieldLabel} 对照 ${detail.domainLabel}，角色 ${detail.relationRole}`], [detail.crossRefId, detail.fieldName, detail.evidenceDomain]),
      facet("usage", "证据用途", detail.evidenceUsage, ["证据域", "字段"]),
      facet("required", "必要证据", detail.requiredEvidence, ["必要证据", "sourceRuleId"]),
      facet("excluded", "排除条件", detail.excludedWhen, ["隐藏", "未命中"]),
      facet("conflict", "冲突复核", detail.conflictTriggers, ["复核", "冲突"]),
      facet("merge", "合并规则", detail.mergeRules, ["合并", "盘层"]),
      facet("display", "展示规则", detail.displayRules, ["展示", "命中"]),
      facet("source", "来源链路", detail.sourceLineage, ["sourceRuleId", "来源"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: [
      "palace-theme-evidence-domain-cross-reference.dictionary",
      "palace-theme-evidence-field.dictionary",
      "search.index"
    ],
    applicableScopes: [
      "主题链证据域对照",
      "详细分析",
      "动态盘",
      "资料检索",
      "人工校盘"
    ],
    relatedEntityIds: unique([
      detail.crossRefId,
      detail.fieldId,
      detail.fieldName,
      detail.evidenceDomain,
      detail.relationRole,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.excludedWhen
  }
}

export function buildZiweiTheorySourceReferenceKnowledgeRecord(
  detail: ReturnType<typeof getAllTheorySourceReferenceContentDetails>[number]
): ZiweiTheorySourceReferenceKnowledgeRecord {
  return {
    id: `theory-source-reference-knowledge.${detail.sourceId}`,
    entity: {
      kind: "theory-source-reference",
      id: detail.sourceId,
      label: detail.title
    },
    sourceKind: detail.sourceKind,
    sourceReliability: detail.sourceReliability,
    sourceIds: ["ziwei-theory-source-reference-dictionary", "structured-term-index"],
    copyrightPolicy: "original-content",
    confidence: detail.sourceReliability,
    reviewStatus: detail.sourceReliability === "high" ? "ready" : "needs-source-check",
    analysisTags: unique([
      `theorySource:${detail.sourceId}`,
      `sourceKind:${detail.sourceKind}`,
      `sourceReliability:${detail.sourceReliability}`,
      `copyrightPolicy:${detail.copyrightPolicy}`
    ]),
    facets: [
      facet("identity", "来源身份", [
        detail.title,
        detail.authorOrCompiler,
        detail.eraOrVersion,
        detail.editionOrLocation
      ], [detail.sourceId, detail.sourceKind]),
      facet("usage", "用途范围", detail.usedFor, ["用途", "理论来源"]),
      facet("citation", "引用规则", detail.citationUsageRules, ["引用边界", "版权"]),
      facet("storage", "存储边界", detail.storageBoundary, ["存储边界", "不可复制"]),
      facet("modules", "关联模块", detail.relatedDataModules, ["模块", "字典"]),
      facet("verification", "复核备注", detail.verificationNotes, ["复核", "来源校验"])
    ],
    storageBuckets: ["theory-source.reference", "source.metadata", "search.index"],
    applicableScopes: ["资料来源索引", "数据字典", "详细分析", "人工校盘", "版权复核"],
    relatedEntityIds: unique([
      detail.sourceId,
      detail.sourceKind,
      detail.accessUrl ?? "",
      ...detail.relatedDataModules
    ]),
    cautionFlags: detail.storageBoundary
  }
}

export function buildZiweiTransformationTopicKnowledgeRecord(
  detail: ReturnType<typeof getAllTransformationTopicContentDetails>[number]
): ZiweiTransformationTopicKnowledgeRecord {
  return {
    id: `transformation-topic-knowledge.${detail.topicId}`,
    entity: {
      kind: "transformation-topic",
      id: detail.topicId,
      label: detail.label
    },
    topicKind: detail.kind,
    sourceIds: ["ziwei-transformation-topic-dictionary", "ziwei-dynamic-flow-rules"],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `transformationTopic:${detail.topicId}`,
      `transformationTopicKind:${detail.kind}`,
      `transformationTopicLabel:${detail.label}`,
      `transformationScope:${detail.scope}`,
      ...detail.relatedTransformationStarIds.map((starId) => `transformationStar:${starId}`),
      detail.relatedStem ? `stem:${detail.relatedStem}` : "",
      detail.relatedFlowType ? `flow:${detail.relatedFlowType}` : "",
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "四化专题身份", [detail.nature, `适用范围：${detail.scope}`], [detail.label, detail.kind]),
      facet("source", "来源用法", detail.sourceUsage, ["来源天干", "盘层", "sourceStem"]),
      facet("target", "目标星用法", detail.targetUsage, ["目标星", "targetStarId"]),
      facet("palace", "目标宫用法", detail.palaceUsage, ["目标宫", "targetPalace"]),
      facet("flow", "盘层用法", detail.flowUsage, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("combination", "组合与格局", detail.combinationUsage, ["格局", "组合", "破格"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "证据"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["transformation.topic", "dynamic-flow.dictionary", "search.index"],
    applicableScopes: ["四化专题解释", "星曜字典", "动态盘", "格局复核", "详细分析", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      ...detail.relatedTransformationStarIds,
      detail.relatedStem ?? "",
      detail.relatedFlowType ?? "",
      ...detail.aliases,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiTransformationTargetCombinationKnowledgeRecord(
  detail: ReturnType<typeof getAllTransformationTargetCombinationContentDetails>[number]
): ZiweiTransformationTargetCombinationKnowledgeRecord {
  return {
    id: `transformation-target-knowledge.${detail.combinationId}`,
    entity: {
      kind: "transformation-target",
      id: detail.combinationId,
      label: detail.label
    },
    transformationStarId: detail.transformationStarId,
    targetStarId: detail.targetStarId,
    sourceIds: [
      "ziwei-transformation-target-combination-dictionary",
      "ziwei-dynamic-flow-rules"
    ],
    copyrightPolicy: "original-content",
    confidence: "high",
    reviewStatus: "ready",
    analysisTags: unique([
      `transformationTarget:${detail.combinationId}`,
      `transformationStar:${detail.transformationStarId}`,
      `targetStar:${detail.targetStarId}`,
      ...detail.sourceStems.map((stem) => `sourceStem:${stem}`),
      `targetRole:${detail.targetRole}`,
      ...sourceReferenceTags(detail.sourceReferences)
    ]),
    facets: [
      facet("identity", "四化目标星组合身份", [detail.targetRole], [detail.label, detail.combinationId]),
      facet("source", "来源天干", detail.sourceUsage, ["来源天干", "四化目标表"]),
      facet("effect", "化象承接", detail.transformationEffect, ["目标星", "承接", "化象"]),
      facet("palace", "目标宫读法", detail.palaceReading, ["目标宫", "宫位"]),
      facet("flow", "盘层读法", detail.flowReading, ["本命", "大限", "流年", "流月", "流日", "流时"]),
      facet("relation", "关系结构", detail.relationReading, ["同宫", "对宫", "三方四正", "夹宫"]),
      facet("pattern", "格局用法", detail.patternReading, ["格局", "破格", "加成"]),
      facet("evidence", "证据字段", detail.evidenceFields, ["sourceRuleId", "证据"]),
      facet("caution", "误读边界", detail.cautions, ["误读", "边界"]),
      sourceReferenceFacet(detail.sourceReferences)
    ],
    storageBuckets: ["transformation.target", "star.transformation", "search.index"],
    applicableScopes: ["四化目标星解释", "星曜字典", "动态盘", "格局复核", "详细分析", "资料检索", "人工校盘"],
    relatedEntityIds: unique([
      detail.transformationStarId,
      detail.targetStarId,
      ...detail.sourceStems,
      ...sourceReferenceIds(detail.sourceReferences)
    ]),
    cautionFlags: detail.cautions
  }
}

export function buildZiweiKnowledgeRepositorySnapshot(input: {
  stars: ZiweiStarDefinition[]
  patterns: ZiweiPatternContentDetailInput[]
}): ZiweiKnowledgeRepositorySnapshot {
  const starRecords = input.stars.map(buildZiweiStarKnowledgeRecord)
  const patternRecords = input.patterns.map(buildZiweiPatternKnowledgeRecord)
  const branchRecords = getAllBranchContentDetails().map(buildZiweiBranchKnowledgeRecord)
  const stemRecords = getAllStemContentDetails().map(buildZiweiStemKnowledgeRecord)
  const elementGateRecords = getAllElementGateContentDetails().map(buildZiweiElementGateKnowledgeRecord)
  const palaceRecords = getAllPalaceContentDetails().map(buildZiweiPalaceKnowledgeRecord)
  const mainStarPalaceCombinationRecords =
    getAllMainStarPalaceCombinationContentDetails().map(
      buildZiweiMainStarPalaceCombinationKnowledgeRecord
    )
  const nonMainStarPalaceCombinationRecords =
    getAllNonMainStarPalaceCombinationContentDetails().map(
      buildZiweiNonMainStarPalaceCombinationKnowledgeRecord
    )
  const periodicStarPalaceCombinationRecords =
    getAllPeriodicStarPalaceCombinationContentDetails().map(
      buildZiweiPeriodicStarPalaceCombinationKnowledgeRecord
    )
  const starPairCombinationRecords =
    getAllStarPairCombinationContentDetails().map(
      buildZiweiStarPairCombinationKnowledgeRecord
    )
  const patternCombinationRelationRecords =
    getAllPatternCombinationRelationContentDetails().map(
      buildZiweiPatternCombinationRelationKnowledgeRecord
    )
  const relationshipStructureRecords =
    getAllRelationshipStructureContentDetails().map(
      buildZiweiRelationshipStructureKnowledgeRecord
    )
  const palaceThemeChainRecords =
    getAllPalaceThemeChainContentDetails().map(
      buildZiweiPalaceThemeChainKnowledgeRecord
    )
  const palaceThemeChainSynthesisTemplateRecords =
    getAllPalaceThemeChainSynthesisTemplateContentDetails().map(
      buildZiweiPalaceThemeChainSynthesisTemplateKnowledgeRecord
    )
  const palaceThemeChainEvidenceHitRuleRecords =
    getAllPalaceThemeChainEvidenceHitRuleContentDetails().map(
      buildZiweiPalaceThemeChainEvidenceHitRuleKnowledgeRecord
    )
  const palaceThemeChainResultThresholdRecords =
    getAllPalaceThemeChainResultThresholdContentDetails().map(
      buildZiweiPalaceThemeChainResultThresholdKnowledgeRecord
    )
  const palaceThemeChainOutputParagraphTemplateRecords =
    getAllPalaceThemeChainOutputParagraphTemplateContentDetails().map(
      buildZiweiPalaceThemeChainOutputParagraphTemplateKnowledgeRecord
    )
  const palaceThemeChainEvidenceFieldStandardRecords =
    getAllPalaceThemeChainEvidenceFieldStandardContentDetails().map(
      buildZiweiPalaceThemeChainEvidenceFieldStandardKnowledgeRecord
    )
  const palaceThemeChainFieldParagraphReviewMatrixRecords =
    getAllPalaceThemeChainFieldParagraphReviewMatrixContentDetails().map(
      buildZiweiPalaceThemeChainFieldParagraphReviewMatrixKnowledgeRecord
    )
  const palaceThemeChainEvidenceDomainCrossReferenceRecords =
    getAllPalaceThemeChainEvidenceDomainCrossReferenceContentDetails().map(
      buildZiweiPalaceThemeChainEvidenceDomainCrossReferenceKnowledgeRecord
    )
  const theorySourceReferenceRecords =
    getAllTheorySourceReferenceContentDetails().map(
      buildZiweiTheorySourceReferenceKnowledgeRecord
    )
  const transformationTopicRecords =
    getAllTransformationTopicContentDetails().map(
      buildZiweiTransformationTopicKnowledgeRecord
    )
  const transformationTargetCombinationRecords =
    getAllTransformationTargetCombinationContentDetails().map(
      buildZiweiTransformationTargetCombinationKnowledgeRecord
    )

  return {
    sources: ZIWEI_KNOWLEDGE_SOURCES,
    terms: ZIWEI_KNOWLEDGE_TERMS,
    intakePacks: ZIWEI_KNOWLEDGE_INTAKE_PACKS,
    analysisDimensions: ZIWEI_KNOWLEDGE_ANALYSIS_DIMENSIONS,
    calibrationFields: ZIWEI_KNOWLEDGE_CALIBRATION_FIELDS,
    starRecords,
    patternRecords,
    branchRecords,
    stemRecords,
    elementGateRecords,
    palaceRecords,
    mainStarPalaceCombinationRecords,
    nonMainStarPalaceCombinationRecords,
    periodicStarPalaceCombinationRecords,
    starPairCombinationRecords,
    patternCombinationRelationRecords,
    relationshipStructureRecords,
    palaceThemeChainRecords,
    palaceThemeChainSynthesisTemplateRecords,
    palaceThemeChainEvidenceHitRuleRecords,
    palaceThemeChainResultThresholdRecords,
    palaceThemeChainOutputParagraphTemplateRecords,
    palaceThemeChainEvidenceFieldStandardRecords,
    palaceThemeChainFieldParagraphReviewMatrixRecords,
    palaceThemeChainEvidenceDomainCrossReferenceRecords,
    theorySourceReferenceRecords,
    transformationTopicRecords,
    transformationTargetCombinationRecords,
    stats: {
      sourceCount: ZIWEI_KNOWLEDGE_SOURCES.length,
      termCount: ZIWEI_KNOWLEDGE_TERMS.length,
      intakePackCount: ZIWEI_KNOWLEDGE_INTAKE_PACKS.length,
      analysisDimensionCount: ZIWEI_KNOWLEDGE_ANALYSIS_DIMENSIONS.length,
      calibrationFieldCount: ZIWEI_KNOWLEDGE_CALIBRATION_FIELDS.length,
      starRecordCount: starRecords.length,
      patternRecordCount: patternRecords.length,
      branchRecordCount: branchRecords.length,
      stemRecordCount: stemRecords.length,
      elementGateRecordCount: elementGateRecords.length,
      palaceRecordCount: palaceRecords.length,
      mainStarPalaceCombinationRecordCount: mainStarPalaceCombinationRecords.length,
      nonMainStarPalaceCombinationRecordCount: nonMainStarPalaceCombinationRecords.length,
      periodicStarPalaceCombinationRecordCount: periodicStarPalaceCombinationRecords.length,
      starPairCombinationRecordCount: starPairCombinationRecords.length,
      patternCombinationRelationRecordCount: patternCombinationRelationRecords.length,
      relationshipStructureRecordCount: relationshipStructureRecords.length,
      palaceThemeChainRecordCount: palaceThemeChainRecords.length,
      palaceThemeChainSynthesisTemplateRecordCount:
        palaceThemeChainSynthesisTemplateRecords.length,
      palaceThemeChainEvidenceHitRuleRecordCount:
        palaceThemeChainEvidenceHitRuleRecords.length,
      palaceThemeChainResultThresholdRecordCount:
        palaceThemeChainResultThresholdRecords.length,
      palaceThemeChainOutputParagraphTemplateRecordCount:
        palaceThemeChainOutputParagraphTemplateRecords.length,
      palaceThemeChainEvidenceFieldStandardRecordCount:
        palaceThemeChainEvidenceFieldStandardRecords.length,
      palaceThemeChainFieldParagraphReviewMatrixRecordCount:
        palaceThemeChainFieldParagraphReviewMatrixRecords.length,
      palaceThemeChainEvidenceDomainCrossReferenceRecordCount:
        palaceThemeChainEvidenceDomainCrossReferenceRecords.length,
      theorySourceReferenceRecordCount: theorySourceReferenceRecords.length,
      transformationTopicRecordCount: transformationTopicRecords.length,
      transformationTargetCombinationRecordCount: transformationTargetCombinationRecords.length,
      recordCount:
        starRecords.length +
        patternRecords.length +
        branchRecords.length +
        stemRecords.length +
        elementGateRecords.length +
        palaceRecords.length +
        mainStarPalaceCombinationRecords.length +
        nonMainStarPalaceCombinationRecords.length +
        periodicStarPalaceCombinationRecords.length +
        starPairCombinationRecords.length +
        patternCombinationRelationRecords.length +
        relationshipStructureRecords.length +
        palaceThemeChainRecords.length +
        palaceThemeChainSynthesisTemplateRecords.length +
        palaceThemeChainEvidenceHitRuleRecords.length +
        palaceThemeChainResultThresholdRecords.length +
        palaceThemeChainOutputParagraphTemplateRecords.length +
        palaceThemeChainEvidenceFieldStandardRecords.length +
        palaceThemeChainFieldParagraphReviewMatrixRecords.length +
        palaceThemeChainEvidenceDomainCrossReferenceRecords.length +
        theorySourceReferenceRecords.length +
        transformationTopicRecords.length +
        transformationTargetCombinationRecords.length
    }
  }
}

function term(
  id: string,
  label: string,
  entityKind: ZiweiKnowledgeTerm["entityKind"],
  aliases: string[],
  definition: string
): ZiweiKnowledgeTerm {
  return {
    id,
    label,
    entityKind,
    aliases,
    definition,
    analysisUsage: ["资料检索", "盘面分析", "人工校准", "后续模型特征"],
    sourceIds: ["structured-term-index", "ziwei-content-dictionary"],
    copyrightPolicy: "original-content"
  }
}

function intakePack(
  id: string,
  label: string,
  purpose: string,
  acceptedData: string[],
  rejectedData: string[],
  sourceIds: string[],
  storageBuckets: string[]
): ZiweiKnowledgeIntakePack {
  return {
    id,
    label,
    purpose,
    acceptedData,
    rejectedData,
    sourceIds,
    copyrightPolicy: sourceIds.includes("external-reference-index")
      ? "metadata-only"
      : "original-content",
    reviewStatus: sourceIds.some((sourceId) => {
      return sourceId.includes("external") || sourceId.includes("human") || sourceId.includes("user")
    })
      ? "needs-human-review"
      : "ready",
    storageBuckets,
    analysisTags: unique([
      `intake:${id}`,
      ...storageBuckets.map((bucket) => `bucket:${bucket}`)
    ])
  }
}

function analysisDimension(
  id: string,
  label: string,
  scope: ZiweiKnowledgeAnalysisDimension["scope"],
  description: string,
  inputBuckets: string[],
  outputTags: string[],
  reviewQuestions: string[]
): ZiweiKnowledgeAnalysisDimension {
  return {
    id,
    label,
    scope,
    description,
    inputBuckets,
    outputTags,
    reviewQuestions
  }
}

function calibrationField(
  id: string,
  label: string,
  scope: ZiweiKnowledgeCalibrationField["scope"],
  description: string,
  required: boolean,
  sourceIds: string[]
): ZiweiKnowledgeCalibrationField {
  return {
    id,
    label,
    scope,
    description,
    required,
    sourceIds,
    reviewStatus: required ? "ready" : "needs-human-review"
  }
}

function facet(
  facetId: string,
  label: string,
  items: string[],
  keywords: string[]
): ZiweiKnowledgeFacet {
  return {
    facetId,
    label,
    summary: items.join("；"),
    keywords: unique(keywords)
  }
}

function sourceReferenceTags(
  sourceReferences: ZiweiContentSourceReference[]
): string[] {
  return sourceReferences.map((source) => `sourceReference:${source.sourceId}`)
}

function sourceReferenceIds(
  sourceReferences: ZiweiContentSourceReference[]
): string[] {
  return sourceReferences.map((source) => source.sourceId)
}

function sourceReferenceFacet(
  sourceReferences: ZiweiContentSourceReference[]
): ZiweiKnowledgeFacet {
  return facet(
    "sourceReferences",
    "理论来源",
    sourceReferences.map((source) => `${source.sourceId}: ${source.usage}`),
    ["sourceReferences", "理论来源"]
  )
}

function sourceForStarCategory(category: ZiweiStarCategory): string {
  if (category === "transformation") {
    return "ziwei-dynamic-flow-rules"
  }

  if (category === "yearly" || category === "monthly" || category === "dailyHourly") {
    return "ziwei-dynamic-flow-rules"
  }

  if (category === "lifecycle") {
    return "derived-analysis-index"
  }

  return "derived-analysis-index"
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function elementLabel(element: "wood" | "fire" | "earth" | "metal" | "water"): string {
  const labels: Record<typeof element, string> = {
    wood: "木",
    fire: "火",
    earth: "土",
    metal: "金",
    water: "水"
  }

  return labels[element]
}


