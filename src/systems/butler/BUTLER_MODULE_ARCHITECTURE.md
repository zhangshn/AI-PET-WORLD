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

## 6.2 ARCH-3C 当前状态

当前已经完成 butler-opportunity-runner 第一轮包装归口：

- butler-opportunity-runner.ts 暂时仍保留原目录。
- buildInitialOpportunityCooldowns / canCreateOpportunity / hasPendingOpportunity / markOpportunityCreated / removeExpiredOpportunities 已通过 education/opportunity 暴露为照看 / 教育判断与机会状态管理入口。
- createFoodOffer / createRestOffer / createApproachOffer 已通过 behavior/opportunity-action 暴露为管家提供机会行为入口。
- butler-gateway.ts 对外仍导出这些函数，但来源已经切换为 education/butler-education-gateway 与 behavior/butler-behavior-gateway。
- 本轮不改变运行逻辑，只完成机会判断与机会创建动作的入口分离。
- 管家创建机会不等于宠物必须接受，机会必须进入宠物自身判断链。

## 6.3 ARCH-3D 当前状态

当前已经完成 butler-mood-runner 第一轮包装归口：

- butler-mood-runner.ts 暂时仍保留原目录。
- deriveButlerMood 已通过 intention/state-interpretation 暴露为管家状态解释 / 情绪表现推导入口。
- butler-gateway.ts 对外仍导出 deriveButlerMood，但来源已经切换为 intention/butler-intention-gateway。
- 本轮不改变运行逻辑，只完成管家状态解释入口归口。
- 后续再逐步把 butler-mood-runner 内部实现迁入 intention/state-interpretation。

## 6.4 ARCH-3E 当前状态

当前已经完成 butler-profile-tuning 第一轮包装归口：

- butler-profile-tuning.ts 暂时仍保留原目录。
- buildButlerProfileTaskTuning / ButlerProfileTaskTuning 已通过 tuning/profile-tendency 暴露为管家人格倾向调参入口。
- butler-gateway.ts 对外仍导出 buildButlerProfileTaskTuning 和 ButlerProfileTaskTuning，但来源已经切换为 tuning/butler-tuning-gateway。
- 本轮不改变运行逻辑，只完成 profile tendency adapter 入口归口。
- tuning 只负责把管家先天人格、倾向和偏置转换为运行层可读取的轻量调参，不直接决定任务、消息或行为。
- 后续再逐步把 butler-profile-tuning 内部实现迁入 tuning/profile-tendency。

## 6.5 ARCH-3F 当前状态

当前已经完成 task 第一轮包装归口：

- task 目录暂时仍保留原位置。
- chooseButlerTask 已通过 intention/task-decision 暴露为管家任务意图选择入口。
- buildButlerTaskDecisionTrace 及相关类型已通过 intention/task-decision 暴露为管家任务决策痕迹入口。
- butler-gateway.ts 对外仍导出 chooseButlerTask / buildButlerTaskDecisionTrace 及相关类型，但来源已经切换为 intention/butler-intention-gateway。
- 本轮不改变运行逻辑，只完成任务意图选择与决策痕迹入口归口。
- 后续再逐步把 task 内部实现迁入 intention/task-decision，或者继续保留 task 作为任务域内部实现。

## 6.6 ARCH-3G 当前状态

当前已经完成 memory-relation 第一轮统一 gateway 归口：

- memory-relation 目录暂时仍保留原位置。
- butler-memory / butler-relation / butler-relation-tuning 仍保留原实现。
- appendButlerMemoryEntry / createButlerMemoryEntry / createInitialButlerMemoryState 等记忆能力已通过 memory-relation/butler-memory-relation-gateway 暴露。
- createInitialButlerRelationState / updateButlerRelationFromOpportunityFeedback / updateButlerRelationFromTaskDecision 等关系能力已通过 memory-relation/butler-memory-relation-gateway 暴露。
- buildButlerExperienceInterpretation / buildButlerRelationTaskTuning 等经验解释能力已通过 memory-relation/butler-memory-relation-gateway 暴露。
- butler-gateway.ts 对外仍导出这些函数和类型，但来源已经切换为 memory-relation/butler-memory-relation-gateway。
- 本轮不改变运行逻辑，只完成记忆 / 关系层公开入口归口。
- memory-relation 只记录经历、关系和经验解释，不直接执行行为，也不直接决定任务、消息或宠物行为。

## 6.7 关于 runtime-orchestration 的当前处理

当前暂不把 butlerSystem.ts 通过 butler-gateway.ts 反向导出。

原因：

