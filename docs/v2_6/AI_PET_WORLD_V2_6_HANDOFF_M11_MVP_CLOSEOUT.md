# AI-PET-WORLD V2.6｜M11 验收整理交接文档

> 新聊天窗口必须先阅读本文档，再继续工作。本文档用于防止新窗口把 Debug 视觉参考库、正式画图算法、核心验算库、主页 UI、旧孵化器业务链条和未来端游形态混在一起。

---

## 0. 当前一句话结论

当前项目已经完成底层自主世界闭环与 M7 管家行为 → 痕迹闭环。现在处于：

```txt
M11｜验收整理阶段
```

不是继续扩功能，不是恢复 `/world` 画面，不是重新做网页卡片 UI，也不是立刻进入 M8 / M9 / M10。

当前 `/world` 已经被刻意清空，因为旧主页画图结果与网页卡片布局方向不对。现在最优先任务是：验收、整理、确认当前边界，再决定正式画图算法重整方案。

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
| M11 主页清空 | 完成 | 错误画面、当前记录卡片、管家说明卡片、P-Phone 卡片已从正式主页移除 |
| M11 验收整理 | 当前阶段 | 先验收当前状态、整理 smoke、整理 Debug 边界、整理下一阶段计划 |
| M11 正式画图算法重整 | 后续阶段 | 验收整理完成后再做 |
| M11 核心资源库 / 验算库 | 后续阶段 | 不是当前第一步；应在验收整理后建立，用于验证正式算法输出 |

---

## 2. 当前最重要的事实

### 2.1 `/world` 已经清空

`/world` 现在不应该展示旧画布、当前记录卡片、管家说明卡片、P-Phone 卡片。

清空原因：

- 旧主页画图算法 / 布局出现右侧大片空白。
- 当前视觉不是正式主世界目标。
- 卡片式网页布局不是未来方向。
- 错误画面不能继续作为 MVP 正式入口。

当前 `/world` 应保持 cleared 状态，直到验收整理完成，并且正式画图算法重新定义且通过验收。

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

### 2.3 孵化器旧概念已废弃

当前 V2.6 正式业务链条里，不再使用旧的孵化器 / embryo / hatch / hatch progress / incubator care 作为当前 MVP 主线。

新窗口如果从旧记忆里提取到：

```txt
孵化器
胚胎
孵化进度
hatch
incubator
watch incubator
```

必须视为旧业务残留，不能写进当前计划、代码、文档或 UI。当前标准是：宠物不是默认资产；MVP 阶段不做宠物入场、宠物学习和复杂宠物系统。宠物未来作为独立生命进入世界，但不是当前 M11 验收整理范围。

---

## 3. 三套东西必须分开，不能混

### 3.1 正式自主世界生成算法

正式世界生成算法负责世界事实和运行逻辑，不负责 Debug 视觉展示。

核心输入 / 事实：

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
- 不允许旧孵化器链条重新进入当前 MVP。

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

正式画图重整内容后置到验收整理之后：

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

它可以用来观察：

- tile 视觉效果。
- trace 视觉效果。
- tree / bush / stone / flower / mushroom / grass_tuft 等对象观感。
- atmosphere 观感。
- UI overlay 参考。

但它不验证世界事实是否正确，不写 runtime save，不推进 runtime tick，不替代 `/world`。

---

## 4. 当前阶段：M11 验收整理

当前第一优先级不是新建功能，而是验收整理。

M11 验收整理要确认：

```txt
1. /world 是否保持 cleared 状态
2. 旧画布、当前记录卡片、管家说明卡片、P-Phone 卡片是否已从正式主页移除
3. pixel-scene-composer 是否只作为 Debug 视觉参考库
4. create-world → runtime save → /world 路径是否可验收
5. M7 管家行为闭环是否没有被破坏
6. WorldViewModel 主链路是否没有被破坏
7. 所有 smoke 哪些已注册，哪些需要 node 直接跑
8. Debug 地址和定位是否清楚
9. 下一阶段正式画图算法重整之前的禁止事项是否明确
10. 孵化器旧概念是否没有进入当前业务链条
```

验收整理完成之后，才进入：

```txt
正式核心资源库 / 验算库
→ 正式画图算法重整
→ 端游式 /world 主世界恢复
```

注意：核心资源库 / 验算库是后续阶段，不是当前第一步。

---

## 5. 核心资源库 / 核心验算库：后续阶段，不是当前第一步

核心资源库 / 验算库还没有正式建立。它后续要服务于正式算法验收，不服务于 Debug composer。

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

建议验收整理完成后再新增文档：

```txt
docs/v2_6/AI_PET_WORLD_V2_6_FORMAL_CORE_RESOURCE_VALIDATION_LIBRARY.md
```

建议后续新增 smoke：

```txt
smoke:m11-core-resource-validation
```

---

## 6. `/world-debug/pixel-scene-composer` 当前定位

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

## 7. 当前关键文件

### 7.1 正式 `/world` 入口

```txt
src/app/world/page.tsx
src/app/world/world-live-runtime-page.tsx
src/app/world/components/pixel-world-view/pixel-world-view.tsx
src/app/world/components/pixel-world-view/pixel-world-view.module.css
src/app/world/components/pixel-world-view/pixel-world-canvas.client.tsx
```

当前状态：`pixel-world-view.tsx` 已清空正式主页展示，只保留 cleared surface。

### 7.2 WorldViewModel 正式表现模型

