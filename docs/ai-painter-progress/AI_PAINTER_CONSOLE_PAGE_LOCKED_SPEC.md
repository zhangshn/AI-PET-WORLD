# AI Painter 训练控制台页面锁定规格

更新时间：2026-08-24 09:48:00 +08:00

状态：active-ai-painter-console-page-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 页面身份

| 项目 | 固定内容 |
|---|---|
| 页面性质 | AI Painter 训练控制台 |
| 主页面 URL | `/ai-painter-progress` |
| 完整地图训练内容与历史 URL | `/ai-painter-progress/natural-home` |
| 当前运行实时监控 URL | `/ai-painter-progress/current-training` |
| 页面职责 | 读取并展示本地小模型程序已经自动保存的训练、推理、审核、失败、成功和归档数据 |
| 页面禁止职责 | 不负责训练、不负责推理、不负责手工归档、不负责手工补存储、不负责替程序制造记录 |

## 1.1 页面固定运行规则

`/ai-painter-progress/natural-home` 是完整世界地图训练内容与历史记录入口，必须按时间读取程序自动保存的训练、推理、审核和归档记录。`/ai-painter-progress/current-training`是当前运行的实时只读监控台，只投影当前或最近一次运行的进度、资源、心跳和终态。两者不得互相冒充“当前训练入口”。

页面顶部必须提供按时间搜索训练内容的下拉框。下拉框中的每一项必须保留程序自动保存的原始目录名、原始版本名、记录类型、状态和修改时间。

页面只能展开当前选中的一条训练记录的图片、报告和证据文件。全部历史记录必须出现在时间下拉框和自动保存记录列表里，但页面不得在首次打开时一次性扫描和渲染全部历史图片，避免控制台卡死。

`/ai-painter-progress/original-images/complete-maps` 固定只显示四个类型入口：自主生成训练原图、冷启动基础完整地图原图、条件配对历史原图、失败与阻断记录。每个类型在 `/ai-painter-progress/original-images/complete-maps/types/<typeId>` 使用独立查看下拉框并按程序时间戳排序；选择后只展示对应的一条记录，不得把不同类型重新混在一个下拉框。已经生成图片但审核失败的记录必须在“失败与阻断记录”展示真实失败图；生成图片之前失败的记录必须在同一类型显示“未生成图片”、失败码、路线、UTC、北京时间和不可变证据路径，不得伪造占位地图。页面同时只读原图库索引与 `.runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/*/generation-attempts/*.json`，不得手工补记录。

页面只读以下自动保存目录，不写入、不复制、不移动、不重命名、不手工归档：

| 数据类型 | 固定读取目录 |
|---|---|
| 完整训练运行档案 | `.runtime/ai-painter/training-run-archive/` |
| 材料槽推理运行 | `.runtime/game-map-material-slot-inference-runs/world-d0znz8/0/` |
| 自动修复执行记录 | `.runtime/ai-painter/game-map-material-slot-next-repair-plan-runs/` |
| foundation 完整地图推理 | `.runtime/ai-painter/complete-world-visual-bootstrap-inference/` |
| foundation 机器审核 | `.runtime/ai-painter/complete-world-visual-machine-reviews/` |
| foundation 自动候选批次 | `.runtime/ai-painter/complete-world-visual-foundation-batches/` |
| 当前完整地图任务包 | `.runtime/ai-painter/world-visual-generation-task-packages/` |
| 当前完整地图数据包 | `data/world-samples/dataset-packages/` |
| AI辅助冷启动完整地图数据包 | `data/world-samples/ai-assisted-cold-start-dataset-packages/` |
| 当前正式样本登记 | `data/world-samples/registry/<dictionaryVersion>/records/` |

控制台页面如果看不到训练图，优先检查程序是否已经把图片写入上述目录；不得用聊天截图、手工复制图片或临时文件替代程序自动保存结果。

## 2. 控制台总树

```txt
/ai-painter-progress
AI Painter 训练控制台
├─ A. 顶部状态区
│  ├─ 当前运行状态
│  ├─ RuntimeFrame 状态
│  ├─ 自动日志统计
│  └─ GPU / 显存状态
│
├─ B. 固定入口区
│  ├─ B1. 完整世界地图训练
│  │  └─ /ai-painter-progress/natural-home
│  ├─ B2. 训练候选图审核
│  │  └─ /ai-painter-progress/trial-reviews
│  ├─ B3. 自动训练日志
│  │  └─ /ai-painter-progress/training-ledger
│  ├─ B4. 世界视觉数据字典
│  │  └─ /ai-painter-progress/world-visual-dictionary
│  ├─ B5. 生成结果归档
│  │  └─ /ai-painter-progress/generated-results
│  ├─ B6. 训练目录
│  │  └─ /ai-painter-progress/training-directory
│  └─ B7. 原图资料库
│     └─ /ai-painter-progress/original-images
│
└─ C. 记录归属说明
   ├─ 日志必须由本地小模型训练程序自动写入
   ├─ 图片必须由本地小模型训练程序自动写入
   ├─ 成功/失败/阻断必须由程序记录
   └─ 聊天进度表只用于汇报，不替代项目数据
```

