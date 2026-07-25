# 训练数据与来源正式规则

更新时间：2026-07-25 09:02:19 +08:00

状态：active-architecture / V7容量128张已批准 / 连续出图批次已停止 / 17条变换派生容量已隔离 / 当前可信26张 / 非正式工程预训练已完成 / 正式缺口102张 / V7 GPU训练未授权

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 数据原则

训练数据必须是可追溯、可复现、可审核的程序资产。文件数量、历史 JSON 数量、重复样本和缺少正式记录的图片不能计入数据充足度。

程序可以生成世界事实、Blueprint、Mask、距离图、对象实例图、可走层、碰撞层和调试预览；程序直绘图不能作为专业完整地图正样本，也不能进入 `/world`。

第一版正式本地模型 RGB target 采用原生 `1024×768` 2D 高分辨率像素风完整画布。正式 target、正式候选、owner review 和 Runtime 必须具备统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性；普通数字插画、仅套像素滤镜的图片、低分辨率自动放大图、tile/sprite 拼接图均不能取得正式资格。训练内部可以使用渐进分辨率，但最终正式输出只计本地模型原生 `1024×768` 文件一次。

完整地图训练资格同时要求完整地图范围。只有单一河段、单一道路、单一池塘、单一林间空地、单一材质范围或放大局部生态单元的全画布图片，统一标记为 `local_scene_not_complete_map`；即使尺寸、来源、hash、23通道和像素风检查通过，也不得计入完整地图 target、`completeMapPositive` 或自主生成训练原图。此类图片只能作为局部视觉知识、负样本或审核失败证据保存。完整地图必须绑定整体入口/出口关系、连续自然通行组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；水体只按当前世界事实出现，不得把东南亚档案解释成固定水体构图模板。

后续初始自然地图训练数据不得包含或标注固定家园中心、建筑候选地、施工预留地、规则中央空地、道路汇聚方块或为这些位置清空对象的布局。`focal_area` 为维持23通道版本兼容而保留，但初始自然地图必须写入全零值，不得进入可视条件引导，不得作为对象排除区或道路目标。违反该规则的生成图必须保存为失败记录，失败码固定为 `preset_home_site_or_construction_clearing_forbidden`，不得进入正样本、容量贡献、Runtime 或 `/world`。

任何新 RGB 的生成都要求“正式文档具体任务 + 项目所有者单图命令或当前有效的有界批次命令”双重授权。历史批次`owner-authorized-v7-remaining-104-continuous-batch-20260723`已经停止，不再构成有效出图授权。范围不明、重复风险、镜像/旋转/共享骨架风险和局部图风险必须在调用生成算力前阻断。

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

条件后置 RGB 的季节与环境输入统一使用 `world-visual-environment-context-v1`。该对象必须由来源记录和锁定环境快照共同生成，并以同一身份贯穿世界事实蓝图、世界导演输出、完整任务包、生成请求和自动检查；至少包含 `season`、`monsoonPhase`、`environmentState`、`weather`、`lighting`、`groundMoisture`、`visibility` 和 `sourceSnapshotId`。所有条件共用同一请求编译算法；该算法还必须按 `regionalLandscapeType` 读取 `coverage-blueprint.json` 的区域生态档案，将 `requiredFeatures` 和 `optionalFeatures` 写入提示证据和请求。统一编译器必须读取版本化基础完整地图视觉标准的聚合数值/文字档案、当前23通道hash和道路期望覆盖比例，不得读取历史完整地图 RGB；当前请求契约固定为 `dynamic_complete_map_scope_plus_foundational_visual_standard_plus_world_facts_director_23_channels_v9`。生成前必须执行完整地图范围门禁；缺少入口/出口、连续自然通行、多空间/生态分区、自然边界或大世界连接证据时，以 `local_scene_not_complete_map` 自动保存阻断；发现预设家园位置或建设空地时，以 `preset_home_site_or_construction_clearing_forbidden` 阻断或拒绝。同一条件重试必须保存项目所有者授权原因，并固定不能修改世界事实、条件几何或审核门槛。不得把雨季、旱季或湿度文字写死。来源记录季节与快照季节不一致、请求文字与环境对象冲突、无水条件请求新增水体时，必须在图像生成前失败并自动保存失败记录。

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

