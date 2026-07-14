# 审核、自动闭环与存储正式规格

更新时间：2026-07-14 18:56:00 +08:00

状态：active-architecture / 自动保存与控制台边界已锁定 / 本地语义初审已接入 / 专业审美模型仍未闭合

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
| VJ-1 | 阻断破图、错误像素网格、抗锯齿、平滑缩放、噪声、重复 stamp、色彩崩坏、像素密度不一致和原生分辨率错误 |
| VJ-2 | 验证道路、水体、岸线、对象和完整地图语义与世界事实一致 |
| Professional Aesthetic | 判断构图、层次、过渡、对象接地、统一光照、材质语言和正式游戏感 |
| Owner Final Review | 项目所有者最终批准或拒绝；机器通过不能替代 |
| RuntimeFrame Entry | 只允许同一图片身份下最新 owner-approved 完整 RuntimeFrame 进入 `/world` |

### 1.1 第一版像素视觉硬门禁

| 检查项 | 固定要求 |
|---|---|
| 原生画布 | `1024×768`，必须由模型直接生成一张完整高分辨率像素风地图，而不是局部 crop、材料槽或低分辨率放大图 |
| 展示规则 | 原生文件是唯一质量基准；响应式显示不得改变事实，审核器必须读取原生像素数据 |
| 风格门禁 | 必须统一视角、尺度、对象比例、像素纹理、轮廓、光照、接地和遮挡；普通插画套像素滤镜不得通过 |
| 像素网格 | 所有边缘、阴影、纹理和对象细节必须落在统一逻辑像素网格上 |
| 像素密度 | 草地、道路、水岸、树木、石头和花草使用一致的像素尺度与观察角度 |
| 色板 | 有限、协调且具有地形可读性；不得退化为均匀绿色噪声或过量抖色 |
| 重复控制 | 阻断明显 tile 接缝、棋盘格、连续重复图案、复制树和机械 stamp |
| 完整地图专业性 | 像素风不能降低入口、中心、道路、水岸、可走性、构图、接地和 owner 终审标准 |

完整地图冷启动原图的水体可见信号必须按区域类型解释，不得用同一个面积门槛迫使窄山溪变成宽河。`tropical-mountain-stream` 的最低水体可见信号固定为 `0.02`；其他声明必须出现淡水的当前区域类型继续使用 `0.03`。该像素比例只负责阻断“要求有水但画面几乎无水”的记录，不证明溪流连通、水岸正确或水文事实成立；连续性、结构语义和项目所有者审核仍必须分别通过。

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

机器拒绝图由 `register:current-bootstrap-machine-negative` 自动登记为 `machine_negative`；它不要求也不得伪造 owner rejection。登记后程序必须重新运行数据审计和不可变数据包构建，使控制台看到真实最新计数。

完整地图机器审核记录必须直接进入自动失败学习器；生成下一任务约束时，`complete_map_machine_review` 必须优先于历史局部材料失败记录。跨 run 图片 hash 完全相同时必须记录候选不新颖失败，不能把重复推理计为新数据。

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
| 第一版家园原图库 | `data/world-samples/original-image-library/natural-home-v1/` |
| 正式样本登记 | `data/world-samples/registry/<dictionaryVersion>/` |
| 不可变完整地图数据包 | `data/world-samples/dataset-packages/<packageId>/` |
| VisualFactManifest | `.runtime/ai-painter/world-visual-fact-manifests/` |
| 完整视觉任务包 | `.runtime/ai-painter/world-visual-generation-task-packages/` |
| 编译后模型条件 | `.runtime/ai-painter/world-visual-generation-task-packages/<taskId>/compiled-conditions/` |
| bootstrap 推理候选 | `.runtime/ai-painter/complete-world-visual-bootstrap-inference/` |
| foundation 自动候选批次 | `.runtime/ai-painter/complete-world-visual-foundation-batches/` |
| bootstrap 机器审核 | `.runtime/ai-painter/complete-world-visual-machine-reviews/` |
| AI 冷启动原图机器审核历史 | `data/world-samples/original-image-library/natural-home-v1/<category>/<record>/reviews/machine/`；`machine-review.json` 仅为最新指针 |
| 正式推理候选 | 后续正式 `.runtime/ai-painter/complete-world-visual-inference/` |
| Runtime 合成 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame | `.runtime/game-map-runtime-frame/` |
| 失败学习 | `.runtime/ai-painter/auto-visual-judge-learning/` |

所有目录使用不可变 runId 和历史记录；`latest.json` 只作为索引，不是唯一证据。

## 8. 本地视觉语义初审

本地 CLIP 初审固定为机器辅助门禁，不是最终审美裁判。程序必须保存模型来源、revision、许可证、模型清单 hash、全部正负标签、每项概率、阈值、失败项和图片 hash。CLIP 通过不得单独触发正样本登记、RuntimeFrame 晋级或 `/world` 展示。

当前 CLIP 检查完整地图身份、自然对象语义、平坦道路语义、可游玩地图可读性和渲染一致性。实测证明它可能放过仍显粗糙的地图，因此必须与 VJ-1、VJ-2、空间越界检查和项目所有者终审并行。

水体越界检查只统计 `terrain_water` Mask 之外的水体视觉。`terrain_grass` 是全画布基础层，不能把合法水域区域重复计入草地泄漏；修正前的历史报告保留为审计证据，不覆盖旧记录。

`npm run run:current-world-foundation-candidate-batch` 由程序自动执行多 seed 生成、机器审核、机器负样本登记和严格数据审计。批次达到尝试上限后必须保持失败状态；只有机器全部通过时才能停止在 `machine_passed_waiting_owner_review`。
