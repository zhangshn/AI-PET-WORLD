# AI Painter 正式实现规格

更新时间：2026-07-20 04:31:34 +08:00

状态：active-architecture / 当前完整世界视觉实现唯一规格 / 真实完整地图推理仍阻断

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 定位与边界

AI Painter 是 AI-PET-WORLD 的完整世界视觉生产系统。它在世界事实、视觉事实清单、世界导演和地图结构约束下，使用项目本地模型生成本轮完整地图新候选。

AI Painter 不决定世界中有什么，不决定道路是否可走、对象是否碰撞、世界如何生长，也不能用图片反推正式世界事实。局部材料、对象图和过渡图只是内部能力，不能代表完整 AI Painter。

当前完整地图模型不得输出“全画布局部图”。`1024×768` 只定义原生画布，不定义地图范围；单一河段、单一道路、单一池塘、单一林间空地、单一材质范围或放大局部生态单元即使铺满画布，也不属于完整地图。世界导演和条件编译器必须在像素生成前提供完整地图范围证据，证明同一画面包含整体入口/出口关系、家园中心、连续道路组织、多个可辨识空间或生态分区、自然边界及大世界连接语义。水体布局必须服从当前世界事实，不能成为每张东南亚地图的默认主体。范围证据缺失或只描述局部场景时，推理入口必须以 `local_scene_not_complete_map` 在算力调用前阻断。

### 1.1 冷启动完整地图视觉标准

经审核的冷启动基础完整地图原图负责提供完整地图视觉知识。实现必须把整批基础图编译为可追溯、版本化的聚合标准，而不是选择某张图作为构图模板。标准至少包含：

- 镜头方向、镜头距离、世界尺度与对象比例；
- 整体构图层次、视觉阅读顺序和可游玩空间组织；
- 入口、家园中心、主路/支路、边界与连接口的关系；
- 多空间、多生态分区的组织方式及分区之间的过渡；
- 有水、少水与无水地图的分布变化，不固定单一河流模板；
- 树木、石头、植被等对象尺寸、密度、接地与遮挡；
- 高分辨率像素纹理、色彩、光照、边缘密度和游戏可读性；
- 历史重复、局部图和项目所有者拒绝构图的负向边界。

生成器不得接收历史完整地图 RGB 作为直接图片参考。正式输入关系固定为：

```text
版本化完整地图视觉标准（怎样保持同一款游戏）
+ 当前世界事实与世界导演（本轮完整区域是什么）
+ 当前23通道（本轮内容具体在哪里）
-> 新的原生1024×768完整像素地图
```

统一视觉标准不允许退化为统一构图。若新结果只更换颜色、植被或局部装饰，却复用相同水体、道路、分区和整体布局，必须以 `complete_map_composition_diversity_failed` 拒绝。

图像生成不是自动队列副作用。正式任务依据与项目所有者本轮明确生成命令缺一不可；智能体、控制器、失败修复器和蓝图队列不得自行开始下一张、批量生成、自动重试或递增版本。每张图生成、程序自动保存及机器审核完成后必须停止等待项目所有者单图审核。

第一版正式视觉风格由项目所有者锁定为 2D 高分辨率像素风完整游戏地图。正式本地模型必须直接生成原生 `1024×768` 完整地图；训练可以渐进使用较低分辨率，但正式候选、owner审核和 Runtime 不得使用低分辨率放大结果。AI辅助冷启动可按 `owner-approved-high-resolution-four-three-derivative-v1` 保存高分辨率精确4:3原图并生成隔离的1024×768训练/机器审核派生图，该图不属于正式候选链。高分辨率像素风必须具有统一视角、尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性，不能以普通数字插画或像素滤镜替代。

### 1.1 画法、训练分辨率与风格契约

