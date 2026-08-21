# AI-PET-WORLD 唯一模块计划表

更新时间：2026-08-21 09:43:30+08:00

状态：active-module-plan / AI Painter固定进度3/5（60%）；stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1的CPU未激活支持及独立只读GPU资格均已通过；尚未执行新配置Smoke或正式训练

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
- 本次失败后的CPU只读因果裁决确认：`stage4_per_class_final_visible_reference_feature_structure_obligation_v1`已经通过`weightedTotalTensor`进入主Loss，但其`perSampleClassTensors`此前没有进入`epoch_worst_sample_class`选择和专项回放，导致主训练对参考特征进行平均优化，而困难样本回放仍使用旧目标。`stage4_epoch_worst_sample_class_reference_feature_structure_replay_v1`的CPU未激活支持现已完成：选择与回放复用同一逐样本逐类别参考特征结构计算、原始批准参考RGB、四类对象掩码、23通道条件及既有派生权重，不新增回放次数或优化器步数；CPU正向13/13、反向21/21、配置审计及旧参考特征合同14/14正向和14/14反向兼容检查全部通过。该合同仍未激活，下一步必须先取得独立只读GPU资格，不能直接重跑Smoke或Stage 0。
- 上述新回放合同的首次独立只读GPU资格已消费一次性授权并失败关闭，未创建优化器、未执行`.backward()`、未修改权重或写入Checkpoint。失败断言要求footprints梯度在tree、rock、vegetation掩码内也严格为零，但样本194中footprints掩码分别完整覆盖240个tree像素、189个rock像素和496个vegetation像素；footprints自身梯度有限非零、其掩码外梯度为零、Denoiser梯度有限非零。因此当前失败属于GPU诊断的“空间掩码重叠”与“条件来源耦合”概念混用，不能作为模型失败，也不能把本次已消费授权补写为通过。下一步只能有界修正跨类别来源隔离检查，改为保持自身掩码不变并仅变更其他条件通道后比较自身Loss，再使用全新授权复验。
- 跨类别来源隔离诊断已经完成有界修正：CPU重叠夹具明确覆盖footprints包含tree、rock和vegetation的合法情况，改为保持当前类别掩码、参考RGB及条件通道不变，仅消融其他对象条件通道，再比较本类别逐样本张量、回放Loss、选择身份及梯度；CPU正向14/14、反向21/21和旧参考特征合同14/14正反兼容均通过。新GPU资格中本类别Loss与逐样本类别张量在消融前后达到字节一致，掩码内梯度有限非零、掩码外为零；但两次独立CUDA反向图的梯度没有达到字节完全相等，资格按合同失败关闭。该结果尚不能证明来源串线，也不能补写为通过；必须先只读量化梯度差异并裁决为数值确定性口径或真实来源依赖。
- 独立CUDA梯度身份合同已按正式数值语义完成有界修正：Loss与逐样本类别张量仍要求字节完全一致；梯度记录最大绝对差、最大相对差、有限值和非零支持身份，并使用PyTorch当前dtype默认容差判定，不选择自由容差。CPU正向16/16、反向21/21及旧合同14/14正反兼容均通过。随后的全新只读GPU资格中tree类Loss、逐样本类别张量、梯度有限性和非零支持身份均通过，但两处参数梯度最大绝对差约为1.016e-5和1.051e-5，略高于float32自动派生的1e-5绝对容差，因此资格真实失败关闭；未创建优化器、未执行`.backward()`、未修改权重、未写Checkpoint，也未编译连续训练计划。
- 上述GPU差异的CPU只读因果裁决已经完成：两处超限梯度分别对应`condition_stem.0.weight`和`condition_stem.2.block.2.weight`；正常与消融路线的tree Loss及逐样本类别张量字节完全一致，tree Loss源码只读取`object_tree`，而两条路线分别重建冻结Autoencoder特征图，微小差异已经先出现在`dLoss/dDecodedRgb`，随后沿同一个保留的50步Denoiser图放大。唯一裁决为独立CUDA/Autograd图的数值路径差异，不支持“其他对象条件来源依赖”。未激活修复合同要求把来源隔离比较放在Loss的直接因果边界`dLoss/dDecodedRgb`，参数梯度只从正常路线执行一次有限非零资格证明；不改变dtype派生容差、模型、Loss、数据或审核阈值。
- `stage4_reference_feature_source_isolation_causal_boundary_v1`的CPU支持和正反回归已经完成：来源消融前后的Loss与逐样本类别张量继续要求字节一致，来源隔离只在`dLoss/dDecodedRgb`直接因果边界使用PyTorch当前dtype正式等价口径；参数梯度仅从正常路线计算一次并继续要求有限非零。新合同正向20/20、反向21/21，旧参考特征合同正向14/14、反向14/14全部通过；模型、训练器Loss、权重、数据、dtype派生容差、Checkpoint和审核阈值均未改变。CPU支持本身保持未激活，其后续独立只读GPU资格已取得成功终态。
- 上述因果边界合同的全新独立只读GPU资格已经通过：固定样本194、validation身份、种子20263722、256×192、50步最终解码和west拓扑下，来源消融前后的最差样本—类别选择身份与回放Loss保持一致，`dLoss/dDecodedRgb`梯度满足PyTorch当前float32正式等价口径，正常路线参数梯度有限非零；Denoiser和冻结Autoencoder状态前后不变。未创建优化器、未执行`.backward()`、未修改权重、未写Checkpoint或启动训练。该结果取得新配置Smoke入口建设资格，但不等于Smoke或Stage 0通过。
- 新配置Smoke入口的首次CPU集成运行已失败关闭：新来源配置已与历史runId、授权和输出目录分离，但配置编译步骤错误删除了`training.ownerTrainingAuthorization`，而未按未激活合同保留`not_authorized_cpu_support_only`及全部false执行标志，训练器因此以`Stage 4 semantic mixture nested execution authorization is not closed`拒绝。GPU授权未创建或消费，Checkpoint未读取，优化器、GPU和训练均未启动；本次runId及生成配置只能作为失败证据，不得复用。
- 第二次全新runId已正确恢复显式关闭的`ownerTrainingAuthorization`，该项修复验证成立；完整CPU反向拒绝25/25通过，但正向13/17。唯一共同根因是证据注册表把训练目标支持合同绑定到状态为`stage4_epoch_worst_reference_feature_replay_cpu_support_completed`的历史CPU终态，而共享资格分类器只认可包含`passed`、`succeeded`或`success`的成功状态，真实Node因此拒绝。GPU授权仍未创建或消费，Checkpoint、优化器、GPU和训练均未启动；下一次必须使用全新runId，把该角色绑定到明确登记此支持合同的当前成功终态，不得修改来源支持合同或放宽分类器。
- 训练目标支持角色已通过一个全新CPU只读成功终态显式绑定到原支持合同，未修改历史终态、共享资格分类器、模型、Loss、数据或审核阈值；新runId的CPU正向17/17、反向25/25、真实Node到Trainer只读预检及资源预检全部通过。
- 随后的全新30 Epoch Smoke已自然完成：90次优化、模型权重变化、最佳Checkpoint、独立不可晋级Epoch 30终态模型、五张固定预览及字节复现、Manifest和Finalization均完整形成。机器审核时间线为Epoch 1九项失败、Epoch 5仅剩rock和vegetation、Epoch 10仅剩vegetation、Epoch 20/30全部通过；正式五张聚合门为2/5，因此Smoke真实失败关闭且未启动Stage 0。该运行不得重跑或作为训练Checkpoint来源；下一步只能独立裁决现有后期稳定资格合同是否认可1→0→0且终态无回退的晚期收敛证据。
- 上述Smoke的独立CPU只读后期稳定资格已经完成并通过：Epoch 10→20→30失败数为1→0→0，符合现有`strict_decrease_then_stable_zero`路线；Epoch 30全部条件通过，独立终态模型与预览字节复现一致，模型权重真实变化且不存在终态回退。资格仅授予从固定随机初始化开始的新Stage 0执行入口，不允许使用Smoke最佳Checkpoint或Epoch 30终态模型初始化；Stage 0尚未授权或启动。
- 当前参考特征回放候选的正式Stage 0编译器已经补齐激活登记，CPU正向44/44、反向37/37和活动配置审计通过；随后从固定随机初始化完成256×192、40 Epoch、5760次优化的全新正式训练。工程链、40轮指标、六张固定预览、Checkpoint、Manifest、模型权重变化、任务胶囊、事件账本及SQLite均完整，但六张预览机器审核0/6通过：早期存在道路、水体和对象问题，Epoch 40道路及水体已通过，footprints、tree、rock、vegetation仍全部为`reference_semantic_mismatch`。该Stage 0按真实视觉失败关闭，失败Checkpoint不得复用，Stage 1未启动。

