# AI-PET-WORLD FORMAL-VIEW-03 /world 只读接入 FormalVisualModel

## 1. 阶段定位

本阶段已在 /world 中只读接入真实 FormalVisualModel。

本阶段不是替换 Debug Renderer。

本阶段不是世界生成层。

本阶段不修改 world-loop。

本阶段不修改 HomeMapState。

本阶段不修改 FormalVisualGenerator。

本阶段不修改 FormalVisualModel schema。

## 2. 当前真实链路

当前 /world 接入链路为：

```text
runtimeState.currentRenderableSnapshot
-> buildFormalVisualModelFromSnapshot
-> FormalVisualModel
-> FormalWorldView
```

FormalVisualModel 来自 `runtimeState.currentRenderableSnapshot`。

FormalWorldView 只接收真实链路生成的 FormalVisualModel。

## 3. 本阶段接入方式

本阶段在 `WorldRuntimeShell` 内使用 `useMemo`：

```text
runtimeState.currentRenderableSnapshot
-> buildFormalVisualModelFromSnapshot(...)
```

然后在现有 ProceduralRendererView 后方新增 FormalWorldView 区域。

## 4. 本阶段明确没有做

本阶段没有：

1. 使用 preview mock。
2. 引用 `PREVIEW_FORMAL_VISUAL_MODEL`。
3. import `formal-world-view.preview`。
4. 修改 FormalWorldView。
5. 修改 FormalVisualGenerator。
6. 修改 FormalVisualModel schema。
7. 修改 renderer。
8. 修改 world-loop。
9. 修改 HomeMapState。
10. 生成 world object。
11. 生成 placement。
12. 生成 actor。
13. 读取 PNG。
14. 读取 WORLD_MAP_ASSETS。
15. 默认接入 pet。

## 5. Debug Renderer 保留

本阶段保留 ProceduralRendererView。

当前 /world 同时包含：

1. ProceduralRendererView：Debug / Dev View。
2. FormalWorldView：真实 FormalVisualModel 的只读主视觉预览。

Debug Renderer 未迁移前必须保留。

## 6. 下一步

下一步进入：

```text
FORMAL-VIEW-04：正式 / Debug 视图切换策略或主视觉布局整理
```
