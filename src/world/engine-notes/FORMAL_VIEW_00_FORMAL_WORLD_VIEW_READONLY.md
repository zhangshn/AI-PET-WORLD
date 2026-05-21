# AI-PET-WORLD FORMAL-VIEW-00 FormalWorldView 只读 FormalVisualModel

## 1. 阶段定位

本阶段新增只读 FormalWorldView 组件。

本阶段不是世界生成层。
本阶段不是 FormalVisualGenerator。
本阶段不生成 FormalVisualModel。
本阶段不接入 /world 页面。
本阶段不改变现有 Debug Renderer。

## 2. 组件输入

FormalWorldView 只能接收：

```ts
model: FormalVisualModel
```

组件不能接收 RenderableWorldSnapshot。
组件不能接收 VisualState。
组件不能调用 FormalVisualGenerator。

## 3. 本阶段新增文件

新增：

1. `src/app/world/components/formal-world-view/formal-world-view.tsx`。
2. `src/app/world/components/formal-world-view/formal-world-view.styles.module.css`。
3. `src/app/world/components/formal-world-view/index.ts`。

## 4. 渲染原则

FormalWorldView 只读渲染 FormalVisualModel：

1. 从 model.canvas 渲染画布壳层。
2. 从 model.objects 渲染世界对象。
3. 从 model.actors 渲染 actor。
4. 从 model.environment 渲染环境摘要。
5. 从 model.hudSummary 渲染玩家可读 HUD。

FormalWorldView 不显示：

1. raw tags。
2. source diagnostics。
3. audit internals。
4. collision / support / influence debug boxes。
5. F / C / S / I。
6. 紫微斗数原始术语。

## 5. 边界

FormalWorldView 不能：

1. 生成 FormalVisualModel。
2. 生成 FormalWorldVisualItem。
3. 生成 FormalActorVisualItem。
4. 调用 buildFormalVisualModel。
5. 调用 buildFormalVisualModelFromSnapshot。
6. 生成 actor。
7. 生成 placement。
8. 填默认 anchor。
9. 修改 VisualState。
10. 修改 HomeMapState。
11. 读取 PNG。
12. 读取 WORLD_MAP_ASSETS。
13. 默认接入 pet。

## 6. 本阶段不做

本阶段不做：

1. 不接入 /world 页面。
2. 不修改 ProceduralRendererView。
3. 不修改 renderer schema / builder。
4. 不修改 world-loop。
5. 不新增 FormalVisualGenerator 逻辑。
6. 不生成世界事实。

## 7. 下一步

下一步进入：

```text
FORMAL-VIEW-01：FormalWorldView 接入演示入口或 debug preview
```

接入前仍需确认它只接收 FormalVisualModel。
