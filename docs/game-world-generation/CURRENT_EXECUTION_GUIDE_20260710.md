# 完整游戏世界生成当前执行指南

更新时间：2026-07-14 14:39:13 +08:00

状态：正式当前执行文档 / 当前主流程已进入代码闸门实现 / 当前 RuntimeFrame 被阻断 / 不代表地图训练成功

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 本文档用途

本文档是当前继续工作的唯一执行入口。

后续执行顺序必须先读本文档，再读被本文档引用的下级文档。旧计划、旧进度和旧 `live-world` 文档已经删除，不再保留平行入口。

## 2. 当前结论

产品定位不得因当前任务而改变：AI-PET-WORLD 是像素风格自主世界游戏，本地小 AI 是游戏核心智能系统；当前正在实现的 AI Painter 只是一项视觉生产能力。当前完整地图工作只闭合“世界事实如何被表达为专业游戏画面”，不代表小 AI 的职责只有画图，也不允许视觉输出取代世界 Runtime、世界导演、状态推理、角色自主或长期演化。

当前系统已经补上唯一编排入口、严格样本登记与不可变数据包、结构化数据审计、VisualFactManifest、动态完整世界视觉任务包、23 通道视觉条件编译器和项目自有完整地图模型架构。第三方 SD/ControlNet 已从正式主流程隔离；自有模型尚无独立训练数据和 checkpoint，因此正式完整地图推理仍阻断，第一版完整游戏世界地图尚未成功。

当前数据路线已经统一澄清：原图库五类目录是并行视觉知识分类，不是五阶段流水线、五个独立模型或程序拼图目录。完整地图正样本、地形、植物、自然物品和过渡/接地数据必须并行进入统一审核、Registry 和不可变完整世界数据包；正式推理只有一条完整世界主入口。20 张完整地图正样本只是其中一个最低门槛，不能替代其他分类数据。

当前地图同时被定义为未来类地球大世界的第一个连接区域，不是彼此孤立的概念图。大世界连接原则已写入 `natural-home-large-world-connectivity-v1`。项目所有者已命令按真实地球实际情况定义连接，程序据东南亚热带季风档案、NASA 参数快照、湄公河委员会水文/地理事实和当前自有地图坐标登记 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`。项目所有者已授权 Runtime 世界事实迁移并审核通过迁移结果，程序已生成 tick 3；当前不再是蓝图、迁移或连接事实审核缺失，只剩连接覆盖门槛未批准。

2026-07-13 项目所有者已将第一版正式视觉路线锁定为 2D 高分辨率像素风完整地图：模型原生画布 `1024×768`，正式候选必须覆盖完整地图并绑定当前任务包。训练允许使用 `256×192 -> 512×384 -> 1024×768` 渐进分辨率降低冷启动成本，但最终生成、机器审核、owner 审核和 Runtime 只认原生 `1024×768`；禁止把低分辨率输出放大、拼接或伪装成正式候选。

分辨率口径不得再次分叉：五类原图库中的完整地图 RGB、正式 target、正式候选、审核输入和 Runtime 图全部使用原生 `1024×768`；渐进训练只改变模型内部训练阶段，不改变数据身份和最终输出资格。画法/生成算法固定指“当前世界任务包与23通道条件如何进入本地模型并生成新像素”；风格契约固定指“这些像素如何保持统一视角、尺度、对象比例、像素纹理、轮廓、光照、接地、遮挡和游戏可读性”。同一算法不自动保证风格统一，同一风格也不能替代世界事实和结构条件。

MVP 生态身份已经由项目所有者确认迁移为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`，区域基准为东南亚大陆热带季风低地、河谷和丘陵生态参照包络，第一版采用现实地球物种。长期仍按 `playerId -> worldId -> worldSeed -> worldProfileId` 生成不同玩家世界。12 个第一版物种、20 类区域及 390 个植物视觉覆盖单元已经写入机器可读档案、目录和覆盖蓝图。第一轮暂用雨季、当地上午 10:00、雨后转晴、温暖湿润柔和日光和湿润地表快照，气候基线已经绑定 NASA POWER 2001–2020 版本化参数快照；视觉快照仍固定标记为 `isFinal=false`，表示光照和画面状态可继续由项目所有者调整。当前历史 WorldState 和最新任务包仍含旧值 `oasis` 或旧温带档案；在正式世界生成/迁移修正前，这些旧值不得作为当前原图生产事实。

