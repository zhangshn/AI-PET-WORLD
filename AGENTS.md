# AI-PET-WORLD 智能体执行规则

更新时间：2026-07-25 09:02:19 +08:00

状态：active-governance / 所有项目窗口和智能体必须遵守

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 当前最新执行门禁

项目所有者已授权的真实地理自然化数据建设已经闭合。工程设施移除runId=`earth-geospatial-engineered-removal-2026-07-24T21-46-52-147Z`通过Overpass API读取当前测量窗口内的OSM工程道路与建筑证据，共识别107个工程要素；OSM几何只用于识别人类开发痕迹并形成移除掩码，不得成为游戏世界几何、导航数据、23通道直接几何或RGB训练图。

自然化WorldFacts runId=`earth-geospatial-naturalized-world-facts-2026-07-24T22-10-04-752Z`重建15,170个被排除像素，WorldFacts SHA-256=`52b207ec59ea6a4034998d8a0def396a61b0dd76c942089795081539758c3ff2`。完整地图条件runId=`earth-geospatial-complete-map-conditions-2026-07-24T22-32-37-023Z`、conditionId=`earth-reference-naturalized-complete-map-b3be6a28ffb6`已经生成并通过独立检查：World Director、完整地图任务、正式23通道、完整地图范围审核、双时区时间、SHA-256和SQLite索引全部存在；`focal_area`全零，不包含固定家园中心，不携带现实或OSM精确几何，不读取历史RGB，`remainingBlockers=[]`。

项目所有者随后以`owner-authorized-earth-reference-naturalized-complete-map-single-rgb-20260725`只授权上述条件的一张RGB。请求ID=`conditional-rgb-001-2026-07-24T23-28-55-094Z`；Codex内置生成仅调用一次，程序自动保存`1448×1086`源图SHA-256=`dd1075eb865991f250d91726724b3f2c17adbe0a3f726d5ad8da183cf8246ab8`和nearest-neighbor `1024×768`审核派生图SHA-256=`ac6778270a44d2379e1ea0c635041eb8685c0def7659ba8e7d3a6a73b1d29bb4`，并完成来源、许可、任务、23通道、审核、双时区时间、hash、SQLite索引和失败学习自动写入。

