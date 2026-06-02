# AI-PET-WORLD V2.6｜M11 当前交接文档

> 状态说明（2026-06-02）：本文保留为 M11 closeout 历史交接记录。仓库当前已经继续向前推进：`/world` 已接入只读 PixiJS PixelWorldView，不再处于 cleared 状态。当前准确状态请先读 `AI_PET_WORLD_V2_6_PROJECT_AUDIT_2026_06_02.md` 与 `AI_PET_WORLD_V2_6_MODULE_PROGRESS.md`。
>
> 本文档只记录当前项目真实状态与下一步工作边界。
> 当前业务核心是 AI 世界、AI 管家、世界规则、层级划分、运行算法、世界资源与 UI 自动生成算法。
> 后续工作必须以当前仓库与当前文档为准，不再引用历史讨论中的旧路线。

---

## 0. 当前一句话结论

AI-PET-WORLD 当前处于：

```txt
M11｜核心资源库 / 验算库 closeout 已完成，视觉算法 Debug 已合并，准备进入正式画图算法重整
```

当前不是恢复旧 `/world` 画面，不是网页卡片主页整理，也不是进入 M8 / M9 / M10。

当前优先级是：

```txt
正式画图算法重整
→ 端游式 /world 主世界恢复
→ MVP closeout
```

正式画图算法重整方案已写入：

```txt
docs/v2_6/AI_PET_WORLD_V2_6_FORMAL_PIXEL_RENDERER_REWORK_PLAN.md
```

---

## 1. 当前业务核心

AI-PET-WORLD 的核心不是传统养成游戏，也不是网页功能集合。

当前业务核心是：

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

我们当前要建设的是一个能自主运行、能被验算、能被正式渲染的 AI 世界底座。

用户创建的是世界。管家是世界里的核心自主行动者。系统工程重点是让世界事实、空间、资源、痕迹、管家行为和未来 UI 自动生成算法形成稳定闭环。

当前业务原则已写入：

```txt
docs/v2_6/AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md
```

---

## 2. 当前模块进度

| 模块 | 状态 | 说明 |
|---|---|---|
| M1 移动痕迹契约迁移 | 完成 | road/path 不再是正式架构，长期移动结果归入痕迹体系 |
| M2 世界空间底座 v0 | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 完成 | TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 完成但降级为视觉参考 | 视觉参考能力已统一收口到 `/world-debug/pixel-visual-lab`，不是正式资源库、算法库或验算库 |
| M5 痕迹视觉表现 v0 | 完成 | pressed_grass / worn_grass / exposed_soil 等视觉概念已存在 |
| M6 生态对象规则深化 | 完成 | 自然对象派生规则有基础，正式画图算法仍需后续重整 |
| M6.5 legacy 命名清理 | 完成 | road/path 正式口径已清理 |
| WORLD-PIXEL-RULE-MAPPER-00 | 完成 | WorldRuntimeSaveRecord / HomeMapState / SpaceGrid / TraceField / ButlerState → WorldViewModel 主链路已建立 |
| M7 管家行为 → 痕迹闭环 | 完成 | 管家动机、意图、验证、痕迹、记忆种子、审计摘要、解释链路完成 |
| M11 主页清空 | 完成 | `/world` 保持 cleared；旧画布、旧网页卡片、旧说明卡已从正式主页移除 |
| M11 验收整理 | 完成 | smoke、Debug 边界、create-world 路径、M7 回归、WorldViewModel 主链路已完成验收 |
| M11 源码历史错误口径清理 | 完成 | 旧生命周期 token 扫描已清空 |
| M11 旧页面运行链路隔离 | 完成 | `useWorldEngineState.ts` 已 inert 化，页面不再通过旧 hook 推进 tick / snapshot / offline catchup |
| M11 旧 worldEngine 隔离 | 完成 | `src/engine/worldEngine.ts` 已变成 legacy inert facade，不再实例化 PetSystem，不再运行 old tick |
| M11 旧 world-engine gateway 收窄 | 完成 | 不再公开旧完整 tick、旧 pet runtime、旧 pet cognition、旧 butler opportunity runner |
| M11 旧完整 world tick runner 隔离 | 完成 | `world-tick-runner.ts` 已 inert 化，即使误 import 也不会触发旧 pet runtime / cognition / opportunity 链 |
| M11 PetSystem 当前主链路隔离 | 完成 | `PetSystem / petSystem / runPetRuntime / runPetCognition / runButlerOpportunities` 当前无源码可触发入口 |
| M11 create-world flow smoke 注册 | 完成 | `smoke:m11-create-world-flow` 已注册，并已修复运行后恢复 runtime save 的副作用 |
| M11 文档错误口径清理 | 完成 | Handoff 与模块进度表已收口；旧口径补扫无明显错误命中 |
| M11 当前业务原则文档 | 完成 | 当前业务原则文档已新增，锁定 AI 世界 / AI 管家 / P-Phone / 非默认宠物等当前业务原则 |
| M11 Actor 表现输入边界验算 | 完成 | `smoke:m11-actor-input-boundary` 已注册并通过；未验证 pet placement 不进入 actors，未来 pet entry 需要正式验证标签 |
| M11 P-Phone 数据入口边界验算 | 完成 | `smoke:m11-p-phone-input-boundary` 已注册并通过；P-Phone 只读正式模型、不暴露后台词、不恢复旧卡片 |
| M11 UI 自动生成输入边界验算 | 完成 | `smoke:m11-ui-auto-generation-input-boundary` 已注册并通过；正式 UI 只读 WorldViewModel、不生成世界事实、不恢复旧卡片、不触发 runtime 写入 |
| M11 核心资源库 / 验算库 closeout | 完成 | `smoke:m11-core-resource-closeout` 已注册并通过；核心资源、WorldViewModel、Actor、P-Phone、UI 输入边界、正式 `/world` cleared 边界已完成总验收 |
| M11 视觉算法 Debug 合并 | 完成 | 旧 `pixel-scene-composer` 与 `tree-render-test` 独立页面已删除，只保留 `/world-debug/pixel-visual-lab` |
| M11 正式画图算法重整 | 下一步 | 方案文档已建立，下一步开始 formal-pixel-renderer schema / gateway |
| M12 构建与质量验收 | 持续 | 每个阶段后必须 lint / tsc / build / 对应 smoke |

