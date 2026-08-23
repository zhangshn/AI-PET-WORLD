# AI Painter 正式主体规格

更新时间：2026-08-24 07:35:09 +08:00

状态：active-long-term-module-specification

文档版本：`AI-PAINTER-SPEC-1.2`

生效日期：`2026-08-24`

替代版本：`AI-PAINTER-SPEC-1.1`

批准状态：`active_internal_formal_standard`

生效范围：AI-PET-WORLD 项目内部正式架构与能力合同

兼容规则：稳定需求编号不得重用；破坏性变更必须提升主体规格版本并重新形成能力发布身份

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

稳定要求：

- **AP-IN-001**：每次任务必须同时绑定上述世界、条件包、字典和能力版本身份；任一必需身份缺失时失败关闭。
- **AP-IN-002**：`factHash`、`VisualFactManifest` 和条件包只能由权威世界数据链产生，RGB 不得反向修改它们。
- **AP-IN-003**：条件包路径和 SHA-256 必须同时验证，路径相同但哈希变化视为新输入身份。
- **AP-IN-004**：同一运行内不得跨 `worldId`、`regionId`、`tick`、样本或条件包消费证据。

## 4. 23 通道条件与空间身份

**AP-COND-001**：当前能力版本的 23 通道权威顺序必须且只能从 [`complete-world-ai-assisted-cold-start-v7.json`](../../ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json) 的 `conditionChannelOrder` 读取：

```text
01 terrain_grass
02 terrain_water
03 terrain_path_ground
04 terrain_shoreline
05 terrain_natural_boundary
06 terrain_mud_patch
07 terrain_tall_grass
08 walkable
09 collision
10 object_footprints
11 object_tree
12 object_rock
13 object_vegetation
14 focal_area
15 object_instance
16 coordinate_x
17 coordinate_y
18 signed_distance_path
19 signed_distance_water
20 signed_distance_shoreline
21 signed_distance_object_ground
22 signed_distance_boundary
23 moisture_proximity
```

**AP-COND-002**：同一配置的 `conditionChannelTypes` 是离散/连续属性的唯一当前实现定义；离散条件按 nearest-neighbor 对齐，连续条件按 bilinear 对齐，规则身份固定为 `discrete_nearest_continuous_bilinear_v1`。

**AP-COND-003**：条件包必须使用 `complete-world-visual-condition-pack-v1`，清单必须使用 `complete-world-visual-condition-manifest-v1`；字段、文件存在性、通道数量和统计边界由 [`check-current-world-visual-conditions.mjs`](../../scripts/check-current-world-visual-conditions.mjs) 验证。缺失通道必须进入 `unavailableChannels`，不得静默填零或由模型猜测。

**AP-COND-004**：任何尺寸变化都必须保持相同样本、相同通道身份和相同空间语义，不得通过重采样改变事实。23 通道的顺序、类型、数值语义、重采样或缺失值规则发生变化时，属于重大能力版本变更。

上述 JSON 是“当前能力实现值”的唯一机器入口，不是永久锁死的业务结构；未来版本可以替换，但必须发布新的条件合同版本和能力身份，旧版本不得原地改写。

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

- **AP-OUT-001**：正式候选必须是单张原生 `1024×768` RGB，并绑定输入证据、能力版本和机器审核报告。
- **AP-OUT-002**：禁止局部拼接、放大冒充、规则程序绘图和历史 RGB 复用。
- **AP-OUT-003**：候选未形成不可变 `runtimeFrameCandidateIdentity` 前不得进入发布链。
- **AP-OUT-004**：机器审核失败的候选不得生成 `publishIdentity`。

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

四段机器接口的最低约束如下；字段名是长期接口要求，具体 schema 版本由能力版本登记：

