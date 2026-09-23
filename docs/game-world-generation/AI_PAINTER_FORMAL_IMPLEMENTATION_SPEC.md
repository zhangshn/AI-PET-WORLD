# AI Painter 正式主体规格

更新时间：2026-09-22 13:11:21 +08:00

状态：active-long-term-module-specification

文档版本：`AI-PAINTER-SPEC-1.17`

生效日期：`2026-09-22`

替代版本：`AI-PAINTER-SPEC-1.16`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

生效范围：AI-PET-WORLD 项目内部正式架构与能力合同

兼容规则：稳定需求编号不得重用；破坏性变更必须提升主体规格版本并重新形成能力发布身份

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

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
| 能力演进控制层 | 代码、模型、Loss、数据、审核、训练和正式发布的版本化机器门禁 | 约束本地AI自主演进，不表示人工审批 |

正式业务运行和能力演进不得依赖 Codex 会话、聊天历史、Owner签名或逐步骤人工授权。本地AI对模型、数据、训练、审核实现和发布版本的变更仍必须通过隔离版本、回归、资源、安全和发布机器门，但机器治理不能被描述成人工许可。

完整产品MVP包含自然世界、人物人格与初始外貌、五类现实动物、生命动态及反馈闭环；当前静态地图训练只是其中一个里程碑。本文第18节定义生命扩展的完整验收边界，不原地改写现有23通道合同或64份地图发布，不把文档生效当作新增能力已实现。

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

**AP-COND-001**：23通道的现行机器权威是 [`ai-painter-complete-map-condition-contract-v1.json`](../../data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json)。其`conditionContractIdentity`、路径和文件SHA-256必须同时进入条件包、条件Manifest、Dataset Release、训练执行和候选证据；通道固定顺序为：

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

**AP-COND-002**：现行条件合同的`typePartitions`是离散/连续属性的唯一机器定义；前15个通道为离散身份，后8个通道为连续场。离散条件按 nearest-neighbor 对齐，连续条件按 bilinear 且`alignCorners=false`对齐，规则身份固定为 `discrete_nearest_continuous_bilinear_v1`。

以下条款是`AP-COND-002`和`AP-COND-004`的强制子条款，不增加新的顶层需求编号：

- **AP-COND-002.a**：模型必须在条件保持原生通道身份时先分类重采样，然后才允许进入共享编码或特征混合。禁止先对23通道统一使用bilinear缩小，也禁止先混合再缩小。
- **AP-COND-002.b**：`object_footprints`、`object_tree`、`object_rock`、`object_vegetation`、道路和其他离散结构掩码在缩小后必须仍保留合同声明的最小连通域；不得因采样相位将存在于权威条件中的对象静默变为全零。
- **AP-COND-002.c**：缩放验收必须包含离散通道的单像素/单连通域正向样本、连续场插值样本、类型故意置换的反向样本和跨通道污染样本。
- **AP-COND-004.a**：能力身份必须记录重采样实现路径与SHA-256；仅在配置文件中出现`nearest`或`bilinear`字符串不构成行为符合证明。

**AP-COND-003**：条件包必须使用 `complete-world-visual-condition-pack-v1`，清单必须使用 `complete-world-visual-condition-manifest-v1`；字段、文件存在性、通道数量和统计边界由 [`check-current-world-visual-conditions.mjs`](../../scripts/check-current-world-visual-conditions.mjs) 验证。缺失通道必须进入 `unavailableChannels`，不得静默填零或由模型猜测。

**AP-COND-004**：任何尺寸变化都必须保持相同样本、相同通道身份和相同空间语义，不得通过重采样改变事实。23 通道的顺序、类型、数值语义、重采样或缺失值规则发生变化时，属于重大能力版本变更。

`complete-world-ai-assisted-cold-start-v7.json`仅是未发布旧实现的历史迁移输入，保留用于旧运行复核；它不再是条件权威，不得被当前检查器、编译器、训练器或入口解析器用作默认值，也不得从其中继承Owner字段、旧门禁或程序血缘。当前条件包只允许由现行条件合同和正式当前条件包注册表建立身份；注册表不存在时必须报告`no_current_condition_package_registered`并失败关闭需要条件数据的后续动作，禁止回退到目录`latest.json`。未来替换通道定义时必须建立新的条件合同版本和能力身份，旧版本不得原地改写。

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

负责 footprints、tree、rock、vegetation 的逐类空间语义、接地、遮挡、尺度和视觉可辨识性。不得改变权威对象掩码或跨类别替换来源。

### 6.4 global_visual_harmonization_and_native_complete_rgb_decode

负责统一构图、光照、色彩、材质和像素风，并直接形成原生完整 RGB。它不得消除前序道路、水文或对象语义，也不得把前序结构退化成仅局部响应。

四段必须绑定同一任务包。后一段只允许消费同包前一段的成功终态和输出身份，禁止跨 run、跨样本、跨条件包或使用历史失败产物。

四段机器接口的最低约束如下；字段名是长期接口要求，具体 schema 版本由能力版本登记：

| 要求编号 | 责任阶段 | `inputSchema` | `outputSchema` | `requiredIdentity` | `successTerminal` / `failureTerminal` | `allowedMutations` | `forbiddenMutations` | `checkpointIdentity` | `reviewContract` |
|---|---|---|---|---|---|---|---|---|---|
| AP-PHASE-001 | `authoritative_world_structure_binding` | 世界事实、Manifest、条件包 | 权威结构绑定证据 | world/region/tick/fact/condition/capability | 绑定成功 / 失败关闭 | 仅新增证据 | 修改世界事实、条件或 Manifest | 不适用 | schema、路径、哈希和身份一致性 |
| AP-PHASE-002 | `terrain_route_hydrology_spatial_realization` | 同包结构绑定输出 | 地形、道路、水文空间输出 | 同包前序终态与输出 SHA-256 | 阶段成功 / 失败关闭 | 当前责任参数或已登记共享映射与输出 | 修改权威拓扑、跨包消费 | 能力版本登记的独立身份或共享Checkpoint责任映射 | 道路、水文、岸线、通行和边界 |
| AP-PHASE-003 | `per_class_object_semantic_realization` | 同包地形阶段输出、权威对象掩码 | 逐类对象语义输出 | 同包前序终态、掩码和条件身份 | 阶段成功 / 失败关闭 | 当前责任参数或已登记共享映射与输出 | 修改掩码、跨类替换、跨包消费 | 能力版本登记的独立身份或共享Checkpoint责任映射 | footprints/tree/rock/vegetation 逐类语义 |
| AP-PHASE-004 | `global_visual_harmonization_and_native_complete_rgb_decode` | 同包对象阶段输出 | 原生完整 RGB 候选 | 同包前序终态、输出和能力身份 | 阶段成功 / 失败关闭 | 当前责任参数或已登记共享映射、RGB与证据 | 消除前序语义、拼接、放大、改事实 | 能力版本登记的独立身份或共享Checkpoint责任映射 | 专业画面、事实对齐和完整地图审核 |

四阶段的正式程序接口必须由本节、能力版本和版本化机器合同共同物化。单次运行目录、历史实验适配器和临时证据只能证明对应执行，不得成为永久Schema、现行能力身份或新任务输入。

以下条款是`AP-PHASE-002`至`AP-PHASE-004`的强制子条款：

- **AP-PHASE-002.a**：道路必须拥有与地形背景可区分的语义承载通路、责任输出、参数或已声明共享映射、梯度可达性和反事实条件响应证据。一组对所有特征通道广播的共享局部传输权重不能单独满足该要求。
- **AP-PHASE-003.a**：footprints、tree、rock、vegetation必须分别登记输入条件、语义承载通路、责任输出、梯度可达性、遮罩不变性和反事实响应。逐类证据可以来自共享模型，但不得被合并对象总分或整图Loss取代。
- **AP-PHASE-004.a**：最终RGB解码边界必须显式消费道路、水文、岸线和四类对象的前序责任输出及条件身份。能力测试必须证明只改变一个权威条件时，最终RGB在相应受限区域产生有限且可解释的响应，其他责任证据不被静默消除。
- **AP-PHASE-004.b**：通用潜变量经冻结Autoencoder解码为RGB只能证明解码路径可执行，不能证明最终RGB对条件负责。若没有上述责任输入与反事实证据，该候选不得进入训练。

## 7. 实现架构的可替换性

四个责任阶段可以由一个模型、多个隔离组件或共享底座实现，但必须满足：

- 责任输出可单独识别、验证和追溯；
- 可训练参数、输入、输出和 Checkpoint 身份明确；
- 最终 RGB 的失败能定位到责任边界，而不是只得到“整图失败”；
- 任何新结构都经过 CPU 合同、只读 GPU 资格、受控 Smoke 和正式 Stage 验证；
- 当前实验结构不得自动升级为永久业务标准。

