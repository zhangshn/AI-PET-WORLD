import type { AiConsolePlane } from "./ai-console-catalog"

export type AiConsoleWorkspaceField = {
  canonicalName: string
  displayName: string
  dataType: "identity" | "enum" | "timestamp_utc" | "sha256" | "integer" | "boolean" | "scalar" | "string" | "structured"
  role: "primary_identity" | "relation" | "state" | "time" | "integrity" | "measure" | "attribute"
  nullable: boolean
}

export type AiConsoleWorkspaceStateContract = {
  stateMachine: string
  canonicalField: string
  truthRule: string
}

export type AiConsoleWorkspacePresentation = "registry" | "timeline" | "topology" | "matrix" | "monitor" | "search" | "control_contract"

export type AiConsoleModuleRelationContract = {
  upstream: string
  downstream: string
  evidenceBinding: string
  operatingRule: string
}

export type AiConsoleWorkspaceDefinition = {
  moduleSlug: string
  slug: string
  title: string
  englishTitle: string
  route: string
  plane: AiConsolePlane
  summary: string
  primaryEntity: string
  sourceOfTruth: string
  updateSemantics: "immutable" | "append_only" | "monotonic_revision" | "replaceable_projection"
  fields: readonly AiConsoleWorkspaceField[]
  workAreas: readonly string[]
  boundary: string
  stateContract: AiConsoleWorkspaceStateContract
  presentation: AiConsoleWorkspacePresentation
}

type WorkspaceFieldInput = Pick<AiConsoleWorkspaceField, "canonicalName" | "displayName"> & { nullable?: boolean }

const controlDefinitionFields = [
  ["commandDefinitionId", "命令定义"],
  ["commandType", "命令类型"],
  ["targetType", "目标类型"],
  ["requiredRole", "所需角色"],
  ["validationRuleSetId", "验证规则"],
  ["parameterSchemaId", "参数Schema"],
  ["safetyBoundary", "安全边界"],
  ["executorIdentity", "执行器身份", true],
] as const

type WorkspaceInput = Omit<AiConsoleWorkspaceDefinition, "route" | "plane" | "sourceOfTruth" | "boundary" | "stateContract" | "presentation" | "fields"> & {
  fields: readonly WorkspaceFieldInput[]
}

const moduleContracts = {
  tasks: {
    plane: "observation",
    sourceOfTruth: "current-execution-registry / local task service",
    boundary: "只读投影任务与执行身份；历史选择不得改写当前任务、活动执行或下一机器动作。",
    stateContract: { stateMachine: "task_and_execution_lifecycle", canonicalField: "lifecycleStatus / executionStatus", truthRule: "只接受当前登记修订与活动心跳共同证明的状态。" },
  },
  capabilities: {
    plane: "observation",
    sourceOfTruth: "capability lifecycle registry / release registry",
    boundary: "能力资格与发布结论只来自本地机器证据；页面不得自报通过、发布或回退。",
    stateContract: { stateMachine: "capability_lifecycle", canonicalField: "capabilityStatus / releaseStatus", truthRule: "资格、发布和回退必须由原子登记及证据集合证明。" },
  },
  training: {
    plane: "observation",
    sourceOfTruth: "training run manifest / progress projection / checkpoint registry",
    boundary: "训练页面只读取已保存投影；不得启动训练、选择Checkpoint或改变Stage状态。",
    stateContract: { stateMachine: "training_run_lifecycle", canonicalField: "trainingStatus", truthRule: "Run、Stage与Checkpoint身份分离，页面状态不得覆盖训练清单。" },
  },
  reviews: {
    plane: "observation",
    sourceOfTruth: "validation manifest / machine review evidence",
    boundary: "审核阈值、节点结论与失败码来自冻结审核合同；页面不得修改或补写通过。",
    stateContract: { stateMachine: "validation_and_review_lifecycle", canonicalField: "validationStatus / reviewStatus", truthRule: "验证过程与审核结论分层，失败证据不可被后续投影隐藏。" },
  },
  data: {
    plane: "observation",
    sourceOfTruth: "dataset release registry / condition schema registry",
    boundary: "数据资格、许可、split与Schema身份只读展示；页面访问不得触发下载、派生或登记。",
    stateContract: { stateMachine: "dataset_release_lifecycle", canonicalField: "releaseStatus / qualityStatus", truthRule: "许可、质量和发布资格必须绑定同一数据版本与内容摘要。" },
  },
  runtime: {
    plane: "observation",
    sourceOfTruth: "WorldFacts registry / RuntimeFrame registry",
    boundary: "视觉候选不得决定WorldFacts；页面不得发布Frame、改写世界状态或回退正式世界。",
    stateContract: { stateMachine: "runtime_frame_lifecycle", canonicalField: "generationStatus / runtimeFrameStatus", truthRule: "WorldFacts先于视觉产物，候选与正式Frame不得混用身份。" },
  },
  evidence: {
    plane: "observation",
    sourceOfTruth: "immutable files / event ledger / SQLite transaction index",
    boundary: "证据只读、不可覆盖；冲突必须显示unknown_or_stale或evidence_conflict。",
    stateContract: { stateMachine: "evidence_integrity_lifecycle", canonicalField: "integrityStatus", truthRule: "文件、事件与SQLite索引必须一致；冲突时失败关闭。" },
  },
  system: {
    plane: "observation",
    sourceOfTruth: "local telemetry service / background service registry",
    boundary: "资源和服务状态只来自本地采样；页面不得直接结束进程、改队列或调整资源上限。",
    stateContract: { stateMachine: "service_and_resource_health", canonicalField: "serviceStatus / healthStatus", truthRule: "仅使用带采样时间、组件身份和来源的本地遥测。" },
  },
  archive: {
    plane: "observation",
    sourceOfTruth: "storage catalog / immutable historical records",
    boundary: "历史检索只改变查询上下文；旧Run和历史合同不得重新获得当前执行身份。",
    stateContract: { stateMachine: "archive_record_lifecycle", canonicalField: "historicalStatus / terminalStatus", truthRule: "历史记录只读且保持原终态，不参与当前任务解析。" },
  },
  control: {
    plane: "control",
    sourceOfTruth: "local control command service / command event ledger",
    boundary: "命令定义、角色和验证合同只读接入；执行器未登记前不提供提交控件，后续写操作必须进入本地命令状态机。",
    stateContract: { stateMachine: "control_command_lifecycle", canonicalField: "commandStatus", truthRule: "命令必须复核目标修订、幂等键、允许转换和结果证据。" },
  },
} as const satisfies Record<string, { plane: AiConsolePlane; sourceOfTruth: string; boundary: string; stateContract: AiConsoleWorkspaceStateContract }>

