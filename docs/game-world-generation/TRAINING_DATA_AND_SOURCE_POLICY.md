# 训练数据与来源正式规则

更新时间：2026-09-08 03:41:56 +08:00

状态：active-long-term-data-and-provenance-contract

文档版本：`AI-PAINTER-DATA-PROVENANCE-1.5`

生效日期：`2026-09-08`

替代版本：`AI-PAINTER-DATA-PROVENANCE-1.4`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

破坏性变更规则：来源资格、64份容量身份、48/8/4/4用途、样本Schema或发布身份改变时必须提升文档版本并形成新的数据与能力发布身份。

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 数据原则

训练数据是可追溯、可复现、可审核的程序资产。文件数量、历史记录数量、重复图片、未完成审核的图片和缺少正式身份的图片不能计入数据容量。

完整地图正样本必须同时满足：

- 完整世界画幅与原生 `1024×768` 像素风合同；
- WorldFacts、World Director、23 通道和 RGB 一一绑定；
- 来源、许可、版本、时间、SHA-256 和派生过程完整；
- 机器审核和数据版本机器发布门完成；
- `train / validation / challenge / regression` 隔离成立；
- 连接实例、主题架构、实例细节和 RGB 构图均不重复；
- 训练用途和模型权属声明准确。

失败内容必须保留并与正向容量隔离。任何资格变化都生成新记录或新版本，不覆盖原图、原审核、原哈希和原失败证据。

## 2. MVP 容量与扩容合同

当前批准的基础数据发布版本容量固定为64张独立完整地图，split固定如下。该“64份”是数据发布合同，不是`complete-world-ai-assisted-cold-start-v7`历史模型配置的现行资格，也不把历史训练入口恢复为可执行状态：

| split | 数量 | 用途 |
|---|---:|---|
| train | 48 | 更新模型权重 |
| validation | 8 | 选择 Checkpoint |
| challenge | 4 | 独立未见条件验证，训练期不得读取内容或指标 |
| regression | 4 | 历史失败回归，不能参与权重选择 |

当前Stage4后继候选的机器发布合同为[`ai-painter-stage4-v2-mvp64-dataset-release-v1.json`](../../data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json)。该合同明确区分116条来源总索引与64条训练发布子集，并以来源索引中的`v7CapacityContributions`原数组顺序逐条匹配`samples`，重算每张RGB、条件包和容量贡献证据的SHA-256。字段名中的`v7`仅是既有来源Schema的一部分，不构成V7模型、旧训练入口、旧Owner字段或历史运行的当前资格。当前读取器只能消费发布合同的64条`samples`；禁止按目录时间、`latest`、数字槽位或历史配置推断活动数据。

后续增强容量为 128 张，目标 split 为 `96/16/8/8`。扩容不改变单条资格、去重、来源或审核门槛；达到机器数据发布资格后，由本地系统按训练计划自主决定是否形成新能力版本。

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

来源产品必须实际覆盖所声明区域和时间，不能只记录产品名称。人类开发、建筑、城市、工程道路、耕地地块和人工水体必须按当前生效的版本化自然化政策识别、移除或自然化，随后才能派生 WorldFacts。

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

### 4.2 东南亚首区现有资料的身份与处置

兼容生态范围、具体地理参照、测量快照、物种名录和训练发布是不同层级，必须分别绑定，不得仅因路径含有同一个地区名而混用。

| 本地记录 | 正式角色 | 保留／替代／停用边界 |
|---|---|---|
| `data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json` | 东南亚大陆热带季风兼容档案；包含柬、老、缅、泰、越的参考包络 | 保留档案身份；不证明包络中每种生态在具体泰国测量窗口都存在 |
| `data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json` | 当前泰国Sakaerat／Wang Nam Khiao具体生态与地形参照 | 保留为首区事实参照；低地、山麓、林地镶嵌、竹林、间歇溪流须由各窗口自身测量支撑；不强制每张地图有水 |
| `data/world-samples/original-image-library/natural-home-v1/earth-parameter-snapshots/mainland-southeast-asia-reference-v1/manifest.json` | 代表点15.5／105.5的区域气候锚点快照 | 保留原字节与来源；不是泰国具体参照点14.5078／101.895的直接测量，不能静默覆盖当前窗口气候。只有新区域来源合同明确接受其空间代表性与误差时可派生使用 |
| `data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-species-catalog-v1.json` | 当前12条现实植物名录记录 | 保留植物知识与来源；不是五类动物名录，也不能证明全部植物均属于同一泰国具体生境 |
| V2 64份数据发布及其显式绑定的旧来源包 | 经新发布合同精确选择的自然地图训练输入 | 保留已绑定来源和hash；旧日期或`v7CapacityContributions`字段名不自动使其无效，也不恢复旧模型／入口权威 |
| `thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-contract-v1.json`与`thailand-rebuild64-cross-modal-rgb-collapse-prevention-contract-v1.json`（均位于`data/ai-painter/system-governance/`） | 两个指定旧槽位的历史实例合同 | 停用其“全MVP通用合同”身份；仅按原作用域复核。固定北入南出、入口方向和旧任务限制不能迁移到其他样本；新通用实现必须另建显式作用域合同 |