机器审核状态=`machine_rejected`，唯一失败码=`condition_terrain_path_ground_centroid_drift`：道路期望中心为`(0.1966, 0.5436)`，视觉信号中心为`(0.5051, 0.5057)`，距离`0.3108`，超过最大值`0.25`；水体条件、来源分辨率、风格指纹和对117张历史完整地图的构图新颖性审核均通过。该记录固定`status=rejected`、`trainingEligibility=machine_rejected`、`formalCandidate=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，未进入人工审核，GPU训练数仍为0。当前唯一下一动作是等待项目所有者明确授权道路条件对齐修复或新的单图尝试；不得自动重试、生成第二张、启动训练、建立候选、绑定RuntimeFrame或进入`/world`。

## 必读入口

开始任何世界地图任务前，必须依次读取：

1. `docs/DOCUMENT_AUTHORITY_INDEX.md`
2. `docs/BUSINESS_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`
5. 当前任务涉及的一个正式下级规格：
   - 视觉实现：`docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md`
   - 数据来源：`docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md`
   - 审核/自动化/存储：`docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md`

禁止默认批量读取 `docs/world-visual-data-dictionary/`。只读取其 `README.md`、当前导出 JSON 和当前任务明确涉及的字典条目。

## 当前范围

当前只处理第一版专业自然家园完整游戏地图及其数据、模型、审核、自动保存和控制台支撑。

项目所有者于 2026-07-18 锁定完整地图范围：当前任务禁止继续生成或接收只有单一河段、单一道路、单一池塘、单一林间空地、单一材质区域或放大局部生态单元的“全画布局部图”。文件尺寸达到 `1024×768` 不等于完整地图。每张新 RGB 在生成前必须由正式世界事实、世界导演和完整地图级 23 通道共同证明其覆盖完整自然家园区域，能够同时表达整体入口/出口关系、连续自然通行组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；水体只在当前世界事实要求时出现，不得把东南亚档案错误解释成每张图都围绕水体。无法证明完整地图范围时必须在调用任何图像生成算力前阻断并询问项目所有者。

项目所有者于 2026-07-23 进一步锁定初始自然世界的自主性边界：任何后续训练原图、世界事实、世界导演、23通道可视引导、提示词和审核规则均不得预设、暗示或保护固定的“家园中心”“活动中心”“建筑候选地”“施工空地”或道路汇聚平台。初始地图中的道路只表达既有自然通行与大世界连接，不得为了未来建筑而在中部或其他位置人为扩宽、留白、清空植被或形成规则方块。家园选址、建造位置和后续修路属于 AI 管家基于人格、记忆、目标和当时世界事实作出的运行时自主决策；只有该决策经合法世界规则写入新的 WorldFact 后，后续 RuntimeFrame 才能表达对应建设事实。为兼容既有模型输入，23通道中的 `focal_area` 名称暂时保留，但在初始自然地图任务中必须是全零的非活动兼容通道，不得进入可视条件引导，也不得承担家园选址、清空对象或道路汇聚语义。历史已保存记录继续作为不可变旧契约证据，不得重写或冒充新规则样本。

除项目所有者明确签发的有界批次授权外，任何智能体或程序不得根据蓝图队列、历史计划、缺失编号、失败记录或“继续”状态自行批量出图。项目所有者曾于 2026-07-23 授权 `owner-authorized-v7-remaining-104-continuous-batch-20260723`；该连续批次已于2026-07-24被项目所有者明确停止，只作为历史授权证据保留，不得从任何槽位恢复。发现文档、世界导演、23 通道或构图尺度可能导致局部图、重复图或相似图时，必须在调用任何图像生成算力前阻断并询问项目所有者。

冷启动基础完整地图原图不是只读展示图，也不是后续生成器直接临摹的图片参考。程序必须先从经审核基础完整地图集合中形成可追溯、版本化的完整地图视觉标准，至少覆盖镜头与世界尺度、整体构图层次、入口/中心/道路关系、空间与生态分区组织、水体分布变化、对象尺寸与密度、像素纹理、色彩、光照和游戏可读性。后续生成只允许消费该聚合标准、当前世界事实、世界导演和本轮23通道；不得把历史完整地图 RGB 直接传给生成器。统一游戏视觉语言不等于重复构图，河流、道路、区域组合和生态结构必须由本轮世界事实产生并通过新颖性审核。

第一版正式视觉已经由项目所有者锁定为 2D 高分辨率像素风完整地图：模型必须原生生成 `1024×768` 完整地图，不再使用 `256×192 -> 4× nearest-neighbor` 的低分辨率像素画契约。高分辨率像素风必须统一视角、尺度、像素纹理语言、轮廓、光照、对象接地和游戏可读性；不得把普通数字插画、tile 拼接、局部 sprite 放大或平滑缩放冒充正式完整地图。

分辨率解释固定为：正式本地模型 target、正式候选、项目所有者审核、Runtime 和 `/world` 只认本地模型原生生成的 `1024×768` 文件；`256×192` 或 `512×384` 只允许作为模型训练内部的渐进阶段，不能作为候选保存后放大取得正式资格。唯一例外是项目所有者于 2026-07-16 批准的 AI 辅助冷启动来源派生契约 `owner-approved-high-resolution-four-three-derivative-v1`：Codex 内置图像生成得到的不小于 `1024×768` 的精确 4:3 原始文件必须原样保存，程序只允许无裁切、无放大地以 nearest-neighbor 生成单独的 `1024×768` 训练/机器审核派生图；原始图和派生图都固定 `formalCandidate=false`、`runtimeFrameEligible=false`、`independentTrainingEligible=false`，不得进入正式候选、Runtime 或 `/world`。画法/生成算法负责把世界事实、23 通道条件和模型状态转换为新像素；风格契约负责统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性。两者必须同时满足，不能互相替代。

整个项目的两大核心业务已经锁定为：

1. AI 管家的性格数据、性格映射和角色自主。正式角色只能申请 AI 管家；紫微斗数和八字是人格数据来源；用户可选现实自我映射或平行世界反向紫微映射。
2. 以地球参数和自然规律为基准的类地球世界自主运行、自主生长与长期演化。

当前地图任务是第二核心业务的第一阶段，不代表整个项目只有地图生成业务。

第一版自然家园必须被视为未来类地球大世界的第一个连接区域，而不是孤立概念图。大世界连接机器契约固定为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。项目所有者已命令按真实地球实际情况定义第一版连接；正式蓝图为 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`，水流北入南出、道路南侧接入、西侧保持自然边界。项目所有者已于 2026-07-13 授权 Runtime 世界事实迁移并审核通过迁移结果；程序已生成 tick 3，自动保存迁移证据和 `.runtime/world-connectivity-owner-reviews/latest.json`。连接训练覆盖门槛已批准并由程序完成27条正样本、27条负样本，9个覆盖轴均达到3正+3负。智能体不得用图片反推或创造连接。

AI-PET-WORLD 的产品身份是像素风格自主世界游戏。本地小 AI 是游戏核心智能系统，不是单一画图程序；它长期负责世界理解、世界导演、状态推理、角色自主、失败学习和世界演化。AI Painter 只是本地小 AI 的视觉生产子系统之一，只负责把已存在的世界事实转成游戏画面，不得被描述成整个小 AI、整个游戏或世界事实生成器。