| 概念 | 正式含义 | 不得误解为 |
|---|---|---|
| 画法/生成算法 | `WorldFacts -> VisualFactManifest -> World Director -> 23通道条件 -> 本地完整世界模型 -> 新像素` 的可追溯生成方法 | 从原图库选图、贴图、拼图或按规则程序直绘 RGB |
| 训练分辨率 | 模型训练内部可以按 `256×192 -> 512×384 -> 1024×768` 渐进学习 | 允许保存低分辨率候选并放大取得正式资格 |
| 正式输出分辨率 | 原图、正式 target、正式候选、审核和 Runtime 均使用模型原生生成的 `1024×768` 完整地图 | 响应式页面显示尺寸或旧材料槽尺寸 |
| 风格契约 | 统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性 | 只在提示词中写“像素风”，或对普通插画套像素滤镜 |

画法/生成算法和风格契约不是同一个概念，但两者缺一不可。算法保证来源、条件消费和新像素生成正确；风格契约保证不同区域、季节和状态仍属于同一款游戏。季节、湿度、生态类型和生命周期可以改变局部色彩、密度和环境状态，但不能自行改变镜头关系、对象比例、逻辑像素尺度、轮廓语言和光照体系。任何新增风格版本必须取得项目所有者命令并保存版本身份；不得由智能体或模型在单张图中临时改风格。

全部地图条件统一使用 `world-visual-environment-context-v1`，不是每张图使用不同算法。统一链路固定为 `来源记录/环境快照 -> WorldFacts.environmentContext -> World Director -> CompleteWorldVisualTaskPackage -> coverage-blueprint区域生态档案 -> 完整地图范围门禁 -> 生成请求编译器 -> 像素生成器`。当前请求契约为 `dynamic_complete_map_scope_plus_foundational_visual_standard_plus_world_facts_director_23_channels_v9`；每个区域的 `requiredFeatures`、`optionalFeatures`、地表湿度、道路材质和调色指令都由同一编译器从当前生态档案与环境上下文动态构建。v9读取 `versioned_foundational_complete_map_visual_standard_aggregate_only_v1`、当前23通道及其道路覆盖档案，但不读取历史完整地图 RGB。范围门禁必须在生成算力调用前验证完整地图入口/出口、家园中心、连续道路、多空间/生态分区、自然边界及大世界连接证据；失败统一写入 `local_scene_not_complete_map` 并阻断。同一条件重试时，项目所有者授权的非空原因必须形成 `owner-authorized-conditional-rgb-retry-repair-v1`，只允许改变视觉材料表达，不能改变世界事实、条件几何、对象足迹、镜头、环境或审核门槛。季节、季风阶段、环境状态、天气、光照、地表湿度和能见度只作为版本化输入参数变化；请求编译器不得硬编码雨季、旱季或湿度，也不得因单个条件新增临时生成算法。任何跨层身份不一致必须在像素生成前阻断。

条件对齐审核的道路识别固定采用 `season_aware_local_color_signal_plus_8x6_spatial_mass_and_centroid_v2`。该算法依据记录的 `classification.monsoonSeason` 选择雨季/转换季暖土道路或旱季红棕土路分类，再使用同一8×6空间质量、质心和覆盖门槛比对23通道。季节分类只改变实际像素信号提取，不改变验收阈值；所有版本必须同时回归历史通过图、拒绝图、雨季图和旱季图。

## 2. 唯一正式链路

```text
WorldFacts
-> VisualFactManifest
-> World Director
-> CompleteWorldVisualTaskPackage
-> Visual Condition Compiler
-> Local Complete-World Inference
-> Fresh Complete-Map Candidate
-> VJ-0 / VJ-1 / VJ-2 / Professional Aesthetic Gate
-> Owner Final Review
-> GameMapRuntimeFrame
-> /world
```

任何缺失环节都必须阻断。旧图选择、复制、放大，局部 crop、材料槽输出和程序占位图均不能冒充本轮完整地图推理。

完整地图范围门禁位于 `Local Complete-World Inference` 之前，并在 VJ-2 与 Professional Aesthetic Gate 中再次验证。23通道数量正确、hash正确、全画布覆盖或道路/水体无冲突，只证明条件数据技术有效，不证明地图范围完整；不得用技术检查通过替代完整游戏地图判断。

### 2.1 五类并行知识输入与统一模型体系

