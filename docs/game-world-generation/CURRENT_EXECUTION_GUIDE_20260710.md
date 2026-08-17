# AI-PET-WORLD 唯一模块计划表

更新时间：2026-08-17 19:18:44 +08:00

状态：active-module-plan / AI Painter固定进度3/5（60%）；逐类最终可见参考特征结构义务已完成正式Stage 0/1/2激活登记，CPU正向41/41、反向33/33及活动配置审计通过；随后全新Stage 0从固定随机初始化完成40 Epoch、5760次优化、40轮指标、六张固定预览复现、Checkpoint、Manifest和Finalization，但六张预览机器审核0/6通过，Epoch 40虽已恢复道路和水体，footprints、tree、rock、vegetation仍全部存在reference_semantic_mismatch，因此Stage 0以新的真实视觉失败关闭，Stage 1未获准启动

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本文档是项目唯一计划表，只记录模块级目标、边界、验收条件和阶段状态。一次命令、一次训练、单张图片、临时阻断、Run ID、哈希、授权及消费记录不得写入Markdown；这些执行证据由本地程序保存到`data/`、`.runtime/`和SQLite。

计划表只在模块建立、完成、失败关闭、暂停或范围实质变化时更新。表中状态不构成执行授权；任何写操作、训练、验证、推理、RuntimeFrame和世界运行仍须通过对应机器门禁及项目所有者授权。

## 1. 模块计划

| 顺序 | 模块 | 目标与边界 | 当前状态 | 验收与后续准入 |
|---:|---|---|---|---|
| 1 | 平台可靠性与文档治理修复 | 建立Owner授权、一次性消费、训练互斥、控制台状态投影、测试隔离和正式文档职责 | 当前范围完成 | 非生产平台检查通过；生产构建按正式部署授权另行验收 |
| 2 | AI Painter R5 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核阈值作为训练目标 | 固定进度3/5（60%）；Stage4进行中 | Stage4必须依次完成合格Smoke及Stage 0/1/2，才能更新为4/5（80%） |
| 3 | 本地自研AI MVP能力迁移 | 把授权、执行、审核、失败学习、证据登记和监控逐项迁移到本地系统，Codex不成为Runtime依赖 | 建设中；Owner信任身份和Stage4一次签署、分阶段消费基础设施已建立 | 本地工具验收、证据完整、Owner私钥隔离、失败安全停止；训练、验证和推理权限继续分离 |
| 4 | 世界生成与自主角色MVP接入 | 将通过严格验证的视觉结果接入受控Runtime并形成角色—世界闭环 | 规划 | 正式推理、Owner画面终审、RuntimeFrame和`/world`分别授权并验收 |

## 2. AI Painter固定五阶段

这五个阶段是候选资格链，不是CPU检查次数或训练轮数。只有整个阶段满足验收条件，固定总进度才前进一格。

1. 失败证据与修复方向：本地程序只读分析正式失败证据，形成有界未激活方向并保存终态；已完成。
2. 候选、训练器支持与隔离配置：合法监督、模型/训练器支持、未激活配置及CPU正反回归完整；已完成。
3. 固定单样本GPU资格：固定样本、种子和拓扑下证明可学习、因果路径、复现及机器审核资格；已完成。
4. Stage 0→1→2完整训练：使用64/64批准数据和48/8/4/4划分，依次完成256×192、512×384、1024×768三阶段训练、复现及机器审核；进行中，固定进度仍为60%。
5. 独立严格复验：使用未参与权重更新和Checkpoint选择的challenge轨迹执行多种子严格复验；未开始。

## 3. Stage4当前业务状态

### 3.1 已经成立的能力

