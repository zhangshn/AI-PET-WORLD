# AI-PET-WORLD 技术架构

版本：v1.2
状态：当前正式架构基线
更新日期：2026-06-25

## 总体架构

```txt
用户 / 管家 / 世界 Runtime
-> 世界事实 World Facts
-> Scene Blueprint
-> Condition Mask
-> 本地 AI Painter 小模型
-> Candidate Frame
-> VisualJudge
-> ApprovedFrame / RuntimeFrame
-> /world
```

## 架构原则

| 原则 | 说明 |
|---|---|
| 事实优先 | 所有视觉输出必须来源于世界事实 |
| 模型只表达 | 小模型负责画面表达，不负责改事实 |
| 审核闸门 | 未通过 VisualJudge 不能进入 ApprovedFrame |
| 训练留档 | 每次训练、推理、失败、打回都要自动保存 |
| 页面分层 | 训练主页保持干净，详细结果进入训练后内容页 |
| 不接在线绘图 API | 当前正式链路不使用第三方在线绘图 API |

## 核心模块表

| 模块 | 位置 | 职责 |
|---|---|---|
| App Router 页面 | `src/app` | 页面入口、训练进度、世界展示 |
| 世界 Runtime | `src/world` | 世界事实、tick、管家行为、建设计划 |
| Visual Frame | `src/world/visual` | Candidate、Review、ApprovedFrame 相关结构 |
| AI Painter API | `src/app/api/ai-painter` | 本地训练/推理/结果展示 API |
| 服务端控制器 | `src/server` | 本地训练控制、进度读取、状态汇总 |
| 小模型训练代码 | `ml/ai-painter` | PyTorch 训练、推理、数据处理 |
| 检查脚本 | `scripts` | VJ、数据、ApprovedFrame、编码、构建检查 |
| 运行产物 | `.runtime/ai-painter` | 训练结果、候选图、失败图、报告 |
| 正式帧数据 | `data/world-approved-frames` | 通过审核后可被 `/world` 读取的帧 |
| 文档 | `docs` | 业务、计划、架构、目录、进度 |

## AI Painter 链路

```txt
训练数据 / target.png / mask / metadata
-> 数据清洗
-> 本地 PyTorch 训练
-> 生成候选图
-> 质量筛选
-> VJ-1 清晰度与结构审核
-> VJ-2 语义与风格审核
-> ApprovedFrame 候选绑定
-> 写入 ApprovedFrame
```

当前训练模型是本地自研小模型链路，使用项目中的 PyTorch 脚本和本地数据集训练。第三方在线绘图 API 不在正式链路中。

## AI Painter 训练架构分线

AI Painter 不是单一路径。为了服务“活着的游戏世界”，训练和展示必须分成三层。

### 1. 完整世界画面训练线

目标：让小模型学习完整自然家园画面的构图、层次、自然区域关系和整体像素质感。

```txt
World Facts
-> Scene Blueprint
-> 14 通道 Condition Mask
-> 完整自然家园训练样本
-> 本地小模型训练
-> 完整候选图
-> VisualJudge
-> ApprovedFrame 候选
```

职责：

| 项目 | 说明 |
|---|---|
| 学习对象 | 一整张自然家园画面 |
| 当前内容 | 草地、水体、水岸、自然小路、树、石、花草、空间深度 |
| 当前禁止 | 建筑、人物、动物、昆虫、动态状态、小镇城市 |
| 输出用途 | 只用于候选、审核、归档；通过后才可能成为完整 ApprovedFrame |
| 当前状态 | 当前主线 |

### 2. 局部视觉单元训练线

目标：让小模型学习可复用的局部视觉单元，用于未来 Runtime 动态组合。

```txt
VisualUnit Fact
-> Unit Blueprint
-> Unit Mask / State
-> 局部训练样本
-> 局部候选图 / 状态帧
-> Unit Judge
-> 可复用视觉资产
```

职责：

| 类型 | 未来内容 |
|---|---|
| 自然单元 | 草地块、水流、水岸、树、石、花草、天气光影 |
| 人物单元 | 管家、人物体型、朝向、动作、状态帧 |
| 建筑单元 | 地基、墙体、屋顶、门窗、室内结构、建造阶段 |
| 生态单元 | 动物、昆虫、生命周期状态 |
| 设施单元 | 道具、工具、材料、交互设施 |

局部视觉单元不是当前主线。它可以有页面入口和数据契约，但不能抢在自然家园完整训练达标前成为主任务。

### 3. Runtime 合成线

目标：后期游戏画面不是一张固定大图，而是由世界事实驱动的运行时画面。

```txt
World Runtime Tick
-> 当前世界事实
-> 地形层 / 物件层 / 动态层 / UI 通信层
-> RuntimeFrame
-> VisualJudge / Runtime Gate
-> /world
```

Runtime 合成原则：

| 原则 | 说明 |
|---|---|
| 不是一张死图 | 游戏后期不靠单张巨大 PNG 表达所有内容 |
| 地图分层 | 地形、道路、水体、植被、建筑、人物、动态效果分层 |
| 状态驱动 | 水流、树木生长、建筑阶段、人物动作都由事实和状态驱动 |
| 视觉不改事实 | AI Painter 和 Runtime Render 只能表达事实，不能新增事实 |
| 审核后展示 | RuntimeFrame 也必须过展示闸门才能进 `/world` |

## 页面架构

训练页面必须分清“训练”和“展示”。

| 页面 | 职责 |
|---|---|
| `/world` | 玩家主世界页面，只能展示完整 ApprovedFrame / RuntimeFrame |
| `/ai-painter-progress` | 本地 AI Painter 训练主页，只放阶段入口和整体状态 |
| `/ai-painter-progress/generated-results` | 所有训练后结果、候选图、失败图、时间戳、耗时、资源账本和审核结果 |
| 完整训练入口 | 进入自然家园完整画面训练、生成、审核链路 |
| 局部训练入口 | 进入 VisualUnit / 局部资产 / 状态帧训练链路，当前后置 |

训练主页不能堆满候选图。生成结果必须集中归档，失败图也必须保留。

## VisualJudge 分层

| 层级 | 目标 | 当前状态 |
|---|---|---|
| VJ-0 | 文件、来源、hash、runtime gate | 完成 |
| VJ-1 | 清晰度、边缘、结构、禁区、失败原因 | 进行中 |
| VJ-2 | 语义、风格、状态一致性 | 最小版完成，继续增强 |

## ApprovedFrame 架构

ApprovedFrame 是玩家可见画面的正式门票。

必须满足：

```txt
Candidate 来自本地小模型
AND 绑定 worldId / tick / sourceFactIds
AND 图片 hash 正确
AND review hash 正确
AND VJ 通过
AND runtime 当前事实匹配
```

## 当前风险

| 风险 | 处理 |
|---|---|
| 泛化候选仍模糊 | 继续自然家园训练与数据扩充 |
| VJ-1/VJ-2 仍需增强 | 保留失败原因，进入下一轮训练 |
| 数据样本偏少 | V95 扩充干净自然样本 |
| 误把候选当正式图 | `/world` 只读 ApprovedFrame / RuntimeFrame |
| 文档跑偏 | 以后按 `docs/EXECUTION_PLAN.md` 执行 |
