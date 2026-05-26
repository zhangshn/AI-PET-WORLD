# AI-PET-WORLD World Painter 正式设计

## 1. 当前目标

当前阶段的目标不是做贴图系统，不是接入外部 AI 生图，不是购买或堆叠素材，也不是把 `/world-debug/pixel-scene-composer` 中的测试 SVG 直接贴到主世界页面。

当前目标是建立一套“由代码规则生成像素世界画面”的系统，让 AI-PET-WORLD 未来具备持续、可审计、可扩展的“自己画世界”能力，而不是得到一张一次性的生成图片。

正式目标链路为：

```text
World Facts
-> Scene Composition
-> Pixel Painter Modules
-> Layer / Y-sort
-> Renderer
-> 主世界视觉呈现
```

其中 `World Facts` 是事实来源，`Scene Composition` 是事实到画面结构的翻译，`Pixel Painter Modules` 负责局部绘制，`Renderer` 只负责呈现。World Painter 的价值在于：同一套世界事实可以随着时间、天气、资源、道路、建设状态、管家位置、宠物位置和生活痕迹持续被重新投影成画面，而不是每次依赖静态贴图或单次图片生成。

World Painter 不是世界事实系统。它不能决定世界里真实存在什么；它只能把正式 `WorldState`、`HomeMapState` 或未来 `worldEngine` 快照提供的事实画出来。

## 2. 当前已经验证通过的内容

`/world-debug/pixel-scene-composer` 当前作为测试页，已经阶段性验证了代码规则可以把多种像素元素组合成一个整体场景，而不是只把单个素材孤立贴到画面上。

当前测试已经覆盖：

- 地面 tile
- 道路 path / roadShape
- 草地与道路边缘过渡
- 路边生态跟随道路变化
- 草簇
- 树
- 灌木
- 石头
- 花
- 角色占位
- y-sort / 层级
- 湿度视觉状态
- 装饰密度
- 地貌色盘

这证明了：代码规则可以通过 tile、道路、边缘生态、植被、小物件、角色占位和层级排序，组合出一个相对统一的像素世界场景，减少“单个贴图拼贴”的割裂感。

当前测试成果可以作为 World Painter / Scene Composer 正式化拆分的实验底座，但它还不是正式主世界视觉系统。

## 3. 核心边界

### 3.1 世界事实层 World Fact Layer

World Fact Layer 负责回答“世界里真实存在什么”。它是 World Painter 的上游，不属于 painter 本身。

正式世界事实可以包括：

- 地貌
- 道路
- 房屋
- 长期树木
- 宠物位置
- 管家位置
- 生活痕迹
- 环境状态
- 时间状态

这些内容必须来自正式世界状态，例如 `WorldState`、`HomeMapState`、runtime save record、worldEngine 快照或未来的持久化事实链路。World Painter 不能绕过这些事实来源自行决定“新增一个正式对象”。

当前 V2.6 正式口径下，旧路线概念不得作为世界事实进入当前设计。任何历史旧设定如果出现在历史文档或审计上下文中，只能作为红线说明，不能作为当前方案。

### 3.2 场景组合层 Scene Composer

Scene Composer 负责把世界事实翻译成画面结构。它不直接画像素，也不创造正式事实，而是生成 `SceneCompositionPlan`。

Scene Composer 可以决定：

- 哪些对象在道路边
- 哪些对象在前景
- 哪些对象在后景
- 哪些对象需要遮挡
- 哪些草、花、石头属于道路边缘生态
- 哪些内容只是视觉装饰
- 哪些元素参与 y-sort
- 哪些视觉对象只是一种表现，而不是正式世界对象

Scene Composer 不能凭空创造正式世界事实。例如，如果正式 `HomeMapState` 中没有某个长期房屋、宠物、道路或管家位置，Scene Composer 不能为了画面完整而把它写成正式事实。

### 3.3 像素绘画层 Pixel Painter

Pixel Painter 负责画单个对象或局部结构。它接收 Scene Composer 已经确定的绘制输入，然后输出可渲染片段。

建议拆分为：

- tree painter
- grass painter
- path painter
- stone painter
- flower painter
- bush painter
- actor placeholder painter

Pixel Painter 的职责是“如何画”，不是“是否存在”。例如 tree painter 可以根据树的年龄、健康、湿度、地貌色盘绘制树冠和树干，但不能决定正式世界里突然多一棵长期树。