同一地区的完整地图不得退化为单一“河流＋小路＋树林”构图。第一版已经在覆盖蓝图中锁定 20 类真实区域，包括低地热带常绿林、季节性常绿/半常绿林、湿润落叶柚木林、旱季疏林、竹林、河岸林、季风草地、洪泛地、淡水沼泽、芦苇湿地、山溪、石灰岩丘陵和森林低山。后续概念确认、原图接收和挑战集必须覆盖不同区域类型，同时保持当前热带季风物种、气候和正式像素画风一致。雪、冰川、高山苔原、荒漠、寒温带白桦/针叶林身份不属于本档案；红树林等海岸生态需另建子档案并经项目所有者批准。

当前主入口检查结果：

```text
npm run check:complete-game-world
```

当前状态：

```text
status = blocked
canEnterWorld = false
blockers = owner_review_missing_identity, formal_gate_missing,
           data_gap_insufficient, project_owned_checkpoint_missing,
           world_connectivity_coverage_thresholds_pending
```

含义：

1. 当前 tick 3 RuntimeFrame 没有正式图片身份和 FormalVisualJudge 报告，不能进入 `/world`；历史被人工拒绝的 RuntimeFrame 继续以 `owner_review_rejected` 失败码保留为证据，但该历史码不是 tick 3 的当前身份状态。
2. 严格审计除原有图片、hash、标签、审核和字典版本外，还要求 `independentTrainingEligible=true`、`strict-project-owned-training-data-v1` IP 谱系以及无上游生成权重/输出依赖。当前独立自研口径下所有样本计数均为 0；原有 17 条登记、16 条感知去重负样本只作历史证据。
3. FormalVisualJudge 通过只代表机器规则曾经通过，不代表最终游戏地图通过。
4. AI Painter 当前图片 API 不允许再直接展示被拒绝 RuntimeFrame。
5. 最新旧材料归档仍绑定字典 `mvp-natural-home-v0.1`；持久化检查把它保留为历史警告并单独校验当前 `mvp-natural-home-v0.3` 完整地图证据，旧归档不能冒充当前训练数据，但不再导致架构检查误失败。
6. 历史 SD 1.5/ControlNet bootstrap 曾自动生成、审核和保存失败图；这些结果已固定为历史对照，不再由正式主入口执行。
7. 项目自有模型架构已建立：23 通道条件编码器、项目自有潜空间自编码器和条件去噪器；配置固定自主初始化且上游模型列表为空。
8. 正式推理入口已实现权属门禁：没有 `project_owned_independent_weights` checkpoint 时自动保存阻断记录，绝不会加载第三方权重或用随机图冒充候选。
9. 历史 foundation v10 的失败已证明：通用第三方生成先验无法替代项目自有世界视觉逻辑；该结论只作架构反例保留。
10. 本地 LAION CLIP 仅作为视觉语义初审，能够辅助区分可游玩地图与概念插画，但不能代替 VJ-1、VJ-2 或项目所有者终审；本轮实验证明 CLIP 可能放过肉眼仍不专业的候选。
11. ADE20K/SceneParse150 条件类别已经按 ControlNet 官方类别表修正；水体、石头和道路曾存在颜色类别错位。当前道路改用 `dirt track`，水体越界审核只统计水体 Mask 之外的区域，注册请求归档不再被误报为无效正式样本。
12. 旧东亚温带概念图片、7 条旧原图库记录及其来源副本已按项目所有者命令删除，旧档案当前记录数为 0。当前热带季风原图库已有经项目所有者审核通过的 AI 辅助冷启动记录，覆盖完整地图和并行视觉知识分类；它们固定为 `aiAssistedColdStartEligible=true`、`independentTrainingEligible=false`，因此当前独立训练合格记录仍为 0。实时数量和分类统计只以 `data/world-samples/original-image-library/natural-home-v1/index.json` 与 `check:original-image-library` 为准，不在执行文档中维护易过期的实时计数。旧物种和快照 JSON 只作迁移说明，程序不得恢复旧图片记录或计入当前热带季风档案。
13. 当前热带季风档案已绑定 `mainland-southeast-asia-reference-v1` 地球参数快照：NASA POWER API v2.9.7、MERRA-2/POWER、2001–2020 气候平均、代表点 `15.5°N, 105.5°E`。原始响应、请求 URL、获取时间和 SHA-256 已保存并由原图库检查器验证。
14. 项目所有者已授权 AI 辅助冷启动训练数据。OpenAI 生成图只有在保存完整来源与提示词、通过机器审核和 owner 审核后，才能进入 `aiAssistedColdStartEligible` 数据；它们永远不计为 `independentTrainingEligible`，对应 checkpoint 必须保存 AI 数据依赖。
15. 大世界连接机器契约 `natural-home-large-world-connectivity-v1` 已建立；程序已自动保存候选，并在项目所有者“使用真实地球实际情况”的命令下登记第一版连接蓝图。当前家园为河岸热带森林区域，北接上游河谷、南接下游洪泛地、东接对岸河岸区域；水流北入南出，道路从南侧接入，西侧保留自然边界。项目所有者授权后，程序已从 tick 1 迁移到 tick 2，写入区域身份、3 个邻居、4 个当前区域连接口、道路延伸和水文/可走图；项目所有者审核通过后，程序在不改变连接几何、不生成图片的前提下写入 tick 3、审核命令、时间、hash 和独立审核记录。

