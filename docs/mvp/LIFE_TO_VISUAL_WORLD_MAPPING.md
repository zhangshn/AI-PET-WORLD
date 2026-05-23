> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD 生命信息到视觉世界映射文档 v1.0

## 0. 文档定位

本文档承接 `docs/mvp/AI_PET_WORLD_ARCHITECTURE_FREEZE.md`，用于冻结“用户生命信息如何变成可见世界差异”的映射规则。

本文档只定义映射规则，不实现代码，不新增 TypeScript 类型，不修改现有生成器、Renderer、系统或页面。

本文档用于后续开发：

- LifeCoreProfile
- ButlerVisualProfile / PetVisualProfile / WorldVisualProfile
- AssetModuleSelection
- WorldGeneration
- HomeMapState 长期成长

正式 UI 不展示紫微斗数、八字、星曜、宫位、LifeCoreProfile 字段或 VisualProfile 字段。所有差异最终都要通过世界本身表现出来：管家样式、宠物样式、宠物行为、家园布局、自然密度、建设方向、小镇成长差异。

## 1. 总体映射链路

冻结链路为：

```text
BirthInput
→ DestinyCore / PersonalityCore
→ PersonalityProfile
→ LifeCoreProfile
→ ButlerVisualProfile
→ PetVisualProfile
→ WorldVisualProfile
→ AssetModuleSelection
→ InitialHomeGenerator / PlacementEngine
→ HomeMapState
→ Renderer
```

| 层级 | 输入 | 输出 | 不负责什么 |
| --- | --- | --- | --- |
| BirthInput | 用户出生年月日时、时区、性别 / perspective、userId、worldSalt | 可计算命理核心的稳定输入 | 不决定地图坐标，不决定素材路径，不决定 UI 展示 |
| DestinyCore / PersonalityCore | BirthInput 与命理计算上下文 | 命理结构、人格解释、建设倾向、行为倾向 | 不渲染世界，不读取素材，不写页面 |
| PersonalityProfile | 命理核心解释结果 | 产品可读的人格与倾向结构 | 不直接决定 PNG，不直接决定地图摆放 |
| LifeCoreProfile | PersonalityProfile、性别 / perspective、生命倾向、调试来源 | 世界系统可消费的统一生命核心参数 | 不进入正式 `/world` 可见文本 |
| ButlerVisualProfile | LifeCoreProfile、constructionStyle、behaviorBias | 管家外观、动作、照护与建设视觉倾向 | 不控制宠物意志，不写地图坐标 |
| PetVisualProfile | LifeCoreProfile、宠物适配、宠物性别算法、抵达时刻人格 | 宠物外观、动作、行为偏好 | 不替代宠物运行时状态 |
| WorldVisualProfile | LifeCoreProfile、constructionStyle、visualBias、homeGrowthBias | 家园视觉语言、密度、秩序、成长方向 | 不直接画地图 |
| AssetModuleSelection | VisualProfile 与可用资产 registry | assetId 权重与选择结果 | 不返回图片路径，不 import PNG |
| InitialHomeGenerator / PlacementEngine | LifeCoreProfile、VisualProfile、worldSeed、sceneRecipe、assetId | HomeMapState | 不把 UI 当业务规则，不合成整图背景 |
| HomeMapState | 生成后的地图状态、placements、resources、constructionPlans、mapDiffs | Renderer 可消费的世界状态合同 | 不包含 React 组件，不解释命理术语 |
| Renderer | HomeMapState 派生的 render model、asset registry、worldTick | 用户看见的世界 | 不生成世界数据，不决定命理和建设策略 |

## 2. BirthInput 输入字段

用户生命信息输入字段冻结为：

- `year`
- `month`
- `day`
- `hour`
- `minute`
- `timezone`
- `gender / perspective`
- `userId`
- `worldSalt`

规则：

- 真实命理时间不能被游戏时间加速。世界 tick、昼夜、离线进度只能影响运行时和表达层，不能修改出生时间。
- 用户性别 / perspective 会影响人格解释、管家生成、宠物适配、宠物性别算法接口，以及部分关系语义的解释方式。
- `worldSalt` 只用于稳定生成差异和避免同一命理输入下完全相同的地图细节，不替代命理核心，不覆盖 BirthInput。

## 3. 命理核心输出字段

