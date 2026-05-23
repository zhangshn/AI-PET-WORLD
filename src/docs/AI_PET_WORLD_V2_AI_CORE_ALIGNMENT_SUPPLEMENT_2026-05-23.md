# AI-PET-WORLD V2.0 AI 核心架构对齐文档

生成日期：2026-05-23  
版本：v1.1 专业架构版  
文档性质：V2.0 主文档、MVP 完整计划书、MVP 架构设计文档、规则生态世界与人格驱动引擎设计文档的 AI 核心补充说明  
适用范围：产品架构、AI 核心工程架构、后续 Codex/人工开发执行、MVP 验收口径  
当前目标：在继续写代码前，明确“我们正在写一套什么 AI”，并把管家自主意识、紫微人格、世界生态、记忆学习、建设执行之间的架构边界写清楚。

---

## 0. 文档地位与使用方式

本文件不是替代四份 V2.0 主文档，而是把四份文档中分散表达的 AI 核心思想，整理成一份可以直接指导工程落地的专业架构说明。

后续若出现理解冲突，优先级如下：

| 优先级 | 依据 | 说明 |
| ---: | --- | --- |
| 1 | 用户当轮明确指令 | 当前聊天中用户明确纠正或指定的内容优先 |
| 2 | V2.0 统一主文档 | 产品最高设定与世界观依据 |
| 3 | V2.0 MVP 完整计划书 | MVP 范围、周期和验收依据 |
| 4 | V2.0 MVP 整体架构设计文档 | 工程分层与模块边界依据 |
| 5 | V2.0 规则生态世界与人格驱动引擎设计文档 | 世界规则、人格驱动、生态模拟依据 |
| 6 | 本文档 | AI 管家核心、记忆学习、意识架构补充 |
| 7 | 当前仓库代码 | 代码必须被文档校正，而不是反过来限制产品核心 |

本文件必须被视为后续 `BUTLER-SOUL-AUTONOMY-CORE`、`BUTLER-WORLD-PERCEPTION`、`BUTLER-MOTIVATION-ENGINE`、`BUTLER-MEMORY-LEARNING` 等模块的设计依据。

---

## 1. 产品本质定义

AI-PET-WORLD V2.0 不是传统宠物游戏、不是玩家建造游戏、不是纯聊天 AI，也不是简单规则模拟器。

它的专业定义是：

```txt
AI-PET-WORLD 是一个由生命信息人格映射驱动的长期运行 AI 自主世界。

玩家是世界源头和观察者。
管家是由玩家生命信息生成的 AI 自主管理者。
宠物是未来由世界事件产生的独立生命。
世界是具有时间、地貌、资源、生态、空间、风险和审计规则的持续状态容器。

管家依靠紫微人格底盘、世界感知、记忆、学习、内在动机和自主目标生成，推动家园建设、维护、等待、记录和解释。
```

一句话定义：

```txt
世界提供现实，紫微斗数提供灵魂，记忆提供经历，学习提供成长，管家意识决定行动，建设系统只是执行器，UI 只是观察窗口。
```

---

## 2. 核心产品红线

### 2.1 玩家不是建造者

玩家不能在正式世界中直接建造房屋、放置道路、摆放宠物床、放置宠物或决定家园结构。

玩家可以：

- 创建世界。
- 提供生命信息。
- 观察世界。
- 通过 P-Phone、日志、管家解释理解世界。
- 在未来进行有限反馈。

玩家不可以：

- 直接下达“建这个建筑”的指令。
- 直接拖拽物品改变世界事实。
- 绕过管家意识和 SafeApply 写入世界。

### 2.2 管家不是 NPC

管家不是任务脚本，也不是玩家按钮的执行器。

管家应被视为一个 AI 自主生命载体，具备：

