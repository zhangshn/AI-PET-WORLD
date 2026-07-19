# 训练数据与来源正式规则

更新时间：2026-07-19 11:53:41 +08:00

状态：active-architecture / 当前数据缺口硬门禁 / 正式样本仍不足

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 数据原则

训练数据必须是可追溯、可复现、可审核的程序资产。文件数量、历史 JSON 数量、重复样本和缺少正式记录的图片不能计入数据充足度。

程序可以生成世界事实、Blueprint、Mask、距离图、对象实例图、可走层、碰撞层和调试预览；程序直绘图不能作为专业完整地图正样本，也不能进入 `/world`。

第一版正式本地模型 RGB target 采用原生 `1024×768` 2D 高分辨率像素风完整画布。正式 target、正式候选、owner review 和 Runtime 必须具备统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性；普通数字插画、仅套像素滤镜的图片、低分辨率自动放大图、tile/sprite 拼接图均不能取得正式资格。训练内部可以使用渐进分辨率，但最终正式输出只计本地模型原生 `1024×768` 文件一次。

完整地图训练资格同时要求完整地图范围。只有单一河段、单一道路、单一池塘、单一林间空地、单一材质范围或放大局部生态单元的全画布图片，统一标记为 `local_scene_not_complete_map`；即使尺寸、来源、hash、23通道和像素风检查通过，也不得计入完整地图 target、`completeMapPositive` 或自主生成训练原图。此类图片只能作为局部视觉知识、负样本或审核失败证据保存。完整地图必须绑定整体入口/出口关系、家园中心、连续道路组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；水体只按当前世界事实出现，不得把东南亚档案解释成固定水体构图模板。

任何新 RGB 的生成都要求“正式文档具体任务 + 项目所有者本轮明确命令”双重授权。程序不得因样本不足、编号空缺、蓝图待处理、失败修复或自动循环而自行出图或批量出图；范围不明、重复风险、局部图风险和待人工审核状态均必须在调用生成算力前阻断。

冷启动基础完整地图原图必须先作为集合建立版本化完整地图视觉标准，不能只用于页面展示，也不能逐张作为后续生成器的图片参考。该标准只能保存经来源与审核身份约束的聚合数值、结构统计和文字契约；至少覆盖镜头/世界尺度、整体构图层次、入口—中心—道路关系、空间与生态分区、水体分布变化、对象尺寸/密度及像素视觉语法。后续条件训练样本仍必须由当前世界事实、世界导演、23通道与本轮新 RGB 真实配对形成。历史完整地图 RGB 不得用于反推世界事实或复制构图。

数据一致性要求固定为“视觉语言统一、构图样本多样”。使用相同水体、道路、分区和整体布局，仅替换植被、颜色、天气或装饰，不能计作新的完整地图正样本；必须写入 `complete_map_composition_diversity_failed` 或对应重复记录。

## 2. 允许的视觉来源

| 来源 | 默认处理 |
|---|---|
| 项目所有者原创图片 | 通过 `strict-project-owned-training-data-v1` 来源、权属、hash 和质量审核后可进入候选样本 |
| 委托原创且完整权利已书面转让给项目所有者的图片 | 提供权利转让协议证据并通过严格 IP 审核后可进入候选样本 |
| 项目独立权重模型生成且 owner approved 的完整地图 | 完成独立来源审计后可作为正样本 |
| 项目独立权重模型生成且 owner rejected 的图片 | 只能进入负样本或隔离区 |
| 外部图片或外部模型输出 | 默认禁止；只有项目所有者明确改变来源政策并完成许可审计后才能使用 |
| OpenAI 或其他在线生成图片 | 严格独立训练链禁止；只有符合 `owner-authorized-ai-assisted-cold-start-v1` 的记录可进入单独 AI 辅助冷启动通道 |
| 程序规则渲染、占位图、结构预览 | 只能用于结构调试或条件验证，不是专业 RGB 目标 |
| 来源不明、许可不明、hash 不一致 | `blocked_source` |

