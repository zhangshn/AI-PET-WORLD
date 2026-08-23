# AI Painter 正式主体规格

更新时间：2026-08-24 05:24:15 +08:00

状态：active-long-term-module-specification

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

> 本文定义 AI Painter 的长期业务责任、正式输入输出、内部生成责任、自动审核、发布和运行边界。当前候选模型、训练轮次、失败原因、临时修复和模块进度只进入唯一计划表及机器证据，不得反向成为长期架构。

## 1. 模块定位

AI Painter 是 AI-PET-WORLD 本地自研 AI 系统中的视觉生产与视觉质量闭环模块，不是项目本体，也不是外部聊天智能体的附属工具。

它负责把已经存在的结构化世界事实转换为可审核、可发布、可进入 Runtime 的完整像素风游戏画面，并在正式能力版本内自主完成生成、验证、审核、失败分类、版本记录、发布或回退。

AI Painter 不负责：

- 决定或修改 WorldFacts；
- 发明 VisualFactManifest 中不存在的对象、道路、水体或连接；
- 替代 AI 管家人格、世界导演、世界 Runtime 或长期记忆；
- 用 RGB 反向覆盖结构化世界事实；
- 把当前研发实验结构永久化为业务架构。

业务关系固定为：

```text
本地自研AI系统
├─ 人格与角色自主
├─ 世界事实、世界导演与持续Runtime
├─ AI Painter视觉生产与质量闭环
└─ 本地知识、证据、失败学习与恢复
```

## 2. 三层设计边界

AI Painter 文档和程序必须明确区分以下三层：

| 层级 | 内容 | 是否长期稳定 |
|---|---|---|
| 业务能力层 | 根据世界事实生成、审核、发布完整地图 | 是 |
| 能力实现层 | 模型家族、组件划分、训练范式、Checkpoint与资源策略 | 可版本化替换 |
| 研发变更控制层 | 代码、模型、Loss、数据、阈值、训练和正式发布的测试门禁 | 只约束研发变更 |

正式业务运行不得依赖 Codex 会话、聊天历史或逐步骤人工授权。研发阶段对模型、数据、训练、阈值和发布版本的高风险变更仍受项目治理约束，但该约束不能被描述成 AI Painter 每生成一张地图都需要人工许可。

## 3. 权威输入合同

每次视觉任务必须绑定同一不可变世界身份：

```text
worldId
regionId
tick
factHash
VisualFactManifest
worldDirectorPlan
conditionPackagePath
conditionPackageSha256
dictionaryVersion
modelCapabilityVersion
```

权威输入来源依次为：

1. WorldFacts 与 RegionGraph；
2. VisualFactManifest；
3. 世界导演的结构化视觉计划；
4. 23 通道条件包；
5. 当前正式发布的 AI Painter 能力版本。

缺失事实必须显式标记为不可用。AI Painter、审核器和 Runtime 均不得用提示词、历史图片、失败预览或模型猜测补全权威事实。

## 4. 23 通道条件与空间身份

正式条件包保持版本化的 23 通道顺序，并覆盖：

- terrain、water、route、shoreline、walkable、collision 与 depth；
- 湿度、遮阴、密集边界、细节分布和生态过渡；
- footprints、tree、rock、vegetation 的对象身份、掩码、接地、遮挡和空间关系；
- camera、lighting、palette、material、edge 与 detail budget。

离散条件按 nearest-neighbor 对齐，连续条件按 bilinear 对齐。任何尺寸变化都必须保持相同样本、相同条件通道身份和相同空间语义，不得通过重采样改变事实。

## 5. 正式输出合同

AI Painter 正式输出必须是单张原生 `1024×768` 完整 RGB 游戏画面，并同时产生：

```text
candidateId
world/frame identity
modelCapabilityVersion
input evidence hashes
nativeRgbPath + sha256
machineReviewReport
failureClassification or publishIdentity
runtimeFrameCandidateIdentity
```

正式输出禁止：

- tile、patch、sprite 或局部画面拼接；
- 低分辨率放大冒充原生完整画幅；
- SVG、Canvas、CSS、规则纹理或程序绘图冒充模型 RGB；
- 透明区、沙盘边缘、画幅外背景或非世界留白；
- 复用历史 RGB、失败预览或旧 RuntimeFrame 冒充新生成。

训练阶段可使用 `256×192 -> 512×384 -> 1024×768` 的分辨率递进，但业务候选和 Runtime 只接受原生 `1024×768` 结果。

## 6. 四个内部生成责任阶段

AI Painter 的长期内部责任固定为四段；它们描述业务责任，不等同于 Stage 0、Stage 1、Stage 2 的训练分辨率。

### 6.1 authoritative_world_structure_binding