当前`.runtime`和`data`中的文件继续是正式证据来源。SQLite只保存结构化元数据、关系、状态和索引；大图片、checkpoint、条件图和原始审核JSON继续使用文件存储，数据库保存URI、大小、修改时间和SHA-256。迁移不得改变样本身份、训练资格、审核历史、runId或hash。

项目所有者于2026-07-20批准第一版物理存储合同：

| 层 | 固定位置 | 作用 |
|---|---|---|
| 项目逻辑入口 | `F:\ai-pet-world\.runtime` | 迁移完成后指向D盘热层的目录联接；保持现有相对路径合同 |
| 热层 | `D:\AI-PET-WORLD-DATA\hot\runtime` | 当前运行、最新状态、仍需直接访问的训练和审核证据 |
| 冷层 | `D:\AI-PET-WORLD-DATA\cold\runs` | 已完成run的不可变归档包及归档清单 |
| SQLite目录 | `D:\AI-PET-WORLD-DATA\catalog` | run、artifact、event、review和迁移索引 |
| 迁移证据 | `D:\AI-PET-WORLD-DATA\migrations` | 源/目标数量、字节、hash、错误、时间戳和切换记录 |

SQLite最低Schema固定包含：`storage_meta`、`migration_runs`、`runs`、`artifacts`、`program_events`。`artifacts`必须保存逻辑相对路径、物理URI、存储层、字节数、修改时间、SHA-256、runId和文件类型；`program_events`必须保存中英文事件、状态、证据URI和时间戳。数据库使用WAL模式并建立路径、runId、时间和状态索引。

无损迁移顺序固定为：预检无活动训练 -> 复制到D盘热层 -> 统计源/目标文件数量和字节 -> 校验SHA-256 -> 建立SQLite目录 -> 只读查询验证 -> 停止开发服务 -> 将F盘旧`.runtime`改名为带迁移ID的备份 -> 建立目录联接 -> 重启服务 -> 运行回归检查。任何一步失败都必须保存失败记录并保持F盘原路径可恢复；项目所有者验收前不得删除F盘备份。

该顺序已由迁移`runtime-to-d-20260720-0528`完整执行并通过：700,058个源文件与700,058个目标文件、94,808,690,230字节完全一致，逐文件hash差异为0。SQLite已登记700,058条artifact和637条历史程序事件；后续训练归档程序会按新run精确索引新增文件，不得重新全盘扫描70万文件。F盘备份`F:\ai-pet-world\.runtime-f-drive-backup-runtime-to-d-20260720-0528`在项目所有者明确验收前继续保留。

## 10. V6失败后的数据容量结论

项目所有者批准的21套条件配对是第一轮实验训练的执行门槛，不是“数据已经足够训练出稳定完整地图”的证明。V6实际split仅为`16 train / 2 validation / 1 challenge / 2 regression`；V6完成三级训练后仍在唯一challenge图上失败。该结果证明当前数据只能用于验证管线、条件接入和算法方向，不能证明模型已获得可泛化的完整地图视觉能力。

