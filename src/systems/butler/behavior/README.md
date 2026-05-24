# butler/behavior

当前目录属于第 8 层：行为执行层。

## 当前负责

这里未来负责把管家已经形成的意图转为可执行行为。

管家行为执行不是意图来源，也不是消息决策来源。它只承接上层已经形成的意图或判断，并表达为建设、整理、观察、解释、保护性回应、提供机会或联系玩家等行为。

## 当前不能做

- 不能写管家意图来源
- 不能写教育原则
- 不能写消息决策
- 不能替宠物做决定
- 不能直接决定宠物 action
- 不能把玩家输入写成直接控制管家的命令

## 后续扩展方向

- 行为执行 gateway
- 行为稳定与冷却
- 行为结果回写
- 机会创建执行
- 解释 / 保护 / 环境管理类行为执行

## 当前已经包含

- opportunity-action：管家提供照看机会的执行入口
- execution：管家当前行为执行快照

execution 当前只负责把已经形成的任务、关系、教育策略转换为可被世界读取的行为执行快照。

边界原则：

- 不选择任务
- 不决定宠物行为
- 不替宠物接受机会
- 不直接写入宠物 learning
- 不直接发送 P-Phone 消息
- 不在本层直接修改 worldEngine 调度

## Home Goal Driven Execution

当前管家行为执行层可以读取 `HomeState.homeGoals`。

规则：

- homeGoals 只影响行为执行快照，不负责选择任务
- `building_home` / `watching_town_adoption_conditions` / `idle` / `watching_pet` 可以被家园目标修正执行倾向
- `offering_food` / `offering_rest` / `offering_approach` 不会被 homeGoals 覆盖
- 管家仍不能控制宠物
- behavior execution 不直接调用 homeSystem

## Goal Execution Memory

当前管家行为执行层如果命中 `goal_driven_execution`，会写入管家长期记忆。

记录内容包括：

- 当前执行类型
- 当前 homeGoal
- 是否允许影响 home
- 是否保持 no_pet_control
- 执行 summary
- 执行 reason

该记忆只记录管家后天经历，不控制宠物行为，不写宠物 learning。
