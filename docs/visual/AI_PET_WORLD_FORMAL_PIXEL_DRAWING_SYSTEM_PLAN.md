# AI-PET-WORLD｜正式像素画图系统方案

> 本文档用于定义 AI-PET-WORLD MVP 阶段的正式像素画图系统。
>
> 本方案不是 Debug 页面说明，也不是单个 renderer 的接口文档，而是规定：世界中的树、草、昆虫、石头、管家、未来宠物、建筑和场景，应该如何从规则、语义结构、像素形状和像素块逐层生成。
>
> 本方案继承 V2.6 总架构中“世界由规则、坐标、生态、生命、痕迹和时间线共同生成”的总原则，并进一步明确正式绘制路线。

---

## 1. 核心结论

AI-PET-WORLD 的正式画图系统不走“AI 生图直接出图”路线。

MVP 阶段采用：

```txt
世界事实
→ 语义结构
→ 像素形状
→ 像素块
→ 场景拼接
→ 正式主世界显示
```

也就是：

```txt
不是让 AI 凭空画一张图。
而是让世界状态通过规则和结构，稳定地生成可复现的像素画面。
```

---

## 2. 画图系统的总原则

### 2.1 保留当前已验证算法

当前已经验证有效的树算法、地面算法和场景组合算法不能被推翻。

尤其是：

```txt
scene_composer_tree_recipe
formal_ground_recipe_v1
layer + anchor + bounds + y-sort 场景拼接逻辑
```

这些应作为当前 Golden Recipe / Golden Composition 的基础。

新方案不是重写它们，而是：

```txt
保留当前有效算法
→ 拆解它为什么有效
→ 抽象出语义结构、像素形状和部件规则
→ 让未来新物种按同一套视觉语法扩展
```

### 2.2 像素块不是起点，而是最终输出语言

之前直接从“小方块”硬拼物体，效果容易变差。

原因是：

```txt
只有小方块，没有语义结构，就会变成噪点和拼贴。
```

正确顺序是：

```txt
语义结构决定像不像。
像素形状决定如何像素化。
像素块决定最终怎么显示。
```

### 2.3 /world 不负责发明画法

正式 `/world` 页面只负责读取世界状态并显示画面。

`/world` 不能直接写新的树、草、昆虫、管家或建筑画法。

正确流程：

```txt
/world-debug/pixel-visual-lab 验证单体
→ Debug 验证组合
→ 形成 recipe / composer
→ /world 只调用稳定算法
```

### 2.4 不同入口不得各画一套

同一个对象必须统一算法来源。

例如树木：

```txt
树木单体预览
场景组合里的树
/world 里的树
```

必须共用同一套 tree recipe。

禁止再次出现：

```txt
Debug 一套
场景一套
/world 一套
```

---

## 3. 三层核心绘制逻辑

正式画图的底层是三层：

```txt
语义结构
→ 像素形状
→ 像素块
```

### 3.1 语义结构

语义结构是物体在变成像素之前的结构说明书。

它定义：

```txt
这个东西是什么
它由哪些部件组成
这些部件之间是什么关系
它的锚点在哪里
它的上下前后关系是什么
哪些部件必须存在
哪些部件禁止出现
```

例如树：

```txt
Tree
├─ anchor: root_bottom
├─ shadow: 在 root_bottom 下方
├─ trunk: 从 root_bottom 向上
├─ trunk_light: 在树干侧边
├─ crown_dark: 树冠后层暗部
├─ crown_main: 树冠主体
├─ crown_highlight: 树冠上方高光
└─ crown_under: 树冠底部暗部
```

例如昆虫：

```txt
Insect
├─ anchor: body_center
├─ body: 身体主体
├─ head: 身体前方
├─ wings: 身体左右
├─ legs: 身体两侧或下方
├─ antenna: 头部前上方
└─ highlight: 身体或翅膀小高光
```

例如管家：

```txt
Butler
├─ anchor: feet_center
├─ shadow: 脚底下方
├─ legs: 从 feet_center 向上
├─ body: 腿上方
├─ cloth: 覆盖身体
├─ arms: 身体左右
├─ head: 身体上方
├─ hair_or_hat: 头部上方
└─ accessory: 可选配饰
```

### 3.2 像素形状

像素形状是语义部件的像素化表达。

它不是最小方块，而是有意义的小形状。

第一批基础形状：

```txt
leaf_row          叶子横条
leaf_cluster      叶团
trunk_strip       树干条
grass_chip        草点
soil_chip         土点
corner_chip       角块
stair_chip        阶梯块
shadow_patch      投影块
highlight_chip    高光碎片
wing_chip         昆虫翅膀块
leg_line          昆虫腿线
body_cluster      小身体块
cloth_panel       服装块
head_block        头部块
```

