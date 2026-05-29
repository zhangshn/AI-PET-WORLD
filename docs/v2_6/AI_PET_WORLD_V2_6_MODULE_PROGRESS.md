# AI-PET-WORLD V2.6｜模块进度表

> 本进度表只依据当前仓库、当前 M11 交接文档与当前业务口径维护。
>
> 当前准确阶段：M11｜核心资源库 / 验算库深化阶段。
>
> 当前不是恢复 `/world` 画面，不是网页卡片主页整理，不是进入 M8 / M9 / M10。

---

## 1. 当前阶段进度表

| 模块 | 进度 | 状态 | 说明 |
|---|---:|---|---|
| M1 移动痕迹契约迁移 | 100% | 完成 | road/path 正式架构已移除，movement trace / trace field 成为正式口径 |
| M2 世界空间底座 v0 | 100% | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 100% | 完成 | TraceFact / TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 100% | 完成但降级为 Debug 参考 | 只能作为 `/world-debug/pixel-scene-composer` 的视觉参考，不是核心资源库、正式算法库或正式验算库 |
| M5 痕迹视觉表现 v0 | 100% | 完成 | pressed_grass / worn_grass / exposed_soil / ecology_transition 已建立 |
| M6 生态对象规则深化 | 100% | 完成 | 生态对象派生规则已有基础；正式画图算法需要在核心资源库 / 验算库完成后重整 |
| M6.5 legacy 命名清理 | 100% | 完成 | legacy road/path 业务口径已降级为兼容命名，正式文档与正式链路不再使用 |
| WORLD-PIXEL-RULE-MAPPER-00 | 100% | 完成 | WorldRuntimeSaveRecord / HomeMapState / SpaceGrid / TraceField / ButlerState → WorldViewModel 主链路已建立 |
| M7 管家行为 → 痕迹闭环 | 100% | 完成 | Butler decision → intent → world rule validation → trace closure → TraceField / MemorySeedField → audit summary → explanation 链路已完成 |
| M8 管家记忆与学习 | 0% | 后置 | MVP 阶段不做 |
| M9 世界学习 v0 | 0% | 后置 | MVP 阶段不做 |
| M10 宠物学习预留 | 0% | 后置 | MVP 阶段不做 |
| M11 主页清空 | 100% | 完成 | `/world` 保持 cleared；旧画布、当前记录卡片、管家说明卡片、P-Phone 卡片已从正式主页移除 |
| M11 验收整理 | 100% | 完成 | 已完成 handoff、关键文件核对、smoke 注册整理、Debug 地址用途整理与本地命令级验收 |
| M11 源码历史错误口径清理 | 100% | 完成 | 源码中旧生命周期 token 扫描已清空；当前搜索无命中 |
| M11 旧页面运行链路隔离 | 100% | 完成 | `useWorldEngineState.ts` 已 inert 化，页面不再通过旧 hook 推进 runtime tick / snapshot / offline catchup |
| M11 旧 worldEngine 隔离 | 100% | 完成 | `src/engine/worldEngine.ts` 已变为 legacy inert facade，不再实例化 PetSystem，不再运行 old tick |
| M11 旧 world-engine gateway 收窄 | 100% | 完成 | `world-engine-gateway.ts` 不再公开旧完整 tick、旧 pet runtime、旧 pet cognition、旧 butler opportunity runner |
| M11 旧完整 world tick runner 隔离 | 100% | 完成 | `world-tick-runner.ts` 已 inert 化，即使误 import 也不会触发旧 pet runtime / cognition / opportunity 链路 |
| M11 PetSystem 当前主链路隔离 | 100% | 完成 | `PetSystem / petSystem / runPetRuntime / runPetCognition / runButlerOpportunities` 当前搜索无源码可触发入口 |
| M11 create-world flow smoke 注册 | 100% | 完成 | `smoke:m11-create-world-flow` 已注册，并已修复运行后恢复 runtime save 的副作用 |
| M11 文档错误口径清理 | 100% | 完成 | Handoff 与模块进度表已重写；旧口径补扫无明显错误命中 |
| M11 当前业务原则文档 | 100% | 完成 | `AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md` 已新增，锁定 AI 世界 / AI 管家 / P-Phone / 非默认宠物等当前业务原则 |
| M11 Actor 表现输入边界验算 | 100% | 完成 | `smoke:m11-actor-input-boundary` 已注册并通过；未验证 pet placement 不进入 WorldViewModel actors，正式未来 pet entry 需要验证标签 |
| M11 P-Phone 数据入口边界验算 | 100% | 完成 | `smoke:m11-p-phone-input-boundary` 已注册并通过；P-Phone 只读正式模型、不暴露后台词、不恢复旧卡片 |
| M11 核心资源库 / 验算库 | 91% | 进行中 | Runtime / HomeMapState / SpaceGrid / SpaceCell / TraceField / WorldViewModel / 生态对象 / Actor / P-Phone 输入边界已验收；下一步补 UI 自动生成输入边界 |
| M11 正式画图算法重整 | 0% | 后续 | 核心资源库 / 验算库 closeout 后再开始；未来 `/world` 是端游式像素主世界，不是网页卡片页 |
| M12 构建与质量验收 | 持续 | 持续 | 每个阶段后必须 lint / tsc / build / 对应 smoke |

