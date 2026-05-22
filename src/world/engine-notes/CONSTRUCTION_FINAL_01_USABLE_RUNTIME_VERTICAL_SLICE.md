# AI-PET-WORLD CONSTRUCTION-FINAL-01 Construction Usable Runtime Vertical Slice

## 1. 阶段定位

CONSTRUCTION-FINAL-01 是 Construction 建设系统从协议层进入工程可运行闭环的收口模块。

本阶段一次性完成：

| 子模块 | 说明 |
|---|---|
| Construction Runtime Adapter | 提供工程可调用入口 |
| Construction Debug Harness | 提供调试运行入口 |
| Construction Memory Persistence Mock | 模拟持久化提案保存结果，不写真实 storage |
| Construction Visual Refresh Bridge | 把 refresh signal 转换为刷新请求前协议 |
| Construction Full Pipeline Audit | 审计完整纵向链路 |
| Construction Pipeline Report | 输出可读报告 |

本阶段不是 UI 阶段。
本阶段不接真实 world-loop。
本阶段不写真实 storage。
本阶段不修改 FormalVisualModel。
本阶段不修改 Renderer。
本阶段不接宠物。

## 2. 当前模块目标

| 项目 | 内容 |
|---|---|
| 当前模块目标 | 让 Construction 链路成为可在工程中调用、审计、模拟、输出报告的纵向闭环 |
| 输入 | ConstructionRuntimeAdapterInput / ConstructionDebugHarnessInput |
| 输出 | ConstructionRuntimeAdapterResult / ConstructionDebugHarnessResult |
| 世界状态变化 | 只能来自 ConstructionRuntimeCycleResult.nextHomeMapState |
| 持久化 | 只进入 memory mock，不是真实持久化 |
| 视觉刷新 | 只进入 bridge request，不是真实 UI refresh |

## 3. 完整链路

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> selected ConstructionPlan
-> ConstructionExecutionResult
-> MapDiff[] 候选
-> SafeApply
-> nextHomeMapState
-> ConstructionWorldLoopProtocolResult
-> ConstructionRuntimeCycleResult
-> PersistenceProposal
-> VisualRefreshSignal
-> MemoryPersistenceMock
-> VisualRefreshBridge
-> FullPipelineAudit
-> PipelineReport
```

## 4. 已完成哪些

| 已完成项 | 文件 | 说明 |
|---|---|---|
| Runtime Adapter | `construction-runtime-adapter.ts` | 串联 runtime cycle、memory mock、visual bridge、full audit、pipeline report |
| Debug Harness | `construction-debug-harness.ts` | 提供 debug-only 调用入口 |
| Memory Persistence Mock | `construction-memory-persistence-mock.ts` | 模拟 proposal 保存结果，不写 storage |
| Visual Refresh Bridge | `construction-visual-refresh-bridge.ts` | 将 signal 转换为 refresh request 前协议 |
| Full Pipeline Audit | `construction-full-pipeline-audit.ts` | 审计 full pipeline lineage、mock、bridge、禁止 token |
| Pipeline Report | `construction-pipeline-report.ts` | 输出工程可读报告 |
| Schema | `construction-schema.ts` | 补齐 final vertical slice 类型 |

## 5. 未完成哪些

| 未完成项 | 原因 | 下一步 |
|---|---|---|
| 真实 world-loop 接入 | 本阶段只做可运行闭环，不注册 loop | 后续 Runtime Bridge 阶段 |
| 真实 persistence 写入 | 本阶段只做 memory mock | 后续 Persistence 阶段 |
| 真实 FormalVisualModel 刷新 | 本阶段只做 bridge request | 后续 Visual Refresh 阶段 |
| 宠物后置进入 | 本阶段不接宠物 | 后续 LifeEvent / CompanionDecision |

## 6. 本轮改哪些文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/world/construction/construction-schema.ts` | 修改 | 增加 runtime adapter、memory mock、visual bridge、full audit、report、debug harness 类型 |
| `src/world/construction/construction-runtime-adapter.ts` | 新增 | 工程可调用纵向闭环入口 |
| `src/world/construction/construction-debug-harness.ts` | 新增 | 调试运行入口 |
| `src/world/construction/construction-memory-persistence-mock.ts` | 新增 | 内存持久化 mock |
| `src/world/construction/construction-visual-refresh-bridge.ts` | 新增 | 视觉刷新桥接协议 |
| `src/world/construction/construction-full-pipeline-audit.ts` | 新增 | 完整链路审计 |
| `src/world/construction/construction-pipeline-report.ts` | 新增 | pipeline report |
| `src/world/engine-notes/CONSTRUCTION_FINAL_01_USABLE_RUNTIME_VERTICAL_SLICE.md` | 新增 | 阶段文档 |
| `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md` | 修改 | 追加完成记录 |
| `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md` | 修改 | 追加红线 |

## 7. 本轮不改哪些文件

| 范围 | 说明 |
|---|---|
| `/world` UI | 不接入 |
| FormalWorldView | 不修改 |
| FormalVisualModel | 不修改 |
| Renderer | 不修改 |
| world-loop | 不接真实 loop |
| map-state schema | 不修改 |
| generation / placement | 不修改 |
| pet / adoption | 不接入 |
| engine / systems / types | 不修改 |

## 8. 完成后如何验证

| 验证项 | 命令 / 检查 |
|---|---|
| lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| build | `npm run build` |
| 变更范围 | 不包含 UI、world-loop、FormalVisualModel、renderer、map-state schema |
| 链路检查 | Runtime Adapter 必须调用 RuntimeCycle，不能重写 SafeApply |
| 持久化检查 | Memory mock 不能写真实 storage |
| 视觉检查 | Visual bridge 不能修改 FormalVisualModel / Renderer / UI |

## 9. 红线

1. Runtime Adapter 不能注册真实 world-loop。
2. Memory Persistence Mock 不能当作正式持久化。
3. Visual Refresh Bridge 不能当作 UI model。
4. Full Pipeline Audit 不能跳过 RuntimeCycle / SafeApply。
5. Pipeline Report 不能当作玩家 UI。
6. 本阶段不能生成宠物、pet actor、pet bed。
7. 本阶段不能包含 pet_arrival / pet_rest。
8. 本阶段不能恢复旧默认宠物开局路线。
9. 本阶段不能读取 PNG / WORLD_MAP_ASSETS 决定世界事实。
10. 本阶段不能使用 Math.random / Date.now / any。

## 10. 下一步

下一步建议进入：

```text
CONSTRUCTION-FINAL-02：Runtime Bridge 接入前一致性检查
```
