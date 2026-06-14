# AI-PET-WORLD 唯一正式架构基线

版本：v1.1  
状态：唯一正式架构与实施依据  
更新日期：2026-06-14  
适用对象：产品负责人、开发人员、GPT/Codex 代码代理

> 本文档替代此前所有 AI Painter 方案、阶段计划、旧视觉链路说明和冻结方案。任何实现、审查和后续交接都必须以本文档为唯一依据。

## 1. 产品目标

AI-PET-WORLD 是一个自主运行的世界游戏，不是玩家直接操纵角色完成任务的传统游戏。

- 用户注册后输入出生年月日等必要信息。
- 紫微斗数及相关人格映射形成管家的灵魂、性格、交流方式、建设偏好和长期决策倾向。
- 管家是世界中的自主行为主体，可以参考玩家建议，但不保证服从。
- 世界规则、资源、生态、事件和管家行为共同产生世界事实。
- 前期世界只有自然环境、基础资源和最低生存内容，后续建筑、道路、小镇、城市及多人协作内容由管家自主建设。
- 用户主要通过游戏内手机与管家沟通。
- 世界事实与视觉表达严格分离。视觉系统只能表达事实，不能篡改事实。
- 没有通过视觉审核的内容永远不能展示给玩家。

## 2. 最终业务主链

```text
用户注册与出生信息
  -> 紫微斗数与人格映射
  -> 管家灵魂 / 性格 / 长期偏好
  -> 自主世界 Runtime
  -> 世界规则、生态、资源、事件、管家决策
  -> World Facts
  -> AI Painter
  -> 隐藏候选图
  -> VisualJudge
  -> VisualFix（失败时）
  -> ApprovedFrame
  -> Runtime Render
  -> 玩家看到世界
```

未来所有自主生成入口必须进入同一条视觉链，包括：

- 管家自主建设。
- 自然、生态和地形变化。
- 小镇与城市建设。
- 道路、建筑、材料和施工状态变化。
- 世界事件留下的痕迹。
- 多玩家管家共同建设。
- 人物、动物、天气、动作和特效。

## 3. 不可改变的技术原则

### 3.1 世界事实优先

World Runtime 是事实来源，AI Painter 不是第二套世界模拟器。Painter 可以补充草叶、纹理、光照、微小石块等非重大视觉细节，但不能新增建筑、角色、资源、道路、事件或其他重大事实。

### 3.2 正式画面必须来自项目内部图像模型

- 禁止第三方在线绘图 API 进入正式主链。
- 禁止把外部模型服务包装成项目自研模型。
- 可以使用 PyTorch、CUDA、DirectML、图像编解码库等基础设施。
- 模型结构、训练数据、权重、条件编码、推理入口和审核策略必须由项目掌控。
- 内部模型未实现时，生成接口必须明确阻断，不能返回假图。

### 3.3 审核失败绝不展示

- Candidate、GenerationCondition、ReviewReport 和 FixPlan 永远不可直接展示。
- `/world` 只能读取与当前 worldId、当前 tick、当前 sourceFactIds 一致的 ApprovedFrame。
- 旧 tick 画面、损坏记录、开发测试图、占位图、SVG、程序色块、调试图都不能回退展示。

### 3.4 审核必须检查图片，不接受自我声明

候选图携带的标签只能作为来源元数据，不能作为“画面优美、无水印、构图正确、版权安全”的审核证据。

- VJ-0 检查文件、字节、哈希、尺寸、来源和事实绑定。
- VJ-1 使用确定性图像分析检查明显失败。
- VJ-2 使用项目自己的视觉判断模型检查语义、风格、构图、事实一致性和连续性。
- 任何 `quality_passed` 类标签都不能替代真实视觉分析。

### 3.5 VisualFix 不得修改世界事实

VisualFix 只能修正生成条件、构图表达、地形表达、资产表达、风格表达和模型采样参数。若世界事实本身冲突，应返回 World Runtime 处理，而不是由视觉模块偷偷改写。

### 3.6 合法数据与非侵权

