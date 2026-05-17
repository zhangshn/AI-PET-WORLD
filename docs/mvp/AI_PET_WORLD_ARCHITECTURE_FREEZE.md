# AI-PET-WORLD 架构冻结文档 v1.0

## 0. 冻结声明

从本文档生成后开始，AI-PET-WORLD 不再反复修改大架构。后续任务只能补模块、补边界、补适配层，不能推翻主链路。

Web 只是当前验证壳。Next.js / React 页面用于本地验证、临时输入、临时预览和调试，不是项目核心本体。未来项目会客户端化，但客户端化只替换 Renderer Adapter、Storage Adapter、Input Adapter。

核心逻辑必须保持纯 TypeScript，不绑定 Next.js / React 页面，不写死在 `src/app` 中。

正式 `/world` 不是 HUD，不是卡片页，不是解释页，而是世界舞台。用户进入 `/world` 时，应该看到属于自己的 AI-PET-WORLD，而不是状态卡、顶部 Hero、事件流或命理解释面板。

## 1. 产品核心定义

AI-PET-WORLD 不是普通像素宠物游戏。

AI-PET-WORLD 的核心是：

```txt
用户输入真实生命信息 / 生辰八字 / 性别
→ 命理核心算法
→ 紫微斗数 / 八字映射
→ LifeCoreProfile
→ ButlerVisualProfile / PetVisualProfile / WorldVisualProfile
→ AssetModuleSelection
→ WorldGeneration
→ HomeMapState
→ WorldRuntime
→ WorldExpression
→ ActorRuntime / MapDiff
→ Renderer
→ 用户看到属于自己的 AI-PET-WORLD
```

用户输入生辰八字 / 真实出生信息 / 性别等生命信息后，系统通过命理核心算法生成：

1. 管家人格
2. 管家视觉样式
3. 管家建设风格
4. 适配宠物
5. 宠物性别 / 宠物外观 / 宠物行为倾向
6. 家园视觉风格
7. 家园建设倾向
8. 未来小镇成长倾向

这些内容不是文字展示，而是通过地图、管家、宠物、家园变化被用户看见。正式产品不靠命理术语解释差异，而是让差异出现在世界里。

## 2. 最终冻结主链路

```txt
BirthInput
→ PersonalityCore / DestinyCore
→ LifeCoreProfile
→ ButlerVisualProfile / PetVisualProfile / WorldVisualProfile
→ AssetModuleSelection
→ InitialHomeGenerator / PlacementEngine
→ HomeMapState
→ WorldRuntime
→ WorldExpression
→ ActorRuntimeState / MapDiff
→ HomeMapRenderer
→ Client Renderer
```

| 层 | 输入 | 输出 | 职责 |
| --- | --- | --- | --- |
| `BirthInput` | 用户真实出生信息、生辰八字、性别 / perspective | 标准化生命输入 | 作为世界和角色差异的源头 |
| `PersonalityCore / DestinyCore` | `BirthInput`、时间、性别视角 | 紫微 / 八字 / 人格基础结果 | 计算命理与人格，不关心 UI、地图、素材 |
| `LifeCoreProfile` | 命理输出、人格解释、生命趋势 | 产品可读生命核心参数 | 隔离紫微 / 八字术语，给世界读取稳定字段 |
| `ButlerVisualProfile / PetVisualProfile / WorldVisualProfile` | `LifeCoreProfile` | 管家、宠物、家园视觉倾向 | 把生命差异映射成视觉差异 |
| `AssetModuleSelection` | VisualProfile、资源库、场景需要 | assetId 候选与模块选择 | 选择可注册、可组合的素材模块 |
| `InitialHomeGenerator / PlacementEngine` | VisualProfile、assetId、worldSeed、sceneRecipe | 初始 placements / zones / resources | 生成世界结构，不由页面手写地图关系 |
| `HomeMapState` | WorldGeneration 输出、MapDiff | 当前家园地图状态 | 保存 zones、placements、resources、constructionPlans、mapDiffs |
| `WorldRuntime` | worldEngine tick、systems、time、runtime state | 世界运行状态 | 驱动时间、宠物、管家、事件、home、progression、save / restore |
| `WorldExpression` | PetState、ButlerState、ConstructionPlan、WorldTime、HomeMapState、LifeCoreProfile、VisualProfile | VisualIntent、MovementIntent、PoseIntent、AtmosphereIntent、MapDiffIntent | 把后端状态翻译成画面表现 |
| `ActorRuntimeState / MapDiff` | WorldExpression 输出 | 活体运行状态、地图增量变化 | 区分生命体运行与地图物件变化 |
| `HomeMapRenderer` | HomeMapState、ActorRuntimeState、render model | Web 可见世界 | 只渲染，不生成世界数据 |
| `Client Renderer` | 同一核心数据结构 | 客户端可见世界 | 未来替换 Web Renderer Adapter，核心数据不变 |