| 要求编号 | 责任阶段 | `inputSchema` | `outputSchema` | `requiredIdentity` | `successTerminal` / `failureTerminal` | `allowedMutations` | `forbiddenMutations` | `checkpointIdentity` | `reviewContract` |
|---|---|---|---|---|---|---|---|---|---|
| AP-PHASE-001 | `authoritative_world_structure_binding` | 世界事实、Manifest、条件包 | 权威结构绑定证据 | world/region/tick/fact/condition/capability | 绑定成功 / 失败关闭 | 仅新增证据 | 修改世界事实、条件或 Manifest | 不适用 | schema、路径、哈希和身份一致性 |
| AP-PHASE-002 | `terrain_route_hydrology_spatial_realization` | 同包结构绑定输出 | 地形、道路、水文空间输出 | 同包前序终态与输出 SHA-256 | 阶段成功 / 失败关闭 | 当前阶段参数与输出 | 修改权威拓扑、跨包消费 | 当前阶段独立身份 | 道路、水文、岸线、通行和边界 |
| AP-PHASE-003 | `per_class_object_semantic_realization` | 同包地形阶段输出、批准对象掩码 | 逐类对象语义输出 | 同包前序终态、掩码和条件身份 | 阶段成功 / 失败关闭 | 当前阶段参数与输出 | 修改掩码、跨类替换、跨包消费 | 当前阶段独立身份 | footprints/tree/rock/vegetation 逐类语义 |
| AP-PHASE-004 | `global_visual_harmonization_and_native_complete_rgb_decode` | 同包对象阶段输出 | 原生完整 RGB 候选 | 同包前序终态、输出和能力身份 | 阶段成功 / 失败关闭 | 当前阶段参数、RGB 与证据 | 消除前序语义、拼接、放大、改事实 | 当前阶段独立身份 | 专业画面、事实对齐和完整地图审核 |

当前四阶段接口的 CPU 未激活实现证据保存在 `.runtime/ai-painter/stage4-staged-interface-evidence-support/`，它只证明某次实现，不是长期权威合同。正式程序物化接口时，必须从本节和能力版本生成一个版本化机器合同；不得引用某个历史 run 目录作为永久 schema。

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

## 9. 模型与训练合同

### 9.1 长期不可变合同

- **AP-TRAIN-001**：正式业务输入保持版本化条件合同，正式业务输出保持原生完整 RGB 合同。
- **AP-TRAIN-002**：train、validation、challenge、regression 的用途隔离不得被模型实现改变。
- **AP-TRAIN-003**：训练必须保存模型前后哈希、指标、资源、Checkpoint、Manifest 与终态证据。
- **AP-TRAIN-004**：后一训练分辨率只能消费同一正式链前一阶段的成功 Checkpoint。

### 9.2 能力版本必须登记的可变参数

潜变量通道、Autoencoder 身份及冻结/可训练状态、空间关系、模型家族、基础宽度、层数、条件融合、梯度聚合、回放策略、Epoch、Smoke 样本、优化器和资源计划都必须由能力版本精确登记。它们可以通过新能力版本替换，但不得被写成永久业务规则。

### 9.3 当前活动实现值

当前能力实现使用 12 通道潜变量、四倍 Autoencoder 空间关系和项目登记的 Autoencoder。具体活动值只从当前能力配置和机器证据读取；本文不固定当前基础宽度、模型候选或训练运行身份。

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

### 12.1 重大能力版本变更的机器判定

以下任一变化都必须判定为重大变更，进入 `completed_waiting_capability_release`，不得由运行实例自动继续：

- **AP-CHANGE-001**：模型家族、责任阶段划分、共享/隔离参数边界或输出瓶颈改变；
- **AP-CHANGE-002**：23 通道的数量、顺序、名称、类型、数值语义、范围、重采样或缺失值规则改变；
- **AP-CHANGE-003**：Autoencoder 身份、结构、潜变量合同或冻结状态改变；
- **AP-CHANGE-004**：数据来源谱系、批准容量、split 用途或 `datasetReleaseIdentity` 改变；
- **AP-CHANGE-005**：机器审核阈值被降低、重定义或审核器语义改变；
- **AP-CHANGE-006**：原生输出分辨率、Checkpoint 兼容格式或 RuntimeFrame 接口改变；
- **AP-CHANGE-007**：WorldFacts、VisualFactManifest、RegionGraph 或条件包的权威绑定方式改变。

仅修正文案、监控显示、证据索引或不改变输入输出字节与合同语义的基础设施缺陷，不构成重大能力变更。无法由机器唯一分类时必须进入 `waiting_owner_decision`，不得自行按非重大变更处理。

### 12.2 能力发布文件与受信注册规范

能力发布由项目级研发决定产生，但正式运行只能相信本地不可变文件和受信注册表，不能相信聊天、调用方布尔字段、页面身份或外部智能体记忆。

固定信任入口如下：

