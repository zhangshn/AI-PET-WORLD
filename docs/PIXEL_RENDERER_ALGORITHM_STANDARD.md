# AI-PET-WORLD 像素资产算法生成标准

> 本文档是 AI-PET-WORLD 后续像素世界、规则资产库、主世界渲染、调试页面和 Codex 开发任务的硬性执行标准。
>
> 核心结论：`src/world/procedural-painter/scene-composer/scene-svg-renderer.ts` 不是一次性的 debug 画图实验，而是 AI-PET-WORLD 像素资产生成范式的原型。后续所有像素资产，都必须按这个算法逻辑扩展。

---

## 1. 背景结论

AI-PET-WORLD 当前不走“大数据训练生成美术图”的路线。

当前阶段采用的是：

```txt
规则资产库
+ 对象参数模型
+ 世界事实
+ 稳定 seed
+ 生态状态
+ 痕迹反馈
+ 分层 renderer
= 可解释、可复现、可长期演化的像素世界
```

前期在 `/world-debug/pixel-scene-composer` 页面验证出的森林场景不是单纯为了做一个漂亮 debug 图，而是为了确认后续世界画法的基本范式：

```txt
世界事实 / 规则参数
→ 生成对象参数
→ renderer 分层绘制
→ 形成像素世界表现
```

因此，后续不能再把像素资产理解成：

```txt
单张 PNG
CSS 图形
SVG 临时图
手写几个 rect 的占位符
资产库一套画法，主世界另一套画法
```

必须统一为：

```txt
对象参数 + 同源 renderer 算法
```

---

## 2. 核心文件定位

当前算法原型文件：

```txt
src/world/procedural-painter/scene-composer/scene-svg-renderer.ts
```

该文件的意义不是“debug 页面专用 SVG 文件”。

它代表的是：

```txt
AI-PET-WORLD 像素对象如何被算法画出来的第一套成熟范式
```

后续可以把 SVG renderer 抽象、迁移、拆分成 shared renderer 或 canvas renderer，但不能丢掉它的算法逻辑。

正式主世界 `/world` 不应该直接依赖 debug 页面，也不应该把 SVG 作为最终主世界技术路线；但主世界、资产库、调试页都应该遵守同一套算法思想。

---

## 3. 总体原则

### 3.1 资产不是图片，资产是 renderer

错误理解：

```txt
tree = 一张树图片
butler = 一张管家图片
stone = 一张石头图片
```

正确理解：

```txt
tree = SceneObject 参数 + renderTree()
bush = SceneObject 参数 + renderBush()
stone = SceneObject 参数 + renderStone()
flower = SceneObject 参数 + renderFlower()
mushroom = SceneObject 参数 + renderMushroom()
insect_signal = SceneObject 参数 + renderInsectSignal()
butler = SceneActor / SceneObject 参数 + renderButler()
```

### 3.2 单个资产必须可参数化

任何像素资产都不允许只是固定图形。

至少应该能接受这些参数的一部分：

```txt
kind
x
y
scale
layer
health
age
stressLevel
growthStage
ecologyRole
moistureAffinity
traceSensitivity
ecologyHealth
pose
mood
task
```

参数变化后，资产表现也应该自然变化。

例如树：

```txt
health 高 → 树冠更饱满，亮部更多
stressLevel 高 → 暗部增加，树冠收缩
age 高 → 树干更粗或更高
growthStage 不同 → 幼树、成熟树、衰退树外形不同
scale 不同 → 尺寸稳定缩放
```

### 3.3 同一资产不能有两套互相冲突的画法

禁止出现：

```txt
组合场景里的 tree 是一套算法
资产库右侧预览的 tree 是另一套手画算法
/world 里的 tree 又是一套 canvas 方块算法
```

所有入口都必须同源：

```txt
同一对象参数
→ 同一类 renderer 逻辑
→ 不同容器展示
```

允许技术输出不同：

```txt
Debug 可以用 SVG 预览
正式 /world 可以用 Canvas 渲染
未来可以用 PixiJS
```

但不允许算法逻辑不同。

---

## 4. 当前已验证的标准范式：树

树是当前最明确的资产标准。

树不是手画图标，而是：

```txt
SceneObject(kind="tree")
+ health
+ age
+ stressLevel
+ growthStage
+ scale
+ layer
        ↓
renderObjectShadow()
renderTree()
renderLeafCluster()
        ↓
像素树
```

### 4.1 树的生成参数

树对象应该具备：

```txt
kind: tree
x: number
y: number
scale: number
layer: back | middle | front
health: number
age: number
stressLevel: number
growthStage: young | mature | declining | recovering 等
ecologyRole: canopy / shelter 等
moistureAffinity: number
traceSensitivity: number
ecologyHealth: number
```