## 3. 唯一主入口

完整游戏世界生成编排的唯一入口是：

```text
npm run run:complete-game-world
```

检查版入口是：

```text
npm run check:complete-game-world
```

只打印执行计划、不写业务数据的入口是：

```text
npm run plan:complete-game-world
```

`run` 执行当前允许的写入和检查；`check` 只执行只读检查；`plan` 只打印步骤。主流程依次建立独立数据审计、VisualFactManifest、世界导演输出、完整视觉任务包、23 通道条件包、自有模型权属检查和正式推理。主入口不再调用第三方 bootstrap；在自有 checkpoint 完成前必须返回阻断。

材料槽、局部训练、v46/v50/v52 等脚本只能作为从属步骤，不能作为完整游戏世界主入口。旧 5×5 Chunk、P10-P17、管家和生态路线的 npm 命令已统一返回 `retired_live_world_command_blocked`，历史文件仅作证据保存。

## 4. 正式文档层级

当前正式文档根目录：

```text
docs/game-world-generation/
```

当前执行入口：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

正式下级规格只保留以下 3 份。后续智能体不得再从阶段性文档自行拼装路线：

| 层级 | 文档 | 用途 |
|---|---|---|
| AI Painter 实现 | `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | VisualFactManifest、世界导演、条件编译、多尺度能力、完整地图推理和验证体系 |
| 训练数据与来源 | `TRAINING_DATA_AND_SOURCE_POLICY.md` | 样本来源、Schema、数据包、严格计数、自动保存和数据库迁移 |
| 审核与自动化 | `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 审核门、失败回写、自主循环、实时状态、控制台和存储 |

`docs/world-visual-data-dictionary/` 是机器参考。默认只读 `README.md`、`data/world-visual-data-dictionary/latest.json` 和当前任务明确涉及的条目，禁止全量读取后自由组合新路线。

## 5. 当前已处理的问题

