# 训练数据与来源正式规则

更新时间：2026-08-03 11:12:09 +08:00

状态：active-long-term-data-and-provenance-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 数据原则

训练数据是可追溯、可复现、可审核的程序资产。文件数量、历史记录数量、重复图片、未完成审核的图片和缺少正式身份的图片不能计入数据容量。

完整地图正样本必须同时满足：

- 完整世界画幅与原生 `1024×768` 像素风合同；
- WorldFacts、World Director、23 通道和 RGB 一一绑定；
- 来源、许可、版本、时间、SHA-256 和派生过程完整；
- 机器审核和适用的 Owner 审核完成；
- `train / validation / challenge / regression` 隔离成立；
- 连接实例、主题架构、实例细节和 RGB 构图均不重复；
- 训练用途和模型权属声明准确。

失败内容必须保留并与正向容量隔离。任何资格变化都生成新记录或新版本，不覆盖原图、原审核、原哈希和原失败证据。

## 2. MVP 容量与扩容合同

V7 首次 MVP 容量固定为 64 张独立完整地图，split 固定为：

| split | 数量 | 用途 |
|---|---:|---|
| train | 48 | 更新模型权重 |
| validation | 8 | 选择 Checkpoint |
| challenge | 4 | 独立未见条件验证，训练期不得读取内容或指标 |
| regression | 4 | 历史失败回归，不能参与权重选择 |

后续增强容量为 128 张，目标 split 为 `96/16/8/8`。扩容不改变单条资格、去重、来源、审核或授权门槛，也不自动触发训练。

MVP 数据包身份、活动版本、容量贡献和实际 Dataset 选择必须一致。训练预检同时验证机器清单与 Python Dataset 的最终选中行，不能只相信容量摘要字段。

具体活动样本、数据包哈希、容量状态和缺口属于机器事实，保存在 `data/`、`.runtime/`和 SQLite，不写入本规格。

## 3. 五类并行视觉知识

原图库使用以下并行分类：

| 分类 | 主要知识 |
|---|---|
| `complete-maps` | 完整构图、空间阅读、全局光照和游戏地图整体标准 |
| `terrain` | 草地、道路、水体、水岸、土壤及环境状态 |
| `vegetation` | 现实物种、生命周期、季节、健康和资源状态 |
| `natural-objects` | 石头等自然对象的形态、尺度、材质和环境关系 |
| `transitions` | 地形过渡、对象接地、阴影、遮挡和边缘连续性 |

五类可以并行接收和审核，不是五个训练阶段。每条原图只有一个主要 `categoryId`；多语义标签保存在统一 Registry，不能通过复制图片到多个目录重复计数。

裁切只用于可追溯标注、条件构建和审核证据，必须绑定父图哈希和区域坐标；裁切图不能作为无来源的独立完整地图正样本。正式推理不得从五类目录挑图、缩放或拼接。

## 4. 真实地球区域来源包

每个国家或地区在进入世界条件与训练数据前，必须建立独立、版本化的 `RealEarthRegionSourcePackage`：

```text
realEarthRegionId
countryOrTerritory
spatialBounds / coordinateReference
observationTime / datasetVersions
elevationAndTerrainSources
landCoverSources
climateAndSeasonSources
soilAndMoistureSources
hydrologySources
ecologyAndSpeciesSources
regionalConnectivitySources
humanDevelopmentRemovalEvidence
licenses / attribution / acquisitionTimestamps
rawObjectHashes / derivationManifest / packageSha256
```

来源产品必须实际覆盖所声明区域和时间，不能只记录产品名称。人类开发、建筑、城市、工程道路、耕地地块和人工水体必须按批准政策识别、移除或自然化，随后才能派生 WorldFacts。

外部卫星 RGB、地图瓦片、导航地图、照片和历史生成图不得直接成为 RGB 训练目标或生成参考。真实测量只提供结构化事实；游戏坐标、自然拓扑和视觉表达必须保留完整派生谱系。

泰国 Sakaerat / Wang Nam Khiao 数据包只用于 MVP 首区，不是长期唯一来源。未来区域只能使用自身来源包的地形、水文、土壤、气候、生态和连接事实；允许复用 Schema、算法和统一美术语言，不允许复用泰国具体事实、主题架构或实例细节。

### 4.1 单包验收

