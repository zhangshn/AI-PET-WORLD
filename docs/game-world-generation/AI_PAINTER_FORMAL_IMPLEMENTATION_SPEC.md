# AI Painter 正式实现规格

更新时间：2026-08-15 23:43:00 +08:00

状态：active-long-term-implementation-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 定位与职责

AI Painter 是 AI-PET-WORLD 的完整世界视觉生产子系统。它把已经存在的 WorldFacts、结构图、视觉事实和世界导演计划表达成原生高分辨率像素风游戏画面，不决定世界中有什么，也不决定可走、碰撞、交互、生态运行或角色行为。

完整地图 RGB 同时是本地自研 AI 的训练目标、未来游戏画面基线和动态世界视觉基线。RGB 不能代替 WorldFacts、结构图或 RuntimeFrame；局部材料、对象图、过渡图和调试预览不能冒充完整地图。

真实地理自然化属于世界事实准备层。外部卫星 RGB、地图瓦片、导航地图和照片不得作为正式 RGB 目标或生成参考；合法测量只能经过来源注册、自然化和结构化派生进入 WorldFacts 与条件通道。

## 2. 唯一正式链路

```text
RealEarthRegionSourcePackage
-> DerivedNaturalWorldFacts
-> WorldFacts
-> VisualFactManifest
-> World Director
-> CompleteWorldVisualTaskPackage
-> Visual Condition Compiler
-> Local Complete-World Model
-> Fresh Complete-Map Candidate
-> Machine Review
-> Owner Final Review
-> GameMapRuntimeFrame
-> /world
```

任一环节缺失、身份不一致或资格不成立都必须阻断。训练、验证、正式推理、RuntimeFrame 与世界运行分别授权，不能从前一环节的成功推导后一环节权限。

## 3. 完整地图画幅合同

正式画面必须满足：

- 原生输出为 `1024×768`，不得由低分辨率、局部图、tile 或 sprite 放大或拼接获得。
- 矩形画幅全部属于世界，内容铺满四边；不得出现透明区、外部纯色背景、深绿遮罩、悬浮切片、沙盘边缘或非世界留白。
- 自然边界表示世界内部的密集生态，不表示世界外背景。
- 画面包含完整区域尺度、连续自然通行、多处可辨识空间或生态分区、自然边界和大世界连接语义。
- 道路、水体和岸线按当前世界事实出现；无水区域不得补水，有水区域不得把同一种河网模板作为默认构图。
- 初始自然世界不得预设家园中心、建设空地、道路汇聚平台或固定中央留白。

只有单一河段、单一道路、单一池塘、单一林间空地或放大局部生态单元时，即使铺满画布，也必须以 `local_scene_not_complete_map` 拒绝。

机器合同由 `data/ai-painter/system-governance/complete-map-world-training-and-dynamic-readiness-contract-v2.json` 提供；Markdown 只定义长期语义，不复制某次合同哈希或运行结果。

## 4. 统一画风与构图多样性

第一版画风固定为 2D 高分辨率像素风完整游戏地图。统一画风至少约束相机、世界尺度、对象比例、逻辑像素密度、纹理语言、轮廓、光照、接地、遮挡和游戏可读性。

统一画风不等于统一构图。不同样本不得复制、镜像、旋转、平移、缩放或轻微变形复用以下内容：

- 区域连接拓扑；
- 水文与岸线骨架；
- 道路轨迹及道路—水体关系；
- 生态与空间分区；
- 整体阅读层级；
- 对象实例、对象簇、密度节奏、空隙和局部过渡。

构图唯一性分为两层：

| 身份 | 比较范围 |
|---|---|
| `themeArchitectureIdentity` | 连接拓扑、水文、道路、分区、边界和整体层级 |
| `instanceDetailIdentity` | 轨迹、轮廓、对象实例与簇、密度、空隙和过渡 |

两层任一重复均不得生成或晋级。结构哈希不同、来源窗口不同、槽位不同、换色或换季节不能替代语义唯一性证明。

## 5. VisualFactManifest

VisualFactManifest 只保存本轮必须表现的视觉事实，并绑定：

```text
manifestId
worldId / regionId / tick
dictionaryVersion
sourceFactIds
runtimeFrameSource
factHash
```

