# daily-state

当前目录属于第 4 层：生命日常状态层。

当前负责：预留宠物作为幼儿期生命的日常身体与感知状态，包括饥饿、饱腹、口渴、能量、困意、排泄、清洁、安全感、注意力、环境熟悉度、困惑与学习准备度等。

当前不能做：不能把状态直接写成行为结果，不能直接选择 action，不能替代 memory / learning，不能绕过 drive / goal / attention。

边界说明：daily-state 只回答“宠物现在处于什么状态”，不回答“宠物一定会做什么”。行为必须继续经过感知、记忆 / 学习、drive、goal、attention 和 behavior 执行链。

## 当前已接入入口

当前 daily-state 已经建立以下包装入口：

- `life-stage/pet-life-stage-gateway.ts`
  - 当前包装既有 pet-life 生命周期推进能力
  - 暂不改变原运行逻辑
  - 后续逐步迁移生命阶段状态逻辑

- `emotion-state/pet-emotion-state-gateway.ts`
  - 当前包装既有 pet-mood 情绪映射能力
  - 暂不改变原运行逻辑
  - 后续逐步迁移情绪状态映射逻辑

- `feeding-state/pet-feeding-state-gateway.ts`
  - 当前包装既有 pet-feeding 进食相关能力
  - 暂不改变原运行逻辑
  - 当前 pet-feeding 仍是混合模块
  - 后续会把饥饿 / 饱腹 / 进食状态迁入 daily-state
  - 机会接受判断迁入自主驱动层
  - 实际进食效果迁入 behavior

- `daily-state-gateway.ts`
  - 当前作为 daily-state 总出口
  - 只导出状态层相关能力
  - 不允许直接选择 action / goal / behavior

后续扩展方向：承接 `pet-life`、`pet-mood`、`pet-feeding` 中的状态部分，并逐步拆出身体状态、情绪状态、环境熟悉度和状态 gateway。
