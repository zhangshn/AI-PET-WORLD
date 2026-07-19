# AI-PET-WORLD 智能体执行规则

更新时间：2026-07-20 04:31:34 +08:00

状态：active-governance / 所有项目窗口和智能体必须遵守

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 必读入口

开始任何世界地图任务前，必须依次读取：

1. `docs/DOCUMENT_AUTHORITY_INDEX.md`
2. `docs/BUSINESS_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`
5. 当前任务涉及的一个正式下级规格：
   - 视觉实现：`docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md`
   - 数据来源：`docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md`
   - 审核/自动化/存储：`docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md`

禁止默认批量读取 `docs/world-visual-data-dictionary/`。只读取其 `README.md`、当前导出 JSON 和当前任务明确涉及的字典条目。

## 当前范围

当前只处理第一版专业自然家园完整游戏地图及其数据、模型、审核、自动保存和控制台支撑。

项目所有者于 2026-07-18 锁定完整地图范围：当前任务禁止继续生成或接收只有单一河段、单一道路、单一池塘、单一林间空地、单一材质区域或放大局部生态单元的“全画布局部图”。文件尺寸达到 `1024×768` 不等于完整地图。每张新 RGB 在生成前必须由正式世界事实、世界导演和完整地图级 23 通道共同证明其覆盖完整自然家园区域，能够同时表达整体入口/出口关系、家园中心、连续道路组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；水体只在当前世界事实要求时出现，不得把东南亚档案错误解释成每张图都围绕水体。无法证明完整地图范围时必须在调用任何图像生成算力前阻断并询问项目所有者。

任何智能体或程序不得根据蓝图队列、历史计划、缺失编号、失败记录或“继续”状态自行批量出图。只有当前正式文档明确允许的任务与项目所有者对本轮具体生成的明确命令同时存在时，才允许生成一张新图；生成完成后必须自动保存并停止等待审核。发现文档、世界导演、23 通道或构图尺度可能导致局部图、重复图或相似图时，必须先停止、解释问题并等待命令，不得以自动重试或版本递增继续消耗算力。

冷启动基础完整地图原图不是只读展示图，也不是后续生成器直接临摹的图片参考。程序必须先从经审核基础完整地图集合中形成可追溯、版本化的完整地图视觉标准，至少覆盖镜头与世界尺度、整体构图层次、入口/中心/道路关系、空间与生态分区组织、水体分布变化、对象尺寸与密度、像素纹理、色彩、光照和游戏可读性。后续生成只允许消费该聚合标准、当前世界事实、世界导演和本轮23通道；不得把历史完整地图 RGB 直接传给生成器。统一游戏视觉语言不等于重复构图，河流、道路、区域组合和生态结构必须由本轮世界事实产生并通过新颖性审核。

第一版正式视觉已经由项目所有者锁定为 2D 高分辨率像素风完整地图：模型必须原生生成 `1024×768` 完整地图，不再使用 `256×192 -> 4× nearest-neighbor` 的低分辨率像素画契约。高分辨率像素风必须统一视角、尺度、像素纹理语言、轮廓、光照、对象接地和游戏可读性；不得把普通数字插画、tile 拼接、局部 sprite 放大或平滑缩放冒充正式完整地图。

分辨率解释固定为：正式本地模型 target、正式候选、项目所有者审核、Runtime 和 `/world` 只认本地模型原生生成的 `1024×768` 文件；`256×192` 或 `512×384` 只允许作为模型训练内部的渐进阶段，不能作为候选保存后放大取得正式资格。唯一例外是项目所有者于 2026-07-16 批准的 AI 辅助冷启动来源派生契约 `owner-approved-high-resolution-four-three-derivative-v1`：Codex 内置图像生成得到的不小于 `1024×768` 的精确 4:3 原始文件必须原样保存，程序只允许无裁切、无放大地以 nearest-neighbor 生成单独的 `1024×768` 训练/机器审核派生图；原始图和派生图都固定 `formalCandidate=false`、`runtimeFrameEligible=false`、`independentTrainingEligible=false`，不得进入正式候选、Runtime 或 `/world`。画法/生成算法负责把世界事实、23 通道条件和模型状态转换为新像素；风格契约负责统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性。两者必须同时满足，不能互相替代。

整个项目的两大核心业务已经锁定为：

1. AI 管家的性格数据、性格映射和角色自主。正式角色只能申请 AI 管家；紫微斗数和八字是人格数据来源；用户可选现实自我映射或平行世界反向紫微映射。
2. 以地球参数和自然规律为基准的类地球世界自主运行、自主生长与长期演化。

当前地图任务是第二核心业务的第一阶段，不代表整个项目只有地图生成业务。