第一版 MVP 世界档案已由项目所有者锁定为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`：以东南亚大陆热带季风低地、河谷和丘陵为现实生态参照，包含热带雨林及季节性森林、河岸、草地、淡水湿地和低山环境；当前明确排除雪、冰川、高山苔原、荒漠、寒温带白桦/针叶林身份及未经批准的海岸红树林子档案。现实事实可以进入世界数据，但外部数据集、地图、文字和图片仍必须逐项保存来源、版本和许可；禁止把权威网站图片自动当作训练数据。

未经项目所有者明确命令，不得开始或恢复：

- 旧 5×5 Chunk、9张候选图或 P10-B3 路线。
- 管家角色实现、玩家交互、建筑、动物和后续生态扩展。
- 紫微斗数人格映射实现；它属于第一核心业务，但不参与当前地图任务的执行顺序。
- 单纯局部材料盲训。

## 文档边界

- `docs/game-world-generation/`：当前正式架构。
- `docs/world-visual-data-dictionary/`：当前视觉事实参考。
- `docs/ai-painter-progress/`：页面锁定规格和实施证据。
- `docs/ziwei/`：独立维护的人格数据子系统；长期服务 AI 管家人格映射，当前不参与世界地图任务。

旧计划、旧进度表和旧 `live-world` 文档已经删除。智能体不得重新建立平行计划或历史副本。

## 当前阻断

```text
owner_review_missing_identity
formal_gate_missing
data_gap_insufficient
ai_assisted_v7_training_blocked_pending_approved_128_dataset_implementation
```

项目所有者于2026-07-20明确授权采用D盘独立训练数据仓库、SQLite索引、冷热分层和无损迁移方案。迁移`runtime-to-d-20260720-0528`已经完成并激活：源和目标均为700,058个文件、94,808,690,230字节，700,058个文件全部完成SHA-256校验，差异数为0，迁移manifest SHA-256=`08a56d7cb74e3ef6fa46f817abb205c00bd00ea6e84b9dcefabdcc7de42cae6a`。项目逻辑路径`F:\ai-pet-world\.runtime`现为指向`D:\AI-PET-WORLD-DATA\hot\runtime`的目录联接；SQLite目录固定为`D:\AI-PET-WORLD-DATA\catalog`，迁移证据固定为`D:\AI-PET-WORLD-DATA\migrations\runtime-to-d-20260720-0528\migration-manifest.json`。F盘旧数据保留在`F:\ai-pet-world\.runtime-f-drive-backup-runtime-to-d-20260720-0528`，在项目所有者再次明确验收前不得删除。控制台和GET API已改为读取SQLite摘要、索引或明确单条证据，禁止递归扫描全部运行目录。存储迁移阻断已经关闭；V4验证采样器也必须承认项目根和已批准的D盘热运行根，并继续拒绝其他外部路径。

自有扩散采样器、Autoencoder训练程序、严格项目自有 IP 数据门禁、版本化地球气候参数快照、第一版真实地球参照连接蓝图、Runtime 连接事实迁移、项目所有者审核记录、22图版本化基础完整地图视觉标准和完整地图范围门禁已经实现。当前 tick 3 已保存区域身份、三个邻居、四个当前区域连接口、南侧道路连接、北入南出的水文图和审核身份。项目所有者已命令旧21套条件蓝图只作历史、不修补、不覆盖；程序已按 `complete-map-scope-world-facts-v2` 使用 `complete-map-v2-001...021` 全新标签重建21套世界事实、导演、任务包和23通道，21/21结构检查及21/21完整地图范围门通过。当前21/21后置RGB均与正式v2任务包及23通道条件包严格同身份。V4 stage 0至stage 2正式渐进训练已完成，stage 2 checkpoint SHA-256=`a3a5bdb608091bbdec5e65160758b8f35ca752adeb647487a013ba6df4c11a04`。项目所有者于2026-07-21授权`complete-map-v2-005`单张held-out验证；runId=`ai-assisted-conditional-inference-validation-v4-2026-07-20T20-31-54-134Z`，图片SHA-256=`418fbe777eb40c2b685b8cf10e38717c1998a8d92630717586c7542e274bea0e`。机器审核以`condition_terrain_water_unexpected_signal`、`condition_terrain_path_ground_coverage_mismatch`、`professional_multiscale_texture_noise_overload`、`professional_quiet_region_missing`拒绝。V4 checkpoint和验证图均固定`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。项目所有者随后授权诊断与修复；程序已自动保存V4根因诊断runId=`ai-assisted-conditional-v4-diagnosis-2026-07-20T21-59-47-587Z`，并建立V5合同`output-bound-condition-hierarchy-multiscale-unet-v5`。V5纯CPU回归runId=`ai-assisted-conditional-v5-cpu-regression-2026-07-20T22-36-42-387Z`已通过。V5 stage 0冒烟runId=`ai-assisted-conditional-denoiser-v5-smoke-2026-07-20T23-03-42-768Z`已经通过，冒烟产物的D盘与SQLite漏索引也由保留证据的无训练修复run闭合。项目所有者随后明确授权V5 stage 0正式渐进训练；正式控制器已完成runId=`ai-assisted-conditional-denoiser-v5-stage-0-2026-07-20T23-58-58-343Z`，真实读取21套条件配对和23通道，在CUDA上完成`256×192`阶段40轮，最佳轮次31、最佳验证指标`1.7963923315207164`、持续85.306秒，checkpoint SHA-256=`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`。程序自动保存中英文启动/完成事件、UTC与Asia/Shanghai时间、40轮指标、manifest、progress、条件证据、算法证据和checkpoint；D盘SQLite已验证6个artifact与2个双语事件，实际文件字节数和SHA-256一致。本轮固定`denoiserTrained=true`、`formalInferenceEligible=false`，没有生成RGB，不是视觉通过、正式候选、Runtime或`/world`资格。下一步只能等待项目所有者明确授权V5 stage 1正式渐进训练；不得自动启动stage 1、stage 2、推理、候选、Runtime或`/world`。旧版本RGB和审核继续作为不可变历史保留，不得重绑到当前身份。`/ai-painter-progress/original-images/complete-maps` 页面分类不得重新混排。

2026-07-19 首张隔离验证 `complete-map-v2-014` 已由程序生成、保存并被验证专用机器审核拒绝；该 V2 图及失败学习固定保留，不能进入原图库、Runtime 或 `/world`。数值诊断确认旧条件去噪器存在潜空间尺度不一致、epsilon 高时间步放大和浅层去噪器能力不足。项目所有者随后授权算法修复；程序已建立 `normalized-latent-v-prediction-multiscale-unet-v3`，复用已批准的 Autoencoder v2，新增按训练集计算的逐通道潜变量归一化、velocity 预测、多尺度 23 通道 U-Net、固定时间步验证和最佳 checkpoint 选择，并重新完成 `256×192 -> 512×384 -> 1024×768` 三阶段训练。V3 最终 checkpoint hash 为 `684ecc29c74408038539c8f3fd62b3272611a0bd0e5ddd4ef3931ae16668659b`，仍固定 `formalInferenceEligible=false`。同条件同 seed 的无 RGB 数值诊断把采样解码饱和比例从 V2 的 `12.493%` 降至 V3 的 `1.1945%`；实际held-out RGB验证runId=`ai-assisted-conditional-inference-validation-2026-07-19T14-37-10-137Z`仍失败，图片hash=`c861188b4f92f7f003f36bba18dd4de78305ef9761fe787e694ee33243834b2f`。程序已保存图像、条件、checkpoint、seed、审核和失败学习；旧机器审核仅检出道路覆盖错配并漏判高频噪声与层级坍缩。V4 Professional Aesthetic回归新增检出`professional_multiscale_texture_noise_overload`和`professional_quiet_region_missing`；V4随后完成训练但held-out视觉验证仍失败。

