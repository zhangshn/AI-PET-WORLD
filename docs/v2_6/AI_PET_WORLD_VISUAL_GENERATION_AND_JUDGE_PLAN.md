# AI-PET-WORLD 自主世界视觉生成与视觉判断系统方案

版本：V2.6 当前方案  
日期：2026-06-03  
状态：当前主线方案，旧方案不再保留

## 1. 方案定位

AI-PET-WORLD 的核心不是“玩家摆放物件”的建造游戏，而是一个由 AI 管家和世界规则共同驱动的自主像素世界。

用户通过注册与出生年月日进入系统，出生信息经由紫微斗数映射为管家的长期人格、决策倾向和沟通方式。管家不是被玩家直接控制的角色，而是世界中的自主行动者。玩家通过游戏内 P-Phone 与管家建立关系、提出建议、沟通想法；管家可以接受、调整、延后或拒绝建议。

世界中的内容由以下入口自主生成：

```txt
世界自主生成入口
  ├─ 管家自主建设世界
  ├─ 世界规则自动生成自然、生态、地形
  ├─ 小镇/城市系统自动生成建筑与道路
  ├─ 事件系统自动生成痕迹与变化
  └─ 未来多玩家管家共同生成内容
        ↓
世界生成新内容
        ↓
视觉系统生成画面
        ↓
视觉判断系统审查
        ↓
不合格则生成视觉修正计划
        ↓
只修视觉表达，不篡改世界事实
        ↓
通过后才展示给玩家
```

前期只实现基础自然物体、基础设施和世界画面表达；后期的小镇、城市、道路、公共设施、多人管家共同建设，都必须沿用同一条“世界事实 -> 视觉生成 -> 视觉判断 -> 展示闸门”的主链。

## 2. 核心原则

### 2.1 世界事实优先

画面只能表达世界事实，不能创造世界事实。

例如：如果 runtime 中没有“医院已建成”的事实，视觉系统不能因为画面好看而画出医院。视觉修正系统也不能把“不存在的建筑”改成“存在的建筑”。它只能做视觉层修正，例如缩小、移动、降低密度、替换像素配方或去除错误视觉块。

### 2.2 管家自主性优先

管家的建设行为来自人格、记忆、资源、空间、规则、阶段目标和事件压力。用户建议只是输入，不是命令。

视觉系统必须服务这个自主性：它展示管家的建设结果，而不是把玩家 UI 操作伪装成世界演化。

### 2.3 页面只读，runtime 写入受控

正式 `/world` 页面是只读展示入口：

```txt
WorldRuntimeSaveRecord
-> WorldViewModel
-> VisualGenerationPlan
-> PixelWorldRenderPlan
-> PixelWorldPixelBufferFrame
-> VisualJudgeReport
-> VisualCorrectionPlan
-> Player Display Gate
```

页面不能推进 tick，不能创建默认世界，不能绕过规则写入 runtime。

正式世界变化只能来自经过规则验证的 tick/API/调度链路：

```txt
管家感知
-> 自主动机
-> 意图
-> 世界规则验证
-> SafeApply
-> WorldRuntimeSaveRecord / HomeMapState
```

## 3. 视觉系统总架构

视觉系统分为四层：

### 3.1 Visual Generation：视觉生成层

职责：把世界事实转换为可绘制的视觉语义。

当前已支持的基础对象包括：

- `tree`
- `stone`
- `bush`
- `flower`
- `mushroom`
- `insect_signal`
- `structure`
- `facility`

视觉生成层输出 `VisualGenerationPlan`，其中包含：

- 世界 id、tick、确定性 key
- 对象级像素配方
- 对象迁移状态
- actor sprite 占位
- trace visual 占位
- atmosphere visual 占位
- audit 结果
- tags

当前目标是让所有正式对象尽量走 `object_block`，不再依赖 marker fallback。

### 3.2 Pixel Render Plan：像素渲染计划层

职责：把视觉语义转换为渲染命令。

当前主命令包括：

- `draw_object_block`
- `place_object_recipe`
- trace / atmosphere / tile 等视觉命令

这一层仍然不直接写画布，而是生成稳定、可审计的 render plan。

### 3.3 Pixel Buffer：像素缓冲层

职责：把渲染命令转换为最终像素缓冲数据。

输出是 `PixelWorldPixelBufferFrame`，由 PixiJS 客户端消费。

这一层的价值是让系统可以在真正展示前做程序化检查，例如：

