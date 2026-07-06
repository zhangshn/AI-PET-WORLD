export type DestinyKnowledgeDomain =
  | "ziwei"
  | "bazi"
  | (string & {})

export type DestinySourceKind =
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
  | (string & {})

export type DestinyStoragePolicy =
  | "public-domain-text-and-summary"
  | "metadata-only"
  | "original-summary-only"
  | "user-owned-input"
  | "blocked"

export type DestinyReviewStatus =
  | "queued"
  | "collected-metadata"
  | "needs-dedup"
  | "needs-source-review"
  | "needs-conflict-review"
  | "approved-for-dictionary"
  | "rejected"

export type DestinyConflictSeverity =
  | "info"
  | "warning"
  | "blocking"

export type DestinyReviewQueuePriority =
  | "P0"
  | "P1"
  | "P2"
  | "P3"

export type DestinyCleanedResultPromotionStatus =
  | "blocked"
  | "metadata-only"
  | "needs-review"
  | "ready-for-dictionary"

export type DestinyDictionaryAdmissionStatus =
  | "admitted"
  | "metadata-only"
  | "review-required"
  | "rejected"

export type DestinyContentIntakeLayer =
  | "common-contract"
  | "domain-profile"
  | "domain-engine"
  | "check-script"
  | "documentation"

export type DestinyCleaningPipelineStepKind =
  | "source-registration"
  | "storage-boundary"
  | "entity-extraction"
  | "deduplication"
  | "conflict-detection"
  | "review-routing"
  | "cleaned-result"

export type DestinyCollectionAutomationMode =
  | "manual"
  | "assisted"
  | "automated"

export type DestinyCollectionBatchStatus =
  | "planned"
  | "ready"
  | "running"
  | "paused"
  | "closed"

export type DestinyCollectionExecutionStepKind =
  | "load-batch"
  | "register-source"
  | "capture-fragment"
  | "clean-fragment"
  | "map-topic"
  | "decide-admission"
  | "route-review"

export type DestinyCollectionExecutionTaskStatus =
  | "queued"
  | "ready"
  | "blocked"
  | "completed"

export type DestinyCollectionAdapterKind =
  | "public-domain-text"
  | "catalog-metadata"
  | "book-metadata"
  | "webpage-metadata"
  | "video-metadata"
  | "software-reference"
  | "manual-sample"

export type DestinyCollectionRequestMode =
  | "public-domain-text"
  | "metadata-only"
  | "own-summary-only"
  | "manual-input-only"

export type DestinyCollectionJobStatus =
  | "draft"
  | "ready"
  | "blocked"

export type DestinyCollectionRunStatus =
  | "draft"
  | "partial-ready"
  | "ready"
  | "blocked"
  | "completed"

export type DestinyCollectionRunResultStatus =
  | "waiting"
  | "ready-to-run"
  | "blocked"
  | "completed"

export type DestinyCollectionBlockStatus =
  | "clear"
  | "blocked"

export type DestinyCollectionLandingCandidateStatus =
  | "waiting-for-run"
  | "candidate-ready"
  | "blocked"

export type DestinyCollectionPromotionTargetKind =
  | "source-result"
  | "fragment-result"
  | "cleaned-result"
  | "topic-mapping"
  | "admission-decision"
  | "review-route"

export type DestinyCollectionPromotionDecision =
  | "promote"
  | "metadata-only"
  | "review-required"
  | "reject"
  | "wait"

export type DestinyCollectionFieldCaptureStage =
  | "source-registration"
  | "fragment-capture"
  | "cleaning"
  | "admission"
  | "review"

export interface DestinyContentIntakeDomainProfile {
  domain: DestinyKnowledgeDomain
  label: string
  coreEntityKinds: string[]
  dynamicEntityKinds: string[]
  dictionaryLayers: string[]
  hardRuleLayers: string[]
  notes: string[]
}