- 本次最新Stage 0的独立CPU只读因果裁决已经完成：逐类参考特征结构义务与epoch最差样本—类别专项回放均在正式训练中激活，六个审核点的训练、验证、回放和Checkpoint指标持续改善，但四类对象参考语义始终未通过；唯一裁决为A，即现有回放已生效但仍不足以约束多样本最终可见语义。已形成未激活的逐类别最差样本参考特征结构义务合同；不得重跑相同Stage 0，下一步只能在独立Owner授权下建设该CPU未激活支持。
- `stage4_per_class_worst_sample_reference_feature_structure_obligation_v1`的CPU未激活支持现已完成：footprints、tree、rock、vegetation分别在批准训练样本中选择本类别最差样本，再以现有派生类别权重和既有rollout权重汇总进入总Loss及Checkpoint资格；不再用单个跨类别全局最大项代表四类对象，不新增回放次数、优化器步数或自由数值。CPU正向15/15、反向21/21，旧参考特征回放正向20/20、反向21/21及配置审计全部通过；未读取Checkpoint、未启动GPU或训练。该合同仍未激活，下一步只能执行独立只读GPU资格。
- 上述逐类别最差样本参考特征结构义务的独立只读GPU资格已经通过：程序完整扫描48条train和8条validation记录，在四类对象内分别执行最差样本选择，并以现有派生类别权重和rollout权重形成训练总义务及验证Checkpoint资格；四类最终解码RGB梯度均有限非零、掩码外严格为零，Denoiser和冻结Autoencoder状态前后哈希一致。该结果证明真实CUDA接线和资格计算成立，不代表视觉质量已经通过；下一步只能为当前候选建立一份全新30 Epoch Smoke入口和独立Smoke授权。
- 当前逐类别最差样本参考特征结构候选的全新30 Epoch Smoke已经自然完成：90次优化、模型权重变化、最佳Checkpoint、独立不可晋级Epoch 30终态身份、五张固定预览及字节复现、Manifest和Finalization均完整形成。机器审核时间线为Epoch 1九项失败、Epoch 5仅剩rock和vegetation、Epoch 10仅剩vegetation、Epoch 20/30全部通过；正式五张聚合门为2/5，因此按既有规则失败关闭且未启动Stage 0。该结果不是终态画面失败，也不得自动重跑；下一步只能在独立CPU只读授权下裁决现有后期稳定资格合同是否认可1→0→0且终态无回退的晚期收敛证据。
- 当前Smoke的独立后期稳定资格首次CPU正反回归已失败关闭，且资格授权没有创建或消费。正式决策库已把1→0→0识别为`strict_decrease_then_stable_zero`，但CPU检查器仍把`sustained_zero_from_first_late_epoch`作为每份绑定Smoke都必须为真的独立正向断言；该断言只适用于0→0→0路线，导致两条合法互斥路线被错误要求同时成立。来源Smoke、审核阈值、Checkpoint、模型和训练均未改动；下一步只能有界修正CPU检查器，使其验证“精确命中两条正式路线之一”，并使用全新runId重跑完整回归。
- 后期稳定资格CPU检查器的互斥路线断言已经有界修正：绑定Smoke的1→0→0精确验证`strict_decrease_then_stable_zero`，独立0→0→0夹具精确验证`sustained_zero_from_first_late_epoch`，两条路线均验证互斥；真正新增失败项、非零平坦、归零后回退、终态身份替换及复现不一致继续拒绝。完整CPU正向17/17、反向27/27通过，随后全新一次性CPU只读资格授权原子消费并形成成功终态；Stage 0准入成立，但不允许使用Smoke Checkpoint初始化，Stage 0尚未启动。
- 当前逐类别最差样本参考特征结构候选随后从正式固定随机初始化完成一次全新256×192、40 Epoch Stage 0。48条train仅用于权重更新，8条validation用于验证与Checkpoint选择，challenge和regression未参与训练；5760次优化、40轮指标、Epoch 1/5/10/20/30/40固定预览及复现、模型权重变化、Checkpoint、Manifest、Finalization和本地治理记录均完整。机器审核0/6通过，但失败时间线持续改善：Epoch 1/5包含道路、水体和四类对象问题，Epoch 10/20继续收敛，Epoch 30仅剩道路west边界及footprints/tree/vegetation，Epoch 40道路、水体、footprints、tree、rock均通过，仅剩植被参考语义不一致。该结果是终态真实视觉失败，不是授权、训练、Checkpoint、复现或工程链失败；Stage 1未启动，本次失败Checkpoint不得复用。

