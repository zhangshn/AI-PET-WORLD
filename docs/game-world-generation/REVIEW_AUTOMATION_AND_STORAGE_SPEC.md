# 审核、自动闭环与存储正式规格

## 2026-08-02 V7训练失败自动存储

V7第一次GPU冒烟在训练前由Python旧授权门禁拒绝。程序已保存runId、双时区时间、退出码、完整stderr、算法源文件hash、`checkpointCreated=false`和`gpuTrainingStarted=false`，并写入SQLite程序事件；不得把“已调用GPU训练入口”描述为“模型已训练”。失败后自动续跑和自动改代码重试均被禁止，当前只保存最小owner动作请求并等待决定。

## 2026-08-02 64容量闭合与全历史失败学习保留

新64组当前64个活动成功版本已全部owner通过并登记V7容量；旧失败版本继续位于未通过组且容量为0。序列审核器现按版本识别每个序号唯一活动版本，不再把“存在失败历史版本”误判为当前序号失败，也不得因此删除失败历史。

自动视觉审核学习器的完整地图机器审核采集上限由80扩大到512，保证旧V6拒绝验证在大量新64组审核写入后仍进入当前全历史失败学习。该调整只扩大证据保留范围，不修改任何审核阈值或通过标准。最新CPU就绪报告通过，但GPU激活申请仍为`waiting_owner_authorization`；存储系统不得依据CPU通过自动启动训练、推理、RuntimeFrame或`/world`。

## 2026-08-01 新64组失败8张替换执行结果

序号`23、33、39、43、45、47、49、55`已使用各自当前权威泰国条件包重建。每张替换图仅读取自身一张语义条件引导图，旧失败RGB引用数为0；8张全部通过未降低阈值的道路/边界、水文/岸线、生态、完整地图、风格及全历史构图门禁，并按明确的批量委托授权进入成功组。

原8张失败记录保持`rejected`，继续显示在`failed-records`，没有删除或覆盖。当前`thailand-rebuild64-20260731`的`01`至`64`每个序号均且仅有一个`ai_assisted_cold_start_eligible + owner_approved`成功记录。GPU训练、RuntimeFrame和`/world`均未启动。

更新时间：2026-08-02 09:55:00 +08:00

状态：active-architecture / 新64组成功活动记录64/64 / 容量64/64 / CPU门禁通过 / V7 GPU训练待明确激活

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 2026-08-01 新64组机器最终筛选覆盖规则

`thailand-rebuild64-20260731`活动64张不再进入项目所有者逐张人工筛选队列。程序按`thailand-rebuild64-machine-final-review-contract-v1`复审并直接完成二分类：机器硬门禁问题数为0时，使用明确的所有者批量委托模式写入成功终态；问题数大于0时直接写入`rejected`和`failed-records`。成功审核记录必须声明没有逐张人工目视；失败记录保持`ownerReviewStatus=not_reached_machine_failed`，不得伪造所有者视觉拒绝。

旧版本、失败原图、机器审核历史、条件绑定和SHA-256全部保留。批处理不得自动修图、重试、重生成、降低阈值、启动GPU、创建RuntimeFrame或进入世界。执行结果为成功56张、未通过8张、待人工审核0；未通过编号为`23、33、39、43、45、47、49、55`。

### 失败8张的有界替换

新的明确授权只覆盖`23、33、39、43、45、47、49、55`各一个替换版本。程序必须把旧机器审核中的issue codes、图片SHA-256、当前conditionId、主题/细节结构身份、指定道路入口边及禁止边界写入修复包。生成器只能读取当前条件引导图，不得读取旧失败RGB；替换图仍执行全部机器硬门禁并直接分类，不重新建立逐张人工审核队列。

## 0-BB. 2026-08-01 失败直达与全画幅机器门禁

凡出现透明或空洞、外部纯色/深绿背景、悬浮地图切片、装饰性多边形边缘、非世界留白、道路未实际接触指定边界、未约定的额外边界出口、镜像翻转伪造连接、缺少未来动态身份或64组框架重复，机器审核必须直接失败；不得以“主体区域看起来完整”降级为提醒，也不得沿用旧机器通过结果。

全画幅审计使用边角颜色聚类、局部纹理方差和边界连通块检测外部遮罩；边界连接审计直接读取RGB道路栅格与四侧边带接触，不只比较道路中心位置。失败原图、owner决定、机器复审和历史目录全部保留，页面分类改为`failed-records`，`conditionalTrainingEligible=false`，正向容量贡献必须为0。

本轮6张旧候选（新64组01至05、53）已经同时固定为`owner_rejected`与`machine_rejected`；自主训练成功类型页实测活动记录0、带图片记录0，未通过页实测可检索到6条。审核合同SHA-256=`a3ebae47ab542cfc818b99fd9237356edda18d666253a85ac00def4c2cf1b9bd`。

## 0-AAAAAAAAA. slot-149 owner通过与容量登记闭合

项目所有者对slot-149明确回复“通过”。正式owner-review文件和不可变历史记录已经写入，条件RGB请求状态更新为`generated_intaked_machine_passed_owner_approved`；容量贡献`ai-assisted-v7-capacity-contribution-v7-capacity-slot-149-2026-07-30T01-25-54-965Z`登记并检查通过。

程序保留原`owner-action-request-slot-149-owner-visual-review-20260730`等待记录，并新增`owner-action-request-slot-149-owner-visual-review-resolution-20260730`解决记录，禁止用可变覆盖冒充历史演进。当前容量=4/64、缺口=60、GPU=0。该审核决定不得触发slot-150、GPU训练、RuntimeFrame或`/world`。

## 0-AAAAAAAA. slot-149机器通过后的owner审核等待状态

slot-149当前图片身份固定为`ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v1`，图片SHA-256=`c74339a56b0d1d9a76cced942857d76cfe58a37464b2afc4c04e9bb88feaf039`。机器审核全部通过并完成145张全历史构图比较，不能据此自动写入owner决定。

程序必须保持：条件RGB请求=`generated_intaked_machine_passed_waiting_owner_review`、owner审核=`pending_review`、`conditionalTrainingEligible=false`；本地动作请求=`owner-action-request-slot-149-owner-visual-review-20260730`、`waiting_owner_review`；当前容量=3/64、缺口=61、GPU=0。

只有项目所有者明确回复通过或拒绝后，正式owner-review入口才能写入决定。通过后才允许登记slot-149容量；拒绝后只允许保存失败与学习证据。两种结果都必须停在下一张RGB之前，不得连带授权slot-150、GPU训练、RuntimeFrame或`/world`。

## 0-AAAAAAA. slot-148 owner通过与容量登记闭合

项目所有者对slot-148明确回复“通过”。正式owner-review文件和不可变历史记录已经写入，条件RGB请求状态更新为`generated_intaked_machine_passed_owner_approved`；容量贡献`ai-assisted-v7-capacity-contribution-v7-capacity-slot-148-2026-07-30T01-00-47-626Z`登记并检查通过。

程序保留原`owner-action-request-slot-148-owner-visual-review-20260730`等待记录，并新增`owner-action-request-slot-148-owner-visual-review-resolution-20260730`解决记录，禁止用可变覆盖冒充历史演进。当前容量=3/64、缺口=61、GPU=0。该审核决定不得触发slot-149、GPU训练、RuntimeFrame或`/world`。

## 0-AAAAAA. slot-148机器通过后的owner审核等待状态

slot-148当前图片身份固定为`ai-cold-start-v7-v7-capacity-slot-148-grassland-forest-transition-v1`，图片SHA-256=`dfab6240b07dddeab8b40c6d2e278daa0c98146959061901681f90403f090dfa`。机器审核全部通过并完成144张全历史构图比较，不能据此自动写入owner决定。

程序必须保持：条件RGB请求=`generated_intaked_machine_passed_waiting_owner_review`、owner审核=`pending_review`、`conditionalTrainingEligible=false`；本地动作请求=`owner-action-request-slot-148-owner-visual-review-20260730`、`waiting_owner_review`；当前容量=2/64、缺口=62、GPU=0。

只有项目所有者明确回复通过或拒绝后，正式owner-review入口才能写入决定。通过后才允许登记slot-148容量；拒绝后只允许保存失败与学习证据。两种结果都必须停在下一张RGB之前，不得连带授权slot-149、GPU训练、RuntimeFrame或`/world`。

## 0-AAAAA. slot-147 owner通过与容量登记闭合

项目所有者对slot-147明确回复“通过”。正式owner-review文件和不可变历史记录已经写入，条件RGB请求状态更新为`generated_intaked_machine_passed_owner_approved`；容量贡献`ai-assisted-v7-capacity-contribution-v7-capacity-slot-147-2026-07-30T00-39-05-580Z`登记并检查通过。

程序保留原`owner-action-request-slot-147-owner-visual-review-20260729`等待记录，并新增`owner-action-request-slot-147-owner-visual-review-resolution-20260730`解决记录，禁止用可变覆盖冒充历史演进。当前容量=2/64、缺口=62、GPU=0。该审核决定不得触发slot-148、GPU训练、RuntimeFrame或`/world`。

