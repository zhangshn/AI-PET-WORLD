export type AiConsolePlane = "observation" | "control"

export type AiConsoleSecondaryModule = {
  slug: string
  title: string
  status: "content_ready"
  route?: string
}

export type AiConsoleModule = {
  id: `AP-${string}`
  slug: string
  title: string
  englishTitle: string
  plane: AiConsolePlane
  route: string
  summary: string
  responsibilities: readonly string[]
  secondaryModules: readonly AiConsoleSecondaryModule[]
}

export type AiCapabilityDomain = {
  id: string
  name: string
  status: "current" | "reserved"
  description: string
  modalities: readonly string[]
}

export type AiConsoleFramework = {
  id: `FRAME-${string}`
  title: string
  englishTitle: string
  summary: string
  moduleSlugs: readonly string[]
  plane: AiConsolePlane
}

const workspace = (slug: string, title: string): AiConsoleSecondaryModule => ({
  slug,
  title,
  status: "content_ready",
})

export const aiCapabilityDomains: readonly AiCapabilityDomain[] = [
  {
    id: "visual_world_generation",
    name: "AI Painter",
    status: "current",
    description: "当前接入能力域：完整地图视觉生成、验证、机器审核与RuntimeFrame证据。",
    modalities: ["图像", "结构化世界事实", "RuntimeFrame"],
  },
  {
    id: "text_and_language",
    name: "文字与语言",
    status: "reserved",
    description: "预留文本生成、语言理解、知识组织和对话能力的统一平台入口。",
    modalities: ["文字", "语言"],
  },
  {
    id: "speech_and_audio",
    name: "语音与音频",
    status: "reserved",
    description: "预留语音识别、语音合成、环境音频及相应审核能力。",
    modalities: ["语音", "音频"],
  },
  {
    id: "video_generation",
    name: "视频",
    status: "reserved",
    description: "预留视频生成、时间一致性验证、审核和发布能力。",
    modalities: ["视频"],
  },
  {
    id: "multimodal_orchestration",
    name: "多模态",
    status: "reserved",
    description: "预留图像、文字、语音、音频、视频与世界事实的联合任务编排。",
    modalities: ["多模态"],
  },
] as const