当前命理核心进入 LifeCoreProfile 前，允许整理为以下字段：

- `personalityProfile`
- `corePersonality`
- `traits`
- `tags`
- `constructionStyle`
- `behaviorBias`
- `relationBias`
- `eventTone`
- `debugLogs`
- `life tendency / runtime tendency`
- `gender / perspective interpretation`

当前真实代码路径包括：

- `src/ai/destiny-core/ziwei-core`
- `src/ai/destiny-core/bazi-core`
- `src/ai/personality-core`
- `src/ai/life-tendency-core`
- `src/ai/gateway.ts`

其中 `src/ai/destiny-core/ziwei-core` 与 `src/ai/destiny-core/bazi-core` 是真实命理计算核心路径；`src/ai/personality-core` 当前更多承担人格解释、life-profile、butler-profile 映射等产品层解释职责。

后续不允许地图、UI、Renderer 直接读取紫微术语。紫微、八字、星曜、宫位等内部结构只进入命理核心、LifeCoreProfile builder 或调试页，不进入正式 `/world` 表达层。

## 4. LifeCoreProfile 定义

LifeCoreProfile 是命理结果进入世界系统前的统一生命核心参数。它把命理结构整理为世界生成、视觉身份、资产选择、运行表达可以消费的产品字段。

| 字段 | 来源 | 用途 | 是否进入正式 UI | 调试属性 |
| --- | --- | --- | --- | --- |
| `sourceId` | userId、profileId、命理计算批次 | 追踪本次生成来源 | 否 | 可在 F3 / audit 显示 |
| `birthSignature` | BirthInput 标准化结果 | 稳定 seed、复现生成 | 否 | 可在 F3 / personality-test 显示 |
| `genderPerspective` | 用户输入性别 / perspective 与解释规则 | 影响人格解释、管家生成、宠物适配 | 否 | 可调试 |
| `personalityProfile` | PersonalityCore / DestinyCore 解释结果 | 作为生命核心的基础人格结构 | 否 | 可调试 |
| `constructionStyle` | butler-profile / life-profile 映射 | 决定建设风格和家园成长偏好 | 否 | 可调试 |
| `behaviorBias` | personality-core、life-tendency-core、gateway 输出 | 影响管家与宠物行为表达倾向 | 否 | 可调试 |
| `relationBias` | 关系倾向、照护倾向、社交距离解释 | 影响管家与宠物的距离、靠近、照护节奏 | 否 | 可调试 |
| `eventTone` | 命理倾向与运行时事件语气 | 影响事件氛围和表达强弱 | 否 | 可调试 |
| `visualBias` | constructionStyle、traits、tags 的视觉归一化 | 生成 Butler / Pet / World VisualProfile | 否 | 可调试 |
| `petMatchBias` | 宠物适配算法输入、人格匹配倾向 | 影响宠物类型、性别接口、行为倾向 | 否 | 可调试 |
| `homeGrowthBias` | constructionStyle、life tendency | 影响家园建设优先级、MapDiff 策略 | 否 | 可调试 |
| `townGrowthBias` | 长期人格倾向与建设风格 | 影响未来小镇扩张方向 | 否 | 可调试 |
| `debugSource` | 命理核心、mapper、版本号、日志 | 审计和复现 | 否 | 只供调试 |

正式 `/world` 不显示 LifeCoreProfile 字段。`src/app/personality-test/`、F3 developer panel、未来 dev world audit page 可以显示内部字段，用于开发审计和验证。

## 5. constructionStyle 到可见世界的映射

当前建设风格字段冻结为：

- `structuredBuilder`
- `warmCaretaker`
- `protectiveKeeper`
- `aestheticOrganizer`
- `quietMaintainer`
- `adaptivePlanner`

| constructionStyle | 可见世界表现 |
| --- | --- |
| `structuredBuilder` | 道路更规整；储物区更早出现；建筑承托更整齐；区域边界更清晰；管家移动路径更直接 |
| `warmCaretaker` | 宠物床更早出现；食物碗 / 水盆位置更贴近宠物路线；暖光、小灯、舒适区更早出现；休息区更柔和 |
| `protectiveKeeper` | 树木 / 灌木边界更多；入口更收束；宠物休息区更靠内侧；安全角落和观察点更明显 |
| `aestheticOrganizer` | 花草更多；蝴蝶 / 落叶 / 石头等自然装饰更多；路径更柔和；色彩层次更丰富 |
| `quietMaintainer` | 颜色更低调；装饰更少但稳定；休息区远离入口；物件分布更安静 |
| `adaptivePlanner` | 根据宠物状态调整建设优先级；根据资源变化调整路径 / 区域；对天气 / 时间 / 事件有更明显响应 |