| 能力 | 说明 |
| --- | --- |
| 灵魂底盘 | 由生命信息与紫微人格系统生成的长期人格结构 |
| 当前意识 | 当前的观察状态、情绪倾向、注意力、风险感知、行动冲动 |
| 世界感知 | 对资源、生态、地貌、空间、建设状态、未来生命机会的理解 |
| 记忆 | 做过什么、失败过什么、观察到什么、形成过什么偏好 |
| 学习 | 行动结果影响未来判断，不是每次重置 |
| 动机 | 安全、照护、整理、维护、探索、等待、解释等内在驱动 |
| 自主目标 | 从动机和环境中形成目标，而不是从固定任务表机械选择 |
| 行动解释 | 能解释“我为什么这么做/为什么不做” |

### 2.3 世界规则不是行为脚本

“规则”不是：

```txt
第 1 天建住所。
材料够就建照护点。
空间够就建储物区。
```

“规则”是世界自然法则：

| 世界规则 | 正确含义 |
| --- | --- |
| 资源守恒 | 材料、照护、水、土地、生态健康不能凭空无限增加 |
| 地貌约束 | 森林、草地、沙漠、绿洲等地貌影响资源和建设可行性 |
| 空间约束 | 建设需要位置，空间压力会影响接纳生命和扩张 |
| 生态约束 | 花草树木、昆虫迹象、小动物活动来自自然条件，不是管家建出来 |
| 审计约束 | 世界变化必须通过 HomeMapState、MapDiff、SafeApply |
| 生命约束 | 宠物/伴生生命必须后置，不能默认生成 |

正确关系：

```txt
世界法则约束现实。
管家在现实约束中自主生活。
```

### 2.4 紫微斗数不是 UI 术语，是灵魂底盘

正式 UI 不展示原始命理术语，但内部可以使用紫微斗数作为人格生成和长期倾向底盘。

紫微斗数应影响：

- 风险感知。
- 行动节奏。
- 建设偏好。
- 照护倾向。
- 维护习惯。
- 对自然边界的态度。
- 对未来生命接纳的谨慎程度。
- 成功/失败记忆的解释方式。

紫微斗数不能单独完成：

- 学习。
- 世界观察。
- 因果反馈。
- 长期记忆。
- 资源规划。
- 行动后调整。

因此系统必须采用：

```txt
紫微人格底盘 + 记忆 + 世界感知 + 学习 + 动机 + 目标生成
```

---

## 3. 总体架构总览

AI-PET-WORLD V2.0 的目标架构应按 12 层划分。

```txt
┌──────────────────────────────────────────────┐
│ 12. /world Formal UI                         │
│ 只读展示 FormalVisualModel / P-Phone / Log   │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 11. Explanation & Observability Layer         │
│ 管家解释、审计日志、MVP Checklist、F3 Debug   │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 10. Visual Projection Layer                   │
│ HomeMapState -> RenderableSnapshot -> FVM     │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 09. SafeApply & Audit Layer                   │
│ MapDiff 审计、禁止 token、状态不可变更新       │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 08. Action Execution Layer                    │
│ Construction Executor / Resource Transaction  │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 07. Planner Layer                             │
│ 将 ButlerAutonomousIntent 转换为可执行计划     │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 06. Butler Soul Autonomy Core                 │
│ 感知、意识、动机、自主目标、记忆引用、学习偏置  │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 05. Memory & Learning Layer                   │
│ 行动记录、结果反馈、偏好更新、失败修正         │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 04. Personality / Soul Layer                  │
│ 生命信息 -> 紫微人格 -> 管家灵魂底盘           │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 03. World Ecology & Resource Layer            │
│ 地貌、资源、生态、空间压力、自然事实           │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 02. World State Layer                         │
│ HomeMapState / MapDiff / ConstructionPlan     │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 01. World Runtime Layer                       │
│ Tick、时间、阶段、事件、持久化                 │
└──────────────────────────────────────────────┘
                      ↑
┌──────────────────────────────────────────────┐
│ 00. Player Source Layer                       │
│ 生命信息、世界 seed、创建世界输入              │
└──────────────────────────────────────────────┘
```

重要原则：

