# 完整游戏世界生成当前执行指南

更新时间：2026-07-23 05:55:34 +08:00

状态：正式当前执行文档 / V7剩余104槽连续数据批次已授权 / 当前24张已登记 / 机器通过仅进入待人工审核 / V7 GPU训练未授权 / RuntimeFrame仍阻断

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 本文档用途

本文档是当前继续工作的唯一执行入口。

后续执行顺序必须先读本文档，再读被本文档引用的下级文档。旧计划、旧进度和旧 `live-world` 文档已经删除，不再保留平行入口。

### 1.1 2026-07-18 项目所有者硬停止令

当前所有未执行的自动或批量 RGB 生成立即停止。不得根据21套蓝图清单、历史“继续”命令、编号顺序或失败重试自行生成下一张图。

新图必须同时满足：

1. 当前任务在本文档中有明确身份和执行依据。
2. 项目所有者对本轮具体生成给出明确命令。
3. 生成前证据证明世界导演和23通道描述的是完整自然家园区域，而不是铺满画布的局部生态场景。
4. 构图表达整体入口/出口关系、家园中心、连续道路组织、多个可辨识空间或生态分区、自然边界和大世界连接语义。
5. 水体只根据当前世界事实出现；无水、少水、河流、池塘、湿地和洪泛状态不得被统一成“东南亚地图都围绕水体”。

只表现单一河段、单一道路、单一池塘、单一林间空地、单一材质范围或放大局部生态单元的结果固定属于 `local_scene_not_complete_map`。尺寸为 `1024×768`、23通道覆盖全画布或提示词包含“完整地图”，均不能改变该结论。此类图片只能保留为失败/审核证据，不得计入完整地图正样本。完整地图范围的机器判定尚未闭合前，程序状态固定为阻断；必须先向项目所有者说明，不能继续出图。

“冷启动基础完整地图原图 -> 版本化完整地图视觉标准”计算链和完整地图范围门禁已经实现。当前聚合标准身份固定为 `foundational-complete-map-visual-standard-b0ddc5c912439480`，来源为22张经项目所有者审核通过的基础完整地图；生成器只读取聚合数值、结构统计和文字契约，历史完整地图 RGB 引用数固定为0。项目所有者于2026-07-18命令不修补旧21套蓝图，保留全部旧批次为不可变历史，并使用全新标签整体重建。程序已按 `complete-map-scope-world-facts-v2` 生成 `complete-map-v2-001` 至 `complete-map-v2-021` 共21套全新世界事实、导演输出、任务包和23通道，当前通过21/21条件结构检查及21/21完整地图范围门；蓝图、任务包和条件包hash各自均为21个唯一值，`sourceBlueprintReuse=false`、`historicalBatchMutation=false`。生成前蓝图快照继续保留 `pairedRgbCount=0`，证明没有历史RGB回绑。2026-07-19项目所有者审核通过当前正式001 V2后，程序重建并检查不可变数据包，严格确认21/21后置RGB与当前正式v2条件完全同身份，未配对数为0。禁止回写蓝图快照或自动重绑旧RGB。

### 1.2 2026-07-19 条件配对严格复核

项目所有者已完成21张当前正式图片的逐图审核。当前正式条件身份配对为21/21，缺失数为0；旧图片、旧审核和此前阻断证据继续由程序保留，不得自动重绑。

程序已于2026-07-19 05:29:25 +08:00自动接收 `ai-cold-start-condition-pair-001-lowland-evergreen-tropical-forest-v2`，该图绑定当前正式任务包与23通道条件包并通过机器合同检查；项目所有者于2026-07-19 06:20:34 +08:00明确审核通过，程序已自动保存审核记录并同步生成请求。最新条件身份严格配对21/21、未配对0。项目所有者于2026-07-19批准三项门禁：21套作为第一轮AI辅助条件去噪训练数量门槛、Autoencoder v2重建达到继续条件、连接覆盖最低27条正样本与27条负样本且9个轴各不少于3条正样本和3条负样本。程序已自动保存并复核27正、27负连接记录，九轴全部达到3正+3负；最新AI辅助数据包状态为 `conditional_denoiser_training_ready`、`blockers=[]`。23通道条件去噪程序已经完成smoke及三个40轮渐进训练阶段；这只形成待验证的AI辅助条件checkpoint，正式独立训练、正式推理、RuntimeFrame晋级和 `/world` 发布仍保持阻断。

统一风格与构图多样性同时为硬要求：所有地图必须属于同一款高分辨率像素游戏，但河流、道路、区域组合、生态结构和整体构图必须由本轮世界事实、世界导演及23通道产生。只复用同一水体/道路模板、只改变植被或颜色，固定判定为构图雷同，不得计作新训练进度。

## 2. 当前结论

产品定位不得因当前任务而改变：AI-PET-WORLD 是像素风格自主世界游戏，本地小 AI 是游戏核心智能系统；当前正在实现的 AI Painter 只是一项视觉生产能力。当前完整地图工作只闭合“世界事实如何被表达为专业游戏画面”，不代表小 AI 的职责只有画图，也不允许视觉输出取代世界 Runtime、世界导演、状态推理、角色自主或长期演化。

当前系统已经补上唯一编排入口、严格样本登记与不可变数据包、结构化数据审计、VisualFactManifest、动态完整世界视觉任务包、23 通道视觉条件编译器和项目自有完整地图模型架构。第三方 SD/ControlNet 已从正式主流程隔离。AI 辅助冷启动不可变数据包、审核器、项目自有 Autoencoder v2和23通道条件去噪训练入口已经实现；这些入口不加载第三方权重，但必须声明 OpenAI 生成数据依赖。首张隔离 V2 验证 `complete-map-v2-014` 已生成并被机器拒绝；程序保存图像、条件、checkpoint、审核hash、失败码和失败学习。数值诊断确认旧链路存在潜空间尺度不一致、epsilon 高时间步放大和浅层去噪器能力不足。项目所有者授权后，程序建立 `normalized-latent-v-prediction-multiscale-unet-v3`：复用 Autoencoder v2，加入训练集逐通道潜变量归一化、velocity 预测、多尺度23通道U-Net、固定时间步验证和最佳checkpoint选择，并重新完成 `256×192 -> 512×384 -> 1024×768` 三阶段训练。V3 无 RGB 诊断把采样解码饱和比例从 V2 的 `12.493%` 降至 `1.1945%`，只证明数值爆炸修复。项目所有者随后明确授权 `complete-map-v2-014` 的 V3 held-out 单图验证；程序于 `2026-07-19 22:37:10 +08:00` 生成并自动保存原生 `1024×768` 验证图、23通道、checkpoint、seed、图片hash、机器审核和失败学习。该图呈现高频噪声和纹理层级坍缩，机器当时只以 `condition_terrain_path_ground_coverage_mismatch` 拒绝，且错误放行VJ-1与Professional Aesthetic，证明模型训练目标和专业审美门禁同时存在缺口。该V3验证固定为失败历史，不得晋级、覆盖或重写成通过。

项目所有者于2026-07-20授权建立V4修复，范围固定为分类型条件缩放、复合训练目标、复合checkpoint选择和基于owner已批准完整地图校准的专业审美门禁。stage 0冒烟与stage 0至stage 2正式渐进训练均已完成并自动保存，stage 2 checkpoint SHA-256=`a3a5bdb608091bbdec5e65160758b8f35ca752adeb647487a013ba6df4c11a04`。项目所有者于2026-07-21授权`complete-map-v2-005`单张held-out验证。首次执行因采样器未承认已批准D盘热运行根而在生成前失败并自动留证；修复该存储路径合同后，同一任务生成原生`1024×768`新图，runId=`ai-assisted-conditional-inference-validation-v4-2026-07-20T20-31-54-134Z`，图片SHA-256=`418fbe777eb40c2b685b8cf10e38717c1998a8d92630717586c7542e274bea0e`。机器审核拒绝并检出水体意外信号、道路覆盖错配、多尺度纹理噪声过载和安静区域缺失。该结果证明V4训练执行闭合，但视觉能力仍失败；不得继续自动推理或声称成功。

项目所有者于2026-07-21授权诊断并修复上述四项失败，同时要求诊断、根因、修复前后差异、算法hash、检查结果、失败码和证据路径由程序详细保存。程序自动写入V4诊断runId=`ai-assisted-conditional-v4-diagnosis-2026-07-20T21-59-47-587Z`。根因固定为：V4条件重建头读取已经混合23通道的内部特征，能够在最终`predicted_clean`和RGB未遵守条件时仍取得较低条件重建损失；V4 checkpoint选择只评估teacher-forced单步恢复，未直接约束完整采样的多尺度纹理层级与安静区域；训练集仅16张且随机时间步不能保证每轮覆盖扩散首尾。V5代码合同已建立为`output-bound-condition-hierarchy-multiscale-unet-v5`：条件重建改为绑定最终预测clean latent，增加多尺度latent gradient、Laplacian、quiet-region excess以及离散/连续输出绑定损失；每轮时间步改为确定性分层轮换；checkpoint选择改为固定网格输出绑定层级分数；最终held-out推理split锁定为`challenge`。纯CPU回归runId=`ai-assisted-conditional-v5-cpu-regression-2026-07-20T22-36-42-387Z`已通过13项检查。V5 stage 0冒烟runId=`ai-assisted-conditional-denoiser-v5-smoke-2026-07-20T23-03-42-768Z`已经通过，冒烟产物漏索引也由保留证据的无训练修复run闭合。项目所有者随后单独授权V5 stage 0正式渐进训练；程序完成runId=`ai-assisted-conditional-denoiser-v5-stage-0-2026-07-20T23-58-58-343Z`，真实读取21套条件配对和23通道，在CUDA上完成`256×192`阶段40轮，最佳轮次31、最佳验证指标`1.7963923315207164`、持续85.306秒，checkpoint SHA-256=`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`。程序自动保存双语事件、双时区时间、逐轮指标、manifest、progress、条件证据、算法证据和checkpoint；D盘SQLite已验证6个artifact与2个双语事件，实际文件hash和字节数一致。本轮固定`denoiserTrained=true`、`formalInferenceEligible=false`且没有生成RGB；不得声称视觉能力已经修复。V5 stage 1、stage 2和新图推理仍未授权。

上段最后一句只记录当时的历史门禁。当前V5 stage 1与stage 2均已由项目所有者分别授权并完成，最新状态只以第7.2节和第10节为准。

项目所有者已批准修复首轮 Autoencoder 细节损失问题。v2 已完成版本化代码、新不可变数据包和 `256×192 -> 512×384 -> 1024×768` 三级渐进训练：潜空间由 `1/8、4 通道` 调整为 `1/4、12 通道`，加入项目自有残差块和像素/边缘/Laplacian 损失；v1 训练与证据全部保留。程序对 6 张验证/挑战/回归证据执行统一 v1/v2 审计，v2 RGB、边缘和高频误差分别降低约 `58.19%`、`54.58%`、`48.79%`，PSNR 提升约 `8.39 dB`。项目所有者已批准v2作为后续训练初始化继续使用；该批准不等于正式推理通过。

当前数据路线已经统一澄清：原图库五类目录是并行视觉知识分类，不是五阶段流水线、五个独立模型或程序拼图目录。完整地图正样本、地形、植物、自然物品和过渡/接地数据必须并行进入统一审核、Registry 和不可变完整世界数据包；正式推理只有一条完整世界主入口。20 张完整地图正样本只是其中一个最低门槛，不能替代其他分类数据。