export const aiConsoleModules: readonly AiConsoleModule[] = [
  {
    id: "AP-01",
    slug: "tasks",
    title: "任务与执行中心",
    englishTitle: "TASKS & EXECUTIONS",
    plane: "observation",
    route: "/ai-console/tasks",
    summary: "统一观察当前项目任务、活动执行、任务队列、自动闭环和执行拓扑。",
    responsibilities: [
      "分离当前项目任务、活动执行、最近训练终态与历史选择",
      "展示本地编排器的任务状态、心跳、资源等待与失败关闭",
    ],
    secondaryModules: [
      workspace("current", "当前项目任务"),
      workspace("active", "活动执行"),
      workspace("queue", "任务队列"),
      workspace("flows", "闭环拓扑"),
      workspace("history", "任务记录"),
    ],
  },
  {
    id: "AP-02",
    slug: "capabilities",
    title: "能力建设中心",
    englishTitle: "CAPABILITY LIFECYCLE",
    plane: "observation",
    route: "/ai-console/capabilities",
    summary: "管理能力域、候选版本、资格链、发布身份、回退关系和职能迁移。",
    responsibilities: [
      "从设计、实施、资格到发布追踪能力全生命周期",
      "区分当前AI Painter与未来文字、语音、视频和多模态能力",
    ],
    secondaryModules: [
      workspace("domains", "能力域"),
      workspace("candidates", "候选版本"),
      workspace("qualification", "资格链"),
      workspace("releases", "发布版本"),
      workspace("migration", "职能迁移"),
    ],
  },
  {
    id: "AP-03",
    slug: "training",
    title: "训练与模型中心",
    englishTitle: "TRAINING & MODELS",
    plane: "observation",
    route: "/ai-console/training",
    summary: "汇总训练计划、模型结构、Stage、指标、Checkpoint、资源和训练历史。",
    responsibilities: [
      "以能力域和模型身份组织训练，不把单一Run冒充平台状态",
      "训练总览、计划、模型、Checkpoint和历史均由新平台自己的查询合同承载",
    ],
    secondaryModules: [
      workspace("overview", "训练总览"),
      workspace("plans", "训练计划"),
      workspace("models", "模型结构"),
      workspace("checkpoints", "Checkpoint"),
      workspace("runs", "训练历史"),
    ],
  },
  {
    id: "AP-04",
    slug: "reviews",
    title: "验证与机器审核中心",
    englishTitle: "VALIDATION & MACHINE REVIEW",
    plane: "observation",
    route: "/ai-console/reviews",
    summary: "集中展示验证过程、审核节点、审核器身份、失败码、终态和证据完整性。",
    responsibilities: [
      "验证过程、机器审核与训练状态采用不同状态机",
      "审核结果只来自冻结合同、机器观测和服务端唯一裁决",
    ],
    secondaryModules: [
      workspace("current", "当前验证"),
      workspace("results", "审核结果"),
      workspace("evidence", "证据查看"),
      workspace("contracts", "审核合同"),
      workspace("failures", "失败分类"),
    ],
  },
  {
    id: "AP-05",
    slug: "data",
    title: "数据与条件中心",
    englishTitle: "DATA & CONDITIONS",
    plane: "observation",
    route: "/ai-console/data",
    summary: "管理数据发布、split、样本、条件Schema、来源许可、质量与统一数据字典。",
    responsibilities: [
      "统一图片、文字、语言、语音、音频、视频和多模态数据语义",
      "固定字段名称、类型、单位、来源、写入器、版本和兼容关系",
    ],
    secondaryModules: [
      workspace("releases", "数据发布"),
      workspace("samples", "样本目录"),
      workspace("conditions", "条件Schema"),
      workspace("dictionary", "统一数据字典"),
      workspace("quality", "数据质量"),
    ],
  },
  {
    id: "AP-06",
    slug: "runtime",
    title: "世界生成与Runtime中心",
    englishTitle: "WORLD GENERATION & RUNTIME",
    plane: "observation",
    route: "/ai-console/runtime",
    summary: "观察权威世界事实绑定、生成任务、候选、RuntimeFrame、发布和世界消费。",
    responsibilities: [
      "AI产物表达WorldFacts，不得反向改写世界事实",
      "候选、机器审核、正式发布和回退拥有独立身份",
    ],
    secondaryModules: [
      workspace("facts", "权威事实绑定"),
      workspace("generations", "生成任务"),
      workspace("candidates", "候选审核"),
      workspace("frames", "RuntimeFrame"),
      workspace("world", "世界运行"),
    ],
  },
  {
    id: "AP-07",
    slug: "evidence",
    title: "证据与治理中心",
    englishTitle: "EVIDENCE & GOVERNANCE",
    plane: "observation",
    route: "/ai-console/evidence",
    summary: "查询不可变证据、SHA-256、事件账本、任务胶囊、事务和政策边界。",
    responsibilities: [
      "文件、事件与SQLite以可恢复事务保持一致",
      "失败证据不可删除，历史合同不可参与当前任务选择",
    ],
    secondaryModules: [
      workspace("artifacts", "证据浏览"),
      workspace("events", "事件账本"),
      workspace("capsules", "任务胶囊"),
      workspace("transactions", "数据库事务"),
      workspace("policies", "政策边界"),
    ],
  },
  {
    id: "AP-08",
    slug: "system",
    title: "系统资源与后台服务",
    englishTitle: "SYSTEM & SERVICES",
    plane: "observation",
    route: "/ai-console/system",
    summary: "展示CPU、内存、GPU、磁盘、后台服务、心跳、队列和资源策略。",
    responsibilities: [
      "区分训练负载、非训练负载、服务健康和资源门禁",
      "关闭控制台或浏览器不得中断后台服务和状态记录",
    ],
    secondaryModules: [
      workspace("resources", "资源总览"),
      workspace("services", "后台服务"),
      workspace("scheduler", "任务调度"),
      workspace("health", "健康检查"),
      workspace("telemetry", "遥测历史"),
    ],
  },
  {
    id: "AP-09",
    slug: "archive",
    title: "历史归档与全局检索",
    englishTitle: "ARCHIVE & SEARCH",
    plane: "observation",
    route: "/ai-console/archive",
    summary: "按能力、任务、Run、模型、数据、时间和终态检索历史记录。",
    responsibilities: [
      "历史选择只影响只读工作区，不得改写当前任务",
      "保留历史证据和替代关系，但不允许旧合同恢复执行权",
    ],
    secondaryModules: [
      workspace("search", "全局检索"),
      workspace("training", "训练归档"),
      workspace("reviews", "审核归档"),
      workspace("generations", "生成归档"),
      workspace("contracts", "历史合同"),
    ],
  },
  {
    id: "AP-10",
    slug: "control",
    title: "操作与安全控制中心",
    englishTitle: "OPERATIONS & SAFETY CONTROL",
    plane: "control",
    route: "/ai-console/control",
    summary: "为本地操作员提供任务、训练、审核、能力、世界、资源和紧急控制合同与已登记安全入口。",
    responsibilities: [
      "人工控制是可选覆盖，不是自主运行的逐步审批",
      "所有写操作必须进入本地命令状态机并由服务端复核",
    ],
    secondaryModules: [
      workspace("tasks", "任务控制"),
      workspace("training", "训练控制"),
      workspace("reviews", "验证控制"),
      workspace("capabilities", "能力控制"),
      workspace("world", "世界控制"),
      workspace("resources", "资源控制"),
      workspace("emergency", "紧急控制"),
    ],
  },
] as const

export const aiConsoleFrameworks: readonly AiConsoleFramework[] = [
  {
    id: "FRAME-01",
    title: "自主任务与能力闭环",
    englishTitle: "AUTONOMOUS DELIVERY LOOP",
    summary: "从任务建立、能力建设、模型训练到机器审核，形成可持续运行的本地AI能力交付闭环。",
    moduleSlugs: ["tasks", "capabilities", "training", "reviews"],
    plane: "observation",
  },
  {
    id: "FRAME-02",
    title: "数据、生成与世界运行",
    englishTitle: "DATA TO WORLD RUNTIME",
    summary: "以统一数据和条件为输入，连接生成候选、RuntimeFrame发布与世界消费。",
    moduleSlugs: ["data", "runtime"],
    plane: "observation",
  },
  {
    id: "FRAME-03",
    title: "平台基础设施与可追溯治理",
    englishTitle: "PLATFORM ASSURANCE",
    summary: "通过不可变证据、资源与后台服务、历史归档和检索保证系统可运行、可解释、可恢复。",
    moduleSlugs: ["evidence", "system", "archive"],
    plane: "observation",
  },
  {
    id: "FRAME-04",
    title: "人工操作与安全控制",
    englishTitle: "HUMAN OPERATIONS & SAFETY",
    summary: "在不破坏自主闭环的前提下，提供独立、受控、可审计的本地人工干预能力。",
    moduleSlugs: ["control"],
    plane: "control",
  },
] as const
