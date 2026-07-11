# AI-PET-WORLD 业务与技术架构

更新时间：2026-07-11 11:56:40 +08:00

状态：long-term-architecture-reference / 当前只实现完整自然家园地图相关层

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

> 本文保留长期产品架构。当前执行范围、阻断和下一步只读取 `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`，不得从长期架构提前启动管家角色或玩家交互。紫微斗数是人格数据子系统，当前地图阶段不实现其业务，但长期必须通过正式契约连接 AI 管家人格映射。

本文定义当前 MVP 和长期主线的业务架构、技术架构、数据流、模块边界和禁止事项。

## 1. 架构原则

| 原则 | 说明 |
|---|---|
| 世界事实优先 | 世界事实是源头，视觉不能决定世界事实。 |
| 结构先于画面 | 先有可玩的结构地图，再有视觉表达。 |
| AI Painter 负责完整视觉生产 | AI Painter 在世界事实、导演结果和地图结构约束下生成完整世界视觉及持续更新；局部材料只是内部能力。它不负责 Runtime、碰撞、交互和世界规则。 |
| 地图不是单图 | 正式游戏地图由地图块、视觉单元、对象层、可走层、碰撞层、交互层和状态层组成。 |
| `/world` 只展示 RuntimeFrame | 训练图、候选图、失败图、局部图只进训练页和归档页。 |
| 训练与正式隔离 | 训练产物不能绕过 RuntimeFrame 和 VisualJudge。 |
| 禁止程序直绘最终画面 | 程序可以生成结构、Mask、校验、合成，不能手写玩家最终画面。 |
| 机器审核不是最终通过 | VisualJudge 和 RuntimeFrame gate 只是前置闸门，最终必须由项目所有者人工确认达到正式游戏标准。 |
| 参考图只定方向 | 当前最高局部图只作为质感基准，不能绕过 RuntimeFrame，也不能作为 `/world` 成果。 |

项目架构必须始终保持两条一级主线：

| 一级主线 | 输入 | 核心处理 | 输出 |
|---|---|---|---|
| AI 管家人格与角色自主 | 紫微斗数、八字、用户选择的映射模式 | 性格数据标准化、现实自我正向映射、平行世界反向紫微映射、记忆与自主决策 | 可持续行动的 AI 管家 |
| 类地球世界自主运行与生长 | 类地球参数、世界数据字典、时间、环境和世界事实 | 世界生成、Runtime 推进、生态与资源变化、状态持久化 | 持续存在并自主演化的世界 |

两条主线通过“管家感知世界事实”和“管家行为写入合法世界变化”连接。视觉系统只负责表达该闭环产生的事实。

## 2. 业务架构图

```mermaid
flowchart TD
  A["用户申请 AI 管家"] --> B["选择现实自我 / 平行世界自我"]
  B --> C["紫微斗数 / 八字性格数据"]
  C --> D["正向人格映射 / 反向紫微映射"]
  D --> E["管家人格 / 记忆 / 动机 / 自主决策"]
  W0["类地球参数与世界数据字典"] --> W1["世界生成 / 时间 / 环境 / 生态 Runtime"]
  W1 --> F["世界事实 WorldFacts"]
  E --> F
  F --> E
  F --> V["VisualFactManifest 当前视觉事实清单"]
  V --> G["结构化地图 HomeMapStructure"]
  G --> H["GameMapFrame"]
  H --> I["世界导演输出 / 完整地图任务包"]
  I --> J["本地 AI Painter 真实完整视觉推理"]
  J --> K["本轮完整地图候选"]
  K --> M["Runtime Compositor 绑定结构与运行层"]
  M --> N["FormalVisualJudge / Composite Quality"]
  N -->|"通过"| O["GameMapRuntimeFrame"]
  N -->|"失败"| P["失败归档 / 修正计划"]
  O --> R["项目所有者人工最终验收"]
  R -->|"通过"| Q["/world 玩家主世界"]
  R -->|"否决"| P
```

## 3. 技术架构图