第一版自然家园必须被视为未来类地球大世界的第一个连接区域，而不是孤立概念图。大世界连接机器契约固定为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。项目所有者已命令按真实地球实际情况定义第一版连接；正式蓝图为 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`，水流北入南出、道路南侧接入、西侧保持自然边界。项目所有者已于 2026-07-13 授权 Runtime 世界事实迁移并审核通过迁移结果；程序已生成 tick 3，自动保存迁移证据和 `.runtime/world-connectivity-owner-reviews/latest.json`。连接训练覆盖门槛已批准并由程序完成27条正样本、27条负样本，9个覆盖轴均达到3正+3负。智能体不得用图片反推或创造连接。

AI-PET-WORLD 的产品身份是像素风格自主世界游戏。本地小 AI 是游戏核心智能系统，不是单一画图程序；它长期负责世界理解、世界导演、状态推理、角色自主、失败学习和世界演化。AI Painter 只是本地小 AI 的视觉生产子系统之一，只负责把已存在的世界事实转成游戏画面，不得被描述成整个小 AI、整个游戏或世界事实生成器。

第一版 MVP 世界档案已由项目所有者锁定为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`：以东南亚大陆热带季风低地、河谷和丘陵为现实生态参照，包含热带雨林及季节性森林、河岸、草地、淡水湿地和低山环境；当前明确排除雪、冰川、高山苔原、荒漠、寒温带白桦/针叶林身份及未经批准的海岸红树林子档案。现实事实可以进入世界数据，但外部数据集、地图、文字和图片仍必须逐项保存来源、版本和许可；禁止把权威网站图片自动当作训练数据。

未经项目所有者明确命令，不得开始或恢复：

- 旧 5×5 Chunk、9张候选图或 P10-B3 路线。
- 管家角色实现、玩家交互、建筑、动物和后续生态扩展。
- 紫微斗数人格映射实现；它属于第一核心业务，但不参与当前地图任务的执行顺序。
- 单纯局部材料盲训。

## 文档边界

- `docs/game-world-generation/`：当前正式架构。
- `docs/world-visual-data-dictionary/`：当前视觉事实参考。
- `docs/ai-painter-progress/`：页面锁定规格和实施证据。
- `docs/ziwei/`：独立维护的人格数据子系统；长期服务 AI 管家人格映射，当前不参与世界地图任务。

旧计划、旧进度表和旧 `live-world` 文档已经删除。智能体不得重新建立平行计划或历史副本。

## 当前阻断

```text
owner_review_missing_identity
formal_gate_missing
data_gap_insufficient
ai_assisted_v4_progressive_training_missing
```