export interface DestinySourceStorageBoundaryProfile {
  profileId: string
  domainScope: DestinyKnowledgeDomain[] | ["all"]
  sourceKind: DestinySourceKind
  label: string
  storagePolicy: DestinyStoragePolicy
  canStoreOriginalText: boolean
  canStoreProjectSummary: boolean
  requiredMetadataFields: string[]
  allowedFields: string[]
  blockedFields: string[]
  promotionPath: string[]
  rejectionSignals: string[]
}

export interface DestinyDataDedupProfile {
  profileId: string
  domainScope: DestinyKnowledgeDomain[] | ["all"]
  sourceKinds: DestinySourceKind[]
  entityKinds: string[]
  dedupKeyTemplate: string
  normalizedFields: string[]
  collisionStrategy: "merge-metadata" | "queue-review" | "reject-duplicate"
  conflictSignals: string[]
}

export interface DestinyEntityExtractionProfile {
  profileId: string
  domain: DestinyKnowledgeDomain
  entityKind: string
  label: string
  sourceFields: string[]
  requiredEntities: string[]
  optionalEntities: string[]
  normalizationRules: string[]
}

export interface DestinyConflictSignalProfile {
  signalId: string
  domainScope: DestinyKnowledgeDomain[] | ["all"]
  label: string
  severity: DestinyConflictSeverity
  compares: string[]
  reason: string
  routingQueueId: string
}

export interface DestinyReviewQueueProfile {
  queueId: string
  domainScope: DestinyKnowledgeDomain[] | ["all"]
  label: string
  priority: DestinyReviewQueuePriority
  intakeStatuses: DestinyReviewStatus[]
  requiredReviewFields: string[]
  autoRejectSignals: string[]
  promotionCriteria: string[]
}

export interface DestinyCleanedEntityRef {
  entityKind: string
  entityId: string
  label: string
  confidence: "high" | "medium" | "low"
  normalizedBy: string[]
}

export interface DestinyCleanedIntakeResultRecord {
  resultId: string
  domain: DestinyKnowledgeDomain
  sourceId: string
  fragmentId: string
  sourceKind: DestinySourceKind
  storagePolicy: DestinyStoragePolicy
  dedupProfileId: string
  dedupKey: string
  normalizedFields: Record<string, string>
  entityRefs: DestinyCleanedEntityRef[]
  topicTags: string[]
  conflictSignalIds: string[]
  reviewQueueId: string | null
  reviewStatus: DestinyReviewStatus
  promotionStatus: DestinyCleanedResultPromotionStatus
  targetDictionaryLayer: string | null
  rejectionReason: string | null
  auditTrail: string[]
}

export interface DestinyContentIntakeDirectoryRule {
  ruleId: string
  layer: DestinyContentIntakeLayer
  path: string
  ownerDomain: DestinyKnowledgeDomain | "all"
  purpose: string
  allowedFiles: string[]
  forbiddenPatterns: string[]
  dependsOn: string[]
  extensionRule: string
}

export interface DestinyCleaningPipelineStepProfile {
  stepId: string
  order: number
  kind: DestinyCleaningPipelineStepKind
  label: string
  inputRefs: string[]
  outputRefs: string[]
  requiredChecks: string[]
  blockingSignals: string[]
}

export interface DestinyCleaningPipelineProfile {
  pipelineId: string
  domain: DestinyKnowledgeDomain
  label: string
  sourceKinds: DestinySourceKind[]
  steps: DestinyCleaningPipelineStepProfile[]
  finalOutputs: string[]
  forbiddenShortcuts: string[]
}

export interface DestinyCleaningPipelineScenarioRecord {
  scenarioId: string
  pipelineId: string
  domain: DestinyKnowledgeDomain
  sourceKind: DestinySourceKind
  inputSummary: string
  expectedStepKinds: DestinyCleaningPipelineStepKind[]
  expectedPromotionStatus: DestinyCleanedResultPromotionStatus
  expectedReviewStatus: DestinyReviewStatus
  expectedReviewQueueId: string | null
  expectedTargetDictionaryLayer: string | null
  expectedConflictSignalIds: string[]
  expectedOutputFields: string[]
  notes: string[]
}

