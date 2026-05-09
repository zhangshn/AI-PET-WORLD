# Pet Module Architecture

当前文件负责：说明 `src/systems/pet` 现有模块如何归属到 AI-PET-WORLD 十层架构中。

本文件只做架构归层说明，不改变运行逻辑。

## 1. 宠物系统在十层架构中的位置

宠物系统主要横跨：

- 第 4 层：生命日常状态层
- 第 5 层：记忆 / 关系层
- 第 6 层：AI 学习层
- 第 7 层：自主驱动层
- 第 8 层：行为执行层

宠物系统不能直接承担：

- 第 1 层命理核心算法
- 第 2 层人格映射算法
- 第 9 层世界运行调度
- 第 10 层 UI 展示逻辑

这些能力应通过对应 gateway 或 world engine 编排进入宠物系统。

## 2. 当前模块归层表

| 当前目录 | 当前归属层 | 当前职责 | 后续整理方向 |
|---|---|---|---|
| pet-birth | 第 2 层 / 宠物出生入口 | 处理宠物出生相关辅助逻辑 | 保留，只作为出生入口，不写后天记忆 |
| daily-state | 第 4 层 | 预留宠物吃喝拉撒睡、安全感、注意力等日常生命状态 | 后续承接 pet-life、pet-mood、pet-feeding 中的状态部分 |
| pet-life | 第 4 层 / 生命阶段推进 | 当前处理生命阶段和生命周期推进 | 后续逐步拆入 daily-state 和 life-line 相关上下文 |
| pet-mood | 第 4 层 / 情绪状态映射 | 当前处理情绪或 timeline 状态到 mood 的映射 | 后续归入 daily-state 的 emotion/mood 子模块 |
| pet-feeding | 第 4 层 + 第 7 层 + 第 8 层混合 | 当前处理食物机会评估与喂食结果 | 后续拆分：饥饿/饱腹进入 daily-state，接受判断进入 drive/goal/opportunity，实际进食效果进入 behavior |
| memory-relation | 第 5 层 | 预留宠物记忆与关系系统 | 后续承接食物记忆、休息记忆、管家关系记忆、边界记忆 |
| learning | 第 6 层 | 预留宠物从记忆中形成经验的学习系统 | 后续承接 food familiarity、rest familiarity、butler trust learning 等 |
| drive | 第 7 层 | 计算宠物内部驱动力 | 已归层，继续保持 |
| goal | 第 7 层 | 计算宠物目标方向 | 已归层，继续保持 |
| attention | 第 7 层 | 计算当前注意力焦点 | 已归层，继续保持 |
| pet-cognition | 第 7 层 / 感知解释 | 把世界刺激转为宠物主体解释 | 后续可归入 autonomous-drive 下的 perception/interpretation 概念，但暂不移动 |
| pet-opportunity | 第 7 层 + 第 8 层混合 | 当前处理宠物是否接受机会，以及接受后的效果 | 后续拆分：接受/拒绝判断归第 7 层，效果执行归第 8 层 |
| pet-action | 第 7 层 / 行为意图选择 | 当前处理 raw action intent 与稳定性 | 后续保留为第 7 层意图选择，不直接做行为执行 |
| behavior | 第 8 层 | 预留宠物行为执行层 | 后续承接执行类行为，不承接主体判断 |
| pet-expression | 第 8 层 | 把内部意图转换为可见行为表达 | 后续逐步归入 behavior，但暂不移动 |
| pet-runtime | 第 7 + 第 8 层编排 | 宠物单 tick 运行编排 | 保留为编排层，不写具体业务判断 |
| pet-state-events | 第 9 层边界 / 事件输出 | 把宠物状态变化转换为事件材料 | 保留，不写主体判断 |
| pet-zone | 第 9 层输入影响 / 世界区域影响 | 处理世界区域对宠物的影响 | 保留为世界输入影响，不直接决定行为 |
| pet-core-boundary.ts | 架构边界文件 | 声明宠物系统边界规则 | 对齐十层架构命名 |

## 3. 宠物幼儿期核心原则

宠物出生时没有生活记忆。

宠物出生时只有：

- 先天人格
- 本能状态
- 基础感知能力
- 初始生命状态

宠物出生时没有：

- 食物记忆
- 休息点记忆
- 排泄地点记忆
- 管家信任记忆
- 边界记忆
- 家园熟悉记忆

因此，任何幼儿期行为都不能写成固定脚本。

不能写成：

```txt
饥饿高 -> 直接吃
看到管家 -> 直接靠近
看到食盆 -> 直接理解食物
困了 -> 直接去固定休息点
```

必须是：

```txt
日常状态
↓
感知
↓
记忆 / 学习为空或不足
↓
drive / goal / attention 形成倾向
↓
宠物自主判断
↓
behavior 执行
↓
结果写入记忆
↓
learning 逐渐形成经验
```

