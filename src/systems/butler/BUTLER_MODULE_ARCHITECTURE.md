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

## 15. MESSAGE-DECISION-2 当前状态

当前已经把管家主动消息判断结果保存为 `ButlerState.latestMessageDecision`。

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
ButlerState.latestMessageDecision
```

当前 F3 开发审计面板可以读取该快照。

边界原则：

- 不改 P-Phone UI
- 不生成短信
- 不记录 AiMessage
- 不把事件自动转短信
- 不把系统日志转成管家消息
- 不改变 worldEngine 调度顺序
- 不改变宠物行为
- 不让管家控制宠物
- 不让管家直接写入宠物 learning

## 16. MESSAGE-DECISION-3 当前状态

当前已经为管家主动消息判断层加入冷却 / 去重规则。

当前字段：

- `createdAtTick`
- `cooldownUntilTick`

当前规则：

```txt
latestMessageDecision
↓
same reason cooldown check
↓
silent or new message decision
```

当前冷却只用于避免同一 reason 在短时间内重复形成联系玩家意图。

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

## 17. MESSAGE-DECISION-4 当前状态

当前已经为 `ButlerMessageDecision` 增加草稿文本字段：

- `draftText`

当前链路：

```txt
ButlerState
↓
latestMessageDecision
↓
draftText
↓
F3 开发审计
```

该字段只表示未来 message delivery 允许发送时，管家可能会怎么说。

边界原则：

- 不接 P-Phone
- 不生成短信
- 不记录 AiMessage
- 不把事件自动转短信
- 不把系统日志转成管家消息

## 18. MESSAGE-DECISION-5 当前状态

当前已经建立 message delivery 边界层。

已新增：

- `message-decision/butler-message-delivery-schema.ts`
- `message-decision/butler-message-delivery-runner.ts`

当前链路：

```txt
ButlerState.latestMessageDecision
↓
buildButlerMessageDeliveryDecision
↓
ButlerState.latestMessageDeliveryDecision
```

当前只判断 latestMessageDecision 是否允许未来进入投递队列。

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

## 19. P-PHONE-PRE-AUDIT-2 当前状态

当前已经新增 P-Phone 接入前审计文档：

- `src/docs/P_PHONE_PRE_AUDIT.md`

当前文档明确：

- P-Phone 旧链路仍包含 WorldEvent 临时转短信
- P-Phone 新链路必须来自管家 message-decision / delivery
- P-Phone 不应该成为系统日志查看器
- `draftText` 不等于已发送消息

边界原则：

- 不改 P-Phone UI
- 不改 `pPhoneMessageMappers.ts`
- 不改 `pPhoneMessagePolicy.ts`
- 不生成短信
- 不记录 AiMessage

## 20. P-PHONE-BRIDGE-1 当前状态

当前已经新增管家 delivery 到 P-Phone preview mapper：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryMapper.ts`
- `buildPPhoneButlerDeliveryPreview`

当前链路：

```txt
ButlerMessageDeliveryDecision
↓
buildPPhoneButlerDeliveryPreview
↓
PPhoneMessageItem | null
```

当前 mapper 只做预览结构转换，不接正式 P-Phone thread。

## 21. P-PHONE-BRIDGE-2 当前状态

当前已经新增 F3 bridge preview 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneBridgePreviewPanel.tsx`

当前展示管家 delivery preview 的：

- previewId
- sender
- senderName
- timeLabel
- text

当前只用于 F3 开发审计，不代表已经发送。

## 22. P-PHONE-BRIDGE-3 当前状态

当前已经新增 P-Phone bridge delivery queue preview builder：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryQueue.ts`
- `buildPPhoneButlerDeliveryQueueItem`

当前链路：

```txt
ButlerMessageDeliveryDecision
↓
buildPPhoneButlerDeliveryPreview
↓
buildPPhoneButlerDeliveryQueueItem
↓
PPhoneButlerDeliveryQueueItem | null
```

当前 queue item 状态为 `preview_only`，不持久化、不写 AiMessage。

## 23. P-PHONE-BRIDGE-4 当前状态