- 训练数据只能来自项目自制、权利清晰的委托制作、CC0 或明确允许训练和商业使用的内容。
- 开发阶段允许项目负责人在项目外部使用 GPT 等 AI 图像工具制作原创训练图片；项目代码、训练程序和游戏运行时不得对接 GPT、OpenAI API 或其他在线绘图服务。
- 外部生成工具只提供原始 PNG，不假定其同时提供 Blueprint、对象坐标或语义 Mask。
- 原始训练图片进入项目后，由项目内部自动标注链生成 Blueprint 与 14 通道 Mask，不以人工逐项描边或人工逐项批准作为正式流程。
- AI 辅助制作的训练图片必须记录生成工具、生成日期、输入条件、文件哈希和许可依据；自动标注结果必须记录标注模型版本、规则版本、置信度、几何校验和质量门禁结果。
- 互联网公开案例只用于提炼抽象原则，默认不能直接进入训练集或素材库。
- 禁止复制具体游戏画面、角色、标志、地图、素材或受保护的独特构图。
- 每条训练数据必须记录来源、授权、版本、哈希和用途。

## 4. 总体技术架构

```text
┌──────────────────────────────────────────────────────────────┐
│ Product Layer                                                │
│ 注册、出生信息、P-Phone、玩家与管家沟通                      │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ Butler Intelligence Layer                                    │
│ 紫微斗数映射、人格、意识、记忆、动机、自主决策                │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ Autonomous World Runtime                                     │
│ 生态、资源、建设、实体、文明、事件、tick、持久化              │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ World Fact Boundary                                          │
│ VisualFactManifest、WorldFactDiff、事实审计                   │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ AI Painter Director                                          │
│ SceneIntent、Composition、Terrain、Asset、Motion、Condition   │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ Internal World Image Model                                   │
│ Condition Encoder、训练、权重、推理、AiImageCandidate         │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ Visual Governance                                            │
│ VJ-0、VJ-1、VJ-2、VisualFix、ApprovedFrame                    │
└──────────────────────────────┬───────────────────────────────┘
                               v
┌──────────────────────────────────────────────────────────────┐
│ Runtime Render                                               │
│ 只读展示 ApprovedFrame，后期合成批准的动态层                  │
└──────────────────────────────────────────────────────────────┘
```

## 5. AI Painter 正式数据流

```text
1. WorldRuntimeSaveRecord
2. VisualFactManifest
3. SceneIntent
4. CompositionPlan
5. TerrainPlan
6. AssetPlan
7. MotionPlan
8. WorldGenerationCondition
9. InternalModelGenerationRequest
10. AiImageCandidate（隐藏）
11. VisualReviewReport
12. VisualFixPlan（失败时）
13. ApprovedFrame（通过时）
14. Runtime Render
```

关键规则：

- 第 1-7 步决定“世界中有什么、画面应该表达什么”。
- 第 8-10 步由内部模型决定“如何画出来”。
- 第 11-13 步决定“是否有资格展示”。
- 第 14 步只负责展示，不重新生成或修改世界底图。

### 5.1 当前自研小模型架构

当前模型不是通用文生图模型，只服务 AI-PET-WORLD 的固定俯视像素世界。训练原图可以由项目负责人在项目外部使用 AI 图像工具制作并导入；项目代码不连接该工具。原图导入后必须由项目内部自动标注系统产生结构化训练条件。

正式训练数据生产链固定为：

```text
原创训练 PNG
  -> Source Asset Registry（来源、许可、哈希）
  -> Automatic Visual Annotator（自动语义识别与实例边界）
  -> Geometry Deriver（道路边缘、水岸、可行走区域、空间深度）
  -> Blueprint + 14 Channel Masks
  -> Annotation Judge（图片、标注、几何和语义一致性）
  -> 自动修正 / 重新标注（失败时）
  -> Accepted Training Pair（通过时）
  -> Internal AI Painter Training
```

人工不进入正式逐项审核链。标注是否可训练由可复现的机器证据决定：像素覆盖、边界一致性、通道冲突、对象完整性、语义置信度、规则检查和标注模型交叉验证。无法自动确认的样本进入隔离区，不得进入训练集，也不要求用户手工逐对象批准。

```text
World Facts
  -> VisualFactManifest
  -> Scene Blueprint
       grass / water / shoreline
       road center / road edge / walkable
       tree trunk / tree crown / rock
       shelter foundation / wall / roof
       construction material / depth
  -> Condition Tensor Builder
  -> Tiny Conditional U-Net v0
  -> RGB 256x192 Lab Candidate
  -> VJ-0 文件与事实闸门
  -> VJ-1 确定性像素质量
  -> Lab Evaluation
```

