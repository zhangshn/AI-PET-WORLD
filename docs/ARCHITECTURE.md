# AI-PET-WORLD 技术架构文档

版本：v1.0  
状态：正式架构基线  
更新时间：2026-06-25

本文档只描述架构，不记录临时实验细节。总入口见 [README.md](../README.md)，业务说明见 [BUSINESS_SPEC.md](./BUSINESS_SPEC.md)，目录结构见 [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md)。

## 1. 项目主旨

AI-PET-WORLD 是一个自主世界游戏。

核心业务：

- 用户注册并输入出生信息。
- 项目根据紫微斗数及人格映射，生成管家的灵魂、性格、沟通方式、长期偏好和建设倾向。
- 管家是自主行为主体，可以参考玩家建议，但不保证服从。
- 世界由规则、资源、生态、事件和管家行为共同推进。
- 前期只有自然环境和基础资源；后续由管家自主建设住所、小镇、城市和多玩家共同世界。
- 用户主要通过游戏内手机与管家沟通。

## 2. 唯一业务主链

```txt
用户注册
-> 出生信息
-> 紫微斗数 / 人格映射
-> 管家灵魂与长期行为偏好
-> 自主世界 Runtime
-> 世界事实 World Facts
-> Scene Blueprint / Condition Mask
-> 本地自研 AI Painter 小模型
-> 候选视觉输出
-> VisualJudge
-> ApprovedFrame / RuntimeFrame
-> 玩家看到世界
```

## 3. 架构总表

| 架构层 | 代表模块 | 输入 | 输出 | 硬边界 |
|---|---|---|---|---|
| 用户交互层 | `src/app/create-world`、`src/app/world`、游戏内手机 | 用户信息、玩家建议、浏览器请求 | 创建世界、查看世界、沟通入口 | 页面不能偷偷改 Runtime 事实 |
| 人格灵魂层 | `src/world/butler`、`src/world/creation` | 出生信息、命盘映射、创建世界输入 | 管家 profile、偏好、行为倾向 | 不能把玩家建议当绝对命令 |
| 世界 Runtime 层 | `src/world/runtime`、`src/world/runtime-core` | 管家动机、世界规则、tick | 世界事实、事件、资源、建设状态 | Runtime 只维护事实，不画图 |
| 世界事实层 | `visual-fact-manifest`、`world-generation-condition` | Runtime state、sourceFactIds | VisualFactManifest、Condition、Mask | 不能补不存在的重大事实 |
| 视觉结构层 | `composition-plan`、`terrain-plan`、`asset-plan` | 世界事实、MVP 规则 | 构图、地形、资产约束 | 只能规划表达方式，不改世界 |
| 本地模型层 | `ml/ai-painter` | target、mask、训练配置、结构条件 | 候选 PNG、模型权重、训练记录 | 不接第三方在线绘图 API |
| 候选存储层 | `ai-image-candidate`、`.runtime/ai-painter` | 模型输出、metadata | CandidateFrame、失败记录、资源账本 | Candidate 不能展示给玩家 |
| 视觉审核层 | `visual-review`、`visual-quality`、`visual-fix` | Candidate、事实、mask、规则 | ReviewReport、FixPlan、拒绝原因 | 审核只判断，不篡改事实 |
| 正式展示层 | `approved-frame`、`/world` | 过审 Candidate、review hash、image hash | ApprovedFrame / RuntimeFrame | 只有过审画面可见 |
| 后续动态层 | `visual-unit`、Runtime 合成 | 对象状态、动作状态、生命周期 | 可组合动态帧 | 当前阶段暂停 |

## 4. 关键数据流

| 数据 | 来源 | 去向 | 必须记录 |
|---|---|---|---|
| 用户出生信息 | 创建世界流程 | 管家人格映射 | 用户输入、映射结果 |
| 管家 profile | 人格灵魂层 | Runtime 行为选择 | 性格、动机、偏好、建设倾向 |
| WorldRuntimeState | Runtime tick | 世界事实层 | worldId、tick、事件、资源、状态 |
| sourceFactIds | Runtime / VisualFactManifest | Candidate / ApprovedFrame | 事实引用、hash 绑定 |
| Condition Mask | 结构层 | AI Painter 训练和推理 | 通道、尺寸、禁用通道 |
| Candidate PNG | 本地小模型 | VisualJudge | 图片 hash、生成时间、模型版本 |
| ReviewReport | VisualJudge | ApprovedFrame | 通过状态、失败原因、review hash |
| ApprovedFrame | ApprovedFrame store | `/world` | worldId、tick、sourceFactIds、image hash、review hash |
| 训练资源账本 | 训练控制器 | 进度页和归档 | GPU、显存、耗时、电费估算、本地 token |

