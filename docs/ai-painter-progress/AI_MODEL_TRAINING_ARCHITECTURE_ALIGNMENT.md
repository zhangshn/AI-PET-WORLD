# AI Painter 模型架构与训练架构对齐规格

更新时间：2026-07-11 12:32:00 +08:00

状态：active-lock / 真实代码与产物检查已实现 / 完整地图数据与视觉推理仍阻断

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 当前结论

数据字典第一版已经整理到可接入训练架构的状态。

| 项目 | 当前值 |
|---|---|
| 字典版本 | `mvp-natural-home-v0.3` |
| 字典状态 | draft，可用于第一版训练接入和项目所有者审核 |
| 当前作用域 | `single_complete_map_visual` |
| 人工默认阅读文档 | 2（`README.md` 与完整打印稿） |
| 结构化字典条目 | 84（保存在单一 JSON 权威源中） |
| 导出条目 | 84 |
| 类别 | 26 |
| 注册失败码 | 366 |
| 硬失败码 | 345 |
| 未注册硬失败码 | 0 |
| 检查命令 | `npm run check:world-visual-data-dictionary` |

结论：可以继续把本地 AI Painter 的模型架构、训练架构、推理架构、审核架构和自动保存架构对齐到该字典；但不能把字典通过等同于最终游戏画面通过。

## 2. 总体架构边界

| 层 | 职责 | 禁止事项 |
|---|---|---|
| 世界事实层 | 保存世界结构、对象、Runtime 状态 | 不由 AI Painter 决定事实 |
| 数据字典层 | 定义第一版地图视觉目标、失败码、训练标签、审核规则 | 不直接生成图片 |
| 导演层 | 将世界事实和失败反馈转成结构化生成计划 | 不写松散 prompt，不新增世界事实 |
| 任务包层 | 将导演计划变成模型可消费输入 | 不缺字段、不跳过字典合同 |
| 本地小模型层 | 学习并输出本轮完整地图视觉候选；局部材料仅为内部从属能力 | 不决定可玩性、不决定最终通过 |
| 推理层 | 使用当前任务包和 checkpoint 生成本轮完整候选 | 不覆盖历史结果、不复用旧图冒充新推理 |
| 合成层 | 把完整视觉候选与结构化 Runtime 层绑定成 RuntimeFrame 候选 | 不用程序直绘代替模型视觉、不绕过审核进入 `/world` |
| 审核层 | 执行 MaterialQuality、VisualJudge、FormalVisualJudge、owner review | 不把机器通过当人工最终通过 |
| 保存层 | 自动保存所有输入、输出、模型、日志、失败码、审核结果 | 不依赖 Codex 手工归档 |

## 3. 字典到模型输入的对齐

| 字典字段 | 来源文档 | 模型/训练用途 | 当前接入状态 |
|---|---|---|---|
| `singleMapScope` | `versions/current-single-map-visual-scope` | 限定当前只训练单一完整地图视觉 | 必须接入 |
| `singleMapEcologyFields` | `ecology/single-map-ecology-fields` | 草、水、湿度、植被密度、自然连续性条件 | 必须接入 |
| `singleMapMaterialFields` | `material-recipe/single-map-material-field-schema` | grass/path/water/shoreline/stone/vegetation 材料槽输入 | 必须接入 |
| `singleMapCompositionFields` | `composition-recipe/single-map-composition-fields` | 入口、路径、中心、水岸、边界、留白和读图顺序 | 必须接入 |
| `singleMapAcceptance` | `review/single-map-visual-acceptance` | 判断是否能作为第一版完整地图候选 | 必须接入 |
| `drawingProcess` | `drawing-method/` | 模型输出从 blockout、value、material 到 grounding 的过程约束 | 必须接入 |
| `artDirection` | `art-direction/` | 禁止噪声图、拼贴、贴纸、糊图、程序占位 | 已接入任务包 |
| `materialRecipes` | `material-recipe/` | 各材质的颜色、颗粒、边缘、层次、地球基准 | 已接入任务包 |
| `compositionRecipe` | `composition-recipe/` | 完整游戏地图的视觉层级和玩家阅读路径 | 必须接入 |
| `renderLayerRecipe` | `render-layer-recipe/` | Runtime 合成层级和材料覆盖顺序 | 已接入任务包 |
| `qualityRubric` | `quality-rubric/` | 机器、智能体、项目所有者共用评分标准 | 必须接入 |

任务包前置事实契约是 `VisualFactManifest`。它必须绑定当前 `worldId`、`tick`、字典版本和真实世界事实，只允许当前地图范围内可见的自然事实进入导演层；管家、施工、动物和其他后置内容不得泄漏到本轮视觉输入。

## 4. 导演输出到训练任务的对齐