这些参数来自：

```txt
worldSeed
spaceGrid
biome
ecologyHealth
moisture
traceField
naturalGrowth
spacePressure
```

### 4.2 树的渲染层次

树的 renderer 必须按层次绘制：

```txt
1. object shadow
2. trunk dark
3. trunk main
4. trunk highlight
5. leaf under / canopy underside
6. leaf dark / back mass
7. leaf main / primary crown
8. leaf highlight
9. optional foreground grass / overlap
```

树冠不能是一个大方块。

树冠必须由多个 leaf cluster 叠出：

```txt
renderLeafCluster(rows)
```

其中 rows 类似：

```txt
[5, 13, 22, 28, 27, 20, 9]
```

renderer 根据 rows 逐行绘制不同宽度的横向像素块，形成不规则树冠轮廓。

### 4.3 树的视觉标准

合格树必须满足：

```txt
能看出树冠层次
有树冠暗部
有树冠亮部
有不规则边缘
树干有明暗
树下有阴影
整体站在地面上
小尺寸下也能一眼认出是树
```

不合格树：

```txt
绿色方块 + 棕色竖条
单色树冠
没有底部阴影
没有树干层次
没有亮部暗部
看起来像图标占位符
```

---

## 5. 其他自然资产必须按同一范式扩展

### 5.1 灌木 bush

灌木不应该是一团随便画的绿色块。

应该是：

```txt
SceneObject(kind="bush")
+ health
+ stressLevel
+ scale
+ ecologyRole
        ↓
renderBush()
→ renderLeafCluster()
```

灌木需要：

```txt
底部阴影
深色叶簇
主叶簇
亮部叶簇
不规则边缘
```

### 5.2 石头 stone

石头应该是：

```txt
SceneObject(kind="stone")
+ scale
+ stressLevel
+ layer
        ↓
renderStone()
```

石头需要：

```txt
底部阴影
主体灰色块
顶部高光
轻微不规则轮廓
```

### 5.3 花 flower

花应该是：

```txt
SceneObject(kind="flower")
+ health
+ stressLevel
+ scale
        ↓
renderFlower()
```

花需要：

```txt
茎
叶
左花瓣
右花瓣
顶部花瓣
中心点
```

生态健康越高，花可以更亮、更完整。

### 5.4 蘑菇 mushroom

蘑菇应该是：

```txt
SceneObject(kind="mushroom")
+ moistureAffinity
+ scale
+ ecologyHealth
        ↓
renderMushroom()
```

蘑菇需要：

```txt
菌柄
菌盖
菌盖亮点
底部阴影
```

### 5.5 小生态信号 insect_signal

小生态信号不是装饰点，而是生态活性的可视化。

应该是：

```txt
SceneObject(kind="insect_signal")
+ ecologyHealth
+ moistureAffinity
        ↓
renderInsectSignal()
```

表现为：

```txt
小亮点
小飞虫点
微弱生态活动提示
```

透明度和密度可以由 ecologyHealth 影响。

---

## 6. 管家资产必须升级为 renderer，而不是占位 actor

当前 Scene Composer 的 actor renderer 仍偏占位。

后续不能把当前简化 actor 当成正式管家资产。

管家必须按树的模式升级：

```txt
SceneActor / SceneObject(kind="butler")
+ pose
+ mood
+ task
+ facing
+ energy
+ tool
+ scale
+ layer
        ↓
renderButler()
```

### 6.1 管家 renderer 分层

`renderButler()` 应至少包含：

```txt
1. shadow
2. legs
3. shoes / feet
4. body / coat
5. arms
6. hands
7. head
8. hair
9. face / eyes
10. pose item / tool / notebook / phone
```

### 6.2 管家姿态参数

管家姿态不是换文案，而是 renderer 参数：

```txt
pose = observe
→ 身体微侧
→ 手部抬起
→ 可出现观察板 / 记录板 / P-Phone

pose = wait
→ 稳定站姿
→ 手放低
→ 动作安静

pose = maintain
→ 手部向前
→ 可出现工具 / 清理动作

pose = walk
→ 腿部错位
→ 身体轻微前倾

pose = idle
→ 基础站姿
```

### 6.3 管家标准

不合格管家：

```txt
蓝色方块人
几块 rect 拼出的人形占位
没有头发、脸、手、姿态差异
observe / wait / maintain 看起来几乎一样
```

合格管家：

```txt
小尺寸下能认出是管家
有头身结构
有服装结构
有姿态差异
有动作语义
能和世界场景融合
```

---

## 7. 后续宠物资产也必须走 renderer 模式

宠物不能直接贴图，也不能默认显示。

