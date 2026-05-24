/**
 * 当前文件负责：声明宠物核心系统在十层架构中的安全边界与模块访问规则。
 */

export type PetCoreBoundaryLayer =
  | "public_gateway"
  | "daily_state"
  | "memory_relation"
  | "learning"
  | "autonomous_drive"
  | "behavior_execution"
  | "runtime_orchestration"
  | "world_event_boundary"
  | "world_influence"
  | "tuning"
  | "test_or_ui"

export type PetCoreBoundaryModule = {
  layer: PetCoreBoundaryLayer
  path: string
  role: string
  accessRule: string
}

export const PET_CORE_PUBLIC_GATEWAYS: PetCoreBoundaryModule[] = [
  {
    layer: "public_gateway",
    path: "src/systems/pet/pet-gateway.ts",
    role: "宠物系统统一公开入口。",
    accessRule:
      "外部系统原则上只允许通过该 gateway 访问宠物系统，不直接深层 import 子模块实现。",
  },
  {
    layer: "public_gateway",
    path: "src/ai/gateway.ts",
    role: "AI 核心统一公开入口。",
    accessRule:
      "世界引擎、测试页、系统层应优先通过该 gateway 访问 AI 核心能力。",
  },
]

export const PET_CORE_DAILY_STATE_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "daily_state",
    path: "src/systems/pet/daily-state",
    role: "宠物生命日常状态层预留目录。",
    accessRule:
      "只维护宠物吃喝拉撒睡、清洁、安全感、注意力、环境熟悉度等当下状态，不直接决定行为。",
  },
  {
    layer: "daily_state",
    path: "src/systems/pet/pet-life",
    role: "宠物生命阶段推进层。",
    accessRule:
      "当前仍作为生命阶段推进模块保留；后续状态类逻辑应逐步迁入 daily-state。",
  },
  {
    layer: "daily_state",
    path: "src/systems/pet/pet-mood",
    role: "宠物情绪状态映射层。",
    accessRule:
      "只处理 mood / emotion 相关状态映射，不直接选择 action。",
  },
  {
    layer: "daily_state",
    path: "src/systems/pet/pet-feeding",
    role: "当前包含食物机会评估与喂食状态效果的混合模块。",
    accessRule:
      "后续应拆分：饥饿/饱腹进入 daily-state，接受判断进入 autonomous_drive，实际效果进入 behavior_execution。",
  },
]

export const PET_CORE_MEMORY_RELATION_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "memory_relation",
    path: "src/ai/memory-core",
    role: "通用记忆核心。",
    accessRule:
      "记忆不是日志；只能通过 memory gateway 更新，不允许 UI 直接写入核心记忆字段。",
  },
  {
    layer: "memory_relation",
    path: "src/systems/pet/memory-relation",
    role: "宠物记忆 / 关系层预留目录。",
    accessRule:
      "只记录经历、关系和可被 learning 读取的经验材料，不直接输出 action。",
  },
]

export const PET_CORE_LEARNING_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "learning",
    path: "src/ai/learning-core",
    role: "通用 AI 学习核心预留目录。",
    accessRule:
      "learning 从 memory / relation 中形成经验，不替代原始 memory，不直接控制行为。",
  },
  {
    layer: "learning",
    path: "src/systems/pet/learning",
    role: "宠物学习层预留目录。",
    accessRule:
      "只沉淀熟悉度、习惯、信任学习、边界意识等经验结果，不绕过 drive / goal / attention。",
  },
]