当前地图同时被定义为未来类地球大世界的第一个连接区域，不是彼此孤立的概念图。大世界连接原则已写入 `natural-home-large-world-connectivity-v1`。项目所有者已命令按真实地球实际情况定义连接，程序据东南亚热带季风档案、NASA 参数快照、湄公河委员会水文/地理事实和当前自有地图坐标登记 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`。项目所有者已授权 Runtime 世界事实迁移并审核通过迁移结果，程序已生成 tick 3；连接覆盖门槛已批准并由程序完成27正、27负、九轴各3正+3负的结构化监督证据。

2026-07-13 项目所有者已将第一版正式视觉路线锁定为 2D 高分辨率像素风完整地图：模型原生画布 `1024×768`，正式候选必须覆盖完整地图并绑定当前任务包。训练允许使用 `256×192 -> 512×384 -> 1024×768` 渐进分辨率降低冷启动成本，但最终生成、机器审核、owner 审核和 Runtime 只认原生 `1024×768`；禁止把低分辨率输出放大、拼接或伪装成正式候选。

分辨率口径不得再次分叉：五类原图库中的完整地图 RGB、正式 target、正式候选、审核输入和 Runtime 图全部使用原生 `1024×768`；渐进训练只改变模型内部训练阶段，不改变数据身份和最终输出资格。画法/生成算法固定指“当前世界任务包与23通道条件如何进入本地模型并生成新像素”；风格契约固定指“这些像素如何保持统一视角、尺度、对象比例、像素纹理、轮廓、光照、接地、遮挡和游戏可读性”。同一算法不自动保证风格统一，同一风格也不能替代世界事实和结构条件。

MVP 生态身份已经由项目所有者确认迁移为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`，区域基准为东南亚大陆热带季风低地、河谷和丘陵生态参照包络，第一版采用现实地球物种。长期仍按 `playerId -> worldId -> worldSeed -> worldProfileId` 生成不同玩家世界。12 个第一版物种、20 类区域及 390 个植物视觉覆盖单元已经写入机器可读档案、目录和覆盖蓝图。第一轮暂用雨季、当地上午 10:00、雨后转晴、温暖湿润柔和日光和湿润地表快照，气候基线已经绑定 NASA POWER 2001–2020 版本化参数快照；视觉快照仍固定标记为 `isFinal=false`，表示光照和画面状态可继续由项目所有者调整。当前历史 WorldState 和最新任务包仍含旧值 `oasis` 或旧温带档案；在正式世界生成/迁移修正前，这些旧值不得作为当前原图生产事实。

同一地区的完整地图不得退化为单一“河流＋小路＋树林”构图。第一版已经在覆盖蓝图中锁定 20 类真实区域，包括低地热带常绿林、季节性常绿/半常绿林、湿润落叶柚木林、旱季疏林、竹林、河岸林、季风草地、洪泛地、淡水沼泽、芦苇湿地、山溪、石灰岩丘陵和森林低山。后续概念确认、原图接收和挑战集必须覆盖不同区域类型，同时保持当前热带季风物种、气候和正式像素画风一致。雪、冰川、高山苔原、荒漠、寒温带白桦/针叶林身份不属于本档案；红树林等海岸生态需另建子档案并经项目所有者批准。

当前主入口检查结果：

```text
npm run check:complete-game-world
```

当前状态：

```text
status = blocked
canEnterWorld = false
blockers = owner_review_missing_identity, formal_gate_missing,
           data_gap_insufficient,
           ai_assisted_v7_training_blocked_pending_approved_128_dataset_implementation
```

含义：

1. 当前 tick 3 RuntimeFrame 没有正式图片身份和 FormalVisualJudge 报告，不能进入 `/world`；历史被人工拒绝的 RuntimeFrame 继续以 `owner_review_rejected` 失败码保留为证据，但该历史码不是 tick 3 的当前身份状态。
2. 严格审计除原有图片、hash、标签、审核和字典版本外，还要求 `independentTrainingEligible=true`、`strict-project-owned-training-data-v1` IP 谱系以及无上游生成权重/输出依赖。当前独立自研口径下所有样本计数均为 0；原有 17 条登记、16 条感知去重负样本只作历史证据。
3. FormalVisualJudge 通过只代表机器规则曾经通过，不代表最终游戏地图通过。
4. AI Painter 当前图片 API 不允许再直接展示被拒绝 RuntimeFrame。
5. 最新旧材料归档仍绑定字典 `mvp-natural-home-v0.1`；持久化检查把它保留为历史警告并单独校验当前 `mvp-natural-home-v0.3` 完整地图证据，旧归档不能冒充当前训练数据，但不再导致架构检查误失败。
6. 历史 SD 1.5/ControlNet bootstrap 曾自动生成、审核和保存失败图；这些结果已固定为历史对照，不再由正式主入口执行。
7. 项目自有模型架构已建立：23 通道条件编码器、项目自有潜空间自编码器和条件去噪器；配置固定自主初始化且上游模型列表为空。
8. 正式推理入口已实现权属门禁：没有 `project_owned_independent_weights` checkpoint 时自动保存阻断记录，绝不会加载第三方权重或用随机图冒充候选。
9. 历史 foundation v10 的失败已证明：通用第三方生成先验无法替代项目自有世界视觉逻辑；该结论只作架构反例保留。
10. 本地 LAION CLIP 仅作为视觉语义初审，能够辅助区分可游玩地图与概念插画，但不能代替 VJ-1、VJ-2 或项目所有者终审；本轮实验证明 CLIP 可能放过肉眼仍不专业的候选。
11. ADE20K/SceneParse150 条件类别已经按 ControlNet 官方类别表修正；水体、石头和道路曾存在颜色类别错位。当前道路改用 `dirt track`，水体越界审核只统计水体 Mask 之外的区域，注册请求归档不再被误报为无效正式样本。
12. 旧东亚温带概念图片、7 条旧原图库记录及其来源副本已按项目所有者命令删除，旧档案当前记录数为 0。当前热带季风原图库已有经项目所有者审核通过的 AI 辅助冷启动记录，覆盖完整地图和并行视觉知识分类；它们固定为 `aiAssistedColdStartEligible=true`、`independentTrainingEligible=false`，因此当前独立训练合格记录仍为 0。实时数量和分类统计只以 `data/world-samples/original-image-library/natural-home-v1/index.json` 与 `check:original-image-library` 为准，不在执行文档中维护易过期的实时计数。旧物种和快照 JSON 只作迁移说明，程序不得恢复旧图片记录或计入当前热带季风档案。
13. 当前热带季风档案已绑定 `mainland-southeast-asia-reference-v1` 地球参数快照：NASA POWER API v2.9.7、MERRA-2/POWER、2001–2020 气候平均、代表点 `15.5°N, 105.5°E`。原始响应、请求 URL、获取时间和 SHA-256 已保存并由原图库检查器验证。
14. 项目所有者已授权 AI 辅助冷启动训练数据。OpenAI 生成图只有在保存完整来源与提示词、通过机器审核和 owner 审核后，才能进入 `aiAssistedColdStartEligible` 数据；它们永远不计为 `independentTrainingEligible`，对应 checkpoint 必须保存 AI 数据依赖。
15. 大世界连接机器契约 `natural-home-large-world-connectivity-v1` 已建立；程序已自动保存候选，并在项目所有者“使用真实地球实际情况”的命令下登记第一版连接蓝图。当前家园为河岸热带森林区域，北接上游河谷、南接下游洪泛地、东接对岸河岸区域；水流北入南出，道路从南侧接入，西侧保留自然边界。项目所有者授权后，程序已从 tick 1 迁移到 tick 2，写入区域身份、3 个邻居、4 个当前区域连接口、道路延伸和水文/可走图；项目所有者审核通过后，程序在不改变连接几何、不生成图片的前提下写入 tick 3、审核命令、时间、hash 和独立审核记录。
16. 项目所有者已授权训练专用条件世界事实建设。2026-07-17的旧21套世界事实蓝图、导演输出、任务包、23通道和后续RGB审核链全部保留为历史证据；其中002 V4、005 V2和006 V5曾形成3套历史条件配对，但不得自动重绑到2026-07-18的v2全新条件身份。条件配对数量门槛仍未获项目所有者批准，因此不能开始条件去噪训练。
17. 首张条件后置 RGB 的失败已证明旧机器契约不足。程序已补入结构语义、构图重复和风格指纹门禁，并自动保存原图库审核历史、统一事件总账、失败码、受影响区域和下一训练目标。被项目所有者拒绝的图片固定 `owner_rejected`，不得进入正样本或条件训练。
18. 第004号 V1 因构图命中已被项目所有者拒绝的第002号 V1，被项目所有者拒绝并由机器审核 v6 复审为 `historical_rejected_composition_duplicate`。该记录、图、双时区时间戳、失败码、相似度指标和失败学习均已由程序保存；004 不得自动重试。
19. 第005号 V1 在生成前发现道路与顶部碰撞边界重叠2563像素，程序已保存无图失败记录。项目所有者授权后，蓝图生成器建立顶部道路通行口并重建21套世界事实；005 V2 的23通道检查结果为道路/水体重叠0、道路/碰撞重叠0，且请求只把当前条件引导图作为唯一图像参考。项目所有者已于 2026-07-16 明确通过005 V2；程序完成机器复审、风格校准证据、owner审核、双时区时间戳和总账保存，并将其固定标记为 `自主生成训练原图第001张`。005 已闭合，不得自动创建 V3。
20. 第006号首次请求在生成前发现晚旱季事实与固定“雨季雨后/湿润地表”请求文字冲突，程序已保存 `generation_request_environment_context_conflict` 无图失败记录。项目所有者于 2026-07-17 授权统一修复；程序建立 `world-visual-environment-context-v1`，以同一对象贯穿21套世界事实、导演、任务包和请求编译器。新批次483个条件通道图片哈希与前批次完全一致，只补环境元数据和动态请求语义；后续地图不得新增逐图算法或硬编码季节。
21. 第006号 V2 已按统一环境上下文生成新的高分辨率精确4:3原始图，程序自动保存原图、1024×768训练派生图、请求、hash、双时区时间戳、机器审核和总账。机器审核结果为 `machine_rejected`：重复构图检查通过；无水体检查通过；失败项为 `style_fingerprint_outside_approved_envelope`、`condition_terrain_path_ground_spatial_distribution_mismatch` 和 `condition_terrain_path_ground_coverage_mismatch`。该图固定为失败记录，`conditionalTrainingEligible=false`，未进入项目所有者审核、训练集、Runtime 或 `/world`。不得把失败改写成通过，也不得在没有项目所有者新授权和非空重试原因时自动创建006 V3。
22. 项目所有者于 2026-07-17 命令继续006。统一请求编译器新增对 `coverage-blueprint.json` 区域生态档案的读取，所有后续条件共用同一 `dynamic_blueprint_director_environment_context_landscape_profile_plus_text_only_style_fingerprint_v5`，不得建立逐图算法。006 V3 已由程序自动保存并被机器拒绝：无水体与构图非重复检查通过；风格距离从V2的 `3.263124` 改善到 `2.138502`，但仍高于批准包络 `1.267636`；道路审核仍将大面积金黄色旱季草地误识别为道路，报告 `actualSignalRatio=0.814`，而条件道路占比为 `0.0617`。V3固定为失败记录，不进入训练。当前发现审核器 `classifyPath` 的通用暖色阈值与旱季草层发生系统冲突；修改道路识别算法属于审核算法调整，必须先获得项目所有者授权，不能通过降低门槛或改写失败记录处理。
23. 项目所有者已授权修复道路识别审核算法。程序实现 `season_aware_local_color_signal_plus_8x6_spatial_mass_and_centroid_v2`：雨季和转换季保留既有暖土道路分类，旱季自动使用红棕土路与金黄草层分离分类；选择依据只读取记录的 `classification.monsoonSeason`。空间交集、覆盖比例、质心和风格门槛均未改变。回归结果固定为：001 V2与005 V2继续通过，002 V1继续失败，006 V2继续失败，006 V3道路审核从失败变为通过；程序重审V3并自动保存旧、新两版机器审核历史和总账。V3当前唯一失败码为 `style_fingerprint_outside_approved_envelope`，仍不具备训练资格。
24. 项目所有者于 2026-07-17 授权006 V4。统一请求编译器升级为 `dynamic_blueprint_director_environment_context_landscape_profile_plus_machine_style_fingerprint_text_profile_v6`，从持久化机器风格指纹自动提取明度、饱和度、边缘密度和块级纹理目标并写入文字请求；仍不读取任何历史完整地图 RGB。V4 使用与V3完全相同的世界事实、导演、23通道、环境上下文和区域生态档案生成，程序自动保存原始图、1024×768派生图、双时区时间戳、双hash、请求、机器审核和总账。机器结果为：风格距离 `1.005644`，低于批准包络 `1.267636`，风格门禁首次通过；无水体和构图非重复检查通过；道路质心与空间位置通过，但实际道路信号占比仅 `0.0013`，相对条件道路占比 `0.0617` 的覆盖比例为 `0.0212`，因此以 `condition_terrain_path_ground_coverage_mismatch` 拒绝。V4固定为失败记录，不进入训练、Runtime或 `/world`；未经项目所有者新的明确授权和非空原因不得创建V5。
25. 项目所有者已授权006 V5只修复道路与旱季草层的视觉分离和连续覆盖。统一请求编译器升级为 `dynamic_blueprint_director_environment_context_route_profile_plus_machine_style_fingerprint_text_profile_v7`，从23通道 `terrain_path_ground` 自动读取 `expectedNonZeroRatio=0.061745` 和通道hash，并把项目所有者授权的非空重试原因保存为 `owner-authorized-conditional-rgb-retry-repair-v1`；该修复不能改变世界事实、条件几何或审核门槛。V5由程序自动保存并通过全部机器审核：风格距离 `0.976893 < 1.267636`；无水体和构图非重复通过；道路实际信号占比 `0.0670`、覆盖比例 `1.0858`、空间交集 `0.6385`、质心距离 `0.0628`，均在原门槛内。当前状态固定为 `machine_contract_passed_waiting_owner_visual_review`，`conditionalTrainingEligible=false`；必须等待项目所有者单图人工审核，不得自动批准、训练、进入Runtime或继续创建006 V6。
26. 项目所有者于 2026-07-17 16:47:39 +08:00 明确通过006 V5并命令进入条件配对数据。程序自动写入 `owner_approved`、审核命令引用、图片hash、双时区时间戳、条件资格和总账；条件绑定状态为 `formal_conditional_training_eligible_owner_approved`，`formalConditionalTrainingEligible=true`，但 `independentTrainingEligible=false`且仍禁止直接进入Runtime或 `/world`。程序重建AI辅助不可变数据包 `natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-17T08-51-45-602Z`，检查通过；当前条件绑定完整地图共3条。条件去噪训练仍被剩余条件蓝图、未批准的条件训练数量门槛和世界连接覆盖门槛阻断，不得将本次入库误报为已可开始完整条件训练。