```mermaid
flowchart LR
  subgraph Personality["Butler Personality and Autonomy"]
    Astrology["Ziwei / Bazi Structured Data"]
    Mapping["Self Mapping / Reverse Ziwei Mapping"]
    ButlerCore["Personality / Memory / Motivation / Decision"]
  end

  subgraph Runtime["World Runtime"]
    Earth["Earth-like Parameters"]
    WF["WorldFacts"]
    Tick["World Tick"]
    Growth["Environment / Ecology / Growth"]
  end

  subgraph Map["Game Map System"]
    HMS["HomeMapStructure"]
    GMF["GameMapFrame"]
    Layers["terrain/object/walkable/collision/interaction/state"]
    Slots["VisualUnitSlots"]
  end

  subgraph Painter["Local AI Painter"]
    FactManifest["VisualFactManifest"]
    Director["World Director Output"]
    Task["Complete World Visual Task Package"]
    Model["Local Complete-World Model"]
    Output["Fresh Complete-Map Candidate"]
    Archive["Generated Results Archive"]
  end

  subgraph Judge["Visual Judge"]
    VJ0["VJ-0 来源/绑定"]
    VJ1["VJ-1 视觉质量"]
    VJ2["VJ-2 语义/游戏地图"]
    CQ["Composite Quality"]
  end

  subgraph Display["Display"]
    RF["GameMapRuntimeFrame"]
    OwnerGate["Owner Final Acceptance"]
    WorldPage["/world"]
  end

  Astrology --> Mapping --> ButlerCore
  Earth --> Tick --> Growth --> WF
  ButlerCore --> WF
  WF --> ButlerCore
  WF --> FactManifest --> HMS --> GMF --> Slots --> Director --> Task --> Model --> Output --> Archive
  Output --> VJ0 --> VJ1 --> VJ2 --> CQ
  CQ --> RF --> OwnerGate --> WorldPage
  GMF --> RF
```

## 4. RuntimeFrame 数据结构边界

正式 GameMapRuntimeFrame 必须至少包含：

| 层 | 作用 | 是否世界事实 |
|---|---|---:|
| identity | worldId、ownerId、tick、sourceFactIds | 是 |
| mapStructure | 地图结构、入口、中心、区域、道路、水岸 | 是 |
| terrainLayer | 草地、水体、水岸、道路等地形定义 | 是 |
| objectLayer | 树、石头、草丛、花等对象记录 | 是 |
| visualLayer | AI Painter 生成的视觉材料引用 | 部分。它是表达，不是事实。 |
| walkableLayer | 可走区域 | 是 |
| collisionLayer | 不可穿越区域 | 是 |
| interactionLayer | 可查看、可点击、可建设、可采集区域 | 是 |
| stateLayer | 生命周期、建造状态、资源状态、天气影响 | 是 |
| audit | VisualJudge、hash、时间戳、模型版本、失败记录 | 否，但必须存在。 |
| ownerAcceptance | 项目所有者人工最终验收记录 | 否，但正式展示前必须存在通过记录。 |

## 5. 关键对象

| 对象 | 作用 | 关键字段 |
|---|---|---|
| WorldFact | 世界事实源头 | `factId`、`worldId`、`tick`、`type`、`payload`、`source` |
| VisualFactManifest | 视觉所需事实清单 | `sourceFactIds`、主事实、支撑事实、环境事实 |
| CompleteWorldVisualTaskPackage | 当前完整地图推理任务 | `worldId`、`tick`、`dictionaryVersion`、`visualFactManifestId`、导演输出、结构输入、失败记忆、禁止内容 |
| CompleteWorldVisualCandidate | 本轮真实完整地图候选 | `taskPackageId`、`modelVersion`、`checkpoint`、`seed`、`imageHash`、`generatedAt`、`reusedExistingImage=false` |
| HomeMapStructure | 自然家园结构 | 入口、中心、水岸、道路、自然边界 |
| GameMapFrame | 可合成地图帧 | layers、slots、layout、camera |
| VisualUnitSlot | 视觉单元槽位 | `slotId`、`kind`、`bounds`、`layer`、`sourceFactIds` |
| RegionTexture | AI 生成的区域视觉材料 | `textureId`、`slotId`、`imageHash`、`reviewStatus` |
| ObjectVisualUnit | AI 生成的对象视觉材料 | `unitId`、`objectKind`、`imageHash`、`alphaMaskHash` |
| Approved Material Pack | 已审核视觉材料包 | `packId`、`worldId`、`tick`、`qualityReport`、`materials` |
| GameMapRuntimeFrame | 正式世界画面记录 | `frameId`、`worldId`、`tick`、`runtimeLayers`、`visualLayers`、`audit` |

