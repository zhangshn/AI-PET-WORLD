# Butler Module Architecture

当前文件负责：说明 `src/systems/butler` 当前模块如何归属到 AI-PET-WORLD 十层架构中。

本文件只做架构归层说明，不改变运行逻辑。

## 1. 管家系统在十层架构中的位置

管家系统主要横跨：

- 第 5 层：记忆 / 关系层
- 第 7 层：自主驱动层
- 第 8 层：行为执行层
- Runtime 编排层
- 第 10 层展示交互边界，但 UI 不属于 butler 系统内部

管家系统不能直接承担：

- 第 1 层命理核心算法
- 第 2 层人格映射算法
- 第 9 层世界运行调度
- 第 10 层 UI 展示逻辑

这些能力应通过对应 gateway、world engine 或 UI 边界进入管家系统。

## 2. 管家核心定位

管家不是普通 NPC。

管家是用户生命数据映射 / 平行世界人格投射。管家创建时有先天人格，但没有世界经历记忆。

管家拥有自主判断，承担照看、教育、引导、保护、解释、环境管理职责。

管家不能替宠物做决定。管家可以提供机会、保持距离、保护性回应、记录经验、调整照看方式。

玩家不能直接控制管家，只能通过互动影响管家判断。

## 3. 当前模块归层表

| 当前目录 / 文件 | 当前归属层 | 当前职责 | 后续整理方向 |
|---|---|---|---|
| `butler-gateway.ts` | 公开 gateway | 管家系统公开出口 | 后续继续保持薄门面 |
| `memory-relation` | 第 5 层：记忆 / 关系层 | 当前承接管家记忆、关系、经验解释 | 后续建立统一 memory-relation gateway |
| `task` | 第 7 层：自主驱动层 / 任务倾向 | 当前承接既有管家任务选择与 trace | 后续拆分到 intention、education、message-decision、behavior |
| `intention` | 第 7 层：自主驱动层 | 预留管家意图形成 | 后续承接靠近、等待、保护、解释、提供机会等意图判断 |
| `education` | 第 7 层到第 8 层之间的教育职责边界 | 预留幼儿期宠物照看、教育、引导、保护判断 | 后续承接教育机会、保护性回应、距离控制 |
| `message-decision` | 第 7 层：自主驱动层 / 消息判断 | 预留管家是否主动联系玩家的判断 | 后续承接 P-Phone 消息必要性、冷却、语气判断 |
| `behavior` | 第 8 层：行为执行层 | 预留管家行为执行 | 后续承接建设、整理、解释、保护性回应、联系玩家等执行入口 |
| `runtime-orchestration` | Runtime 编排层 | 预留管家运行编排入口 | 后续让 butler runtime 只调用各层 gateway |
| `butler-opportunity-runner.ts` | 第 7 层 + 第 8 层混合 | 当前处理管家提供机会的创建、冷却、清理 | 后续拆分为 intention / education 判断与 behavior 执行 |
| `butler-mood-runner.ts` | 第 7 层状态解释辅助 | 当前处理管家 mood 推导 | 后续可归入 intention 的状态解释输入 |
| `butler-profile-tuning.ts` | tuning | 当前处理管家人格相关任务调参 | 保留为 tuning，不写核心业务流程 |
| `butler-schema.ts` | 类型边界 | 管家系统共享类型 | 保持轻量，不堆业务判断 |

## 4. P-Phone 与消息边界

P-Phone 是管家可能主动联系玩家的入口，不是系统日志查看器。

管家消息必须来自管家自主判断，不能把世界事件、宠物事件或系统日志自动转成短信。

UI 层可以展示管家消息结果，但不能写管家消息判断逻辑。

## 5. 管家与宠物边界

管家可以：

- 提供食物机会
- 提供休息环境
- 保持安全距离
- 保护性回应
- 记录宠物反应
- 调整照看方式
- 解释当前世界状态
- 管理家园环境

管家不能：

- 替宠物吃
- 替宠物睡
- 替宠物喜欢管家
- 直接写入宠物学习结果
- 直接决定宠物行为
- 把玩家输入当成直接控制指令

宠物对管家的机会必须经过宠物自身判断链。

## 6. ARCH-3A 当前状态

当前已经完成管家系统第一阶段分层目录与架构文档建立：

- `memory-relation`
- `task`
- `intention`
- `education`
- `message-decision`
- `behavior`
- `runtime-orchestration`

本轮不移动旧目录，不改变运行逻辑，只补齐目录 README 与架构说明。

## 6.1 ARCH-3B 当前状态

当前已经建立管家系统核心边界声明：

- `butler-core-boundary.ts`
- `BUTLER_CORE_PUBLIC_GATEWAYS`
- `BUTLER_CORE_MEMORY_RELATION_MODULES`
- `BUTLER_CORE_AUTONOMOUS_DRIVE_MODULES`
- `BUTLER_CORE_EDUCATION_MODULES`
- `BUTLER_CORE_MESSAGE_DECISION_MODULES`
- `BUTLER_CORE_BEHAVIOR_EXECUTION_MODULES`
- `BUTLER_CORE_RUNTIME_MODULES`
- `BUTLER_CORE_TUNING_MODULES`
- `BUTLER_CORE_TYPE_BOUNDARY_MODULES`

本轮不移动旧目录，不改变运行逻辑，只建立边界声明和 gateway 导出。

## 7. 后续迁移顺序建议

1. 建立 butler-core-boundary 边界声明
2. 建立 runtime-orchestration gateway，仅包装既有 butlerSystem 调用链
3. 将 task 的意图判断包装到 intention
4. 将幼儿期照看判断包装到 education
5. 将主动联系玩家判断包装到 message-decision
6. 将机会创建与环境管理执行包装到 behavior
7. 将记忆 / 关系公开入口整理为 memory-relation gateway

## 8. 禁止事项

- 禁止把管家写成普通 NPC
- 禁止把管家消息写成系统日志
- 禁止 P-Phone 自动展示系统事件
- 禁止玩家直接控制管家
- 禁止管家替宠物做决定
- 禁止管家直接写入宠物学习结果
- 禁止 butlerSystem.ts 继续变重
- 禁止 UI 深层 import 管家内部旧模块
- 禁止在本阶段移动旧实现