```txt
Butler Soul Autonomy Core 是 AI 管家的大脑。
Construction Planner 是行动规划器。
SafeApply 是世界事实审计门。
/world 是观察窗口。
```

---

## 4. 核心运行闭环

### 4.1 创建世界闭环

```txt
CreateWorldInput
-> 生命信息标准化
-> 紫微人格 / 管家灵魂底盘
-> Stable World Seed
-> Initial HomeMapState
-> WorldEcologyState
-> FormalVisualModel
-> /world 只读展示
```

创建世界阶段只允许生成：

- 自然地貌。
- 自然资源。
- 世界生态初始状态。
- 管家观察入口。
- 初始建设意图占位。

不得生成：

- 已完成住所。
- 已完成照护点。
- 宠物。
- 宠物床。
- 孵化器。
- 胚胎。

### 4.2 世界 Tick 闭环

```txt
World Tick
-> 读取 HomeMapState / EcologyState / ResourceState
-> 管家世界感知
-> 读取管家记忆
-> 管家意识状态更新
-> 动机生成
-> 自主目标生成
-> ButlerAutonomousIntent
-> Planner 转换计划
-> ResourceCycle 检查资源
-> Executor 生成 MapDiff
-> SafeApply 审计并应用
-> HomeMapState 更新
-> EcologyState 刷新
-> Memory/Learning 更新
-> EventLog / P-Phone / FormalVisualModel 刷新
```

### 4.3 学习闭环

```txt
Intent
-> Action Attempt
-> SafeApply Result
-> World Feedback
-> ButlerMemoryEvent
-> Learning Update
-> Preference Drift
-> Next Intent Bias
```

验收重点：管家下一次判断必须能受到过去结果影响。

---

## 5. 领域模型与边界

| 领域对象 | 定义 | 归属层 | 是否世界事实 |
| --- | --- | --- | --- |
| PlayerSource | 玩家生命信息、创建世界输入 | Player Source | 否 |
| ButlerSoulProfile | 管家长期人格/灵魂底盘 | Personality/Soul | 否，属于 AI 内部状态 |
| ButlerConsciousState | 管家当前意识状态 | Autonomy Core | 否，属于 AI 内部状态 |
| ButlerWorldPerception | 管家对世界的主观感知 | Autonomy Core | 否，是解释和决策输入 |
| ButlerMemoryState | 管家长期记忆 | Memory/Learning | 否，但影响世界行动 |
| ButlerAutonomousIntent | 管家自主意图 | Autonomy Core | 否，是计划输入 |
| HomeMapState | 世界结构化事实容器 | World State | 是 |
| WorldEcologyState | 生态事实状态 | World Ecology | 是，挂入 HomeMapState |
| ConstructionPlan | 可执行建设计划 | Planner | 是，作为世界计划状态 |
| MapDiff | 世界变化候选 | Action/Audit | 是，审计后进入历史 |
| SafeApplyResult | 变化审计结果 | Audit | 是，影响状态和记忆 |
| FormalVisualModel | 视觉投影 | Visual | 否，是只读派生结果 |
| PPhoneMessage | 解释消息 | Explanation | 否，是展示投影 |

---

## 6. Butler Soul Autonomy Core 专业架构

### 6.1 模块定位

`Butler Soul Autonomy Core` 是 AI 管家的核心意识层。

它负责回答：

- 管家现在看到了什么？
- 管家在意什么？
- 管家为什么紧张、等待、维护、建设或记录？
- 管家为什么不建？
- 管家现在的行动是否受到人格影响？
- 管家是否记得过去的结果？
- 管家是否因为过去经验改变了选择？

它不负责：

- 直接修改 HomeMapState。
- 直接写 MapDiff。
- 直接渲染 UI。
- 直接生成宠物。
- 绕过 SafeApply。

### 6.2 子模块结构

建议目录：

```txt
src/ai/butler-autonomy
├── schema.ts
├── gateway.ts
├── soul-profile-adapter.ts
├── conscious-state.ts
├── world-perception.ts
├── motivation-engine.ts
├── goal-generator.ts
├── intent-ranking.ts
├── memory-state.ts
├── learning-update.ts
├── audit.ts
└── explanation.ts
```

