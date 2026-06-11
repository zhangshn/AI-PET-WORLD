# AI-PET-WORLD AI Painter 当前正式方案

版本：v4.0  
状态：当前唯一正式视觉方案  
更新日期：2026-06-11

## 1. 当前结论

AI-PET-WORLD 的最终目标没有改变：自主世界产生事实，项目自己的 AI Painter 根据事实自主生成世界画面，画面通过审核后才能展示。

上一版方案的技术方向正确，但把完整模型研发闭环全部放进第一阶段，导致 MVP 过重。本版将工作拆为三个层级：

1. **AI Painter 架构 MVP**：建立正确的数据和展示边界，不再沿用第三方 Provider 或程序色块绘图。
2. **AI Painter 模型 MVP**：训练一个范围很窄的自研模型，真正生成第一张静态世界位图。
3. **正式自主视觉闭环**：逐步加入真实语义审核、自动修正、连续性和动态内容。

第一版不要求一次完成完整视觉 AI 平台，但必须沿着正确方向前进，不能用旧程序绘图冒充，也不能把人工图片冒充 AI 自主生成结果。

## 2. 不变的产品定义

- 用户出生信息通过紫微斗数和相关人格逻辑形成管家的灵魂、性格和长期倾向。
- 管家是自主角色，不是玩家直接控制的单位。
- 世界规则、生态、资源、事件和管家行为共同产生世界事实。
- AI Painter 根据世界事实生成视觉表达。
- Painter 可以补充纹理、光影和非重大装饰，但不能新增重大世界事实。
- 审核未通过的画面不能展示。
- 后续小镇、城市和多玩家管家建设都进入同一视觉生成与审核链。

## 3. 当前 MVP 目标

### 3.1 架构 MVP

架构 MVP 只验证正式链路是否正确，不代表已经具备 AI 绘图能力。

```text
World Facts
  -> WorldGenerationCondition
  -> Candidate 接口
  -> VJ-0 文件与事实闸门
  -> ApprovedFrame 接口
  -> Runtime Render 只读展示
```

允许使用项目自有测试图片验证 Candidate、审核记录、ApprovedFrame 和展示闸门，但必须满足：

- 只能在开发测试模式使用。
- 必须明确标记 `development_test_asset`。
- 不能标记为模型生成。
- 不能证明 AI Painter 已经完成。
- 不能作为正式自主世界对玩家发布。

程序生成的色块、SVG、Canvas 草图、随机素材拼图和调试图不能进入 ApprovedFrame。

### 3.2 模型 MVP

模型 MVP 才是当前真正的绘图完成目标：

- 固定俯视视角。
- 固定输出尺寸。
- 固定像素视觉语言。
- 只生成静态世界底图。
- 只覆盖草地、水岸、树木、石头、花草、道路、材料和临时住所。
- 不做人物、动物、复杂天气、城市和视频动画。
- 从 WorldGenerationCondition 生成真实 PNG/WebP。
- 输出必须先进入隐藏 Candidate。
- 至少通过 VJ-0 和 VJ-1 后才能成为 ApprovedFrame。

第一张图必须达到“完整世界画面”，不能是色块、布局草图或程序占位图。参考图定义质量方向，但不能直接复制或作为无授权训练数据。

### 3.3 正式闭环

模型 MVP 完成后再逐步加入：

- VJ-2 语义视觉模型。
- VisualFix 自动重绘。
- 上一帧和 WorldFactDiff 连续性。
- 人物、动物、天气和建设动作。
- 小镇、城市和多玩家世界扩展。

这些是正式自主世界所必需的能力，但不全部阻塞第一张模型生成图片。

## 4. 正式技术边界

### 4.1 正式链路禁止

- 第三方在线绘图 API。
- 未确认的外部模型端点。
- 将第三方预训练模型包装成项目自研模型。
- 未经授权图片、游戏截图、角色、标志或素材进入训练集。
- 人工图片冒充模型生成图片。
- Mock、占位图、调试图或程序色块作为正式世界画面。
- 候选图绕过审核直接展示。
- VisualFix 修改世界事实。

### 4.2 可以使用的基础设施

- GPU、CUDA、DirectML。
- PyTorch 等训练与张量计算框架。
- PNG、WebP、JPG 编解码库。
- 数据库、对象存储和任务队列。
- Canvas、WebGL 或游戏引擎用于 ApprovedFrame 显示和已批准动态资产播放。

