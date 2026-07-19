# 审核、自动闭环与存储正式规格

更新时间：2026-07-20 04:31:34 +08:00

状态：active-architecture / 自动保存与控制台边界已锁定 / V3漏判已保存 / V4 stage 0冒烟证据已自动保存 / Professional Aesthetic v2待V4新图验证

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

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
| 完整地图专业性 | 像素风不能降低入口、中心、道路、水岸、可走性、构图、接地和 owner 终审标准 |
| 完整地图范围 | 必须表现整体入口/出口关系、家园中心、连续道路组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；只有单一河段、道路、池塘、林间空地、材质范围或放大局部生态单元时，固定写入 `local_scene_not_complete_map` 并拒绝 |
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

所有目录使用不可变 runId 和历史记录；`latest.json` 只作为索引，不是唯一证据。

AI辅助条件去噪训练程序必须在统一训练总账中自动写入训练预检启动、阶段成功、阻断和失败事件；每条事件必须包含中英文标题与说明、runId、分辨率阶段、预测目标、证据路径、退出码或失败码，并明确 `finalGameMapSuccess=false`、`canEnterWorld=false`。checkpoint manifest、训练进度、诊断报告和统一总账是并列证据，任何一项都不得由页面访问或聊天记录替代。2026-07-19 已将 V3 三阶段训练和无RGB数值诊断按原始manifest/diagnostic证据补录到统一总账；后续运行由训练程序直接自动写入，不再依赖人工补录。

V4及后续版本还必须由训练程序为每个run自动保存 `algorithm-evidence.json`，至少包含配置、模型、训练器、数据读取器、扩散过程和正式runner的路径与SHA-256，以及模型合同、条件缩放合同、训练损失合同、checkpoint选择合同和双时区时间戳。训练指标必须逐项保存velocity、clean latent、latent gradient、离散条件重建、连续条件重建和复合质量分数；只保存总loss不满足审计要求。成功、阻断、异常退出和部分产物均不得漏记。

2026-07-20项目所有者授权的V4 stage 0冒烟训练已经由正式控制器执行。runId=`ai-assisted-conditional-denoiser-v4-smoke-2026-07-19T20-23-04-154Z`，状态=`conditional_denoiser_program_smoke_test_passed`，checkpoint SHA-256=`f7e00f80035d8986546ed4004b68647852a83df8d43c99b0ef40e28787910c63`。程序已自动保存21套条件配对、23通道、velocity、clean latent、latent gradient、离散条件重建、连续条件重建、复合指标、6个算法源文件hash、进程证据、退出码及UTC/北京时间。该记录固定`formalInferenceEligible=false`，只证明程序可运行；不得作为正式渐进训练完成、推理成功、候选通过或Runtime资格。

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