允许类别包括地形、水体、道路、岸线、植被、自然对象、空间、生态、光照和已获准的运行时视觉状态。MVP 自然地图必须排除管家、玩家、建筑、施工、动物和未经批准的交互事实。缺失事实必须显式标记不可用，不得由模型或实现猜测。

## 6. 世界导演

世界导演根据 VisualFactManifest、地图结构、视觉字典和失败约束生成结构化计划，不使用固定场景模板。输出至少包括：

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

导演不能新增世界中不存在的对象、连接口、水体或建设位置。

## 7. 条件编译器

条件编译器把任务包和导演计划转换为模型可消费的结构条件。正式条件包固定维护 23 个版本化通道；离散通道使用 nearest-neighbor 对齐，连续通道使用 bilinear 对齐，最终条件保持原生 `1024×768`。

| 条件层 | 内容 |
|---|---|
| 大尺度结构 | terrain、water、path、shoreline、walkable、collision、depth、focal area |
| 中尺度生态 | 湿度、踩踏、树荫、密集边界、安静区域、细节聚集 |
| 自然过渡 | grass-path、grass-water、water-shore、tree-ground、rock-ground、wet-dry、shadow-light 距离关系 |
| 对象与接地 | instance、type、footprint、height、contact shadow、ground disturbance、occlusion order |
| 视觉控制 | camera、light、palette、material density、edge softness、detail budget、style version |

没有权威几何来源的通道必须标记 `unavailable_authoritative_source_missing`，不得填充猜测数据。初始自然地图的兼容通道 `focal_area` 必须全零且不得参与可视引导。

## 8. 大世界连接合同

`natural-home-large-world-connectivity-v1` 只定义 RegionGraph、EdgePort、PathGraph、HydrologyGraph 和 WalkableGraph 的通用模式；具体区域实例只约束其自身 `regionId`。

每个完整区域任务必须绑定自己的：

```text
connectivityBlueprintId
regionId
edgePortIds
pathGraphId
hydrologyGraphId
walkableGraphId
realEarthRegionSourcePackageId
```

编译器只能表达已批准的道路、水口、生态与海拔过渡，不得根据 RGB、提示词或其他区域蓝图创造连接。每个训练区域至少具有一组与相邻区域双向配对且可达的通行 EdgePort；存在跨界水系时还必须证明上游、下游、流向和岸线连续。

具体区域连接实例不得跨样本复用。泰国 Sakaerat / Wang Nam Khiao 包只服务 MVP 对应区域，不能成为未来区域的默认地形、水文、道路或生态事实。

道路边界拓扑必须绑定当前执行样本。`requiredBoundarySides` 的权威来源只能是当前样本已经批准的 WorldFacts、区域连接蓝图和项目生成的游戏坐标道路几何；当前样本的 `terrain_path_ground` 只用于验证这些来源在对应分辨率上的一致性，不能反向创造、替换或决定世界事实。其他样本的审核预览、条件包、候选合同、数据集成员列表或历史成功方向不得作为当前样本的具体边界值。

配置编译和CPU授权门必须在GPU执行授权消费前，对当前样本身份、条件包身份、权威边界方向、道路几何以及所有计划训练分辨率的条件掩码进行一致性检查。训练器还必须在模型构建和Checkpoint读取前重复执行同一来源约束。任一来源不一致时必须失败关闭，不得修改条件包或掩码来迎合历史候选，也不得把该停止解释为模型效果失败。

## 9. 匿名道路与水文实现

匿名游戏道路由当前世界事实、连接口和匿名种子决定。公开道路数据只可形成有许可、不可逆、非空间的形态统计，不能保存或复制真实单条道路几何。道路中心线、宽度与自然性必须通过点密度、最长线段、曲折度、内角和累计曲率审核。

道路视觉审核必须：

1. 按季节识别合法道路颜色信号；
2. 将候选拆分为 8 连通分量；
3. 使用正式道路条件建立有界支持走廊；
4. 只保留与走廊相交或具有足够条件支持的完整分量；
5. 对保留分量计算覆盖、交集、质心和空间网格指标；
6. 保存原始、保留和排除像素数以及分量理由。

水体审核按条件是否存在水体选择分支。有水条件验证覆盖、空间位置、流动连通和岸线；无水条件只使用强蓝主导和局部连续色面判断意外水体。不得以槽位、图片类别或 Owner 结论硬编码分支。