`AP-PHASE-002`至`AP-PHASE-004`共同要求每个能力版本登记`responsibilityImplementationMode`。稳定机器枚举仅允许`single_model`、`declared_shared_substrate`或`parameter_isolated_components`，并必须保存三段可训练责任到参数或共享映射、Checkpoint、输出、审核和终态证据的完整关系。单模型或共享底座不要求伪造三份物理Checkpoint，但必须为每段责任提供不可混淆的映射与输出证据；隔离组件必须证明参数和Checkpoint没有共享。任何实现都不得用最终整图审核代替逐责任审核。当前Stage4 V2已经以版本化父合同登记`declared_shared_substrate`、共享参数命名空间及逐责任专属参数命名空间；该登记只证明CPU合同边界已经物化，不证明GPU资格、训练或正式能力发布。

当前正在验证的具体模型或组件实现只属于研发候选，其状态从唯一计划表和机器证据读取。

被机器审核拒绝或被后继实现替代的候选身份是不可变历史身份。程序可以保留它们的证据解析适配器，但当前入口解析器、训练器和Codex默认均不得把它们视为新工作来源。修改条件重采样、责任通路、模型参数图或最终RGB责任属于`AP-CHANGE-001/002`能力变更，必须建立新`modelCapabilityVersion`、新入口和新输出命名空间，不得在旧候选ID下原地修复后继续训练。

## 8. 数据合同

当前登记合格数据容量为 64 份，固定划分为：

| split | 数量 | 用途 |
|---|---:|---|
| train | 48 | 允许更新权重 |
| validation | 8 | 指标、Checkpoint 选择，不更新权重 |
| challenge | 4 | 未见结构资格，不参与训练和选择 |
| regression | 4 | 历史失败回归，不参与训练和选择 |

当前Stage4后继候选的数据发布身份只由[`ai-painter-stage4-v2-mvp64-dataset-release-v1.json`](../../data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json)建立。该合同从116条来源索引的`v7CapacityContributions`集合按原数组顺序精确发布64条，并逐条绑定RGB、条件包和容量贡献证据的路径与SHA-256；其中`v7`只表示来源集合字段的历史名称，不恢复V7模型、旧训练入口、人工授权字段或目录`latest`选择。训练读取器必须按该发布合同的`samples`集合和split读取，不能把116条顶层来源总数解释为训练容量。

`complete-maps`、`terrain`、`vegetation`、`natural-objects`、`transitions` 是并行视觉知识类别，不是五个训练阶段，也不是推理时的素材拼接目录。

64 份数据是否满足某一模型家族的泛化需要，必须通过独立实验和证据判断；不能因为 validation 存在未见组合而自动判定数据有缺陷，也不能因为容量合同满足就自动证明任何模型一定充分。

数据来源、许可、样本身份、唯一性和哈希规则由 [训练数据与来源规则](TRAINING_DATA_AND_SOURCE_POLICY.md) 定义。

## 9. 模型与训练合同

### 9.1 长期不可变合同

- **AP-TRAIN-001**：正式业务输入保持版本化条件合同，正式业务输出保持原生完整 RGB 合同。
- **AP-TRAIN-002**：train、validation、challenge、regression 的用途隔离不得被模型实现改变。
- **AP-TRAIN-003**：训练必须保存模型前后哈希、指标、资源、Checkpoint、Manifest 与终态证据。
- **AP-TRAIN-004**：后一训练分辨率只能消费同一正式链前一阶段的成功 Checkpoint。

Smoke同样受split用途隔离约束：只有train可更新任何参数；validation只能前向评估，challenge和regression不得参与调参或Checkpoint选择。Smoke权重不得晋级为正式阶段初始化。即便诊断权重最终丢弃，也不能借此把validation改称train；若确需研究另一划分，须建立独立数据与能力身份，并且不能污染原发布的独立验收结论。

### 9.2 能力版本必须登记的可变参数

潜变量通道、Autoencoder 身份及冻结/可训练状态、空间关系、模型家族、基础宽度、层数、条件融合、梯度聚合、回放策略、Epoch、Smoke 样本、优化器和资源计划都必须由能力版本精确登记。它们可以通过新能力版本替换，但不得被写成永久业务规则。

能力版本进入CPU实现验收前必须至少完整登记以下四类机器绑定：

1. `lossContract`：合同身份、路径、SHA-256、每个项的完整计算公式、输入输出形状、遮罩、归一化、聚合、空值、数值权重、实现源文件路径与SHA-256、公式对应测试路径与SHA-256。仅保存Loss名称和权重不构成可执行合同。
2. `reviewThresholdContract`：审核合同身份、路径、SHA-256、审核器程序路径与SHA-256，以及每个阈值的字段名、数值、单位、适用对象、比较符、输入窗口、聚合方式和失败码。“使用冻结阈值”的文字声明不构成阈值绑定。
3. `datasetBinding`：`datasetReleaseIdentity`、包路径和SHA-256、`manifest.json`与`source-index.json`的独立路径和SHA-256、四个split文件的路径和SHA-256，以及Python Dataset实际选中行的重现哈希。任一文件未发布、未上传、缺失或计数不一致时禁止训练。
4. `foundationAssetBinding`：基础资产角色、资产发布身份、源路径、SHA-256、结构/状态哈希、冻结合同、加载程序血缘和允许用途。项目基础Autoencoder只有在该绑定通过时才能被加载；它不是历史失败Denoiser Checkpoint。

上述路径、数值和SHA属于能力版本证据，不在本长期文档硬编码单次实例。

### 9.3 训练目标与正式审核对齐

每个可训练责任必须保存`trainingReviewAlignment`，至少包含：

```text
responsibilityId
conditionChannelIds
objectiveTermIds + formulaSha256
responsibilityOutputIdentity
formalReviewContractIdentity + sha256
reviewMetricIds / failureCodes
positiveAlignmentTests
negativeAlignmentTests
```

该对齐必须证明道路、水文、岸线、footprints、tree、rock和vegetation的权威条件、责任输出、可学习目标与正式审核项存在可执行对应。对齐证据不等于训练一定成功，但任一正式审核责任没有任何相应条件通路、责任输出或训练目标时，候选不得进入GPU。审核分数、阈值和失败预览像素仍不得作为训练目标。

### 9.4 Autoencoder冻结与资产角色

能力系统构造完成时必须自行将已绑定的项目基础Autoencoder设为评估模式、对全部参数执行`requires_grad_(False)`，并阻止上层`train()`调用将它恢复为可训练状态。Trainer必须再次验证模式、可训练参数集为空、前后状态哈希不变和优化器参数组不包含Autoencoder。模型层自保证与Trainer门禁两者任一缺失都失败关闭。

#### 9.4.1 独立CPU只读基础资产加载验证

[`ai-painter-foundation-cpu-load-probe-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-foundation-cpu-load-probe-policy-v1.json)定义独立的CPU兼容性验证入口，不属于旧谱系合同的静态CPU资格检查，不改写或继承旧合同的激活字段。它只读取该政策精确绑定的项目Autoencoder与来源清单，以`weights_only=True`受限反序列化加载；不允许退回不受限加载器或增加反序列化类型白名单。文件、元数据、结构或来源绑定不符即失败关闭。

该入口只检查实际加载、父模型模式切换后的冻结保持，以及固定合成输入的一次前后向状态不变性；不读取真实训练图片，不创建优化器、不更新参数、不加载Denoiser权重、不输出Checkpoint、不使用GPU、不更新正式运行登记。程序、解释器、输入、资源上限及运行身份必须绑定，由现有受管进程执行，保留成功或失败、清理状态与文件前后哈希。

成功只能说明指定资产在指定程序下可加载并在本次CPU探针中保持冻结；不能证明历史数据独立、训练中的优化器排除、真实训练冻结、GPU资格、视觉质量或能力发布。证据不足时不得据此决定重训或替换基础模型。程序和反例测试须先通过，实际执行结果另存机器证据。

候选初始化的只读连接检查由[`ai-painter-candidate-cpu-initialization-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-candidate-cpu-initialization-policy-v1.json)独立限定。它绑定候选合同及上述基础资产加载政策，重算基础Checkpoint和来源清单的文件身份，以受限加载器取得Autoencoder状态，再由当前候选程序按登记种子创建新的Denoiser。必须对两个新建模型的初始状态进行一致性核验，记录实际加载文件、来源元数据、候选配置与状态身份；不得接收历史Denoiser、修改旧静态合同或继承旧训练资格。

