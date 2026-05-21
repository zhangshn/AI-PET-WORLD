# AI-PET-WORLD 工程开发红线

## 1. 文档定位

本文档记录 AI-PET-WORLD 后续开发必须遵守的工程红线。

当前最高依据：

1. AI-PET-WORLD MVP 完整计划书 v1.5。
2. AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3。
3. AI-PET-WORLD MVP 整体架构设计文档 v1.0。

所有后续实现必须服从这些文档。

## 2. 世界事实红线

1. 世界事实只能来自规则世界引擎。
2. UI 不能生成世界事实。
3. Renderer 不能生成世界事实。
4. Debug View 不能生成世界事实。
5. FormalWorldView 不能生成世界事实。
6. 不能绕过 Intent / Plan / Validate / Diff / WorldState。
7. 不能把 proposal 当成现实。
8. 不能把 audit 当成现实。
9. 不能把 debug scenario 当成正式世界。
10. 不能为了视觉效果伪造对象。

## 3. HomeMapState / placement 红线

1. 不能由 Renderer 生成 placement。
2. 不能由 FormalWorldView 生成 placement。
3. 不能由 Debug View 生成 placement。
4. 不能为了显示效果修改 HomeMapState。
5. 不能为了角色显示硬塞 MapPlacement。
6. 不能把 actor projection 写回 HomeMapState。
7. 不能把 FormalVisualModel 写回 HomeMapState。
8. 不能把 UI 临时状态写成世界事实。
9. 不能把未校验 diff 写入正式世界。
10. 不能绕过 SafeApply。

## 4. PNG / asset 红线

1. 正式世界对象不能以 PNG 贴图作为本体。
2. 树不是 tree.png。
3. 房屋不是 house.png。
4. 道路不是 path.png。
5. 管家不是 butler.png。
6. 宠物不是 pet.png。
7. Renderer 不能读取 PNG 作为正式主路径。
8. FormalWorldView 不能读取 PNG 作为正式主路径。
9. FormalVisualModel 不能读取 PNG 作为正式主路径。
10. 不能重新引入 WORLD_MAP_ASSETS 作为正式主路径。
11. 不能使用 backgroundImage / img / next/image 伪装正式世界对象。
12. 图片资源只能作为未来非正式参考或明确标记的外观资源，不能成为世界事实来源。

## 5. ShapeGrammar / Geometry 红线

1. 世界对象必须优先理解为几何结构。
2. 点 / 线 / 面早于贴图。
3. ShapeGrammar 只描述结构，不决定世界是否发生变化。
4. ShapeGrammar 不能生成 placement。
5. ShapeGrammar 不能修改 HomeMapState。
6. ShapeGrammar 不能读取 PNG。
7. ShapeGrammar 不能读取 WORLD_MAP_ASSETS。
8. EntityGeometry 只承载 footprint / collision / support / influence 等几何投影。
9. Geometry audit 只能展示事实，不能生成事实。
10. Debug geometry 可以保留，但不能伪装成最终玩家 UI。

## 6. Actor Geometry 红线

1. 管家 / 宠物显示必须来自世界状态或 actor runtime projection。
2. Renderer 不能生成 actor。
3. FormalWorldView 不能生成 actor。
4. Renderer 不能决定角色是否存在。
5. FormalWorldView 不能决定角色是否存在。
6. Renderer 不能填默认 anchor。
7. FormalWorldView 不能填默认 anchor。
8. actor projection 不能写回 MapPlacement。
9. actor projection 不能修改 HomeMapState。
10. 当前 butler actor projection v0 是 Debug 几何占位，不是最终行为系统。
11. 当前 actor geometry 不是最终角色美术。
12. 当前 actor geometry 不代表最终 autonomous movement。
13. pet 不作为默认 actor 接入。
14. pet 必须继续遵守生命关系事件后置原则。
15. 宠物不能通过事件文本说人话。

## 7. Debug View 红线

