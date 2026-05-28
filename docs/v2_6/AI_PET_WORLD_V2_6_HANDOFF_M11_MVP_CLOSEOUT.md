# AI-PET-WORLD V2.6｜M11 / MVP 收口交接文档

> 新聊天窗口必须先阅读本文档，再继续工作。本文档用于防止新窗口把 Debug 视觉参考库、正式画图算法、核心验算库、主页 UI 和未来端游形态混在一起。

---

## 0. 当前一句话结论

当前项目已经完成底层自主世界闭环与 M7 管家行为 → 痕迹闭环。现在进入 M11：MVP 收口与正式主世界体验整理。

但是：`/world` 当前已经被刻意清空，因为旧主页画图结果与卡片布局方向不对。下一步不是继续修卡片，也不是马上恢复画面，而是先整理正式画图算法与核心资源库 / 验算库边界。

---

## 1. 当前模块进度

| 模块 | 状态 | 说明 |
|---|---|---|
| M1 移动痕迹契约迁移 | 完成 | road/path 不再是正式架构，长期移动结果归入痕迹体系 |
| M2 世界空间底座 v0 | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 完成 | TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 完成但降级为 Debug 参考 | 不能再被当作正式核心算法 |
| M5 痕迹视觉表现 v0 | 完成 | pressed_grass / worn_grass / exposed_soil 等视觉概念已存在 |
| M6 生态对象规则深化 | 完成 | 自然对象派生规则有基础，但正式画图算法还要重整 |
| M6.5 legacy 命名清理 | 完成 | road/path 正式口径已清理 |
| WORLD-PIXEL-RULE-MAPPER-00 | 完成 | 正式 WorldViewModel 主链路已建立，但当前视觉输出不作为最终主页效果 |
| M7 管家行为 → 痕迹闭环 | 完成 | 管家动机、意图、验证、痕迹、记忆种子、审计摘要、解释链路完成 |
| M8 管家记忆与学习 | 后置 | MVP 阶段不做 |
| M9 世界学习 v0 | 后置 | MVP 阶段不做 |
| M10 宠物学习预留 | 后置 | MVP 阶段不做 |
| M11 主世界正式体验整理 | 当前阶段 | 主页已清空；下一步是正式画图算法与核心验算库边界整理 |

---

## 2. 当前最重要的事实

### 2.1 `/world` 已经清空

`/world` 现在不应该展示旧画布、当前记录卡片、管家说明卡片、P-Phone 卡片。

清空原因：

- 旧主页画图算法/布局出现右侧大片空白。
- 当前视觉不是正式主世界目标。
- 卡片式网页布局不是未来方向。
- 错误画面不能继续作为 MVP 正式入口。

当前 `/world` 应保持 cleared 状态，直到正式画图算法重新定义并通过验收。

### 2.2 未来不是网页卡片页

未来目标是端游 / Steam / 桌面游戏式体验，不是网页信息卡片页。

Web 只是当前 MVP 的最快技术载体，不代表最终产品形态。

正式主世界应是：

```txt
沉浸式像素世界
全屏或近全屏主画面
轻量 HUD / 浮层 / 角落状态
无网页卡片堆叠
无 Debug 面板
无工程字段
```

禁止继续围绕“顶部说明 + 右上状态卡 + 底部两张说明卡”做设计。这些卡片未来不要。

---

## 3. 三套东西必须分开，不能混

### 3.1 正式自主世界生成算法

正式世界生成算法负责世界事实和运行逻辑，不负责 Debug 视觉展示。

核心输入/事实：

```txt
WorldRuntimeSaveRecord
HomeMapState
SpaceGrid
SpaceRegion / SpaceCell
TraceField
TraceMemorySeedField
TraceInfluenceSummary
ButlerRuntimeDecision
ButlerRuntimeIntent
ButlerWorldRuleValidation
ButlerRuntimeAuditSummary
```

正式链路：

```txt
create-world input
→ runtime save
→ HomeMapState
→ SpaceGrid
→ TraceField
→ WorldViewModel
→ PixelWorldView
```

红线：

- 不默认生成宠物。
- 不允许 Debug 参数写入 runtime。
- 不允许 Scene Composer 直接替代正式世界生成。
- 不允许 road/path 重新成为正式架构。
- 长期移动和空间使用结果只能进入痕迹体系。

### 3.2 正式画图算法

正式画图算法是：把正式世界事实转换成用户能看到的像素世界。

正式画图不能直接搬 `/world-debug/pixel-scene-composer`。

正式画图应该遵守：

```txt
HomeMapState / SpaceGrid / TraceField / WorldViewModel 作为事实来源
PixelWorldView 只读 WorldViewModel
derived_visual_only 只能作为只读视觉派生
not_world_fact / no_runtime_write 必须明确
最终呈现要接近沉浸式像素森林/家园，而不是工程预览框
```