- 是否越界
- 是否出现巨大 debug block
- 是否中心区域被遮挡
- 是否对象可读性不足
- 是否对象密度过高
- 是否出现旧业务禁词或错误标记

### 3.4 PixiJS Player Display：玩家展示层

职责：把已经生成并审查过的像素缓冲展示给玩家。

PixiJS 只消费 `PixelWorldPixelBufferFrame`，不读取 runtime，不推进 tick，不生成默认世界，不手写 canvas 逻辑。

## 4. 视觉判断系统

视觉判断系统是正式展示前的质量闸门。

输入：

```txt
VisualGenerationPlan
PixelWorldRenderPlan
PixelWorldPixelBufferFrame
```

输出：

```txt
VisualJudgeReport
VisualCorrectionPlan
```

### 4.1 VisualJudgeReport

`VisualJudgeReport` 用于判断当前画面是否可以展示给玩家。

字段包括：

- `ok`：是否通过
- `score`：视觉分数
- `severity`：`pass | warn | fail`
- `findings`：问题列表
- `tags`：审查标签

当前检查类别：

- `illegal_debug_visual`：错误 debug 块、大型占位块
- `readability`：对象可读性
- `density`：对象密度
- `composition`：构图与中心遮挡
- `semantic`：语义迁移问题，例如 marker fallback
- `business_rule`：旧业务或禁词泄漏
- `style_safety`：风格/版权安全问题

### 4.2 VisualCorrectionPlan

`VisualCorrectionPlan` 用于描述画面不合格时应该如何修正。

重要边界：

```txt
VisualCorrectionPlan 只能修视觉表达
VisualCorrectionPlan 不能改 runtime facts
VisualCorrectionPlan 不能新增世界事实
VisualCorrectionPlan 不能替管家做建设决策
```

当前修正动作包括：

- `remove_visual_block`
- `reduce_visual_density`
- `resize_visual_object`
- `replace_visual_recipe`
- `reposition_visual_object`
- `promote_actor_sprite`
- `remove_forbidden_visual_token`

所有 action 均要求：

```ts
affectsRuntimeFacts: false
```

## 5. 展示闸门

正式展示规则：

```txt
VisualJudgeReport.ok === true
  -> 允许展示给玩家

VisualJudgeReport.ok === false
  -> 禁止直接展示
  -> 生成 VisualCorrectionPlan
  -> 重新生成或修正视觉表达
  -> 再次审查
```

当前 `/world` 已经具备基础 UI：

- 展示 `Visual Judge`
- 展示视觉分数
- 展示“展示闸门”
- 展示是否允许给玩家看
- 展示问题列表
- 展示视觉修正计划
- 明确提示 runtime facts 不会被视觉修正修改

后续阶段需要把展示闸门从“UI 提示”升级为“正式流程控制”，即不合格画面不能进入最终玩家展示层。

## 6. 真实视觉参考与版权安全

视觉系统需要参考真实网络和现实世界知识，但必须规避侵权风险。

### 6.1 允许的参考方式

允许使用抽象视觉原则，例如：

- 树通常由树干、树冠、阴影组成
- 小像素对象需要清晰轮廓
- 地面、物体、角色和 UI 需要颜色层级区分
- 自然物体应该有聚散关系，而不是机械均匀散布
- 中心阅读区域不应被巨大不透明块遮挡
- 建筑需要底座、主体、顶部等可读结构

这些属于抽象原则，不复制具体表达。

### 6.2 禁止的参考方式

禁止：

- 复制参考图
- 重建具体截图
- 模仿名艺术家风格
- 复刻商业游戏、影视、动漫、品牌 IP
- 复制具体 sprite silhouette
- 复制专有调色板作为可识别风格克隆
- 存储网络参考图并作为生成资产
- 让输出追求与某张图片“高度相似”

当前代码中通过 `VISUAL_STYLE_SAFETY_POLICY` 和 `VISUAL_REFERENCE_GUIDELINES` 约束：

```txt
reference research allowed
abstract principles only
no direct copy
no named artist imitation
no IP replication
no reference image reconstruction
original visual expression
```

### 6.3 版权政策依据

本项目不把以下内容作为正式资产策略：

- 一对一复制他人作品
- 针对某个受保护作品生成实质相似画面
- 用“某某艺术家风格”作为生成目标
- 用知名 IP 形象作为世界资产

参考依据：