```txt
src/world/world-view-model/world-view-model-gateway.ts
src/world/world-view-model/world-view-model-schema.ts
src/world/world-view-model/*mapper*.ts
```

当前状态：正式主链路存在，但画图算法需要验收整理后再重整。

### 7.3 Runtime / M7 管家闭环

```txt
src/world/runtime/world-runtime-gateway.ts
src/world/runtime/world-runtime-tick-runner.ts
src/world/runtime/butler-runtime-intent.ts
src/world/runtime/butler-runtime-trace-closure.ts
src/world/runtime/butler-runtime-audit-summary.ts
```

当前状态：M7 已完成，不要重新设计它。

### 7.4 create-world → runtime save

```txt
src/app/create-world/create-world-route-page.tsx
src/app/api/world/create/route.ts
src/world/runtime/world-runtime-gateway.ts
scripts/run-world-m11-create-world-flow-smoke.cjs
```

当前状态：创建页已经开始接入正式 runtime save。注意：`package.json` 目前尚未注册 `smoke:m11-create-world-flow`，需要用 node 直接跑或在验收整理阶段补注册。

### 7.5 Debug 视觉参考库

```txt
src/app/world-debug/pixel-scene-composer/pixel-scene-composer-client.tsx
```

当前状态：已经改成 Debug 视觉参考库口径，不是核心资源库。

---

## 8. Debug 地址清单

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
| `/world` | 正式主世界入口；当前已清空，等待验收整理完成后再进入正式画图算法重整 |
| `/personality-test` | 命理 / 人格调试页，允许显示内部信息 |
| `/world-debug` | 世界 Debug 入口 |
| `/world-debug/pixel-scene-composer` | Debug 视觉参考库，不是正式算法库 |
| `/world-debug/mapdiff` | MapDiff 调试 |
| `/world-debug/procedural-renderer` | 旧实验 / 调试，不得搬进正式 `/world` |
| `/world-debug/proposal-audit` | Proposal / audit 调试 |
| `/world-debug/tree-render-test` | 树渲染测试 |
| `/world-debug/visual-change-verification` | 视觉变化验证 |

---

## 9. 当前 smoke / 验收命令

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

## 10. 新窗口下一步建议顺序

不要直接恢复 `/world` 画面。不要直接进入核心资源库开发。先做 M11 验收整理。

```txt
1. 先打印当前进度表。
2. 说明本轮只做 M11 验收整理，不做新功能。
3. 跑 lint / tsc / build / smoke:m11-formal-surface，确认清空主页没有破坏主链路。
4. 跑 node scripts/run-world-m11-create-world-flow-smoke.cjs，确认 create-world → runtime save → /world 仍然成立。
5. 跑 M7 smoke，确认管家闭环没有被破坏。
6. 跑 world-pixel-viewmodel-primary，确认正式 WorldViewModel 主链路仍存在。
7. 整理当前验收结果，更新模块进度文档。
8. 只有验收整理完成后，再进入核心资源库 / 验算库文档与正式画图算法重整。
```

---

## 11. 新窗口回复格式规则

每次回复必须先显示进度表，再说计划，再给指令。

固定格式：

```txt
一、当前阶段进度表
用表格展示：模块 / 进度 / 状态 / 说明。

二、本轮目标
只写一个大模块目标，不拆成一堆小任务。

三、本轮不做什么
明确不做 M8 / M9 / M10，不恢复卡片主页，不恢复旧画面，不做宠物、小镇、多用户等。

四、执行方案
只给一个大模块级方案。

五、验收命令
给完整命令：git pull、lint、tsc、build、对应 smoke。

六、如果要交给 Codex
必须说明：Codex 只在用户本地修改，用户手动上传；不要说 Codex 会直接推 GitHub。
```

---

## 12. Codex 使用规则

如果后续交给 Codex：

```txt
Codex 在用户本地项目修改代码。
用户手动检查、运行命令、git add、commit、push 或上传。
不要写“我已经让 Codex 推到 GitHub”。
不要让 Codex 直接替用户远程提交。
```

本聊天里的 ChatGPT 可以在 GitHub 上直接改文件，但交给 Codex 的指令必须按本地执行口径写。

---

## 13. 禁止事项

新窗口绝对不要做：

- 不要把 `/world-debug/pixel-scene-composer` 原样搬到 `/world`。
- 不要把 Debug 视觉参考库叫成核心资源库。
- 不要把 Scene Composer 当正式画图算法。
- 不要继续做网页卡片式主页。
- 不要恢复顶部说明卡、当前记录卡、管家说明卡、P-Phone 卡片。
- 不要默认生成宠物。
- 不要恢复孵化器、胚胎、hatch、incubator 等旧业务链条。
- 不要恢复 road/path 正式架构。
- 不要进入 M8 / M9 / M10。
- 不要做小镇、公园、医院、多用户世界。
- 不要让页面访问推进 runtime tick。
- 不要让 derived_visual_only 写入 HomeMapState。
- 不要暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词到正式 UI。

---

## 14. 未来 `/world` 视觉目标

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

## 15. 交接结论

当前项目不要再扩功能，也不要马上恢复画面。

当前最重要的下一步是：

```txt
M11 验收整理
→ 核心资源库 / 验算库
→ 正式画图算法重整
→ 端游式 /world 主世界恢复
```

只有当验收整理完成、正式算法边界清楚，并且 smoke 能验证结果正确时，才恢复 `/world` 画面。