## 0-AAAA. slot-147机器通过后的owner审核等待状态

slot-147当前图片身份固定为`ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v1`，图片SHA-256=`0dce7acccce15d238ff92afe2bb9dc47ee54e730db0da8569640a5aba1dbbf12`。机器审核全部通过并完成143张全历史构图比较，不能据此自动写入owner决定。

程序必须保持以下状态：

1. 条件RGB请求=`generated_intaked_machine_passed_waiting_owner_review`；
2. owner审核=`pending_review`；
3. `conditionalTrainingEligible=false`；
4. 本地动作请求=`owner-action-request-slot-147-owner-visual-review-20260729`、`waiting_owner_review`；
5. 当前容量=1/64、缺口=63、GPU=0。

只有项目所有者明确回复通过或拒绝后，正式owner-review入口才能写入决定。通过后才允许登记slot-147容量；拒绝后只允许保存失败与学习证据。两种结果都必须停在下一张RGB之前，不得连带授权slot-148、GPU训练、RuntimeFrame或`/world`。

## 0-AAA. 本地owner动作请求与外部员工边界

本地系统是正式判断、授权请求、审核状态和长期记忆的唯一载体。Codex只作为受控执行与检查员工：可以执行本地系统明确分派的有界生成、修复或检查，但不得推断owner决定、绕过门禁、代替本地存储或依靠聊天保存下一动作。

当系统需要项目所有者允许后才能继续时，必须在等待前生成`owner-action-request`，至少保存：

1. 当前任务和图片/条件身份；
2. owner已经表达的视觉或业务结论；
3. 本地机器发现和阻断码；
4. 为什么正式程序不能直接继续；
5. 只请求的最小动作范围；
6. 必须保持不变的图片、WorldFacts、条件、阈值或其他合同；
7. 禁止发生的新RGB、自动下一槽、GPU训练等副作用；
8. 面向owner展示的完整说明；
9. 证据路径、hash和获批后的执行/复审/登记链。

职责合同固定为`data/ai-painter/system-governance/local-ai-responsibility-contract-v1.json`；记录入口为`npm run record:ai-painter-owner-action-request -- --input <request-input.json>`。正式记录保存到`.runtime/ai-painter/owner-action-requests/<requestId>/request.json`，同时写入训练过程事件和SQLite索引。`latest.json`只作读取指针，聊天文本和外部智能体记忆均不是正式证据。

slot-146水体误判说明已按该合同补录为已解决请求，只引用不可变历史证据，不改写原拒绝、复审、owner通过或容量贡献。后续程序应在发现门禁冲突的同一运行中直接调用统一记录器，而不是等待Codex临时组织说明。

## 0-AA. 2026-07-29 历史结构身份兼容审计

生成前全历史门禁必须区分三类证据：

1. `native_structural_identity`：直接读取当前正式蓝图的具体连接、主题架构和实例细节身份；
2. `legacy_blueprint_structural_identity_compatibility`：仅对具有不可变旧版训练蓝图、具体连接身份和原有完整几何的记录，生成审计旁路身份并保存蓝图路径及SHA-256；
3. `legacy_guide_only_composition_reference`：仅限明确登记的`ai-cold-start-map-003-condition-guided-east-river`，连接身份固定不可用，只执行条件引导直接、水平镜像、垂直镜像及180度旋转的主题和细节比较。

所有类型都不得读取历史RGB或修改历史记录。第三类不能参与具体连接身份相等判断，也不能被解释成连接审核通过；它只保证该早期构图继续进入反重复范围。除明确登记的单条早期记录外，任何缺少结构身份的历史记录继续阻断。

审计产物必须保存`legacyStructuralIdentityCompatibilityCount`、`legacyGuideOnlyCompositionReferenceCount`、逐条兼容证据、`connectivityComparisonIncompleteCount`以及历史RGB/历史记录修改边界。兼容处理不得改变水体、道路、复合骨架、细节骨架、镜像或旋转阈值。

## 0-A. 2026-07-29 区域连接作用域审核门禁

在构图新颖性审核之前，程序必须先执行具体区域连接实例审核：

1. 当前样本具有独立`regionId`；
2. `connectivityBlueprintId`属于该`regionId`，不是默认`region-0001`；
3. EdgePort、PathGraph、HydrologyGraph和WalkableGraph来自当前WorldFacts及经批准事实链；
4. 当前景观没有被强制补入不存在的跨区域水系；
5. 与历史容量不存在同一具体连接实例复用、镜像、旋转、轻微变形或仅内部曲线变化。
6. 当前`regionId`位于可连通的世界RegionGraph中，至少一组跨区域通行端口已与相邻区域双向配对，PathGraph/WalkableGraph可证明到达；不存在孤立区域或悬空端口。
7. 当前`themeArchitectureIdentity`与全部历史在连接、水文、道路、分区、边界和整体层级上不重复。
8. 当前`instanceDetailIdentity`与全部历史在具体轨迹、轮廓、对象实例/对象簇、密度、空隙和过渡上不重复。
9. 当前`regionId`绑定自己的`RealEarthRegionSourcePackage`；包内区域范围、地形、土地覆盖、气候、土壤、水文、生态、连接、许可、版本、hash和派生清单完整，且没有复用其他地区事实补位。

失败码固定为`concrete_region_connectivity_instance_reused`、`current_region_connectivity_facts_missing`、`region_disconnected_from_world_graph`、`complete_map_theme_architecture_duplicate`、`complete_map_detail_content_duplicate`或`real_earth_region_source_package_missing`。门禁在RGB算力调用前失败关闭，并在RGB生成后再次比较；不能用不同hash、不同测量窗口、换色、换季节、轻微位移或项目风格一致性覆盖。

修订前slot-124条件只是受影响记录之一；当前全部历史容量必须进入连接作用域、主题架构和实例细节三层重审。重审完成前控制台和数据包只能显示`pending_connectivity_theme_and_detail_reaudit`，不得显示为可训练容量，不得触发任何新RGB或V7 GPU训练。

当前MVP来源审核还必须明确显示：

```text
productScope = long_term_real_earth_multi_region
currentRegionScope = thailand_sakaerat_wang_nam_khiao_mvp_only
currentRegionSourcePackageCount = 1
otherCountryDataMixed = false
thailandFactsUsedOutsideThailand = false
```

未来地区进入审核时必须生成新的区域来源包记录，不能改写当前泰国包或只更换`regionId`。若来源空间范围与区域身份不一致，固定写入`real_earth_region_source_scope_mismatch`；若检测到跨地区事实复用，固定写入`cross_region_source_fact_reuse_forbidden`。

## 0. 2026-07-25 64张MVP容量的自动化与存储边界

当前64张MVP容量计划只由程序生成、保存和审计。最新runId=`ai-assisted-v7-data-capacity-plan-2026-07-25T03-00-46-178Z`已自动保存计划、覆盖矩阵、缺口、双时区时间、事件和SQLite索引；本轮生成RGB=0、GPU训练=0、训练=0。

后续38条数据若获项目所有者有界授权，每条仍须由程序自动保存成功、失败、阻断、图片、世界事实、World Director、23通道、来源许可、机器审核、owner审核、双时区时间、SHA-256和SQLite索引。页面只读取和提交明确审核命令，不得代替程序创建业务记录。旧104连续批次不得恢复，64张完成也不得自动启动GPU训练。

## 1. 审核链

```text
Fresh Candidate
-> VJ-0 Source and Identity
-> VJ-1 Pixel Quality
-> VJ-2 Structure and Semantics
-> Professional Aesthetic Gate
-> Owner Final Review
-> RuntimeFrame Entry Gate
```

| 闸门 | 职责 |
|---|---|
| VJ-0 | 验证当前任务包、worldId、tick、字典、模型、checkpoint、seed、图片 hash 和非复用声明 |
| VJ-1 | 阻断破图、错误像素网格、抗锯齿、平滑缩放、噪声、重复 stamp、色彩崩坏、像素密度不一致和原生分辨率错误 |
| VJ-2 | 验证道路、水体、岸线、对象和完整地图语义与世界事实一致 |
| Professional Aesthetic | 判断构图、层次、过渡、对象接地、统一光照、材质语言和正式游戏感 |
| Owner Final Review | 项目所有者最终批准或拒绝；机器通过不能替代 |
| RuntimeFrame Entry | 只允许同一图片身份下最新 owner-approved 完整 RuntimeFrame 进入 `/world` |

### 1.1 第一版像素视觉硬门禁

