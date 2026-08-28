# AI Painter 后台管理自动化锁定规格

更新时间：2026-08-24 12:43:09 +08:00

状态：active-ai-painter-admin-backend-contract

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 后台身份

| 项目 | 固定内容 |
|---|---|
| 后台名称 | AI Painter 训练后台管理 |
| 后台性质 | 本地小模型训练、推理、审核、存储、追溯的自动化管理后台 |
| 管理页面入口 | `/ai-painter-progress` |
| 完整地图训练内容与历史入口 | `/ai-painter-progress/natural-home` |
| 当前运行实时监控入口 | `/ai-painter-progress/current-training` |
| 数据写入者 | 本地小模型程序 |
| Codex 职责 | 规划、检查、修复读取展示、完善自动化脚本和校验，不替程序手工写训练数据 |
| 禁止事项 | 禁止 Codex 手工补成功记录、手工归档训练图、手工改版本名、手工伪造审核状态 |

## 2. 后台总架构

```txt
AI Painter 后台管理
├─ A. 训练控制台页面
│  ├─ 当前状态
│  ├─ 当前运行实时监控入口
│  ├─ 完整地图训练内容与历史入口
│  ├─ 训练图预览
│  ├─ 训练数据目录
│  ├─ 训练日志
│  ├─ 候选图审核
│  ├─ 生成结果归档
│  └─ 世界视觉数据字典
│
├─ B. 自动训练控制器
│  ├─ 创建训练任务
│  ├─ 读取数据字典
│  ├─ 读取导演输出
│  ├─ 生成任务包
│  ├─ 启动本地小模型训练
│  ├─ 启动本地小模型推理
│  ├─ 启动 Runtime 合成
│  └─ 启动机器审核
│
├─ C. 自动存储系统
│  ├─ 训练输入存储
│  ├─ 训练配置存储
│  ├─ 训练过程日志存储
│  ├─ 模型权重存储
│  ├─ 推理输入存储
│  ├─ 推理图片存储
│  ├─ RuntimeFrame 候选存储
│  ├─ 审核结果存储
│  ├─ 失败原因存储
│  └─ 人工复核记录存储
│
├─ D. 自动审核系统
│  ├─ MaterialQuality
│  ├─ VisualJudge
│  ├─ FormalVisualJudge
│  ├─ failure-codes
│  ├─ negative samples
│  └─ owner review required gate
│
├─ E. 数据追溯系统
│  ├─ runId
│  ├─ versionId
│  ├─ dictionaryVersionId
│  ├─ modelVersion
│  ├─ trainingVersion
│  ├─ sourceDataset
│  ├─ inputPackage
│  ├─ outputImages
│  ├─ reviewReports
│  └─ lineage
│
└─ F. ApprovedFrame 发布系统
   ├─ 机器审核通过
   ├─ 能力版本与Runtime发布门通过
   ├─ 写入 ApprovedFrame
   └─ `/world` 只读取 ApprovedFrame
```

### 2.1 训练阶段自动闭环

一个已启动训练阶段不得在训练进程结束时停留在“训练完成，等待验证”。同一执行包必须继续由本地程序完成固定预览复现、validation与Checkpoint身份验证、机器审核、失败隔离、Manifest、Finalization、唯一终态及本地治理记录。页面只投影这些机器记录，不触发人工操作，也不依赖Codex任务保持打开。

能力版本和执行计划必须在启动前列明完整阶段动作链；程序分别验证并一次性消费内部任务身份。新的模型、数据、审核实现或训练计划由本地能力生命周期建立隔离版本并自动展示；只有触及长期业务、外部许可、付费或不可恢复操作时，页面才显示政策边界报告，报告不产生Owner等待状态。

## 3. 后台固定功能列表

| 编号 | 功能 | 自动处理者 | 固定输出 | 页面职责 |
|---|---|---|---|---|
| B01 | 创建训练任务 | 程序 | task package / run manifest | 只展示 |
| B02 | 读取数据字典 | 程序 | dictionary contract snapshot | 只展示 |
| B03 | 读取导演计划 | 程序 | director output snapshot | 只展示 |
| B04 | 训练本地小模型 | 程序 | `training-summary.json`、`best.pt`、`training-log.jsonl` | 只展示 |
| B05 | 推理生成图片 | 程序 | PNG/JPG/WebP、`latest.json`、manifest | 只展示图片和路径 |
| B06 | Runtime 合成 | 程序 | `composite-output.png`、compositor audit | 只展示 |
| B07 | 材料质量审核 | 程序 | `material-quality-report.json` | 只展示 |
| B08 | VisualJudge 审核 | 程序 | `review-report.json` / `selection-report.json` | 只展示 |
| B09 | 失败样本记录 | 程序 | failure codes / negative labels | 只展示 |
| B10 | 训练总账记录 | 程序 | `events.jsonl`、`latest.json` | 只展示 |
| B11 | 生成结果归档 | 程序 | generated-results index / images / summaries | 只展示 |
| B12 | 能力版本与Runtime发布门 | 本地程序按完整机器证据自主执行 | capability release / runtime publish record | 页面展示状态 |
| B13 | ApprovedFrame 写入 | 本地程序 | approved frame record | `/world` 读取 |

## 4. 自动时间戳规则

所有后台自动写入的数据都必须带时间戳。时间戳必须由程序写入，不由 Codex 事后补写。

| 字段 | 含义 | 格式 |
|---|---|---|
| `createdAt` | 记录创建时间 | ISO 8601 |
| `startedAt` | 训练/推理/审核开始时间 | ISO 8601 |
| `finishedAt` | 训练/推理/审核结束时间 | ISO 8601 或 null |
| `updatedAt` | 最近更新时间 | ISO 8601 |
| `savedAt` | 图片、报告、归档写入时间 | ISO 8601 |
| `reviewedAt` | 机器审核完成时间 | ISO 8601 |
| `capabilityReleaseAdjudicatedAt` | 能力版本机器发布裁决时间 | ISO 8601 或 null |