| 角色 | 固定要求 |
|---|---|
| 受信注册表 | `data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json`；Schema必须为`ai-painter-capability-release-registry-v1` |
| 能力发布根 | `data/ai-painter/capability-releases/<capabilityReleaseIdentity>/`；禁止绝对路径、父级越界和外部目录 |
| 能力发布文件 | Schema必须为`ai-painter-capability-release-v1`且状态为`released` |
| Owner发布决定 | Schema必须为`ai-painter-capability-release-owner-decision-v1`且状态为`approved` |
| Runtime自治策略 | 必须绑定当前`ai-painter-capability-runtime-autonomy-contract-v2`路径及实际SHA-256 |

能力发布文件必须包含：

```text
schemaVersion
capabilityReleaseIdentity
status
modelCapabilityVersion
runtimeAutonomyPolicy { contractId, path, sha256, allowedInternalActions, maxInfrastructureRecoveryAttempts }
bindings
ownerReleaseDecision { path, sha256 }
programLineage
outputRoot
```

`bindings`必须且只能包含以下五个角色，每个角色都必须登记`identity`、项目逻辑相对`path`和文件原始字节`sha256`：

1. `datasetRelease`；
2. `modelArtifact`；
3. `reviewContract`；
4. `runtimeInterfaceContract`；
5. `conditionContract`。

Owner发布决定必须绑定相同`capabilityReleaseIdentity`、五类绑定集合的规范化`approvedBindingSetSha256`及`approvedPolicyContractSha256`。受信注册记录必须再次绑定能力发布文件、Owner发布决定、策略合同和绑定集合SHA。任何身份、路径、原始字节或状态不一致都必须失败关闭。

正式验证顺序固定为：

```text
读取固定受信注册表
-> 唯一定位 capabilityReleasePath
-> 重新计算能力发布文件SHA-256
-> 验证Schema、released状态和发布身份
-> 读取并重算Runtime自治策略SHA-256
-> 逐项读取并重算数据、模型、审核、Runtime和条件合同SHA-256
-> 读取并重算Owner发布决定SHA-256
-> 验证Owner批准的绑定集合与策略SHA
-> 签发一次性内部任务票据
-> 消费时再次计算ticketSha256并重新核对发布注册表
```

发布、撤销、替代和回退规则：

- 当前受信注册表状态为`active_no_capability_release`且`releaseRecords`为空，因此不存在可运行的正式AI Painter能力；
- 发布记录只能追加新身份或形成新的受信注册状态，不得修改能力发布文件原始字节；
- 撤销必须把对应身份登记为`revoked`并保存撤销决定，撤销后不得签发新票据；
- 能力替代必须生成新的`capabilityReleaseIdentity`，不得原地改写旧发布；
- 回退只能指向仍处于受信、未撤销状态的历史能力发布身份，并生成新的不可变回退决定和原子正式指针；
- 已签发票据在消费时发现注册表、发布文件或策略身份变化必须失败关闭，不得继续使用旧缓存；
- 调用方提供`capabilityReleaseVerified=true`、自报SHA或复制旧票据均不构成发布证明。

## 13. 发布、RuntimeFrame 与回退

### 13.1 正式身份链与基数

```text
datasetReleaseIdentity
  1 -> N modelCapabilityVersion
modelCapabilityVersion
  1 -> 0..1 capabilityReleaseIdentity
capabilityReleaseIdentity
  1 -> N runtimeFrameCandidateIdentity
runtimeFrameCandidateIdentity
  1 -> 0..1 publishIdentity
```

- **AP-ID-001**：一个模型能力版本只能绑定一个不可变数据发布身份；同一数据版本可产生多个模型能力版本。
- **AP-ID-002**：`capabilityReleaseIdentity` 绑定模型能力、数据、条件合同、审核合同和 Runtime 接口；其中任一身份变化都必须重新发布能力身份。
- **AP-ID-003**：世界事实、条件任务或生成随机身份变化只生成新的候选身份，不自动改变能力发布身份。
- **AP-ID-004**：候选 RGB、输入哈希或审核报告变化必须生成新的 `runtimeFrameCandidateIdentity`，不得原地修改旧候选。
- **AP-ID-005**：只有通过当前能力发布合同全部门禁的候选才可形成唯一 `publishIdentity`；发布失败保持上一正式指针。

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

最低可执行验收映射：