- 当前Stage 0植被终态语义与Checkpoint选择身份的独立CPU只读裁决已经完成：植被颜色、边缘、多尺度亮度、最终参考特征、逐类别最差样本及专项回放均在正式训练中激活并总体改善，但Epoch 40机器审核的植被maskedLumaCorrelation仍为0.0626、低于冻结要求0.08，唯一裁决为A。Epoch 34至40的Checkpoint候选受严格相对west边界非回退门阻断，而Epoch 40固定预览按绝对道路审核通过，两者作用域不同，不是植被失败的接线根因。现有证据不能唯一派生新的合法监督表达，因此只生成Owner项目级决策请求，不自动重跑、调参或进入Stage 1。

- CPU只读合法植被监督设计复核已完成：64份批准记录、48/8/4/4划分、原始参考RGB、23通道条件及object_vegetation掩码全部合格。现有最差亮度结构义务只取全样本×全类别的一个总最大值，可能由其他类别遮蔽植被最差样本；参考特征路径已有逐类别最差样本先例，因此唯一派生stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1，不新增模型、权重、数据或阈值。该合同仍未激活，下一步仅可实施CPU支持和正反回归。

- stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1的CPU未激活支持已完成：复用现有50步最终解码RGB及加权逐样本逐类别亮度结构张量，四类对象分别选择最差样本后在同一Loss槽汇总，Checkpoint资格对8条validation记录使用相同逐类别最大值；未新增模型、Loss权重、优化步骤、数据或阈值。下一步仅可执行独立只读GPU梯度资格。
- 上述逐类别最差样本最终可见亮度结构义务的独立只读GPU资格已经通过：诊断批次严格取不可变source-index正式顺序中的前四条train记录，并单独确认固定样本194的validation身份；footprints、tree、rock、vegetation分别按本类别列选出最大义务，选择结果与CPU直接重算完全一致。四项派生加权最大值之和精确进入同一最终可见Loss槽，Checkpoint资格复用同一张量与正式rollout权重；四类掩码内梯度有限非零、掩码外严格为零，Denoiser和冻结Autoencoder状态前后哈希一致。该结果只授予全新30 Epoch Smoke入口建设资格，不代表Stage4训练已经完成。
- 当前逐类别最差样本最终可见亮度结构候选的全新30 Epoch Smoke已自然完成：CPU正向17/17、反向15/15以及真实Node/Trainer和资源预检全部通过；90次优化、模型权重变化、最佳Checkpoint、独立不可晋级Epoch 30终态模型身份、五张固定预览及字节复现、Manifest和Finalization均完整。机器审核时间线为Epoch 1九项失败、Epoch 5仅剩rock和vegetation、Epoch 10仅剩vegetation、Epoch 20/30连续全部通过；原五张聚合门为2/5并失败关闭。随后独立CPU只读后期稳定资格以1→0→0的`strict_decrease_then_stable_zero`路线通过，终态无回退，当前已取得从固定随机初始化开始执行全新Stage 0的准入；Smoke最佳Checkpoint和Epoch 30终态身份均不得用于Stage 0初始化。
- 该候选随后从正式固定随机初始化完成一次全新256×192、40 Epoch Stage 0：48条train仅用于权重更新，8条validation用于验证与Checkpoint选择，5760次优化、六张固定预览及字节复现、正式诊断、模型权重变化、Checkpoint、Manifest、Finalization和本地治理记录均完整。机器审核0/6通过，但时间线由Epoch 1的八项问题持续收敛至Epoch 40仅剩footprints、tree、rock三类`reference_semantic_mismatch`；道路、水体和vegetation在Epoch 40已通过。该结果按真实视觉泛化失败关闭，失败Checkpoint、授权、runId和输出目录不得复用，Stage 1/2均未启动。

