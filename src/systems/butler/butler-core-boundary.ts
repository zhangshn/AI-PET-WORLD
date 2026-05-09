/**
 * 当前文件负责：声明管家核心系统在十层架构中的安全边界与模块访问规则。
 */

export type ButlerCoreBoundaryLayer =
  | "public_gateway"
  | "memory_relation"
  | "autonomous_drive"
  | "education"
  | "message_decision"
  | "behavior_execution"
  | "runtime_orchestration"
  | "tuning"
  | "type_boundary"
  | "test_or_ui"

export type ButlerCoreBoundaryModule = {
  layer: ButlerCoreBoundaryLayer
  path: string
  role: string
  accessRule: string
}

export const BUTLER_CORE_PUBLIC_GATEWAYS: ButlerCoreBoundaryModule[] = [
  {
    layer: "public_gateway",
    path: "src/systems/butler/butler-gateway.ts",
    role: "管家系统统一公开入口。",
    accessRule:
      "外部系统原则上只允许通过该 gateway 访问管家系统，不直接深层 import 子模块实现。",
  },
  {
    layer: "public_gateway",
    path: "src/ai/gateway.ts",
    role: "AI 核心统一公开入口。",
    accessRule:
      "世界引擎、测试页、系统层应优先通过该 gateway 访问 AI 核心能力。",
  },
]

export const BUTLER_CORE_MEMORY_RELATION_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "memory_relation",
    path: "src/systems/butler/memory-relation",
    role: "管家记忆 / 关系层。",
    accessRule:
      "只记录管家经历、任务判断、机会反馈、宠物关系和经验解释，不直接执行行为。",
  },
]

export const BUTLER_CORE_AUTONOMOUS_DRIVE_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "autonomous_drive",
    path: "src/systems/butler/task",
    role: "管家当前任务选择与任务决策 trace。",
    accessRule:
      "只能形成任务倾向和任务解释，不直接替宠物决定行为；后续会逐步拆入 intention / education / message-decision。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/butler/intention/state-interpretation",
    role: "管家状态解释 / 情绪表现推导入口。",
    accessRule:
      "只根据管家任务和状态推导 mood / 状态解释，不直接决定 task、message 或 behavior。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/butler/intention",
    role: "管家意图形成预留目录。",
    accessRule:
      "只形成管家为何想靠近、等待、解释、保护、提供机会或不行动的意图，不直接执行行为。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/butler/butler-mood-runner.ts",
    role: "管家 mood 推导辅助。",
    accessRule:
      "只作为状态解释输入，不直接决定 task、message 或 behavior；后续可归入 intention。",
  },
]

export const BUTLER_CORE_EDUCATION_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "education",
    path: "src/systems/butler/education",
    role: "管家幼儿期宠物照看 / 教育判断预留目录。",
    accessRule:
      "只能判断如何在不剥夺宠物自主性的前提下提供机会、保护、等待或引导，不直接控制宠物行为。",
  },
  {
    layer: "education",
    path: "src/systems/butler/education/opportunity",
    role: "管家机会判断与机会状态管理入口。",
    accessRule:
      "只判断机会是否可创建、冷却是否允许、机会是否待处理，不直接控制宠物行为。",
  },
  {
    layer: "education",
    path: "src/systems/butler/butler-opportunity-runner.ts",
    role: "当前管家机会创建与冷却混合模块。",
    accessRule:
      "当前保留旧实现；后续逐步拆分到 education / behavior。管家机会只能成为宠物判断输入。",
  },
]

export const BUTLER_CORE_MESSAGE_DECISION_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "message_decision",
    path: "src/systems/butler/message-decision",
    role: "管家是否主动联系玩家的判断预留目录。",
    accessRule:
      "只判断管家是否形成联系玩家的表达意图，不把事件自动转成 P-Phone 消息。",
  },
]

export const BUTLER_CORE_BEHAVIOR_EXECUTION_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "behavior_execution",
    path: "src/systems/butler/behavior",
    role: "管家行为执行层预留目录。",
    accessRule:
      "只把上层意图表达为可见行为或世界操作，不负责意图判断。",
  },
  {
    layer: "behavior_execution",
    path: "src/systems/butler/behavior/opportunity-action",
    role: "管家提供食物、休息、靠近机会的行为入口。",
    accessRule:
      "只创建可供宠物自主判断的机会，不代表宠物必须接受。",
  },
]