v0 的目标是证明模型能够理解世界结构：水、道路、树、石头和临时住所必须出现在 Blueprint 指定区域。v0 不承诺达到最终参考图质量，也不进入正式玩家 ApprovedFrame。

当 v0 结构控制验证通过后，升级为：

```text
Blueprint Encoder
+ World Condition Encoder
+ Noise / Seed
-> 小型条件生成模型
-> 高质量 RGB 世界图
-> VJ-0 / VJ-1 / VJ-2
-> ApprovedFrame
```

普通 Conditional U-Net 只作为结构控制基线，不作为最终高质量生成模型。最终模型必须具备真实随机采样能力，不能依赖程序色块或固定素材拼接。

## 6. 核心数据契约

### 6.1 VisualFactManifest

必须包含：`worldId`、`tick`、`sourceFactIds`、主要事实、支撑事实、环境事实、禁止新增事实和事实审计结果。

它回答的是“当前世界真实发生了什么”，不是“参考图应该长什么样”。

### 6.2 WorldGenerationCondition

必须包含：

- `conditionId`、`version`、`worldId`、`tick`、`modelVersion`。
- `sceneCondition`、`spatialCondition`、`terrainCondition`。
- `assetCondition`、`styleCondition`、`motionCondition`。
- `safetyCondition`、`fixConditions`、`ruleDataIds`、`sourceFactIds`。
- `canShowToPlayer=false`。

它是结构化模型输入，不是自然语言提示词包，也不是控制草图。

### 6.3 AiImageCandidate

必须包含：

- `candidateId`、`worldId`、`tick`、`conditionId`。
- `sourceFactIds`、`modelVersion`、生成请求 ID。
- 图片地址或受控存储引用、真实格式、宽高和字节哈希。
- `sourceKind=project_model_generated` 或隔离的 `development_test_asset`。
- `canShowToPlayer=false`。

正式 ApprovedFrame 只允许来源为 `project_model_generated`。

### 6.4 VisualReviewReport

必须记录：Judge 阶段、Judge 版本、每项检查的真实证据、图片哈希、失败原因、分数和结论。候选图自带标签不能作为视觉检查证据。

### 6.5 ApprovedFrame

必须绑定：

- 当前 `worldId` 和当前 `tick`。
- Candidate、Condition、GenerationRequest、ReviewReport。
- 当前完整 `sourceFactIds`。
- 图片哈希、字节数、Content-Type、模型版本和 Judge 版本。
- `canShowToPlayer=true`。

世界 tick 改变后，旧 ApprovedFrame 默认失效，除非事实差异规则明确证明画面仍然有效。MVP 阶段不做复用，必须严格同 tick。

## 7. VisualJudge 分层

### 7.1 VJ-0 文件与事实硬闸门

必须一次性完成以下检查：

- 图片真实存在，可读取真实字节。
- 只允许 PNG/WebP/JPG；拒绝 SVG、HTML、JSON、文本和空内容。
- 声明格式、Content-Type、宽高与真实图片一致。
- 生成稳定 SHA-256。
- 文件大小和最低尺寸满足要求。
- Candidate、Condition、Request、Review、ApprovedFrame 的 worldId/tick 一致。
- sourceFactIds 完整一致。
- 正式来源为 `project_model_generated` 且绑定内部模型版本。
- 开发测试资产不能进入生产 ApprovedFrame。
- `/world` 再次验证当前 runtime tick，防止旧画面展示。

### 7.2 VJ-1 确定性图片质量检查

- 大面积单色、透明、空白和极低信息量。
- 严重模糊、损坏、异常压缩和异常矩形块。
- 文字、水印、UI 卡片、调试边框。
- 基础亮度、对比度、色彩范围和像素锐度。
- 这些结果必须来自图片计算，不能来自 Candidate 标签。

### 7.3 VJ-2 项目视觉判断模型

- 图片是否表达当前世界事实。
- 是否新增不存在的建筑、角色、资源或事件。
- 是否达到明亮、治愈、精细、俯视像素风。
- 构图、层次、道路、地形、材料与建设关系是否合理。
- 与上一帧是否保持世界身份和未变化区域连续性。
- 是否存在近似复制、标志、角色或版权风险。

## 8. MVP 视觉目标

第一张正式静态世界图必须是完整位图，不是程序布局图。