- 当前Stage 0 footprints、tree、rock最终参考语义泛化失败的独立CPU只读裁决已经完成：三类逐类最差亮度结构与参考特征目标均激活并下降，但正式合同声明的48条train逐类最差选择在batchSize=1下实际只看当前单样本；validation只保存逐类最大数值，没有保存被选sampleId、seedIndex和class身份。唯一裁决为B，已形成未激活的epoch完整逐类最差选择与Checkpoint身份合同；不得复用失败Checkpoint、自动重跑或进入Stage 1。

- stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1的CPU未激活支持已完成：每个完整Epoch覆盖48条train记录并分别选择footprints/tree/rock/vegetation最大义务，下一Epoch仅复用既有两次回放预算重算可微Loss；Checkpoint资格覆盖8条validation及既有rollout seeds并落盘精确身份。未新增优化步骤、Loss权重、数据或阈值。下一步仅可执行独立只读GPU梯度资格。
- 上述完整Epoch逐类别最差样本最终可见亮度选择与Checkpoint身份合同的独立只读GPU资格已经通过：真实CUDA 50步最终解码按正式source-index顺序覆盖全部48条train记录，并覆盖8条validation及全部既有rollout seeds；footprints、tree、rock、vegetation分别保留最大义务身份，四个选中样本—类别的掩码内梯度有限非零、掩码外严格为零，validation的classIdentity、sampleId、seedIndex、rawScore、weightedScore及总Checkpoint选择分数一致。Denoiser和冻结Autoencoder状态前后哈希不变，未创建优化器、未执行.backward()、未修改权重或写入Checkpoint。下一步只能执行一份全新30 Epoch Smoke。