- butlerSystem.ts 当前会 import ./butler/butler-gateway。
- 如果 butler-gateway.ts 反过来 export butlerSystem.ts，容易形成循环引用。
- 所以 runtime-orchestration 当前仍作为预留目录和未来收口方向。
- 后续真正重构 butlerSystem.ts 时，应让 butlerSystem.ts 逐步变薄，并把内部编排迁入 runtime-orchestration。
- 这一阶段不改运行逻辑，不强行包装 butlerSystem.ts。

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

## 9. ARCH-3 第一阶段完成状态

当前 ARCH-3 管家系统入口归口第一阶段已完成。

已完成：

- butler-core-boundary 边界声明
- education / opportunity 入口归口
- behavior / opportunity-action 入口归口
- intention / state-interpretation 入口归口
- intention / task-decision 入口归口
- tuning / profile-tendency 入口归口
- memory-relation 统一 gateway 归口
- 管家系统第一阶段总结文档

当前没有移动旧模块，没有改变运行逻辑。

当前暂不把 butlerSystem.ts 通过 butler-gateway.ts 反向导出，避免循环引用。

下一阶段不应继续盲目拆文件，而应进入运行链路审计：

- butlerSystem.ts 是否继续变重
- butlerSystem.ts 是否可以逐步改为调用各层 gateway
- 管家机会是否进入宠物自主判断链
- message-decision 是否仍然没有被误写成事件触发器
- P-Phone 是否仍然不是系统日志

## 10. BUTLER-EDUCATION-1 当前状态

当前已经建立管家教育策略最小层：

- `education/strategy/butler-education-strategy-gateway.ts`

该层根据 `ButlerRelationState` 生成：

- foodIntensityOffset
- restIntensityOffset
- approachIntensityOffset
- posture
- reason
- tags

当前教育策略只影响管家提供机会的方式：

```txt
ButlerRelationState
↓
buildButlerEducationStrategy
↓
机会强度 offset
↓
createFoodOffer / createRestOffer / createApproachOffer
↓
宠物自主判断是否接受
```

## 11. BUTLER-EDUCATION-2 当前状态

当前已经新增管家教育策略开发审计面板：

- `src/app/world/components/butler-debug/ButlerEducationStrategyDebugPanel.tsx`

该面板只出现在 `/world` 的 F3 开发审计区域中。

当前展示：

- posture
- foodIntensityOffset
- restIntensityOffset
- approachIntensityOffset
- reason
- tags

边界原则：

- 不展示在正式世界主体验中
- 不接 P-Phone
- 不生成系统日志
- 不影响宠物行为
- 不直接写入宠物 learning
- 只用于开发审计管家是否根据关系反馈调整照看方式

## 12. BUTLER-EDUCATION-3 当前状态

当前已经把管家教育策略写入任务决策 trace 审计信息。

当前 trace scores 会补充：

- education_posture
- education_food_intensity_offset
- education_rest_intensity_offset
- education_approach_intensity_offset
- education_reason
- education_tag_x

本轮只增加开发审计信息，不改变任务选择逻辑。

边界原则：

- 不改变 chooseButlerTask 的判断结果
- 不改变机会创建逻辑
- 不影响宠物行为
- 不直接写入宠物 learning
- 不接 P-Phone
- 只让 F3 开发审计面板能看到教育策略如何参与管家判断解释

## 13. BUTLER-EDUCATION-4 当前状态

当前已经把管家教育策略保存为 `ButlerState.latestEducationStrategy`。

该字段用于：

- F3 开发审计读取当前教育策略快照
- 后续 message-decision 判断管家是否需要主动联系玩家
- 后续 P-Phone 使用管家自主判断结果，而不是重新读取系统日志

当前字段内容来自：

```txt
ButlerRelationState
↓
buildButlerEducationStrategy
↓
ButlerState.latestEducationStrategy
```

边界原则：

- 不改变宠物行为
- 不让管家控制宠物
- 不直接写入宠物 learning
- 不接 P-Phone
- 不改变 worldEngine 调度顺序
- 只保存当前管家的教育策略快照，供开发审计和未来 message-decision 读取

## 14. MESSAGE-DECISION-1 当前状态

当前已经建立管家主动消息判断层最小闭环。

已建立：

- `message-decision/butler-message-decision-schema.ts`
- `message-decision/butler-message-decision-runner.ts`
- `message-decision/butler-message-decision-gateway.ts`

当前链路：

```txt
ButlerState
↓
latestEducationStrategy
↓
relation / task
↓
buildButlerMessageDecision
↓
ButlerMessageDecision
```

当前只表示管家是否形成“联系玩家”的意图。

边界原则：

- 不接 P-Phone
- 不生成短信
- 不记录 AiMessage
- 不把事件自动转短信
- 不把系统日志转成管家消息
- 不改变 worldEngine 调度顺序
- 不改变宠物行为
- 不让管家控制宠物
- 不让管家直接写入宠物 learning
