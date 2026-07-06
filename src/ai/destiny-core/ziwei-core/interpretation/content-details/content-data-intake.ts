import type {
  DestinyCleanedIntakeResultRecord,
  DestinyCleaningPipelineProfile,
  DestinyCleaningPipelineScenarioRecord,
  DestinyCollectionBatchPlan,
  DestinyCollectionFieldProfile,
  DestinyCollectionAdapterKind,
  DestinyCollectionAdapterProfile,
  DestinyCollectionAdmissionDecisionCandidate,
  DestinyCollectionAutomationMode,
  DestinyCollectionBatchStatus,
  DestinyCollectionCleaningInputDraft,
  DestinyCollectionCleanedResultCandidate,
  DestinyCollectionExecutionTaskRecord,
  DestinyCollectionExecutionTaskStatus,
  DestinyCollectionExecutorProfile,
  DestinyCollectionFragmentCaptureInput,
  DestinyCollectionFragmentResultCandidate,
  DestinyCollectionJobDraft,
  DestinyCollectionAuditRecord,
  DestinyCollectionJobBlockRecord,
  DestinyCollectionJobRunResultDraft,
  DestinyCollectionLandingCandidateStatus,
  DestinyCollectionPromotionDecision,
  DestinyCollectionPromotionDecisionRecord,
  DestinyCollectionPromotionGateProfile,
  DestinyCollectionPromotionTargetKind,
  DestinyCollectionRequestMode,
  DestinyCollectionReviewQueueItemDraft,
  DestinyCollectionReviewRouteCandidate,
  DestinyCollectionRunBatchRecord,
  DestinyCollectionSourceResultCandidate,
  DestinyCollectionSourceRegistrationDraft,
  DestinyCollectionTopicMappingCandidate,
  DestinyConflictSignalProfile,
  DestinyDataDedupProfile,
  DestinyDictionaryAdmissionDecisionRecord,
  DestinyDictionaryAdmissionPolicyProfile,
  DestinyDictionaryAdmissionStatus,
  DestinyEntityExtractionProfile,
  DestinyReviewQueueProfile,
  DestinyReviewStatus,
  DestinySourceKind,
  DestinySourceSeedRecord,
  DestinySourceStorageBoundaryProfile,
  DestinyStoragePolicy,
  DestinyTopicMappingProfile
} from "../../../content-intake/content-intake-contract"

export type ZiweiDataIntakeStage =
  | "P35-A"
  | "P35-B"
  | "P35-C"
  | "P35-D"
  | "P35-E"
  | "P35-F"

export type ZiweiDataSourceKind = Extract<
  DestinySourceKind,
  | "classic-public-domain"
  | "classic-index"
  | "university-library-catalog"
  | "modern-book-metadata"
  | "website-metadata"
  | "video-metadata"
  | "software-reference-metadata"
  | "forum-thread-metadata"
  | "manual-sample"
  | "project-original"
>

export type ZiweiDataStoragePolicy = DestinyStoragePolicy

export type ZiweiDataReviewStatus = DestinyReviewStatus

export type ZiweiDataCollectionAutomationMode = DestinyCollectionAutomationMode

export type ZiweiDataCollectionBatchStatus = DestinyCollectionBatchStatus

export type ZiweiDataIntakePlanStatus =
  | "completed"
  | "active"
  | "queued"

export type ZiweiDataTopicTag =
  | "star"
  | "palace"
  | "branch"
  | "stem"
  | "element-gate"
  | "pattern"
  | "transformation"
  | "brightness"
  | "dynamic-flow"
  | "relationship"
  | "sample"
  | "storage-boundary"

export type ZiweiDataPageVisibility =
  | "dictionary-only"
  | "chart-hit-only"
  | "review-panel"
  | "hidden"

export interface ZiweiDataIntakeStagePlan {
  stage: ZiweiDataIntakeStage
  title: string
  status: ZiweiDataIntakePlanStatus
  goal: string
  deliverables: string[]
  acceptanceChecks: string[]
}

export interface ZiweiExternalDataSourceRecord {
  sourceId: string
  sourceKind: ZiweiDataSourceKind
  title: string
  locator: string
  authorOrPublisher: string
  versionOrDate: string
  storagePolicy: ZiweiDataStoragePolicy
  allowedStorage: string[]
  blockedStorage: string[]
  topicTags: ZiweiDataTopicTag[]
  reliabilityHint: "high" | "medium" | "low" | "unknown"
  reviewStatus: ZiweiDataReviewStatus
}

export interface ZiweiRawIntakeFragmentRecord {
  fragmentId: string
  sourceId: string
  topicTags: ZiweiDataTopicTag[]
  sourceLocator: string
  originalTextStoragePolicy: "none" | "short-quote-only" | "user-owned"
  normalizedSummary: string
  extractedEntities: string[]
  dedupKey: string
  reviewStatus: ZiweiDataReviewStatus
  rejectionReason: string | null
}

export interface ZiweiDataTopicMappingRecord {
  mappingId: string
  topicTag: ZiweiDataTopicTag
  targetDictionaryLayer: string
  acceptedSourceKinds: ZiweiDataSourceKind[]
  requiredFields: string[]
  usageBoundary: string[]
}

export interface ZiweiDataUsabilityScoreRule {
  ruleId: string
  label: string
  scoreDelta: number
  appliesWhen: string[]
}

export interface ZiweiDataAnalysisUsageProfile {
  usageId: string
  label: string
  inputAdmissionStatuses: DestinyDictionaryAdmissionStatus[]
  targetDictionaryLayers: string[]
  analysisFields: string[]
  pageVisibility: ZiweiDataPageVisibility
  chartHitRequirement: string[]
  requiredSourceTrace: string[]
  forbiddenUse: string[]
  outputRefs: string[]
}

export interface ZiweiDataIntakeClosureReport {
  stage: ZiweiDataIntakeStage
  status: "completed"
  closedScope: string[]
  acceptanceEvidence: string[]
  remainingBoundary: string[]
  nextStage: ZiweiDataIntakeStage
  validationCommands: string[]
}

