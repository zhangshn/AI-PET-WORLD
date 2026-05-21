# AI-PET-WORLD World Engine Development Guardrails

## 1. 文档定位

本文档是 AI-PET-WORLD 世界引擎、渲染层、视觉模型层和前端呈现层的开发红线。

当前最高依据：

1. AI-PET-WORLD MVP 完整计划书 v1.5。
2. AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3。
3. AI-PET-WORLD MVP 整体架构设计文档 v1.0。

本文件优先级高于历史 P8-I0 / P8-I1 / P8-I2 / P8-I3 旧路线。

## 2. 最高原则

1. 世界事实先于画面。
2. 规则生成先于渲染。
3. 布局由 seed、人格、资源、事件和规则共同生成，不能固定模板化。
4. 自动生成内容必须进入结构化容器。
5. FormalVisualModel 是正式视觉模型容器。
6. FormalWorldView 只读渲染，不生成模型。
7. Debug View 与 Formal World View 分离。
8. 宠物后置，petState 必须可选。

## 3. 世界事实红线

世界事实只能来自：

1. HomeMapState。
2. WorldState。
3. MapDiff。
4. EventLog。
5. placements。
6. validated world-loop / SafeApply 输出。

禁止：

1. Renderer 生成世界事实。
2. FormalWorldView 生成世界事实。
3. UI 状态伪造世界对象。
4. proposal / unvalidated diff 被当作现实。
5. debug scenario result 被当作正式世界事实。
6. assetId / PNG 反向决定世界对象是否存在。

## 4. 非固定布局红线

禁止固定布局模板作为正式主路径。

必须满足：

```text
同一 seed + 同一状态
-> 稳定可复现

不同人格 / seed / 资源 / 事件状态
-> 布局可观察差异
```

禁止：

1. 每个玩家使用同一固定地图。
2. 前端组件固定摆放房子、树、道路、设施、管家。
3. 为了视觉好看绕过 PlacementEngine。
4. 刷新后无规则随机变化。
5. layout recipe 直接成为最终固定画面。

## 5. Renderer 红线

Renderer 可以读取：

1. VisualState。
2. RenderableWorldSnapshot。
3. VisualPlacement。
4. VisualActorGeometryProjection。
5. DrawCommand。
6. EntityGeometry。

Renderer 不能：

1. 生成 placement。
2. 生成 actor。
3. 修改 HomeMapState。
4. 修改 WorldState。
5. 读取 proposal 当现实。
6. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
7. 为了视觉效果伪造对象。
8. 参与 world-loop。
9. 参与 persistence 决策。
10. 参与 construction / placement 决策。

## 6. FormalVisualModel 红线

FormalVisualModel 必须来自：

```text
VisualState / RenderableWorldSnapshot
```

FormalVisualModel 可以包含：

1. FormalCanvasModel。
2. FormalWorldObjectModel。
3. FormalActorModel。
4. FormalEnvironmentModel。
5. FormalHudSummary。

FormalVisualModel 不能：

1. 生成不存在的世界对象。
2. 生成 placement。
3. 修改 HomeMapState。
4. 修改 WorldState。
5. 读取 proposal 当现实。
6. 伪造 actor。
7. 伪造 pet。
8. 绕过 canProject。
9. 绕过 petState 可选规则。

## 7. FormalWorldView 红线

FormalWorldView 只能只读 FormalVisualModel。

FormalWorldView 禁止：

1. 生成 FormalWorldVisualItem。
2. 生成 FormalActorVisualItem。
3. buildFormalWorldVisualItems。
4. buildFormalActorVisualItems。
5. 决定树、房子、道路、设施、管家、宠物怎么长。
6. 生成 actor。
7. 生成 placement。
8. 填默认 anchor。
9. 修改 VisualState。
10. 修改 HomeMapState。
11. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
12. 显示 raw tags / source diagnostics / audit internals。
13. 显示 F / C / S / I。
14. 显示 collision / support / influence debug boxes。
15. 显示紫微斗数原始术语。
16. 在 petState 不存在时显示默认宠物。

