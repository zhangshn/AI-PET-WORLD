# AI-PET-WORLD V2.6｜正式核心资源库 / 验算库

> 当前文档是 M11 验收整理完成后的下一阶段入口。
> 它不是 Debug 视觉参考库，不是正式画图算法，不是 `/world` 画面恢复方案。

---

## 1. 当前阶段定位

当前阶段名称：

```txt
M11｜核心资源库 / 验算库
```

当前目标不是让画面变好看，而是先验证正式算法输出是否正确。

正式验算库服务于：

```txt
WorldRuntimeSaveRecord
→ HomeMapState
→ SpaceGrid
→ TraceField
→ WorldViewModel
→ 后续 PixelWorldView
```

它只验证正式事实链路和只读表现边界。

---

## 2. 它不是哪些东西

正式核心资源库 / 验算库不是：

- 不是 `/world-debug/pixel-scene-composer`。
- 不是 Debug 视觉参考库。
- 不是 Scene Composer 参数库。
- 不是正式画图算法。
- 不是 `/world` 画面恢复。
- 不是网页卡片主页。
- 不是宠物学习、小镇、公园、医院、多用户系统。
- 不是孵化器 / embryo / hatch / incubator 旧业务链条。

---

## 3. 第一批验算对象

| 验算对象 | 验算目标 | 当前口径 |
|---|---|---|
| WorldRuntimeSaveRecord | runtime save 是否存在、JSON 是否可读、read-only 投影是否不写回 | 只读验收 |
| HomeMapState | mapSize / placements 是否作为世界事实来源 | 事实来源 |
| SpaceGrid | columns / rows / tileSize / canvas 是否稳定映射 | 空间底座 |
| TraceField | traces 是否作为痕迹事实来源 | 痕迹来源 |
| WorldViewModel tiles | tile 数量是否等于 SpaceGrid cell 数量 | 表现投影 |
| WorldViewModel objects | world_fact / derived_visual_only 是否区分清楚 | 事实 / 视觉派生分离 |
| WorldViewModel traces | trace projection 是否只读 | 表现投影 |
| WorldViewModel actors | 管家可见；默认宠物不得出现 | 生命表现边界 |
| derived_visual_only | 必须带 `not_world_fact` 与 `no_runtime_write` | 只读视觉派生 |
| `/world` formal path | 不得引用 Debug Composer / SVG renderer / procedural renderer | 正式入口隔离 |

---

## 4. 第一批硬性禁止项

正式核心资源库 / 验算库必须守住：

- 不默认生成宠物。
- 不把 Debug Composer 当核心资源库。
- 不把 Scene Composer 当正式画图算法。
- 不让 `/world` 引用 `buildSceneSvg`。
- 不让 `/world` 引用 `WorldPainterReadonlyPreview`。
- 不让 `/world` 引用 `FormalWorldView`。
- 不让 `/world` 引用 `ProceduralRendererView`。
- 不让 `derived_visual_only` 写入 HomeMapState。
- 不让验算 smoke 推进 runtime tick。
- 不恢复网页卡片主页。
- 不恢复旧 `/world` 画面。

---

## 5. 第一批 smoke

新增 smoke：

```powershell
npm run smoke:m11-core-resource-validation
```

该 smoke 只读验证：

- runtime save hash 不变。
- runtime tick 不变。
- HomeMapState placements 不变。
- WorldViewModel canvas 来自 HomeMapState / SpaceGrid。
- WorldViewModel tiles 数量等于 columns × rows。
- world_fact object 与 derived_visual_only object 分离。
- derived_visual_only object 均带 `not_world_fact` / `no_runtime_write`。
- WorldViewModel 不能生成默认可见宠物。
- `/world` formal path 不得回退 Debug / SVG / Scene Composer。

---

## 6. 下一步关系

当前阶段完成后，才进入：

```txt
正式画图算法重整
```

正式画图算法重整必须读取正式验算库确认过的事实链路，不能直接搬 `/world-debug/pixel-scene-composer`。
