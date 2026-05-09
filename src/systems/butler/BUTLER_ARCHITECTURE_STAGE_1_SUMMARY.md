# Butler Architecture Stage 1 Summary

当前文件负责：总结管家系统第一阶段架构归口结果。

## 1. 阶段目标

本阶段目标不是改业务逻辑，而是把 `src/systems/butler` 现有模块的公开入口按照 AI-PET-WORLD 十层架构重新归口。

本阶段不移动旧目录，不改变运行逻辑，只建立新结构入口和边界说明。

## 2. 管家核心定位

管家不是普通 NPC。

管家是：

- 用户生命数据映射
- 平行世界人格投射
- 自主意识管理者
- 幼儿期宠物照看者
- 家园维护者
- 世界解释者
- 玩家与世界之间的自主中介

管家创建时拥有：

- 先天人格
- 管理倾向
- 建设倾向
- 照看倾向
- 沟通倾向

管家创建时没有：

- 世界经历记忆
- 与宠物的关系记忆
- 与玩家的互动记忆
- 对当前家园的经验

## 3. 已完成的入口归口

### 第 5 层：记忆 / 关系层 memory-relation

已建立：

- `memory-relation/butler-memory-relation-gateway.ts`

当前包装旧模块：

- `memory-relation/butler-memory`
- `memory-relation/butler-relation`
- `memory-relation/butler-relation-tuning`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 统一 memory / relation / experience interpretation 出口
- 不直接执行行为
- 不直接决定任务、消息或宠物行为

### 第 7 层：自主驱动层 intention

已建立：

- `intention/butler-intention-gateway.ts`
- `intention/state-interpretation/butler-state-interpretation-gateway.ts`
- `intention/task-decision/butler-task-decision-gateway.ts`

当前包装旧模块：

- `butler-mood-runner.ts`
- `task/butler-task-runner`
- `task/butler-task-decision-trace`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- deriveButlerMood 已归口到 state-interpretation
- chooseButlerTask / buildButlerTaskDecisionTrace 已归口到 task-decision

### Education：幼儿期照看 / 教育边界

已建立：

- `education/butler-education-gateway.ts`
- `education/opportunity/butler-opportunity-education-gateway.ts`

当前包装旧模块：

- `butler-opportunity-runner.ts` 中的机会判断、冷却、清理部分

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 管家机会只是提供给宠物自主判断的输入
- 管家不能替宠物决定是否接受机会

### 第 8 层：行为执行层 behavior

已建立：

- `behavior/butler-behavior-gateway.ts`
- `behavior/opportunity-action/butler-opportunity-action-gateway.ts`

当前包装旧模块：

- `butler-opportunity-runner.ts` 中的 createFoodOffer / createRestOffer / createApproachOffer

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 行为层只创建机会，不代表宠物必须接受

### tuning：人格倾向调参层

已建立：

- `tuning/butler-tuning-gateway.ts`
- `tuning/profile-tendency/butler-profile-tendency-gateway.ts`

当前包装旧模块：

- `butler-profile-tuning.ts`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- tuning 只把 ButlerProfile 转换为轻量调参
- tuning 不直接决定任务、消息或行为

### message-decision：主动通信判断层

已建立：

- `message-decision/README.md`

当前状态：

- 当前只是预留目录
- 后续承接 P-Phone 主动消息判断
- 管家消息不是系统日志
- 事件发生不等于自动发消息

### runtime-orchestration：运行编排层

已建立：

- `runtime-orchestration/README.md`

当前状态：

- 当前只是预留目录
- 暂不通过 butler-gateway.ts 反向导出 butlerSystem.ts
- 避免 butlerSystem.ts 与 butler-gateway.ts 形成循环引用
- 后续真正重构时，再把 butlerSystem.ts 内部编排逐步迁入 runtime-orchestration

## 4. 当前 butler-gateway.ts 对外入口

`butler-gateway.ts` 现在应该统一从以下新入口导出能力：

- `education/butler-education-gateway`
- `behavior/butler-behavior-gateway`
- `intention/butler-intention-gateway`
- `tuning/butler-tuning-gateway`
- `memory-relation/butler-memory-relation-gateway`
- `butler-core-boundary`

仍然保留直接导出：

- `butler-schema`

原因：

- schema 当前是类型边界
- 暂时不需要包装

## 5. 当前仍保留的旧模块

以下旧模块暂时保留：

- `butler-opportunity-runner.ts`
- `butler-mood-runner.ts`
- `butler-profile-tuning.ts`
- `task`
- `memory-relation/butler-memory`
- `memory-relation/butler-relation`
- `memory-relation/butler-relation-tuning`
- `butlerSystem.ts`

保留原因：

- 当前阶段只做入口归口
- 不改变运行逻辑
- 后续按模块逐步迁移内部实现
- butlerSystem.ts 暂不反向包装，避免循环引用

## 6. P-Phone 边界

P-Phone 不是系统日志。

P-Phone 是管家可能主动联系玩家的入口。

不能写成：

```txt
事件发生 → 自动发消息
宠物饿了 → 自动发消息
每日 Tick → 自动汇报