| 检查项 | 固定要求 |
|---|---|
| 原生画布 | `1024×768`，必须由模型直接生成一张完整高分辨率像素风地图，而不是局部 crop、材料槽或低分辨率放大图 |
| 原始生成文件门禁 | 正式本地模型候选的原始文件必须恰好为原生 `1024×768`，审核文件与原始文件 hash 一致。AI辅助冷启动来源允许按 `owner-approved-high-resolution-four-three-derivative-v1` 保存不小于1024×768的精确4:3原图，并生成nearest-neighbor、无裁切、无放大的1024×768训练/机器审核派生图；审核必须同时验证原图与派生图双hash、尺寸、变换和用途隔离。该派生图永远不是正式候选或Runtime图 |
| 展示规则 | 原生文件是唯一质量基准；响应式显示不得改变事实，审核器必须读取原生像素数据 |
| 风格门禁 | 必须统一视角、尺度、对象比例、像素纹理、轮廓、光照、接地和遮挡；普通插画套像素滤镜不得通过 |
| 像素网格 | 所有边缘、阴影、纹理和对象细节必须落在统一逻辑像素网格上 |
| 像素密度 | 草地、道路、水岸、树木、石头和花草使用一致的像素尺度与观察角度 |
| 色板 | 有限、协调且具有地形可读性；不得退化为均匀绿色噪声或过量抖色 |
| 重复控制 | 阻断明显 tile 接缝、棋盘格、连续重复图案、复制树和机械 stamp |
| 完整地图专业性 | 像素风不能降低入口/出口、自然通行、水岸、可走性、构图、接地和 owner 终审标准 |
| 完整地图范围 | 必须表现整体入口/出口关系、连续自然通行组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；只有单一河段、道路、池塘、林间空地、材质范围或放大局部生态单元时，固定写入 `local_scene_not_complete_map` 并拒绝 |
| 自主选址边界 | 初始自然地图出现固定家园中心、规则中央空地、道路汇聚平台、建筑候选地、施工预留地或为其清空对象时，固定写入 `preset_home_site_or_construction_clearing_forbidden` 并拒绝；机器通过也不得覆盖项目所有者判断 |
| 水体适用性 | 水体只在当前世界事实要求时出现并服从水文图；东南亚身份不等于每张图都围绕水体，无水或少水蓝图不得被生成器自行补水 |

完整地图范围必须执行两次门禁：生成前检查世界导演、任务包和23通道是否描述完整区域；生成后检查RGB是否仍保持完整地图尺度。生成前失败不得调用图像生成算力，必须保存无图阻断记录；生成后失败必须保存真实图片、失败码、时间戳、hash和证据路径，但不得进入完整地图正样本。

机器审核还必须验证新图符合由冷启动基础完整地图集合计算得到的版本化完整地图视觉标准。标准一致性检查负责镜头、世界尺度、对象比例、像素语言、光照和游戏可读性；构图多样性检查负责阻断水体、道路、分区和整体布局模板复用。两项必须分别记录，不能用“风格一致”掩盖“构图重复”，也不能用“构图不同”放行风格漂移。缺少可追溯视觉标准时在生成前写入 `foundational_complete_map_visual_standard_missing`；构图重复时写入 `complete_map_composition_diversity_failed`。

完整地图冷启动原图的水体可见信号必须按区域类型解释，不得用同一个面积门槛迫使窄山溪变成宽河。`tropical-mountain-stream` 的最低水体可见信号固定为 `0.02`；其他声明必须出现淡水的当前区域类型继续使用 `0.03`。该像素比例只负责阻断“要求有水但画面几乎无水”的记录，不证明溪流连通、水岸正确或水文事实成立；连续性、结构语义和项目所有者审核仍必须分别通过。

## 2. 审核记录

每次审核必须自动保存中英文标题和说明、审核器版本、输入图片 hash、各维度分数、失败码、受影响区域、证据路径、状态、时间戳和下一修复目标。

owner review 固定状态：`pending_review`、`owner_approved`、`owner_rejected`。人工拒绝必须覆盖同一图片此前机器通过结论；后续新图片不继承旧图片的拒绝。

### 2.1 训练门禁批准记录

项目所有者对训练门槛、Autoencoder 视觉续行结论和连接覆盖门槛的批准，必须由 `npm run record:ai-assisted-training-gate-owner-approval` 统一写入。程序必须自动保存不可变历史记录、`latest.json`、中英文程序事件和证据 hash，并同步更新连接契约与覆盖蓝图；聊天说明不能替代正式记录。

截至 2026-07-19，已批准的第一轮门槛固定为：当前条件配对 `21` 套，Autoencoder v2 允许作为后续训练初始化继续使用，连接覆盖正样本至少 `27` 条、负样本至少 `27` 条，9 个连接轴每轴至少 `3` 条正样本和 `3` 条负样本。程序已自动保存并复核 `27/27` 正样本和 `27/27` 负样本，九轴全部达到 `3正+3负`；AI辅助数据包连接门禁已打开。门禁打开只允许进入条件去噪程序实现与训练，不等于形成正式checkpoint、正式候选或RuntimeFrame。

## 3. 失败回写

失败记录必须转换为：

```text
failure family
affected region
negative sample label
judge-gap record（机器漏判时）
dictionary fix target（规则缺失时）
dataset target
model capability target
next task constraint
```

拒绝图不得进入正样本。只有具备图片证据、失败码、受影响区域和下一训练目标的失败记录才算可学习经验。

机器拒绝图由 `register:current-bootstrap-machine-negative` 自动登记为 `machine_negative`；它不要求也不得伪造 owner rejection。登记后程序必须重新运行数据审计和不可变数据包构建，使控制台看到真实最新计数。

完整地图机器审核记录必须直接进入自动失败学习器；生成下一任务约束时，`complete_map_machine_review` 必须优先于历史局部材料失败记录。跨 run 图片 hash 完全相同时必须记录候选不新颖失败，不能把重复推理计为新数据。

## 4. 自主循环

程序未来可以自动执行：读取证据、诊断失败、选择已授权任务、构建数据、训练、推理、机器审核、保存结果和生成下一轮计划。

上述“未来可以自动执行”不构成当前出图授权。当前任何新 RGB 都必须同时具有正式执行文档中的具体任务身份和项目所有者本轮明确生成命令；不得根据队列、编号、失败修复计划、历史“继续”或模型自主判断自动出图。

程序必须停止等待项目所有者的情况：

1. 需要 owner final review。
2. 需要改变数据来源政策、字典标准、模型路线、审核门槛或页面结构。
3. 数据不足、来源不明、身份冲突或无法形成合法下一任务。
4. 连续失败达到正式停止条件。
5. 同一条件已有 `pending_review` 图片；在项目所有者完成该图片审核前，不得创建下一版本。
6. 同一条件已有生成历史但没有项目所有者明确重试授权和具体原因；程序应推进其他未尝试条件，而不是继续递增版本号。

## 5. 实时状态

实时状态必须来自训练控制器、真实子进程 PID、步骤状态和定时刷新记录，不得根据 GPU 占用率猜测，也不得读取旧 running 文件冒充运行。

跨进程运行锁保证同一时间只有一个正式训练动作。运行期间定时刷新状态；完成、失败或取消后必须清理定时器和锁。

状态至少区分：`idle`、`dataset_building`、`training`、`inference`、`reviewing`、`archiving`、`blocked`、`failed`、`completed_waiting_owner_review`。

## 6. 控制台边界

控制台是只读观察与明确命令入口，不是训练记录的创造者。GET 页面不得修改台账、更新时间或历史快照。

主页只保留状态和功能入口；训练记录、候选审核、自动日志、数据字典、生成归档和目录分别进入对应页面。页面命名、结构和样式继续受 `docs/ai-painter-progress/` 锁定规格约束。

## 7. 自动存储

### 7.0 物理存储与索引合同

项目所有者已批准`D:\AI-PET-WORLD-DATA`作为AI Painter独立数据根。热运行目录固定为`hot\runtime`，冷归档目录固定为`cold\runs`，SQLite目录固定为`catalog`，迁移证据目录固定为`migrations`。项目内`.runtime`只作为兼容逻辑入口；完成无损迁移后必须使用目录联接指向D盘热运行目录，不得复制出第二套可写业务身份。

文件继续是正式证据，SQLite是程序自动维护的目录与查询层。程序写入训练状态、统一事件、run manifest、图片、checkpoint、审核或失败证据后，必须同步登记或在当前run结束时事务化补齐SQLite索引。GET页面不得写业务台账，也不得递归扫描全部运行目录；主页只读取状态摘要，历史列表必须分页查询SQLite，单条详情按URI读取明确文件。

已完成run进入冷层时，程序必须先生成不可变归档和归档manifest，记录原始相对路径、文件数、总字节、每个文件SHA-256和归档SHA-256；只有SQLite事务提交成功后才能把热层标记为`archived`。本轮迁移只复制、校验、建库和切换逻辑入口，不删除F盘旧数据。

本轮迁移`runtime-to-d-20260720-0528`已由程序完成：源/目标文件数均为700,058，总字节均为94,808,690,230，逐文件SHA-256校验通过700,058条，差异0条，manifest SHA-256=`08a56d7cb74e3ef6fa46f817abb205c00bd00ea6e84b9dcefabdcc7de42cae6a`。`.runtime`目录联接、SQLite artifact索引、637条历史程序事件回填和后续run定向自动索引均已启用；F盘备份继续保留。GET页面只读索引或选中单条证据，不再以页面访问触发全目录扫描或业务写入。

