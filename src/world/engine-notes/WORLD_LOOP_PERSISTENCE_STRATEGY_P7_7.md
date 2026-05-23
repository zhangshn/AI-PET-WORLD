> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7.7 WorldLoop 持久化策略

## 1. P7.7 的定位

P7.7 不是实现持久化。
P7.7 不是把 runtimeState 直接塞进 localStorage。
P7.7 是决定 RuntimeWorldState 的正式持久化边界。

当前 `/world` 已经可以手动 Tick，但状态只存在 React 内存中。
刷新页面后会回到 firstSceneModel。
这不是 bug，而是 P7.7 前的安全状态。

## 2. 为什么不能直接持久化完整 RuntimeWorldState

不能直接持久化完整 RuntimeWorldState 的原因：

1. RuntimeWorldState 包含 currentRenderableSnapshot，这是派生展示对象，不是核心世界事实。
2. RuntimeWorldState 包含 lastStepResult，里面嵌套完整 P5 chain，体积会快速膨胀。
3. auditTrail 会随着 Tick 增长，不能无限写入 localStorage。
4. RenderableWorldSnapshot 可以从 HomeMapState 重新派生，不应作为唯一事实来源。
5. world-loop 未来会加入宠物/管家真实状态，持久化边界需要提前规划。
6. debug_tick/manual_tick 不一定都应该进入正式持久化历史。
7. 旧版本 runtimeState 可能与新 schema 不兼容。

## 3. 推荐持久化核心结构

未来类型草案如下，本阶段只作为文档约束，不创建 TS 类型：

```ts
type PersistedWorldLoopStateDraft = {
  version: "world_loop_persistence_v0"
  worldId: string
  ownerId: string
  tickIndex: number
  currentHomeMapState: HomeMapState
  lastAppliedTick?: {
    tickId: string
    status: WorldLoopStepStatus
    safeApplyStatus: SafeApplyDecisionStatus
    appliedMapDiffCount: number
    checkedAt: number
  }
  auditTrailSummary: {
    totalCount: number
    recent: PersistedAuditTrailSummary[]
  }
  savedAt: number
  tags: string[]
}

type PersistedAuditTrailSummary = {
  tickId: string
  checkedAt: number
  status: WorldLoopStepStatus
  blockers: string[]
  warnings: string[]
  notes: string[]
  stageSummary: {
    stage: WorldLoopStageName
    status: WorldLoopStepStatus
  }[]
}
```

说明：

1. currentHomeMapState 是核心世界事实。
2. currentRenderableSnapshot 不需要持久化，可以恢复后重新派生。
3. lastStepResult 不完整持久化，只存 summary。
4. auditTrail 只存 summary 和最近 N 条。

## 4. 不应该持久化的内容

不应该持久化：

1. currentRenderableSnapshot。
2. VisualState。
3. DrawCommand[]。
4. RenderableWorldSnapshot。
5. 完整 WorldLoopStepResult。
6. 完整 WorldEngineChainAuditReport。
7. debug scenario result。
8. construction debug scenario result。
9. React UI 状态。
10. Renderer viewport / hover / selected command 等临时显示状态。

这些内容要么可以从 HomeMapState 派生，要么是调试/界面状态，不应成为世界事实。

## 5. 可以持久化的内容

可以持久化：

1. worldId。
2. ownerId。
3. tickIndex。
4. currentHomeMapState。
5. 最近一次 applied / blocked / skipped 的摘要。
6. 最近 N 条 auditTrail summary。
7. persistence version。
8. savedAt。
9. tags。

P7 MVP 阶段 N 建议为 10。
超过 10 条只保留摘要计数，不无限增长。

## 6. localStorage / backend / session state 的阶段选择