- 明亮、治愈、精细、俯视像素风。
- 固定视角、固定输出尺寸和固定像素密度。
- 内容范围：自然空地、水岸、草地、树、石头、花、路径、材料、临时住所。
- 允许 Painter 增加非重大自然细节。
- 不包含人物、动物、复杂天气、城市和动态动画。
- 参考图只定义质量方向，不作为直接训练数据或复制目标。

## 9. 目标目录结构

```text
ai-pet-world/
├─ docs/
│  └─ AI_PET_WORLD_MASTER_ARCHITECTURE.md       # 唯一正式架构基线
├─ src/
│  ├─ app/
│  │  ├─ api/world/
│  │  │  ├─ create/                              # 创建正式世界
│  │  │  ├─ tick/                                # 推进世界事实
│  │  │  └─ visual/
│  │  │     ├─ condition/                        # 读取结构化生成条件
│  │  │     ├─ generate/                         # 内部模型生成入口
│  │  │     ├─ candidate/                        # 隐藏候选图状态
│  │  │     ├─ judge/                            # 审核入口
│  │  │     ├─ fix-plan/                         # 视觉修正计划
│  │  │     ├─ approved/                         # ApprovedFrame 读取
│  │  │     ├─ integrity/                        # 全链路完整性检查
│  │  │     └─ status/                           # 状态摘要
│  │  └─ world/                                  # 只读玩家世界页面
│  ├─ world/
│  │  ├─ runtime/                                # 唯一世界 Runtime 主链
│  │  ├─ construction/                           # 管家自主建设
│  │  ├─ ecology/                                # 生态规则
│  │  ├─ entity/                                 # 世界实体
│  │  ├─ civilization/                           # 小镇/城市/文明
│  │  └─ world-visual-painter/
│  │     ├─ visual-fact-manifest/                # 世界事实视觉清单
│  │     ├─ scene-intent/                        # 场景意图
│  │     ├─ composition-plan/                    # 构图计划
│  │     ├─ terrain-plan/                        # 地形计划
│  │     ├─ asset-plan/                          # 资产语义计划
│  │     ├─ motion-plan/                         # 动态计划
│  │     ├─ world-generation-condition/          # 唯一模型条件协议
│  │     ├─ internal-image-model/                # TS 模型状态与调用契约，不放训练代码
│  │     ├─ training-data/                       # TS 数据清单、来源与导入契约
│  │     ├─ ai-image-candidate/                  # 候选图存储与闸门
│  │     ├─ visual-judge/
│  │     │  ├─ vj-0/                            # 文件与事实硬闸门
│  │     │  ├─ vj-1/                            # 确定性图像质量
│  │     │  └─ vj-2/                            # 项目视觉判断模型
│  │     ├─ visual-fix/                          # 修正条件与重绘
│  │     ├─ approved-frame/                      # 唯一可展示产物
│  │     ├─ continuity/                          # 后期帧连续性
│  │     ├─ visual-rule-dataset/                 # 可追溯规则数据
│  │     └─ authorized-data/                     # 授权与来源清单
│  └─ butler/                                    # 人格、意识、记忆和自主决策
├─ ml/
│  └─ ai-painter/                                # 独立 Python/PyTorch 小模型工程
│     ├─ pyproject.toml
│     ├─ configs/
│     │  ├─ dataset_v0.yaml
│     │  ├─ model_tiny_unet_v0.yaml
│     │  └─ training_v0.yaml
│     ├─ src/ai_painter/
│     │  ├─ blueprint/                           # Blueprint schema、校验与 mask 构建
│     │  ├─ dataset/                             # 导入、索引、Dataset、DataLoader
│     │  ├─ annotation/                          # 自动语义/实例标注与置信度
│     │  ├─ geometry/                            # 岸线、道路边缘、可行走、深度推导
│     │  ├─ annotation_judge/                    # 自动标注质量门禁与交叉验证
│     │  ├─ condition/                           # 多通道 Condition Tensor
│     │  ├─ models/                              # Tiny U-Net 与后续生成模型
│     │  ├─ training/                            # loss、trainer、checkpoint、日志
│     │  ├─ inference/                           # 权重加载与 PNG 推理
│     │  └─ evaluation/                          # 结构一致性与质量评估
│     ├─ scripts/
│     │  ├─ import_dataset.py
│     │  ├─ validate_dataset.py
│     │  ├─ train_tiny_unet.py
│     │  └─ infer_tiny_unet.py
│     └─ tests/                                  # 按模块拆分的 Python 测试
├─ data/
│  ├─ world-runtime/                             # 本地 MVP 世界存档
│  ├─ world-visual-candidates/                   # 隐藏候选图记录
│  ├─ world-approved-frames/                     # 审核通过记录
│  └─ ai-painter-datasets/                       # 本地训练数据，不提交原图到 Git
│     ├─ source-originals/                       # 原始 20 张及后续原创 PNG，只作源素材
│     ├─ annotation-working/                     # 自动标注中间结果，不可训练
│     ├─ annotation-quarantine/                  # 自动门禁失败样本，不要求人工批准
│     ├─ accepted/                               # 自动配对并通过机器质量门禁
│     │  └─ dataset_v0/
│     │     ├─ images/
│     │     ├─ blueprints/
│     │     ├─ masks/
│     │     └─ metadata/
│     ├─ rejected/                               # 失败样本与原因
│     ├─ indexes/                                # train/validation 索引
│     └─ manifests/                              # 来源、许可、哈希、版本
├─ scripts/
│  ├─ check-source-encoding.mjs
│  └─ inspect-world-visual-painter.mjs
└─ services/
   └─ ai-painter-inference/                      # v0 训练成功后才建立本地推理服务
```