### 3.2 当前尚未完成的业务门

1. 当前最差样本—类别候选的身份分离Smoke和后期稳定资格已经通过，但其全新Stage 0以六张预览0/6通过的真实视觉失败关闭；不得使用其Checkpoint、部分权重、授权、runId或输出目录再次执行；
2. `stage4_per_class_final_visible_reference_feature_structure_obligation_v1`的独立CPU支持、只读GPU梯度资格、30 Epoch Smoke、后期稳定资格及正式Stage激活登记均已完成；其全新Stage 0工程链完整，但六张预览0/6通过，Epoch 40四类对象参考语义仍不一致，因此真实视觉失败关闭，Stage 1/2均未启动；
3. `stage4_per_class_worst_sample_reference_feature_structure_obligation_v1`已完成CPU支持、全新只读GPU资格、30 Epoch Smoke、独立后期稳定资格及全新Stage 0；Stage 0工程链完整但机器审核0/6通过，Epoch 40仅剩植被参考语义不一致，因此真实视觉失败关闭。植被终态残差的独立CPU只读裁决已完成并确认现有合法监督已激活但仍不足；当前需要Owner决定暂停该路线或授权新的CPU只读合法植被监督设计复核，Stage 1/2均未启动；
4. `stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1`已完成CPU支持、独立只读GPU资格、全新30 Epoch Smoke、独立后期稳定资格及全新Stage 0；Stage 0工程证据完整但机器审核0/6通过，Epoch 40仍有footprints、tree、rock参考语义不一致。独立CPU裁决已确认训练端48条逐类最差选择退化为batchSize=1的当前样本选择，且validation选择身份未落盘；当前仅可建设有界CPU未激活接线修复，Stage 1/2未启动；
5. 只有后续合法路线依次通过Smoke、Stage 0、Stage 1和Stage 2，固定进度才从3/5（60%）更新为4/5（80%）。

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
-> CPU只读因果裁决（已完成；逐类参考特征结构已进入主Loss，但perSampleClassTensors未进入epoch最差样本—类别选择及专项回放）
-> epoch最差样本—类别参考特征结构选择与回放CPU未激活支持（已完成；正向13/13、反向21/21、配置审计和旧合同兼容检查通过）
-> 首次独立只读GPU资格（已执行并失败关闭；真实样本中footprints覆盖其他三类对象掩码，旧断言错误地要求这些重叠位置梯度为零；这不是模型视觉失败）
-> 有界修正跨类别来源隔离诊断：保持自身掩码不变，仅改变其他条件通道后比较自身Loss、选择身份和梯度（已完成；CPU正向14/14、反向21/21）
-> 第二次独立只读GPU资格（已执行并失败关闭；Loss与逐样本类别张量字节一致，但独立CUDA反向梯度未达到字节一致）
-> 按PyTorch当前dtype派生正式梯度等价口径并完成CPU正反门（已完成；正向16/16、反向21/21，旧合同14/14正反兼容）
-> 第三次独立只读GPU资格（已执行并失败关闭；tree类Loss和逐样本类别张量字节一致、非零支持身份一致，但两处梯度略超float32正式派生容差）
-> CPU只读裁决该差异属于独立CUDA图数值路径还是实际其他条件来源梯度依赖（已完成；唯一裁决为独立CUDA/Autograd图数值路径差异）
-> 因果边界来源隔离合同的有界CPU实施与正反回归（已完成；正向20/20、反向21/21，旧合同正向14/14、反向14/14）
-> 全新独立只读GPU资格（已完成；直接因果边界梯度等价、正常参数梯度有限非零、模型状态不变）
-> 新配置30 Epoch Smoke入口首次CPU集成（已失败关闭；未激活配置缺少显式关闭的ownerTrainingAuthorization，GPU与训练未启动）
-> 有界恢复未激活Owner授权对象并使用全新runId重跑CPU门（已完成；Owner权限闭合通过，但证据角色的成功终态分类不匹配而失败关闭）
-> 以全新runId修正训练目标支持角色的成功终态绑定并重跑CPU门（已完成；正向17/17、反向25/25及真实只读预检通过）
-> 新配置30 Epoch Smoke（已完整执行；Epoch 1/5/10失败，Epoch 20/30通过，聚合2/5真实失败关闭）
-> 独立CPU只读后期稳定资格裁决（已完成；1→0→0严格下降后稳定归零，终态无回退，Stage 0准入成立）
-> 新配置Stage 0（已完整执行；40 Epoch、5760次优化及工程证据完整，但六张预览0/6通过；Epoch 40道路和水体通过，四类对象参考语义仍不一致，真实视觉失败关闭）
-> 本次Stage 0四类对象泛化失败的独立CPU只读因果裁决（已完成；唯一裁决A：参考特征回放已激活但不足以约束多样本最终可见语义）
-> 逐类别最差样本参考特征结构义务CPU未激活支持（已完成；正向15/15、反向21/21、配置审计及旧回放兼容回归通过）
-> 逐类别最差样本参考特征结构义务独立只读GPU资格（已完成；48条train、8条validation、四类独立选择和最终解码梯度全部通过）
-> 当前候选全新30 Epoch Smoke（已完整执行；Epoch 1/5/10失败，Epoch 20/30连续通过，聚合2/5失败关闭）
-> 独立CPU只读后期稳定资格首次回归（已失败关闭；1→0→0路线被错误要求同时满足0→0→0断言，资格授权未消费）
-> 有界修正资格CPU检查器并重跑完整回归（已完成；正向17/17、反向27/27）
-> 独立CPU只读后期稳定资格（已完成并通过；1→0→0严格下降后稳定归零，Stage 0准入成立）
-> 全新Stage 0（已完整执行；5760次优化和工程证据完整，机器审核0/6，Epoch 40仅剩vegetation_reference_semantic_mismatch，真实视觉失败关闭）
-> CPU只读植被终态参考语义残差与Checkpoint选择身份因果裁决（已完成；唯一裁决A：现有合法植被监督已完整激活并改善，但Epoch 40最终可见亮度相关性仍低于冻结要求；Checkpoint相对west门与终态绝对道路审核不是同一合同口径）
-> CPU只读合法植被监督设计复核（已完成；唯一派生逐类别最差样本最终可见亮度结构义务）
-> stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1 CPU未激活支持、正反回归和配置审计（已完成）
-> 独立只读GPU资格（已完成；source-index前四条train记录逐类选择与CPU重算一致，四项Loss槽、Checkpoint资格和梯度边界通过，模型状态不变）
-> 当前候选全新30 Epoch Smoke（已完整执行；Epoch 1/5/10失败，Epoch 20/30连续通过，原聚合2/5失败关闭）
-> 独立CPU只读后期稳定资格（已完成并通过；1→0→0严格下降后稳定归零，独立终态身份及字节复现有效）
-> 全新Stage 0（已完整执行；5760次优化和工程证据完整，机器审核0/6，Epoch 40道路、水体和vegetation通过，footprints、tree、rock参考语义仍不一致，真实视觉失败关闭）
-> CPU只读footprints/tree/rock最终参考语义泛化因果裁决（已完成；唯一裁决B：48条train逐类最差选择实际退化为batchSize=1当前样本选择，validation选择身份未落盘）
-> 当前下一步：仅可为stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1编译并执行一份全新30 Epoch Smoke；不得复用失败Checkpoint、历史授权、旧runId或输出目录，也不得直接进入Stage 0/1/2
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