- 训练、权重变化、Checkpoint、固定预览和字节复现工程链已经证明可用；过去出现的授权血缘、历史失败证据误用、Windows进度文件并发写入和预览身份问题已经有正式机器门禁。
- 64份批准数据、48/8/4/4划分、23通道条件及道路和四类对象监督身份保持固定。
- 历史V8、V9、结构事实优先、条件保持语义渲染器、事实条件语义混合解码器及首次正式Stage 0视觉失败均保留为只读历史证据，不得作为新执行父Checkpoint或直接运行来源。
- 上一正式候选曾完成一次256×192、40 Epoch Stage 0；其训练、Checkpoint、固定预览复现和权重变化证据有效，但footprints、tree、rock、vegetation最终参考语义持续不通过，因此该历史Stage 0已经真实失败关闭，不得成为当前候选的执行或Checkpoint来源。
- 上述历史四类对象泛化失败的CPU只读因果裁决已经完成：样本194的参考、条件及审核身份在六个审核点保持一致，没有证据支持身份错配；唯一裁决指向50步最终解码画面缺少逐类亮度空间结构义务，由此形成当前候选的新增训练义务。
- `stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_v1`已完成CPU、独立只读GPU资格及一次新配置30 Epoch Smoke。训练、权重变化、不可晋级Checkpoint和五张固定预览字节复现均成立；原始Smoke的Epoch 1、5、10失败及总计2/5记录保持不变，独立CPU只读后期稳定资格依据Epoch 10→20→30的1→0→0收敛、Epoch 20/30连续通过和终态无回退取得Stage 0准入。
- 当前候选随后完成一次全新的256×192、40 Epoch Stage 0。训练、48/8/4/4数据隔离、5760次优化、六个固定预览字节复现、权重变化、不可晋级Checkpoint、Manifest和Finalization工程证据均已形成；但六个固定预览机器审核0/6通过，Stage 0以真实视觉失败关闭。Epoch 30的道路与水体曾同时通过，Epoch 40水体保持通过，但道路所需west边界接触回退失败，footprints、tree、rock、vegetation虽然均有局部响应，仍未复现参考图的最终可见亮度空间结构。
- 本次Stage 0 CPU只读因果裁决已经完成：现有50步逐类最终亮度结构Loss、四类对象聚合指标和Checkpoint分数均改善，但六个固定审核点仍全部失败，Epoch 40四类对象亮度相关性均低于冻结要求；唯一主因裁决为训练目标与最终机器视觉特征失配。Checkpoint选择允许道路west边界从Epoch 30通过回退到Epoch 40失败，属于已确认的次要缺口，但不能解释四类对象在所有审核点持续失败；现有证据也不足以确认多样本梯度干扰。
- 当前`stage4_full_rollout_worst_sample_class_reference_luminance_obligation_v1`复用合法参考RGB、对象掩码、现有50步最终解码RGB、既有派生权重和尺度，不新增模型、自由数值或审核目标；其CPU正反回归、配置审计及独立只读GPU资格均已完成。新配置30 Epoch Smoke也已完整执行，训练、权重变化、不可晋级Checkpoint及五张固定预览字节复现成立；Epoch 1、5、10失败，Epoch 20和30连续通过，因此聚合门以2/5失败关闭。独立CPU只读后期稳定资格保留了1→0→0的后期审核收敛事实，但正式合同要求Checkpoint绑定并复现终态Epoch 30，当前不可变Manifest实际只绑定Epoch 5，资格因此失败关闭且不得启动Stage 0。
- Checkpoint选择与终态资格身份CPU只读因果裁决已经完成：Epoch 30的综合选择分数优于Epoch 5且机器审核通过，但其道路west边界接触略低于已选Epoch 5，现有严格非回退门因此拒绝更新最佳Checkpoint。训练结束后程序只重新加载、保存并复现最佳Epoch 5状态，导致视觉通过的Epoch 30没有独立可恢复模型身份；唯一裁决为Smoke证据身份缺口，不是降低Checkpoint门或审核阈值的理由。已形成未激活的最佳Checkpoint—终态资格身份分离合同，要求保留现有最佳Checkpoint规则，同时单独保存不可晋级的Epoch 30状态和字节级预览复现证据。
- `stage4_best_checkpoint_and_terminal_qualification_identity_separation_v1`的CPU支持已经完成：最佳Checkpoint继续按原综合分数和道路west边界非回退门选择，主Checkpoint格式保持不变；新Smoke已独立保存不可晋级、不可作为Stage 0初始化的Epoch 30终态状态，并与Epoch 30固定预览完成字节级复现绑定；后期稳定资格据此通过并授予当前候选Stage 0准入。
- 当前最差样本—类别最终参考亮度候选已经从固定随机初始化完成一次全新256×192、40 Epoch Stage 0。训练、验证、六个固定预览、Checkpoint、Manifest、Finalization、任务胶囊、事件账本和SQLite证据均完整形成；道路与水体在Epoch 40通过，但footprints、tree、rock、vegetation仍存在参考语义不一致，六个审核点全部失败，因此Stage 0真实视觉失败关闭，Stage 1未获准启动。
- 本次Stage 0四类对象最终可见语义CPU只读裁决已经完成。正式配置中的50步最终一致性、逐类多尺度亮度结构及最差样本—类别目标均已激活，Epoch 1→40相关Loss持续下降；但六个固定审核点仍全部失败，Epoch 40道路和水体通过、四类对象局部响应通过而参考语义持续不匹配。唯一裁决为A：训练目标已激活，但不能充分约束多样本最终可见语义。没有逐类梯度冲突证据支持B；Checkpoint选择非单调属于次要缺口，不能独立解释六点持续失败，因此不选择C；证据完整，未选择D。
- `stage4_per_class_final_visible_reference_feature_structure_obligation_v1`的CPU未激活支持和配置审计已经完成：该义务只使用原始批准参考RGB、原始四类对象掩码、23通道条件和冻结项目Autoencoder既有空间阶段特征，在最终解码输出上保留逐样本、逐类别约束；四类掩码内梯度均有限非零、掩码外为零且跨类别隔离，类别权重与rollout权重均复用现有正式派生合同。模型结构、现有Loss权重、数据划分、Checkpoint格式和审核阈值均未改变；配置本身继续保持未激活，正式Smoke或训练仍需独立授权。
- 上述逐类参考特征结构义务的独立只读GPU资格已经完成：固定样本194、种子20263722、256×192和50步最终解码条件下，footprints、tree、rock、vegetation均对最终解码RGB产生掩码内有限非零梯度、掩码外零梯度并保持跨类别来源隔离；冻结Autoencoder的3个既有空间阶段均参与，Denoiser与Autoencoder状态前后完全一致。该结果只证明真实CUDA因果接线成立，不代表视觉质量已经通过；尚未授权Smoke或训练。
- 逐类参考特征结构义务的Smoke来源身份分离和正式预检证据所有权修复已经完成：原混合身份配置保留为不可变历史证据；同一新授权、同一runId和精确SHA-256绑定的`passed_gpu_not_started_not_consumed`预检可由正式执行唯一接续，历史预检、外部路径、已消费状态及正式输出污染继续失败关闭。
- 当前逐类参考特征结构候选已完整执行一次全新30 Epoch Smoke。训练、90次优化、模型权重变化、最佳Checkpoint、独立不可晋级Epoch 30终态模型身份、五张固定预览及字节复现、Manifest和Finalization均已形成；Epoch 1因多项早期视觉不一致失败，Epoch 5仅剩植被参考语义不一致，Epoch 10、20和30连续全部通过。原聚合门严格按五张预览计算为3/5通过并失败关闭；这不是终态画面失败，也不得重跑相同配置，下一步只能由现有正式后期稳定资格合同裁决其是否具备Stage 0准入。
- 后期稳定资格合同已完成有界语义修正：保留原有“严格下降后稳定归零”路线，同时新增“首个后期Epoch已经为零且持续0→0→0”路线；非零平坦、归零后回退、新增失败项、终态身份替换及复现不一致仍失败关闭。CPU正向17/17、反向27/27全部通过，随后正式只读资格以`sustained_zero_from_first_late_epoch`路线通过，Stage 0准入已成立但尚未启动训练。
- 当前Stage 0活动配置审计已失败关闭：现有正式Stage编译器只激活到上一条最差样本—类别亮度合同，没有登记`stage4PerClassFinalVisibleReferenceFeatureStructureObligation`；CPU检查器也未检查该字段，因此旧范围回归虽显示正向38/38、反向29/29，实际生成的Stage 0配置仍将当前义务标记为`cpu_support_verified_inactive`，训练相关激活门均为false。为避免无效训练，Stage 0执行授权未创建或消费，Checkpoint、优化器、GPU及训练均未开始。
- 上述正式激活登记缺口已经有界修复：Stage 0/1/2均把`stage4PerClassFinalVisibleReferenceFeatureStructureObligation`登记为`training_loss_active_owner_authorized`，正式训练门为true，Smoke及全部禁止门为false；CPU正向41/41、反向33/33和活动配置审计全部通过，训练器、正式运行器、模型、Loss、数据、Checkpoint格式及审核阈值未修改。
- 当前逐类参考特征结构候选随后完成一次全新256×192、40 Epoch Stage 0。48条train参与权重更新，8条validation用于验证和Checkpoint选择，challenge/regression未参与权重更新；5760次优化、40轮指标、六张固定预览、字节复现、权重变化、Checkpoint、Manifest、Finalization、任务胶囊、事件账本及SQLite记录均已形成。机器审核0/6通过：Epoch 1至30包含道路、水体或对象问题，Epoch 40道路和水体已经通过，但footprints、tree、rock、vegetation仍全部为`reference_semantic_mismatch`。这是新的真实视觉泛化失败，不是授权、配置、训练、Checkpoint或复现工程失败；Stage 1未启动。