自有扩散采样器、Autoencoder训练程序、严格项目自有 IP 数据门禁、版本化地球气候参数快照、第一版真实地球参照连接蓝图、Runtime 连接事实迁移、项目所有者审核记录、22图版本化基础完整地图视觉标准和完整地图范围门禁已经实现。当前 tick 3 已保存区域身份、三个邻居、四个当前区域连接口、南侧道路连接、北入南出的水文图和审核身份。项目所有者已命令旧21套条件蓝图只作历史、不修补、不覆盖；程序已按 `complete-map-scope-world-facts-v2` 使用 `complete-map-v2-001...021` 全新标签重建21套世界事实、导演、任务包和23通道，21/21结构检查及21/21完整地图范围门通过。生成前世界事实蓝图快照继续不可变地保留 `pairedRgbCount=0`。当前21/21后置RGB均与正式v2任务包及23通道条件包严格同身份，未配对数为0。项目所有者随后批准21套作为第一轮AI辅助条件去噪训练门槛、批准Autoencoder v2达到继续条件，并批准连接覆盖最低27条正样本、27条负样本且9个覆盖轴各不少于3正+3负；程序已自动保存批准记录。程序现已构建并机器复核27正、27负连接记录，9轴全部达到3正+3负，AI辅助数据包状态为 `conditional_denoiser_training_ready` 且 `blockers=[]`。项目自有23通道条件去噪训练程序、隔离单图验证入口和验证专用机器审核均已实现。首张V2验证已拒绝并保留；V3算法修复与256×192、512×384、1024×768三级训练已经完成，随后获owner授权的V3 held-out单图验证也已生成、自动保存并被拒绝。该图暴露高频噪声、纹理层级坍缩、条件覆盖错配以及专业审美漏判；V3固定为失败验证历史，不得继续训练或作为V4父checkpoint。项目所有者已授权V4修复分类型条件缩放、复合训练目标、复合checkpoint选择和专业审美漏判；V4程序已通过静态检查、CPU前向/反向与V3失败图审核回归。项目所有者于2026-07-20明确授权并由正式控制器执行V4 stage 0冒烟训练，runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`已通过并自动保存，checkpoint SHA-256=`f7e00f80035d8986546ed4004b68647852a83df8d43c99b0ef40e28787910c63`；该checkpoint仅证明程序可运行，固定`formalInferenceEligible=false`，不是V4渐进训练或正式推理checkpoint。当前尚未执行V4正式渐进训练或新图推理。下一步固定为等待项目所有者明确授权V4 stage 0正式渐进训练；在该命令前不得启动GPU训练或调用图像生成算力。旧版本RGB和审核继续作为不可变历史保留，不得重绑到当前身份。生成请求只允许把当前条件引导图作为唯一图像参考，风格只能来自22张基础完整地图形成的版本化聚合标准，不得引用历史完整地图RGB。`/ai-painter-progress/original-images/complete-maps` 固定按自主生成训练原图、冷启动基础完整地图原图、条件配对历史原图、失败与阻断记录四类进入下级页面，不得重新混排。连接覆盖门槛不得由智能体自行改变。任何改变数据标准、模型路线、审核门槛、页面结构或自动保存边界的操作，必须先说明并获得项目所有者命令。

2026-07-19 首张隔离验证 `complete-map-v2-014` 已由程序生成、保存并被验证专用机器审核拒绝；该 V2 图及失败学习固定保留，不能进入原图库、Runtime 或 `/world`。数值诊断确认旧条件去噪器存在潜空间尺度不一致、epsilon 高时间步放大和浅层去噪器能力不足。项目所有者随后授权算法修复；程序已建立 `normalized-latent-v-prediction-multiscale-unet-v3`，复用已批准的 Autoencoder v2，新增按训练集计算的逐通道潜变量归一化、velocity 预测、多尺度 23 通道 U-Net、固定时间步验证和最佳 checkpoint 选择，并重新完成 `256×192 -> 512×384 -> 1024×768` 三阶段训练。V3 最终 checkpoint hash 为 `684ecc29c74408038539c8f3fd62b3272611a0bd0e5ddd4ef3931ae16668659b`，仍固定 `formalInferenceEligible=false`。同条件同 seed 的无 RGB 数值诊断把采样解码饱和比例从 V2 的 `12.493%` 降至 V3 的 `1.1945%`；实际held-out RGB验证runId=`ai-assisted-conditional-inference-validation-2026-07-19T14-37-10-137Z`仍失败，图片hash=`c861188b4f92f7f003f36bba18dd4de78305ef9761fe787e694ee33243834b2f`。程序已保存图像、条件、checkpoint、seed、审核和失败学习；旧机器审核仅检出道路覆盖错配并漏判高频噪声与层级坍缩。V4 Professional Aesthetic回归新增检出`professional_multiscale_texture_noise_overload`和`professional_quiet_region_missing`，但V4模型尚未训练。

V4模型合同固定为`typed-condition-composite-objective-multiscale-unet-v4`：离散条件nearest-neighbor、连续条件bilinear；训练保存velocity、clean latent、latent gradient、离散条件重建、连续条件重建及复合checkpoint质量分数；每个run自动保存配置、模型、训练器、数据读取器、扩散过程和runner的SHA-256及双时区时间戳。V4 stage 0冒烟训练已经由项目所有者授权并通过，且程序已自动保存全部规定证据。冒烟通过只证明程序能运行，不能直接进入渐进训练、推理、候选、Runtime或`/world`；当前只允许在项目所有者再次明确授权后执行V4 stage 0正式渐进训练。

AI辅助单图推理验证入口现在还必须自动调用验证专用机器审核入口：依次执行VJ-0、VJ-1、VJ-2、版本化风格指纹和构图新颖性审核，保存中英文记录、图片/条件/审核hash，并在失败时自动回写失败学习。该验证记录不得写入原图库，不得成为正式候选，不得绑定Runtime或进入`/world`。

项目所有者已于 2026-07-13 明确授权 `owner-authorized-ai-assisted-cold-start-v1`：OpenAI 生成的高分辨率像素风原图可以进入单独的 AI 辅助冷启动数据通道，但必须保存生成来源、提示词、时间、hash、owner 授权和审核结果，并固定 `independentTrainingEligible=false`。由此训练的 checkpoint 必须标记 AI 生成数据依赖；不得冒充纯项目独立数据 checkpoint。原 `strict-project-owned-training-data-v1` 通道继续保留，未来用于无第三方生成输出依赖的纯项目数据训练。

项目所有者已于 2026-07-16 批准无单独 API 付费的 Codex 内置图像生成路线。不得把 ChatGPT Pro 订阅解释成 OpenAI API 额度；不得要求保存 API Key；直接 OpenAI API 失败必须由程序记录失败码、路线、时间戳和证据，但不得保存密钥。Codex 内置生成只负责冷启动原始图，接收、派生、审核、失败回写和训练资格全部由项目程序自动处理。