`complete-maps`、`terrain`、`vegetation`、`natural-objects` 和 `transitions` 只表示原始视觉记录的主要知识分类。它们必须并行经过同一来源审计、权属审计、视觉审核、样本登记和数据包构建流程，不能被解释为五个先后训练阶段。

```text
五类合格记录
-> 统一 Registry
-> 统一 Complete-World Dataset Package
-> 项目自有完整世界模型体系
-> 单一正式完整世界推理入口
-> Fresh Complete-Map Candidate
```

“单一正式完整世界模型体系”指只有一条取得正式候选资格的训练/推理主线，不等于提前写死只能存在一个神经网络。结构、过渡、对象、全局统一和分辨率能力可以在实验验证后由多个自有模块承担，但必须由同一任务包编排、共同输出一个完整候选，并接受同一套审核和版本谱系。

语义分类数据用于学习相应视觉规律，不等于推理时从目录中挑图拼接。正式推理必须根据当前完整任务包和条件张量生成新像素；不得复制原图、贴图、按目录合成、选择旧候选或把局部模型输出放大成完整地图。

## 3. VisualFactManifest

VisualFactManifest 只保存本轮画面需要的事实，并绑定 `manifestId`、`worldId`、`tick`、`dictionaryVersion`、来源 RuntimeFrame 和事实 hash。

当前允许类别：

```text
terrainFacts
waterFacts
pathFacts
shorelineFacts
vegetationFacts
objectFacts
spatialFacts
ecologyFacts
lightingFacts（存在真实事实时）
runtimeVisualStateFacts（当前范围允许时）
```

当前必须排除：管家、人格、玩家、建筑、施工、动物、昆虫和交互实现事实。缺失时间、天气或光照事实时必须显式记录缺失，不得由实现猜测。

每条视觉事实至少包含：`factId`、`factType`、`worldId`、`tick`、几何或空间关系、视觉意义、优先级、允许变化和禁止改变内容。

## 4. 世界导演

世界导演根据当前 VisualFactManifest、地图结构、视觉字典和历史失败生成结构化计划，不使用固定场景模板，也不只输出一段 prompt。

导演输出至少包含：

```text
sceneIntent
compositionPlan
focalHierarchy
terrainPlan
ecologyPlan
transitionPlan
objectPlan
lightingPlan
colorScript
detailDensityPlan
negativeSpacePlan
failureAvoidancePlan
reviewPlan
```

水体方向、道路阅读顺序、树木密度、中心位置和过渡关系必须来自当前事实与结构。导演不得新增世界中不存在的对象。

## 5. 视觉条件编译器

条件编译器把任务包和导演输出转换为模型可消费的张量与向量。数据字典不能只约束 Markdown 和审核器。

| 条件层 | 当前允许字段 |
|---|---|
| 大尺度结构 | terrain class、water body、path topology、shoreline、walkable、collision、depth、focal area |
| 中尺度生态 | open/wet/trampled/shadow grass、wet mud、dense boundary、quiet area、detail cluster |
| 自然过渡 | grass-path、grass-water、water-shore、tree-ground、rock-ground、wet-dry、shadow-light 距离图 |
| 对象与接地 | instance、type、footprint、height、contact shadow、ground disturbance、occlusion order |
| 视觉控制 | camera、light direction、palette、material density、edge softness、detail budget、style version |

二值 Mask 继续用于结构约束；距离图、实例图和连续值图负责表达过渡宽度、方向、湿度、接地和遮挡。字段只有在字典和任务包中正式定义后才能进入模型。

### 5.1 大世界连接条件

大世界连接首先是结构图契约，不是新增一套图片拼接逻辑。当前机器契约为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。

完整区域任务在声明“大世界连接覆盖”前，必须绑定 `connectivityBlueprintId`、`regionId`、`edgePortIds`、`pathGraphId`、`hydrologyGraphId` 和 `walkableGraphId`。编译器只能把已经批准的道路、水口、生态/海拔过渡和对象身份关系转换为向量、图特征、Mask 或距离图；不得根据 RGB、提示词或模型偏好创造连接口。