V4模型合同固定为`typed-condition-composite-objective-multiscale-unet-v4`：离散条件nearest-neighbor、连续条件bilinear；训练保存velocity、clean latent、latent gradient、离散条件重建、连续条件重建及复合checkpoint质量分数。V4失败诊断确认：内部条件重建头能够读取已混入条件的中间特征，不能证明最终`predicted_clean`或RGB遵守23通道；checkpoint选择也没有直接度量完整采样后的纹理层级与安静区域。V5固定为`output-bound-condition-hierarchy-multiscale-unet-v5`，必须从最终预测clean latent重建条件，增加多尺度梯度、Laplacian、安静区域超量、离散/连续输出绑定损失，训练时间步采用确定性分层轮换，并把严格最终推理split锁定为`challenge`。V5代码、CPU回归、stage 0冒烟和stage 0正式渐进训练已经完成；stage 0 checkpoint仍固定`formalInferenceEligible=false`。任何V5 stage 1、stage 2、推理或RGB生成仍需项目所有者单独授权。

AI辅助单图推理验证入口现在还必须自动调用验证专用机器审核入口：依次执行VJ-0、VJ-1、VJ-2、版本化风格指纹和构图新颖性审核，保存中英文记录、图片/条件/审核hash，并在失败时自动回写失败学习。该验证记录不得写入原图库，不得成为正式候选，不得绑定Runtime或进入`/world`。

项目所有者已于 2026-07-13 明确授权 `owner-authorized-ai-assisted-cold-start-v1`：OpenAI 生成的高分辨率像素风原图可以进入单独的 AI 辅助冷启动数据通道，但必须保存生成来源、提示词、时间、hash、owner 授权和审核结果，并固定 `independentTrainingEligible=false`。由此训练的 checkpoint 必须标记 AI 生成数据依赖；不得冒充纯项目独立数据 checkpoint。原 `strict-project-owned-training-data-v1` 通道继续保留，未来用于无第三方生成输出依赖的纯项目数据训练。

项目所有者已于 2026-07-16 批准无单独 API 付费的 Codex 内置图像生成路线。不得把 ChatGPT Pro 订阅解释成 OpenAI API 额度；不得要求保存 API Key；直接 OpenAI API 失败必须由程序记录失败码、路线、时间戳和证据，但不得保存密钥。Codex 内置生成只负责冷启动原始图，接收、派生、审核、失败回写和训练资格全部由项目程序自动处理。

2026-07-22 20:10:36 +08:00 slot-002闭环历史状态：`v7-capacity-slot-001`与`v7-capacity-slot-002`均已完成独立世界事实、世界导演、正式23通道、唯一RGB、机器审核、项目所有者审核和容量贡献登记。slot-002记录ID=`ai-cold-start-v7-v7-capacity-slot-002-lowland-evergreen-tropical-forest-v1`，owner审核时间为`2026-07-22T11:59:39.976Z / 2026-07-22T19:59:39+08:00`；容量贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-002-2026-07-22T12-01-16-339Z`，SHA-256=`7f3dcf75cfc5a1804b7d3905afa0f463a4253bff3701f888881673ae8f2725f2`。当时的数据包`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-22T12-04-59-138Z`确认条件绑定完整地图23条、V7贡献2条、未配对0条、阻断0条；当时的容量审计`ai-assisted-v7-data-capacity-plan-2026-07-22T12-05-01-665Z`确认23/23合格、失败0条、正式缺口105条。该段门禁已由后续slot-003闭环状态覆盖。

2026-07-21最新执行状态覆盖此前“等待V5 stage 1”的历史描述：项目所有者已明确授权并由正式控制器完成V5 stage 1正式渐进训练。runId=`ai-assisted-conditional-denoiser-v5-stage-1-2026-07-21T00-47-30-506Z`严格继承stage 0 checkpoint SHA-256=`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`，在CUDA上完成`512×384`阶段40轮，最佳轮次31、最佳验证指标`1.9992291231950123`、持续109.312秒，新checkpoint SHA-256=`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`。程序自动保存双语事件、双时区时间、逐轮指标、manifest、progress、条件证据、算法证据、父谱系和checkpoint；本轮D盘SQLite的6个artifact与2个双语事件已经完成字节数和hash校验。Stage 0运行目录中的5个不可变产物和2个双语事件继续通过校验；共享`latest.json`按设计更新为stage 1，不作为历史run不可变hash。Stage 1没有生成RGB，固定`formalInferenceEligible=false`。当前唯一下一动作是等待项目所有者单独授权V5 stage 2正式渐进训练；未获授权不得启动stage 2、推理、候选、Runtime或`/world`。

2026-07-21最新执行状态进一步覆盖上述“等待V5 stage 2”的历史门禁：项目所有者已明确授权并由正式控制器完成V5 stage 2原生`1024×768`正式渐进训练。runId=`ai-assisted-conditional-denoiser-v5-stage-2-2026-07-21T07-41-08-443Z`严格继承stage 1 checkpoint SHA-256=`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`，在CUDA上完成40轮，最佳轮次40、最佳验证指标`2.0965599417686462`、持续183.328秒，新checkpoint SHA-256=`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`。程序自动保存双语事件、双时区时间、逐轮指标、manifest、progress、条件证据、算法证据、父谱系和checkpoint；D盘SQLite已验证本轮6个artifact与2个双语事件，物理文件字节数和SHA-256一致。Stage 0与stage 1各自的5个不可变运行产物和2个双语事件继续通过校验；共享`latest.json`按设计指向stage 2。本轮没有生成RGB，固定`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。当前唯一下一动作是等待项目所有者单独授权一张`challenge` split held-out推理验证；未获授权不得推理、生成RGB、建立候选、绑定Runtime或进入`/world`。

