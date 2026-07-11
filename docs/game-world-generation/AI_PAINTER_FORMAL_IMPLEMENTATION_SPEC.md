# AI Painter 正式实现规格

更新时间：2026-07-11 12:32:00 +08:00

状态：active-architecture / 当前完整世界视觉实现唯一规格 / 真实完整地图推理仍阻断

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 定位与边界

AI Painter 是 AI-PET-WORLD 的完整世界视觉生产系统。它在世界事实、视觉事实清单、世界导演和地图结构约束下，使用项目本地模型生成本轮完整地图新候选。

AI Painter 不决定世界中有什么，不决定道路是否可走、对象是否碰撞、世界如何生长，也不能用图片反推正式世界事实。局部材料、对象图和过渡图只是内部能力，不能代表完整 AI Painter。

## 2. 唯一正式链路

```text
WorldFacts
-> VisualFactManifest
-> World Director
-> CompleteWorldVisualTaskPackage
-> Visual Condition Compiler
-> Local Complete-World Inference
-> Fresh Complete-Map Candidate
-> VJ-0 / VJ-1 / VJ-2 / Professional Aesthetic Gate
-> Owner Final Review
-> GameMapRuntimeFrame
-> /world
```

任何缺失环节都必须阻断。旧图选择、复制、放大，局部 crop、材料槽输出和程序占位图均不能冒充本轮完整地图推理。

## 3. VisualFactManifest

VisualFactManifest 只保存本轮画面需要的事实，并绑定 `manifestId`、`worldId`、`tick`、`dictionaryVersion`、来源 RuntimeFrame 和事实 hash。

当前允许类别：

```text
terrainFacts
waterFacts
pathFacts
shorelineFacts
vegetationFacts
objectFacts
spatialFacts
ecologyFacts
lightingFacts（存在真实事实时）
runtimeVisualStateFacts（当前范围允许时）
```

当前必须排除：管家、人格、玩家、建筑、施工、动物、昆虫和交互实现事实。缺失时间、天气或光照事实时必须显式记录缺失，不得由实现猜测。

每条视觉事实至少包含：`factId`、`factType`、`worldId`、`tick`、几何或空间关系、视觉意义、优先级、允许变化和禁止改变内容。

## 4. 世界导演

世界导演根据当前 VisualFactManifest、地图结构、视觉字典和历史失败生成结构化计划，不使用固定场景模板，也不只输出一段 prompt。

导演输出至少包含：

```text
sceneIntent
compositionPlan
focalHierarchy
terrainPlan
ecologyPlan
transitionPlan
objectPlan
lightingPlan
colorScript
detailDensityPlan
negativeSpacePlan
failureAvoidancePlan
reviewPlan
```

水体方向、道路阅读顺序、树木密度、中心位置和过渡关系必须来自当前事实与结构。导演不得新增世界中不存在的对象。

## 5. 视觉条件编译器

条件编译器把任务包和导演输出转换为模型可消费的张量与向量。数据字典不能只约束 Markdown 和审核器。

| 条件层 | 当前允许字段 |
|---|---|
| 大尺度结构 | terrain class、water body、path topology、shoreline、walkable、collision、depth、focal area |
| 中尺度生态 | open/wet/trampled/shadow grass、wet mud、dense boundary、quiet area、detail cluster |
| 自然过渡 | grass-path、grass-water、water-shore、tree-ground、rock-ground、wet-dry、shadow-light 距离图 |
| 对象与接地 | instance、type、footprint、height、contact shadow、ground disturbance、occlusion order |
| 视觉控制 | camera、light direction、palette、material density、edge softness、detail budget、style version |

二值 Mask 继续用于结构约束；距离图、实例图和连续值图负责表达过渡宽度、方向、湿度、接地和遮挡。字段只有在字典和任务包中正式定义后才能进入模型。

## 6. 模型能力边界

模型按能力分层，但不提前写死必须存在七个独立模型。实现可以在行为测试证明等价时合并能力。

| 能力 | 职责 | 当前约束 |
|---|---|---|
| 结构基础能力 | 学习草、水、道路、岸线和对象的大结构位置 | 低分辨率只用于结构预训练，不是正式画面 |
| 中尺度组织能力 | 学习湿草、踩踏、树荫、边界密植、留白和细节聚集 | 必须在未见结构上验证 |
| 自然过渡能力 | 学习地形、湿度、明暗和对象接地的连续变化 | 不能退化为硬切贴片 |
| 对象视觉能力 | 生成对象、接触关系、阴影和遮挡证据 | 对象不得漂浮、错位或遮挡路径 |
| 完整画面统一能力 | 统一构图、光照、色彩、边缘、锐度和材质语言 | 必须输出本轮完整地图候选 |
| 分辨率提升能力 | 原生输出正式尺寸，或使用项目本地训练的提升模型 | 禁止 nearest-neighbor 放大冒充生成 |
| 审核学习能力 | 学习通过/拒绝、排序、失败区域和历史回归 | 机器通过不能替代人工终审 |

模型数量、网络类型、参数量和分辨率递进由实验与验收决定，不允许仅因文档示例写死。

## 7. 验证体系

训练集、验证集、挑战集和历史回归集必须按图片 hash 与结构 hash 隔离。

| 集合 | 用途 |
|---|---|
| train | 更新模型权重 |
| validation | 选择 checkpoint，不参与训练 |
| unseen-structure challenge | 验证未见道路、水岸、对象位置和区域组合 |
| regression | 阻止灰绿迷彩、胶带路、岸线硬切、对象贴纸、模糊和重复纹理复发 |

模型晋级必须证明：事实一致、结构正确、视觉质量提升、历史失败减少，并且不是通过降低阈值获得通过。

## 8. 当前实现状态

| 组件 | 状态 |
|---|---|
| VisualFactManifest | 已实现 |
| 动态世界导演与任务包 | 已实现 |
| 视觉条件编译器 | 未实现 |
| 当前任务包驱动的完整地图推理 | 未实现 |
| 原生正式分辨率新候选 | 未实现 |
| 专业审美学习模型 | 未闭合 |

当前不得继续 V152、V153 式旧数据集盲目续训。下一实现目标只能来自当前执行指南。

## 9. 禁止事项

1. 禁止建立“项目内部视觉教师”或其他新名词，让程序直绘图承担专业视觉教师。
2. 禁止把程序纹理、SVG、Canvas、CSS、几何图或规则渲染图计为专业完整地图正样本。
3. 禁止复用旧 `generated.png`、旧 RuntimeFrame 或放大图冒充本轮推理。
4. 禁止局部材料模型取得完整地图主入口地位。
5. 禁止写死未经实验确认的模型数量、数据规模和工期。
6. 禁止第三方在线绘图 API 进入正式链路。