| 输入 | 模型允许学习的内容 | 模型禁止决定的内容 |
|---|---|---|
| 区域邻接与边界连接口 | 连接在视觉上如何自然延续 | 哪两个区域相邻、出口是否存在 |
| PathGraph / WalkableGraph | 道路宽度、边缘、磨损和视觉引导 | 可走性、碰撞、道路是否跨水 |
| HydrologyGraph | 河道、水岸、流向的视觉连续性 | 上游、下游、流量和地形高程事实 |
| ObjectIdentitySet | 同一对象在状态变化中的一致视觉身份 | 对象创建、删除、位置和生命状态 |

第一版具体区域连接已经按真实地球参照登记为 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`。项目所有者授权后，程序已把区域、邻居、边界连接口、道路延伸和水文/可走图迁移到 tick 2，并自动保存 `.runtime/world-connectivity-migrations/latest.json`；项目所有者审核通过后，程序生成 tick 3 和 `.runtime/world-connectivity-owner-reviews/latest.json`，状态固定为 `runtime_migrated_owner_approved`。现有 AI 辅助冷启动图片在未逐张绑定新蓝图并完成图片自身审核前，仍不能自动计入连接训练覆盖。

## 6. 模型能力边界

模型按能力分层，但不提前写死必须存在七个独立模型。实现可以在行为测试证明等价时合并能力。

| 能力 | 职责 | 当前约束 |
|---|---|---|
| 结构基础能力 | 学习草、水、道路、岸线和对象的大结构位置 | 低分辨率只用于结构预训练，不是正式画面 |
| 中尺度组织能力 | 学习湿草、踩踏、树荫、边界密植、留白和细节聚集 | 必须在未见结构上验证 |
| 自然过渡能力 | 学习地形、湿度、明暗和对象接地的连续变化 | 不能退化为硬切贴片 |
| 对象视觉能力 | 生成对象、接触关系、阴影和遮挡证据 | 对象不得漂浮、错位或遮挡路径 |
| 完整画面统一能力 | 统一构图、光照、色彩、边缘、锐度和材质语言 | 必须输出本轮完整地图候选 |
| 高分辨率像素风能力 | 原生输出 `1024×768` 完整高分辨率像素风地图 | 禁止低分辨率放大、局部图放大、tile/sprite 拼接和普通插画像素滤镜 |
| 审核学习能力 | 学习通过/拒绝、排序、失败区域和历史回归 | 机器通过不能替代人工终审 |

模型数量、网络类型、参数量和分辨率递进由实验与验收决定，不允许仅因文档示例写死。

## 7. 验证体系

训练集、验证集、挑战集和历史回归集必须按图片 hash 与结构 hash 隔离。

| 集合 | 用途 |
|---|---|
| train | 更新模型权重 |
| validation | 选择 checkpoint，不参与训练 |
| unseen-structure challenge | 验证未见道路、水岸、对象位置和区域组合 |
| regression | 阻止灰绿迷彩、胶带路、岸线硬切、对象贴纸、模糊和重复纹理复发 |

模型晋级必须证明：事实一致、结构正确、视觉质量提升、历史失败减少，并且不是通过降低阈值获得通过。

## 8. 当前实现状态

| 组件 | 状态 |
|---|---|
| VisualFactManifest | 已实现 |
| 动态世界导演与任务包 | 已实现 |
| 合法样本登记与不可变数据包 | 已实现程序能力；独立自研口径下的有效正、负样本均为 0，原 16 条第三方/旧模型负样本仅作历史证据 |
| 严格项目自有 IP 数据门禁 | 已实现 `strict-project-owned-training-data-v1`；独立样本必须校验原创方式、权利人、全球商业/训练/修改/转授权权利、第三方内容与生成模型禁用状态、权属证据文件和 hash |
| AI 辅助冷启动门禁 | 已获 owner 授权；OpenAI 生成原图必须进入独立谱系，保存生成器、提示词、授权、hash 与审核；不得声明独立数据或独立权重 |
| AI 辅助冷启动不可变数据包 | 已实现；程序从已审核原图库自动构建、复制图片、复核 hash、划分 train/validation/challenge/regression 并保存字典、来源政策和配置快照 |
| AI 辅助条件世界事实批次 | 已实现；项目所有者命令旧21套只作历史、不修补、不覆盖。程序按 `complete-map-scope-world-facts-v2` 使用全新标签 `complete-map-v2-001...021` 重建21套训练专用世界事实、导演输出、任务包与23通道条件包，固定 `sourceBlueprintReuse=false`、`historicalBatchMutation=false`。生成前蓝图快照不可变地保留 `pairedRgbCount=0`。项目所有者于2026-07-19审核通过当前正式001 V2后，程序重建并检查不可变数据包，严格确认21/21后置RGB与当前v2身份一致，未配对数为0。旧条件RGB及其审核链全部保留，但不得重绑v2新身份。所有构建失败、检查失败、成功报告、时间戳和hash均由程序自动保存 |
| AI 辅助 Autoencoder 预热入口 | 已实现并完成 `256×192 -> 512×384 -> 1024×768` 首轮渐进训练；后一阶段继承同一数据包的前一阶段项目 checkpoint，自动保存父 hash、四类 split 指标和重建对照图；不加载第三方权重，checkpoint 固定声明 AI 生成数据依赖、`denoiserTrained=false`、`formalInferenceEligible=false`。当前 1024 重建仍明显模糊，只能认定训练流程闭环，不能认定视觉能力通过 |
| AI 辅助 Pixel Detail Autoencoder v2 | 已获项目所有者调整授权并完成三级渐进训练；采用项目自有残差编码/解码结构、`1/4` 潜空间、12 潜通道和像素/边缘/Laplacian 损失。v2 使用独立配置、数据包快照、运行目录和 checkpoint schema，保留 v1 全部证据。统一 6 图审计显示 RGB/边缘/高频误差分别降低约 `58.19%/54.58%/48.79%`，PSNR 提升约 `8.39 dB`；项目所有者已确认达到进入后续条件训练准备的继续条件，但该确认不授予正式推理资格 |
| AI 辅助条件去噪器 V3 | 已获项目所有者算法修复授权。首张V2隔离验证在`complete-map-v2-014`上产生多色噪声并被机器拒绝；诊断确认潜空间尺度不一致、epsilon高时间步放大和浅层去噪器能力不足。V3复用Autoencoder v2，固定采用训练集逐通道潜变量归一化、`velocity_v1`预测、多尺度23通道条件U-Net、固定时间步验证和最佳checkpoint选择；已重新完成256×192、512×384、1024×768三阶段训练，最佳轮次分别为22、31、40。最终checkpoint hash为`684ecc29c74408038539c8f3fd62b3272611a0bd0e5ddd4ef3931ae16668659b`。同条件同seed无RGB诊断将解码饱和比例从V2的12.493%降至V3的1.1945%，但随后获owner单图授权的held-out验证仍生成高频噪声与层级坍缩图，并以`condition_terrain_path_ground_coverage_mismatch`被拒绝；V3固定为失败验证历史、`formalInferenceEligible=false`，不得继续训练或作为V4父checkpoint |
| AI 辅助条件去噪器 V4 | 已获项目所有者针对V3失败的修复授权。配置身份固定为`typed-condition-composite-objective-multiscale-unet-v4`：15个离散通道只用nearest-neighbor，8个连续通道只用bilinear；训练同时计算velocity MSE、clean latent L1、clean latent gradient L1、离散条件重建BCE和连续条件重建L1；best checkpoint只按固定验证网格复合条件质量分数选择。配置、模型、训练器、采样器和审核器已通过静态检查、CPU前向/反向及历史V3失败图回归。项目所有者授权的stage 0冒烟runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`已通过，程序保存的checkpoint SHA-256=`f7e00f80035d8986546ed4004b68647852a83df8d43c99b0ef40e28787910c63`；该checkpoint只证明程序可运行，固定`formalInferenceEligible=false`。正式渐进训练和V4 RGB验证尚未执行 |
| 视觉条件编译器 | v1 已实现 23 个 1024×768 单通道源条件和结构化向量；离散通道 nearest-neighbor、连续通道 bilinear 对齐到各训练阶段，最终原生条件保持 `1024×768`，不产生 RGB 候选 |
| 历史第三方 bootstrap 证据 | SD 1.5 + ControlNet Segmentation 结果已隔离为历史实验；不再由完整世界主入口运行，不进入独立自研训练计数 |
| bootstrap 机器审核 | 已实现 VJ-0/VJ-1/VJ-2/Professional 四级记录；当前首图机器拒绝 |
| 项目自有扩散训练程序 | 已实现；读取独立数据包和配套 23 通道条件包，按自编码器、条件去噪器两阶段训练并自动保存 checkpoint 谱系；当前因独立样本为 0 阻断 |
| 当前任务包驱动的AI辅助隔离验证采样器 | `run:ai-assisted-conditional-inference-validation` 已实现；只接收当前生效版本的最终1024 AI辅助checkpoint、held-out任务包、23通道和项目所有者本轮单图命令，离散条件使用nearest-neighbor、连续条件使用bilinear；生成后自动调用`review:ai-assisted-conditional-inference-validation`执行VJ-0/VJ-1/VJ-2、风格指纹、构图新颖性、专业审美、审核hash和失败学习；固定`formalCandidate=false`、`runtimeFrameEligible=false`。V2与V3验证均已执行并拒绝；V4尚无checkpoint，当前不得运行V4 RGB验证 |
| 原生正式分辨率新候选 | 当前无项目独立权重生成的 `1024×768` 高分辨率像素风完整候选；历史第三方 1024×768 bootstrap 只作隔离证据，分辨率相同不代表资格相同 |
| 专业审美学习模型 | 本地CLIP语义初审继续只作辅助。Professional Aesthetic v2新增由owner已批准基础完整地图自动校准的多尺度纹理上限、安静区域和层级检查；不加载外部审美权重。历史V3失败图回归能检出`professional_multiscale_texture_noise_overload`与`professional_quiet_region_missing`。该门禁仍不能代替owner终审，且尚需在未来V4验证图上持续验证 |