2026-07-21最新执行状态覆盖上述“等待V5单张验证”的历史门禁：项目所有者已明确授权唯一`challenge`样本`complete-map-v2-014`的V5 held-out单图验证。正式入口已修复V4硬编码并通过显式`--v5`读取Stage 2 checkpoint SHA-256=`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`。runId=`ai-assisted-conditional-inference-validation-v5-2026-07-21T08-45-43-210Z`生成原生`1024×768`图片SHA-256=`3e4af6352c2ed4a48a3610de0f59c5efe161a858b4cd92f0553fade0aa506011`。机器审核状态为`machine_rejected`：VJ-2记录`condition_terrain_path_ground_coverage_mismatch`，Professional Aesthetic记录`professional_multiscale_texture_noise_overload`。D盘SQLite已验证8个artifact与3个中英文程序事件；自动视觉审核学习runId=`auto-visual-judge-learning-2026-07-21T09-22-05-435Z`已摄取本轮机器审核。验证图固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。当前唯一下一动作是等待项目所有者明确授权V5失败诊断与修复；不得自动重训、重复推理、批量生成、建立候选、绑定Runtime或进入`/world`。

2026-07-22最新执行状态进一步覆盖上述历史门禁：项目所有者已授权并由正式控制器完成V6 stage 2原生`1024×768`正式渐进训练，runId=`ai-assisted-conditional-denoiser-v6-stage-2-2026-07-21T19-11-57-819Z`，checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`。Stage 2执行40轮，最佳epoch=36，最佳验证指标=`2.792788481960694`，耗时`323.927`秒；父checkpoint固定为Stage 1的`23593901bd7c9dff385a1c943867b0da1f990b6e8f1fa530359cf5da4062e921`且哈希复核一致。21套完整地图条件、23通道和challenge隔离未改变，challenge的`metricsReadDuringTraining=false`，未生成RGB。程序自动保存5个不可变产物、1个latest指针及2条中英文程序事件，并完成D盘SQLite哈希核验。Stage 2仍固定`formalInferenceEligible=false`。当前唯一下一动作是等待项目所有者单独授权一个V6 challenge split held-out单图验证；未获授权不得推理、生成RGB、候选、Runtime或`/world`，也不得重复Stage 2训练。

2026-07-22执行历史覆盖上一句“等待V6单图验证”的旧门禁：项目所有者以“继续”明确授权唯一`challenge`样本`complete-map-v2-014`的V6 held-out单图验证。正式程序生成runId=`ai-assisted-conditional-inference-validation-v6-2026-07-21T20-39-03-363Z`，绑定V6 Stage 2 checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，生成原生`1024×768`新图，图片SHA-256=`6ce37acc6278d5d7bbae6210e8273c634358fc1301936be9d394725fe2cf039e`。机器审核状态为`machine_rejected`：VJ-0、VJ-1通过，VJ-2以`condition_terrain_path_ground_coverage_mismatch`拒绝，Professional Aesthetic当前通过。程序已自动保存图片、23通道条件、checkpoint、seed、model-report、manifest、machine-review、双语过程事件和D盘SQLite索引，并由`auto-visual-judge-learning-2026-07-21T20-39-36-899Z`自动回写失败学习。该图固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，不得进入原图库、候选、Runtime或`/world`。该阶段当时的下一动作是等待项目所有者授权V6失败诊断与修复；该历史门禁现已由下一段覆盖。

2026-07-22最新执行状态覆盖上述“等待V6失败诊断”的历史门禁：项目所有者已授权V6失败诊断与修复。程序完成诊断runId=`ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z`，确认V6训练rollout和正式推理均从纯高斯噪声开始，不存在target图捷径；根因固定为训练/验证容量仅`16/2`、checkpoint只评估一个validation样本和一个seed、像素级指标不能可靠代表完整地图语义，以及Professional Aesthetic对单轴纹理异常存在诊断漏口。V7合同`all-validation-multiseed-semantic-rollout-unet-v7`已实现：全部validation样本、每样本至少2个seed、最差轨迹纳入checkpoint选择，并新增稀疏区域对比和`8×6`空间网格RGB约束；世界事实、世界导演、23通道身份、页面结构和既有审核拒绝门槛均未改变。最新纯CPU回归runId=`ai-assisted-conditional-v7-cpu-regression-2026-07-22T00-20-01-226Z`已验证2个validation样本、2个seed、4条完整轨迹及已批准容量合同；本轮没有GPU训练、没有推理、没有新RGB。

项目所有者于2026-07-22批准V7验证容量固定为128张独立完整地图，split固定为`96 train / 16 validation / 8 challenge / 8 regression`。旧21张条件绑定完整地图必须保留并进入身份、hash、世界事实和构图去重审计；当前另有3张已登记V7容量贡献，合计24张，正式缺口104张。128张不得通过复制、裁切、轻微变体、只换seed、旧图重绑或局部图充数；每张必须绑定独立完整地图级世界事实、世界导演、正式23通道、原生`1024×768` RGB、来源与许可、机器审核、项目所有者审核和自动存储证据。2026-07-23 的连续批次授权仅解除剩余104槽位逐张重复授权，不解除完整地图、去重、机器审核、人工审核、容量登记或训练门禁。V7 GPU训练仍未获得授权；128张不可变数据包建成并通过审计后，仍须项目所有者单独授权训练。

程序已于2026-07-23完成slot-003容量贡献登记后的重新审计，最新runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`。旧21条基线与3条已登记V7贡献全部通过原生分辨率、世界档案、完整地图范围、图片/记录/审核hash、机器审核、项目所有者审核、构图新颖性、世界事实身份和23通道审计，失败数为0；当前合格24条、正式缺口104条，剩余split为`77 train / 14 validation / 7 challenge / 6 regression`，最终合计严格为`96/16/8/8`。证据位于`.runtime/ai-painter/ai-assisted-v7-data-capacity-plans/ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z/`。该run生成图片0张、GPU训练0次、训练0次；覆盖矩阵完成不等于数据包完成或训练获批。

