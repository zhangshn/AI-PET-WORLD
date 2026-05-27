# AI-PET-WORLD V2.6｜完整业务架构总图（强化版）

## 0. 总原则｜世界由规则、坐标、生态、生命、痕迹和时间线共同生成

AI-PET-WORLD V2.6 的世界不是一张由坐标直接画出的图，也不是 UI 临时拼出的背景板。世界由规则、坐标、生态、生命、痕迹和时间线共同生成，并以世界事实为先、表现层为后的方式运行。

用户是世界源头、观察者和轻影响者，不是直接控制者。管家是用户生命信息在世界中的自主意识管理者。宠物是独立生命，不是默认资产，不应默认进入世界。

坐标是定位底座，用来表达对象在哪里、区域在哪里、地块是否可通行、移动成本如何计算；坐标不是世界生成算法。长期移动结果不进入独立 road/path/movement channel 母架构，而统一归入痕迹体系。

正式 `/world` 必须是像素主世界。正式主世界链路是：

```txt
WorldRuntimeSaveRecord + HomeMapState + SpaceGrid + TraceField + ButlerState
→ WorldViewModel
→ PixelWorldView
→ Tile / Trace / Object / Sprite / Atmosphere Layer
```

Pixel Scene Composer 是 `/world-debug` 的规则实验室，只用于验证像素世界组合规则，不能原样搬进正式 `/world`。SVG、CSS 几何图层、procedural renderer、FormalGeometry、审计卡片、手动 Tick 必须隔离到 `/world-debug` 或历史验证资产。

## 1. 产品战略与业务定位架构

AI-PET-WORLD 的核心体验是让用户拥有一个会随时间、规则、生命与痕迹演化的自主世界。用户不是在操作一个装饰性家园，而是在观察一个由事实驱动、由管家管理、由生态和痕迹持续塑形的生命环境。

产品定位包括：

- 自主世界：世界拥有状态、历史、痕迹、记忆和学习入口。
- 轻影响关系：用户通过创建、关注、等待、表达偏好影响世界，而不是直接改写世界事实。
- 管家中介：管家理解用户生命信息，并以自主意识管理世界事务。
- 独立生命：宠物未来进入世界时必须作为独立生命出现，不是默认资产或 UI 装饰。
- 像素主世界：正式 `/world` 以像素主世界作为第一体验，不以 Debug 卡片或 SVG 预览代替。

## 2. 完整世界图生成核心逻辑｜不是坐标直接画图，而是规则生成世界

世界图生成的核心顺序是：

```txt
世界事实
→ 空间结构
→ 生态与资源状态
→ 痕迹与时间线
→ 管家与生命状态
→ WorldViewModel
→ 像素表现
```

坐标只回答“在哪里”。区域、生态、对象、管家行为、痕迹强度和时间阶段共同回答“这里为什么变成这样”。

世界事实必须先于表现层。UI、PixelWorldView、Canvas、SVG、CSS、LLM narrative 都不能生成世界事实。所有事实写入必须走 runtime tick、MapDiff、Audit、SafeApply 和 WorldRuntimeSaveRecord 的规则边界。

## 2.1 正式像素主世界绘制方案｜从规则组合到 PixelWorldView

正式像素主世界不是把 Debug Scene Composer 页面搬到 `/world`，而是把实验室验证过的组合规则沉淀为正式 mapper / renderer：

```txt
HomeMapState + SpaceGrid + TraceField + ButlerState
→ WorldViewModel
→ PixelWorldView
→ PixelWorldCanvas
```

正式表现层职责：

- Tile Layer：读取 SpaceGrid 和世界事实，表现地面、边界、建造区、生态过渡和痕迹压低感。
- Trace Layer：读取 TraceField 和 TraceVisualProjection，表现草地压低、裸土、磨损、维护、等待点和关注点。
- Object Layer：读取 HomeMapState placements，表现树、灌木、石头、花、蘑菇、设施和结构。
- Sprite Layer：表现管家；宠物只有在已有事实时才显示。
- Atmosphere Layer：根据世界状态给出轻量氛围，不写事实。