### 3.4 渲染层 Renderer

Renderer 负责把 `SceneCompositionPlan` 画出来。当前测试阶段使用 SVG，未来可以继续使用 SVG、Canvas、Pixi 或其他渲染技术。

Renderer 必须保持只读：

- Renderer 不能决定世界事实。
- Renderer 不能让 UI 自己创造正式对象。
- Renderer 不能把调试参数当作正式世界规则。
- Renderer 不能把测试页中的交互参数写回 `HomeMapState`。

Renderer 的正确角色是：读取 Scene Composer 生成的结构，按照层级、y-sort、色盘和 painter 输出进行呈现。

## 4. 参数语义定稿

### biome

`biome` 表示地貌类型。

当前测试支持：

- forest
- grassland
- desert
- oasis

在正式世界中，`biome` 应来自世界环境事实，不应由 UI 随便切换。测试页中的 biome 下拉框只是为了观察不同地貌色盘与生态组合效果。

### moisture

`moisture` 表示湿度状态。

它影响：

- 颜色
- 草高
- 叶色
- 湿润感
- 干燥感
- 树冠健康感

`moisture` 不应该重洗世界布局。正式语义下，同一个世界结构在湿度变化时，应该主要改变视觉状态，而不是重新生成道路、长期树木或正式对象位置。

### decorationDensity

`decorationDensity` 表示装饰密度。

它影响：

- 草簇数量
- 小花数量
- 小石头数量
- 灌木数量
- 路边装饰数量

它不是“成熟大树开关”，也不是正式世界事实的替代品。正式世界中的长期树木、建筑、道路、管家、宠物等必须来自事实层；`decorationDensity` 只控制视觉装饰的丰富程度。

### roadShape

`roadShape` 表示道路方案预览。

在测试页中，它用于观察不同道路生成方案，不应被理解为“管家走路时道路实时变化”。正式世界中，道路变化应来自世界事实或建设结果，而不是 UI 滑杆。

当道路变化时，依附道路的生态可以变化：

- 路边草
- 小花
- 小石头
- 灌木
- 路边树苗

但正式世界里，长期稳定对象应由世界事实层决定。道路边缘生态可以是视觉投影，长期道路和长期对象必须有事实来源。

## 5. 为什么不能直接接入 /world

当前不能直接把 `pixel-scene-composer` 接入 `/world`，原因如下：

- 当前仍是测试参数驱动。
- 当前不是 `HomeMapState` 驱动。
- 当前不是 worldEngine 事实驱动。
- 当前 SVG 生成逻辑还混在测试模块中。
- 当前未完成正式 painter 拆分。
- 当前未完成主世界视觉验收。
- 当前不能让正式页面显示调试参数。

`/world-debug/pixel-scene-composer` 的价值是验证视觉组合算法，而不是替代正式世界渲染链路。正式 `/world` 必须只读正式世界事实，不能暴露 biome、moisture、decorationDensity、roadShape 这类测试调试控件给正式用户。

## 6. 正式模块拆分方案

推荐目录结构：

```text
src/world/procedural-painter/
├── WORLD_PAINTER_FORMAL_DESIGN.md
├── scene-composer/
│   ├── scene-composer-schema.ts
│   ├── scene-composer-gateway.ts
│   ├── scene-composer-constants.ts
│   ├── scene-composer-random.ts
│   ├── scene-composer-palette.ts
│   ├── scene-composer.ts
│   ├── terrain-composer.ts
│   ├── road-composer.ts
│   ├── vegetation-composer.ts
│   ├── object-composer.ts
│   └── scene-svg-renderer.ts
├── terrain/
├── vegetation/
├── objects/
└── renderer/
```

文件职责建议：