## 3. 现有代码对应关系

| 冻结架构层 | 当前已有代码 | 当前状态 | 后续动作 |
| --- | --- | --- | --- |
| 用户源头层 | `src/ai/gateway.ts` 导出 `BirthInput`，`src/app/personality-test/` 提供测试输入 | 部分已有 | 后续正式输入仍只产生命源头数据，不写入 UI 逻辑 |
| 命理核心层 | `src/ai/destiny-core/`、`src/ai/personality-core/`、`src/ai/life-tendency-core/`、`src/ai/gateway.ts` | 已有 | 保持纯 TS；不因 UI、地图、素材改核心 |
| LifeCoreProfile 层 | `src/ai/personality-core/life-profile-core/`、`buildLifePersonalityProfile` | 部分已有 | 新增统一 `LifeCoreProfile` 类型与 builder |
| VisualProfile 层 | `src/visual-system/`、旧 visual DNA / mapper、部分像素原型 | 部分已有 | 新增 `ButlerVisualProfile` / `PetVisualProfile` / `WorldVisualProfile` mapper |
| Asset Module 层 | `src/world/map-assets/world-map-asset-registry.ts`、`src/world/pixel-world/`、`public/assets/generated/` | 部分已有 | 形成正式 Asset Module 选择层 |
| Asset Lab 层 | `art-assets/`、`docs/assets/ASSET_MANIFEST.md`、像素测试页 / 原型组件 | 部分已有 | 新增开发工具流程，不进入正式 UI |
| WorldGeneration 层 | `src/world/generation/`、`src/world/placement/`、`src/world/construction/` | 已有 | 输入升级为 LifeCoreProfile + VisualProfile + worldSeed + sceneRecipe |
| HomeMapState 层 | `src/world/map-state/home-map-state-schema.ts`、`home-map-local-persistence.ts`、`map-diff-engine.ts` | 已有 | 保持为地图状态主合同 |
| WorldRuntime 层 | `src/engine/worldEngine.ts`、`src/engine/world-engine/`、`src/systems/`、`src/world/runtime/`、`src/world/progression/`、`src/world/offline/`、`src/world/persistence/` | 已有 | 后续只把状态交给 WorldExpression |
| WorldExpression 层 | 部分表达逻辑分散在 event / visualization / pet-expression | 缺失 | 后续新增独立层 |
| ActorRuntime 层 | `src/world/runtime/entity-runtime.ts`、`movement-runtime.ts` 等基础 runtime | 部分已有 | 新增 `ActorRuntimeState`，生命体不再只是静态 placement |
| Renderer 层 | `src/world/rendering/HomeMapRenderer.tsx`、`home-map-render-model.ts`、`HomeMapPlacementSprite.tsx`、`home-map-render-styles.ts` | 已有 | `/world` 收口到 `HomeMapRenderer` |
| Web Adapter 层 | `src/app/world/page.tsx`、`src/app/world/hooks/useWorldEngineState.ts` | 已有 | 变薄，只做路由、临时存储、调试挂载 |
| Future Client Adapter 层 | 暂无 | 后续新增 | 替换 Renderer / Storage / Input Adapter，不改核心 |

## 4. 命理核心层冻结规则

当前真实代码路径包括：

- `src/ai/destiny-core/`
- `src/ai/personality-core/`
- `src/ai/life-tendency-core/`
- `src/ai/gateway.ts`

其中 `src/ai/destiny-core/ziwei-core/` 与 `src/ai/destiny-core/bazi-core/` 是当前真实命理核心路径。`src/ai/personality-core/` 当前更多承担人格解释、life-profile、butler-profile 等映射职责。旧文档中把 `personality-core` 作为命理核心统称时，后续文档应注明当前代码命名差异。