该连接检查可以为验证候选身份重算清单、RGB和条件文件的原始字节哈希，但不得解码为训练图片／条件张量，不进行前向、反向、优化、Checkpoint写入、GPU运行或生产登记。它只证明本次候选初始化的文件与程序绑定，不证明数据用途隔离、模型选择历史、训练中的冻结保持或训练资格。入口为[`scripts/check-ai-painter-candidate-cpu-initialization.mjs`](../../scripts/check-ai-painter-candidate-cpu-initialization.mjs)，仍由既有受管CPU进程承担资源监督和清理。

### 9.5 当前迁移实现值

现有迁移实现使用12通道潜变量。当前Stage4 V2候选同样登记12通道潜变量、四倍Autoencoder空间关系和项目基础Autoencoder，并由V2父合同单独登记基础宽度、责任宽度和时间嵌入等活动实现值。这些数值是未发布能力版本的可变实现参数，不是长期业务常量，也不能单独授予GPU或训练资格。新能力的具体活动值只从该能力的不可变配置和机器证据读取；本文不固定未来模型宽度、模型候选或训练运行身份。

失败Denoiser Checkpoint只能保存身份和证据；不得加载、复用、晋级或作为初始化。只有从当前能力明确绑定的非失败父资产启动的全新隔离能力版本可以继续研发。已批准项目基础Autoencoder按`foundationAssetBinding`加载不属于读取历史失败Denoiser；两类资产必须使用不同角色、身份和加载白名单验证。

### 9.6 有界学习能力实验与正式资格隔离

在明确收缩为技术可行性验证的任务中，可以按[`ai-painter-learning-capacity-experiment-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-learning-capacity-experiment-policy-v1.json)建立独立、不可发布的256×192小样本实验。此例外仅适用于学习能力与执行测量，不取代第8节64份正式训练门槛或第18.5节资格链，不改变正式数据、划分、模型审核阈值和Runtime边界。

- 仅从精确绑定的既有train集合取样；源文件、来源权利证据、泰国区域、WorldFacts／条件／RGB身份和类型化读取必须重算。已知拒绝样本不作目标。旧记录中的Owner词语只解释来源，不作为当前实验放行条件。
- 实验数据与能力使用独立身份，明确`train_only_learning_capacity_no_generalization_claim`；训练集上的测量仅为训练诊断，不命名为独立validation，不消费validation／challenge／regression内容或指标。原64份来源隔离阻断不因实验通过而消失。
- 基础Autoencoder只可从精确项目资产绑定加载并全程冻结。可核验的项目资产来源、结构和字节必须有效；历史暴露／父绑定缺口逐项保留，不据此签发未见、独立或正式资格。若连资产来源或安全加载都无法核验，实验失败关闭，不自动重训基础模型。
- 复用现有模型与Loss；次数、优化步、seed、资源、输出、无自动重试和终态预先冻结。先通过CPU反例及当前实验不更新参数的GPU前后向检查，再允许有界train优化。
- 实验必须保存真实优化步来源、模型前后状态、冻结基础状态、固定种子推理、Checkpoint及新对象重载后的复现证据。输出不同不等于语义正确，Loss下降不等于泛化；最终步Checkpoint不进行选优且不可晋级正式Stage。
- 使用既有当前执行登记、锁、心跳、超时和事务提交；关闭外部窗口不构成继续加轮权限。成功只表示实验执行完成，失败如实记录；两者均不修改Stage4资格或发布到`/world`。

上述实验的来源、资源和代码证据由独立机器包验证；不得把CPU-only父合同的未激活标记改为已获GPU或训练资格，也不得把新增实验例外反向用于正式训练。

#### 9.6.1 单次周期性残差受控例外

仅[`ai-painter-endpoint-phase4-experiment-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-endpoint-phase4-experiment-policy-v1.json)定义的独立`endpoint-ab-v4`实验允许增加一个训练目标派生的周期性残差损失，不继承或修改旧策略的`lossChangesAllowed:false`。两组从同一绑定的实验父权重开始，均保留完整原损失和每四个epoch一次的既有终点RGB损失；候选组仅在相同终点增加该项。原图、23通道、冻结资产、采样、种子、既有审核阈值与不可发布边界保持不变。

新项以最终RGB减去train目标的残差为输入，计算4×4相位各自空间均值，去掉各颜色通道的全局偏差后，对全部相位及颜色通道计算平滑RMS。完整公式、固定系数、形状、数值保护和错误处理以本例外机器策略及绑定实现／测试为准；目标不得参与纯噪声初始化或推理条件。不得直接平滑输出图或惩罚原图自身纹理。

该例外只消费一个执行身份，总计最多400次更新（每组200），执行前冻结全部参数；CPU及本候选不更新权重的GPU检查必须通过，失败或预算耗尽即关闭，不自动续训、重复消费或搜索系数。须保留原有六组九指标裁决及真实图像、语义缺陷，指标改善不等于VJ-2或Stage4通过。此例外不允许以新增同类Loss继续延长失败路线；后继路线须另行审查。

零更新GPU显存失败后的内存生命周期复核仅按[`ai-painter-phase4-gpu-recheck-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-phase4-gpu-recheck-policy-v1.json)使用独立身份执行一次。它必须绑定已关闭且零更新的失败、真实CPU等价性证据和修复后程序，保持同一损失及70%显存上限；禁止创建优化器、训练、输出Checkpoint或自动衔接后继任务。该复核不恢复原400步实验的消费资格，也不替换最近训练终态；只登记自己的GPU复核终态。

GPU复核成功后的受控训练仅通过[`ai-painter-phase4-controlled-training-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-phase4-controlled-training-policy-v1.json)建立一个新的不可重复消费执行身份，原零更新失败和复核身份不重用。新包保持相同原图、条件、父模型、损失公式和资源限制，重新通过当前程序CPU及GPU检查后，总计最多400步，固定最终Checkpoint并复验全部12张输出；沿用原有九指标及语义边界，不选优、不发布、不自动衔接后继实验。

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

Owner职责只由`DOCUMENT_AUTHORITY_INDEX.md`中的`GOV-OWNER-001`定义。Owner可以主动调整长期业务目标、观察、暂停或紧急停止，但不介入本地AI正常状态机；未定义许可、付费或不可恢复动作由程序禁止并失败关闭，不生成审批请求。本地AI自行提出和验证能力版本、模型家族、数据版本、审核实现与训练计划，并由机器发布门决定发布或回退。

任何能力版本及单次地图的训练、生成、审核、发布、回退和记录都不得依赖逐次人工授权。证据不能唯一裁决时，当前路线失败关闭；本地系统只能进入合同已声明的替代路线，不能伪造结论。

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
- 在证据不足时失败关闭当前路线；触及长期业务或外部边界时禁止越界动作并生成政策边界报告，不等待Owner响应。

内部任务票据只承担幂等、防重、状态转换和证据追溯，不代表从 Owner 借来的权限，也不能扩大当前能力版本的边界。

Codex 可以在研发阶段承担代码建设、复杂诊断和有界修复，但不得成为 AI Painter 正式运行、审核、记录、发布或恢复的必要依赖。

## 12. 研发变更控制

以下是独立能力版本变更，不是当前运行实例可以静默修改的参数：

- 修改模型结构、Loss、权重策略或训练计划；
- 修改 64 份数据、48/8/4/4 划分或来源资格；
- 修改 23 通道顺序、Autoencoder、Checkpoint 格式或审核阈值；
- 启动新的训练路线、重试真实视觉失败训练或晋级 Checkpoint；
- 改变 RuntimeFrame、正式推理或进入世界的发布边界。

这些变更必须形成独立版本、范围、回归、证据和机器发布决定。本地AI可以自主建立并执行该版本；CPU检查、只读分析、自动审核、失败记录、控制台显示和同一不可变证据上的幂等恢复更不得被拆成人工授权。

### 12.1 重大能力版本变更的机器判定

以下任一变化都必须判定为重大变更：当前运行实例进入`failed_closed`并登记`failureCode=capability_change_required`，本地能力生命周期编排器建立新的`change_candidate`并重新完成全部机器资格，不得在原实例内继续：

- **AP-CHANGE-001**：模型家族、责任阶段划分、共享/隔离参数边界或输出瓶颈改变；
- **AP-CHANGE-002**：23 通道的数量、顺序、名称、类型、数值语义、范围、重采样或缺失值规则改变；
- **AP-CHANGE-003**：Autoencoder 身份、结构、潜变量合同或冻结状态改变；
- **AP-CHANGE-004**：数据来源谱系、登记容量、split 用途或 `datasetReleaseIdentity` 改变；
- **AP-CHANGE-005**：机器审核阈值被降低、重定义或审核器语义改变；
- **AP-CHANGE-006**：原生输出分辨率、Checkpoint 兼容格式或 RuntimeFrame 接口改变；
- **AP-CHANGE-007**：WorldFacts、VisualFactManifest、RegionGraph 或条件包的权威绑定方式改变。