## 4. 管家与宠物边界

管家可以：

- 提供食物机会
- 提供休息环境
- 保持安全距离
- 保护性回应
- 记录宠物反应
- 调整照看方式

管家不能：

- 替宠物吃
- 替宠物睡
- 替宠物喜欢管家
- 直接写入宠物学习结果
- 直接决定宠物行为

宠物对管家的机会必须经过自身判断链。

## 5.1 ARCH-2C 当前迁移状态

当前已经完成 daily-state 第一轮包装：

- pet-life 暂时仍保留原目录，但已通过 daily-state/life-stage 暴露状态层入口。
- pet-mood 暂时仍保留原目录，但已通过 daily-state/emotion-state 暴露状态层入口。
- pet-gateway.ts 对外仍导出 runPetLife 和 mapTimelineStateToPetMood，但来源已切换为 daily-state-gateway。
- 本轮不改变运行逻辑，只完成状态层入口归口。

## 5.2 ARCH-2D 当前迁移状态

当前已经完成 pet-feeding 第一轮包装归口：

- pet-feeding 暂时仍保留原目录，但已通过 daily-state/feeding-state 暴露入口。
- pet-gateway.ts 对外仍导出 evaluateFoodOffer / applyFeeding 及相关类型，但来源已切换为 daily-state-gateway。
- 本轮不改变运行逻辑，只完成进食相关入口归口。
- pet-feeding 仍是混合模块，后续再拆分：
  - 饥饿 / 饱腹 / 进食状态进入 daily-state
  - 接受 / 拒绝判断进入自主驱动层
  - 实际进食效果进入 behavior

## 5.3 ARCH-2E 当前迁移状态

当前已经完成 pet-opportunity 第一轮包装归口：

- pet-opportunity 暂时仍保留原目录。
- evaluateApproachOffer / evaluateRestOffer 已通过 opportunity-decision 暴露为自主驱动层入口。
- applyAcceptedApproachOfferEffect / applyAcceptedRestOfferEffect 已通过 behavior/opportunity-effect 暴露为行为执行层入口。
- pet-gateway.ts 对外仍导出这些函数和类型，但来源已经切换到新包装层。
- 本轮不改变运行逻辑，只完成机会判断与机会效果的入口分离。
- 后续再逐步拆分 pet-opportunity 内部实现。

## 5.4 ARCH-2F 当前迁移状态

当前已经完成 pet-expression 第一轮包装归口：

- pet-expression 暂时仍保留原目录。
- expressPetAction 及相关类型已通过 behavior/expression 暴露为行为执行层入口。
- pet-gateway.ts 对外仍导出 expressPetAction 和相关类型，但来源已经切换为 behavior/pet-behavior-gateway。
- 本轮不改变运行逻辑，只完成可见行为表达入口归口。
- 后续再逐步把 pet-expression 内部实现迁入 behavior/expression。

## 5.5 ARCH-2G 当前迁移状态

当前已经完成 pet-action 第一轮包装归口：

- pet-action 暂时仍保留原目录。
- selectPetAction / applyPetActionStability 及相关类型已通过 action-intention 暴露为自主驱动层入口。
- pet-gateway.ts 对外仍导出 selectPetAction / applyPetActionStability 和相关类型，但来源已经切换为 action-intention/pet-action-intention-gateway。
- 本轮不改变运行逻辑，只完成行为意图选择入口归口。
- 后续再逐步把 pet-action 内部实现迁入 action-intention。

## 5.6 ARCH-2H 当前迁移状态

当前已经完成 pet-cognition 第一轮包装归口：

- pet-cognition 暂时仍保留原目录。
- runPetStimulusPerception 及相关类型已通过 cognition/perception 暴露为自主驱动层中的感知 / 主体解释入口。
- pet-gateway.ts 对外仍导出 runPetStimulusPerception 和相关类型，但来源已经切换为 cognition/pet-cognition-layer-gateway。
- 本轮不改变运行逻辑，只完成世界 signal → 宠物主体解释入口归口。
- 后续再逐步把 pet-cognition 内部实现迁入 cognition/perception。

## 5. 后续迁移顺序

1. pet-life / pet-mood 的状态部分逐步迁入 daily-state
2. pet-feeding 拆分为状态、机会判断、行为效果三部分
3. pet-opportunity 拆分接受判断和效果执行
4. pet-expression 逐步归入 behavior
5. pet-state-events 保留为事件输出，不写主体判断
6. pet-runtime 保留为 tick 编排层，只调用各层 gateway

## 6. 禁止事项

- 禁止把日常状态直接写成行为结果
- 禁止把 memory 当 learning
- 禁止 learning 直接控制 action
- 禁止 pet-runtime 继续堆复杂业务判断
- 禁止 petSystem.ts 继续变重
- 禁止 UI 直接深层 import 宠物内部模块
- 禁止世界信号直接决定宠物行为