export interface DestinyTopicMappingProfile {
  mappingProfileId: string
  domain: DestinyKnowledgeDomain
  topicTag: string
  label: string
  entityKinds: string[]
  sourceKinds: DestinySourceKind[]
  targetDictionaryLayer: string
  requiredCleanedFields: string[]
  sourceTraceFields: string[]
  acceptanceRules: string[]
  rejectionRules: string[]
  downstreamUse: string[]
}

export interface DestinyDictionaryAdmissionPolicyProfile {
  policyId: string
  domain: DestinyKnowledgeDomain
  label: string
  appliesToPromotionStatuses: DestinyCleanedResultPromotionStatus[]
  appliesToStoragePolicies: DestinyStoragePolicy[]
  minScoreInclusive: number
  maxScoreInclusive: number
  admissionStatus: DestinyDictionaryAdmissionStatus
  allowedTargetDictionaryLayers: string[]
  requiredEvidenceFields: string[]
  requiredReviewQueueIds: string[]
  blockingSignals: string[]
  outputFields: string[]
}

export interface DestinyDictionaryAdmissionDecisionRecord {
  decisionId: string
  domain: DestinyKnowledgeDomain
  cleanedResultId: string
  policyId: string
  score: number
  admissionStatus: DestinyDictionaryAdmissionStatus
  targetDictionaryLayer: string | null
  requiredReviewQueueId: string | null
  acceptedEvidenceFields: string[]
  rejectionReason: string | null
  nextAction: string
  auditTrail: string[]
}

export interface DestinyCollectionFieldProfile {
  fieldId: string
  domainScope: DestinyKnowledgeDomain[] | ["all"]
  captureStage: DestinyCollectionFieldCaptureStage
  label: string
  required: boolean
  valueType: "string" | "string[]" | "number" | "boolean" | "enum"
  mapsTo: string[]
  validationRules: string[]
  forbiddenValues: string[]
}

export interface DestinySourceSeedRecord {
  seedId: string
  domain: DestinyKnowledgeDomain
  sourceKind: DestinySourceKind
  label: string
  locatorTemplate: string
  automationMode: DestinyCollectionAutomationMode
  storagePolicy: DestinyStoragePolicy
  topicTags: string[]
  allowedCaptureFields: string[]
  forbiddenCaptureFields: string[]
  expectedEntityKinds: string[]
  handoffPipelineId: string
  reviewQueueId: string | null
}

export interface DestinyCollectionBatchPlan {
  batchId: string
  domain: DestinyKnowledgeDomain
  label: string
  status: DestinyCollectionBatchStatus
  automationMode: DestinyCollectionAutomationMode
  sourceSeedIds: string[]
  sourceKinds: DestinySourceKind[]
  topicTags: string[]
  requiredFieldIds: string[]
  expectedOutputs: string[]
  storageGuardrails: string[]
  reviewGates: string[]
}

export interface DestinyCollectionExecutorProfile {
  executorId: string
  domain: DestinyKnowledgeDomain
  label: string
  stepKinds: DestinyCollectionExecutionStepKind[]
  consumes: string[]
  produces: string[]
  guardrails: string[]
  failureModes: string[]
}

export interface DestinyCollectionExecutionTaskRecord {
  taskId: string
  domain: DestinyKnowledgeDomain
  batchId: string
  sourceSeedId: string
  sourceKind: DestinySourceKind
  automationMode: DestinyCollectionAutomationMode
  status: DestinyCollectionExecutionTaskStatus
  stepKind: DestinyCollectionExecutionStepKind
  nextStepKind: DestinyCollectionExecutionStepKind | null
  requiredFieldIds: string[]
  allowedCaptureFields: string[]
  forbiddenCaptureFields: string[]
  expectedOutputs: string[]
  storageGuardrails: string[]
  reviewQueueId: string | null
  auditTrail: string[]
}