正式画图下一步要重新整理：

```txt
1. viewport / camera / cover 展示策略
2. 坐标定位规则
3. 自然对象密度规则
4. 树、草、石头、花、蘑菇、小生态信号的分布规则
5. 痕迹视觉如何覆盖 tile
6. actor 如何轻量可见
7. 不显示网页卡片，只保留端游式 HUD 方向
```

### 3.3 Debug 视觉参考库

`/world-debug/pixel-scene-composer` 当前只允许是：

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

当前页面已经改成“视觉参考”口径。它可以用来观察：

- tile 视觉效果
- trace 视觉效果
- tree / bush / stone / flower / mushroom / grass_tuft 等对象观感
- atmosphere 观感
- UI overlay 参考

但它不验证世界事实是否正确，不写 runtime save，不推进 runtime tick，不替代 `/world`。

---

## 4. 核心资源库 / 核心验算库：还没有正式建立

下一步必须建立真正的核心资源库 / 验算库。

它的定位不是看图好不好看，而是验证正式算法输出是否正确。

它未来要验证：

```txt
SpaceGrid 是否正确
SpaceCell terrainKind / regionKind / traceStrength 是否正确
HomeMapState placements 是否正确
TraceField 是否正确
TraceMemorySeedField 是否正确
WorldViewModel tiles / objects / traces / actors 是否正确
derived_visual_only 是否只读
not_world_fact / no_runtime_write 是否齐全
默认宠物是否没有出现
坐标定位是否正确
生态对象是否按正式规则生成
```

核心验算库应该服务于正式算法，不服务于 Debug composer。

建议下一步新增文档：

```txt
docs/v2_6/AI_PET_WORLD_V2_6_FORMAL_CORE_RESOURCE_VALIDATION_LIBRARY.md
```

建议后续新增 smoke：

```txt
smoke:m11-core-resource-validation
```

---

## 5. `/world-debug/pixel-scene-composer` 当前定位

地址：

```txt
http://localhost:3000/world-debug/pixel-scene-composer
```

当前定位：

```txt
Debug 视觉参考库 / 像素组合预览实验室
```

允许：

- 看视觉组合效果。
- 看树、草、石头、花、痕迹、tile 的大致观感。
- 作为未来正式画图视觉目标的参考。

禁止：

- 把它当正式核心资源库。
- 把它当正式算法验算库。
- 把里面的参数当正式世界生成参数。
- 把 Debug 页面原样搬进 `/world`。
- 让 Scene Composer 进入正式 WorldViewModel 主链路。

---

## 6. 当前关键文件

### 6.1 正式 `/world` 入口

```txt
src/app/world/page.tsx
src/app/world/world-live-runtime-page.tsx
src/app/world/components/pixel-world-view/pixel-world-view.tsx
src/app/world/components/pixel-world-view/pixel-world-view.module.css
src/app/world/components/pixel-world-view/pixel-world-canvas.client.tsx
```

当前状态：`pixel-world-view.tsx` 已清空正式主页展示，只保留 cleared surface。

### 6.2 WorldViewModel 正式表现模型

```txt
src/world/world-view-model/world-view-model-gateway.ts
src/world/world-view-model/world-view-model-schema.ts
src/world/world-view-model/*mapper*.ts
```

当前状态：正式主链路存在，但画图算法需要重整后再恢复主页展示。

### 6.3 Runtime / M7 管家闭环

```txt
src/world/runtime/world-runtime-gateway.ts
src/world/runtime/world-runtime-tick-runner.ts
src/world/runtime/butler-runtime-intent.ts
src/world/runtime/butler-runtime-trace-closure.ts
src/world/runtime/butler-runtime-audit-summary.ts
```

当前状态：M7 已完成，不要重新设计它。

### 6.4 create-world → runtime save

```txt
src/app/create-world/create-world-route-page.tsx
src/app/api/world/create/route.ts
src/world/runtime/world-runtime-gateway.ts
scripts/run-world-m11-create-world-flow-smoke.cjs
```

当前状态：创建页已经开始接入正式 runtime save。注意：`package.json` 目前尚未注册 `smoke:m11-create-world-flow`，需要用 node 直接跑或补注册。

### 6.5 Debug 视觉参考库

```txt
src/app/world-debug/pixel-scene-composer/pixel-scene-composer-client.tsx
```

当前状态：已经改成 Debug 视觉参考库口径，不是核心资源库。

---

## 7. Debug 地址清单

本地开发地址：

