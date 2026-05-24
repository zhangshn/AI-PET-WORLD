> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD 素材模块系统文档 v1.0

## 0. 文档定位

本文档承接架构冻结、生命到视觉映射、世界视觉语言三份文档：

- `docs/mvp/AI_PET_WORLD_ARCHITECTURE_FREEZE.md`
- `docs/mvp/LIFE_TO_VISUAL_WORLD_MAPPING.md`
- `docs/mvp/WORLD_VISUAL_LANGUAGE.md`

本文档只定义素材模块规则，不实现代码，不生成 PNG，不修改 `world-map-asset-registry.ts`，不修改 Renderer、PlacementEngine、InitialHomeGenerator、命理核心、worldEngine、systems 或 `/world` 页面。

本文档用于后续开发：

- AssetModuleSelection
- Asset Lab
- `world-map-asset-registry`
- Renderer
- PlacementEngine

本文档不是美术外包规范，不是 UI 原型图，不是整图设计稿。当前目标是低保真 MVP 素材系统：风格统一、可用、可替换、可验证世界逻辑。

## 1. 核心原则：Asset ≠ UI ≠ Wallpaper

Asset、UI、Wallpaper 必须严格区分。

| 类型 | 定义 | 允许进入正式 `/world` 主链路吗 |
| --- | --- | --- |
| Asset | 单个可注册素材；有 assetId、path、size、anchor、layer；可被 PlacementEngine 使用 | 是，但只能通过 assetId + registry + placement |
| UI | 页面、按钮、调试工具、Asset Lab 预览；可辅助生成或验证素材 | 否，不能决定世界业务关系，不能直接作为正式地图内容 |
| Wallpaper | 整张背景图、合成后的完整地图 | 否，正式 `/world` 禁止使用 |

禁止事项：

- 禁止把整张地图当 `<img>`。
- 禁止 CSS `background-image` 作为完整地图。
- 禁止把草地、道路、树、建筑合成一张大图。
- 禁止 `page.tsx` 手写素材路径。
- 禁止 VisualProfile 直接 import PNG。
- 禁止 Renderer 生成世界数据。

正确方向：

```text
assetId + registry + MapPlacement + HomeMapState + Renderer
```

## 2. 素材模块总链路

冻结链路为：

```text
VisualProfile
→ AssetModuleSelection
→ assetId
→ world-map-asset-registry
→ MapPlacement
→ HomeMapState
→ buildHomeMapRenderModel
→ HomeMapRenderer
```

| 层级 | 职责 |
| --- | --- |
| VisualProfile | 只提供偏好，不提供图片路径，不 import PNG |
| AssetModuleSelection | 根据偏好和 registry 选择 assetId，可以输出候选、权重、replacementGroup |
| world-map-asset-registry | 管理 assetId 到 path、尺寸、层级、锚点、标签的映射，是唯一素材路径入口 |
| MapPlacement | 表示某个 assetId 出现在世界哪个位置，包含 x/y、layer、scale、alpha、label、source、tags |
| HomeMapState | 保存所有 placements、zones、resources、constructionPlans、mapDiffs |
| buildHomeMapRenderModel | 把 HomeMapState 分层整理成 Renderer 可消费的 render model |
| HomeMapRenderer | 根据 render model 渲染，不做素材选择，不生成业务关系 |

当前代码已经体现了这条链路的核心骨架：`HomeMapState` 只记录 `assetId`，`HomeMapRenderer` 和 `HomeMapPlacementSprite` 通过 registry 解析素材路径。

## 3. AssetModule 基础字段

未来 AssetModule 建议字段如下。本节只定义字段，不写 TypeScript 代码。

| 字段 | 说明 |
| --- | --- |
| `assetId` | 稳定唯一 ID，世界状态只记录 assetId |
| `category` | 大类：ground / path / edge / nature / facility / structure / actor / atmosphere / decoration |
| `moduleType` | 业务类型：grass、tree、flower、food_bowl、pet_body 等 |
| `path` | 文件路径，只在 registry 中存在，不进入 VisualProfile 和 `page.tsx` |
| `size` | 像素尺寸 |
| `anchor` | 锚点：bottom-center、center、tile、top-left 等 |
| `layer` | 渲染层：ground、path、edge、zone、structure、facility、nature、surface-decoration、actor、atmosphere |
| `tags` | 通用标签 |
| `styleTags` | 风格标签：warm、quiet、structured、protective、aesthetic 等 |
| `visualBiasTags` | 对应 WorldVisualProfile / ButlerVisualProfile / PetVisualProfile 的偏好标签 |
| `supportedProfiles` | 适合哪些视觉 profile 使用 |
| `animationFrames` | 用于蝴蝶、宠物、管家等后续动画 |
| `collisionMode` | none、soft、solid、actor-only 等 |
| `placementRules` | 可摆放区域、承托需求、密度限制、是否可孤立 |
| `replacementGroup` | 后续正式美术替换时同组替换 |
| `clientReady` | 是否适合未来客户端直接使用 |
| `sourceType` | generated、manual、reference、external、placeholder |