| 编号 | 问题 | 当前处理状态 | 证据 |
|---|---|---|---|
| P0 | 没有唯一完整游戏世界生成编排入口 | 已处理；主入口已改为自有权重正式路线 | `npm run run:complete-game-world` 不再调用第三方 bootstrap，没有自有 checkpoint 时自动阻断和保存原因 |
| P0 | 模型训练架构未对齐 | 检查方式已处理，能力仍未完全对齐 | `npm run check:ai-painter-model-training-alignment` 现在核验真实命令、代码和产物，并因完整视觉推理缺失而正确失败；失败学习消费端已经实现 |
| P1 | 控制台状态会误报通过 | 已处理 | 控制台 API 读取 owner review，拒绝时不再 ready |
| P1 | AI Painter 图片 API 展示被拒绝 RuntimeFrame | 已处理 | 被拒绝图返回 404 |
| P1 | FormalVisualJudge 不够专业 | 已处理第一轮 | 增加灰绿伪装补丁等阻断 |
| P1 | 文档承认数据不够 | 已处理为硬阻断 | `data_gap_insufficient` 阻断主入口 |
| P2 | 文档治理混乱 | 已处理 | `docs/DOCUMENT_AUTHORITY_INDEX.md` 已建立，旧根计划、旧进度和旧 live-world 文档已删除 |
| P1 | 旧 live-world HTTP 控制入口仍开放 | 已处理 | 旧候选和图片 API 返回 410，不再参与当前控制面 |
| P1 | 旧 live-world npm 命令仍可执行 | 已处理 | 41 个旧 5×5/P10-P17/管家/生态命令统一返回 `retired_live_world_command_blocked` |
| P1 | 数据审计按文件数或历史模型产物虚增样本 | 已处理 | 除原有证据检查外，必须显式通过独立训练资格；当前正式计数全部为 0 |
| P1 | 世界视觉任务写死场景字段并混入后置事实 | 已处理 | `VisualFactManifest` 先筛选当前可见事实，导演字段由当前结构动态推导 |
| P1 | `check` 实际执行写操作 | 已处理 | `check` 只读、`plan` 只打印、`run` 才执行当前允许写入 |
| P0 | 任务包没有进入模型可消费条件 | 自有模型架构已对齐 23 通道，训练与 checkpoint 仍阻断 | `ProjectOwnedConditionEncoder` 固定接受 23 通道；没有自有 checkpoint 时不生成 RGB |
| P0 | 正式模型权属未锁定 | 已处理架构和门禁 | 配置固定 `project_owned_independent_weights`、自主初始化、空上游模型列表；第三方历史清单固定 `formalRouteAllowed=false` |
| P1 | 新完整地图失败被旧局部材料记录压住 | 已处理 | 自动学习器优先输出 `complete_map_machine_review` 失败约束，旧材料失败只作次级历史证据 |
| P1 | 机器失败图无法进入负样本闭环 | 已处理 | `npm run register:current-bootstrap-machine-negative` 自动登记机器负样本，不伪造 owner rejection |
| P1 | 仅按 SHA-256 去重会累计噪声变体 | 已处理 | 正式登记器增加感知差异 hash；近重复候选保存推理/审核，但不重复增加样本计数 |
| P0 | 没有统一合法样本入口和不可变数据包 | 程序能力已处理，真实样本仍为 0 | 登记器自动留存图片、hash、IP权属、许可、审核、标签和 split；数据包自动快照字典、任务、导演、条件、审核规则和审计 |

## 6. 当前未完成的问题

这些不是已经成功，而是下一阶段必须继续处理的内容：

| 优先级 | 未完成项 | 为什么重要 |
|---|---|---|
| P0 | 独立训练数据缺口未闭合 | 当前没有任何通过 `independent-training-eligible` 审计的 RGB 数据，自有模型无法开始有效训练 |
| P0 | 项目自有 checkpoint 缺失 | 自有扩散训练程序和采样器均已实现，但权重尚未训练；正式推理必须阻断，不得用随机输出冒充候选 |
| P0 | 完整地图候选仍不能通过 owner review | 当前图被人工拒绝，不能进入 `/world` |
| P1 | FormalVisualJudge 仍需继续从失败样本学习 | 已加一轮规则，但还不是完整专业审美模型 |
| P1 | 控制台实时监控需要继续严格化 | 已实现 25 秒周期实时状态、子进程 PID 存活检查和 3 秒非重入状态流；仍需在真实长任务中完成持续验收 |
| P1 | 子文档状态迁移 | 已处理；下级文件统一标记为 `architecture-spec`，实现事实只读取当前执行指南和程序检查 |
| P1 | Runtime 世界连接事实缺失 | 已处理并通过项目所有者审核 | tick 3 保存审核身份；3 个邻居、4 个当前区域连接口、南侧道路延伸和北入南出水文图保持不变；`npm run check:current-world-connectivity-migration` 通过 |