| 数据 | 当前正式位置 |
|---|---|
| 训练总账 | `.runtime/ai-painter/training-process-ledger/` |
| 运行控制与实时状态 | `.runtime/ai-painter/training-control/` |
| 训练档案 | `.runtime/ai-painter/training-run-archive/` |
| 第一版家园原图库 | `data/world-samples/original-image-library/natural-home-v1/` |
| 正式样本登记 | `data/world-samples/registry/<dictionaryVersion>/` |
| 不可变完整地图数据包 | `data/world-samples/dataset-packages/<packageId>/` |
| VisualFactManifest | `.runtime/ai-painter/world-visual-fact-manifests/` |
| 完整视觉任务包 | `.runtime/ai-painter/world-visual-generation-task-packages/` |
| 编译后模型条件 | `.runtime/ai-painter/world-visual-generation-task-packages/<taskId>/compiled-conditions/` |
| bootstrap 推理候选 | `.runtime/ai-painter/complete-world-visual-bootstrap-inference/` |
| foundation 自动候选批次 | `.runtime/ai-painter/complete-world-visual-foundation-batches/` |
| bootstrap 机器审核 | `.runtime/ai-painter/complete-world-visual-machine-reviews/` |
| AI 冷启动原图机器审核历史 | `data/world-samples/original-image-library/natural-home-v1/<category>/<record>/reviews/machine/`；`machine-review.json` 仅为最新指针 |
| 正式推理候选 | 后续正式 `.runtime/ai-painter/complete-world-visual-inference/` |
| AI辅助条件推理验证 | `.runtime/ai-painter/ai-assisted-conditional-inference-validation/<runId>/`；固定保存验证图、模型报告、清单、23通道hash、机器审核和失败记录，不得进入Runtime |
| Runtime 合成 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame | `.runtime/game-map-runtime-frame/` |
| 失败学习 | `.runtime/ai-painter/auto-visual-judge-learning/` |
| 条件编号顺序阻断 | `.runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/sequence-blocks/` |

所有目录使用不可变 runId 和历史记录；`latest.json` 只作为兼容指针，不是唯一证据。SQLite中的URI和hash是查询索引，也不得替代原始文件。

AI辅助条件去噪训练程序必须在统一训练总账中自动写入训练预检启动、阶段成功、阻断和失败事件；每条事件必须包含中英文标题与说明、runId、分辨率阶段、预测目标、证据路径、退出码或失败码，并明确 `finalGameMapSuccess=false`、`canEnterWorld=false`。checkpoint manifest、训练进度、诊断报告和统一总账是并列证据，任何一项都不得由页面访问或聊天记录替代。2026-07-19 已将 V3 三阶段训练和无RGB数值诊断按原始manifest/diagnostic证据补录到统一总账；后续运行由训练程序直接自动写入，不再依赖人工补录。

V4及后续版本还必须由训练程序为每个run自动保存 `algorithm-evidence.json`，至少包含配置、模型、训练器、数据读取器、扩散过程和正式runner的路径与SHA-256，以及模型合同、条件缩放合同、训练损失合同、checkpoint选择合同和双时区时间戳。训练指标必须逐项保存velocity、clean latent、latent gradient、离散条件重建、连续条件重建和复合质量分数；只保存总loss不满足审计要求。成功、阻断、异常退出和部分产物均不得漏记。

诊断和修复检查与训练run适用相同的自动保存责任。每次诊断必须由程序保存中英文根因、触发失败码、输入图片/checkpoint/审核hash、证据路径、受影响合同、禁止项和下一授权边界；每次修复检查必须保存修复前后合同、源文件SHA-256、逐项检查结果、进程退出码、是否使用GPU、是否生成图片、正式资格字段以及UTC和Asia/Shanghai时间。不可变run记录、`latest.json`兼容指针、统一程序事件和SQLite artifact/event索引必须同时写入，任一缺失均不得声称诊断或修复闭合。页面只读这些程序证据，不得在GET访问时补写。

2026-07-21项目所有者授权V4失败诊断与V5代码修复。程序自动保存诊断runId=`ai-assisted-conditional-v4-diagnosis-2026-07-20T21-59-47-587Z`，其中锁定V4四项失败、最终输出未绑定条件的根因、checkpoint选择缺口和时间步覆盖缺口；随后自动保存V5纯CPU回归runId=`ai-assisted-conditional-v5-cpu-regression-2026-07-20T22-36-42-387Z`。回归13项检查全部通过，记录`gpuUsed=false`、`imageGenerated=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。这两条记录只证明诊断与代码修复闭合，不证明V5已经训练或取得视觉能力。

2026-07-21项目所有者明确授权V5 stage 0冒烟训练。正式控制器运行runId=`ai-assisted-conditional-denoiser-v5-smoke-2026-07-20T23-03-42-768Z`，真实读取21套条件配对和23通道，在CUDA上完成`256×192`前向/反向，状态=`conditional_denoiser_program_smoke_test_passed`，checkpoint SHA-256=`f6f9214470452e93ec899cee405b37f3a2108bb3bc9abc85dd7c6fc679c54b67`。程序自动写入中英文启动/完成事件、UTC与Asia/Shanghai时间、四个split指标、条件证据、算法证据、checkpoint和退出状态；该run没有生成RGB，固定`denoiserTrained=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。冒烟只证明程序可运行，不是V5正式渐进训练或视觉能力通过。

V5冒烟完成后发现运行目录中的5个不可变产物起初未进入SQLite artifact索引。程序没有重跑训练、没有使用GPU、没有改写checkpoint，而是通过修复runId=`storage-catalog-repair-ai-assisted-conditional-denoiser-v5-smoke-2026-07-20T23-03-42-768Z-2026-07-20T23-13-15-231Z`原地计算SHA-256并补录`algorithm-evidence.json`、checkpoint、`condition-evidence.json`、`manifest.json`和`progress.json`。训练runner同时修复为：每次成功、阻断或失败都自动索引现存运行产物；任何单独文件写入也同步登记逻辑路径、D盘物理路径、runId、字节数、修改时间和SHA-256。该缺口和修复均保留双语程序事件及证据报告，不得删除或把补录解释成重新训练。

2026-07-21项目所有者单独授权V5 stage 0正式渐进训练。正式控制器执行runId=`ai-assisted-conditional-denoiser-v5-stage-0-2026-07-20T23-58-58-343Z`，真实读取21套条件配对和23通道，在CUDA上完成`256×192`阶段40轮，最佳轮次31、最佳验证指标`1.7963923315207164`、持续85.306秒；checkpoint SHA-256=`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`，algorithm-evidence SHA-256=`13d2446734f8dc6c76969e1b3a22f5a5a4ec61e9f5f3b928506ccf273a2bc803`，condition-evidence SHA-256=`2657e094de927132468024e0b1e08203d1824feb8060cb362c5f3736e798e59a`。程序自动保存中英文启动/完成事件、UTC=`2026-07-21T00:00:38.881513Z`与Asia/Shanghai=`2026-07-21T08:00:38.881513+08:00`时间、40轮指标、manifest、progress、条件证据、算法证据和checkpoint；D盘SQLite已验证6个artifact与2个双语事件，物理文件字节数和SHA-256一致。本轮没有生成RGB，固定`denoiserTrained=true`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。下一步只能等待项目所有者单独授权V5 stage 1，不得把stage 0完成解释成视觉通过或正式地图成功。