| 导演输出字段 | 训练任务字段 | 要求 |
|---|---|---|
| `singleMapScopePlan` | `singleMapScope` | 当前只允许单一完整地图，玩家/交互/多 tick 保留 |
| `singleMapEcologyPlan` | `singleMapEcologyFields` | 生态条件必须进入输入包 |
| `singleMapMaterialPlan` | `singleMapMaterialFields` | 每个材料槽必须能追溯字典材质规则 |
| `singleMapCompositionPlan` | `singleMapCompositionFields` | 入口、道路、中心、水岸、边界必须结构化 |
| `singleMapAcceptancePlan` | `singleMapAcceptance` | 通过/失败标准必须结构化 |
| `drawingProcessPlan` | `drawingProcess` | 不能只给一段 prompt |
| `artDirectionPlan` | `artDirection` | 必须明确禁止项和专业画面目标 |
| `materialRecipePlan` | `materialRecipes` | 必须绑定草、路、水、岸、石、植被等材料规则 |
| `compositionPlan` | `compositionRecipe` | 必须绑定读图顺序、焦点、留白和节奏 |
| `renderLayerRecipePlan` | `renderLayerRecipe` | 必须绑定 Runtime 层级 |
| `qualityRubricPlan` | `qualityRubric` | 必须绑定质量门槛和 owner override |

## 5. 本地 AI 模型架构对齐

当前第一版不把模型定义成一个万能画图黑箱，而是拆成可审计链路。

| 模块 | 当前职责 | 对齐字典 | 输出 |
|---|---|---|---|
| 材料槽模型 | 学习 grass、path、water、shoreline、tree、rock 等局部材料；仅为内部从属能力 | `singleMapMaterialFields`、`materialRecipe` | 材料槽 PNG、材料质量报告；不能单独代表完整地图训练 |
| 完整图候选模型 | 学习完整自然家园地图候选 | `singleMapScope`、`compositionRecipe`、`qualityRubric` | contact sheet、latest.json、候选图 |
| Runtime 合成器 | 根据结构和材料合成完整 1024x768 RuntimeFrame 候选 | `runtimeRenderLayerRecipe`、`singleMapCompositionFields` | composite-output.png、RuntimeFrame candidate |
| VisualJudge/FormalJudge | 判断候选是否符合专业游戏地图标准 | `qualityRubric`、`singleMapAcceptance`、`review/failure-codes` | 通过/失败报告、失败码 |
| Owner Review | 项目所有者最终视觉验收 | `singleMapAcceptance`、owner override | pass/reject 记录 |

## 6. 训练架构对齐

| 阶段 | 输入 | 输出 | 必须保存 |
|---|---|---|---|
| 数据准备 | 字典合同、源样本、失败反馈、目标材料槽 | dataset、dataset-summary | manifest、sample list、failure source |
| 训练 | dataset、config、initial checkpoint | best.pt、training-summary、log | 配置、epoch、loss、设备、样本数 |
| 合并模型 | 各材料槽 best.pt | combined-model-root | combined-model-root-manifest |
| 完整视觉推理 | current task package、VisualFactManifest、model checkpoint | 本轮完整地图候选、inference manifest | 任务包、模型版本、checkpoint、seed、图片 hash、生成时间、`reusedExistingImage=false` |
| 内部材料推理（可选） | model-root、reference dataset、task package | materials、latest.json、material-quality-report | 模型路径、输入包、每个材料槽图片；不得代替完整视觉推理 |
| 材料审核 | materials、字典材质规则 | MaterialQuality report | failedSlots、materialPassed |
| 材料包 | material pass 结果 | ApprovedMaterialPack 或失败记录 | approved pack 或 failure report |
| Runtime 合成 | 材料包、结构、层级规则 | complete RuntimeFrame candidate | composite-output、audit、candidate JSON |
| FormalJudge | RuntimeFrame candidate、质量字典 | formal report | formalVisualJudgeIssues |
| 人工复核 | formal report、候选图 | owner pass/reject | owner status、reason、negative sample label |

## 7. 自动保存对齐

每次训练/推理/审核必须自动保存，不能只在聊天里说明。

| 数据 | 必须自动保存到 |
|---|---|
| 训练总账 | `.runtime/ai-painter/training-process-ledger/` |
| 训练运行档案 | `.runtime/ai-painter/training-run-archive/` |
| 训练目录 | `.runtime/ai-painter/*-training/` |
| 数据目录 | `.runtime/ai-painter/*-dataset/` |
| 合并模型 | `.runtime/ai-painter/*-combined/` |
| 推理运行 | `.runtime/game-map-material-slot-inference-runs/` |
| Runtime 合成 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame 候选 | `.runtime/game-map-runtime-frame-candidates/` |
| 字典审核试验 | `.runtime/world-visual-dictionary-trials/` |
| 页面索引 | 页面读取上述自动保存目录，不替程序手工补记录 |

