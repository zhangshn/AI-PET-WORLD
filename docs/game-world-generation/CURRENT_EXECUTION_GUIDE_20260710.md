# AI-PET-WORLD 唯一模块计划表

更新时间：2026-08-24 05:24:15 +08:00

状态：active-module-plan / AI Painter固定进度3/5（60%）；三组件Smoke真实视觉失败，当前先完成文档整编，再收敛失败边界

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本文档是项目唯一计划表，只记录模块级目标、边界、验收条件和阶段状态，并在当前模块内保留最近一次模块终态、当前阻断和唯一下一动作。一次命令、单次Run、哈希、授权、消费记录、逐候选历史和训练流水不得写入Markdown；这些事实由本地程序保存到`data/`、`.runtime/`和SQLite。

表中状态不构成执行授权。当前冷启动训练、模型/数据/阈值修改和能力版本发布仍遵守项目安全门；同一执行包内的固定预览复现、validation、机器审核、只读分析、失败关闭、终态记录、监控和治理同步属于本地系统内部闭环，不应拆成重复人工操作。

## 1. 当前模块计划

| 顺序 | 模块 | 目标与边界 | 当前状态 | 验收与后续准入 |
|---:|---|---|---|---|
| 1 | 平台可靠性与文档治理修复 | 建立能力版本、一次性任务票据、训练互斥、后台执行、状态投影和正式文档职责 | 当前范围完成；AI Painter文档正在统一业务与研发边界 | 后续变更继续遵守机器门禁与文档权威链 |
| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；当前执行模块 | Stage4完整训练与审核通过后才能更新为4/5（80%） |
| 3 | 本地自研AI MVP能力迁移 | 训练/生成、验证、审核、确定性裁决、终态、治理记录和监控由本地程序闭环，Codex不成为Runtime依赖 | 与AI Painter同步建设；文档主体边界正在整编 | 能力版本、内部任务票据、状态机、自主裁决、失败安全停止和证据完整通过CPU回归 |
| 4 | 世界生成与自主角色MVP接入 | 将通过严格验证并发布的视觉能力接入受控Runtime | 未开始 | 冷启动能力版本发布验收通过；后续RuntimeFrame按正式机器门自主运行 |

## 2. AI Painter固定五阶段

这五项是候选资格阶段，不是CPU检查次数、修复次数或训练轮数。只有完整阶段达到验收条件，固定总进度才前进一格。

1. 失败证据与修复方向：已完成。
2. 候选、训练器支持与隔离配置：已完成。
3. 固定GPU资格：已完成。
4. Stage 0→Stage 1→Stage 2完整训练、固定复现与机器审核：进行中。
5. 不参与权重更新和Checkpoint选择的独立严格复验：未开始。

## 3. 当前研发候选结构

AI Painter对外只提供一个完整世界视觉入口。当前研发候选正在验证以下责任顺序：

```text
authoritative_world_structure_binding
-> terrain_route_hydrology_spatial_realization
-> per_class_object_semantic_realization
-> global_visual_harmonization_and_native_complete_rgb_decode
-> native complete RGB candidate
```

第一阶段是非训练权威输入绑定；后三阶段是参数、Checkpoint、输出和终态相互隔离的训练组件。全部阶段绑定同一world、region、tick、fact、VisualFactManifest和23通道条件包。该候选不得与`Stage 0/1/2`的`256×192 / 512×384 / 1024×768`训练分辨率阶段混淆，也不得在验证通过前写成永久模型架构。

## 4. 最近一次模块终态

受控三组件Stage 0 Smoke的三个组件均已自然完成30 Epoch。本地机器审核五张既有固定预览通过0/5，模型路线真实视觉失败已关闭且证据保持不可变。该失败不因当前治理能力建设而重新打开。

## 5. 当前阻断与唯一下一动作

当前先完成AI Painter正式文档整编，明确长期业务、当前候选和研发门禁三层边界。文档检查通过后，唯一模型动作是对本次三组件Smoke的0/5真实视觉失败执行一次CPU只读责任边界因果裁决：判断为责任/监督不足、前序身份接线缺陷、最终协调组件语义消除或证据不足。

只有证据证明具体接线或语义消除缺陷时，才允许形成一个最小、有界修复；若证明三组件责任或现有监督不足，则退出当前候选并进入项目级模型路线决定。不得借文档整编自动重跑Smoke、调参、增加Loss、降低阈值或启动Stage 0/1/2。

## 6. 完成条件与固定边界

- 当前固定进度只能报告3/5（60%），不得用CPU测试、只读GPU诊断、文档或工具建设冒充Stage4训练完成。
- 本地自主闭环建设属于本地AI能力迁移，不增加AI Painter固定五阶段进度；它完成后减少重复人工操作和Codex在线依赖。
- 当前Smoke只有在固定预览复现、机器审核、Manifest、Finalization和唯一终态全部形成后才算闭环。
- Smoke通过只获得Stage 0候选资格，不自动证明Stage 0成功；Smoke真实视觉失败则保存证据并按冻结裁决合同退出、形成一个有界修复或升级真实业务选择。
- Stage 1只能加载同一合法路线的Stage 0成功Checkpoint；Stage 2只能加载同一路线的Stage 1成功Checkpoint。
- 失败、退出、Smoke、诊断或历史Checkpoint不得作为正式阶段初始化或晋级来源。
- 不得降低机器审核阈值、把失败预览像素或审核结果作为训练目标，也不得用部分产物补写成功终态。
- Stage5、正式推理、Checkpoint正式晋级、能力版本发布、RuntimeFrame和进入`/world`不属于当前执行范围。

长期业务与技术边界分别见[业务规格](../BUSINESS_SPEC.md)、[总体架构](../ARCHITECTURE.md)、[本地自研AI能力与迁移架构](../LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md)和[AI Painter正式主体规格](AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md)。