当前已经新增 F3 delivery queue 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneDeliveryQueueDebugPanel.tsx`

当前展示 queue preview 的：

- queueId
- source
- status
- decisionReason
- priority
- createdAtTick
- checkedAtTick
- messageText
- tags

当前不接正式 P-Phone，不写 AiMessage。

## 24. P-PHONE-DELIVERY-1 当前状态

当前已经新增未来正式 delivery queue item builder：

- `PPhoneButlerFutureDeliveryQueueItem`
- `buildPPhoneButlerFutureDeliveryQueueItem`

当前链路：

```txt
PPhoneButlerDeliveryQueueItem
↓
buildPPhoneButlerFutureDeliveryQueueItem
↓
PPhoneButlerFutureDeliveryQueueItem | null
```

当前只是数据边界，`ready_for_future_delivery` 不代表已经发送。

## 25. P-PHONE-DELIVERY-2 当前状态

当前已经新增 AiMessage record input builder：

- `src/app/world/ui/phone/messages/pPhoneButlerAiMessageRecordBuilder.ts`
- `buildPPhoneButlerAiMessageRecordInput`

当前链路：

```txt
PPhoneButlerFutureDeliveryQueueItem
↓
buildPPhoneButlerAiMessageRecordInput
↓
CreateAiMessageRecordInput | null
```

当前只构造未来可写入 AiMessage 的输入，不调用 `recordAiMessageOnce`。

## 26. P-PHONE-DELIVERY-3 当前状态

当前已经新增 F3 AiMessage record preview 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneAiMessageRecordPreviewPanel.tsx`

当前展示：

- id
- source
- entityType
- entityId
- importance
- userVisibleChannel
- messageId
- messageChannel
- triggerReason
- sourceEventId
- messageText
- tags

当前只展示 `CreateAiMessageRecordInput` 预览，不写正式消息。

## 27. P-PHONE-DELIVERY-4 当前状态

当前已经完成 P-Phone delivery 第二批基础建设：

- 正式 future delivery queue 数据边界
- AiMessage record input builder
- F3 AiMessage record preview
- bridge / butler 架构文档补充

当前整体链路：

```txt
ButlerState.latestMessageDeliveryDecision
↓
buildPPhoneButlerDeliveryPreview
↓
buildPPhoneButlerDeliveryQueueItem
↓
buildPPhoneButlerFutureDeliveryQueueItem
↓
buildPPhoneButlerAiMessageRecordInput
↓
F3 record preview
```

当前仍然不接正式 P-Phone，不生成真实短信，不记录 AiMessage。

## 28. P-PHONE-DELIVERY-5 当前状态

当前已经新增 P-Phone delivery 受控写入开关类型：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryWriterTypes.ts`
- `PPhoneButlerDeliveryWriteControl`
- `PPhoneButlerDeliveryWriteMode`
- `PPhoneButlerDeliveryWriteResult`

默认写入控制是：

```txt
disabled
↓
canWrite=false
↓
didWrite=false
```

该边界只定义 writer 输入、开关与结果类型，不写 AiMessage。

## 29. P-PHONE-DELIVERY-6 当前状态

当前已经新增受控手动 writer：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryWriter.ts`
- `writePPhoneButlerDeliveryMessageOnce`

该 writer 只有在显式满足以下条件时才允许写入：

```txt
recordInput exists
↓
control.mode === "enabled"
↓
recordAiMessageOnce
```

默认业务链路不调用该 writer。

边界原则：

- 不在 worldEngine 中触发写入
- 不在 butlerSystem 中触发写入
- 不在 React render 中触发写入
- 不让 UI 自动发送消息

## 30. P-PHONE-DELIVERY-7 当前状态

当前 writer result 已区分以下结果：

- `disabled`
- `manual_audit_only`
- `missing_record_input`
- `blocked`
- `written`
- `skipped_duplicate`

其中 `written` 只可能来自显式 enabled 的 manual writer。

当前 F3 审计路径只展示 disabled preview，不会触发真实写入。

## 31. P-PHONE-DELIVERY-8 当前状态