export const PET_CORE_AUTONOMOUS_DRIVE_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/drive",
    role: "宠物 drive 计算系统。",
    accessRule:
      "只能输出内部驱动倾向，不直接输出 action；参数统一放在 pet-drive-tuning.ts。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/goal",
    role: "宠物 goal 计算系统。",
    accessRule:
      "只能输出目标解释和目标方向，不直接输出 action；参数统一放在 pet-goal-tuning.ts。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/attention",
    role: "宠物 attention 计算系统。",
    accessRule:
      "只输出当前注意力焦点和注意状态，不直接决定行为。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/action-intention",
    role: "宠物行为意图选择与稳定控制入口。",
    accessRule:
      "只选择 raw action intent 和处理 action stability，不执行最终行为，也不绕过 drive / goal / attention。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/cognition/perception",
    role: "宠物感知 / 主体解释入口。",
    accessRule:
      "只把 world signal 转换为宠物主体解释，不直接决定 action，也不绕过 drive / goal / attention。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/opportunity-decision",
    role: "宠物机会接受 / 拒绝判断入口。",
    accessRule:
      "只判断宠物是否接受机会，不执行机会效果，不直接修改行为结果。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/pet-cognition",
    role: "宠物对世界刺激的主体解释层。",
    accessRule:
      "只把世界 signal 转为 cognition，不直接决定 action；后续将逐步迁入 cognition/perception。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/pet-action",
    role: "宠物内部行为意图选择与稳定控制。",
    accessRule:
      "action selector 只选择 raw intent；不得直接读取世界实体刺激，不得绕过 drive / goal / attention；后续将逐步迁入 action-intention。",
  },
  {
    layer: "autonomous_drive",
    path: "src/systems/pet/pet-opportunity",
    role: "当前包含机会接受判断与机会效果的混合模块。",
    accessRule:
      "后续应拆分：接受 / 拒绝判断归 autonomous_drive，接受后的实际效果归 behavior_execution。",
  },
]

export const PET_CORE_BEHAVIOR_EXECUTION_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "behavior_execution",
    path: "src/ai/behavior-core",
    role: "通用行为过程核心。",
    accessRule:
      "只负责行为过程表达，不直接读取命理核心来决定行为。",
  },
  {
    layer: "behavior_execution",
    path: "src/systems/pet/behavior",
    role: "宠物行为执行层预留目录。",
    accessRule:
      "只负责把上层意图表达为行为，不负责主体判断。",
  },
  {
    layer: "behavior_execution",
    path: "src/systems/pet/behavior/opportunity-effect",
    role: "宠物接受机会后的实际效果执行入口。",
    accessRule:
      "只执行已接受机会的效果，不负责判断宠物是否应该接受机会。",
  },
  {
    layer: "behavior_execution",
    path: "src/systems/pet/behavior/expression",
    role: "宠物可见行为表达入口。",
    accessRule:
      "只把上层意图表达为可见行为，不负责 drive / goal / attention / learning 判断。",
  },
  {
    layer: "behavior_execution",
    path: "src/systems/pet/pet-expression",
    role: "把内部意图转换为当前阶段可见行为表达。",
    accessRule:
      "只处理 visible expression，不反向覆盖 drive / goal；参数统一放在 pet-expression-tuning.ts。",
  },
]

export const PET_CORE_RUNTIME_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "runtime_orchestration",
    path: "src/systems/pet/runtime-orchestration",
    role: "宠物单 Tick 运行编排公开入口。",
    accessRule:
      "只作为运行编排入口，不写具体业务判断；后续应逐步只调用各层 gateway。",
  },
  {
    layer: "runtime_orchestration",
    path: "src/systems/pet/pet-runtime/pet-runtime-runner.ts",
    role: "宠物单 Tick 运行编排层。",
    accessRule:
      "只允许系统层或 pet-gateway 调用；UI 和测试页不得直接修改这里的运行链路；后续将逐步迁入 runtime-orchestration。",
  },
]

export const PET_CORE_WORLD_EVENT_BOUNDARY_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "world_event_boundary",
    path: "src/systems/pet/world-boundary/state-events",
    role: "宠物状态变化事件输出入口。",
    accessRule:
      "只把宠物状态变化转换为事件材料，不写主体判断，不决定下一步行为。",
  },
  {
    layer: "world_event_boundary",
    path: "src/systems/pet/pet-state-events",
    role: "宠物状态变化事件输出边界。",
    accessRule:
      "只把宠物状态变化转换为事件材料，不写主体判断，不决定下一步行为；后续将逐步迁入 world-boundary/state-events。",
  },
]

export const PET_CORE_WORLD_INFLUENCE_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "world_influence",
    path: "src/systems/pet/world-boundary/zone-influence",
    role: "世界区域对宠物影响输入入口。",
    accessRule:
      "只把世界区域影响转换为宠物可接收的影响输入，不直接决定宠物 action。",
  },
  {
    layer: "world_influence",
    path: "src/systems/pet/pet-zone",
    role: "世界区域对宠物状态与倾向的输入影响。",
    accessRule:
      "世界区域只能形成影响和 signal，不能直接决定宠物 action；后续将逐步迁入 world-boundary/zone-influence。",
  },
]

