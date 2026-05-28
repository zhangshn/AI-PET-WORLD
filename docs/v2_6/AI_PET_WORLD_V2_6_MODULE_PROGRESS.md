# AI-PET-WORLD V2.6｜模块进度表

> 本进度表只依据《完整业务架构总图（强化版）》与《无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案》以及 `AI_PET_WORLD_V2_6_HANDOFF_M11_MVP_CLOSEOUT.md`。
>
> 当前准确阶段：M11｜验收整理阶段。
> 当前不是新功能开发，不是恢复 `/world` 画面，不是网页卡片主页整理，不是进入 M8 / M9 / M10。

| 模块 | 进度 | 状态 | 说明 |
|---|---:|---|---|
| M1 移动痕迹契约迁移 | 100% | 完成 | road/path 正式架构已移除，movement trace / trace field 成为正式口径 |
| M2 世界空间底座 v0 | 100% | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 100% | 完成 | TraceFact / TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 100% | 完成但降级为 Debug 参考 | movement / spatial_use / ecology influence 已分层；当前只能作为 `/world-debug/pixel-scene-composer` 的视觉参考，不是核心资源库、正式算法库或正式验算库 |
| M5 痕迹视觉表现 v0 | 100% | 完成 | pressed_grass / worn_grass / exposed_soil / ecology_transition 已建立 |
| M6 生态对象规则深化 | 100% | 完成 | 生态对象派生规则已有基础；正式画图算法需要在 M11 验收整理完成后重整 |
| M6.5 legacy 命名清理 | 100% | 完成 | legacy road/path 业务口径已降级为兼容命名，正式文档与正式链路不再使用 |
| WORLD-PIXEL-RULE-MAPPER-00 | 100% | 完成 | 正式 WorldViewModel 主链路已建立：WorldRuntimeSaveRecord / HomeMapState / SpaceGrid / TraceField / ButlerState → WorldViewModel；当前视觉输出不作为最终主页效果 |
| M7 管家行为 → 痕迹闭环 | 100% | 完成 | Butler decision → intent → world rule validation → trace closure → TraceField / MemorySeedField → audit summary → explanation 链路已完成；当前只验收不重构 |
| M8 管家记忆与学习 | 0% | 后置 | MVP 阶段不做 |
| M9 世界学习 v0 | 0% | 后置 | MVP 阶段不做 |
| M10 宠物学习预留 | 0% | 后置 | MVP 阶段不做 |
| M11 主页清空 | 100% | 完成 | `/world` 已保持 cleared 状态；旧画布、当前记录卡片、管家说明卡片、P-Phone 卡片已从正式主页移除 |
| M11 验收整理 | 100% | 完成 | 已完成 handoff 复读、关键文件静态核对、smoke 注册情况整理、Debug 地址用途整理与本地命令级验收；当前可进入下一阶段准备，但仍不得直接恢复 `/world` 画面 |
| M11 核心资源库 / 验算库 | 0% | 后续 | 验收整理完成后再进入；下一步优先建立正式核心资源库 / 验算库边界 |
| M11 正式画图算法重整 | 0% | 后续 | 核心资源库 / 验算库边界明确后再开始；未来 `/world` 是端游式像素主世界，不是网页卡片页 |
| M12 构建与质量验收 | 持续 | 持续 | 每个模块后必须 lint / tsc / build / 对应 smoke |

## 当前路线

当前项目已经完成 M1-M6.5、WORLD-PIXEL-RULE-MAPPER-00、M7 管家行为 → 痕迹闭环与 M11 验收整理。

当前准确阶段是：

```txt
M11｜验收整理完成
```

当前已经确认：`/world` 保持 cleared，旧画布和旧卡片主页没有恢复，Debug Composer 没有进入正式 `/world`，create-world → runtime save → `/world` 路径可验收，M7 闭环和 WorldViewModel 主链路没有被破坏。

下一步才进入：

```txt
核心资源库 / 验算库
→ 正式画图算法重整
→ 端游式 /world 主世界恢复
```

## M11 当前必须验收的内容