当前已经新增 F3 manual writer 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneDeliveryWriterAuditPanel.tsx`

当前面板展示：

- status
- canWrite
- didWrite
- messageId
- recordId
- reason
- tags

当前面板不提供按钮，不调用 `recordAiMessageOnce`，不写 AiMessage。

## 32. P-PHONE-DELIVERY-9 当前状态

当前已经新增 P-Phone read-only integration preview：

- `src/app/world/ui/phone/messages/pPhoneButlerRecordPreviewMapper.ts`
- `src/app/world/components/butler-debug/ButlerPPhoneReadonlyIntegrationPreviewPanel.tsx`

当前链路：

```txt
CreateAiMessageRecordInput
↓
buildPPhoneButlerRecordPreviewMessage
↓
PPhoneMessageItem | null
```

该预览只展示未来进入正式 P-Phone 前的消息形态，不接正式 thread。

## 33. P-PHONE-DELIVERY-10 当前状态

当前已经完成 P-Phone delivery 第三批基础建设：

- 受控写入开关类型
- 手动 writer
- writer result 状态边界
- F3 writer 审计面板
- read-only integration preview mapper
- F3 read-only integration preview 面板

当前整体链路：

```txt
ButlerMessageDeliveryDecision
↓
P-Phone bridge preview
↓
future delivery queue item
↓
CreateAiMessageRecordInput
↓
writer disabled preview
↓
read-only integration preview
```

当前仍不接正式 P-Phone，不自动写 AiMessage。

## 34. P-Phone Delivery 安全边界

当前 P-Phone delivery 链路必须保持以下边界：

- P-Phone UI 不决定管家是否联系玩家
- P-Phone UI 不自动发送消息
- P-Phone bridge 不读取 WorldEvent 生成短信
- P-Phone bridge 不把系统日志转成管家消息
- `draftText` 不是已发送消息
- `CreateAiMessageRecordInput` 不是已写入记录
- `ready_for_future_delivery` 不是已发送状态
- manual writer 只能由显式 enabled 控制调用

## 35. 下一阶段建议

下一阶段如果要继续推进 P-Phone delivery，应先建立明确的手动触发边界。

建议顺序：

1. 继续保持正式 P-Phone thread 不变。
2. 为 manual writer 增加开发期显式触发入口前，先设计权限和审计条件。
3. 明确 `enabled` 控制只来自开发工具或未来受控 delivery service。
4. 在真实写入前继续验证去重、冷却和 queue item 稳定性。
5. 最后再考虑让正式 P-Phone 读取持久化 AiMessage，而不是读取 bridge preview。

## 36. P-PHONE-DELIVERY-11 当前状态

当前已经修复 manual writer 的 duplicate 判断。

当前 writer 写入顺序：

```txt
preview
↓
recordInput exists
↓
control.mode === "enabled"
↓
find existing AiMessage by messageId
↓
existing → skipped_duplicate
↓
not existing → recordAiMessageOnce
```

duplicate 检查发生在写入前，避免重复调用 `recordAiMessageOnce`。

## 37. P-PHONE-DELIVERY-12 当前状态

当前已经新增 persisted readback mapper：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryReadback.ts`
- `buildPPhoneButlerDeliveryReadback`

该 mapper 通过 `getAiDataRecords` 读取指定 `messageId` 的 AiMessage。

当前只读，不写 AiMessage，不接正式 P-Phone thread。

## 38. P-PHONE-DELIVERY-13 当前状态

当前已经新增 F3 开发限定手动写入面板：

- `src/app/world/components/butler-debug/ButlerPPhoneManualDeliveryWritePanel.tsx`

当前行为：

- 只有点击按钮才调用 enabled writer
- 写入结果保存在 `useState`
- 写入后刷新 persisted readback 面板
- 不自动写入

该按钮只出现在 F3 / 管家开发审计区域，不属于生产主体验。

## 39. P-PHONE-DELIVERY-14 当前状态

当前已经新增 F3 persisted readback 面板：

- `src/app/world/components/butler-debug/ButlerPPhoneDeliveryReadbackPanel.tsx`

当前用于验证：

- 手动写入后是否能通过持久化读取链路读到 AiMessage
- 读到的 AiMessage 是否能转换为 P-Phone preview
- 正式 P-Phone thread 是否仍未被替换

## 40. P-PHONE-DELIVERY-15 当前状态

当前已经完成 P-Phone delivery 第四批基础建设：

- manual writer 写入前去重
- persisted readback mapper
- F3 手动写入面板
- F3 persisted readback 面板
- 文档边界补充

当前允许：

- 开发面板显式点击后写入 AiMessage
- 写入后读取验证

当前禁止：

- 不自动写 AiMessage
- 不在 worldEngine 中触发写入
- 不在 butlerSystem 中触发写入
- 不在 React render 中触发写入
- 不替换正式 P-Phone thread
- 不把事件自动转短信
- 不把系统日志转成管家消息

## 43. P-PHONE-INTEGRATION-BATCH-5 当前状态

当前已经开始正式 P-Phone butler thread 接入。

当前正式读取优先级：

```txt
delivery-generated persisted butler message
↓
other persisted butler message
↓
legacy message-policy butler message
↓
legacy WorldEvent butler message fallback
↓
placeholder status message
```

本轮完成：

- 新 delivery 链路生成的持久化 butler message 优先显示
- 普通持久化 butler message 次级显示
- 旧 message-policy butler message 降级
- 旧 WorldEvent butler message 只作为 fallback
- World Notice 保持原样
- fallback butler status message 不再写入 AiMessage

当前仍然不做：

- 不自动写 AiMessage
- 不删除旧 event policy
- 不关闭 World Notice
- 不新增 F3 面板
- 不让 P-Phone UI 决定管家是否联系玩家

## 44. P-PHONE-MIGRATION-BATCH-6 当前状态

当前已经降级旧 WorldEvent → butler message 逻辑。

当前规则：

```txt
WorldEvent
↓
World Notice：允许
Butler Message：默认关闭
```

本轮完成：

- `ENABLE_LEGACY_BUTLER_EVENT_MESSAGES = false`
- `pet_hatched` 不再自动生成管家短信
- `offline_catchup` 不再自动生成管家短信
- `dual_agent_interaction` 不再自动生成管家短信
- 旧 event policy 不再写入 butler AiMessage
- World Notice 保留事件来源和 AiMessage 写入

