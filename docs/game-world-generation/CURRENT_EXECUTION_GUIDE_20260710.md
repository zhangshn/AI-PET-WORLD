# AI-PET-WORLD 唯一模块计划表

更新时间：2026-08-30 09:23:09 +08:00

状态：active-module-plan / AI Painter固定进度3/5（60%）；联合条件局部传输30步Smoke覆盖不足以拒绝模型家族，24 Epoch全数据筛查合同待编译

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。证据冲突或政策边界必须失败关闭、保存事实并给出安全替代，不进入Owner等待状态。

本文档是项目唯一计划表，只记录模块级目标、边界、验收条件和阶段状态，并在当前模块内保留最近一次模块终态、当前阻断和唯一下一动作。一次命令、单次Run、哈希、内部票据或历史授权、消费记录、逐候选历史和训练流水不得写入Markdown；这些事实由本地程序保存到`data/`、`.runtime/`和SQLite。

表中状态不构成聊天授权。Owner职责只由`DOCUMENT_AUTHORITY_INDEX.md`中的`GOV-OWNER-001`定义；本地自研AI在生效项目合同内自主完成能力变更、训练、验证、审核、发布与回退，不得生成等待Owner批准的正常状态。Codex等外部执行者仍受Owner当前任务范围约束。同一执行包内的固定预览复现、validation、机器审核、只读分析、失败关闭、终态记录、监控和治理同步不得拆成人工操作。

## 1. 当前模块计划

| 顺序 | 模块 | 目标与边界 | 当前状态 | 验收与后续准入 |
|---:|---|---|---|---|
| 1 | 平台可靠性与文档治理修复 | 建立自主能力生命周期、内部任务票据、训练互斥、后台执行、状态投影和正式文档职责 | `GOV-OWNER-001`、三层状态机、可信发布、防重放、37条顶层需求追踪、历史合同边界和本地文档规则已建立；正式文档基线已区分文档生效与程序符合；唯一当前执行登记已按事务、SQLite提交记录和绑定SHA-256落盘，控制台只从该登记投影当前任务及最近训练终态，旧Smoke已从默认记录源移除并登记为历史只读 | 当前身份隔离正反回归、控制台回归、TypeScript、文档权威/状态机/需求追踪语义检查已通过；该结论不表示AI Painter程序全量符合或模型通过。登记无效时必须显示`unknown_or_stale`且禁止历史回退；后续生命周期转换必须复用同一登记协议 |
| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；联合条件局部传输30 Epoch单样本Smoke真实视觉失败，但仅30次优化、覆盖30/1000训练timestep且与50个正式推理timestep无重叠，证据不足以拒绝模型家族 | 禁止原样重跑30步Smoke；下一步只编译冻结模型、Loss、数据、阈值和seed的24 Epoch全数据筛查合同，当前未激活GPU或训练 |
| 3 | 本地自研AI MVP能力迁移 | 能力设计、训练/生成、验证、审核、确定性裁决、发布、终态、治理记录和监控由本地程序闭环，Codex不成为Runtime依赖 | 通用闭环执行器、能力生命周期、机器发布裁决、签名内部票据、SQLite持久防重放、政策边界报告、实时进度/心跳、Windows WMI后台启动及唯一当前执行状态投影已完成CPU集成回归；当前没有活动训练 | 后续能力候选必须由生命周期编排器按同一登记、状态机和证据协议自主完成执行、验证、审核、裁决、发布或失败关闭；任何未登记命名空间不得成为当前任务 |
| 4 | 世界生成与自主角色MVP接入 | 将通过严格机器验证并发布的视觉能力接入受控Runtime | 未开始 | 第一版能力通过完整机器发布门；后续RuntimeFrame按正式机器门自主运行 |

## 2. AI Painter固定五阶段

这五项是候选资格阶段，不是CPU检查次数、修复次数或训练轮数。只有完整阶段达到验收条件，固定总进度才前进一格。

1. 失败证据与修复方向：已完成。
2. 候选、训练器支持与隔离配置：已完成。
3. 固定GPU资格：已完成。
4. Stage 0→Stage 1→Stage 2完整训练、固定复现与机器审核：失败关闭（最新完整条件候选Stage 0正式训练完成但审核0/6；Stage 1/2未启动，当前无活动训练）。
5. 不参与权重更新和Checkpoint选择的独立严格复验：未开始。

## 3. 最近退出的研发候选结构

AI Painter对外只提供一个完整世界视觉入口。最近一次三组件候选验证了以下责任顺序，但已因正式机器审核0/5和因果裁决A退出，不再是活动训练候选：

```text
authoritative_world_structure_binding
-> terrain_route_hydrology_spatial_realization
-> per_class_object_semantic_realization
-> global_visual_harmonization_and_native_complete_rgb_decode
-> native complete RGB candidate
```

第一阶段是非训练权威输入绑定；后三阶段是参数、Checkpoint、输出和终态相互隔离的训练组件。全部阶段绑定同一world、region、tick、fact、VisualFactManifest和23通道条件包。该候选不得与`Stage 0/1/2`的`256×192 / 512×384 / 1024×768`训练分辨率阶段混淆，也不得在验证通过前写成永久模型架构。