这些字段的目标是让素材可注册、可组合、可替换、可验证，而不是把素材逻辑散落到页面、CSS 或 Renderer 里。

## 4. 素材分类

### 4.1 地表模块

包括：

- grass
- dirt
- path
- edge
- ground variation

用途：

- 构成地图基础。
- 不能用单一背景图代替。
- 必须通过 tile / placement 表达。

P0 建议：

- `ground_grass_base_01`
- `ground_grass_base_02`
- `ground_dirt_base_01`
- `path_dirt_horizontal_01`
- `path_dirt_vertical_01`
- `path_dirt_corner_*`
- `edge_grass_dirt_*`

### 4.2 自然模块

包括：

- tree
- bush
- grass_tuft
- flower
- stone
- fallen_leaf
- butterfly

用途：

- 表达自然边界。
- 表达探索目标。
- 表达美感、温暖、安全感。
- 表达 WorldVisualProfile 差异。

P0 建议：

- `nature_tree_small_01`
- `nature_bush_small_01`
- `surface_grass_tuft_01`
- `surface_flower_patch_01`
- `surface_stone_small_01`
- `surface_fallen_leaf_01`
- `nature_butterfly_yellow_01`

### 4.3 生活设施模块

包括：

- shelter
- arrival_point
- food_bowl
- water_bowl
- pet_bed
- storage_box
- lamp

用途：

- 表达照护、住所、资源、休息、宠物抵达。
- 必须有承托关系。
- 不能孤立摆放。

P0 建议：

- `building_temp_shelter_01`
- `facility_food_bowl_full_01`
- `facility_water_bowl_full_01`
- `facility_pet_bed_neat_01`
- `facility_storage_box_01`
- `facility_lamp_warm_01`
- `arrival_natural_clearing_01`

### 4.4 角色模块

包括：

- butler_body
- butler_pose
- butler_tool
- pet_body
- pet_ear
- pet_tail
- pet_eye
- pet_pose

用途：

- 表达管家和宠物的视觉身份。
- 后续由 ActorRuntimeState 控制位置、朝向、pose。
- 不应作为固定静态 placement 永久不动。

P0 建议：

- `butler_body_standard_01`
- `butler_pose_idle_01`
- `butler_pose_walk_01`
- `butler_pose_work_01`
- `pet_body_round_01`
- `pet_pose_idle_01`
- `pet_pose_walk_01`
- `pet_pose_eat_01`
- `pet_pose_sleep_01`

### 4.5 氛围模块

包括：

- shadow
- light
- night overlay
- glow
- floating particle
- butterfly motion

用途：

- 表达时间、天气、温暖度、生命感。
- 不承载核心业务逻辑。
- 不影响碰撞。

P0 建议：

- `atmosphere_shadow_soft_01`
- `atmosphere_lamp_glow_01`
- `atmosphere_butterfly_frame_01`
- `atmosphere_butterfly_frame_02`

## 5. 模块化绘制原则

现在不要求商业级美术。当前采用低保真温暖自然像素拼图风。

统一规则：

- 透明背景。
- 低饱和自然色。
- 尺寸统一。
- 锚点统一。
- 不用黑色硬描边。
- 底部必须有阴影或承托。
- 每个素材最多 5 个主色。
- 角色和设施尽量 3/4 俯视或轻俯视。
- 地图 tile 不要画成 UI 图标。
- 物件不能漂浮。
- 设施必须有地面承托。

尺寸建议：

- 32x32：地表、花草、石头、落叶、蝴蝶。
- 64x64：树、灌木、食物碗、水盆、宠物床、宠物、管家。
- 128x128：帐篷、抵达区大型组合、特殊设施。