V7代码修复已把checkpoint评估扩展为全部validation样本、多seed和最差轨迹，并加入完整地图空间网格与稀疏区域对比约束，但代码修复不能替代数据容量。项目所有者于2026-07-22批准V7验证容量固定为128张独立完整地图，split固定为`96 train / 16 validation / 8 challenge / 8 regression`。最新程序容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T06-22-44-884Z`确认旧21条基线与1条V7贡献合计22/22张通过记录身份、图片/记录/审核hash、世界事实身份、23通道、完整地图范围和构图新颖性审计，失败0张；正式缺口为106张，剩余split固定规划为`79 train / 14 validation / 7 challenge / 6 regression`。

128张属于正向条件去噪RGB容量，不等于把失败图作为正目标。负样本、机器漏判、审核拒绝和失败学习继续进入审核器、回归集、挑战集或失败经验库；除非有独立的负样本学习合同，不得直接混入正向RGB target。新增完整地图必须覆盖锁定的东南亚MVP生态类别和湿季、湿转干、干季、干转湿四个季风状态；覆盖矩阵必须在具体出图前由程序生成并通过审计，不能以一类一图的表面数量代替道路、水体、入口、中心、空间分区、自然边界和大世界连接的结构变化。

当前V7训练状态固定为`blocked_pending_approved_128_dataset_implementation`。机器可读覆盖矩阵确认当前容量24、缺口104。剩余104槽已获连续数据批次授权：机器通过只进入待人工审核，失败必须存图、失败码、时间戳和证据后继续；未经owner逐张通过不得登记容量。128张不可变数据包完成后仍须项目所有者单独授权V7 GPU训练。

任何新增数据仍必须遵守本文件的来源、许可、身份、hash、时间戳、审核与自动保存规则。不得通过复制、轻微变体、重复seed或旧图重绑虚增样本数量；不得把局部图、程序占位图或失败图伪装为完整地图正样本。

## 11. V7季节过渡事实与首个容量槽位

程序已从项目既有NASA POWER 2001-2020月度原始快照建立两份版本化环境事实：`mainland-southeast-asia-tropical-monsoon-provisional-wet-to-dry-transition-v1`和`mainland-southeast-asia-tropical-monsoon-provisional-dry-to-wet-transition-v1`。两份快照均保存源月份、气候均值、原始响应SHA-256、构建规则和双时区时间；它们是世界事实输入，不是RGB训练图，不得单独计入128张容量。

首个容量槽位`v7-capacity-slot-001`的正式任务证据runId=`ai-assisted-v7-data-task-v7-capacity-slot-001-2026-07-22T02-07-41-845Z`，身份固定为`train / lowland-evergreen-tropical-forest / wet_to_dry_transition`。它已通过23通道唯一性、原生`1024×768`完整范围、世界身份、大世界连接和自动保存检查，并在完成单图生成、机器审核和owner审核后由正式容量入口登记为1条V7 train贡献。

### 11.1 首个槽位RGB人工审核通过

更新时间：2026-07-22 12:59:59 +08:00

项目所有者已授权并仅生成一张`v7-capacity-slot-001` RGB。请求ID=`conditional-rgb-001-2026-07-22T03-03-07-793Z`；训练派生图SHA-256=`6f89c3830183a48dc4d7074a8d88b8787e3ff19753dc42bb6bd337548878e5c2`。机器合同审核通过，项目所有者审核已由程序写入`owner_approved`，记录状态=`ai_assisted_cold_start_eligible`，`formalConditionalTrainingEligible=true`，自主生成训练原图序号=`002`。它仍固定`independentTrainingEligible=false`且不得直接进入Runtime或`/world`。

正式入口`npm run register:ai-assisted-v7-capacity-contribution`现已保存任务、23通道、RGB、机器审核、owner审核和容量槽位的一一对应关系；独立入口`npm run check:ai-assisted-v7-capacity-contribution`已验证该贡献。不可变证据位于`.runtime/ai-painter/ai-assisted-v7-capacity-contributions/ai-assisted-v7-capacity-contribution-v7-capacity-slot-001-2026-07-22T06-19-53-556Z/contribution.json`，SHA-256=`33be42900b7c3a8e9375f50cfa6d61dc70b555ace0d09b2d0f4d6f8a9d924ae3`。

slot-001闭环时的数据包曾保持旧21条条件配对并增加1条V7贡献，总条件绑定完整地图22条、未配对0条，正式缺口从107减为106。该段保留为历史；slot-002闭环后的最新结果为23条、缺口105。后续槽位同样不得读取历史完整地图RGB几何、不得把已有RGB重绑为target，也不得自动复制、裁切或批量生成。

### 11.2 容量槽位002任务准备

更新时间：2026-07-22 18:12:27 +08:00

`v7-capacity-slot-002`任务runId=`ai-assisted-v7-data-task-v7-capacity-slot-002-2026-07-22T10-03-58-601Z`绑定`lowland-evergreen-tropical-forest / wet_to_dry_transition / train / structural_diversity_reserve`。程序已保存独立世界事实、世界导演、任务包、23通道条件包、完整地图范围审核、双时区时间和hash；构图为东南入口、偏置不规则中心、西北大世界出口，且世界事实不要求主要地表水体。该任务没有读取历史完整地图RGB几何，没有生成RGB，也没有启动GPU。它只有在项目所有者明确授权唯一一张RGB、机器审核和owner审核均完成后，才可能登记为容量贡献。

项目所有者随后授权该槽位唯一一张RGB。程序保存源图SHA-256=`96ee07168ba20d700299901a5abe907bb830be8764f5f656f372507ca5582b79`及`1024x768`训练/机器审核派生图SHA-256=`d326d6073e91b1a8ba2bcccca5e153281326980b725ef987277b1fdbc75f92e3`。在owner审核前，机器合同已通过但owner状态仍为`pending_review`，当时不得进入条件训练数据包或计入容量；该段保留为“机器通过不能代替人工审核”的历史门禁证据。最新owner通过与容量结果见下一段。

项目所有者现已明确审核通过该图，程序自动完成owner审核写入、容量登记、数据包重建和容量重审。slot-002贡献SHA-256=`7f3dcf75cfc5a1804b7d3905afa0f463a4253bff3701f888881673ae8f2725f2`；最新数据包ID=`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-22T12-04-59-138Z`，条件绑定完整地图23条、V7贡献2条、未配对0条。最新容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T12-05-01-665Z`确认23/23合格、失败0、缺口105。该数据仍属于AI辅助冷启动通道，固定`independentTrainingEligible=false`；不得作为正式候选、Runtime或`/world`画面。