宠物必须等世界事实中存在正式宠物 actor 后，才允许进入主世界渲染。

宠物资产范式：

```txt
ScenePetActor
+ species
+ bodyShape
+ ageStage
+ mood
+ pose
+ energy
+ trustState
+ health
+ scale
+ layer
        ↓
renderPet()
```

宠物 renderer 应拆成：

```txt
shadow
body
ear
tail
legs
face
eyes
emotion mark
pose offset
```

禁止：

```txt
没有宠物事实时默认画宠物
用测试宠物占位冒充正式宠物
```

---

## 8. 建筑与设施也必须参数化

后续房屋、医院、公园、家具、设施，都不能直接手画单图。

应该走：

```txt
SceneStructure / SceneFacility
+ type
+ level
+ constructionProgress
+ condition
+ material
+ usageTrace
+ scale
+ layer
        ↓
renderStructure()
/ renderFacility()
```

例如房屋：

```txt
foundation
wall
roof
door
window
shadow
construction marks
```

医院：

```txt
base
wall
roof
sign
door
window
medical marker
shadow
```

设施状态也应影响表现：

```txt
constructionProgress 低 → 半成品
condition 差 → 暗色 / 裂痕 / 杂草
usageTrace 高 → 周围有路径 / 压草 / 磨损
```

---

## 9. 地面与痕迹资产标准

地面不是单一绿色底图。

地面由 tile renderer 生成：

```txt
SceneTile
+ kind
+ variant
+ visualKind
+ traceVisualIntensity
+ traceVisualSource
+ traceVisualStage
        ↓
renderTile()
renderTileDecorations()
```

### 9.1 地面类型

至少包括：

```txt
grass
pressed_grass
worn_grass
exposed_soil
ecology_transition
recovery_growth
soil
built
boundary
```

### 9.2 痕迹不是装饰

痕迹必须来自世界运行结果：

```txt
TraceField
TraceLifecycle
TraceInfluence
MemorySeed
movement history
spatial use history
butler attention history
```

痕迹表现：

```txt
草被压低
草地磨损
裸土出现
恢复痕迹
维护痕迹
等待点
关注点
```

禁止：

```txt
为了好看随便画路径
先画路径再假装世界走过
```

正确顺序：

```txt
世界运行产生痕迹事实
→ traceField 记录
→ tile visualKind 改变
→ renderer 表现
```

---

## 10. 资产库页面标准

资产库页面：

```txt
/world-debug/pixel-scene-composer
```

定位：

```txt
规则资产库
+ 像素组合实验室
+ renderer 预览工作台
```

资产库允许 debug、允许 SVG 预览、允许参数调节。

但必须遵守：

```txt
资产预览必须使用同源 renderer
不能手写另一套临时 canvas 图
不能用占位图冒充正式资产
不能把 debug 页面逻辑直接塞进 /world
```

点击资产时，应显示：

```txt
资产名称
所属图层
规则来源
接入边界
同源 renderer 生成的预览
```

例如点击 tree：

```txt
SceneObject(kind="tree")
→ renderTree()
→ renderLeafCluster()
→ 资产预览
```

不能：

```txt
点击 tree
→ drawSceneQualityTree()
→ 手画像素树
```

---

## 11. 正式 /world 页面标准

正式 `/world` 是世界展示页，不是 debug 页面。

正式链路：

```txt
WorldRuntimeSaveRecord
+ HomeMapState
+ SpaceGrid
+ TraceField
+ ButlerState
        ↓
WorldViewModel
        ↓
PixelWorldView
```

正式 `/world` 不应该：

```txt
直接依赖 /world-debug 页面
直接使用 debug UI
直接写 runtime save
直接推进 tick
默认生成宠物
绕过 SafeApply 写世界事实
```

正式 `/world` 可以使用从 Scene Composer 沉淀出来的规则：

```txt
object generation rules
tile rules
trace visual rules
renderer rules
layer sorting rules
```

但必须以正式架构承载：

```txt
Scene Composer 原型规则
→ rule assets / renderer assets
→ WorldViewModel
→ PixelWorldView
```

---

## 12. SVG、Canvas、PixiJS 的关系

当前 `scene-svg-renderer.ts` 使用 SVG 是实验阶段的实现形式。

重点不是 SVG。

重点是它里面的算法：

```txt
对象参数
分层绘制
leaf cluster
shadow
highlight
health/stress/growth 参数影响视觉
```

未来可以迁移为：

```txt
Canvas renderer
PixiJS renderer
sprite batch renderer
shader / tile layer renderer
```

但迁移时必须保持同一套算法语义。

错误迁移：

```txt
SVG 里树很好
Canvas 里重新画一个方块树
```

正确迁移：