2026-07-20项目所有者授权的V4 stage 0冒烟训练已经由正式控制器执行。runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`，状态=`conditional_denoiser_program_smoke_test_passed`，checkpoint SHA-256=`f7e00f80035d8986546ed4004b68647852a83df8d43c99b0ef40e28787910c63`。程序已自动保存21套条件配对、23通道、velocity、clean latent、latent gradient、离散条件重建、连续条件重建、复合指标、6个算法源文件hash、进程证据、退出码及UTC/北京时间。该记录固定`formalInferenceEligible=false`，只证明程序可运行；不得作为正式渐进训练完成、推理成功、候选通过或Runtime资格。

2026-07-20项目所有者随后授权V4 stage 0正式渐进训练。第一次runId=`ai-assisted-conditional-denoiser-v4-stage-0-2026-07-20T13-22-57-511Z`完成40轮后在最终manifest阶段因D盘物理路径无法转换为F盘逻辑路径失败；训练程序自动保留checkpoint、40轮进度、失败码、失败记录和算法证据。仅修复目录联接路径兼容后，正式控制器重试runId=`ai-assisted-conditional-denoiser-v4-stage-0-2026-07-20T13-49-02-362Z`成功，最佳轮次35，checkpoint SHA-256=`5ec9c8bea87349497007db437f0716e764dfe6617660a3372ad36f7e3238b16b`，algorithm-evidence SHA-256=`94f557e407a63c4fb15f84e571df6e39404b681463497eb14238b7b115c13e19`。成功与失败两次运行均由程序自动保存；stage 0 checkpoint固定`formalInferenceEligible=false`，其后已按项目所有者单独授权进入并完成stage 1。

2026-07-21项目所有者单独授权V4 stage 1正式渐进训练。正式控制器执行runId=`ai-assisted-conditional-denoiser-v4-stage-1-2026-07-20T16-23-39-466Z`，完成`512×384`阶段40轮，最佳轮次38；父checkpoint SHA-256=`5ec9c8bea87349497007db437f0716e764dfe6617660a3372ad36f7e3238b16b`与stage 0实际文件严格一致，新checkpoint SHA-256=`e1983d8ad8dbe7ffa6ae5c2daaf9330c8cbd0e544551c3e54a6b2437ab54d3ac`，algorithm-evidence SHA-256=`5cec7a29c2577beb1816b620c35ee88531eef7a3e6210e9c51d7146bc53b34ee`。程序自动保存manifest、40轮逐项指标、checkpoint、算法证据、父谱系、程序事件和双时区时间戳；运行目录没有RGB输出。stage 1 checkpoint固定`formalInferenceEligible=false`，下一步只能等待项目所有者单独授权stage 2。

2026-07-21项目所有者单独授权V4 stage 2正式渐进训练。正式控制器执行runId=`ai-assisted-conditional-denoiser-v4-stage-2-2026-07-20T19-28-49-245Z`，完成原生`1024×768`阶段40轮，最佳轮次38，持续126.343秒；父checkpoint SHA-256=`e1983d8ad8dbe7ffa6ae5c2daaf9330c8cbd0e544551c3e54a6b2437ab54d3ac`与stage 1实际文件严格一致，新checkpoint SHA-256=`a3a5bdb608091bbdec5e65160758b8f35ca752adeb647487a013ba6df4c11a04`。随后获授权的`complete-map-v2-005`单张验证由程序自动保存为runId=`ai-assisted-conditional-inference-validation-v4-2026-07-20T20-31-54-134Z`，图片SHA-256=`418fbe777eb40c2b685b8cf10e38717c1998a8d92630717586c7542e274bea0e`；VJ-2和Professional Aesthetic合计记录4项失败。验证图固定不能进入候选、Runtime或`/world`，下一步等待项目所有者授权失败修复。

### 7.1 AI 辅助条件 RGB 自动保存链

AI辅助条件去噪checkpoint的隔离验证固定由 `run:ai-assisted-conditional-inference-validation` 启动，并由 `review:ai-assisted-conditional-inference-validation` 自动执行VJ-0、VJ-1、VJ-2、版本化风格指纹和构图新颖性审核。机器拒绝必须保存真实图片、失败码、受影响区域、下一训练目标、审核hash和失败学习；机器通过也只能停止在等待项目所有者审核状态。该验证链不得写入原图库记录，不得声明正式候选资格，不得绑定Runtime或进入`/world`。

2026-07-19 的V3 held-out验证 `ai-assisted-conditional-inference-validation-2026-07-19T14-37-10-137Z` 已由程序自动保存，图片hash为`c861188b4f92f7f003f36bba18dd4de78305ef9761fe787e694ee33243834b2f`。旧审核只记录道路覆盖错配并错误放行VJ-1与Professional Aesthetic；该漏判事实必须作为judge-gap保留。Professional Aesthetic v2固定从owner已批准的基础完整地图身份计算多尺度纹理上限、安静区域和层级包络，保存校准记录ID、阈值、指标、失败码、受影响区域和下一训练目标。它不得读取历史RGB作为生成参考，不得加载外部审美权重，也不得替代owner终审。对历史V3失败图的回归必须命中`professional_multiscale_texture_noise_overload`和`professional_quiet_region_missing`；未来每张V4验证图仍必须重新执行全部审核并保存新记录，不能覆盖V3旧审核。

绑定训练专用世界事实和 23 通道条件的新 RGB 生成完成后，固定由程序执行以下链路：

```text
生成文件完成
-> intake-ai-assisted-cold-start-image.mjs 自动原样保存高分辨率4:3原图、生成1024×768训练派生图、计算双hash并写原图库事件
-> run-ai-assisted-cold-start-review-pipeline.mjs 自动执行机器审核
-> training-process-ledger 自动写中英文过程事件
-> 机器失败自动保存审核历史并刷新失败学习
-> 机器通过后停止为 completed_waiting_owner_review
-> 项目所有者明确批准或拒绝
-> record-ai-assisted-cold-start-owner-review.mjs 自动保存不可变人工审核历史
-> 拒绝时自动写失败码、受影响区域、下一训练目标和失败学习记录
```

`finalize:ai-assisted-conditional-rgb` 只允许作为上述自动链的生成完成入口，不得再成为脱离机器审核、统一总账和失败回写的孤立存储支线。`run:ai-assisted-cold-start-review-pipeline` 可用于恢复已经完成接收但尚未审核的历史候选。`check:ai-assisted-conditional-rgb-automation` 必须验证原图、训练派生图、双hash、派生政策、无裁切/无放大证据、UTC 与北京时间、原图库事件、机器审核、统一总账、人工拒绝及失败学习证据之间的身份一致性。生成器在图片产生前失败时，程序必须通过 `record:ai-assisted-conditional-rgb-generation-failure` 保存不可变尝试记录并更新当前请求状态；秘密不得落盘。

项目所有者审核不能由程序推断。程序只负责在收到明确 owner 命令后保存结论；拒绝记录固定禁止正样本训练和 `/world` 展示。2026-07-15 首张条件后置 RGB 被旧机器契约放行、但因统一视角、世界尺度、对象比例和像素纹理密度偏离而被项目所有者拒绝；该事实已经由程序写入原图库审核历史、统一总账和失败学习，证明专业风格一致性仍是机器审核缺口。

同一条件的版本号只表示不可变历史，不表示可以无限重试。生成请求必须显式指定条件来源；存在待人工审核或已通过图片时，程序必须在调用任何图像生成或训练算力前阻断。拒绝或生成失败后的同条件重试必须由项目所有者明确授权并保存重试原因。条件002的V4已完成机器审核和项目所有者审核并固定为 `owner_approved`，因此程序必须永久阻断V5；条件004 V1因重复历史拒绝构图已由人工和机器共同拒绝，固定不得自动重试；当前唯一活动请求是条件005 V2。

机器审核必须执行构图新颖性检查：先校验精确hash和近似重复，再比较低频完整构图、水体布局和道路布局；命中带 `composition_duplicate` 的历史 owner 拒绝模式时，写入 `historical_rejected_composition_duplicate`、历史记录ID、比较指标、受影响区域和下一训练目标。生成请求不得向图像生成器提供历史完整地图RGB；唯一图像参考必须是当前23通道派生的条件引导图。004 V1 已作为该门禁的固定回归样本。

## 8. 本地视觉语义初审

本地 CLIP 初审固定为机器辅助门禁，不是最终审美裁判。程序必须保存模型来源、revision、许可证、模型清单 hash、全部正负标签、每项概率、阈值、失败项和图片 hash。CLIP 通过不得单独触发正样本登记、RuntimeFrame 晋级或 `/world` 展示。

当前 CLIP 检查完整地图身份、自然对象语义、平坦道路语义、可游玩地图可读性和渲染一致性。实测证明它可能放过仍显粗糙的地图，因此必须与 VJ-1、VJ-2、空间越界检查和项目所有者终审并行。

水体越界检查只统计 `terrain_water` Mask 之外的水体视觉。`terrain_grass` 是全画布基础层，不能把合法水域区域重复计入草地泄漏；修正前的历史报告保留为审计证据，不覆盖旧记录。

`npm run run:current-world-foundation-candidate-batch` 由程序自动执行多 seed 生成、机器审核、机器负样本登记和严格数据审计。批次达到尝试上限后必须保持失败状态；只有机器全部通过时才能停止在 `machine_passed_waiting_owner_review`。

## 9. V5 Stage 1自动保存证据

2026-07-21项目所有者单独授权V5 stage 1正式渐进训练。正式控制器执行runId=`ai-assisted-conditional-denoiser-v5-stage-1-2026-07-21T00-47-30-506Z`，严格继承stage 0实际checkpoint SHA-256=`fc5ba951cdee6ed00a997dbd6e650a16db2d6c69497175a14636367534e0a079`，完成`512×384`阶段40轮。新checkpoint SHA-256=`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`，algorithm-evidence SHA-256=`a7b1245db41c428cd3e11b1bc2e795279aefd5d0cede59f270cdc96f9436bc7a`，condition-evidence SHA-256=`ff18b593c976c4e4afa3622f9862b11bf5d3912776caff782fd1c6a19f8662c8`。

程序自动保存中英文启动/完成事件、UTC与Asia/Shanghai双时区时间、40轮指标、manifest、progress、条件证据、算法证据、父checkpoint谱系和新checkpoint。D盘SQLite已验证本轮6个artifact与2个双语事件，物理文件字节数和SHA-256一致。该段是stage 1历史证据；共享`latest.json`现已按设计指向stage 2，stage 1历史核验只验证运行目录中的5个不可变产物及2个双语事件。本轮没有生成RGB，固定`denoiserTrained=true`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。

## 10. V5 Stage 2自动保存证据

2026-07-21项目所有者单独授权V5 stage 2原生`1024×768`正式渐进训练。正式控制器执行runId=`ai-assisted-conditional-denoiser-v5-stage-2-2026-07-21T07-41-08-443Z`，严格继承stage 1实际checkpoint SHA-256=`44e43a831cee6d52f40b0e7ef95212c9bc83c9f9e508d39ca3b6db2a91e2c41d`，完成40轮。新checkpoint SHA-256=`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`，algorithm-evidence SHA-256=`064e9606c42637e7247f5302a31bdd3c3029a5e5b6bfb817436e813b16d73883`，condition-evidence SHA-256=`6745e09917bd045d2e8a335192ee4dccb5739ca2cd232f91b7d761cf3183cfe0`。

程序自动保存中英文启动/完成事件、UTC与Asia/Shanghai双时区时间、40轮指标、manifest、progress、条件证据、算法证据、父checkpoint谱系和新checkpoint。D盘SQLite已验证本轮6个artifact与2个双语事件，物理文件字节数和SHA-256一致。Stage 0与stage 1各自只验证运行目录中的5个不可变产物及2个双语事件，共享`latest.json`只归属当前stage 2。本轮没有生成RGB，固定`denoiserTrained=true`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。该等待验证的历史门禁已完成，当前状态以第11节为准。

## 11. V5单张Challenge验证自动保存证据

2026-07-21项目所有者明确授权唯一`challenge`样本`complete-map-v2-014`的V5 held-out单图验证。正式程序生成runId=`ai-assisted-conditional-inference-validation-v5-2026-07-21T08-45-43-210Z`，绑定Stage 2 checkpoint SHA-256=`b8363a1625854ceb70b6c4ad48cf379dbeefa986743b469b377af09e7927580b`，生成原生`1024×768`图片SHA-256=`3e4af6352c2ed4a48a3610de0f59c5efe161a858b4cd92f0553fade0aa506011`。

程序按顺序执行VJ-0、VJ-1、VJ-2与Professional Aesthetic。VJ-0、VJ-1通过；VJ-2记录`condition_terrain_path_ground_coverage_mismatch`，Professional Aesthetic记录`professional_multiscale_texture_noise_overload`，最终状态`machine_rejected`。程序自动保存图片、model-report、manifest、machine-review和3个过程事件；D盘SQLite核验8个artifact与3个具备中英文标题的程序事件，物理文件字节数和SHA-256一致。自动视觉审核学习runId=`auto-visual-judge-learning-2026-07-21T09-22-05-435Z`已将本轮`machine-review.json`作为最新完整地图机器审核证据摄取，失败模式总数更新为56。

该图及记录固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，不得进入原图库、候选、Runtime或`/world`。当前等待项目所有者明确授权失败诊断与修复，不得自动重训或重复推理。

## 12. V5失败诊断与V6 CPU回归自动保存证据

项目所有者授权V5失败诊断与修复后，程序写入诊断runId=`ai-assisted-conditional-v5-diagnosis-2026-07-21T10-26-42-232Z`。记录保存V5验证图片、checkpoint、机器审核hash、失败码、量化道路覆盖、三项根因、V6修复边界、算法源hash、中英文事件和双时区时间戳。

项目所有者授权后，程序完成V6 Stage 1 runId=`ai-assisted-conditional-denoiser-v6-stage-1-2026-07-21T12-46-28-623Z`，自动保存checkpoint、manifest、progress、条件证据和算法证据，并把5个不可变产物、1个latest指针及2条中英文程序事件登记至`D:\AI-PET-WORLD-DATA\catalog\ai-pet-world-catalog.sqlite`。Stage 1父checkpoint、当前checkpoint、条件证据和算法证据哈希均复核一致，目录中RGB数量为0，challenge保持`metricsReadDuringTraining=false`。Stage 1记录明确`formalInferenceEligible=false`，不得解释为正式推理或视觉通过。

## 13. V6 Stage 2自动保存证据

2026-07-22项目所有者单独授权V6 stage 2原生`1024×768`正式渐进训练。正式控制器执行runId=`ai-assisted-conditional-denoiser-v6-stage-2-2026-07-21T19-11-57-819Z`，严格继承stage 1实际checkpoint SHA-256=`23593901bd7c9dff385a1c943867b0da1f990b6e8f1fa530359cf5da4062e921`，完成40轮，最佳轮次36、最佳验证指标`2.792788481960694`、持续`323.927`秒。新checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，algorithm-evidence SHA-256=`a56f157960759dc092060a8d30c326eed7e0189ae82d8bb2d2e49b007e5f6e3a`，condition-evidence SHA-256=`f1237d6fb2ba8ed7ab529425bb252c8bac39bb72b8f5299c13e147aeaab5bdac`。

程序自动保存中英文启动/完成事件、UTC与Asia/Shanghai双时区时间、40轮指标、manifest、progress、条件证据、算法证据、父checkpoint谱系和新checkpoint。D盘SQLite已验证本轮5个不可变artifact、1个latest指针与2个双语事件，物理文件字节数和SHA-256一致；Stage 1历史核验只保留5个不可变artifact及2个双语事件，共享latest指针由Stage 2接管。本轮没有生成RGB，challenge保持`metricsReadDuringTraining=false`，固定`denoiserTrained=true`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。随后获授权的V6单图验证已执行并机器拒绝，当前状态以第14节为准；不得重复Stage 2训练。

## 14. V6单张Challenge验证自动保存证据

2026-07-22项目所有者以“继续”明确授权唯一`challenge`样本`complete-map-v2-014`的V6 held-out单图验证。正式程序执行runId=`ai-assisted-conditional-inference-validation-v6-2026-07-21T20-39-03-363Z`，绑定V6 Stage 2 checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，生成原生`1024×768`图片SHA-256=`6ce37acc6278d5d7bbae6210e8273c634358fc1301936be9d394725fe2cf039e`。

程序依次执行VJ-0、VJ-1、VJ-2与Professional Aesthetic。VJ-0、VJ-1通过；VJ-2记录`condition_terrain_path_ground_coverage_mismatch`；Professional Aesthetic当前通过；最终状态为`machine_rejected`。程序自动保存`validation.png`、23通道条件引用、checkpoint与seed、`model-report.json`、`manifest.json`、`machine-review.json`、3条直接关联本推理run的中英文过程事件及latest指针。D盘SQLite核验8个artifact的物理字节数与SHA-256；审核流程另有机器拒绝双语事件。自动失败学习runId=`auto-visual-judge-learning-2026-07-21T20-39-36-899Z`已把本轮machine review作为最新完整地图失败证据摄取。

本轮图像与记录固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，不得写入原图库、候选、Runtime或`/world`。该段的等待诊断门禁已由第15节取代；V6图像、审核和失败学习继续保持不可变。

## 15. V6失败诊断与V7 CPU回归自动保存证据

项目所有者授权V6失败诊断与修复后，程序写入诊断runId=`ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z`，证据目录为`.runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v6/ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z/`。诊断记录绑定V6验证图片SHA-256=`6ce37acc6278d5d7bbae6210e8273c634358fc1301936be9d394725fe2cf039e`和checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，保存数据split、rollout输入、机器审核漏口、根因、V7修复边界、源文件hash及双时区时间戳。诊断阶段没有GPU训练、推理或新RGB。

V7最新纯CPU回归runId=`ai-assisted-conditional-v7-cpu-regression-2026-07-22T00-20-01-226Z`，证据目录为`.runtime/ai-painter/ai-assisted-conditional-v7-repair-checks/ai-assisted-conditional-v7-cpu-regression-2026-07-22T00-20-01-226Z/`。程序自动保存配置、模型、训练器、审核器和检查器SHA-256，验证2个validation样本、每样本2个seed、4条完整轨迹、前向/反向、23通道、challenge隔离和容量批准合同。该run固定`gpuTrainingStarted=false`、`imageGenerationStarted=false`、`trainingStarted=false`。

Professional Aesthetic只新增`professional_single_axis_texture_envelope_exceeded_diagnostic`诊断警告，用于记录单轴纹理异常；原拒绝门槛`minimumMultiscaleViolationCount=4`、原`issues`和`passed`语义均未改变，因此V6历史machine review仍保持原结果。项目所有者已批准128张完整地图容量及`96/16/8/8` split；V7配置固定`trainingAuthorizationStatus=blocked_pending_approved_128_dataset_implementation`。覆盖矩阵、缺口清单、每条数据接收、去重、审核、失败与数据包构建均必须由程序自动保存双时区时间、hash和证据路径。128张数据包完成后仍需另行授权训练；程序不得自动训练、推理、生成图片或修改审核门槛。

最新程序容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`已自动保存`capacity-plan.json`、`coverage-matrix.json`和`gap-list.json`。审计结果为旧21条基线与3条V7贡献合计24/24条合格、失败0条、缺口104条；该run固定`imagesGenerated=0`、`gpuTrainingStarted=false`、`trainingStarted=false`。后续每条新增数据必须沿正式程序入口保存身份、双时区时间、hash、审核和split证据，页面只读取这些程序证据，不得由聊天记录或页面访问代写业务状态。

