> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD 世界视觉语言文档 v1.0

## 0. 文档定位

本文档承接 `docs/mvp/AI_PET_WORLD_ARCHITECTURE_FREEZE.md` 和 `docs/mvp/LIFE_TO_VISUAL_WORLD_MAPPING.md`。

本文档只定义视觉表达规则，不实现代码，不新增 TypeScript 类型，不修改 Renderer、worldEngine、systems、PlacementEngine、InitialHomeGenerator 或 `/world` 页面。

本文档用于后续开发：

- WorldExpression
- ActorRuntime
- Construction Visibility
- Renderer 表达层

本文档不是 UI 设计稿，不是原型图，不定义 HUD，不定义卡片页。正式 `/world` 的核心是世界本身。

核心句：

```text
不要让用户读懂后端，要让用户看见后端。
```

## 1. 总原则：世界本身就是 UI

正式 `/world` 不显示：

- HUD
- 状态卡
- 解释面板
- 顶部 Hero
- 底部旁白
- 事件流
- 常驻按钮
- 紫微术语
- debug grid
- 坐标标签

正式 `/world` 显示：

- 地图
- 管家
- 宠物
- 设施
- 自然物件
- 光线
- 动作
- 地图变化

用户通过观察世界理解系统，而不是阅读状态字段。宠物是否饿、管家是否在建设、资源是否准备好、家园是否更安全，都应该被地图、动作、位置、节奏和变化表达出来。

## 2. 后端状态到视觉表达的总链路

冻结链路为：

```text
PetState / ButlerState / ConstructionPlan / WorldTime / HomeMapState
→ WorldExpression
→ VisualIntent / MovementIntent / PoseIntent / AtmosphereIntent / MapDiffIntent
→ ActorRuntimeState / MapDiff
→ HomeMapRenderer
→ 用户看见世界变化
```

| 层级 | 职责 |
| --- | --- |
| `PetState` | 宠物真实状态，包含 `hunger`、`energy`、`mood`、`action`、lifeState、goal、memory、learning、perception、interpretation 等 |
| `ButlerState` | 管家真实状态，包含 `task`、`mood`、opportunity、profile、behaviorBias、task trace、memory、relation 等 |
| `ConstructionPlan` | 建设意图，包含 projectType、targetZoneType、status、currentStage、priority、stages 等 |
| `WorldTime` | 世界时间，影响光线、活动节奏、建设频率、休息倾向 |
| `HomeMapState` | 当前地图状态，包含 zones、placements、resources、constructionPlans、mapDiffs |
| `WorldExpression` | 视觉翻译层，把后端状态翻译成意图，不直接渲染、不直接改 UI |
| `VisualIntent` | 表达视觉状态，例如更暗、更温暖、区域更凌乱、角色更谨慎 |
| `MovementIntent` | 表达移动目标，例如 food_bowl、pet_bed、construction zone、boundary |
| `PoseIntent` | 表达姿态，例如 eating、resting、sleeping、working、observing、alert |
| `AtmosphereIntent` | 表达氛围，例如 morning soft light、night lamp on、quiet evening |
| `MapDiffIntent` | 表达地图变化意图，后续转为 MapDiff |
| `ActorRuntimeState` | 地图上的活体表现，表达 x/y、target、facing、pose、movementState、speed、currentIntent |
| `MapDiff` | 地图变化，表达 add / move / update / remove |
| `Renderer` | 只渲染结果，不生成业务逻辑，不决定命理、建设或行为 |

## 3. 三段式视觉因果

所有重要行为都必须尽量表现为：

```text
前兆 → 行动 → 结果
```

宠物饿了：

- 前兆：宠物停顿、朝向食物碗
- 行动：宠物走向食物碗
- 结果：宠物在碗旁 `eating` pose，随后离开或休息

宠物累了：

- 前兆：宠物移动变慢、停顿变多
- 行动：宠物走向宠物床
- 结果：宠物 `resting` / `sleeping` pose

管家建设：

- 前兆：管家走到目标区域观察
- 行动：管家在储物箱和建设区之间移动
- 结果：地面、设施、装饰通过 MapDiff 出现或移动

不要让地图突然变化。用户要能看见变化原因。MapDiff 的出现最好有角色移动、区域观察、材料准备或环境变化作为前兆。

## 4. 宠物状态视觉语言

基于 PetState / behavior / drive，宠物状态不通过数字展示，而通过目标、移动、朝向、姿态和路径频率表达。