| 验收项 | 当前口径 | 状态 |
|---|---|---|
| `/world` cleared 状态 | 正式主页保持清空，不恢复旧画布或网页卡片主页 | 已通过本地 smoke |
| 旧主页卡片移除 | 不恢复当前记录卡片、管家说明卡片、P-Phone 卡片、顶部说明卡 | 已通过本地 smoke |
| Debug Composer 定位 | `/world-debug/pixel-scene-composer` 只作为 Debug 视觉参考库 | 已锁定口径 |
| create-world 路径 | `/create-world` → runtime save → `/world` 可验收 | 已通过 node smoke |
| M7 闭环 | 管家行为 → 验证 → 痕迹 → 记忆种子 → 解释链路不被破坏 | 已通过本地 smoke |
| WorldViewModel 主链路 | 正式表现模型主链路继续存在，但当前不恢复画面 | 已通过本地 smoke |
| smoke 注册情况 | 区分 package.json 已注册命令与 node 直接运行脚本 | 已整理 |
| Debug 地址用途 | 明确 Debug 页面用途，不进入正式 `/world` | 已整理 |
| 孵化器旧链条 | 不恢复 incubator / embryo / hatch / hatch progress | 已锁定口径 |

## M11 本轮静态核对记录

| 核对对象 | 核对结果 | 说明 |
|---|---|---|
| `docs/v2_6/AI_PET_WORLD_V2_6_HANDOFF_M11_MVP_CLOSEOUT.md` | 通过 | 当前阶段锁定为 M11 验收整理；明确不恢复 `/world` 画面、不进入 M8 / M9 / M10 |
| `src/app/world/components/pixel-world-view/pixel-world-view.tsx` | 通过 | `PixelWorldView` 当前只保留 `data-surface-state="cleared"` 的 cleared surface |
| `src/app/world/world-live-runtime-page.tsx` | 通过 | `/world` 仍通过 `readWorldRuntimeForView` 读取 runtime，并构建 `buildWorldViewModelForPixelWorld`；页面层不推进 runtime tick |
| `package.json` | 通过 | M11 formal surface、M7 closeout / explanation / audit-summary、butler trace closure、WorldViewModel primary smoke 已注册 |
| `scripts/run-world-m11-create-world-flow-smoke.cjs` | 通过 | 当前不注册 npm alias，继续按 handoff 要求用 node 直接跑 |

## M11 命令级验收记录

| 命令 | 结果 | 说明 |
|---|---|---|
| `git pull` | PASS | 已拉取最新 smoke 修正 |
| `npm run lint` | PASS | ESLint 通过 |
| `npx tsc --noEmit` | PASS | TypeScript 类型检查通过 |
| `npm run build` | PASS | Next.js 16.2.4 build 通过 |
| `npm run smoke:m11-formal-surface` | PASS | `/world` cleared、旧画布/卡片移除、无默认宠物、read-only surface 通过 |
| `node scripts/run-world-m11-create-world-flow-smoke.cjs` | PASS | create-world API 写入 runtime save，`/world` 可读取创建后的 runtime save |
| `npm run smoke:m7-closeout` | PASS | fresh runtime 可自举一次显式 tick 并完成 M7 closeout 验收 |
| `npm run smoke:m7-explanation` | PASS | explanation / pPhone model 链路通过；M11 cleared surface 未恢复旧说明卡片 |
| `npm run smoke:m7-audit-summary` | PASS | audit summary 持久化、trace pointer、safeguards、read-only view 通过 |
| `npm run smoke:butler-trace-closure` | PASS | Butler trace closure、no default pet、read-only view 通过 |
| `npm run smoke:world-pixel-viewmodel-primary` | PASS | WorldViewModel 主链路、无 Scene Composer gateway、无 SVG renderer、无默认宠物通过 |

## 当前 smoke / 验收命令整理

### 已注册在 `package.json` 的 smoke

```powershell
npm run smoke:m11-formal-surface
npm run smoke:m7-closeout
npm run smoke:m7-explanation
npm run smoke:m7-audit-summary
npm run smoke:butler-trace-closure
npm run smoke:world-pixel-viewmodel-primary
```

### 当前需要 node 直接跑的 smoke

```powershell
node scripts/run-world-m11-create-world-flow-smoke.cjs
```

说明：`smoke:m11-create-world-flow` 当前尚未注册进 `package.json`。M11 验收整理阶段继续用 node 直接跑；是否补注册应作为独立整理项处理，不影响当前 create-world flow 验收。

## Debug 地址和用途