当前不得继续 V152、V153 式旧数据集盲目续训。下一实现目标只能来自当前执行指南。

AI 辅助 Autoencoder 预热和正式完整世界扩散训练不是同一成功状态。前者只学习已审核 RGB 的视觉压缩与重建基础；它不消费 WorldState、世界导演、23 通道条件或连接契约。当前三级渐进预热已经证明数据读取、项目权重继承、CUDA 训练、指标、重建证据和 checkpoint 谱系能够自动运行，但原生 1024 重建仍丢失大量像素细节。继续调整 Autoencoder 容量、结构或损失属于模型调整，必须先由项目所有者批准；不得靠重复增加轮次冒充能力提升。只有后续真实条件绑定闭合、条件训练门槛获得项目所有者批准、条件去噪器完成训练并通过正式审核后，才可能形成任务包驱动的完整地图模型。任何 AI 辅助预热 checkpoint 都不得被正式推理入口当作 `project_owned_independent_weights`。

2026-07-18 的v2条件世界事实整体重建不改变上述结论。21套新条件包建立“世界事实和导演意图应如何进入模型”的训练输入侧，旧批次RGB继续保持原历史身份，不能事后与v2条件配对。项目所有者已逐图命令并审核完成21套后置新RGB；生成来源、条件包hash、任务包hash、图片hash与审核记录均由程序保存。项目所有者于2026-07-19批准21套作为第一轮AI辅助条件去噪训练数量门槛、批准Autoencoder v2达到继续条件，并批准大世界连接覆盖最低27条正样本、27条负样本且9个覆盖轴各不少于3正+3负。连接覆盖已由程序自动建立并复核为27正、27负、九轴各3正+3负；V3条件去噪器已完成三个40轮渐进阶段，但held-out视觉验证失败并暴露训练目标与专业审美漏判问题。项目所有者随后授权V4程序修复和stage 0冒烟训练；冒烟已经由正式控制器执行并自动保存全部规定证据。下一步是获得项目所有者明确授权后执行V4 stage 0正式渐进训练，而不是继续V3、直接运行V4 RGB或把冒烟checkpoint当成训练完成。任何V3/V4 checkpoint和验证图均不得自行晋级正式候选或Runtime。