export type ZiweiDataSourceStorageBoundaryProfile = DestinySourceStorageBoundaryProfile
export type ZiweiDataDedupProfile = DestinyDataDedupProfile
export type ZiweiDataEntityExtractionProfile = DestinyEntityExtractionProfile
export type ZiweiDataConflictSignalProfile = DestinyConflictSignalProfile
export type ZiweiDataReviewQueueProfile = DestinyReviewQueueProfile
export type ZiweiDataCleanedIntakeResultRecord = DestinyCleanedIntakeResultRecord
export type ZiweiDataCleaningPipelineProfile = DestinyCleaningPipelineProfile
export type ZiweiDataCleaningPipelineScenarioRecord = DestinyCleaningPipelineScenarioRecord
export type ZiweiDataDictionaryTopicMappingProfile = DestinyTopicMappingProfile & {
  domain: "ziwei"
  topicTag: ZiweiDataTopicTag
  sourceKinds: ZiweiDataSourceKind[]
}
export type ZiweiDataDictionaryAdmissionPolicyProfile = DestinyDictionaryAdmissionPolicyProfile & {
  domain: "ziwei"
}
export type ZiweiDataDictionaryAdmissionDecisionRecord = DestinyDictionaryAdmissionDecisionRecord & {
  domain: "ziwei"
}
export type ZiweiDataCollectionFieldProfile = DestinyCollectionFieldProfile
export type ZiweiDataSourceSeedRecord = DestinySourceSeedRecord & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionBatchPlan = DestinyCollectionBatchPlan & {
  domain: "ziwei"
  sourceKinds: ZiweiDataSourceKind[]
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionAdapterProfile = DestinyCollectionAdapterProfile & {
  domain: "ziwei"
  sourceKinds: ZiweiDataSourceKind[]
}
export type ZiweiDataCollectionExecutorProfile = DestinyCollectionExecutorProfile & {
  domain: "ziwei"
}
export type ZiweiDataCollectionExecutionTaskRecord = DestinyCollectionExecutionTaskRecord & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
}
export type ZiweiDataCollectionSourceRegistrationDraft = DestinyCollectionSourceRegistrationDraft & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
}
export type ZiweiDataCollectionFragmentCaptureInput = DestinyCollectionFragmentCaptureInput & {
  domain: "ziwei"
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionCleaningInputDraft = DestinyCollectionCleaningInputDraft & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionReviewQueueItemDraft = DestinyCollectionReviewQueueItemDraft & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
}
export type ZiweiDataCollectionJobDraft = DestinyCollectionJobDraft & {
  domain: "ziwei"
  adapterKind: DestinyCollectionAdapterKind
  sourceKind: ZiweiDataSourceKind
  requestMode: DestinyCollectionRequestMode
}
export type ZiweiDataCollectionRunBatchRecord = DestinyCollectionRunBatchRecord & {
  domain: "ziwei"
}
export type ZiweiDataCollectionJobRunResultDraft = DestinyCollectionJobRunResultDraft & {
  domain: "ziwei"
}
export type ZiweiDataCollectionJobBlockRecord = DestinyCollectionJobBlockRecord & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
}
export type ZiweiDataCollectionAuditRecord = DestinyCollectionAuditRecord & {
  domain: "ziwei"
}
export type ZiweiDataCollectionSourceResultCandidate = DestinyCollectionSourceResultCandidate & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
}
export type ZiweiDataCollectionFragmentResultCandidate = DestinyCollectionFragmentResultCandidate & {
  domain: "ziwei"
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionCleanedResultCandidate = DestinyCollectionCleanedResultCandidate & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionTopicMappingCandidate = DestinyCollectionTopicMappingCandidate & {
  domain: "ziwei"
  topicTags: ZiweiDataTopicTag[]
}
export type ZiweiDataCollectionAdmissionDecisionCandidate = DestinyCollectionAdmissionDecisionCandidate & {
  domain: "ziwei"
}
export type ZiweiDataCollectionReviewRouteCandidate = DestinyCollectionReviewRouteCandidate & {
  domain: "ziwei"
}
export type ZiweiDataCollectionPromotionGateProfile = DestinyCollectionPromotionGateProfile & {
  domain: "ziwei"
}
export type ZiweiDataCollectionPromotionDecisionRecord = DestinyCollectionPromotionDecisionRecord & {
  domain: "ziwei"
  sourceKind: ZiweiDataSourceKind
}

export const ZIWEI_DATA_INTAKE_STAGE_PLANS: ZiweiDataIntakeStagePlan[] = [
  {
    stage: "P35-A",
    title: "全网资料采集入口设计",
    status: "completed",
    goal: "建立可持续采集紫微斗数资料的入口、字段和批次结构。",
    deliverables: ["来源登记表", "原始片段表", "主题标签表", "采集批次规则"],
    acceptanceChecks: [
      "所有资料必须先登记来源。",
      "来源不明的现代资料只能 metadata-only。",
      "采集片段不能直接进入当前盘解释。"
    ]
  },
  {
    stage: "P35-B",
    title: "来源元信息与可存储边界分级",
    status: "completed",
    goal: "将古籍、现代书籍、网站、视频、软件、论坛和人工样例分开存储。",
    deliverables: ["存储策略", "来源可信度", "可存储字段", "禁止存储字段"],
    acceptanceChecks: [
      "现代书籍内容暂不采集，现代资料只登记元信息。",
      "第三方软件不存截图、图标、商标和排版。",
      "公版古籍可以存原文、术语、篇目、主题索引和自有摘要；现代整理版只存元信息。"
    ]
  },
  {
    stage: "P35-C",
    title: "资料清洗、去重、归类",
    status: "completed",
    goal: "把采集资料按主题、实体、重复度和可用性整理。",
    deliverables: ["去重键", "实体抽取", "冲突标记", "复核队列"],
    acceptanceChecks: [
      "同一资料多处转载必须合并。",
      "冲突资料不得直接升为硬规则。",
      "无法确认来源的资料保留 rejected 或 needs-source-review。"
    ]
  },
  {
    stage: "P35-D",
    title: "星曜宫位格局四化主题映射",
    status: "completed",
    goal: "将资料映射到星曜、宫位、格局、四化、动态盘和关系结构。",
    deliverables: ["主题映射表", "目标字典层", "必填字段", "使用边界"],
    acceptanceChecks: [
      "映射不能重复定义算法表。",
      "映射必须能回到 sourceId 和 fragmentId。",
      "主题标签必须可筛选。"
    ]
  },
  {
    stage: "P35-E",
    title: "可用资料筛选与入库",
    status: "completed",
    goal: "根据可信度、可存储边界、安全边界和主题覆盖筛选可进入数据字典的资料。",
    deliverables: ["可用性评分", "入库状态", "拒绝原因", "人工复核结果"],
    acceptanceChecks: [
      "低可信资料只能做参考线索。",
      "来源不明资料不能进入解释正文。",
      "入库资料必须是项目原创摘要或可安全保存结构。"
    ]
  },
  {
    stage: "P35-F",
    title: "分析模型与页面使用接入",
    status: "completed",
    goal: "把筛选后的资料接入数据字典、分析层和页面使用。",
    deliverables: ["字典增量", "分析字段", "页面可见性", "检查脚本"],
    acceptanceChecks: [
      "页面只展示盘中命中内容。",
      "数据字典和当前盘解释保持分离。",
      "新增内容必须通过闭合检查。"
    ]
  }
]

export const ZIWEI_DATA_INTAKE_CLOSURE_REPORTS: ZiweiDataIntakeClosureReport[] = [
  {
    stage: "P35-C",
    status: "completed",
    closedScope: [
      "建立通用命理资料清洗协议，保留八字后续复用边界。",
      "紫微斗数完成 10 类来源、10 个来源边界模板、4 个去重规则、4 个实体抽取规则。",
      "完成 4 个冲突信号、5 个复核队列、4 个清洗结果样例、1 条清洗 pipeline 和 10 类来源输入输出样例。"
    ],
    acceptanceEvidence: [
      "10 类来源覆盖公版古籍、古籍索引、世界大学图书馆馆藏目录、现代书籍、网站、视频、软件、论坛、人工样例和项目原创。",
      "清洗 pipeline 固定为来源登记、可存储边界、实体抽取、去重、冲突检测、复核路由、清洗结果。",
      "blocked、metadata-only、needs-review、ready-for-dictionary 均有对应场景和检查。"
    ],
    remainingBoundary: [
      "P35-C 只定义清洗和归类执行结构，不执行全网采集。",
      "现代书籍正文、网站全文、视频字幕全文、软件截图和受限馆藏影像仍禁止入库。",
      "八字不在紫微目录接入，后续只复用通用命理资料协议。"
    ],
    nextStage: "P35-D",
    validationCommands: [
      "node scripts/ziwei/check-p35-data-intake.mjs",
      "node scripts/ziwei/run-current-ziwei-closure-checks.mjs",
      "npm run check:encoding",
      "npx tsc --noEmit"
    ]
  },
  {
    stage: "P35-D",
    status: "completed",
    closedScope: [
      "完成 12 类紫微主题映射矩阵，覆盖星曜、宫位、十二地支、天干、五行局、格局、四化、庙旺、动态流限、关系、样例和来源边界。",
      "每个主题定义目标字典层、实体字段、可接受来源、必填清洗字段、溯源字段、接收规则、拒绝规则和后续用途。",
      "主题映射保留 sourceId、fragmentId、dedupKey、entityRefs、promotionStatus，确保资料能回查、能筛选、能复核。"
    ],
    acceptanceEvidence: [
      "检查脚本要求 12 个 ZiweiDataTopicTag 全部有 dictionary topic mapping profile。",
      "brightness 映射明确四化不写庙旺，dynamic-flow 映射明确大限、流年、流月、流日、流时分层。",
      "目录结构、数据字典、来源边界和执行表已同步 P35-D 主题矩阵。"
    ],
    remainingBoundary: [
      "P35-D 不执行真实全网采集，只定义清洗结果进入哪个主题字典层。",
      "P35-D 不改星曜目录、四化表、庙旺落陷表、动态盘硬规则。",
      "下一步 P35-E 才开始做可用资料评分、入库状态、拒绝原因和人工复核结果。"
    ],
    nextStage: "P35-E",
    validationCommands: [
      "node scripts/ziwei/check-p35-data-intake.mjs",
      "node scripts/ziwei/run-current-ziwei-closure-checks.mjs",
      "npm run check:encoding",
      "npx tsc --noEmit",
      "npx eslint src/ai/destiny-core/content-intake/content-intake-contract.ts src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts src/ai/destiny-core/ziwei-core/interpretation/content-details/index.ts src/ai/destiny-core/ziwei-core/interpretation/index.ts scripts/ziwei/check-p35-data-intake.mjs"
    ]
  },
  {
    stage: "P35-E",
    status: "completed",
    closedScope: [
      "建立 5 条资料入库政策，覆盖公版古籍直入、目录索引元信息、现代资料主题复核、动态盘复核和禁止入库。",
      "建立 4 条清洗结果入库决策，覆盖 admitted、review-required 和 rejected 三类实际输出。",
      "入库决策明确分数、目标字典层、复核队列、接收证据字段、拒绝原因、下一步动作和审计轨迹。"
    ],
    acceptanceEvidence: [
      "检查脚本校验政策 ID、分数范围、适用 promotionStatus、适用 storagePolicy 和输出字段。",
      "检查脚本校验每条决策引用真实 cleanedResultId，且目标字典层必须被政策允许。",
      "blocked 资料必须保留 rejectionReason，review-required 资料必须保留 requiredReviewQueueId。"
    ],
    remainingBoundary: [
      "P35-E 只定义筛选和入库门禁，不执行真实全网采集。",
      "P35-E 不把资料写进页面解释，不改当前盘命中逻辑。",
      "下一步 P35-F 才把通过筛选的字典增量接入分析模型和页面可见性。"
    ],
    nextStage: "P35-F",
    validationCommands: [
      "node scripts/ziwei/check-p35-data-intake.mjs",
      "node scripts/ziwei/run-current-ziwei-closure-checks.mjs",
      "npm run check:encoding",
      "npx tsc --noEmit",
      "npx eslint src/ai/destiny-core/content-intake/content-intake-contract.ts src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts src/ai/destiny-core/ziwei-core/interpretation/content-details/index.ts src/ai/destiny-core/ziwei-core/interpretation/index.ts scripts/ziwei/check-p35-data-intake.mjs"
    ]
  },
  {
    stage: "P35-F",
    status: "completed",
    closedScope: [
      "建立 5 条分析使用 profile，覆盖星曜字典详情、当前盘命中星曜、格局命中、动态流限复核和拒绝资料审计。",
      "完成页面可见性分层，区分 dictionary-only、chart-hit-only、review-panel 和 hidden。",
      "完成星曜字典布局修正，从全量卡片展开改为左侧星曜索引和右侧单星详情。"
    ],
    acceptanceEvidence: [
      "检查脚本校验 analysis usage profile 的入库状态、目标字典层、页面可见性、证据追踪和禁用场景。",
      "chart-hit-only 使用层只能消费 admitted 资料，避免未复核资料进入当前盘结论。",
      "TypeScript、限定范围 ESLint、编码检查和 P35 专项检查均通过。"
    ],
    remainingBoundary: [
      "P35-F 不执行真实全网采集，只定义资料通过门禁后的分析与页面使用边界。",
      "数据字典仍是资料库，不等于当前盘结论；当前盘只展示盘中命中的资料。",
      "后续进入真实资料采集批次时，必须沿用 P35-A 到 P35-F 的来源、清洗、映射、入库和页面可见性规则。"
    ],
    nextStage: "P35-F",
    validationCommands: [
      "node scripts/ziwei/check-p35-data-intake.mjs",
      "node scripts/ziwei/run-current-ziwei-closure-checks.mjs",
      "npm run check:encoding",
      "npx tsc --noEmit",
      "npx eslint src/app/ziwei/_components/star-dictionary-modal.tsx src/ai/destiny-core/content-intake/content-intake-contract.ts src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts src/ai/destiny-core/ziwei-core/interpretation/content-details/index.ts src/ai/destiny-core/ziwei-core/interpretation/index.ts scripts/ziwei/check-p35-data-intake.mjs scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  }
]

export const ZIWEI_EXTERNAL_DATA_SOURCE_REGISTRY: ZiweiExternalDataSourceRecord[] = [
  {
    sourceId: "p35.source.public-domain-classic-index",
    sourceKind: "classic-public-domain",
    title: "公开古籍与古籍索引入口",
    locator: "manual-search://classic-public-domain",
    authorOrPublisher: "public-domain or public index",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "public-domain-text-and-summary",
    allowedStorage: ["书名", "版本", "篇目", "主题索引", "公版古籍原文", "项目自有摘要"],
    blockedStorage: ["现代整理版正文", "现代点校版排版", "书影图片", "第三方整理排版"],
    topicTags: ["star", "palace", "pattern", "transformation"],
    reliabilityHint: "medium",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.classic-index-metadata",
    sourceKind: "classic-index",
    title: "古籍目录与版本索引",
    locator: "manual-search://classic-index",
    authorOrPublisher: "public index or library catalog",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["书名", "卷次", "篇目", "版本", "馆藏或索引链接", "主题标签"],
    blockedStorage: ["现代点校正文", "书影图片", "商业数据库正文", "第三方整理排版"],
    topicTags: ["storage-boundary", "star", "palace", "pattern"],
    reliabilityHint: "medium",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.university-library-catalog",
    sourceKind: "university-library-catalog",
    title: "世界大学图书馆馆藏目录元信息",
    locator: "manual-search://university-library-catalogs",
    authorOrPublisher: "university library catalog or digital collection",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["大学或图书馆名", "馆藏系统链接", "书名", "责任者", "版本", "馆藏号", "数字化状态", "公版判断线索", "主题标签"],
    blockedStorage: ["受限馆藏影像", "登录后数据库全文", "现代点校正文", "批量书影图片", "馆藏系统排版"],
    topicTags: ["storage-boundary", "star", "palace", "pattern", "transformation"],
    reliabilityHint: "high",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.modern-book-metadata",
    sourceKind: "modern-book-metadata",
    title: "现代书籍资料元信息",
    locator: "manual-search://modern-books",
    authorOrPublisher: "to be filled during collection",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["书名", "作者", "出版社", "版本", "页码", "主题", "复核状态"],
    blockedStorage: ["正文", "表格原文", "排版", "扫描图"],
    topicTags: ["star", "palace", "pattern", "brightness", "dynamic-flow"],
    reliabilityHint: "unknown",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.website-metadata",
    sourceKind: "website-metadata",
    title: "网站文章资料元信息",
    locator: "manual-search://web-articles",
    authorOrPublisher: "to be filled during collection",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["标题", "作者", "URL", "发布日期", "主题", "自有摘要", "复核状态"],
    blockedStorage: ["整篇正文", "截图", "站点样式", "广告文案"],
    topicTags: ["star", "palace", "pattern", "transformation", "relationship"],
    reliabilityHint: "unknown",
    reviewStatus: "queued"
  },
  {
    sourceId: "p36.source.ziwei-my-website-index",
    sourceKind: "website-metadata",
    title: "ziwei.my 紫微斗数网站资料索引",
    locator: "https://www.ziwei.my/",
    authorOrPublisher: "ziwei.my",
    versionOrDate: "visited 2026-07-05",
    storagePolicy: "metadata-only",
    allowedStorage: [
      "页面标题",
      "URL",
      "栏目",
      "主题标签",
      "涉及星曜",
      "涉及宫位",
      "涉及格局",
      "访问日期",
      "项目自有摘要",
      "复核状态"
    ],
    blockedStorage: [
      "整篇正文",
      "段落搬运",
      "截图",
      "站点排版",
      "广告文案",
      "未经改写的组合解释",
      "未经复核的当前盘断语"
    ],
    topicTags: ["star", "palace", "pattern", "transformation", "relationship", "sample"],
    reliabilityHint: "low",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.video-metadata",
    sourceKind: "video-metadata",
    title: "视频课程或讲解资料元信息",
    locator: "manual-search://videos",
    authorOrPublisher: "to be filled during collection",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["标题", "作者", "平台", "链接", "时间点", "主题", "自有摘要"],
    blockedStorage: ["字幕全文", "课程讲义", "画面截图", "会员内容"],
    topicTags: ["star", "pattern", "dynamic-flow", "sample"],
    reliabilityHint: "unknown",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.software-reference-metadata",
    sourceKind: "software-reference-metadata",
    title: "排盘软件参考元信息",
    locator: "manual-search://software-references",
    authorOrPublisher: "to be filled during collection",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["软件名", "版本", "功能点", "差异摘要", "人工复核状态"],
    blockedStorage: ["截图", "图标", "商标", "版式", "成套文案"],
    topicTags: ["dynamic-flow", "brightness", "pattern", "sample"],
    reliabilityHint: "unknown",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.forum-thread-metadata",
    sourceKind: "forum-thread-metadata",
    title: "论坛或社群讨论资料元信息",
    locator: "manual-search://forum-threads",
    authorOrPublisher: "to be filled during collection",
    versionOrDate: "metadata to be filled during collection",
    storagePolicy: "metadata-only",
    allowedStorage: ["标题", "作者昵称", "平台", "链接", "发布时间", "主题", "自有摘要", "复核状态"],
    blockedStorage: ["整帖正文", "楼层截图", "用户头像", "个人隐私", "未脱敏命例"],
    topicTags: ["sample", "relationship", "pattern", "dynamic-flow"],
    reliabilityHint: "low",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.manual-sample",
    sourceKind: "manual-sample",
    title: "人工校盘样例",
    locator: "manual-input://ziwei-samples",
    authorOrPublisher: "project user input",
    versionOrDate: "created during manual calibration",
    storagePolicy: "user-owned-input",
    allowedStorage: ["用户自有输入", "排盘参数", "差异摘要", "复核状态"],
    blockedStorage: ["第三方完整案例", "个人隐私未脱敏内容"],
    topicTags: ["sample", "dynamic-flow", "pattern", "relationship"],
    reliabilityHint: "medium",
    reviewStatus: "queued"
  },
  {
    sourceId: "p35.source.project-original",
    sourceKind: "project-original",
    title: "项目原创整理资料",
    locator: "project://ziwei/content-dictionary",
    authorOrPublisher: "ai-pet-world",
    versionOrDate: "created during dictionary expansion",
    storagePolicy: "original-summary-only",
    allowedStorage: ["项目原创摘要", "结构化字段", "主题标签", "分析边界", "复核记录"],
    blockedStorage: ["未标来源的外部正文", "未标来源的外部截图", "无法回查的转载内容"],
    topicTags: ["star", "palace", "branch", "stem", "pattern", "transformation", "dynamic-flow"],
    reliabilityHint: "high",
    reviewStatus: "queued"
  }
]

export const ZIWEI_DATA_SOURCE_STORAGE_BOUNDARY_PROFILES: ZiweiDataSourceStorageBoundaryProfile[] = [
  {
    profileId: "p35.boundary.classic-public-domain",
    domainScope: ["ziwei"],
    sourceKind: "classic-public-domain",
    label: "公版古籍正文",
    storagePolicy: "public-domain-text-and-summary",
    canStoreOriginalText: true,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["书名", "版本", "篇目", "来源链接或馆藏信息", "采集日期"],
    allowedFields: ["公版古籍原文", "术语", "篇目", "版本", "主题索引", "项目自有摘要"],
    blockedFields: ["现代整理版正文", "现代点校版排版", "书影图片", "第三方整理排版"],
    promotionPath: ["登记来源", "确认公版或原始古籍属性", "标注篇目与主题", "进入古籍术语索引"],
    rejectionSignals: ["只能找到现代整理版", "来源不能确认版本", "内容来自商业数据库复制"]
  },
  {
    profileId: "p35.boundary.classic-index",
    domainScope: ["ziwei"],
    sourceKind: "classic-index",
    label: "古籍目录索引",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["书名", "卷次或篇目", "索引来源", "版本提示", "主题标签"],
    allowedFields: ["目录", "版本说明", "馆藏或索引链接", "主题标签", "复核状态"],
    blockedFields: ["点校正文", "书影图片", "数据库全文", "第三方整理版排版"],
    promotionPath: ["登记目录", "匹配公版正文来源", "补充主题标签", "等待正文来源复核"],
    rejectionSignals: ["目录无法回查", "目录和实际正文不一致", "索引来源不明"]
  },
  {
    profileId: "p35.boundary.university-library-catalog",
    domainScope: ["ziwei"],
    sourceKind: "university-library-catalog",
    label: "世界大学图书馆馆藏目录",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["大学或图书馆名", "馆藏链接", "书名", "版本或馆藏说明", "访问日期"],
    allowedFields: ["馆藏元信息", "馆藏号", "版本提示", "数字化状态", "公版判断线索", "主题标签", "项目自有摘要"],
    blockedFields: ["受限馆藏影像", "登录后数据库全文", "现代点校正文", "批量书影图片", "馆藏系统排版"],
    promotionPath: ["登记馆藏目录", "确认是否公版或原始古籍", "匹配篇目和主题", "可确认公版正文后转入 classic-public-domain"],
    rejectionSignals: ["馆藏链接不可回查", "只提供现代整理版", "需要登录或授权才能查看正文"]
  },
  {
    profileId: "p35.boundary.modern-book",
    domainScope: ["ziwei"],
    sourceKind: "modern-book-metadata",
    label: "现代书籍元信息",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: false,
    requiredMetadataFields: ["书名", "作者", "出版社", "版本", "页码或章节", "主题"],
    allowedFields: ["书名", "作者", "出版社", "版本", "页码", "主题", "复核状态"],
    blockedFields: ["正文", "表格原文", "扫描图", "排版", "整段解释"],
    promotionPath: ["登记元信息", "标记主题", "人工复核观点是否能由公版或项目资料支撑", "仅作为线索"],
    rejectionSignals: ["要求摘录正文", "无法确认书目信息", "主题无法映射"]
  },
  {
    profileId: "p35.boundary.website",
    domainScope: ["ziwei"],
    sourceKind: "website-metadata",
    label: "网站文章元信息",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["标题", "作者或站点", "URL", "发布日期或访问日期", "主题"],
    allowedFields: ["标题", "作者", "URL", "日期", "主题", "自有摘要", "复核状态"],
    blockedFields: ["整篇正文", "站点截图", "站点样式", "广告文案", "付费内容"],
    promotionPath: ["登记元信息", "提取实体标签", "写项目自有摘要", "进入复核队列"],
    rejectionSignals: ["无作者无日期且无法回查", "大量转载无法确认源头", "内容含付费或会员限制"]
  },
  {
    profileId: "p35.boundary.video",
    domainScope: ["ziwei"],
    sourceKind: "video-metadata",
    label: "视频课程或讲解元信息",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["标题", "作者或频道", "平台", "链接", "时间点", "主题"],
    allowedFields: ["标题", "作者", "平台", "链接", "时间点", "主题", "自有摘要"],
    blockedFields: ["字幕全文", "课程讲义", "画面截图", "会员内容", "逐字稿"],
    promotionPath: ["登记元信息", "标记时间点", "提炼自有摘要", "等待主题复核"],
    rejectionSignals: ["需要复制字幕", "会员课程不可回查", "时间点缺失"]
  },
  {
    profileId: "p35.boundary.software",
    domainScope: ["ziwei"],
    sourceKind: "software-reference-metadata",
    label: "排盘软件参考元信息",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["软件名", "版本", "功能点", "观察日期", "差异主题"],
    allowedFields: ["软件名", "版本", "功能点", "差异摘要", "人工复核状态"],
    blockedFields: ["截图", "图标", "商标", "版式", "成套文案", "专有交互复刻"],
    promotionPath: ["登记软件版本", "记录功能差异", "转写为项目自有验收点", "不作为硬规则来源"],
    rejectionSignals: ["依赖截图证明", "要求复刻外部排版", "无法确认版本"]
  },
  {
    profileId: "p35.boundary.forum-thread",
    domainScope: ["ziwei"],
    sourceKind: "forum-thread-metadata",
    label: "论坛社群讨论元信息",
    storagePolicy: "metadata-only",
    canStoreOriginalText: false,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["标题", "作者昵称或匿名标记", "平台", "链接", "发布时间", "主题"],
    allowedFields: ["标题", "平台", "链接", "发布时间", "主题", "自有摘要", "复核状态"],
    blockedFields: ["整帖正文", "楼层截图", "头像", "个人隐私", "未脱敏命例"],
    promotionPath: ["登记元信息", "脱敏主题", "仅作为样例线索", "需要二次来源支撑"],
    rejectionSignals: ["含真实个人隐私", "不可脱敏", "单一样例被当成通用理论"]
  },
  {
    profileId: "p35.boundary.manual-sample",
    domainScope: ["ziwei"],
    sourceKind: "manual-sample",
    label: "人工校盘样例",
    storagePolicy: "user-owned-input",
    canStoreOriginalText: true,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["输入来源", "排盘参数", "校验目标", "脱敏状态", "复核人"],
    allowedFields: ["用户自有输入", "排盘参数", "差异摘要", "复核状态", "脱敏标记"],
    blockedFields: ["第三方完整案例", "个人隐私未脱敏内容", "不可授权资料"],
    promotionPath: ["登记样例", "脱敏", "校验算法或展示", "不得直接升为理论"],
    rejectionSignals: ["非用户自有", "无法脱敏", "试图作为通用断语"]
  },
  {
    profileId: "p35.boundary.project-original",
    domainScope: ["ziwei"],
    sourceKind: "project-original",
    label: "项目原创整理资料",
    storagePolicy: "original-summary-only",
    canStoreOriginalText: true,
    canStoreProjectSummary: true,
    requiredMetadataFields: ["生成模块", "来源引用", "主题标签", "复核状态", "更新时间"],
    allowedFields: ["项目原创摘要", "结构化字段", "主题标签", "分析边界", "复核记录"],
    blockedFields: ["未标来源外部正文", "未标来源外部截图", "无法回查转载内容"],
    promotionPath: ["绑定来源", "写入结构化字段", "复核冲突", "进入数据字典"],
    rejectionSignals: ["缺少来源引用", "与硬规则冲突", "无法解释生成依据"]
  }
]

export const ZIWEI_DATA_DEDUP_PROFILES: ZiweiDataDedupProfile[] = [
  {
    profileId: "p35.dedup.source-entity-topic",
    domainScope: ["ziwei"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata"],
    entityKinds: ["starId", "palaceId", "branchId", "stemId", "patternId", "transformationId"],
    dedupKeyTemplate: "ziwei:{sourceKind}:{sourceId}:{entityKind}:{entityId}:{topicTag}",
    normalizedFields: ["sourceId", "entityKind", "entityId", "topicTag", "normalizedSummary"],
    collisionStrategy: "queue-review",
    conflictSignals: ["same-entity-different-summary", "same-source-duplicate-topic", "hard-rule-mismatch"]
  },
  {
    profileId: "p35.dedup.public-domain-classic-passage",
    domainScope: ["ziwei"],
    sourceKinds: ["classic-public-domain"],
    entityKinds: ["classicTitle", "chapterTitle", "term"],
    dedupKeyTemplate: "ziwei:classic:{classicTitle}:{version}:{chapterTitle}:{term}",
    normalizedFields: ["classicTitle", "version", "chapterTitle", "term", "originalTextHash"],
    collisionStrategy: "merge-metadata",
    conflictSignals: ["version-mismatch", "chapter-title-mismatch", "text-hash-different"]
  },
  {
    profileId: "p35.dedup.dynamic-flow-topic",
    domainScope: ["ziwei"],
    sourceKinds: ["software-reference-metadata", "website-metadata", "manual-sample", "project-original"],
    entityKinds: ["daYun", "liuNian", "liuYue", "liuRi", "liuShi"],
    dedupKeyTemplate: "ziwei:dynamic:{flowType}:{entityId}:{sourceKind}:{topicTag}",
    normalizedFields: ["flowType", "entityId", "sourceKind", "topicTag", "normalizedSummary"],
    collisionStrategy: "queue-review",
    conflictSignals: ["flow-layer-mismatch", "dynamic-inheritance-mismatch", "same-flow-different-palace"]
  },
  {
    profileId: "p35.dedup.manual-sample-parameter",
    domainScope: ["ziwei"],
    sourceKinds: ["manual-sample"],
    entityKinds: ["sampleId", "birthInput", "flowSelection"],
    dedupKeyTemplate: "ziwei:sample:{birthDate}:{birthTime}:{gender}:{calendarType}:{flowSelection}",
    normalizedFields: ["birthDate", "birthTime", "gender", "calendarType", "flowSelection"],
    collisionStrategy: "merge-metadata",
    conflictSignals: ["same-input-different-chart", "same-sample-different-result", "privacy-risk"]
  }
]

export const ZIWEI_DATA_ENTITY_EXTRACTION_PROFILES: ZiweiDataEntityExtractionProfile[] = [
  {
    profileId: "p35.extract.ziwei-star",
    domain: "ziwei",
    entityKind: "starId",
    label: "紫微星曜实体抽取",
    sourceFields: ["title", "normalizedSummary", "topicTags", "extractedEntities"],
    requiredEntities: ["starId", "starLabel", "starCategory"],
    optionalEntities: ["brightness", "transformation", "pairedStarId", "palaceId"],
    normalizationRules: ["别名归一到 starId", "主星、辅曜、煞曜、杂曜、周期星分层", "四化不写入庙旺字段"]
  },
  {
    profileId: "p35.extract.ziwei-palace-pattern",
    domain: "ziwei",
    entityKind: "patternId",
    label: "紫微宫位格局实体抽取",
    sourceFields: ["title", "normalizedSummary", "topicTags", "extractedEntities"],
    requiredEntities: ["patternId", "palaceId", "conditionSummary"],
    optionalEntities: ["breakageSignal", "repairSignal", "threeSquareFourUpright", "flowType"],
    normalizationRules: ["格局只归入 patternId", "破格和修复信号分字段", "动态盘格局必须带 flowType"]
  },
  {
    profileId: "p35.extract.ziwei-dynamic-flow",
    domain: "ziwei",
    entityKind: "flowType",
    label: "紫微动态盘实体抽取",
    sourceFields: ["title", "normalizedSummary", "topicTags", "sourceLocator"],
    requiredEntities: ["flowType", "palaceId", "sourceRuleId"],
    optionalEntities: ["daYunIndex", "liuNianYear", "liuYueMonth", "liuRiDay", "liuShiBranch"],
    normalizationRules: ["大限、流年、流月、流日、流时独立标记", "动态盘继承不覆盖原盘", "流动层必须保留来源层级"]
  },
  {
    profileId: "p35.extract.ziwei-stem-branch",
    domain: "ziwei",
    entityKind: "stemBranch",
    label: "紫微天干地支实体抽取",
    sourceFields: ["title", "normalizedSummary", "topicTags", "extractedEntities"],
    requiredEntities: ["stemId", "branchId"],
    optionalEntities: ["elementGate", "branchGroup", "direction", "season"],
    normalizationRules: ["天干地支与八字共享文字实体但不共享解释层", "四马地、四桃花、四库地归入 branchGroup", "五行局不等于八字用神"]
  }
]

export const ZIWEI_DATA_CONFLICT_SIGNAL_PROFILES: ZiweiDataConflictSignalProfile[] = [
  {
    signalId: "p35.conflict.ziwei-hard-rule-overwrite",
    domainScope: ["ziwei"],
    label: "紫微硬规则覆盖风险",
    severity: "blocking",
    compares: ["star-catalog", "pattern-catalog", "transformation-rules", "brightness-table", "dynamic-flow-rules"],
    reason: "外部资料试图覆盖项目硬规则表时必须进入复核，不能直接改算法。",
    routingQueueId: "destiny.review.rule-conflict"
  },
  {
    signalId: "p35.conflict.ziwei-storage-boundary",
    domainScope: ["ziwei"],
    label: "紫微资料存储边界冲突",
    severity: "blocking",
    compares: ["sourceKind", "storagePolicy", "blockedFields", "originalTextStoragePolicy"],
    reason: "现代资料出现正文、截图、字幕全文或软件版式时必须拒绝或回到元信息层。",
    routingQueueId: "destiny.review.source-unknown"
  },
  {
    signalId: "p35.conflict.ziwei-flow-layer-mismatch",
    domainScope: ["ziwei"],
    label: "紫微动态层级冲突",
    severity: "warning",
    compares: ["flowType", "palaceId", "sourceRuleId", "dynamicInheritance"],
    reason: "大限、流年、流月、流日、流时层级不一致时需要人工确认。",
    routingQueueId: "destiny.review.rule-conflict"
  },
  {
    signalId: "p35.conflict.ziwei-source-duplicate",
    domainScope: ["ziwei"],
    label: "紫微同源重复冲突",
    severity: "info",
    compares: ["dedupKey", "sourceId", "entityId", "topicTag"],
    reason: "同一来源、同一实体、同一主题重复采集时合并元信息。",
    routingQueueId: "destiny.review.duplicate-collision"
  }
]

export const ZIWEI_DATA_REVIEW_QUEUE_PROFILES: ZiweiDataReviewQueueProfile[] = [
  {
    queueId: "p35.review.ziwei-topic-mapping",
    domainScope: ["ziwei"],
    label: "紫微主题映射复核",
    priority: "P1",
    intakeStatuses: ["needs-source-review", "needs-dedup"],
    requiredReviewFields: ["sourceId", "topicTag", "entityKind", "entityId", "targetDictionaryLayer"],
    autoRejectSignals: ["topic-unmapped", "entity-missing", "sourceId-missing"],
    promotionCriteria: ["主题标签可筛选", "实体可归一", "目标数据字典层明确"]
  },
  {
    queueId: "p35.review.ziwei-dynamic-flow",
    domainScope: ["ziwei"],
    label: "紫微动态盘资料复核",
    priority: "P0",
    intakeStatuses: ["needs-conflict-review", "needs-source-review"],
    requiredReviewFields: ["flowType", "palaceId", "sourceRuleId", "sourceId", "reviewDecision"],
    autoRejectSignals: ["flowType-missing", "tries-to-overwrite-natal-chart", "dynamic-hard-rule-conflict"],
    promotionCriteria: ["流动层级明确", "不覆盖原盘", "与动态盘硬规则不冲突"]
  }
]

export const ZIWEI_DATA_CLEANED_INTAKE_RESULT_RECORDS: ZiweiDataCleanedIntakeResultRecord[] = [
  {
    resultId: "p35.cleaned.star-general-template",
    domain: "ziwei",
    sourceId: "p35.source.website-metadata",
    fragmentId: "p35.fragment.slot.star-general",
    sourceKind: "website-metadata",
    storagePolicy: "metadata-only",
    dedupProfileId: "p35.dedup.source-entity-topic",
    dedupKey: "ziwei:website-metadata:p35.source.website-metadata:starId:{starId}:star",
    normalizedFields: {
      sourceId: "p35.source.website-metadata",
      entityKind: "starId",
      entityId: "{starId}",
      topicTag: "star",
      normalizedSummary: "项目自有星曜摘要"
    },
    entityRefs: [
      {
        entityKind: "starId",
        entityId: "{starId}",
        label: "星曜",
        confidence: "medium",
        normalizedBy: ["p35.extract.ziwei-star"]
      }
    ],
    topicTags: ["star"],
    conflictSignalIds: [],
    reviewQueueId: "p35.review.ziwei-topic-mapping",
    reviewStatus: "needs-source-review",
    promotionStatus: "needs-review",
    targetDictionaryLayer: "star.dictionary",
    rejectionReason: null,
    auditTrail: ["来源已登记", "仅保留元信息和项目自有摘要", "等待星曜实体复核"]
  },
  {
    resultId: "p35.cleaned.classic-pattern-template",
    domain: "ziwei",
    sourceId: "p35.source.public-domain-classic-index",
    fragmentId: "p35.fragment.slot.pattern-breakage",
    sourceKind: "classic-public-domain",
    storagePolicy: "public-domain-text-and-summary",
    dedupProfileId: "p35.dedup.public-domain-classic-passage",
    dedupKey: "ziwei:classic:{classicTitle}:{version}:{chapterTitle}:{term}",
    normalizedFields: {
      classicTitle: "{classicTitle}",
      version: "{version}",
      chapterTitle: "{chapterTitle}",
      term: "{term}",
      originalTextHash: "{originalTextHash}"
    },
    entityRefs: [
      {
        entityKind: "patternId",
        entityId: "{patternId}",
        label: "格局",
        confidence: "medium",
        normalizedBy: ["p35.extract.ziwei-palace-pattern"]
      }
    ],
    topicTags: ["pattern"],
    conflictSignalIds: [],
    reviewQueueId: null,
    reviewStatus: "collected-metadata",
    promotionStatus: "ready-for-dictionary",
    targetDictionaryLayer: "pattern.dictionary",
    rejectionReason: null,
    auditTrail: ["公版古籍来源已登记", "版本和篇目已归一", "可进入古籍术语和格局资料层"]
  },
  {
    resultId: "p35.cleaned.dynamic-flow-template",
    domain: "ziwei",
    sourceId: "p35.source.software-reference-metadata",
    fragmentId: "p35.fragment.slot.dynamic-flow",
    sourceKind: "software-reference-metadata",
    storagePolicy: "metadata-only",
    dedupProfileId: "p35.dedup.dynamic-flow-topic",
    dedupKey: "ziwei:dynamic:{flowType}:{entityId}:software-reference-metadata:dynamic-flow",
    normalizedFields: {
      flowType: "{flowType}",
      entityId: "{palaceId}",
      sourceKind: "software-reference-metadata",
      topicTag: "dynamic-flow",
      normalizedSummary: "项目自有动态盘差异摘要"
    },
    entityRefs: [
      {
        entityKind: "flowType",
        entityId: "{flowType}",
        label: "动态层",
        confidence: "medium",
        normalizedBy: ["p35.extract.ziwei-dynamic-flow"]
      },
      {
        entityKind: "palaceId",
        entityId: "{palaceId}",
        label: "宫位",
        confidence: "medium",
        normalizedBy: ["p35.extract.ziwei-dynamic-flow"]
      }
    ],
    topicTags: ["dynamic-flow"],
    conflictSignalIds: ["p35.conflict.ziwei-flow-layer-mismatch"],
    reviewQueueId: "p35.review.ziwei-dynamic-flow",
    reviewStatus: "needs-conflict-review",
    promotionStatus: "needs-review",
    targetDictionaryLayer: "dynamic-flow.dictionary",
    rejectionReason: null,
    auditTrail: ["软件来源只登记元信息", "不复制截图和版式", "动态层冲突进入复核队列"]
  },
  {
    resultId: "p35.cleaned.blocked-modern-content-template",
    domain: "ziwei",
    sourceId: "p35.source.modern-book-metadata",
    fragmentId: "p35.fragment.slot.pattern-breakage",
    sourceKind: "modern-book-metadata",
    storagePolicy: "metadata-only",
    dedupProfileId: "p35.dedup.source-entity-topic",
    dedupKey: "ziwei:modern-book-metadata:p35.source.modern-book-metadata:patternId:{patternId}:pattern",
    normalizedFields: {
      sourceId: "p35.source.modern-book-metadata",
      entityKind: "patternId",
      entityId: "{patternId}",
      topicTag: "pattern",
      normalizedSummary: ""
    },
    entityRefs: [
      {
        entityKind: "patternId",
        entityId: "{patternId}",
        label: "格局",
        confidence: "low",
        normalizedBy: ["p35.extract.ziwei-palace-pattern"]
      }
    ],
    topicTags: ["pattern", "storage-boundary"],
    conflictSignalIds: ["p35.conflict.ziwei-storage-boundary"],
    reviewQueueId: "destiny.review.source-unknown",
    reviewStatus: "rejected",
    promotionStatus: "blocked",
    targetDictionaryLayer: null,
    rejectionReason: "现代书籍正文、表格原文或扫描图不得进入资料库。",
    auditTrail: ["现代书籍只保留元信息", "检测到禁存字段", "阻断入库"]
  }
]

export const ZIWEI_DATA_CLEANING_PIPELINE_PROFILES: ZiweiDataCleaningPipelineProfile[] = [
  {
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    label: "紫微资料清洗执行流程 v1",
    sourceKinds: [
      "classic-public-domain",
      "classic-index",
      "university-library-catalog",
      "modern-book-metadata",
      "website-metadata",
      "video-metadata",
      "software-reference-metadata",
      "forum-thread-metadata",
      "manual-sample",
      "project-original"
    ],
    steps: [
      {
        stepId: "p35.pipeline.step.source-registration",
        order: 1,
        kind: "source-registration",
        label: "来源登记",
        inputRefs: ["rawInput", "sourceKind", "locator"],
        outputRefs: ["sourceId", "sourceKind", "storagePolicy"],
        requiredChecks: ["必须有 sourceId", "必须有 locator", "必须有 sourceKind"],
        blockingSignals: ["locator-missing", "source-kind-unknown"]
      },
      {
        stepId: "p35.pipeline.step.storage-boundary",
        order: 2,
        kind: "storage-boundary",
        label: "可存储边界判断",
        inputRefs: ["sourceId", "sourceKind", "allowedStorage", "blockedStorage"],
        outputRefs: ["storagePolicy", "originalTextStoragePolicy", "blockedFields"],
        requiredChecks: ["现代资料不得保存正文", "大学图书馆馆藏目录先停留元信息层", "公版古籍正文必须确认来源"],
        blockingSignals: ["p35.conflict.ziwei-storage-boundary"]
      },
      {
        stepId: "p35.pipeline.step.entity-extraction",
        order: 3,
        kind: "entity-extraction",
        label: "实体抽取",
        inputRefs: ["normalizedSummary", "topicTags", "extractedEntities"],
        outputRefs: ["entityRefs", "topicTags"],
        requiredChecks: ["至少命中一个实体", "实体必须能归一到紫微 domain profile", "动态资料必须带 flowType"],
        blockingSignals: ["entity-missing", "topic-unmapped"]
      },
      {
        stepId: "p35.pipeline.step.deduplication",
        order: 4,
        kind: "deduplication",
        label: "去重键生成",
        inputRefs: ["sourceId", "sourceKind", "entityRefs", "topicTags"],
        outputRefs: ["dedupProfileId", "dedupKey", "normalizedFields"],
        requiredChecks: ["dedupKey 必须包含 ziwei domain", "dedupKey 必须包含 sourceId 或来源归一字段", "同源同实体同主题进入合并或复核"],
        blockingSignals: ["same-source-duplicate-topic"]
      },
      {
        stepId: "p35.pipeline.step.conflict-detection",
        order: 5,
        kind: "conflict-detection",
        label: "冲突检测",
        inputRefs: ["dedupKey", "entityRefs", "storagePolicy", "hardRuleLayers"],
        outputRefs: ["conflictSignalIds", "reviewStatus", "promotionStatus"],
        requiredChecks: ["外部资料不得覆盖硬规则", "动态层级冲突必须标记", "禁存字段必须标记"],
        blockingSignals: ["p35.conflict.ziwei-hard-rule-overwrite", "p35.conflict.ziwei-storage-boundary"]
      },
      {
        stepId: "p35.pipeline.step.review-routing",
        order: 6,
        kind: "review-routing",
        label: "复核路由",
        inputRefs: ["conflictSignalIds", "reviewStatus", "promotionStatus"],
        outputRefs: ["reviewQueueId", "reviewStatus"],
        requiredChecks: ["来源不明进入来源复核", "去重碰撞进入去重复核", "硬规则冲突进入硬规则复核"],
        blockingSignals: ["tries-to-overwrite-hard-rule", "unverified-modern-source"]
      },
      {
        stepId: "p35.pipeline.step.cleaned-result",
        order: 7,
        kind: "cleaned-result",
        label: "清洗结果输出",
        inputRefs: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "conflictSignalIds", "reviewQueueId"],
        outputRefs: ["cleanedResultRecord", "promotionStatus", "targetDictionaryLayer"],
        requiredChecks: ["blocked 必须有 rejectionReason", "ready-for-dictionary 必须有 targetDictionaryLayer", "auditTrail 不得为空"],
        blockingSignals: ["missing-rejection-reason", "missing-target-dictionary-layer"]
      }
    ],
    finalOutputs: ["dedupKey", "entityRefs", "conflictSignalIds", "reviewQueueId", "promotionStatus", "targetDictionaryLayer", "auditTrail"],
    forbiddenShortcuts: ["不能跳过来源登记", "不能跳过可存储边界", "不能把现代资料正文直接写入数据字典", "不能用外部资料覆盖硬规则"]
  }
]

const ZIWEI_CLEANING_SCENARIO_STEPS: DestinyCleaningPipelineScenarioRecord["expectedStepKinds"] = [
  "source-registration",
  "storage-boundary",
  "entity-extraction",
  "deduplication",
  "conflict-detection",
  "review-routing",
  "cleaned-result"
]

const ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS = [
  "dedupKey",
  "entityRefs",
  "conflictSignalIds",
  "reviewQueueId",
  "promotionStatus",
  "targetDictionaryLayer",
  "auditTrail"
]

export const ZIWEI_DATA_CLEANING_PIPELINE_SCENARIOS: ZiweiDataCleaningPipelineScenarioRecord[] = [
  {
    scenarioId: "p35.scenario.classic-public-domain-ready",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "classic-public-domain",
    inputSummary: "确认来源和版本的公版古籍正文，抽取格局或术语。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "ready-for-dictionary",
    expectedReviewStatus: "collected-metadata",
    expectedReviewQueueId: null,
    expectedTargetDictionaryLayer: "pattern.dictionary",
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["可存公版原文。", "必须保留版本、篇目、术语和来源。"]
  },
  {
    scenarioId: "p35.scenario.classic-index-metadata",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "classic-index",
    inputSummary: "古籍目录或版本索引，只能确认书名、篇目或馆藏线索。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "metadata-only",
    expectedReviewStatus: "needs-source-review",
    expectedReviewQueueId: "destiny.review.source-unknown",
    expectedTargetDictionaryLayer: null,
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["先作为索引线索。", "找到可确认公版正文后再转入 classic-public-domain。"]
  },
  {
    scenarioId: "p35.scenario.university-library-catalog",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "university-library-catalog",
    inputSummary: "世界大学图书馆馆藏目录或数字馆藏入口。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "metadata-only",
    expectedReviewStatus: "needs-source-review",
    expectedReviewQueueId: "destiny.review.source-unknown",
    expectedTargetDictionaryLayer: null,
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["只存馆藏元信息和公版判断线索。", "不存受限影像、登录后全文或馆藏系统排版。"]
  },
  {
    scenarioId: "p35.scenario.modern-book-metadata",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "modern-book-metadata",
    inputSummary: "现代书籍条目、页码和主题线索。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "metadata-only",
    expectedReviewStatus: "needs-source-review",
    expectedReviewQueueId: "destiny.review.source-unknown",
    expectedTargetDictionaryLayer: null,
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["现代书籍内容暂不采。", "只保留书名、作者、版本、页码、主题。"]
  },
  {
    scenarioId: "p35.scenario.website-star-summary",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "website-metadata",
    inputSummary: "网站文章元信息和项目自有星曜摘要。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "needs-review",
    expectedReviewStatus: "needs-source-review",
    expectedReviewQueueId: "p35.review.ziwei-topic-mapping",
    expectedTargetDictionaryLayer: "star.dictionary",
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["不存整篇正文。", "实体抽取后进入主题映射复核。"]
  },
  {
    scenarioId: "p35.scenario.video-topic-summary",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "video-metadata",
    inputSummary: "视频标题、作者、平台、链接、时间点和项目自有摘要。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "needs-review",
    expectedReviewStatus: "needs-source-review",
    expectedReviewQueueId: "p35.review.ziwei-topic-mapping",
    expectedTargetDictionaryLayer: "star.dictionary",
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["不存字幕全文。", "时间点必须可回查。"]
  },
  {
    scenarioId: "p35.scenario.software-dynamic-flow",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "software-reference-metadata",
    inputSummary: "排盘软件版本、功能点和动态盘差异摘要。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "needs-review",
    expectedReviewStatus: "needs-conflict-review",
    expectedReviewQueueId: "p35.review.ziwei-dynamic-flow",
    expectedTargetDictionaryLayer: "dynamic-flow.dictionary",
    expectedConflictSignalIds: ["p35.conflict.ziwei-flow-layer-mismatch"],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["不存截图、图标、商标或版式。", "只转成项目验收点和差异摘要。"]
  },
  {
    scenarioId: "p35.scenario.forum-thread-sample",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "forum-thread-metadata",
    inputSummary: "论坛或社群讨论元信息和脱敏主题摘要。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "needs-review",
    expectedReviewStatus: "needs-source-review",
    expectedReviewQueueId: "p35.review.ziwei-topic-mapping",
    expectedTargetDictionaryLayer: null,
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["不能把单一样例升成通用理论。", "必须脱敏。"]
  },
  {
    scenarioId: "p35.scenario.manual-sample",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "manual-sample",
    inputSummary: "用户自有输入的人工校盘样例。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "needs-review",
    expectedReviewStatus: "needs-dedup",
    expectedReviewQueueId: "destiny.review.duplicate-collision",
    expectedTargetDictionaryLayer: null,
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["用于校验算法和页面。", "不得直接升为理论。"]
  },
  {
    scenarioId: "p35.scenario.project-original",
    pipelineId: "p35.pipeline.ziwei-cleaning-v1",
    domain: "ziwei",
    sourceKind: "project-original",
    inputSummary: "项目原创摘要、结构化字段和复核记录。",
    expectedStepKinds: ZIWEI_CLEANING_SCENARIO_STEPS,
    expectedPromotionStatus: "ready-for-dictionary",
    expectedReviewStatus: "approved-for-dictionary",
    expectedReviewQueueId: null,
    expectedTargetDictionaryLayer: "star.dictionary",
    expectedConflictSignalIds: [],
    expectedOutputFields: ZIWEI_CLEANING_SCENARIO_OUTPUT_FIELDS,
    notes: ["必须绑定来源引用。", "不得混入未标来源的外部正文。"]
  }
]

export const ZIWEI_RAW_INTAKE_FRAGMENT_SLOTS: ZiweiRawIntakeFragmentRecord[] = [
  {
    fragmentId: "p35.fragment.slot.star-general",
    sourceId: "p35.source.website-metadata",
    topicTags: ["star"],
    sourceLocator: "to-be-collected",
    originalTextStoragePolicy: "none",
    normalizedSummary: "待采集星曜本体资料，入库前只存自有摘要和实体标签。",
    extractedEntities: ["starId", "starLabel", "category"],
    dedupKey: "star-general:{sourceId}:{entity}",
    reviewStatus: "queued",
    rejectionReason: null
  },
  {
    fragmentId: "p35.fragment.slot.pattern-breakage",
    sourceId: "p35.source.modern-book-metadata",
    topicTags: ["pattern"],
    sourceLocator: "to-be-collected",
    originalTextStoragePolicy: "none",
    normalizedSummary: "待采集格局成格、破格、修复边界资料，不能复制原文。",
    extractedEntities: ["patternId", "breakageSignal", "repairSignal"],
    dedupKey: "pattern-breakage:{sourceId}:{patternId}",
    reviewStatus: "queued",
    rejectionReason: null
  },
  {
    fragmentId: "p35.fragment.slot.dynamic-flow",
    sourceId: "p35.source.software-reference-metadata",
    topicTags: ["dynamic-flow"],
    sourceLocator: "to-be-collected",
    originalTextStoragePolicy: "none",
    normalizedSummary: "待采集大限、流年、流月、流日、流时差异点，只存元信息和自有差异摘要。",
    extractedEntities: ["flowType", "palace", "sourceRuleId"],
    dedupKey: "dynamic-flow:{sourceId}:{flowType}:{topic}",
    reviewStatus: "queued",
    rejectionReason: null
  }
]

export const ZIWEI_DATA_TOPIC_MAPPINGS: ZiweiDataTopicMappingRecord[] = [
  {
    mappingId: "p35.mapping.star-dictionary",
    topicTag: "star",
    targetDictionaryLayer: "star.dictionary",
    acceptedSourceKinds: ["classic-public-domain", "modern-book-metadata", "website-metadata"],
    requiredFields: ["sourceId", "entity", "normalizedSummary", "storagePolicy"],
    usageBoundary: ["只补星曜解释，不新增 starId。", "现代资料只作为元信息和自有摘要来源。"]
  },
  {
    mappingId: "p35.mapping.pattern-dictionary",
    topicTag: "pattern",
    targetDictionaryLayer: "pattern.dictionary",
    acceptedSourceKinds: ["classic-public-domain", "modern-book-metadata", "website-metadata"],
    requiredFields: ["sourceId", "patternId", "normalizedSummary", "reviewStatus"],
    usageBoundary: ["不重复定义成格条件。", "未命中格局不得进入当前盘展示。"]
  },
  {
    mappingId: "p35.mapping.dynamic-flow",
    topicTag: "dynamic-flow",
    targetDictionaryLayer: "dynamic-flow.dictionary",
    acceptedSourceKinds: ["software-reference-metadata", "manual-sample", "website-metadata"],
    requiredFields: ["sourceId", "flowType", "normalizedSummary", "sourceLocator"],
    usageBoundary: ["只记录差异摘要和复核问题。", "动态硬规则仍以 project.dynamic-flow-rules 为准。"]
  },
  {
    mappingId: "p35.mapping.transformation",
    topicTag: "transformation",
    targetDictionaryLayer: "transformation.topic",
    acceptedSourceKinds: ["classic-public-domain", "modern-book-metadata", "website-metadata"],
    requiredFields: ["sourceId", "stem", "targetStarId", "normalizedSummary"],
    usageBoundary: ["不重复定义四化目标表。", "四化自身不写庙旺。"]
  }
]

export const ZIWEI_DATA_DICTIONARY_TOPIC_MAPPING_PROFILES: ZiweiDataDictionaryTopicMappingProfile[] = [
  {
    mappingProfileId: "p35.dictionary-mapping.star",
    domain: "ziwei",
    topicTag: "star",
    label: "Star dictionary mapping",
    entityKinds: ["starId", "starCategory", "alias", "brightnessRef"],
    sourceKinds: ["classic-public-domain", "university-library-catalog", "modern-book-metadata", "website-metadata", "video-metadata", "project-original"],
    targetDictionaryLayer: "star.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include one known starId or a reviewable alias", "promotionStatus must be ready-for-dictionary or needs-review", "modern sources can only provide metadata and project-owned summaries"],
    rejectionRules: ["reject if the record creates a new starId without catalog review", "reject if original modern body text is required"],
    downstreamUse: ["star base explanation", "star category filtering", "star-palace combination evidence"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.palace",
    domain: "ziwei",
    topicTag: "palace",
    label: "Palace dictionary mapping",
    entityKinds: ["palaceId", "palaceThemeId", "fieldId"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "project-original"],
    targetDictionaryLayer: "palace.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must resolve to a known palaceId or palace theme", "palace meaning must stay separate from current chart interpretation", "source must preserve the palace-field boundary"],
    rejectionRules: ["reject if the note mixes palace meaning with behavior mapping", "reject if it cannot be traced to sourceId and fragmentId"],
    downstreamUse: ["palace base explanation", "palace theme chain", "chart sector interpretation"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.branch",
    domain: "ziwei",
    topicTag: "branch",
    label: "Earthly branch dictionary mapping",
    entityKinds: ["branchId", "branchGroupId", "spaceContextId"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "project-original"],
    targetDictionaryLayer: "branch.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include branchId or branchGroupId", "groups such as four-travel-horse must be represented as structured group refs", "branch content must not override the fixed branch order"],
    rejectionRules: ["reject if branch grouping conflicts with hard rule tables", "reject if it is only a single unsourced modern claim"],
    downstreamUse: ["branch base dictionary", "branch group explanation", "palace spatial context"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.stem",
    domain: "ziwei",
    topicTag: "stem",
    label: "Heavenly stem dictionary mapping",
    entityKinds: ["stemId", "yinYang", "elementId", "transformationRuleRef"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "project-original"],
    targetDictionaryLayer: "stem.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include stemId", "stem meaning must remain separate from transformation target tables", "yin-yang and five-element notes must be normalized"],
    rejectionRules: ["reject if it changes fixed stem order", "reject if it rewrites transformation hard rules"],
    downstreamUse: ["stem base dictionary", "stem-branch context", "transformation source trace"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.element-gate",
    domain: "ziwei",
    topicTag: "element-gate",
    label: "Element gate dictionary mapping",
    entityKinds: ["elementGateId", "fiveElementId", "bureauId"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "project-original"],
    targetDictionaryLayer: "element-gate.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include elementGateId or bureauId", "notes must distinguish explanation from fixed bureau calculation", "source should preserve the linked stem-branch context"],
    rejectionRules: ["reject if it changes five-element bureau calculation", "reject if it lacks normalized element refs"],
    downstreamUse: ["element gate explanation", "bureau context", "chart metadata explanation"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.pattern",
    domain: "ziwei",
    topicTag: "pattern",
    label: "Pattern dictionary mapping",
    entityKinds: ["patternId", "formationSignal", "breakageSignal", "repairSignal"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "video-metadata", "project-original"],
    targetDictionaryLayer: "pattern.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include patternId or a reviewable pattern alias", "formation and breakage must be separated", "only chart-hit patterns can be promoted into current chart output"],
    rejectionRules: ["reject if it lists an unhit pattern as current chart result", "reject if breakage and formation are merged without labels"],
    downstreamUse: ["pattern dictionary", "pattern hit report", "breakage and repair analysis"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.transformation",
    domain: "ziwei",
    topicTag: "transformation",
    label: "Transformation topic mapping",
    entityKinds: ["stemId", "transformationId", "targetStarId", "flowOwner"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "project-original"],
    targetDictionaryLayer: "transformation.topic",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include stemId and transformationId", "record must identify natal or flow owner when applicable", "transformation notes must not carry brightness status"],
    rejectionRules: ["reject if transformation is treated as brightness", "reject if it overwrites the fixed stem-to-transformation target table"],
    downstreamUse: ["transformation explanation", "flow transformation display", "pattern evidence"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.brightness",
    domain: "ziwei",
    topicTag: "brightness",
    label: "Brightness dictionary mapping",
    entityKinds: ["starId", "branchId", "brightnessState"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "project-original"],
    targetDictionaryLayer: "star-brightness.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include starId and branchId", "brightnessState must be one normalized value", "auxiliary stars without brightness tables must stay ungraded"],
    rejectionRules: ["reject if four transformations are given brightness states", "reject if a misc star is graded without an approved brightness table"],
    downstreamUse: ["star brightness table", "chart palace star display", "pattern strength evidence"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.dynamic-flow",
    domain: "ziwei",
    topicTag: "dynamic-flow",
    label: "Dynamic flow mapping",
    entityKinds: ["flowType", "flowPalaceId", "flowLabel", "inheritanceRuleId"],
    sourceKinds: ["software-reference-metadata", "manual-sample", "website-metadata", "project-original"],
    targetDictionaryLayer: "dynamic-flow.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include flowType", "records must distinguish daYun, liuNian, liuYue, liuRi, and liuShi", "dynamic labels must preserve their owner layer"],
    rejectionRules: ["reject if a lower flow deletes upper flow markers", "reject if software layout is copied as implementation"],
    downstreamUse: ["dynamic chart labels", "flow pattern filtering", "current chart hit scope"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.relationship",
    domain: "ziwei",
    topicTag: "relationship",
    label: "Relationship structure mapping",
    entityKinds: ["relationshipStructureId", "sourceEntityRef", "targetEntityRef", "relationRole"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "manual-sample", "project-original"],
    targetDictionaryLayer: "relationship.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["entityRefs must include at least two related entities", "relationRole must be normalized", "relationship evidence must not become a standalone hard rule without review"],
    rejectionRules: ["reject if relationship role is ambiguous", "reject if only anecdotal sample evidence exists"],
    downstreamUse: ["star pair relation", "pattern relation", "palace theme synthesis"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.sample",
    domain: "ziwei",
    topicTag: "sample",
    label: "Manual sample calibration mapping",
    entityKinds: ["sampleId", "anonymizedChartId", "calibrationField", "reviewDecision"],
    sourceKinds: ["manual-sample", "project-original"],
    targetDictionaryLayer: "sample.calibration",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["sample must be anonymized or user-owned", "sample must remain calibration evidence rather than universal theory", "reviewDecision must be recorded"],
    rejectionRules: ["reject if personal data is not anonymized", "reject if a single sample is promoted as a general rule"],
    downstreamUse: ["manual verification", "edge-case review", "rule confidence calibration"]
  },
  {
    mappingProfileId: "p35.dictionary-mapping.storage-boundary",
    domain: "ziwei",
    topicTag: "storage-boundary",
    label: "Source storage boundary mapping",
    entityKinds: ["sourceKind", "storagePolicy", "boundaryRuleId", "reviewQueueId"],
    sourceKinds: ["classic-public-domain", "classic-index", "university-library-catalog", "modern-book-metadata", "website-metadata", "video-metadata", "software-reference-metadata", "forum-thread-metadata", "manual-sample", "project-original"],
    targetDictionaryLayer: "source-storage-boundary.dictionary",
    requiredCleanedFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "promotionStatus", "normalizedFields"],
    sourceTraceFields: ["sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    acceptanceRules: ["sourceKind and storagePolicy must be explicit", "boundary records must route unsafe material before dictionary promotion", "all modern body text remains outside storage"],
    rejectionRules: ["reject if source kind is unknown", "reject if a record requires copying restricted body text"],
    downstreamUse: ["source registration", "review queue routing", "dictionary promotion gate"]
  }
]

export const ZIWEI_DATA_USABILITY_SCORE_RULES: ZiweiDataUsabilityScoreRule[] = [
  {
    ruleId: "p35.score.has-clear-source",
    label: "来源清楚",
    scoreDelta: 20,
    appliesWhen: ["有标题、作者或发布方", "有可回查 locator"]
  },
  {
    ruleId: "p35.score.storage-safe",
    label: "存储安全",
    scoreDelta: 30,
    appliesWhen: ["metadata-only", "public-domain-text-and-summary", "original-summary-only", "user-owned-input"]
  },
  {
    ruleId: "p35.score.topic-mapped",
    label: "主题可映射",
    scoreDelta: 20,
    appliesWhen: ["能映射到星曜、宫位、格局、四化、动态盘或关系结构"]
  },
  {
    ruleId: "p35.score.conflict-risk",
    label: "存在冲突或流派差异",
    scoreDelta: -20,
    appliesWhen: ["与项目硬规则冲突", "流派差异未标注", "来源无法二次确认"]
  },
  {
    ruleId: "p35.score.storage-blocked",
    label: "禁止存储",
    scoreDelta: -100,
    appliesWhen: ["要求复制正文", "要求复制截图", "来源禁止转载或不可确认"]
  }
]

export const ZIWEI_DATA_DICTIONARY_ADMISSION_POLICY_PROFILES: ZiweiDataDictionaryAdmissionPolicyProfile[] = [
  {
    policyId: "p35.admission.public-domain-ready",
    domain: "ziwei",
    label: "公版古籍可入字典",
    appliesToPromotionStatuses: ["ready-for-dictionary"],
    appliesToStoragePolicies: ["public-domain-text-and-summary", "original-summary-only", "user-owned-input"],
    minScoreInclusive: 70,
    maxScoreInclusive: 100,
    admissionStatus: "admitted",
    allowedTargetDictionaryLayers: [
      "star.dictionary",
      "palace.dictionary",
      "branch.dictionary",
      "stem.dictionary",
      "element-gate.dictionary",
      "pattern.dictionary",
      "transformation.topic",
      "star-brightness.dictionary",
      "relationship.dictionary"
    ],
    requiredEvidenceFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "targetDictionaryLayer", "auditTrail"],
    requiredReviewQueueIds: [],
    blockingSignals: ["source-kind-unknown", "tries-to-overwrite-hard-rule", "modern-content-without-metadata"],
    outputFields: ["dictionaryLayer", "sourceTrace", "entityRefs", "normalizedSummary", "admissionAudit"]
  },
  {
    policyId: "p35.admission.metadata-index-only",
    domain: "ziwei",
    label: "目录索引仅保留元信息",
    appliesToPromotionStatuses: ["metadata-only"],
    appliesToStoragePolicies: ["metadata-only"],
    minScoreInclusive: 30,
    maxScoreInclusive: 69,
    admissionStatus: "metadata-only",
    allowedTargetDictionaryLayers: ["source-storage-boundary.dictionary"],
    requiredEvidenceFields: ["sourceId", "sourceKind", "sourceLocator", "storagePolicy", "reviewStatus", "auditTrail"],
    requiredReviewQueueIds: ["destiny.review.source-unknown"],
    blockingSignals: ["restricted-image", "commercial-database-body", "modern-body-text"],
    outputFields: ["sourceIndex", "metadataTrace", "reviewQueueId", "publicDomainCandidate"]
  },
  {
    policyId: "p35.admission.topic-review-required",
    domain: "ziwei",
    label: "现代资料主题复核后入库",
    appliesToPromotionStatuses: ["needs-review"],
    appliesToStoragePolicies: ["metadata-only", "original-summary-only"],
    minScoreInclusive: 45,
    maxScoreInclusive: 89,
    admissionStatus: "review-required",
    allowedTargetDictionaryLayers: [
      "star.dictionary",
      "palace.dictionary",
      "branch.dictionary",
      "stem.dictionary",
      "element-gate.dictionary",
      "pattern.dictionary",
      "transformation.topic",
      "relationship.dictionary"
    ],
    requiredEvidenceFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "reviewQueueId", "targetDictionaryLayer", "auditTrail"],
    requiredReviewQueueIds: ["p35.review.ziwei-topic-mapping", "destiny.review.rule-conflict"],
    blockingSignals: ["source-kind-unknown", "copied-modern-body", "unreviewed-hard-rule-conflict"],
    outputFields: ["reviewQueueId", "topicMapping", "ownSummary", "admissionAudit"]
  },
  {
    policyId: "p35.admission.dynamic-flow-review-required",
    domain: "ziwei",
    label: "动态盘差异复核后入库",
    appliesToPromotionStatuses: ["needs-review"],
    appliesToStoragePolicies: ["metadata-only", "user-owned-input"],
    minScoreInclusive: 45,
    maxScoreInclusive: 89,
    admissionStatus: "review-required",
    allowedTargetDictionaryLayers: ["dynamic-flow.dictionary", "sample.calibration"],
    requiredEvidenceFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "reviewQueueId", "targetDictionaryLayer", "auditTrail"],
    requiredReviewQueueIds: ["p35.review.ziwei-dynamic-flow", "destiny.review.duplicate-collision"],
    blockingSignals: ["software-layout-copy", "lower-flow-deletes-upper-flow", "unreviewed-flow-conflict"],
    outputFields: ["flowType", "reviewQueueId", "differenceSummary", "admissionAudit"]
  },
  {
    policyId: "p35.admission.blocked",
    domain: "ziwei",
    label: "禁止入库",
    appliesToPromotionStatuses: ["blocked"],
    appliesToStoragePolicies: ["metadata-only", "blocked"],
    minScoreInclusive: -100,
    maxScoreInclusive: 29,
    admissionStatus: "rejected",
    allowedTargetDictionaryLayers: [],
    requiredEvidenceFields: ["sourceId", "fragmentId", "storagePolicy", "reviewStatus", "rejectionReason", "auditTrail"],
    requiredReviewQueueIds: ["destiny.review.source-unknown"],
    blockingSignals: ["modern-body-text", "screenshot-copy", "restricted-source", "personal-data-unmasked"],
    outputFields: ["rejectionReason", "blockedFields", "sourceTrace", "admissionAudit"]
  }
]

export const ZIWEI_DATA_DICTIONARY_ADMISSION_DECISION_RECORDS: ZiweiDataDictionaryAdmissionDecisionRecord[] = [
  {
    decisionId: "p35.admission-decision.classic-pattern-template",
    domain: "ziwei",
    cleanedResultId: "p35.cleaned.classic-pattern-template",
    policyId: "p35.admission.public-domain-ready",
    score: 90,
    admissionStatus: "admitted",
    targetDictionaryLayer: "pattern.dictionary",
    requiredReviewQueueId: null,
    acceptedEvidenceFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "targetDictionaryLayer", "auditTrail"],
    rejectionReason: null,
    nextAction: "写入格局资料字典，保留公版古籍版本、篇目和实体引用。",
    auditTrail: ["命中公版古籍策略", "主题映射到 pattern.dictionary", "无需现代资料正文"]
  },
  {
    decisionId: "p35.admission-decision.star-general-template",
    domain: "ziwei",
    cleanedResultId: "p35.cleaned.star-general-template",
    policyId: "p35.admission.topic-review-required",
    score: 62,
    admissionStatus: "review-required",
    targetDictionaryLayer: "star.dictionary",
    requiredReviewQueueId: "p35.review.ziwei-topic-mapping",
    acceptedEvidenceFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "reviewQueueId", "targetDictionaryLayer", "auditTrail"],
    rejectionReason: null,
    nextAction: "进入星曜主题复核，确认星曜 ID、别名和自有摘要后再入字典。",
    auditTrail: ["现代网站资料只保留元信息", "已映射 star.dictionary", "等待主题复核"]
  },
  {
    decisionId: "p35.admission-decision.dynamic-flow-template",
    domain: "ziwei",
    cleanedResultId: "p35.cleaned.dynamic-flow-template",
    policyId: "p35.admission.dynamic-flow-review-required",
    score: 58,
    admissionStatus: "review-required",
    targetDictionaryLayer: "dynamic-flow.dictionary",
    requiredReviewQueueId: "p35.review.ziwei-dynamic-flow",
    acceptedEvidenceFields: ["sourceId", "fragmentId", "dedupKey", "entityRefs", "topicTags", "reviewQueueId", "targetDictionaryLayer", "auditTrail"],
    rejectionReason: null,
    nextAction: "进入动态盘复核，确认大限、流年、流月、流日、流时继承边界后再入库。",
    auditTrail: ["软件资料只保留差异摘要", "不复制版式截图", "等待动态盘冲突复核"]
  },
  {
    decisionId: "p35.admission-decision.blocked-modern-content-template",
    domain: "ziwei",
    cleanedResultId: "p35.cleaned.blocked-modern-content-template",
    policyId: "p35.admission.blocked",
    score: -100,
    admissionStatus: "rejected",
    targetDictionaryLayer: null,
    requiredReviewQueueId: "destiny.review.source-unknown",
    acceptedEvidenceFields: ["sourceId", "fragmentId", "storagePolicy", "reviewStatus", "rejectionReason", "auditTrail"],
    rejectionReason: "现代书籍正文、表格原文或扫描图不得进入资料库。",
    nextAction: "只保留书名、作者、版本、页码和主题元信息；正文、表格和扫描图全部阻断。",
    auditTrail: ["命中禁存字段", "入库状态为 rejected", "保留阻断原因"]
  }
]