27. 项目所有者于2026-07-17命令不重复地完成21套蓝图首轮执行。程序先修正请求编译器中遗留的006旱季疏林硬编码，统一契约升级为 `dynamic_blueprint_director_environment_context_route_profile_plus_machine_style_fingerprint_text_profile_v8`；生态身份、地表湿度、道路材质和调色语义改为从当前蓝图动态编译，世界事实、23通道和审核门槛未改变。21套首轮执行已全部有结果：002 V4、005 V2、006 V5为3条正式配对；013 V1、015 V1、018 V1、022 V1通过机器审核并等待项目所有者单图审核；007 V2和016 V1在生成后被机器拒绝；008–012、014、017、019–021因道路通道与水体或碰撞通道重叠而在生成前阻断。所有生成图、无图失败、请求、双时区时间戳、hash、审核与总账均由程序自动保存。对于被通道冲突阻断的蓝图，修复必然改变世界事实或23通道几何，必须在获得项目所有者专门授权后执行，不得用放宽门槛或绘图掩盖。

28. 2026-07-18 完成版本化基础完整地图视觉标准与完整地图范围门禁。程序从22张 owner approved、`complete-natural-home-map`、1024×768基础图计算内容寻址聚合标准，检查结果为 `sourceRecordCount=22`、`historicalCompleteMapRgbReferenceCount=0`、`generatorProfileContainsHistoricalImagePath=false`。统一请求契约升级为 `dynamic_complete_map_scope_plus_foundational_visual_standard_plus_world_facts_director_23_channels_v9`，生成器只能使用本轮条件引导图、聚合视觉标准、当前世界事实、世界导演和23通道。范围门禁要求边界入口/出口、家园中心、连续道路、多个可辨识空间、自然边界及大世界连接证据，并在像素生成前运行。历史旧批次21套蓝图中17套通过结构门禁，010、017、019、021以 `local_scene_not_complete_map` 阻断，原因均包含缺少道路边界连接；该历史结论已由下列第29项全新批次取代。门禁通过不等于允许生成；未取得具体单图命令时 `computeStarted=false`。

29. 项目所有者于2026-07-18命令停止修补旧21套蓝图，保留旧批次为不可变历史，并以全新标签整体重建。程序按 `complete-map-scope-world-facts-v2` 生成严格连续的 `complete-map-v2-001...021`，每套重新保存世界事实、导演输出、任务包、23通道、独立hash和检查报告；当前21/21条件结构检查通过、21/21完整地图范围门通过，道路与水体/碰撞重叠均为0。生成前蓝图快照固定 `pairedRgbCount=0`，不得把旧RGB重新绑定。项目所有者于2026-07-19审核通过绑定当前正式 `2026-07-17T22-35-10-903Z` 条件版本的001 V2后，严格数据包确认21/21当前v2配对，未配对数为0；旧001及其较早条件版本继续作为历史保存。

## 3. 唯一主入口

完整游戏世界生成编排的唯一入口是：

```text
npm run run:complete-game-world
```

检查版入口是：

```text
npm run check:complete-game-world
```

只打印执行计划、不写业务数据的入口是：

```text
npm run plan:complete-game-world
```

`run` 执行当前允许的写入和检查；`check` 只执行只读检查；`plan` 只打印步骤。主流程依次建立独立数据审计、VisualFactManifest、世界导演输出、完整视觉任务包、23 通道条件包、自有模型权属检查和正式推理。主入口不再调用第三方 bootstrap；在自有 checkpoint 完成前必须返回阻断。

材料槽、局部训练、v46/v50/v52 等脚本只能作为从属步骤，不能作为完整游戏世界主入口。旧 5×5 Chunk、P10-P17、管家和生态路线的 npm 命令已统一返回 `retired_live_world_command_blocked`，历史文件仅作证据保存。

## 4. 正式文档层级

当前正式文档根目录：

```text
docs/game-world-generation/
```

当前执行入口：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

正式下级规格只保留以下 3 份。后续智能体不得再从阶段性文档自行拼装路线：

| 层级 | 文档 | 用途 |
|---|---|---|
| AI Painter 实现 | `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | VisualFactManifest、世界导演、条件编译、多尺度能力、完整地图推理和验证体系 |
| 训练数据与来源 | `TRAINING_DATA_AND_SOURCE_POLICY.md` | 样本来源、Schema、数据包、严格计数、自动保存和数据库迁移 |
| 审核与自动化 | `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 审核门、失败回写、自主循环、实时状态、控制台和存储 |

`docs/world-visual-data-dictionary/` 是机器参考。默认只读 `README.md`、`data/world-visual-data-dictionary/latest.json` 和当前任务明确涉及的条目，禁止全量读取后自由组合新路线。

## 5. 当前已处理的问题

| 编号 | 问题 | 当前处理状态 | 证据 |
|---|---|---|---|
| P0 | 没有唯一完整游戏世界生成编排入口 | 已处理；主入口已改为自有权重正式路线 | `npm run run:complete-game-world` 不再调用第三方 bootstrap，没有自有 checkpoint 时自动阻断和保存原因 |
| P0 | 模型训练架构未对齐 | 检查方式已处理，能力仍未完全对齐 | `npm run check:ai-painter-model-training-alignment` 现在核验真实命令、代码和产物，并因完整视觉推理缺失而正确失败；失败学习消费端已经实现 |
| P1 | 控制台状态会误报通过 | 已处理 | 控制台 API 读取 owner review，拒绝时不再 ready |
| P1 | AI Painter 图片 API 展示被拒绝 RuntimeFrame | 已处理 | 被拒绝图返回 404 |
| P1 | FormalVisualJudge 不够专业 | 已处理第一轮 | 增加灰绿伪装补丁等阻断 |
| P1 | 文档承认数据不够 | 已处理为硬阻断 | `data_gap_insufficient` 阻断主入口 |
| P2 | 文档治理混乱 | 已处理 | `docs/DOCUMENT_AUTHORITY_INDEX.md` 已建立，旧根计划、旧进度和旧 live-world 文档已删除 |
| P1 | 旧 live-world HTTP 控制入口仍开放 | 已处理 | 旧候选和图片 API 返回 410，不再参与当前控制面 |
| P1 | 旧 live-world npm 命令仍可执行 | 已处理 | 41 个旧 5×5/P10-P17/管家/生态命令统一返回 `retired_live_world_command_blocked` |
| P1 | 数据审计按文件数或历史模型产物虚增样本 | 已处理 | 除原有证据检查外，必须显式通过独立训练资格；当前正式计数全部为 0 |
| P1 | 世界视觉任务写死场景字段并混入后置事实 | 已处理 | `VisualFactManifest` 先筛选当前可见事实，导演字段由当前结构动态推导 |
| P1 | `check` 实际执行写操作 | 已处理 | `check` 只读、`plan` 只打印、`run` 才执行当前允许写入 |
| P0 | 任务包没有进入模型可消费条件 | 自有模型架构已对齐 23 通道，训练与 checkpoint 仍阻断 | `ProjectOwnedConditionEncoder` 固定接受 23 通道；没有自有 checkpoint 时不生成 RGB |
| P0 | 正式模型权属未锁定 | 已处理架构和门禁 | 配置固定 `project_owned_independent_weights`、自主初始化、空上游模型列表；第三方历史清单固定 `formalRouteAllowed=false` |
| P1 | 新完整地图失败被旧局部材料记录压住 | 已处理 | 自动学习器优先输出 `complete_map_machine_review` 失败约束，旧材料失败只作次级历史证据 |
| P1 | 机器失败图无法进入负样本闭环 | 已处理 | `npm run register:current-bootstrap-machine-negative` 自动登记机器负样本，不伪造 owner rejection |
| P1 | 仅按 SHA-256 去重会累计噪声变体 | 已处理 | 正式登记器增加感知差异 hash；近重复候选保存推理/审核，但不重复增加样本计数 |
| P0 | 没有统一合法样本入口和不可变数据包 | 程序能力已处理，真实样本仍为 0 | 登记器自动留存图片、hash、IP权属、许可、审核、标签和 split；数据包自动快照字典、任务、导演、条件、审核规则和审计 |