项目所有者已明确授权 `owner-authorized-ai-assisted-cold-start-v1`。OpenAI 辅助生成的高分辨率像素风图片可以进入独立的 AI 辅助冷启动通道，但必须标记 `thirdPartyGenerativeModelUsed=true`、`independentTrainingEligible=false`，保存生成器、完整提示词证据、owner 授权、文件 hash、机器审核和人工审核。只有 owner 审核通过后才能标记 `aiAssistedColdStartEligible=true`；由此训练的 checkpoint 必须声明 AI 生成数据依赖，不得冒充 `project_owned_independent_weights`。原严格项目自有数据通道继续并存。

2026-07-16 项目所有者进一步批准 `owner-approved-high-resolution-four-three-derivative-v1`。该契约仅用于 Codex 内置图像生成的 AI 辅助冷启动来源：生成器原始文件必须精确 4:3 且不小于 `1024×768`，必须原样不可变保存；程序只能以 nearest-neighbor、无裁切、无放大生成 `1024×768` 训练/机器审核派生图。原图和派生图必须保存独立路径、尺寸和 SHA-256；派生图固定 `formalCandidate=false`、`runtimeFrameEligible=false`、`directWorldDisplayAllowed=false`、`independentTrainingEligible=false`。该例外不改变正式本地模型原生 `1024×768` 输出契约。

两条训练谱系固定分离：

| 通道 | 数据资格 | checkpoint 声明 |
|---|---|---|
| AI 辅助冷启动 | `aiAssistedColdStartEligible=true`、`independentTrainingEligible=false`、完整 OpenAI 来源与 owner 授权 | `project_owned_architecture_ai_assisted_cold_start_weights` |
| 纯项目独立训练 | `independentTrainingEligible=true`、`strict-project-owned-training-data-v1` | `project_owned_independent_weights` |

## 3. 样本类型

```text
bootstrap_structure
material_training
transition_training
object_grounding_training
complete_map_training
owner_approved_positive
owner_rejected_negative
machine_negative
judge_gap_negative
blocked_source
```

`bootstrap_structure` 可以使用程序生成的结构条件，但不能因此获得专业视觉正样本资格。拒绝图不能作为正常 RGB target。

`machine_negative` 只允许登记 VJ-0/VJ-1/VJ-2/Professional 任一机器闸门明确拒绝的本地模型完整地图。它必须保存机器审核记录，固定 `ownerReviewStatus=not_reached_machine_failed`、`rejectedBy=complete_map_machine_review`、`trainingUsage=negative` 和 `mustNotTrainAsPositive=true`，不得伪造项目所有者拒绝。

原图接收层固定为 `data/world-samples/original-image-library/natural-home-v1/`。程序通过 `intake:original-image` 自动复制原图和证据、计算 hash、写不可变记录并更新索引。原图接收不是样本登记：新记录只能是 `intake`，命中第三方内容、第三方生成模型、复制作品或未知来源时自动成为 `blocked`；任何记录均不得在未完成后续审核和正式登记前进入训练数据包。

旧 checkpoint 和第三方权重候选仅保留为历史实验证据。它们不得进入独立自研数据计数、正式训练包、正式 checkpoint 晋级或 `/world`。

## 4. 单条样本合同

每张图片必须绑定：

```text
sampleId
worldId / tick（适用时）
dictionaryVersion
directorPlanId
taskPackageId
blueprintHash
conditionHashes
conditionPackPath
imagePath / imageSha256
sourceType / sourcePath / sourceLicense
modelVersion / checkpoint / seed（模型输出时）
ownerReviewStatus
machineReviewStatus
labels / failureCodes / affectedRegions
trainingUsage
createdAtUtc / createdAtAsiaShanghai
```

正式计数还必须满足：真实图片存在、hash 匹配、样本 ID 和图片 hash 唯一、标签完整、审核完成、绑定当前字典版本。声明 `independentTrainingEligible=true` 的样本还必须绑定可读取的 `conditionPackPath`，且条件包通道顺序与项目自有模型配置完全一致。

独立训练样本必须使用 `ipProvenance.policyVersion=strict-project-owned-training-data-v1`，并由程序验证：权利人身份、原创方式、全球商业使用权、模型训练权、修改权、转让或再许可权、原创源文件、权属证据路径与 hash。`thirdPartyContentUsed`、`thirdPartyGenerativeModelUsed` 和 `copiedFromExistingWork` 必须全部为 `false`。普通“获准训练”但没有完整权利转让的图片不得声明独立训练资格。