程序已于2026-07-22补齐`wet_to_dry_transition`与`dry_to_wet_transition`版本化环境快照，并通过NASA原始响应hash与四季入口检查；两份快照只是世界事实，不是RGB。`v7-capacity-slot-001`与`v7-capacity-slot-002`现均已完成任务、单图生成、机器审核、项目所有者审核和最终容量贡献登记，合法计入V7 train split各一条。下一任务尚未获得授权；不得自动准备或生成后续槽位，不得批量出图或启动GPU训练。

2026-07-22 21:33:24 +08:00 最新执行状态覆盖上一句“下一任务尚未获得授权”：项目所有者已明确授权准备`v7-capacity-slot-003`。第一次准备runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T12-38-25-200Z`因旱季配方未实现而在RGB前失败；项目所有者确认允许修复后，第二次准备runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-11-19-044Z`被完整地图范围门以`complete_map_route_overlaps_collision`阻断。两次失败均由程序保存`failure.json`、双时区时间、错误码和SQLite事件，且`imageGenerationStarted=false`、`gpuTrainingStarted=false`。程序随后在不改变世界档案、23通道和审核标准的前提下，把slot-003绑定至既有`dry_season`快照，并把道路调整为西南侧进入、经东偏不规则家园中心、从北侧既有大世界通道继续；世界事实不要求主要地表水体。成功任务runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-27-59-480Z`已通过独立检查：23通道、完整地图范围、32项SQLite artifact和1条中英文程序事件全部一致，`pairedRgbCount=0`。当前只等待项目所有者对slot-003唯一一张RGB的单独授权；不得自动出图、准备slot-004或启动V7 GPU训练。容量仍为23，正式缺口仍为105。

2026-07-23项目所有者授权在完整地图原图类型页加入单条“通过 / 拒绝”审核按钮。GET页面仍只读；按钮只向正式审核程序提交明确owner命令，业务文件和SQLite由程序自动写入。V7容量槽位通过后允许程序自动登记并检查容量贡献、重建和检查数据包、刷新128张容量审计；拒绝必须自动保存失败图引用、原因、下一训练目标、双时区时间、hash、不可变历史、双语事件和失败学习。该按钮不得自动生成下一张RGB、准备下一槽位、启动GPU训练、创建RuntimeFrame或进入`/world`。

2026-07-23 04:16:35 +08:00 最新执行状态覆盖上一句“等待slot-003单图授权”：项目所有者已明确授权并仅生成`v7-capacity-slot-003`唯一一张完整地图RGB。正式请求ID=`conditional-rgb-003-2026-07-22T20-03-44-163Z`，记录ID=`ai-cold-start-v7-v7-capacity-slot-003-lowland-evergreen-tropical-forest-v1`；唯一图像引用为当前任务语义条件引导图，历史完整地图RGB引用数为0。程序自动保存`1448×1086`源图SHA-256=`8182273c7f60a6445a2a7fafdef1f2b4c1ed085d00ae9d69aa6a1f102211a9b4`及nearest-neighbor `1024×768`训练派生图SHA-256=`3fb5be1a2ac39c5da46cb9c67516b0bd3712bfe1d66c6a13e215913c593217c4`，并完成任务、23通道、提示、来源许可、机器审核、双时区时间、hash和SQLite证据写入。当前请求状态=`generated_intaked_machine_passed_waiting_owner_review`、机器状态=`machine_contract_passed_waiting_owner_visual_review`、owner状态=`pending_review`，仍不得计入容量。当前唯一动作是项目所有者在页面审核该图；不得生成第二张、准备`slot-004`、启动V7 GPU训练、建立RuntimeFrame或进入`/world`。

2026-07-23 05:55:34 +08:00 最新授权覆盖上一句“停止等待下一任务”：项目所有者允许将剩余104张数据建设切换为连续批次模式。批次范围固定`slot-004...107`，严格单活动请求；程序自动准备、保存和机器审核，机器通过进入待人工审核队列，失败保存后继续下一槽。该授权不允许自动人工通过、自动容量登记、自动重试或V7 GPU训练。像素仍由批准的Codex内置生成通道提供，本地程序负责世界条件编排、接收、审核、存储与队列推进，不得把该阶段宣称为本地V7模型自主出图。

2026-07-24最新执行状态覆盖上述连续批次授权：项目所有者已经停止批量出图。变换重复审计runId=`ai-assisted-v7-transform-duplicate-audit-2026-07-23T21-57-30-763Z`确认17条镜像、旋转或共享构图骨架派生记录；重分类runId=`ai-assisted-v7-capacity-reclassification-2026-07-23T22-54-14-255Z`在不改写历史的前提下暂停其容量资格。最新容量计划runId=`ai-assisted-v7-data-capacity-plan-2026-07-23T23-02-25-228Z`确认可信26张、暂停17张、正式缺口102张。生成前范围门已经以`transform_derived_complete_map_skeleton_forbidden`阻断变换派生骨架。新增MVP事实参照固定为泰国Sakaerat / Wang Nam Khiao；历史事实锚点和旧连接蓝图继续作为不可变证据保留。

项目所有者于2026-07-24进一步批准`owner-approved-real-geography-naturalization-route-20260724`。新数据路线允许使用具有明确许可、版本和来源的真实地球高程、土地覆盖、气候与土壤测量数据派生自然世界事实和自然拓扑；这不等于复制外部RGB、地图瓦片视觉或现实导航地图。程序必须剔除建筑、城市、工程道路、耕地地块、行政/地籍边界和人工水体几何，并依据邻近自然地形、水文、土壤与生态证据完成自然化重建，再归一化到游戏世界坐标。原始测量、来源许可、采集时间、远端身份、hash、变换步骤、派生事实和失败记录必须由程序自动保存并进入SQLite。真实地理栅格分辨率不得被擅自解释为游戏米/像素；外部测量数据不得作为RGB训练原图或直接图片参考。当前只授权来源预检、数据采集、自然化世界事实、世界导演与23通道建设；任何RGB生成、GPU训练、正式候选、RuntimeFrame或`/world`仍需项目所有者单独授权。

2026-07-25最新真实地理首图审核状态覆盖此前“机器拒绝并等待修复授权”的历史门禁。程序在不修改世界事实、23通道、图像、审核阈值和风格标准的前提下，完成道路视觉误判诊断runId=`ai-assisted-cold-start-path-false-positive-diagnosis-2026-07-25T00-34-27-315Z`。根因是旧审核器把远离正式道路条件的旱季裸地暖色碎片一并计入道路中心；新版只保留与正式`terrain_path_ground`走廊连通或受其支持的8连通视觉分量。旧道路中心距离`0.3108`，同图新距离`0.0856`，被排除的非道路暖色像素为`27,182`；`thresholdsChanged=false`、`newRgbCreated=false`。

同一张SHA-256=`ac6778270a44d2379e1ea0c635041eb8685c0def7659ba8e7d3a6a73b1d29bb4`的`1024×768`派生图随后完成正式机器复审，runId=`ai-assisted-cold-start-review-ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1-2026-07-25T00-37-54-194Z`，状态=`machine_contract_passed_waiting_owner_visual_review`、问题数=0。旧拒绝记录、诊断记录和新通过记录均作为不可变历史保留。项目所有者此前对该图的明确“通过，完全可以”已由正式程序以命令引用`owner-approved-earth-reference-naturalized-complete-map-b3be6a28ffb6-20260725`写入，owner reviewId=`ai-cold-start-owner-review-ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1-2026-07-25T00-41-06-524Z`。当前训练资格=`ai_assisted_cold_start_eligible`、`formalConditionalTrainingEligible=true`、`independentTrainingEligible=false`，仍固定`formalCandidate=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。