## 6. 当前未完成问题与程序证据

本节只记录当前程序门禁，不把“程序能力已实现”误写成“模型能力已成功”。当前条件 RGB 顺序证据更新于 `2026-07-17 01:09:21 +08:00`，来源包括 AI 辅助数据包检查、条件语义对齐检查、自动保存检查、条件编号防重复检查和构图重复回归检查。

| 优先级 | 未完成项 | 当前程序证据 | 固定处理 |
|---|---|---|---|
| P0 | 独立训练数据缺口 | `independentEligibleCount=0`，正式数据包 `sampleCount=0` | 保持 `data_gap_insufficient`，不得启动正式训练 |
| 历史闭合 | V3 AI辅助条件 checkpoint | V3 最终1024 checkpoint已保存，hash=`684ecc29c74408038539c8f3fd62b3272611a0bd0e5ddd4ef3931ae16668659b`；held-out视觉验证已失败，仍为AI辅助谱系且`formalInferenceEligible=false` | 固定保留为失败验证历史；不得作为V4父checkpoint或冒充正式成功 |
| 已闭合 | v2当前条件配对 | 当前21张新RGB均已自动保存、通过机器合同检查并取得owner approval；严格数据包确认21/21 | 保留审核和数据包证据，不得重绑历史RGB |
| 已闭合 | Autoencoder v2人工视觉继续条件 | 统一6图审计显示 v2 明显优于 v1；项目所有者已批准作为后续训练初始化继续使用 | 不得把继续条件解释成正式推理通过 |
| 已闭合 | 大世界连接覆盖 | 程序自动保存并复核27正、27负；9个连接轴全部达到3正+3负 | 不得修改批准门槛或用RGB视觉替代结构化连接证据 |
| 已闭合 | AI辅助条件去噪训练程序 | `train:ai-assisted-conditional-denoiser -- --smoke-test --resolution-stage 0` 已真实读取21套配对和23通道，完成加噪、噪声预测、反向传播与自动证据保存 | 保留程序与冒烟证据；不得将冒烟checkpoint冒充完整训练或正式推理checkpoint |
| 已闭合 | AI辅助条件去噪器三级渐进训练 | 256×192、512×384、1024×768各完成40轮，父checkpoint血缘和自动证据有效 | 保留全部阶段checkpoint；不得将待验证checkpoint冒充正式推理成功 |
| 已闭合为失败 | V3 held-out视觉推理验证 | `ai-assisted-conditional-inference-validation-2026-07-19T14-37-10-137Z` 已生成并保存；图片hash=`c861188b4f92f7f003f36bba18dd4de78305ef9761fe787e694ee33243834b2f`，机器以道路覆盖错配拒绝；视觉复核还确认高频噪声、安静区域缺失和层级坍缩 | 保留全部图片、算法、条件、审核和失败学习；禁止继续V3训练或把机器漏判解释成通过 |
| 已闭合为失败 | V4 held-out视觉推理验证失败 | `complete-map-v2-005`验证runId=`ai-assisted-conditional-inference-validation-v4-2026-07-20T20-31-54-134Z`已生成并自动保存；图片SHA-256=`418fbe777eb40c2b685b8cf10e38717c1998a8d92630717586c7542e274bea0e`；VJ-2与Professional Aesthetic共检出4项失败 | 保留图像、条件、checkpoint、算法hash、机器审核与程序事件；禁止V4重试或进入候选、Runtime、`/world` |
| 已闭合为失败 | V6单张challenge验证与诊断 | 验证runId=`ai-assisted-conditional-inference-validation-v6-2026-07-21T20-39-03-363Z`被VJ-2拒绝；诊断runId=`ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z`已保存根因 | V6不得重试；V7修复已完成CPU回归，但训练仍阻断 |
| P0 | V7批准的128张数据包尚未建成 | 程序已审计旧21条基线与3条V7贡献合计24/24条合格；正式缺口104条；剩余槽位连续数据批次已授权 | 程序严格串行建设104槽；机器通过进入待审队列，人工通过后才登记容量；数据包完成后仍需单独授权V7训练 |
| P0 | 当前 RuntimeFrame 缺少正式图片身份 | tick 3 RuntimeFrame 的 `imageSha256=null`，`canShowInWorld=false` | 只有正式模型新候选完成全部审核后才能绑定 |
| P1 | FormalVisualJudge 专业审美能力仍需持续验证 | Professional Aesthetic v2已在V4新图上正确拦截多尺度纹理噪声过载和安静区域缺失；VJ-2同时检出水体意外信号与道路覆盖错配 | 保留本轮门禁证据；未来每次漏判仍必须保存judge-gap，owner终审不变 |
| P1 | 控制台实时状态仍需长任务验收 | 25秒状态刷新、PID存活检查和3秒非重入状态流已实现 | 下一次真实长任务持续验证，不得根据GPU猜测状态 |
| 已闭合 | 运行目录小文件过多导致磁盘高活动 | 迁移`runtime-to-d-20260720-0528`已激活；源/目标700,058文件、94,808,690,230字节、逐文件hash差异0；SQLite登记700,058条artifact和637条程序事件 | `.runtime`已连接D盘热层；F盘备份保留；控制台和GET API只读索引或明确单条证据，不得恢复全目录扫描 |

正式条件配对数只能统计 VJ-2 条件空间对齐通过并取得项目所有者审核的同一图片身份。旧批次002 V4、005 V2与006 V5共3条只作历史配对证据；当前 `complete-map-scope-world-facts-v2` 批次的正式条件配对数为 `21`，未配对数为 `0`，两者不得与旧批次合并或自动重绑。

## 7. 完整计划表

下面是当前唯一执行计划。五类原图库是并行知识分类，不是五个先后训练阶段；所有阶段只服务同一个完整世界模型体系和同一个正式推理入口。