非训练阶段，负责绑定 WorldFacts、VisualFactManifest、RegionGraph、道路、水文、对象掩码和 23 通道条件身份。不得生成或修改世界事实。

### 6.2 terrain_route_hydrology_spatial_realization

负责在可学习视觉表示中实现地形、道路、水体、岸线、通行与区域连接。输出必须保留权威拓扑和边界连接，不能用固定河网或道路模板替代当前事实。

### 6.3 per_class_object_semantic_realization

负责 footprints、tree、rock、vegetation 的逐类空间语义、接地、遮挡、尺度和视觉可辨识性。不得改变批准对象掩码或跨类别替换来源。

### 6.4 global_visual_harmonization_and_native_complete_rgb_decode

负责统一构图、光照、色彩、材质和像素风，并直接形成原生完整 RGB。它不得消除前序道路、水文或对象语义，也不得把前序结构退化成仅局部响应。

四段必须绑定同一任务包。后一段只允许消费同包前一段的成功终态和输出身份，禁止跨 run、跨样本、跨条件包或使用历史失败产物。

## 7. 实现架构的可替换性

四个责任阶段可以由一个模型、多个隔离组件或共享底座实现，但必须满足：

- 责任输出可单独识别、验证和追溯；
- 可训练参数、输入、输出和 Checkpoint 身份明确；
- 最终 RGB 的失败能定位到责任边界，而不是只得到“整图失败”；
- 任何新结构都经过 CPU 合同、只读 GPU 资格、受控 Smoke 和正式 Stage 验证；
- 当前实验结构不得自动升级为永久业务标准。

当前正在验证的具体模型或三组件实现只属于研发候选，其状态从唯一计划表和机器证据读取。

## 8. 数据合同

当前批准数据容量为 64 份，固定划分为：

| split | 数量 | 用途 |
|---|---:|---|
| train | 48 | 允许更新权重 |
| validation | 8 | 指标、Checkpoint 选择，不更新权重 |
| challenge | 4 | 未见结构资格，不参与训练和选择 |
| regression | 4 | 历史失败回归，不参与训练和选择 |

`complete-maps`、`terrain`、`vegetation`、`natural-objects`、`transitions` 是并行视觉知识类别，不是五个训练阶段，也不是推理时的素材拼接目录。

64 份数据是否满足某一模型家族的泛化需要，必须通过独立实验和证据判断；不能因为 validation 存在未见组合而自动判定数据有缺陷，也不能因为容量合同满足就自动证明任何模型一定充分。

数据来源、许可、样本身份、唯一性和哈希规则由 [训练数据与来源规则](TRAINING_DATA_AND_SOURCE_POLICY.md) 定义。

## 9. 模型与训练的稳定合同

长期稳定的训练边界包括：

- 23 通道条件输入；
- 12 通道潜变量边界；
- 项目 Autoencoder 的明确版本和冻结/可训练状态；
- train、validation、challenge、regression 隔离；
- 训练前后模型哈希、指标、资源、Checkpoint、Manifest 与终态证据；
- 后一训练分辨率只能消费同一正式链前一阶段的成功 Checkpoint。

具体基础宽度、层数、条件融合方式、梯度聚合方式、回放策略、Epoch 数和 Smoke 样本属于能力实现版本，不应作为不可替换的业务规则。当前正式实验值由活动配置和唯一计划表管理。

失败 Checkpoint 只能保存身份和证据；除非新的正式变更范围明确批准，否则不得加载、复用、晋级或作为初始化。

## 10. 自动验证与机器审核

每次正式生成或训练阶段必须在同一执行闭环中自动完成：

```text
输入身份验证
-> 执行/生成
-> 固定证据保存与字节复现
-> validation与Checkpoint身份验证
-> 专业画面审核
-> 世界事实与条件对齐审核
-> 道路、水文、岸线和对象语义审核
-> 构图重复与历史回归审核
-> 成功发布或失败关闭
-> 任务胶囊、事件账本、SQLite与状态投影同步
```

机器审核是已发布 AI Painter 能力版本的正式运行门，不是给 Owner 看的临时建议。审核规则、阈值和来源必须版本化、可复现、可追溯；审核器不得以自己的结果作为训练目标，也不得为通过而降低阈值。

Owner 或项目治理只在以下层级介入：

- 批准新的能力版本、模型家族、数据版本、阈值版本或业务范围；
- 处理机器证据不能唯一裁决的真实业务选择；
- 对冷启动阶段的能力发布进行阶段性验收。

正式能力版本发布后，单次地图的生成、审核、发布、回退和记录不应依赖逐次人工授权。

详细审核、存储和状态投影规则见 [审核、自动闭环与存储正式规格](REVIEW_AUTOMATION_AND_STORAGE_SPEC.md)。

