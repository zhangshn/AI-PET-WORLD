# AI-PET-WORLD 技术架构

状态：正式架构说明
更新日期：2026-06-27

本文只描述当前固定架构，不记录临时想法。当前执行顺序以 [唯一执行计划表](./EXECUTION_PLAN.md) 为准，当前完成度以 [当前进度表](./PROGRESS.md) 为准。

## 总架构链路

```txt
业务输入 / 世界规则
-> World Facts 世界事实
-> Scene Blueprint / Condition Mask
-> 本地自研 AI Painter 小模型
-> CandidateFrame 候选画面
-> VisualJudge
-> ApprovedFrame / RuntimeFrame
-> /world 玩家主世界页面
```

核心原则：世界事实是源头，AI Painter 只负责视觉表达，VisualJudge 负责阻断不合格表达，ApprovedFrame 是视觉层凭证，不是 `/world` 页面本体。`/world` 必须是完整游戏 Runtime 界面。

## 模块职责

| 模块 | 职责 | 当前状态 |
|---|---|---|
| World Runtime | 维护世界事实、tick、管家行为、事件和资源状态 | 已有基础链路 |
| World Facts | 抽取当前世界真实存在的事实，用于视觉生成绑定 | 已接入 sourceFactIds |
| Scene Blueprint | 把世界事实转成画面结构条件，不是随意画图提示词 | 进行中 |
| Condition Mask | 把地形、道路、水岸、草地、深度等结构转为训练和推理条件 | 进行中 |
| AI Painter 数据层 | 存储训练样本、候选图、失败图、mask、资源账本 | 已接通 |
| 本地小模型 | 使用本地 PyTorch / CUDA 进行训练和推理 | 进行中 |
| VisualJudge VJ-0 | 校验文件、来源、hash、runtime gate、ApprovedFrame 边界 | 完成 |
| VisualJudge VJ-1 | 校验清晰度、边缘、结构、事实覆盖和视觉质量 | 进行中 |
| VisualJudge VJ-2 | 校验语义、风格、状态一致性和完整游戏画面感 | 进行中 |
| ApprovedFrame | 保存通过视觉闸门的视觉层凭证，不等于游戏页面 | 已打通首帧协议 |
| `/world` | 玩家主世界页面，只展示完整游戏 Runtime 界面 | 闸门已修正，禁止单张图片直铺 |

## 当前小模型结构

| 层级 | 说明 |
|---|---|
| 输入 | 结构条件通道、自然家园 mask、深度、可走区域、世界事实绑定 |
| 主体 | 本地 PyTorch 小模型，当前使用 RGB Refiner / Tiny U-Net 系列 |
| 辅助 | PatchGAN 或局部判别训练只作为画质辅助，不决定世界事实 |
| 输出 | 完整自然家园候选 PNG |
| 限制 | 输出只是候选图，不等于 ApprovedFrame |

当前模型不是第三方在线绘图 API。它是本地训练和本地推理链路。但训练数据、候选图、失败图仍必须经过权属记录与 VisualJudge 审核。

## VJ-1 双口径

| 口径 | 用途 | 是否可进入 `/world` |
|---|---|---|
| 训练诊断 VJ-1 | 用 target 对比 MAE、PSNR、锐度、边缘密度，判断模型是否学会复现训练目标 | 否 |
| 正式世界 VJ-1 | 不依赖 target，检查完整帧、事实覆盖、结构合理、画质清晰、无禁用内容 | 是，但仍需 VJ-2 和 ApprovedFrame |

训练诊断通过只能说明模型训练有效，不能直接说明世界画面可展示。正式世界画面必须通过正式世界 VJ-1、VJ-2 和 ApprovedFrame 绑定。

## `/world` 展示闸门

`/world` 必须满足全部条件才展示画面：

```txt
存在 ApprovedFrame
AND ApprovedFrame 是完整主世界帧
AND approvalScope = approved_for_game_world
AND worldId 匹配当前世界
AND tick 匹配当前 runtime
AND sourceFactIds 匹配当前世界事实
AND VJ-0 通过
AND 正式世界 VJ-1 通过
AND VJ-2 通过
AND 包含 game_world_ready_for_player
AND 包含 formal_full_world_frame
AND 不是训练图、候选图、失败图、crop、patch、tile、sprite
AND 不是单张图片直铺
AND 已生成游戏 RuntimeFrame / 游戏视口 / 交互容器
```

训练页、归档页、候选页可以展示训练过程，但不得冒充玩家正式世界画面。

## 训练结果归档架构

```txt
训练开始
-> 自动记录时间戳、耗时、GPU、显存、配置、数据集来源
-> 生成候选图
-> 质量筛选
-> VJ 审核
-> 成功 / 失败都写入 generated-results
-> 页面只做查看，不改变审核结论
```

失败图必须保留。失败图不是垃圾，它是后续训练、审计和判断模型问题的重要数据。

## 代码与版权合规架构

| 规则 | 内容 |
|---|---|
| 禁止复制源码 | 不允许直接复制其他项目、教程、博客、仓库中的实现代码作为本项目代码 |
| 允许学习原则 | 可以学习公开资料中的概念、论文思想、设计原则和工程方法，但必须用本项目自己的实现表达 |
| 依赖需合规 | 使用第三方库必须通过包管理器或明确许可证引入，不能私下复制库内部源码 |
| 生成资产需记录 | 训练图、候选图、参考图、失败图必须记录来源、用途、授权说明、生成时间 |
| 不复制素材 | 不允许复制他人角色、地图、UI、像素资产、商标或受保护美术表达 |
| 审核留痕 | 模型输出进入训练或展示前，必须经过来源、事实、画质和权属记录 |

这条规则同时约束人写代码、GPT 写代码、Codex 写代码和后续任何代理协作。

## 当前架构结论

当前架构没有变成“程序随便画图”，也没有允许候选图进入主世界。现在的关键问题是：小模型已经能生成自然家园候选，并已打通 Game-World ApprovedFrame 协议，但正式稳定率和完整世界感仍需要继续提升。下一步不扩展人物、建筑或动态，而是继续完成自然家园小模型泛化、正式世界 VJ-1/VJ-2 和更稳定的自然家园 ApprovedFrame。