| 阶段 | 正式任务 | 程序入口或产物 | 完成门禁 | 当前状态 |
|---:|---|---|---|---|
| 1 | 文档与唯一入口治理 | 本文档；`plan/check/run:complete-game-world` | 所有当前任务只服从本文档 | 已完成 |
| 1A | D盘独立数据仓库与SQLite目录迁移 | `D:\AI-PET-WORLD-DATA`；存储解析器、目录数据库和迁移检查器 | 源/目标数量、字节和hash一致；F盘备份保留；控制台只读索引 | 已完成并激活；迁移manifest SHA-256=`08a56d7cb74e3ef6fa46f817abb205c00bd00ea6e84b9dcefabdcc7de42cae6a` |
| 2 | 锁定MVP世界范围 | `mainland-southeast-asia-tropical-monsoon-natural-home-v1` | 只做第一版自然家园，不提前实现人物、建筑、动物和交互 | 已完成 |
| 3 | 锁定正式视觉契约 | 原生 `1024×768` 2D高分辨率纯像素风完整地图 | 禁止低分辨率放大、tile/sprite拼接和普通插画像素化 | 已完成 |
| 4 | 世界视觉数据字典 | `npm run check:world-visual-data-dictionary` | `mvp-natural-home-v0.3` 条目、失败码和引用全部有效 | 已完成 |
| 5 | 地球参数、生态档案和现实物种 | 版本化NASA参数快照、热带季风档案、12个现实物种和覆盖蓝图 | 来源、版本、许可、采集时间和hash可追溯 | 已完成基础版本 |
| 6 | 大世界连接事实 | RegionGraph、EdgePort、PathGraph、HydrologyGraph、WalkableGraph | tick 3连接事实和owner review均通过 | 已完成事实层 |
| 7 | 大世界连接覆盖门槛 | `build/check:world-connectivity-coverage` | 27条正样本、27条负样本；9个覆盖轴各不少于3正+3负 | 已完成；27正/27负，九轴均3正+3负 |
| 8 | 五类原图并行建设 | `complete-maps`、`terrain`、`vegetation`、`natural-objects`、`transitions` | 每条记录绑定来源、提示词、hash、时间戳和审核身份 | 进行中 |
| 9 | 原图程序接收 | `npm run build:original-image-intake-template`；`npm run intake:original-image -- --request <request.json>`；`npm run check:original-image-library` | 程序自动复制、计算hash、写record并更新索引；接收不等于训练资格 | 程序已实现 |
| 10 | AI辅助冷启动原图 | `owner-authorized-ai-assisted-cold-start-v1` | 固定 `independentTrainingEligible=false`；必须机器和owner审核通过 | 已授权，持续建设 |
| 11 | 条件世界事实建设 | `build/check:ai-assisted-conditional-world-facts` | 先保存世界事实、导演、任务包和23通道，不读取旧RGB几何 | v2全新标签21套已完成；21/21结构与范围检查通过 |
| 12 | 条件后置RGB建设 | `build/check:ai-assisted-conditional-rgb-request` | 从 `complete-map-v2-001...021` 逐图生成新的精确4:3高分辨率原始RGB，禁止复用旧构图或旧RGB | 已完成；严格配对21/21 |
| 13 | 条件候选审核闭合 | 旧批次继续保留为历史；当前v2每个新RGB形成独立机器审核和owner审核链 | 21个唯一世界身份全部机器通过并取得owner approval | 已完成；21/21 owner approved |
| 13A | 条件编号推进与算力门禁 | `check:ai-assisted-conditional-rgb-sequence`；生成请求必须显式传入 `--source-record-id` | 同一条件待人工审核或已通过时一律阻断；存在历史时默认禁止重试，只有 owner 明确授权并提供 `--retry-reason` 才能重试 | 已实现；002与005批准阻断，004拒绝阻断 |
| 13B | 历史构图隔离与重复审核 | 生成请求仅使用当前条件引导图；`check:ai-assisted-composition-novelty` | 历史完整地图图像引用必须为0；命中历史拒绝构图时机器自动拒绝并回写失败 | 已实现并由004回归验证 |
| 14 | 新RGB自动接收 | `finalize:ai-assisted-conditional-rgb -- --input <generated.png>` | 原图必须精确4:3且不小于1024×768；程序原样保存原图，并以nearest-neighbor无裁切无放大生成1024×768训练派生图，同时保存双hash、条件包、任务包、UTC、北京时间和失败码 | 新契约已实现；不改变正式候选原生1024×768门禁 |
| 15 | 自动机器审核 | `run:ai-assisted-cold-start-review-pipeline` | VJ-0来源、VJ-1像素质量、VJ-2结构语义、专业审美全部通过 | 程序已实现 |
| 16 | 项目所有者单图审核 | `owner_approved` / `owner_rejected` | 只有项目所有者能形成结论；每个图片身份单独审核 | 已完成；当前正式条件版本配对21/21 |
| 17 | 失败自动回写 | 统一总账、失败码、受影响区域、负样本和下一目标 | 由程序自动保存，不由Codex手写运行记录 | 程序已实现 |
| 18 | AI辅助不可变数据包 | `build/check:ai-assisted-cold-start-dataset-package` | 来源、提示词、审核、图片hash、条件蓝图、连接证据和split一致 | 已重建并通过；旧21条基线 + V7贡献2条 = 23条条件绑定完整地图，连接27正/27负、`blockers=[]` |
| 19 | 正式条件配对闭合 | 新RGB + 先行23通道条件 + 同一身份审核链 | VJ-2空间语义通过并取得owner approval；V7新增记录还须容量贡献登记 | 已完成；旧21条基线与1条V7贡献，未配对0 |
| 20 | Autoencoder v2视觉验收 | `audit:ai-assisted-autoencoder-version-comparison` | 项目所有者确认重建细节达到继续条件 | 已批准继续条件；不等于正式推理通过 |
| 21 | AI辅助条件训练门槛 | 项目所有者批准的配对与连接数量门槛 | 21套当前正式条件配对；连接27正/27负且九轴各3正+3负 | 已批准且全部满足 |
| 21A | AI辅助条件去噪训练程序 | `train:ai-assisted-conditional-denoiser` | 真实消费当前数据包、23通道、连接监督和Autoencoder v2；自动保存checkpoint、逐项指标、算法证据、失败、谱系及统一程序台账 | V4程序合同已实现；stage 0冒烟已通过 |
| 21B | AI辅助条件去噪器V3渐进训练 | 归一化潜空间 + velocity预测 + 多尺度23通道U-Net；256×192 -> 512×384 -> 1024×768 | 每一阶段只继承上一阶段V3 checkpoint；固定时间步验证选择best checkpoint；全程保存四个split指标与谱系 | 已完成但held-out视觉验证失败；固定保留历史，不继续训练 |
| 21C | AI辅助条件去噪器V3隔离验证 | `run:ai-assisted-conditional-inference-validation` + `review:ai-assisted-conditional-inference-validation` + V3最终1024 checkpoint + `complete-map-v2-014` | 自动保存验证图、模型报告、全部审核、hash和失败学习；不得进入Runtime | 已执行并拒绝；历史runId=`ai-assisted-conditional-inference-validation-2026-07-19T14-37-10-137Z` |
| 21D | AI辅助条件去噪器V4程序修复 | 分类型条件缩放 + velocity/clean/gradient/condition reconstruction复合损失 + 复合checkpoint选择 | 配置、训练器、模型、推理器和审核器合同一致；无训练测试通过；V3失败图专业审美回归必须拒绝 | 程序已实现并通过合同检查 |
| 21E | AI辅助条件去噪器V4冒烟训练 | `smoke:ai-assisted-conditional-denoiser-v4` | 真实读取数据包并完成一次复合损失前向/反向；自动保存算法hash、五类损失、退出码、失败和总账 | 已完成；runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`，checkpoint仅限程序验证 |
| 21F | AI辅助条件去噪器V4正式渐进训练与隔离验证 | V4 stage 0 -> stage 1 -> stage 2 -> 1张owner授权held-out验证 | 三个训练阶段均已完成；`complete-map-v2-005`验证已机器拒绝并自动保存全部证据 | 已闭合为失败历史；禁止V4重试 |
| 21G | V4失败诊断与V5程序修复 | `diagnose:ai-assisted-conditional-v4-failure`；`check:ai-assisted-conditional-v5-repair` | 根因、4项失败、算法hash、CPU前向/反向、23通道输出绑定、时间步覆盖、双语双时区记录和SQLite索引完整 | 已完成；诊断runId=`ai-assisted-conditional-v4-diagnosis-2026-07-20T21-59-47-587Z`，CPU回归runId=`ai-assisted-conditional-v5-cpu-regression-2026-07-20T22-36-42-387Z` |
| 21H | AI辅助条件去噪器V5冒烟训练 | `smoke:ai-assisted-conditional-denoiser-v5` | 只证明V5真实数据前向/反向和自动证据链可运行；不得生成RGB或取得正式资格 | 已完成；runId=`ai-assisted-conditional-denoiser-v5-smoke-2026-07-20T23-03-42-768Z`，checkpoint SHA-256=`f6f9214470452e93ec899cee405b37f3a2108bb3bc9abc85dd7c6fc679c54b67`；5个产物已进入D盘与SQLite |
| 21I | AI辅助条件去噪器V5 stage 0正式渐进训练 | `npm run train:ai-assisted-conditional-denoiser-v5 -- --resolution-stage 0` | 必须自动保存逐轮指标、checkpoint、算法证据、进程事件、失败和SQLite索引；不得生成RGB或取得正式推理资格 | 已完成；runId=`ai-assisted-conditional-denoiser-v5-stage-0-2026-07-20T23-58-58-343Z`，最佳轮次31，checkpoint SHA-256=`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`，6个artifact与2个双语事件已完成D盘SQLite校验 |
| 21J | AI辅助条件去噪器V5 stage 1正式渐进训练 | `npm run train:ai-assisted-conditional-denoiser-v5 -- --resolution-stage 1` | 只能在项目所有者单独授权后执行；必须严格继承stage 0实际checkpoint并自动保存父hash、逐轮指标、算法证据、程序事件和SQLite索引；不得生成RGB或取得正式推理资格 | 已完成；runId=`ai-assisted-conditional-denoiser-v5-stage-1-2026-07-21T00-47-30-506Z`，`512×384`共40轮，最佳轮次31，checkpoint SHA-256=`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`，6个artifact与2个双语事件已完成D盘SQLite校验 |
| 21K | AI辅助条件去噪器V5 stage 2正式渐进训练 | `npm run train:ai-assisted-conditional-denoiser-v5 -- --resolution-stage 2` | 只能在项目所有者单独授权后执行；必须严格继承stage 1实际checkpoint并原生训练`1024×768`，自动保存全部谱系、指标、算法证据、事件和SQLite索引；不得自动生成RGB或取得正式推理资格 | 已完成；runId=`ai-assisted-conditional-denoiser-v5-stage-2-2026-07-21T07-41-08-443Z`，40轮，最佳轮次40，checkpoint SHA-256=`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`，6个artifact与2个双语事件已完成D盘SQLite校验 |
| 22 | 项目原创/独立样本登记 | `build:project-owned-sample-intake-template`；`register:complete-map-training-sample` | `strict-project-owned-training-data-v1` 权属、条件和审核全部通过 | 当前0条独立样本 |
| 23 | 正式数据缺口审计 | `audit:complete-map-data-sufficiency` | v0.3全部最低门槛满足 | 阻断 |
| 24 | 正式不可变数据包 | `build/check:current-complete-map-dataset-package` | train、validation、challenge、regression按图片和结构hash隔离 | 当前0样本，阻断 |
| 25 | 视觉事实与任务包 | `build:current-world-visual-fact-manifest`；`consume:game-map-visual-learning-feedback`；`build:current-world-visual-task-package` | 只消费当前真实事实、导演输出和失败记忆 | 程序已实现 |
| 26 | 23通道正式条件编译 | `compile/check:current-world-visual-conditions` | 权威通道对齐；缺失来源必须明确标记且不得猜测 | 检查通过 |
| 27 | 项目自有完整世界模型训练 | `train:project-owned-complete-world-model` | 独立数据审计通过；自主初始化；无第三方生成权重 | 被数据缺口阻断 |
| 28 | 项目自有条件checkpoint | 自动保存数据谱系、训练配置、指标、算法hash和无上游权重声明 | 当前生效版本的条件去噪器训练完成并通过模型检查 | V3、V4 checkpoint均固定为失败验证历史；V5已有stage 0与stage 1渐进训练checkpoint，stage 1固定`formalInferenceEligible=false` |
| 29 | 纯项目独立权重正式完整地图推理验证 | `run:current-world-visual-inference` | 当前任务包驱动纯项目独立权重生成一张全新原生完整地图 | 独立数据与独立checkpoint尚未形成；不得与21C的AI辅助隔离验证混同 |
| 30 | 正式候选机器审核 | VJ-0、VJ-1、VJ-2、Professional、MaterialQuality、FormalVisualJudge | 同一候选全部机器闸门通过 | 尚未开始 |
| 31 | RuntimeFrame绑定 | 地图结构、视觉、可走、碰撞、交互、状态和审计层 | 同一正式图片身份完整绑定且不可显示训练内容 | 尚未完成 |
| 32 | 项目所有者最终验收 | Owner Final Review | 项目所有者明确确认达到正式游戏标准 | 尚未到达 |
| 33 | `/world`正式发布 | `/world`只读终审通过的GameMapRuntimeFrame | 禁止展示训练图、候选图、失败图、局部图和程序占位图 | 当前阻断 |
| 34 | 下一轮自主闭环 | 失败回写 -> 数据调整 -> 训练 -> 新候选 | 历史失败减少且所有运行证据由程序自动保存 | 持续循环 |

### 7.1 当前独立训练数据门槛

以下数字只统计 `independentTrainingEligible=true` 的正式独立数据；AI辅助冷启动数据不得混入。

| 数据类别 | 当前 | 最低要求 | 当前缺口 |
|---|---:|---:|---:|
| 完整地图正样本 | 0 | 20 | 20 |
| 完整地图负样本 | 0 | 40 | 40 |
| grass-path 正样本 | 0 | 40 | 40 |
| grass-path 负样本 | 0 | 40 | 40 |
| grass-water 正样本 | 0 | 40 | 40 |
| grass-water 负样本 | 0 | 40 | 40 |
| object-ground 正样本 | 0 | 30 | 30 |
| object-ground 负样本 | 0 | 30 | 30 |
| 机器漏判记录 | 0 | 20 | 20 |
| AI辅助正式条件RGB配对 | 21 | 21 | 0 |
| 大世界连接训练覆盖正样本 | 27 | 27，且9轴各不少于3 | 0 |
| 大世界连接训练覆盖负样本 | 27 | 27，且9轴各不少于3 | 0 |

### 7.2 当前唯一下一动作

当前不得启动局部材料盲训、正式独立训练、旧版本重复推理或V7 GPU训练。D盘独立数据仓库、SQLite索引、冷热分层和无损迁移已经完成并通过回归；V7代码合同、纯CPU回归及`v7-capacity-slot-001/002/003`容量贡献登记已经完成，但没有V7 GPU训练或正式checkpoint。项目所有者已批准128张容量与`96/16/8/8` split，并于2026-07-23授权剩余104槽连续数据批次。程序必须逐槽串行准备和审核；机器通过仅进入待人工审核，机器失败留证后继续，任何产物都不得自动取得owner通过或容量资格。

```text
保留生成前21套蓝图快照及全部请求、生成图、失败、指标、失败码与总账
-> 当前不可变数据包已严格统计旧21条基线与1条V7容量贡献并保存完整审核证据
-> 程序已保存21套条件门槛、Autoencoder v2视觉继续条件和27正/27负/每轴3+3连接覆盖门槛批准
-> 程序已构建并复核27条连接正样本和27条连接负样本，9个覆盖轴均达到3正+3负
-> AI辅助不可变数据包已复核22条条件绑定完整地图、图片hash、条件hash、任务包hash、连接证据、split和门槛记录，blockers=[]
-> 首张V2隔离验证complete-map-v2-014已生成、机器拒绝并自动保存图片、审核、失败码和失败学习
-> V2数值诊断已定位潜空间尺度不一致、epsilon高时间步放大和浅层去噪器能力不足
-> 项目所有者已授权V3算法修复；V3采用逐通道潜变量归一化、velocity预测、多尺度23通道U-Net、固定时间步验证和最佳checkpoint选择
-> V3已按256×192、512×384、1024×768顺序完成三阶段训练，每阶段只继承前一阶段V3项目checkpoint
-> 训练程序已自动保存checkpoint、训练/验证指标、seed、配置hash、数据包hash、连接证据hash、失败、双时区时间戳和统一程序台账
-> V3同条件同seed无RGB诊断已证明数值爆炸修复，但held-out RGB验证仍产生高频噪声、纹理层级坍缩和条件覆盖错配
-> V3 held-out验证图、条件、checkpoint、seed、图片hash、旧机器审核与失败学习已由程序自动保存；V3固定为失败历史
-> V3机器审核曾错误放行VJ-1与Professional Aesthetic；V4专业审美v2已能对该历史图新增拦截高频噪声和安静区域缺失
-> 项目所有者已授权V4程序修复；V4采用分类型23通道缩放、复合训练目标和复合checkpoint选择，配置/模型/训练/推理/审核合同已通过无训练验证
-> V4 stage 0冒烟训练已由正式控制器执行并通过；runId=ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z
-> 冒烟checkpoint SHA-256=f7e00f80035d8986546ed4004b68647852a83df8d43c99b0ef40e28787910c63；算法源文件hash、配置hash、数据包hash、五类损失、复合指标、进程证据、退出码、双时区时间戳和统一总账已由程序自动保存
-> D盘独立训练数据仓库、SQLite索引、冷热分层和无损迁移已完成；复制、700,058文件与94,808,690,230字节核对、逐文件hash、SQLite建库、目录联接切换和控制台回归均通过
-> V4 stage 0至stage 2正式渐进训练已完成并自动保存；stage 2 runId=ai-assisted-conditional-denoiser-v4-stage-2-2026-07-20T19-28-49-245Z，checkpoint SHA-256=a3a5bdb608091bbdec5e65160758b8f35ca752adeb647487a013ba6df4c11a04
-> V4 complete-map-v2-005 held-out图已生成、自动保存并机器拒绝
-> 项目所有者已授权V4失败诊断与V5代码修复；诊断与CPU回归已由程序自动保存并写入SQLite，未启动GPU且未生成图片
-> V5 stage 0冒烟已通过；runId=ai-assisted-conditional-denoiser-v5-smoke-2026-07-20T23-03-42-768Z，checkpoint SHA-256=f6f9214470452e93ec899cee405b37f3a2108bb3bc9abc85dd7c6fc679c54b67
-> V5冒烟的21套条件、23通道、双语事件、双时区时间、算法证据和5个产物已进入D盘与SQLite；漏索引缺口及无训练修复run均已保留
-> V5 stage 0正式渐进训练已完成；runId=ai-assisted-conditional-denoiser-v5-stage-0-2026-07-20T23-58-58-343Z，checkpoint SHA-256=fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079
-> V5 stage 1正式渐进训练已完成；runId=ai-assisted-conditional-denoiser-v5-stage-1-2026-07-21T00-47-30-506Z，checkpoint SHA-256=44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d
-> V5 stage 2原生1024×768正式渐进训练已完成；runId=ai-assisted-conditional-denoiser-v5-stage-2-2026-07-21T07-41-08-443Z，checkpoint SHA-256=b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b
-> Stage 2的21套条件、23通道、40轮指标、双语事件、双时区时间、算法与条件证据及6个产物已自动保存并完成D盘SQLite校验；本轮没有RGB，formalInferenceEligible=false
-> 当前等待项目所有者单独授权一张challenge split held-out推理验证；未获命令前不得推理、生成RGB、建立候选、绑定Runtime或进入/world
-> 验证结果不得直接进入RuntimeFrame或/world，仍需全部机器审核和项目所有者审核
-> 所有机器审核门槛保持不变，不删除失败、不回写蓝图、不复用历史图像取得通过
```

第002号 V1/V2/V3/V4、第004号V1、第005号V1/V2、第006号V1/V2/V3/V4/V5及其图片、请求、审核和失败历史必须全部保留，不覆盖、不删除。生成请求程序必须显式接收 `--source-record-id`，不能使用默认条件；同一条件存在 `pending_review` 或 `owner_approved` 图片时必须在生成前阻断并保存 `computeStarted=false` 的顺序阻断记录。存在历史的条件默认禁止重试；只有项目所有者明确授权同一条件重试，并提供非空重试原因时才允许新版本。第003号记录不在当前21套条件蓝图清单中，不凭编号猜测或创建不存在的003任务。

## 8. 成功定义

第一版完整游戏世界地图成功必须同时满足：

1. 完整地图数据包可追溯。
2. 本地小模型输出完整 RuntimeFrame 候选。
3. RuntimeFrame 不是局部 crop，不是材料测试图。
4. MaterialQuality 通过。
5. FormalVisualJudge 通过。
6. 专业审美失败模式无阻断。
7. 项目所有者人工终审通过。
8. `/world` 只读取通过终审的 RuntimeFrame。
9. 全过程记录自动保存到 `.runtime`，不是 Codex 手写替代。

## 9. 禁止事项

1. 不允许把局部材料训练当作完整世界训练成功。
2. 不允许把 FormalVisualJudge 通过当作最终成功。
3. 不允许展示 owner rejected RuntimeFrame 作为当前可用地图。
4. 不允许读取旧 running 状态假装实时运行。
5. 不允许绕过 `docs/game-world-generation/` 直接按旧文档自由发挥。
6. 不允许把没有自动保存的数据当作正式训练数据。
7. 不允许在数据缺口未闭合时宣布第一版世界地图完成。
8. 不允许建立“项目内部视觉教师”或让程序直绘图成为专业完整地图正样本。
9. 不允许写死未经实验验证的模型数量、数据规模和工期。
10. 不允许把五类原图库解释为五个先后训练阶段、五个 Runtime 图层或五个必须独立存在的模型。
11. 不允许从原图库复制、选择、放大或机械拼接图片冒充完整世界模型输出。

## 10. 当前检查命令

每次继续前先跑：

```text
npm run check:ai-painter-model-training-alignment
npm run check:world-connectivity-contract
npm run check:world-connectivity-coverage
npm run check:current-world-connectivity-proposal
npm run check:earth-reference-world-connectivity-blueprint
npm run check:current-world-visual-conditions
npm run check:project-owned-complete-world-model
npm run check:ai-assisted-cold-start-dataset-package
npm run check:ai-assisted-complete-world-model
npm run check:ai-assisted-conditional-rgb-sequence
npm run check:foundational-complete-map-visual-standard
npm run check:ai-assisted-complete-map-scope -- --summary
npm run audit:ai-assisted-autoencoder-version-comparison
npm run check:complete-map-training-sample-registry
npm run check:current-complete-map-dataset-package
npm run build:complete-map-data-blueprint
npm run audit:complete-map-data-sufficiency
npm run check:complete-game-world
```

如果 `check:complete-game-world` 返回 `blocked`，说明系统没有坏，而是当前流程正确阻断。阻断原因必须作为下一步任务来源。

## 11. 2026-07-10 控制台稳定性修复记录

本节是当前执行文档的一部分，禁止后续实现退回旧行为。

| 编号 | 已处理问题 | 固定实现规则 | 验证结果 |
|---|---|---|---|
| P1 | 训练进度轮询重入 | SSE 和前端降级轮询必须等待上一轮完成，再延迟 3 秒；禁止使用 1 秒异步 `setInterval` | TypeScript 与 lint 通过；摘要响应约 5 KB |
| P1 | 重型状态接口重复扫描 | 完整状态快照使用 3 秒共享缓存；SSE 只发送状态摘要 | 完整响应约 3.18 MB，SSE 摘要约 5 KB |
| P1 | 长任务实时状态过期 | 控制器每 25 秒刷新实时状态；控制状态记录同时保存真实启动的子进程 PID | 已进入代码实现；待下一次真实长任务持续验收 |
| P1 | 生产构建追踪训练产物 | `.runtime` 不得进入 `training-data-image` 路由生产文件追踪清单 | NFT 从 142,400,589 字节降至 268,128 字节 |
| P2 | GET 页面修改业务台账 | `/ai-painter-progress/natural-home` 只读现有证据；刷新页面不得写 `latest.json` 或历史快照 | 页面访问前后台账修改时间保持一致 |

控制台只是读取器。训练、推理、审核、失败回写和晋级事件仍由程序自动保存，页面访问不得成为业务事件。

已知后续项：生产构建仍会报告 `world-visual-dictionary-trials/image` 导入链上的宽泛文件匹配警告，来源涉及 `generated-results` 和 `natural-home` 的动态目录扫描。当前该路由 NFT 约 278 KB，不是本次 67 万运行文件追踪问题，但后续必须把共享读取逻辑从页面模块迁入独立只读服务，消除构建警告。

## 9. 2026-07-21 V5 Stage 1正式训练结果

项目所有者已单独授权并由正式控制器完成V5 stage 1正式渐进训练：

- runId：`ai-assisted-conditional-denoiser-v5-stage-1-2026-07-21T00-47-30-506Z`
- 分辨率阶段：`512×384`
- 训练轮数：40
- 最佳轮次：31
- 最佳验证指标：`1.9992291231950123`
- 持续时间：109.312秒
- 父checkpoint SHA-256：`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`
- 新checkpoint SHA-256：`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`
- 自动存储：D盘SQLite已验证6个artifact与2个双语事件，文件字节数和hash一致
- 视觉边界：没有生成RGB，`formalInferenceEligible=false`

此前“等待stage 1”与“等待stage 2”的文字只表示当时的历史门禁，当前状态以第10节和第7.2节为准。V5 stage 2已完成，不得重复训练或自动启动任何RGB推理。

## 10. 2026-07-21 V5 Stage 2正式训练结果

项目所有者已单独授权并由正式控制器完成V5 stage 2原生`1024×768`正式渐进训练：

- runId：`ai-assisted-conditional-denoiser-v5-stage-2-2026-07-21T07-41-08-443Z`
- 训练轮数：40
- 最佳轮次：40
- 最佳验证指标：`2.0965599417686462`
- 持续时间：183.328秒
- 父checkpoint SHA-256：`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`
- 新checkpoint SHA-256：`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`
- 自动存储：D盘SQLite已验证6个artifact与2个双语事件，文件字节数和hash一致
- 视觉边界：没有生成RGB，`formalInferenceEligible=false`

该Stage 2历史门禁已经由项目所有者授权并完成，当前状态以第11节为准。不得重复Stage 2训练或重复执行同一张验证图。

## 11. 2026-07-21 V5单张Challenge验证结果

项目所有者已明确授权并由正式入口执行唯一`challenge`样本`complete-map-v2-014`的V5单图held-out验证。执行前程序修复了验证入口仍硬编码V4配置与checkpoint的问题；修复只增加显式`--v5`路由和V5 provenance、损失合同、checkpoint指标校验，没有改变模型算法、数据、审核门槛或页面。

- runId：`ai-assisted-conditional-inference-validation-v5-2026-07-21T08-45-43-210Z`
- 模型：`ai-pet-world-complete-world-ai-assisted-cold-start-v5`
- checkpoint SHA-256：`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`
- 条件：`complete-map-v2-014` / `challenge` / 23通道 / 完整地图范围
- 图片：原生`1024×768`
- 图片SHA-256：`3e4af6352c2ed4a48a3610de0f59c5efe161a858b4cd92f0553fade0aa506011`
- 机器结论：`machine_rejected`
- 失败码：`condition_terrain_path_ground_coverage_mismatch`、`professional_multiscale_texture_noise_overload`
- 隔离边界：`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`
- 自动存储：D盘SQLite已核验8个artifact与3个中英文程序事件，物理文件字节数和SHA-256一致
- 失败学习：`auto-visual-judge-learning-2026-07-21T09-22-05-435Z`已摄取本轮`machine-review.json`

该段记录V5验证后的历史门禁；V5诊断与V6后续训练、验证均已完成，当前状态只以第13节和第7.2节为准。

## 12. 2026-07-21 V5失败诊断与V6修复结果

项目所有者已授权V5失败诊断与算法修复。程序自动保存诊断runId=`ai-assisted-conditional-v5-diagnosis-2026-07-21T10-26-42-232Z`，锁定三项根因：V5潜变量条件探针可恢复条件但不能证明冻结解码器输出RGB遵守稀疏道路；最佳checkpoint只看teacher-forced单步潜变量指标，没有评价完整扩散采样RGB；challenge虽未参与优化或checkpoint选择，但仍被训练结束报告提前读取。

V6配置身份固定为`decoded-rgb-sparse-region-rollout-multiscale-unet-v6`。它不改变世界事实、世界导演、23通道数量与顺序、数据身份或审核门槛；只新增解码RGB全局损失、道路/水体/岸线/物体占地/焦点区域独立归一化损失、RGB层级与安静区域损失，并将validation固定seed完整采样RGB质量纳入checkpoint选择。challenge在训练期只保存身份与数量，不读取图片或条件张量。

项目所有者已明确授权并由正式控制器完成V6 stage 1正式渐进训练，runId=`ai-assisted-conditional-denoiser-v6-stage-1-2026-07-21T12-46-28-623Z`，checkpoint SHA-256=`23593901bd7c9dff385a1c943867b0da1f990b6e8f1fa530359cf5da4062e921`。该阶段以训练内部`512×384`执行40轮，最佳epoch=36，最佳验证指标=`2.6799847496052585`，耗时约302秒；父checkpoint为Stage 0且哈希一致。21套条件、23通道与challenge隔离合同均保持，未生成RGB。程序在D盘SQLite登记5个不可变产物及2条中英文事件，checkpoint、条件证据和算法证据哈希均复核一致；共享latest指针已由Stage 2接管。Stage 1的`formalInferenceEligible=false`。

项目所有者随后明确授权并由正式控制器完成V6 stage 2原生`1024×768`正式渐进训练，runId=`ai-assisted-conditional-denoiser-v6-stage-2-2026-07-21T19-11-57-819Z`。该阶段执行40轮，最佳epoch=36，最佳验证指标=`2.792788481960694`，持续`323.927`秒；父checkpoint SHA-256=`23593901bd7c9dff385a1c943867b0da1f990b6e8f1fa530359cf5da4062e921`与Stage 1实际文件一致，新checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`。21套条件、23通道和challenge隔离保持不变，challenge的`metricsReadDuringTraining=false`，运行目录RGB数量为0。程序自动保存5个不可变产物、1个latest指针和2条中英文事件，并完成D盘SQLite字节数与哈希核验。Stage 2固定`formalInferenceEligible=false`。随后获授权的V6 challenge单图验证已执行并机器拒绝，当前状态以第13节为准；不得重复Stage 2训练。