这些字段不能以数字或术语显示给用户。用户应通过地图结构、设施出现顺序、自然密度、管家行动方式感知差异。

## 6. ButlerVisualProfile 映射规则

ButlerVisualProfile 字段冻结为：

- `bodyShape`
- `clothingPalette`
- `toolStyle`
- `movementStyle`
- `poseBias`
- `careStyle`
- `constructionVisualStyle`
- `boundaryStyle`
- `idleBehavior`
- `workBehavior`

这些字段来自 LifeCoreProfile、constructionStyle、behaviorBias、relationBias 的组合映射。

| 来源倾向 | ButlerVisualProfile 表现 |
| --- | --- |
| `structuredBuilder` 高 | 管家服装更整齐；工具包更明显；工作 pose 更频繁；移动路径更直 |
| `warmCaretaker` 高 | 管家颜色更温暖；靠近宠物动作更慢；照护设施优先；小灯 / 床 / 食物区关联更强 |
| `protectiveKeeper` 高 | 管家更常靠近边界或入口；边界巡视频率更高；安全设施优先 |
| `aestheticOrganizer` 高 | 管家建设更偏装饰；花草、灯、庭院点缀更多 |
| `quietMaintainer` 高 | 管家动作更低调；更常维护现有设施，不频繁大改 |
| `adaptivePlanner` 高 | 管家目标点随宠物状态变化更明显 |

管家不是普通 NPC，而是用户生命数据生成的自主意识管理者主角。管家可以照护、规划、建设、提醒和维护世界，但不能剥夺宠物自主决定权。宠物状态、宠物意愿和宠物行为仍需由宠物系统与未来 ActorRuntime / WorldExpression 共同表达。

## 7. PetVisualProfile 映射规则

PetVisualProfile 字段冻结为：

- `gender`
- `speciesArchetype`
- `bodyShape`
- `mainColor`
- `secondaryColor`
- `earType`
- `tailType`
- `eyeStyle`
- `movementStyle`
- `poseSet`
- `behaviorBias`
- `restPreference`
- `curiosityStyle`
- `alertStyle`
- `socialDistance`

宠物不是随机宠物。宠物由以下因素共同决定：

- 用户生命信息
- 宠物适配算法
- 宠物性别算法
- 宠物真实抵达 / 分配时刻人格

宠物性别算法已有，本文件只定义它接入 PetVisualProfile 的位置，不实现算法。未来 PetVisualProfile builder 应接收宠物性别算法结果，并将其作为 `gender` 字段和视觉生成的一部分。

| 倾向 | PetVisualProfile 与行为表现 |
| --- | --- |
| 安静 / 敏感倾向 | 体型偏小；颜色柔和；移动慢；更常观察；休息区使用频率高 |
| 探索 / 活跃倾向 | 动作更频繁；耳朵 / 尾巴更明显；更常靠近草丛、边界、蝴蝶、花草；`walking` / `exploring` pose 更频繁 |
| 警觉 / 防御倾向 | `alert` pose 更明显；社交距离更远；更常停在边界或安全角落；靠近行为更谨慎 |
| 亲近 / 依赖倾向 | 更常靠近管家或照护区；休息区和食物区路径更常被使用；`approach` pose 更频繁 |

PetVisualProfile 决定宠物“应该如何被看见”，PetState / ActorRuntime 决定宠物“此刻正在做什么”。两者不能混用。

## 8. WorldVisualProfile 映射规则

WorldVisualProfile 字段冻结为：

- `homePalette`
- `pathStyle`
- `groundVariation`
- `treeDensity`
- `bushDensity`
- `flowerDensity`
- `butterflyDensity`
- `stoneDensity`
- `fallenLeafDensity`
- `boundaryDensity`
- `restAreaWarmth`
- `careAreaPriority`
- `structureOrder`
- `decorationStyle`
- `arrivalAreaStyle`
- `townGrowthBias`

