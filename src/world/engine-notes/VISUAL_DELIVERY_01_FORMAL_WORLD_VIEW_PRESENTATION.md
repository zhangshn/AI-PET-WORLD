# AI-PET-WORLD VISUAL-DELIVERY-01 Formal World View Presentation

## 当前模块目标

本阶段把 `/world` 默认正式主视觉从工程几何预览推进到低保真像素家园雏形。

本阶段是视觉表现交付，不是世界事实生成阶段。

## 已完成内容

| 完成项 | 说明 |
|---|---|
| FormalWorldView 表现增强 | FormalWorldView 仍只接收 `FormalVisualModel`，但以像素草地、路径、结构、资源、自然边界和管家占位的方式呈现 |
| Canvas 氛围增强 | 根据 model 的 mood / atmosphere 增加温暖、安静、清晨、夜晚、雨天等表现 class |
| SVG 表现增强 | 使用 SVG pattern / className 表现低保真草地、道路、资源堆和自然层级 |
| HUD 增强 | HUD 卡片更接近玩家可读 UI，不显示 raw tags / source / diagnostics |
| /world 页面层级整理 | Formal 主视觉保持默认核心位置，Debug 视图保留但不抢占主视觉 |
| MVP ViewModel 增强 | 只读增加氛围、世界阶段、伙伴后置状态等展示字段 |

## 本轮改哪些文件

| 文件 | 说明 |
|---|---|
| `src/app/world/components/formal-world-view/formal-world-view.tsx` | 增加只读表现 class、SVG pattern defs、actor 低保真占位呈现 |
| `src/app/world/components/formal-world-view/formal-world-view.styles.module.css` | 新增低保真像素家园视觉样式 |
| `src/app/world/world-route-page.tsx` | 使用增强后的 ViewModel 字段展示 MVP 摘要 |
| `src/app/world/world-route-page.styles.module.css` | 调整页面为更温暖的产品化主视觉层级 |
| `src/app/world/mvp-world-view-model.ts` | 增加只读氛围、阶段和伙伴状态摘要 |

## 本轮不改哪些文件

| 范围 | 说明 |
|---|---|
| `src/world/map-state/*` | 不修改 HomeMapState / MapDiff schema |
| `src/world/placement/*` | 不修改 PlacementEngine |
| `src/world/generation/*` | 不修改世界生成逻辑 |
| `src/world/construction/*` | 不修改建设链路 |
| `src/world/world-loop/*` | 不接真实 scheduler |
| `src/world/formal-visual-model/*` | 不修改 FormalVisualModel / FormalVisualGenerator |
| `public/*` | 不新增图片或素材依赖 |

## 视觉交付标准

| 标准 | 状态 |
|---|---:|
| 默认进入 `/world` 可看到正式主视觉 | 已完成 |
| 主画布有柔和草地 / 地面背景 | 已完成 |
| 道路不再像普通线框 | 已完成 |
| 结构 / shelter 有更强生活区视觉 | 已完成 |
| 资源 / storage 有储备区表现 | 已完成 |
| nature / boundary 有自然边界表现 | 已完成 |
| actor 有低保真管家占位 | 已完成 |
| HUD / 日志 / P-Phone 仍可读 | 已完成 |
| Debug 视图保留 | 已完成 |

## 红线

1. UI 不生成世界事实。
2. FormalWorldView 只读 `FormalVisualModel`。
3. CSS 只控制表现，不决定对象存在。
4. 不默认显示宠物。
5. 不创建 pet actor / pet bed / pet_arrival / pet_rest。
6. 不读取 PNG / WORLD_MAP_ASSETS 作为事实来源。
7. 不修改世界生成层。
8. 不修改 Construction / SafeApply / world-loop。
9. 不绕过 `buildFormalVisualModelFromSnapshot`。

## 验证方式

| 验证项 | 命令 / 检查 |
|---|---|
| Lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| Build | `npm run build` |
| 页面检查 | `/create-world` 创建世界后进入 `/world`，默认显示 Formal 主视觉 |
| 红线检查 | 搜索 `Date.now` / `Math.random` / `any` 和旧宠物 token |