## 13. 2026-07-22 V6单张Challenge验证结果

项目所有者以“继续”授权唯一`challenge`样本`complete-map-v2-014`的V6 held-out单图验证。正式程序执行runId=`ai-assisted-conditional-inference-validation-v6-2026-07-21T20-39-03-363Z`，绑定V6 Stage 2 checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，使用23通道和固定challenge身份生成原生`1024×768`新图；图片SHA-256=`6ce37acc6278d5d7bbae6210e8273c634358fc1301936be9d394725fe2cf039e`。

机器审核结果为`machine_rejected`。VJ-0、VJ-1通过；VJ-2以`condition_terrain_path_ground_coverage_mismatch`拒绝；Professional Aesthetic当前通过。该机器结果不能被解释为专业画面接近通过，后续诊断必须同时核查机器审核对高频噪声、空间层级、完整地图对象结构和游戏可读性的漏判，但不得在未授权前修改审核门槛。

程序已自动保存`validation.png`、23通道条件、checkpoint与seed身份、`model-report.json`、`manifest.json`、`machine-review.json`、中英文过程事件和D盘SQLite索引；8个artifact及3条直接关联双语事件的物理字节数与SHA-256已核验。自动失败学习runId=`auto-visual-judge-learning-2026-07-21T20-39-36-899Z`已摄取本轮machine review。该结果固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，不能进入原图库、候选、Runtime或`/world`。

