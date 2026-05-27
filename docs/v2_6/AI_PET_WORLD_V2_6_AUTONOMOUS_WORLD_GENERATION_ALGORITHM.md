# AI-PET-WORLD V2.6｜自主世界生成算法

## 1. 文档定位

这不是画图算法，而是 AI-PET-WORLD 自主世界事实生成与演化算法。

它决定世界如何自己存在、变化、沉淀痕迹，并进入下一轮时间线。

## 2. 输入资产

- WorldRuntimeSaveRecord
- HomeMapState
- SpaceGrid
- TraceField
- ButlerState / lastButlerRuntimeDecision
- Resources
- Events
- MemorySeed
- Timeline phase
- World seed

## 3. 自主世界生成主链路

```txt
WorldRuntimeSaveRecord
→ 读取 HomeMapState
→ 派生 SpaceGrid
→ 派生 / 读取 TraceField
→ 读取 ButlerState / runtime decision
→ 进入世界规则判断
→ 生成 Butler intent
→ World rule validation
→ SafeApply
→ 生成 Event / Trace / Resource / HomeMapState diff
→ 生成 MemorySeed
→ 写入下一轮 RuntimeSaveRecord
→ 进入下一轮 Tick
```

## 4. 世界事实生成规则

### 空间规则

空间规则读取坐标、区域、地块、边界、占用、可通行性、移动成本。坐标只负责定位，不直接生成世界图。

### 生态规则

生态规则读取 biome、moisture、groundHealth、naturalGrowth、spacePressure 和 TraceField，影响自然对象、恢复倾向和衰退倾向。

### 痕迹规则

痕迹规则把重复行为、空间使用、生态变化、建设维护、关系互动、时间经过沉淀成 TraceFact / TraceField。

### 行为意图规则

管家动机必须先变成意图，再经过世界规则验证，不能直接改写 HomeMapState。

### 资源规则

资源规则决定建设、维护、恢复和等待是否允许。

### 事件规则

事件记录为什么发生、为什么未发生、由哪些规则判断产生。

### 记忆种子规则

MemorySeed 记录可进入未来记忆与学习的原因片段，但当前不代表完整学习系统已完成。

### 时间线规则

时间线贯穿世界创建、初始运行、生态成长、生命互动、痕迹沉淀和长期演化。

## 5. 痕迹如何参与世界生成

TraceField 不是画面装饰。它是世界长期记忆事实。

TraceField 影响：

- movementCost
- 区域熟悉度
- 生态恢复与衰退
- 管家判断
- 后续行为倾向
- 视觉表现

痕迹类型必须区分：

- movement
- spatial_use
- ecology_change
- construction_maintenance
- relationship_interaction
- time_passage
- event_impact

没有 movement trace，不得生成 long-used area。

## 6. 当前已完成与未完成

已完成：

- SpaceGrid v0
- TraceField v0
- Trace lifecycle v0
- trace influence 分层 v0
- trace visual v0
- ecology object rule v0

未完成：

- Butler intent → SafeApply → Trace / Event / MemorySeed 闭环
- 宠物入场
- 管家学习
- 宠物学习
- 世界学习
- 长期时间线演化