正式入口：

```text
npm run build:original-image-intake-template
npm run intake:original-image -- --request <original-image-intake-request-v1.json>
npm run check:original-image-library
npm run build:project-owned-sample-intake-template
npm run register:complete-map-training-sample -- --request <registration-request.json>
npm run check:project-owned-training-data-ip-policy
npm run check:complete-map-training-sample-registry
```

模板生成程序一次输出 `complete-maps`、`terrain`、`vegetation`、`natural-objects` 和 `transitions` 五份请求模板及统一 manifest。任何后续实现不得把模板入口退回只输出完整地图类别。

模板只绑定当前任务包和23通道条件，不产生 RGB，也不计入样本。未完成机器审核、owner视觉审核或IP审核的请求必须被程序拒绝并自动保存拒绝记录。

正式登记同时执行感知差异去重。SHA-256 不同但感知结构近重复的噪声变体只能保留推理与审核证据，不能重复增加样本数量。

## 5. 数据包结构

```text
dataset-package/
├─ manifest.json
├─ source-index.json
├─ splits/
│  ├─ train.json
│  ├─ validation.json
│  ├─ challenge.json
│  └─ regression.json
├─ positive/complete-map/
├─ negative/complete-map/
├─ transition/
├─ object-grounding/
├─ blocked/
└─ reports/data-sufficiency-audit.json
```

数据包版本发布后不可覆盖。修复标签、替换图片或改变分组必须生成新版本并保留父版本引用。

正式程序入口：

```text
npm run register:complete-map-training-sample -- --request <registration-request.json>
npm run check:complete-map-training-sample-registry
npm run build:current-complete-map-dataset-package
npm run check:current-complete-map-dataset-package
```

登记程序负责复制留存图片、计算 SHA-256、写入时间戳和不可变记录。登记请求必须提供来源类型、许可、当前字典版本、任务与导演身份、Blueprint/条件 hash、机器与人工审核状态、标签、用途和 split。程序不得替项目所有者生成许可、审核结论或专业正样本。

当前正式位置：

```text
data/world-samples/registry/<dictionaryVersion>/
data/world-samples/dataset-packages/<packageId>/
```

数据包必须绑定字典快照、导演与任务快照、条件 Manifest、审核规则快照和最新严格审计。`train`、`validation`、`challenge`、`regression` 必须按图片 hash、Blueprint hash 和条件 hash 隔离。

### 5.1 AI 辅助冷启动数据包与训练边界

AI 辅助冷启动数据包固定保存到：

```text
data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/
```

程序只能从原图库索引读取 `aiAssistedColdStartEligible=true`、`independentTrainingEligible=false`、机器审核通过且项目所有者审核通过的不可变记录。构建时必须重新核验图片、提示词证据、审核记录和 SHA-256，并复制到新的不可变版本；不得直接从页面、聊天记录或临时附件训练。

当前 AI 辅助冷启动数据中，旧批次条件配对只作历史证据；当前 `complete-map-v2-001...021` 已形成21套新的原图、任务包、23通道条件、机器审核和owner审核同一身份配对。其他已审核完整地图继续只允许执行项目自有 Autoencoder 视觉预热。地形、植物、自然物品和过渡/接地图当前只作为 `visual_knowledge_reference` 保存，不能伪装成完整地图 target。Autoencoder 预热不消费世界任务包，不训练条件去噪器，不生成正式候选，也不能取得 Runtime 或 `/world` 资格。

项目所有者已于2026-07-18命令保留旧21套条件蓝图为历史、不进行修补，并根据“原图生成前已经保存的提示词意图 + 锁定世界档案 + 地球参数快照 + 已批准连接事实”以全新身份整体重建。程序已通过 `npm run build:ai-assisted-conditional-world-facts` 自动生成并保存 `complete-map-v2-001...021` 共21套世界事实蓝图、导演输出、任务包和原生 `1024×768` 的23通道条件包，并由 `npm run check:ai-assisted-conditional-world-facts` 与 `npm run check:ai-assisted-complete-map-scope` 校验为21/21通过。该生成前批次固定 `generationContractVersion=complete-map-scope-world-facts-v2`、`sourceBlueprintReuse=false`、`historicalBatchMutation=false`、`sourceImageGeometryRead=false`、`existingRgbBoundToGeneratedConditions=false`、`pairedRgbCount=0`，用来证明条件不是由RGB反推；该字段不得在出图后回写。2026-07-19项目所有者审核通过当前正式001 V2后，程序重建并检查不可变数据包，按任务包、条件包和hash严格确认当前v2后置RGB配对21/21，未配对数为0；旧版本RGB和审核仅作历史，不得自动重绑。

