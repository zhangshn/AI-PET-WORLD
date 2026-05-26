# Pixel Scene Composer 阶段验收记录

本文记录 `/world-debug/pixel-scene-composer` 当前阶段的测试结论、参数语义和下一步拆分方向。

## 当前结论

当前测试页作为“像素世界组合算法验证器”阶段性通过。

它验证的不是单个素材是否足够精修，而是以下内容是否能组成一个整体：

- 地面 tile
- 道路 path
- 草地 / 道路边缘过渡
- 草簇
- 树
- 灌木
- 石头
- 花
- 角色占位
- y-sort 深度排序
- 统一地貌色盘

当前结论：可以继续作为后续 World Painter / Scene Composer 的实验底座。

## 参数语义

### biome

`biome` 表示地貌类型。

当前用于验证：

- forest
- grassland
- desert
- oasis

它影响整体色盘、植被倾向、道路宽度和装饰风格。

### moisture

`moisture` 表示湿度状态。

它应该影响：

- 地面湿润/干燥观感
- 草高
- 草色
- 叶色
- 树冠健康感
- 场景厚重感

它不应该作为“重新生成整张地图”的随机种子。

正确方向：同一条道路、同一个世界结构下，湿度改变只改变视觉状态，不重洗场景结构。

### density

当前 UI 里显示为 `density`，实际语义应理解为 `decorationDensity`。

它表示装饰/植被显现密度，不是“世界是否存在树”的根本事实。

它可以影响：

- 草簇数量
- 小花数量
- 石头数量
- 灌木数量
- 路边装饰数量
- 场景繁茂程度

它不应该被理解为正式世界里的“成熟大树开关”。

在当前测试器里，density 可以用于快速观察不同装饰密度下的画面表现。

### pathCurve

当前 UI 里显示为 `pathCurve`，实际语义应理解为 `roadShape` 或 `roadPlanPreview`。

它不是管家走路时实时改变道路。

它表示不同道路生成方案的测试参数。

正确理解：

- pathCurve 改变 = 测试另一种道路结构方案
- 道路变，道路两边依附道路生成的生态也应该跟着变
- 路边草、花、小石头、灌木、路边树苗可以变化
- 这不是正式世界里“管家走到哪，路就马上变到哪”

## 与正式世界的边界

当前测试页不是正式世界存档，也不是正式 HomeMapState。

它是一个视觉规则实验器，用于验证“素材组合算法”能否降低贴图感。

正式世界中应拆分为：

1. WorldState / HomeMapState
   - 真实世界事实
   - 例如房屋、孵化器、长期树木、道路、宠物、管家位置

2. SceneCompositionPlan
   - 把世界事实翻译成场景组合计划
   - 决定哪些对象在道路边、哪些对象在前景、哪些对象需要遮挡

3. Pixel Painter Modules
   - 单体素材绘制模块
   - 例如 tree painter、grass painter、path painter、stone painter、flower painter

4. Renderer
   - 只负责呈现
   - 不创造正式世界事实

## 当前测试通过标准

当前阶段通过标准如下：

- 道路变化时，路边生态可以跟着变化
- 湿度变化时，主要改变视觉状态，不应重洗道路结构
- 装饰密度变化时，场景繁茂程度变化明显
- 地面、路径、边缘、草、树、灌木、石头、花可以组成整体画面
- 画面不再只像单独贴上一棵树，而是开始像一个像素世界场景

## 下一阶段建议

下一阶段不要继续只抠单张测试图，应进入正式拆分：

1. 保留 `/world-debug/pixel-scene-composer` 作为实验页。
2. 把测试模块拆成正式结构：
   - scene-composer
   - terrain painter
   - path painter
   - vegetation painter
   - object painter
   - layer / y-sort system
3. 新增初始家园场景验证：
   - 空地
   - 孵化器
   - 管家占位
   - 初始路径/活动痕迹
   - 稀疏植被
4. 后续再接入 HomeMapState / worldEngine，而不是直接把测试 SVG 当正式世界。

## 当前状态

状态：阶段性通过，可进入下一步正式化拆分。
