# AI-PET-WORLD MVP 必交付完整闭环报告

## 1. 阶段定位

本阶段补齐 MVP 必交付完整闭环的硬性文件、入口和总控文档。

当前完成的是 MVP 工程闭环、debug 闭环、dry-run 闭环和只读展示闭环。它可以运行、验证、展示和审计，但仍不等于线上真实产品、真实数据库、真实定时 world-loop 或宠物正式进入。

## 2. MVP 已完成模块

| 模块 | 状态 | 说明 |
|---|---:|---|
| Butler MVP 输入与人格映射 | 已完成 | 新增 `src/world/butler/*` |
| MVP Initial World Builder | 已完成 | 复用 `generateInitialHomeMap` |
| MVP World Runtime Tick | 已完成 | 调用 Construction vertical slice |
| MVP Persistence Dry Run | 已完成 | 仅 memory dry-run，不写真实存储 |
| MVP Visual Refresh | 已完成 | 输出 snapshot refresh request |
| MVP Formal Visual Refresh | 已完成 | 复用 FormalVisualGenerator |
| WorldLog / ButlerExplanation / P-Phone | 已完成 | 只读摘要，不生成世界事实 |
| LifeEvent / CompanionDecision 后置候选 | 已完成 | 只生成候选，不生成宠物 |
| MVP Core Pipeline 总入口 | 已完成 | `runAiPetWorldMvpPipeline` |
| MVP Smoke Scenarios / Audit | 已完成 | 至少 3 个 scenario |
| /world MVP ViewModel | 已完成 | `buildMvpWorldViewModel` |

## 3. 本轮完成模块

| 模块 | 文件 | 入口 |
|---|---|---|
| Butler MVP | `src/world/butler/*` | `buildButlerMvpProfile` |
| Initial World | `mvp-initial-world-builder.ts` | `buildMvpInitialWorld` |
| Runtime Tick | `mvp-world-runtime-tick.ts` | `runMvpWorldRuntimeTick` |
| Persistence Dry Run | `mvp-persistence-dry-run.ts` | `runMvpPersistenceDryRun` |
| Visual Refresh | `mvp-visual-refresh.ts` | `buildMvpVisualRefresh` |
| Formal Visual Refresh | `mvp-formal-visual-refresh.ts` | `buildMvpFormalVisualRefresh` |
| Logs / P-Phone | `mvp-world-log.ts` / `mvp-pphone-data.ts` | `buildMvpPPhoneData` |
| MVP Pipeline | `mvp-core-pipeline.ts` | `runAiPetWorldMvpPipeline` |
| Smoke Audit | `mvp-smoke-audit.ts` | `runMvpSmokeAudit` |
| ViewModel | `src/app/world/mvp-world-view-model.ts` | `buildMvpWorldViewModel` |

## 4. 当前完整 MVP 链路

```text
BirthInput
-> ButlerMvpProfile
-> worldSeed
-> InitialHomeGenerator
-> HomeMapState
-> MvpWorldRuntimeTick
-> Construction vertical slice
-> MapDiff / SafeApply
-> nextHomeMapState
-> MvpPersistenceDryRun
-> MvpVisualRefresh
-> MvpFormalVisualRefresh
-> FormalVisualModel
-> MvpWorldLog / ButlerExplanation / PPhoneData
-> LifeEventCandidate / CompanionDecisionCandidate
-> AiPetWorldMvpAudit
-> AiPetWorldMvpReport
-> MvpWorldViewModel
```

## 5. 未完成模块

| 未完成项 | 当前原因 | 后续产品化路线 |
|---|---|---|
| 真实数据库持久化 | 当前为 dry-run | 接 persistence adapter |
| 真实定时 world-loop | 当前不注册 scheduler | 接 scheduler bridge |
| 宠物正式进入 | 当前仅候选协议 | 实现 accept_companion 后置流 |
| 线上用户数据 | 当前为本地 MVP 闭环 | 接用户系统与真实存储 |
| 商业化完整版本 | 超出 MVP | 继续产品迭代 |

## 6. 禁止事项

| 禁止事项 | 状态 |
|---|---:|
| 默认生成宠物 | 禁止 |
| 默认生成 pet actor / pet bed | 禁止 |
| 生成 pet_arrival / pet_rest | 禁止 |
| UI / CSS / PNG 决定世界事实 | 禁止 |
| Renderer / FormalWorldView 生成世界事实 | 禁止 |
| 绕过 HomeMapState / MapDiff / SafeApply / FormalVisualModel | 禁止 |
| 未审计结果当作最终事实 | 禁止 |

## 7. 如何验证

| 验证项 | 命令 |
|---|---|
| Lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| Build | `npm run build` |
| 入口验收 | `rg "runAiPetWorldMvpPipeline|buildMvpWorldViewModel" src` |
| 文件验收 | `Test-Path` 检查必交付文件 |

## 8. 下一步产品化路线

1. MVP core integration tests。
2. 真实 persistence adapter。
3. 真实 world-loop scheduler。
4. Snapshot refresh adapter 接入生产链路。
5. LifeEvent / CompanionDecision / accept_companion 后置产品化。