export const ZIWEI_DATA_ANALYSIS_USAGE_PROFILES: ZiweiDataAnalysisUsageProfile[] = [
  {
    usageId: "p35.analysis.star-dictionary-detail",
    label: "星曜字典详情使用",
    inputAdmissionStatuses: ["admitted", "review-required"],
    targetDictionaryLayers: ["star.dictionary", "star-brightness.dictionary"],
    analysisFields: ["starId", "category", "aliases", "extendedOverview", "brightnessState", "sourceTrace"],
    pageVisibility: "dictionary-only",
    chartHitRequirement: ["不要求当前盘命中", "作为通用星曜资料展示"],
    requiredSourceTrace: ["sourceId", "fragmentId", "policyId", "decisionId"],
    forbiddenUse: ["不能直接生成当前盘结论", "不能显示未复核现代资料正文"],
    outputRefs: ["starDictionaryEntries", "starDictionaryModal"]
  },
  {
    usageId: "p35.analysis.chart-hit-star-reading",
    label: "当前盘命中星曜分析使用",
    inputAdmissionStatuses: ["admitted"],
    targetDictionaryLayers: ["star.dictionary", "star-brightness.dictionary", "palace.dictionary"],
    analysisFields: ["starId", "palaceId", "brightnessState", "palaceTheme", "hitEvidence", "sourceTrace"],
    pageVisibility: "chart-hit-only",
    chartHitRequirement: ["必须在当前盘实际出现", "必须能回到 starId、palaceId 和盘层"],
    requiredSourceTrace: ["sourceId", "fragmentId", "decisionId", "targetDictionaryLayer"],
    forbiddenUse: ["不能展示未命中的星曜断语", "不能用字典资料覆盖安星结果"],
    outputRefs: ["detailedAnalysis", "palaceDetail", "chartStarBadges"]
  },
  {
    usageId: "p35.analysis.pattern-hit-reading",
    label: "格局命中分析使用",
    inputAdmissionStatuses: ["admitted"],
    targetDictionaryLayers: ["pattern.dictionary", "relationship.dictionary"],
    analysisFields: ["patternId", "formationSignal", "breakageSignal", "repairSignal", "hitEvidence", "sourceTrace"],
    pageVisibility: "chart-hit-only",
    chartHitRequirement: ["必须被格局命中算法确认", "必须区分成格、破格和修复"],
    requiredSourceTrace: ["sourceId", "fragmentId", "decisionId", "targetDictionaryLayer"],
    forbiddenUse: ["不能显示未命中格局", "不能把破格和成格混写"],
    outputRefs: ["patternOverview", "patternDetailedAnalysis", "patternFilterResult"]
  },
  {
    usageId: "p35.analysis.dynamic-flow-reading",
    label: "动态流限分析使用",
    inputAdmissionStatuses: ["admitted", "review-required"],
    targetDictionaryLayers: ["dynamic-flow.dictionary", "transformation.topic", "sample.calibration"],
    analysisFields: ["flowType", "flowPalaceId", "flowLabel", "inheritanceRuleId", "reviewQueueId", "sourceTrace"],
    pageVisibility: "review-panel",
    chartHitRequirement: ["必须绑定当前查看的流动层", "未复核资料只能进入复核面板"],
    requiredSourceTrace: ["sourceId", "fragmentId", "decisionId", "requiredReviewQueueId"],
    forbiddenUse: ["不能让低层流限删除高层标记", "不能复制外部软件版式"],
    outputRefs: ["dynamicFlowOverview", "dynamicFlowMatrix", "dynamicFlowReviewPanel"]
  },
  {
    usageId: "p35.analysis.rejected-source-audit",
    label: "拒绝资料审计",
    inputAdmissionStatuses: ["rejected", "metadata-only"],
    targetDictionaryLayers: ["source-storage-boundary.dictionary"],
    analysisFields: ["sourceId", "storagePolicy", "rejectionReason", "blockedFields", "auditTrail"],
    pageVisibility: "hidden",
    chartHitRequirement: ["不进入当前盘展示", "只保留为后台审计和复核依据"],
    requiredSourceTrace: ["sourceId", "policyId", "decisionId", "rejectionReason"],
    forbiddenUse: ["不能进入解释正文", "不能进入当前盘命中结果"],
    outputRefs: ["sourceAudit", "reviewQueue", "blockedMaterialLog"]
  }
]