固定程序入口：

```text
npm run build:ai-assisted-cold-start-dataset-package
npm run check:ai-assisted-cold-start-dataset-package
npm run check:ai-assisted-complete-world-model
npm run train:ai-assisted-complete-world-model -- --resolution-stage 0
```

AI 辅助 checkpoint 必须声明：

```text
ownership = project_owned_architecture_ai_assisted_cold_start_weights
trainingLane = ai_assisted_cold_start
thirdPartyWeightsLoaded = false
thirdPartyGeneratedTrainingOutputUsed = true
aiGenerationDependencyDeclared = true
denoiserTrained = true
formalInferenceEligible = false
```

上述条件蓝图之后的新RGB已有21张项目所有者通过记录，并已全部满足正式v2任务包、23通道条件包和hash完全一致的真实配对；最新严格复核结果为21/21，未配对数为0。项目所有者已批准21套作为第一轮AI辅助条件去噪训练数量门槛，并批准Autoencoder v2达到继续条件。大世界连接覆盖门槛固定为至少27条正样本、27条负样本且9个覆盖轴各不少于3正+3负；程序现已自动保存并复核27正、27负连接记录，9轴全部达到3正+3负。AI辅助数据包连接门禁已打开；项目自有23通道条件去噪训练程序已完成单批次冒烟和256×192、512×384、1024×768三个40轮渐进阶段，最终checkpoint仍为待验证状态。隔离的AI辅助单图推理验证入口已经实现并通过模型合同检查，只允许使用validation、challenge或regression split，并要求项目所有者提供本轮具体单图命令；所有输出固定为非正式候选、非Runtime。冒烟checkpoint、阶段checkpoint、验证图和门禁打开均不得误报为正式推理或Runtime成功。下一步只允许执行一张未见结构推理验证；任何单张验证RGB必须另获项目所有者对本轮具体生成的明确命令。程序不得根据已有图片反推世界事实、把未配对蓝图冒充训练样本、自动重绑旧RGB或自行改变门槛。

条件后置 RGB 生成完成后必须通过 `finalize:ai-assisted-conditional-rgb` 进入既有原图库接收层，并由该入口自动调用 `run:ai-assisted-cold-start-review-pipeline`。AI辅助高分辨率来源必须使用同一 `recordId` 保存原始图 hash、训练派生图 hash、派生政策版本、无裁切/无放大证据和审核链；统一事件总账与原图库记录使用1024×768训练派生图身份，且必须能追溯到不可变原图。任何只保存图片但没有机器审核、总账事件和后续审核状态的记录都不能计入训练数据。项目所有者拒绝后，程序必须固定 `trainingEligibility=owner_rejected`、`aiAssistedColdStartEligible=false`、`independentTrainingEligible=false` 并保存不可变失败学习记录。生成前失败也必须由 `record:ai-assisted-conditional-rgb-generation-failure` 保存失败码、路线、UTC、北京时间和证据路径，不得保存 API Key 或其他秘密。

