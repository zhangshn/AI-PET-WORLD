# AI-PET-WORLD V2.6｜M11 当前交接文档

> 本文档只记录当前项目真实状态与下一步工作边界。
> 当前业务核心是 AI 世界、AI 管家、世界规则、层级划分、运行算法、世界资源与 UI 自动生成算法。
> 后续工作必须以当前仓库与当前文档为准，不再引用历史讨论中的旧路线。

---

## 0. 当前一句话结论

AI-PET-WORLD 当前处于：

```txt
M11｜核心资源库 / 验算库深化 + 历史错误口径清理阶段
```

当前不是新功能开发，不是恢复 `/world` 画面，不是网页卡片主页整理，也不是进入 M8 / M9 / M10。

当前优先级是：

```txt
清理历史错误口径
→ 锁定当前业务原则
→ 补齐核心资源库 / 验算库
→ closeout
→ 正式画图算法重整
→ 端游式 /world 主世界恢复
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

---

## 2. 当前模块进度

| 模块 | 状态 | 说明 |
|---|---|---|
| M1 移动痕迹契约迁移 | 完成 | road/path 不再是正式架构，长期移动结果归入痕迹体系 |
| M2 世界空间底座 v0 | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 完成 | TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 完成但降级为 Debug 参考 | 只能作为 Debug 视觉参考库，不能作为正式资源库、算法库或验算库 |
| M5 痕迹视觉表现 v0 | 完成 | pressed_grass / worn_grass / exposed_soil 等视觉概念已存在 |
| M6 生态对象规则深化 | 完成 | 自然对象派生规则有基础，正式画图算法仍需后续重整 |
| M6.5 legacy 命名清理 | 完成 | road/path 正式口径已清理 |
| WORLD-PIXEL-RULE-MAPPER-00 | 完成 | WorldRuntimeSaveRecord / HomeMapState / SpaceGrid / TraceField / ButlerState → WorldViewModel 主链路已建立 |
| M7 管家行为 → 痕迹闭环 | 完成 | 管家动机、意图、验证、痕迹、记忆种子、审计摘要、解释链路完成 |
| M11 主页清空 | 完成 | `/world` 保持 cleared；旧画布、旧网页卡片、旧说明卡已从正式主页移除 |
| M11 验收整理 | 完成 | smoke、Debug 边界、create-world 路径、M7 回归、WorldViewModel 主链路已完成验收 |
| M11 历史错误口径清理 | 进行中 | 源码旧生命周期扫描已清空，正在清理 docs 错误描述 |
| M11 核心资源库 / 验算库 | 进行中 | Runtime / HomeMapState / SpaceGrid / SpaceCell / TraceField / WorldViewModel / 生态对象已验收 |
| M11 正式画图算法重整 | 后续 | 验算库 closeout 后再开始 |
| M12 构建与质量验收 | 持续 | 每个阶段后必须 lint / tsc / build / 对应 smoke |

---

## 3. `/world` 当前边界

`/world` 当前必须保持 cleared 状态。

清空原因：

- 旧主页画图结果不符合正式主世界方向。
- 旧网页卡片布局不是未来产品形态。
- 当前不能把 Debug 视觉参考库搬到正式主页。
- 正式画图算法必须等核心资源库 / 验算库 closeout 后重整。

未来 `/world` 目标是端游式像素主世界，不是网页卡片页。

---

## 4. Debug Composer 边界

`/world-debug/pixel-scene-composer` 只允许作为：

```txt
Debug 视觉参考库
像素组合预览实验室
visual reference only
```

它不是：

```txt
核心资源库
正式算法库
正式验算库
正式 /world 渲染来源
```

它不能写 runtime save，不能推进 runtime tick，不能替代 WorldViewModel，不能进入正式 `/world`。

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
→ 后续正式像素渲染算法
```

页面读取不得推进 runtime tick。

UI 不得生成世界事实。

`derived_visual_only` 只能作为只读视觉派生，不得写回 HomeMapState。

---

## 6. 核心资源库 / 验算库当前完成范围

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
| formal `/world` Debug 隔离 | 已验收 |

下一步验算不恢复 UI，只补输入边界：

```txt
Actor 表现输入边界
P-Phone 数据入口边界
UI 自动生成输入边界
create-world smoke npm 注册
核心资源库 / 验算库 closeout
```

---

## 7. 当前 smoke / 验收命令

### 基础验收

```powershell
git pull
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:m11-core-resource-validation
```

### 全量回归

```powershell
npm run smoke:m11-formal-surface
npm run smoke:m11-core-resource-validation
node scripts/run-world-m11-create-world-flow-smoke.cjs
npm run smoke:m7-closeout
npm run smoke:m7-explanation
npm run smoke:m7-audit-summary
npm run smoke:butler-trace-closure
npm run smoke:world-pixel-viewmodel-primary
```

---

## 8. Debug 地址和用途

| 地址 | 用途 | 边界 |
|---|---|---|
| `/create-world` | MVP 创建世界入口 | 允许进入正式 runtime save 路径 |
| `/world` | 正式主世界入口 | 当前保持 cleared，不恢复旧画面或网页卡片主页 |
| `/personality-test` | 命理 / 人格调试页 | 允许显示内部调试信息 |
| `/world-debug` | 世界 Debug 入口 | 只服务开发验证 |
| `/world-debug/mapdiff` | MapDiff 调试 | 不进入正式 `/world` |
| `/world-debug/pixel-scene-composer` | Debug 视觉参考库 / 像素组合预览实验室 | 不是核心资源库、正式算法库或正式验算库 |
| `/world-debug/procedural-renderer` | 旧实验 / 调试 | 不得搬进正式 `/world` |
| `/world-debug/proposal-audit` | Proposal / audit 调试 | 不得暴露到正式 UI |
| `/world-debug/tree-render-test` | 树渲染测试 | 仅作调试 |
| `/world-debug/visual-change-verification` | 视觉变化验证 | 仅作调试 |

---

## 9. 当前阶段禁止事项

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

---

## 10. 下一步计划

```txt
1. 完成 docs 错误口径清理。
2. 在聊天中确认当前业务逻辑，不直接写项目。
3. 经确认后写入新的当前业务原则文档。
4. 回到核心资源库 / 验算库：补 Actor / P-Phone / UI 自动生成输入验算。
5. 注册 create-world smoke npm 命令。
6. 完成核心资源库 / 验算库 closeout。
7. 开始正式画图算法重整。
8. 恢复端游式 /world 主世界。
9. MVP closeout。
```
