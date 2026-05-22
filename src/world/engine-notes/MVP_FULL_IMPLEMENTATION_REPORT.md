# AI-PET-WORLD MVP 必交付完整实现报告

## 1. 阶段定位

本阶段把 MVP 必交付链路从协议闭环推进到工程可运行、可验证、可展示、可审计的 MVP 闭环。

当前完成的是：

| 类型 | 状态 | 说明 |
|---|---:|---|
| 工程闭环 | 已完成 | MVP 总入口可以串起管家、初始世界、建设运行、持久化 dry-run、视觉刷新、日志、P-Phone、生命事件候选、审计与报告 |
| debug 闭环 | 已完成 | Smoke Audit 与页面调试视图可用于检查链路 |
| dry-run 闭环 | 已完成 | 持久化与视觉刷新均为前置请求或内存模拟，不写真实数据库 |
| 只读展示闭环 | 已完成 | /world 默认展示 FormalWorldView，并显示 MVP 只读 ViewModel |

当前仍不等于线上真实产品、真实数据库、真实定时 world-loop、宠物正式进入或商业化完整版本。

## 2. MVP 已完成模块

| 模块 | 状态 | 关键入口 |
|---|---:|---|
| Butler MVP 输入与人格映射 | 已完成 | `buildButlerMvpProfile` |
| MVP Initial World Builder | 已完成 | `buildMvpInitialWorld` |
| MVP World Runtime Tick | 已完成 | `runMvpWorldRuntimeTick` |
| MVP Persistence Dry Run | 已完成 | `runMvpPersistenceDryRun` |
| MVP Visual Refresh | 已完成 | `buildMvpVisualRefresh` |
| MVP Formal Visual Refresh | 已完成 | `buildMvpFormalVisualRefresh` |
| WorldLog / ButlerExplanation / P-Phone | 已完成 | `buildMvpWorldLogEntries` / `buildMvpPPhoneData` |
| LifeEvent / CompanionDecision 后置候选 | 已完成 | `buildLifeEventCandidates` / `buildCompanionDecisionCandidates` |
| MVP Core Pipeline 总入口 | 已完成 | `runAiPetWorldMvpPipeline` |
| MVP Smoke Scenarios / Smoke Audit | 已完成 | `runMvpSmokeAudit` |
| /world MVP 只读 ViewModel | 已完成 | `buildMvpWorldViewModel` |
| /world 可用展示 | 已完成 | 默认 Formal 主视觉，保留 Debug 切换，展示 MVP 核心闭环摘要 |

## 3. 当前完整 MVP 链路

```text
Player Birth Input
-> Butler MVP Profile
-> Initial HomeMapState
-> Construction Runtime Vertical Slice
-> MVP Runtime Tick
-> SafeApply nextHomeMapState
-> Persistence Dry Run / Memory Preview
-> Visual Refresh Request
-> Formal Visual Refresh Precheck
-> WorldLog
-> ButlerExplanation
-> P-Phone Data
-> LifeEvent Candidate
-> CompanionDecision Candidate
-> MVP Audit
-> MVP Report
-> /world Readonly ViewModel
-> FormalWorldView 只读渲染
```

## 4. 本轮可见产品化修正

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/app/create-world/create-world-route-page.tsx` | 重写 | 修复乱码文案，移除 `Date.now`，使用稳定输入时间戳，明确开局不默认宠物 |
| `src/app/world/world-route-page.tsx` | 重写 | /world 默认展示 Formal 主视觉，保留 Debug 切换，接入 `runAiPetWorldMvpPipeline` 与 `buildMvpWorldViewModel` |
| `src/app/world/components/formal-world-view/formal-world-view.tsx` | 修正 | 修复只读 FormalWorldView 的可见中文文案 |
| `src/world/runtime/world-first-scene-model.ts` | 重写 | 修复首屏模型文案，清理旧乱码，保持真实链路生成 |
| `src/world/creation/world-creation-runtime.ts` | 重写 | 修复运行时文案，移除 `Date.now` fallback，保持 deterministic world creation |

## 5. 禁止事项

| 禁止事项 | 当前状态 |
|---|---:|
| 默认生成宠物 | 禁止 |
| 默认生成 pet actor / pet bed | 禁止 |
| 生成 pet_arrival / pet_rest | 禁止 |
| 生成旧出生装置路线 | 禁止 |
| UI / CSS / PNG 决定世界事实 | 禁止 |
| Renderer / FormalWorldView 生成世界事实 | 禁止 |
| 绕过 HomeMapState / MapDiff / SafeApply / FormalVisualModel | 禁止 |
| 把 dry-run / audit / report 当作线上最终事实 | 禁止 |

## 6. 尚未完成的产品化步骤

| 未完成项 | 当前原因 | 下一步 |
|---|---|---|
| 真实数据库持久化 | 当前只有 dry-run / memory preview | 实现 persistence adapter 并接入账号数据 |
| 真实定时 world-loop | 当前只提供手动 Tick 与协议桥 | 实现 scheduler bridge 与后台 tick 策略 |
| 真实线上用户数据 | 当前是本地浏览器输入与 localStorage | 接入用户系统与后端存储 |
| 宠物正式进入 | 当前只有后置候选入口 | 实现 LifeEvent -> CompanionDecision -> accept_companion |
| 集成测试 | 当前通过 lint / tsc / build 与 smoke audit 入口 | 补充自动化 integration tests |

## 7. 如何验证

| 验证项 | 命令 / 检查 |
|---|---|
| Lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| Production build | `npm run build` |
| 入口验收 | 搜索硬性入口函数 |
| 文件验收 | 检查硬性文件清单 |
| 页面验收 | `/create-world` 创建世界后进入 `/world`，默认显示正式主视觉与 MVP 核心闭环 |