条件后置 RGB 的季节与环境输入统一使用 `world-visual-environment-context-v1`。该对象必须由来源记录和锁定环境快照共同生成，并以同一身份贯穿世界事实蓝图、世界导演输出、完整任务包、生成请求和自动检查；至少包含 `season`、`monsoonPhase`、`environmentState`、`weather`、`lighting`、`groundMoisture`、`visibility` 和 `sourceSnapshotId`。所有条件共用同一请求编译算法；该算法还必须按 `regionalLandscapeType` 读取 `coverage-blueprint.json` 的区域生态档案，将 `requiredFeatures` 和 `optionalFeatures` 写入提示证据和请求。统一编译器必须读取版本化基础完整地图视觉标准的聚合数值/文字档案、当前23通道hash和道路期望覆盖比例，不得读取历史完整地图 RGB；当前请求契约固定为 `dynamic_complete_map_scope_plus_foundational_visual_standard_plus_world_facts_director_23_channels_v9`。生成前必须执行完整地图范围门禁；缺少入口/出口、家园中心、连续道路、多空间/生态分区、自然边界或大世界连接证据时，以 `local_scene_not_complete_map` 自动保存阻断。同一条件重试必须保存项目所有者授权原因，并固定不能修改世界事实、条件几何或审核门槛。不得把雨季、旱季或湿度文字写死。来源记录季节与快照季节不一致、请求文字与环境对象冲突、无水条件请求新增水体时，必须在图像生成前失败并自动保存失败记录。

机器审核的颜色分类器必须覆盖雨季和旱季两种地表。若通用道路暖色阈值将大面积金黄色旱季草层误判为道路，程序必须保留候选失败记录并阻断晋级；修复必须改进道路/草层的实际分类方法并对历史通过图、拒绝图和不同季节执行回归，不得只放宽空间、覆盖或风格阈值让当前图片通过。

当前道路识别版本固定为 `season_aware_local_color_signal_plus_8x6_spatial_mass_and_centroid_v2`。旱季分类必须证明006 V2的低对比道路仍失败、006 V3的红棕土路与草层分离后通过；雨季分类必须证明001 V2和005 V2继续通过，历史拒绝002 V1继续失败。机器重审必须把旧审核保存到 `reviews/machine/<reviewId>.json`，不得覆盖历史失败证据。

### 5.2 条件编号推进与防重复规则

条件后置 RGB 必须按“一个条件蓝图、一个当前审核身份”推进，不能把版本号递增当作任务进度。固定规则如下：

| 情况 | 程序行为 |
|---|---|
| 未显式提供 `--source-record-id` | 生成前阻断；不得默认回到001、002或任何历史条件 |
| 同一条件已有 `pending_review` 图片 | 生成前阻断并保存顺序阻断记录；`computeStarted=false` |
| 同一条件已有 `owner_approved` 图片 | 生成前阻断并推进其他未尝试条件 |
| 同一条件已有拒绝或失败历史 | 默认禁止自动重试；必须有项目所有者明确重试授权和非空原因 |
| 不同 SHA 但同一条件反复生成 | 仍属于同一条件重试，不得按新数据任务计算进度 |
| 历史完整地图被作为新图的图像参考 | 生成前阻断；生成器只允许接收当前条件引导图，风格只由版本化基础完整地图聚合标准提供 |
| 新图命中历史完整地图或项目所有者已拒绝构图 | 机器审核自动拒绝，保存相似记录ID、指标、失败码和下一训练目标；不得自动重试当前条件 |
| 当前条件审核完成 | 默认选择条件蓝图清单中尚未尝试的下一条，不按缺失编号自行创建任务 |

编号防重复检查入口固定为 `npm run check:ai-assisted-conditional-rgb-sequence`，构图重复回归入口固定为 `npm run check:ai-assisted-composition-novelty`。生成请求必须保存 `historicalCompleteMapImageReferencesUsed=false`、空的历史风格图引用和唯一条件引导图路径。顺序阻断记录保存在 `.runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/sequence-blocks/`；不得修改或删除既有图片、请求、审核和失败历史。

## 6. 当前最低门槛

