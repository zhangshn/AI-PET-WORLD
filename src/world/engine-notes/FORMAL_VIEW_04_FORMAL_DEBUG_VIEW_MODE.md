# AI-PET-WORLD FORMAL-VIEW-04 正式 / Debug 视图切换策略

## 1. 阶段定位

本阶段整理 /world 页面中 FormalWorldView 与 ProceduralRendererView 的呈现关系。

默认显示 FormalWorldView。

Debug Renderer 保留，但不作为默认主视觉。

Both 模式用于开发对照，不作为最终玩家默认体验。

## 2. 当前视图模式

`/world` 新增本地 UI 状态：

```ts
viewMode: "formal" | "debug" | "both"
```

默认值为：

```ts
"formal"
```

## 3. 显示规则

1. Formal 模式只显示 FormalWorldView。
2. Debug 模式只显示 ProceduralRendererView。
3. Both 模式同时显示 FormalWorldView 与 ProceduralRendererView。
4. Debug Renderer 必须保留，不能删除。
5. FormalVisualModel 仍然来自 `runtimeState.currentRenderableSnapshot`。

## 4. viewMode 边界

viewMode 只是 UI 显示状态。

viewMode 不进入 world-loop。

viewMode 不修改 HomeMapState。

viewMode 不参与 FormalVisualModel 生成。

viewMode 不生成 world object / placement / actor。

viewMode 不写入持久化。

## 5. 本阶段没有做

本阶段没有：

1. 使用 preview mock。
2. import `formal-world-view.preview`。
3. 引用 `PREVIEW_FORMAL_VISUAL_MODEL`。
4. 修改 FormalVisualGenerator。
5. 修改 FormalVisualModel schema。
6. 修改 world-loop。
7. 修改 HomeMapState。
8. 生成 world object。
9. 生成 placement。
10. 生成 actor。
11. 读取 PNG。
12. 读取 WORLD_MAP_ASSETS。
13. 默认接入 pet。

## 6. 下一步

下一步是 WORLD-GEN-00 或 FORMAL-VIEW-05，待检查后决定。
