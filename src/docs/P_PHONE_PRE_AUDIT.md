# P-Phone Pre-Audit

当前文件负责：审计 AI-PET-WORLD 在接入管家主动消息系统前的 P-Phone 旧链路和新链路边界。

本阶段不改代码，只确认：

- 当前 P-Phone 消息从哪里来
- 哪些逻辑属于旧的事件转短信链路
- 哪些逻辑可以保留
- 哪些逻辑必须逐步替换
- 新的 message-decision / delivery 链路应该如何接入

---

## 1. 当前阶段结论

当前 P-Phone 仍然同时承担三类职责：

```txt
1. 展示已持久化的 AiMessage
2. 根据 WorldEvent 临时生成 P-Phone 消息
3. 在没有消息时生成基础占位 / 状态短信
```

其中第 1 类可以保留。

第 2 类属于旧链路：事件转短信。

第 3 类属于临时占位逻辑，可以短期保留，但后续不能继续作为管家主动消息来源。

未来 P-Phone 的正式消息来源应该是：

```txt
ButlerState.latestMessageDecision
↓
ButlerState.latestMessageDeliveryDecision
↓
message delivery queue
↓
AiMessage
↓
P-Phone 展示
```

注意：当前还没有接入 delivery queue，也没有把 message decision 写入 AiMessage。

---

## 2. 当前旧链路

当前 P-Phone 旧链路的核心问题是：它仍然可能从 WorldEvent 或运行状态中临时生成短信式内容。

旧链路大致是：

```txt
WorldEvent / world runtime state
↓
pPhoneMessageMappers
↓
pPhoneMessagePolicy
↓
P-Phone UI
```

这条链路的问题不是 UI 展示本身，而是消息来源不符合新的业务原则。

P-Phone 不应该是：

- 系统日志查看器
- WorldEvent 自动转短信工具
- 世界运行状态的文本投影
- 宠物行为的即时播报器

P-Phone 应该是：

- 管家可能主动联系玩家的入口
- 展示已经被允许投递的管家消息
- 展示持久化后的 AiMessage
- 展示管家基于自主判断形成的沟通结果

---

## 3. 可以保留的逻辑

以下逻辑可以保留：

- P-Phone UI 容器
- 手机界面路由
- 已持久化 AiMessage 的展示能力
- 已有消息列表的渲染能力
- 消息时间、发送者、基础状态显示
- 当前用于开发过渡的空状态展示

这些能力属于第 10 层：展示 / 交互层。

它们只负责展示结果，不负责判断管家是否应该联系玩家。

---

## 4. 必须逐步替换的逻辑

以下逻辑必须逐步替换：

- WorldEvent 直接生成 P-Phone 消息
- 系统事件自动转短信
- 宠物状态变化自动转短信
- 管家状态变化自动转短信
- 没有经过 message-decision 的主动消息
- 没有经过 delivery boundary 的消息投递

替换后的消息来源必须满足：

```txt
ButlerMessageDecision.shouldContactPlayer === true
↓
ButlerMessageDeliveryDecision.canEnterDeliveryQueue === true
↓
message delivery queue 允许入队
↓
生成 AiMessage
↓
P-Phone 展示
```

在该链路完成前，不应该把现有事件转短信逻辑扩展得更复杂。

---

## 5. 新链路边界

新的管家主动消息链路分为三段。

### 5.1 Message Decision

message-decision 只判断管家是否形成联系玩家意图。

它输出：

- `ButlerMessageDecision`
- `shouldContactPlayer`
- `priority`
- `reason`
- `draftText`
- `createdAtTick`
- `cooldownUntilTick`

它不做：

- 不发送消息
- 不生成 AiMessage
- 不调用 P-Phone
- 不把事件自动转短信
- 不把系统日志转成管家消息

### 5.2 Message Delivery Boundary

message delivery boundary 只判断 message decision 是否允许未来进入投递队列。

它输出：

- `ButlerMessageDeliveryDecision`
- `canEnterDeliveryQueue`
- `blockReason`
- `decisionReason`
- `priority`
- `draftText`
- `checkedAtTick`

它不做：

- 不发送消息
- 不写 AiMessage
- 不调用 P-Phone
- 不改变现有 P-Phone UI

### 5.3 P-Phone Display

P-Phone 只展示已经进入展示层的数据。

它不应该重新判断：

- 管家是否应该联系玩家
- 当前事件是否应该变成短信
- 宠物状态是否需要提醒玩家
- 管家草稿是否应该投递

---

## 6. 建议替换顺序

建议按以下顺序接入，避免一次性改动 P-Phone 主链路：

1. 保持现有 P-Phone UI 不变。
2. 保持 `pPhoneMessageMappers.ts` 和 `pPhoneMessagePolicy.ts` 不变。
3. 确认 `ButlerState.latestMessageDecision` 已能稳定生成。
4. 确认 `ButlerState.latestMessageDeliveryDecision` 已能稳定生成。
5. 新增 message delivery queue 类型和存储边界。
6. 只允许 `canEnterDeliveryQueue === true` 的消息进入 delivery queue。
7. delivery queue 再生成持久化 `AiMessage`。
8. P-Phone 只读取持久化 `AiMessage`。
9. 逐步关闭 WorldEvent 临时转短信逻辑。
10. 删除或降级旧占位短信逻辑。

---

## 7. 禁止事项

- 禁止把 WorldEvent 自动转成 P-Phone 消息。
- 禁止把系统日志展示成管家消息。
- 禁止事件发生就自动发短信。
- 禁止 P-Phone UI 深层 import 管家判断模块。
- 禁止 P-Phone UI 自己调用 `buildButlerMessageDecision`。
- 禁止 P-Phone UI 自己调用 `buildButlerMessageDeliveryDecision`。
- 禁止跳过 delivery boundary 直接生成 AiMessage。
- 禁止把 `draftText` 当成已发送消息。
- 禁止把低优先级 observe-only 判断直接投递。
- 禁止让管家消息替宠物做决定。
- 禁止让管家消息直接写入宠物 learning。

---

## 8. 接入前检查清单

接入 P-Phone 前必须确认：

- `ButlerState.latestMessageDecision` 已存在并可恢复旧存档。
- `ButlerState.latestMessageDeliveryDecision` 已存在并可恢复旧存档。
- `draftText` 只作为草稿，不代表已经发送。
- `cooldownUntilTick` 已用于避免同 reason 重复形成联系意图。
- `canEnterDeliveryQueue` 是进入未来投递队列的唯一判断入口。
- P-Phone 仍只做展示层职责。
- 事件转短信链路没有继续扩张。

---

## 9. 当前阶段不做

本阶段不做：

- 不改 P-Phone UI
- 不改 `pPhoneMessageMappers.ts`
- 不改 `pPhoneMessagePolicy.ts`
- 不生成短信
- 不记录 AiMessage
- 不接入 message delivery queue
- 不改变 world engine 调度
- 不改变 pet system 行为
- 不改变 butler system 行为

当前只完成接入前审计。
