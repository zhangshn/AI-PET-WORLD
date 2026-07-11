# 训练数据与来源正式规则

更新时间：2026-07-11 12:32:00 +08:00

状态：active-architecture / 当前数据缺口硬门禁 / 正式样本仍不足

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 数据原则

训练数据必须是可追溯、可复现、可审核的程序资产。文件数量、历史 JSON 数量、重复样本和缺少正式记录的图片不能计入数据充足度。

程序可以生成世界事实、Blueprint、Mask、距离图、对象实例图、可走层、碰撞层和调试预览；程序直绘图不能作为专业完整地图正样本，也不能进入 `/world`。

## 2. 允许的视觉来源

| 来源 | 默认处理 |
|---|---|
| 项目所有者制作或明确授权的图片 | 完成来源、许可、hash 和质量审核后可进入候选样本 |
| 项目本地模型生成且 owner approved 的完整地图 | 可作为最高优先级正样本 |
| 项目本地模型生成且 owner rejected 的图片 | 只能进入负样本或隔离区 |
| 外部图片或外部模型输出 | 默认禁止；只有项目所有者明确改变来源政策并完成许可审计后才能使用 |
| OpenAI 或其他在线生成图片 | 当前正式训练链禁止 |
| 程序规则渲染、占位图、结构预览 | 只能用于结构调试或条件验证，不是专业 RGB 目标 |
| 来源不明、许可不明、hash 不一致 | `blocked_source` |

## 3. 样本类型

```text
bootstrap_structure
material_training
transition_training
object_grounding_training
complete_map_training
owner_approved_positive
owner_rejected_negative
judge_gap_negative
blocked_source
```

`bootstrap_structure` 可以使用程序生成的结构条件，但不能因此获得专业视觉正样本资格。拒绝图不能作为正常 RGB target。

## 4. 单条样本合同

每张图片必须绑定：

```text
sampleId
worldId / tick（适用时）
dictionaryVersion
directorPlanId
taskPackageId
blueprintHash
conditionHashes
imagePath / imageSha256
sourceType / sourcePath / sourceLicense
modelVersion / checkpoint / seed（模型输出时）
ownerReviewStatus
machineReviewStatus
labels / failureCodes / affectedRegions
trainingUsage
createdAtUtc / createdAtAsiaShanghai
```

正式计数还必须满足：真实图片存在、hash 匹配、样本 ID 和图片 hash 唯一、标签完整、审核完成、绑定当前字典版本。

## 5. 数据包结构

```text
dataset-package/
├─ manifest.json
├─ source-index.json
├─ splits/
│  ├─ train.json
│  ├─ validation.json
│  ├─ challenge.json
│  └─ regression.json
├─ positive/complete-map/
├─ negative/complete-map/
├─ transition/
├─ object-grounding/
├─ blocked/
└─ reports/data-sufficiency-audit.json
```

数据包版本发布后不可覆盖。修复标签、替换图片或改变分组必须生成新版本并保留父版本引用。

## 6. 当前最低门槛

以下是当前 v0.3 已锁定门槛，不采用提案中的 1,000～10,000 张估算：

| 数据 | 最低要求 |
|---|---:|
| 完整地图正样本 | 20 |
| 完整地图负样本 | 40 |
| grass-path 正/负样本 | 40 / 40 |
| grass-water 正/负样本 | 40 / 40 |
| object-ground 正/负样本 | 30 / 30 |
| 机器漏判记录 | 20 |

当前严格审计结果全部为 0。门槛只能由项目所有者明确批准后调整，不能为了启动训练而降低。

## 7. 自动保存

训练、推理、审核和失败回写必须由程序自动保存。Codex 可以修复程序和检查证据，但不得手工伪造训练记录。

必须保存输入任务包、数据包版本、配置、模型版本、checkpoint、seed、设备、耗时、loss、生成图片、hash、机器审核、人工审核、失败区域和下一轮任务。

## 8. 数据库迁移边界

当前 `.runtime` 和 `data` 是正式文件来源。未来数据库保存结构化元数据、关系、状态和索引；大图片与 checkpoint 使用对象存储或文件存储，数据库保存 URI 与 hash。迁移不得改变样本身份和审核历史。