程序已自动重建冷启动数据包`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-25T00-45-56-567Z`，共76条，其中完整地图/Autoencoder 72条、正式条件绑定43条，split=`53/7/6/6`，阻断项为空。该真实地理记录进入`validation`并只承担`rgb_autoencoder_warmup`；因尚无当前V7容量贡献身份，不得被冒充为V7正式容量。此次闭环没有生成新RGB、没有启动GPU训练、没有建立RuntimeFrame或进入`/world`。

真实地理测量窗口已由程序编译并通过离线检查。runId=`earth-geospatial-naturalization-2026-07-24T15-43-27-955Z`使用Sakaerat官方`7,808 ha`范围与4:3画布计算仅用于采样的观测包络；该包络约`10.20 × 7.65 km`，不定义运行时米/像素。程序缓存并哈希Copernicus DEM与ESA WorldCover源，裁取并归一化`1024×768`测量数组；高程为`248.0724–769.7570 m`，有效像素`786,432`，识别并自然化耕地/建成区像素`10,280`。首次调色板解析失败及后续成功运行均已自动保存，当前`imageGenerationStarted=false`、`gpuTrainingStarted=false`、`derivedWorldFactsCreated=false`。本段所列“尚未采集SoilGrids与尚未派生自然水文”的旧状态已由下一段覆盖。