底层工具可以使用，决定画什么、如何训练、模型权重、如何审核以及世界连续性必须由项目掌控。

### 4.3 从零训练的现实定义

从零训练不是普通 Web 功能开发，而是独立的模型研发任务。数据质量、标注、GPU、模型实验和失败迭代都会决定周期。

MVP 必须通过缩小领域降低难度，而不是假装少量代码就能达到参考图质量。

## 5. 当前正式链路

```text
自主世界事实 World Facts
  -> World Condition Encoder
  -> AI Painter Director / Scene Intent
  -> Scene + Style Condition
  -> 项目自研 World Image Generation Model
  -> 隐藏 AiImageCandidate
  -> 分阶段 VisualJudge
  -> ApprovedFrame
  -> Runtime Render
  -> 玩家看到画面
```

正式闭环阶段增加：

```text
上一张 ApprovedFrame
+ WorldFactDiff
+ Keep Mask / Change Mask
  -> Continuity Condition
  -> World Image Model
  -> VisualJudge
  -> VisualFix
  -> 下一张 ApprovedFrame
```

## 6. VisualJudge 分阶段实现

VisualJudge 不是一个普通规则函数，而是逐步建设的视觉审核子项目。

### VJ-0：硬闸门

- 校验 PNG/WebP/JPG 格式和真实图片字节。
- 校验尺寸、哈希、worldId、tick 和 sourceFactIds。
- 校验 Candidate 默认不可展示。
- 校验当前 tick 和 ApprovedFrame 一致。
- 拒绝 SVG、HTML、JSON、空文件、占位图和调试图。

VJ-0 属于架构 MVP，必须先完成。

### VJ-1：弱视觉规则

- 检查大面积单色、空白或透明区域。
- 检查异常色块、严重模糊、极低信息量和损坏图片。
- 检查水印、明显文字、UI 卡片和调试边框。
- 检查基础亮度、对比度、色彩范围和像素锐度。

VJ-1 属于模型 MVP。它不能证明构图优美，但能阻止明显失败图展示。

### VJ-2：真实语义视觉审核

- 世界事实和图片内容一致性。
- 像素风格一致性。
- 构图、层次、地形和道路关系。
- 与上一帧的连续性。
- 新增不存在物体的检测。
- 参考质量方向和版权风险。

VJ-2 需要视觉模型和审核训练数据，属于正式闭环阶段，不阻塞第一张模型候选图产生。

在 VJ-2 完成前，模型输出只能用于受控 MVP 测试；正式公开发布仍需补足相应审核能力。

## 7. Runtime Render 边界

Runtime Render 不生成静态世界事实对应的场景图。

它可以：

- 读取、校验、缓存、缩放和显示 ApprovedFrame。
- 播放经过批准的角色、动物、天气和特效资产。
- 合成已经批准的动态视觉层。

它不能：

- 决定世界里有什么。
- 绘制或修改地形、道路、建筑和世界底图。
- 使用程序色块替代 AI Painter 输出。
- 展示未审核 Candidate 或失败图。

人物、动物和天气进入动态阶段后，也必须来自 Approved Asset 或 Approved Animation；Runtime Render 只播放和合成。

## 8. 数据计划

| 阶段 | 数据目标 | 用途 |
|---|---:|---|
| D0 规范集 | 20-50 张自有高质量基准图及标注 | 固定视角、色彩、像素密度和质量标准 |
| D1 原型集 | 1,000-5,000 个合法场景或局部样本 | 训练窄领域静态模型原型 |
| D2 稳定集 | 根据模型实验扩充，不预先保证固定数量 | 提升质量、多样性和失败覆盖 |
| D3 连续性集 | 同一世界变化前后的成对样本 | 训练 tick 连续性和局部变化 |
| D4 审核集 | 合格图、失败图、失败区域和人工评分 | 训练 VJ-2 和 VisualFix |

数据只能来自项目自制、权利归属明确的委托制作、CC0 或明确允许模型训练的内容。公开互联网图片默认只能用于抽象原则研究，不能直接进入训练集。

## 9. 数据结构

### WorldGenerationCondition

`worldId`、`tick`、`sourceFactIds`、`sceneCondition`、`styleCondition`、`seed`、`modelVersion`。连续性阶段再加入 `previousFrameId`、`worldFactDiff`、`keepMask` 和 `changeMask`。