| 要求编号 | 证明方式 | 阻断条件 | 正式证据 |
|---|---|---|---|
| AP-ACCEPT-001 | 条件清单、条件包、路径与 SHA-256 检查 | 任一身份、通道或文件缺失/替换 | 输入清单与条件检查报告 |
| AP-ACCEPT-002 | 专业画面、事实对齐、道路、水文、岸线和四类对象机器审核 | 任一冻结审核项失败 | 版本化机器审核报告 |
| AP-ACCEPT-003 | 原生尺寸、完整画幅、无拼接/放大检查 | 非 `1024×768` 原生完整 RGB | 候选 Manifest 与 RGB SHA-256 |
| AP-ACCEPT-004 | 执行、验证、审核、裁决、发布和记录状态机回归 | 非法跳转、缺失终态或需聊天继续 | 任务胶囊、事件账本、SQLite、终态 |
| AP-ACCEPT-005 | 能力、候选和发布身份链验证 | 跨版本、跨 run、历史失败证据注入 | 能力发布与候选发布记录 |

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

### 17.1 唯一机器合同登记

| 合同角色 | 唯一路径 | 权威层级 |
|---|---|---|
| 完整地图与未来动态就绪业务合同 | [`data/ai-painter/system-governance/complete-map-world-business-contract-v3.json`](../../data/ai-painter/system-governance/complete-map-world-business-contract-v3.json) | 长期业务机器合同 |
| 64 份地图语义拓扑差异合同 | [`data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json`](../../data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json) | 数据发布机器合同 |
| 当前 23 通道顺序、类型和缩放合同 | [`ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json`](../../ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json) | 当前能力版本实现合同 |
| 条件包与清单检查器 | [`scripts/check-current-world-visual-conditions.mjs`](../../scripts/check-current-world-visual-conditions.mjs) | 当前机器验证入口 |
| 本地系统与外部执行边界 | [`data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v2.json`](../../data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v2.json) | 本地系统正式职责合同 |
| 已发布能力版本运行自治状态机 | [`data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json`](../../data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json) | 正式运行自治合同 |
| 能力发布受信注册表 | [`data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json`](../../data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json) | 当前无正式能力发布；未来发布必须登记不可变文件、真实SHA和Owner发布决定 |
| 历史合同替代索引 | [`data/ai-painter/system-governance/contract-supersession-index-v1.json`](../../data/ai-painter/system-governance/contract-supersession-index-v1.json) | 保留历史原始字节用于复核，禁止历史合同授权新工作 |

单次 `.runtime` 文件、聊天内容和外部评审不能登记为长期机器合同；它们只能证明某次执行。合同路径发生替换时，必须按 12.1 判断是否形成新的能力发布身份。调用方提供的`verified=true`或格式正确的64位字符串不能证明能力已经发布；机器必须读取受信发布注册表和不可变发布文件，重算发布、Owner决定以及数据、模型、审核、Runtime和条件合同的SHA-256。内部任务票据在消费时必须重新计算自身SHA-256。

仓库内文档与机器合同的一致性由`npm run check:ai-painter-document-contracts`和`.github/workflows/ai-painter-document-contracts.yml`共同验证；该入口不得依赖本机`.runtime`、Checkpoint或GPU。完整23通道数据与缩放行为仍由本地`npm run check:ai-painter-contract-semantic-alignment`验证。两类检查均不得把“合同检查通过”解释为“能力已经发布”或“模型训练通过”。

### 17.2 稳定需求编号与追踪规则

| 编号范围 | 主题 | 最低追踪目标 |
|---|---|---|
| `AP-IN-*` / `AP-COND-*` | 权威输入与条件 | 条件合同、编译器、输入检查和运行证据 |
| `AP-OUT-*` | 正式输出 | Manifest、候选身份、审核和发布记录 |
| `AP-PHASE-*` | 四段责任接口 | 接口合同、组件实现、CPU/GPU 资格与阶段终态 |
| `AP-TRAIN-*` | 模型与训练 | 配置、Trainer、回归、Checkpoint 和训练终态 |
| `AP-CHANGE-*` | 重大变更 | 变更分类器、能力发布门和 Owner 决策记录 |
| `AP-ID-*` | 身份链 | 发布注册表、候选记录和原子发布指针 |
| `AP-ACCEPT-*` | 验收 | 审核器、测试、失败码和不可变证据 |

需求编号一经发布不得改义、重排或复用；废止要求保留编号并标记 superseded。程序、JSON 合同、CPU 测试、GPU 资格和运行证据应引用同一编号，形成“文档要求 -> 机器合同 -> 程序实现 -> 测试 -> 运行证据”的追踪链。
