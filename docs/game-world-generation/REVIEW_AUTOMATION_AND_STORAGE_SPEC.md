# 审核、自动闭环与存储正式规格

更新时间：2026-07-11 12:32:00 +08:00

状态：active-architecture / 自动保存与控制台边界已锁定 / 专业审美模型未闭合

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 审核链

```text
Fresh Candidate
-> VJ-0 Source and Identity
-> VJ-1 Pixel Quality
-> VJ-2 Structure and Semantics
-> Professional Aesthetic Gate
-> Owner Final Review
-> RuntimeFrame Entry Gate
```

| 闸门 | 职责 |
|---|---|
| VJ-0 | 验证当前任务包、worldId、tick、字典、模型、checkpoint、seed、图片 hash 和非复用声明 |
| VJ-1 | 阻断破图、模糊、噪声、网格、重复、色彩崩坏和分辨率不足 |
| VJ-2 | 验证道路、水体、岸线、对象和完整地图语义与世界事实一致 |
| Professional Aesthetic | 判断构图、层次、过渡、对象接地、统一光照、材质语言和正式游戏感 |
| Owner Final Review | 项目所有者最终批准或拒绝；机器通过不能替代 |
| RuntimeFrame Entry | 只允许同一图片身份下最新 owner-approved 完整 RuntimeFrame 进入 `/world` |

## 2. 审核记录

每次审核必须自动保存中英文标题和说明、审核器版本、输入图片 hash、各维度分数、失败码、受影响区域、证据路径、状态、时间戳和下一修复目标。

owner review 固定状态：`pending_review`、`owner_approved`、`owner_rejected`。人工拒绝必须覆盖同一图片此前机器通过结论；后续新图片不继承旧图片的拒绝。

## 3. 失败回写

失败记录必须转换为：

```text
failure family
affected region
negative sample label
judge-gap record（机器漏判时）
dictionary fix target（规则缺失时）
dataset target
model capability target
next task constraint
```

拒绝图不得进入正样本。只有具备图片证据、失败码、受影响区域和下一训练目标的失败记录才算可学习经验。

## 4. 自主循环

程序未来可以自动执行：读取证据、诊断失败、选择已授权任务、构建数据、训练、推理、机器审核、保存结果和生成下一轮计划。

程序必须停止等待项目所有者的情况：

1. 需要 owner final review。
2. 需要改变数据来源政策、字典标准、模型路线、审核门槛或页面结构。
3. 数据不足、来源不明、身份冲突或无法形成合法下一任务。
4. 连续失败达到正式停止条件。

## 5. 实时状态

实时状态必须来自训练控制器、真实子进程 PID、步骤状态和定时刷新记录，不得根据 GPU 占用率猜测，也不得读取旧 running 文件冒充运行。

跨进程运行锁保证同一时间只有一个正式训练动作。运行期间定时刷新状态；完成、失败或取消后必须清理定时器和锁。

状态至少区分：`idle`、`dataset_building`、`training`、`inference`、`reviewing`、`archiving`、`blocked`、`failed`、`completed_waiting_owner_review`。

## 6. 控制台边界

控制台是只读观察与明确命令入口，不是训练记录的创造者。GET 页面不得修改台账、更新时间或历史快照。

主页只保留状态和功能入口；训练记录、候选审核、自动日志、数据字典、生成归档和目录分别进入对应页面。页面命名、结构和样式继续受 `docs/ai-painter-progress/` 锁定规格约束。

## 7. 自动存储

| 数据 | 当前正式位置 |
|---|---|
| 训练总账 | `.runtime/ai-painter/training-process-ledger/` |
| 运行控制与实时状态 | `.runtime/ai-painter/training-control/` |
| 训练档案 | `.runtime/ai-painter/training-run-archive/` |
| VisualFactManifest | `.runtime/ai-painter/world-visual-fact-manifests/` |
| 完整视觉任务包 | `.runtime/ai-painter/world-visual-generation-task-packages/` |
| 推理候选 | 后续正式 `complete-world-visual-inference/` |
| Runtime 合成 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame | `.runtime/game-map-runtime-frame/` |
| 失败学习 | `.runtime/ai-painter/auto-visual-judge-learning/` |

所有目录使用不可变 runId 和历史记录；`latest.json` 只作为索引，不是唯一证据。