项目所有者已批准首轮 v2 调整并完成继续条件视觉验收。v2 的目标只是在相同已审核数据上验证细节重建是否优于 v1，不改变完整世界业务路线，不增加第三方权重，也不授予正式推理资格。程序已经保存 v1/v2 重建证据、统一指标报告和项目所有者批准记录；后续阻断来自连接覆盖样本不足，而不是继续重复Autoencoder预热。

历史 bootstrap 证据（仅审计，不属于正式执行步骤）：

```text
npm run run:current-world-foundation-bootstrap-inference
npm run run:current-world-foundation-candidate-batch
npm run check:current-world-bootstrap-inference
npm run review:current-world-bootstrap-candidate
npm run check:current-world-bootstrap-machine-review
.runtime/ai-painter/complete-world-visual-bootstrap-inference/
.runtime/ai-painter/complete-world-visual-machine-reviews/
```

任何历史 bootstrap 图都固定 `canEnterWorld=false`、`canCountAsPositiveSample=false`、`independentTrainingEligible=false`。后续即使人工认为其画面可用，也不得将它转入独立自研训练包。

当前 V28/V151 bootstrap 已实测连续两次输出相同图片 hash。机器审核必须把跨 run 重复图片记录为 `vj0_output_not_novel_across_runs`；在模型具备有效 seed/latent 候选变化前，不得靠重复执行累计伪候选数量。