| 文件 | 职责 | 输入 | 输出 |
| --- | --- | --- | --- |
| `schema.ts` | 定义自主意识层类型 | 无 | TS types |
| `gateway.ts` | 唯一对外入口 | ButlerAutonomyInput | ButlerAutonomyResult |
| `soul-profile-adapter.ts` | 将紫微人格转为管家长期灵魂向量 | personality profile | ButlerSoulProfile |
| `conscious-state.ts` | 计算当前意识状态 | soul + perception + memory | ButlerConsciousState |
| `world-perception.ts` | 管家主观感知世界 | HomeMapState + EcologyState | ButlerWorldPerception |
| `motivation-engine.ts` | 生成内在动机 | soul + perception + memory | ButlerMotivation[] |
| `goal-generator.ts` | 从动机生成自主目标 | motivations | ButlerGoal[] |
| `intent-ranking.ts` | 对目标排序并形成意图 | goals + constraints | ButlerAutonomousIntent |
| `memory-state.ts` | 最小记忆结构 | events | ButlerMemoryState |
| `learning-update.ts` | 行动后学习 | SafeApplyResult + memory | updated memory |
| `audit.ts` | 审计意图越权 | intent | warnings/tags |
| `explanation.ts` | 生成可解释文本 | result | P-Phone / logs |

### 6.3 输入输出契约

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

export type ButlerAutonomyResult = {
  perception: ButlerWorldPerception;
  consciousState: ButlerConsciousState;
  motivations: ButlerMotivation[];
  candidateGoals: ButlerGoal[];
  selectedIntent: ButlerAutonomousIntent;
  memoryEffects: ButlerMemoryEffect[];
  audit: ButlerAutonomyAudit;
  explanations: ButlerAutonomyExplanation[];
  tags: string[];
};
```

### 6.4 ButlerSoulProfile 草案

```ts
export type ButlerSoulProfile = {
  soulId: string;
  source: "ziwei_life_profile" | "fallback_life_profile";
  riskSensitivity: number;
  orderPreference: number;
  careDrive: number;
  explorationDrive: number;
  boundaryDrive: number;
  resourcePrudence: number;
  socialWarmth: number;
  patience: number;
  rhythmBias: "morning" | "daytime" | "evening" | "night" | "balanced";
  explanationTone: "calm" | "practical" | "warm" | "reserved" | "protective";
  tags: string[];
};
```

### 6.5 ButlerWorldPerception 草案

```ts
export type ButlerWorldPerception = {
  worldId: string;
  observedAt: number;
  resourcePressure: number;
  ecologicalStability: number;
  spacePressure: number;
  constructionDebt: number;
  shelterNeed: number;
  careNeed: number;
  storageNeed: number;
  quietSpaceNeed: number;
  boundaryMaintenanceNeed: number;
  companionReadinessConcern: number;
  perceivedFacts: string[];
  risks: string[];
  opportunities: string[];
  tags: string[];
};
```

### 6.6 ButlerMotivation 草案

```ts
export type ButlerMotivationKind =
  | "safety"
  | "care"
  | "order"
  | "resource_prudence"
  | "ecology_respect"
  | "exploration"
  | "waiting"
  | "explanation";

export type ButlerMotivation = {
  motivationId: string;
  kind: ButlerMotivationKind;
  intensity: number;
  sourceSoulFactors: string[];
  sourceWorldFactors: string[];
  sourceMemoryFactors: string[];
  reason: string;
  tags: string[];
};
```

### 6.7 ButlerAutonomousIntent 草案

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
  constructionAllowed: boolean;
  emotionalTone: "calm" | "focused" | "cautious" | "uncertain" | "protective";
  sourceMotivations: string[];
  perceivedWorldFacts: string[];
  memoryReferences: string[];
  reason: string;
  nextExpectedConsumer:
    | "construction_planner"
    | "memory_only"
    | "event_log"
    | "p_phone";
  tags: string[];
};
```