## 3. 完整地图训练内容与历史入口树

```txt
/ai-painter-progress/natural-home
完整世界地图训练
├─ A. 返回训练主页
│
├─ B. 页面标题区
│  ├─ 标题：完整世界地图训练
│  ├─ 当前训练范围说明
│  └─ 基础指标
│     ├─ 原始样本
│     ├─ 清洁样本
│     ├─ 隔离样本
│     └─ 训练 / 验证
│
├─ C. 现阶段自动保存训练数据
│  ├─ C1. 自动保存目录统计
│  │  ├─ 自动保存目录数量
│  │  ├─ 当前最新目录
│  │  ├─ 最新类型
│  │  └─ 最后更新时间
│  ├─ C2. 训练图预览区
│  │  ├─ 完整地图合成图
│  │  ├─ contact-sheet 候选总览图
│  │  ├─ generated 推理图
│  │  ├─ target 对照图
│  │  └─ 材料槽输出图
│  ├─ C3. 最新训练数据列表
│  │  ├─ 目录原名
│  │  ├─ 类型
│  │  ├─ 自动保存路径
│  │  ├─ 证据文件
│  │  └─ 预览图数量
│  ├─ C4. 查看全部生成结果归档
│  └─ C5. 查看自动训练日志
│
├─ D. 所选训练记录状态
│  ├─ 原始训练集
│  ├─ 图像质量闸门
│  ├─ 清洁训练集
│  └─ 正式世界展示状态
│
├─ E. 训练图片 / 推理结果区
│  ├─ 原始样本总览
│  ├─ 清洁样本总览
│  ├─ Tiny U-Net 推理图
│  ├─ 结构引导推理图
│  ├─ RGB Refiner 推理图
│  ├─ 清洁结构引导推理图
│  ├─ 清洁 RGB Refiner 推理图
│  ├─ RGB Refiner v2 推理图
│  ├─ 单样本 Direct Output 推理图
│  ├─ 清洁集 Direct Output 多样本推理图
│  ├─ 14 通道结构预览
│  └─ 清洁集 14 通道结构预览
│
├─ F. 本地模型训练结果
│  ├─ 基础 Tiny U-Net
│  ├─ 结构引导模型
│  ├─ RGB Refiner
│  ├─ RGB 诊断
│  ├─ 清洁结构引导模型
│  ├─ 清洁 RGB Refiner
│  ├─ 清洁 RGB 诊断
│  └─ 修复建议
│
├─ G. 质量阻断原因
│  ├─ 阻断统计
│  ├─ 禁用内容通道
│  ├─ 通道冲突
│  └─ 门禁说明
│
└─ H. 被隔离样本
   ├─ 样本 ID
   ├─ 失败/警告原因
   ├─ 图像质量指标
   └─ 主要冲突数据
```

## 4. 固定功能列表

| 编号 | 功能 | 固定入口 | 数据来源 | 是否允许页面写入 |
|---|---|---|---|---|
| F00 | 查看当前运行实时状态 | `/ai-painter-progress/current-training` | `/api/ai-painter/current-training` | 否 |
| F01 | 查看当前训练状态 | `/ai-painter-progress` | `/api/ai-painter/training-progress` | 否 |
| F02 | 查看完整世界地图训练 | `/ai-painter-progress/natural-home` | `.runtime/ai-painter/`、`.runtime/game-map-*` | 否 |
| F03 | 查看训练图预览 | `/ai-painter-progress/natural-home` | 程序自动保存的 PNG/JPG/WebP | 否 |
| F04 | 查看训练候选图审核 | `/ai-painter-progress/trial-reviews` | 程序自动保存的 review/trial 数据 | 否 |
| F05 | 查看自动训练日志 | `/ai-painter-progress/training-ledger` | `.runtime/ai-painter/training-process-ledger/` | 否 |
| F06 | 查看世界视觉数据字典 | `/ai-painter-progress/world-visual-dictionary` | 项目数据字典文件 | 否 |
| F07 | 查看生成结果归档 | `/ai-painter-progress/generated-results` | `.runtime/ai-painter/generated-results/` 和自动保存目录 | 否 |
| F08 | 查看训练目录 | `/ai-painter-progress/training-directory` | 固定训练入口清单 | 否 |
| F09 | 查看 RuntimeFrame 状态 | 控制台状态区 | 程序写入的 RuntimeFrame 状态 | 否 |
| F10 | 查看 GPU / 显存 | 控制台状态区 | 本地运行状态接口 | 否 |
| F11 | 查看第一版家园原图 | `/ai-painter-progress/original-images` | `data/world-samples/original-image-library/natural-home-v1/` | 否 |

## 5. 训练图预览固定规则