| 状态或 drive | 视觉表达 |
| --- | --- |
| `hunger` 高 | 宠物目标变成 `food_bowl`；靠近食物碗；`eating` pose；食物区路径更常被使用 |
| `energy` 低 | 移动速度降低；停顿增加；目标变成 `pet_bed`；`resting` / `sleeping` pose |
| `mood relaxed` | 行动节奏平稳；更容易靠近照护区或休息区；idle 呼吸动画柔和 |
| `mood alert` | 停顿更长；朝向边界、入口或刺激源；`alert` pose；社交距离变远 |
| `mood curious` | 靠近草丛、石头、蝴蝶、新物件；`exploring` / `observing` pose；边界路径使用增加 |
| `drive eat` | 目标 `food_bowl`；`eating` pose |
| `drive rest` | 目标 `pet_bed`；`resting` / `sleeping` pose |
| `drive explore` | 目标自然物件 / 边界 / 新设施；`walking` / `exploring` pose |
| `drive observe` | 停在目标物旁；facing target；`observing` pose |
| `drive approach` | 靠近管家 / 照护区 / 安全物件；`approach` pose |
| `drive avoid` | 远离刺激源；躲到边界内侧或安全角落；`alert` / retreat pose |

当前 `src/types/pet.ts` 已有 `sleeping`、`eating`、`walking`、`exploring`、`approaching`、`idle`、`observing`、`resting`、`alert_idle` 等 PetAction。后续 WorldExpression 可以把更细的 drive 映射到这些 action / pose，再交给 ActorRuntime 表达。

## 5. 宠物人格倾向视觉语言

PetVisualProfile 是宠物长期视觉身份。PetState 是宠物当前状态。两者不能混用。

| 宠物人格倾向 | 长期视觉语言 |
| --- | --- |
| 安静 / 敏感倾向 | 移动更慢；停顿更多；更常观察；更常靠近休息区；颜色和动作更柔和 |
| 探索 / 活跃倾向 | 移动频率更高；更常靠近草丛、花、蝴蝶、边界；`walking` / `exploring` pose 更多；路径变化更频繁 |
| 警觉 / 防御倾向 | `alert` pose 更多；离入口或陌生物更远；靠近行为更谨慎；常停在安全角落或边界内侧 |
| 亲近 / 依赖倾向 | 更常靠近管家或照护区；`approach` pose 更多；休息区与食物区路径使用更频繁 |

同一个 PetState 在不同 PetVisualProfile 下可以表现出不同节奏。例如同样是 `hunger` 高，亲近型宠物可能更快靠近照护区，警觉型宠物可能先观察食物碗和管家位置，再靠近。

## 6. 管家任务视觉语言

基于 ButlerState / task，管家任务通过站位、朝向、路径、姿态和 MapDiff 前兆表达。

| task / expression intent | 视觉表达 |
| --- | --- |
| `watching_pet` | 管家站在宠物附近但不贴近；朝向宠物；保持一定距离；不打断宠物行为 |
| `offering_food` | 管家靠近食物碗 / 储物箱 / 照护区；食物区后续可能 update；宠物仍自己决定是否靠近 |
| `offering_rest` | 管家靠近宠物床或休息区；休息区可能被整理；宠物仍自己决定是否休息 |
| `offering_approach` | 管家停在宠物可接受距离；不追逐宠物；给宠物接近机会 |
| `building_home` | 管家移动到建设目标区；在储物箱与目标区之间移动；work pose；触发 ConstructionPlan / MapDiff |
| `idle` | 管家在住所、路径、照护区附近低频移动；idle pose；不制造无意义变化 |
| `observe_environment` | 管家靠近边界、入口、新物件；observing pose；后续可能形成建设意图 |

当前 `src/systems/butler/butler-schema.ts` 已有 `watching_pet`、`offering_food`、`offering_rest`、`offering_approach`、`building_home`、`idle` 等 ButlerTask。`observe_environment` 暂作为后续 WorldExpression / ActorRuntime 的表达意图，不声称当前 ButlerTask enum 已包含。

## 7. 管家人格视觉语言

基于 ButlerVisualProfile / constructionStyle，管家的长期差异不显示为数值，而显示为路径、设施优先级、巡视频率、建设内容和动作节奏。

| constructionStyle | 长期视觉语言 |
| --- | --- |
| `structuredBuilder` 高 | 管家路径更直接；更常走向储物区、道路、地基；work pose 更频繁；家园区域更规整 |
| `warmCaretaker` 高 | 更常靠近照护区、宠物床、食物碗、水盆；小灯、休息区、宠物床更早出现；靠近宠物动作更慢 |
| `protectiveKeeper` 高 | 更常巡视边界、入口、安全角落；树木、灌木、围合感更明显；宠物休息区更靠内侧 |
| `aestheticOrganizer` 高 | 更常添加花草、灯、落叶、石头、蝴蝶等自然装饰；视觉层次更丰富 |
| `quietMaintainer` 高 | 更少大幅度移动；更常维护已有区域；动作更低调；家园更安静 |
| `adaptivePlanner` 高 | 管家目标点随宠物状态、天气、资源变化而变化；建设计划更灵活 |