---

## 7. 意识决策算法

### 7.1 决策步骤

`Butler Soul Autonomy Core` 每轮 Tick 应按以下顺序运行：

| 步骤 | 名称 | 说明 |
| ---: | --- | --- |
| 1 | Normalize Input | 统一时间、世界状态、人格、记忆输入 |
| 2 | Build Perception | 从 HomeMapState/EcologyState/ResourceState 形成管家主观感知 |
| 3 | Read Memory | 读取最近行动、失败、成功、偏好和未完成承诺 |
| 4 | Build Conscious State | 形成当前意识状态：观察、警惕、专注、等待、保护等 |
| 5 | Generate Motivations | 生成安全、照护、秩序、资源谨慎、生态尊重等动机 |
| 6 | Generate Goals | 从动机形成候选目标，不从固定建筑列表直接选择 |
| 7 | Score & Rank | 根据人格、世界、记忆、可行性、风险给目标打分 |
| 8 | Select Intent | 选出一个主意图，也可选择等待/记录 |
| 9 | Audit Intent | 检查是否越权、是否绕过世界规则、是否触碰宠物红线 |
| 10 | Explain | 生成给日志/P-Phone/UI 的解释 |

### 7.2 评分原则

意图优先级不应由单一规则决定，而应来自综合评分：

```txt
IntentScore =
  PersonalityBias
+ WorldNeedScore
+ ResourceFeasibility
+ MemoryBias
+ RiskAdjustment
+ TimeRhythmAdjustment
+ RandomnessWithinSeed
- SafetyPenalty
- ResourceViolationPenalty
```

其中：

| 因子 | 说明 |
| --- | --- |
| PersonalityBias | 紫微人格底盘提供长期倾向 |
| WorldNeedScore | 世界当前是否真的需要这个行动 |
| ResourceFeasibility | 资源是否允许，不足时应转为准备/等待 |
| MemoryBias | 曾经成功/失败会影响选择 |
| RiskAdjustment | 高风险人格和低风险人格处理方式不同 |
| TimeRhythmAdjustment | 生活节律影响行动时机 |
| RandomnessWithinSeed | 允许可复现的个体差异 |
| SafetyPenalty | 越界行为降权或拒绝 |
| ResourceViolationPenalty | 资源不守恒行为必须拒绝 |

---

## 8. 记忆与学习架构

### 8.1 记忆不是日志

日志只是展示；记忆是会影响未来决策的内部状态。

最小记忆结构应包括：

```ts
export type ButlerMemoryEvent = {
  eventId: string;
  occurredAt: number;
  kind:
    | "observation"
    | "intent_selected"
    | "construction_attempt"
    | "safe_apply_accepted"
    | "safe_apply_rejected"
    | "resource_blocked"
    | "waiting_decision"
    | "player_explanation";
  summary: string;
  worldFacts: string[];
  emotionalMark: "neutral" | "satisfied" | "concerned" | "frustrated" | "protective";
  learningTags: string[];
};

export type ButlerMemoryState = {
  memoryId: string;
  recentEvents: ButlerMemoryEvent[];
  learnedPreferences: {
    shelterBias: number;
    careBias: number;
    storageBias: number;
    boundaryBias: number;
    waitingBias: number;
    resourceCautionBias: number;
  };
  unresolvedConcerns: string[];
  tags: string[];
};
```

### 8.2 学习来源

| 来源 | 学习效果 |
| --- | --- |
| SafeApply 接受 | 增强对应行动信心 |
| SafeApply 拒绝 | 增强谨慎、等待或资源准备倾向 |
| 资源不足 | 提高资源谨慎，降低直接建设冲动 |
| 空间压力过高 | 提高整理/等待/边界维护倾向 |
| 生态压力高 | 提高生态尊重、降低扩张倾向 |
| 多次等待后世界改善 | 增强等待/观察策略信心 |
| 建设后空间压力上升 | 下次更谨慎扩张 |