const moduleRelationContracts = {
  tasks: { upstream: "业务目标与能力需求", downstream: "能力建设、训练与执行服务", evidenceBinding: "任务胶囊、执行事件与终态证据", operatingRule: "当前任务、活动执行、排队任务和历史任务必须分离身份。" },
  capabilities: { upstream: "任务需求与能力缺口", downstream: "模型训练、资格审核与能力发布", evidenceBinding: "候选版本、资格报告与发布登记", operatingRule: "能力设计、候选、资格与正式发布不得压缩成单一状态。" },
  training: { upstream: "合格数据版本、模型设计与训练计划", downstream: "验证、机器审核与能力资格", evidenceBinding: "Run清单、指标、Checkpoint与预览证据", operatingRule: "训练Run、Stage、Checkpoint与发布身份保持独立。" },
  reviews: { upstream: "训练候选、验证输入与冻结审核合同", downstream: "资格裁决、发布或失败关闭", evidenceBinding: "验证清单、审核节点、失败码与不可变证据", operatingRule: "验证过程状态与机器审核结论使用不同状态机。" },
  data: { upstream: "获许可来源与内部生成记录", downstream: "训练、验证、推理与多模态任务", evidenceBinding: "数据发布登记、Schema、许可与质量报告", operatingRule: "数据版本、split、条件Schema和内容摘要必须同身份绑定。" },
  runtime: { upstream: "WorldFacts、能力发布与条件包", downstream: "RuntimeFrame发布与世界消费", evidenceBinding: "事实清单、候选审核、发布事务与回退关系", operatingRule: "WorldFacts决定视觉约束，视觉产物不得反向改写事实。" },
  evidence: { upstream: "全平台文件、事件与数据库事务", downstream: "审计、恢复、失败关闭与政策边界", evidenceBinding: "SHA-256、事件序号与SQLite事务索引", operatingRule: "证据冲突时失败关闭，不得回退到旧记录补齐事实。" },
  system: { upstream: "本地进程、资源采样与服务心跳", downstream: "调度门禁、健康裁决与容量策略", evidenceBinding: "遥测样本、服务登记与健康检查记录", operatingRule: "资源投影必须带采样时间和来源，不以页面状态代替机器采样。" },
  archive: { upstream: "已终结任务、Run、审核、生成与合同", downstream: "只读复核、检索和可追溯分析", evidenceBinding: "原始终态、归档索引与不可变内容摘要", operatingRule: "历史选择只改变查询上下文，不恢复旧记录的执行权。" },
  control: { upstream: "本地操作员意图与当前登记修订", downstream: "本地命令状态机与结果证据", evidenceBinding: "命令事件、幂等键、目标修订与结果终态", operatingRule: "人工控制是可选覆盖，所有写入必须由服务端重新复核。" },
} as const satisfies Record<string, AiConsoleModuleRelationContract>

const presentationRouteKeys = {
  timeline: new Set([
    "tasks/history", "training/runs", "reviews/results", "runtime/generations", "evidence/events", "system/telemetry",
    "archive/training", "archive/reviews", "archive/generations",
  ]),
  topology: new Set([
    "tasks/flows", "capabilities/qualification", "capabilities/migration", "training/models", "runtime/facts",
    "runtime/frames", "evidence/transactions", "system/scheduler", "archive/contracts",
  ]),
  matrix: new Set([
    "capabilities/domains", "reviews/contracts", "reviews/failures", "data/conditions", "data/dictionary",
    "data/quality", "evidence/policies", "system/health",
  ]),
  monitor: new Set([
    "tasks/current", "tasks/active", "training/overview", "reviews/current", "runtime/world", "system/resources", "system/services",
  ]),
  search: new Set([
    "archive/search", "evidence/artifacts", "data/samples",
  ]),
} as const

function resolveWorkspacePresentation(moduleSlug: string, slug: string): AiConsoleWorkspacePresentation {
  if (moduleSlug === "control") return "control_contract"
  const routeKey = `${moduleSlug}/${slug}`
  for (const [presentation, routeKeys] of Object.entries(presentationRouteKeys)) {
    if (routeKeys.has(routeKey)) return presentation as Exclude<AiConsoleWorkspacePresentation, "registry" | "control_contract">
  }
  return "registry"
}

function normalizeWorkspaceField({ canonicalName, displayName, nullable }: WorkspaceFieldInput): AiConsoleWorkspaceField {
  const normalized = canonicalName.toLowerCase()
  const isSha256 = normalized.includes("sha256") || normalized.endsWith("hash")
  const isTimestamp = normalized.endsWith("atutc") || normalized.endsWith("time") || normalized.includes("timerange")
  const isStatus = normalized.endsWith("status") || normalized.includes("terminal") || normalized.includes("eligibility") || normalized === "evidencetype" || normalized === "mediatype" || normalized === "storagemode"
  const isBoolean = normalized.startsWith("is") || normalized.endsWith("enabled") || normalized.includes("readonly")
  const isInteger = normalized.endsWith("count") || normalized.endsWith("sequence") || normalized.endsWith("revision") || normalized.endsWith("length") || normalized === "gateorder" || normalized === "tick" || normalized.endsWith("tick")
  const isScalar = normalized.includes("utilization") || normalized.includes("value") || normalized === "priority"
  const isIdentity = normalized.endsWith("id") || normalized.endsWith("identity")
  const isRelation = isIdentity && (normalized.includes("target") || normalized.includes("source") || normalized.includes("parent") || normalized.includes("superseded") || normalized.includes("rollback"))

  return {
    canonicalName,
    displayName,
    dataType: isSha256 ? "sha256" : isTimestamp ? "timestamp_utc" : isStatus ? "enum" : isBoolean ? "boolean" : isInteger ? "integer" : isScalar ? "scalar" : isIdentity ? "identity" : normalized.includes("set") || normalized.includes("range") || normalized.includes("order") || normalized === "requiredidentityfields" ? "structured" : "string",
    role: isSha256 ? "integrity" : isTimestamp ? "time" : isStatus ? "state" : isRelation ? "relation" : isIdentity ? "primary_identity" : isInteger || isScalar ? "measure" : "attribute",
    nullable: nullable ?? (normalized.includes("failure") || normalized.includes("rollback") || normalized.includes("superseded") || normalized.includes("last") || normalized.includes("preview")),
  }
}