export const ZIWEI_DATA_COLLECTION_FIELD_PROFILES: ZiweiDataCollectionFieldProfile[] = [
  {
    fieldId: "p35.collection-field.source-identity",
    domainScope: ["ziwei"],
    captureStage: "source-registration",
    label: "来源身份字段",
    required: true,
    valueType: "string[]",
    mapsTo: ["sourceId", "sourceKind", "title", "authorOrPublisher", "versionOrDate"],
    validationRules: ["必须有 sourceKind", "必须有可回查标题或馆藏题名", "现代资料必须记录作者、平台或发布方"],
    forbiddenValues: ["unknown-source", "copied-from-screenshot", "untraceable-forward"]
  },
  {
    fieldId: "p35.collection-field.locator",
    domainScope: ["ziwei"],
    captureStage: "source-registration",
    label: "来源定位字段",
    required: true,
    valueType: "string",
    mapsTo: ["locator", "sourceLocator", "accessDate", "catalogNumber"],
    validationRules: ["必须能回查", "馆藏目录必须记录馆藏系统或目录链接", "视频资料必须记录时间点"],
    forbiddenValues: ["private-login-only", "paywalled-body-copy", "screenshot-only"]
  },
  {
    fieldId: "p35.collection-field.storage-boundary",
    domainScope: ["ziwei"],
    captureStage: "fragment-capture",
    label: "存储边界字段",
    required: true,
    valueType: "enum",
    mapsTo: ["storagePolicy", "allowedStorage", "blockedStorage", "originalTextStoragePolicy"],
    validationRules: ["必须先判定 storagePolicy", "现代资料正文不得进入片段", "公版古籍原文必须记录版本线索"],
    forbiddenValues: ["modern-body-text", "restricted-image", "software-screenshot", "unmasked-personal-data"]
  },
  {
    fieldId: "p35.collection-field.topic-entity",
    domainScope: ["ziwei"],
    captureStage: "cleaning",
    label: "主题实体字段",
    required: true,
    valueType: "string[]",
    mapsTo: ["topicTags", "extractedEntities", "entityRefs", "targetDictionaryLayer"],
    validationRules: ["topicTags 必须来自 P35-D 主题集合", "entityRefs 必须能归一到星曜、宫位、格局、四化或动态盘实体", "未识别实体进入复核"],
    forbiddenValues: ["behavior-mapping", "personality-mapping", "unmapped-topic"]
  },
  {
    fieldId: "p35.collection-field.audit-review",
    domainScope: ["ziwei"],
    captureStage: "review",
    label: "审计复核字段",
    required: true,
    valueType: "string[]",
    mapsTo: ["reviewStatus", "reviewQueueId", "promotionStatus", "admissionStatus", "auditTrail"],
    validationRules: ["needs-review 必须有 reviewQueueId", "blocked 必须有 rejectionReason", "admitted 必须保留 admission decision"],
    forbiddenValues: ["silent-admission", "missing-rejection-reason", "missing-audit-trail"]
  }
]