第一版原图覆盖必须绑定 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`，并区分以下数据轴：

| 原图类别 | 必须绑定的覆盖轴 |
|---|---|
| 完整地图 | worldId、worldSeed、结构布局、季风季节、环境状态、完整任务包 |
| 地形 | terrainType、monsoonSeason、moisture、growth/wear state |
| 植物 | plantKind、speciesId、lifeStage、monsoonSeason、health、resourceState、visualVariant |
| 自然物品 | objectKind、environmentState、groundingState、visualVariant |
| 过渡与接地 | transitionKind、两侧材料状态、季风季节、湿度、正负极性 |

### 6.1 分类、上下文与统一打包规则

五类原图库是并行的主要分类，不能被文档、脚本或智能体解释成五个训练阶段。每条原图记录只保留一个主要 `categoryId` 以保证物理身份稳定；完成正式审核与登记时，可以在 Registry 中附加多个经过区域级证据支持的语义标签，但不能复制同一图片到多个目录重复计数。

| 规则 | 固定要求 |
|---|---|
| 并行获取 | 完整地图、地形、植物、自然物品和过渡数据可以同时建设，不规定先后完成顺序。 |
| 上下文保留 | `terrain`、`vegetation`、`natural-objects`、`transitions` 原图可以保留完整环境上下文，不要求制作孤立贴片。 |
| 裁切限制 | 裁切只用于可追溯标注、条件构建和审核证据，必须绑定父图 hash 与区域坐标；不能作为无来源的独立正样本。 |
| 统一登记 | 五类通过审核后统一进入 `registry/<dictionaryVersion>/`，不建立五套相互独立的正式样本库。 |
| 统一数据包 | 数据包同时组织完整构图知识和语义视觉知识，并按 train、validation、challenge、regression 隔离。 |
| 统一模型主线 | 正式训练和推理由完整世界模型体系消费统一数据包；目录分类不决定模型数量。 |
| 禁止拼接 | 推理不得从五类目录复制、选取、缩放或机械拼接图片作为完整地图候选。 |

### 6.2 大世界连接训练数据

完整地图记录只有绑定已批准的区域连接事实后，才能声明具有大世界连接训练资格。机器契约固定为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。

| 字段 | 作用 |
|---|---|
| `connectivityBlueprintId` | 指向项目所有者批准、程序登记的具体世界连接蓝图 |
| `regionId` | 标识本图对应的大世界区域 |
| `edgePortIds` | 标识道路、水系、生态和海拔在边界上的批准连接口 |
| `pathGraphId` | 绑定入口、中心、出口和跨区域道路关系 |
| `hydrologyGraphId` | 绑定河流、溪流、池塘、流向、上游与下游关系 |
| `walkableGraphId` | 绑定可走连通分量与碰撞关系 |
| 正负连接标签 | 保存连续连接、断路、断水、孤立区域、邻接冲突和对象身份中断等证据 |

第一版连接蓝图已经登记为 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`，Runtime 连接事实已迁移到 tick 2，并经项目所有者审核后写入 tick 3。项目所有者已批准连接覆盖最低27条正样本、27条负样本，9个覆盖轴各不少于3正+3负。程序已在 `data/world-samples/world-connectivity/coverage/` 自动保存并机器复核27正、27负结构化连接监督记录，九轴全部达到3正+3负；这些记录不含RGB、不修改Runtime世界事实。现有 AI 辅助冷启动原图即使通过视觉审核，也只属于视觉冷启动数据，不得仅凭图片视觉内容计入连接覆盖。

20 条 `completeMapPositive` 是完整地图类别的最低门槛，不是第一批唯一任务，也不是全部训练数据规模。390 个热带季风植物视觉覆盖单元和过渡、接地、负样本、漏判数据与完整地图样本共同构成数据充足度；各类可以并行积累，但任何门槛不足时统一数据包仍保持阻断。

五类当前知识内容、正式字典引用、第一轮雨季雨后状态词表、现有门槛和禁止对象统一保存在：

```text
data/world-samples/original-image-library/natural-home-v1/parallel-visual-knowledge-catalog-v1.json
```

该文件是机器可读内容目录，不是图片任务队列，也不代表已经存在原图。`check:original-image-library` 必须验证五类完整、字典 ID 可解析、植物目录数量一致、并行获取规则存在且机械拼接固定禁止。

不能把所有组合做机械笛卡尔积。物种目录完成后，由覆盖蓝图选取关键生命周期、雨季/旱季及转换期基准、健康/资源特殊状态和未见组合挑战集；每条原图仍必须遵守来源、hash、审核和 split 隔离规则。当前机器可读蓝图固定在 `data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json`。

项目所有者已经确认第一版采用现实地球物种，并把区域基准锁定为东南亚大陆热带季风低地、河谷和丘陵生态参照包络。第一版机器可读世界档案与物种目录固定在：

```text
data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json
data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-species-catalog-v1.json
```