目录规则：

- 不重新建立 `prompt-package`、`control-sketch`、`provider`、`external-api` 或旧程序绘图目录。
- 原始图片只能进入 `source-originals`，不得直接成为可训练样本。
- `annotation-working` 和 `annotation-quarantine` 都不是正式训练来源，也不能绕过 Annotation Judge。
- 人工标注页面仅保留为开发诊断工具，不属于正式数据生产和批准链。
- `visual-review` 迁移为 `visual-judge/vj-0|vj-1|vj-2` 时必须作为一个完整模块迁移，不能长期双轨并存。
- 大模型权重、训练原图和临时输出不直接提交 Git，只提交清单、配置、哈希和可复现脚本。

### 9.1 文件拆分与复杂度硬规则

后续新增和整改代码必须遵守：

| 文件类型 | 目标长度 | 硬上限 | 规则 |
|---|---:|---:|---|
| TypeScript/Python 业务文件 | 80-220 行 | 300 行 | 一个文件只负责一个明确职责 |
| Next.js route | 60-150 行 | 180 行 | 只做输入、调用 service、输出响应 |
| schema/type 文件 | 80-200 行 | 250 行 | 按领域拆分，不再建立总 schema 大文件 |
| store 文件 | 100-250 行 | 320 行 | 路径、序列化、校验分别拆分 |
| 单元/行为测试文件 | 100-250 行 | 300 行 | 按场景拆分，不建立单个巨型测试脚本 |
| `index.ts` | 5-40 行 | 60 行 | 只导出，不包含业务逻辑 |

超过目标长度时必须先判断是否存在多个职责；超过硬上限不得继续追加功能，必须在同一模块内拆分。禁止为了满足行数机械拆分互相强耦合的碎片文件。

现有超长文件作为明确技术债处理，不要求一次性全库重构，但在对应模块再次修改前必须先拆分：

1. `visual-review-builder.ts` 拆为 VJ-0 编排、图片读取、格式解析和 ReviewReport 组装。
2. `world-visual-painter-schema.ts` 拆为 condition、candidate、review、approved-frame、training-data 类型。
3. Candidate/ApprovedFrame store 拆为 path、normalize、validate、repository。
4. visual API route 抽取 service，route 保持轻量。
5. 视觉行为测试按 candidate、review、approved-frame、runtime-gate 分文件。

## 10. 技术栈与职责

| 层 | 技术 | 职责 |
|---|---|---|
| Web 与 API | TypeScript、Next.js | 产品页面、世界 API、视觉编排、只读展示 |
| 世界 Runtime | TypeScript | 世界事实、tick、生态、建设、事件和持久化 |
| 模型研发 | Python、PyTorch | 数据加载、Condition Encoder、训练、验证、推理 |
| GPU 基础 | CUDA 或 DirectML | 张量计算与模型加速 |
| 图像分析 | Python 图像库或 TS 原生解析 | VJ-0/VJ-1 的字节和确定性图片检查 |
| 数据存储 | 本地文件（MVP），后续数据库与对象存储 | 世界记录、候选图、审核记录、批准帧和数据清单 |
| Runtime Render | Web 图片层，后期 Canvas/WebGL/游戏引擎 | 只读展示批准画面和批准动态资产 |