## 11. 本地自研 AI 原生执行闭环

AI Painter 的正常执行主体是本地自研 AI 与本地程序。其原生能力包括：

- 读取世界事实、任务包和能力版本；
- 选择已经正式发布且适用于当前任务的执行路线；
- 执行生成、验证和机器审核；
- 对冻结证据进行确定性失败分类；
- 在合同允许的次数和状态内恢复非业务性基础设施故障；
- 发布合格候选，拒绝不合格候选并保持上一正式版本；
- 写入任务胶囊、事件账本、SQLite、资源遥测和进度状态；
- 在证据不足或涉及业务范围变化时升级为 Owner 决策。

内部任务票据只承担幂等、防重、状态转换和证据追溯，不代表从 Owner 借来的权限，也不能扩大当前能力版本的边界。

Codex 可以在研发阶段承担代码建设、复杂诊断和有界修复，但不得成为 AI Painter 正式运行、审核、记录、发布或恢复的必要依赖。

## 12. 研发变更控制

以下是能力版本变更，不是日常运行步骤：

- 修改模型结构、Loss、权重策略或训练计划；
- 修改 64 份数据、48/8/4/4 划分或来源资格；
- 修改 23 通道顺序、Autoencoder、Checkpoint 格式或审核阈值；
- 启动新的训练路线、重试真实视觉失败训练或晋级 Checkpoint；
- 改变 RuntimeFrame、正式推理或进入世界的发布边界。

这些变更必须形成独立版本、范围、回归、证据和发布决定。CPU 检查、只读分析、自动审核、失败记录、控制台显示和同一不可变证据上的幂等恢复不应被拆成重复人工授权。

## 13. 发布、RuntimeFrame 与回退

机器审核全部通过后，本地程序形成不可变发布候选。发布链必须验证：

```text
world/frame identity
-> model capability version
-> input evidence hashes
-> native RGB hash
-> review report hash
-> RuntimeFrame candidate
-> atomic publish pointer
```

发布不得覆盖历史证据。新候选失败时保持上一正式 RuntimeFrame；能力版本回退必须保留失败版本、触发原因和回退身份。世界运行读取正式发布指针，不读取训练目录、聊天输出或 `latest.json` 的未确认内容。

## 14. 失败学习与路线停损

失败处理遵循固定闭环：

```text
发现问题
-> 提出可验证问题
-> 读取不可变证据分析
-> 形成唯一裁决或证据不足
-> 执行一个有界修复 / 退出路线 / 请求业务选择
```

不得通过不断新增同类 Loss、逐字段修补、自动重跑、降低阈值或扩充候选数量延长失败路线。模型或训练范式在受控 Smoke 和正式 Stage 中被证明不足后，应退出该候选并回到更高层的模型、数据、资源或业务范式决策。

## 15. 记录、监控与恢复

本地程序自动保存：

- 任务、输入包、配置和程序血缘；
- 逐阶段进度、Epoch、optimizer step、Loss、validation 与资源；
- 预览、正式候选、审核、Checkpoint、Manifest、Finalization 和终态；
- 失败分类、恢复次数、发布或回退身份；
- 任务胶囊、事件账本和 SQLite 索引。

训练和生成进程必须独立于 Codex 窗口。监控台只读投影本地 `progress.json`、终态和遥测；关闭浏览器或 Codex 不得停止后台执行。

## 16. 验收标准

AI Painter 正式能力必须同时满足：

- 输入世界身份、VisualFactManifest、23 通道和 RGB 一致；
- 道路、水文、岸线、对象和完整地图语义可审核；
- 输出为原生 `1024×768` 完整像素风游戏画面；
- 生成、验证、审核、发布、回退和记录由本地系统闭环完成；
- 研发候选、正式能力版本和运行实例证据严格隔离；
- 不依赖 Codex 会话或逐地图人工授权；
- 失败不会进入 Runtime，历史正式版本可安全保持或回退；
- 机器证据能够复现每次决定。

## 17. 文档与状态职责

| 信息 | 唯一来源 |
|---|---|
| 长期业务责任与正式边界 | 本文 |
| 数据与来源 | `TRAINING_DATA_AND_SOURCE_POLICY.md` |
| 审核、发布、存储与状态投影 | `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` |
| 当前候选、固定进度、阻断与下一动作 | `CURRENT_EXECUTION_GUIDE_20260710.md` |
| 单次运行、哈希、授权、Checkpoint与失败事实 | `data/`、`.runtime/`、SQLite |
| 本地自研 AI 与 Codex 职责迁移 | `../LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md` |

本文不保存 Run ID、单次 SHA-256、当前 Epoch、临时失败或逐命令历史。