### 8.3 学习闭环验收

必须能验证：

```txt
同一个世界，同一个人格，在经历不同 SafeApply 结果后，下一轮意图评分发生变化。
```

---

## 9. 与现有模块的集成边界

### 9.1 Construction 模块重新定位

当前 Construction 模块不废弃，但必须从“决策中心”降级为“执行规划层”。

| 当前模块 | 新定位 |
| --- | --- |
| `construction-planner-input-builder.ts` | 接收 ButlerAutonomousIntent，构建 Planner 输入 |
| `construction-planner.ts` | 把意图转成候选计划，而不是直接决定管家要做什么 |
| `construction-executor-runtime.ts` | 继续将计划转成 add/update MapDiff |
| `deferred-construction-placement.ts` | 后续从固定建设模板升级为“意图 + 约束 -> 形态候选” |
| `construction-safe-apply-runtime.ts` | 继续作为世界事实审计门，同时输出学习反馈 |

### 9.2 World Ecology 模块定位

`WorldEcologyState` 是世界事实的一部分，不是管家主观意识。

它提供：

- 地貌事实。
- 植物生长状态。
- 昆虫迹象。
- 野外活动迹象。
- 自然资源基础。
- 微气候舒适度。

管家通过 `ButlerWorldPerception` 解读这些事实。

```txt
WorldEcologyState 是客观状态。
ButlerWorldPerception 是管家主观看法。
```

### 9.3 Personality Core 定位

`personality-core` 不应该直接决定具体行动，而是提供长期倾向。

正确链路：

```txt
personality-core
-> ButlerSoulProfile
-> Motivation/Goal/Intent scoring
-> Action Planner
```

错误链路：

```txt
personality-core
-> 直接生成某个建筑
```

---

## 10. 建议目录结构

后续新增 AI 管家自主核心时，建议采用如下目录：

```txt
src
├── ai
│   ├── personality-core
│   │   └── ...
│   ├── butler-autonomy
│   │   ├── schema.ts
│   │   ├── gateway.ts
│   │   ├── soul-profile-adapter.ts
│   │   ├── conscious-state.ts
│   │   ├── world-perception.ts
│   │   ├── motivation-engine.ts
│   │   ├── goal-generator.ts
│   │   ├── intent-ranking.ts
│   │   ├── memory-state.ts
│   │   ├── learning-update.ts
│   │   ├── audit.ts
│   │   └── explanation.ts
│   └── gateway.ts
├── world
│   ├── ecology
│   │   ├── world-ecology-state.ts
│   │   └── ...
│   ├── construction
│   │   └── ...
│   ├── map-state
│   │   └── home-map-state-schema.ts
│   └── mvp-core
│       └── ...
└── app
    └── world
        └── ...
```

对外统一入口建议：

```ts
// src/ai/butler-autonomy/gateway.ts
export function buildButlerAutonomyResult(
  input: ButlerAutonomyInput
): ButlerAutonomyResult;

export function updateButlerMemoryFromWorldResult(
  input: ButlerLearningInput
): ButlerMemoryState;
```

---

## 11. MVP 分阶段落地计划

| 阶段 | 模块 | 目标 | 是否写业务代码 |
| ---: | --- | --- | --- |
| 1 | `BUTLER-SOUL-AUTONOMY-DOC-00` | 补齐本文档和主计划引用 | 否 |
| 2 | `BUTLER-SOUL-AUTONOMY-SCHEMA-00` | 定义 schema、输入输出、审计结构 | 是 |
| 3 | `BUTLER-WORLD-PERCEPTION-00` | 从 HomeMapState/EcologyState 生成管家感知 | 是 |
| 4 | `BUTLER-MOTIVATION-ENGINE-00` | 从人格、感知、记忆生成动机 | 是 |
| 5 | `BUTLER-GOAL-GENERATOR-00` | 从动机生成候选目标 | 是 |
| 6 | `BUTLER-INTENT-RANKING-00` | 评分并选出主意图 | 是 |
| 7 | `BUTLER-MEMORY-SEED-00` | 最小记忆状态与事件记录 | 是 |
| 8 | `CONSTRUCTION-LISTENS-TO-BUTLER-00` | Construction 接收 ButlerAutonomousIntent | 是 |
| 9 | `LEARNING-FEEDBACK-00` | SafeApply 结果反写记忆 | 是 |
| 10 | `WORLD-UI-AUTONOMY-AUDIT-00` | /world 展示“为什么这样做” | 是 |