1. 区域身份、空间范围和坐标参考明确。
2. 来源提供者、产品、版本、许可、署名、对象身份和采集时间完整。
3. 原始文件存在，字节数与 SHA-256 一致。
4. 高程、土地覆盖、气候、土壤、水文、生态和连接没有跨地区补用。
5. 人类开发识别、自然化和无数据处理过程完整。
6. 原始数据到 DerivedNaturalWorldFacts、WorldFacts 和游戏坐标的链路完整。
7. 区域连接实例有效并接入同一 RegionGraph。
8. 历史 RGB 读取和外部地图 RGB 训练目标均为零。
9. WorldFacts、导演、23 通道、主题架构和实例细节身份一致。

任一项失败都必须以具体失败码阻断，不能只写“数据不足”。

## 5. 允许的视觉来源

| 来源 | 默认资格 |
|---|---|
| 项目所有者原创图片 | 完成严格权属、来源、哈希和质量审核后可作为候选 |
| 委托原创且完整权利已书面转让 | 权利证据通过后可作为候选 |
| 项目独立权重模型输出 | 审核通过后可进入独立谱系候选 |
| 项目独立权重模型失败输出 | 只进入负样本或隔离区 |
| 外部图片或外部模型输出 | 默认禁止，除非 Owner 另行批准来源政策并完成许可审计 |
| AI 辅助冷启动图片 | 只进入独立 AI 辅助谱系，不能声明独立数据或独立权重 |
| 程序结构图、Mask、占位图和调试预览 | 只用于结构验证，不是专业 RGB 目标 |
| 来源不明、许可不明或哈希不一致 | `blocked_source` |

两条训练谱系必须分离：

| 谱系 | 数据资格 | Checkpoint 声明 |
|---|---|---|
| AI 辅助冷启动 | `aiAssistedColdStartEligible=true`、`independentTrainingEligible=false` | `project_owned_architecture_ai_assisted_cold_start_weights` |
| 纯项目独立训练 | `independentTrainingEligible=true` 且通过严格权属门禁 | `project_owned_independent_weights` |

“保存到本地”不等于“独立自研”。使用第三方模型生成的数据训练出的权重必须声明依赖，不能进入独立权重谱系。

## 6. 原图接收与样本类型

原图接收根目录为：

```text
data/world-samples/original-image-library/natural-home-v1/
```

接收程序复制原图和来源证据、计算哈希并写不可变记录。接收不等于训练登记；未完成后续审核和正式 Registry 登记前，任何图片不得进入数据包。

正式样本类型包括：

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

机器失败记录固定为 `ownerReviewStatus=not_reached_machine_failed`，不得伪造成 Owner 拒绝。Owner 拒绝、机器拒绝和审核漏判可以进入失败学习与回归，但不得成为正向 RGB target。

## 7. 单条样本合同

每张图片至少绑定：

```text
sampleId
recordId
capacitySlotId（适用时）
worldId / regionId / tick
dictionaryVersion
directorPlanId / taskPackageId
blueprintHash
conditionPackPath / conditionHashes
imagePath / imageSha256
sourceType / sourcePath / sourceLicense
modelVersion / checkpoint / seed（模型输出时）
ownerReviewStatus / machineReviewStatus
labels / failureCodes / affectedRegions
trainingUsage / split
createdAtUtc / createdAtAsiaShanghai
```

正式计数还要求：真实文件存在、哈希一致、样本 ID、图片哈希和容量槽位唯一、条件通道顺序正确、来源与审核齐全。

独立训练样本必须验证权利人、原创方式、全球商业使用权、训练权、修改权、转让或再许可权、原创源文件、权属证据路径和哈希；`thirdPartyContentUsed`、`thirdPartyGenerativeModelUsed` 和 `copiedFromExistingWork` 必须全部为 `false`。

## 8. 数据包合同

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

数据包发布后不可覆盖。修复标签、替换图片、改变 split、更新字典或增删样本必须建立新版本并保留父版本。

数据包必须绑定字典、来源政策、导演、任务、条件、审核规则和训练配置快照。四个 split 必须同时按图片哈希、来源窗口、结构哈希、条件哈希、主题架构和实例细节隔离，防止同源、变换派生或语义近邻泄漏。

AI 辅助冷启动数据包固定保存到：

```text
data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/
```

程序只能从正式原图库索引读取机器与 Owner 审核均合格、资格字段完整且哈希可复核的不可变记录。页面、聊天、临时附件和孤立图片不能直接作为训练输入。

## 9. 完整地图结构唯一性

不同文件哈希、条件 ID、真实测量窗口或结构身份只证明记录不同，不能证明内容不同。出图前和接收后都必须比较当前数据集及全部成功、待审、机器失败和 Owner 拒绝历史。