function workspace(input: WorkspaceInput): AiConsoleWorkspaceDefinition {
  const contract = moduleContracts[input.moduleSlug as keyof typeof moduleContracts]
  if (!contract) throw new Error(`AI console module contract not found: ${input.moduleSlug}`)

  return {
    ...input,
    route: `/ai-console/${input.moduleSlug}/${input.slug}`,
    plane: contract.plane,
    sourceOfTruth: contract.sourceOfTruth,
    boundary: contract.boundary,
    stateContract: contract.stateContract,
    presentation: resolveWorkspacePresentation(input.moduleSlug, input.slug),
    fields: input.fields.map(normalizeWorkspaceField),
  }
}

function listedWorkspace(
  moduleSlug: string,
  slug: string,
  title: string,
  englishTitle: string,
  summary: string,
  primaryEntity: string,
  updateSemantics: AiConsoleWorkspaceDefinition["updateSemantics"],
  fields: readonly (readonly [canonicalName: string, displayName: string, nullable?: boolean])[],
  workAreas: readonly string[],
) {
  return workspace({
    moduleSlug,
    slug,
    title,
    englishTitle,
    summary,
    primaryEntity,
    updateSemantics,
    fields: fields.map(([canonicalName, displayName, nullable]) => ({ canonicalName, displayName, nullable })),
    workAreas,
  })
}