---

## 2. 当前路线

当前项目已经完成：

```txt
M1-M6.5
WORLD-PIXEL-RULE-MAPPER-00
M7 管家行为 → 痕迹闭环
M11 主页清空
M11 验收整理
源码历史错误口径清理
旧页面运行链路隔离
旧 worldEngine 隔离
旧 world-engine gateway 收窄
旧完整 world tick runner 隔离
PetSystem 当前主链路隔离
create-world flow smoke npm 注册与副作用修复
M11 文档错误口径清理
当前业务原则文档写入
核心资源库 / 验算库第一批只读验收
SpaceCell / 坐标 / Trace 投影深化验算
生态对象来源与分布规则验算
Actor 表现输入边界验算
P-Phone 数据入口边界验算
```

当前准确阶段是：

```txt
M11｜核心资源库 / 验算库深化
```

后续路线：

```txt
UI 自动生成输入边界验算
→ 核心资源库 / 验算库 closeout
→ 正式画图算法重整
→ 端游式 /world 主世界恢复
→ MVP closeout
```

---

## 3. 当前业务核心

AI-PET-WORLD 当前业务核心是：

```txt
AI 世界
AI 管家
世界规则
层级划分
运行算法
世界资源
UI 自动生成算法
P-Phone 通信入口
```

当前工程重点不是扩功能，而是把世界事实链路、管家自主行为链路、资源与空间算法、WorldViewModel、验算库和未来 UI 自动生成输入边界打稳。

---

## 4. M11 验收整理完成记录

| 验收项 | 当前口径 | 状态 |
|---|---|---|
| `/world` cleared 状态 | 正式主页保持清空，不恢复旧画布或网页卡片主页 | 已通过本地 smoke |
| 旧主页卡片移除 | 不恢复当前记录卡片、管家说明卡片、P-Phone 卡片、顶部说明卡 | 已通过本地 smoke |
| Debug Composer 定位 | `/world-debug/pixel-scene-composer` 只作为 Debug 视觉参考库 | 已锁定口径 |
| create-world 路径 | `/create-world` → runtime save → `/world` 可验收 | 已通过 npm smoke；smoke 运行后会恢复 runtime save |
| M7 闭环 | 管家行为 → 验证 → 痕迹 → 记忆种子 → 解释链路不被破坏 | 已通过本地 smoke |
| WorldViewModel 主链路 | 正式表现模型主链路继续存在，但当前不恢复画面 | 已通过本地 smoke |
| Actor 表现输入边界 | 当前只显示管家 actor；未验证 pet placement 不显示；未来 pet entry 必须带正式验证标签 | 已通过 npm smoke |
| P-Phone 数据入口边界 | P-Phone 只读正式模型；不暴露后台词；不恢复旧 P-Phone 卡片；不推进 runtime | 已通过 npm smoke |
| smoke 注册情况 | M11 / M7 / WorldViewModel smoke 已注册为 npm 命令 | 已整理 |
| Debug 地址用途 | 明确 Debug 页面用途，不进入正式 `/world` | 已整理 |
| 源码历史错误口径清理 | 旧生命周期 token 扫描已清空 | 已完成 |
| 旧页面运行链路隔离 | 旧 `/world` hook 不再推进 tick、不再读写旧 snapshot、不再 offline catchup | 已完成 |
| 旧 worldEngine 隔离 | 保留导出名但 inert 化，不再运行旧 PetSystem / old tick | 已完成 |
| 旧 world-engine gateway 收窄 | 不再公开旧完整 tick 与旧 pet runner 入口 | 已完成 |
| 旧完整 world tick runner 隔离 | 即使误 import `runWorldTick` 也不再触发旧 pet runtime / cognition / opportunity 链 | 已完成 |
| PetSystem 当前主链路隔离 | 当前搜索无源码可触发入口 | 已完成 |
| 文档错误口径清理 | Handoff 与模块进度表已收口；旧口径补扫无明显错误命中 | 已完成 |

