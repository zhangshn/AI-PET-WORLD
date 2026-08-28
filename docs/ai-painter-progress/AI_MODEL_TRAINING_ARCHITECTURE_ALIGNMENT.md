# AI Painter 模型架构与训练架构对齐规格

更新时间：2026-08-24 09:48:00 +08:00

状态：active-model-training-alignment-contract

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 对齐目标

AI Painter 的模型、训练、推理、审核和存储必须共同消费世界视觉数据字典、VisualFactManifest、World Director 和完整任务包。字典通过只证明合同可读取，不等于数据充分、训练完成、视觉能力通过或游戏世界完成。

## 2. 分层边界

| 层 | 职责 | 禁止事项 |
|---|---|---|
| 世界事实 | 保存世界结构、对象和 Runtime 状态 | 不由 AI Painter 决定事实 |
| 视觉字典 | 定义视觉目标、标签、失败码和审核规则 | 不直接生成图片 |
| 世界导演 | 将事实和失败约束转成结构化计划 | 不新增世界事实，不只输出松散 prompt |
| 任务包 | 将导演计划编译为模型输入 | 不缺字段、不跳过字典合同 |
| 本地分阶段视觉系统 | 按权威绑定、地形道路水文、对象语义、全局视觉与完整RGB责任链生成完整地图候选 | 不共享责任身份，不决定可玩性和最终通过 |
| Runtime 合成 | 绑定候选与结构化运行层 | 不用程序直绘替代模型视觉 |
| 审核与发布 | 执行机器门禁、能力版本和Runtime发布策略 | 不把部分指标通过当最终通过 |
| 存储 | 自动保存输入、输出、模型、日志、Token 和失败 | 不依赖聊天或 Codex 手工归档 |

## 3. Generation Task Package 合同

任务包至少包含以下字段：

```text
schemaVersion
taskId
createdAt
dictionaryVersionId
worldId
ownerId
tick
outputSize
singleMapScope
sourceFactIds
directorPlan
mapGrammar
spatialLayers
ecologyState
singleMapEcologyFields
gameplayContract
visualStyle
drawingProcess
artDirection
materialRecipes
singleMapMaterialFields
compositionRecipe
singleMapCompositionFields
renderLayerRecipe
qualityRubric
singleMapAcceptance
allowedEntities
forbiddenContent
previousFailures
storageContract
```

任务包必须绑定当前 `worldId`、`tick`、字典版本和 VisualFactManifest。只允许范围内的正式世界事实进入视觉输入；未获准的角色、施工、建筑和动物事实不得泄漏。

## 4. Visual Director Output 合同

导演输出至少包含：

```text
schemaVersion
directorRunId
createdAt
dictionaryVersionId
worldId
tick
sourceFactIds
singleMapScopePlan
sceneIntent
compositionPlan
terrainPlan
assetPlan
motionPlan
drawingProcessPlan
artDirectionPlan
materialRecipePlan
singleMapEcologyPlan
singleMapMaterialPlan
compositionRecipePlan
singleMapCompositionPlan
renderLayerRecipePlan
qualityRubricPlan
singleMapAcceptancePlan
fixPlanInput
generationTaskDraft
safety
```

导演字段必须能够追溯数据字典条目，不能由实现临时发明或省略。

## 5. 字典到模型输入

| 字典合同 | 模型用途 |
|---|---|
| `singleMapScope` | 限定完整地图范围 |
| `singleMapEcologyFields` | 生态、季节、湿度和自然连续性 |
| `singleMapMaterialFields` | 草、路、水、岸、石、植被等材料语义 |
| `singleMapCompositionFields` | 入口/出口、通行、分区、边界和阅读层级 |
| `singleMapAcceptance` | 机器审核、能力版本与Runtime发布标准 |
| `drawingProcess` | 结构、层级、材质和接地过程约束 |
| `artDirection` | 像素风、尺度、轮廓、光照和禁止项 |
| `renderLayerRecipe` | Runtime 图层顺序和覆盖关系 |
| `qualityRubric` | 质量门槛、失败码和审核证据 |

字典字段必须进入模型条件、损失、审核或存储中的明确位置，不能只出现在 Markdown 和提示词中。

## 6. 训练和推理链