这些长期差异应进入 WorldExpression 和 Construction Visibility，而不是进入正式 UI 文案。

## 8. 建设阶段视觉语言

基于 ConstructionPlan / ConstructionStage / MapDiff，建设必须被看见为过程，而不是凭空发生。

| ConstructionStage | 视觉语言 |
| --- | --- |
| `planned` | 管家靠近目标区域观察；暂不产生地图变化 |
| `preparing_ground` | 地面从草地转为踩踏泥地 / 木板 / 承托；edge 或 surface decoration 出现 |
| `placing_materials` | 储物箱附近出现材料；管家从储物区移动到建设区 |
| `building` | 设施 / 建筑 placement 出现或移动；work pose；MapDiff `add` / `move` / `update` |
| `decorating` | 花草、石头、落叶、小灯、蝴蝶等装饰出现；`aestheticOrganizer` 影响更明显 |
| `completed` | 管家离开目标区；宠物开始使用新区域；区域看起来稳定 |

建设不能凭空发生。建设不能只靠文字提示。建设必须通过地图变化和管家移动被看见。

当前 `src/world/construction/construction-schema.ts` 已定义 `planned`、`preparing_ground`、`placing_materials`、`building`、`decorating`、`completed`，后续 Construction Visibility 应直接围绕这些阶段扩展表达。

## 9. 地图区域视觉语言

初始家园区域需要让用户一眼理解“这里是什么”，但不能靠标签、坐标或解释卡片。

| 区域 | 视觉语言 |
| --- | --- |
| 宠物抵达区 | 自然空地；草泥边缘；小石头 / 小花；连接照护区的路径；不是科幻传送门；不是孵化仓 |
| 初始照护区 | 食物碗；水盆；踩踏地面；小草丛 / 小石头；连接住所和抵达点的路径 |
| 临时住所区 | 帐篷；泥地 / 木板承托；小灯；储物；路径连接 |
| 宠物休息区 | 宠物床；安静草边；阴影；小灯；靠近但不贴住所 |
| 自然边界区 | 树；灌木；石头；小花；落叶；形成外围边界 |

这些区域应由 `HomeZone`、`MapPlacement`、scene recipe、PlacementEngine 和 assetId 共同表达，不由 `/world/page.tsx` 手写坐标。

## 10. 自然模块视觉语言

自然模块用于表达生命感、安全感、探索目标和氛围，不是随机撒装饰。

| 模块 | 视觉职责 |
| --- | --- |
| 树 | 用于边界、安全感、遮挡和世界稳定感；`protectiveKeeper` 高时密度更高 |
| 灌木 | 用于过渡区、边界和安全角落；不能随机孤立摆放 |
| 草丛 | 用于自然感、宠物探索目标、地面过渡 |
| 小花 | 用于美感、温暖感、`aestheticOrganizer` 表达 |
| 石头 | 用于边缘、路径转角、自然空地 |
| 落叶 | 用于氛围、季节、安静感 |
| 蝴蝶 | 用于动态生命感；`aestheticOrganizer` / `warmCaretaker` 高时概率增加；不作为核心建筑，不影响碰撞 |
| 小灯 | 用于温暖、夜晚可读性、照护区 / 休息区表达；`warmCaretaker` 高时更早出现 |

自然模块必须服务区域关系、宠物行为目标和视觉氛围。装饰密度应可追溯到 WorldVisualProfile、constructionStyle 或 MapDiff。

## 11. 世界时间视觉语言

不需要 HUD 显示时间，但时间要通过世界表现。

| 时间 | 视觉语言 |
| --- | --- |
| 早晨 | 光线偏柔；宠物更容易探索 / 接近；管家开始观察或整理 |
| 白天 | 光线明亮；建设、路径整理、资源处理更常发生 |
| 傍晚 | 光线变暖；休息区、小灯更明显；宠物活动节奏降低 |
| 夜晚 | 世界变暗；小灯亮起；宠物更容易休息；管家减少大幅建设 |

时间可以进入 atmosphere layer，不进入 HUD。当前 Renderer 已有 day-night atmosphere 表达位置，后续应让 WorldExpression 生成 AtmosphereIntent，再由 Renderer 表达。

## 12. 资源与环境视觉语言

资源不是商城数字。资源应该表现为世界里的状态、物件和空间关系。

资源应该表现为：