## 8. 当前缺口

| 缺口 | 影响 | 处理规则 |
|---|---|---|
| 部分旧链路仍以历史脚本名或 v46 管线名输出 | 页面和人容易误读版本 | 不改已有数据名；后续新轮次必须原样显示真实目录和 runId |
| 字典字段已定义，但不是所有训练脚本都显式读取完整任务包 | 模型可能仍吃局部材料数据，无法理解完整地图目标 | 下一轮训练前必须检查任务包字段 |
| 机器指标能过但画面仍可能不专业 | 不能直接进入 `/world` | 必须 owner review |
| 页面以前只读部分目录 | 用户查不到所有训练数据 | 已锁定生成结果页读取自动保存目录 |
| 完整世界视觉推理执行器未实现 | 任务包尚不能送入真正的完整图模型产生新图 | 维持阻断，不得用旧图选择/缩放器冒充推理 |
| 审核失败学习结果尚不能作用于未实现的完整图推理器 | 失败记录已经进入任务包，但尚不能改变不存在的完整图推理过程 | 推理器接入后必须消费任务包中的失败记忆，不得另建旁路 |

## 8.1 当前真实实现矩阵

| 组件 | 状态 | 程序证据 |
|---|---|---|
| 世界视觉数据字典 | 已实现 | `scripts/check-world-visual-data-dictionary.mjs` |
| 当前世界视觉任务包 | 已实现 | `scripts/build-current-world-visual-generation-task-package.mjs` |
| 当前视觉事实清单 | 已实现 | `scripts/build-current-world-visual-fact-manifest.mjs` |
| 完整世界视觉推理 | 未实现 | 必须由后续正式执行器提供，不得以空壳命令代替 |
| 审核失败学习消费端 | 已实现 | `scripts/consume-game-map-visual-learning-feedback.mjs`；产物进入下一份世界视觉任务包 |

任务包自动保存目录：`.runtime/ai-painter/world-visual-generation-task-packages/`。

## 9. 正式训练进入条件

禁止继续 V52、V152 或其他版本号式旧数据集盲训。任何下一轮正式世界地图训练必须同时满足：

| 条件 | 检查命令 |
|---|---|
| 字典合同通过 | `npm run check:world-visual-data-dictionary` |
| 页面锁定通过 | `npm run check:ai-painter-generated-results-page-lock` |
| 训练数据持久化通过 | `npm run check:ai-painter-training-data-persistence` |
| 文档规则通过 | `npm run check:documentation-policy` |
| 模型训练架构对齐通过 | `npm run check:ai-painter-model-training-alignment` |
| 数据严格审计满足当前门槛 | `npm run audit:complete-map-data-sufficiency` |
| VisualFactManifest 与任务包绑定当前世界 | `npm run build:current-world-visual-task-package` |
| 视觉条件编译器和完整视觉推理已有行为证据 | 不能由空壳命令或旧图替代 |

## 10. 结论

数据字典已经具备第一版训练接入基础。AI 模型架构和训练架构必须从“局部材料能出图”升级为“字典驱动的完整地图候选链路”：

```txt
World facts
-> World Visual Data Dictionary
-> VisualFactManifest
-> Visual Director Output
-> Generation Task Package
-> Local AI Painter Model
-> Fresh Complete-Map Inference
-> Runtime Structure Binding / Compositor
-> MaterialQuality + FormalVisualJudge
-> Owner Review
-> Automatic Persistent Training Memory
```

没有完成这条链路，不能说第一版世界地图训练闭环完成。

## 2026-07-10 10:35:00 +08:00 P0 alignment lock

This section is the machine-readable alignment lock for the complete game-world generation route.
It exists because the project check script must prove that the local model training architecture
is aligned with the world visual data dictionary before any run can be called a formal complete-map run.

Canonical entrypoint:

```text
npm run run:complete-game-world
```

The following older commands are subordinate implementation steps only. They are not the complete
game-world generation entrypoint by themselves:

```text
npm run run:game-map-material-slot-inference
npm run full:game-map-material-slot-v46-runtime-frame
npm run run:game-map-material-slot-next-repair-plan
```

Required Generation Task Package fields:

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

Required Visual Director Output fields:

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

Formal complete-world pipeline:

```text
World facts
-> World Visual Data Dictionary
-> Visual Director Output
-> Generation Task Package
-> Local AI Painter Model
-> Runtime Compositor
-> MaterialQuality + FormalVisualJudge
-> Owner Review
-> Automatic Persistent Training Memory
```

Hard rule:

```text
The program must not report final success while complete-map data is insufficient,
FormalVisualJudge fails, owner review is pending, or owner review has rejected the RuntimeFrame.
```