道路比较至少覆盖：入口侧、边界接触顺序、跨度方向、主要转弯序列和道路—水体关系。

水文比较至少覆盖：进出边界、主河数量、支流、分汊、汇流、分流、回流、岛体、回水洼地、岸线包围关系和主要弯曲序列。

整体骨架比较至少覆盖：连接拓扑、道路、水文、生态分区、自然边界、对象组织和阅读层级。

坐标变化、宽度变化、换色、换季节、左右互换、镜像、旋转或轻微形变不能把同一语义模板变成新样本。正式机器规则由 `data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json` 提供。

## 10. 区域连接资格

区域连接的正式机器合同为`data/world-samples/world-connectivity/world-connectivity-contract-v1.json`，合同身份固定为`natural-home-large-world-connectivity-v1`。本规则只定义长期数据资格，不复制某次覆盖数量、审核结果或运行状态。

完整地图只有绑定自身合法区域连接事实后，才能声明大世界连接资格。每条记录必须包含：

```text
connectivityBlueprintId
regionId
edgePortIds
pathGraphId
hydrologyGraphId
walkableGraphId
```

通用连接 Schema 不等于具体连接实例。`region-0001` 等实例只能用于其对应运行区域，不能作为所有训练样本的默认蓝图。同一具体连接实例及其变换版本不得多次计入容量。

每个区域至少与一个相邻区域形成双向配对且可达的通行连接；存在跨界水体时还必须证明水文连续。内部湿地、封闭池塘、少水和无水事实必须保留，不得被统一改造成跨区域河流。

## 11. 季节、生态和对象覆盖

第一版 MVP 使用 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`，并覆盖湿季、湿转干、干季、干转湿。环境对象至少包含：

```text
season
monsoonPhase
environmentState
weather
lighting
groundMoisture
visibility
sourceSnapshotId
```

来源记录、环境快照、WorldFacts、导演、任务包和生成请求必须使用同一环境身份。不得将雨季文本硬编码到所有条件，也不得为无水条件新增水体。

植物覆盖按区域、物种、生命周期、季节、健康、资源状态和视觉变体审计。覆盖单元不是强制图片数；一张合格原图可以覆盖多个有证据支持的单元，但重复裁切、近重复图片和噪声变体不能增加充足度。

## 12. 自动保存与失败处理

数据接收、数据包构建、训练、验证、推理、审核和失败必须由程序自动保存：

- 输入身份、来源、许可、版本和哈希；
- UTC 与 Asia/Shanghai 时间；
- 数据集和 split；
- 条件、配置、模型和父 Checkpoint；
- Token、硬件、耗时和进程结果；
- 图片、审核、失败码、受影响区域和修复目标；
- 不可变 Run 记录、SQLite artifact/event 索引和查询指针。

生成前失败必须明确 `imageGenerationStarted=false`；训练前失败必须明确 `gpuTrainingStarted=false` 和 `checkpointCreated=false`。秘密不得进入日志或证据。

历史失败只能由新记录复审，不能覆盖。算法修复必须用同一图片完成回归，证明旧通过继续通过、旧拒绝继续拒绝且阈值未被放宽。

## 13. 授权边界

训练数据合格不构成训练授权，训练完成不构成验证授权，验证通过不构成正式推理授权。单图生成、有界批次生成、训练、验证、正式推理、RuntimeFrame 和世界运行均使用各自不可变 Owner 授权并在执行前原子消费。

程序不得从编号、队列、旧授权、页面状态或聊天中的“允许”“继续”推导新权限。同一条件已有待审、通过或失败历史时，重试必须具有明确、未消费且范围匹配的授权。

## 14. 数据验收标准

数据包只有同时满足以下条件才能进入对应训练门禁：

1. 样本文件、记录、来源、许可和哈希完整。
2. WorldFacts、导演、任务、23 通道和 RGB 身份一致。
3. 实际 Dataset 选中行与 Manifest、容量和 split 完全一致。
4. challenge 与 regression 未参与训练或 Checkpoint 选择。
5. 主题架构、实例细节、道路、水文、岸线和整体骨架无历史重复。
6. 机器审核、Owner 审核和用途资格符合当前谱系。
7. 失败记录、旧版本和被撤销容量完整保留且未混入正样本。
8. 训练程序能够从不可变数据包复现同一选择结果。

具体数据包 ID、样本数量、活动版本、运行结论和哈希只从机器记录读取，不写入本规格。