## 7. 下一步执行顺序

下一步不能再盲目训练局部材料。

必须按下面顺序走：

1. 文档治理收口：所有当前入口指向本文档。
2. 当前档案数据闭合：`mainland-southeast-asia-reference-v1` 地球气候参数快照已完成并通过 hash 校验。后续新增地形、水文或气候参数必须创建新快照版本，不得覆盖原始响应。
3. 大世界连接蓝图、Runtime 迁移和项目所有者审核记录已完成：`npm run check:earth-reference-world-connectivity-blueprint`、`npm run check:current-world-connectivity-migration` 和 `npm run check:world-connectivity-contract` 均必须通过。tick 3 已保存区域身份、三个邻居、四个当前区域连接口、道路延伸、水文图和审核身份；连接覆盖门槛仍需单独批准。
4. 五类原图并行接收：完整地图、地形、植物、自然物品和过渡/接地数据按各自主要分类并行建设，不按页面顺序训练。运行 `npm run build:original-image-intake-template` 一次生成绑定当前热带季风档案、临时快照和正式知识词表的五类请求模板及统一 manifest；完成真实原图后只通过 `npm run intake:original-image -- --request <request.json>` 复制留存图片和证据、计算 hash、写 `record.json` 并更新原图库索引。接收只产生 `intake` 或 `blocked`，不产生正式训练样本；运行 `npm run check:original-image-library` 检查目录、索引、五类知识目录、字典引用、图片与 hash。旧温带记录只作历史证据。
5. 项目原创样本入口：运行 `npm run build:project-owned-sample-intake-template`，程序自动绑定当前任务和23通道条件包，但只生成待填写模板，不生成 RGB 或正式样本。
6. 合法样本登记：原图库记录完成视觉审核和 IP 审核后，只通过 `npm run register:complete-map-training-sample -- --request <registration-request.json>` 留存正式样本、原创源文件、权属证据、来源许可、hash、审核状态、标签、连接蓝图与 split；程序不得制造专业正样本。运行 `npm run check:project-owned-training-data-ip-policy` 验证第三方内容和第三方生成模型均未进入独立训练数据。
7. 数据缺口审计与打包：运行 `npm run audit:complete-map-data-sufficiency`、`npm run build:current-complete-map-dataset-package` 和对应检查；不足数据包必须保持阻断状态。
8. 视觉事实清单：运行 `npm run build:current-world-visual-fact-manifest`，只允许当前范围内真实可见事实进入生成链路。
9. 失败学习消费与世界视觉任务包：运行 `npm run consume:game-map-visual-learning-feedback` 后，由 `npm run build:current-world-visual-task-package` 自动保存 VisualFactManifest、导演输出、地图结构、失败记忆和视觉版本的统一输入；完整世界主入口已自动编排这些步骤。
10. 运行 `npm run compile:current-world-visual-conditions` 和 `npm run check:current-world-visual-conditions`，验证当前任务包的结构、过渡、对象、生态和导演条件已经自动保存；没有权威来源的通道必须明确缺失，不得猜测。
11. 运行 `npm run check:project-owned-complete-world-model`，验证自有架构、训练器和采样器固定消费 23 通道，使用随机/自主初始化与空上游模型列表，且正式源码没有加载 Stable Diffusion、ControlNet 或 Diffusers 权重。
12. 只有通过独立数据审计后才允许运行 `npm run train:project-owned-complete-world-model`。训练器先训练项目自有潜空间自编码器，再训练项目自有条件去噪器；checkpoint 必须自动保存自主初始化、数据谱系、训练配置、每轮指标、文件 hash 和无上游权重声明。数据不足时必须自动保存 `independent_dataset_not_training_ready` 与 `independent_training_samples_missing` 后停止。
13. 正式推理只允许运行 `npm run run:current-world-visual-inference`。如果自有 checkpoint 缺失，程序必须自动保存 `project_owned_checkpoint_missing` 并停止，不得生成随机 RGB。
14. 自有模型生成新完整地图后，再进入 VJ-0/VJ-1/VJ-2/专业审美和 owner final review；全过程仍必须由程序自动保存。
15. 主入口运行：只通过 `npm run run:complete-game-world` 推进完整世界流程。
16. 只有自有模型候选机器全部通过并需要 owner final review 时，程序才停止等待项目所有者。

