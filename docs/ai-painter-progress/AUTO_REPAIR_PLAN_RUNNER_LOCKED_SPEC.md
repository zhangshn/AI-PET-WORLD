# AI Painter 自动修复计划执行器锁定规范

更新时间：2026-07-10 19:50:04 +08:00

状态：active-auto-repair-runner-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 固定目标

完整世界地图训练进入下一轮材料修复时，必须由本地程序读取 repair plan 并自动执行。Codex 不能把逐条手工命令执行结果冒充为程序自动训练闭环。

## 2. 固定输入

```txt
.runtime/ai-painter/game-map-material-slot-next-repair-plan/latest.json
```

该文件由程序生成，必须包含 `recommendedCommands`、`runId`、`sourceArchiveRunId`、`targetSlots`、`targetCategories` 和 acceptance gate。

## 3. 固定执行入口

```txt
npm run run:game-map-material-slot-next-repair-plan
```

该入口只能执行 package.json 中已登记，并且在执行器白名单中的训练、推理、审核、合成、归档检查命令。

## 4. 固定输出

```txt
.runtime/ai-painter/game-map-material-slot-next-repair-plan-runs/<runId>/run-report.json
.runtime/ai-painter/game-map-material-slot-next-repair-plan-runs/latest.json
```

`run-report.json` 只记录自动执行过程，字段必须包含：

| 字段 | 固定含义 |
|---|---|
| `schemaVersion` | `game-map-material-slot-next-repair-plan-run-v1` |
| `runId` | 自动执行器运行 ID |
| `sourcePlanRunId` | 来源 repair plan 的 runId |
| `sourcePlanPath` | 来源 repair plan 路径 |
| `createdByProgram` | 必须为 `true` |
| `manualEdited` | 必须为 `false` |
| `codexGenerated` | 必须为 `false` |
| `startedAt` | 程序启动时间 |
| `finishedAt` | 程序结束时间 |
| `status` | running / success / failed |
| `commands` | 每条自动执行命令的开始时间、结束时间、退出码和状态 |

## 5. 训练数据归属

训练图、候选图、失败图、模型权重、审核报告、Runtime 合成图和归档报告，仍必须由本地小模型训练流水线自动写入各自固定目录。自动执行器不能复制、移动、重命名或伪造这些数据。

## 6. 固定校验入口

```txt
npm run check:ai-painter-admin-backend-automation
```

该校验必须确认：

| 检查项 | 通过标准 |
|---|---|
| 文档锁定 | 后台、控制台、训练数据持久化和自动执行器文档都存在 |
| package 脚本 | 自动计划、自动执行、自动检查入口都存在 |
| runtime 证据 | 最新训练归档和最新 repair plan 都存在 |
| 执行器归属 | `createdByProgram=true`、`manualEdited=false`、`codexGenerated=false` |
| 命令安全 | 执行器使用白名单，不接受任意 shell 命令 |
| 图片展示 | 当前训练页通过只读 API 展示自动保存图片 |

## 7. 非训练校验模式

执行器允许使用以下命令只检查最新 repair plan 和命令白名单：

```txt
node scripts/run-game-map-material-slot-next-repair-plan.mjs --dry-run
```

`--dry-run` 不启动训练、不写训练运行报告、不写训练图、不写审核结论，只用于确认下一轮自动执行链路可以被程序安全读取。

## 8. 失败自动保留规则

如果自动执行器在训练、推理、审核、合成或归档检查任一步失败，必须把失败状态写入当前 run-report，并自动触发失败保留步骤：

```txt
node scripts/run-current-game-map-material-slot-v46-runtime-pipeline.mjs --archive-existing
```

失败保留步骤必须记录在 run-report 的 `failureRetention` 字段中。该字段只能表示失败数据已经尝试保留，不能把失败流程改写为成功流程，不能让未通过 MaterialQuality / VisualJudge / FormalVisualJudge / 项目所有者人工验收的画面进入 `/world`。