## 16. V7季节快照与首个任务证据自动保存

季节过渡快照构建程序已自动写入`provisional-visual-snapshot-wet-to-dry-transition-v1.json`和`provisional-visual-snapshot-dry-to-wet-transition-v1.json`，并更新覆盖蓝图中的四季状态索引。检查器验证两份快照、NASA原始响应hash及四季入口；构建过程固定`imageGenerationStarted=false`、`gpuTrainingStarted=false`。

首个容量槽位任务runId=`ai-assisted-v7-data-task-v7-capacity-slot-001-2026-07-22T02-07-41-845Z`由程序自动保存`world-fact-blueprint.json`、`visual-fact-manifest.json`、`director-output.json`、`task-package.json`、任务manifest、23通道条件包、完整地图范围审核、run manifest和latest指针。独立检查器复核关键文件hash、world profile、season、landscape、独立seed/布局、23个唯一通道、完整范围通过和自动保存身份。程序同时把该run的33个证据文件登记到D盘热层SQLite索引，并自动写入1条中英文程序事件；页面和GET API只读取这些程序证据，不替代程序写入。

## 17. V7首张RGB自动接收与审核记录

更新时间：2026-07-22 11:41:47 +08:00

正式请求`conditional-rgb-001-2026-07-22T03-03-07-793Z`只执行一次图像生成。程序自动保存`1448×1086`源图、`1024×768` nearest-neighbor训练派生图、提示词证据、条件包、任务包、条件引导图、图片hash、接收记录、机器审核、审核流水线报告和项目所有者审核状态。派生图SHA-256=`6f89c3830183a48dc4d7074a8d88b8787e3ff19753dc42bb6bd337548878e5c2`，机器状态=`machine_contract_passed_waiting_owner_visual_review`，项目所有者状态已由程序更新为`owner_approved`，并保存不可变审核历史、双语事件、请求状态同步和自主生成训练原图序号`002`。

