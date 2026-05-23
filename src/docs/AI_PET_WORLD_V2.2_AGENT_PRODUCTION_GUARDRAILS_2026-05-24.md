# AI-PET-WORLD V2.2 Agent Production Guardrails 架构补充文档

日期：2026-05-24  
版本：V2.2  
性质：在 V2.1 全景系统架构图与 AI 核心架构文档基础上，补齐生产级 AI Agent 世界运行护栏。

---

## 1. 本文档结论

V2.1 全景架构已经确立了 AI-PET-WORLD 的主骨架：

- 世界事实先于画面。
- UI 只读。
- 紫微斗数是灵魂底盘。
- 管家通过感知、动机、目标、规划、行动、审计、记忆反馈形成认知闭环。
- Construction 只是执行层。
- MapDiff 与 SafeApply 是世界事实可信的审计门。

V2.2 需要补齐的是生产级 AI Agent 世界系统的横切护栏：

1. Memory Lifecycle：冷热记忆、反思、遗忘与压缩。
2. Constraint Kernel：硬约束、软约束、叙事约束边界。
3. Failure Recovery：SafeApply 拒绝后的回滚、冷却、死锁打破。
4. Observer Ingress：玩家作为源头与观察者的合规输入链路。
5. AI Context & Meta-Mapper：低 Token 上下文编译、Prompt 模板、结构化输出解析。
6. Multi-Agent Conflict Resolver：多主体资源、空间、行动冲突仲裁。
7. Model Router & Deterministic Fallback：LLM 失败时的本地确定性兜底。

---

## 2. Memory Lifecycle：记忆生命周期

长期运行世界不能把所有日志无限送入 AI 上下文。日志是展示，记忆是会影响未来决策的内部状态。

| 记忆层 | 含义 | 生命周期 | 作用 |
| --- | --- | --- | --- |
| Working Memory | 当前 Tick 的感知、意图、风险、目标 | 单 Tick | 支撑当轮判断 |
| Short-term Memory | 最近事件、失败、成功、等待原因 | 数小时到数天 | 影响近期行为偏置 |
| Episodic Memory | 重要经历，如首次建设成功、首次审计拒绝 | 长期 | 形成管家人生经历 |
| Reflection Memory | 对多个事件压缩后的经验总结 | 长期 | 降低 Token 成本并保留因果经验 |
| Soul Drift | 长期经验对倾向的微弱修正 | 慢速演化 | 影响但不覆盖紫微灵魂底盘 |
| Forgetting Policy | 删除低价值碎片，保留摘要和学习效果 | 定期触发 | 防止记忆爆炸 |

原则：

```txt
原始日志不能无限进入 AI 上下文。
记忆必须先压缩为经验、倾向和反思，再影响下一轮决策。
```

---

## 3. Constraint Kernel：世界法则边界

AI 可以生成意图，但不能绕过世界法则。V2.2 必须将规则分成三类。

| 约束类型 | 例子 | 执行者 | AI 是否可绕过 |
| --- | --- | --- | --- |
| Hard Constraints | 资源不能凭空增加、不能越界放置、不能默认生成宠物、不能绕过 SafeApply | ResourceCycle / SafeApply / World Laws | 绝不允许 |
| Soft Constraints | 管家更倾向等待、整理、维护、保护、扩张 | Motivation / Intent Ranking | 可被人格、记忆、世界状态调整 |
| Narrative Constraints | 如何解释行为、P-Phone 如何表达 | Explanation Layer | 可变，但不能制造事实 |

关键红线：

```txt
LLM 或 AI 决策只能影响软约束和解释层。
硬约束必须由底层代码锁死。
```

---

## 4. Failure Recovery：异常恢复与死锁打破

SafeApply 拒绝不能只是日志，也必须影响管家的意识状态和下一轮动机。

| 结果 | Conscious State 变化 | 下一轮影响 |
| --- | --- | --- |
| SafeApply Accepted | 满足、稳定、信心增加 | 同类意图 confidence 上升 |
| Resource Rejected | 困惑、谨慎、资源焦虑 | 转向 prepare_resources / wait_and_record |
| Spatial Rejected | 犹豫、重新观察 | 转向 observe_world / maintain_boundary |
| Guardrail Rejected | 警惕、禁忌增强 | 降低相关意图，写入安全记忆 |
| 连续拒绝 | 挫败、冷却、转移目标 | 触发 Deadlock Breaker |

死锁打破规则：

```txt
同类意图连续失败 N 次后进入冷却。
冷却期间 Intent Ranking 必须降低同类目标权重。
管家必须转向观察、等待、记录、资源准备或解释。
```

---

## 5. Observer Ingress：玩家观察者输入链路

玩家不是建造者，但玩家不是无关者。玩家作为世界源头和观察者，其输入必须通过合规投影影响管家。