## 5. 模块边界表

| 模块 | 可以做 | 不可以做 |
|---|---|---|
| Runtime | 推进 tick、更新事实、生成事件、提交建设变化 | 直接生成正式画面 |
| AI Painter | 根据事实和 mask 生成视觉候选 | 新增建筑、人物、动物或改变事实 |
| VisualJudge | 判断候选是否合格、给出失败原因 | 修改 Runtime 或把失败图强行通过 |
| ApprovedFrame | 绑定过审图和世界事实 | 接收未审核 Candidate |
| `/world` | 读取 ApprovedFrame / RuntimeFrame | 展示候选图、训练图、调试图 |
| Codex / GPT 代理 | 写代码、训练脚本、文档、检查和修复流程 | 手动替代系统保存正式结果、绕过审核 |
| 训练页面 | 启动训练、展示结果、展示归档 | 把失败候选伪装成正式世界 |

## 6. 世界 Runtime 架构

世界 Runtime 的职责是维护事实，不负责画面美化。

核心模块：

| 模块 | 职责 |
|---|---|
| world/runtime | 世界 tick、存档、运行时网关 |
| world/runtime-core | Runtime tick 中的建设、审计、初始世界构建 |
| world/butler | 管家人格、行为偏好、运行时 profile |
| world/construction | 管家自主建设计划、执行、安全提交 |
| world/environment | 地形、材料、生态环境状态 |
| world/ecology | 生物群系、生态规则、区域类型 |
| world/trace | 世界痕迹、记忆种子、trace 生命周期 |
| world/map-state | 家园地图状态、diff、持久化 |
| world/placement | 放置规则、布局规则 |

Runtime 输出的是世界事实，例如：

- 当前 tick。
- 世界资源。
- 地形与生态状态。
- 管家动机和行动结果。
- 建设计划与建设状态。
- 事件痕迹。
- 可供 AI Painter 使用的 sourceFactIds。

## 7. AI Painter 架构

AI Painter 只负责视觉表达，不负责篡改世界事实。

```txt
后端定义世界事实
-> 后端生成结构条件 / Mask
-> 本地 AI 小模型只负责画面表达
-> VisualJudge 检查有没有乱画
-> 通过后才展示
```

Painter 可以补充草叶、碎石、水波、明暗、纹理等非重大视觉细节。

Painter 不能凭空新增：

- 建筑。
- 角色。
- 动物。
- 道路。
- 资源。
- 事件痕迹。
- 管家行为结果。

如果世界事实中没有这些东西，AI Painter 画出来也必须被 VisualJudge 拦截。

## 8. 正式视觉硬边界

正式玩家世界只允许展示 `ApprovedFrame` 或后续经过同级审核的 `RuntimeFrame`。

以下内容永远不能作为正式世界画面：

- 程序画图。
- SVG / Canvas / HTML / CSS 渲染图。
- 调试预览图。
- 结构贴合图。
- 固定模板图。
- 占位图。
- 未过 VisualJudge 的候选图。
- 第三方在线绘图 API 直接生成的正式画面。

当前项目允许使用 PyTorch、CUDA、PIL、图像编码库等基础设施。正式图像必须由项目本地小模型推理生成，并通过项目自己的视觉审核链路。

Codex/GPT 代码代理只能维护训练管线、数据导入、标注校验、模型训练脚本、存储、VisualJudge 和 ApprovedFrame 闸门。代理不能把某一次人工生成、程序生成或调试生成的画面持续写入产品，不能用固定画面替代本地模型自主学习。

## 9. 当前 MVP 视觉范围

当前主线只做纯自然家园视觉底座。

允许内容：

- 草地。
- 水体。
- 水岸。
- 自然小路。
- 树木。
- 岩石。
- 花草灌木。
- 空间深度。

当前禁止内容：

- 建筑。
- 房屋。
- 临时住所。
- 建筑地基。
- 墙体。
- 屋顶。
- 施工材料。
- 人物。
- 动物。
- 昆虫。
- 管家。
- 小镇和城市。

这些禁止内容不是永久不做，而是不能混入当前自然底座训练。后续必须作为独立 VisualUnit 模块训练。

## 10. VisualUnit v0 架构方向