流动水体必须具有合法入口和出口；封闭水体不得冒充跨区域水系。多张有水地图必须覆盖不同河网连接类型，不能反复使用“分汊—成岛—回流”等同一语义模板。

## 10. 模型与训练能力

模型体系可以由多个自研模块组成，但只有一条正式完整世界训练与推理主线。能力至少包括：

| 能力 | 验收边界 |
|---|---|
| 结构基础 | 学习草、水、道路、岸线和对象位置；低分辨率只用于训练 |
| 中尺度组织 | 在未见结构上保持生态与空间组织 |
| 自然过渡 | 不产生硬切、贴片和漂浮接地 |
| 对象视觉 | 对象位置、尺度、阴影和遮挡与结构一致 |
| 全局统一 | 完整候选具有统一构图、光照、色彩和材质语言 |
| 高分辨率像素风 | 原生 `1024×768`，不依赖放大或拼接 |
| 审核学习 | 学习失败类别并保持历史回归，不能替代 Owner 终审 |

训练可以按 `256×192 -> 512×384 -> 1024×768` 渐进执行；正式候选、审核和 Runtime 只接受模型原生 `1024×768` 输出。后一 Stage 必须验证父 Checkpoint 身份和哈希，训练完成不自动获得正式推理资格。

### 10.1 有界候选、Smoke与完整训练退出规则

有界单样本Smoke只用于证明当前候选在固定样本、种子、初始化、Epoch和审核合同下具备进入完整训练的最低资格。Smoke Checkpoint不得晋级、不得作为正式推理资格，也不得使固定阶段进度前进；Smoke通过只允许项目所有者另行决定是否授权新的完整训练。

每个不可变候选只允许一次有效Smoke。有效Smoke是指配置、身份、资源和授权门全部通过，并已进入第一次授权权重更新；在此之前因配置、路径、合同、资源或证据写入错误停止的执行必须独立失败关闭，只形成执行前阻断证据，不得冒充候选的模型效果结论。修正这类执行前阻断必须使用新的独立Owner授权，并在再次消费GPU授权前完成一次覆盖全部合同字段、调用顺序、路径、哈希、资源和输出目录的CPU审计。

有效Smoke机器审核失败时，当前候选必须失败关闭并返回Owner决策，不得通过自动重试、连续单字段修补、降低审核阈值或改写失败证据延长同一候选。只有形成新的有界候选及其独立CPU回归后，才能申请新的Smoke。有效Smoke通过后，新的完整训练仍必须从Stage 0规定的固定随机初始化开始；Stage 1只能加载本次Stage 0 Checkpoint，Stage 2只能加载本次Stage 1 Checkpoint。Stage 0、1、2训练和各自机器审核全部通过后，完整训练阶段才算完成。

### 10.2 Stage4连续授权包与顺序执行合同

Owner可对一份精确、不可变的Stage4执行计划执行一次离线签署。总包必须包含且只包含Smoke、Stage 0、Stage 1和Stage 2四个固定角色，并为协调器及每个角色分别形成独立签名身份、精确动作集合和一次性消费记录。总包不是通配授权；执行计划没有逐项写明的动作不得由模式、运行器或执行器自动补齐。

持续执行器必须遵守以下顺序与边界：

1. 在任何正式写入前验证总包、信任注册表锚点、协调器授权、四份子授权、运行器路径与SHA-256、候选身份、输出目录新鲜性和固定60%基线；
2. 先原子消费协调器授权，再按`Smoke -> Stage 0 -> Stage 1 -> Stage 2`逐项执行；
3. 每项先执行真实运行器预检，预检成功后才原子消费本项授权并启动同一长时运行器；
4. 后一项只有在前一项正式成功终态、机器审核、Manifest、Finalization和所需Checkpoint身份全部满足签署合同时才能启动；
5. Stage 1只能使用本包Stage 0成功Checkpoint，Stage 2只能使用本包Stage 1成功Checkpoint；历史失败、退出、部分完成、Smoke或诊断Checkpoint不得成为父Checkpoint；
6. 任一真实失败、证据冲突、输出目录冲突、授权过期或Owner业务选择点必须停止整个连续执行，未开始项保持未消费且不得自动重试；
7. 只有四项均成功，才能形成Stage4成功终态并把唯一计划表固定进度从3/5（60%）更新为4/5（80%）。