2026-07-25 01:49:16 +08:00，程序完成SoilGrids测量和临时自然水文编译，最终runId=`earth-geospatial-soil-hydrology-2026-07-24T17-49-16-293Z`。四个`0-5cm / Q0.5`土壤窗口均来自SoilGrids WCS 2.0.1并保存原始GeoTIFF、许可、请求URL、字节数和SHA-256：黏土`19.7–37.2%`、均值`28.4045%`；砂土`30.1–39.5%`、均值`35.8619%`；pH`5.0–5.9`、均值`5.2482`；体积含水量`36.7–40.7%`、均值`39.4580%`。程序把已保存DEM聚合到`256×192`分析网格，执行Priority-Flood洼地填充、D8汇流和流量累积；最大汇流量`12,578`，临时排水像素`734`、占比`1.4933%`，边界出口`65`。该水文固定为`provisional_dem_derived_pending_engineered_linear_removal`，在工程线性设施移除证据完成前不得成为最终WorldFact。第一次runId=`earth-geospatial-soil-hydrology-2026-07-24T17-31-39-590Z`因`MinHeap`初始化顺序失败，后续无数据值统计修正和最终成功run均由程序保留为不可变历史并写入SQLite。当前只剩`engineered_linear_feature_removal_evidence_missing`、`derived_world_facts_missing`、`complete_map_23_channels_missing`三项阻断；本阶段仍为RGB 0张、GPU训练0次、WorldFacts 0套。

项目所有者授权的26图非正式工程预训练已经完成。数据包ID=`ai-assisted-v7-engineering-pretraining-trusted-26-2026-07-23T23-45-32-454Z`，manifest SHA-256=`06b706d208607cf74a6436f53b3f5b2ed395fdece6a3319dc9bb0f2b5fc46586`；训练runId=`ai-assisted-conditional-denoiser-v7-engineering-26-stage-0-2026-07-23T23-51-23-450Z`，6轮`256x192`工程训练最佳epoch=6、最佳验证指标=`3.538672380770246`、checkpoint SHA-256=`bc65e68936ce851142c94b2be65ced528f44a874361e39e02d31406c3419d382`。程序自动保存6个训练artifact、2条中英文事件和D盘SQLite索引；本轮生成RGB=0。该run固定`formalV7TrainingAuthorized=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，不能增加正式容量。未经项目所有者新的单独授权，不得执行held-out RGB验证、恢复批量出图、启动正式V7训练、建立候选、RuntimeFrame或进入`/world`。

2026-07-24最新自主性执行状态：程序已按`initial-natural-world-no-preset-home-site-v1`暂停旧工程包中24条含固定`home_center`或非零`focal_area`的后续训练资格，并以runId=`ai-assisted-v7-autonomy-rebuild-24-2026-07-24T03-24-05-684Z`建立`autonomous-world-rebuild-001...024`共24套无预设家园位置条件。24/24套23通道完整、`focal_area`全零、完整地图范围通过、配对RGB为0。构图审计runId=`ai-assisted-v7-autonomy-rebuild-condition-skeleton-audit-2026-07-24T03-33-33-443Z`完成276组原位及镜像/旋转比较，重复、强变换重复和关注组均为0。

项目所有者随后以`owner-authorized-autonomous-world-rebuild-001-single-rgb-20260724`只授权`autonomous-world-rebuild-001`唯一一张RGB。请求ID=`conditional-rgb-001-2026-07-24T04-29-42-877Z`；Codex内置生成仅调用一次，源图SHA-256=`db0c793ea93429d44ac913267be6a56409e620d309e922516a4687d52590eaba`，程序自动派生的`1024×768`图SHA-256=`fbe83fa149ded7d09da77b77bcf956caa86cc49c4142d1f0747fbfc49b032c0a`。首次接收失败已保留不可变记录和SQLite事件，修复授权识别后复用同一源图完成接收，没有重复生成。

项目所有者已于`2026-07-24T06:01:21.719Z / 2026-07-24T14:01:21+08:00`以`owner-approved-autonomous-world-rebuild-001-20260724`明确通过001。程序自动保存owner审核、不可变历史、原图索引、请求更新和SQLite事件；审核记录SHA-256=`064472a424b42524ec6c5d41466409ceb8baaabe0b104d49baea4eca0b0001c6`。当前请求=`generated_intaked_machine_passed_owner_approved`，训练资格=`ai_assisted_cold_start_eligible`；该图仍未取得正式容量、独立训练、正式候选、RuntimeFrame或`/world`资格。001闭环后必须停止；不得生成002、自动登记容量或启动GPU训练，任何后续动作仍需项目所有者单独授权。

2026-07-24 17:03:18 +08:00 最新执行状态覆盖上一句“不得生成002”的历史门禁：项目所有者已以`owner-authorized-autonomous-world-rebuild-002-single-rgb-20260724`单独授权并仅生成`autonomous-world-rebuild-002`唯一一张RGB。请求ID=`conditional-rgb-002-2026-07-24T08-09-32-109Z`，世界身份=`training-world:autonomous-complete-map-002:12a1ebb5d0eb`，景观=`seasonal-evergreen-semi-evergreen-forest`，季节=`wet_to_dry_transition`；正式23通道完整且`focal_area`全零，无主要水体事实、固定家园中心、活动中心、施工空地或历史完整地图RGB引用。Codex内置生成仅调用一次；程序自动保存`1448×1086`源图SHA-256=`415038107844f51c1ffc78534fca0669cf434199051b9dcd5e05fbbd1517de5b`和nearest-neighbor `1024×768`派生图SHA-256=`46ee59c59b5f99be083b9bf53de33fa3c5d3dccc87a060414bb709a362658dfe`，并完成来源、许可、双时区时间、hash、机器审核和SQLite证据写入。当前请求=`generated_intaked_machine_passed_waiting_owner_review`、机器状态=`machine_contract_passed_waiting_owner_visual_review`、owner状态=`pending_review`、训练资格=`false`。当前唯一动作是项目所有者在控制台页面审核002；不得生成003、自动重试、批量出图、自动登记容量、启动GPU训练、创建RuntimeFrame或进入`/world`。