### 3.3 像素块

像素块是最终输出语言。

它对应 SVG / Canvas / PixiJS 中的最小绘制指令。

基础字段：

```ts
PixelBlock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  layer: string
}
```

基础类型：

```txt
square_block        正方块
wide_block          横条块
tall_block          竖条块
dot_block           点块
line_block          细线块
shadow_block        阴影块
highlight_block     高光块
dark_block          暗部块
transparent_block   半透明块
noise_block         噪点块
```

---

## 4. 为什么不能只做像素块库

只做像素块库会导致：

```txt
没有轮廓
没有重心
没有比例
没有部件关系
没有锚点
没有识别度
```

最终容易变成：

```txt
一堆颜色块
一团噪点
不像树、不像昆虫、不像管家
```

所以像素块库必须建立在语义结构和像素形状之上。

正确关系：

```txt
语义结构 = 像不像
像素形状 = 怎么像素化
像素块 = 怎么显示
```

---

## 5. 侵权边界

语义结构本身通常不是侵权风险来源。

例如：

```txt
树有树干、树冠、阴影
昆虫有身体、头、翅膀、腿
人形角色有头、身体、手、脚
房子有屋顶、墙、门、窗
```

这些属于通用现实结构或通用概念。

真正的风险来自复制第三方作品的独特表达，例如：

```txt
复刻某个商业游戏的树的具体轮廓、配色、比例和像素排列
复刻某个知名角色的发型、服装、配色、姿势和轮廓
复刻某个游戏 UI 的布局、按钮、字体、图标和交互样式
做成“像素版某知名 IP”
```

安全原则：

```txt
使用通用现实语义结构
使用自有 palette
使用自有 recipe
使用自有像素形状
使用自有场景拼接规则
不复刻第三方独特表达
```

---

## 6. 正式画图系统分层

正式画图系统分为九层：

```txt
1. Pixel Style Foundation      像素风格基础规范
2. Semantic Structure Library  语义结构库
3. Pixel Shape Library         像素形状库
4. Pixel Primitive Library     像素块库
5. Pixel Part Library          物体部件库
6. Pixel Object Recipe         物品 / 物种生成规则
7. Scene Composition           场景拼接算法
8. Pixel Visual Learning       反馈学习与权重调整
9. Formal Pixel Renderer       正式主世界渲染
```

MVP 第一版先做前六层的 Debug 验证，不直接接 `/world`。

---

## 7. Pixel Style Foundation

这一层定义整个像素世界的风格基础。

它不画具体对象，只定义：

```txt
像素单位
色板
阴影规则
高光规则
透明度规则
层级规则
尺寸规则
命名规则
```

建议字段：

```txt
pixelUnit: 2 / 4 / 8
palette: grass / leaf / trunk / soil / stone / shadow / highlight / cloth / skin
layer: ground / trace / shadow / object / actor / atmosphere / overlay
opacity: 透明度使用规则
scaleRange: 各类对象尺寸范围
```

目的：

```txt
让所有东西像同一个游戏。
```

---

## 8. Semantic Structure Library

这一层定义物体的意义结构。

第一批结构：

```txt
TreeSemanticStructure
GrassTileSemanticStructure
StoneSemanticStructure
InsectSemanticStructure
ButlerSemanticStructure
```

每个结构至少包含：

```txt
kind
anchor
requiredParts
optionalParts
forbiddenParts
partRelations
boundsRule
scaleRule
paletteRole
layerRule
validationRule
```

### 8.1 TreeSemanticStructure

```txt
anchor: root_bottom
requiredParts: shadow, trunk, crown_main
optionalParts: trunk_light, crown_dark, crown_highlight, crown_under
forbiddenParts: grass, ground, flower, insect
```

### 8.2 InsectSemanticStructure

```txt
anchor: body_center
requiredParts: body, head
optionalParts: wings, legs, antenna, highlight
sizeLimit: small_creature
```

### 8.3 ButlerSemanticStructure

```txt
anchor: feet_center
requiredParts: shadow, legs, body, head
optionalParts: cloth, arms, hair_or_hat, accessory
sizeLimit: actor
```

---

## 9. Pixel Shape Library

这一层定义可复用像素形状。

第一批：

```txt
leaf_row
leaf_cluster
trunk_strip
shadow_patch
highlight_chip
grass_chip
soil_chip
worn_strip
pressed_mark
stone_cluster
wing_chip
leg_line
antenna_line
body_cluster
head_block
cloth_panel
arm_strip
leg_strip
```

