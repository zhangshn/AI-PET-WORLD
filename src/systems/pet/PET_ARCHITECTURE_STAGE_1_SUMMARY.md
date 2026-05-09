# Pet Architecture Stage 1 Summary

当前文件负责：总结宠物系统第一阶段架构归口结果。

## 1. 阶段目标

本阶段目标不是改业务逻辑，而是把 `src/systems/pet` 现有旧模块的公开入口按照 AI-PET-WORLD 十层架构重新归口。

本阶段不移动旧目录，不改变运行逻辑，只建立新结构入口。

## 2. 已完成的入口归口

### 第 4 层：生命日常状态层 daily-state

已建立：

- `daily-state/daily-state-gateway.ts`
- `daily-state/life-stage/pet-life-stage-gateway.ts`
- `daily-state/emotion-state/pet-emotion-state-gateway.ts`
- `daily-state/feeding-state/pet-feeding-state-gateway.ts`

当前包装旧模块：

- `pet-life`
- `pet-mood`
- `pet-feeding`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 后续再迁移状态类实现

### 第 5 层：记忆 / 关系层 memory-relation

已建立：

- `memory-relation/README.md`

当前状态：

- 作为宠物记忆 / 关系层预留目录
- 后续承接食物记忆、休息记忆、管家关系记忆、边界记忆等

### 第 6 层：AI 学习层 learning

已建立：

- `learning/README.md`

当前状态：

- 作为宠物学习层预留目录
- 后续承接 food familiarity、rest familiarity、butler trust learning 等
- learning 不等于 memory
- learning 不能直接控制 action

### 第 7 层：自主驱动层

已建立或归口：

- `drive`
- `goal`
- `attention`
- `cognition/perception`
- `action-intention`
- `opportunity-decision`

当前包装旧模块：

- `pet-cognition`
- `pet-action`
- `pet-opportunity` 的判断部分

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 后续逐步迁移内部实现

### 第 8 层：行为执行层 behavior

已建立：

- `behavior/pet-behavior-gateway.ts`
- `behavior/opportunity-effect/pet-opportunity-effect-gateway.ts`
- `behavior/expression/pet-expression-behavior-gateway.ts`

当前包装旧模块：

- `pet-opportunity` 的效果部分
- `pet-expression`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 后续逐步迁移内部实现

### 第 9 层：世界边界 world-boundary

已建立：

- `world-boundary/pet-world-boundary-gateway.ts`
- `world-boundary/state-events/pet-state-events-boundary-gateway.ts`
- `world-boundary/zone-influence/pet-zone-influence-boundary-gateway.ts`

当前包装旧模块：

- `pet-state-events`
- `pet-zone`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 后续逐步迁移内部实现

### Runtime 编排层 runtime-orchestration

已建立：

- `runtime-orchestration/pet-runtime-orchestration-gateway.ts`

当前包装旧模块：

- `pet-runtime`

当前状态：

- 只包装旧实现
- 不改变运行逻辑
- 后续逐步让 `pet-runtime` 只调用各层 gateway

## 3. 当前 pet-gateway.ts 对外入口

`pet-gateway.ts` 现在应该统一从以下新入口导出能力：

- `daily-state/daily-state-gateway`
- `cognition/pet-cognition-layer-gateway`
- `action-intention/pet-action-intention-gateway`
- `opportunity-decision/pet-opportunity-decision-gateway`
- `behavior/pet-behavior-gateway`
- `world-boundary/pet-world-boundary-gateway`
- `runtime-orchestration/pet-runtime-orchestration-gateway`

旧模块仍然保留，但不再作为 `pet-gateway.ts` 的直接公开出口。

## 4. 当前仍保留的旧模块

以下旧模块暂时保留：

- `pet-life`
- `pet-mood`
- `pet-feeding`
- `pet-cognition`
- `pet-action`
- `pet-opportunity`
- `pet-expression`
- `pet-state-events`
- `pet-zone`
- `pet-runtime`

保留原因：

- 当前阶段只做入口归口
- 不改变运行逻辑
- 后续按模块逐步迁移内部实现

## 5. 禁止事项

- 禁止把 daily-state 直接写成 behavior 结果
- 禁止把 memory 当 learning
- 禁止 learning 直接控制 action
- 禁止 world signal 直接决定宠物 action
- 禁止 pet-runtime 继续堆复杂业务判断
- 禁止 UI 深层 import 宠物内部旧模块
- 禁止 petSystem.ts 继续变重
- 禁止在本阶段删除旧模块

## 6. 下一阶段建议

宠物系统第一阶段完成后，下一阶段建议进入：

ARCH-3：管家系统 `systems/butler` 分层整理

管家系统需要按以下方向拆分：

- `memory-relation`
- `task`
- `intention`
- `education`
- `message-decision`
- `behavior`
- `runtime-orchestration`

管家系统分层时必须遵守：

- 管家是用户生命数据映射 / 平行世界人格投射
- 管家拥有自主判断
- 管家不是普通 NPC
- 管家可以照看、教育、引导、保护、解释、管理环境
- 管家不能替宠物做决定
- 管家消息不是系统日志
- P-Phone 是管家可能主动联系玩家的入口