```text
WorldFacts
-> World Visual Data Dictionary
-> VisualFactManifest
-> Visual Director Output
-> Generation Task Package
-> 23-channel Condition Package
-> Authoritative World Structure Binding
-> Terrain / Route / Hydrology Spatial Realization
-> Per-Class Object Semantic Realization
-> Global Visual Harmonization and Native Complete RGB Decode
-> Fresh Complete-Map Inference
-> Runtime Structure Binding
-> Machine Review
-> Capability Release / Runtime Publish Gate
-> Persistent Training Memory
```

前三个生成责任阶段中的权威绑定为非训练阶段；其后的地形、对象、全局视觉三个组件必须使用隔离参数、Checkpoint、输出和终态身份，并按同包前序成功证据连接。该内部责任链不得与Stage 0/1/2训练分辨率阶段混淆。

训练阶段可以渐进分辨率执行，但完整地图正式输出必须原生 `1024×768`。材料、对象和过渡能力是分阶段视觉系统的内部能力，不得把局部材料拼接、旧图选择或低分辨率放大冒充完整推理。

完整推理必须保存任务包、模型版本、Checkpoint、seed、图片哈希、生成时间和 `reusedExistingImage=false`。历史第三方 bootstrap 固定隔离，不得进入正式模型或 `/world`。

## 7. 数据与 Checkpoint 对齐

训练预检必须同时验证：

- 数据包、Registry 和实际 Dataset 最终选中行一致；
- `train / validation / challenge / regression` 数量和身份一致；
- challenge 与 regression 未参与训练和 Checkpoint 选择；
- 23 通道顺序、缩放方式和任务身份一致；
- 后一 Stage 的父 Checkpoint 路径、哈希、架构和数据谱系一致；
- 三个责任隔离组件的参数、Checkpoint、输出、终态和同包前序消费身份一致，且不存在跨组件可训练参数共享；
- 第三方权重、激活或输出未进入独立权重链；
- 能力版本、执行包、内部任务票据、范围和消费状态有效。

数据容量、代码回归、冒烟、Stage 完成、Checkpoint 保存、训练后验证和正式推理资格是不同状态，不能互相代替。

## 8. 自动保存对齐

每次训练、验证、推理和审核必须自动保存：

| 证据 | 最低内容 |
|---|---|
| Run Manifest | 任务、数据、配置、环境、状态、父资产 |
| Epoch | 训练损失、验证指标、Checkpoint 选择、最坏轨迹 |
| Checkpoint | 文件、哈希、模型合同、父子谱系、资格 |
| 条件证据 | WorldFacts、任务包、23 通道身份和哈希 |
| 算法证据 | 模型、训练器、数据读取器、扩散过程和 Runner 版本 |
| Token 与资源 | 本地 Token、样本呈现、优化步、CPU、内存、GPU、显存、磁盘、耗时 |
| 审核与失败 | 图片、失败码、区域、指标、修复目标和资格 |
| 索引 | 不可变文件、SQLite artifact/event 和查询指针 |

页面只读取这些记录，不创建或修复业务证据。

## 9. 正式准入

正式训练至少要求：字典合同、页面只读边界、训练数据持久化、文档治理、模型训练对齐、数据充分性、任务包、条件编译、能力版本变更门和资源预检全部通过。

正式推理还要求合格 Checkpoint、训练后验证、机器发布能力版本和当前任务包。RuntimeFrame 与 `/world` 继续使用独立机器发布门；第一版与重大能力版本变更使用同一完整机器证据规则，不设置人工首发特例。

## 10. 验收标准

模型训练架构对齐只有同时满足以下条件才算成立：

1. 任务包与导演字段完整且能追溯字典。
2. 模型真实消费 WorldFacts、VisualFactManifest 和 23 通道。
3. 数据、split、Checkpoint 与训练程序身份一致。
4. 训练、验证、推理和审核自动保存不可变证据。
5. 完整候选来自本地模型新推理，不是旧图、局部图或程序直绘。
6. 机器审核、能力版本发布验收和Runtime发布资格保持独立。
7. 程序在数据不足、资格失败、审核失败、能力版本未发布或Runtime发布门未通过时不能报告最终成功。

具体实现状态、缺口、Run ID、哈希和运行命令结果由机器检查器与唯一模块计划表提供，不写入本规格。