## 5. 自动数据细节

每一轮训练/推理/审核必须自动保存以下细节。

| 类别 | 必须字段 |
|---|---|
| 身份 | `runId`、`stageId`、`versionId`、`worldId`、`tick` |
| 字典 | `dictionaryVersionId`、`dictionaryContract`、`failureCodeRegistryVersion` |
| 输入 | `sourceDatasetRoot`、`sampleIds`、`taskPackagePath`、`directorOutputPath` |
| 模型 | `modelVersion`、`trainingVersion`、`checkpointPath`、`initialCheckpointPath` |
| 配置 | `configPath`、`epochs`、`learningRate`、`lossWeights`、`seed` |
| 设备 | `deviceName`、`gpuMemoryTotal`、`gpuMemoryUsed`、`estimatedKwh` |
| 输出 | `outputRoot`、`imageFiles`、`manifestPath`、`summaryPath` |
| 指标 | `loss`、`bestLoss`、`score`、`edgeDensity`、`sharpness`、`colorRange` |
| 审核与发布 | `materialPassed`、`visualJudgePassed`、`formalJudgePassed`、`datasetReleaseIdentity`、`capabilityReleaseIdentity`；`legacyOwnerReviewStatus`仅兼容历史记录 |
| 失败 | `failureCodes`、`failedSlots`、`formalIssues`、`negativeSampleLabels` |
| 归属 | `createdByProgram`、`manualEdited`、`codexGenerated` |

固定要求：

```txt
createdByProgram = true
manualEdited = false
codexGenerated = false
```

如果某条记录是 Codex 临时生成的文档或说明，不能混入训练运行数据。

## 6. 图片自动保存规则

| 图片类型 | 固定保存内容 | 是否必须可在后台查看 |
|---|---|---|
| 训练样本图 | source / target / mask / structure preview | 是 |
| 推理生成图 | generated.png / contact-sheet.png | 是 |
| 材料槽图 | grass / path / water / shoreline / tree / rock / flower / shrub | 是 |
| Runtime 合成图 | composite-output.png | 是 |
| 审核图 | selected candidates / rejected candidates / comparison sheet | 是 |
| 失败图 | failed sample image / negative sample image | 是 |
| ApprovedFrame | approved image bytes / hash / frame record | 是 |

图片记录必须包含：

| 字段 | 含义 |
|---|---|
| `imagePath` | 项目相对路径 |
| `imageRole` | source / generated / contactSheet / materialSlot / composite / failed / approved |
| `width` | 图片宽度 |
| `height` | 图片高度 |
| `byteLength` | 文件大小 |
| `sha256` | 图片 hash |
| `savedAt` | 程序写入时间 |
| `sourceRunId` | 来源运行 |
| `reviewStatus` | pending / failed / candidate / approved |

## 7. 固定存储目录

| 数据 | 固定目录 |
|---|---|
| 训练过程总账 | `.runtime/ai-painter/training-process-ledger/` |
| 训练运行档案 | `.runtime/ai-painter/training-run-archive/` |
| AI Painter 训练/生成/审核 | `.runtime/ai-painter/` |
| 材料槽推理 | `.runtime/game-map-material-slot-inference-runs/` |
| Runtime 合成输出 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame 工作区 | `.runtime/game-map-runtime-frame-working/` |
| RuntimeFrame 候选 | `.runtime/game-map-runtime-frame-candidates/` |
| RuntimeFrame 正式记录 | `.runtime/game-map-runtime-frame/` |
| RuntimeFrame 拒绝记录 | `.runtime/game-map-rejected-runtime-frames/` |
| 生成结果索引 | `.runtime/ai-painter/generated-results/` |
| ApprovedFrame | `data/world-approved-frames/` |
| 世界运行索引 | `data/world-runtime/` |

后台必须保留`working -> candidates -> accepted frame / rejected frames`生命周期身份；任何自动索引和状态投影都不得把工作区或候选目录等同于正式RuntimeFrame。

## 8. 后台页面只读规则

后台页面只允许：

```txt
读取状态
读取目录
读取图片
读取日志
读取审核报告
读取失败原因
读取 ApprovedFrame 状态
```

后台页面不允许：

```txt
替程序保存训练数据
替程序创建成功记录
替程序移动图片
替程序重命名版本
替程序修改审核结论
替程序把失败图改成通过图
```

## 9. 自动闭环流程

```txt
数据字典
-> 导演输出
-> 任务包
-> 本地小模型训练
-> 本地小模型推理
-> 图片自动保存
-> 材料质量审核
-> Runtime 合成
-> FormalVisualJudge
-> 失败则自动记录失败原因和负样本
-> 通过则进入能力版本与Runtime发布门
-> 发布门通过后程序写入 ApprovedFrame
-> /world 只读取 ApprovedFrame
```

## 10. 后台验收标准

| 检查项 | 通过标准 |
|---|---|
| 时间戳 | 每条训练/推理/审核/图片/失败记录都有程序写入时间 |
| 图片 | 训练图、生成图、失败图、合成图、审核图都能在后台查到 |
| 失败记录 | 失败原因、失败码、失败图、失败目录可追溯 |
| 成功记录 | 成功必须来自程序审核记录，不来自聊天 |
| 版本名 | 页面原样显示目录名和版本号 |
| 自动化归属 | 记录中能区分程序自动写入、机器审核与项目级能力发布验收 |
| ApprovedFrame | 未经机器审核、能力版本和Runtime发布门确认不能进入 `/world` |