规则：

- 不因 UI 修改命理核心。
- 不因地图修改命理核心。
- 不因素材修改命理核心。
- 不因 Web 页面修改命理核心。
- 正式 UI 不显示紫微斗数术语。
- 调试页可以显示内部命理结构。
- 命理核心只输出稳定结构和解释结果，不 import app 页面、Renderer、素材文件。

## 5. LifeCoreProfile 层定义

`LifeCoreProfile` 用来把命理输出统一成产品可读的生命核心参数。它是命理核心和世界 / 视觉 / 行为系统之间的稳定中间层。

建议字段：

- `sourceId`
- `birthSignature`
- `genderPerspective`
- `personalityProfile`
- `constructionStyle`
- `behaviorBias`
- `relationBias`
- `visualBias`
- `petMatchBias`
- `homeGrowthBias`
- `townGrowthBias`

地图、宠物、管家、小镇不直接读取紫微术语，而是读取 `LifeCoreProfile`。正式 UI 不展示 `LifeCoreProfile` 的内部字段，调试页可以展示。

## 6. VisualProfile 层定义

VisualProfile 分为三类：

1. `ButlerVisualProfile`
2. `PetVisualProfile`
3. `WorldVisualProfile`

`ButlerVisualProfile` 字段：

- `bodyShape`
- `clothingPalette`
- `toolStyle`
- `movementStyle`
- `careStyle`
- `constructionVisualStyle`
- `boundaryStyle`

`PetVisualProfile` 字段：

- `gender`
- `bodyShape`
- `mainColor`
- `secondaryColor`
- `earType`
- `tailType`
- `eyeStyle`
- `movementStyle`
- `poseSet`
- `behaviorBias`

`WorldVisualProfile` 字段：

- `homePalette`
- `pathStyle`
- `treeDensity`
- `bushDensity`
- `flowerDensity`
- `butterflyDensity`
- `boundaryDensity`
- `restAreaWarmth`
- `structureOrder`
- `decorationStyle`
- `townGrowthBias`

用户命理差异最终必须在管家、宠物、家园、小镇视觉上出现差异。差异不能只停留在文字解释里。

## 7. Asset Module 层定义

素材不是整图，不是背景图。

素材是可注册、可组合、可替换的模块。正式世界只能通过 `assetId + registry + placements` 使用素材。

分类：

1. 地表模块
   - `grass`
   - `dirt`
   - `path`
   - `edge`

2. 自然模块
   - `tree`
   - `bush`
   - `grass_tuft`
   - `flower`
   - `stone`
   - `fallen_leaf`
   - `butterfly`

3. 生活模块
   - `shelter`
   - `arrival_point`
   - `food_bowl`
   - `water_bowl`
   - `pet_bed`
   - `storage_box`
   - `lamp`

4. 角色模块
   - `butler_body`
   - `butler_pose`
   - `pet_body`
   - `pet_ear`
   - `pet_tail`
   - `pet_eye`
   - `pet_pose`

可以用 UI / Canvas / SVG / 脚本生成素材，但正式世界只能使用 PNG + assetId + registry。地图生成器只能传 assetId，不直接传文件路径。

## 8. Asset Lab 定义

Asset Lab 是开发工具，不是正式游戏 UI。

职责：

- 代码生成低保真像素素材
- 预览素材
- 导出 PNG
- 保存到 `public/assets/generated`
- 注册到 `world-map-asset-registry`
- 检查尺寸、透明背景、命名、风格统一

当前不追求画面精美，只追求稳定、统一、可用、可替换。Asset Lab 的预览、调试、批量生成工具可以存在于 dev / test 路径，但不能成为正式 `/world` 主体验。

## 9. WorldGeneration 层冻结规则

当前已有：

- `src/world/generation/`
- `src/world/placement/`
- `src/world/map-state/`
- `src/world/construction/`

规则：

- 不在 `page.tsx` 手写地图坐标。
- 不让 UI 层决定地图关系。
- 不把原型图当背景图。
- 不把草地、道路、建筑、设施合成整图。
- `InitialHomeGenerator` 负责生成 `HomeMapState`。
- `PlacementEngine` 负责区域关系、承托、路径连续、碰撞、密度。
- `MapDiff` 负责增量变化。
- Renderer 只渲染。