其后建立的权威语义载体模型家族已完成受控Smoke、只读GPU资格及正式Stage 0。正式Stage 0自然完成40 Epoch和5760次优化，但六个固定审核节点全部失败；Manifest绑定且字节复现一致的最佳Epoch 37预览独立审核仍存在footprints、tree、rock、vegetation四类参考语义不匹配。该候选已经由本地能力生命周期登记为`rejected`，不得重跑、复用Checkpoint或进入Stage 1/2。

解码后四类对象RGB候选随后完成受控Smoke及正式Stage 0。Stage 0自然完成40 Epoch和5760次优化，专业画面质量在六个固定节点通过，但道路边界与footprints、tree、rock、vegetation参考语义持续失败，最终审核为0/6。该候选已失败关闭，不得重跑、复用Checkpoint或进入Stage 1/2。

最终有界原生条件编码责任残差候选完成CPU实现、只读GPU资格及30 Epoch受控Smoke。水体和四类对象语义在Epoch 30全部通过，但道路仍在条件未授权的南侧边界形成接触。该结构只能在批准责任掩码内叠加残差，并明确禁止掩码外修改，不能直接消除基础干净潜变量路径在掩码外产生的错误道路信号。该候选已登记为`rejected`，不得启动正式Stage 0、自动重试或复用其不可晋级Smoke Checkpoint。

## 4. 最近一次模块终态

联合条件局部传输30 Epoch受控Smoke已自然完成并由同一闭环包完成字节复现、五节点正式机器审核、晚期稳定性裁决、Finalization和失败终态。五个预览全部存在道路或对象参考语义失败，Smoke资格未通过；该真实失败证据保持不可变，不降低阈值、不作为训练目标，也不晋级Checkpoint。

CPU只读覆盖裁决进一步确认该Smoke每Epoch仅对固定validation样本194执行一次优化，总计30次优化；训练timestep仅覆盖1000步扩散日程中的30步，范围635–722，与50个正式推理timestep精确重叠0步。对照的既有24 Epoch全数据筛查为1152次优化、覆盖1000/1000并重叠50/50；正式Stage 0为5760次优化。因此当前证据只能否决本次Smoke资格，不能拒绝联合条件局部传输模型家族。

## 5. 当前阻断与后续实施顺序

唯一裁决为`controlled_smoke_training_coverage_insufficient_for_model_family_rejection`，`candidateRejected=false`。禁止原样重跑同一30步单样本Smoke，也禁止读取本次或任何失败Checkpoint权重。

本地程序已生成未激活的24 Epoch全数据筛查设计合同：固定48条train记录每Epoch一次优化，共1152步；固定seed 20263722、1000步完整timestep覆盖、50/50正式推理timestep重叠，并冻结现有联合条件局部传输模型、正式Loss值与权重、64条数据及split、机器审核阈值和Checkpoint边界。当前合同不含future runId或输出命名空间，所有GPU、优化器、反向、权重修改和训练门均为false。

下一步唯一允许动作是`compile_joint_condition_local_transport_24_epoch_full_data_screen`，由本地程序另行编译不可复用的正式执行合同并通过CPU正反门；本次裁决本身不得启动GPU或训练。

## 6. 完成条件与固定边界

- 当前固定进度只能报告3/5（60%），不得用CPU测试、只读GPU诊断、文档或工具建设冒充Stage4训练完成。
- 本地自主闭环建设属于本地AI能力迁移，不增加AI Painter固定五阶段进度；它完成后减少重复人工操作和Codex在线依赖。
- “当前入口脚本白名单通过”与“当前执行身份隔离通过”是两个独立验收项；后者已由唯一登记、事务一致性、绑定证据重算、篡改失败关闭、重复初始化拒绝和历史隔离回归证明。后续程序不得将两者重新合并为目录扫描逻辑。
- 当前Smoke只有在固定预览复现、机器审核、Manifest、Finalization和唯一终态全部形成后才算闭环。
- Smoke通过只获得Stage 0候选资格，不自动证明Stage 0成功；Smoke真实视觉失败则保存证据并按冻结裁决合同退出、形成一个有界修复或升级真实业务选择。
- Stage 1只能加载同一合法路线的Stage 0成功Checkpoint；Stage 2只能加载同一路线的Stage 1成功Checkpoint。
- 失败、退出、Smoke、诊断或历史Checkpoint不得作为正式阶段初始化或晋级来源。
- 不得降低机器审核阈值、把失败预览像素或审核结果作为训练目标，也不得用部分产物补写成功终态。
- Stage5、正式推理、Checkpoint正式晋级、能力版本发布、RuntimeFrame和进入`/world`不属于当前执行范围。

长期业务与技术边界分别见[业务规格](../BUSINESS_SPEC.md)、[总体架构](../ARCHITECTURE.md)、[本地自研AI能力与迁移架构](../LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md)和[AI Painter正式主体规格](AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md)。