字段说明：

| 字段 | 说明 |
| --- | --- |
| `homePalette` | 世界整体色彩倾向 |
| `pathStyle` | 路径风格，可为 `straight` / `soft_curve` / `scattered` / `compact` |
| `groundVariation` | 草地、泥地、边缘、地表变化的丰富度 |
| `treeDensity` | 自然边界树木密度 |
| `bushDensity` | 灌木边界和过渡区密度 |
| `flowerDensity` | 花草装饰密度 |
| `butterflyDensity` | 动态自然氛围概率 |
| `stoneDensity` | 石头、边角、过渡点的装饰密度 |
| `fallenLeafDensity` | 落叶等轻装饰出现概率 |
| `boundaryDensity` | 家园边界安全感 |
| `restAreaWarmth` | 宠物休息区舒适度 |
| `careAreaPriority` | 食物、水、床、小灯等照护设施优先级 |
| `structureOrder` | 道路、储物、建筑布局秩序 |
| `decorationStyle` | 装饰偏少、自然、温暖、精致等 |
| `arrivalAreaStyle` | 宠物真实抵达 / 分配点的视觉样式 |
| `townGrowthBias` | 未来小镇扩张方向 |

WorldVisualProfile 不直接画地图，而是影响 AssetModuleSelection、PlacementEngine、ConstructionPlan。它提供偏好、密度、秩序和成长方向，不提供 React 组件、图片路径或坐标硬编码。

## 9. AssetModuleSelection 映射规则

VisualProfile 不直接返回图片路径。VisualProfile 返回偏好，AssetModuleSelection 根据偏好、可用资产和 registry 选择 assetId。

规则：

- 地图生成器只能使用 assetId。
- Renderer 才能根据 assetId 查 registry path。
- 不允许 VisualProfile 直接 import PNG。
- 不允许 `page.tsx` 手写资产路径。
- 不允许整图背景。

资产模块分类冻结为：

| 分类 | 模块 |
| --- | --- |
| 地表模块 | `grass`、`dirt`、`path`、`edge` |
| 自然模块 | `tree`、`bush`、`grass_tuft`、`flower`、`stone`、`fallen_leaf`、`butterfly` |
| 生活模块 | `shelter`、`arrival_point`、`food_bowl`、`water_bowl`、`pet_bed`、`storage_box`、`lamp` |
| 角色模块 | `butler_body`、`butler_pose`、`pet_body`、`pet_ear`、`pet_tail`、`pet_eye`、`pet_pose` |

映射例子：

- `aestheticOrganizer` 高：`flower` asset 权重提高，`butterfly` asset 权重提高，decoration asset 权重提高。
- `protectiveKeeper` 高：dense bush / tree boundary asset 权重提高。
- `warmCaretaker` 高：warm lamp / pet bed / care area asset 权重提高。
- `structuredBuilder` 高：clean path / storage / foundation asset 权重提高。

当前 `src/world/map-assets/world-map-asset-registry.ts` 已经承担 assetId 到 path 的注册职责。后续 AssetModuleSelection 应输出 assetId 或 assetId 权重，而不是文件路径。

## 10. InitialHomeGenerator 接入规则

当前 `InitialHomeGenerator` 已经读取 `butlerConstructionStyle`，并通过 `InitialHomeGenerator / PlacementEngine` 生成 `HomeMapState`。

未来输入升级为：

```text
LifeCoreProfile
+ ButlerVisualProfile
+ PetVisualProfile
+ WorldVisualProfile
+ worldSeed
+ sceneRecipe
```

输出仍然是：

```text
HomeMapState
```

规则：

- 不重写 InitialHomeGenerator。
- 不重写 PlacementEngine。
- 只扩展输入和 mapping。
- 保持 HomeMapState 作为地图状态主合同。
- 不在 `app/page.tsx` 手写坐标。
- 不让 UI 层决定地图关系。

InitialHomeGenerator 负责生成初始地图状态；PlacementEngine 负责区域关系、承托、路径连续、碰撞和密度；Renderer 只渲染结果。

## 11. MapDiff 与长期成长映射

后续建设不是重画整张地图，而是通过 MapDiff 增量变化。MapDiff 表示 `add`、`remove`、`update`、`move` 等长期成长变化，保留 HomeMapState 的连续性。