未来输入升级为：

```txt
LifeCoreProfile
+ ButlerVisualProfile
+ PetVisualProfile
+ WorldVisualProfile
+ worldSeed
+ sceneRecipe
```

输出仍是：

```txt
HomeMapState
```

当前 `src/world/generation/generation-schema.ts` 已有 `WorldGenerationInput`、`InitialHomeGenerationInput`、`InitialHomeGenerationResult`。当前 `src/world/generation/initial-home-generator.ts` 已经整合 seed、scene recipe、PlacementEngine 生成 `HomeMapState`。

## 10. WorldRuntime 层冻结规则

当前已有：

- `src/engine/worldEngine.ts`
- `src/systems/`
- `src/world/runtime/`
- `src/world/progression/`
- `src/world/offline/`
- `src/world/persistence/`

规则：

- `worldEngine` 负责 tick、time、pet、butler、home、event、runtime、progression、save / restore。
- `worldEngine` 不直接画 UI。
- `worldEngine` 不直接生成视觉素材。
- `systems` 负责运行系统边界，不 import app 页面。
- `persistence` 负责存档结构与兼容，不把产品 UI 概念写进核心。
- 后续只把状态交给 `WorldExpression`。

当前 `worldEngine` 仍有 `incubator` 兼容链路，并通过 `adoption` adapter 暴露 `adoptionState`。这部分先保留，后续迁移产品语义。

## 11. WorldExpression 层定义

`WorldExpression` 是后续必须补齐的关键层。

职责：把后端状态翻译成画面表现。

输入：

- `PetState`
- `ButlerState`
- `ConstructionPlan`
- `WorldTime`
- `HomeMapState`
- `LifeCoreProfile`
- `VisualProfile`

输出：

- `VisualIntent`
- `MovementIntent`
- `PoseIntent`
- `AtmosphereIntent`
- `MapDiffIntent`

例子：

```txt
pet.hunger 高
→ 宠物目标 food_bowl
→ pose walking / eating
```

```txt
pet.energy 低
→ 宠物目标 pet_bed
→ pose resting / sleeping
```

```txt
butler.task building_home
→ 管家目标 construction zone
→ pose walking / working
```

```txt
worldTime night
→ atmosphere darker
→ lamp on
```

`WorldExpression` 不替代 `worldEngine`，也不替代 Renderer。它只负责表达映射。

## 12. ActorRuntime 层定义

`ActorRuntime` 是让管家和宠物活起来的关键层。

`ActorRuntimeState` 字段：

- `actorId`
- `actorType: butler | pet`
- `x`
- `y`
- `targetX`
- `targetY`
- `facing`
- `pose`
- `movementState`
- `speed`
- `currentIntent`
- `linkedBackendState`

规则：

- 管家和宠物不能只是静态 `MapPlacement`。
- `MapPlacement` 表示地图物件。
- `ActorRuntimeState` 表示运行中的生命体。
- Renderer 合并 `HomeMapState + ActorRuntimeState` 显示世界。
- `ActorRuntimeState` 不直接决定后端状态，只表达后端状态在地图上的运行位置、朝向、姿态和移动。

## 13. Renderer 层冻结规则

当前已有：

- `src/world/rendering/HomeMapRenderer.tsx`
- `src/world/rendering/home-map-render-model.ts`
- `src/world/rendering/HomeMapPlacementSprite.tsx`
- `src/world/rendering/home-map-render-styles.ts`

规则：

- Renderer 只渲染，不生成世界数据。
- Web Renderer 只是当前临时实现。
- 未来客户端可以替换 Renderer Adapter。
- 核心数据结构不变。
- `HomeMapRenderer` 的输入应来自 `buildHomeMapRenderModel(HomeMapState)`，后续再合并 `ActorRuntimeState`。

正式 `/world` 不显示：

- HUD
- 状态卡
- 解释面板
- 顶部 Hero
- 事件流
- 常驻按钮
- debug grid
- 坐标标签
- 紫微术语

正式 `/world` 显示：

- 世界本身

## 14. Web 与未来客户端边界

当前 Next.js 只是临时验证壳。

Web Adapter 可以负责：

- 页面路由
- 临时输入
- 临时 localStorage
- 临时预览
- 调试页

Web Adapter 不允许负责：

