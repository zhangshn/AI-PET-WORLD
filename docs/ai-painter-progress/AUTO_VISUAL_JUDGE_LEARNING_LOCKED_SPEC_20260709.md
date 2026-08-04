# 自动视觉判断学习锁定规范

更新时间：2026-08-02 15:41:57 +08:00

状态：active-auto-visual-judge-learning-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 目标

自动视觉判断不能只依靠 Codex 在聊天里解释。

程序必须从已经落盘的训练、推理、质量评审、人工审核和漏判诊断证据中学习，生成可追溯的自动判断记忆，并在后续训练和审核中持续使用。

## 2. 第一阶段学习方式

当前阶段采用证据驱动程序学习，不宣称已经完成神经网络美术评审模型训练。

程序学习来源：

| 来源 | 文件 |
| --- | --- |
| 训练总账 | `.runtime/ai-painter/training-process-ledger/events.jsonl` |
| 材料质量报告 | `material-quality-report.json` |
| 完整地图机器评审 | `*-formal-visual-judge.json` |
| 项目所有者审核 | `owner-review.json` |
| 机器漏判诊断 | `review-diagnosis.json` |

## 3. 自动输出

程序必须写入：

| 输出 | 用途 |
| --- | --- |
| `.runtime/ai-painter/auto-visual-judge-learning/latest.json` | 当前最新自动判断学习记忆 |
| `.runtime/ai-painter/auto-visual-judge-learning/history/<runId>/auto-visual-judge-learning.json` | 每次学习快照 |

输出必须包含：

1. `createdByProgram: true`
2. `manualEdited: false`
3. `codexGenerated: false`
4. `evidenceSummary`
5. `currentDecision`
6. `learnedFailurePatterns`
7. `nextAutonomousJudgeInputs`
8. `evidenceRecords`

## 4. 学习内容

程序必须学习以下内容：

1. 材料质量失败码出现次数。
2. FormalVisualJudge 失败码出现次数。
3. 人工审核拒绝原因。
4. 机器漏判根因。
5. 必需修复项。
6. 每个失败模式影响的地图区域，例如 grass、road、water、shoreline、whole_frame。
7. 每个失败模式是否必须阻断 `/world`。
8. 每个失败模式是否要求升级自动评审闸门。

## 5. 当前自动判断原则

只要存在材料质量失败、FormalVisualJudge 失败、人工审核拒绝或已学习的世界阻断失败模式，`currentDecision.status` 必须是 `blocked`。

`canEnterWorld` 默认必须是 `false`。

程序只能把通过全部机器闸门且获得项目所有者人工终审通过的 RuntimeFrame 标记为最终游戏地图成功。

## 6. 自动触发

以下程序事件写入后，必须刷新自动视觉判断学习记忆：

1. 修复训练控制器写入训练总账。
2. RuntimeFrame 合成写入训练总账。
3. 项目所有者拒绝写入训练总账。
4. 机器漏判诊断写入训练总账。

也可以手动运行：

```bash
npm run learn:game-map-auto-visual-judge
```

检查入口：

```bash
npm run check:game-map-auto-visual-judge-learning
```

## 7. 边界

这一步是让程序开始自动学习判断依据，不是最终 AI 美术审查模型完成。

后续如果需要升级为小模型视觉分类器，必须继续使用这里的 `learnedFailurePatterns`、负样本、人工拒绝记录和 FormalVisualJudge 漏判诊断作为训练输入。