export interface DestinyCollectionSourceRegistrationDraft {
  registrationId: string
  domain: DestinyKnowledgeDomain
  taskId: string
  sourceSeedId: string
  sourceKind: DestinySourceKind
  locatorTemplate: string
  storagePolicy: DestinyStoragePolicy
  requiredFieldIds: string[]
  allowedCaptureFields: string[]
  forbiddenCaptureFields: string[]
  status: DestinyReviewStatus
  auditTrail: string[]
}

export interface DestinyCollectionFragmentCaptureInput {
  captureInputId: string
  domain: DestinyKnowledgeDomain
  taskId: string
  sourceRegistrationId: string
  captureStage: DestinyCollectionFieldCaptureStage
  storagePolicy: DestinyStoragePolicy
  topicTags: string[]
  allowedCaptureFields: string[]
  forbiddenCaptureFields: string[]
  expectedEntityKinds: string[]
  guardrails: string[]
}

export interface DestinyCollectionCleaningInputDraft {
  cleaningInputId: string
  domain: DestinyKnowledgeDomain
  taskId: string
  sourceRegistrationId: string
  captureInputId: string
  pipelineId: string
  sourceKind: DestinySourceKind
  topicTags: string[]
  normalizedFieldTargets: string[]
  dedupHintFields: string[]
  conflictCheckIds: string[]
  expectedOutputs: string[]
}

export interface DestinyCollectionReviewQueueItemDraft {
  reviewItemId: string
  domain: DestinyKnowledgeDomain
  taskId: string
  reviewQueueId: string
  sourceKind: DestinySourceKind
  trigger: string
  requiredReviewFields: string[]
  promotionCriteria: string[]
  blockingSignals: string[]
  auditTrail: string[]
}

export interface DestinyCollectionAdapterProfile {
  adapterId: string
  domain: DestinyKnowledgeDomain
  adapterKind: DestinyCollectionAdapterKind
  label: string
  sourceKinds: DestinySourceKind[]
  automationModes: DestinyCollectionAutomationMode[]
  requestMode: DestinyCollectionRequestMode
  allowedStoragePolicies: DestinyStoragePolicy[]
  produces: string[]
  guardrails: string[]
  blockedOperations: string[]
}

export interface DestinyCollectionJobDraft {
  jobId: string
  domain: DestinyKnowledgeDomain
  adapterId: string
  adapterKind: DestinyCollectionAdapterKind
  taskId: string
  sourceRegistrationId: string
  captureInputId: string
  cleaningInputId: string
  sourceKind: DestinySourceKind
  storagePolicy: DestinyStoragePolicy
  requestMode: DestinyCollectionRequestMode
  locatorTemplate: string
  allowedCaptureFields: string[]
  forbiddenCaptureFields: string[]
  expectedOutputs: string[]
  guardrails: string[]
  reviewQueueId: string | null
  status: DestinyCollectionJobStatus
  blockReasons: string[]
  auditTrail: string[]
}

export interface DestinyCollectionRunBatchRecord {
  runBatchId: string
  domain: DestinyKnowledgeDomain
  label: string
  jobIds: string[]
  readyJobIds: string[]
  draftJobIds: string[]
  blockedJobIds: string[]
  status: DestinyCollectionRunStatus
  guardrails: string[]
  nextAction: string
  auditTrail: string[]
}

export interface DestinyCollectionJobRunResultDraft {
  runResultId: string
  domain: DestinyKnowledgeDomain
  runBatchId: string
  jobId: string
  adapterId: string
  requestMode: DestinyCollectionRequestMode
  status: DestinyCollectionRunResultStatus
  producedDraftRefs: string[]
  expectedOutputs: string[]
  nextAction: string
  auditTrail: string[]
}

