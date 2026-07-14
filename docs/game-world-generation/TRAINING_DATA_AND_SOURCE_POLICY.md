# 训练数据与来源正式规则

更新时间：2026-07-14 07:04:00 +08:00

状态：active-architecture / 当前数据缺口硬门禁 / 正式样本仍不足

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 数据原则

训练数据必须是可追溯、可复现、可审核的程序资产。文件数量、历史 JSON 数量、重复样本和缺少正式记录的图片不能计入数据充足度。

程序可以生成世界事实、Blueprint、Mask、距离图、对象实例图、可走层、碰撞层和调试预览；程序直绘图不能作为专业完整地图正样本，也不能进入 `/world`。

第一版正式 RGB 训练目标采用原生 `1024×768` 2D 高分辨率像素风完整画布。完整地图原图必须具备统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性；普通数字插画、仅套像素滤镜的图片、低分辨率自动放大图、tile/sprite 拼接图均不能获得正式原图资格。训练可以使用渐进分辨率，但最终目标图、审核图和 Runtime 图只计原生 `1024×768` 文件一次。

## 2. 允许的视觉来源

| 来源 | 默认处理 |
|---|---|
| 项目所有者原创图片 | 通过 `strict-project-owned-training-data-v1` 来源、权属、hash 和质量审核后可进入候选样本 |
| 委托原创且完整权利已书面转让给项目所有者的图片 | 提供权利转让协议证据并通过严格 IP 审核后可进入候选样本 |
| 项目独立权重模型生成且 owner approved 的完整地图 | 完成独立来源审计后可作为正样本 |
| 项目独立权重模型生成且 owner rejected 的图片 | 只能进入负样本或隔离区 |
| 外部图片或外部模型输出 | 默认禁止；只有项目所有者明确改变来源政策并完成许可审计后才能使用 |
| OpenAI 或其他在线生成图片 | 当前正式训练链禁止 |
| 程序规则渲染、占位图、结构预览 | 只能用于结构调试或条件验证，不是专业 RGB 目标 |
| 来源不明、许可不明、hash 不一致 | `blocked_source` |

项目所有者已明确授权 `owner-authorized-ai-assisted-cold-start-v1`。OpenAI 辅助生成的高分辨率像素风图片可以进入独立的 AI 辅助冷启动通道，但必须标记 `thirdPartyGenerativeModelUsed=true`、`independentTrainingEligible=false`，保存生成器、完整提示词证据、owner 授权、文件 hash、机器审核和人工审核。只有 owner 审核通过后才能标记 `aiAssistedColdStartEligible=true`；由此训练的 checkpoint 必须声明 AI 生成数据依赖，不得冒充 `project_owned_independent_weights`。原严格项目自有数据通道继续并存。

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

第一版连接蓝图已经登记为 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`，Runtime 连接事实已迁移到 tick 2，并经项目所有者审核后写入 tick 3。现有 AI 辅助冷启动原图即使通过视觉审核，也只属于视觉冷启动数据；在逐张绑定边界连接口和图结构并通过图片自身的连接审核前，不得计入连接覆盖。连接正负样本的最低数量仍未得到项目所有者批准，当前必须保持 `pending_owner_approval`，智能体和程序不得自行发明数字或借用旧的 20/40 条视觉门槛。

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

训练、推理、审核和失败回写必须由程序自动保存。自有训练器在数据不足时也必须保存带北京时间、数据包 ID、阻断码、第三方权重加载状态和 checkpoint 创建状态的记录。Codex 可以修复程序和检查证据，但不得手工伪造训练记录。

必须保存输入任务包、数据包版本、配置、模型版本、checkpoint、seed、设备、耗时、loss、生成图片、hash、机器审核、人工审核、失败区域和下一轮任务。

## 9. 数据库迁移边界

当前 `.runtime` 和 `data` 是正式文件来源。未来数据库保存结构化元数据、关系、状态和索引；大图片与 checkpoint 使用对象存储或文件存储，数据库保存 URI 与 hash。迁移不得改变样本身份和审核历史。