当前 foundation bootstrap 使用时间戳绑定 seed，直接生成原生 `1024×768` 候选，并保存失败反馈输入。它已解决旧 checkpoint 固定图和重采样预览问题，但只把 6/23 条件编译为 ControlNet segmentation 输入，仍由 `vj2_current_condition_vocabulary_not_consumed` 阻断，不能替代未来完整条件模型。

第三方预训练模型边界固定如下：SD 1.5、ControlNet 和 LAION CLIP 只作为隔离的历史实验证据，不得进入正式生成、正式训练或正式模型晋级链路。历史权重来源、固定 revision、许可证、文件 hash 和本地路径继续保留以便审计，但完整世界主入口不再调用它们。

## 9. 历史第三方逻辑与独立自研路线

### 9.1 SD 1.5 在历史实验中做什么

SD 1.5 是第三方潜空间扩散模型，当前只提供像素生成先验。其推理逻辑固定为：

```text
世界导演结构化输出
-> 项目编译的受限文本约束
-> 第三方 tokenizer / text encoder 转换为文本向量
-> seed 生成潜空间初始噪声
-> 第三方 U-Net 在多个去噪步骤中预测噪声
-> scheduler 逐步更新潜变量
-> 第三方 VAE 把最终潜变量解码成 RGB 图片
```

SD 1.5 不读取 WorldState，也不理解项目的 23 通道字典。它只理解自身预训练获得的通用文本与图像先验。因此，它能“生成像素”，但不能单独保证世界事实、可走性、碰撞、对象数量和专业游戏地图质量。

### 9.2 ControlNet Segmentation 在当前链路中做什么

ControlNet 是第三方结构控制网络。原始方法保留一份锁定的扩散主干，使用可训练的编码分支读取空间条件，再通过零初始化卷积将条件残差注入 U-Net 各层。

当前项目实际路径是：

```text
23 通道条件包
-> 只取 terrain_grass / water / shoreline / path / tree / rock
-> 转换为 ADE20K 语义分割颜色图
-> ControlNet Segmentation 提取结构特征
-> 将结构残差注入 SD 1.5 U-Net
-> 输出受部分结构约束的新图
```

它当前只消费 6/23 条件。距离图、实例图、可走层、碰撞层、焦点、湿度、接地和遮挡等项目条件并未进入该网络。这是当前道路墙体化、水体丢失、对象碎片化和整体构图失控的主要架构原因之一。

### 9.3 项目自有与第三方边界