export interface DestinyCollectionJobBlockRecord {
  blockRecordId: string
  domain: DestinyKnowledgeDomain
  runBatchId: string
  jobId: string
  status: DestinyCollectionBlockStatus
  sourceKind: DestinySourceKind
  requestMode: DestinyCollectionRequestMode
  blockReasons: string[]
  blockedOperations: string[]
  forbiddenCaptureFields: string[]
  resolutionPath: string[]
  auditTrail: string[]
}

export interface DestinyCollectionAuditRecord {
  auditRecordId: string
  domain: DestinyKnowledgeDomain
  runBatchId: string
  subjectKind: "run-batch" | "collection-job" | "run-result" | "block-record"
  subjectId: string
  passedChecks: string[]
  failedChecks: string[]
  outputRefs: string[]
  auditTrail: string[]
}

export interface DestinyCollectionSourceResultCandidate {
  sourceResultId: string
  domain: DestinyKnowledgeDomain
  runResultId: string
  jobId: string
  sourceRegistrationId: string
  sourceKind: DestinySourceKind
  locatorTemplate: string
  storagePolicy: DestinyStoragePolicy
  status: DestinyCollectionLandingCandidateStatus
  auditTrail: string[]
}

export interface DestinyCollectionFragmentResultCandidate {
  fragmentResultId: string
  domain: DestinyKnowledgeDomain
  sourceResultId: string
  captureInputId: string
  storagePolicy: DestinyStoragePolicy
  topicTags: string[]
  allowedCaptureFields: string[]
  forbiddenCaptureFields: string[]
  status: DestinyCollectionLandingCandidateStatus
  auditTrail: string[]
}

export interface DestinyCollectionCleanedResultCandidate {
  cleanedCandidateId: string
  domain: DestinyKnowledgeDomain
  fragmentResultId: string
  cleaningInputId: string
  pipelineId: string
  sourceKind: DestinySourceKind
  topicTags: string[]
  dedupHintFields: string[]
  conflictCheckIds: string[]
  expectedOutputs: string[]
  status: DestinyCollectionLandingCandidateStatus
  auditTrail: string[]
}

export interface DestinyCollectionTopicMappingCandidate {
  topicMappingCandidateId: string
  domain: DestinyKnowledgeDomain
  cleanedCandidateId: string
  topicTags: string[]
  targetDictionaryLayers: string[]
  sourceTraceRefs: string[]
  status: DestinyCollectionLandingCandidateStatus
  auditTrail: string[]
}

export interface DestinyCollectionAdmissionDecisionCandidate {
  admissionCandidateId: string
  domain: DestinyKnowledgeDomain
  cleanedCandidateId: string
  topicMappingCandidateId: string
  admissionStatus: DestinyDictionaryAdmissionStatus
  targetDictionaryLayer: string | null
  requiredReviewQueueId: string | null
  status: DestinyCollectionLandingCandidateStatus
  nextAction: string
  auditTrail: string[]
}

export interface DestinyCollectionReviewRouteCandidate {
  reviewRouteCandidateId: string
  domain: DestinyKnowledgeDomain
  admissionCandidateId: string
  reviewRequired: boolean
  reviewQueueId: string | null
  reason: string
  status: DestinyCollectionLandingCandidateStatus
  auditTrail: string[]
}

export interface DestinyCollectionPromotionGateProfile {
  gateId: string
  domain: DestinyKnowledgeDomain
  targetKind: DestinyCollectionPromotionTargetKind
  label: string
  acceptedCandidateStatuses: DestinyCollectionLandingCandidateStatus[]
  acceptedAdmissionStatuses: DestinyDictionaryAdmissionStatus[]
  requiredEvidenceRefs: string[]
  promotionRules: string[]
  blockingRules: string[]
  outputs: string[]
}

export interface DestinyCollectionPromotionDecisionRecord {
  promotionDecisionId: string
  domain: DestinyKnowledgeDomain
  gateId: string
  targetKind: DestinyCollectionPromotionTargetKind
  candidateId: string
  decision: DestinyCollectionPromotionDecision
  admissionStatus: DestinyDictionaryAdmissionStatus
  sourceKind: DestinySourceKind
  targetDictionaryLayer: string | null
  reviewQueueId: string | null
  promotedRecordRefs: string[]
  blockedReason: string | null
  nextAction: string
  auditTrail: string[]
}