后续正式美术可以逐个替换 PNG，但 assetId 和 replacementGroup 应尽量稳定。只要 assetId、尺寸、锚点、layer 和 replacementGroup 保持兼容，业务逻辑不应该因为美术替换而变化。

## 6. 用代码 / UI 生成素材的规则

用户不会手绘，所以允许用代码、Canvas、SVG、CSS、内部 UI 工具生成素材。

允许：

- Asset Lab 预览素材。
- Canvas 生成 PNG。
- SVG 生成 PNG。
- CSS 组合后导出 PNG。
- 脚本批量生成低保真素材。
- 人工挑选合格版本。

禁止：

- 正式 `/world` 直接用 div 画树。
- 正式 `/world` 直接用 CSS 画宠物。
- 正式 `/world` 直接把 Asset Lab 组件当地图。
- 生成后不注册 assetId。
- 生成整张地图背景图。
- 每次运行随机生成导致 assetId 不稳定。

流程必须是：

```text
Asset Lab / script
→ 生成 PNG
→ 保存 public/assets/generated/...
→ 注册 world-map-asset-registry
→ PlacementEngine 使用 assetId
→ Renderer 渲染
```

Asset Lab 是开发工具，不是正式游戏 UI。

## 7. 各类素材的生成配方

草地 tile：

- 基础绿色。
- 随机深浅像素点。
- 边缘轻微变化。
- 可重复拼接。

泥地 tile：

- 基础棕色。
- 中间稍亮。
- 边缘稍暗。
- 少量斑点。

小路：

- 中间泥地。
- 两侧草地过渡。
- 方向明确。
- 可做 horizontal / vertical / corner。

树：

- 树干。
- 3~5 个树冠块。
- 左上高光。
- 右下暗部。
- 底部阴影。

灌木：

- 低矮圆块组合。
- 顶部高光。
- 底部阴影。
- 适合边界。

草丛：

- 3~5 个草叶。
- 中间高、两侧低。
- 底部阴影。

小花：

- 草丛底座。
- 3~5 个彩色像素点。
- 不画复杂花瓣。

石头：

- 不规则椭圆。
- 左上高光。
- 右下暗部。
- 底部阴影。

落叶：

- 2~4 个小叶片。
- 暗绿 / 黄绿 / 浅棕。
- 随机朝向但导出固定版本。

蝴蝶：

- 2 帧动画。
- 中间身体。
- 左右翅膀。
- 用动画表达生命感，不靠复杂细节。

帐篷：

- 三角主体。
- 入口暗部。
- 底部泥地 / 木板承托。
- 小阴影。

食物碗：

- 椭圆碗。
- 碗口高光。
- 几粒食物点。
- 底部阴影。

水盆：

- 椭圆盆。
- 浅蓝水面。
- 高光点。
- 底部阴影。

宠物床：

- 椭圆垫子。
- 外圈稍暗。
- 中间柔和。
- 后侧靠垫。
- 底部阴影。

管家：

- 64x64。
- 头、身体、衣服、手、脚、工具包。
- 不追求五官细节。
- 第一批 idle / walk / work。

宠物：

- 64x64。
- 圆形宠物事实。
- 身体、耳朵、眼睛、尾巴、脚、阴影。
- 第一批 idle / walk / eat / sleep / alert。

## 8. AssetModuleSelection 规则

AssetModuleSelection 不生成图。它只根据 VisualProfile 和 registry 选择 assetId。

| 倾向 | asset 选择规则 |
| --- | --- |
| `structuredBuilder` 高 | clean path；storage；foundation；orderly support；lower random decoration |
| `warmCaretaker` 高 | pet bed；food bowl；water bowl；warm lamp；softer rest area |
| `protectiveKeeper` 高 | dense tree；bush boundary；safe corner；entry narrowing |
| `aestheticOrganizer` 高 | flower；butterfly；stone；fallen leaf；decorative lamp |
| `quietMaintainer` 高 | lower saturation；fewer decorations；stable maintenance assets；compact quiet rest area |
| `adaptivePlanner` 高 | asset choice can respond to pet state, weather, resource state, time |

AssetModuleSelection 只决定候选和权重，不决定坐标，不加载图片，不修改 HomeMapState。

## 9. PlacementEngine 使用规则

AssetModuleSelection 只决定候选和权重。PlacementEngine 决定摆放。

必须遵守：

