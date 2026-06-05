# AI-PET-WORLD 当前正式架构

状态：只保留当前正式架构。旧方案、冻结方案、旧视觉链路不再作为实现依据。

## 1. 主链路

```txt
用户注册与出生信息
-> 生命/人格映射
-> 管家灵魂与人格核心
-> 世界创建
-> Runtime save record
-> 世界规则与自主决策
-> 世界事实、痕迹、生态、建设
-> VisualFactManifest
-> SceneIntent
-> AI Painter Director
-> CompositionPlan
-> TerrainPlan
-> AssetPlan
-> MotionPlan
-> PromptPackage
-> AI Image Generation Model
-> AiImageCandidate
-> VisualJudge
-> VisualFix
-> ApprovedFrame
-> Runtime Render
-> Player Display
```

## 2. Runtime 边界

正式 runtime 存档是 `WorldRuntimeSaveRecord`。

Runtime 写入只能通过已经验证的 runtime/world-rule 路径发生。

`/world` 页面是只读入口，不能写 runtime，不能创建默认世界，不能推进 tick。

## 3. 正式视觉链路

正式视觉结果只能来自 AI 生成的位图候选图。

程序 SVG、Canvas、primitive map、对象直绘、占位块、debug HTML 都不属于正式视觉链路，不能作为预览、fallback、候选图或 ApprovedFrame。

```txt
WorldRuntimeSaveRecord
-> VisualFactManifest
-> SceneIntent
-> CompositionPlan
-> TerrainPlan
-> AssetPlan
-> MotionPlan
-> PromptPackage
-> AiImageCandidate
-> VisualReviewReport
-> VisualFixPlan
-> ApprovedFrame
-> Player Display Gate
```

## 4. 正式目录结构

正式视觉目录只允许使用 `src/world/world-visual-painter`。

```txt
src/world/world-visual-painter/
  index.ts
  world-visual-painter-schema.ts
  world-visual-painter-gateway.ts
  authorized-data/
  visual-fact-manifest/
  scene-intent/
  composition-plan/
  terrain-plan/
  asset-plan/
  motion-plan/
  prompt-package/
  ai-image-provider/
  ai-image-candidate/
  visual-review/
  visual-fix/
  approved-frame/
  visual-rule-dataset/
  visual-target-policy/
```

职责划分：

- `authorized-data`：登记允许训练、提炼规则或提示参考的数据来源和授权状态。
- `visual-fact-manifest`：从 `WorldRuntimeSaveRecord` 提取视觉可读事实清单。
- `scene-intent`：决定当前画面的故事焦点和必须表达的世界事实。
- `composition-plan`：制定主焦点、前景、中景、背景和边缘包围。
- `terrain-plan`：制定草地、路径、水岸、高差等地形表达。
- `asset-plan`：制定建设资产、自然资产、材料资产和占位禁止规则。
- `motion-plan`：制定后续人物、动物、施工、水面、树叶等动态层。
- `prompt-package`：把世界事实和视觉规则整理成 AI 图像生成输入。
- `ai-image-provider`：读取图像生成供应商配置并构建生成请求。
- `ai-image-candidate`：登记隐藏的 AI 位图候选图。
- `visual-review`：审核事实一致性、视觉质量和原创安全。
- `visual-fix`：生成只修视觉表达、不改世界事实的修正计划。
- `approved-frame`：只代表审核通过后的可展示画面。

## 5. 视觉审核边界

视觉审核只检查表达质量、事实一致性和原创安全，可以生成视觉修正计划。

视觉审核不能：

- 修改 runtime 事实。
- 添加不存在的建筑、角色、道路、资源或事件。
- 展示未通过审核的 frame。

当前展示门禁：

```txt
pass -> display
warn -> block
fail -> block
```

## 6. 当前 UI 边界

当前正式 `/world` 页面是世界优先入口：

- 不做 dashboard。
- 不做右侧卡片。
- 不做管家状态 UI。
- 不做 P-Phone UI。
- 通过审核前不展示 debug panel。
- 没有 ApprovedFrame 时只展示中文阻断页。

## 7. 正式入口

- `/world`：正式只读世界显示入口。
- `/create-world`：世界创建入口。
- `/api/world/tick`：显式 runtime tick 入口。