---

## 12. 验收标准

`BUTLER-SOUL-AUTONOMY-CORE` 完成后，必须满足下表。

| 验收问题 | 通过标准 |
| --- | --- |
| 管家为什么行动？ | 日志/P-Phone/ViewModel 能看到动机、人格因素、世界事实 |
| 管家为什么不行动？ | `wait_and_record` 是合法意图，并能解释资源/风险/记忆原因 |
| 是否受人格影响？ | 同一世界下，不同 ButlerSoulProfile 产生不同动机权重 |
| 是否受资源影响？ | 资源不足不能直接建设，必须转为准备、等待或记录 |
| 是否受生态影响？ | EcologyState 的地貌、植物、空间压力影响目标评分 |
| 是否有记忆？ | recentEvents/learnedPreferences 记录行动结果 |
| 是否会学习？ | SafeApply 接受/拒绝影响下一轮 intent ranking |
| 是否绕过世界事实？ | 不允许直接修改 HomeMapState，必须走 MapDiff/SafeApply |
| 是否触碰宠物红线？ | 不生成默认宠物、宠物床、孵化器、胚胎 |
| 是否可审计？ | ButlerAutonomyAudit 输出 warnings/tags |

---

## 13. 当前代码状态专业判断

| 能力 | 当前状态 | 判断 |
| --- | --- | --- |
| 世界事实容器 | 已有 HomeMapState | 可继续使用 |
| 世界变化管道 | 已有 MapDiff/SafeApply | 可继续使用 |
| 管家建设结果写入 | 已支持 add/update | 可继续使用 |
| 初始建筑剥离 | 已完成一轮 | 方向正确 |
| 生态状态 | 已有 WorldEcologyState 初版 | 需要扩展但方向正确 |
| 管家自主意识 | 缺失 | P0 缺口 |
| 记忆学习闭环 | 缺失 | P0 缺口 |
| 紫微人格驱动决策 | 部分存在 | 需要通过 SoulProfile 接入 |
| ConstructionPlanner | 当前权重过高 | 需要降级为执行规划层 |
| /world 可解释性 | 有基础日志 | 需要展示意图、动机、记忆依据 |

结论：

```txt
当前不是推倒重来，而是需要把“AI 大脑层”补到现有世界状态和建设管道之上。
```

---

## 14. 不应优先做的事项

在 Butler Soul Autonomy Core 完成前，不应优先做：

- 大量新增建筑资产。
- 复杂宠物行为。
- 宠物入场。
- 社区/小镇完整系统。
- 玩家建造入口。
- 商业化系统。
- 过度视觉精修。

原因：这些都会在 AI 管家本体层缺失时，把项目重新拉回传统游戏。

---

## 15. 最终架构结论

AI-PET-WORLD 的护城河不在地图，也不在建房子，而在：

```txt
人格生成的灵魂底盘
+ 可持续运行的世界事实
+ 自主意识决策
+ 记忆学习闭环
+ 可审计的世界变化
+ 用户只能观察而不能直接控制
```

后续所有开发必须遵守：

```txt
世界法则约束现实。
紫微斗数生成灵魂。
记忆形成经历。
学习改变未来。
管家自主决定行动。
建设系统只是执行器。
SafeApply 是世界事实审计门。
UI 只是观察窗口。
```

这才是 AI-PET-WORLD 与普通宠物游戏、建造游戏、AI 聊天角色的根本区别。
