# AI-PET-WORLD V2.0 AI 核心对齐补充文档

生成日期：2026-05-23  
文档性质：V2.0 主文档、MVP 完整计划书、MVP 架构设计文档、规则生态世界与人格驱动引擎文档的工程补充  
当前用途：在继续写代码前，统一“我们到底在写什么 AI”，并明确当前架构缺口、下一阶段模块边界与验收标准。

---

## 0. 本补充文档的地位

本补充文档不是替代原四份 V2.0 文档，而是把最近开发过程中暴露出的核心分歧补齐：

- AI-PET-WORLD 不是普通宠物游戏。
- AI-PET-WORLD 不是玩家手动建造游戏。
- AI-PET-WORLD 不是只靠固定规则驱动的模拟器。
- AI-PET-WORLD 的核心是：由生命信息生成的 AI 管家，在规则生态世界中，依靠人格、记忆、观察、学习和自主判断推动世界演化。

后续若口径冲突，优先级仍然是：

1. 用户当轮明确指令
2. V2.0 统一主文档
3. V2.0 MVP 完整计划书
4. V2.0 MVP 整体架构设计文档
5. V2.0 规则生态世界与人格驱动引擎设计文档
6. 本补充文档
7. 仓库既有代码

本补充文档用于约束后续 AI 核心模块开发，尤其是 `BUTLER-SOUL-AUTONOMY-CORE`。

---

## 1. 最高产品定义

AI-PET-WORLD 的核心定义应固定为：

```txt
AI-PET-WORLD 是一个由生命信息人格映射驱动的长期运行 AI 自主世界。
玩家是世界源头和观察者。
管家是由玩家生命信息生成的自主管理者，不是执行玩家按钮的 NPC。
世界有地貌、资源、生态、时间、风险、空间和审计规则。
管家在这些真实世界约束中，依靠人格、记忆、学习、观察和动机，自主建设、维护、等待或拒绝。
宠物/伴生生命是后置 LifeEvent，不是默认开局资产。
```

一句话：

```txt
世界提供现实，紫微斗数提供灵魂，记忆提供经历，学习提供成长，管家意识决定行动。
```

---

## 2. “规则”的正确定义

开发中不能把“规则”理解成传统游戏脚本。

错误理解：

```txt
第 1 天建临时住所。
资源够就建照护点。
空间够就建储物区。
系统预设几个建筑目标，管家从里面选一个。
```

正确理解：

```txt
规则是世界自然法则，不是管家行为剧本。
```

| 规则类型 | 正确含义 | 是否控制管家 |
| --- | --- | --- |
| 地貌规则 | 沙漠、绿洲、森林、草地有不同资源上限、恢复速度、风险与建设限制 | 不直接控制，只提供现实约束 |
| 资源规则 | 材料、水、土地、生态健康、空间压力不能凭空变化 | 不直接控制，只限制可行性 |
| 时间规则 | 世界有 Tick、阶段、等待、长期衰退和恢复 | 不直接控制，只影响环境 |
| 审计规则 | 世界变化必须进入 HomeMapState、MapDiff、SafeApply | 不直接控制，只保证可信 |
| 生命规则 | 管家、宠物、未来居民是自主生命，不是 UI 对象 | 不直接控制，只定义边界 |

因此，后续代码中应避免把 `ConstructionPlanner` 设计成最高决策者。它只能接收管家意识层输出的意图，然后把意图转成可执行计划。

---

## 3. AI 管家的本体定义

管家不是：

- 建造按钮的执行器
- 固定任务列表的 NPC
- 宠物服务员
- UI 讲解员
- 单纯人格标签展示器

管家是：

```txt
由玩家生命信息映射出的 AI 自主管理者。
他有灵魂底盘、当前意识、记忆、感知、动机、学习和行动倾向。
```

管家可以：

| 能力 | 含义 |
| --- | --- |
| 观察 | 观察资源、生态、空间、边界、风险、建设状态、未来生命机会 |
| 判断 | 根据人格、记忆、世界状态形成内部判断 |
| 等待 | 资源不足、风险过高、动机不明确时可以不建 |
| 建设 | 在现实约束允许时建设住所、储物、照护、边界、路径、安静区等 |
| 维护 | 修复、整理、清理、保留自然边界 |
| 记录 | 把行动、失败、成功、风险、偏好写入记忆 |
| 学习 | 下次决策受过往结果影响，不是每次重新随机 |
| 拒绝 | 可以延迟、拒绝、暂不接纳伴生生命 |

---

## 4. 紫微斗数在系统中的位置

紫微斗数不是前台卖点，也不是装饰标签。它是管家的“灵魂底盘”。

它应该影响：