项目最终要的不是一张静态图，而是可组合、可审核、可运行的视觉单元。

```txt
世界事实
-> VisualUnit 定义
-> 状态帧 / 动作帧 / 生命周期帧
-> 本地小模型生成视觉表达
-> VisualJudge 审核单元与整帧
-> Runtime 合成
-> 玩家看到动态世界
```

未来每个视觉对象都应具备：

| 字段 | 含义 |
|---|---|
| unitId | 视觉单元 ID |
| unitType | natural、butler、character、building、facility、item、animal、effect |
| worldFactBinding | worldId、tick、sourceFactIds |
| lifecycleState | seed、growing、idle、building、damaged、completed 等 |
| actionState | idle、walk、work、build、talk、interact 等 |
| frameSet | 静态帧、循环帧、动作帧、状态变化帧 |
| conditionMask | 对应结构条件 |
| judgeRecord | VisualJudge 结果和失败原因 |

## 11. 训练数据正式链路

```txt
原创训练 PNG
-> Source Registry：来源、授权、哈希
-> 自动结构标注
-> Blueprint v1 + 14 通道 Mask
-> Annotation Judge
-> Accepted Training Pair
-> 本地 AI Painter 训练
-> 本地模型推理 PNG
-> VisualJudge
-> ApprovedFrame
```

人工可以负责导入、抽检和决定方向，但正式训练数据不能长期依赖人工逐对象描边。长期目标是结构先行、同源生成 Mask、机器审核。

## 12. 14 通道 Condition Mask

| 通道 | 含义 | 当前自然阶段 |
|---|---|---|
| grass | 草地区域 | 使用 |
| water_body | 水体内部 | 使用 |
| shoreline | 水岸过渡 | 使用 |
| road_center | 道路中心 | 使用 |
| road_edge | 道路边缘 | 使用 |
| tree_trunk | 树干 / 树干落点 | 使用 |
| tree_crown | 树冠覆盖 | 使用 |
| rock | 岩石区域 | 使用 |
| shelter_foundation | 建筑地基 | 必须为空 |
| shelter_wall | 墙体立面 | 必须为空 |
| shelter_roof | 屋顶结构 | 必须为空 |
| construction_material | 施工材料 | 必须为空 |
| walkable | 可行走区域 | 使用 |
| depth | 空间深度 | 使用 |

## 13. VisualJudge 与 ApprovedFrame

VisualJudge 分层：

| 层级 | 状态 | 职责 |
|---|---|---|
| VJ-0 | 已建 | 文件、来源、事实绑定、尺寸、hash、runtime gate |
| VJ-1 | 进行中 | 基础质量指标、清晰度、边缘、水体异常、失败类型 |
| VJ-2 | 未完成 | 语义、风格、世界事实一致性、动态状态一致性 |

`ApprovedFrame` 是玩家可见画面的硬闸门。任何 Candidate、训练输出、调试图、原稿图，都不能绕过 ApprovedFrame 进入 `/world`。

## 14. 当前技术状态

| 模块 | 状态 | 说明 |
|---|---|---|
| Runtime 主链 | 已成型 | tick、存档、construction、trace、butler motivation 已分层 |
| AI Painter 训练工程 | 可运行 | PyTorch/CUDA/训练/推理/记录已接通 |
| 自然家园视觉底座 | 进行中 | V89 隐藏候选已生成，仍需继续提升泛化和质量 |
| 训练结果归档 | 已接通 | 训练图、失败图、时间戳、资源账本已进入归档链路 |
| VisualJudge VJ-0 | 完成 | 文件、来源、事实硬闸门已建 |
| VisualJudge VJ-1 | 进行中 | 质量指标能拦截部分失败图 |
| VisualJudge VJ-2 | 未完成 | 语义、风格、状态一致性判断还未完成 |
| ApprovedFrame | 未完成 | 当前正式世界图为 0 |
| VisualUnit v0 | 数据契约已建立 | 已有 schema、registry、状态帧、运行时帧、`data/visual-units` 目录和 1 个树木静态契约样例；judge 未完成 |

## 15. 缺口清单

当前还缺：

1. VisualUnit v0 judge。
2. VisualUnit 真实 target / mask 样例。
3. 人物 / 管家视觉单元训练链路。
4. 设施 / 建筑视觉单元训练链路。
5. 动态状态帧训练链路。
6. Runtime 合成层。
7. VJ-2 语义与状态一致性判断。
8. 第一张正式自然家园 ApprovedFrame。