上述JSON中的历史Owner状态词不构成当前运行许可。保留事实、停用调度与物理删除是不同操作；本规则不要求重写历史文件，也不凭名称判定垃圾数据。

## 5. 允许的视觉来源

| 来源 | 默认资格 |
|---|---|
| 项目自有原创图片 | 完成严格权属、来源、哈希和质量审核后可作为候选 |
| 委托原创且完整权利已书面转让 | 权利证据通过后可作为候选 |
| 项目独立权重模型输出 | 审核通过后可进入独立谱系候选 |
| 项目独立权重模型失败输出 | 只进入负样本或隔离区 |
| 外部图片或外部模型输出 | 默认禁止；只有当前生效来源政策明确允许且许可审计、来源血缘与机器审核全部通过时可作为候选 |
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
machine_qualified_positive
machine_negative
judge_gap_negative
blocked_source
```

`owner_approved_positive`与`owner_rejected_negative`只用于兼容历史不可变记录，不得由当前程序创建，也不得作为当前训练资格字段。当前正样本身份统一由`machine_qualified_positive`、`datasetReleaseIdentity`和完整机器审核链表达。

机器失败记录必须明确为机器门禁失败，不得伪造成项目级否决。数据版本发布否决、机器拒绝和审核漏判可以进入失败学习与回归，但不得成为正向 RGB target。

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
machineReviewStatus
datasetReleaseIdentity
capabilityReleaseIdentity（模型生成记录适用时）
legacyOwnerReviewStatus（仅兼容历史记录，可选，不构成当前逐图审核要求）
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

`manifest.json`和`source-index.json`是`datasetReleaseIdentity`的必备构成文件，不是可选附件或本机私有文件。数据发布记录和每个训练能力都必须分别绑定：

```text
datasetPackagePath / datasetPackageSha256
manifestPath / manifestSha256
sourceIndexPath / sourceIndexSha256
trainSplitPath / trainSplitSha256
validationSplitPath / validationSplitSha256
challengeSplitPath / challengeSplitSha256
regressionSplitPath / regressionSplitSha256
datasetSelectionReproductionSha256
```

训练预检必须先从`manifest.json`核对包身份、容量、split计数、字典、条件和发布身份，再从`source-index.json`的正式样本集合读取每条完整记录，最后与四个split文件和Python Dataset实际选中行逐项比较。顶层对象不得当作样本数组，顶层索引总数不得当作批准容量。任一文件缺失、未进入正式代码/数据基线、哈希不符、样本重复、split不符或实际选中行不一致时，必须在GPU消费前失败关闭。

旧发布中的内嵌`samples`或`v7CapacityContributions`可以作为精确溯源输入，但不能替代上述四份独立split绑定。物化缺失文件、修改选中行或改变划分必须形成新发布身份与能力绑定，不得为让校验通过而原地改写旧包。Smoke仍只能用train更新权重；被观察并用于修复的数据必须记录暴露情况，不能继续声称它是未见独立测试。

AI 辅助冷启动数据包固定保存到：

```text
data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/
```

通用正式数据包保存到`data/world-samples/dataset-packages/<packageId>/`。两个根目录不是可互换的扫描位置：前者保留AI辅助冷启动血缘，后者承载不属于该血缘的通用正式包。训练活动配置必须绑定精确`packagePath`、`packageId`和SHA-256，读取器不得通过目录优先级、最新修改时间或同名文件猜测活动数据包。

程序只能从正式原图库索引读取机器审核与当前数据版本资格均合格、字段完整且哈希可复核的不可变记录。页面、聊天、临时附件和孤立图片不能直接作为训练输入。

数字槽位或“样本194”等简称只允许作为页面显示标签，不能成为授权、训练、验证或审核的正式身份。机器合同必须保存完整`sampleId`、split、source-index路径及SHA-256；如果同时存在容量槽位身份，也必须单独保存并验证，禁止从简称反推样本。

### 8.1 不计正式容量的train-only技术实验

主体规格第9.6节定义的有界学习实验可从已绑定train记录建立独立实验选样清单；原始64份包、四份split、图片、条件和历史资格保持原字节。实验清单不是新的正式Dataset Release，不声明64份已通过，也不把实验样本标记为正式`machine_qualified_positive`。其身份及实际读取行必须可重现，依赖清单逐文件绑定SHA，禁止从目录时间或简称取样。

该实验仍核验许可／AI辅助谱系、原图、泰国来源、条件与RGB绑定和现有拒绝证据；已知拒绝的图片不作监督目标。来源依赖和历史暴露不被洗除；由于只消费train且不作未见验证，可记录这些风险并进行受限学习测量，但不能据此放行任何正式划分。仅做训练集诊断与固定最终步Checkpoint，不读取非train内容或指标，不作Checkpoint选优，不改变审核阈值。所有产物属于`ai_assisted_cold_start`实验谱系，不允许转为独立权重或正式阶段父模型。

## 9. 完整地图结构唯一性

不同文件哈希、条件 ID、真实测量窗口或结构身份只证明记录不同，不能证明内容不同。出图前和接收后都必须比较当前数据集及全部成功、待审、机器失败和数据版本发布否决历史。

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

### 11.1 人物、动物与动态数据资格

自然地图64份容量只证明其发布范围，不是人物外貌、五类动物或时序数据的充足性结论。生命数据仍进入第8节既有正式包目录，以新`packageId`和数据发布身份隔离，不新增平行数据根，不覆写自然地图包。

| 数据类别 | 必备约定 | 数据合格条件 |
|---|---|---|
| 紫微／八字外貌映射 | 文本或规则来源、版本、权利、原文定位、结构化游戏规则、参数与单位／范围、缺时辰路由、精度和冲突处理 | 不把相术当现实人体科学；输入合法、规则可重现、正反边界测试齐全 |
| 《麻衣神相》等候选资料 | `research_candidate`标记、准确书名／版本／出处及待研究问题 | 尚未规则化时不可进入外貌生成；文档提名不等于资料已获得或已获使用权 |
| 五类动物名录 | 五个唯一`animalTypeId`、明确分类层级、每类至少一个真实`speciesId`／学名、区域分布、生境、状态及来源 | 不将别名、颜色、图片或个体计为新类型；在版本化名录完成前标记不可用于正式生命能力 |
| 形态与状态参数 | 物种／人物身份、初始形态、单位／范围、状态、原因、可见体征、适用条件及不适用项 | 真实生物事实与游戏抽象规则分开；不编造数值，不给所有物种套用同一尺度或症状 |
| 生命视觉样本 | 上述档案与状态hash、实体ID、姿态／位置／遮挡、完整RGB、来源权利、质量和语义审核 | 外部文字／分布事实许可不自动包含图片训练权；图像仍遵守第5节来源政策 |
| 时序样本 | `sequenceId`、实体／世界／region／tick、前后状态、变化事实、稳定身份、时间间隔、帧hash | 非法跳变、无原因换体型或逐帧换人不能作合格正样本 |

train／validation／challenge／regression除地图来源窗口外，必须按人物身份、动物个体、同一生成谱系及完整时序片段分组隔离；相邻帧、同角色换背景或裁切增强不得跨组制造假泛化。每个已发布类型和支持状态均需覆盖审计与固定正反样本；具体张数、状态组合和阈值在新数据／审核合同中预先登记，缺少覆盖不得宣告完整MVP合格。

用户出生资料按最小必要原则处理：训练／图像生成消费派生游戏档案和受控来源引用，普通样本日志、公开预览与运行监控不得展开原始出生资料。不得以人类真实健康信息作为未获许可的症状训练输入。

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

## 13. 数据版本与训练变更边界

训练数据合格不构成模型能力通过，阶段闭环通过也不构成能力版本已经发布。新增或修改数据、划分、模型、训练计划和审核阈值必须形成独立能力版本变更；已发布能力版本内的生成、validation、预览复现、机器审核、失败关闭、RuntimeFrame发布与终态记录由本地程序自动完成，不得拆成新的人工签署请求。

程序不得从编号、队列、旧执行包、页面状态或聊天中的“允许”“继续”推导数据或能力资格。同一条件已有待审、通过或失败历史时，重试必须符合当前能力版本的次数和停损合同；真实失败路线重启必须由本地系统建立新的隔离能力版本并重新完成机器门禁。

### 13.1 资产保留与清理判定

JSON、hash文件、重复指针与大文件不能仅凭扩展名或数量判为垃圾。必须先按引用图和资产角色分类：现行发布依赖、冻结基础模型、合法旧数据来源、历史失败证据、可重建派生缓存、未被引用的临时文件。被拒绝Denoiser只保留复核，不得加载；明确登记的项目基础Autoencoder可以按冻结角色保留复用，两者不能混称“沿用旧模型”。

清理候选报告必须记录绝对路径、真实物理目标、大小、重解析点、当前引用、不可变证据依赖、可重建命令及恢复方式。活动任务、现行发布、父资产、失败终态或未完成事务引用的对象不能删除。迁移／去重／清理须在对应任务和安全边界内执行，不能由文档整编顺带触发；删除前必须证明无引用并具备备份或可验证重建方案，不能把运行证据删掉掩盖失败。

## 14. 数据验收标准

数据包只有同时满足以下条件才能进入对应训练门禁：

1. 样本文件、记录、来源、许可和哈希完整。
2. WorldFacts、导演、任务、23 通道和 RGB 身份一致。
3. 实际 Dataset 选中行与 Manifest、容量和 split 完全一致。
4. challenge 与 regression 未参与训练或 Checkpoint 选择。
5. 主题架构、实例细节、道路、水文、岸线和整体骨架无历史重复。
6. 机器审核、数据版本发布资格和用途资格符合当前谱系。
7. 失败记录、旧版本和被撤销容量完整保留且未混入正样本。
8. 训练程序能够从不可变数据包复现同一选择结果。

具体数据包 ID、样本数量、活动版本、运行结论和哈希只从机器记录读取，不写入本规格。