TypeScript 与 Python 并不冲突：TypeScript 管世界与产品主链，Python 管模型训练和推理。不要为了“全自研”重写 PyTorch、PNG 编解码器、GPU 驱动或浏览器渲染器。

## 11. 模块级实施计划

实施必须按“大模块完成”推进，不允许每次只改几个字段后宣布阶段完成。

### 模块 A：架构和条件协议（已基本完成）

范围：删除旧外部路线，建立 WorldGenerationCondition，Candidate 和 ApprovedFrame 绑定条件。  
剩余收尾：删除旧术语；确保文档、API 和类型只有一种正式名称。

### 模块 B：VJ-0 完整硬闸门（已完成）

必须一次完成：

1. Candidate 写入闸门。
2. Candidate 读取闸门。
3. Judge 的 worldId/tick/sourceFactIds/condition/request 检查。
4. ApprovedFrame 写入与读取闸门。
5. `/world` 当前 runtime tick 二次校验。
6. integrity API 全链路校验。
7. 删除“候选标签等于视觉审核通过”的逻辑。
8. 对失败情况提供可定位的中英文错误。
9. 类型、编码、构建和针对性测试全部通过。

模块 B 已完成：Candidate、ReviewReport、ApprovedFrame 与当前 Runtime 的 worldId、tick、sourceFactIds、Condition、Request、图片字节和来源已经形成真实硬闸门；静态闸门与行为测试均已通过。

### 模块 C：VJ-1 确定性图片分析（部分完成）

已完成真实像素解码、亮度、对比度、颜色范围、主色占比、边缘密度和锐度计算，并接入 ReviewReport、ApprovedFrame 和 VisualFix。尚需补齐透明度、异常矩形块、文字/水印基础检测及对应失败图片集。不得用标签替代真实计算。

### 模块 D：自动标注数据流水线与本地训练数据集（进行中）

一次完成原始图片注册、14 通道自动标注、几何派生、Blueprint/Mask 配对、机器质量门禁、失败隔离、来源与许可记录、哈希、数据清单以及 train/validation 划分。

模块 D 的硬边界：

1. GPT 等 AI 图像工具只由项目负责人在项目外部使用，用于开发期制作原创训练 PNG。
2. 项目代码不得调用 GPT、OpenAI API 或其他在线绘图服务。
3. 游戏运行时不得依赖 GPT，也不得向外部平台发送世界事实或用户数据。
4. 原始 PNG 不自带可信结构标注，必须经过项目内部自动标注器和 Annotation Judge。
5. 正式链禁止以人工逐项描边、逐结构下拉选择或人工批准作为训练数据准入条件。
6. 自动标注必须输出 14 通道 Mask、结构化 Blueprint、置信度、生成版本和机器审核证据。
7. 低置信度、通道冲突或几何不一致样本自动进入隔离区，不得进入训练索引。
8. 第一批原始素材固定保留现有 20 张；自动标注闭环通过后再扩展到 100-300 条完整配对样本。

模块 D 同时完成与本模块直接相关的结构收敛：建立 `ml/ai-painter` 独立工程、拆分 training-data 契约，并保证新增文件符合 9.1 的长度规则。不得在模块 D 提前训练正式模型。

当前已完成 `ml/ai-painter` Python 独立工程、Blueprint v1、14 通道 Condition Mask、原始图片导入、来源许可记录、SHA-256、不可覆盖样本 ID、完整性审计以及稳定 train/validation 划分。现有 20 张图片只作为原始素材：其中旧人工/脚本粗标注不再作为正式真值，必须由新的自动标注链重新生成。模块 D 尚未完成，当前缺少自动视觉标注器、几何派生器、Annotation Judge 和自动修正闭环。

训练数据采用“分层定义、分目录归档、完整场景主训练”的结构：`scene` 保存完整世界场景并计入主模型训练数量；`object` 保存完整房屋、人物、动物、树木等对象；`part` 保存屋顶、墙体、门窗、头部、四肢、服装等结构部件；`material` 保存木材、石材、草地、水面、布料等纹理。领域目录固定为 world、building、character、animal、vegetation、terrain、road、water、material、prop。开发环境通过 `/ai-painter-lab` 查看原始素材、自动标注证据和隔离原因；页面不得成为正式人工审批依赖。