| 影响对象 | 说明 |
| --- | --- |
| 风险感知 | 管家看到同样风险时，是谨慎、冒险、焦虑还是稳定 |
| 观察重点 | 管家更关注安全、秩序、舒适、自然、资源、关系或扩张 |
| 建设节奏 | 快速行动、等待观察、先整理、先维护、先搭遮蔽等 |
| 资源偏好 | 材料、水、空间、生态、照护准备的优先权重 |
| 房屋偏好 | 开放、紧凑、隐蔽、自然融合、秩序化、防御型等 |
| 维护倾向 | 是否喜欢定期整理、是否容忍自然生长、是否偏好边界感 |
| 伴生生命态度 | 是否愿意接纳、是否延迟、是否需要更高安全感 |
| 记忆解释方式 | 成功或失败会被解释成什么经验 |

紫微斗数不能单独完成：

- 学习
- 因果反馈
- 资源规划
- 世界观察
- 长期记忆
- 行动后更新

因此正确架构是：

```txt
紫微斗数 = 灵魂底色
记忆系统 = 人生经历
世界系统 = 现实环境
学习系统 = 成长能力
意识系统 = 当前判断
行动系统 = 对世界产生变化
```

---

## 5. 当前代码与目标架构对齐表

| 目标能力 | 当前代码/模块 | 状态 | 备注 |
| --- | --- | --- | --- |
| HomeMapState 世界事实容器 | `src/world/map-state/home-map-state-schema.ts` | 已有 | 已增加 `ecologyState`，方向正确 |
| MapDiff 变化记录 | `MapDiff` / construction executor | 已有 | 已支持 add/update 建设变化 |
| SafeApply 审计门 | `construction-safe-apply-runtime.ts` | 已有 | 已支持建设 add 并刷新生态状态 |
| 初始世界与管家建设边界 | `initial-home-generator.ts` | 初步完成 | 初始世界不再直接生成住所/照护点 |
| 世界生态状态 | `world-ecology-state.ts` | 初步完成 | 当前是生态摘要，不是完整生态引擎 |
| 管家建设执行管道 | ConstructionPlanner/Executor/SafeApply | 初步完成 | 是行动管道，不是 AI 本体 |
| 房屋偏好 | house-style 相关模块 | 部分完成 | 还需要听从管家意识层 |
| 伴生生命后置 | LifeEvent/CompanionDecision | 部分完成 | 当前红线方向正确 |
| 紫微人格底盘 | personality/butler profile | 部分完成 | 还没有真正成为意识发动机 |
| 管家自主意识 | 缺少独立核心 | 缺失 | 下一阶段 P0 |
| 管家记忆学习 | memory/learning 尚未闭环 | 缺失 | 下一阶段 P0 |
| 行动反馈写入记忆 | 尚未形成 | 缺失 | 下一阶段 P0 |
| 多主体社区/小镇 | 未做 | 后置 | 非当前 MVP 首要目标 |

---

## 6. 当前最大架构缺口

当前系统已经有：

```txt
世界状态容器
-> 建设计划
-> MapDiff
-> SafeApply
-> 可视化投影
```

但缺少：

```txt
管家灵魂
-> 管家意识
-> 世界感知
-> 记忆读取
-> 动机生成
-> 自主目标生成
-> 行动意图
-> 行动反馈学习
```

也就是说，当前最大风险是：

```txt
把 ConstructionPlanner 误当成 AI 管家本体。
```

正确边界应改为：

```txt
ButlerSoulAutonomyCore 负责“管家想做什么、为什么想做”。
ConstructionPlanner 负责“如何把这个意图转为可执行建设计划”。
Executor 负责“如何生成 MapDiff”。
SafeApply 负责“是否允许进入世界事实”。
WorldLoop 负责“把这一轮变化接回长期世界运行”。
Memory/Learning 负责“这次行动如何影响下一次判断”。
```

---

## 7. 新核心模块：BUTLER-SOUL-AUTONOMY-CORE

下一阶段应补齐的 P0 模块为：

```txt
BUTLER-SOUL-AUTONOMY-CORE
```

目标：

```txt
把紫微人格、世界生态、资源状态、当前建设状态、记忆和学习偏好合成为管家的自主行动意图。
```

它不是建设模块，不直接写 HomeMapState，不直接生成 MapDiff。

它输出：

```txt
ButlerAutonomousIntent
```

再由 ConstructionPlanner、EventLog、MemoryUpdate 等下游模块消费。

### 7.1 子模块划分