| constructionStyle | MapDiff 长期成长策略 |
| --- | --- |
| `structuredBuilder` | 更早添加路径、储物、地基；`move` / `update` 操作更偏规整 |
| `warmCaretaker` | 更早添加宠物床、食物、水、灯；休息区 `update` 更频繁 |
| `protectiveKeeper` | 更早添加边界、灌木、树、观察点 |
| `aestheticOrganizer` | 更早添加花草、蝴蝶、装饰 |
| `quietMaintainer` | 更少大规模 `add`；更多 `update` / maintain |
| `adaptivePlanner` | 根据宠物状态、资源、天气、时间改变 MapDiff 优先级 |

MapDiff 的目标是让世界成长可追踪、可回放、可审计，而不是每次重新生成一张不连续的新地图。

## 12. 正式 UI 暴露规则

正式 `/world` 不显示：

- 紫微斗数术语
- 星曜
- 宫位
- 八字术语
- LifeCoreProfile 字段
- VisualProfile 字段
- debugLogs
- constructionStyle 数值
- behaviorBias 数值
- relationBias 数值
- HUD
- 状态卡
- 解释面板

正式 `/world` 显示：

- 管家样式
- 宠物样式
- 宠物行为
- 家园布局
- 自然密度
- 建设变化
- 光线 / 氛围
- 未来小镇成长结果

调试页可以显示内部字段：

- `personality-test`
- F3 developer panel
- future dev world audit page

## 13. 用户如何看懂后端

不要让用户读懂后端，让用户看见后端。

不要显示：

```text
warmCaretaker = 0.82
```

应该看到：

- 宠物床更早出现
- 食物碗 / 水盆离宠物更近
- 小灯更多
- 管家更常停在照护区附近

不要显示：

```text
pet curiosity high
```

应该看到：

- 宠物更常走到草丛、蝴蝶、边界
- 宠物在新物件旁观察
- `exploring` pose 更多

不要显示：

```text
protectiveKeeper high
```

应该看到：

- 边界树木和灌木更多
- 入口更安全
- 宠物床更靠内侧
- 管家更常巡视边界

用户不需要理解紫微斗数术语、八字结构或内部评分。用户应该通过世界的形状、节奏、关系、动作和变化，感知“这是属于自己的 AI-PET-WORLD”。

## 14. 验收标准

本文档完成后，后续实现必须满足：

1. 相同资源条件下，不同用户生命信息生成不同 ButlerVisualProfile。
2. 相同资源条件下，不同用户生命信息生成不同 PetVisualProfile。
3. 相同资源条件下，不同用户生命信息生成不同 WorldVisualProfile。
4. InitialHomeGenerator 不直接读取紫微术语。
5. Renderer 不读取紫微术语。
6. `page.tsx` 不写地图坐标。
7. 正式 `/world` 不显示命理术语。
8. 所有视觉差异必须能追溯到 LifeCoreProfile / VisualProfile。
9. AssetModuleSelection 只返回 assetId，不返回文件路径。
10. MapDiff 负责长期成长变化，不覆盖整张地图。

## 15. 后续 TypeScript 落地建议

只建议，不执行。

建议后续新增目录：

```text
src/world/life-core/
  life-core-schema.ts
  life-core-builder.ts

src/world/visual-identity/
  visual-identity-schema.ts
  butler-visual-profile.ts
  pet-visual-profile.ts
  world-visual-profile.ts
  life-to-visual-mapper.ts

src/world/asset-modules/
  asset-module-schema.ts
  asset-module-selector.ts
```

后续实现时必须先写类型，再写 mapper，再接 generation，不得直接改 `/world` UI。LifeCoreProfile 与 VisualProfile 是世界系统输入层，不是页面状态；AssetModuleSelection 是 assetId 选择层，不是素材生成器；InitialHomeGenerator 与 PlacementEngine 只接收扩展后的稳定输入，不被重写。

## 16. 下一步任务

下一步任务只建议，不执行：

```text
WORLD-VISUAL-LANGUAGE-DOC-03
```

任务目标：

新增 `docs/mvp/WORLD_VISUAL_LANGUAGE.md`，定义宠物状态、管家任务、建设阶段、时间、自然模块、地图变化如何被用户直接看懂。