export const BUTLER_CORE_RUNTIME_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "runtime_orchestration",
    path: "src/systems/butler/runtime-orchestration",
    role: "管家运行编排层预留目录。",
    accessRule:
      "只编排管家单 Tick / 单次世界更新流程，不写具体业务判断；后续应逐步只调用各层 gateway。",
  },
  {
    layer: "runtime_orchestration",
    path: "src/systems/butlerSystem.ts",
    role: "当前管家系统总运行入口。",
    accessRule:
      "当前保留旧实现；后续逐步收口到 butler runtime-orchestration。禁止继续变重。",
  },
]

export const BUTLER_CORE_TUNING_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "tuning",
    path: "src/systems/butler/butler-profile-tuning.ts",
    role: "管家人格相关任务调参入口。",
    accessRule:
      "只做 profile tendency 到任务倾向的调参适配，不写具体任务执行流程。",
  },
  {
    layer: "tuning",
    path: "src/systems/butler/tuning/profile-tendency",
    role: "管家人格倾向调参入口。",
    accessRule:
      "只把 ButlerProfile 转换为任务选择层可读取的轻量调参，不直接决定 task、message 或 behavior。",
  },
]



export const BUTLER_CORE_TYPE_BOUNDARY_MODULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "type_boundary",
    path: "src/systems/butler/butler-schema.ts",
    role: "管家系统共享类型边界。",
    accessRule:
      "只定义类型和结构，不写运行逻辑。",
  },
]

export const BUTLER_CORE_TEST_OR_UI_RULES: ButlerCoreBoundaryModule[] = [
  {
    layer: "test_or_ui",
    path: "src/app/world",
    role: "正式世界展示层。",
    accessRule:
      "只展示管家结果和管家消息结果，不写管家判断逻辑，不把 P-Phone 写成系统日志。",
  },
  {
    layer: "test_or_ui",
    path: "src/app/personality-test",
    role: "测试页与调试展示层。",
    accessRule:
      "只能展示核心输出或调用 gateway，不允许把管家核心判断复制到测试页中。",
  },
]

export const BUTLER_CORE_FORBIDDEN_RULES = [
  "禁止把管家写成普通 NPC。",
  "禁止把管家消息写成系统日志。",
  "禁止事件发生就自动发 P-Phone 消息。",
  "禁止玩家直接控制管家；玩家只能通过互动影响管家判断。",
  "禁止管家替宠物做决定。",
  "禁止管家直接写入宠物 learning。",
  "禁止管家机会直接变成宠物行为；机会必须经过宠物自身判断链。",
  "禁止 butlerSystem.ts 继续堆复杂业务判断。",
  "禁止 UI / P-Phone 深层 import 管家内部判断模块。",
  "禁止把 message-decision 写成事件触发器。",
  "禁止为了短期表现丰富，把管家主体链路退回脚本触发器。",
]

export const BUTLER_CORE_ALLOWED_CHAIN = [
  "world state",
  "pet state",
  "player interaction",
  "butler profile tendency",
  "butler memory / relation",
  "task tendency",
  "intention",
  "education judgment",
  "message decision",
  "behavior execution",
  "memory update",
  "relation update",
  "long-term experience",
]

export const BUTLER_CORE_BOUNDARY_SUMMARY = {
  productDirection:
    "AI-PET-WORLD 的管家不是 NPC，而是用户生命数据映射 / 平行世界人格投射的自主意识管理者。",
  corePrinciple:
    "管家拥有自主判断，可以照看、教育、保护、解释和管理环境，但不能替宠物做决定。",
  infantCarePrinciple:
    "宠物幼儿期没有生活记忆，管家承担照看和教育职责，但只能提供机会和环境，宠物必须自主判断。",
  messagePrinciple:
    "P-Phone 是管家可能主动联系玩家的入口，不是系统日志；消息必须来自管家判断。",
  safetyPrinciple:
    "管家系统通过 gateway / boundary / tuning 封装，避免 UI、P-Phone 和临时业务逻辑污染核心。",
}

export const BUTLER_CORE_BOUNDARY_MODULES = [
  ...BUTLER_CORE_PUBLIC_GATEWAYS,
  ...BUTLER_CORE_MEMORY_RELATION_MODULES,
  ...BUTLER_CORE_AUTONOMOUS_DRIVE_MODULES,
  ...BUTLER_CORE_EDUCATION_MODULES,
  ...BUTLER_CORE_MESSAGE_DECISION_MODULES,
  ...BUTLER_CORE_BEHAVIOR_EXECUTION_MODULES,
  ...BUTLER_CORE_RUNTIME_MODULES,
  ...BUTLER_CORE_TUNING_MODULES,
  ...BUTLER_CORE_TYPE_BOUNDARY_MODULES,
  ...BUTLER_CORE_TEST_OR_UI_RULES,
]