- 建筑和设施不能孤立。
- 帐篷必须有泥地 / 木板 / 阴影承托。
- 食物碗、水盆必须有踩踏地面或照护区承托。
- 宠物床必须有休息区承托。
- 树、灌木形成边界时要成组，不随机孤立。
- 小花、草丛、石头用于过渡和点缀。
- 蝴蝶属于 atmosphere / animated nature，不影响碰撞。
- 角色 placement 只代表初始位置，后续由 ActorRuntimeState 控制。

当前 `src/world/placement/placement-rules.ts` 已经包含地表覆盖、建筑承托、设施承托、路径连续、碰撞、自然边界、装饰过渡等校验方向。后续 AssetModuleSelection 接入时应复用这些规则，而不是绕过 PlacementEngine。

## 10. world-map-asset-registry 规则

registry 是唯一素材路径入口。

registry 必须管理：

- assetId
- path
- size
- anchor
- layer
- tags
- optional metadata

禁止：

- `page.tsx` 直接引用 `public/assets` path。
- VisualProfile 直接引用 path。
- PlacementEngine 直接拼 path。
- Renderer 选择业务素材。

Renderer 只做：

```text
assetId → registry → path → render
```

当前 `src/world/map-assets/world-map-asset-registry.ts` 已经提供 `WORLD_MAP_ASSETS` 和 `getWorldMapAssetPath(assetId)`。后续扩展 metadata 时，仍应保持 registry 是路径和素材元数据的唯一入口。

## 11. public/assets 规则

建议路径：

```text
public/assets/generated/world/ground/
public/assets/generated/world/path/
public/assets/generated/world/edge/
public/assets/generated/world/nature/
public/assets/generated/world/facilities/
public/assets/generated/world/structures/
public/assets/generated/world/actors/
public/assets/generated/world/atmosphere/
```

规则：

- 生成素材放 `generated`。
- 手工素材可以放 `manual` 或 `source`。
- 不把参考图放进正式 `generated`。
- 不把 zip 直接作为运行素材。
- 文件命名必须和 assetId 对齐。
- 缺失文件列入 TODO，不删除 registry。

当前目录观察：

- `public/assets/generated/world/ground/`、`edges/`、`paths/`、`nature/`、`surface/`、`zones/` 已有素材。
- `public/assets/generated/home/arrival-point/`、`home/buildings/temp-shelter/`、`home/facilities/` 已有素材。
- 当前未观察到 `public/assets/generated/world/actors/` 目录，actor 占位素材需列入后续 TODO。
- `art-assets/references/` 和 `art-assets/source-zips/` 是参考与源包，不是运行时素材。

## 12. Actor 素材与 ActorRuntime 的关系

宠物和管家素材不是最终行为。素材只提供 pose / body / part。

ActorRuntimeState 控制：

- x
- y
- target
- facing
- pose
- movementState
- speed

角色素材分两阶段。

P0：

- 单体 sprite。
- idle / walk / eat / sleep / work。
- 不做复杂换装。

P1：

- 模块化零件。
- body / ear / tail / eye / clothes / tool。
- 由 PetVisualProfile / ButlerVisualProfile 组合。

不要一开始做复杂角色系统。先做能表达吃饭、休息、建设的最小 pose。当前 `MapPlacement` 中的 actor placement 只能作为初始位置或占位表达，长期行为应交给后续 ActorRuntimeState。

## 13. 未来客户端化规则

Web 是临时验证壳。素材系统必须为客户端复用。

客户端可复用：

- PNG assets
- assetId
- registry 数据结构
- HomeMapState
- MapPlacement
- ActorRuntimeState
- VisualProfile
- AssetModuleSelection 结果

客户端替换：

- Renderer Adapter
- Storage Adapter
- Input Adapter

禁止：

- 把素材逻辑写死在 React 组件。
- 把资产选择写进 CSS。
- 把地图关系写进 `app/page.tsx`。

只要客户端能读取同一批 assetId、registry、HomeMapState 和 ActorRuntimeState，就可以替换 Web Renderer，而不推翻世界生成、素材选择和地图状态合同。

## 14. P0 素材最小清单

第一批必须有的 P0 素材如下。

地表：

1. `ground_grass_base_01`
2. `ground_grass_base_02`
3. `ground_dirt_base_01`
4. `path_dirt_horizontal_01`
5. `path_dirt_vertical_01`
6. `path_dirt_corner_left_top_01`
7. `path_dirt_corner_right_top_01`
8. `path_dirt_corner_left_bottom_01`
9. `path_dirt_corner_right_bottom_01`

自然：