- 木材 / 储物箱
- 泥土 / 地面承托
- 草地健康
- 水盆
- 树木 / 落叶 / 石头
- 可用休息空间

资源变化：

| 资源状态 | 视觉语言 |
| --- | --- |
| `materialReadiness` 高 | 储物区更有材料感 |
| `careReadiness` 高 | 照护区更完整 |
| `naturalGrowth` 高 | 草丛、花草、树更容易出现 |
| `groundHealth` 低 | 地面斑驳、泥地更明显 |
| `spacePressure` 高 | 设施更紧凑 |

这些资源状态来自 `HomeMapState.resources`，后续不能以常驻数字面板作为正式 `/world` 主表达。

## 13. MapDiff 视觉语言

MapDiff 必须可见、可理解、可追踪。

| operation | 视觉语言 |
| --- | --- |
| `add` | 新物件出现；最好由管家接近目标区后发生 |
| `move` | 物件位置调整；应体现管家整理或宠物需求 |
| `update` | 地面、状态、设施外观变化；可表现维护、使用、磨损、增强 |
| `remove` | 物件消失或被整理；需要谨慎，避免用户误以为 bug |

MapDiff 不覆盖整张地图。MapDiff 是世界成长的可追踪记录。每个重要 MapDiff 都应该能回溯到 ConstructionPlan、WorldExpression、资源状态或长期成长策略。

## 14. 禁止视觉表达

禁止：

- 用文字卡片解释后端作为正式主体验
- HUD 常驻显示状态
- 把宠物 hunger / energy 数字显示在主世界
- 把管家 task 字段显示在主世界
- 把 constructionStyle 数值显示在主世界
- 把紫微术语显示在主世界
- 让物件随机瞬移
- 让地图突然变化但没有前兆
- 让 UI 层手写坐标
- 让 Renderer 生成业务关系
- 用整张图片当地图
- 用图标贴在草地上假装世界

这些内容可以进入调试页、F3 developer panel、personality-test 或 dev audit，但不能成为正式 `/world` 主体验。

## 15. MVP 最小视觉闭环

第一阶段只要求做三个闭环。

闭环 A：宠物吃饭

- `hunger` 高
- 宠物看向食物碗
- 宠物走向食物碗
- `eating` pose
- `hunger` 下降

闭环 B：宠物休息

- `energy` 低
- 宠物走向宠物床
- `resting` / `sleeping` pose
- `energy` 恢复

闭环 C：管家建设

- ConstructionPlan 开始
- 管家走向目标区
- 地面 / 设施 / 装饰通过 MapDiff 变化
- 宠物后续使用新区域

只要这三个闭环成立，用户就能看见后端逻辑。

## 16. 与后续代码层对应关系

只建议，不执行。

后续对应代码：

```text
src/world/expression/
  world-expression-schema.ts
  pet-expression-mapper.ts
  butler-expression-mapper.ts
  construction-expression-mapper.ts
  atmosphere-expression-mapper.ts

src/world/actors/
  actor-runtime-schema.ts
  actor-runtime-engine.ts
  actor-target-resolver.ts
  actor-pose-resolver.ts

src/world/rendering/
  后续扩展 ActorRuntimeState 渲染支持
```

说明：

- 先写类型，再写 mapper，再接 Renderer。
- 不要直接改 `/world` UI。
- `ActorRuntimeState` 表达活体运行位置、目标、朝向、速度和姿态。
- `MapPlacement` 表达地图物件。
- `HomeMapRenderer` 只渲染 HomeMapState / render model / ActorRuntimeState 的结果。

## 17. 验收标准

后续实现必须满足：

1. 用户不看文字也能理解宠物在吃饭。
2. 用户不看文字也能理解宠物在休息。
3. 用户不看文字也能理解管家在建设。
4. 用户能通过地图差异感知不同管家建设风格。
5. 用户能通过宠物动作感知宠物状态。
6. 用户能通过自然密度、花草、边界感知世界风格。
7. 正式 `/world` 不出现 HUD。
8. 正式 `/world` 不出现状态卡。
9. Renderer 不生成业务逻辑。
10. MapDiff 变化能被追踪。
11. ActorRuntimeState 和 MapPlacement 职责清晰。
12. 调试信息只进入 F3 / personality-test / dev audit。

## 18. 下一步任务

下一步任务只建议，不执行：

```text
ASSET-MODULE-SYSTEM-DOC-04
```

任务目标：

新增 `docs/mvp/ASSET_MODULE_SYSTEM.md`，定义地图、自然、设施、宠物、管家等素材模块如何生成、注册、组合、替换，以及 Asset Lab 如何作为开发工具存在。