| 子模块 | 目录建议 | 职责 |
| --- | --- | --- |
| Soul Profile Adapter | `src/ai/butler-autonomy/soul-profile.ts` | 把紫微人格/生命信息人格结果转成管家长期灵魂向量 |
| Conscious State | `src/ai/butler-autonomy/conscious-state.ts` | 表示当前意识：观察、警惕、专注、疲惫、等待、整理冲动等 |
| World Perception | `src/ai/butler-autonomy/world-perception.ts` | 管家如何感知资源、生态、风险、空间、未完成建设 |
| Memory Seed | `src/ai/butler-autonomy/butler-memory.ts` | MVP 阶段先做最小记忆结构，记录行动和结果 |
| Motivation Engine | `src/ai/butler-autonomy/motivation-engine.ts` | 生成内在动机：安全、照护、整理、探索、维护、等待 |
| Goal Generator | `src/ai/butler-autonomy/goal-generator.ts` | 从动机生成目标，不从固定任务列表直接选 |
| Intent Gateway | `src/ai/butler-autonomy/gateway.ts` | 对外只暴露统一入口 |
| Learning Update | `src/ai/butler-autonomy/learning-update.ts` | 根据行动结果更新记忆和偏好 |
| Audit | `src/ai/butler-autonomy/audit.ts` | 审计意图是否越权、是否绕过世界规则 |

### 7.2 最小输出类型草案

```ts
export type ButlerAutonomousIntentKind =
  | "observe_world"
  | "wait_and_record"
  | "prepare_resources"
  | "maintain_boundary"
  | "stabilize_shelter"
  | "organize_storage"
  | "prepare_care"
  | "preserve_quiet_space"
  | "explain_to_player";

export type ButlerAutonomousIntent = {
  intentId: string;
  kind: ButlerAutonomousIntentKind;
  priority: number;
  confidence: number;
  emotionalTone: "calm" | "focused" | "cautious" | "uncertain" | "protective";
  sourceMotivations: string[];
  perceivedWorldFacts: string[];
  memoryReferences: string[];
  constructionAllowed: boolean;
  reason: string;
  tags: string[];
};
```

### 7.3 最小输入类型草案

```ts
export type ButlerAutonomyInput = {
  worldId: string;
  ownerId: string;
  now: number;
  worldDay: number;
  homeMapState: HomeMapState;
  ecologyState: WorldEcologyState;
  butlerSoulProfile: ButlerSoulProfile;
  butlerMemoryState: ButlerMemoryState;
  recentSafeApplyResult?: ConstructionSafeApplyResult;
  tags: string[];
};
```

---

## 8. 管家自主决策链路

后续目标链路：

```txt
CreateWorldInput
-> ButlerSoulProfile
-> HomeMapState + WorldEcologyState
-> ButlerWorldPerception
-> ButlerMemoryState
-> MotivationEngine
-> ButlerAutonomousIntent
-> ConstructionPlannerInput
-> ConstructionPlan
-> Executor
-> MapDiff
-> SafeApply
-> HomeMapState 更新
-> EcologyState 刷新
-> Memory/Learning 更新
-> /world 只读展示
```

这条链路必须满足：

| 要求 | 说明 |
| --- | --- |
| 管家先感知再行动 | 不能直接从固定建设列表选 |
| 可以等待 | 不行动也是合法行为 |
| 可以只记录 | 管家可能先记录资源不足，不建 |
| 可以拒绝扩张 | 不是所有世界都积极建设 |
| 行动后要学习 | 成功、失败、被 SafeApply 拒绝都会进入记忆 |
| 建设仍走 SafeApply | 管家再自主也不能绕过世界事实容器 |
| UI 只读 | 页面不能直接替管家决定 |

---

## 9. 对现有 Construction 模块的重新定位

当前 Construction 模块不废弃，但要降级为“执行层”。

| 模块 | 新定位 |
| --- | --- |
| `construction-planner-input-builder.ts` | 不再独立决定最高意图，而是接收 `ButlerAutonomousIntent` 后构建计划输入 |
| `construction-planner.ts` | 把意图转成候选计划，不再假装自己是管家大脑 |
| `construction-executor-runtime.ts` | 继续负责 add/update MapDiff 候选 |
| `construction-safe-apply-runtime.ts` | 继续负责审计和写入世界状态 |
| `deferred-construction-placement.ts` | 后续需要从“目标模板”升级成“由管家意图 + 世界约束决定的建设形态候选” |

当前临时住所、照护点、储物区、安静区不应该理解成写死建筑路线，而应理解成 MVP 阶段的可执行建设结果类型。后续要让这些类型由管家意图自然产生，而不是由系统预设任务驱动。

---

## 10. 对 World Ecology 的定位

当前 `WorldEcologyState` 是正确方向，但仍是第一版。

它应该长期演化为：

| 层级 | 内容 |
| --- | --- |
| 地貌事实 | 草地、森林、沙漠、绿洲等稳定规则 |
| 植物事实 | 草、树、花、灌木、自然边界、生长阶段 |
| 昆虫迹象 | 生态健康达到条件后出现的背景生命迹象 |
| 野外活动迹象 | 小动物活动，不等于宠物入场 |
| 资源事实 | 材料、水、土地容量、照护准备、生态健康 |
| 微气候事实 | 湿度、舒适度、热/冷压力、光照 |
| 建设影响 | 管家建设会改变空间压力、生态压力和维护需求 |