仅修正文案、监控显示、证据索引或不改变输入输出字节与合同语义的基础设施缺陷，不构成重大能力变更。无法由机器唯一分类时必须进入`failed_closed`并登记`failureCode=change_classification_ambiguous`，不得自行按非重大变更处理。

### 12.2 自主能力生命周期与机器发布规范

能力发布只能由本地能力生命周期编排器根据真实不可变文件和完整机器证据产生。唯一写入主体为`local_ai_capability_release_orchestrator`，其程序血缘和操作系统写入身份必须由发布合同登记；训练器、审核器、控制台、调用方和外部智能体均不得直接写发布注册表或正式指针。Owner签名、聊天、调用方布尔字段、页面身份、外部智能体记忆和历史授权包都不是发布条件或发布证明。

生命周期固定为：

```text
change_candidate
-> isolated_implementation
-> cpu_contract_verified
-> readonly_gpu_qualified（需要GPU时）
-> controlled_smoke_completed
-> formal_stage_validation_completed
-> independent_regression_completed
-> machine_release_adjudicated
-> released / rejected / rolled_back
```

本地系统可以在当前业务、来源、资源和安全合同内自主创建并推进新能力版本。每个阶段必须生成独立终态；任一阶段真实失败时当前版本失败关闭，不能用人工签字覆盖失败，也不能自动降低审核门槛。

能力发布文件必须包含：

```text
schemaVersion
capabilityReleaseIdentity
status
modelCapabilityVersion
businessContractIdentity
datasetRelease { identity, path, sha256 }
modelArtifact { identity, path, sha256 }
reviewContract { identity, path, sha256 }
runtimeInterfaceContract { identity, path, sha256 }
conditionContract { identity, path, sha256 }
testAndQualificationEvidence[] { role, identity, path, sha256, status }
programLineage
resourceAndSafetyPolicyIdentity
rollbackIdentity
outputRoot
createdBy = local_ai_capability_lifecycle_orchestrator
```

机器发布验证顺序固定为：

```text
读取生效业务与安全合同
-> 读取当前自主能力注册表
-> 重新计算数据、模型、审核、Runtime、条件、测试和程序血缘SHA-256
-> 验证来源许可、split隔离、资源预算和审核非退化
-> 验证生命周期全部必需终态及其顺序
-> 独立发布裁决器生成唯一结果
-> 在单写者锁和SQLite事务内比较注册表版本并原子追加capabilityReleaseIdentity
-> 写入同目录临时文件、刷新并原子改名后更新正式指针
-> 运行时签发一次性内部任务票据
-> 消费时验证机器签名、重算ticketSha256并重新核对发布注册表
```

发布、撤销、替代和回退规则：

- 注册表是动态机器状态，当前记录数量和具体身份不得硬编码到长期文档；
- 发布注册表使用单写者、追加式事件和单调`registryRevision`；写入必须执行compare-and-swap，修订号冲突时失败关闭，不得覆盖并发发布；
- 发布文件、注册表追加事件、SQLite发布记录和正式指针更新必须由事务日志关联；进程中断后只能恢复到“全部未提交”或“发布记录完整但指针待幂等完成”，不得出现只有指针没有发布记录的状态；
- 发布记录只能追加，不得修改能力发布文件原始字节；
- 撤销必须保存机器撤销原因与证据，撤销后不得签发新票据；
- 能力替代必须生成新的`capabilityReleaseIdentity`，不得原地改写旧发布；
- 回退只能指向仍完整、未撤销且与当前业务合同兼容的历史发布身份，并原子更新正式指针；
- 已签发票据在消费时发现注册表、发布文件或策略身份变化必须失败关闭；
- 内部票据只表示一次合法状态转换，不表示Owner授权，也不能补充能力版本未声明的动作；票据必须由操作系统保护的本地机器密钥签名，并绑定`ticketId`、`issuerIdentity`、`issuerKeyId`、`capabilityReleaseIdentity`、执行包、动作、attempt、nonce、有效期、输入证据和程序血缘；
- 消费方必须在同一SQLite事务内验证机器签名、重新计算规范化载荷SHA，并以`ticketId + capabilityReleaseIdentity + action + attempt`唯一约束登记消费与事件；程序重启、PID变化或部分文件存在均不得重放；
- 调用方提供`capabilityReleaseVerified=true`、自报SHA、Owner签名或复制旧票据均不构成发布证明。

历史Owner签署、冷启动发布决定和逐任务授权合同必须保留原始字节用于旧运行复核，并在替代索引中标记为`historical_read_only_not_valid_for_current_execution`；当前程序不得读取它们建立新能力或运行权限。

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

### 15.1 当前身份与状态投影合同

AI Painter必须使用唯一当前执行登记，禁止由控制台或服务端聚合器通过扫描多个历史命名空间推断当前任务。稳定要求如下：

以下条款是`AP-ACCEPT-004`的强制子条款，不增加新的顶层需求编号：

- **AP-ACCEPT-004.a**：本地能力生命周期编排器是当前执行登记的唯一写入主体；训练器、审核器、控制台、GET聚合器和外部智能体不得直接改写。
- **AP-ACCEPT-004.b**：`currentProjectTask`、`activeExecution`、`latestTrainingTerminal`和`selectedHistoricalRun`必须分别建模、分别返回；任一字段不得作为另一字段的替代。
- **AP-ACCEPT-004.c**：每次合法转换必须使用单调`registryRevision`和`eventSequence`；时间戳只是审计字段，不得在并发或相同时间精度下取代序号。
- **AP-ACCEPT-004.d**：当前登记必须绑定能力版本、执行包、任务、Run、生命周期阶段、执行状态、任务胶囊或终态路径与SHA-256；读取时必须重新计算并验证。
- **AP-ACCEPT-004.e**：当前任务选择不得使用Smoke、Stage、审核、裁决或规划的固定来源优先级，也不得使用“第一个可读目录”或文件系统修改时间选择。
- **AP-ACCEPT-004.f**：当前登记缺失、哈希不符、修订冲突或指向不可验证证据时，必须返回`unknown_or_stale`并保存冲突证据；不得扫描历史目录寻找替代结果。
- **AP-ACCEPT-004.g**：历史Run选择只能改变只读查询上下文；不得改写全局当前任务、活动执行、最近训练终态、恢复点或下一动作。
- **AP-ACCEPT-004.h**：当前登记文件、追加事件、SQLite索引和证据身份必须由同一个可恢复事务关联；中断恢复只能完成同一修订或回到上一完整修订，不得形成只更新指针而未登记证据的状态。
- **AP-ACCEPT-004.i**：`nextMachineAction`必须由生命周期编排器写入当前登记，至少绑定`actionId`、`entrypointId`、能力版本、来源终态证据、程序血缘、先决条件和禁止副作用。控制台不得自行推导或补齐。
- **AP-ACCEPT-004.j**：Full-data screen或正式机器审核失败时，来源训练/审核执行必须保持不可变`failed_closed`终态；编排器必须以新`registryRevision`建立`taskKind=failure_boundary_adjudication`、`executionState=package_materialized`的后继当前任务，同时保留原训练为`latestTrainingTerminal`。`lifecycleStage`只能沿用最后有成功证据的正式资格节点，另存失败动作及训练分辨率阶段；筛查结束不等于`formal_stage_validation_completed`。裁决启动后只将`executionState`推进为`adjudicating`；裁决确认能力变更时才建立新的`lifecycleStage=change_candidate`能力身份。该转换不需要Owner或Codex介入，但只读裁决不得直接重训。

训练失败后的合法机器裁决或候选规划应当成为新的`currentProjectTask`，原训练终态继续作为`latestTrainingTerminal`保留。没有活动进程时`activeExecution`必须为空，不得以历史`running`或GPU活动填充。详细Schema、事务、投影和恢复规则由`REVIEW_AUTOMATION_AND_STORAGE_SPEC.md`第11节定义。

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
| 单次运行、哈希、内部票据、历史授权证据、Checkpoint与失败事实 | `data/`、`.runtime/`、SQLite |
| 本地自研 AI 与 Codex 职责迁移 | `../LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md` |

本文不保存 Run ID、单次 SHA-256、当前 Epoch、临时失败或逐命令历史。

### 17.1 唯一机器合同登记