### 模块 E：内部模型训练基础设施

一次完成 Python 工程、数据加载、Condition Encoder 接口、训练/验证循环、检查点、日志、配置、可复现实验和最小数据过拟合测试。

### 模块 F：第一张内部模型候选图

一次完成推理请求、权重加载、PNG/WebP 输出、Candidate 持久化、VJ-0/VJ-1、ApprovedFrame 和 `/world` 展示。只有真实 `project_model_generated` 图片通过后才算完成。

### 模块 G：质量迭代与 VJ-2

扩充数据、训练审核模型、事实一致性、构图、风格、连续性和版权风险判断。

### 模块 H：VisualFix 与自动闭环

审核失败自动形成结构化修正条件并重绘，限制重试次数，保留完整审计，不改变世界事实。

### 模块 I：动态世界

静态闭环稳定后，加入人物、动物、天气和建设动作。动态资产也必须经过批准，Runtime Render 只播放和合成。

### 11.1 优化后的实施周期

周期按单人开发、RTX 5050、本地小模型、原创训练图片在项目外制作、项目内部自动标注、GPT/Codex 辅助代码计算。原始图片准备与自动标注系统开发可以并行。

| 阶段 | 交付结果 | 预计周期 |
|---|---|---:|
| D0 架构与超长文件收敛 | 建立 `ml/ai-painter`，拆分训练契约和本轮涉及的超长文件 | 2-4 天 |
| D1 自动标注协议 | Blueprint、14 通道 Mask、置信度、来源与哈希规范 | 2-4 天 |
| D2 自动视觉标注器 | 语义区域、实例边界、对象类型与结构分解 | 5-10 天 |
| D3 几何派生与机器门禁 | 岸线、道路边缘、可行走、深度、冲突检查、失败隔离 | 4-8 天 |
| D4 现有 20 张自动重建 | 清除粗标注资格，重新生成配对数据与机器证据 | 2-5 天 |
| E Tiny U-Net 训练工程 | Dataset、Condition Tensor、模型、训练、checkpoint、日志 | 5-8 天 |
| F 最小过拟合与第一张 PNG | 先在 8-32 条样本过拟合，再完整推理一张 256x192 PNG | 3-7 天 |
| G 结构控制原型 | 水、路、树、石头和住所位置可控，100-300 条数据训练 | 1-2 周 |
| H 质量提升 | 扩展至 1,000-3,000 条，升级小型条件生成模型和 VJ-2 | 3-8 周 |

关键时间判断：

- 第一张由自研小模型真实生成的 PNG：约 2-4 周。
- 能按照 Blueprint 稳定控制主要区域：约 4-7 周。
- 初步可用于游戏内部测试的静态画面：约 8-16 周，主要取决于训练图片数量、统一程度和显卡训练速度。
- 接近参考图质量不能仅靠代码周期保证，必须以数据集和实际生成结果验收。

为了缩短周期，第一轮只做 `256x192`、固定俯视视角、草地/水域/道路/树/石头/临时住所，不做人物、动物、天气、城市、动画和 1024x768 直接训练。

## 12. 完成定义

一个模块只有同时满足以下条件才可标记完成：

- 模块范围内的代码、类型、API、存储和错误处理全部完成。
- 不存在新旧双轨、兼容空壳和废弃目录。
- 中英文用户提示无乱码。
- 核心失败路径有测试或可重复验证步骤。
- `npm run check:encoding` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- 文档进度表与真实代码一致。
- 未满足验收时必须写“未完成”，禁止用“框架已完成”替代功能完成。

## 13. 当前真实状态