10. `nature_tree_small_01`
11. `nature_bush_small_01`
12. `surface_grass_tuft_01`
13. `surface_flower_patch_01`
14. `surface_stone_small_01`
15. `surface_fallen_leaf_01`
16. `nature_butterfly_yellow_01_frame_1`
17. `nature_butterfly_yellow_01_frame_2`

生活设施：

18. `building_temp_shelter_01`
19. `facility_food_bowl_full_01`
20. `facility_water_bowl_full_01`
21. `facility_pet_bed_neat_01`
22. `facility_storage_box_01`
23. `facility_lamp_warm_01`
24. `arrival_natural_clearing_01`

角色：

25. `butler_body_standard_01`
26. `butler_pose_idle_01`
27. `butler_pose_walk_01`
28. `butler_pose_work_01`
29. `pet_body_round_01`
30. `pet_pose_idle_01`
31. `pet_pose_walk_01`
32. `pet_pose_eat_01`
33. `pet_pose_sleep_01`
34. `pet_pose_alert_01`

如果 registry 已有同义 assetId，可以复用，不强制重复创建。如果文件缺失，列入 TODO，不删除 registry。

## 15. 当前已知 TODO

根据 `docs/mvp/PROJECT_FILE_AUDIT.md` 与当前目录观察，已知 TODO 为：

- 当前 registry 中部分 actor 占位路径存在 404 风险。
- 需要对齐 `public/assets` 与 `world-map-asset-registry`。
- P0 文档命名与 registry 实际路径可能存在兼容命名差异。
- 后续 Asset Lab 应优先生成缺失 actor 占位素材。
- 不删除已有 registry 项，先补文件或做兼容映射。

具体风险示例：

- `/assets/generated/world/actors/butler_body_standard_01.png`
- `/assets/generated/world/actors/pet_part_body_round_01.png`
- `/assets/generated/world/actors/pet_pose_skeleton_idle_front_01.png`

这些路径应作为后续素材补齐任务处理，本轮不生成、不移动、不删除。

## 16. 禁止事项

必须禁止：

- 不做整图地图。
- 不做原型图背景。
- 不把 UI 当素材。
- 不把素材选择写进 `page.tsx`。
- 不让 Renderer 决定业务关系。
- 不让 VisualProfile import PNG。
- 不让 PlacementEngine 拼图片路径。
- 不删除测试素材。
- 不删除参考素材。
- 不删除缺失文件对应 registry，先列 TODO。
- 不追求商业级美术。
- 不因素材不好看改命理核心。
- 不因素材不好看改世界生成核心。

素材问题只能通过 Asset Lab、registry、PNG 替换、AssetModuleSelection 和 PlacementEngine 规则解决，不能向命理核心、worldEngine 或 `/world` 页面转嫁。

## 17. 验收标准

后续实现必须满足：

1. 每个正式素材都有 assetId。
2. 每个正式素材都能在 registry 中找到 path。
3. HomeMapState 只记录 assetId，不记录 React 组件。
4. Renderer 通过 registry 渲染。
5. `page.tsx` 不写素材路径。
6. VisualProfile 不写素材路径。
7. AssetModuleSelection 只返回 assetId / 权重。
8. PlacementEngine 只处理摆放关系，不处理图片加载。
9. P0 素材能支持宠物吃饭、宠物休息、管家建设三个闭环。
10. 后续正式美术可逐个替换 PNG，不改业务逻辑。
11. 未来客户端可复用 assetId、registry、PNG、HomeMapState。

## 18. 后续代码落地建议

只建议，不执行。

后续新增：

```text
src/world/asset-modules/
  asset-module-schema.ts
  asset-module-selector.ts
  asset-module-rules.ts
  asset-module-groups.ts

src/app/asset-lab/
  page.tsx

scripts/generate-pixel-assets.ts
```

执行顺序：

1. 先检查 registry 与 `public/assets` 对齐。
2. 再补缺失 actor 占位素材。
3. 再写 asset-module-schema。
4. 再写 asset-module-selector。
5. 再做 Asset Lab。
6. 再接入 VisualProfile / WorldGeneration。

以上均为后续建议，本轮不执行。

## 19. 下一步任务

下一步任务只建议，不执行：

```text
LIFE-CORE-PROFILE-TYPES-05
```

任务目标：

开始进入代码阶段。新增 LifeCoreProfile 类型与 builder 目录，但不接入 `/world`，不改命理核心，不改 Renderer。
