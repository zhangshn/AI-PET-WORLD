# AI-PET-WORLD Architecture V1

## 1. 十层架构

AI-PET-WORLD 当前采用 10 层架构。层级用于划分职责边界，不代表所有目录都必须按编号命名；目录必须按功能命名。

1. 命理核心层：提供紫微、八字等生命底色计算与基础解释。
2. 人格映射层：把命理底色映射为人格、偏好、管家投射与可公开表达。
3. 意识核心层：承载自主意识、主体边界、代理循环与基础自治规则。
4. 生命日常状态层：维护饥饿、能量、困意、清洁、安全感等日常生命状态。
5. 记忆 / 关系层：沉淀主体经历、关系状态、长期互动事实与可被学习层读取的材料。
6. AI 学习层：从记忆中形成经验、倾向和调整，不等同于原始 memory。
7. 自主驱动层：形成 drive、goal、attention、intention 等内部自主方向。
8. 行为执行层：把内部意图转成可执行行为，不负责主体判断。
9. 世界运行层：推进世界 tick、生态、设施、地图、实体与离线运行。
10. 展示 / 交互层：向玩家展示世界结果，并接收玩家互动影响。

## 2. Life Line 主轴

生命线 Life Line 不是单独某一层，而是贯穿全部层级的纵向主轴。它负责把生命底色、人格、意识、状态、记忆、学习、驱动、行为、世界反馈和展示结果串成持续生命过程。

Life Line 只能组织和传递生命过程信息，不能越权直接替代命理算法、主体判断、学习规则、行为执行或 UI 展示。

## 3. 每层职责

- 命理核心层：只产出生命底色、结构特征、运行趋势和原始解释材料。
- 人格映射层：把底色映射为宠物、管家、家园与行为偏好的高层人格资料。
- 意识核心层：定义主体意识、自治边界、代理状态与自主判断的基础框架。
- 生命日常状态层：维护生命体日常状态，不处理长期记忆和学习。
- 记忆 / 关系层：记录经历、关系估计和互动事实，不直接输出行动。
- AI 学习层：从记忆和关系中归纳经验，不替代 memory 存储。
- 自主驱动层：生成内部驱动、目标、注意力和意图，不直接执行行为。
- 行为执行层：选择、表达和稳定行为，不反向修改命理或主体核心。
- 世界运行层：推进世界状态和实体变化，不包含 UI 展示判断。
- 展示 / 交互层：展示管家、宠物、家园和世界结果，不写核心 AI 或世界运行逻辑。

## 4. 当前代码目录归属

- 第 1 层：`src/ai/destiny-core/ziwei-core`、`src/ai/destiny-core/bazi-core`
- 第 2 层：`src/ai/personality-core/life-profile-core`、`src/ai/personality-core/personality-interpretation-core`、`src/ai/personality-core/butler-profile-core`
- 第 3 层：`src/ai/consciousness-core/consciousness`、`src/ai/consciousness-core/autonomy-core`、`src/ai/consciousness-core/agent-core`
- 第 4 层：`src/systems/pet/daily-state`，现有部分状态逻辑仍散落在 `src/systems/pet/pet-life`、`src/systems/pet/pet-mood`、`src/systems/pet/pet-feeding`
- 第 5 层：`src/ai/memory-core`、`src/systems/pet/memory-relation`、`src/systems/butler/memory-relation`
- 第 6 层：`src/ai/learning-core`、`src/systems/pet/learning`
- 第 7 层：`src/systems/pet/drive`、`src/systems/pet/goal`、`src/systems/pet/attention`、`src/systems/butler/intention`
- 第 8 层：`src/ai/behavior-core`、`src/systems/pet/behavior`、`src/systems/pet/pet-action`、`src/systems/pet/pet-expression`、`src/systems/butler/behavior`
- 第 9 层：`src/engine`、`src/world`、`src/systems/event`、`src/systems/home`、`src/systems/incubator`
- 第 10 层：`src/app/world`、`src/app/personality-test`

## 5. 未来目标目录规划

- `src/ai/destiny-core`：继续收纳命理核心，不再直接暴露给正式世界 UI。
- `src/ai/personality-core`：集中人格、投射、解释、公开资料。
- `src/ai/consciousness-core`：集中自主意识、自治规则、agent 循环。
- `src/ai/life-line-core`：未来承载贯穿层级的生命线上下文编排。
- `src/ai/memory-core`：保留通用记忆核心。
- `src/ai/learning-core`：未来承载从记忆到经验的学习规则。
- `src/ai/behavior-core`：保留通用行为核心。
- `src/systems/pet/daily-state`：未来承载宠物日常生命状态。
- `src/systems/pet/memory-relation`：未来承载宠物记忆与关系接口。
- `src/systems/pet/learning`：未来承载宠物经验形成。
- `src/systems/pet/drive`、`goal`、`attention`：自主驱动层。
- `src/systems/pet/behavior`：行为执行层。
- `src/systems/butler/memory-relation`、`task`、`intention`、`education`、`message-decision`、`behavior`：管家主体系统分区。

## 6. 禁止跨层规则

- 命理核心不能直接控制行为、目标、消息、教育或世界 tick。
- 人格映射不能写世界运行逻辑。
- 意识核心不能写 UI 展示逻辑。
- memory 不能等同于 learning，learning 不能直接篡改原始记忆。
- drive / goal / attention / intention 只能产出内部方向，不直接替玩家控制主体。
- behavior 只执行行为，不负责主体价值判断。
- world engine 只推进世界运行，不新增管家教育规则、宠物学习规则或 P-Phone 消息决策。
- UI 层不能写核心 AI、世界运行、管家消息判断或命理算法细节。

## 7. 不能继续变重的文件

以下文件必须保持门面、编排或薄封装职责，只允许 import 修正、gateway 调用和转发：

- `src/ai/gateway.ts`
- `src/systems/petSystem.ts`
- `src/systems/butlerSystem.ts`
- `src/engine/worldEngine.ts`
- `src/engine/world-engine/runners/world-tick-runner.ts`
- `src/app/world/ui/phone/PPhoneRouter.tsx`
- `src/app/world/layouts/WorldObserveLayout.tsx`

## 8. 后续迁移顺序

1. 先稳定 `src/ai` 的命理、人格、意识三层目录。
2. 再把宠物日常状态迁入 `src/systems/pet/daily-state`。
3. 再拆分宠物 memory-relation 与 learning，确保 learning 只从 memory 形成经验。
4. 再收口宠物 drive / goal / attention / behavior 的职责边界。
5. 再完善管家 memory-relation、task、intention、education、message-decision、behavior。
6. 最后收紧 `src/app/world` 展示层，隐藏底层命理术语。

## 9. 管家 / 宠物自主意识核心原则

- 自主意识不是逻辑操控。
- 管家和宠物都是自主主体。
- 玩家不能直接控制管家或宠物，只能通过互动影响。
- 命理核心只提供生命底色，不直接控制行为。
- 管家拥有自主判断，但不能替宠物做决定。
- 宠物的行动必须经过自身状态、记忆、驱动、目标和行为执行链。

## 10. 幼儿期与教育原则

宠物出生时没有生活记忆，是幼儿期生命。宠物可以被照看、被保护、被引导、被环境影响，但不能被玩家或管家直接操控。

管家是用户生命数据映射 / 平行世界人格投射，不是普通 NPC。管家创建时有先天人格，但没有世界经历记忆。管家承担照看、教育、引导、保护、解释和环境管理职责；管家可以提供机会、保持距离、保护性回应、记录经验、调整照看方式，但不能替宠物做决定。