当前边界：

- 新管家短信必须来自 message delivery 链路
- P-Phone UI 不决定管家是否联系玩家
- 不关闭 World Notice
- 不改变 worldEngine 调度
- 不改变宠物行为

## 45. BUTLER-BEHAVIOR-BATCH-1 当前状态

当前已经建立管家行为执行层第一阶段。

新增：

- `src/systems/butler/behavior/execution/butler-behavior-execution-schema.ts`
- `src/systems/butler/behavior/execution/butler-behavior-execution-runner.ts`
- `src/systems/butler/behavior/execution/butler-behavior-execution-gateway.ts`

当前链路：

```txt
ButlerState.task
↓
ButlerRelationState
↓
ButlerEducationStrategy
↓
buildButlerBehaviorExecution
↓
ButlerState.latestBehaviorExecution
```

当前行为执行层只生成快照，不选择任务，不直接修改家园，不控制宠物。

当前边界：

- 不新增 F3 面板
- 不接 P-Phone
- 不直接调用 homeSystem.build
- 不改变 worldEngine 调度
- 不改变宠物行为
- 不让管家替宠物做决定

## 46. BUTLER-HOME-ACTION-BATCH-2 当前状态

当前已经让家园建设经过管家行为执行边界。

当前链路：

```txt
ButlerSystem.update
↓
ButlerState.latestBehaviorExecution
↓
runHomeConstruction
↓
canButlerAffectHome
↓
homeSystem.build
```

当前规则：

- `homeSystem.build` 必须经过 `latestBehaviorExecution` 边界
- 只有 `canAffectHome === true` 才允许推进家园建设
- 只有 `home_building / home_maintenance / space_tidying` 类行为可影响家园
- `butler.task` 只作为行为执行快照输入，不再直接决定家园建设
- 家园建设仍不控制宠物，不写宠物 learning

当前边界：

- 不改变 worldEngine 调度顺序
- 不在 butlerSystem 里直接调用 homeSystem
- 不新增 F3 面板
- 不改 P-Phone

## 47. HOME-SPACE-BATCH-3 当前状态

当前已经建立家园空间实体第一阶段。

新增 / 更新：

- `HomeSpaceState`
- `HomeSpaceId`
- `HomeSpaceStatus`
- `HomeSpaceRole`
- `HomeState.homeSpaces`
- `createInitialHomeSpaces`
- `syncHomeSpaces`

当前最小空间包括：

- `empty_land`
- `incubator_area`
- `temporary_shelter`
- `garden_area`
- `storage_area`
- `activity_area`

当前链路：

```txt
homeSystem.build
↓
buildHome
↓
syncHomeSpaces
↓
HomeState.homeSpaces
```

当前边界：

- homeSpaces 不控制宠物行为
- 不接 PixiJS
- 不做像素地图渲染
- 不改变 worldEngine 调度
- 旧存档通过 HomeSystem.restore 自动补齐空间结构

## 48. HOME-SPACE-BATCH-4 当前状态

当前已经建立家园空间摘要第一阶段。

新增 / 更新：

- `HomeSpaceSummary`
- `HomeState.spaceSummary`
- `buildHomeSpaceSummary`

当前摘要包括：

- 当前主空间
- 正在建设空间
- 已激活空间
- 可用空间
- 需要维护空间
- 可活动空间
- 家园整体舒适度
- 家园整体稳定度
- 家园整体活跃度
- summary 文本
- tags

当前链路：

```txt
HomeState.homeSpaces
↓
buildHomeSpaceSummary
↓
HomeState.spaceSummary
```

当前边界：

- spaceSummary 只用于展示和后续空间选择
- 不控制宠物行为
- 不接 PixiJS
- 不做像素地图渲染
- 不改变 worldEngine 调度
- 旧存档通过 HomeSystem.restore 自动补齐摘要

## 49. HOME-SPACE-ACTION-BATCH-6 当前状态

当前已经建立管家行为影响具体家园空间的第一阶段。

当前链路：

```txt
ButlerState.latestBehaviorExecution
↓
homeSystem.applyButlerSpaceAction
↓
applyButlerHomeSpaceAction
↓
HomeState.homeSpaces
↓
HomeState.spaceSummary
```

当前空间影响：

- `home_building` 主要推进 `temporary_shelter`
- `home_maintenance` 修复舒适度 / 稳定度最低的可用空间
- `space_tidying` 提升 `storage_area / activity_area` 的稳定度和秩序感
- `incubator_watch` 轻微提升 `incubator_area` 稳定度

当前边界：

- behavior 层不直接调用 homeSystem
- 不控制宠物行为
- 不写宠物 learning
- 不新增正式 overlay
- 不新增 F3 面板
- 不改变 worldEngine 调度顺序