第一次自动接收因旧授权校验只接受`conversation-owner-authorization-2026-07-13`而阻断；失败证据固定保存于该请求的`automation-failures/intake-owner-authorization-contract-mismatch.json`，并写入双语程序事件。接收器现接受文档规定的V7单图授权身份，随后复用同一源图完成自动接收，没有生成第二张图。机器通过不得替代人工视觉审核；人工通过后`formalConditionalTrainingEligible=true`，但`runtimeFrameEligible=false`、`canEnterWorld=false`继续保持。

人工通过后的首次数据包自动重建曾暴露旧数据包构建器只识别历史21套条件身份；失败证据固定保存于`.runtime/ai-painter/ai-assisted-dataset-package-failures/ai-assisted-dataset-package-build-failure-2026-07-22T04-55-29-837Z/failure-record.json`，并以事件ID=`338b3f3a-c623-4123-9127-9e6ed5991e98`写入中英文程序日志。该失败保留为历史，后续正式V7容量贡献入口已闭合，不得删除或改写原失败记录。

项目所有者授权最终配对与容量贡献实现后，程序先后写入slot-001、slot-002与slot-003贡献并更新原图记录和索引中的贡献指针；slot-003贡献SHA-256=`154474ba36bf49aa8d11c55657e90e91f64cb0f21dae33ea90a5e899ab020ec4`。数据包重建与独立检查确认总条件绑定完整地图24条、V7贡献3条、未配对0条。页面只能展示这些程序证据，不能自行新增贡献或改变缺口。

## 18. V7容量槽位002任务自动保存证据

更新时间：2026-07-22 18:12:27 +08:00

项目所有者授权继续准备下一任务后，正式程序写入runId=`ai-assisted-v7-data-task-v7-capacity-slot-002-2026-07-22T10-03-58-601Z`。run根目录保存总`manifest.json`，其`v7-capacity-slot-002/`子目录自动保存`world-fact-blueprint.json`、`visual-fact-manifest.json`、`director-output.json`、`task-package.json`、完整地图范围审核和槽位manifest；23通道条件包及23张通道图保存在该子目录的`compiled-conditions/`中。独立检查器核验32项D盘SQLite artifact和1条中英文程序事件。任务准备阶段的`pairedRgbCount=0`与等待授权状态作为历史证据保留；后续RGB、审核和容量登记已沿正式入口闭合。页面和GET API只能读取并展示这些程序证据，不得以页面访问创建RGB、审核或容量贡献。

## 19. V7容量槽位002 RGB自动接收与审核证据

项目所有者于2026-07-22明确审核通过slot-002后，程序自动写入`reviews/owner-review.json`、更新原图记录和条件生成请求，并登记容量贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-002-2026-07-22T12-01-16-339Z`，贡献SHA-256=`7f3dcf75cfc5a1804b7d3905afa0f463a4253bff3701f888881673ae8f2725f2`。数据包重建和独立检查均通过；slot-002闭环时容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T12-05-01-665Z`确认23/23合格、失败0、缺口105。该段是历史证据，当前状态以第22节为准。

项目所有者授权单图后，正式请求`conditional-rgb-002-2026-07-22T10-50-32-811Z`只执行一次生成。程序自动接收`1448x1086`源图，生成无裁切、无放大的nearest-neighbor `1024x768`训练/机器审核派生图，写入原图记录、请求结果、图片hash、双时区时间、机器审核、style fingerprint、审核流水线报告和程序日志。源图与派生图SHA-256分别为`96ee07168ba20d700299901a5abe907bb830be8764f5f656f372507ca5582b79`和`d326d6073e91b1a8ba2bcccca5e153281326980b725ef987277b1fdbc75f92e3`。

自动化检查结果为`ai_assisted_conditional_rgb_automation_check_passed`。请求状态`generated_intaked_machine_passed_waiting_owner_review`、机器状态`machine_contract_passed_waiting_owner_visual_review`和owner状态`pending_review`均是slot-002在人工审核前的历史证据；后续owner通过及容量登记见本节前文。页面只能读取并展示程序证据，不得改写历史审核，不得重复生成本槽位，也不得启动GPU训练。slot-003当前状态见第20节。

## 20. V7容量槽位003任务准备、失败与自动保存证据

更新时间：2026-07-22 21:33:24 +08:00

项目所有者授权准备slot-003后，程序自动保存两次失败。runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T12-38-25-200Z`记录旱季配方缺失；runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-11-19-044Z`记录`complete_map_route_overlaps_collision`。各run均写入`failure.json`、UTC和Asia/Shanghai时间、错误文本、失败程序事件及SQLite artifact，并明确`imageGenerationStarted=false`、`gpuTrainingStarted=false`。失败证据不得删除、覆盖或伪装为成功。

修复后成功runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-27-59-480Z`。程序自动保存世界事实、世界导演、任务包、23通道条件包、通道图、完整地图范围审核、manifest和latest指针；独立检查核验32项SQLite artifact、全部文件hash及1条中英文成功事件。`task_ready_rgb_missing_waiting_owner_single_image_authorization`是任务准备阶段的历史状态；后续生成、审核和容量登记见第22节。页面和GET API仍只能读取展示，不得代写RGB、机器审核、owner审核或容量贡献。

## 21. 2026-07-23 原图项目所有者审核命令入口

项目所有者已明确授权在完整地图原图类型页增加单条“通过 / 拒绝”按钮。按钮仅在机器合同通过且owner状态为`pending_review`时显示；GET页面仍无业务副作用。POST只负责把项目所有者明确决定交给`record-ai-assisted-cold-start-owner-review.mjs`，不得由页面组件直接写文件或推断结论。

通过V7容量槽位后，程序必须自动登记容量贡献、独立检查贡献、重建并检查AI辅助数据包、刷新128张容量计划；拒绝必须保存具体原因、下一轮修复目标、图片引用、失败码、双时区时间、hash、不可变审核历史、双语事件和失败学习。审核操作不得自动生成下一张RGB、准备下一槽位、启动GPU训练、晋级Runtime或进入`/world`。本段最后的slot-003等待状态属于入口实现时的历史门禁；当前闭环状态以第22节为准。

## 22. 2026-07-23 V7容量槽位003审核闭环与自动链修复

项目所有者已通过控制台审核slot-003，owner记录、图片hash、双时区时间和原图记录由程序自动保存。审核服务最初只读取`taskPackageId`判断V7容量身份，未识别正式`recordId`与`taskPackagePath`中的`v7-capacity-slot-003`，因此没有触发后续自动链。程序已修正为严格读取记录ID、显式容量槽位和任务路径，并继续只接受`v7-capacity-slot-NNN`格式；该修复不改变审核门槛、数据资格或页面布局。

正式恢复链登记贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-003-2026-07-22T21-02-11-194Z`，贡献检查确认3条V7贡献且失败0条；数据包`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-22T21-03-31-782Z`确认条件绑定完整地图24条、V7贡献3条、未配对0条、阻断0条；容量计划`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`确认24/24合格、正式缺口104条。本轮没有生成新图或启动GPU训练。该句原有“下一槽位仍需明确命令”属于历史门禁，已被第23节连续批次授权覆盖。