正式 `/world` 禁止使用 buildSceneSvg、data:image/svg+xml、WorldPainterReadonlyPreview、FormalWorldView、ProceduralRendererView 作为主视觉。

## 3. 横向八层业务母架构

V2.6 以八层横向母架构组织业务能力。每一层都服务世界事实与表现链路，但不能越权写入其他层事实。

## 3.1 世界本体层

世界本体层定义世界身份、所有者、创建来源、当前阶段、HomeMapState、WorldRuntimeSaveRecord、世界时间和持久化边界。

世界本体层是事实源之一。它不是 UI 状态，也不是渲染缓存。正式页面只能读取本体事实，不能在 render/request 阶段推进 tick 或写 save。

## 3.2 生命人格与记忆层

生命人格与记忆层包含用户生命信息、管家人格转译、未来宠物人格、记忆种子和学习入口。

人格不能直接改写世界事实。记忆种子不是正式记忆，学习结果也不能直接写世界事实。任何行为影响都必须进入规则层和 runtime 链路。

## 3.3 世界规则层

世界规则层负责将资源、建设、生态、痕迹、管家意图、空间限制和时间推进组合为可审计变化。

规则层必须维护：

- MapDiff
- Audit
- SafeApply
- Runtime Tick
- Save Record

AI / LLM / narrative 不能绕过规则链路直接写世界事实。

## 3.4 世界空间层

世界空间层提供 coordinate、region、tile/cell、placement、occupancy、passability 和 movementCost。

空间层只表达定位、占用、通行和成本。它不生成世界原因，不设置独立移动通道，不把 road/path/route 写成世界生成前提。

## 3.5 世界生态层

世界生态层表达草地、土壤、湿度、生态健康、恢复、枯萎、覆盖、蘑菇、小生态信号等变化。

生态状态可以参与规则判断和视觉表现，但必须通过世界事实与痕迹体系进入后续变化，不能由 UI 直接生成。

## 3.6 行为意图层

行为意图层负责管家的观察、等待、维护、建设等 motivation。管家可以读取资源、建设状态、痕迹影响、记忆种子提示和世界阶段，但不能被 trace 或用户指令直接控制。

管家行为仍必须通过 runtime、规则和 SafeApply 才能影响世界事实。

## 3.7 世界变化层

世界变化层包括 runtime tick、资源循环、建设推进、生态变化、痕迹生命周期和事件影响。

显式 runtime tick 是世界变化的入口。正式 `/world` 读取时不能推进世界变化，不能写 HomeMapState 或 WorldRuntimeSaveRecord。

## 3.8 世界表现层

世界表现层包括 WorldViewModel、PixelWorldView、PixelWorldCanvas、正式文案、P-Phone 入口和管家解释。

表现层只读取事实和 ViewModel。PixelWorldView 只画 model.tiles、model.traces、model.objects、model.actors、model.atmosphere，不读取 runtime save，不推进 Tick，不写事实。

## 4. 纵向时间线架构

世界时间线由创建、初始稳定、资源积累、管家观察、建设维护、痕迹生成、痕迹沉淀、记忆种子准备和未来学习消费构成。

时间推进只能由显式 runtime tick 或未来后台 job 触发。页面访问不能成为时间推进入口。

## 5. 世界痕迹架构

痕迹是世界记忆的外在形式，不是装饰。痕迹来自空间使用、移动、生态变化、行为活动、建设维护、关系互动、事件影响、时间流逝和情绪关注。

痕迹参与：

- movementCost 与 familiarity 派生
- 生态变化观察
- 管家 motivation 的只读上下文
- TraceVisualProjection
- MemorySeed 派生

痕迹本身不能绕过 runtime 直接改写 HomeMapState。Trace effects 是影响建议，必须由规则层读取。

## 6. 管家、宠物、世界三重学习架构

三重学习是未来能力，不应在当前阶段写成已完成。