该等待诊断门禁已由第14节取代。V6图像、checkpoint、审核和失败学习继续作为不可变失败历史保存，不得覆盖或重试。

## 14. 2026-07-22 V6失败诊断与V7修复结果

项目所有者已授权V6失败诊断与修复。程序完成诊断runId=`ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z`，证据位于`.runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v6/ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z/diagnosis.json`。诊断确认训练rollout和正式推理均从纯高斯噪声开始，不存在target图捷径；根因固定为：数据split仅`16 train / 2 validation / 1 challenge / 2 regression`，V6 checkpoint完整采样只使用一个validation样本和一个seed，像素级指标不能可靠代表完整地图语义，Professional Aesthetic对单轴纹理异常缺少诊断提示。

V7代码合同已经建立为`all-validation-multiseed-semantic-rollout-unet-v7`。它不改变世界事实、世界导演、完整地图范围、23通道身份、数据来源、页面结构或既有审核拒绝门槛；只把全部validation样本、每样本至少2个seed和最差完整采样轨迹纳入checkpoint选择，并增加稀疏区域对比与`8×6`空间网格RGB约束。Professional Aesthetic仅新增单轴纹理异常诊断警告，历史V6审核结果及原拒绝门槛不变。

最新纯CPU回归runId=`ai-assisted-conditional-v7-cpu-regression-2026-07-22T00-20-01-226Z`已验证2个validation样本、2个seed、4条完整轨迹，并通过前向/反向、有限指标、输出梯度、23通道、challenge隔离、容量批准合同和无第三方权重检查。本轮没有GPU训练、推理或新RGB；V7没有正式checkpoint。

项目所有者于2026-07-22批准V7验证容量为128张独立完整地图，split固定为`96 train / 16 validation / 8 challenge / 8 regression`。最新容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`确认旧21条基线与3条V7贡献合计24/24条通过记录、图片、审核、世界身份、23通道和构图新颖性审计，失败0条；正式缺口为104条，剩余split为`77/14/7/6`。新增数据不得复制、裁切、只换seed、轻微改色、回绑旧RGB或使用局部地图充数。

覆盖矩阵与缺口清单由程序自动保存。该段原记录的“剩余105槽且逐图单独授权”属于slot-002闭环时的历史门禁；slot-003闭环后当前缺口为104。项目所有者已于2026-07-23用`owner-authorized-v7-remaining-104-continuous-batch-20260723`覆盖逐图重复授权：仅允许`slot-004...107`严格串行建设，任何时刻最多一个活动请求。每槽仍须绑定独立世界事实、世界导演、正式23通道、原生`1024×768` RGB、来源/许可、hash及审核记录；机器通过只进入待人工审核，失败留证后继续，不得自动重试、自动人工通过、自动登记容量或启动V7 GPU训练。

V7配置固定`trainingAuthorizationStatus=blocked_pending_approved_128_dataset_implementation`、`formalInferenceEligible=false`。128张不可变数据包完成审计后仍需项目所有者单独授权V7 GPU训练；未获授权不得训练、推理、生成验证图、降低审核门槛或返回局部材料路线。

## 15. 2026-07-22 V7首个容量槽位任务准备结果

项目所有者授权程序根据既有NASA POWER 2001-2020月度气候快照补齐季节过渡世界事实。程序已生成并校验`wet_to_dry_transition`与`dry_to_wet_transition`两份版本化环境快照，连同既有湿季、干季快照组成四季状态入口。两份快照只包含来源、月份、气候统计、地表与植被状态及生成约束；没有生成图片、没有启动GPU，也没有改变审核门槛。

程序随后只为覆盖矩阵中的首个缺口`v7-capacity-slot-001`建立任务证据，runId=`ai-assisted-v7-data-task-v7-capacity-slot-001-2026-07-22T02-07-41-845Z`。该任务固定为`train / lowland-evergreen-tropical-forest / wet_to_dry_transition`，绑定独立world seed、独立布局身份、正式世界事实、世界导演、原生`1024×768`完整地图任务包、23通道条件包和大世界连接事实。完整地图范围审核状态为`complete_map_scope_passed`，证明任务输入覆盖入口、家园中心、连续道路、多个空间/生态区、自然边界和大世界连接，而不是局部图任务。程序已将33个运行证据登记到D盘热层SQLite索引，并写入1条中英文程序事件。

该任务准备阶段当时固定`pairedRgbCount=0`、`imageGenerationStarted=false`、`gpuTrainingStarted=false`，状态为`task_ready_rgb_missing_waiting_owner_single_image_authorization`。它在当时不是训练样本、不是候选图、不是RuntimeFrame，也不能减少正式缺口；该历史门禁随后已由第16至18节的单图生成、审核和容量贡献登记结果取代。

## 16. 2026-07-22 V7首个容量槽位单图生成结果

更新时间：2026-07-22 11:41:47 +08:00

项目所有者已明确授权`v7-capacity-slot-001`单张RGB。程序建立正式请求`conditional-rgb-001-2026-07-22T03-03-07-793Z`，只引用当前V7任务的语义条件引导图，不引用任何历史完整地图RGB。Codex内置生成只执行一次，得到`1448×1086`精确4:3源图；程序原样保存源图，并按`owner-approved-high-resolution-four-three-derivative-v1`无裁切、无放大地以nearest-neighbor生成单独`1024×768`训练/机器审核派生图，SHA-256=`6f89c3830183a48dc4d7074a8d88b8787e3ff19753dc42bb6bd337548878e5c2`。

单图生成阶段当时的机器状态为`machine_contract_passed_waiting_owner_visual_review`，项目所有者状态为`pending_review`，`conditionalTrainingEligible=false`。该历史等待状态随后已由第17节的owner通过和第18节的容量贡献登记取代。首次自动接收因旧接收器授权标识未覆盖V7单图授权而失败；程序已保存失败证据和双语事件，修复后复用同一源图完成接收，没有消耗第二次图像生成。

## 17. 2026-07-22 V7首张RGB项目所有者审核结果

更新时间：2026-07-22 12:59:59 +08:00

项目所有者已明确通过该图。程序自动保存不可变人工审核历史，状态=`owner_approved`，记录状态=`ai_assisted_cold_start_eligible`，`formalConditionalTrainingEligible=true`，并按既有不可重复序号登记为`自主生成训练原图第002张`；`slot-001`仍是本轮容量槽位身份，两种编号不得混写。该图只取得AI辅助训练数据资格，仍固定`independentTrainingEligible=false`、`directRuntimeFrameUseAllowed=false`、`canEnterWorld=false`。

审核后数据包自动重建曾暴露旧构建器只识别历史21套条件身份；该失败证据继续不可变保存在`.runtime/ai-painter/ai-assisted-dataset-package-failures/ai-assisted-dataset-package-build-failure-2026-07-22T04-55-29-837Z/failure-record.json`。该问题已由V7容量贡献入口闭合；slot-001至slot-003均已登记，最新数据包条件绑定完整地图数为24，正式缺口104。本句原有“等待新任务命令”属于slot-003闭环历史状态；当前执行以第25节的104槽连续批次授权为准，V7 GPU训练仍禁止启动。

## 18. 2026-07-22 V7首条容量贡献闭合结果

更新时间：2026-07-22 14:30:49 +08:00

程序新增正式登记入口`npm run register:ai-assisted-v7-capacity-contribution`和只读检查入口`npm run check:ai-assisted-v7-capacity-contribution`。登记程序验证原始缺口槽位、任务包、完整地图范围审核、23通道及各通道hash、图片hash、机器审核、项目所有者审核和唯一性后，写入不可变贡献证据，并更新原图记录与索引指针；页面或聊天记录不能代替该程序登记。

`v7-capacity-slot-001`贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-001-2026-07-22T06-19-53-556Z`已通过独立检查。该阶段数据包曾为22条、缺口106；此处保留为slot-001闭环时的历史结果，最新状态以第21节的23条、缺口105为准。