这些形状可以被不同对象复用。

例如：

```txt
leaf_row 可以用于树冠和灌木。
shadow_patch 可以用于树、石头、昆虫、管家。
highlight_chip 可以用于树叶、石头、昆虫翅膀、管家衣服。
```

---

## 10. Pixel Primitive Library

这一层定义最底层像素块。

第一批：

```txt
square_block
wide_block
tall_block
dot_block
line_block
shadow_block
highlight_block
dark_block
transparent_block
noise_block
```

但注意：

```txt
Primitive 是绘制终点，不是审美起点。
```

---

## 11. Pixel Part Library

这一层定义对象部件。

### 11.1 树木部件

```txt
tree_shadow
tree_trunk
tree_trunk_light
tree_crown_dark
tree_crown_main
tree_crown_highlight
tree_crown_under
```

### 11.2 草地部件

```txt
ground_base
grass_detail
soil_detail
pressed_mark
worn_mark
recovery_mark
```

### 11.3 石头部件

```txt
stone_shadow
stone_body
stone_dark_edge
stone_highlight
```

### 11.4 昆虫部件

```txt
insect_body
insect_head
insect_wing
insect_leg
insect_antenna
insect_highlight
```

### 11.5 管家部件

```txt
butler_shadow
butler_leg
butler_body
butler_cloth
butler_arm
butler_head
butler_hair_or_hat
butler_accessory
```

---

## 12. Pixel Object Recipe

这一层生成完整对象。

第一批对象：

```txt
tree
grass_tile
stone
insect
butler
```

每个对象必须输出：

```txt
blocks
shapes
parts
anchor
bounds
paletteId
recipeId
recipeVersion
validationResult
```

### 12.1 tree recipe

当前树木继续沿用 `scene_composer_tree_recipe` 作为 Golden Recipe。

后续不是重写，而是拆解为：

```txt
tree semantic structure
→ tree parts
→ leaf_row / trunk_strip / shadow_patch
→ pixel blocks
```

### 12.2 grass recipe

当前地面继续沿用 `formal_ground_recipe_v1`。

后续逐步拆解为：

```txt
ground_base
grass_chip
soil_chip
worn_strip
pressed_mark
recovery_mark
```

### 12.3 insect recipe

昆虫第一版使用部件级 recipe：

```txt
insect_body
+ insect_head
+ optional insect_wing
+ optional insect_leg
+ optional insect_antenna
+ optional insect_highlight
```

### 12.4 butler recipe

管家第一版只做基础模型，不接完整人格视觉差异。

```txt
butler_shadow
+ butler_leg
+ butler_body
+ butler_cloth
+ butler_arm
+ butler_head
+ optional hair_or_hat
```

后续再接：

```txt
管家人格
→ ButlerVisualProfile
→ pose / cloth / accessory / color tendency
```

---

## 13. Scene Composition

场景拼接不是简单把对象画出来。

它负责：

```txt
对象放哪里
谁在前谁在后
谁不能重叠
谁贴地
谁可遮挡谁
画面密度多少
视觉焦点在哪里
```

### 13.1 空间放置依据

```txt
区域类型
地块类型
可通行性
生态状态
痕迹状态
对象 bounds
对象 anchor
密度上限
```

### 13.2 图层顺序

```txt
Tile Layer       地面
Trace Layer      痕迹
Shadow Layer     物体阴影
Object Layer     树 / 石头 / 草丛 / 昆虫
Actor Layer      管家 / 未来宠物
Foreground Layer 前景遮挡
Atmosphere Layer 光照 / 氛围
UI Overlay       P-Phone / 管家解释
```

### 13.3 Y-Sort

物体和角色需要按 y 坐标排序。

```txt
y 越小，越靠后。
y 越大，越靠前。
```

这样才能保证树、石头、管家、未来宠物之间的前后遮挡合理。

---

## 14. Validator

没有大量数据学习时，Validator 是质量底线。

每个对象至少检查：

```txt
是否有 anchor
是否有 bounds
是否使用合法 palette
是否尺寸合理
是否包含必要部件
是否包含禁止部件
是否有 recipeId
是否有 recipeVersion
是否层级合理
```

### 14.1 树木检查

```txt
必须有 trunk
必须有 crown
必须有 shadow
不能包含 grass / ground
树冠必须在树干上方
树冠宽度必须大于树干
```

### 14.2 昆虫检查

```txt
必须有 body
必须有 head
尺寸不能超过 small_creature 上限
腿不能离身体太远
翅膀不能脱离身体
```