关键红线：

```txt
小动物/野外活动迹象属于世界生态，不等于宠物，也不能绕过 LifeEvent。
```

---

## 11. MVP 当前状态判断

| 阶段 | 状态 | 是否符合文档 |
| --- | --- | --- |
| 世界事实容器 | 已形成 | 是 |
| UI 只读原则 | 基本形成 | 是 |
| 初始建筑剥离 | 已做 | 是 |
| 管家建设 MapDiff 链路 | 已做 | 是 |
| SafeApply add 支持 | 已做 | 是 |
| EcologyState 初始写入和刷新 | 已做 | 是，初版 |
| 管家自主意识 | 未做 | 不足 |
| 记忆学习闭环 | 未做 | 不足 |
| 紫微人格深度决策 | 未做 | 不足 |
| 代码与文档最大差距 | AI 管家本体层缺失 | P0 |

结论：

```txt
当前架构底座没有推倒风险，但核心 AI 层缺失。
下一阶段不能继续只补建设功能，必须先补 Butler Soul Autonomy Core。
```

---

## 12. 下一阶段执行顺序

建议后续从文档和代码两条线同步推进。

| 顺序 | 模块 | 类型 | 目标 |
| ---: | --- | --- | --- |
| 1 | `BUTLER-SOUL-AUTONOMY-DOC-00` | 文档 | 把管家灵魂、自主意识、学习闭环写入计划书和架构文档 |
| 2 | `BUTLER-SOUL-AUTONOMY-SCHEMA-00` | 代码 | 新增 ButlerAutonomy 类型、输入输出、审计字段 |
| 3 | `BUTLER-WORLD-PERCEPTION-00` | 代码 | 让管家从 HomeMapState/EcologyState 形成感知 |
| 4 | `BUTLER-MOTIVATION-ENGINE-00` | 代码 | 生成内在动机，而不是直接生成建设目标 |
| 5 | `BUTLER-GOAL-GENERATOR-00` | 代码 | 从动机生成自主目标，可建设、可等待、可记录 |
| 6 | `BUTLER-MEMORY-SEED-00` | 代码 | 最小记忆结构，记录行动、结果、解释 |
| 7 | `CONSTRUCTION-LISTENS-TO-BUTLER-00` | 代码 | ConstructionPlanner 接收 ButlerAutonomousIntent |
| 8 | `LEARNING-FEEDBACK-00` | 代码 | SafeApply 结果反写记忆，影响下一轮 |
| 9 | `WORLD-UI-AUTONOMY-AUDIT-00` | UI/文档 | /world 显示“管家为什么这样做”，而不是只显示建了什么 |

---

## 13. 后续验收标准

`BUTLER-SOUL-AUTONOMY-CORE` 完成后，必须能回答这些问题：

| 问题 | 验收标准 |
| --- | --- |
| 管家为什么行动？ | ViewModel/P-Phone/Log 能显示来源动机、世界观察、人格倾向 |
| 管家为什么不行动？ | 等待、观察、记录必须是合法 intent |
| 这个决定是否受人格影响？ | 不同人格在同一世界约束下，优先级和解释不同 |
| 这个决定是否受资源影响？ | 资源不足时不能直接建成，必须等待、整理或记录 |
| 这个决定是否受生态影响？ | EcologyState 的地貌/植物/空间压力影响动机 |
| 这次结果是否进入记忆？ | 成功/失败/拒绝必须进入 ButlerMemoryState |
| 下次是否会变？ | 记忆和学习偏好必须影响下一轮意图分数 |
| 是否绕过世界规则？ | 不允许绕过 MapDiff/SafeApply |
| 是否生成默认宠物？ | 不允许 |

---

## 14. 明确不做事项

在完成 Butler Soul Autonomy Core 前，不应优先做：

- 大量新增建筑资产
- 宠物入场
- 宠物行为系统
- 社区/小镇完整模拟
- 玩家直接建设入口
- 复杂商业化系统
- 过度视觉精修

原因：这些都依赖管家/生命体自主意识层。如果先做，会把项目重新带回传统游戏。

---

## 15. 最终结论

当前项目已经建立了世界事实容器、建设变化链路和生态状态底座。下一步的真正核心不是继续堆建筑，而是补齐 AI 管家的“灵魂 -> 意识 -> 记忆 -> 学习 -> 动机 -> 自主目标 -> 行动反馈”闭环。

后续开发必须坚持：

```txt
世界法则约束现实。
紫微斗数生成灵魂。
记忆形成经历。
学习改变未来。
管家自主决定行动。
建设系统只是执行器。
UI 只是观察窗口。
```

这才是 AI-PET-WORLD 与普通宠物游戏、建造游戏、AI 聊天角色的根本区别。