当前目录包含 12 个现实物种：5 种乔木、2 种灌木、2 种草本/竹类、2 种花草和 1 种水岸苇类。外部植物学资料只用于核对正式学名、接受状态和地理分布，不授予、推定或替代任何图片训练权；权威站点中的图片禁止自动接收，除非另行完成项目权属和训练许可审计。气候、地形、水文和物种事实可以进入世界数据，但每个数据集仍必须保存来源、版本、采集时间和许可。

同一东南亚大陆热带季风档案必须覆盖多种真实自然区域，而不是重复单一河岸小路。当前 20 类区域固定在 `coverage-blueprint.json` 的 `regionalLandscapeTypes`，包括低地常绿热带森林、季节性常绿/半常绿森林、湿润落叶柚木林、旱季疏林、竹林、河岸林、季风草地、洪泛地、淡水沼泽、芦苇湿地、山溪、石灰岩丘陵、森林低山和季风转换地貌。当前档案明确排除雪、冰川、高山苔原、荒漠、寒温带白桦/针叶林身份；海岸红树林必须建立独立子档案并经项目所有者批准后才可进入。

第一轮默认原图与完整地图验证使用 `provisional-visual-snapshot-v2.json`：雨季、当地上午 10:00、雨后转晴、温暖湿润的柔和日光、地表湿润且定义水体之外无随机积水。项目所有者于 2026-07-14 批准新增 `provisional-visual-snapshot-late-dry-season-v1.json`，用于晚旱季龙脑香疏林及其他明确的旱季原图，禁止将其错误绑定为雨季雨后状态。提示证据必须显式保存目标 `snapshotId`、路径、`monsoonSeason` 和 `environmentState`；程序必须验证图片分类季节与快照季节一致。两个快照均为 `isFinal=false`，不是最终世界默认值；新增快照只能追加版本，已经绑定旧 `snapshotId` 的图片、审核和训练记录不得覆盖或改写。

生命周期覆盖采用关键状态而不是全组合：

| 植物组 | 物种数 | 每种关键状态 | 每状态视觉变体 | 覆盖单元 |
|---|---:|---:|---:|---:|
| 乔木 | 5 | 12 | 3 | 180 |
| 灌木 | 2 | 10 | 3 | 60 |
| 草本与竹类 | 2 | 10 | 3 | 60 |
| 花草 | 2 | 10 | 3 | 60 |
| 水岸苇类 | 1 | 10 | 3 | 30 |
| 合计 | 12 | - | - | 390 |

这 390 是需要被原图库审计覆盖的“植物视觉单元”，不是强制要求 390 个互不相关的图片文件。单张项目原创图片只有在区域、物种、季风季节、生命状态和视觉变体均被明确标注时才能覆盖多个单元；重复裁切、近重复图和只改变噪声的变体不得增加充足度。与下方 300 个数据门槛单元不去重相加时，规划上界为 690 个覆盖单元；最终真实文件数必须由原图库记录去重和数据审计计算，不能在没有图片时写死。

旧 `temperate-humid-natural-home-v1` 物种目录和快照文件只作迁移说明。其概念图片、原图库记录和来源副本已按项目所有者命令删除，当前数量为 0；程序不得恢复、重新登记或重新标注这些旧图片。

以下是当前 v0.3 已锁定门槛，不采用提案中的 1,000～10,000 张估算：

| 数据 | 最低要求 |
|---|---:|
| 完整地图正样本 | 20 |
| 完整地图负样本 | 40 |
| grass-path 正/负样本 | 40 / 40 |
| grass-water 正/负样本 | 40 / 40 |
| object-ground 正/负样本 | 30 / 30 |
| 机器漏判记录 | 20 |

独立自研训练计数只接受 `independentTrainingEligible=true`、`trainingDataProvenance=independent-training-eligible` 且通过上游权重/输出检查的记录。当前历史登记图全部缺少该独立资格，因此新口径下的正式正、负、过渡、对象接地和漏判样本均为 0。门槛只能由项目所有者明确批准后调整。

## 7. 第三方历史实验隔离

历史清单 `data/ai-painter/model-sources/local-visual-foundation-v1.json` 固定 `formalRouteAllowed=false`。已下载文件和 hash 只为了复现旧实验和解释失败，不得由 `run:complete-game-world` 自动加载。