### 14.3 管家检查

```txt
必须有 head
必须有 body
必须有 leg
必须有 shadow
不能漂浮
尺寸必须在 actor 范围内
```

---

## 15. Pixel Visual Lab 页面规划

`/world-debug/pixel-visual-lab` 新增：

```txt
像素原型库
```

页面结构：

```txt
像素原型库
├─ Golden Recipe 说明
├─ 语义结构展示
├─ 像素形状展示
├─ 基础像素块展示
├─ 物品生成按钮
│  ├─ 树木
│  ├─ 草地
│  ├─ 石头
│  ├─ 昆虫
│  └─ 管家
├─ 生成预览
├─ 结构摘要
│  ├─ usedSemanticStructure
│  ├─ usedShapes
│  ├─ usedParts
│  ├─ usedBlocks
│  ├─ recipeId
│  └─ recipeVersion
└─ Validator 结果
```

第一版只做：

```txt
点击按钮
→ 生成一个单体
→ 显示它怎么拼出来
→ Validator 判断是否合规
```

不做：

```txt
拖拽编辑
保存到正式世界
接入 /world
学习候选生成
用户 P-Phone 反馈
```

---

## 16. 学习模块位置

学习模块很重要，但不是第一版画图落地的起点。

第二阶段再做：

```txt
生成多个候选
→ 创作者选择 / 否定 / 标记问题
→ 保存反馈样本
→ 调整 recipe 权重草稿
→ Validator 检查
→ Promotion Gate 晋升
```

MVP 学习来源：

```txt
本项目生成的候选
创作者 Debug 反馈
Validator 结果
用户未来通过 P-Phone 对个人世界的反馈
```

禁止学习来源：

```txt
互联网抓图
未授权游戏截图
未授权素材库
第三方平台内容
用户上传图片作为全局训练数据
```

---

## 17. 建议目录架构

第一版新增：

```txt
src/world/pixel-primitives/
├─ pixel-primitive-schema.ts
├─ pixel-style-foundation.ts
├─ semantic-structure-library.ts
├─ pixel-shape-library.ts
├─ pixel-primitive-library.ts
├─ pixel-part-library.ts
├─ pixel-object-recipes.ts
├─ pixel-object-validator.ts
├─ pixel-primitive-svg-renderer.ts
└─ index.ts
```

Debug 页面新增：

```txt
src/app/world-debug/pixel-visual-lab/pixel-primitive-library-panel.tsx
```

第二阶段再新增：

```txt
src/world/pixel-learning/
├─ pixel-learning-schema.ts
├─ pixel-candidate-generator.ts
├─ pixel-feedback-mapper.ts
├─ pixel-recipe-weight-learner.ts
└─ index.ts
```

---

## 18. 执行顺序

```txt
1. 建立正式画图方案文档
2. 建立 pixel-primitives 目录
3. 定义 schema
4. 定义 style foundation
5. 定义 semantic structures
6. 定义 pixel shapes
7. 定义 primitives
8. 定义 parts
9. 定义 object recipes：tree / grass / stone / insect / butler
10. 定义 SVG renderer
11. 定义 validator
12. 在 pixel-visual-lab 加“像素原型库”Tab
13. smoke 检查不读 runtime、不写世界事实、不推进 Tick
14. 创作者检查 Debug 页面效果
15. 再决定是否接学习候选生成
16. 再进入场景拼接算法
17. 最后才接 /world
```

---

## 19. 第一版 smoke 要求

新增 smoke：

```txt
npm run smoke:pixel-primitive-library
```

检查：

```txt
pixel-primitives 目录存在
PixelPrimitiveLibraryPanel 存在
像素原型库 Tab 存在
tree / grass / stone / insect / butler 按钮存在
输出包含 semantic structure / shapes / parts / blocks / recipeId / validator
不读取 runtime
不写世界事实
不推进 Tick
不生成宠物事实
不接正式 /world
```

---

## 20. 当前阶段最终决定

当前阶段先做：

```txt
Pixel Primitive Library v1
```

但它不是单纯的小方块库。

它必须包含：

```txt
Golden Recipe 继承
语义结构
像素形状
像素块
物体部件
对象 recipe
Validator
Debug 单体生成
```

当前不做：

```txt
重写树算法
重写地面算法
学习模块第一版
人物人格视觉差异
正式 /world 接入
第三方 AI 生图
互联网学习
```

一句话：

```txt
我们不是用像素块替代当前算法，
而是把当前算法里已经有效的像素画法沉淀成一套可复用、可验证、可扩展的像素语法。
```