离线签署器是唯一允许读取Owner私钥的组件，部署在项目目录之外；项目代码、Codex、训练器和持续执行器只接触签名授权及公钥信任注册表。所有运行级授权、消费、日志、进度、终态和Checkpoint证据写入`.runtime/`、`data/`和SQLite，不复制到正式规格或唯一计划表。

## 11. 数据与验证隔离

`complete-maps`、`terrain`、`vegetation`、`natural-objects` 和 `transitions` 是五类并行视觉知识，不是五个训练阶段，也不允许推理时从目录选图拼接。

训练数据必须按图片哈希、结构哈希、来源窗口、主题架构和实例细节隔离为：

| split | 用途 |
|---|---|
| train | 更新权重 |
| validation | 选择 Checkpoint，不参与权重更新 |
| challenge | 未见结构和条件的独立验证，训练期不得读取内容或指标 |
| regression | 阻止历史失败复发，不参与权重选择 |

模型晋级必须同时证明事实一致、结构响应、视觉质量、未见结构泛化、重复控制和历史回归；不得通过降低门槛获得通过。

## 12. 来源与自研边界

“本地执行”“项目自研代码”“项目自研架构”“项目独立权重”是不同声明。第三方权重、激活或模型输出不得进入独立权重训练链。AI 辅助冷启动数据必须使用独立谱系并声明生成依赖，不能标记为 `project_owned_independent_weights`。

第三方模型实验只作为不可变失败与对照证据保留，不得由正式完整世界入口加载。商业发布前必须对模型、数据、依赖和许可证进行专业复核；本规格是工程治理合同，不构成法律意见。

## 13. 审核与资格

正式候选依次经过：

1. VJ-0：来源、身份、尺寸、哈希和绑定；
2. VJ-1：图像技术质量；
3. VJ-2：世界事实、条件响应、道路、水文、岸线、对象和完整地图语义；
4. Professional Aesthetic：像素风、尺度、层级、纹理、接地和游戏可读性；
5. 全历史构图与语义拓扑比较；
6. Owner 最终视觉审核。

机器通过只表示进入 Owner 审核资格。Owner 拒绝覆盖同一图片的机器通过资格，但不得覆盖或删除旧机器记录。Owner 通过也不自动授予训练、正式推理、RuntimeFrame 或 `/world` 权限；每种资格由自己的合同和授权决定。

## 14. 自动记录责任

程序必须自动保存任务、WorldFacts、导演、条件、模型配置、数据清单、父 Checkpoint、逐 Epoch 指标、Token、硬件、图片、审核、失败、时间、哈希和 SQLite 索引。每次运行使用不可变 Run ID；`latest.json` 只作查询指针。

聊天、页面 GET、Codex 记忆或 Markdown 不能代替机器记录。需要 Owner 决策时，本地系统生成带范围、不变量、禁止副作用和证据引用的 `owner-action-request`；该请求不构成授权。

## 15. 禁止事项

1. 禁止程序直绘 SVG、Canvas、CSS 或规则纹理作为正式 RGB。
2. 禁止复用旧图、旧 RuntimeFrame、局部图或放大图冒充新推理。
3. 禁止历史 RGB 进入生成提示、图像参考或 WorldFacts 反推。
4. 禁止固定一个道路、水文、岸线或生态骨架反复换皮。
5. 禁止模型或程序创造缺失的世界事实和连接口。
6. 禁止机器审核替代 Owner 终审。
7. 禁止降低阈值、删除失败证据或重写历史来制造通过。
8. 禁止由队列、编号、旧授权或聊天中的“继续”自动扩展任务范围。
9. 禁止未获独立授权启动训练、验证、正式推理、RuntimeFrame 或世界运行。

## 16. 验收标准

AI Painter 实现合格必须同时满足：

- 当前任务的 WorldFacts、导演、23 通道、模型输入和 RGB 身份一致；
- 原生完整画幅、像素风和游戏可读性符合合同；
- 道路、水文、岸线、生态分区和对象组织响应当前事实；
- 与全部成功、待审和失败历史不存在主题架构或实例细节重复；
- 训练、验证、推理和审核的不可变证据完整可查；
- 候选未越过 Owner 授权、正式推理、RuntimeFrame 和 `/world` 门禁。

具体运行状态、样本数量、Run ID、Checkpoint 哈希和临时阻断只从本地机器证据及唯一模块计划表读取，不写入本规格。
