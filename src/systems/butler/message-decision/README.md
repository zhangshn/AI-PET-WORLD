# butler/message-decision

当前目录属于管家主体系统中的消息决策区，服务于第 7 层自主驱动。

## 当前负责

这里未来负责管家是否主动联系玩家的判断。

P-Phone 消息不是系统日志，不是事件自动转短信，而是管家基于自主判断后可能联系玩家。

本目录未来负责：

- 管家是否有必要主动联系玩家
- 管家联系玩家的原因解释
- 管家消息冷却与优先级
- 管家消息语气与关系状态的衔接
- 哪些情况应保持沉默或继续观察

## 当前不能做

- 不能写 P-Phone UI
- 不能把世界事件自动转成短信
- 不能绕过管家自主判断
- 不能替宠物做决定
- 不能把系统日志伪装成管家消息
- 不能直接改 worldEngine、petSystem 或 butlerSystem 行为

## 后续扩展方向

- 联系玩家意图
- 消息必要性判断
- 消息冷却规则
- 关系语气
- message-decision gateway

## MESSAGE-DECISION-1 当前状态

当前已经建立管家主动消息判断层最小闭环：

- `butler-message-decision-schema.ts`
- `butler-message-decision-runner.ts`
- `butler-message-decision-gateway.ts`

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

边界原则：

- 不生成 P-Phone 消息
- 不写系统日志
- 不把事件自动转短信
- 不接入真实短信发送
- 不改变 worldEngine 调度顺序
- 不改变宠物行为
- 不让管家控制宠物
- 不让管家直接写入宠物 learning

## MESSAGE-DECISION-2 当前状态

当前已经把管家主动消息判断结果保存为：

- `ButlerState.latestMessageDecision`

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

边界原则：

- 只保存判断快照
- 不生成短信
- 不记录 AiMessage
- 不接 P-Phone
- 不把事件自动转短信
- 不把系统日志转成管家消息

## MESSAGE-DECISION-3 当前状态

当前已经为管家主动消息判断层加入最小冷却 / 去重规则。

当前 `ButlerMessageDecision` 增加：

- `createdAtTick`
- `cooldownUntilTick`

当前冷却规则只用于：

- 避免同一 reason 在短时间内重复形成联系玩家意图
- 让管家继续观察，而不是每个 tick 都想联系玩家
- 为未来 P-Phone message delivery 提供节流依据

当前不做：

- 不接 P-Phone
- 不生成短信
- 不记录 AiMessage
- 不把事件自动转短信
- 不把系统日志转成管家消息

## MESSAGE-DECISION-4 当前状态

当前已经为管家主动消息判断加入草稿文本字段：

- `draftText`

该字段表示：

- 如果未来 message delivery 允许发送，管家可能会怎么说
- 当前只用于 F3 开发审计
- 当前不代表已经发送

当前不做：

- 不接 P-Phone
- 不生成短信
- 不记录 AiMessage
- 不把事件自动转短信
- 不把系统日志转成管家消息