| 玩家行为 | 禁止方式 | 正确方式 |
| --- | --- | --- |
| 希望建住所 | 直接建房 | 形成 PlayerSignal，进入管家感知与关系记忆 |
| 投喂 | 凭空改变状态 | 变成资源输入事件，经 ResourceCycle 与 SafeApply |
| 长期不打开 | 世界暂停 | 世界继续运行，管家形成独自维护记忆 |
| 经常查看日志 | 控制管家 | 增加解释倾向和关系感知 |
| 表达担心 | 直接改结果 | 作为情绪信号影响 IntentScore 外部 Bias |

链路：

```txt
Player Interaction
-> Observer Signal
-> Signal Audit
-> Butler Perception Bias
-> Relationship Memory
-> IntentScore ExternalBias
```

---

## 6. AI Context & Meta-Mapper：LLM 工程适配层

结构化世界状态不能原样无限丢给大模型。必须新增 AI 上下文编译与结构化输出解析层。

| 模块 | 职责 |
| --- | --- |
| Context Compiler | 将 HomeMapState、EcologyState、Memory 摘要成低 Token 上下文 |
| Prompt Template Registry | 管理感知、动机、反思、解释等任务模板 |
| Metadata Mapper | 将数值、状态、约束转换成 AI 可理解的语义摘要 |
| Structured Output Parser | 将 AI 输出解析为 ButlerAutonomousIntent 或 Reflection |
| Output Validator | 校验 schema、越权、红线、非法事实 |
| Prompt Budget Manager | 控制上下文长度与成本 |
| Model Router | 决定哪些任务走 LLM，哪些任务走确定性算法 |
| Deterministic Fallback | LLM 失败时提供本地稳定兜底 |

红线：

```txt
LLM 不能直接写世界。
LLM 只能输出候选意图、候选解释、候选反思。
所有输出必须结构化、验证、审计后才能进入下游。
```

---

## 7. Multi-Agent Conflict Resolver：多主体冲突仲裁

MVP 阶段可以单管家优先，但架构必须预留多主体能力。

| 冲突类型 | 例子 | 解决机制 |
| --- | --- | --- |
| 资源冲突 | 多主体同时消耗同一批资源 | Resource Lock |
| 空间冲突 | 多个建设计划占同一区域 | Spatial Reservation |
| 行动冲突 | 一个维护，一个拆除 | Intent Arbitration |
| Tick 冲突 | 同一 Tick 多个 MapDiff 写入 | Transaction Queue |
| 社交冲突 | 目标互相矛盾 | Relationship Mediation |

预留链路：

```txt
World Tick Scheduler
-> Intent Queue
-> Conflict Resolver
-> Transaction Ordering
-> SafeApply
```

---

## 8. V2.2 升级后的核心闭环

```txt
Player / World / Memory 输入
-> Observer Signal Audit
-> Context Compiler / Meta-Mapper
-> Butler World Perception
-> Conscious State
-> Motivation Engine
-> Goal Generator
-> Intent Ranking
-> Intent Audit
-> Planner
-> ResourceCycle
-> Conflict Resolver
-> MapDiff
-> SafeApply
-> Accepted / Rejected
-> Failure Recovery
-> Memory Lifecycle
-> Learning Update
-> Next Intent Bias
```

这代表 AI-PET-WORLD 从“AI 自主世界主骨架”升级为“生产级 AI Agent 世界运行系统”。

---

## 9. 工程优先级

| 优先级 | 模块 | 原因 |
| --- | --- | --- |
| P0 | Memory Lifecycle Manager | 长期运行世界必须控制记忆成本和学习质量 |
| P0 | Constraint Kernel | 防止 AI 绕过世界法则和资源守恒 |
| P0 | Failure Recovery | 防止 SafeApply 拒绝后死循环 |
| P0 | Observer Ingress | 让玩家作为源头合规影响世界 |
| P0 | AI Context & Meta-Mapper | MVP 需要可控地使用 LLM/结构化输出 |
| P1 | Model Router & Fallback | 提升稳定性和成本控制 |
| P1 | Multi-Agent Conflict Resolver | 为宠物、小镇、多主体未来扩展预留 |

---

## 10. 验收标准

| 验收问题 | 通过标准 |
| --- | --- |
| 记忆是否会无限增长？ | 热/温/冷/反思记忆分层，原始碎片可压缩或遗忘 |
| AI 是否能绕过规则？ | Hard Constraints 由代码执行，LLM 无法直接写世界 |
| SafeApply 拒绝后会不会卡死？ | 连续失败触发冷却和目标切换 |
| 玩家是否能合规影响世界？ | 玩家输入进入 Observer Signal，不直接改 HomeMapState |
| LLM 输出是否可控？ | 输出必须经过 Parser、Validator、Audit |
| 多主体未来是否可扩展？ | 预留 Intent Queue、Conflict Resolver、Transaction Ordering |

---

## 11. 结论

V2.1 解决的是“AI 自主世界主骨架”。

V2.2 补齐的是“生产级 AI Agent 运行护栏”。

后续代码开发必须坚持：

```txt
AI 能生成意图，但不能绕过世界。
玩家能影响管家，但不能直接建造。
记忆能改变未来，但不能无限膨胀。
LLM 能参与推理，但不能直接写事实。
失败必须形成学习，不能进入死循环。
多主体扩展必须预留冲突仲裁。
```
