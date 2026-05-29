# AI-PET-WORLD V2.6｜正式画图算法重整方案

> 本文档用于开启 M11 closeout 后的下一阶段：正式画图算法重整。
>
> 当前只定方案，不恢复 `/world`，不搬 Debug 页面，不写正式 renderer 代码。
>
> 后续代码必须按本文档边界推进。

---

## 0. 当前结论

AI-PET-WORLD 已完成：

```txt
M11 核心资源库 / 验算库 closeout
视觉算法 Debug 合并与简化
```

下一阶段是：

```txt
正式画图算法重整
```

正式画图算法不是把 `/world-debug/pixel-visual-lab` 搬进 `/world`。

正式画图算法应该是：

```txt
WorldViewModel
→ formal pixel renderer
→ Tile Layer
→ Trace Layer
→ Object Layer
→ Actor Layer
→ Atmosphere Layer
→ /world 端游式像素主世界
```

---

## 1. 当前阶段不做什么

本阶段禁止：

- 不恢复旧 `/world` 网页卡片主页。
- 不恢复旧 SVG / Debug Composer / Procedural Renderer 到 `/world`。
- 不把 `/world-debug/pixel-visual-lab` 搬进 `/world`。
- 不让正式 UI 直接读 runtime。
- 不让正式 UI 写 runtime save。
- 不让正式 UI 生成世界事实。
- 不恢复旧宠物默认生成。
- 不恢复孵化器 / embryo / hatch / incubator 旧链路。
- 不做 M8 / M9 / M10。
- 不做小镇 / 公园 / 医院 / 多用户正式运行。

---

## 2. 正式画图算法的唯一输入

正式画图算法只能读取：

```txt
WorldViewModel
```

允许读取的结构：

```txt
WorldViewModel.canvas
WorldViewModel.tiles
WorldViewModel.objects
WorldViewModel.traces
WorldViewModel.actors
WorldViewModel.atmosphere
WorldViewModel.butlerExplanation
WorldViewModel.pPhone
WorldViewModel.tags
```

禁止正式画图算法直接读取：

```txt
WorldRuntimeSaveRecord
HomeMapState
SpaceGrid
TraceField
TraceMemorySeedField
TraceInfluenceSummary
ButlerRuntimeDecision
ButlerRuntimeIntent
ButlerWorldRuleValidation
ButlerRuntimeAuditSummary
```

这些已经在核心资源库 / 验算库阶段完成投影，正式画图算法只接收投影后的表现模型。

---

## 3. 正式画图算法的输出分层

正式画图算法输出应拆为五层：

```txt
Tile Layer
Trace Layer
Object Layer
Actor Layer
Atmosphere Layer
```

### 3.1 Tile Layer

来源：

```txt
WorldViewModel.tiles
```

职责：

- 绘制基础地面。
- 表现 terrainKind / regionKind。
- 表现基础生态过渡。
- 表现不可通行边界。

禁止：

- 不直接推导世界事实。
- 不写回 tile。
- 不自己生成 map。

---

### 3.2 Trace Layer

来源：

```txt
WorldViewModel.tiles.traceIntensity
WorldViewModel.traces
```

职责：

- 表现 pressed_grass。
- 表现 worn_grass。
- 表现 exposed_soil。
- 表现长期行动痕迹。

禁止：

- 不把痕迹当装饰随机生成。
- 不直接调用 TraceField。
- 不修改痕迹事实。

---

### 3.3 Object Layer

来源：

```txt
WorldViewModel.objects
```

职责：

- 绘制 world_fact 对象。
- 绘制 derived_visual_only 对象。
- 表现树、灌木、石头、草簇、花等视觉对象。

边界：

```txt
world_fact = 已存在事实对象

derived_visual_only = 只读视觉派生对象
```

禁止：

- 不把 derived_visual_only 写回 HomeMapState。
- 不在 renderer 内新增事实对象。
- 不在 renderer 内创建宠物。

---

### 3.4 Actor Layer

来源：

```txt
WorldViewModel.actors
```

职责：

- 绘制管家 actor。
- 未来绘制经过正式入场验证的 pet actor。
- 按 actor.visible 决定是否显示。

当前结论：

```txt
当前只允许 1 个管家 actor。
当前不允许默认宠物 actor。
未来 pet actor 必须来自正式验证后的 WorldViewModel.actors。
```

禁止：

- 不在 renderer 里补一个默认宠物。
- 不用占位宠物填画面。
- 不把未来宠物视觉参考当正式宠物。

---

### 3.5 Atmosphere Layer

来源：

```txt
WorldViewModel.atmosphere
WorldViewModel.butlerExplanation
WorldViewModel.pPhone
```

职责：

- 表现世界氛围。
- 表现轻量提示。
- 后续承接 P-Phone / 管家解释的入口位置。

禁止：

- 不暴露后台词。
- 不把 AuditSummary / TraceField / SafeApply / WorldViewModel 等内部词显示给用户。
- 不恢复旧网页卡片主页。

---

## 4. Debug visual lab 与正式算法的关系

当前唯一视觉算法 Debug 页面：

```txt
/world-debug/pixel-visual-lab
```

它只做：

```txt
视觉算法测试台
场景组合预览
树木绘制预览
后台视觉算法接线验证
```

它不能：

