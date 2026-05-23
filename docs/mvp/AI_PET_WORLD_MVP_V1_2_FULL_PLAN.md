> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD MVP 完整计划书 v1.2

完整版｜命理人格核心 + 世界生成与自主建设层 + 像素资产管线 + Renderer 数据驱动 UI

本文档是 AI-PET-WORLD MVP v1.2 主线计划。

后续所有 `/world`、地图、世界生成、管家建设、像素素材、Renderer、Placement Engine、MapDiff 相关任务，必须先读取本文档。

本文档用于防止 AI / Codex 把原型图误解为背景图、贴图或静态 UI。

本文档用于保护命理人格核心，不允许因为 UI 或地图生成任务重写 `personality-core` / `destiny-core` / `ziwei-core`。

本文档用于明确 AI-PET-WORLD 不是普通像素宠物游戏，而是命理人格 + AI 管家 + AI 宠物 + 自主世界生成 + 自主建设的像素生命世界。

## 目录

0. [本版本修正说明](#0-本版本修正说明)
1. [MVP 总目标](#1-mvp-总目标)
2. [完整核心架构：横向八层 + 纵向生命线层](#2-完整核心架构横向八层--纵向生命线层)
3. [命理人格核心层（紫微斗数 / 八字）](#3-命理人格核心层紫微斗数--八字)
4. [命理人格算法管线与输出结构](#4-命理人格算法管线与输出结构)
5. [管家人格生成与建设风格映射](#5-管家人格生成与建设风格映射)
6. [宠物人格生成与自主行为关系](#6-宠物人格生成与自主行为关系)
7. [世界时间、资源与建设规则](#7-世界时间资源与建设规则)
8. [世界生成与自主建设层](#8-世界生成与自主建设层)
9. [像素世界设计系统与 Initial Home Scene Recipe](#9-像素世界设计系统与-initial-home-scene-recipe)
10. [禁止贴图 UI：Design ≠ Asset ≠ Wallpaper](#10-禁止贴图-uidesign--asset--wallpaper)
11. [Pixel Asset Pipeline：MVP 像素资产生产管线](#11-pixel-asset-pipelinemvp-像素资产生产管线)
12. [MVP v1.2 阶段计划总表](#12-mvp-v12-阶段计划总表)
13. [建议文件目录与职责](#13-建议文件目录与职责)
14. [核心数据结构草案](#14-核心数据结构草案)
15. [MVP 数据流与运行闭环](#15-mvp-数据流与运行闭环)
16. [Codex 开发纪律](#16-codex-开发纪律)
17. [MVP v1.2 验收标准](#17-mvp-v12-验收标准)
18. [当前已推进进度记录](#18-当前已推进进度记录)
19. [下一步执行顺序](#19-下一步执行顺序)
20. [最终结论](#20-最终结论)
- [附录 A：开发时必须重复确认的硬规则](#附录-a开发时必须重复确认的硬规则)
- [附录 B：给 AI / Codex 的固定开场检查](#附录-b给-ai--codex-的固定开场检查)

## 0. 本版本修正说明

AI-PET-WORLD 的完整 MVP 不是“一个像素地图页面”，而是由真实生命信息、命理人格算法、AI 管家、AI 宠物、世界时间、资源循环、地图生成、管家建设、像素渲染共同构成的自主生命世界。

一句话定义：

AI-PET-WORLD 是一个以玩家真实生命信息为源头，由命理人格算法生成 AI 管家与 AI 宠物底层人格，再由世界生成层和自主建设层驱动家园长期成长的像素生命世界。

本版本必须修正以下认知：

1. 玩家不是直接操作者，而是世界源头、观察者和陪伴者。
2. 管家不是工具人，而是玩家生命信息映射出的自主意识管理者。
3. 宠物不是普通宠物素材，而是拥有出生 / 抵达时刻人格底色、状态、记忆和行为演化的独立生命。
4. MVP 不能只做 UI、地图生成和像素资产管线。
5. MVP 必须保留命理人格核心，这是第一护城河。

## 1. MVP 总目标

MVP 目标不是一次性完成完整游戏，也不是做一个好看的静态地图。MVP 必须证明以下核心闭环成立：

1. 玩家输入真实生命信息后，系统能生成管家的源头人格与管理风格。
2. 宠物通过真实抵达 / 分配时刻建立人格底色，不通过孵化仓 / 胚胎 / hatch 概念进入产品。
3. 世界能生成一个可见、可保存、可继续变化的初始像素家园。
4. 管家能根据资源、宠物需求、世界时间、天气、事件和人格倾向，自主形成建设意图。
5. 建设意图不是直接改前端代码，而是生成 `ConstructionPlan` / `MapDiff` / `placements` 等世界变化数据。
6. 前端 Renderer 只负责稳定渲染 `HomeMapState`，让玩家看见家园逐步成长。

最小成功标准：

玩家打开 `/world` 后能看到一个真实可理解的像素家园，并且这个家园不是手工写死的展示图，而是未来能够被管家继续建设和改变的世界状态。

## 2. 完整核心架构：横向八层 + 纵向生命线层

### 横向八层

1. 玩家源头层：玩家真实出生信息、世界 seed、账户世界入口。
2. 命理人格层：紫微斗数 / 八字输入规范化、排盘、星曜、宫位、组合与人格映射。
3. 人格映射层：`BirthPattern` -> `PersonalityProfile` -> 管家 / 宠物行为倾向、建设风格、视觉倾向。
4. 意识核心层：管家与宠物的自主意识、当前关注、判断、犹豫、靠近、回避等认知基础。
5. 状态 / 记忆 / 关系层：短期状态、长期记忆、管家与宠物关系、世界事件历史。
6. 自主驱动层：`eat`、`rest`、`approach`、`explore`、`observe`、`avoid` 等驱动。
7. 行为执行层：管家任务、宠物动作、建设阶段、路径移动、Pose 映射。
8. 世界运行层：`worldEngine`、时间、资源、生态、地图、离线运行、持久化。

### 纵向生命线层

纵向生命线层贯穿所有层，负责长期阶段、成长轨迹、AI 世界时间、未来 AI 纪元、宠物生命周期、家园成长阶段和小镇演化。

## 3. 命理人格核心层（紫微斗数 / 八字）

命理人格核心是 AI-PET-WORLD 的第一护城河。没有这一层，项目会退化成普通像素宠物游戏。

核心原则：

1. 玩家真实出生信息用于生成管家的源头人格和管理风格。
2. 宠物人格由宠物真实抵达 / 分配时刻生成。
3. 游戏世界时间可以加速，但真实命理时间不能被游戏时间加速。
4. 正式 UI 不显示紫微斗数术语，只显示人格结果、行为倾向、管家解释和世界变化。
5. 调试页可以显示时辰、星曜、宫位、`BirthPattern`、`PersonalityProfile` 等内部信息。

必须保护的核心文件职责：

- `src/ai/personality-core/lunar.ts`
  - 公历转农历、时辰映射、真实时间输入规范化。
- `src/ai/personality-core/ziwei-engine.ts`
  - 紫微斗数核心排盘计算。
- `src/ai/personality-core/calculator.ts`
  - 适配层，只把 `ziwei-engine` 输出转为 `BirthPattern`。
- `src/ai/personality-core/mapper.ts`
  - `BirthPattern` -> `PersonalityProfile`。
- `src/ai/personality-core/constants.ts`
  - 权重、阈值、空宫 / 借宫强度等常量。
- `src/ai/personality-core/evolution.ts`
  - 未来成长、时间漂移、长期阶段影响的占位层。
- `src/ai/personality-core/gateway.ts`
  - 统一入口，只暴露 `buildBirthPattern`、`buildPersonalityFromPattern`、`buildPersonalityProfile`。
- `src/ai/personality-core/schema.ts`
  - `BirthPattern`、`PersonalityProfile`、trait、tag、summary 等类型定义。

知识库目录：

- `knowledge/starProfiles.ts`
- `knowledge/pairRelations.ts`
- `knowledge/pairProfiles.ts`
- `knowledge/pairProfiles/*`
- `knowledge/labels.ts`
- `knowledge/priorities.ts`
- `knowledge/summaries.ts`
- `knowledge/emptyState.ts`

硬规则：

`ziwei-engine.ts` 视为稳定核心。除非明确扩展算法，否则不能因为 UI、地图、世界生成任务去重写它。

## 4. 命理人格算法管线与输出结构

算法流程：

```txt
BirthInput
→ Time Normalization
→ Lunar Conversion
→ Ziwei Plate
→ BirthPattern
→ PersonalityProfile
→ Runtime Influence
```

输入字段：

- `year`
- `month`
- `day`
- `hour`
- `minute`
- `timezone`
- `gender` / `perspective`

输出字段：

- `corePersonality`
- `traits`
- `tags`
- `constructionStyle`
- `behaviorBias`
- `relationBias`
- `eventTone`
- `debugLogs`

十四主星必须作为人格底层基线，不再使用抽象 `core_symbol`。组合人格使用 `pairRelations` + `pairProfiles`。空宫不是错误，而是通过借对宫、三方四正修正、虚化倾向形成独特人格表现。

## 5. 管家人格生成与建设风格映射

管家生成流程：

```txt
玩家输入真实出生年月日 / 出生时间
→ personality-core 生成 ButlerPersonalityProfile
→ PersonalityProfile 映射为 ButlerConstructionStyle
→ 管家在世界中以该风格进行观察、整理、照护、建设和解释
```

建设风格字段：

- `structured_builder`
  - 优先路径、地基、储物、秩序结构。
- `warm_caretaker`
  - 优先宠物床、食物角、水盆、暖光。
- `protective_keeper`
  - 优先围栏、安全角落、观察点、边界。
- `aesthetic_organizer`
  - 优先花草、灯、装饰、庭院美感。
- `quiet_maintainer`
  - 优先稳定、低调、耐久、安静区域。
- `adaptive_planner`
  - 根据宠物状态和资源变化动态调整。

验收标准：

同样的世界资源条件下，不同玩家生成的管家，在建设优先级、解释语气、区域选择和视觉倾向上应出现可观察差异。

## 6. 宠物人格生成与自主行为关系

宠物是独立自主生命，不是玩家手里的道具。

规则：

1. 宠物真实抵达 / 分配时刻作为宠物人格映射时间。
2. 宠物出生或抵达前不显示完整人格结果。
3. 宠物人格影响行为倾向，但行为仍由人格 + 当前状态 + 记忆 + 环境共同决定。
4. 宠物不能在事件文本里说人话。事件表达应以动作、状态、情绪、环境反应为主。

MVP 先做到：宠物拥有可被行为系统读取的人格 profile，正式 UI 不暴露紫微术语。

## 7. 世界时间、资源与建设规则

三层时间：

1. 真实命理时间：用于玩家管家人格、宠物抵达人格，不加速。
2. AI 世界时间：用于昼夜、资源、天气、宠物作息、管家建设，可加速。
3. AI 纪元时间：未来用于世界历史、社区文明、小镇阶段，MVP 只保留概念。

资源规则：

1. 资源不是商城凭空刷新。
2. 资源有位置、恢复速度、消耗方式和生态关系。
3. 建设不能凭空发生，必须有土地、空间、材料、时间和管家意图。
4. 草地、树、落叶、石头、木材、泥土、水、休息空间都是世界资源的一部分。

建设规则：

玩家不直接点击建造。家园变化来自管家判断、宠物需求、资源状态、天气、时间和事件。

## 8. 世界生成与自主建设层

该层用于解决“AI 直接写前端 UI 很丑、布局不自然、素材随机摆放”的根本问题。

它不是 UI，也不是单纯 `worldEngine`，而是把人格、资源、需求、建设意图转换成可见地图变化的中间层。

核心模块：

1. World Seed System：根据玩家 ID、真实出生信息、`worldSalt` 生成稳定世界种子。
2. HomeMapState：保存玩家当前家园地图，包括 zones、placements、resources、constructionPlans、mapDiffs。
3. Initial Home Generator：根据 seed、管家建设风格、P0 素材包和 scene recipe 生成第一张初始家园。
4. Placement Engine：按规则摆放素材，负责地面承托、路径连续、碰撞检测、装饰密度、区域关系。
5. MapDiff / Persistence：每次建设以增量变化写入地图，不覆盖整个世界。
6. Construction Planner：管家根据宠物需求、资源状态、天气、事件和人格形成建设意图。
7. Construction Executor：将建设计划分阶段执行，玩家能看到家园逐步变化。
8. Renderer：前端只读取 `HomeMapState` / placements / `MapDiff` 渲染，不自由设计地图。

首次生成流程：

```txt
玩家真实信息
→ 管家人格
→ worldSeed
→ InitialHomeGenerator
→ HomeMapState
→ Renderer
→ 玩家看到初始家园
```

后续建设流程：

```txt
worldEngine tick
→ 管家感知
→ ConstructionPlan
→ PlacementEngine
→ MapDiff
→ Renderer
→ 玩家看到家园成长
```

## 9. 像素世界设计系统与 Initial Home Scene Recipe

核心原则：

1. 原型图只代表业务关系，不代表最终视觉。
2. 参考图只学习画面组织方式，不照抄内容。
3. `/world` 正式页面不能默认显示白色网格和坐标标签。
4. 地图不是在草地上贴图标，而是区域、地面、道路、承托、主体、装饰、角色、氛围组成的世界。
5. 任何建筑或设施不能孤立摆放。
6. 帐篷必须有泥地 / 木板 / 阴影承托。
7. 食物碗、水盆必须有踩踏地面或生活区承托。
8. 宠物床必须有休息区承托。
9. 宠物抵达点必须是自然空地，不是科幻传送门，也不是孵化仓。

初始家园区域模板：

### 宠物抵达区

- 圆形或半圆形自然空地、草泥边缘、石头、小花、连接照护区的路径。

### 初始照护区

- 食物碗、水盆、踩踏泥地、草丛、小石头、连接住所和抵达点的路径。

### 临时住所区

- 帐篷、泥地 / 木板底座、小灯、储物、路径连接。

### 宠物休息区

- 宠物床、小灯、安静草边、阴影、靠近但不贴住所。

### 自然边界区

- 树、灌木、石头、小花、落叶形成外围边界。

## 10. 禁止贴图 UI：Design ≠ Asset ≠ Wallpaper

过去 AI 经常把“设计稿 / 原型图”误解成“素材图 / 背景图”，导致地图被降维成静态贴图。

必须区分：

- 原型图 = 地图语法参考
- 素材图 = 可被注册的单个 asset
- 世界地图 = `HomeMapState` 中的 tiles / placements / zones / mapDiffs

绝对禁止：

1. 禁止把整张原型图用 `<img>` 贴到 `/world`。
2. 禁止把完整地图截图作为 CSS `background-image`。
3. 禁止用单一草地 PNG `background-repeat` 代替 ground tile layer。
4. 禁止把“草地 + 路 + 建筑 + 设施”合成一张大图。
5. 禁止让 AI 自由摆坐标后生成静态展示图。
6. 禁止在 `page.tsx` 手写大量地图坐标。
7. 禁止让 Renderer 生成世界数据。
8. 禁止让 UI 层决定建筑、道路、设施、角色的业务关系。
9. 禁止恢复旧 `WorldObserveLayout`、`WorldPixelStage`、`P-Phone`、`MiniMap`、`DeveloperDock` 作为正式 `/world` 主链路。

正确做法：

1. 地表必须由 `HomeMapState.placements` 中的 ground tile 组成。
2. 每个 tile 都必须是可寻址的数据：`id` / `assetId` / `x` / `y` / `layer` / `tags`。
3. 建筑、设施、自然物件、角色必须作为独立 Entity / Placement 存在。
4. Renderer 只能循环渲染 `renderModel.allPlacements`。
5. Placement Engine 负责区域关系、承托、路径、碰撞、密度。
6. MapDiff 负责增量变化，不覆盖整张地图。
7. CSS `background-image` 只允许用于单个 tile / sprite，不允许用于整张地图背景。

渲染层级：

```txt
ground
path
edge
zone
structure
facility
nature
surface-decoration
actor
atmosphere
```

判断标准：

如果一个修改让地图变成“一张背景图 + 几个绝对定位图标”，就是错误。

正确结果必须是：

```txt
Scene Recipe
→ Placement Engine
→ HomeMapState
→ RenderModel
→ HomeMapRenderer
→ 玩家看到可演化世界
```

每次涉及 `/world`、地图、像素、素材、Renderer、Placement 的任务，必须先声明：

```txt
原型图不是背景图。
原型图不是素材图。
地图必须由 HomeMapState 驱动。
Renderer 不允许自由设计地图。
所有可见变化必须来自 placements 或 MapDiff。
```

## 11. Pixel Asset Pipeline：MVP 像素资产生产管线

MVP 阶段策略：

低保真温暖自然像素拼图风 + P0 最小资产包 + AI 生成候选 + 人工筛选修正 + 后续正式替换。

风格定位：

- 32x32 tile 为基础。
- 低饱和度自然色。
- 俯视 / 轻微 3/4 视角。
- 温暖、柔和、自然。
- 不追求商业精美像素。
- 不做复杂动画。
- 不做成熟营地。
- 不做现代露营地。
- 不做科幻基地。

P0 最小素材包：

地面：

- `ground_grass_base_01`
- `ground_grass_base_02`
- `ground_dirt_base_01`

道路：

- `path_dirt_horizontal_01`
- `path_dirt_vertical_01`
- `path_dirt_corner_left_top_01`
- `path_dirt_corner_right_top_01`
- `path_dirt_corner_left_bottom_01`
- `path_dirt_corner_right_bottom_01`

边缘：

- `edge_grass_dirt_top_01`
- `edge_grass_dirt_bottom_01`
- `edge_grass_dirt_left_01`
- `edge_grass_dirt_right_01`

自然：

- `nature_tree_small_01`
- `nature_bush_small_01`

地表：

- `surface_grass_tuft_01`
- `surface_stone_small_01`
- `surface_flower_patch_01`
- `surface_fallen_leaf_01`

建筑：

- `building_temp_shelter_01`
- `building_pet_arrival_point_01`
- `building_initial_care_station_01`

设施：

- `facility_food_bowl_full_01`
- `facility_water_bowl_full_01`
- `facility_pet_bed_neat_01`
- `facility_storage_box_closed_01`

角色：

- `butler_body_standard_01`
- `pet_part_body_round_01`
- `pet_pose_skeleton_idle_front_01`

素材验收：

- 透明背景
- 尺寸正确
- 风格统一
- 无黑底
- 无残影
- 无脏点
- 可注册 `assetId`
- 可被 Placement Engine 调用

## 12. MVP v1.2 阶段计划总表

| 阶段 | 内容 |
| --- | --- |
| MVP-CORE | 基础世界运行、保存、离线、主舞台。 |
| ADOPTION | 孵化仓切换为领养中心，产品层不再显示孵化仓 / 胚胎 / hatch。 |
| AI-PERSONALITY-00 | 命理核心文档与接口冻结。 |
| AI-PERSONALITY-01 | 管家人格生成接入玩家真实出生信息。 |
| AI-PERSONALITY-02 | 宠物人格生成接入真实抵达 / 分配时刻。 |
| RULE-00/01 | 世界时间、资源、建设规则。 |
| PIXEL-RULE-00 | `PIXEL_WORLD_DESIGN_SYSTEM.md`。 |
| ASSET-PIPELINE-00 | `PIXEL_ASSET_PIPELINE.md` 与 P0 素材清单。 |
| WORLD-GEN-00 | World Seed System。 |
| WORLD-GEN-01 | `HomeMapState`。 |
| WORLD-GEN-02 | Initial Home Scene Recipe。 |
| WORLD-GEN-03 | Initial Home Generator。 |
| WORLD-GEN-04 | Placement Engine 最小版。 |
| WORLD-GEN-05 | MapDiff / Persistence。 |
| UI-06 | Renderer 读取 `HomeMapState` 渲染低保真初始家园。 |
| CONSTRUCTION-00 | Construction Planner。 |
| CONSTRUCTION-01 | Construction Executor 分阶段建设。 |
| UI-07 | 绑定 world state / pet / butler / home / `HomeMapState` / `MapDiff`。 |
| UI-08 | 紫微 / 八字视觉映射。 |
| UI-09 | 正式美术替换，后置。 |
| COMMUNITY-00 | 小镇社区 Proposal / Consensus 机制，MVP 不落完整功能，只保留架构方向。 |

## 13. 建议文件目录与职责

`src/world/generation/`

- `world-seed.ts`
- `initial-home-generator.ts`
- `generation-schema.ts`

`src/world/map-state/`

- `home-map-state-schema.ts`
- `map-diff-engine.ts`
- `map-persistence.ts`

`src/world/placement/`

- `placement-engine.ts`
- `placement-rules.ts`
- `placement-validator.ts`
- `layout-recipes.ts`

`src/world/construction/`

- `construction-schema.ts`
- `construction-planner.ts`
- `construction-scorer.ts`
- `construction-executor.ts`
- `construction-events.ts`

`src/world/rendering/`

- `HomeMapRenderer.tsx`
- `HomeMapPlacementSprite.tsx`
- `home-map-render-model.ts`
- `home-map-render-styles.ts`
- `fallback-sprite-style.ts`

`src/app/world/page.tsx`

- 只负责组织状态和渲染入口，不再承担地图设计逻辑。

`src/ai/personality-core/`

- 命理人格核心。必须保留原核心职责，不因世界生成层重写。

## 14. 核心数据结构草案

`HomeMapState`：

- `worldId`
- `ownerId`
- `seed`
- `mapSize`
- `zones`
- `placements`
- `resources`
- `constructionPlans`
- `mapDiffs`
- `createdAt`
- `updatedAt`

`MapPlacement`：

- `id`
- `assetId`
- `x`
- `y`
- `layer`
- `scale`
- `variant`
- `anchor`
- `reason`
- `createdBy`

`ConstructionIntent`：

- `type`
- `sourceNeed`
- `urgency`
- `personalityBias`
- `reason`
- `preferredZone`

`ConstructionPlan`：

- `projectType`
- `targetZoneId`
- `requiredResources`
- `requiredTime`
- `stages`
- `layoutRecipeId`
- `placements`
- `expectedEffects`

`MapDiff`：

- `diffId`
- `worldDay`
- `addedPlacements`
- `removedPlacements`
- `updatedZones`
- `resourceTransactions`
- `eventIds`

`PersonalityProfile` 必须能输出 `constructionStyle` 与 `behaviorBias`，使命理人格层可以影响世界生成层。

## 15. MVP 数据流与运行闭环

首次进入：

```txt
玩家输入出生信息
→ personality-core 生成 ButlerPersonalityProfile
→ constructionStyle
→ World Seed
→ Initial Home Generator
→ HomeMapState
→ Renderer
→ 玩家看到初始家园
```

宠物抵达：

```txt
领养中心分配 / 宠物抵达真实时刻
→ personality-core 生成 PetPersonalityProfile
→ petSystem 读取人格倾向
→ worldEngine 更新宠物状态
→ Renderer 显示宠物
```

周期建设：

```txt
worldEngine tick
→ 管家感知资源、宠物、天气、事件
→ Construction Planner 生成建设意图
→ Constraint Check
→ Placement Engine 生成 placements
→ MapDiff 写入
→ Renderer 渲染变化
→ 事件系统输出管家解释
```

未来社区：

```txt
多个管家
→ Community Proposal
→ Consensus Engine
→ Shared ConstructionPlan
→ TownMapDiff
→ 小镇地图成长
```

## 16. Codex 开发纪律

1. 不允许再让 AI 自由设计 `/world` 地图。
2. AI 不直接写最终 UI 布局，AI 只能输出结构化数据、计划、解释或候选方案。
3. 正式 `/world` 不默认显示 debug grid / 坐标标签。
4. 不恢复旧 `WorldObserveLayout`、`WorldPixelStage`、`P-Phone`、`MiniMap`、`DeveloperDock`。
5. 不在正式 UI 显示紫微斗数术语。
6. 不把孵化仓 / 胚胎 / hatch 写回产品层。
7. 不重写 `personality-core` 稳定核心，除非明确扩展算法。
8. 每次写代码前要确认当前文件内容，避免覆盖已有逻辑。
9. 每轮完成必须运行 `npm run lint`、`npx tsc --noEmit`、`npm run build`。
10. 地图和建设相关变化必须走 `HomeMapState` / `MapPlacement` / `MapDiff` / Renderer。
11. 原型图不能被当作背景贴图。
12. CSS 背景只能用于单个 tile / sprite，不能用于整张地图。

Codex 每轮开场检查：

- 当前做什么
- 不做什么
- 改哪些文件
- 不改哪些文件
- 保留哪些后台逻辑
- 删除哪些旧 UI
- 完成后如何验证

## 17. MVP v1.2 验收标准

产品方向：

- 玩家打开世界后能明显看出这是像素生命世界，不是文字游戏。

命理核心：

- 玩家真实出生信息能生成管家人格；宠物抵达时刻能生成宠物人格；正式 UI 不显示紫微术语。

管家规则：

- 玩家不直接建造；管家基于资源、宠物需求和人格自主建设。

世界生成：

- 同一玩家 seed 生成稳定初始家园；刷新不会随机变化。

地图状态：

- `HomeMapState` 可保存、读取、渲染。

Placement：

- 设施不孤立；路径连续；建筑有承托；草地不棋盘化；不是贴图 UI。

像素资产：

- P0 素材包可用，透明背景，风格统一，能进入 registry。

UI：

- `/world` 默认不显示白色网格；不是坐标测试图；不是整图背景贴图。

行为：

- 管家和宠物状态能在世界中体现，后续建设能通过 `MapDiff` 显示。

技术：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

全部通过。

## 18. 当前已推进进度记录

`WORLD-GEN-MEGA-01`：

- 世界生成与自主建设层第一版可见闭环。

`WORLD-GEN-ARCH-FIX-01`：

- Renderer 抽离，`page.tsx` 变薄，`map-diff-engine` 建立。

`GROUND-TILEMAP-FIX-01`：

- 地表层从 CSS repeat 改为 ground tile placements。

`CONSTRUCTION-PLANNER-MEGA-02`：

- 管家建设计划 + MapDiff 可见变化第一版。

当前已推进内容必须继续遵守本文“不做贴图 UI”的规则。任何回退成静态背景、整图贴图、`page.tsx` 手写坐标的修改，均视为架构倒退。

## 19. 下一步执行顺序

1. 先保证 main 分支 lint / tsc / build 通过。
2. 修复占位角色素材 404。
3. 执行 `CONSTRUCTION-VISIBLE-STAGE-FIX-03`：建设阶段可见性与重复设施修正。
4. 再执行 `CONSTRUCTION-AUTO-TICK-04`：管家建设跟随 world tick 自动推进。
5. 后续再接用户登录 / 生辰八字输入 / 管家人格真实接入。
6. 不要提前做小镇社区。
7. 不要提前接数据库。
8. 不要提前恢复旧 UI。

## 20. 最终结论

AI-PET-WORLD 的 MVP 必须同时包含：

1. 命理人格核心：决定管家和宠物是谁。
2. 世界运行核心：决定世界如何流动。
3. 世界生成与自主建设层：决定家园如何长出来。
4. 像素资产管线：提供可被生成系统调用的积木。
5. Renderer：让玩家真正看见世界。

MVP 的目标是跑通完整闭环：

```txt
玩家输入真实生命信息
→ 生成管家人格
→ 生成初始家园
→ 宠物抵达
→ 管家自主建设
→ 玩家看到家园逐步变化
```

## 附录 A：开发时必须重复确认的硬规则

不要做贴图 UI。

不要把原型图当背景图。

不要把素材表当整图展示。

不要让 AI 自由设计 `/world`。

不要在 `page.tsx` 手写地图。

不要用一张草地图 repeat 当世界。

不要恢复旧 `WorldObserveLayout` / `WorldPixelStage` / `P-Phone` / `MiniMap`。

不要在正式 UI 显示紫微术语。

不要把孵化仓 / 胚胎 / hatch 写回产品层。

地图必须由 `HomeMapState` 驱动。

建设必须由 `ConstructionPlan` / `MapDiff` 驱动。

Renderer 只负责渲染。

## 附录 B：给 AI / Codex 的固定开场检查

每次让 AI / Codex 写代码前，先要求它输出：

```txt
本轮任务名称：
当前做什么：
当前不做什么：
会修改哪些文件：
不会修改哪些文件：
是否涉及 personality-core：否 / 是，原因：
是否涉及 /world Renderer：否 / 是，原因：
是否可能造成贴图 UI：否 / 是，风险：
如何保证 HomeMapState 驱动：
如何验证：lint / tsc / build：
```

如果它没有回答这些内容，不允许开始写代码。