| 能力 | 当前归属 |
|---|---|
| 世界事实、数据字典、世界导演 | 项目自有 |
| 23 通道条件编译、任务包和失败回写 | 项目自有 |
| 自动存储、机器审核、owner 终审和 `/world` 门禁 | 项目自有 |
| SD 1.5 tokenizer、text encoder、U-Net、VAE 权重 | 第三方 |
| ControlNet Segmentation 结构控制权重 | 第三方 |
| 历史候选图的底层像素先验 | 第三方权重提供，已从正式路线隔离 |

“下载到本地”只代表本地执行，不代表权重自研。

### 9.4 独立自研的固定阶段

| 阶段 | 正式内容 | 硬门禁 | 当前状态 |
|---|---|---|---|
| A 世界条件 | 世界事实、导演与 23 通道条件 | 不生成 RGB，不猜测缺失事实 | 已实现 |
| B 自有架构 | 项目自有条件编码器、潜空间自编码器、条件去噪器、扩散训练器和采样器 | 随机/自主初始化，不加载第三方生成权重 | 已实现并通过架构检查，未训练 |
| C 独立数据 | 权利清晰的项目训练数据 | 不使用第三方权重、激活或输出做模仿性转移 | 缺失 |
| D 独立训练 | 自有自编码器、去噪器和条件编码器两阶段训练 | checkpoint 必须保存独立来源谱系 | 程序已实现，被独立数据缺口阻断 |
| E 正式推理 | 当前世界任务包直接驱动自有权重 | 未见结构、事实一致和专业审核全部通过 | 采样程序已实现，被 checkpoint 与数据缺口阻断 |

第三方模型不是迁移起点，只是已隔离的历史对照。正式路线从项目自有架构和自主初始化开始。

### 9.5 许可证与“完全自研”判定

基于第三方权重微调、LoRA、ControlNet、参数转移或蒸馏产生的模型，默认属于第三方模型的派生路线。CreativeML Open RAIL++-M 对“模型派生物”的定义还明确覆盖了将权重、参数、激活或模型输出转移给新模型以使其表现相似的情况，包括使用该模型合成数据训练新模型的蒸馏。

因此，如果未来目标是“不依赖第三方权重且可独立声明权利”，项目必须单独保存：随机/自主初始化证据、训练数据权利链、数据 hash、不使用第三方权重/激活/输出的训练证据和完整 checkpoint 谱系。商业发布前还需进行专业法律复核；本文档是工程来源治理规则，不是法律意见。

原始依据：

- Latent Diffusion：`https://arxiv.org/abs/2112.10752`
- ControlNet：`https://arxiv.org/abs/2302.05543`
- CreativeML Open RAIL++-M：`https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/main/LICENSE.md`

## 10. 条件编译器证据

```text
npm run compile:current-world-visual-conditions
npm run check:current-world-visual-conditions
.runtime/ai-painter/world-visual-generation-task-packages/<taskId>/compiled-conditions/
```

当前缺少权威几何来源的 `depth`、`contact_shadow`、`ground_disturbance` 和逐像素 `occlusion_order` 不允许猜测；编译器必须保存为 `unavailable_authoritative_source_missing`。这些缺口只能由后续真实世界事实或结构契约补充。

## 11. 禁止事项

1. 禁止建立“项目内部视觉教师”或其他新名词，让程序直绘图承担专业视觉教师。
2. 禁止把程序纹理、SVG、Canvas、CSS、几何图或规则渲染图计为专业完整地图正样本。
3. 禁止复用旧 `generated.png`、旧 RuntimeFrame 或放大图冒充本轮推理。
4. 禁止局部材料模型取得完整地图主入口地位。
5. 禁止写死未经实验确认的模型数量、数据规模和工期。
6. 禁止第三方在线绘图 API 进入正式链路。
7. 禁止对像素候选使用双线性、双三次、AI 超分或抗锯齿缩放后冒充正式像素画面。
8. 禁止把 tile 拼接、重复 stamp、局部 sprite 放大或旧 `256×192` 材料槽冒充原生完整像素地图。