| 模块 | 状态 | 判断 |
|---|---|---|
| 产品与自主世界定义 | 完成 | 主方向明确 |
| 旧外部视觉路线清理 | 完成 | 正式代码不调用第三方绘图服务 |
| 自研小模型架构与目标目录 | 完成 | `ml/ai-painter`、本地数据目录、独立 Python 环境边界和文件复杂度规则已经落地 |
| WorldGenerationCondition | 基本完成 | 结构已建立，需清理少量旧术语 |
| VJ-0 | 完成 | Candidate 与 ApprovedFrame 写入/读取、当前 tick、worldId、sourceFactIds、图片字节、来源和生产展示闸门均已实现并通过测试 |
| VJ-1 | 部分完成 | 已实现真实像素解码及亮度、对比度、颜色范围、主色占比、边缘密度、锐度检测；透明度、异常块、文字/水印仍待完成 |
| 自动标注训练数据集 | 进行中 | 已有 Blueprint v1、14 通道 Mask、来源、许可、哈希、导入和索引基础；正式自动标注器、几何派生、机器质量门禁和自动修正尚未实现。现有 20 张仅是原始素材 |
| 内部模型训练管线 | 未开始 | 无训练与验证实现 |
| 内部模型权重 | 不存在 | 不能生成正式候选图 |
| 第一张模型世界图 | 未完成 | 当前不得展示世界图 |
| VJ-2 / VisualFix 闭环 | 未开始 | 后续正式阶段 |
| 动态人物与动物 | 未开始 | 静态闭环后启动 |

## 14. GPT/Codex 强制执行协议

以下规则是给所有后续 GPT/Codex 代码代理的硬性指令。

### 14.1 禁止自由发挥

- 不得改变产品目标、正式技术路线或模块顺序。
- 不得擅自引入第三方绘图 API、外部 Provider、手工导入正式路线或程序绘图替代方案。
- 不得把候选图标签当作真实视觉审核。
- 不得新增本文档未定义的平行 Runtime、视觉主链或兼容架构。
- 不得为了快速看到画面而降低 ApprovedFrame 闸门。
- 不确定时先检查代码和本文档；仍有冲突时停止并明确报告，不得自行选择新方向。

### 14.2 一次完成一个大模块

- 每轮开始前必须声明当前唯一模块、范围和完成定义。
- 读取该模块涉及的全部代码后再编辑，不允许边猜边加小补丁。
- 一轮必须完成模块内部的类型、实现、API、存储、校验、错误处理、测试和清理。
- 不得跨越到下一大模块，也不得同时铺多个未完成骨架。
- 模块未通过全部验收，不得标记完成。
- 完成后必须输出进度表，明确“完成、未完成、下一模块”。

### 14.3 文档控制

- 本文件是唯一正式架构基线。
- 未经用户明确要求，不得修改本文件，不得新增其他方案 MD、冻结 MD、交接 MD 或临时架构文档。
- 代码实现与本文档冲突时，应先报告冲突；不能静默修改文档来迁就代码。
- 进度变化只有在一个大模块完整验收后才能更新。

### 14.4 删除与清理

- 被新模块替代的旧实现应在同一模块内删除，不保留冻结副本。
- 删除前确认没有正式引用；删除后扫描旧名称、空目录、乱码和失效脚本。
- 不得删除世界 Runtime、紫微斗数、人格、管家自主性和真实世界规则主链。

### 14.5 每轮固定输出格式

```text
当前模块：
本轮范围：
完成定义：

实施结果：
1. ...
2. ...

验证：
- encoding：通过/失败
- typecheck：通过/失败
- build：通过/失败
- module tests：通过/失败

进度表：
| 模块 | 状态 | 完成度 | 说明 |

下一模块：
阻塞项：
```

## 15. 下一步唯一任务

当前继续只执行“模块 D：自动标注数据流水线与本地训练数据集”。不要开始正式模型训练，不要制作动态内容，不要接入 GPT、OpenAI API 或任何在线绘图服务。

下一大模块必须一次完成以下内容：

1. 将现有 20 张图片登记为不可变的 `source-originals` 原始素材。
2. 取消旧粗标注和人工逐项审核结果的正式训练资格，但保留原图、来源、许可和哈希。
3. 建立 Automatic Visual Annotator，输出对象语义、实例边界、结构部件和置信度。
4. 建立 Geometry Deriver，生成道路中心/边缘、水岸、可行走区域和空间深度。
5. 生成完整 Blueprint v1 与 14 通道 Mask。
6. 建立 Annotation Judge，检查通道完整性、边界一致性、遮挡关系、几何冲突、语义置信度和图片对应关系。
7. 失败样本自动修正或进入隔离区；禁止要求用户逐对象手工审核。
8. 只有机器证据完整并通过门禁的样本才能进入 train/validation 索引。

在用户发出下一步代码指令前，只保留本次文档变更，不实施代码修改。