1. Debug View 可以显示 raw geometry。
2. Debug View 可以显示 raw tags。
3. Debug View 可以显示 source diagnostics。
4. Debug View 可以显示 audit data。
5. Debug View 可以显示 collision / support / influence。
6. Debug View 可以显示 F / C / S / I。
7. Debug View 可以显示 anchor source。
8. Debug View 可以显示 rule status。
9. Debug View 不能参与世界运行。
10. Debug View 不能伪装成最终玩家 UI。
11. Debug View 不能生成 placement。
12. Debug View 不能生成 actor。
13. Debug View 不能修改 HomeMapState。
14. Debug View 不能读取 proposal 当现实。
15. Debug View 必须与未来 Formal World View 分离。

## 8. FormalVisualModel 红线

1. 正式视觉模型必须来自 `src/world/formal-visual-model/`。
2. FormalVisualModel 必须早于新的 FormalWorldView。
3. FormalVisualGenerator 必须是纯函数。
4. FormalVisualGenerator 只能从已存在的渲染投影派生正式视觉模型。
5. FormalVisualGenerator 不能生成世界事实。
6. FormalVisualGenerator 不能生成 placement。
7. FormalVisualGenerator 不能生成 actor。
8. FormalVisualGenerator 不能修改 HomeMapState。
9. FormalVisualGenerator 不能读取 PNG 作为正式主路径。
10. FormalVisualGenerator 不能读取 WORLD_MAP_ASSETS 作为正式主路径。
11. FormalVisualModel 可以表达正式视觉语义。
12. FormalVisualModel 不能替代 WorldState。
13. FormalVisualModel 不能替代 VisualState。
14. FormalVisualModel 不能把 debug source 暴露给玩家主视觉。
15. FormalVisualModel 必须保留可审计来源。

## 9. FormalWorldView 红线

1. 旧 P8-I0 / P8-I1 / P8-I2 / P8-I3 FormalWorldView 手写视觉路线全部作废。
2. FormalWorldView 不能生成 FormalWorldVisualItem。
3. FormalWorldView 不能生成 FormalActorVisualItem。
4. FormalWorldView 不能在组件内决定地面、道路、建筑、树木、设施、actor 的正式视觉表现。
5. FormalWorldView 不能生成正式视觉模型。
6. FormalWorldView 只能只读 FormalVisualModel 渲染。
7. FormalWorldView 不能读取 PNG。
8. FormalWorldView 不能读取 WORLD_MAP_ASSETS。
9. FormalWorldView 不能生成 actor。
10. FormalWorldView 不能生成 placement。
11. FormalWorldView 不能填默认 anchor。
12. FormalWorldView 不能修改 VisualState。
13. FormalWorldView 不能修改 HomeMapState。
14. FormalWorldView 不能显示 raw tags / source diagnostics / audit internals。
15. FormalWorldView 不能显示紫微斗数原始术语。

## 10. 管家 / 宠物产品红线

1. 管家是管理者，不是玩家手动操控角色。
2. 管家可以观察、解释、记录、保护性回应。
3. 管家不能剥夺宠物自主决定权。
4. 管家显示必须来自世界状态或 actor runtime projection。
5. 宠物是独立自主生命。
6. 宠物不是按钮驱动对象。
7. 宠物不是开局默认资产。
8. 宠物必须由生命关系事件接纳后进入主世界。
9. 宠物行为来自 personality / state / drive / goal / memory / environment。
10. 宠物不能通过事件文本说人话。
11. 玩家观察世界，而不是直接控制世界。
12. 玩家不能直接操控管家或宠物。
13. 不能用 UI 临时状态伪造宠物存在。
14. 不能为了画面完整默认接入 pet。
15. 后续动画必须由 runtime state / behavior state 派生。

## 11. 当前 P8 后续入口

当前 P8-I-RESET 已完成。

下一步唯一正确入口是：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

在进入 VISUAL-MODEL-00 前，禁止重新新增 `src/app/world/components/formal-world-view/`。
