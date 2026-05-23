> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H 管家 / 宠物 actor 几何占位规划

## 1. 阶段定位

P8-H 是角色几何占位阶段。

目标不是做角色动画，也不是做最终角色美术，而是让管家 / 宠物能够在几何视觉系统中以 actor 形式出现。

P8-H 必须延续 P8-G 的几何路线：

- 不读取 PNG。
- 不读取 WORLD_MAP_ASSETS 作为正式显示主路径。
- 不使用 backgroundImage 作为正式角色显示。
- 不生成 placement。
- 不修改 HomeMapState。
- 不用 UI 临时状态伪造角色存在。
- 角色显示必须来自世界状态。

## 2. 产品原则

管家原则：

1. 管家是管理者，不是玩家手动操控角色。
2. 管家可以管理、观察、靠近、等待、解释、记录、保护性回应。
3. 管家不能剥夺宠物自主决定权。
4. 管家显示必须来自世界状态或 actor runtime projection。
5. 管家后续动作必须由 runtime state / task state / intent state 派生。

宠物原则：

1. 宠物是独立自主生命。
2. 宠物不是按钮驱动对象。
3. 宠物行为来自 personality / state / drive / goal / memory / environment。
4. 宠物不能通过事件文本说人话。
5. 宠物显示必须来自世界状态或 actor runtime projection。
6. 宠物后续动作必须由 behavior state / drive state / runtime state 派生。

## 3. 为什么不能直接在 Renderer 里画角色

Renderer 只能显示当前世界事实。

Renderer 不能：

1. 生成 actor placement。
2. 临时决定管家存在。
3. 临时决定宠物存在。
4. 修改 HomeMapState。
5. 修改 runtime state。
6. 读取 button state / UI state 伪造角色。
7. 直接读取 personality-core 原始数据画角色。
8. 绕过 world-loop 生成角色位置。

## 4. 推荐阶段拆分

### P8-H0：阶段规划

只写本文档，锁定 actor 显示边界。

### P8-H1：Actor Geometry Projection 协议

新增只读协议，用于描述 actor 的几何投影。

建议新增目录：

src/world/actor-geometry/

建议文件：

- actor-geometry-schema.ts
- actor-geometry-builder.ts
- actor-geometry-gateway.ts

协议只描述：

- actorKind: butler / pet
- actorId
- anchor
- body footprint
- interaction radius
- attention direction
- tags

注意：
Actor Geometry 不生成 HomeMapState placement。
Actor Geometry 只描述角色几何投影。

### P8-H2：Actor Runtime Projection 输入边界

建立从已有世界状态 / runtime state 派生 actor projection 的只读边界。

要求：

1. 不修改 world-loop。
2. 不修改 HomeMapState。
3. 不生成 placement。
4. 先允许 deterministic placeholder projection。
5. projection 必须带 tags 标明来源：
   - actor_projection_v0
   - actor_kind:butler
   - actor_kind:pet
   - source:runtime_projection

### P8-H3：VisualState 接入 actor projection

让 VisualState 可以携带 actor projection 派生结果。

注意：
这一步要先评估是否修改 renderer schema。
如果修改 schema，必须只新增字段，不能破坏现有 VisualPlacement。

### P8-H4：Renderer 显示 actor geometry

Renderer 读取 actor projection，显示几何占位。

显示规则：

1. 管家用几何人形占位。
2. 宠物用几何动物占位。
3. 不使用 PNG。
4. 不使用 img。
5. 不使用 next/image。
6. 不使用 WORLD_MAP_ASSETS。
7. 不使用 backgroundImage。
8. 不生成 placement。
9. 不修改 HomeMapState。

### P8-H5：Actor Debug Diagnostics

新增 actor debug 诊断区，显示：

- actorKind
- actorId
- anchor
- source
- hasBody
- hasInteractionRadius
- tags

明确：
Actor Debug Diagnostics 不是最终玩家 UI。

## 5. 当前暂不做的事情

P8-H 不做：

1. 最终角色美术。
2. 角色动画系统。
3. 路径移动系统。
4. 角色行为决策。
5. 宠物自主行为重写。
6. 管家人格生成。
7. 管家任务系统重写。
8. 宠物事件文本重写。
9. 多宠物队列。
10. 玩家点击控制角色。

## 6. 页面查看目标

未来 P8-H4 完成后，页面查看位置：

/world
-> 几何 / 程序化视觉预览 v1
-> actor geometry layer

Debug 页面：

/world-debug/visual-change-verification
-> Before / After
-> actor geometry layer

未来 P8-H5 完成后，页面查看位置：

/world
-> Actor Geometry Diagnostics

## 7. P8-H 继续禁止事项

1. 禁止用 Renderer 生成角色。
2. 禁止用 UI 临时状态伪造角色存在。
3. 禁止修改 HomeMapState 来硬塞角色。
4. 禁止把 actor projection 当作 placement 写回。
5. 禁止读取 PNG。
6. 禁止读取 WORLD_MAP_ASSETS。
7. 禁止使用 backgroundImage。
8. 禁止使用 img / next/image。
9. 禁止绕过 world-loop。
10. 禁止让宠物通过事件文本说人话。
11. 禁止让管家替宠物做决定。
12. 禁止把 Debug 诊断区包装成最终玩家 UI。

## 8. 当前结论

P8-H 可以开始，但第一步必须先建立 actor geometry projection 协议。

下一步建议：

P8-H1：Actor Geometry Projection 协议