- U.S. Copyright Office, Copyright and Artificial Intelligence initiative：说明美国版权局持续处理 AI 生成内容、版权归属和训练材料相关问题。
- U.S. Copyright Office, Part 2: Copyrightability Report, 2025：强调 AI 生成输出的版权问题需要关注人类创作性和表达归属。
- U.S. Copyright Office, 2023 AI registration guidance：说明包含 AI 生成材料的作品在登记时需要区分人类作者贡献与机器生成材料。

本项目工程结论：

```txt
可以学习“怎么让像素图可读”
不能学习“怎么画成某个现成作品”
可以参考现实结构
不能复制具体表达
可以做原创像素系统
不能做 IP/名家/截图复刻系统
```

## 7. 当前已落地内容

### 7.1 已完成模块

- `src/world/visual-generation`
- `src/world/visual-judge`
- `src/world/visual-reference`
- `src/world/pixel-art-recipes/recipes/*`
- `/world` 视觉审查 UI
- `/world` 展示闸门 UI
- `/world` 视觉参考安全 UI

### 7.2 当前已完成基础对象

- tree object recipe
- stone object recipe
- bush object recipe
- flower object recipe
- mushroom object recipe
- insect signal recipe
- structure object recipe
- facility object recipe

### 7.3 当前测试

已通过：

```txt
tsc
lint
build
smoke:visual-reference-safety
smoke:visual-judge
smoke:visual-generation-natural-objects
smoke:pixel-worldview-pixi-entry
smoke:pixel-worldview-render-plan
smoke:pixel-worldview-buffer
smoke:pixel-worldview-buffer-palette
smoke:pixel-primitive-library
smoke:world-debug-pixel-visual-lab
```

页面验证：

```txt
/create-world -> 200 OK
/world        -> 200 OK
```

## 8. 后续阶段

### 阶段 2.5 后半段：展示闸门流程化

目标：让 Visual Judge 不只是 UI 展示，而是正式决定画面是否可以进入玩家展示层。

需要完成：

- 不合格画面不进入最终展示层
- UI 显示“正在视觉修正”状态
- correction plan 进入重新生成流程
- 展示层只接收通过审查的 frame

### 阶段 2.6：管家/角色 sprite 审查

目标：把管家、未来 NPC、行动动画纳入视觉判断。

需要检查：

- sprite 可读性
- 动作方向
- 与地面接触
- 是否遮挡关键区域
- 是否产生错误身份暗示
- 是否出现 IP/名家风格风险

### 阶段 2.7：建筑与建设过程审查

目标：支持管家自主建设产生的建筑、设施、道路和施工阶段画面。

需要检查：

- 建筑是否来自世界事实
- 建筑阶段是否正确
- 道路和入口是否可读
- 建筑密度是否合理
- 是否提前画出未来城市内容

### 阶段 2.8：AI 视觉模型接入预留

目标：未来接入真正的视觉模型，对生成画面做更接近人眼的审查。

当前系统已经预留结构：

```txt
PixelBufferFrame / screenshot
-> programmatic checks
-> optional AI vision review
-> VisualJudgeReport
-> VisualCorrectionPlan
```

AI 视觉模型只能提供审查意见，不能直接修改世界事实。

## 9. 当前风险与处理建议

### 9.1 Runtime store 仍是本地文件存档

当前 `world-runtime-store.ts` 使用本地文件系统，因此生产构建会出现 Turbopack tracing warning。

这不是视觉系统错误，但说明后续需要拆分：

```txt
RuntimeStoreAdapter
  ├─ LocalFileRuntimeStore
  ├─ BrowserLocalRuntimeStore
  └─ DatabaseRuntimeStore
```

### 9.2 展示闸门目前仍偏 UI

当前 UI 已经展示“允许展示/禁止直接展示”，但正式流程还需要进一步把不合格 frame 拦截在玩家展示层之前。

### 9.3 真实参考需要继续保持抽象化

后续如果加入联网参考、图片参考或素材分析，必须继续遵守：

```txt
不下载并存储参考图
不复制参考图布局
不模仿名艺术家
不复刻 IP
不追求实质相似
只抽象为可执行视觉原则
```

## 10. 一句话结论

本方案的目标是建立 AI-PET-WORLD 的正式视觉闭环：

```txt
自主世界产生事实
-> 视觉系统表达事实
-> 视觉判断系统审查表达
-> 修正系统只修画面
-> 合格后展示给玩家
```

这条链路保证了三个核心边界：

- 管家和世界保持自主
- 视觉系统不篡改世界事实
- AI 画面生成遵守原创与版权安全边界