### 3.2 当前尚未完成的业务门

1. 当前最差样本—类别候选的身份分离Smoke和后期稳定资格已经通过，但其全新Stage 0以六张预览0/6通过的真实视觉失败关闭；不得使用其Checkpoint、部分权重、授权、runId或输出目录再次执行；
2. `stage4_per_class_final_visible_reference_feature_structure_obligation_v1`的独立CPU支持、只读GPU梯度资格、30 Epoch Smoke、后期稳定资格及正式Stage激活登记均已完成；其全新Stage 0工程链完整，但六张预览0/6通过，Epoch 40四类对象参考语义仍不一致，因此真实视觉失败关闭，Stage 1/2均未启动；
3. 只有后续合法路线依次通过Stage 0、Stage 1和Stage 2，固定进度才从3/5（60%）更新为4/5（80%）。

### 3.3 下一条执行路线

```text
逐类50步最终可见亮度空间结构义务CPU正反回归（已完成）
-> 独立只读GPU梯度资格（已完成）
-> 新配置30 Epoch Smoke（已完成，原始审核记录2/5）
-> CPU只读后期稳定资格（已完成，Epoch 10→20→30为1→0→0并取得Stage 0准入）
-> 单独授权并执行Stage 0（已完整执行，六张预览0/6通过，真实视觉失败关闭）
-> CPU只读Stage 0泛化失败因果裁决（已完成，主因：训练目标与最终机器视觉特征失配）
-> 最差样本—类别最终参考亮度义务CPU未激活支持（已完成）
-> 独立只读GPU资格（已完成）
-> 新配置30 Epoch Smoke（已完成，聚合审核2/5失败关闭；Epoch 20/30连续通过）
-> 独立CPU只读后期稳定资格（已执行；后期视觉时间线成立，但终态Checkpoint身份不符而失败关闭）
-> CPU只读裁决Checkpoint选择与终态后期稳定身份为何分离（已完成；Smoke只保存最佳Epoch 5，缺少独立Epoch 30资格身份）
-> 最佳Checkpoint—终态资格身份分离CPU支持（已完成；保留现有Checkpoint选择、主Checkpoint格式和审核阈值）
-> 全新授权Smoke形成独立Epoch 30终态模型/预览复现证据（已完成）
-> 独立CPU只读后期稳定资格（已完成并通过）
-> 全新Stage 0（已完整执行；道路与水体通过，四类对象参考语义不一致，六张预览0/6，真实视觉失败关闭）
-> CPU只读四类对象最终可见语义因果裁决（已完成；唯一裁决A：目标已激活但不能充分约束多样本最终可见语义）
-> 逐类最终可见参考特征结构义务CPU未激活支持（已完成，正向14/14、反向14/14，配置审计通过）
-> 独立只读GPU梯度资格（已完成，四类掩码内梯度非零、掩码外为零、跨类别隔离、模型状态不变）
-> 独立30 Epoch模型Smoke入口CPU门（已执行；来源配置的未激活义务叶与历史活动顶层身份冲突，失败关闭）
-> 分离来源架构配置身份与全新Smoke执行身份（已完成；新来源CPU正反门、真实Node到Trainer只读预检及资源预检通过）
-> 正式Smoke预检证据所有权修复（已完成；当前运行证据可接续且历史复用继续拒绝）
-> 全新30 Epoch模型Smoke（已完整执行；Epoch 1/5失败，Epoch 10/20/30连续通过，聚合3/5关闭）
-> CPU只读后期稳定资格裁决（已完成；合同语义补齐后以sustained_zero_from_first_late_epoch路线通过）
-> Stage 0活动配置编译审计（已执行；发现当前参考特征结构义务未被正式Stage编译器激活，安全失败关闭）
-> 有界补齐当前义务在正式Stage 0/1/2编译器及CPU检查器中的激活和正反覆盖（已完成，正向41/41、反向33/33、配置审计通过）
-> 全新Stage 0独立授权与256×192、40 Epoch正式训练（已完整执行；5760步与工程证据完整，机器审核0/6，Epoch 40四类对象参考语义仍不一致，真实视觉失败关闭）
-> Stage 1未启动；只有后续合法修复路线取得新的Stage 0成功Checkpoint后才可申请Stage 1
-> 后续合法路线的Stage 2只能加载其Stage 1成功Checkpoint
-> 四项全部成功后更新Stage4为4/5（80%）
```

一次签署不等于无限授权。总包中的Smoke、Stage 0、Stage 1和Stage 2仍分别签名、分别消费、分别验收；任一阶段真实失败、证据冲突、授权过期、输出目录冲突或需要Owner业务选择时，持续执行器必须停止，未开始授权保持未消费且不得自动重试。

## 4. 当前边界

- 当前固定进度只能报告3/5（60%），不得用CPU测试、只读GPU诊断、工具建设或文档完成冒充Stage4训练完成。
- 不得读取历史失败Checkpoint作为新候选初始化；Stage 0从正式合同规定的固定随机初始化开始，Stage 1/2只能使用本次前一Stage成功Checkpoint。
- 不得降低机器审核阈值、修改来源证据、把失败预览像素或审核结果作为训练目标，也不得用部分产物补写成功终态。
- Stage5、正式推理、Checkpoint正式晋级、Owner正式画面验收、RuntimeFrame和进入`/world`均不在当前Stage4连续执行授权内。

业务与技术边界分别见[业务规格](../BUSINESS_SPEC.md)、[总体架构](../ARCHITECTURE.md)、[本地自研AI能力与迁移架构](../LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md)和[AI Painter正式实现规格](AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md)。