### 11.3 容量槽位003任务准备

更新时间：2026-07-22 21:33:24 +08:00

`v7-capacity-slot-003`绑定`lowland-evergreen-tropical-forest / dry_season / train / pairwise_landscape_season_baseline`。程序先保存两次RGB前失败：旱季配方缺失，以及道路与封闭边界碰撞；项目所有者已授权修复该配方。成功runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-27-59-480Z`使用既有旱季环境快照，保存独立世界事实、世界导演、任务包、正式23通道、完整地图范围审核、双时区时间、hash、32项SQLite artifact和1条中英文程序事件。

该任务没有读取历史完整地图RGB几何，没有绑定现有RGB，没有生成图片，也没有启动GPU。当前`pairedRgbCount=0`，因此不会增加训练容量；总容量仍为23，缺口仍为105。只有项目所有者再次明确授权slot-003唯一一张RGB，并且后续机器审核、owner审核和容量登记全部通过后，该记录才可能进入AI辅助条件训练数据包。

## 12. 2026-07-24 容量重分类与非正式工程预训练边界

变换重复审计已确认17条历史容量由镜像、旋转或共享构图骨架派生。程序必须保留这些图片、记录、审核、时间戳和hash，但不得再把它们计入正式128张容量。独立重分类证据为`.runtime/ai-painter/ai-assisted-v7-capacity-reclassifications/ai-assisted-v7-capacity-reclassification-2026-07-23T22-54-14-255Z/reclassification.json`，SHA-256=`24f126487ccbd353d840b84f07edd6a4cf9646a2bd9a6940b514de1c44d770f2`。

当前可信数据固定为26张：21张当前`complete-map-v2`条件配对完整地图，加V7容量槽位`001`、`002`、`003`、`033`、`034`。当前split固定为`21 train / 2 validation / 1 challenge / 2 regression`。该26张可以用于项目所有者授权的非正式工程预训练，只用于验证数据读取、23通道绑定、训练损失、checkpoint保存、事件记录和D盘SQLite索引链。

工程预训练输出必须固定`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。它不能补足102张正式数据缺口，不能登记为新容量，不能启动或冒充正式V7训练，也不能生成新RGB。任何正式V7训练仍需128张数据包闭合并由项目所有者单独授权。