| 优先级 | 图片类型 | 说明 |
|---:|---|---|
| 1 | `composite-output.png` | 完整地图合成候选图，优先显示 |
| 2 | `contact-sheet.png` | 候选图 / 审核总览图 |
| 3 | `generated.png` | 本地小模型生成图 |
| 4 | `target.png` | 对照目标图 |
| 5 | `slot-terrain-*` | 地形、道路、水体、水岸等材料槽图 |
| 6 | `slot-object-*` | 树、石头、花草、灌木等物体槽图 |

训练图只能从程序已经保存的文件读取。页面不复制、不移动、不重命名、不生成新图。

## 6. 固定自动读取目录

| 数据范围 | 固定读取目录 |
|---|---|
| AI Painter 训练、生成、审核、模型目录 | `.runtime/ai-painter/` |
| 材料槽推理运行 | `.runtime/game-map-material-slot-inference-runs/` |
| 完整地图 Runtime 合成输出 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame 工作记录 | `.runtime/game-map-runtime-frame-working/` |
| RuntimeFrame 候选记录 | `.runtime/game-map-runtime-frame-candidates/` |
| RuntimeFrame 正式记录 | `.runtime/game-map-runtime-frame/` |
| RuntimeFrame 拒绝记录 | `.runtime/game-map-rejected-runtime-frames/` |
| 训练过程总账 | `.runtime/ai-painter/training-process-ledger/` |
| 训练运行档案 | `.runtime/ai-painter/training-run-archive/` |
| 生成结果索引 | `.runtime/ai-painter/generated-results/` |

页面必须按`working -> candidates -> accepted frame / rejected frames`解释RuntimeFrame状态；工作记录和候选记录不得显示为已经进入`/world`。

## 7. 禁止事项

| 禁止项 | 说明 |
|---|---|
| 禁止把聊天记录当项目数据 | 聊天只汇报，不存储训练结果 |
| 禁止由 Codex 手工补存储 | 存储必须由本地小模型程序自动完成 |
| 禁止改版本名 | `v51` 就显示 `v51`，不能换名 |
| 禁止隐藏失败图 | 失败图也是训练数据，必须可追溯 |
| 禁止把候选图当 ApprovedFrame | 未通过审核不能进入 `/world` |
| 禁止随意改页面样式 | 没有项目所有者命令，不改布局、颜色、卡片风格 |
| 禁止随意新增入口 | 新入口必须先说明原因并获得命令 |
| 禁止随意删除旧入口 | 旧训练数据必须可查 |

## 8. 当前自动化边界

从现在开始，训练数据、原图、训练图、推理图、失败图、候选图、审核图、RuntimeFrame 候选和 ApprovedFrame 结果，都必须由对应本地程序自动保存并进入控制台可读索引。控制台页面只负责读取和展示这些已保存数据；Codex 不得手工复制图片或补写索引代替程序。

每个图像生产或接收程序必须在图片与 manifest/record 原子落盘成功后更新所属索引或台账。控制台监听轻量索引事件并自动刷新；分类列表必须展示所有记录的缩略图和身份，详情页展示完整图片及全部证据。未经索引的临时图片不得在控制台伪装成正式记录。

如果页面看不到数据，先判断：

1. 程序是否已经保存。
2. 文件是否在固定目录。
3. 页面读取范围是否覆盖。
4. 是否需要新增读取范围。
5. 如需调整读取范围，必须形成版本化页面合同变更、影响报告和回归证据；Codex实施时仍须位于Owner当前任务范围内。

## 9. 当前闭环标准

```txt
本地小模型程序运行
-> 自动保存训练/推理/审核/失败/成功数据
-> 控制台页面读取固定目录
-> 控制台页面展示状态、目录、图、日志、审核
-> 机器审核通过
-> 能力版本机器发布门 / Runtime机器发布门
-> ApprovedFrame 才能进入 /world
```

## 10. 只读与实时状态固定规则

1. 所有控制台 GET 页面必须无业务副作用，不得因为刷新、预加载、监控或外部访问而改写台账。
2. 流水线台账只能由训练、推理、审核、失败回写、归档或晋级程序事件写入。
3. 状态轮询必须等待上一轮完成后再安排下一轮，禁止异步 `setInterval` 重入。
4. 重型完整状态快照必须使用共享短时缓存；实时状态流只发送页面需要的摘要或增量。
5. SSE 断开后必须取消后续请求；前端降级轮询同样必须非重入。
6. 生产构建不得追踪或打包 `.runtime` 训练产物。
7. 完整地图原图的正式审核由本地程序自动执行。页面可以提供“标记疑点 / 紧急拒绝 / 解除紧急拒绝”人工覆盖入口，但它不是每张图必须经过的批准按钮；POST只提交覆盖意图，正式程序负责验证身份、保存理由、生成新审核记录并原子更新索引，页面不得直接代写业务状态。
8. 人工覆盖按钮不能直接启动或停止图片生成、下一槽位准备、GPU训练、推理、Runtime晋级或`/world`发布；正常状态转换由本地自主状态机和机器证据决定，紧急停止使用独立安全控制入口。