| 方案 | 适合阶段 | 优点 | 风险 | 当前是否采用 |
| --- | --- | --- | --- | --- |
| React memory state | P7.4-P7.6 | 最安全，不污染正式世界 | 刷新丢失 | 是 |
| localStorage | P7.8/P7.9 之前的本地 MVP | 实现快，适合单机验证 | 容量有限、版本迁移、旧数据污染 | 暂不实现 |
| backend persistence | 账号系统 / 多设备阶段 | 正式可靠 | 需要 API、权限、冲突处理 | 不在当前阶段 |
| sessionStorage | 临时调试 | 刷新可保留，同 tab 隔离 | 不是正式持久化 | 暂不实现 |

## 7. 状态恢复流程建议

未来恢复流程：

1. 用户进入 /world。
2. buildWorldFirstSceneModel 生成 firstSceneModel。
3. 尝试读取 persisted state。
4. 校验 persisted.version。
5. 校验 persisted.worldId === firstSceneModel.worldId。
6. 校验 persisted.ownerId === firstSceneModel.homeMapState.ownerId。
7. 校验 currentHomeMapState 基础字段完整。
8. 如果通过，使用 persisted.currentHomeMapState 构建 RenderableWorldSnapshot。
9. buildRuntimeWorldStateFromPersistedState。
10. 如果任何一步失败，fallback 到 firstSceneModel。

恢复流程必须重新派生 RenderableWorldSnapshot，不直接信任持久化中的 Renderer 输出。

## 8. 世界切换与隔离策略

1. storage key 必须包含 worldId。
2. ownerId 必须参与校验。
3. 不允许不同 worldId 共用 RuntimeWorldState。
4. create-world 输入变化后必须重新判断 worldId。
5. 如果 worldId 变了，旧 runtime state 不能继续使用。
6. 未来多个世界时需要 world index。
7. 删除世界时需要同步删除 persisted state。

推荐 key：

```text
ai-pet-world:world-loop:${worldId}
```

## 9. auditTrail 裁剪策略

1. 不持久化完整 auditTrail。
2. 只持久化最近 N 条 summary。
3. P7 MVP 阶段 N = 10。
4. 每条 summary 最多保留前 6 条 blockers/warnings/notes。
5. stage 只保留 stage/status，不保留长 message。
6. 完整 audit 可仅在当前页面内存显示。
7. 后端阶段再考虑完整审计日志归档。

## 10. 持久化失败 fallback

持久化失败时：

1. 不阻塞 /world 打开。
2. 不阻塞 Renderer。
3. 不报错中断页面。
4. fallback 到 firstSceneModel。
5. 显示 “使用初始世界状态” 的提示。
6. 保留一条 runtime note。
7. 不自动清空用户数据，除非明确版本不兼容。

## 11. P7.8/P7.9 之前禁止事项

1. 禁止现在直接写 localStorage。
2. 禁止现在直接恢复 persisted runtime。
3. 禁止持久化 RenderableWorldSnapshot 作为事实。
4. 禁止无限持久化 auditTrail。
5. 禁止跳过 worldId / ownerId 校验。
6. 禁止 Renderer 参与持久化。
7. 禁止 Tick 自动持久化但没有版本策略。
8. 禁止 debug scenario 状态进入正式持久化。
9. 禁止把旧 construction debug state 当正式世界。
10. 禁止用 Date.now() 作为不可控保存时间来源；未来 savedAt 必须由 runtime input 或明确 save action 提供。

## 12. 后续实现路线

P7.7：持久化策略文档

P7.8：旧 construction flow 收缩文档

P7.9：P7 收口文档

P7.10：PersistedWorldLoopState schema

P7.11：persistence adapter，不接 UI

P7.12：/world 恢复 persisted state

P7.13：手动保存按钮

P7.14：自动保存策略评估

当前不实现这些，只写路线。

## 13. 当前结论

当前继续使用 React memory state。
不在 P7.7 写 localStorage。
下一步进入 P7.8：旧 construction flow 收缩文档。
只有 P7.10 之后才开始定义正式持久化 schema。