后续新数据必须以`sakaerat-wang-nam-khiao-mvp-reference-v1`为具体MVP参照，并通过完整地图范围门和变换骨架前置门。项目所有者于2026-07-24批准真实地理自然化路线：有明确许可、版本和来源的高程、土地覆盖、气候与土壤测量可以派生自然世界事实及自然拓扑；建筑、城市、工程道路、耕地地块、地籍/行政边界和人工水体必须先移除或自然化重建。外部RGB、卫星图像、地图瓦片视觉、照片和外部视觉作品仍不得进入训练数据或作为生成器图片参考。

### 真实地理测量来源与自然化边界

正式来源注册表固定为`data/world-samples/earth-geospatial/source-registry/earth-geospatial-source-registry-v1.json`，首个区域契约固定为`data/world-samples/earth-geospatial/regions/sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1/region-contract.json`。当前来源职责固定如下：

| 来源 | 允许用途 | 禁止用途 |
|---|---|---|
| Copernicus DEM GLO-30 | 地形高程、坡度、自然汇流与地貌层级的测量输入 | 直接当作游戏高度图发布；把真实栅格分辨率解释为游戏米/像素 |
| ESA WorldCover 2021 | 识别自然覆盖、建成区与耕地，形成移除/重建掩码 | 当作RGB目标、颜色参考或可直接显示的地图 |
| NASA POWER | 季风气候、温度、降雨、湿度与风的区域上下文 | 决定细粒度地形几何 |
| SoilGrids | 土壤属性、排水与地表湿度的区域上下文 | 冒充对象位置、道路或精确水文几何 |

每次程序运行必须保存：来源ID、提供者、产品版本、许可、署名、URL、采集时间、远端对象身份、原始响应hash、空间窗口、变换步骤、移除的人类开发类别、自然化重建报告、派生事实hash、成功/失败事件及SQLite索引。测量数据只有在自然化审计通过后才能形成WorldFact；它本身不是WorldFact，更不是RGB训练样本。

### 12.1 非正式工程预训练执行结果

程序已建立数据包`ai-assisted-v7-engineering-pretraining-trusted-26-2026-07-23T23-45-32-454Z`，manifest SHA-256=`06b706d208607cf74a6436f53b3f5b2ed395fdece6a3319dc9bb0f2b5fc46586`。26条数据全部具备唯一RGB、记录、机器审核、owner审核和23通道证据；17条镜像、旋转或共享骨架派生记录不在该包内。初始自然地图不允许固定家园中心，因此数据包内部使用统一全零`focal_area`兼容通道，原始记录及其hash保持不变。

非正式训练runId=`ai-assisted-conditional-denoiser-v7-engineering-26-stage-0-2026-07-23T23-51-23-450Z`，checkpoint SHA-256=`bc65e68936ce851142c94b2be65ced528f44a874361e39e02d31406c3419d382`。程序完成6轮`256x192`工程训练，最佳验证指标=`3.538672380770246`，并自动保存逐轮指标、manifest、条件证据、算法证据、checkpoint、双语事件和SQLite索引。该run没有生成RGB，不取得正式V7、正式推理、Runtime或`/world`资格。

这次运行不改变128张正式容量合同：当前可信26张、正式缺口102张。任何held-out RGB验证、正式V7训练、后续阶段训练或新增数据生产都必须获得项目所有者新的单独授权。

## 13. 真实地理自然化数据的当前执行边界

更新时间：2026-07-25 06:39:54 +08:00

项目所有者已授权并完成`owner-approved-real-geography-naturalization-route-20260724`的数据阶段。Overpass/OSM在该链路中只用于识别测量窗口内的人类工程道路和建筑，并生成可追溯移除掩码；不得把OSM道路、水系、建筑轮廓、节点、关系或现实导航拓扑直接复制为游戏几何、23通道最终结构或RGB训练目标。