---

## 5. 核心资源库 / 验算库当前完成范围

| 验算对象 | 验算目标 | 当前口径 |
|---|---|---|
| WorldRuntimeSaveRecord | runtime save 存在、version / worldId / ownerId / tick 基础字段正确 | 已验收 |
| HomeMapState | mapSize / zones / placements / constructionPlans / mapDiffs 可读 | 已验收 |
| SpaceGrid / canvas | columns × rows × tileSize 映射到 WorldViewModel canvas | 已验收 |
| SpaceCell 坐标 | id / row / column / x / y / coordinate 稳定映射 | 已验收 |
| SpaceCell 类型 | regionKind / terrainKind / passability / traceLevel / occupancyKind 合法 | 已验收 |
| SpaceCell passability | passable 布尔值、blocked movementCost、非 blocked cost 范围 | 已验收 |
| SpaceGrid summary | regionCounts / terrainCounts / occupancyCounts / passable / blocked / restricted 计数 | 已验收 |
| TraceField | traces 作为痕迹投影来源 | 已验收 |
| TraceMemorySeedField | 记忆种子字段存在 | 已验收 |
| TraceInfluenceSummary | 痕迹影响摘要存在 | 已验收 |
| WorldViewModel tiles | tile 数量等于 columns × rows，并一一映射 SpaceCell | 已验收 |
| WorldViewModel tile traceIntensity | traceIntensity 来自 SpaceCell traceStrength / traceInfluenceStrength | 已验收 |
| WorldViewModel objects | world_fact 与 derived_visual_only 分离 | 已验收 |
| derived_visual_only | 必须带 `not_world_fact` 与 `no_runtime_write` | 已验收 |
| 生态对象来源 | 生态对象只能作为视觉派生或 HomeMapState 事实映射出现 | 已验收 |
| 生态对象分布 | 派生生态对象必须落在合法 SpaceCell，不能落在无效或占用单元 | 已验收 |
| 生态对象标签 | 派生生态对象必须带 `rule_asset_projection`、`region_*`、`terrain_*`，且不得写回 HomeMapState | 已验收 |
| WorldViewModel actors 基础存在性 | 当前必须有且只有可见管家 actor | 已验收 |
| Actor 输入边界 | 未验证 pet placement 被拦截；正式未来 pet entry 需要 `formal_life_entry_validated / pet_world_entry_validated / actor_input_boundary_validated` | 已验收 |
| P-Phone 输入边界 | 只读 `WorldViewModel.pPhone`；用户文案不暴露 HomeMapState / SafeApply / TraceField / AuditSummary / WorldViewModel 等后台词；正式 `/world` 不恢复旧 P-Phone 卡片 | 已验收 |
| formal `/world` path | 不引用 Debug Composer / SVG / procedural renderer | 已验收 |

---

## 6. 旧运行链路隔离记录

当前已完成以下隔离：

```txt
src/app/world/hooks/useWorldEngineState.ts
→ inert placeholder
→ 不再 import worldEngine
→ 不再 setInterval 推进 tick
→ 不再读写旧 snapshot
→ 不再 offline catchup

src/engine/worldEngine.ts
→ legacy inert facade
→ 保留导出名
→ 不再 new PetSystem
→ 不再 runWorldTick
→ getPet 固定 null
→ getWorldRuntime 固定 null

src/systems/systems-gateway.ts
→ 不再公开 PetSystem
→ 不再公开 FoodOfferDecision

src/engine/world-engine/world-engine-gateway.ts
→ 不再公开旧完整 runWorldTick
→ 不再公开 refreshWorldSystemState
→ 不再公开 runManagementInteractions
→ 不再公开 runPetRuntime
→ 不再公开 runPetCognition
→ 不再公开 runButlerOpportunities

src/engine/world-engine/runners/world-tick-runner.ts
→ inert placeholder
→ 不再 import PetSystem
→ 不再 import runPetRuntime
→ 不再 import runPetCognition
→ 不再 import runButlerOpportunities
→ 不再执行旧完整 world tick
```

当前搜索结果：

```txt
PetSystem / petSystem / runPetRuntime / runPetCognition / runButlerOpportunities
→ 无源码可触发入口命中
```

说明：这不是删除未来生命能力，而是切断当前 M11 主链路中旧运行入口，避免旧页面、旧 tick、旧 PetSystem 链路被误恢复。

---

## 7. 下一批核心验算细项

下一步继续补齐，不恢复 `/world` 画面：

```txt
UI 自动生成输入边界验算
核心资源库 / 验算库 closeout
```