## 23. 2026-07-23 V7剩余104槽连续数据批次

项目所有者授权ID固定为`owner-authorized-v7-remaining-104-continuous-batch-20260723`，范围仅为`v7-capacity-slot-004...107`。程序必须使用`.runtime/ai-painter/ai-assisted-v7-continuous-data-batches/`保存批次`state.json`、逐次事件和`latest.json`，同时登记D盘SQLite；任何时刻最多一个`ready_for_openai_assisted_generation`请求。

每槽顺序固定为：程序准备并检查世界事实、世界导演、完整地图任务与23通道；Codex内置生成通道只返回本槽RGB；程序自动接收、保存来源与hash并执行机器审核。机器通过进入`pending_review`队列，机器失败保存图片、失败码、双时区时间、审核证据和失败学习后继续下一槽。同槽不得自动重试或递增版本。批次不得自动写入owner通过、不得在owner逐张审核前登记容量贡献、不得启动V7 GPU训练、不得建立RuntimeFrame或进入`/world`。

## 24. 2026-07-24 自主重建001失败保留、恢复接收与待审核证据

项目所有者单图授权ID固定为`owner-authorized-autonomous-world-rebuild-001-single-rgb-20260724`，请求ID=`conditional-rgb-001-2026-07-24T04-29-42-877Z`。首次接收因授权许可白名单缺少该新ID而失败，程序必须并已经把失败保存到该请求目录中的不可变JSON，至少包括失败阶段、UTC和Asia/Shanghai时间、输入图片绝对路径与SHA-256、错误文本、`gpuTrainingStarted=false`和`automaticNextGeneration=false`，同时写入中英文SQLite事件。失败不得因后续恢复成功而删除。

授权识别修复后，程序复用同一张SHA-256=`db0c793ea93429d44ac913267be6a56409e620d309e922516a4687d52590eaba`源图继续接收，没有第二次调用图像生成。程序自动生成并保存SHA-256=`fbe83fa149ded7d09da77b77bcf956caa86cc49c4142d1f0747fbfc49b032c0a`的`1024×768`派生图、原图记录、机器审核、来源与许可、双时区时间和hash。SQLite精确查询确认本请求具有失败、自动审核开始、机器审核通过、等待owner审核4条相关程序事件。

机器审核通过后，请求首先进入`generated_intaked_machine_passed_waiting_owner_review`且owner为`pending_review`。控制台类型页已经验证能读取并展示该记录、图片及“通过 / 拒绝”按钮；本次页面修改只补充自主重建记录类型识别，没有调整锁定布局。页面GET不得写业务记录，按钮不得推断owner结论。

项目所有者于`2026-07-24T06:01:21.719Z / 2026-07-24T14:01:21+08:00`以命令`owner-approved-autonomous-world-rebuild-001-20260724`明确通过。程序自动保存owner当前记录与不可变历史，审核记录SHA-256=`064472a424b42524ec6c5d41466409ceb8baaabe0b104d49baea4eca0b0001c6`，并把请求状态更新为`generated_intaked_machine_passed_owner_approved`、训练资格更新为`ai_assisted_cold_start_eligible`。自动化检查和原图库检查均通过，控制台已验证显示`owner_approved`。

审核闭环不得自动登记容量、生成002、启动GPU训练、创建RuntimeFrame或进入`/world`。任何后续动作必须继续使用项目所有者单独授权。

## 25. 2026-07-24 自主重建002自动保存与待审核证据

更新时间：2026-07-24 17:03:18 +08:00

项目所有者单图授权ID=`owner-authorized-autonomous-world-rebuild-002-single-rgb-20260724`，请求ID=`conditional-rgb-002-2026-07-24T08-09-32-109Z`。授权解析器必须同时校验授权中的`002`、重建ID中的`002`和条件标签中的`002`，不得把002授权用于001、003或任何批次。

程序自动保存`1448×1086`源图SHA-256=`415038107844f51c1ffc78534fca0669cf434199051b9dcd5e05fbbd1517de5b`、`1024×768`派生图SHA-256=`46ee59c59b5f99be083b9bf53de33fa3c5d3dccc87a060414bb709a362658dfe`、请求、原图记录、世界事实引用、世界导演引用、23通道引用、提示、来源/许可、UTC与Asia/Shanghai时间、hash、机器审核和SQLite证据。原图记录SHA-256=`2e78bc84309ea8c091bf6073984d48d812a1f033b1c3f48f666d2aab967c077d`，机器审核记录SHA-256=`b3047c5bb1467742c3cc7f87d55ff6f6aadb16ea0d26f5d637cf9cae2dd08eeb`。

机器审核通过后，请求进入`generated_intaked_machine_passed_waiting_owner_review`，机器状态=`machine_contract_passed_waiting_owner_visual_review`，owner状态=`pending_review`，训练资格仍为`false`。控制台类型页已经验证能读取并展示002记录、图片和待审核状态；GET页面不写业务记录。

002等待人工审核期间，程序和智能体均不得自动生成003、自动重试、批量出图、推断owner结论、登记容量、启动GPU训练、创建RuntimeFrame或进入`/world`。项目所有者的通过或拒绝必须由页面审核命令触发正式程序写入。

## 26. 2026-07-25 道路误判诊断、同图复审与审核历史

更新时间：2026-07-25 09:02:19 +08:00

记录`ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1`首次机器审核以`condition_terrain_path_ground_centroid_drift`拒绝后，程序必须保留原机器审核、失败学习、图像引用、时间、hash和SQLite事件。后续诊断或复审不得删除、覆盖或回写旧记录。

项目所有者授权的诊断只允许检查审核算法。诊断runId=`ai-assisted-cold-start-path-false-positive-diagnosis-2026-07-25T00-34-27-315Z`确认旱季裸地暖色碎片被误计为道路。道路审核改为先形成8连通视觉分量，再只保留与正式`terrain_path_ground`走廊相交或被其支持的分量；不得改变固定阈值、世界事实、世界导演、23通道、RGB或风格标准。程序必须同时保存旧指标、新指标、排除像素数、算法版本、`thresholdsChanged`和`newRgbCreated`。

同一SHA-256=`ac6778270a44d2379e1ea0c635041eb8685c0def7659ba8e7d3a6a73b1d29bb4`图像的机器复审runId=`ai-assisted-cold-start-review-ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1-2026-07-25T00-37-54-194Z`必须作为新的不可变审核记录保存，不得替换首次拒绝。项目所有者通过由正式程序以命令引用`owner-approved-earth-reference-naturalized-complete-map-b3be6a28ffb6-20260725`写入，owner reviewId=`ai-cold-start-owner-review-ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1-2026-07-25T00-41-06-524Z`。

通过后的自动动作仅限更新记录资格、写入不可变owner历史、SQLite事件和重建获准的数据包。不得自动建立V7容量贡献、启动GPU训练、生成新RGB、建立正式候选、绑定RuntimeFrame或进入`/world`。控制台必须能够查看同一记录的原始拒绝、诊断、同图机器通过和owner通过证据。

## 27. 2026-07-29 slot-146无水森林误判与同图复审

记录`ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v1`首次机器审核仅以`condition_terrain_water_unexpected_signal`拒绝；生成前121份条件构图、生成后142份RGB构图、风格指纹和道路条件均已通过。原拒绝、失败学习、图像SHA-256=`9d1381f69cd1beada1602c31bf7aadab7e91aceac70d158eacba165afc308f97`和机器历史必须保留。

项目所有者授权只修复水体误判并复审同图。正式方法`condition_presence_aware_water_signal_v3`在有水条件继续使用原宽淡水颜色信号，在无水条件使用强蓝主导加16×16局部高密度连续色面；`maximumAbsentSignalRatio`仍为`0.005`。回归runId=`ai-assisted-water-signal-classifier-regression-2026-07-29T11-16-51-707Z`比较113条记录，其中111条历史水体审核已通过样本回归失败0，64条有水、47条无水继续通过，历史002水体空间错位继续拒绝；图片、WorldFacts、23通道和阈值均未修改。

同图机器复审ID=`ai-cold-start-machine-review-ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v1-2026-07-29T11-23-30-735Z`通过，水信号从旧`0.0787`变为正式无水分支`0.0028`，问题数0。项目所有者以`owner-approved-v7-capacity-slot-146-complete-pass-20260729`明确完全通过；owner reviewId=`ai-cold-start-owner-review-ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v1-2026-07-29T11-26-23-796Z`。容量贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-146-2026-07-29T11-33-04-333Z`登记并独立检查通过，当前正式RGB容量1/64，缺口63，GPU=0。