export const ZIWEI_DATA_SOURCE_SEED_RECORDS: ZiweiDataSourceSeedRecord[] = [
  {
    seedId: "p35.seed.public-domain-classic",
    domain: "ziwei",
    sourceKind: "classic-public-domain",
    label: "公版古籍正文种子",
    locatorTemplate: "manual-or-catalog://public-domain-classic/{title}/{version}",
    automationMode: "assisted",
    storagePolicy: "public-domain-text-and-summary",
    topicTags: ["star", "palace", "pattern", "transformation", "branch", "stem"],
    allowedCaptureFields: ["书名", "版本", "篇目", "公版原文", "术语", "项目自有摘要"],
    forbiddenCaptureFields: ["现代点校排版", "商业数据库正文", "书影批量图片"],
    expectedEntityKinds: ["starId", "palaceId", "patternId", "stemId", "branchId", "transformationId"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: null
  },
  {
    seedId: "p35.seed.university-library-catalog",
    domain: "ziwei",
    sourceKind: "university-library-catalog",
    label: "大学图书馆馆藏目录种子",
    locatorTemplate: "library-catalog://{institution}/{catalogId}",
    automationMode: "automated",
    storagePolicy: "metadata-only",
    topicTags: ["storage-boundary", "star", "palace", "pattern"],
    allowedCaptureFields: ["馆藏系统", "题名", "责任者", "版本", "馆藏号", "数字化状态", "公版判断线索"],
    forbiddenCaptureFields: ["登录后全文", "受限馆藏影像", "馆藏系统排版", "批量书影", "正文", "扫描图"],
    expectedEntityKinds: ["sourceKind", "title", "version", "catalogNumber"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: "destiny.review.source-unknown"
  },
  {
    seedId: "p35.seed.modern-book-metadata",
    domain: "ziwei",
    sourceKind: "modern-book-metadata",
    label: "现代书籍元信息种子",
    locatorTemplate: "book-metadata://{title}/{author}/{edition}",
    automationMode: "assisted",
    storagePolicy: "metadata-only",
    topicTags: ["star", "palace", "pattern", "brightness", "dynamic-flow"],
    allowedCaptureFields: ["书名", "作者", "出版社", "版本", "页码", "主题", "复核状态"],
    forbiddenCaptureFields: ["正文", "表格原文", "扫描图", "整段解释"],
    expectedEntityKinds: ["sourceKind", "topicTag", "pageRef", "reviewStatus"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: "destiny.review.source-unknown"
  },
  {
    seedId: "p35.seed.website-topic-summary",
    domain: "ziwei",
    sourceKind: "website-metadata",
    label: "网站主题摘要种子",
    locatorTemplate: "web-metadata://{url}",
    automationMode: "automated",
    storagePolicy: "metadata-only",
    topicTags: ["star", "palace", "pattern", "relationship", "brightness"],
    allowedCaptureFields: ["标题", "作者", "URL", "发布日期或访问日期", "主题", "项目自有摘要"],
    forbiddenCaptureFields: ["整篇正文", "截图", "站点样式", "广告文案"],
    expectedEntityKinds: ["starId", "palaceId", "patternId", "relationshipStructureId"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: "p35.review.ziwei-topic-mapping"
  },
  {
    seedId: "p35.seed.video-topic-summary",
    domain: "ziwei",
    sourceKind: "video-metadata",
    label: "视频课程主题摘要种子",
    locatorTemplate: "video-metadata://{platform}/{videoId}/{timecode}",
    automationMode: "assisted",
    storagePolicy: "metadata-only",
    topicTags: ["star", "palace", "pattern", "dynamic-flow"],
    allowedCaptureFields: ["标题", "作者或频道", "平台", "链接", "时间点", "主题", "项目自有摘要"],
    forbiddenCaptureFields: ["字幕全文", "课程讲义", "画面截图", "会员内容"],
    expectedEntityKinds: ["topicTag", "timecode", "starId", "flowType"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: "p35.review.ziwei-topic-mapping"
  },
  {
    seedId: "p35.seed.software-dynamic-flow",
    domain: "ziwei",
    sourceKind: "software-reference-metadata",
    label: "排盘软件动态盘差异种子",
    locatorTemplate: "software-reference://{softwareName}/{version}/{feature}",
    automationMode: "manual",
    storagePolicy: "metadata-only",
    topicTags: ["dynamic-flow", "transformation", "sample"],
    allowedCaptureFields: ["软件名", "版本", "功能点", "差异摘要", "人工复核状态"],
    forbiddenCaptureFields: ["截图", "图标", "商标", "版式", "成套文案"],
    expectedEntityKinds: ["flowType", "flowPalaceId", "transformationId", "reviewDecision"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: "p35.review.ziwei-dynamic-flow"
  },
  {
    seedId: "p35.seed.manual-sample",
    domain: "ziwei",
    sourceKind: "manual-sample",
    label: "人工校盘样例种子",
    locatorTemplate: "manual-sample://{sampleId}",
    automationMode: "manual",
    storagePolicy: "user-owned-input",
    topicTags: ["sample", "dynamic-flow", "pattern", "relationship"],
    allowedCaptureFields: ["用户自有输入", "排盘参数", "差异摘要", "脱敏标记", "复核状态"],
    forbiddenCaptureFields: ["第三方完整案例", "未脱敏个人信息", "不可授权资料"],
    expectedEntityKinds: ["sampleId", "anonymizedChartId", "calibrationField", "reviewDecision"],
    handoffPipelineId: "p35.pipeline.ziwei-cleaning-v1",
    reviewQueueId: "destiny.review.duplicate-collision"
  }
]

export const ZIWEI_DATA_COLLECTION_BATCH_PLANS: ZiweiDataCollectionBatchPlan[] = [
  {
    batchId: "p35.collection-batch.classic-dictionary-seed",
    domain: "ziwei",
    label: "公版古籍字典种子批次",
    status: "ready",
    automationMode: "assisted",
    sourceSeedIds: ["p35.seed.public-domain-classic"],
    sourceKinds: ["classic-public-domain"],
    topicTags: ["star", "palace", "pattern", "transformation", "branch", "stem"],
    requiredFieldIds: ["p35.collection-field.source-identity", "p35.collection-field.locator", "p35.collection-field.storage-boundary", "p35.collection-field.topic-entity", "p35.collection-field.audit-review"],
    expectedOutputs: ["sourceRecord", "rawFragment", "cleanedResult", "topicMapping", "admissionDecision"],
    storageGuardrails: ["允许公版古籍原文", "必须记录版本和篇目", "不得混入现代整理版正文"],
    reviewGates: ["来源可回查", "实体可归一", "不覆盖硬规则"]
  },
  {
    batchId: "p35.collection-batch.catalog-metadata-seed",
    domain: "ziwei",
    label: "馆藏与现代书籍元信息批次",
    status: "ready",
    automationMode: "automated",
    sourceSeedIds: ["p35.seed.university-library-catalog", "p35.seed.modern-book-metadata"],
    sourceKinds: ["university-library-catalog", "modern-book-metadata"],
    topicTags: ["storage-boundary", "star", "palace", "pattern", "brightness", "dynamic-flow"],
    requiredFieldIds: ["p35.collection-field.source-identity", "p35.collection-field.locator", "p35.collection-field.storage-boundary", "p35.collection-field.audit-review"],
    expectedOutputs: ["sourceRecord", "metadataOnlyResult", "reviewQueueItem"],
    storageGuardrails: ["只存元信息", "不存正文和扫描图", "馆藏目录不复制受限影像"],
    reviewGates: ["来源类型明确", "公版判断线索可回查", "现代书籍不进入解释正文"]
  },
  {
    batchId: "p35.collection-batch.web-video-topic-review",
    domain: "ziwei",
    label: "网站与视频主题复核批次",
    status: "planned",
    automationMode: "assisted",
    sourceSeedIds: ["p35.seed.website-topic-summary", "p35.seed.video-topic-summary"],
    sourceKinds: ["website-metadata", "video-metadata"],
    topicTags: ["star", "palace", "pattern", "relationship", "brightness", "dynamic-flow"],
    requiredFieldIds: ["p35.collection-field.source-identity", "p35.collection-field.locator", "p35.collection-field.storage-boundary", "p35.collection-field.topic-entity", "p35.collection-field.audit-review"],
    expectedOutputs: ["sourceRecord", "ownSummaryFragment", "cleanedResult", "topicMapping", "reviewQueueItem"],
    storageGuardrails: ["不存整篇正文", "不存字幕全文", "只存项目自有摘要"],
    reviewGates: ["主题映射复核", "实体归一复核", "冲突信号复核"]
  },
  {
    batchId: "p35.collection-batch.dynamic-flow-sample-review",
    domain: "ziwei",
    label: "动态盘差异与人工样例批次",
    status: "planned",
    automationMode: "manual",
    sourceSeedIds: ["p35.seed.software-dynamic-flow", "p35.seed.manual-sample"],
    sourceKinds: ["software-reference-metadata", "manual-sample"],
    topicTags: ["dynamic-flow", "transformation", "sample", "pattern", "relationship"],
    requiredFieldIds: ["p35.collection-field.source-identity", "p35.collection-field.locator", "p35.collection-field.storage-boundary", "p35.collection-field.topic-entity", "p35.collection-field.audit-review"],
    expectedOutputs: ["sourceRecord", "differenceSummary", "cleanedResult", "dynamicFlowReviewItem", "admissionDecision"],
    storageGuardrails: ["不复制软件截图和版式", "样例必须脱敏", "单一样例不能升为通用理论"],
    reviewGates: ["动态盘继承边界复核", "隐私脱敏复核", "样例重复碰撞复核"]
  }
]

export const ZIWEI_DATA_COLLECTION_EXECUTOR_PROFILE: ZiweiDataCollectionExecutorProfile = {
  executorId: "p35.collection-executor.ziwei-v1",
  domain: "ziwei",
  label: "紫微资料采集任务执行器 v1",
  stepKinds: [
    "load-batch",
    "register-source",
    "capture-fragment",
    "clean-fragment",
    "map-topic",
    "decide-admission",
    "route-review"
  ],
  consumes: [
    "ZIWEI_DATA_COLLECTION_FIELD_PROFILES",
    "ZIWEI_DATA_SOURCE_SEED_RECORDS",
    "ZIWEI_DATA_COLLECTION_BATCH_PLANS",
    "ZIWEI_DATA_SOURCE_STORAGE_BOUNDARY_PROFILES",
    "ZIWEI_DATA_CLEANING_PIPELINE_PROFILES"
  ],
  produces: [
    "sourceRecord",
    "rawFragment",
    "cleanedResult",
    "topicMapping",
    "admissionDecision",
    "reviewQueueItem"
  ],
  guardrails: [
    "执行器只生成采集任务和审计字段，不直接写入星曜、宫位、格局解释正文。",
    "metadata-only 来源只能采集元信息和项目自有摘要，禁止采集正文、截图、扫描图和排版。",
    "所有任务必须先过来源登记、存储边界、清洗、主题映射、入库门禁和复核队列。",
    "紫微任务只引用通用 content-intake 契约，后续八字接入时复用同一执行任务结构。"
  ],
  failureModes: [
    "来源种子缺失或 sourceKind 不匹配时阻断任务。",
    "批次字段不完整时阻断任务。",
    "采集字段命中 forbiddenCaptureFields 时阻断入库并进入复核。",
    "自动批次试图采集正文或受限影像时立即阻断。"
  ]
}

export const ZIWEI_DATA_COLLECTION_ADAPTER_PROFILES: ZiweiDataCollectionAdapterProfile[] = [
  {
    adapterId: "p35.collection-adapter.public-domain-text",
    domain: "ziwei",
    adapterKind: "public-domain-text",
    label: "公版古籍文本适配器",
    sourceKinds: ["classic-public-domain"],
    automationModes: ["assisted"],
    requestMode: "public-domain-text",
    allowedStoragePolicies: ["public-domain-text-and-summary"],
    produces: ["sourceRecord", "rawFragment", "cleanedResult"],
    guardrails: ["只处理已确认公版的古籍文本", "必须保留版本和篇目定位", "不得混入现代整理版正文"],
    blockedOperations: ["modern-book-fulltext", "copyrighted-scan", "unverified-transcription"]
  },
  {
    adapterId: "p35.collection-adapter.library-catalog-metadata",
    domain: "ziwei",
    adapterKind: "catalog-metadata",
    label: "馆藏目录元信息适配器",
    sourceKinds: ["university-library-catalog"],
    automationModes: ["automated"],
    requestMode: "metadata-only",
    allowedStoragePolicies: ["metadata-only"],
    produces: ["sourceRecord", "metadataOnlyResult", "reviewQueueItem"],
    guardrails: ["只采目录元信息", "不采扫描图", "不采受限影像和全文"],
    blockedOperations: ["scan-image-download", "fulltext-copy", "restricted-asset-capture"]
  },
  {
    adapterId: "p35.collection-adapter.modern-book-metadata",
    domain: "ziwei",
    adapterKind: "book-metadata",
    label: "现代书籍元信息适配器",
    sourceKinds: ["modern-book-metadata"],
    automationModes: ["automated"],
    requestMode: "metadata-only",
    allowedStoragePolicies: ["metadata-only"],
    produces: ["sourceRecord", "metadataOnlyResult", "reviewQueueItem"],
    guardrails: ["现代书籍暂不采正文", "只保留书名作者版本目录线索", "不得进入解释正文"],
    blockedOperations: ["book-body-copy", "chapter-transcription", "paid-content-capture"]
  },
  {
    adapterId: "p35.collection-adapter.website-own-summary",
    domain: "ziwei",
    adapterKind: "webpage-metadata",
    label: "网站主题自有摘要适配器",
    sourceKinds: ["website-metadata"],
    automationModes: ["assisted"],
    requestMode: "own-summary-only",
    allowedStoragePolicies: ["metadata-only", "original-summary-only"],
    produces: ["sourceRecord", "ownSummaryFragment", "cleanedResult", "reviewQueueItem"],
    guardrails: ["不存整篇网页正文", "只写项目自有摘要", "必须记录页面定位和访问时间"],
    blockedOperations: ["article-fulltext-copy", "page-screenshot", "paywalled-content-capture"]
  },
  {
    adapterId: "p35.collection-adapter.video-own-summary",
    domain: "ziwei",
    adapterKind: "video-metadata",
    label: "视频主题自有摘要适配器",
    sourceKinds: ["video-metadata"],
    automationModes: ["assisted"],
    requestMode: "own-summary-only",
    allowedStoragePolicies: ["metadata-only", "original-summary-only"],
    produces: ["sourceRecord", "ownSummaryFragment", "topicMapping", "reviewQueueItem"],
    guardrails: ["不存字幕全文", "不存课程讲义", "只记录时间点和项目自有摘要"],
    blockedOperations: ["subtitle-fulltext-copy", "video-frame-capture", "member-content-capture"]
  },
  {
    adapterId: "p35.collection-adapter.software-reference",
    domain: "ziwei",
    adapterKind: "software-reference",
    label: "排盘软件差异摘要适配器",
    sourceKinds: ["software-reference-metadata"],
    automationModes: ["manual"],
    requestMode: "metadata-only",
    allowedStoragePolicies: ["metadata-only"],
    produces: ["sourceRecord", "differenceSummary", "dynamicFlowReviewItem"],
    guardrails: ["不存截图", "不存图标商标", "只记录功能差异和复核结论"],
    blockedOperations: ["software-screenshot", "brand-asset-copy", "layout-reproduction"]
  },
  {
    adapterId: "p35.collection-adapter.manual-sample",
    domain: "ziwei",
    adapterKind: "manual-sample",
    label: "人工脱敏样例适配器",
    sourceKinds: ["manual-sample"],
    automationModes: ["manual"],
    requestMode: "manual-input-only",
    allowedStoragePolicies: ["user-owned-input"],
    produces: ["sourceRecord", "differenceSummary", "cleanedResult", "reviewQueueItem"],
    guardrails: ["样例必须脱敏", "只接收用户自有输入", "单一样例不能升为通用理论"],
    blockedOperations: ["third-party-case-copy", "personal-data-without-anonymization", "unlicensed-sample-import"]
  }
]

function resolveZiweiCollectionTaskStatus(
  batchStatus: ZiweiDataCollectionBatchStatus
): DestinyCollectionExecutionTaskStatus {
  if (batchStatus === "ready" || batchStatus === "running") {
    return "ready"
  }

  if (batchStatus === "closed") {
    return "completed"
  }

  if (batchStatus === "paused") {
    return "blocked"
  }

  return "queued"
}

function buildZiweiDataCollectionExecutionTasks(): ZiweiDataCollectionExecutionTaskRecord[] {
  const sourceSeedById = new Map(ZIWEI_DATA_SOURCE_SEED_RECORDS.map((seed) => [seed.seedId, seed]))

  return ZIWEI_DATA_COLLECTION_BATCH_PLANS.flatMap((batch) =>
    batch.sourceSeedIds.map((sourceSeedId) => {
      const seed = sourceSeedById.get(sourceSeedId)

      if (!seed) {
        throw new Error(`Missing ziwei collection source seed: ${sourceSeedId}`)
      }

      return {
        taskId: `${batch.batchId}.${seed.seedId.replace("p35.seed.", "task.")}`,
        domain: "ziwei",
        batchId: batch.batchId,
        sourceSeedId: seed.seedId,
        sourceKind: seed.sourceKind,
        automationMode: batch.automationMode,
        status: resolveZiweiCollectionTaskStatus(batch.status),
        stepKind: "register-source",
        nextStepKind: "capture-fragment",
        requiredFieldIds: batch.requiredFieldIds,
        allowedCaptureFields: seed.allowedCaptureFields,
        forbiddenCaptureFields: seed.forbiddenCaptureFields,
        expectedOutputs: batch.expectedOutputs,
        storageGuardrails: batch.storageGuardrails,
        reviewQueueId: seed.reviewQueueId,
        auditTrail: [
          `batch:${batch.batchId}`,
          `seed:${seed.seedId}`,
          `pipeline:${seed.handoffPipelineId}`,
          "must-pass:p35-a-to-p35-f"
        ]
      }
    })
  )
}

export const ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS: ZiweiDataCollectionExecutionTaskRecord[] =
  buildZiweiDataCollectionExecutionTasks()

function buildZiweiDataCollectionSourceRegistrationDrafts(): ZiweiDataCollectionSourceRegistrationDraft[] {
  const sourceSeedById = new Map(ZIWEI_DATA_SOURCE_SEED_RECORDS.map((seed) => [seed.seedId, seed]))

  return ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS.map((task) => {
    const seed = sourceSeedById.get(task.sourceSeedId)

    if (!seed) {
      throw new Error(`Missing ziwei collection source seed: ${task.sourceSeedId}`)
    }

    return {
      registrationId: `${task.taskId}.source-registration`,
      domain: "ziwei",
      taskId: task.taskId,
      sourceSeedId: seed.seedId,
      sourceKind: seed.sourceKind,
      locatorTemplate: seed.locatorTemplate,
      storagePolicy: seed.storagePolicy,
      requiredFieldIds: task.requiredFieldIds,
      allowedCaptureFields: task.allowedCaptureFields,
      forbiddenCaptureFields: task.forbiddenCaptureFields,
      status: "queued",
      auditTrail: [...task.auditTrail, "draft:source-registration"]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_SOURCE_REGISTRATION_DRAFTS: ZiweiDataCollectionSourceRegistrationDraft[] =
  buildZiweiDataCollectionSourceRegistrationDrafts()

function buildZiweiDataCollectionFragmentCaptureInputs(): ZiweiDataCollectionFragmentCaptureInput[] {
  const sourceSeedById = new Map(ZIWEI_DATA_SOURCE_SEED_RECORDS.map((seed) => [seed.seedId, seed]))

  return ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS.map((task) => {
    const seed = sourceSeedById.get(task.sourceSeedId)

    if (!seed) {
      throw new Error(`Missing ziwei collection source seed: ${task.sourceSeedId}`)
    }

    return {
      captureInputId: `${task.taskId}.fragment-capture`,
      domain: "ziwei",
      taskId: task.taskId,
      sourceRegistrationId: `${task.taskId}.source-registration`,
      captureStage: "fragment-capture",
      storagePolicy: seed.storagePolicy,
      topicTags: seed.topicTags,
      allowedCaptureFields: task.allowedCaptureFields,
      forbiddenCaptureFields: task.forbiddenCaptureFields,
      expectedEntityKinds: seed.expectedEntityKinds,
      guardrails: task.storageGuardrails
    }
  })
}

export const ZIWEI_DATA_COLLECTION_FRAGMENT_CAPTURE_INPUTS: ZiweiDataCollectionFragmentCaptureInput[] =
  buildZiweiDataCollectionFragmentCaptureInputs()

function buildZiweiDataCollectionCleaningInputDrafts(): ZiweiDataCollectionCleaningInputDraft[] {
  const sourceSeedById = new Map(ZIWEI_DATA_SOURCE_SEED_RECORDS.map((seed) => [seed.seedId, seed]))
  const dedupHintFields = ZIWEI_DATA_DEDUP_PROFILES.flatMap((profile) => profile.normalizedFields)
  const conflictCheckIds = ZIWEI_DATA_CONFLICT_SIGNAL_PROFILES.map((profile) => profile.signalId)

  return ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS.map((task) => {
    const seed = sourceSeedById.get(task.sourceSeedId)

    if (!seed) {
      throw new Error(`Missing ziwei collection source seed: ${task.sourceSeedId}`)
    }

    return {
      cleaningInputId: `${task.taskId}.cleaning-input`,
      domain: "ziwei",
      taskId: task.taskId,
      sourceRegistrationId: `${task.taskId}.source-registration`,
      captureInputId: `${task.taskId}.fragment-capture`,
      pipelineId: seed.handoffPipelineId,
      sourceKind: seed.sourceKind,
      topicTags: seed.topicTags,
      normalizedFieldTargets: task.requiredFieldIds,
      dedupHintFields: Array.from(new Set(dedupHintFields)),
      conflictCheckIds,
      expectedOutputs: task.expectedOutputs
    }
  })
}

export const ZIWEI_DATA_COLLECTION_CLEANING_INPUT_DRAFTS: ZiweiDataCollectionCleaningInputDraft[] =
  buildZiweiDataCollectionCleaningInputDrafts()

function buildZiweiDataCollectionReviewQueueItemDrafts(): ZiweiDataCollectionReviewQueueItemDraft[] {
  const sourceSeedById = new Map(ZIWEI_DATA_SOURCE_SEED_RECORDS.map((seed) => [seed.seedId, seed]))
  const batchById = new Map(ZIWEI_DATA_COLLECTION_BATCH_PLANS.map((batch) => [batch.batchId, batch]))

  return ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS.flatMap((task) => {
    if (!task.reviewQueueId) {
      return []
    }

    const seed = sourceSeedById.get(task.sourceSeedId)
    const batch = batchById.get(task.batchId)

    if (!seed || !batch) {
      throw new Error(`Missing ziwei collection review source or batch for task: ${task.taskId}`)
    }

    return [
      {
        reviewItemId: `${task.taskId}.review-item`,
        domain: "ziwei",
        taskId: task.taskId,
        reviewQueueId: task.reviewQueueId,
        sourceKind: seed.sourceKind,
        trigger: task.status === "queued" ? "batch-not-ready" : "post-cleaning-gate",
        requiredReviewFields: task.requiredFieldIds,
        promotionCriteria: batch.reviewGates,
        blockingSignals: task.forbiddenCaptureFields,
        auditTrail: [...task.auditTrail, `review:${task.reviewQueueId}`]
      }
    ]
  })
}

export const ZIWEI_DATA_COLLECTION_REVIEW_QUEUE_ITEM_DRAFTS: ZiweiDataCollectionReviewQueueItemDraft[] =
  buildZiweiDataCollectionReviewQueueItemDrafts()

function buildZiweiDataCollectionJobDrafts(): ZiweiDataCollectionJobDraft[] {
  const adapterBySourceKind = new Map(
    ZIWEI_DATA_COLLECTION_ADAPTER_PROFILES.flatMap((adapter) =>
      adapter.sourceKinds.map((sourceKind) => [sourceKind, adapter] as const)
    )
  )
  const registrationByTaskId = new Map(ZIWEI_DATA_COLLECTION_SOURCE_REGISTRATION_DRAFTS.map((item) => [item.taskId, item]))
  const captureInputByTaskId = new Map(ZIWEI_DATA_COLLECTION_FRAGMENT_CAPTURE_INPUTS.map((item) => [item.taskId, item]))
  const cleaningInputByTaskId = new Map(ZIWEI_DATA_COLLECTION_CLEANING_INPUT_DRAFTS.map((item) => [item.taskId, item]))

  return ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS.map((task) => {
    const adapter = adapterBySourceKind.get(task.sourceKind)
    const registration = registrationByTaskId.get(task.taskId)
    const captureInput = captureInputByTaskId.get(task.taskId)
    const cleaningInput = cleaningInputByTaskId.get(task.taskId)

    if (!adapter || !registration || !captureInput || !cleaningInput) {
      throw new Error(`Missing ziwei collection job dependency for task: ${task.taskId}`)
    }

    const blockReasons = [
      ...(adapter.allowedStoragePolicies.includes(registration.storagePolicy) ? [] : ["storage-policy-not-allowed"]),
      ...(task.status === "blocked" ? ["task-blocked"] : []),
      ...(task.status === "completed" ? ["task-already-completed"] : [])
    ]

    return {
      jobId: `${task.taskId}.collection-job`,
      domain: "ziwei",
      adapterId: adapter.adapterId,
      adapterKind: adapter.adapterKind,
      taskId: task.taskId,
      sourceRegistrationId: registration.registrationId,
      captureInputId: captureInput.captureInputId,
      cleaningInputId: cleaningInput.cleaningInputId,
      sourceKind: task.sourceKind,
      storagePolicy: registration.storagePolicy,
      requestMode: adapter.requestMode,
      locatorTemplate: registration.locatorTemplate,
      allowedCaptureFields: captureInput.allowedCaptureFields,
      forbiddenCaptureFields: captureInput.forbiddenCaptureFields,
      expectedOutputs: task.expectedOutputs,
      guardrails: [...adapter.guardrails, ...task.storageGuardrails],
      reviewQueueId: task.reviewQueueId,
      status: blockReasons.length > 0 ? "blocked" : task.status === "ready" ? "ready" : "draft",
      blockReasons,
      auditTrail: [...task.auditTrail, `adapter:${adapter.adapterId}`, `request-mode:${adapter.requestMode}`]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_JOB_DRAFTS: ZiweiDataCollectionJobDraft[] =
  buildZiweiDataCollectionJobDrafts()

function buildZiweiDataCollectionRunBatches(): ZiweiDataCollectionRunBatchRecord[] {
  const readyJobIds = ZIWEI_DATA_COLLECTION_JOB_DRAFTS.filter((job) => job.status === "ready").map((job) => job.jobId)
  const draftJobIds = ZIWEI_DATA_COLLECTION_JOB_DRAFTS.filter((job) => job.status === "draft").map((job) => job.jobId)
  const blockedJobIds = ZIWEI_DATA_COLLECTION_JOB_DRAFTS.filter((job) => job.status === "blocked").map((job) => job.jobId)

  return [
    {
      runBatchId: "p35.collection-run.ziwei-v1",
      domain: "ziwei",
      label: "紫微资料采集运行批次 v1",
      jobIds: ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => job.jobId),
      readyJobIds,
      draftJobIds,
      blockedJobIds,
      status: blockedJobIds.length > 0 ? "blocked" : draftJobIds.length > 0 ? "partial-ready" : "ready",
      guardrails: [
        "运行器只执行 job 草案，不直接写入解释正文。",
        "metadata-only job 禁止采集正文、扫描图、截图、受限影像和软件版式。",
        "own-summary-only job 只能输出项目自有摘要。",
        "所有输出必须继续进入清洗、主题映射、入库门禁和复核。"
      ],
      nextAction: "ready job 可交给适配器执行；draft job 等待对应批次转为 ready。",
      auditTrail: ["executor:p35.collection-executor.ziwei-v1", "jobs:7", "runner:no-network-side-effect"]
    }
  ]
}

export const ZIWEI_DATA_COLLECTION_RUN_BATCHES: ZiweiDataCollectionRunBatchRecord[] =
  buildZiweiDataCollectionRunBatches()

function resolveZiweiRunResultStatus(jobStatus: ZiweiDataCollectionJobDraft["status"]): ZiweiDataCollectionJobRunResultDraft["status"] {
  if (jobStatus === "ready") {
    return "ready-to-run"
  }

  if (jobStatus === "blocked") {
    return "blocked"
  }

  return "waiting"
}

function buildZiweiDataCollectionRunResultDrafts(): ZiweiDataCollectionJobRunResultDraft[] {
  const runBatch = ZIWEI_DATA_COLLECTION_RUN_BATCHES[0]

  return ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => ({
    runResultId: `${job.jobId}.run-result`,
    domain: "ziwei",
    runBatchId: runBatch.runBatchId,
    jobId: job.jobId,
    adapterId: job.adapterId,
    requestMode: job.requestMode,
    status: resolveZiweiRunResultStatus(job.status),
    producedDraftRefs: [
      job.sourceRegistrationId,
      job.captureInputId,
      job.cleaningInputId,
      ...(job.reviewQueueId ? [job.reviewQueueId] : [])
    ],
    expectedOutputs: job.expectedOutputs,
    nextAction: job.status === "ready" ? "execute-adapter" : job.status === "blocked" ? "resolve-block" : "wait-for-batch-ready",
    auditTrail: [...job.auditTrail, `run-batch:${runBatch.runBatchId}`]
  }))
}

export const ZIWEI_DATA_COLLECTION_RUN_RESULT_DRAFTS: ZiweiDataCollectionJobRunResultDraft[] =
  buildZiweiDataCollectionRunResultDrafts()

function buildZiweiDataCollectionJobBlockRecords(): ZiweiDataCollectionJobBlockRecord[] {
  const runBatch = ZIWEI_DATA_COLLECTION_RUN_BATCHES[0]
  const adapterById = new Map(ZIWEI_DATA_COLLECTION_ADAPTER_PROFILES.map((adapter) => [adapter.adapterId, adapter]))

  return ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => {
    const adapter = adapterById.get(job.adapterId)

    if (!adapter) {
      throw new Error(`Missing ziwei collection adapter for job: ${job.jobId}`)
    }

    return {
      blockRecordId: `${job.jobId}.block-record`,
      domain: "ziwei",
      runBatchId: runBatch.runBatchId,
      jobId: job.jobId,
      status: job.blockReasons.length > 0 ? "blocked" : "clear",
      sourceKind: job.sourceKind,
      requestMode: job.requestMode,
      blockReasons: job.blockReasons,
      blockedOperations: adapter.blockedOperations,
      forbiddenCaptureFields: job.forbiddenCaptureFields,
      resolutionPath: job.blockReasons.length > 0
        ? ["修正来源种子或适配器存储策略", "重新生成 job 草案", "重新进入 P35 检查"]
        : ["无阻断，继续按 job 状态等待或执行"],
      auditTrail: [...job.auditTrail, `block-check:${adapter.adapterId}`]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_JOB_BLOCK_RECORDS: ZiweiDataCollectionJobBlockRecord[] =
  buildZiweiDataCollectionJobBlockRecords()

function buildZiweiDataCollectionAuditRecords(): ZiweiDataCollectionAuditRecord[] {
  const runBatch = ZIWEI_DATA_COLLECTION_RUN_BATCHES[0]
  const batchAudit: ZiweiDataCollectionAuditRecord = {
    auditRecordId: `${runBatch.runBatchId}.audit`,
    domain: "ziwei",
    runBatchId: runBatch.runBatchId,
    subjectKind: "run-batch",
    subjectId: runBatch.runBatchId,
    passedChecks: ["job-count", "ready-draft-split", "no-network-side-effect", "guardrails-present"],
    failedChecks: runBatch.blockedJobIds.length > 0 ? ["blocked-jobs-present"] : [],
    outputRefs: [runBatch.runBatchId],
    auditTrail: runBatch.auditTrail
  }

  const jobAudits = ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job): ZiweiDataCollectionAuditRecord => ({
    auditRecordId: `${job.jobId}.audit`,
    domain: "ziwei",
    runBatchId: runBatch.runBatchId,
    subjectKind: "collection-job",
    subjectId: job.jobId,
    passedChecks: ["adapter-bound", "source-registration-bound", "capture-input-bound", "cleaning-input-bound", "forbidden-fields-kept"],
    failedChecks: job.blockReasons,
    outputRefs: [job.sourceRegistrationId, job.captureInputId, job.cleaningInputId],
    auditTrail: job.auditTrail
  }))

  return [batchAudit, ...jobAudits]
}

export const ZIWEI_DATA_COLLECTION_AUDIT_RECORDS: ZiweiDataCollectionAuditRecord[] =
  buildZiweiDataCollectionAuditRecords()

function resolveZiweiLandingCandidateStatus(
  runResultStatus: ZiweiDataCollectionJobRunResultDraft["status"]
): DestinyCollectionLandingCandidateStatus {
  if (runResultStatus === "ready-to-run" || runResultStatus === "completed") {
    return "candidate-ready"
  }

  if (runResultStatus === "blocked") {
    return "blocked"
  }

  return "waiting-for-run"
}

function buildZiweiDataCollectionSourceResultCandidates(): ZiweiDataCollectionSourceResultCandidate[] {
  const jobById = new Map(ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => [job.jobId, job]))

  return ZIWEI_DATA_COLLECTION_RUN_RESULT_DRAFTS.map((runResult) => {
    const job = jobById.get(runResult.jobId)

    if (!job) {
      throw new Error(`Missing ziwei collection job for run result: ${runResult.runResultId}`)
    }

    return {
      sourceResultId: `${runResult.jobId}.source-result`,
      domain: "ziwei",
      runResultId: runResult.runResultId,
      jobId: job.jobId,
      sourceRegistrationId: job.sourceRegistrationId,
      sourceKind: job.sourceKind,
      locatorTemplate: job.locatorTemplate,
      storagePolicy: job.storagePolicy,
      status: resolveZiweiLandingCandidateStatus(runResult.status),
      auditTrail: [...runResult.auditTrail, "landing:source-result"]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_SOURCE_RESULT_CANDIDATES: ZiweiDataCollectionSourceResultCandidate[] =
  buildZiweiDataCollectionSourceResultCandidates()

function buildZiweiDataCollectionFragmentResultCandidates(): ZiweiDataCollectionFragmentResultCandidate[] {
  const sourceResultByJobId = new Map(ZIWEI_DATA_COLLECTION_SOURCE_RESULT_CANDIDATES.map((item) => [item.jobId, item]))
  const captureInputById = new Map(ZIWEI_DATA_COLLECTION_FRAGMENT_CAPTURE_INPUTS.map((item) => [item.captureInputId, item]))

  return ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => {
    const sourceResult = sourceResultByJobId.get(job.jobId)
    const captureInput = captureInputById.get(job.captureInputId)

    if (!sourceResult || !captureInput) {
      throw new Error(`Missing ziwei fragment result dependency for job: ${job.jobId}`)
    }

    return {
      fragmentResultId: `${job.jobId}.fragment-result`,
      domain: "ziwei",
      sourceResultId: sourceResult.sourceResultId,
      captureInputId: captureInput.captureInputId,
      storagePolicy: job.storagePolicy,
      topicTags: captureInput.topicTags,
      allowedCaptureFields: captureInput.allowedCaptureFields,
      forbiddenCaptureFields: captureInput.forbiddenCaptureFields,
      status: sourceResult.status,
      auditTrail: [...sourceResult.auditTrail, "landing:fragment-result"]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_FRAGMENT_RESULT_CANDIDATES: ZiweiDataCollectionFragmentResultCandidate[] =
  buildZiweiDataCollectionFragmentResultCandidates()

function buildZiweiDataCollectionCleanedResultCandidates(): ZiweiDataCollectionCleanedResultCandidate[] {
  const fragmentResultByJobId = new Map(
    ZIWEI_DATA_COLLECTION_FRAGMENT_RESULT_CANDIDATES.map((item) => [item.fragmentResultId.replace(".fragment-result", ""), item])
  )
  const cleaningInputById = new Map(ZIWEI_DATA_COLLECTION_CLEANING_INPUT_DRAFTS.map((item) => [item.cleaningInputId, item]))

  return ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => {
    const fragmentResult = fragmentResultByJobId.get(job.jobId)
    const cleaningInput = cleaningInputById.get(job.cleaningInputId)

    if (!fragmentResult || !cleaningInput) {
      throw new Error(`Missing ziwei cleaned result dependency for job: ${job.jobId}`)
    }

    return {
      cleanedCandidateId: `${job.jobId}.cleaned-candidate`,
      domain: "ziwei",
      fragmentResultId: fragmentResult.fragmentResultId,
      cleaningInputId: cleaningInput.cleaningInputId,
      pipelineId: cleaningInput.pipelineId,
      sourceKind: job.sourceKind,
      topicTags: cleaningInput.topicTags,
      dedupHintFields: cleaningInput.dedupHintFields,
      conflictCheckIds: cleaningInput.conflictCheckIds,
      expectedOutputs: cleaningInput.expectedOutputs,
      status: fragmentResult.status,
      auditTrail: [...fragmentResult.auditTrail, `pipeline:${cleaningInput.pipelineId}`, "landing:cleaned-candidate"]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_CLEANED_RESULT_CANDIDATES: ZiweiDataCollectionCleanedResultCandidate[] =
  buildZiweiDataCollectionCleanedResultCandidates()

function buildZiweiDataCollectionTopicMappingCandidates(): ZiweiDataCollectionTopicMappingCandidate[] {
  return ZIWEI_DATA_COLLECTION_CLEANED_RESULT_CANDIDATES.map((candidate) => {
    const targetDictionaryLayers = Array.from(new Set(
      ZIWEI_DATA_DICTIONARY_TOPIC_MAPPING_PROFILES
        .filter((profile) => candidate.topicTags.includes(profile.topicTag))
        .map((profile) => profile.targetDictionaryLayer)
    ))

    return {
      topicMappingCandidateId: `${candidate.cleanedCandidateId}.topic-mapping`,
      domain: "ziwei",
      cleanedCandidateId: candidate.cleanedCandidateId,
      topicTags: candidate.topicTags,
      targetDictionaryLayers,
      sourceTraceRefs: [candidate.fragmentResultId, candidate.cleaningInputId],
      status: candidate.status,
      auditTrail: [...candidate.auditTrail, "landing:topic-mapping-candidate"]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_TOPIC_MAPPING_CANDIDATES: ZiweiDataCollectionTopicMappingCandidate[] =
  buildZiweiDataCollectionTopicMappingCandidates()

function resolveZiweiAdmissionStatus(job: ZiweiDataCollectionJobDraft): DestinyDictionaryAdmissionStatus {
  if (job.status === "blocked") {
    return "rejected"
  }

  if (job.storagePolicy === "metadata-only") {
    return "metadata-only"
  }

  if (job.reviewQueueId) {
    return "review-required"
  }

  return "admitted"
}

function buildZiweiDataCollectionAdmissionDecisionCandidates(): ZiweiDataCollectionAdmissionDecisionCandidate[] {
  const jobByCleanedCandidateId = new Map(
    ZIWEI_DATA_COLLECTION_JOB_DRAFTS.map((job) => [`${job.jobId}.cleaned-candidate`, job])
  )
  const topicMappingByCleanedCandidateId = new Map(
    ZIWEI_DATA_COLLECTION_TOPIC_MAPPING_CANDIDATES.map((item) => [item.cleanedCandidateId, item])
  )

  return ZIWEI_DATA_COLLECTION_CLEANED_RESULT_CANDIDATES.map((candidate) => {
    const job = jobByCleanedCandidateId.get(candidate.cleanedCandidateId)
    const topicMapping = topicMappingByCleanedCandidateId.get(candidate.cleanedCandidateId)

    if (!job || !topicMapping) {
      throw new Error(`Missing ziwei admission dependency for candidate: ${candidate.cleanedCandidateId}`)
    }

    const admissionStatus = resolveZiweiAdmissionStatus(job)

    return {
      admissionCandidateId: `${candidate.cleanedCandidateId}.admission`,
      domain: "ziwei",
      cleanedCandidateId: candidate.cleanedCandidateId,
      topicMappingCandidateId: topicMapping.topicMappingCandidateId,
      admissionStatus,
      targetDictionaryLayer: admissionStatus === "admitted" || admissionStatus === "review-required"
        ? topicMapping.targetDictionaryLayers[0] ?? null
        : null,
      requiredReviewQueueId: job.reviewQueueId,
      status: candidate.status,
      nextAction: candidate.status === "candidate-ready"
        ? "run-admission-policy"
        : candidate.status === "blocked"
          ? "resolve-block-before-admission"
          : "wait-for-run-before-admission",
      auditTrail: [...topicMapping.auditTrail, `admission:${admissionStatus}`]
    }
  })
}

export const ZIWEI_DATA_COLLECTION_ADMISSION_DECISION_CANDIDATES: ZiweiDataCollectionAdmissionDecisionCandidate[] =
  buildZiweiDataCollectionAdmissionDecisionCandidates()

function buildZiweiDataCollectionReviewRouteCandidates(): ZiweiDataCollectionReviewRouteCandidate[] {
  return ZIWEI_DATA_COLLECTION_ADMISSION_DECISION_CANDIDATES.map((candidate) => ({
    reviewRouteCandidateId: `${candidate.admissionCandidateId}.review-route`,
    domain: "ziwei",
    admissionCandidateId: candidate.admissionCandidateId,
    reviewRequired: Boolean(candidate.requiredReviewQueueId) || candidate.admissionStatus === "review-required",
    reviewQueueId: candidate.requiredReviewQueueId,
    reason: candidate.requiredReviewQueueId
      ? "candidate-has-review-queue"
      : candidate.admissionStatus === "metadata-only"
        ? "metadata-only-no-dictionary-body"
        : "no-review-required-before-final-admission-check",
    status: candidate.status,
    auditTrail: [...candidate.auditTrail, "landing:review-route-candidate"]
  }))
}

export const ZIWEI_DATA_COLLECTION_REVIEW_ROUTE_CANDIDATES: ZiweiDataCollectionReviewRouteCandidate[] =
  buildZiweiDataCollectionReviewRouteCandidates()

export const ZIWEI_DATA_COLLECTION_PROMOTION_GATE_PROFILES: ZiweiDataCollectionPromotionGateProfile[] = [
  {
    gateId: "p35.collection-promotion-gate.source-result",
    domain: "ziwei",
    targetKind: "source-result",
    label: "来源登记结果晋级门禁",
    acceptedCandidateStatuses: ["candidate-ready"],
    acceptedAdmissionStatuses: ["admitted", "metadata-only", "review-required"],
    requiredEvidenceRefs: ["sourceRegistrationId", "locatorTemplate", "storagePolicy", "sourceKind"],
    promotionRules: ["来源定位可回查", "存储策略明确", "sourceKind 与来源种子一致"],
    blockingRules: ["来源不明", "存储策略为空", "现代资料试图写入正文"],
    outputs: ["sourceRecordCandidate", "sourceTraceRef", "auditTrail"]
  },
  {
    gateId: "p35.collection-promotion-gate.fragment-result",
    domain: "ziwei",
    targetKind: "fragment-result",
    label: "片段结果晋级门禁",
    acceptedCandidateStatuses: ["candidate-ready"],
    acceptedAdmissionStatuses: ["admitted", "metadata-only", "review-required"],
    requiredEvidenceRefs: ["fragmentResultId", "allowedCaptureFields", "forbiddenCaptureFields", "topicTags"],
    promotionRules: ["只包含允许字段", "禁采字段保留审计", "主题标签可筛选"],
    blockingRules: ["正文或截图进入 metadata-only 片段", "禁采字段丢失", "主题标签为空"],
    outputs: ["fragmentRecordCandidate", "captureBoundaryAudit", "topicTags"]
  },
  {
    gateId: "p35.collection-promotion-gate.cleaned-result",
    domain: "ziwei",
    targetKind: "cleaned-result",
    label: "清洗结果晋级门禁",
    acceptedCandidateStatuses: ["candidate-ready"],
    acceptedAdmissionStatuses: ["admitted", "review-required"],
    requiredEvidenceRefs: ["cleaningInputId", "pipelineId", "dedupHintFields", "conflictCheckIds"],
    promotionRules: ["清洗 pipeline 明确", "去重字段齐全", "冲突信号已检查"],
    blockingRules: ["metadata-only 不生成解释正文清洗结果", "去重字段为空", "冲突检查缺失"],
    outputs: ["cleanedResultCandidate", "dedupAudit", "conflictAudit"]
  },
  {
    gateId: "p35.collection-promotion-gate.topic-mapping",
    domain: "ziwei",
    targetKind: "topic-mapping",
    label: "主题映射晋级门禁",
    acceptedCandidateStatuses: ["candidate-ready"],
    acceptedAdmissionStatuses: ["admitted", "review-required"],
    requiredEvidenceRefs: ["topicMappingCandidateId", "targetDictionaryLayers", "sourceTraceRefs"],
    promotionRules: ["目标字典层明确", "sourceTraceRefs 可回查", "不覆盖硬规则"],
    blockingRules: ["metadata-only 不进入解释主题正文", "目标字典层为空", "来源追踪缺失"],
    outputs: ["topicMappingRecordCandidate", "targetDictionaryLayer", "sourceTraceRefs"]
  },
  {
    gateId: "p35.collection-promotion-gate.admission-decision",
    domain: "ziwei",
    targetKind: "admission-decision",
    label: "入库决策晋级门禁",
    acceptedCandidateStatuses: ["candidate-ready"],
    acceptedAdmissionStatuses: ["admitted", "metadata-only", "review-required", "rejected"],
    requiredEvidenceRefs: ["admissionCandidateId", "admissionStatus", "targetDictionaryLayer", "requiredReviewQueueId"],
    promotionRules: ["admitted 必须有目标字典层", "metadata-only 不能有正文目标层", "review-required 必须有复核路径"],
    blockingRules: ["admissionStatus 不明确", "rejected 不能晋级", "review-required 缺少复核队列"],
    outputs: ["admissionDecisionCandidate", "nextAction", "auditTrail"]
  },
  {
    gateId: "p35.collection-promotion-gate.review-route",
    domain: "ziwei",
    targetKind: "review-route",
    label: "复核路由晋级门禁",
    acceptedCandidateStatuses: ["candidate-ready", "waiting-for-run"],
    acceptedAdmissionStatuses: ["metadata-only", "review-required"],
    requiredEvidenceRefs: ["reviewRouteCandidateId", "reviewRequired", "reviewQueueId", "reason"],
    promotionRules: ["review-required 必须进入复核队列", "metadata-only 保留审计路由", "等待运行的候选不得进入正式字典"],
    blockingRules: ["复核队列缺失", "等待运行候选试图晋级正文", "复核原因为空"],
    outputs: ["reviewRouteRecordCandidate", "reviewQueueId", "reason"]
  }
]

function resolveZiweiPromotionDecision(
  candidateStatus: DestinyCollectionLandingCandidateStatus,
  admissionStatus: DestinyDictionaryAdmissionStatus,
  reviewRequired: boolean
): DestinyCollectionPromotionDecision {
  if (candidateStatus === "waiting-for-run") {
    return "wait"
  }

  if (candidateStatus === "blocked" || admissionStatus === "rejected") {
    return "reject"
  }

  if (admissionStatus === "metadata-only") {
    return "metadata-only"
  }

  if (reviewRequired || admissionStatus === "review-required") {
    return "review-required"
  }

  return "promote"
}

function resolveZiweiPromotionNextAction(decision: DestinyCollectionPromotionDecision): string {
  if (decision === "promote") {
    return "promote-to-dictionary-record"
  }

  if (decision === "metadata-only") {
    return "keep-metadata-only-and-hide-from-dictionary-body"
  }

  if (decision === "review-required") {
    return "route-to-review-before-promotion"
  }

  if (decision === "reject") {
    return "reject-and-keep-audit-only"
  }

  return "wait-for-run-or-candidate-ready"
}

function buildZiweiDataCollectionPromotionDecisionRecords(): ZiweiDataCollectionPromotionDecisionRecord[] {
  const sourceResultById = new Map(ZIWEI_DATA_COLLECTION_SOURCE_RESULT_CANDIDATES.map((item) => [item.sourceResultId, item]))
  const fragmentResultById = new Map(ZIWEI_DATA_COLLECTION_FRAGMENT_RESULT_CANDIDATES.map((item) => [item.fragmentResultId, item]))
  const cleanedCandidateById = new Map(ZIWEI_DATA_COLLECTION_CLEANED_RESULT_CANDIDATES.map((item) => [item.cleanedCandidateId, item]))
  const topicMappingByCleanedId = new Map(ZIWEI_DATA_COLLECTION_TOPIC_MAPPING_CANDIDATES.map((item) => [item.cleanedCandidateId, item]))
  const admissionByCleanedId = new Map(ZIWEI_DATA_COLLECTION_ADMISSION_DECISION_CANDIDATES.map((item) => [item.cleanedCandidateId, item]))
  const reviewRouteByAdmissionId = new Map(ZIWEI_DATA_COLLECTION_REVIEW_ROUTE_CANDIDATES.map((item) => [item.admissionCandidateId, item]))
  const gateByTargetKind = new Map(ZIWEI_DATA_COLLECTION_PROMOTION_GATE_PROFILES.map((gate) => [gate.targetKind, gate]))

  return ZIWEI_DATA_COLLECTION_JOB_DRAFTS.flatMap((job) => {
    const sourceResult = sourceResultById.get(`${job.jobId}.source-result`)
    const fragmentResult = fragmentResultById.get(`${job.jobId}.fragment-result`)
    const cleanedCandidate = cleanedCandidateById.get(`${job.jobId}.cleaned-candidate`)

    if (!sourceResult || !fragmentResult || !cleanedCandidate) {
      throw new Error(`Missing ziwei promotion candidate chain for job: ${job.jobId}`)
    }

    const topicMapping = topicMappingByCleanedId.get(cleanedCandidate.cleanedCandidateId)
    const admission = admissionByCleanedId.get(cleanedCandidate.cleanedCandidateId)

    if (!topicMapping || !admission) {
      throw new Error(`Missing ziwei promotion admission chain for job: ${job.jobId}`)
    }

    const reviewRoute = reviewRouteByAdmissionId.get(admission.admissionCandidateId)

    if (!reviewRoute) {
      throw new Error(`Missing ziwei promotion review route for job: ${job.jobId}`)
    }

    const candidateRows: Array<{
      targetKind: DestinyCollectionPromotionTargetKind
      candidateId: string
      candidateStatus: DestinyCollectionLandingCandidateStatus
      auditTrail: string[]
    }> = [
      {
        targetKind: "source-result",
        candidateId: sourceResult.sourceResultId,
        candidateStatus: sourceResult.status,
        auditTrail: sourceResult.auditTrail
      },
      {
        targetKind: "fragment-result",
        candidateId: fragmentResult.fragmentResultId,
        candidateStatus: fragmentResult.status,
        auditTrail: fragmentResult.auditTrail
      },
      {
        targetKind: "cleaned-result",
        candidateId: cleanedCandidate.cleanedCandidateId,
        candidateStatus: cleanedCandidate.status,
        auditTrail: cleanedCandidate.auditTrail
      },
      {
        targetKind: "topic-mapping",
        candidateId: topicMapping.topicMappingCandidateId,
        candidateStatus: topicMapping.status,
        auditTrail: topicMapping.auditTrail
      },
      {
        targetKind: "admission-decision",
        candidateId: admission.admissionCandidateId,
        candidateStatus: admission.status,
        auditTrail: admission.auditTrail
      },
      {
        targetKind: "review-route",
        candidateId: reviewRoute.reviewRouteCandidateId,
        candidateStatus: reviewRoute.status,
        auditTrail: reviewRoute.auditTrail
      }
    ]

    return candidateRows.map((row) => {
      const gate = gateByTargetKind.get(row.targetKind)

      if (!gate) {
        throw new Error(`Missing ziwei promotion gate for target: ${row.targetKind}`)
      }

      const decision = resolveZiweiPromotionDecision(row.candidateStatus, admission.admissionStatus, reviewRoute.reviewRequired)
      const promotedRecordRefs = decision === "promote" || decision === "metadata-only" ? [row.candidateId] : []

      return {
        promotionDecisionId: `${row.candidateId}.promotion-decision`,
        domain: "ziwei",
        gateId: gate.gateId,
        targetKind: row.targetKind,
        candidateId: row.candidateId,
        decision,
        admissionStatus: admission.admissionStatus,
        sourceKind: job.sourceKind,
        targetDictionaryLayer: decision === "promote" ? admission.targetDictionaryLayer : null,
        reviewQueueId: admission.requiredReviewQueueId,
        promotedRecordRefs,
        blockedReason: decision === "reject"
          ? "candidate-blocked-or-rejected"
          : decision === "wait"
            ? "candidate-waiting-for-run"
            : decision === "metadata-only"
              ? "metadata-only-no-dictionary-body"
              : decision === "review-required"
                ? "review-required-before-promotion"
                : null,
        nextAction: resolveZiweiPromotionNextAction(decision),
        auditTrail: [...row.auditTrail, `promotion-gate:${gate.gateId}`, `promotion-decision:${decision}`]
      }
    })
  })
}

export const ZIWEI_DATA_COLLECTION_PROMOTION_DECISION_RECORDS: ZiweiDataCollectionPromotionDecisionRecord[] =
  buildZiweiDataCollectionPromotionDecisionRecords()

export function getAllZiweiDataIntakeStagePlans(): ZiweiDataIntakeStagePlan[] {
  return ZIWEI_DATA_INTAKE_STAGE_PLANS
}

export function getAllZiweiDataIntakeClosureReports(): ZiweiDataIntakeClosureReport[] {
  return ZIWEI_DATA_INTAKE_CLOSURE_REPORTS
}

export function getAllZiweiExternalDataSourceRecords(): ZiweiExternalDataSourceRecord[] {
  return ZIWEI_EXTERNAL_DATA_SOURCE_REGISTRY
}

export function getAllZiweiRawIntakeFragmentSlots(): ZiweiRawIntakeFragmentRecord[] {
  return ZIWEI_RAW_INTAKE_FRAGMENT_SLOTS
}

export function getAllZiweiDataTopicMappings(): ZiweiDataTopicMappingRecord[] {
  return ZIWEI_DATA_TOPIC_MAPPINGS
}

export function getAllZiweiDataDictionaryTopicMappingProfiles(): ZiweiDataDictionaryTopicMappingProfile[] {
  return ZIWEI_DATA_DICTIONARY_TOPIC_MAPPING_PROFILES
}

export function getAllZiweiDataUsabilityScoreRules(): ZiweiDataUsabilityScoreRule[] {
  return ZIWEI_DATA_USABILITY_SCORE_RULES
}

export function getAllZiweiDataDictionaryAdmissionPolicyProfiles(): ZiweiDataDictionaryAdmissionPolicyProfile[] {
  return ZIWEI_DATA_DICTIONARY_ADMISSION_POLICY_PROFILES
}

export function getAllZiweiDataDictionaryAdmissionDecisionRecords(): ZiweiDataDictionaryAdmissionDecisionRecord[] {
  return ZIWEI_DATA_DICTIONARY_ADMISSION_DECISION_RECORDS
}

export function getAllZiweiDataAnalysisUsageProfiles(): ZiweiDataAnalysisUsageProfile[] {
  return ZIWEI_DATA_ANALYSIS_USAGE_PROFILES
}

export function getAllZiweiDataCollectionFieldProfiles(): ZiweiDataCollectionFieldProfile[] {
  return ZIWEI_DATA_COLLECTION_FIELD_PROFILES
}

export function getAllZiweiDataSourceSeedRecords(): ZiweiDataSourceSeedRecord[] {
  return ZIWEI_DATA_SOURCE_SEED_RECORDS
}

export function getAllZiweiDataCollectionBatchPlans(): ZiweiDataCollectionBatchPlan[] {
  return ZIWEI_DATA_COLLECTION_BATCH_PLANS
}

export function getAllZiweiDataCollectionAdapterProfiles(): ZiweiDataCollectionAdapterProfile[] {
  return ZIWEI_DATA_COLLECTION_ADAPTER_PROFILES
}

export function getZiweiDataCollectionExecutorProfile(): ZiweiDataCollectionExecutorProfile {
  return ZIWEI_DATA_COLLECTION_EXECUTOR_PROFILE
}

export function getAllZiweiDataCollectionExecutionTaskRecords(): ZiweiDataCollectionExecutionTaskRecord[] {
  return ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS
}

export function getAllZiweiDataCollectionSourceRegistrationDrafts(): ZiweiDataCollectionSourceRegistrationDraft[] {
  return ZIWEI_DATA_COLLECTION_SOURCE_REGISTRATION_DRAFTS
}

export function getAllZiweiDataCollectionFragmentCaptureInputs(): ZiweiDataCollectionFragmentCaptureInput[] {
  return ZIWEI_DATA_COLLECTION_FRAGMENT_CAPTURE_INPUTS
}

export function getAllZiweiDataCollectionCleaningInputDrafts(): ZiweiDataCollectionCleaningInputDraft[] {
  return ZIWEI_DATA_COLLECTION_CLEANING_INPUT_DRAFTS
}

export function getAllZiweiDataCollectionReviewQueueItemDrafts(): ZiweiDataCollectionReviewQueueItemDraft[] {
  return ZIWEI_DATA_COLLECTION_REVIEW_QUEUE_ITEM_DRAFTS
}

export function getAllZiweiDataCollectionJobDrafts(): ZiweiDataCollectionJobDraft[] {
  return ZIWEI_DATA_COLLECTION_JOB_DRAFTS
}

export function getAllZiweiDataCollectionRunBatches(): ZiweiDataCollectionRunBatchRecord[] {
  return ZIWEI_DATA_COLLECTION_RUN_BATCHES
}

export function getAllZiweiDataCollectionRunResultDrafts(): ZiweiDataCollectionJobRunResultDraft[] {
  return ZIWEI_DATA_COLLECTION_RUN_RESULT_DRAFTS
}

export function getAllZiweiDataCollectionJobBlockRecords(): ZiweiDataCollectionJobBlockRecord[] {
  return ZIWEI_DATA_COLLECTION_JOB_BLOCK_RECORDS
}

export function getAllZiweiDataCollectionAuditRecords(): ZiweiDataCollectionAuditRecord[] {
  return ZIWEI_DATA_COLLECTION_AUDIT_RECORDS
}

export function getAllZiweiDataCollectionSourceResultCandidates(): ZiweiDataCollectionSourceResultCandidate[] {
  return ZIWEI_DATA_COLLECTION_SOURCE_RESULT_CANDIDATES
}

export function getAllZiweiDataCollectionFragmentResultCandidates(): ZiweiDataCollectionFragmentResultCandidate[] {
  return ZIWEI_DATA_COLLECTION_FRAGMENT_RESULT_CANDIDATES
}

export function getAllZiweiDataCollectionCleanedResultCandidates(): ZiweiDataCollectionCleanedResultCandidate[] {
  return ZIWEI_DATA_COLLECTION_CLEANED_RESULT_CANDIDATES
}

export function getAllZiweiDataCollectionTopicMappingCandidates(): ZiweiDataCollectionTopicMappingCandidate[] {
  return ZIWEI_DATA_COLLECTION_TOPIC_MAPPING_CANDIDATES
}

export function getAllZiweiDataCollectionAdmissionDecisionCandidates(): ZiweiDataCollectionAdmissionDecisionCandidate[] {
  return ZIWEI_DATA_COLLECTION_ADMISSION_DECISION_CANDIDATES
}

export function getAllZiweiDataCollectionReviewRouteCandidates(): ZiweiDataCollectionReviewRouteCandidate[] {
  return ZIWEI_DATA_COLLECTION_REVIEW_ROUTE_CANDIDATES
}

export function getAllZiweiDataCollectionPromotionGateProfiles(): ZiweiDataCollectionPromotionGateProfile[] {
  return ZIWEI_DATA_COLLECTION_PROMOTION_GATE_PROFILES
}

export function getAllZiweiDataCollectionPromotionDecisionRecords(): ZiweiDataCollectionPromotionDecisionRecord[] {
  return ZIWEI_DATA_COLLECTION_PROMOTION_DECISION_RECORDS
}

export function getAllZiweiDataSourceStorageBoundaryProfiles(): ZiweiDataSourceStorageBoundaryProfile[] {
  return ZIWEI_DATA_SOURCE_STORAGE_BOUNDARY_PROFILES
}

export function getAllZiweiDataDedupProfiles(): ZiweiDataDedupProfile[] {
  return ZIWEI_DATA_DEDUP_PROFILES
}

export function getAllZiweiDataEntityExtractionProfiles(): ZiweiDataEntityExtractionProfile[] {
  return ZIWEI_DATA_ENTITY_EXTRACTION_PROFILES
}

export function getAllZiweiDataConflictSignalProfiles(): ZiweiDataConflictSignalProfile[] {
  return ZIWEI_DATA_CONFLICT_SIGNAL_PROFILES
}

export function getAllZiweiDataReviewQueueProfiles(): ZiweiDataReviewQueueProfile[] {
  return ZIWEI_DATA_REVIEW_QUEUE_PROFILES
}

export function getAllZiweiDataCleanedIntakeResultRecords(): ZiweiDataCleanedIntakeResultRecord[] {
  return ZIWEI_DATA_CLEANED_INTAKE_RESULT_RECORDS
}

export function getAllZiweiDataCleaningPipelineProfiles(): ZiweiDataCleaningPipelineProfile[] {
  return ZIWEI_DATA_CLEANING_PIPELINE_PROFILES
}

export function getAllZiweiDataCleaningPipelineScenarios(): ZiweiDataCleaningPipelineScenarioRecord[] {
  return ZIWEI_DATA_CLEANING_PIPELINE_SCENARIOS
}