export const PET_CORE_TUNING_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "tuning",
    path: "src/systems/pet/pet-action/pet-action-tuning.ts",
    role: "宠物 action / stability 调参入口。",
    accessRule:
      "调行为优先改 tuning，不直接改核心判断结构。",
  },
  {
    layer: "tuning",
    path: "src/systems/pet/drive/pet-drive-tuning.ts",
    role: "宠物 drive 调参入口。",
    accessRule:
      "调 drive 权重优先改 tuning，不在 drive runner 中硬编码数值。",
  },
  {
    layer: "tuning",
    path: "src/systems/pet/goal/pet-goal-tuning.ts",
    role: "宠物 goal 调参入口。",
    accessRule:
      "调 goal 阈值、持续时间、记忆覆盖、drive alignment 时优先改 tuning。",
  },
  {
    layer: "tuning",
    path: "src/systems/pet/pet-expression/pet-expression-tuning.ts",
    role: "宠物 expression 调参入口。",
    accessRule:
      "调可见表达阈值优先改 tuning，不在 expression runner 中散落硬编码。",
  },
]

export const PET_CORE_TEST_OR_UI_RULES: PetCoreBoundaryModule[] = [
  {
    layer: "test_or_ui",
    path: "src/app/personality-test",
    role: "测试页与调试展示层。",
    accessRule:
      "只能展示核心输出或调用 gateway，不允许把核心算法复制到测试页中。",
  },
  {
    layer: "test_or_ui",
    path: "src/app/world",
    role: "正式世界页面。",
    accessRule:
      "只展示世界结果和观察内容，不显示紫微斗数底层术语，不直接操作核心算法。",
  },
]

export const PET_CORE_FORBIDDEN_RULES = [
  "禁止 UI / 测试页直接复制 drive / goal / expression / memory / learning 的核心判断逻辑。",
  "禁止世界实体直接决定宠物 action；世界实体只能生成 signal。",
  "禁止把紫微 / 八字动态直接映射成 action；它们只能进入 life runtime / tendency / drive / goal。",
  "禁止把 daily-state 直接写成 behavior 结果。",
  "禁止把 memory 当 learning，也禁止 learning 直接控制 action。",
  "禁止在 pet-runtime 中继续堆复杂业务判断；它只能编排 gateway。",
  "禁止在 runner 中继续堆大量调参数字；新增参数必须优先放入 tuning 文件。",
  "禁止为了短期表现丰富，把主体链路退回脚本触发器。",
  "禁止绕过 gateway 深层 import 核心实现，除非是在同一子系统内部拆分文件。",
]

export const PET_CORE_ALLOWED_CHAIN = [
  "world signal",
  "pet cognition",
  "daily state",
  "memory / relation",
  "learning",
  "life runtime tendency",
  "drive",
  "goal",
  "attention",
  "raw action intent",
  "behavior execution",
  "visible expression",
  "stability",
  "memory update",
  "learning update",
  "long-term growth",
]

export const PET_CORE_BOUNDARY_SUMMARY = {
  productDirection:
    "AI-PET-WORLD 的核心不是宠物游戏脚本，而是可迁移的 AI 生命内核。",
  corePrinciple:
    "宠物和管家都是 autonomous agent；世界只产生 signal，不直接决定行为。",
  infantPrinciple:
    "宠物通过领养审查进入世界时没有生活记忆，早期行为必须经过状态、感知、记忆、学习、驱动、目标和行为链。",
  safetyPrinciple:
    "核心算法通过 gateway / layer / tuning 封装，避免 UI、测试页和临时业务逻辑直接污染核心。",
  reusableDirection:
    "当前生命内核未来可以迁移到聊天、影视互动、AI NPC、虚拟陪伴和数字生命产品中。",
}

export const PET_CORE_BOUNDARY_MODULES = [
  ...PET_CORE_PUBLIC_GATEWAYS,
  ...PET_CORE_DAILY_STATE_MODULES,
  ...PET_CORE_MEMORY_RELATION_MODULES,
  ...PET_CORE_LEARNING_MODULES,
  ...PET_CORE_AUTONOMOUS_DRIVE_MODULES,
  ...PET_CORE_BEHAVIOR_EXECUTION_MODULES,
  ...PET_CORE_RUNTIME_MODULES,
  ...PET_CORE_WORLD_EVENT_BOUNDARY_MODULES,
  ...PET_CORE_WORLD_INFLUENCE_MODULES,
  ...PET_CORE_TUNING_MODULES,
  ...PET_CORE_TEST_OR_UI_RULES,
]