独立CPU基础资产加载验证的唯一政策为[`ai-painter-foundation-cpu-load-probe-policy-v1.json`](../../data/ai-painter/system-governance/ai-painter-foundation-cpu-load-probe-policy-v1.json)，由第9.4.1节限定；其检查入口为[`scripts/check-ai-painter-foundation-cpu-load.mjs`](../../scripts/check-ai-painter-foundation-cpu-load.mjs)。它不替代下表的静态谱系合同，不作为自动训练调度或能力发布入口。

| 合同角色 | 唯一路径 | 权威层级 |
|---|---|---|
| 完整地图与未来动态就绪业务合同 | [`data/ai-painter/system-governance/complete-map-world-business-contract-v3.json`](../../data/ai-painter/system-governance/complete-map-world-business-contract-v3.json) | 长期业务机器合同 |
| 64 份地图语义拓扑差异合同 | [`data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json`](../../data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json) | 数据发布机器合同 |
| 现行完整地图23通道条件合同 | [`ai-painter-complete-map-condition-contract-v1.json`](../../data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json) | 当前条件顺序、类型、存储、归一化、重采样、身份血缘与缺失策略的唯一机器权威；不包含训练或能力发布资格 |
| Stage4 V2 64份数据发布合同 | [`ai-painter-stage4-v2-mvp64-dataset-release-v1.json`](../../data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json) | 当前后继候选的唯一数据输入身份；固定从116条来源索引精确选择64条、48/8/4/4，并绑定每张RGB、条件包和贡献证据，不授予模型、GPU或训练资格 |
| V7迁移期23通道顺序、类型和缩放快照 | [`ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json`](../../ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json) | 已退役未发布实现的历史复核输入；现行条件合同已独立物化，当前程序不得再读取本文件建立条件、训练或运行身份 |
| Stage4全分辨率类型化语义传输与RGB责任后继合同 | [`stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json`](../../data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json) | `cpu_supported_inactive`后继能力父合同；以`declared_shared_substrate`登记共享底座和七个隔离责任命名空间，并冻结条件、数据、Loss、审核、基础资产及CPU验收前置门；不表示GPU资格、训练通过或能力发布 |
| Stage4 V2 Trainer与正式Loss支持合同 | [`stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json`](../../data/ai-painter/system-governance/stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json) | 逐项登记正式V6复合Loss的公式、权重、形状、遮罩、归一化、实现和测试血缘；V2只复用已登记目标，不增加加权Loss，也不把审核阈值或失败像素作为训练目标 |
| Stage4 V2机器审核阈值合同 | [`ai-painter-stage4-v2-machine-review-threshold-contract-v1.json`](../../data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json) | 登记专业画面、道路、水文、岸线和四类对象的正式阈值、适用条件、比较符、聚合和失败码；审核边界必须从真实不可变文件与执行包血缘重算，不接受调用方自报身份 |
| Stage4 V2项目基础Autoencoder谱系合同 | [`ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1.json`](../../data/ai-painter/system-governance/ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1.json) | 只把指定项目资产登记为跨候选冻结基础能力；CPU阶段仅校验路径、文件SHA、结构与加载程序，不反序列化权重；未来加载、训练前和训练后必须补齐相同状态SHA及优化器排除证据 |
| 条件包与清单检查器 | [`scripts/check-current-world-visual-conditions.mjs`](../../scripts/check-current-world-visual-conditions.mjs) | 当前机器验证入口 |
| 本地系统与外部执行边界 | 本文第10至12节及[`local-ai-operating-responsibility-contract-v3.json`](../../data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json) | V3机器合同、CPU治理核心与政策边界记录程序已建立；不产生Owner等待状态 |
| 自主能力运行与内部票据 | 本文第10至13节及[`ai-painter-capability-runtime-autonomy-contract-v3.json`](../../data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v3.json) | 机器发布核验、签名内部票据和持久防重放核心；不得解释为已发布模型能力 |
| 自主能力生命周期 | [`ai-painter-capability-lifecycle-contract-v1.json`](../../data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json) | 本地能力候选、CPU/GPU资格、Smoke、正式验证、独立回归、机器发布裁决及发布/拒绝/回退状态合同 |
| 单包自动闭环 | [`ai-painter-autonomous-closed-loop-contract-v1.json`](../../data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json) | 训练或生成、验证、机器审核、裁决、终态、任务胶囊、事件账本、SQLite、进度与心跳的现行闭环合同 |
| 现行入口注册表 | [`ai-painter-current-entrypoint-registry-v1.json`](../../data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json) | 本地自主执行器只解析登记入口；旧脚本保留为历史证据但不能进入当前链 |
| 退役入口审计索引 | [`ai-painter-retired-entrypoint-index-v1.json`](../../data/ai-painter/system-governance/ai-painter-retired-entrypoint-index-v1.json) | 保留历史入口路径、角色和源码SHA-256；全部`dispatchable=false`，不得被当前解析器调度 |
| 能力发布注册表 | [`ai-painter-capability-release-registry-v2.json`](../../data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json) | 当前无已发布AI Painter能力；未来只能由机器发布单写者追加，不接受Owner布尔字段或签名作为发布证明 |
| 历史合同替代索引 | [`data/ai-painter/system-governance/contract-supersession-index-v2.json`](../../data/ai-painter/system-governance/contract-supersession-index-v2.json) | 保留历史原始字节用于复核，禁止历史Owner等待合同授权新工作 |

单次 `.runtime` 文件、聊天内容和外部评审不能登记为长期机器合同；它们只能证明某次执行。合同路径发生替换时，必须按12.1判断是否形成新的能力版本。调用方提供的`verified=true`、Owner签名或格式正确的64位字符串不能证明能力已经发布；机器必须读取自主能力注册表和不可变发布文件，重算数据、模型、审核、Runtime、条件、测试与程序血缘SHA-256。内部任务票据在消费时必须重新计算自身SHA-256。

当前工作区的文档与机器合同一致性以本地`npm run check:ai-painter-document-contracts`为正式验收入口；该入口不得依赖本机`.runtime`、Checkpoint或GPU。`.github/workflows/ai-painter-document-contracts.yml`如被运行只是同一检查的远程镜像，不是本地文档基线生效的前置条件。完整23通道数据与缩放行为由本地`npm run check:ai-painter-contract-semantic-alignment`验证。Stage4模型空间保真、责任通路、Autoencoder冻结、失败裁决继任、正式入口和控制台投影一致性由本地`npm run check:ai-painter-stage4-core`验证；该命令及远程工作流只是验收要求，在实际运行证据存在前不得声明已通过。三类检查均不得把“合同或核心回归通过”解释为“能力已经发布”或“模型训练通过”。

### 17.2 37条稳定需求逐项追踪

符合状态只允许：`document_defined_program_pending`、`partial_legacy_implementation_not_certified`、`machine_conformant`或`superseded`。只有机器合同、程序实现、正反测试和本地运行证据四层同时存在且身份一致时，单项才可登记为`machine_conformant`；文档检查通过本身不能提升程序符合状态。