export const aiConsoleWorkspaceDefinitions: readonly AiConsoleWorkspaceDefinition[] = [
  workspace({
    moduleSlug: "tasks",
    slug: "current",
    title: "当前项目任务",
    englishTitle: "CURRENT PROJECT TASK",
    summary: "只读呈现项目唯一当前任务的身份、业务目标、生命周期位置、阻断和下一机器动作。",
    primaryEntity: "currentProjectTask",
    updateSemantics: "monotonic_revision",
    fields: [
      { canonicalName: "taskId", displayName: "任务身份" },
      { canonicalName: "capabilityDomain", displayName: "能力域" },
      { canonicalName: "lifecycleStatus", displayName: "生命周期状态" },
      { canonicalName: "nextMachineAction", displayName: "下一机器动作" },
      { canonicalName: "registryRevision", displayName: "登记修订" },
      { canonicalName: "evidenceSha256", displayName: "绑定证据摘要" },
    ],
    workAreas: ["任务身份摘要", "生命周期与阻断", "下一机器动作", "登记与证据关系"],
  }),
  workspace({
    moduleSlug: "tasks",
    slug: "active",
    title: "活动执行",
    englishTitle: "ACTIVE EXECUTION",
    summary: "核对当前真实活动执行的进程、心跳、任务锁、阶段和进度，不从历史running记录推测。",
    primaryEntity: "activeExecution",
    updateSemantics: "replaceable_projection",
    fields: [
      { canonicalName: "executionId", displayName: "执行身份" },
      { canonicalName: "runId", displayName: "Run身份" },
      { canonicalName: "processId", displayName: "进程身份" },
      { canonicalName: "heartbeatAtUtc", displayName: "最近心跳" },
      { canonicalName: "taskLockIdentity", displayName: "任务锁身份" },
      { canonicalName: "executionStatus", displayName: "执行状态" },
    ],
    workAreas: ["活动身份核验", "进程与心跳", "阶段与进度", "任务锁一致性"],
  }),
  workspace({
    moduleSlug: "tasks",
    slug: "queue",
    title: "任务队列",
    englishTitle: "TASK QUEUE",
    summary: "展示已登记任务的排队、调度优先级、资源等待和取消状态，不把队列记录当作活动执行。",
    primaryEntity: "ai_task_queue_item",
    updateSemantics: "monotonic_revision",
    fields: [
      { canonicalName: "queueItemId", displayName: "队列项身份" },
      { canonicalName: "taskId", displayName: "任务身份" },
      { canonicalName: "priority", displayName: "调度优先级" },
      { canonicalName: "resourceWaitReason", displayName: "资源等待原因" },
      { canonicalName: "queuedAtUtc", displayName: "入队时间" },
      { canonicalName: "queueStatus", displayName: "队列状态" },
    ],
    workAreas: ["待执行队列", "资源等待", "调度顺序", "取消与过期记录"],
  }),
  workspace({
    moduleSlug: "tasks",
    slug: "flows",
    title: "闭环拓扑",
    englishTitle: "EXECUTION FLOW TOPOLOGY",
    summary: "以只读拓扑呈现规划、实施、训练、验证、审核、发布、回退与失败关闭的合法状态关系。",
    primaryEntity: "ai_execution_flow_definition",
    updateSemantics: "immutable",
    fields: [
      { canonicalName: "flowDefinitionId", displayName: "流程定义身份" },
      { canonicalName: "capabilityDomain", displayName: "能力域" },
      { canonicalName: "sourceState", displayName: "来源状态" },
      { canonicalName: "targetState", displayName: "目标状态" },
      { canonicalName: "transitionGuard", displayName: "转换门禁" },
      { canonicalName: "failureTerminal", displayName: "失败终态" },
    ],
    workAreas: ["正常闭环", "资格门禁", "失败关闭", "回退关系"],
  }),
  workspace({
    moduleSlug: "tasks",
    slug: "history",
    title: "任务记录",
    englishTitle: "TASK HISTORY",
    summary: "按任务定义和执行修订查询不可变任务记录、终态与证据入口，不影响当前任务登记。",
    primaryEntity: "ai_task_execution_history",
    updateSemantics: "append_only",
    fields: [
      { canonicalName: "taskId", displayName: "任务身份" },
      { canonicalName: "executionId", displayName: "执行身份" },
      { canonicalName: "eventSequence", displayName: "事件序号" },
      { canonicalName: "terminalStatus", displayName: "执行终态" },
      { canonicalName: "finishedAtUtc", displayName: "结束时间" },
      { canonicalName: "evidencePath", displayName: "证据入口" },
    ],
    workAreas: ["任务定义", "执行修订", "终态记录", "证据追踪"],
  }),
  listedWorkspace(
    "capabilities", "domains", "能力域", "CAPABILITY DOMAINS",
    "统一呈现AI Painter及未来文字、语言、语音、音频、视频和多模态能力的责任、输入输出与接入状态。",
    "ai_capability_domain", "monotonic_revision",
    [["capabilityDomain", "能力域"], ["displayNameZh", "中文名称"], ["modalities", "模态集合"], ["responsibilityBoundary", "责任边界"], ["adoptionStatus", "接入状态"], ["maturityLevel", "成熟度"]],
    ["能力域目录", "输入输出合同", "模态覆盖", "接入与成熟度"],
  ),
  listedWorkspace(
    "capabilities", "candidates", "候选版本", "CAPABILITY CANDIDATES",
    "查询候选模型、训练范式、数据版本、父级关系和当前资格阶段，不把候选身份误写为发布身份。",
    "ai_capability_version", "append_only",
    [["capabilityVersionId", "能力版本"], ["parentCapabilityVersionId", "父版本"], ["modelIdentity", "模型身份"], ["datasetReleaseIdentity", "数据版本"], ["qualificationStage", "资格阶段"], ["candidateStatus", "候选状态"]],
    ["候选版本列表", "父子血缘", "绑定资产", "资格阶段"],
  ),
  listedWorkspace(
    "capabilities", "qualification", "资格链", "QUALIFICATION CHAIN",
    "按能力生命周期展示CPU合同、只读GPU、Smoke、正式Stage、独立回归和机器发布裁决。",
    "ai_capability_qualification", "append_only",
    [["qualificationGateId", "资格门禁"], ["capabilityVersionId", "能力版本", true], ["gateOrder", "门禁顺序"], ["qualificationStatus", "资格状态"], ["evidenceRequirement", "证据要求"], ["failureTerminal", "失败终态", false]],
    ["资格阶段图", "当前门禁", "失败终态", "发布准入"],
  ),
  listedWorkspace(
    "capabilities", "releases", "发布版本", "CAPABILITY RELEASES",
    "展示由本地系统重新计算并原子登记的能力发布身份、证据绑定、活动版本与回退关系。",
    "ai_capability_release", "append_only",
    [["capabilityReleaseIdentity", "发布身份"], ["capabilityVersionId", "能力版本"], ["modelIdentity", "模型身份"], ["datasetReleaseIdentity", "数据版本"], ["conditionSchemaId", "条件Schema"], ["releaseStatus", "发布状态"]],
    ["活动发布", "证据绑定", "前序版本", "回退关系"],
  ),
  listedWorkspace(
    "capabilities", "migration", "职能迁移", "CAPABILITY MIGRATION",
    "跟踪本地系统对项目工作能力的接管范围、机器验收、外部依赖与安全回退状态。",
    "local_ai_capability_migration", "monotonic_revision",
    [["capabilityId", "能力身份"], ["currentMaturityLevel", "当前等级"], ["targetMaturityLevel", "目标等级"], ["externalDependency", "外部依赖"], ["machineAcceptanceStatus", "机器验收"], ["rollbackIdentity", "回退身份"]],
    ["能力成熟度", "迁移门禁", "依赖退出", "回退准备"],
  ),
  listedWorkspace(
    "training", "overview", "训练总览", "TRAINING OVERVIEW",
    "汇总当前训练身份、Stage、Epoch、Batch、优化步、Loss、预计时间和资源投影，不推测未保存状态。",
    "ai_training_run_projection", "replaceable_projection",
    [["runId", "训练Run"], ["trainingStage", "训练Stage"], ["epoch", "Epoch"], ["optimizationStep", "优化步"], ["loss", "Loss"], ["estimatedCompletionAtUtc", "预计完成时间"]],
    ["运行身份", "训练进度", "核心指标", "资源摘要"],
  ),
  listedWorkspace(
    "training", "plans", "训练计划", "TRAINING PLANS",
    "展示冻结训练配置、数据划分、种子、分辨率、Epoch、阶段依赖和停止条件。",
    "ai_training_plan", "immutable",
    [["trainingPlanId", "训练计划"], ["datasetReleaseIdentity", "数据版本"], ["splitIdentity", "数据划分"], ["randomSeed", "随机种子"], ["nativeResolution", "目标分辨率"], ["parentTerminalRule", "父终态规则"]],
    ["冻结配置", "数据与种子", "阶段依赖", "停止与恢复条件"],
  ),
  listedWorkspace(
    "training", "models", "模型结构", "MODEL ARCHITECTURE",
    "查看模型家族、内部组件、参数隔离、输入输出、能力版本和状态摘要。",
    "ai_model_identity", "immutable",
    [["modelIdentity", "模型身份"], ["modelFamily", "模型家族"], ["componentSet", "组件集合"], ["parameterCount", "参数量"], ["inputContractId", "输入合同"], ["modelStateSha256", "模型状态摘要"]],
    ["模型家族", "组件责任", "输入输出", "参数与状态身份"],
  ),
  listedWorkspace(
    "training", "checkpoints", "Checkpoint", "CHECKPOINT REGISTRY",
    "查询Checkpoint内容身份、来源Stage、父级、资格、选择分数、晋级和禁止复用状态。",
    "ai_checkpoint_identity", "append_only",
    [["checkpointIdentity", "Checkpoint身份"], ["sourceRunId", "来源Run"], ["sourceStage", "来源Stage"], ["parentCheckpointIdentity", "父Checkpoint"], ["qualificationStatus", "资格状态"], ["reusePolicy", "复用策略"]],
    ["身份与血缘", "来源Stage", "资格与分数", "晋级和复用边界"],
  ),
  listedWorkspace(
    "training", "runs", "训练历史", "TRAINING RUNS",
    "按Run查看指标、预览、终态、Manifest、Finalization和资源遥测，不影响当前训练身份。",
    "ai_training_run", "append_only",
    [["runId", "Run身份"], ["trainingPlanId", "训练计划"], ["terminalStatus", "运行终态"], ["manifestEvidenceId", "Manifest证据"], ["finalizationEvidenceId", "Finalization证据"], ["finishedAtUtc", "结束时间"]],
    ["Run目录", "指标与预览", "终态证据", "资源与时间"],
  ),
  listedWorkspace(
    "reviews", "current", "当前验证", "CURRENT VALIDATION",
    "展示当前验证运行、节点、进度、审核器、输入身份和已保存事件，不与训练状态混用。",
    "ai_validation_run_projection", "replaceable_projection",
    [["validationRunId", "验证Run"], ["inputRunId", "输入Run"], ["validationStage", "验证阶段"], ["reviewerIdentity", "审核器身份"], ["nodeProgress", "节点进度"], ["validationStatus", "验证状态"]],
    ["验证身份", "输入绑定", "节点进度", "验证事件"],
  ),
  listedWorkspace(
    "reviews", "results", "审核结果", "MACHINE REVIEW RESULTS",
    "逐节点展示通过或失败、失败码、区域、指标、阈值合同和唯一审核终态。",
    "ai_review_node_result", "append_only",
    [["reviewRunId", "审核运行"], ["reviewNodeId", "审核节点"], ["reviewStatus", "审核状态"], ["failureCode", "失败码"], ["metricValue", "指标值"], ["thresholdContractId", "阈值合同"]],
    ["节点结果", "指标与阈值", "失败区域", "审核终态"],
  ),
  listedWorkspace(
    "reviews", "evidence", "证据查看", "REVIEW EVIDENCE",
    "关联原始预览、规范化副本、SHA-256、参考来源和字节复现关系。",
    "ai_review_evidence", "immutable",
    [["evidenceId", "证据身份"], ["reviewRunId", "审核运行"], ["originalArtifactPath", "原始产物"], ["normalizedArtifactPath", "规范化副本"], ["evidenceSha256", "证据摘要"], ["reproductionIdentity", "复现身份"]],
    ["原始证据", "规范化证据", "来源与参考", "复现关系"],
  ),
  listedWorkspace(
    "reviews", "contracts", "审核合同", "REVIEW CONTRACTS",
    "查询审核器版本、指标定义、冻结阈值、适用能力域和合同替代关系。",
    "ai_review_contract", "immutable",
    [["reviewContractId", "审核合同"], ["reviewerVersion", "审核器版本"], ["metricDefinitionId", "指标定义"], ["thresholdSetId", "阈值集合"], ["capabilityDomain", "适用能力域"], ["supersededBy", "后继合同"]],
    ["审核器目录", "指标定义", "冻结阈值", "适用与替代关系"],
  ),
  listedWorkspace(
    "reviews", "failures", "失败分类", "FAILURE CLASSIFICATION",
    "按视觉失败、身份冲突、基础设施故障、证据不足和政策边界组织失败事实。",
    "ai_review_failure", "append_only",
    [["failureId", "失败身份"], ["failureCode", "失败码"], ["failureCategory", "失败分类"], ["affectedScope", "影响范围"], ["evidenceId", "证据身份"], ["repairEligibility", "修复资格"]],
    ["失败分类树", "证据与范围", "重复模式", "修复准入"],
  ),
  listedWorkspace(
    "data", "releases", "数据发布", "DATASET RELEASES",
    "展示数据发布准入、来源许可、容量与Split门禁；正式发布身份只从独立机器登记读取。",
    "ai_dataset_release_gate", "immutable",
    [["releaseGateId", "发布门禁"], ["gateOrder", "门禁顺序"], ["qualificationRequirement", "资格要求"], ["evidenceRequirement", "证据要求"], ["failureTerminal", "失败终态", false], ["datasetReleaseIdentity", "数据发布身份", true]],
    ["发布准入合同", "来源与许可", "容量与Split", "正式发布记录"],
  ),
  listedWorkspace(
    "data", "samples", "样本目录", "SAMPLE CATALOG",
    "按样本身份、能力域、模态、条件、标签、对象掩码和质量资格浏览数据记录。",
    "ai_dataset_record", "append_only",
    [["recordId", "样本身份"], ["capabilityDomain", "能力域"], ["modality", "模态"], ["conditionSchemaId", "条件Schema"], ["labelSetId", "标签集合"], ["qualityStatus", "质量状态"]],
    ["样本检索", "模态与条件", "标签和掩码", "资格与质量"],
  ),
  listedWorkspace(
    "data", "conditions", "条件Schema", "CONDITION SCHEMA",
    "定义字段或通道顺序、类型、范围、缺失规则、对齐规则和重采样合同。",
    "ai_condition_schema", "immutable",
    [["conditionSchemaId", "条件Schema"], ["fieldOrChannelOrder", "字段或通道顺序"], ["dataType", "数据类型"], ["valueRange", "取值范围"], ["missingValueRule", "缺失规则"], ["resamplingRule", "重采样规则"]],
    ["Schema身份", "字段与通道", "范围和缺失", "对齐与重采样"],
  ),
  listedWorkspace(
    "data", "dictionary", "统一数据字典", "UNIFIED DATA DICTIONARY",
    "查询全平台实体、字段、枚举、单位、权威来源、写入器、敏感级别和兼容关系。",
    "ai_data_dictionary_entry", "monotonic_revision",
    [["dictionaryEntryId", "字典条目"], ["canonicalName", "机器字段名"], ["displayNameZh", "中文名称"], ["dataType", "数据类型"], ["sourceOfTruth", "权威来源"], ["supersededBy", "后继条目"]],
    ["实体目录", "字段定义", "枚举与单位", "版本与兼容"],
  ),
  listedWorkspace(
    "data", "quality", "数据质量", "DATA QUALITY",
    "展示完整性、一致性、分布、重复、泄漏、漂移和异常的质量门禁；真实质量结论只从独立报告登记读取。",
    "ai_dataset_quality_gate", "immutable",
    [["qualityGateId", "质量门禁"], ["qualityDimension", "质量维度"], ["evaluationRequirement", "评估要求"], ["failureTerminal", "失败终态", false], ["modalityScope", "适用模态"], ["qualityReportId", "质量报告", true]],
    ["质量门禁目录", "完整性与一致性", "重复与泄漏", "漂移与异常"],
  ),
  listedWorkspace(
    "runtime", "facts", "权威事实绑定", "AUTHORITATIVE FACT BINDING",
    "查看WorldFacts、VisualFactManifest及world、region、tick、factHash的同身份绑定。",
    "ai_runtime_fact_binding", "immutable",
    [["worldId", "世界身份"], ["regionId", "区域身份"], ["tick", "世界Tick"], ["factHash", "事实摘要"], ["visualFactManifestId", "视觉事实清单"], ["conditionSchemaId", "条件Schema"]],
    ["世界身份", "事实清单", "条件绑定", "一致性证据"],
  ),
  listedWorkspace(
    "runtime", "generations", "生成任务", "RUNTIME GENERATIONS",
    "展示能力版本、条件包、推理执行、候选身份、进度和生成终态。",
    "ai_runtime_generation", "append_only",
    [["generationId", "生成任务"], ["capabilityReleaseIdentity", "能力发布"], ["conditionPackageId", "条件包"], ["runId", "推理Run"], ["candidateIdentity", "候选身份"], ["generationStatus", "生成状态"]],
    ["生成任务队列", "能力与条件", "推理进度", "生成终态"],
  ),
  listedWorkspace(
    "runtime", "candidates", "候选审核", "RUNTIME CANDIDATES",
    "查询候选身份、机器审核、拒绝码、发布资格和与正式Frame的隔离状态。",
    "ai_runtime_frame_candidate", "append_only",
    [["runtimeFrameCandidateIdentity", "Frame候选"], ["generationId", "生成任务"], ["reviewRunId", "审核运行"], ["reviewStatus", "审核状态"], ["failureCode", "拒绝码"], ["publishQualification", "发布资格"]],
    ["候选目录", "审核结果", "拒绝原因", "发布资格"],
  ),
  listedWorkspace(
    "runtime", "frames", "RuntimeFrame", "RUNTIME FRAME REGISTRY",
    "展示Frame候选、正式Frame、能力发布身份、发布事务、回退和世界消费关系。",
    "ai_runtime_frame", "append_only",
    [["runtimeFrameIdentity", "RuntimeFrame"], ["worldId", "世界身份"], ["tick", "世界Tick"], ["capabilityReleaseIdentity", "能力发布"], ["publishIdentity", "发布事务"], ["runtimeFrameStatus", "Frame状态"]],
    ["Frame身份", "运行图层", "发布与消费", "回退关系"],
  ),
  listedWorkspace(
    "runtime", "world", "世界运行", "WORLD RUNTIME",
    "查看当前世界视觉版本、Frame消费、暂停、冻结、恢复和世界运行身份。",
    "ai_world_runtime_projection", "replaceable_projection",
    [["worldId", "世界身份"], ["currentTick", "当前Tick"], ["activeRuntimeFrameIdentity", "活动Frame"], ["consumptionStatus", "消费状态"], ["publishFreezeStatus", "发布冻结"], ["worldRuntimeStatus", "世界状态"]],
    ["世界身份", "Frame消费", "发布冻结", "运行与恢复"],
  ),
  listedWorkspace(
    "evidence", "artifacts", "证据浏览", "EVIDENCE ARTIFACTS",
    "查询新控制台显式登记的内容寻址证据及其原始字节快照；证据类型与保留合同作为独立视图。",
    "ai_console_formal_evidence_artifact", "append_only",
    [
      ["evidenceId", "证据身份"], ["evidenceType", "证据类型"], ["logicalPath", "逻辑路径"], ["integrityStatus", "完整性状态"],
      ["evidenceSequence", "证据序号"], ["registrationId", "登记批次"], ["mediaType", "媒体类型"], ["contentByteLength", "原始字节数"],
      ["contentSha256", "内容摘要"], ["sourceRevision", "来源修订"], ["sourceBindingSha256", "来源绑定摘要"], ["transactionId", "提交事务"],
      ["commandId", "命令身份"], ["registeredAtUtc", "登记时间"], ["storageMode", "保存模式"], ["previousEvidenceRecordSha256", "前序证据摘要", true],
      ["evidenceRecordSha256", "证据记录摘要"], ["evidenceTypeId", "类型合同身份", true], ["requiredIdentityFields", "身份字段", true],
      ["immutabilityRule", "不可变规则", true], ["integrityRule", "完整性规则", true], ["retentionRule", "保留规则", true],
    ],
    ["正式证据记录", "证据类型目录", "身份与完整性", "保留与冲突"],
  ),
  listedWorkspace(
    "evidence", "events", "事件账本", "EVENT LEDGER",
    "按单调事件序号查看执行修订、状态转换、因果关系和绑定事务。",
    "ai_execution_event", "append_only",
    [["eventId", "事件身份"], ["eventSequence", "事件序号"], ["executionId", "执行身份"], ["sourceState", "来源状态"], ["targetState", "目标状态"], ["transactionId", "事务身份"], ["occurredAtUtc", "发生时间"], ["evidencePath", "证据路径"], ["evidenceSha256", "证据摘要"], ["previousEventSha256", "前序事件摘要", true], ["eventSha256", "事件摘要"]],
    ["事件时间线", "状态转换", "因果链", "事务绑定"],
  ),
  listedWorkspace(
    "evidence", "capsules", "任务胶囊", "TASK CAPSULES",
    "查询任务目标、能力、输入、执行、终态和政策边界组成的本地任务胶囊。",
    "ai_task_capsule", "immutable",
    [["capsuleId", "胶囊身份"], ["taskId", "任务身份"], ["capabilityVersionId", "能力版本"], ["inputEvidenceSetId", "输入证据集"], ["terminalStatus", "任务终态"], ["policyBoundaryReportId", "政策边界报告"]],
    ["任务目标", "输入与能力", "执行摘要", "终态与边界"],
  ),
  listedWorkspace(
    "evidence", "transactions", "数据库事务", "RECOVERABLE TRANSACTIONS",
    "展示新控制台控制提交事务，以及文件、事件、SQLite索引的一致性门禁、恢复和冲突合同。",
    "ai_recoverable_transaction_record", "append_only",
    [["transactionId", "事务身份", true], ["transactionSequence", "事务序号", true], ["commandId", "命令身份", true], ["eventId", "事件身份", true], ["commitSurfaceSet", "提交表面集合", true], ["commitStatus", "提交状态", true], ["recoveryStatus", "恢复状态", true], ["receiptPath", "回执路径", true], ["receiptSha256", "回执摘要", true], ["eventSequence", "事件序号", true], ["eventSha256", "事件摘要", true], ["eventLedgerRevision", "事件账本修订", true], ["committedAtUtc", "提交时间", true], ["previousTransactionSha256", "前序事务摘要", true], ["transactionRecordSha256", "事务记录摘要", true], ["transactionGateId", "事务门禁", true], ["gateOrder", "门禁顺序", true], ["commitSurface", "提交表面", true], ["consistencyRequirement", "一致性要求", true], ["failureTerminal", "失败终态", true]],
    ["控制提交事务", "事务提交合同", "文件与事件", "SQLite一致性", "恢复与冲突"],
  ),
  listedWorkspace(
    "evidence", "policies", "政策边界", "POLICY BOUNDARIES",
    "展示长期业务、来源许可、外部费用、不可恢复操作、安全上限和审计真实性的失败关闭规则。",
    "ai_policy_boundary_rule", "immutable",
    [["policyRuleId", "政策规则"], ["boundaryCategory", "边界分类"], ["prohibitedAction", "禁止动作"], ["failureTerminal", "失败终态", false], ["preservationRequirement", "保留要求"], ["safeAlternativeRequirement", "安全替代要求"], ["policyBoundaryReportId", "边界报告", true]],
    ["边界规则目录", "阻断分类", "影响与保持项", "安全替代路线"],
  ),
  listedWorkspace(
    "system", "resources", "资源总览", "RESOURCE OVERVIEW",
    "展示CPU、内存、GPU、显存、磁盘和当前任务占用的本地遥测投影。",
    "ai_resource_sample_projection", "replaceable_projection",
    [["sampledAtUtc", "采样时间"], ["cpuUtilization", "CPU利用率"], ["memoryUtilization", "内存利用率"], ["gpuUtilization", "GPU利用率"], ["vramUtilization", "显存利用率"], ["diskFreeBytes", "磁盘可用空间"]],
    ["计算资源", "内存与显存", "磁盘容量", "任务占用"],
  ),
  listedWorkspace(
    "system", "services", "后台服务", "BACKGROUND SERVICES",
    "查询服务身份、进程、启动方式、心跳、状态和最近错误，不直接管理进程。",
    "ai_background_service", "replaceable_projection",
    [["serviceIdentity", "服务身份"], ["processId", "进程身份"], ["launchMode", "启动方式"], ["heartbeatAtUtc", "最近心跳"], ["serviceStatus", "服务状态"], ["lastFailureCode", "最近错误"]],
    ["服务目录", "进程与启动", "心跳状态", "最近故障"],
  ),
  listedWorkspace(
    "system", "scheduler", "任务调度", "TASK SCHEDULER",
    "展示资源队列、优先级、时间窗口、容量策略和调度决策证据。",
    "ai_scheduler_projection", "monotonic_revision",
    [["schedulerRevision", "调度修订"], ["queueItemId", "队列项"], ["priority", "优先级"], ["resourceWindowId", "资源窗口"], ["capacityPolicyId", "容量策略"], ["schedulingStatus", "调度状态"]],
    ["资源队列", "优先级", "时间窗口", "容量策略"],
  ),
  listedWorkspace(
    "system", "health", "健康检查", "SYSTEM HEALTH",
    "汇总Python、CUDA、Node、数据库、磁盘和证据目录的确定性健康检查。",
    "ai_system_health_check", "append_only",
    [["healthCheckId", "检查身份"], ["componentId", "组件身份"], ["componentVersion", "组件版本"], ["healthStatus", "健康状态"], ["failureCode", "失败码"], ["checkedAtUtc", "检查时间"]],
    ["运行环境", "GPU与驱动", "数据库与磁盘", "证据目录"],
  ),
  listedWorkspace(
    "system", "telemetry", "遥测历史", "TELEMETRY HISTORY",
    "按时间查看资源采样、峰值、趋势和异常，不以控制台文字替代机器采样。",
    "ai_resource_sample", "append_only",
    [["resourceSampleId", "采样身份"], ["sampledAtUtc", "采样时间"], ["resourceType", "资源类型"], ["sampleValue", "采样值"], ["unit", "单位"], ["anomalyStatus", "异常状态"]],
    ["采样时间线", "资源趋势", "峰值记录", "异常事件"],
  ),
  listedWorkspace(
    "archive", "search", "全局检索", "GLOBAL SEARCH",
    "按统一身份、时间、状态、能力、数据和SHA-256检索历史记录。",
    "ai_archive_search_projection", "replaceable_projection",
    [["queryIdentity", "查询身份"], ["identityFilter", "身份条件"], ["capabilityDomain", "能力域"], ["statusFilter", "状态条件"], ["timeRange", "时间范围"], ["sha256Filter", "摘要条件"]],
    ["统一搜索", "身份过滤", "时间与状态", "证据摘要定位"],
  ),
  listedWorkspace(
    "archive", "training", "训练归档", "TRAINING ARCHIVE",
    "查询历史训练Run、Checkpoint、预览、指标、终态和对应证据。",
    "ai_training_archive_record", "append_only",
    [["runId", "训练Run"], ["checkpointIdentity", "Checkpoint"], ["terminalStatus", "运行终态"], ["previewEvidenceId", "预览证据"], ["metricSetId", "指标集合"], ["archivedAtUtc", "归档时间"]],
    ["Run归档", "Checkpoint血缘", "指标与预览", "终态证据"],
  ),
  listedWorkspace(
    "archive", "reviews", "审核归档", "REVIEW ARCHIVE",
    "查询历史验证批次、审核节点、失败码、终态和证据集合。",
    "ai_review_archive_record", "append_only",
    [["reviewRunId", "审核运行"], ["validationRunId", "验证Run"], ["reviewNodeCount", "审核节点数"], ["terminalStatus", "审核终态"], ["failureCodeSet", "失败码集合"], ["evidenceSetId", "证据集合"]],
    ["验证批次", "审核节点", "失败码", "证据归档"],
  ),
  listedWorkspace(
    "archive", "generations", "生成归档", "GENERATION ARCHIVE",
    "查询历史生成任务、候选、RuntimeFrame、发布、拒绝和回退记录。",
    "ai_generation_archive_record", "append_only",
    [["generationId", "生成任务"], ["candidateIdentity", "候选身份"], ["runtimeFrameIdentity", "RuntimeFrame"], ["publishIdentity", "发布事务"], ["terminalStatus", "生成终态"], ["rollbackIdentity", "回退身份"]],
    ["生成任务", "候选与Frame", "发布与拒绝", "回退历史"],
  ),
  listedWorkspace(
    "archive", "contracts", "历史合同", "HISTORICAL CONTRACTS",
    "只读复核已停用合同、原始字节摘要和替代关系，禁止其参与当前解析。",
    "ai_historical_contract", "append_only",
    [["contractIdentity", "合同身份"], ["contractSha256", "合同摘要"], ["historicalStatus", "历史状态"], ["supersededBy", "后继合同"], ["retiredAtUtc", "停用时间"], ["newWorkEligibility", "新任务资格"]],
    ["历史合同目录", "原始摘要", "替代关系", "新任务隔离"],
  ),
  listedWorkspace(
    "control", "tasks", "任务控制", "TASK CONTROL CONTRACT",
    "定义启动已登记任务、暂停或恢复队列、调整优先级和取消未启动任务的命令合同。",
    "ai_control_command_definition", "immutable",
    controlDefinitionFields,
    ["允许命令", "目标与修订", "幂等和冲突", "结果证据"],
  ),
  listedWorkspace(
    "control", "training", "训练控制", "TRAINING CONTROL CONTRACT",
    "定义启动合格训练、安全点暂停、合法恢复、安全停止和时间窗口命令。",
    "ai_training_control_definition", "immutable",
    controlDefinitionFields,
    ["训练准入", "安全暂停", "合法恢复", "安全停止"],
  ),
  listedWorkspace(
    "control", "reviews", "验证控制", "REVIEW CONTROL CONTRACT",
    "定义正式验证、只读审核重跑、状态投影重建和证据检查命令。",
    "ai_review_control_definition", "immutable",
    controlDefinitionFields,
    ["正式验证", "只读复核", "投影重建", "证据检查"],
  ),
  listedWorkspace(
    "control", "capabilities", "能力控制", "CAPABILITY CONTROL CONTRACT",
    "定义激活合格能力、停用、合法回退和自动更新开关的命令合同。",
    "ai_capability_control_definition", "immutable",
    controlDefinitionFields,
    ["激活准入", "停用条件", "合法回退", "自动更新策略"],
  ),
  listedWorkspace(
    "control", "world", "世界控制", "WORLD CONTROL CONTRACT",
    "定义暂停或恢复Frame发布、回退正式Frame和冻结视觉更新的命令合同。",
    "ai_world_control_definition", "immutable",
    controlDefinitionFields,
    ["发布暂停", "Frame回退", "视觉冻结", "世界身份核验"],
  ),
  listedWorkspace(
    "control", "resources", "资源控制", "RESOURCE CONTROL CONTRACT",
    "定义合同允许的资源窗口、资源上限、安全缓存和服务管理命令。",
    "ai_resource_control_definition", "immutable",
    controlDefinitionFields,
    ["资源窗口", "资源上限", "安全缓存", "服务目标"],
  ),
  listedWorkspace(
    "control", "emergency", "紧急控制", "EMERGENCY CONTROL CONTRACT",
    "定义紧急停止、冻结新任务、冻结世界发布并保存现场证据的最高优先级命令合同。",
    "ai_emergency_stop_definition", "immutable",
    controlDefinitionFields,
    ["紧急停止", "新任务冻结", "世界发布冻结", "现场证据"],
  ),
] as const