第三方图可以保留机器拒绝、失败码和审核器回归证据，但在独立自研数据审计中固定排除。

第三方历史产物必须额外保存 `upstreamModelId`、`upstreamRevision`、`upstreamLicense`和 `derivativeStatus`，并固定 `independentTrainingEligible=false`。它们只能用于解释历史失败和回归审核器，不参与独立生成模型的数据闭环。

真正独立权重的训练数据必须进入单独的 `independent-training-eligible` 来源审计，证明数据权利清晰且没有用第三方权重、激活或输出对新模型进行模仿性转移。独立训练数据与当前冷启动候选数据必须分库、分类和分许可标记。

## 8. 自动保存

AI辅助条件去噪checkpoint的隔离验证图不得进入原图库接收层。它必须保存在`.runtime/ai-painter/ai-assisted-conditional-inference-validation/<runId>/`，并由`review:ai-assisted-conditional-inference-validation`自动保存VJ-0、VJ-1、VJ-2、风格指纹、构图新颖性、审核hash和失败学习；无论机器通过或拒绝均固定为非正式候选、非Runtime。

训练、推理、审核和失败回写必须由程序自动保存。自有训练器在数据不足时也必须保存带北京时间、数据包 ID、阻断码、第三方权重加载状态和 checkpoint 创建状态的记录。Codex 可以修复程序和检查证据，但不得手工伪造训练记录。

AI 辅助条件 RGB 自动保存检查固定为 `npm run check:ai-assisted-conditional-rgb-automation`。该检查读取程序记录，不创建审核结论；缺少图片、hash、UTC/北京时间、原图库事件、机器审核、统一总账、owner 拒绝证据或失败学习记录时必须失败。

必须保存输入任务包、数据包版本、配置、模型版本、checkpoint、seed、设备、耗时、loss、生成图片、hash、机器审核、人工审核、失败区域和下一轮任务。

AI 辅助冷启动训练记录固定保存到 `.runtime/ai-painter/project-owned-complete-world-model-ai-assisted/`；每次运行必须建立独立 run 目录并保存 `progress.json`、`manifest.json`、checkpoint、训练/验证 loss、四类 split 指标和验证/挑战/回归的原图-模型重建对照图及 hash。对照图只属于模型训练证据，固定 `formalCandidate=false`。渐进分辨率的后一阶段只能继承同一数据包、同一权属、无第三方权重且分辨率正好为前一阶段的项目 checkpoint，并保存父 checkpoint 路径与 hash；缺少父 checkpoint 时必须自动阻断。阻断与失败分别保存到 `blocks/`、`failures/`，不得覆盖严格独立训练谱系 `.runtime/ai-painter/project-owned-complete-world-model/`。

首轮 v1 Autoencoder 在原生 1024 重建中明显丢失像素细节后，项目所有者已批准进入模型调整。v2 数据包必须绑定 `ai-pet-world-complete-world-ai-assisted-cold-start-v2` 配置快照；v2 checkpoint 独立保存到 `.runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/`，不得覆盖 v1。v2 将潜空间从 `1/8、4 通道` 调整为 `1/4、12 通道`，并使用项目代码实现的像素、边缘和 Laplacian 高频损失；该调整仍不改变 AI 生成数据依赖，不赋予条件训练或正式推理资格。

v1/v2 重建比较固定使用 `npm run audit:ai-assisted-autoencoder-version-comparison`，读取两版原生 1024 验证、挑战和回归证据，统一计算 RGB MAE、边缘 MAE、Laplacian MAE 和 PSNR，并自动保存报告。训练 loss 因损失版本不同不能直接横向比较。当前 6 张统一证据显示 v2 的 RGB、边缘和高频误差分别降低约 `58.19%`、`54.58%`、`48.79%`，PSNR 提升约 `8.39 dB`；该结果证明重建改善，但仍要求项目所有者视觉审核，不能自动取得正式推理资格。

## 9. 数据库迁移边界

当前 `.runtime` 和 `data` 是正式文件来源。未来数据库保存结构化元数据、关系、状态和索引；大图片与 checkpoint 使用对象存储或文件存储，数据库保存 URI 与 hash。迁移不得改变样本身份和审核历史。