export const DESTINY_CONTENT_INTAKE_DOMAIN_PROFILES: DestinyContentIntakeDomainProfile[] = [
  {
    domain: "ziwei",
    label: "紫微斗数",
    coreEntityKinds: ["starId", "palaceId", "branchId", "stemId", "patternId", "transformationId"],
    dynamicEntityKinds: ["daYun", "liuNian", "liuYue", "liuRi", "liuShi"],
    dictionaryLayers: ["star.dictionary", "palace.dictionary", "pattern.dictionary", "transformation.topic"],
    hardRuleLayers: ["star-catalog", "pattern-catalog", "transformation-rules", "brightness-table", "dynamic-flow-rules"],
    notes: ["紫微资料可以使用通用采集、清洗、去重和复核协议，实体集合由紫微 domain profile 决定。"]
  },
  {
    domain: "bazi",
    label: "八字",
    coreEntityKinds: ["stemId", "branchId", "tenGodId", "elementId", "hiddenStemId", "pillarId"],
    dynamicEntityKinds: ["daYun", "liuNian", "liuYue", "liuRi", "liuShi"],
    dictionaryLayers: ["stem-branch.dictionary", "ten-god.dictionary", "element-dynamics.dictionary", "flow.dictionary"],
    hardRuleLayers: ["ganzhi-table", "hidden-stems", "solar-terms", "element-weights", "runtime-flow-rules"],
    notes: ["八字已有 bazi-core、bazi-data 和 bazi-runtime；后续只挂资料采集 profile，不重建八字算法，也不重做清洗协议。"]
  }
]

export const DESTINY_COMMON_REVIEW_QUEUE_PROFILES: DestinyReviewQueueProfile[] = [
  {
    queueId: "destiny.review.source-unknown",
    domainScope: ["all"],
    label: "来源不明复核",
    priority: "P0",
    intakeStatuses: ["needs-source-review"],
    requiredReviewFields: ["sourceId", "sourceKind", "locator", "collectorNote", "reviewDecision"],
    autoRejectSignals: ["locator-missing", "source-kind-unknown", "modern-content-without-metadata"],
    promotionCriteria: ["来源可回查", "来源类型明确", "存储边界明确"]
  },
  {
    queueId: "destiny.review.duplicate-collision",
    domainScope: ["all"],
    label: "去重碰撞复核",
    priority: "P1",
    intakeStatuses: ["needs-dedup"],
    requiredReviewFields: ["dedupKey", "sourceIds", "entityIds", "collisionReason", "mergeDecision"],
    autoRejectSignals: ["same-source-same-entity-same-topic", "empty-normalized-summary"],
    promotionCriteria: ["同源重复已合并", "跨源差异已保留来源", "主题标签一致"]
  },
  {
    queueId: "destiny.review.rule-conflict",
    domainScope: ["all"],
    label: "硬规则冲突复核",
    priority: "P0",
    intakeStatuses: ["needs-conflict-review"],
    requiredReviewFields: ["domain", "entityId", "hardRuleLayer", "sourceId", "conflictSignalId", "reviewDecision"],
    autoRejectSignals: ["tries-to-overwrite-hard-rule", "unverified-modern-source"],
    promotionCriteria: ["不覆盖硬规则", "保留为资料分歧", "有二次来源或公版来源支撑"]
  }
]