- `scene-composer-schema.ts`：定义正式输入、输出、tile、object、layer、summary 等类型。
- `scene-composer-gateway.ts`：提供稳定入口，屏蔽内部拆分细节。当前可继续兼容测试入口，拆分完成后应不再依赖测试模块。
- `scene-composer-constants.ts`：集中管理 tile size、columns、rows、默认 canvas 尺寸、默认密度阈值等常量。
- `scene-composer-random.ts`：提供稳定 hash、stable unit、seed 派生等确定性工具。禁止使用 `Math.random` 参与正式世界布局。
- `scene-composer-palette.ts`：根据 biome、moisture 等输入生成色盘。
- `scene-composer.ts`：正式组合入口，串联 terrain、road、vegetation、object，并输出 `SceneCompositionPlan`。
- `terrain-composer.ts`：生成地面 tile、基础地貌底色、地面变化。
- `road-composer.ts`：生成道路 path、road sample、edge mask、道路边缘结构。
- `vegetation-composer.ts`：生成草簇、路边生态、花、灌木、树苗等视觉植被。
- `object-composer.ts`：根据事实输入和视觉规则安排对象占位、长期对象投影、actor placeholder。
- `scene-svg-renderer.ts`：将 `SceneCompositionPlan` 渲染为 SVG。它只能渲染，不能决定事实。
- `terrain/`：未来存放 terrain painter 或 terrain-specific helper。
- `vegetation/`：未来存放 tree、grass、bush、flower 等 painter。
- `objects/`：未来存放 stone、actor placeholder、house placeholder、life trace 等 painter。
- `renderer/`：未来存放 SVG、Canvas、Pixi 等渲染后端适配。

## 7. 安全拆分顺序

拆分必须遵守“先不改变画面结果”的原则。每一步都应尽量只移动代码、整理职责、保持输出稳定。

第一阶段：

- 新增 `scene-composer-constants.ts`
- 新增 `scene-composer-random.ts`
- 新增 `scene-composer-palette.ts`

目标：先抽出常量、确定性随机工具和色盘逻辑，不改变 `composeScene` 与 `buildSceneSvg` 的外部行为。

第二阶段：

- 新增 `terrain-composer.ts`
- 新增 `road-composer.ts`

目标：把地面 tile、道路 sample、道路边缘过渡拆出，保持道路与 tile 结果基本不变。

第三阶段：

- 新增 `vegetation-composer.ts`
- 新增 `object-composer.ts`

目标：把草簇、路边生态、树、灌木、石头、花、角色占位等组合规则拆出。长期对象与视觉装饰的边界要在类型和注释中写清楚。

第四阶段：

- 新增 `scene-svg-renderer.ts`

目标：把 SVG 字符串生成从测试模块中拆出。Renderer 只读取 `SceneCompositionPlan`，不能决定世界事实。

第五阶段：

- 新增 `scene-composer.ts` 作为正式组合入口
- `scene-composer-gateway.ts` 不再依赖 `scene-composer-test-module.ts`

目标：让正式 gateway 走正式 composer，测试页继续通过 gateway 使用同一套正式组合链路。

每一阶段都必须保证：

- `/world-debug/pixel-scene-composer` 页面仍可打开
- 视觉结果基本不变
- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过

## 8. 未来接入正式世界的条件

只有满足以下条件后，才可以考虑接入 `/world`：

- Scene Composer 不再直接依赖测试模块。
- 输入来自正式 `WorldState` / `HomeMapState` / worldEngine 快照。
- UI 不创造正式世界事实。
- 视觉系统只读事实。
- 调试参数不进入正式页面。
- 通过 world-debug 视觉验收。
- 通过 V2.6 当前世界规则红线检查。

正式接入时，`/world` 应该接收类似 “RenderableWorldSnapshot -> SceneCompositionPlan -> Renderer” 的只读投影链路，而不是让页面自己传入调试参数生成事实。

## 9. 禁止事项

当前和后续拆分过程中，禁止：

- 禁止把测试 SVG 直接接入 `/world`。
- 禁止把 `/world-debug` 参数暴露给正式用户。
- 禁止写入孵化器。
- 禁止写入胚胎默认链路。
- 禁止写入候选宠物驱动。
- 禁止让宠物默认进入世界。
- 禁止用旧聊天摘要覆盖 V2.6 当前正式文档。
- 禁止让 Renderer 创造世界事实。
- 禁止为了画面好看凭空生成正式世界对象。

如果某些词出现在审计、红线或历史说明中，只能表示“不允许这样做”，不能表示当前方案支持这些旧路线。

## 10. 本阶段验收标准

本次任务只新增正式设计文档，不改动主页面，不重构大文件，不改变当前 debug 测试页行为。

验收标准：

1. 新增 `src/world/procedural-painter/WORLD_PAINTER_FORMAL_DESIGN.md`
2. 文档内容完整、清晰、中文
3. 没有把旧设定作为当前方案
4. 明确说明当前不能接入 `/world`
5. 明确说明下一步是安全拆分，不是主页面接入
6. `npm run lint` 通过
7. `npx tsc --noEmit` 通过
8. `npm run build` 通过