```txt
抽出 renderTree 的参数和绘制步骤
SVG / Canvas / PixiJS 分别实现同一 renderer contract
```

---

## 13. 后续开发硬性红线

### 13.1 禁止手画占位资产冒充正式资产

禁止：

```txt
drawFakeTree()
drawPlaceholderButler()
drawSceneQualityTree() 但不走正式 renderer
green block + brown line 作为 tree
blue block person 作为 butler
```

### 13.2 禁止资产库和主世界使用不同算法

任何资产如果在资产库和主世界表现不同，必须判定为错误。

### 13.3 禁止只看组合场景，不沉淀单个模块 renderer

组合场景只是结果。

真正要沉淀的是：

```txt
renderTree
renderBush
renderStone
renderFlower
renderMushroom
renderInsectSignal
renderButler
renderPet
renderStructure
renderFacility
renderTrace
renderTile
```

### 13.4 禁止把 renderer 当静态美术

renderer 必须接受参数。

如果一个资产不能被参数影响，就不是合格资产。

### 13.5 禁止默认生成不存在的生命

尤其是宠物：

```txt
没有宠物事实 → 不显示宠物
有宠物事实 → renderPet()
```

---

## 14. 推荐目录演进

当前原型：

```txt
src/world/procedural-painter/scene-composer/scene-svg-renderer.ts
```

未来建议抽象为：

```txt
src/world/pixel-renderer/
  renderer-contract.ts
  palette.ts
  draw-rect.ts
  render-tile.ts
  render-trace.ts
  render-tree.ts
  render-bush.ts
  render-stone.ts
  render-flower.ts
  render-mushroom.ts
  render-insect-signal.ts
  render-butler.ts
  render-pet.ts
  render-structure.ts
  render-facility.ts
  layer-sort.ts
```

如果仍然保留 SVG debug：

```txt
src/world/procedural-painter/scene-composer/scene-svg-renderer.ts
```

则它应该调用 shared renderer rules，而不是另起一套。

---

## 15. 下一步执行模块

### 15.1 模块一：SCENE-COMPOSER-ASSET-PREVIEW-SAME-RENDERER-00

目标：

```txt
修正规则资产库右侧预览。
资产库预览必须使用 Scene Composer 同源 renderer。
删除或废弃手写 canvas tree / butler 预览。
```

验收：

```txt
点击 tree → 使用 renderTree / renderLeafCluster 风格
点击 bush → 使用 renderBush 风格
点击 stone → 使用 renderStone 风格
点击 flower → 使用 renderFlower 风格
点击 mushroom → 使用 renderMushroom 风格
点击 insect_signal → 使用 renderInsectSignal 风格
点击 butler → 不再使用蓝色方块人
```

### 15.2 模块二：SCENE-COMPOSER-BUTLER-RENDERER-00

目标：

```txt
新增 renderButler()
替换当前简陋 renderActor()
```

验收：

```txt
observe / wait / maintain / walk / idle 有可见姿态差异
管家不再是方块人
管家有头、身体、服装、手、腿、阴影
```

### 15.3 模块三：PIXEL-RENDERER-SHARED-CONTRACT-00

目标：

```txt
抽象 renderer contract。
让 SVG / Canvas / 未来 PixiJS 可以共享同一套资产算法语义。
```

验收：

```txt
tree / bush / stone / flower / mushroom / butler 的 renderer 不再散落在 debug 页面里。
```

### 15.4 模块四：FORMAL-WORLD-USES-SAME-ASSET-RENDERER-00

目标：

```txt
正式 /world 的 PixelWorldView 使用同源资产 renderer。
不能再用另一套简化 drawTree / drawActor。
```

验收：

```txt
/world 里的树和 /world-debug/pixel-scene-composer 里的树风格一致
/world 里的管家和资产库预览风格一致
主世界仍然不写 runtime，不推进 tick
```

---

## 16. Codex 执行提示词模板

后续给 Codex 的任务必须包含这段红线：

```txt
本任务必须遵守 docs/PIXEL_RENDERER_ALGORITHM_STANDARD.md。

特别注意：
src/world/procedural-painter/scene-composer/scene-svg-renderer.ts 是当前像素资产算法范式原型。
后续像素资产必须按“对象参数 + 分层 renderer”方式生成。
禁止手写另一套占位图。
禁止资产库、debug 页面和正式 /world 使用不同资产算法。
如果要迁移 SVG 到 Canvas/PixiJS，只能迁移 renderer 语义，不能重画一套不同风格的假资产。
```

---

## 17. 一句话总标准

```txt
AI-PET-WORLD 的像素资产不是画出来的图片，
而是由世界事实、对象参数、生态状态、痕迹反馈和同源 renderer 算出来的像素生命世界。
```
