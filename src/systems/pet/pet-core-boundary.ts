/**
 * 当前文件负责：声明宠物核心系统的安全边界与模块访问规则。
 */

export type PetCoreBoundaryLayer =
  | "core_runtime"
  | "core_decision"
  | "core_expression"
  | "core_memory"
  | "core_tuning"
  | "public_gateway"
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

export const PET_CORE_RUNTIME_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "core_runtime",
    path: "src/systems/pet/pet-runtime/pet-runtime-runner.ts",
    role: "宠物单 Tick 运行编排层。",
    accessRule:
      "只允许系统层或 pet-gateway 调用；UI 和测试页不得直接修改这里的运行链路。",
  },
  {
    layer: "core_runtime",
    path: "src/systems/pet/pet-life",
    role: "宠物生命阶段推进层。",
    accessRule:
      "只处理生命阶段和生命周期推进，不写 UI 展示逻辑，不写世界实体脚本。",
  },
]

export const PET_CORE_DECISION_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "core_decision",
    path: "src/systems/pet/pet-drive",
    role: "宠物 drive 计算系统。",
    accessRule:
      "只能输出内部驱动倾向，不直接输出 action；参数统一放在 pet-drive-tuning.ts。",
  },
  {
    layer: "core_decision",
    path: "src/systems/pet/pet-goal",
    role: "宠物 goal 计算系统。",
    accessRule:
      "只能输出目标解释和目标方向，不直接输出 action；参数统一放在 pet-goal-tuning.ts。",
  },
  {
    layer: "core_decision",
    path: "src/systems/pet/pet-action",
    role: "宠物内部行为意图选择与稳定控制。",
    accessRule:
      "action selector 只选择 raw intent；不得直接读取世界实体刺激，不得绕过 drive / goal。",
  },
  {
    layer: "core_decision",
    path: "src/systems/pet/pet-cognition",
    role: "宠物对世界刺激的主体解释层。",
    accessRule:
      "只把世界 signal 转为 cognition，不直接决定 action。",
  },
  {
    layer: "core_expression",
    path: "src/systems/pet/pet-expression",
    role: "把内部意图转换为当前阶段可见行为表达。",
    accessRule:
      "只处理 visible expression，不反向覆盖 drive / goal；参数统一放在 pet-expression-tuning.ts。",
  },
  {
    layer: "core_memory",
    path: "src/ai/memory-core",
    role: "宠物经验结构与记忆更新。",
    accessRule:
      "记忆不是日志；只能通过 memory gateway 更新，不允许 UI 直接写入核心记忆字段。",
  },
]

export const PET_CORE_TUNING_MODULES: PetCoreBoundaryModule[] = [
  {
    layer: "core_tuning",
    path: "src/systems/pet/pet-action/pet-action-tuning.ts",
    role: "宠物 action / stability 调参入口。",
    accessRule:
      "调行为优先改 tuning，不直接改核心 layer 判断结构。",
  },
  {
    layer: "core_tuning",
    path: "src/systems/pet/pet-drive/pet-drive-tuning.ts",
    role: "宠物 drive 调参入口。",
    accessRule:
      "调 drive 权重优先改 tuning，不在 drive runner 中硬编码数值。",
  },
  {
    layer: "core_tuning",
    path: "src/systems/pet/pet-goal/pet-goal-tuning.ts",
    role: "宠物 goal 调参入口。",
    accessRule:
      "调 goal 阈值、持续时间、记忆覆盖、drive alignment 时优先改 tuning。",
  },
  {
    layer: "core_tuning",
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
  "禁止 UI / 测试页直接复制 drive / goal / expression / memory 的核心判断逻辑。",
  "禁止世界实体直接决定宠物 action；世界实体只能生成 signal。",
  "禁止把紫微 / 八字动态直接映射成 action；它们只能进入 life runtime / tendency / drive / goal。",
  "禁止在 runner 中继续堆大量调参数字；新增参数必须优先放入 tuning 文件。",
  "禁止为了短期表现丰富，把主体链路退回脚本触发器。",
  "禁止绕过 gateway 深层 import 核心实现，除非是在同一子系统内部拆分文件。",
]

export const PET_CORE_ALLOWED_CHAIN = [
  "world signal",
  "pet cognition",
  "life runtime tendency",
  "drive",
  "goal",
  "raw action intent",
  "visible expression",
  "stability",
  "memory update",
  "long-term growth",
]

export const PET_CORE_BOUNDARY_SUMMARY = {
  productDirection:
    "AI-PET-WORLD 的核心不是宠物游戏脚本，而是可迁移的 AI 生命内核。",
  corePrinciple:
    "宠物和管家都是 autonomous agent；世界只产生 signal，不直接决定行为。",
  safetyPrinciple:
    "核心算法通过 gateway / layer / tuning 封装，避免 UI、测试页和临时业务逻辑直接污染核心。",
  reusableDirection:
    "当前生命内核未来可以迁移到聊天、影视互动、AI NPC、虚拟陪伴和数字生命产品中。",
}

export const PET_CORE_BOUNDARY_MODULES = [
  ...PET_CORE_PUBLIC_GATEWAYS,
  ...PET_CORE_RUNTIME_MODULES,
  ...PET_CORE_DECISION_MODULES,
  ...PET_CORE_TUNING_MODULES,
  ...PET_CORE_TEST_OR_UI_RULES,
]