## 6. AI Painter 内部边界

| 模块 | 职责 |
|---|---|
| Dataset Builder | 准备训练图、Mask、来源记录、用途记录。 |
| Training Runner | 本地训练，记录 GPU、耗时、loss、输出。 |
| Inference Runner | 根据当前 VisualFactManifest、世界导演输出和完整任务包，使用本地模型生成本轮完整地图新候选；局部材料推理只可作为内部从属能力。 |
| Refiner | 细化局部视觉材料。 |
| Candidate Store | 保存候选结果，不进入 `/world`。 |
| Result Archive | 保存成功、失败、耗时、时间戳、GPU 信息、质量分数。 |

AI Painter 禁止承担：

| 禁止职责 | 原因 |
|---|---|
| 决定地图里有什么 | 这是世界事实和 Runtime 的职责。 |
| 决定玩家能不能走 | 这是可走层和碰撞层的职责。 |
| 直接写 `/world` | 必须经过 RuntimeFrame 和 VisualJudge。 |
| 接入第三方在线绘图 API | 当前正式链路必须本地自研。 |

## 7. `/world` 展示闸门

```mermaid
flowchart TD
  A["/world 请求"] --> B["读取 latest GameMapRuntimeFrame"]
  B --> C{"是否存在"}
  C -->|"否"| D["显示阻断说明，不展示图"]
  C -->|"是"| E{"是否完整 RuntimeFrame"}
  E -->|"否"| D
  E -->|"是"| F{"是否通过 VJ-0/VJ-1/VJ-2"}
  F -->|"否"| D
  F -->|"是"| G{"是否通过 composite quality"}
  G -->|"否"| D
  G -->|"是"| H{"是否通过项目所有者人工最终验收"}
  H -->|"否"| D
  H -->|"是"| I["展示正式游戏世界"]
```

`/world` 不能读取：

| 内容 | 原因 |
|---|---|
| 训练图片 | 中间产物。 |
| 失败图片 | 只能归档和复盘。 |
| 候选图片 | 未正式通过。 |
| 局部素材 | 不是完整游戏地图。 |
| 单张 ApprovedFrame | 只是视觉素材凭证，不是 RuntimeFrame。 |
| 程序占位图 | 不是正式 AI 视觉结果。 |
| 人工否决图 | 机器审核曾通过也不能展示，必须进入失败归档和修复链。 |

## 8. 当前架构结论

当前必须从“AI 自由生成一张图”收口为“视觉事实清单 + 世界导演 + 结构化游戏地图 + 本地模型完整视觉推理 + RuntimeFrame 绑定”。AI Painter 负责完整视觉表达，局部材料只是内部能力。游戏是否可玩、对象是否存在、道路是否连通、碰撞是否正确、世界是否自主，全部由结构化数据和 Runtime 决定。

正式展示链路必须收口为：

```txt
VisualFactManifest + 世界导演 + 结构化游戏地图
+ 本地 AI Painter 本轮完整地图新候选
+ RuntimeFrame 结构与运行层绑定
+ VisualJudge / composite quality
+ 项目所有者人工最终验收
= /world 正式游戏世界
```

缺少项目所有者人工最终验收，或人工验收明确否决时，不能把任何 RuntimeFrame 当成正式游戏成功结果。