- 管家学习：从世界痕迹、记忆种子和用户关系中形成长期管理倾向。
- 宠物学习：未来宠物进入世界后形成独立行为偏好和熟悉区域。
- 世界学习：世界从长期痕迹和生态变化中沉淀状态趋势。

当前阶段允许生成记忆种子和提示，不等于完整 ButlerMemory、PetMemory 或 WorldLearning。

## 7. 创建世界业务流程

创建世界流程应遵循：

```txt
用户输入生命信息
→ 管家种子与世界初始事实
→ HomeMapState
→ SpaceGrid
→ 初始资源与生态状态
→ Runtime Save
→ WorldViewModel
→ PixelWorldView
```

创建世界不默认生成宠物，不恢复孵化器旧路线，不让 UI 直接写事实。

## 8. 无大数据阶段的业务模型与规则资产库

当前阶段不训练大模型。系统依赖规则资产库、参数模型、世界事实、痕迹反馈和小样本运行日志来运行。

规则资产包括：

- 空间映射规则
- 生态状态规则
- 痕迹生命周期规则
- movementCost 派生规则
- 管家 motivation scoring 规则
- 记忆种子筛选规则
- 像素表现 mapper / renderer 规则

这些规则先服务确定性、可审计和可回放，再为未来自学习阶段积累样本。

## 9. 跨层组合关系

跨层组合必须遵守方向：

```txt
事实层 → 规则层 → ViewModel → 表现层
```

禁止反向：

```txt
UI / Canvas / SVG / CSS / narrative → 世界事实
```

痕迹可以影响空间判断、视觉提示、管家评分和记忆种子，但只能通过只读派生或显式 runtime tick 持久化摘要，不能直接写世界事实。

## 10. 用户关系与商业架构

用户关系以长期陪伴、观察、轻影响和信任为核心。商业化不能破坏生命独立性，不能把宠物默认资产化，也不能把管家降级为按钮执行器。

正式世界体验必须让用户感知：

- 世界在运行
- 管家在观察和管理
- 痕迹在积累
- 生态在变化
- 用户不是直接操控者

## 11. 当前进度、代码风险、未完成能力与后续路线

当前已形成正式像素主世界外壳和基本链路：

```txt
readWorldRuntimeForView
→ buildWorldViewModelForPixelWorld
→ PixelWorldView
```

但不能夸大为“完整像素主世界已完成”。正式 PixelWorldView 外壳已出现，部分 mapper 已开始承接规则；下一阶段仍需推进：

```txt
WORLD-PIXEL-RULE-MAPPER-00
```

该阶段目标是继续把 Pixel Scene Composer 验证过的组合规则沉淀到正式 WorldViewModel mapper 与 Pixel renderer，而不是把 Debug 页面搬进 `/world`。

仍需警惕：

- Debug renderer 回流正式 `/world`
- SVG / CSS 几何图被误当主视觉
- road/path 被误恢复为正式移动架构
- 宠物被默认生成
- UI 写事实或推进 tick
- 管家学习、宠物学习、世界学习被写成已完成

## 12. 业务治理红线

- UI 不生成世界事实。
- PixelWorldView 不读取 runtime save，不推进 tick，不写事实。
- 正式 `/world` 必须是 PixelWorldView 主世界入口。
- Pixel Scene Composer 只能是 `/world-debug` 规则实验室。
- SVG、CSS 几何图、procedural renderer、FormalWorldView、WorldPainterReadonlyPreview 不得作为正式 `/world` 主视觉。
- 不设置独立 movement channel / road / path 母架构。
- 长期移动结果统一进入痕迹体系。
- 坐标不是生成算法。
- 宠物不默认出现。
- 人格不能直接改写世界事实。
- 学习结果不能直接写世界事实。
- LLM / narrative 不能直接写世界事实。
- 痕迹不是装饰，必须参与记忆、学习、世界变化和表现入口。
- Debug 页面、审计卡片、手动 Tick、手动保存不得伪装成正式体验。