## 19. 2026-07-22 V7容量槽位002任务准备结果

更新时间：2026-07-22 18:12:27 +08:00

项目所有者以“允许继续”授权准备下一任务后，程序仅构建一次`v7-capacity-slot-002`，runId=`ai-assisted-v7-data-task-v7-capacity-slot-002-2026-07-22T10-03-58-601Z`。任务从最新容量计划和已验证gap-list读取固定身份`train / lowland-evergreen-tropical-forest / wet_to_dry_transition / structural_diversity_reserve`，建立独立世界事实、世界导演、任务包和23通道条件包；构图为东南侧入口经偏置不规则家园中心连接西北侧大世界出口，当前世界事实不要求主要地表水体，与slot-001的结构身份不同。

在任务准备阶段，独立检查确认`channelCount=23`、`completeMapScopePassed=true`、`pairedRgbCount=0`，并核验任务、条件、范围审计的hash、32项D盘SQLite artifact和1条中英文程序事件。当时状态为`task_ready_rgb_missing_waiting_owner_single_image_authorization`；该历史阻断随后已由单图授权、生成、机器审核、owner审核和容量登记闭合。程序仍禁止重复构建slot-002；当前不得自动进入slot-003或启动GPU。

## 20. 2026-07-22 V7容量槽位002单图生成与机器审核结果

项目所有者明确授权该槽位唯一一张RGB后，程序建立请求`conditional-rgb-002-2026-07-22T10-50-32-811Z`。请求绑定`training-world-facts-v7-complete-map-002`、世界导演、完整地图级23通道及`foundational-complete-map-visual-standard-b0ddc5c912439480`聚合标准；唯一图像引用是语义条件引导图，`historicalCompleteMapImageReferencesUsed=false`。画面固定为低地常绿热带森林、雨季向旱季过渡、无主要地表水、东南入口经偏置不规则家园中心连接西北大世界出口。

程序自动接收源图、生成派生图并执行机器审核。源图尺寸`1448x1086`、SHA-256=`96ee07168ba20d700299901a5abe907bb830be8764f5f656f372507ca5582b79`；nearest-neighbor `1024x768`派生图SHA-256=`d326d6073e91b1a8ba2bcccca5e153281326980b725ef987277b1fdbc75f92e3`。原图记录位于`data/world-samples/original-image-library/natural-home-v1/complete-maps/ai-cold-start-v7-v7-capacity-slot-002-lowland-evergreen-tropical-forest-v1/record.json`，机器审核位于同目录`reviews/machine-review.json`。

在owner审核前，请求状态为`generated_intaked_machine_passed_waiting_owner_review`，机器审核为`machine_contract_passed_waiting_owner_visual_review`，项目所有者状态为`pending_review`。该段保留为机器通过不等于人工通过的过程证据；后续owner审核和容量闭环结果以第21节为准。

## 21. 2026-07-22 V7容量槽位002 owner审核与容量闭环

项目所有者已明确审核通过`ai-cold-start-v7-v7-capacity-slot-002-lowland-evergreen-tropical-forest-v1`。程序自动写入owner审核记录，审核时间为`2026-07-22T11:59:39.976Z / 2026-07-22T19:59:39+08:00`，并把请求状态更新为`generated_intaked_machine_passed_owner_approved`。该通过只授予AI辅助条件训练资格，不授予独立训练、正式候选、Runtime或`/world`资格。

容量登记runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-002-2026-07-22T12-01-16-339Z`，贡献SHA-256=`7f3dcf75cfc5a1804b7d3905afa0f463a4253bff3701f888881673ae8f2725f2`。独立检查确认slot-001与slot-002两条贡献均通过且无重复槽位。数据包已由程序重建为`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-22T12-04-59-138Z`：总样本54条、完整地图50条、条件绑定完整地图23条、V7贡献2条、未配对0条、`blockers=[]`。

slot-002闭环时的容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T12-05-01-665Z`确认23/23条合格、失败0条、正式缺口105条；当时split为`18 train / 2 validation / 1 challenge / 2 regression`，剩余规划为`78 / 14 / 7 / 6`。该段历史门禁已由第22至25节覆盖，当前数字以第25节为准。

## 22. 2026-07-22 V7容量槽位003任务准备结果

项目所有者已明确授权准备`v7-capacity-slot-003`。第一次runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T12-38-25-200Z`因`dry_season`配方尚未实现而在RGB前失败；获得修复授权后，第二次runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-11-19-044Z`被完整地图范围门以`complete_map_route_overlaps_collision`阻断。程序为两次失败分别保存`failure.json`、双时区时间、错误原因、程序事件和SQLite索引；两次均未生成RGB或启动GPU。

修复严格使用既有`mainland-southeast-asia-tropical-monsoon-provisional-late-dry-season-v1`快照，任务身份为`train / lowland-evergreen-tropical-forest / dry_season / pairwise_landscape_season_baseline`。完整地图结构固定为西南侧道路入口、东偏不规则家园中心、北侧大世界延伸，多个开放林地与常绿森林边界分区；当前世界事实不要求主要地表水体。成功runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-27-59-480Z`，条件包规范SHA-256=`7e739f0359608bb0d4a1b6056ec1eb1c5c85b95bbfe7a3922689026e31f45fd0`，完整地图范围审核SHA-256=`db3e5aae85a3466271782cbc2ebb12330a42f1ea24d2342473cb092c6018b44b`。

独立检查确认23通道、完整地图范围、32项SQLite artifact和1条中英文程序事件全部通过；`pairedRgbCount=0`、`imageGenerationStarted=false`、`gpuTrainingStarted=false`。当前唯一下一动作是等待项目所有者单独授权slot-003的一张RGB；不得自动生成、重复准备、进入slot-004或启动V7 GPU训练。容量仍为23，正式缺口仍为105。

## 23. 2026-07-23 控制台原图审核入口

项目所有者已授权完整地图原图类型页提供单条“通过 / 拒绝”按钮。GET继续只读，POST只提交明确owner命令；正式程序自动保存审核、失败学习、双语事件、时间、hash和SQLite证据。V7容量槽位通过后自动登记并检查容量贡献、重建并检查数据包、刷新容量计划。该入口不自动生成下一张RGB、不准备下一槽位、不启动GPU训练、不改变Runtime或`/world`门禁。

本节记录审核入口实现时的历史状态：当时slot-003任务与23通道已就绪但RGB尚未生成。该门禁已经由第24节和第25节闭合。

## 24. 2026-07-23 V7容量槽位003单图生成与机器审核结果

更新时间：2026-07-23 04:16:35 +08:00

项目所有者已明确授权`v7-capacity-slot-003`唯一一张完整地图RGB。程序先补齐并保存当前任务的语义条件引导图，再建立请求`conditional-rgb-003-2026-07-22T20-03-44-163Z`；请求绑定`training-world-facts-v7-complete-map-003`、世界导演、完整地图级23通道及版本化基础完整地图聚合标准，唯一图像引用为当前语义条件引导图，历史完整地图RGB引用数为0。

Codex内置图像生成仅执行一次，得到`1448×1086`精确4:3源图，源图SHA-256=`8182273c7f60a6445a2a7fafdef1f2b4c1ed085d00ae9d69aa6a1f102211a9b4`。程序按`owner-approved-high-resolution-four-three-derivative-v1`自动生成无裁切、无放大的nearest-neighbor `1024×768`训练派生图，SHA-256=`3fb5be1a2ac39c5da46cb9c67516b0bd3712bfe1d66c6a13e215913c593217c4`，并自动保存原图、任务、23通道、条件引导、提示证据、来源许可、双时区时间、机器审核、hash及SQLite索引。

自动检查`check:ai-assisted-conditional-rgb-automation`与`check:original-image-library`均通过。当前请求状态=`generated_intaked_machine_passed_waiting_owner_review`，机器审核状态=`machine_contract_passed_waiting_owner_visual_review`，项目所有者状态=`pending_review`，训练资格仍为`ai_assisted_cold_start_pending_review`。当前唯一下一动作是项目所有者在原图页面审核该图；不得自动生成第二张、准备`slot-004`、登记容量贡献、启动V7 GPU训练、创建RuntimeFrame或进入`/world`。

## 25. 2026-07-23 V7容量槽位003 owner审核与容量闭环

项目所有者已通过控制台审核`ai-cold-start-v7-v7-capacity-slot-003-lowland-evergreen-tropical-forest-v1`，审核时间为`2026-07-22T20:48:20.545Z / 2026-07-23T04:48:20+08:00`，结论为`owner_approved`。审核文件、图片SHA-256=`3fb5be1a2ac39c5da46cb9c67516b0bd3712bfe1d66c6a13e215913c593217c4`和原图记录继续由程序自动保存。

首次页面审核后没有自动进入容量登记。根因是审核服务只从`taskPackageId`判断V7槽位，而正式槽位身份实际存在于`recordId`及`taskPackagePath`。程序已把识别范围修正为记录ID、容量槽位字段和任务路径，并继续要求严格匹配`v7-capacity-slot-NNN`，没有改变数据、审核或训练门槛。随后使用同一owner命令引用补跑正式程序链，登记贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-003-2026-07-22T21-02-11-194Z`，贡献SHA-256=`154474ba36bf49aa8d11c55657e90e91f64cb0f21dae33ea90a5e899ab020ec4`；独立贡献检查确认slot-001至003共3条且无失败。

程序重建数据包`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-22T21-03-31-782Z`，确认完整地图条件绑定24条、V7容量贡献3条、未配对0条、阻断0条。最新容量计划runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`确认24/24合格、失败0条、正式缺口104条；当前split为`19 train / 2 validation / 1 challenge / 2 regression`，剩余规划为`77 train / 14 validation / 7 challenge / 6 regression`，最终仍严格为`96 / 16 / 8 / 8`。本次恢复链生成图片0张、GPU训练0次、训练0次。

当前下一步固定为执行`owner-authorized-v7-remaining-104-continuous-batch-20260723`：从`slot-004`开始逐槽串行准备世界事实、世界导演、完整地图任务、23通道和唯一生成请求。Codex内置生成通道返回RGB后由程序自动接收、保存并机器审核；机器通过进入待人工审核队列，失败归档后继续下一槽。批次结束后停止等待项目所有者逐张审核；不得自动人工通过、自动容量登记、自动重试或启动V7 GPU训练。
