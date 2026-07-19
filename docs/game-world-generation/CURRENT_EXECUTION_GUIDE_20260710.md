# 完整游戏世界生成当前执行指南

更新时间：2026-07-20 04:31:34 +08:00

状态：正式当前执行文档 / 当前v2条件严格配对21/21 / V3 held-out视觉验证已拒绝并保留 / V4 stage 0冒烟训练已通过并自动保存 / 等待V4正式渐进训练授权 / RuntimeFrame仍阻断

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

项目所有者于2026-07-20授权建立V4修复，范围固定为：离散条件nearest-neighbor、连续条件bilinear的分类型缩放；velocity、clean latent、latent gradient、离散/连续条件重建的复合训练目标；基于固定验证网格复合质量分数的best checkpoint选择；仅使用owner已批准基础完整地图校准的多尺度纹理与安静区域专业审美门禁。V4程序、配置、采样合同和审核器已经完成代码合同、CPU前向/反向与历史V3失败图回归测试；专业审美回归能够新增拦截 `professional_multiscale_texture_noise_overload` 和 `professional_quiet_region_missing`。项目所有者随后授权V4 stage 0冒烟训练；正式控制器已执行并完成runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`，程序自动保存算法证据、五类损失、复合指标、进程证据、退出码、双时区时间戳和仅限程序验证的checkpoint。当前尚未执行V4正式渐进训练或任何V4 RGB推理，因此不得声称V4模型能力成功。

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
           data_gap_insufficient, ai_assisted_v4_progressive_training_missing
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
| P0 | V4正式渐进训练尚未授权和执行 | V4 stage 0冒烟runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`已通过；程序自动保存21套配对、23通道、五类损失、复合指标、算法hash、checkpoint、进程证据和双时区时间戳；冒烟checkpoint固定`formalInferenceEligible=false` | 下一步只能在项目所有者明确授权后执行V4 stage 0正式渐进训练；不得把冒烟checkpoint用于推理、候选、Runtime或`/world` |
| P0 | 当前 RuntimeFrame 缺少正式图片身份 | tick 3 RuntimeFrame 的 `imageSha256=null`，`canShowInWorld=false` | 只有正式模型新候选完成全部审核后才能绑定 |
| P1 | FormalVisualJudge 专业审美能力仍需持续验证 | Professional Aesthetic v2已实现owner正样本校准的多尺度纹理上限、安静区域与层级检查，并能拦截V3失败图；尚未经过新V4推理图验证 | 每次漏判必须保存judge-gap、校准样本身份、阈值、失败码、区域和下一修复目标；owner终审不变 |
| P1 | 控制台实时状态仍需长任务验收 | 25秒状态刷新、PID存活检查和3秒非重入状态流已实现 | 下一次真实长任务持续验证，不得根据GPU猜测状态 |

正式条件配对数只能统计 VJ-2 条件空间对齐通过并取得项目所有者审核的同一图片身份。旧批次002 V4、005 V2与006 V5共3条只作历史配对证据；当前 `complete-map-scope-world-facts-v2` 批次的正式条件配对数为 `21`，未配对数为 `0`，两者不得与旧批次合并或自动重绑。

## 7. 完整计划表

下面是当前唯一执行计划。五类原图库是并行知识分类，不是五个先后训练阶段；所有阶段只服务同一个完整世界模型体系和同一个正式推理入口。