export const DESTINY_CONTENT_INTAKE_DIRECTORY_RULES: DestinyContentIntakeDirectoryRule[] = [
  {
    ruleId: "destiny.directory.common-contract",
    layer: "common-contract",
    path: "src/ai/destiny-core/content-intake/",
    ownerDomain: "all",
    purpose: "命理资料采集、清洗、去重、冲突和复核的通用契约层。",
    allowedFiles: ["content-intake-contract.ts"],
    forbiddenPatterns: ["index.ts", "ziwei-*", "bazi-*", "*engine.ts"],
    dependsOn: [],
    extensionRule: "这里不写紫微或八字算法，只定义跨命理模块共用的类型和通用队列。"
  },
  {
    ruleId: "destiny.directory.ziwei-profile",
    layer: "domain-profile",
    path: "src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts",
    ownerDomain: "ziwei",
    purpose: "紫微斗数 P35 资料采集、来源边界、去重、实体抽取、冲突信号和复核队列 profile。",
    allowedFiles: ["content-data-intake.ts"],
    forbiddenPatterns: ["bazi-*", "behavior-*", "personality-*"],
    dependsOn: ["src/ai/destiny-core/content-intake/content-intake-contract.ts"],
    extensionRule: "紫微资料只在该文件挂接 profile，不向通用层写入紫微专用算法。"
  },
  {
    ruleId: "destiny.directory.bazi-existing-core",
    layer: "domain-engine",
    path: "src/ai/destiny-core/bazi-core/",
    ownerDomain: "bazi",
    purpose: "八字已有算法、数据和动态运行层，P35-C 不重建八字排盘。",
    allowedFiles: ["bazi-schema.ts", "bazi-data/", "bazi-runtime/", "bazi-*.ts"],
    forbiddenPatterns: ["ziwei-*", "content-intake/index.ts", "duplicate-cleaner-*"],
    dependsOn: [],
    extensionRule: "八字后续如接资料采集 profile，优先放在 bazi-core/bazi-data-intake.ts，并复用通用 contract。"
  },
  {
    ruleId: "destiny.directory.ziwei-check",
    layer: "check-script",
    path: "scripts/ziwei/check-p35-data-intake.mjs",
    ownerDomain: "ziwei",
    purpose: "复核 P35 采集结构、通用命理协议、紫微 profile 和八字扩展边界。",
    allowedFiles: ["check-p35-data-intake.mjs"],
    forbiddenPatterns: ["manual-only-check", "browser-only-check"],
    dependsOn: [
      "src/ai/destiny-core/content-intake/content-intake-contract.ts",
      "src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts",
      "src/ai/destiny-core/bazi-core/bazi-schema.ts"
    ],
    extensionRule: "检查脚本必须证明结构不是紫微写死，并确认八字已有 core 可作为后续接入点。"
  },
  {
    ruleId: "destiny.directory.ziwei-docs",
    layer: "documentation",
    path: "docs/ziwei/",
    ownerDomain: "ziwei",
    purpose: "记录紫微当前阶段文档、目录、进度和来源边界。",
    allowedFiles: [
      "README.md",
      "ROADMAP.md",
      "DIRECTORY_STRUCTURE.md",
      "ALGORITHM_CONTRACTS.md",
      "CONTENT_DATA_DICTIONARY.md",
      "SOURCE_STORAGE_BOUNDARY.md",
      "PAGE_ACCEPTANCE.md",
      "EXECUTION_TABLE.md"
    ],
    forbiddenPatterns: ["旧阶段散文档", "SOURCE_COPYRIGHT.md", "IMPLEMENTATION_PLAN.md"],
    dependsOn: ["scripts/ziwei/check-p35-data-intake.mjs"],
    extensionRule: "紫微文档继续只维护 8 份，新增阶段内容写进既有文档，不再开散文档。"
  }
]

export function getAllDestinyContentIntakeDomainProfiles(): DestinyContentIntakeDomainProfile[] {
  return DESTINY_CONTENT_INTAKE_DOMAIN_PROFILES
}

export function getAllDestinyCommonReviewQueueProfiles(): DestinyReviewQueueProfile[] {
  return DESTINY_COMMON_REVIEW_QUEUE_PROFILES
}

export function getAllDestinyContentIntakeDirectoryRules(): DestinyContentIntakeDirectoryRule[] {
  return DESTINY_CONTENT_INTAKE_DIRECTORY_RULES
}