| 地址 | 用途 | 边界 |
|---|---|---|
| `/create-world` | MVP 创建世界入口 | 允许进入正式 runtime save 路径 |
| `/world` | 正式主世界入口 | 当前必须保持 cleared，不恢复旧画面或网页卡片主页 |
| `/personality-test` | 命理 / 人格调试页 | 允许显示内部调试信息 |
| `/world-debug` | 世界 Debug 入口 | 只服务开发验证 |
| `/world-debug/mapdiff` | MapDiff 调试 | 不进入正式 `/world` |
| `/world-debug/pixel-scene-composer` | Debug 视觉参考库 / 像素组合预览实验室 | 不是核心资源库、正式算法库或正式验算库 |
| `/world-debug/procedural-renderer` | 旧实验 / 调试 | 不得搬进正式 `/world` |
| `/world-debug/proposal-audit` | Proposal / audit 调试 | 不得暴露到正式 UI |
| `/world-debug/tree-render-test` | 树渲染测试 | 仅作调试 |
| `/world-debug/visual-change-verification` | 视觉变化验证 | 仅作调试 |

## WORLD-PIXEL-RULE-MAPPER-00 完成内容

- `SpaceGrid → tiles`
- `TraceField → traces`
- `HomeMapState placements → objects`
- `ButlerState / decision → actors`
- `Resources / ecology / trace influence → atmosphere`
- `/world` 不引用 `buildSceneSvg`
- `/world` 不引用 `WorldPainterReadonlyPreview`
- `/world` 不引用 `FormalWorldView`
- `/world` 不引用 `ProceduralRendererView`
- `/world` 不把 Debug Composer 搬进正式页
- `WorldViewModel` 不直接依赖 `scene-composer-gateway`
- smoke 已守卫默认宠物不生成、runtime 不写入、tick 不推进

注意：以上是正式表现模型主链路能力，不代表当前 `/world` 已恢复正式像素画面。当前 `/world` 必须继续保持 cleared，直到后续正式画图算法重整完成并通过验收。

## M7 管家行为 → 痕迹闭环完成内容

目标链路：

```txt
ButlerState / runtime decision
→ Butler intent
→ World rule validation
→ SafeApply
→ Trace / Event / Resource / HomeMapState diff
→ MemorySeed
→ ButlerRuntimeAuditSummary
→ explanation / pPhone model
→ 下一轮 RuntimeSaveRecord
```

已完成：

- `ButlerRuntimeDecision → ButlerRuntimeIntent`
- `ButlerRuntimeIntent → ButlerWorldRuleValidation`
- `runTraceLifecycleTick → applyButlerRuntimeTraceClosure`
- `TraceField → TraceMemorySeedField`
- `lastButlerRuntimeIntent` 持久化
- `lastButlerWorldRuleValidation` 持久化
- `lastButlerRuntimeAuditSummary` 持久化
- 解释链路优先读取 `lastButlerRuntimeAuditSummary`
- `AI_PET_WORLD_V2_6_M7_BUTLER_TRACE_CLOSURE_CLOSEOUT.md` 已新增
- `smoke:butler-trace-closure` 已新增
- `smoke:m7-explanation` 已新增，并守卫 audit-summary-first 解释路径
- `smoke:m7-audit-summary` 已新增
- `smoke:m7-closeout` 已新增
- `observe_world / wait_for_resources` 不写 HomeMapState diff，但允许留下验证后的行为痕迹
- `continue_construction / maintain_home` 仍必须通过 SafeApply 才能写 HomeMapState diff
- 明确守卫 `no_pet_fact_created`，M7 不默认生成宠物
- 明确守卫正式 `/world` 不回退 SVG / Scene Composer / Debug 主链路

## 下一阶段入口

M11 验收整理完成后，下一阶段不是直接恢复 `/world` 画面，而是先建立：

```txt
核心资源库 / 验算库
```

该阶段目标是验证正式算法输出是否正确，包括但不限于：

- SpaceGrid 是否正确。
- SpaceCell terrainKind / regionKind / traceStrength 是否正确。
- HomeMapState placements 是否正确。
- TraceField 是否正确。
- TraceMemorySeedField 是否正确。
- WorldViewModel tiles / objects / traces / actors 是否正确。
- derived_visual_only 是否只读。
- not_world_fact / no_runtime_write 是否齐全。
- 默认宠物是否没有出现。
- 坐标定位是否正确。
- 生态对象是否按正式规则生成。

## M11 禁止事项

- 不做 M8 / M9 / M10。
- 不做宠物学习。
- 不做小镇 / 公园 / 医院。
- 不做多用户。
- 不恢复网页卡片主页。
- 不恢复旧 `/world` 画面。
- 不把 Debug Composer 搬进 `/world`。
- 不恢复孵化器 / embryo / hatch / incubator 旧业务链条。
- 不恢复 road/path 正式架构。
- 不让页面访问推进 runtime tick。
- 不让 `derived_visual_only` 写入 HomeMapState。
- 不暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词到正式 UI。