| 需求ID | 机器合同绑定 | 程序实现绑定 | 测试绑定 | 运行证据绑定 | 当前符合状态 |
|---|---|---|---|---|---|
| `AP-IN-001` | 现行23通道条件合同定义完整输入绑定集合 | 条件编译器要求显式任务Manifest并写入完整`identityBindings`；没有当前包时禁止历史回退 | 缺失`worldId/regionId/tick/factHash/datasetReleaseIdentity`及旧包注入均失败关闭 | 当前合同和无包静态检查已通过；新包运行证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-IN-002` | `complete-map-world-business-contract-v3`与现行条件合同 | 编译器禁止修改或推测WorldFacts/VisualFactManifest | 旧包缺少只读事实声明时在写入前失败关闭 | CPU合同检查输出；新包终态尚无 | `partial_legacy_implementation_not_certified` |
| `AP-IN-003` | 现行条件合同定义全部路径—SHA配对 | 当前注册表、条件Manifest和条件包均重算文件SHA | 同路径换哈希、路径越界及不可读SHA绑定拒绝已建立 | 当前静态检查输出；新包证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-IN-004` | 现行条件合同定义同包精确身份集合 | 编译器和检查器拒绝跨world/region/tick/sample/package绑定 | 显式历史Manifest负回归返回`historical_not_current` | CPU负回归已通过；新包运行证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-COND-001` | `ai-painter-complete-map-condition-contract-v1`及Stage4 V2输入绑定 | 条件编译/检查器和`stage4_semantic_transport_v2.py`精确验证23通道顺序与类型 | 完整顺序、错序、未知通道、类型置换及旧`latest`隔离回归已建立 | CPU合同检查输出；GPU与训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-COND-002` | 现行条件合同及Stage4 V2合同绑定nearest/bilinear规则 | V2原生条件先编码、离散保占用缩放及连续插值已实现 | nearest/bilinear、单像素离散区域保留及类型置换正反回归已建立 | CPU合同检查输出；GPU与训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-COND-003` | 现行条件合同固定条件包/Manifest schema及23通道缺失策略 | 条件检查器从正式current registry读取，拒绝缺失、重复、乱序、静默填零及历史fallback | 无当前包、显式旧包、通道身份和文件哈希正反回归已建立 | 当前无新条件包，正式状态为`no_current_condition_package_registered` | `partial_legacy_implementation_not_certified` |
| `AP-COND-004` | 现行条件合同固定空间尺寸、dtype、数值范围和按类型重采样 | 条件编译器和V2实现保持相同条件身份，不以缩放改变事实 | 离散无插值、连续bilinear和非法类型分区拒绝测试已通过 | CPU行为报告已形成；多分辨率训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-OUT-001` | 后继完整RGB输出合同待物化 | 候选生成与身份门待迁移 | 原生1024×768及绑定检查待建立 | 未来候选Manifest | `document_defined_program_pending` |
| `AP-OUT-002` | `complete-map-world-business-contract-v3` | 禁止拼接/放大/直绘门待迁移 | 负向图像来源测试待建立 | 未来输出来源报告 | `document_defined_program_pending` |
| `AP-OUT-003` | 后继候选身份合同待物化 | Runtime候选登记器待迁移 | 无身份进入发布链拒绝测试待建立 | 未来候选登记记录 | `document_defined_program_pending` |
| `AP-OUT-004` | 后继审核发布合同待物化 | 发布编排器待迁移 | 审核失败不得发布测试待建立 | 未来发布拒绝记录 | `document_defined_program_pending` |
| `AP-PHASE-001` | 后继四段接口合同待物化 | 权威绑定适配能力尚未形成统一正式接口 | 统一Schema与身份回归待建立 | 现行能力符合证据待生成 | `document_defined_program_pending` |
| `AP-PHASE-002` | Stage4 V2父合同登记地形—道路—水文责任、共享底座和逐责任专属命名空间 | V2为道路、水体和岸线建立独立原生条件编码、传输、潜变量贡献和RGB责任输出 | 专属参数不共享、输出可达、权威掩码、离散占用保留及历史V1隔离正反回归已建立 | CPU合同检查输出；GPU与训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-PHASE-003` | Stage4 V2父合同登记四类对象责任、共享底座和逐责任专属命名空间 | V2为footprints、tree、rock、vegetation建立独立原生条件编码、传输、潜变量贡献和RGB责任输出 | 专属参数不共享、输出可达、单像素保留、掩码隔离及逐责任梯度回归已建立 | CPU合同检查输出；GPU与训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-PHASE-004` | Stage4 V2父合同登记全局RGB责任、七类条件责任输出和冻结基础解码器 | V2最终RGB接口显式消费基础解码RGB、23通道及七类责任掩码/提案 | 掩码内响应、掩码外字节不变、条件责任证据和Autoencoder自冻结回归已建立 | CPU合同检查输出；GPU与训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-TRAIN-001` | Stage4 V2父合同已绑定输入、输出、正式Loss、审核阈值、64份数据和基础Autoencoder谱系 | Trainer新增仅由精确V2架构身份触发的责任前向与最终RGB路径；旧入口不获得V2能力 | 正式V6 Loss公式/权重不变、阈值/失败像素不回流、错误架构和程序SHA替换均失败关闭 | CPU前置合同与模型/Trainer回归；GPU、Smoke和正式训练证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-TRAIN-002` | 现行V2仍绑定原64条release；独立split后继包已物化但未取得训练资格 | `split_release.py`直接读取四份绑定清单并重算来源与实际Dataset选择；`split_training.py`提供train优化步来源记录和验证期模型／优化器状态保护，尚未接入正式Smoke | 新读取器已用真实64张RGB与1472个通道完成CPU取数；文件篡改、跨split身份／窗口重叠、非train更新和验证期状态变化的负回归已建立；历史暴露／变换近邻审核、新能力绑定及真实Smoke仍待完成 | 不可变后继数据包及`.runtime/ai-painter/dataset-release-checks/`中的CPU选择报告；不构成GPU或训练资格 | `partial_legacy_implementation_not_certified` |
| `AP-TRAIN-003` | 后继训练证据合同待物化 | 模型哈希、指标、Checkpoint与终态记录待统一 | 完整终态字段测试待建立 | 现行训练符合证据待生成 | `document_defined_program_pending` |
| `AP-TRAIN-004` | 后继阶段执行包与父Checkpoint机器合同待完整物化 | 批执行器已取消历史默认入口，校验真实阶段终态、产物hash和同链前阶段父绑定；合格单阶段训练入口尚未登记 | CPU文件级正反回归已建立；真实Trainer加载、票据消费、资源监督及GPU阶段恢复仍待验证 | CPU回归仅证明编排防护，不是模型加载或正式训练通过 | `partial_legacy_implementation_not_certified` |
| `AP-CHANGE-001` | V1失败裁决合同与Stage4 V2独立父合同已物化 | 生命周期编排器保留V1失败终态并以独立V2能力身份推进CPU验收 | V1/V2身份相等、旧Checkpoint/输出复用、错误当前任务和父合同替换均失败关闭 | 当前登记与CPU裁决/验收终态；GPU证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-CHANGE-002` | 后继能力变更分类合同待物化 | 条件合同变更分类器待迁移 | 23通道任一语义改变测试待建立 | 未来变更分类报告 | `document_defined_program_pending` |
| `AP-CHANGE-003` | Stage4 V2项目基础Autoencoder谱系合同已物化 | 模型构造层自冻结，Trainer支持层登记未来加载/训练前后状态与优化器排除证明 | 资产路径/SHA、结构程序、冻结锚点、状态阶段和优化器排除篡改均失败关闭 | CPU阶段仅证明静态谱系；未来GPU/训练状态证据尚无 | `partial_legacy_implementation_not_certified` |
| `AP-CHANGE-004` | 后继能力变更分类合同待物化 | 数据谱系分类器待迁移 | 来源、容量、split变化测试待建立 | 未来变更分类报告 | `document_defined_program_pending` |
| `AP-CHANGE-005` | Stage4 V2机器审核阈值合同固定路径、SHA、数值、适用条件和失败码 | 候选中立审核边界重算正式阈值、执行包、候选、条件、参考和掩码身份 | 阈值替换、历史/跨包证据、自报身份、候选尺寸伪造及不适用边界规则均失败关闭 | CPU审核合同检查；未来正式候选审核终态尚无 | `partial_legacy_implementation_not_certified` |
| `AP-CHANGE-006` | 后继能力变更分类合同待物化 | 输出/Checkpoint/Runtime分类器待迁移 | 接口变化测试待建立 | 未来变更分类报告 | `document_defined_program_pending` |
| `AP-CHANGE-007` | 后继能力变更分类合同待物化 | 权威事实绑定分类器待迁移 | 绑定方式变化测试待建立 | 未来变更分类报告 | `document_defined_program_pending` |
| `AP-ID-001` | 后继能力发布身份合同待物化 | 发布编排器待迁移 | dataset与model基数测试待建立 | 未来发布注册记录 | `document_defined_program_pending` |
| `AP-ID-002` | 后继能力发布身份合同待物化 | 发布绑定核验器待迁移 | 任一依赖变化重发身份测试待建立 | 未来能力发布文件 | `document_defined_program_pending` |
| `AP-ID-003` | 后继候选身份合同待物化 | 候选登记器待迁移 | 世界任务变化不改能力身份测试待建立 | 未来候选记录 | `document_defined_program_pending` |
| `AP-ID-004` | 后继候选身份合同待物化 | 候选不可变写入器待迁移 | RGB/输入/审核变化生成新身份测试待建立 | 未来候选记录 | `document_defined_program_pending` |
| `AP-ID-005` | 后继发布身份合同待物化 | 原子发布指针待迁移 | 失败保持上一指针测试待建立 | 未来发布事件与指针 | `document_defined_program_pending` |
| `AP-ACCEPT-001` | 现行条件合同加Stage4 V2输入合同 | 条件编译器、current registry检查器和类型缩放行为检查已接入 | 23通道顺序/类型/范围/缩放、旧包和无包正反回归已通过 | 当前输出仅证明CPU输入合同；不等于模型或能力通过 | `partial_legacy_implementation_not_certified` |
| `AP-ACCEPT-002` | Stage4 V2机器审核阈值合同已物化并绑定专业画面、道路、水文、岸线和四类对象阈值 | 候选中立组合边界已实现；正式执行包审核入口在Smoke物化时建立，当前不可调度 | 阈值数值/适用条件/失败码、文件SHA、不可变执行包血缘和历史证据隔离正反回归已通过 | CPU审核合同检查；未来正式候选审核报告尚无 | `partial_legacy_implementation_not_certified` |
| `AP-ACCEPT-003` | 完整RGB业务合同已有目标定义 | 输出来源与尺寸门待迁移 | 原生尺寸/无拼接/无放大测试待建立 | 未来候选Manifest与RGB哈希 | `document_defined_program_pending` |
| `AP-ACCEPT-004` | `ai-painter-capability-lifecycle-contract-v1`、`ai-painter-autonomous-closed-loop-contract-v1`及本文第15.1节 | 能力生命周期、单包执行、审核状态、有限恢复、后台心跳、终态程序、SQLite提交记录、控制台唯一读取链和四身份字段已接入；具体动态修订只从机器登记读取，不在正式规格硬编码 | 当前登记绑定SHA重算、篡改失败关闭、重复初始化拒绝、旧Smoke默认读取隔离及控制台回归已通过；审核失败后的合法`adjudicating`/`change_candidate`自动物化、正式枚举投影和断电恢复注入仍待完整机器符合证明 | `.runtime/ai-painter/current-execution-registry/current.json`、同事务记录、SQLite索引及本地检查报告 | `partial_legacy_implementation_not_certified` |
| `AP-ACCEPT-005` | 后继身份与发布合同待物化 | 发布注册表、票据消费和指针待迁移 | 跨版本/跨run/历史失败注入测试待建立 | 未来能力与候选发布记录 | `document_defined_program_pending` |

需求编号一经发布不得改义、重排或复用；废止要求保留编号并标记`superseded`。机器合同、程序、CPU测试、GPU资格和运行证据必须直接登记需求ID；缺少任何一层只能保持待迁移或部分符合，不能由文档检查器、格式正确的SHA或历史成功证据提升为`machine_conformant`。

### 17.3 程序适配缺口与验收责任

下表是规范与现有实现的符合性差距，不是运行流水或第二张计划表；不得据此自动改代码、改机器合同或恢复训练。规范不为适应旧实现而降低要求。代码路径是责任落点，不代表其中全部逻辑已验证。

| 需求归属 | 适配缺口 | 代码／机器责任 | 必须补齐的验收证据 |
|---|---|---|---|
| AP-TRAIN-002 | 原Smoke仍存在validation更新路径；新train优化步边界已有CPU行为回归，但尚未通过隔离能力版本接入Smoke，不能声称原问题已在正式训练中修复 | 原Smoke物化器／训练适配器及`ml/ai-painter/src/ai_painter/complete_world/split_training.py` | 新执行身份绑定训练和验证样本；逐optimizer step记录来源；非train更新计数为0；验证前后模型、缓冲区及优化器状态一致 |
| AP-TRAIN-001、AP-TRAIN-002 | 后继四份split文件与真实Python取数已具备CPU证据；原V2绑定不自动迁移；历史暴露、变换派生／语义近邻及新能力绑定尚未闭环 | `ml/ai-painter/src/ai_painter/complete_world/split_release.py`、`ml/ai-painter/scripts/materialize_stage4_v2_split_release.py`及后继能力物化器 | 四份独立绑定与64条选择重现hash；实际图片／通道取数；内容hash与文件字节hash区分；来源窗口隔离；补齐历史审核后再决定训练资格 |
| AP-ACCEPT-004 | CPU验收使用的`cpu_contract_accepted`与正式`cpu_contract_verified`枚举不一致；字符串下一动作不能代替结构化动作绑定 | `scripts/run-ai-painter-stage4-v2-cpu-contract-acceptance.mjs`、当前登记协议及生命周期编排器 | 显式版本化迁移、原始证据保留、读写两端同枚举；无法迁移返回unknown而非猜测 |
| AP-ACCEPT-004 | 失败裁决不得把未运行的正式阶段标为完成 | `scripts/reconcile-ai-painter-stage4-v2-capability-lifecycle.mjs`及失败裁决登记路径 | CPU／GPU／Smoke／筛查／各正式阶段失败分别测试；最后成功资格与失败动作分开 |
| AP-TRAIN-004 | 批执行器的旧入口回退已移除，真实文件父绑定、身份、重复启动及失败终态防护已有CPU回归；正式单阶段执行包、已登记Trainer入口及真实加载尚未闭环 | `scripts/run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs`及对应执行器回归 | 每阶段精确V2模型身份；Stage1载入Stage0成功权重、Stage2载入Stage1成功权重的实际加载hash；票据消费、资源上限、心跳、超时与恢复真实回归；CPU模拟产物不得充当训练证据 |
| AP-CHANGE-005、AP-ACCEPT-002 | 旧跨模态合同仅覆盖两个槽位，且阈值数字与规则文本不一致，不能充当全MVP现行门禁 | 来源规格第4.2节及跨模态补充规格 | 新作用域合同、公式与阈值一致、边界反例、全历史覆盖和新程序血缘；不得改旧文件字节 |
| 文档基线检查 | 检查器版本断言已与权威文档同步；原文档检查入口通过只证明文档基线，不消除本表程序缺口 | `scripts/check-ai-painter-document-governance.mjs` | 持续校验版本、37条要求和状态语义；历史合同原始字节仍须通过独立核验；不得将文档通过提升为模型资格 |

## 18. 完整MVP视觉与生命闭环合同

### 18.1 范围与职责

本节是在既有37条顶层需求下的完整MVP验收场景，不重用、改变或增加顶层AP编号。它定义应达到的结果；当前是否完成由第17.2节、唯一模块计划表及机器证据分别表达。

业务规格第3.2节定义分段交付：原始自然世界先行验收只消费自然事实、完整地图、运行层及保存恢复；人物、动物、房屋和建设不是该能力的前置条件。对应本节MVP-VIS-01、06、07、08的自然世界适用部分，必须记录实际适用范围，不能据此把整组场景或完整MVP标记通过。随后单独接入人格及人物行动，动物与建设各按自己的依赖和资格接入。

自然世界阶段不要求预建人工路网或建筑；有事实支持的自然通行仍须成立，事实中已有道路、水体和主要对象仍须对齐。前期不开展与可读性、事实一致性无关的纹理／装饰精修；也不得以道路后置为由自动忽略训练RGB与条件冲突。适用性只能由新候选的事实和冻结审核合同确定，不能由结果失败后临时改判“不适用”。第9节训练资格、第18.5节阶段顺序、原生1024×768发布及历史证据保护不变。

单一原始自然世界先行MVP的全历史创作唯一性适用性采用数据与来源规格第9.1节：状态为`deferred_out_of_current_mvp_scope`，规则与实现保留供后续恢复，不作为本阶段阻断且不算通过。当前数据集内部去重、历史用途／模型谱系隔离、来源权利和事实一致性仍是准入要求。新作用域的数据、能力、训练、审核及发布必须一致绑定该边界；旧合同与旧失败不原地改写。程序适配与反例未验证前不得声称已解除机器阻断，也不得把该例外扩展到其余资格门。

| 责任模块 | 必须提供 | 不得承担 |
|---|---|---|
| 出生资料／人格映射 | 合法出生输入、资料精度、紫微／八字来源、映射模式、稳定人格及初始外貌档案 | 用程序默认男性或固定映射模式冒充用户选择；从缺失资料编造完整命盘 |
| 生态数据与世界事实 | 泰国首区自然事实、五类动物名录、生境、形态及生命规则 | 把区域兼容包络当每个窗口的事实；把植物目录当动物名录 |
| 本地AI与Runtime | 感知、记忆、动机、合法行动、实体状态与资源变化、保存恢复 | 由Painter决定病情、碰撞、资源扣除或行为是否成功 |
| 世界导演／条件编译 | 同一tick的事实清单、对象位置、可见状态、生命条件扩展及明确不适用项 | 偷占既有自然物通道，或将未知状态静默填零 |
| AI Painter | 从结构化输入生成身份一致、状态可辨的原生完整RGB | 逐帧换人、增加名录外生物、复用旧帧或局部贴图伪装新状态 |
| 机器审核／发布 | 身份、来源、语义、质量、动态与Runtime一致性，以及原子发布／拒绝证据 | 只看图好看或退出码为0就判定成功 |

### 18.2 人物初始外貌和资料完整度

接口字段及归属采用总体架构第4.1节，具体来源与规则资格采用数据规格第11.1节。路由必须区分：合法日期且时辰完整→紫微规则可用时优先紫微；合法日期但缺时辰→八字`THREE_PILLARS`；日期缺失／非法／规则范围外→资料不可用。程序错误不是资料不足，不能用静默fallback包装为合格人格或外貌。

外貌映射必须给出版本化参数表、单位／范围、证据引用、缺失值规则、稳定随机seed和冲突处理。同输入、同规则和同seed生成同档案；人物身份绑定实例而非仅绑定生日。现实自我／平行世界模式与性别呈现分别记录；平行世界具体外貌变换尚无有效规则时应标记该变换不可用，不自行取反或伪造已实现。

《麻衣神相》仅是候选资料类别，不要求为完成文档而杜撰其内容。来源研究可以继续增加合格规则数据；规则公式或含义改变必须升版并重新验收，不能覆盖已存人物档案。

### 18.3 五类动物与多态表达

MVP数量单位固定为五个`animalTypeId`，不是五张图、五种颜色或五个模型。具体类型名称、分类层级及代表物种由一份版本化AnimalRoster显式声明；在名录尚未定稿时不擅自将“五个类型”等同于五个具体物种。每个类型至少有一个来源合格、适合首区生境的现实物种实例，不能用不同物种别名重复计数。

每个已发布物种必须有：稳定实体ID、可识别外形、合理尺度与活动范围、可执行动作、基础健康／活动状态、资源或环境约束和可见体征。个体间允许有有界形态差异，同一个体的稳定形态不能随seed或刷新漂移。样本数量按身份、状态和跨场景覆盖审计决定，不能以现有64张自然地图证明动物数据充分。

### 18.4 连续状态与模型边界

稳定档案、Runtime状态、可见体征和完整RGB是四种不同记录；每次任务必须通过实体ID、档案hash、状态hash和世界tick关联。变化由合法状态转移或行动事件触发，不由图片噪声触发。

必须覆盖健康／患病／恢复、活动／休息、形态差异及行动限制；各物种的不适用状态显式标记并有规则依据。健康规则是虚构世界规则，不是对真实用户的医疗推断。人格和外貌来源不直接设定患病事实。

生命视觉可采用共享底座或隔离组件，仍须通过第6节四段责任与第7节实现模式约束。能力合同新增生命输入、时序约束、责任输出、Loss和审核映射后，必须重新执行资格链。自然地图Autoencoder或其他基础资产只能按有证据的资产角色复用，不能从文件日期、名字或旧成功记录继承能力。

世界tick与视觉采样频率分别由版本化Runtime／资源合同定义。采样可以低于tick频率，但任务必须绑定真实快照，缺帧、过期及阻断必须如实报告；不得用高GPU占用证明“活着”，也不要求每个tick无条件启动GPU。资源合同须在执行前登记更新间隔、延迟预算、内存／显存／磁盘上限、超时、尝试上限及恢复策略；缺值禁止资源消费，不在本文编造硬件承诺。

### 18.5 模型资格与失败恢复验收

| 资格边界 | 前提及成功证据 | 失败后的合法行为 |
|---|---|---|
| CPU合同 | 输入／数据／模型／Loss／审核／基础资产身份齐全，行为正反测试通过 | 保存缺口，不用CPU通过代替GPU能力 |
| 只读GPU资格 | 当前能力真实前向、梯度可达性与资源边界；无优化器更新，冻结资产前后状态一致 | 基础设施恢复仅限合同次数；语义失败交给只读裁决 |
| 受控Smoke | 当前能力资格有效；仅train更新；固定复现、验证、审核、完整终态 | 保留失败，不晋级Smoke权重，不原样无限重跑 |
| 全数据筛查（能力合同包含时） | 逐样本责任审核；明确其位于Smoke与正式阶段之间的实际位置 | 筛查失败不能登记正式阶段完成 |
| Stage0／1／2 | 依次256×192、512×384、1024×768；每阶段成功终态、父权重hash、固定验证与审核 | 任一失败不消费其权重；修复产生独立能力身份，不跳级 |
| 独立严格复验 | challenge／regression未参与训练及选择；最终候选与冻结规则接受独立验证 | 若用失败反馈修改候选，须明确已暴露集合并为新结论建立独立测试证据 |
| 能力／Runtime发布 | 数据、模型、条件、审核、测试、Runtime及程序血缘齐全并原子登记 | 失败保持上一有效发布；无合法当前帧则展示阻断 |

每次后继动作须有登记入口、前态、完整输入身份、幂等键、有效任务锁、心跳、超时、唯一终态和明确下一动作。失联、执行失败、待物化和无活动任务分别报告；不得把“窗口无输出”直接归因为网络或把CPU终态误当继续训练。后台继续执行能力须经过关闭控制台、进程中断、断点恢复及并发重复消费的实际回归。

### 18.6 可验证的完整MVP验收矩阵

以下`MVP-VIS-*`为场景编号；所有新增生命场景保持`document_defined_program_pending`，直到数据、机器合同、代码、正反测试及运行证据均齐全。表中代码为已有责任落点，不等于现有程序已提供完整功能；测试描述为待实现的验收要求，不冒称已有测试文件。

| 场景 | 对应顶层要求 | 代码责任落点 | 必须验证的行为与证据 |
|---|---|---|---|
| MVP-VIS-01 自然首区 | AP-IN-002、AP-COND-001 | `scripts/build-earth-geospatial-naturalized-world-facts.mjs`、条件编译链 | 泰国窗口来源→自然化→WorldFacts→条件hash全链；无水／封闭水体不强加河口，旧区域平均值不冒充具体窗口测量 |
| MVP-VIS-02 出生与外貌 | AP-IN-001、AP-IN-004 | `src/world/creation/world-creation-runtime.ts`、`src/ai/personality-core/butler-profile-core/` | 完整时辰／缺时辰／非法日期三路；同档案可复现；不同实例隔离；模式或规则缺失明确阻断 |
| MVP-VIS-03 五类动物 | AP-IN-002、AP-PHASE-003 | `src/world/live-world/types/entity-types.ts`及生态名录适配责任 | 恰有五个类型、各有真实物种和生境依据；重名不重计；名录外或错误生境注入被拒绝 |
| MVP-VIS-04 多态与身份 | AP-PHASE-003、AP-OUT-001 | `ml/ai-painter/src/ai_painter/complete_world/`及新增生命条件适配 | 同实体连续至少3个合法tick；健康→患病→恢复状态可追溯，形态身份稳定；独立体型样本可区分，未知症状不伪造 |
| MVP-VIS-05 行动反馈 | AP-IN-002、AP-IN-004 | `src/ai/butler-autonomy/`、`src/world/runtime/world-runtime-tick-runner.ts` | 感知→目标→合法行动→资源／状态变化→记忆→再决策；状态限制确实改变行动结果；重复提交不重复扣资源 |
| MVP-VIS-06 时序与存档 | AP-ID-004、AP-ACCEPT-004 | `src/world/runtime/world-runtime-store.ts`、`src/world/game-map-frame/` | 同tick状态一致；保存恢复保持实体／规则／随机状态；中途断电不产生半提交，旧帧不可冒充新tick |
| MVP-VIS-07 训练隔离 | AP-TRAIN-002、AP-TRAIN-004 | `ml/ai-painter/scripts/`、`scripts/run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs` | 样本更新来源逐步可查；四split及人物／同源序列分组隔离；父Checkpoint真实加载身份正确；篡改必须失败 |
| MVP-VIS-08 展示发布 | AP-OUT-002、AP-ACCEPT-005 | `src/world/game-map-frame/game-map-runtime-frame-pipeline.ts`、`src/app/api/world/game-map-runtime-frame/image/route.ts` | 原生完整RGB、全部语义审核、实体状态与碰撞一致；跨world／tick／能力注入、失败候选、旧图均拒绝；发布指针原子更新 |

视觉定量门槛必须在新能力的审核合同中预先冻结，包含公式、单位、比较符、适用范围、阈值和已标注正反样本。缺少可靠实体身份／健康语义审核器时该项为未通过，不得用像素相似度替代；通过人工阅读本规范不能替代这些机器证据。

### 18.7 资料未齐时的明确处置

尚待研究的数据包括具体五类动物及代表物种、外貌映射细则、相术候选文本、各物种可见健康状态、生命条件与时序审核阈值。其完成条件分别由本节及来源规格定义；这不是要求Owner逐任务审批。资料未齐只阻断依赖它的生命能力发布，不改变已冻结自然地图候选的输入，也不能把整个MVP标为完成。

后续执行者必须先读权威链与唯一计划表，按本规范识别“缺数据／缺合同／缺实现／缺测试／缺运行证据”，再在自身合法任务范围内推进。不得为消除待办而反复改写业务目标、将缺口改称通过、降低审核门或启用历史候选。
