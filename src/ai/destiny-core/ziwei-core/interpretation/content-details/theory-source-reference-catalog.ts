import type {
  ZiweiContentDictionarySection,
  ZiweiTheorySourceKind,
  ZiweiTheorySourceReferenceContentDetail
} from "./content-detail-types"

interface TheorySourceSeed {
  sourceId: string
  title: string
  sourceKind: ZiweiTheorySourceKind
  authorOrCompiler: string
  eraOrVersion: string
  editionOrLocation: string
  accessUrl: string | null
  sourceReliability: "high" | "medium" | "low"
  copyrightPolicy: string
  usedFor: string[]
  citationUsageRules: string[]
  storageBoundary: string[]
  relatedDataModules: string[]
  verificationNotes: string[]
}

const THEORY_SOURCE_SEEDS: TheorySourceSeed[] = [
  {
    sourceId: "classic.ziwei-doushu-quanshu",
    title: "紫微斗数全书",
    sourceKind: "classic",
    authorOrCompiler: "托名陈抟，明代潘希尹补辑",
    eraOrVersion: "明代流传本",
    editionOrLocation: "南阳堂刊本系统，公开影印与整理索引",
    accessUrl:
      "https://zh.wikisource.org/zh-hant/%E7%B4%AB%E5%BE%AE%E6%96%97%E6%95%B8%E5%85%A8%E6%9B%B8",
    sourceReliability: "medium",
    copyrightPolicy: "public-domain-summary",
    usedFor: ["星曜本体", "宫位解释", "格局术语", "赋文术语", "读盘顺序参考"],
    citationUsageRules: [
      "只登记篇目、主题和自有摘要，不复制长段原文。",
      "古籍内容作为理论线索，需要结合项目算法与人工校验。",
      "遇到版本差异时标记 medium confidence，不直接写成唯一断法。"
    ],
    storageBoundary: [
      "允许存篇名、主题索引、结构化摘要和复核备注。",
      "不把古籍赋文整段复制到代码或页面。",
      "不把古籍中的断语直接输出为当前盘结论。"
    ],
    relatedDataModules: ["star.dictionary", "pattern.dictionary", "palace.dictionary", "relationship.dictionary"],
    verificationNotes: [
      "用于复核太微赋、形性赋、星垣论、斗数准绳、斗数发微论、诸星问答论等主题。"
    ]
  },
  {
    sourceId: "classic.ziwei-doushu-quanshu-shuge-index",
    title: "新锓希夷陈先生紫微斗数全书",
    sourceKind: "public-domain-index",
    authorOrCompiler: "托名陈抟，明代潘希尹补辑",
    eraOrVersion: "明代南阳堂刊本影印索引",
    editionOrLocation: "书格公开书影索引",
    accessUrl: "https://www.shuge.org/view/zi_wei_dou_shu_quan_shu/",
    sourceReliability: "medium",
    copyrightPolicy: "metadata-only",
    usedFor: ["古籍版本索引", "目录校对", "篇目来源定位"],
    citationUsageRules: [
      "只存书名、版本、整理说明和篇目索引。",
      "引用时优先标注为版本来源，不替代逐条文本校勘。",
      "不复制书影、图片、页面排版或整段说明。"
    ],
    storageBoundary: [
      "允许存版本元信息与人工摘要。",
      "不存书影图片，不搬运站点排版。",
      "后续逐条理论仍需进入自有结构化摘要。"
    ],
    relatedDataModules: ["source.metadata", "classic.index", "human.review"],
    verificationNotes: ["用于确认《紫微斗数全书》的版本脉络和公开影印入口。"]
  },
  {
    sourceId: "classic.ziwei-doushu-lineage-ctext-index",
    title: "紫微斗数古籍脉络索引",
    sourceKind: "public-domain-index",
    authorOrCompiler: "中国哲学书电子化计划条目整理",
    eraOrVersion: "现代数据库索引",
    editionOrLocation: "ctext wiki 条目",
    accessUrl: "https://ctext.org/wiki.pl?if=gb&remap=gb&res=979714",
    sourceReliability: "low",
    copyrightPolicy: "metadata-only",
    usedFor: ["古籍名称索引", "版本脉络线索", "后续人工查书入口"],
    citationUsageRules: [
      "只作为索引线索，不作为具体断法来源。",
      "提到《紫微斗数全集》《紫微斗数捷览》等时必须另行核书。",
      "不复制现代数据库条目正文。"
    ],
    storageBoundary: [
      "只存元信息和待核验标记。",
      "不能把索引内容当成已校勘理论。",
      "需要后续人工确认具体版本、页码和篇目。"
    ],
    relatedDataModules: ["external-reference-index", "human.review"],
    verificationNotes: ["作为古籍清单线索，具体内容必须二次核验。"]
  },
  {
    sourceId: "project.star-catalog",
    title: "项目星曜目录",
    sourceKind: "project-algorithm",
    authorOrCompiler: "ai-pet-world 项目",
    eraOrVersion: "当前代码版本",
    editionOrLocation: "src/ai/destiny-core/ziwei-core/star-catalog",
    accessUrl: null,
    sourceReliability: "high",
    copyrightPolicy: "original-content",
    usedFor: ["星曜 ID", "星曜分类", "显示名", "别名", "数据字典唯一星曜索引"],
    citationUsageRules: [
      "星曜 ID、分类和显示名以项目目录为唯一调用来源。",
      "解释资料只引用 starId，不重复定义一套星曜枚举。",
      "新增星曜必须先进入 star-catalog。"
    ],
    storageBoundary: [
      "只存项目结构化参数。",
      "不混入外部断语。",
      "页面和分析层只读取统一导出。"
    ],
    relatedDataModules: ["star.dictionary", "star.palace", "star.combination"],
    verificationNotes: ["代码内高可信结构来源。"]
  },
  {
    sourceId: "project.pattern-catalog",
    title: "项目格局目录",
    sourceKind: "project-algorithm",
    authorOrCompiler: "ai-pet-world 项目",
    eraOrVersion: "当前代码版本",
    editionOrLocation: "src/app/ziwei/_lib/ziwei-pattern-catalog.ts",
    accessUrl: null,
    sourceReliability: "high",
    copyrightPolicy: "original-content",
    usedFor: ["格局 ID", "格局分类", "成格条件", "命中与隐藏边界"],
    citationUsageRules: [
      "格局是否命中只以项目格局目录和当前盘结果为准。",
      "数据字典解释格局，不重写成格条件。",
      "未命中格局不得进入当前盘展示。"
    ],
    storageBoundary: [
      "只存可判定条件和项目自有解释。",
      "不复制外部成套格局断语。",
      "新增格局必须补检查脚本和样例。"
    ],
    relatedDataModules: ["pattern.dictionary", "pattern.combination", "palace-theme.evidence-domain"],
    verificationNotes: ["格局判定的项目唯一结构来源。"]
  },
  {
    sourceId: "project.transformation-rules",
    title: "项目四化目标规则",
    sourceKind: "project-algorithm",
    authorOrCompiler: "ai-pet-world 项目",
    eraOrVersion: "当前代码版本",
    editionOrLocation: "NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM 及动态流四化入口",
    accessUrl: null,
    sourceReliability: "high",
    copyrightPolicy: "original-content",
    usedFor: ["十干四化目标", "本命四化", "动态流四化", "目标星组合"],
    citationUsageRules: [
      "四化目标表只在算法层定义一次。",
      "数据字典只解释四化如何读取，不重新定义目标表。",
      "四化本身不分庙旺，只观察目标星、目标宫和盘层承接。"
    ],
    storageBoundary: [
      "只存项目结构化目标规则和解释边界。",
      "不复制外部四化断语。",
      "动态流必须保留 flowType 和 sourceRuleIds。"
    ],
    relatedDataModules: ["transformation.topic", "transformation.target", "dynamic-flow.dictionary"],
    verificationNotes: ["四化目标和动态流触发的项目内高可信来源。"]
  },
  {
    sourceId: "project.brightness-table",
    title: "项目星曜庙旺落陷表",
    sourceKind: "project-algorithm",
    authorOrCompiler: "ai-pet-world 项目",
    eraOrVersion: "当前代码版本",
    editionOrLocation: "src/ai/destiny-core/ziwei-core/star-catalog/star-brightness.ts",
    accessUrl: null,
    sourceReliability: "high",
    copyrightPolicy: "original-content",
    usedFor: ["星曜亮度", "庙旺落陷", "承接强弱", "破格与修复复核"],
    citationUsageRules: [
      "亮度读取必须来自统一亮度表。",
      "无亮度定义的星曜标记为不论或进入复核，不强行补庙旺。",
      "亮度不能脱离星曜、宫位和关系结构单独断事。"
    ],
    storageBoundary: [
      "只存项目结构化亮度状态。",
      "不复制外部亮度表原文或截图。",
      "后续变更必须有检查脚本覆盖。"
    ],
    relatedDataModules: ["brightness.table", "star.dictionary", "palace-theme.evidence-field"],
    verificationNotes: ["亮度状态的项目内高可信来源。"]
  },
  {
    sourceId: "project.dynamic-flow-rules",
    title: "项目动态盘规则",
    sourceKind: "project-algorithm",
    authorOrCompiler: "ai-pet-world 项目",
    eraOrVersion: "当前代码版本",
    editionOrLocation: "dynamic-chart / dynamic-flow modules",
    accessUrl: null,
    sourceReliability: "high",
    copyrightPolicy: "original-content",
    usedFor: ["大限", "流年", "流月", "流日", "流时", "动态命宫", "盘层继承"],
    citationUsageRules: [
      "动态盘数据必须保留 chartLayer 和 dynamicFlowType。",
      "下级流层只追加短周期触发，不能覆盖本命和上级流层。",
      "短周期结论默认降权为提示。"
    ],
    storageBoundary: [
      "只存项目结构化动态规则。",
      "不复制第三方软件动态盘排版或文案。",
      "页面只读取 ViewModel，不直接改算法。"
    ],
    relatedDataModules: ["dynamic-flow.dictionary", "palace-theme.field-paragraph-matrix"],
    verificationNotes: ["动态盘层级和页面流动时间的项目内高可信来源。"]
  },
  {
    sourceId: "project.content-dictionary",
    title: "项目原创内容数据字典",
    sourceKind: "project-dictionary",
    authorOrCompiler: "ai-pet-world 项目",
    eraOrVersion: "当前代码版本",
    editionOrLocation: "interpretation/content-details",
    accessUrl: null,
    sourceReliability: "high",
    copyrightPolicy: "original-content",
    usedFor: ["星曜解释", "宫位解释", "组合解释", "格局解释", "主题链解释资料"],
    citationUsageRules: [
      "所有解释内容必须标注是项目原创整理或来自来源摘要。",
      "数据字典不直接等于当前盘结论。",
      "页面展示只能读取盘中命中内容。"
    ],
    storageBoundary: [
      "只存原创结构化解释和来源索引。",
      "不复制现代书籍、课程、软件或截图成套表达。",
      "有争议资料进入 needs-human-review。"
    ],
    relatedDataModules: ["star.dictionary", "palace.dictionary", "pattern.dictionary", "palace-theme.dictionary"],
    verificationNotes: ["项目内容层自身来源，需要持续补 sourceReferences。"]
  },
  {
    sourceId: "internal.synthesis-reading-order",
    title: "项目读盘顺序归纳",
    sourceKind: "internal-synthesis",
    authorOrCompiler: "ai-pet-world 项目整理",
    eraOrVersion: "当前资料仓库规则",
    editionOrLocation: "CONTENT_KNOWLEDGE_REPOSITORY.md / content-knowledge-repository.ts",
    accessUrl: null,
    sourceReliability: "medium",
    copyrightPolicy: "original-content",
    usedFor: ["读盘顺序", "字段优先级边界", "降权边界", "复核路径"],
    citationUsageRules: [
      "归纳规则必须标记 internal-synthesis，不能伪装为古籍原文。",
      "用于解释器排序和复核，不直接生成绝对断语。",
      "优先级和降权规则必须能回到字段、证据域和 sourceRuleIds。"
    ],
    storageBoundary: [
      "只存项目归纳原则和复核边界。",
      "不得写成传统唯一断法。",
      "涉及高风险主题必须保守表达并进入人工复核。"
    ],
    relatedDataModules: ["palace-theme.field-paragraph-matrix", "palace-theme.evidence-domain", "risk.language"],
    verificationNotes: ["用于回答“谁优先、谁降权”的项目归纳来源。"]
  },
  {
    sourceId: "human.calibration-notes",
    title: "人工校盘与资料复核笔记",
    sourceKind: "manual-calibration",
    authorOrCompiler: "项目人工复核",
    eraOrVersion: "持续更新",
    editionOrLocation: "data/ziwei/sample-calibration / docs/ziwei",
    accessUrl: null,
    sourceReliability: "medium",
    copyrightPolicy: "metadata-only",
    usedFor: ["样例校盘", "差异标记", "资料来源复核", "争议规则确认"],
    citationUsageRules: [
      "只存用户自有输入、项目样例、复核结论和差异摘要。",
      "第三方案例只能存元信息和自有摘要。",
      "人工未确认的条目标记 needs-human-review。"
    ],
    storageBoundary: [
      "不存第三方案例原文、截图或软件排版。",
      "不把单一样例当成通用理论。",
      "人工结论必须保留日期和复核状态。"
    ],
    relatedDataModules: ["sample.golden", "calibration.queue", "human.review"],
    verificationNotes: ["用于后续人工对照和闭合争议项。"]
  },
  {
    sourceId: "external.modern-reference-metadata",
    title: "现代资料元信息索引",
    sourceKind: "modern-reference-metadata",
    authorOrCompiler: "外部现代书籍、课程、网站或软件资料",
    eraOrVersion: "待人工登记",
    editionOrLocation: "external-reference-index",
    accessUrl: null,
    sourceReliability: "low",
    copyrightPolicy: "metadata-only",
    usedFor: ["资料查证入口", "页码主题索引", "人工复核方向"],
    citationUsageRules: [
      "只存书名、作者、版本、页码、主题、链接和复核状态。",
      "不复制现代书籍、课程、网站或软件的成套表达。",
      "现代资料摘要必须用项目自有语言重写并标注 needs-source-check。"
    ],
    storageBoundary: [
      "不存受版权保护正文。",
      "不存第三方截图、图标、商标或排版。",
      "只能作为人工复核线索，不能直接作为项目规则唯一来源。"
    ],
    relatedDataModules: ["external-reference-index", "source.metadata", "copyright.boundary"],
    verificationNotes: ["用于后续人工补书籍来源，不直接生成解释。"]
  },
  {
    sourceId: "external.ziwei-my-reference-index",
    title: "ziwei.my 紫微斗数网站资料索引",
    sourceKind: "modern-reference-metadata",
    authorOrCompiler: "ziwei.my 网站公开页面",
    eraOrVersion: "现代网站资料，访问日期 2026-07-05",
    editionOrLocation: "https://www.ziwei.my/",
    accessUrl: "https://www.ziwei.my/",
    sourceReliability: "low",
    copyrightPolicy: "metadata-only",
    usedFor: [
      "星曜本体解释选题参考",
      "星曜入十二宫主题参考",
      "双星组合和格局目录参考",
      "吉曜煞曜杂曜解释颗粒度参考",
      "读盘层级和资料缺口对照"
    ],
    citationUsageRules: [
      "只登记页面标题、URL、主题标签、实体标签、访问日期和项目自有摘要。",
      "不复制网站原文、表格、排版、截图或成套表达。",
      "任何进入星曜字典的内容都必须改写为项目自有解释，并标记 needs-source-check 或 needs-human-review。",
      "该网站只作为现代资料线索，不作为古籍硬规则来源。"
    ],
    storageBoundary: [
      "允许存 URL、标题、栏目、主题标签、涉及星曜、涉及宫位、涉及格局和自有摘要。",
      "禁止存整篇正文、段落搬运、截图、页面样式和站点排版。",
      "不得把网站文字直接输出到当前盘分析；必须先经过清洗、去重、冲突复核和人工确认。"
    ],
    relatedDataModules: [
      "star.dictionary",
      "star.palace",
      "star.combination",
      "pattern.dictionary",
      "relationship.dictionary",
      "content-intake.review"
    ],
    verificationNotes: [
      "用于补足当前星曜解释过短、落宫解释不足、组合解释不够像读盘资料的问题。",
      "优先抽取目录级结构和主题覆盖范围，再由项目生成自有解释。"
    ]
  }
]

