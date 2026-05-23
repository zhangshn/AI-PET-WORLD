> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7.8 旧 construction flow 收缩策略

## 1. P7.8 的定位

P7.8 不是删除 construction flow。
P7.8 不是重写 construction 系统。
P7.8 是明确旧 construction flow 的长期边界。

当前系统已经有正式 world-loop：

```text
RuntimeWorldState
-> buildWorldLoopStep
-> SafeApply
-> currentHomeMapState
-> RenderableWorldSnapshot
-> ProceduralRendererView
```

因此旧 construction flow 不应该继续扩张成另一套长期世界推进系统。

## 2. 当前 construction flow 的合理职责

construction flow 当前合理职责：

1. 初始世界生成。
2. 初始家园布局。
3. create-world 后第一幕家园状态辅助。
4. construction debug scenario。
5. mapdiff debug 的对比输入。
6. 测试构建逻辑。
7. 为 world-evolution 提供历史参考。

construction flow 在 MVP 阶段可以保留，但职责应限制在 initial generation / debug support。

## 3. construction flow 不应继续承担的职责

construction flow 不应继续承担：

1. 多 Tick 世界推进。
2. 长期家园演化。
3. 正式世界状态写入。
4. 正式 MapDiff apply。
5. 宠物行为导致的世界变化。
6. 管家意图导致的长期建设。
7. SafeApply 决策。
8. Renderer 数据源。
9. 持久化恢复。
10. 正式 /world Tick 执行。

## 4. 新旧链路职责对比

| 职责 | 旧 construction flow | 新 world-loop / world-evolution flow |
| --- | --- | --- |
| 初始世界生成 | 是 | 否，承接初始状态 |
| 初始家园布局 | 是 | 否，后续可读取 |
| debug scenario | 是 | 可提供正式链路 debug |
| 长期世界推进 | 否 | 是 |
| 正式 Tick | 否 | 是 |
| MapDiff 提案 | 历史/辅助 | WorldDiffProposal |
| MapDiff 写入 | 否 | SafeApply 后写入 runtime state |
| Renderer 输入 | 否 | RenderableWorldSnapshot |
| 持久化 | 否 | P7.10 后设计 |

## 5. 迁移策略

阶段一：保留并冻结扩张

1. construction flow 继续保留。
2. 不新增长期推进职责。
3. 不新增正式 Tick 调用。
4. debug scenario 可以继续存在。

阶段二：把后续建设行为迁移到 world-evolution

1. 新的建设行为必须表达为 IntentDecision。
2. 再转成 WorldChangePlan。
3. 再转成 WorldDiffProposal。
4. 再经过 validation / audit / SafeApply。

阶段三：construction flow 收缩为 initial generation

1. 只负责新世界出生时的初始家园。
2. 不再参与 Tick。
3. 不再参与正式世界长期变化。
4. debug 场景明确标注为 debug-only。

## 6. 对现有文件的边界建议

`src/world/construction/`

建议：保留；只用于 construction debug 和初始建设辅助；不再新增正式长期推进职责。

`src/world/debug-scenarios/`

建议：保留；用于 debug；不得被正式 /world Tick 调用。

`src/world/generation/`

建议：保留；负责 initial home generation。

`src/world/world-evolution/`

建议：长期变化计划与 proposal 的正式入口。

`src/world/world-loop/`

建议：正式 Tick 与 runtime state 的入口。

`src/world/runtime/world-first-scene-model.ts`

建议：负责第一幕；不承担多 Tick 长期推进。

`src/app/world/world-route-page.tsx`

建议：只调用 world-loop，不调用 construction debug scenario。

## 7. P7 之后新增建设能力应该进入哪里

如果后续要新增：

1. 建房子
2. 扩建院子
3. 种树
4. 铺路
5. 修复设施
6. 清理区域
7. 移动物体
8. 重组空间

都应该优先进入：

```text
IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> SafeApply
-> RuntimeWorldState
```

而不是直接扩展 construction flow。

## 8. 禁止事项

1. 禁止正式 /world 调用 construction debug scenario。
2. 禁止 Renderer 读取 construction debug result。
3. 禁止 construction flow 直接修改 runtimeState。
4. 禁止 construction flow 绕过 SafeApply 写 HomeMapState。
5. 禁止新增长期建设逻辑到 construction debug 文件。
6. 禁止把 construction debug state 持久化为正式世界。
7. 禁止为了快速看到变化绕过 world-loop。
8. 禁止把 construction flow 和 world-loop 混在同一个页面逻辑中。
9. 禁止删除旧 construction flow 前不写迁移文档。
10. 禁止让 construction flow 成为第二套世界引擎。

## 9. 后续路线

P7.8：旧 construction flow 收缩文档

P7.9：P7 收口文档

P7.10：PersistedWorldLoopState schema

P7.11：persistence adapter

P7.12：/world 恢复 persisted state

P7.13：手动保存按钮

P7.14：自动保存策略评估

## 10. 当前结论

当前不删除 construction flow。
当前不修改 construction 代码。
当前只锁定边界：
construction flow 负责 initial generation / debug support。
world-loop / world-evolution 负责长期世界推进。

下一步进入 P7.9：P7 收口文档。
