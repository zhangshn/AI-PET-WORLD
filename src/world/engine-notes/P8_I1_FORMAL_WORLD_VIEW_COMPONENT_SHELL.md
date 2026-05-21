# AI-PET-WORLD P8-I1 FormalWorldView 组件骨架

## 1. 阶段定位

本阶段新增 FormalWorldView 组件骨架。

本阶段不接入 /world 页面。
本阶段不替换 ProceduralRendererView。
本阶段不修改 Renderer Core。
本阶段不修改 world-loop。
本阶段不生成世界事实。

## 2. 组件输入

FormalWorldView 只读取：

- RenderableWorldSnapshot
- VisualState
- VisualPlacement
- VisualActorGeometryProjection

## 3. 组件输出

当前组件只输出：

- 主世界视图壳层。
- 干净画布占位。
- 玩家可理解的最小 HUD。
- 管家状态摘要。

当前不显示：

- Debug Diagnostics。
- raw tags。
- source labels。
- collision boxes。
- F / C / S / I。
- actor debug flags。
- 紫微斗数原始术语。

## 4. 管家规则

管家作为第一生命，可以从 VisualState.actorGeometryProjections 中显示。

当前只显示 butler summary。

FormalWorldView 不能生成管家。
FormalWorldView 不能填默认 anchor。
FormalWorldView 不能修改 actor projection。

## 5. 宠物规则

本阶段不默认显示 pet。

宠物仍然后置，必须由生命关系事件接纳后进入。

FormalWorldView 不能为了画面完整伪造宠物。

## 6. 当前不做

本阶段不做：

1. 接入 /world。
2. 正式 Canvas 绘制。
3. 正式 actor 绘制。
4. 最终角色美术。
5. 动画。
6. world-loop 修改。
7. HomeMapState 修改。
8. MapPlacement 生成。
9. Debug / Formal 路由切换。

## 7. 下一步

下一步进入：

P8-I2：Formal World Canvas

目标是让 FormalWorldView 开始用干净程序化样式显示 VisualState 中的世界对象。
