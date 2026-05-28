# AI-PET-WORLD V2.6｜M11 正式像素主世界视觉目标

> 本文档用于锁定 MVP 阶段 `/world` 正式视觉方向，防止主世界回退成开发预览页、调试页或工程面板页。

## 1. 目标结论

`/world` 的正式目标不是“把地图完整塞进一个调试框”，而是让用户看到一个沉浸式的自主像素家园。

目标观感：

```txt
一整块可以被观察的像素森林 / 像素家园。
世界画面占据主视觉。
UI 信息轻量覆盖或收纳。
用户第一眼看到的是世界本身，而不是工程容器。
```

## 2. 正式视觉方向

正式 `/world` 后续应靠近以下视觉方向：

- 画面像完整的像素森林，而不是左侧地图预览。
- Canvas / pixel scene 应铺满主视觉区域。
- 页面不应出现大面积无意义空白。
- 地图可以使用 cover / crop / viewport 方式适配屏幕。
- 不强制展示完整 1920x1152 世界边界。
- 用户看到的是“正在运行的世界窗口”，不是“完整数据画布”。
- 管家、树、草、石头、花、痕迹和生态过渡应自然分布。
- 画面密度要接近自然森林，而不是稀疏格子。
- UI 不应遮挡核心视觉体验。

## 3. 适配原则

当前画布尺寸可以继续由 WorldViewModel 输出，但正式展示方式必须从“完整展示画布”转向“视口展示世界”。

优先级：

```txt
沉浸式视口体验 > 完整画布可见性
自然世界观感 > 调试完整性
用户理解 > 工程信息展示
```

允许策略：

- Canvas 使用 `object-fit: cover` 或等效缩放裁切。
- 主世界区域使用 `overflow: hidden`。
- 桌面端优先 16:9 / 16:10 大视口。
- 移动端允许垂直裁切和信息卡片折叠。
- 后续可增加 camera / viewport / focus target 概念。

不允许策略：

- 右侧或下方出现大片空白。
- 因为完整画布比例而牺牲主视觉区域。
- 把 Debug 面板、审计字段、底层结构放进正式页面。
- 使用 SVG / Scene Composer / ProceduralRenderer 替代正式 PixelWorldView。

## 4. 信息层目标

正式 `/world` 仍然需要解释世界，但解释层不能抢占主画面。

后续 UI 方向：

- 管家说明改为轻量浮层或底部小卡。
- P-Phone 改为消息入口、浮动卡片或抽屉。
- 当前运行记录可保留，但应弱化为状态徽章。
- 不展示 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词。
- 不在正式 UI 中展示 raw debug / score / JSON。

## 5. 世界内容口径

正式像素主世界仍然遵守当前业务红线：

- 不默认生成宠物。
- 不引入独立 road / path 架构。
- 移动结果归入痕迹体系。
- 管家只是管理者，不替宠物做决定。
- 玩家是世界源头和观察者，不是直接控制者。
- 世界变化必须来自 HomeMapState、TraceField、管家行为闭环和世界规则验证。

## 6. M11-3 下一步

M11-3 的目标不是重写画图算法，而是先修正式页面布局：

```txt
1. /world 主视觉区域铺满屏幕宽度
2. 移除右侧大片空白
3. Canvas 以 viewport / cover 方式展示
4. 管家说明和 P-Phone 从占位卡片变成轻量信息层
5. 保持 PixelWorldView 主链路不变
6. 增加 smoke 守卫正式视觉布局不回退
```

后续如果要继续靠近目标图效果，再进入像素世界内容密度优化：

```txt
natural object density
forest canopy layering
grass variation
trace visibility balance
foreground/background depth
camera focus target
```

这些属于 M11 后半段或 MVP 美术收口，不属于 M8/M9/M10。