## 8. Debug View 红线

Debug View 可以显示工程信息，但不能伪装成最终玩家 UI。

Debug View 可以显示：

1. grid。
2. raw tags。
3. diagnostics。
4. source labels。
5. collision。
6. support。
7. influence。
8. actor debug flags。
9. anchorSource。
10. reason strings。

正式 /world 不能默认显示以上内容。

## 9. PNG / WORLD_MAP_ASSETS 红线

PNG / WORLD_MAP_ASSETS 可以作为表现资源候选，但不能作为世界事实来源。

禁止：

1. 因为有 tree.png 就让树存在。
2. 因为有 house.png 就让房子存在。
3. 因为有 pet.png 就让宠物存在。
4. 用 backgroundImage 作为正式世界对象主路径。
5. 用 assetId 反推对象存在。
6. 绕过 FormalVisualModel 直接贴图做正式世界。

正确关系：

```text
世界对象先进入 HomeMapState / placements
-> VisualState
-> FormalVisualModel
-> Renderer 选择表现资源
```

## 10. 宠物后置红线

1. petState 必须可选。
2. 开局不能默认显示宠物。
3. pet actor 不能默认生成。
4. pet FormalActorModel 不能默认生成。
5. 宠物必须通过 LifeEvent + CompanionDecision + accept_companion 进入。
6. 宠物不能通过事件文本说人话。
7. 没有 petState 时，worldEngine / Renderer / FormalVisualModel / FormalWorldView 必须正常运行。

## 11. P8-I Reset 红线

旧 P8-I0 / I1 / I2 / I3 FormalWorldView 路线已作废。

禁止恢复旧路线：

1. 禁止重新新增旧 FormalWorldView 组件。
2. 禁止重新新增 formal-world-view.styles.module.css。
3. 禁止组件内生成 FormalWorldVisualItem。
4. 禁止组件内生成 FormalActorVisualItem。
5. 禁止组件内 buildFormalWorldVisualItems。
6. 禁止组件内 buildFormalActorVisualItems。
7. 禁止在组件内写正式视觉模型生成逻辑。
8. 未完成 VISUAL-MODEL-00 / VISUAL-MODEL-01 前，不允许重新创建 FormalWorldView。

下一步必须从：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

开始。

## 12. 每轮开发必须回答

每轮开发开始前必须打印并确认：

1. 当前阶段。
2. 本轮做什么。
3. 本轮不做什么。
4. 允许修改文件。
5. 禁止修改文件。
6. 是否固定布局。
7. 是否组件生成模型。
8. 是否生成世界事实。
9. 是否生成 placement。
10. 是否生成 actor。
11. 是否读取 PNG / WORLD_MAP_ASSETS。
12. 是否接入 pet。
13. 完成后去哪里看。
14. 如何验证。

## 13. 验收门槛

每轮必须通过：

```text
npm run lint
npx tsc --noEmit
npm run build
```

如果本轮只改文档，也仍然需要至少确认：

1. 文档为 UTF-8。
2. 文档无乱码。
3. 文档无旧路线冲突描述。
4. 搜索 FormalWorldVisualItem / FormalActorVisualItem 不应出现在组件中。
5. 搜索 WORLD_MAP_ASSETS / PNG 不应出现在正式主路径中。

## 14. 当前下一步

当前下一步：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

进入 VISUAL-MODEL-00 前，必须确认：

1. P8_FORMAL_VISUAL_STAGE_PLAN.md 无乱码。
2. ENGINE_DEVELOPMENT_GUARDRAILS.md 无乱码。
3. 旧 P8-I0 / I1 / I2 / I3 文档不存在。
4. src/app/world/components/formal-world-view/ 不存在。
5. P8_I_ROUTE_RESET_TO_FORMAL_VISUAL_MODEL.md 存在。
6. 总控文档明确下一步是 VISUAL-MODEL-00。