### AiImageCandidate

`candidateId`、`worldId`、`tick`、`imageUrl/imageBytes`、`format`、`width`、`height`、`sourceKind`、`modelVersion`、`seed`、`sourceFactIds`、`canShowToPlayer=false`。

`sourceKind` 必须区分：

- `project_model_generated`
- `development_test_asset`

只有 `project_model_generated` 才能证明模型 MVP 已完成。

### VisualReviewReport

`judgeStage`、图片哈希、文件检查、弱视觉检查、失败项、证据、分数、Judge 版本和状态。

### ApprovedFrame

`frameId`、`worldId`、`tick`、`candidateId`、`sourceKind`、`imageHash`、`modelVersion`、`reviewVersion`、`reviewScore`、`sourceFactIds`、`approvedAt`、`canShowToPlayer=true`。

开发测试资产生成的 ApprovedFrame 只能存在于开发测试环境，不能进入正式玩家环境。

## 10. 当前代码处置

### 保留

- 世界 Runtime、生态、建设、资源和 World Facts。
- 紫微斗数、人格、管家意识和自主行为。
- VisualFactManifest 和 Scene Intent。
- Candidate、Review、ApprovedFrame 的基本存储边界。
- `/world` 只读取 ApprovedFrame 的原则。

### 已完成清理

- 已删除 `external_api`、第三方 API Key 和在线 Provider 路线。
- 已删除 `manual_import` 正式生成路线。
- 已删除旧 local-image-model Provider、HTTP、command bridge、dry-run 和重复适配层。
- 已建立项目内部模型状态边界；模型未实现时明确阻断生成。

### 已完成条件协议整改

- 已建立内部 `WorldGenerationCondition`，统一承载场景、空间、地形、资产、风格、动态和安全条件。
- 已删除旧提示包与控制草图结构及其路由、存储字段和兼容目录。
- Candidate 与 ApprovedFrame 已改为通过 `conditionId`、worldId、tick 和 sourceFactIds 追溯生成条件。
- 生成条件默认不可展示，并强制要求 VisualJudge；视觉修正只能改变视觉条件，不能改变世界事实。

### 下一阶段整改

- 将 VisualJudge 拆成 VJ-0、VJ-1、VJ-2。
- 先完成 VJ-0 的文件、来源、世界、tick、事实引用和环境隔离硬闸门。
- 开发测试资产只能验证链路，不得冒充内部模型生成结果或进入正式玩家环境。

## 11. 分阶段验收

| 阶段 | 目标 | 完成定义 |
|---|---|---|
| A1 架构收敛 | 清除旧 Provider 主线 | 正式代码只指向项目内部模型 |
| A2 条件协议 | World Facts 转成统一条件 | WorldGenerationCondition 稳定可测试 |
| A3 展示闸门 | Candidate 到 ApprovedFrame | VJ-0 通过后只读展示，开发资产严格隔离 |
| M1 数据基线 | D0 与数据规范 | 首批自有数据可追溯 |
| M2 训练管线 | 训练、验证和导出 | 小数据实验可以完整运行和恢复 |
| M3 模型原型 | 第一张模型位图 | `project_model_generated` PNG/WebP 产生 |
| M4 模型 MVP | 静态窄领域世界画面 | VJ-0、VJ-1 通过，人工质量验收达到 MVP 标准 |
| F1 VJ-2 | 语义视觉审核 | 能判断事实、风格、构图和连续性 |
| F2 VisualFix | 自动重绘 | 失败后自动修正视觉条件，不改事实 |
| F3 连续性 | 同一世界持续变化 | 未变化区域稳定，变化区域符合事实 |
| F4 动态世界 | 人物、动物和天气 | 使用批准动态资产并接受视觉审核 |

## 12. 当前红线

- 架构 MVP 跑通不等于 AI Painter 已经完成。
- 人工测试图片不能冒充模型生成结果。
- 第一张程序色块或调试图不能作为 MVP 世界画面。
- 没有合法数据不能开展正式训练。
- 没有真实模型权重不能宣称具备自主绘图能力。
- VJ-0、VJ-1 未通过不能进入 ApprovedFrame。
- 正式公开发布前必须补足与发布风险相匹配的 VJ-2 能力。
- 所有视觉修正不得篡改世界事实。