- 命理核心
- 世界生成核心
- 行为系统
- 角色运行时
- 地图业务关系
- 素材业务选择
- 小镇演化

未来客户端只替换：

- Renderer Adapter
- Storage Adapter
- Input Adapter

核心保留：

- `src/ai`
- `src/world`
- `src/engine`
- `src/systems`

## 15. 当前需要保留、断开、迁移的内容

参考 `docs/mvp/PROJECT_FILE_AUDIT.md`，当前分类冻结为：

| 分类 | 处理 |
| --- | --- |
| `KEEP_CORE` | 核心算法、世界运行、世界生成、地图状态、建设、Renderer、持久化、运行时类型全部保留 |
| `KEEP_TEST` | 测试页、调试页、F3 审计、测试报告、test/debug/audit 产物全部保留 |
| `KEEP_DEV` | 文档、配置、开发辅助脚本、架构说明、素材清单全部保留 |
| `DISCONNECT_UI` | 体验卡片页先从正式 `/world` 断开，不删除 |
| `DEPRECATE_LATER` | incubator / hatch / embryo、旧 P-Phone、旧 pixel UI 原型等先兼容保留，后续迁移 |
| `DELETE_SAFE` | 当前为空 |

强调：

- 测试内容不删除。
- 体验卡片页先断开，不删除。
- `incubator` / `hatch` / `embryo` 先兼容保留，后续迁移。
- `/world` 后续收口到 `HomeMapRenderer`。
- 当前 `/world` 链路是 `page.tsx → useWorldEngineState → generateInitialHomeMap → advanceMvpConstructionByWorldTick → buildWorldExperienceModel → WorldExperiencePage`。
- 目标 `/world` 链路是 `page.tsx → useWorldEngineState → generateInitialHomeMap → buildHomeMapRenderModel → HomeMapRenderer`。

## 16. 后续执行顺序冻结

阶段 0：
项目文件审计 `PROJECT_FILE_AUDIT.md`

阶段 1：
架构冻结 `AI_PET_WORLD_ARCHITECTURE_FREEZE.md`

阶段 2：
`LIFE_TO_VISUAL_WORLD_MAPPING.md`

阶段 3：
`WORLD_VISUAL_LANGUAGE.md`

阶段 4：
`ASSET_MODULE_SYSTEM.md`

阶段 5：
`LifeCoreProfile` 类型与 builder

阶段 6：
VisualProfile mapper

阶段 7：
Asset Module + Asset Lab

阶段 8：
`/world` 收口到 `HomeMapRenderer`

阶段 9：
`WorldExpression`

阶段 10：
`ActorRuntime`

阶段 11：
建设可见化 Construction Visibility

阶段 12：
客户端 Adapter 准备

## 17. 禁止事项

- 不再重新设计大架构。
- 不再做传统原型图作为开发输入。
- 不把原型图当背景。
- 不让 AI 自由设计 `/world`。
- 不把核心逻辑写进 `src/app`。
- 不把 UI 卡片作为正式主链路。
- 不删除测试内容。
- 不删除命理核心。
- 不删除 `worldEngine`。
- 不删除 Renderer。
- 不提前做小镇。
- 不提前接数据库。
- 不提前做客户端壳。
- 不追求商业级美术。
- 不因素材问题修改命理核心。
- 不把素材生成问题转嫁给 WorldGeneration。
- 不让 Renderer 生成世界数据。

## 18. 验收标准

此文档完成后，后续每次任务都必须回答：

1. 本次任务属于哪一层？
2. 是否改动命理核心？
3. 是否改动正式 `/world` 主链路？
4. 是否新增 UI/HUD/卡片？
5. 是否影响未来客户端？
6. 是否通过 lint / tsc / build？

如果任务只新增 Markdown 文档，可以说明未运行 lint / tsc / build 的原因；如果任务修改 TypeScript、配置、页面、Renderer、worldEngine、systems 或生成链路，必须运行验证。

## 19. 下一步任务

下一步任务只建议，不执行：

```txt
LIFE-TO-VISUAL-MAPPING-DOC-02
```

任务目标：新增生命信息到视觉世界映射文档，明确 `LifeCoreProfile → VisualProfile → AssetModuleSelection → WorldGeneration` 的字段映射、差异维度、禁止术语暴露和验证方式。不要写功能代码。