---

## 8. 当前 smoke / 验收命令整理

### 基础验收

```powershell
git pull
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:m11-core-resource-validation
npm run smoke:m11-create-world-flow
npm run smoke:m11-core-resource-validation
npm run smoke:m11-actor-input-boundary
npm run smoke:m11-p-phone-input-boundary
```

### 全量回归

```powershell
npm run smoke:m11-formal-surface
npm run smoke:m11-core-resource-validation
npm run smoke:m11-create-world-flow
npm run smoke:m11-core-resource-validation
npm run smoke:m11-actor-input-boundary
npm run smoke:m11-p-phone-input-boundary
npm run smoke:m7-closeout
npm run smoke:m7-explanation
npm run smoke:m7-audit-summary
npm run smoke:butler-trace-closure
npm run smoke:world-pixel-viewmodel-primary
```

### 已注册在 `package.json` 的 M11 smoke

```powershell
npm run smoke:m11-formal-surface
npm run smoke:m11-core-resource-validation
npm run smoke:m11-create-world-flow
npm run smoke:m11-actor-input-boundary
npm run smoke:m11-p-phone-input-boundary
```

### 已注册在 `package.json` 的 M7 / WorldViewModel smoke

```powershell
npm run smoke:m7-closeout
npm run smoke:m7-explanation
npm run smoke:m7-audit-summary
npm run smoke:butler-trace-closure
npm run smoke:world-pixel-viewmodel-primary
```

---

## 9. Debug 地址和用途

| 地址 | 用途 | 边界 |
|---|---|---|
| `/create-world` | MVP 创建世界入口 | 允许进入正式 runtime save 路径；smoke 会恢复本地 runtime save |
| `/world` | 正式主世界入口 | 当前必须保持 cleared，不恢复旧画面或网页卡片主页 |
| `/personality-test` | 命理 / 人格调试页 | 允许显示内部调试信息 |
| `/world-debug` | 世界 Debug 入口 | 只服务开发验证；当前不再接旧 worldEngine hook |
| `/world-debug/mapdiff` | MapDiff 调试 | 不进入正式 `/world` |
| `/world-debug/pixel-scene-composer` | Debug 视觉参考库 / 像素组合预览实验室 | 不是核心资源库、正式算法库或正式验算库 |
| `/world-debug/procedural-renderer` | 旧实验 / 调试 | 不得搬进正式 `/world` |
| `/world-debug/proposal-audit` | Proposal / audit 调试 | 不得暴露到正式 UI |
| `/world-debug/tree-render-test` | 树渲染测试 | 仅作调试 |
| `/world-debug/visual-change-verification` | 视觉变化验证 | 仅作调试 |

---

## 10. WORLD-PIXEL-RULE-MAPPER-00 完成内容

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
- smoke 已守卫 runtime 不写入、tick 不推进
- Actor 表现输入边界已守卫：未验证 pet placement 不进入 actors，未来 pet entry 必须经过正式验证标签
- P-Phone 数据入口边界已守卫：只读正式模型、不暴露后台词、不恢复旧 P-Phone 卡片

注意：以上是正式表现模型主链路能力，不代表当前 `/world` 已恢复正式像素画面。当前 `/world` 必须继续保持 cleared，直到后续正式画图算法重整完成并通过验收。

---

## 11. M7 管家行为 → 痕迹闭环完成内容

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
- `smoke:m7-explanation` 已新增，并守卫 audit-summary-first 解释路径与 P-Phone 用户可见边界
- `smoke:m7-audit-summary` 已新增
- `smoke:m7-closeout` 已新增
- `observe_world / wait_for_resources` 不写 HomeMapState diff，但允许留下验证后的行为痕迹
- `continue_construction / maintain_home` 仍必须通过 SafeApply 才能写 HomeMapState diff
- 正式 `/world` 不回退 SVG / Scene Composer / Debug 主链路

---

## 12. M11 / 当前阶段禁止事项

- 不做 M8 / M9 / M10。
- 不做宠物学习。
- 不做小镇 / 公园 / 医院正式运行。
- 不做多用户正式运行。
- 不恢复网页卡片主页。
- 不恢复旧 `/world` 画面。
- 不把 Debug Composer 搬进 `/world`。
- 不把 Debug Composer 叫成核心资源库。
- 不把 Scene Composer 当正式画图算法。
- 不恢复历史旧生命入口路线。
- 不恢复 road/path 正式架构。
- 不让页面访问推进 runtime tick。
- 不让 `derived_visual_only` 写入 HomeMapState。
- 不暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词到正式 UI。