```txt
不能进入正式 /world
不能替代正式 renderer
不能读 runtime
不能写世界事实
不能推进 Tick
不能成为核心资源库
不能成为正式验算库
```

正式画图算法可以参考它的视觉效果，但必须重新接入正式输入：

```txt
WorldViewModel
```

---

## 5. 建议文件拆分

正式画图算法建议新增目录：

```txt
src/world/formal-pixel-renderer/
```

建议文件：

```txt
src/world/formal-pixel-renderer/formal-pixel-renderer-schema.ts
src/world/formal-pixel-renderer/formal-pixel-renderer-gateway.ts
src/world/formal-pixel-renderer/tile-layer-renderer.ts
src/world/formal-pixel-renderer/trace-layer-renderer.ts
src/world/formal-pixel-renderer/object-layer-renderer.ts
src/world/formal-pixel-renderer/actor-layer-renderer.ts
src/world/formal-pixel-renderer/atmosphere-layer-renderer.ts
src/world/formal-pixel-renderer/formal-pixel-renderer-audit.ts
src/world/formal-pixel-renderer/index.ts
```

### 文件职责

| 文件 | 职责 |
|---|---|
| `formal-pixel-renderer-schema.ts` | 定义正式像素渲染输出结构 |
| `formal-pixel-renderer-gateway.ts` | 唯一对外入口，输入 WorldViewModel，输出 render model |
| `tile-layer-renderer.ts` | tiles → tile layer |
| `trace-layer-renderer.ts` | traces / traceIntensity → trace layer |
| `object-layer-renderer.ts` | objects → object layer |
| `actor-layer-renderer.ts` | actors → actor layer |
| `atmosphere-layer-renderer.ts` | atmosphere / butler / pPhone → atmosphere layer |
| `formal-pixel-renderer-audit.ts` | 验证只读边界、无默认宠物、无 Debug 来源 |
| `index.ts` | 统一导出 |

---

## 6. `/world` 恢复条件

`/world` 不能立刻恢复。

恢复必须满足：

```txt
formal-pixel-renderer 已建立
formal render model 已通过 smoke
/world 只读取 WorldViewModel
/world 只调用 formal-pixel-renderer-gateway
/world 不引用 Debug visual lab
/world 不引用 SVG Debug preview
/world 不引用 procedural-renderer
/world 不写 runtime
/world 不推进 Tick
/world 不生成默认宠物
```

通过后才能把 `/world` 从 cleared 页面切换为端游式像素主世界。

---

## 7. 第一批 smoke 设计

### 7.1 `smoke:formal-pixel-renderer-contract`

检查：

```txt
formal-pixel-renderer 只接收 WorldViewModel
不 import runtime
不 import HomeMapState
不 import TraceField
不 import Debug visual lab
不 import procedural-renderer
输出包含 Tile / Trace / Object / Actor / Atmosphere 五层
无默认宠物 actor
derived visual-only 不写 runtime
```

---

### 7.2 `smoke:formal-pixel-renderer-readonly`

检查：

```txt
调用 formal renderer 前后 runtime save hash 不变
runtime tick 不变
HomeMapState placements 不变
没有写入文件
没有推进 Tick
```

---

### 7.3 `smoke:formal-world-surface-gate`

检查：

```txt
正式 /world 当前仍 cleared
正式 /world 没有引用 Debug visual lab
正式 /world 没有引用 procedural renderer
正式 /world 没有恢复网页卡片主页
```

说明：这个 smoke 用于 renderer 建立前的过渡期，防止提前恢复 `/world`。

---

## 8. 第一阶段执行顺序

建议按以下顺序推进：

```txt
1. 新建 formal-pixel-renderer schema
2. 新建 formal-pixel-renderer gateway
3. 建立 Tile Layer 输出
4. 建立 Trace Layer 输出
5. 建立 Object Layer 输出
6. 建立 Actor Layer 输出
7. 建立 Atmosphere Layer 输出
8. 增加 formal renderer audit
9. 增加 smoke:formal-pixel-renderer-contract
10. 增加 smoke:formal-pixel-renderer-readonly
11. 文档同步
12. 再决定何时恢复 /world
```

---

## 9. 正式渲染模型建议结构

建议输出结构：

```ts
type FormalPixelRenderModel = {
  worldId: string
  ownerId: string
  tick: number
  canvas: {
    width: number
    height: number
    tileSize: number
    columns: number
    rows: number
  }
  layers: {
    tiles: FormalTileLayer
    traces: FormalTraceLayer
    objects: FormalObjectLayer
    actors: FormalActorLayer
    atmosphere: FormalAtmosphereLayer
  }
  audit: FormalPixelRendererAudit
  tags: string[]
}
```

关键点：

```txt
它是 render model，不是 world fact。
它是只读表现结构，不是存档结构。
它只服务正式像素主世界绘制。
```

---

## 10. 当前最终边界

当前阶段最终边界：

```txt
视觉算法 Debug 已合并完成。
核心资源库 / 验算库 closeout 已完成。
正式画图算法即将开始。
正式画图算法只能读 WorldViewModel。
正式画图算法不能写 runtime。
正式画图算法不能生成默认宠物。
正式画图算法不能引用 Debug visual lab。
正式 /world 仍保持 cleared，直到 formal renderer 通过验收。
```