export const ZIWEI_THEORY_SOURCE_REFERENCE_DETAILS: ZiweiTheorySourceReferenceContentDetail[] =
  THEORY_SOURCE_SEEDS.map((seed) => {
    return {
      ...seed,
      sections: buildSections(seed)
    }
  })

export function getTheorySourceReferenceContentDetail(
  sourceId: string
): ZiweiTheorySourceReferenceContentDetail | null {
  return (
    ZIWEI_THEORY_SOURCE_REFERENCE_DETAILS.find((detail) => {
      return detail.sourceId === sourceId
    }) ?? null
  )
}

export function getAllTheorySourceReferenceContentDetails(): ZiweiTheorySourceReferenceContentDetail[] {
  return [...ZIWEI_THEORY_SOURCE_REFERENCE_DETAILS]
}

function buildSections(seed: TheorySourceSeed): ZiweiContentDictionarySection[] {
  return [
    {
      title: "来源身份",
      items: [
        `${seed.title}（${seed.sourceId}）`,
        `来源类型：${seed.sourceKind}`,
        `作者或整理者：${seed.authorOrCompiler}`,
        `版本或位置：${seed.eraOrVersion} / ${seed.editionOrLocation}`
      ]
    },
    {
      title: "用途范围",
      items: seed.usedFor
    },
    {
      title: "引用规则",
      items: seed.citationUsageRules
    },
    {
      title: "存储边界",
      items: seed.storageBoundary
    },
    {
      title: "关联模块",
      items: seed.relatedDataModules
    },
    {
      title: "复核备注",
      items: seed.verificationNotes
    }
  ]
}