```txt
http://localhost:3000/
http://localhost:3000/create-world
http://localhost:3000/world
http://localhost:3000/personality-test
http://localhost:3000/world-debug
http://localhost:3000/world-debug/mapdiff
http://localhost:3000/world-debug/pixel-scene-composer
http://localhost:3000/world-debug/procedural-renderer
http://localhost:3000/world-debug/proposal-audit
http://localhost:3000/world-debug/tree-render-test
http://localhost:3000/world-debug/visual-change-verification
```

定位说明：

| 地址 | 用途 |
|---|---|
| `/create-world` | MVP 创建世界入口 |
| `/world` | 正式主世界入口；当前已清空，等待正式画图算法重整 |
| `/personality-test` | 命理 / 人格调试页，允许显示内部信息 |
| `/world-debug` | 世界 Debug 入口 |
| `/world-debug/pixel-scene-composer` | Debug 视觉参考库，不是正式算法库 |
| `/world-debug/mapdiff` | MapDiff 调试 |
| `/world-debug/procedural-renderer` | 旧实验/调试，不得搬进正式 `/world` |
| `/world-debug/proposal-audit` | Proposal / audit 调试 |
| `/world-debug/tree-render-test` | 树渲染测试 |
| `/world-debug/visual-change-verification` | 视觉变化验证 |

---

## 8. 当前 smoke / 验收命令

基础验收：

```powershell
git pull
npm run lint
npx tsc --noEmit
npm run build
```

M7 验收：

```powershell
npm run smoke:m7-closeout
npm run smoke:m7-explanation
npm run smoke:m7-audit-summary
npm run smoke:butler-trace-closure
```

WorldViewModel 验收：

```powershell
npm run smoke:world-pixel-viewmodel-primary
```

M11 当前主页清空验收：

```powershell
npm run smoke:m11-formal-surface
```

create-world 正式路径验收：

```powershell
node scripts/run-world-m11-create-world-flow-smoke.cjs
```

注意：`smoke:m11-create-world-flow` 尚未注册进 `package.json`。新窗口继续时可以先补注册，也可以继续用 node 直接跑。

---

## 9. 新窗口下一步建议顺序

不要直接恢复 `/world` 画面。按下面顺序走：

```txt
1. 先跑 lint / tsc / build / smoke:m11-formal-surface，确认清空主页没有破坏主链路。
2. 跑 node scripts/run-world-m11-create-world-flow-smoke.cjs，确认 create-world → runtime save → /world 仍然成立。
3. 把 smoke:m11-create-world-flow 注册进 package.json。
4. 建立正式核心资源库 / 验算库文档。
5. 为核心验算库新增 smoke，验证正式算法输出，不验证 Debug composer 视觉效果。
6. 重新设计正式画图算法：viewport / camera / cover / 坐标定位 / 自然密度 / 痕迹覆盖。
7. 通过 smoke 后，再恢复 `/world` 的正式画面。
8. 恢复画面时必须是端游式主世界，不要回到网页卡片布局。
```

---

## 10. 禁止事项

新窗口绝对不要做：

- 不要把 `/world-debug/pixel-scene-composer` 原样搬到 `/world`。
- 不要把 Debug 视觉参考库叫成核心资源库。
- 不要把 Scene Composer 当正式画图算法。
- 不要继续做网页卡片式主页。
- 不要恢复顶部说明卡、当前记录卡、管家说明卡、P-Phone 卡片。
- 不要默认生成宠物。
- 不要恢复 road/path 正式架构。
- 不要进入 M8 / M9 / M10。
- 不要做小镇、公园、医院、多用户世界。
- 不要让页面访问推进 runtime tick。
- 不要让 derived_visual_only 写入 HomeMapState。
- 不要暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词到正式 UI。

---

## 11. 未来 `/world` 视觉目标

未来 `/world` 应该是：

```txt
像端游一样的像素主世界
画面占满主视觉区域
无右侧大片空白
无网页卡片
轻 HUD / 小浮层 / 角落状态
世界画面优先，说明信息退后
```

画面目标接近：

```txt
沉浸式像素森林 / 像素家园
自然对象密度高
树冠、草、石头、花、蘑菇、小生态信号自然分布
痕迹自然融合在地表
管家小而可见
没有默认宠物
没有道路系统
```

技术方向：

```txt
WorldViewModel 仍是正式表现模型
PixelWorldView 只读 WorldViewModel
后续可以引入 camera / viewport / focus target
Canvas 可以 cover / crop 展示，不强求完整地图全显示
Web MVP 是技术载体，目标体验按端游主世界设计
```

---

## 12. 交接结论

当前项目不要再扩功能，也不要马上恢复画面。

当前最重要的下一步是：

```txt
正式核心资源库 / 验算库
→ 正式画图算法重整
→ 端游式 /world 主世界恢复
```

只有当正式算法边界清楚，并且 smoke 能验证结果正确时，才恢复 `/world` 画面。