export function getAiConsoleWorkspaces(moduleSlug: string) {
  return aiConsoleWorkspaceDefinitions.filter((workspaceDefinition) => workspaceDefinition.moduleSlug === moduleSlug)
}

export function getAiConsoleWorkspace(moduleSlug: string, workspaceSlug: string) {
  return aiConsoleWorkspaceDefinitions.find(
    (workspaceDefinition) => workspaceDefinition.moduleSlug === moduleSlug && workspaceDefinition.slug === workspaceSlug,
  )
}

export function getAiConsoleModuleRelationContract(moduleSlug: string): AiConsoleModuleRelationContract | undefined {
  return moduleRelationContracts[moduleSlug as keyof typeof moduleRelationContracts]
}

export function getAiConsoleWorkspaceNeighbors(moduleSlug: string, workspaceSlug: string) {
  const moduleWorkspaces = getAiConsoleWorkspaces(moduleSlug)
  const currentIndex = moduleWorkspaces.findIndex((workspaceDefinition) => workspaceDefinition.slug === workspaceSlug)
  if (currentIndex < 0) return { previous: undefined, next: undefined }
  return {
    previous: currentIndex > 0 ? moduleWorkspaces[currentIndex - 1] : undefined,
    next: currentIndex < moduleWorkspaces.length - 1 ? moduleWorkspaces[currentIndex + 1] : undefined,
  }
}

export function validateAiConsoleWorkspaceCatalog() {
  const diagnostics: string[] = []
  const routeSet = new Set<string>()
  for (const workspaceDefinition of aiConsoleWorkspaceDefinitions) {
    if (routeSet.has(workspaceDefinition.route)) diagnostics.push(`duplicate_route:${workspaceDefinition.route}`)
    routeSet.add(workspaceDefinition.route)
    if (workspaceDefinition.fields.length < 4) diagnostics.push(`insufficient_fields:${workspaceDefinition.route}`)
    if (workspaceDefinition.workAreas.length < 4) diagnostics.push(`insufficient_work_areas:${workspaceDefinition.route}`)
  }
  return {
    ok: diagnostics.length === 0 && aiConsoleWorkspaceDefinitions.length === 52,
    workspaceCount: aiConsoleWorkspaceDefinitions.length,
    routeCount: routeSet.size,
    diagnostics,
  }
}