工程设施移除runId=`earth-geospatial-engineered-removal-2026-07-24T21-46-52-147Z`保存107个工程要素及其来源响应、查询、许可、时间、hash和移除掩码。自然化WorldFacts runId=`earth-geospatial-naturalized-world-facts-2026-07-24T22-10-04-752Z`重建15,170个被排除像素，只导出聚合的地势、土地覆盖、土壤、水文和生态事实；WorldFacts固定`visualTrainingTargetEligible=false`，不能单独计入RGB容量。

完整地图条件runId=`earth-geospatial-complete-map-conditions-2026-07-24T22-32-37-023Z`只消费聚合WorldFacts与已审核大世界连接契约，并在新的匿名游戏坐标中建立World Director、完整地图任务和23通道。独立检查确认23通道完整、`focal_area`全零、完整地图范围通过、没有读取历史RGB或复制现实/OSM几何。该条件包仍不是训练RGB、正式候选、RuntimeFrame或`/world`画面；任何单张RGB、训练或容量登记仍需项目所有者另行授权并继续遵守本文件的来源、许可、审核、自动保存和失败回写规则。

## 14. 真实地理自然化条件首张RGB的数据资格

更新时间：2026-07-25 09:02:19 +08:00

项目所有者已以`owner-authorized-earth-reference-naturalized-complete-map-single-rgb-20260725`单独授权conditionId=`earth-reference-naturalized-complete-map-b3be6a28ffb6`的一张AI辅助冷启动RGB。请求ID=`conditional-rgb-001-2026-07-24T23-28-55-094Z`；生成器只接收程序编译的本轮语义条件引导图，不接收历史完整地图RGB、现实地图RGB、卫星图、地图瓦片或OSM几何。

程序自动保存`1448×1086`源图SHA-256=`dd1075eb865991f250d91726724b3f2c17adbe0a3f726d5ad8da183cf8246ab8`与`1024×768`审核派生图SHA-256=`ac6778270a44d2379e1ea0c635041eb8685c0def7659ba8e7d3a6a73b1d29bb4`。机器审核仅以`condition_terrain_path_ground_centroid_drift`拒绝：道路视觉中心相对条件通道偏移`0.3108`，超过上限`0.25`。水体对齐、来源分辨率、风格指纹和构图新颖性均通过。

该机器拒绝、失败图引用、失败码、下一训练目标、双时区时间、hash、SQLite索引和失败学习均作为不可变历史保留，不得覆盖或删除。项目所有者后续只授权诊断该审核差距并复审同一张图；没有授权重画、修改世界事实、23通道、审核阈值或风格标准。

正式诊断runId=`ai-assisted-cold-start-path-false-positive-diagnosis-2026-07-25T00-34-27-315Z`确认旧审核器把远离正式道路条件的旱季裸地暖色碎片计入道路视觉中心。新版道路审核只保留与`terrain_path_ground`走廊连通或受其支持的8连通视觉分量，旧中心距离`0.3108`降为同图`0.0856`，排除非道路暖色像素`27,182`；`thresholdsChanged=false`、`newRgbCreated=false`。

同图机器复审runId=`ai-assisted-cold-start-review-ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1-2026-07-25T00-37-54-194Z`通过，问题数=0。项目所有者明确通过由正式程序保存为reviewId=`ai-cold-start-owner-review-ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1-2026-07-25T00-41-06-524Z`，命令引用=`owner-approved-earth-reference-naturalized-complete-map-b3be6a28ffb6-20260725`。

该记录当前资格固定为：`trainingEligibility=ai_assisted_cold_start_eligible`、`formalConditionalTrainingEligible=true`、`independentTrainingEligible=false`、`formalCandidate=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。程序重建的数据包`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-25T00-45-56-567Z`已将其放入`validation`，只承担`rgb_autoencoder_warmup`。它尚无V7容量贡献身份，不得计入V7正式容量，也不得进入Runtime或`/world`。