## 8. 成功定义

第一版完整游戏世界地图成功必须同时满足：

1. 完整地图数据包可追溯。
2. 本地小模型输出完整 RuntimeFrame 候选。
3. RuntimeFrame 不是局部 crop，不是材料测试图。
4. MaterialQuality 通过。
5. FormalVisualJudge 通过。
6. 专业审美失败模式无阻断。
7. 项目所有者人工终审通过。
8. `/world` 只读取通过终审的 RuntimeFrame。
9. 全过程记录自动保存到 `.runtime`，不是 Codex 手写替代。

## 9. 禁止事项

1. 不允许把局部材料训练当作完整世界训练成功。
2. 不允许把 FormalVisualJudge 通过当作最终成功。
3. 不允许展示 owner rejected RuntimeFrame 作为当前可用地图。
4. 不允许读取旧 running 状态假装实时运行。
5. 不允许绕过 `docs/game-world-generation/` 直接按旧文档自由发挥。
6. 不允许把没有自动保存的数据当作正式训练数据。
7. 不允许在数据缺口未闭合时宣布第一版世界地图完成。
8. 不允许建立“项目内部视觉教师”或让程序直绘图成为专业完整地图正样本。
9. 不允许写死未经实验验证的模型数量、数据规模和工期。
10. 不允许把五类原图库解释为五个先后训练阶段、五个 Runtime 图层或五个必须独立存在的模型。
11. 不允许从原图库复制、选择、放大或机械拼接图片冒充完整世界模型输出。

## 10. 当前检查命令

每次继续前先跑：

```text
npm run check:ai-painter-model-training-alignment
npm run check:world-connectivity-contract
npm run check:current-world-connectivity-proposal
npm run check:earth-reference-world-connectivity-blueprint
npm run check:current-world-visual-conditions
npm run check:project-owned-complete-world-model
npm run check:complete-map-training-sample-registry
npm run check:current-complete-map-dataset-package
npm run build:complete-map-data-blueprint
npm run audit:complete-map-data-sufficiency
npm run check:complete-game-world
```

如果 `check:complete-game-world` 返回 `blocked`，说明系统没有坏，而是当前流程正确阻断。阻断原因必须作为下一步任务来源。

## 11. 2026-07-10 控制台稳定性修复记录

本节是当前执行文档的一部分，禁止后续实现退回旧行为。

| 编号 | 已处理问题 | 固定实现规则 | 验证结果 |
|---|---|---|---|
| P1 | 训练进度轮询重入 | SSE 和前端降级轮询必须等待上一轮完成，再延迟 3 秒；禁止使用 1 秒异步 `setInterval` | TypeScript 与 lint 通过；摘要响应约 5 KB |
| P1 | 重型状态接口重复扫描 | 完整状态快照使用 3 秒共享缓存；SSE 只发送状态摘要 | 完整响应约 3.18 MB，SSE 摘要约 5 KB |
| P1 | 长任务实时状态过期 | 控制器每 25 秒刷新实时状态；控制状态记录同时保存真实启动的子进程 PID | 已进入代码实现；待下一次真实长任务持续验收 |
| P1 | 生产构建追踪训练产物 | `.runtime` 不得进入 `training-data-image` 路由生产文件追踪清单 | NFT 从 142,400,589 字节降至 268,128 字节 |
| P2 | GET 页面修改业务台账 | `/ai-painter-progress/natural-home` 只读现有证据；刷新页面不得写 `latest.json` 或历史快照 | 页面访问前后台账修改时间保持一致 |

控制台只是读取器。训练、推理、审核、失败回写和晋级事件仍由程序自动保存，页面访问不得成为业务事件。

已知后续项：生产构建仍会报告 `world-visual-dictionary-trials/image` 导入链上的宽泛文件匹配警告，来源涉及 `generated-results` 和 `natural-home` 的动态目录扫描。当前该路由 NFT 约 278 KB，不是本次 67 万运行文件追踪问题，但后续必须把共享读取逻辑从页面模块迁入独立只读服务，消除构建警告。