---

## 3. `/world` 当前边界

`/world` 当前必须保持 cleared 状态。

清空原因：

- 旧主页画图结果不符合正式主世界方向。
- 旧网页卡片布局不是未来产品形态。
- 当前不能把视觉 Debug 测试台搬到正式主页。
- 正式画图算法必须建立 formal-pixel-renderer，并通过 smoke 后才能接入 `/world`。

未来 `/world` 目标是端游式像素主世界，不是网页卡片页。

---

## 4. 视觉算法 Debug 边界

当前唯一视觉算法 Debug 页面是：

```txt
/world-debug/pixel-visual-lab
```

它只允许作为：

```txt
视觉算法测试台
场景组合预览
树木绘制预览
后台视觉算法接线验证
```

它不是：

```txt
核心资源库
正式算法库
正式验算库
正式 /world 渲染来源
```

它不能写 runtime save，不能推进 runtime tick，不能替代 WorldViewModel，不能进入正式 `/world`。

已删除的旧视觉 Debug 独立页面：

```txt
/world-debug/pixel-scene-composer
/world-debug/tree-render-test
```

---

## 5. 正式主链路

当前正式链路是：

```txt
create-world input
→ runtime save
→ HomeMapState
→ SpaceGrid / SpaceCell / SpaceRegion
→ TraceField / TraceMemorySeedField / TraceInfluenceSummary
→ ButlerRuntimeDecision / ButlerRuntimeIntent / ButlerWorldRuleValidation
→ ButlerRuntimeAuditSummary
→ WorldViewModel
→ formal-pixel-renderer
→ 后续正式像素主世界
```

页面读取不得推进 runtime tick。

UI 不得生成世界事实。

`derived_visual_only` 只能作为只读视觉派生，不得写回 HomeMapState。

Actor 表现输入必须来自 WorldViewModel，不得由 UI 或 Debug 页面自行生成。

当前只允许管家 actor 作为可见正式 actor。未来 pet actor 必须经过正式入场验证标签后才能进入表现层。

P-Phone 数据入口必须来自正式 `WorldViewModel.pPhone` 投影，不得由正式 UI 自行拼接后台调试数据。

P-Phone 可以解释世界规则验证、家园事实、正式写入边界、痕迹和记忆种子，但不得暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词。

正式画图算法唯一输入必须是 WorldViewModel。

正式画图算法不得直接读写 runtime，不得生成世界事实，不得恢复旧网页卡片或 Debug 来源。

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

## 7. 核心资源库 / 验算库完成范围