| 阶段 | 正式任务 | 程序入口或产物 | 完成门禁 | 当前状态 |
|---:|---|---|---|---|
| 1 | 文档与唯一入口治理 | 本文档；`plan/check/run:complete-game-world` | 所有当前任务只服从本文档 | 已完成 |
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
| 18 | AI辅助不可变数据包 | `build/check:ai-assisted-cold-start-dataset-package` | 来源、提示词、审核、图片hash、条件蓝图、连接证据和split一致 | 已重建并通过；21/21配对、连接27正/27负、`blockers=[]` |
| 19 | 正式条件配对闭合 | 新RGB + v2先行23通道条件 + 同一身份审核链 | VJ-2空间语义通过并取得owner approval | 已完成；21/21，未配对0 |
| 20 | Autoencoder v2视觉验收 | `audit:ai-assisted-autoencoder-version-comparison` | 项目所有者确认重建细节达到继续条件 | 已批准继续条件；不等于正式推理通过 |
| 21 | AI辅助条件训练门槛 | 项目所有者批准的配对与连接数量门槛 | 21套当前正式条件配对；连接27正/27负且九轴各3正+3负 | 已批准且全部满足 |
| 21A | AI辅助条件去噪训练程序 | `train:ai-assisted-conditional-denoiser` | 真实消费当前数据包、23通道、连接监督和Autoencoder v2；自动保存checkpoint、逐项指标、算法证据、失败、谱系及统一程序台账 | V4程序合同已实现；stage 0冒烟已通过 |
| 21B | AI辅助条件去噪器V3渐进训练 | 归一化潜空间 + velocity预测 + 多尺度23通道U-Net；256×192 -> 512×384 -> 1024×768 | 每一阶段只继承上一阶段V3 checkpoint；固定时间步验证选择best checkpoint；全程保存四个split指标与谱系 | 已完成但held-out视觉验证失败；固定保留历史，不继续训练 |
| 21C | AI辅助条件去噪器V3隔离验证 | `run:ai-assisted-conditional-inference-validation` + `review:ai-assisted-conditional-inference-validation` + V3最终1024 checkpoint + `complete-map-v2-014` | 自动保存验证图、模型报告、全部审核、hash和失败学习；不得进入Runtime | 已执行并拒绝；历史runId=`ai-assisted-conditional-inference-validation-2026-07-19T14-37-10-137Z` |
| 21D | AI辅助条件去噪器V4程序修复 | 分类型条件缩放 + velocity/clean/gradient/condition reconstruction复合损失 + 复合checkpoint选择 | 配置、训练器、模型、推理器和审核器合同一致；无训练测试通过；V3失败图专业审美回归必须拒绝 | 程序已实现并通过合同检查 |
| 21E | AI辅助条件去噪器V4冒烟训练 | `smoke:ai-assisted-conditional-denoiser-v4` | 真实读取数据包并完成一次复合损失前向/反向；自动保存算法hash、五类损失、退出码、失败和总账 | 已完成；runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`，checkpoint仅限程序验证 |
| 21F | AI辅助条件去噪器V4正式渐进训练 | V4 stage 0 -> stage 1 -> stage 2；每一阶段只继承同版本前一阶段checkpoint | 自动保存全部损失、复合选择指标、父checkpoint hash、算法证据、双时区时间戳和程序事件；完成仍不等于正式推理通过 | 等待项目所有者明确授权；不得自动启动 |
| 22 | 项目原创/独立样本登记 | `build:project-owned-sample-intake-template`；`register:complete-map-training-sample` | `strict-project-owned-training-data-v1` 权属、条件和审核全部通过 | 当前0条独立样本 |
| 23 | 正式数据缺口审计 | `audit:complete-map-data-sufficiency` | v0.3全部最低门槛满足 | 阻断 |
| 24 | 正式不可变数据包 | `build/check:current-complete-map-dataset-package` | train、validation、challenge、regression按图片和结构hash隔离 | 当前0样本，阻断 |
| 25 | 视觉事实与任务包 | `build:current-world-visual-fact-manifest`；`consume:game-map-visual-learning-feedback`；`build:current-world-visual-task-package` | 只消费当前真实事实、导演输出和失败记忆 | 程序已实现 |
| 26 | 23通道正式条件编译 | `compile/check:current-world-visual-conditions` | 权威通道对齐；缺失来源必须明确标记且不得猜测 | 检查通过 |
| 27 | 项目自有完整世界模型训练 | `train:project-owned-complete-world-model` | 独立数据审计通过；自主初始化；无第三方生成权重 | 被数据缺口阻断 |
| 28 | 项目自有条件checkpoint | 自动保存数据谱系、训练配置、指标、算法hash和无上游权重声明 | 当前生效版本的条件去噪器训练完成并通过模型检查 | V3 checkpoint固定为失败验证历史；V4只有程序冒烟checkpoint，正式渐进训练checkpoint尚未形成 |
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

当前不得启动局部材料盲训或正式独立训练。当前v2的21套条件配对、逐图审核、数量门槛批准、Autoencoder v2继续条件验收、连接覆盖、首张V2隔离验证、V3算法修复、V3三级训练、V3 held-out失败验证和V4 stage 0冒烟训练已经完成。下一动作固定为：

```text
保留生成前21套蓝图快照及全部请求、生成图、失败、指标、失败码与总账
-> 当前不可变数据包已严格统计21/21并保存完整审核证据
-> 程序已保存21套条件门槛、Autoencoder v2视觉继续条件和27正/27负/每轴3+3连接覆盖门槛批准
-> 程序已构建并复核27条连接正样本和27条连接负样本，9个覆盖轴均达到3正+3负
-> AI辅助不可变数据包已复核21/21、图片hash、条件hash、任务包hash、连接证据、split和门槛记录，blockers=[]
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
-> 当前没有V4正式渐进训练checkpoint，也没有V4 RGB；下一步只允许在项目所有者明确授权后执行V4 stage 0正式渐进训练
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