| 验算对象 | 当前结果 |
|---|---|
| WorldRuntimeSaveRecord | 已验收 |
| HomeMapState | 已验收 |
| SpaceGrid / canvas | 已验收 |
| SpaceCell 坐标 | 已验收 |
| SpaceCell 类型 | 已验收 |
| SpaceCell passability / movementCost | 已验收 |
| SpaceGrid summary | 已验收 |
| TraceField | 已验收 |
| TraceMemorySeedField | 已验收 |
| TraceInfluenceSummary | 已验收 |
| WorldViewModel tiles | 已验收 |
| WorldViewModel tile traceIntensity | 已验收 |
| WorldViewModel objects | 已验收 |
| derived_visual_only 只读边界 | 已验收 |
| 生态对象来源与分布规则 | 已验收 |
| WorldViewModel actors 基础存在性 | 已验收 |
| Actor 表现输入边界 | 已验收 |
| P-Phone 数据入口边界 | 已验收 |
| UI 自动生成输入边界 | 已验收 |
| 视觉算法 Debug 合并 | 已验收 |
| formal `/world` Debug 隔离 | 已验收 |
| M11 closeout 总验收 | 已验收 |

Actor 表现输入边界当前结论：

```txt
当前只显示管家 actor。
未验证 pet placement 不进入 WorldViewModel actors。
未来 pet entry 必须经过正式验证标签。
Actor 投影只读，不写 runtime save / HomeMapState。
```

P-Phone 数据入口边界当前结论：

```txt
P-Phone 只读正式模型。
P-Phone 不暴露后台词。
P-Phone 不恢复旧卡片。
P-Phone 投影只读，不推进 runtime tick，不写 runtime save / HomeMapState。
```

UI 自动生成输入边界当前结论：

```txt
正式 /world 只把 WorldViewModel 传给 PixelWorldView。
PixelWorldView 当前保持 cleared。
未来 UI 不得直接读写 runtime。
未来 UI 不得生成世界事实。
未来 UI 不得恢复旧卡片或 Debug 来源。
```

视觉算法 Debug 合并当前结论：

```txt
只保留 /world-debug/pixel-visual-lab。
旧 /world-debug/pixel-scene-composer 已删除。
旧 /world-debug/tree-render-test 已删除。
视觉算法 Debug 不读 runtime、不写世界事实、不推进 Tick。
```

下一步不恢复 UI，先建立正式画图算法基础：

```txt
formal-pixel-renderer schema / gateway
```

---

## 8. 当前 smoke / 验收命令

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
npm run smoke:m11-ui-auto-generation-input-boundary
npm run smoke:m11-core-resource-closeout
npm run smoke:world-debug-pixel-visual-lab
```

### 全量回归

```powershell
npm run smoke:m11-formal-surface
npm run smoke:m11-core-resource-validation
npm run smoke:m11-create-world-flow
npm run smoke:m11-core-resource-validation
npm run smoke:m11-actor-input-boundary
npm run smoke:m11-p-phone-input-boundary
npm run smoke:m11-ui-auto-generation-input-boundary
npm run smoke:m11-core-resource-closeout
npm run smoke:world-debug-pixel-visual-lab
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
| `/world` | 正式主世界入口 | 当前保持 cleared，不恢复旧画面或网页卡片主页 |
| `/personality-test` | 命理 / 人格调试页 | 允许显示内部调试信息 |
| `/world-debug` | 世界 Debug 入口 | 只服务开发验证；当前不再接旧 worldEngine hook |
| `/world-debug/mapdiff` | MapDiff 调试 | 不进入正式 `/world` |
| `/world-debug/pixel-visual-lab` | 唯一视觉算法 Debug 测试台 | 合并场景组合与树木绘制；不读 runtime、不写世界事实、不推进 Tick、不进入正式 `/world` |
| `/world-debug/procedural-renderer` | 旧实验 / 调试 | 不得搬进正式 `/world` |
| `/world-debug/proposal-audit` | Proposal / audit 调试 | 不得暴露到正式 UI |
| `/world-debug/visual-change-verification` | 视觉变化验证 | 仅作调试 |

---

## 10. 当前阶段禁止事项

- 不做 M8 / M9 / M10。
- 不做宠物学习。
- 不做小镇 / 公园 / 医院正式运行。
- 不做多用户正式运行。
- 不恢复网页卡片主页。
- 不恢复旧 `/world` 画面。
- 不把视觉算法 Debug 页面搬进 `/world`。
- 不把视觉算法 Debug 页面叫成核心资源库。
- 不把 Scene Composer 当正式画图算法。
- 不恢复历史旧生命入口路线。
- 不恢复 road/path 正式架构。
- 不让页面访问推进 runtime tick。
- 不让 `derived_visual_only` 写入 HomeMapState。
- 不暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词到正式 UI。

---

## 11. 下一步计划

```txt
1. 新建 formal-pixel-renderer schema。
2. 新建 formal-pixel-renderer gateway。
3. 建立 Tile / Trace / Object / Actor / Atmosphere 五层 render model。
4. 增加 formal renderer contract smoke。
5. 增加 formal renderer readonly smoke。
6. 继续保持 /world cleared，直到正式 renderer 通过验收。
7. 恢复端游式 /world 主世界。
8. MVP closeout。
```
