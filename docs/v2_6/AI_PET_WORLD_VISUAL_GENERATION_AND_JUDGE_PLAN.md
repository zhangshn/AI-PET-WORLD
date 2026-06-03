# AI-PET-WORLD 自主世界视觉生成与视觉判断系统方案

版本：v2.6 当前正式方案  
日期：2026-06-03  
状态：当前主线方案，旧方案不再保留

## 1. 方案定位

AI-PET-WORLD 不是玩家手动摆放物件的建造游戏，而是由 AI 管家、世界规则、事件系统和未来多玩家管家共同驱动的自主世界。

视觉系统的职责不是创造事实，而是把已经存在的世界事实表达成可展示画面。所有自主生成入口都必须进入同一条视觉审查链：

```txt
世界自主生成入口
  ├─ 管家自主建设世界
  ├─ 世界规则自动生成自然、生态、地形
  ├─ 小镇 / 城市系统自动生成建筑与道路
  ├─ 事件系统自动生成痕迹 / 变化
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

前期只实现基础自然物体、基础设施和只读世界画面；后期小镇、城市、道路、公共设施和多玩家共建内容，都沿用这条主链。

## 2. 核心原则

## 世界事实优先

画面只能表达世界事实，不能创造世界事实。

如果 runtime 中没有“医院已建成”的事实，视觉系统不能因为画面好看就画出医院。视觉修正系统也不能把“不存在的建筑”修成“存在的建筑”。它只能移动、缩放、降密度、替换像素配方、隐藏错误视觉块，或生成新的视觉表达计划。

## 管家自主性优先

管家的建设行为来自人格、记忆、资源、空间、规则、阶段目标和事件压力。用户建议只是输入，不是命令。

视觉系统必须服务这个自主性：展示管家的建设结果，而不是把玩家 UI 操作伪装成世界演化。

## 页面只读

正式 `/world` 页面是只读展示入口：

```txt
WorldRuntimeSaveRecord
-> WorldViewModel
-> VisualFactManifest
-> VisualGenerationPlan
-> PixelWorldRenderPlan
-> PixelWorldPixelBufferFrame
-> VisualJudgeReport
-> VisualCorrectionPlan
-> Player Display Gate
```

页面不能推进 tick，不能创建默认世界，不能绕过规则写入 runtime。

## 3. 视觉系统分层

## Visual Generation

职责：把世界事实转换为可绘制的视觉语义。

输出 `VisualGenerationPlan`，包括：

- 世界 id、tick、确定性 key
- 对象级像素配方
- 对象迁移状态
- actor sprite 占位
- trace visual 占位
- atmosphere visual 占位
- audit 结果
- tags

## PixelWorld Render Plan

职责：把视觉语义转换为渲染命令。

输出 `PixelWorldRenderPlan`，包括：

- tile 填充命令
- trace patch 命令
- object recipe / object block 命令
- actor marker 命令
- atmosphere tint 命令
- overlay label 命令

## Pixel Buffer

职责：把渲染命令转换为纯数据像素缓冲区。

输出 `PixelWorldPixelBufferFrame`。PixiJS 只消费这个 frame，不读取 runtime，不写世界事实。

## Visual Judge

职责：审查视觉输出是否可以展示给玩家。

Visual Judge 同时消费 `VisualFactManifest`。这个 manifest 只记录世界事实来源，不提供写入能力，用来说明画面中的 tile、object、trace、actor、atmosphere 分别来自建设、生态、地形、事件痕迹、管家行为或纯视觉派生。

当前正式审查类别：

- `world_fact_consistency`：画面对象必须能追溯到 VisualGenerationPlan。
- `world_fact_manifest`：recipe、render command、pixel cell 必须能追溯到事实来源 manifest。
- `semantic`：不能出现 marker fallback 这类未完成迁移表达。
- `illegal_debug_visual`：不能泄漏 debug block、超大占位矩形。
- `composition`：不能越界，不能大面积遮挡中央阅读区域。
- `readability`：对象必须有足够像素块和可读面积。
- `density`：自主生成对象密度不能压垮画面。
- `structure_logic`：建筑 / 设施必须有可读底座、主体或垂直体量。
- `construction_stage`：施工阶段必须有地基、框架、脚手架或未完成边缘等可读线索。
- `access_readability`：建筑 / 设施附近需要有道路、痕迹、磨损草地或维护路径等入口线索。
- `path_connectivity`：道路、痕迹、维护路径不能碎成无法理解的孤立块。
- `ecology_coherence`：自然 / 生态视觉必须符合生态色彩和氛围信号。
- `player_focus`：玩家中央阅读区域不能被高不透明度细节压满。
- `business_rule`：不能出现旧业务或未规划生命体相关 token。
- `style_safety`：不能携带侵权风格、真实素材复制或外部 IP 线索。

## 4. 视觉修正规则

视觉修正计划分为两层：

```txt
VisualCorrectionIntent  // 想修什么
-> VisualCorrectionAction // 当前 buffer 上怎么执行
```

`VisualCorrectionIntent` 是结构化修正目标，例如：

- `add_construction_stage_cue`：给施工阶段补地基、框架、脚手架或未完成边缘线索。
- `add_access_trace_cue`：给建筑入口补道路、磨损草地或维护痕迹。
- `reconnect_path_visuals`：连接碎裂的道路 / 痕迹视觉。
- `cluster_ecology_transition`：把生态视觉聚成可读过渡，而不是散点噪声。
- `protect_player_focus_area`：降低中央阅读区域密度或不透明度。
- `resize_for_readability`：提升对象可读性。
- `hide_invalid_visual`：隐藏无法追溯事实来源的错误视觉。

所有 intent 都必须满足：

```txt
visualOnly: true
preservesRuntimeFacts: true
```

视觉修正计划只能修改视觉表达：

- 移动对象
- 缩放对象
- 降低密度
- 替换像素配方
- 调整颜色和明暗
- 移除错误视觉块
- 调整遮挡和排序

视觉修正计划不能：

- 新增 runtime 中不存在的建筑
- 新增 runtime 中不存在的角色
- 改写管家行为结果
- 改写世界资源、空间、事件或记忆

当前实现中，`VisualCorrectionPlan` 可以应用到 `PixelWorldPixelBufferFrame`，输出 corrected buffer。修正结果带有 `affectsRuntimeFacts: false`，并由 display gate 复审；复审通过后才展示给玩家。

第 6 阶段起，部分 intent 可以生成新的 `visual_only` pixel buffer cell：

- `add_construction_stage_cue`：生成地基、脚手架等施工阶段 cue。
- `add_access_trace_cue`：生成靠近建筑入口的磨损草地 / 维护痕迹 cue。
- `reconnect_path_visuals`：生成连接碎裂 trace 的视觉 cue。
- `cluster_ecology_transition`：生成生态过渡聚合 cue。

这些 cell 只存在于 corrected buffer 中，带有 `visual_only`、`visual_correction_generated` 和对应 intent/action 标签。它们不进入 runtime，不进入世界事实，不改变管家的建设结果。

第 7 阶段起，展示闸门输出 `VisualDisplayGateReview`，用于记录复审闭环：

- 原始审查 severity。
- 最终审查 severity。
- 修正是否执行。
- 生成了多少 visual-only cell。
- 剩余 finding 数量。
- 剩余 fail 数量。
- 已解决 finding 数量。
- 复审阶段，例如 `correction_applied`、`post_correction_passed`、`post_correction_failed`。
- 阻塞原因列表。

因此 display gate 可以清楚地区分：

```txt
原始画面直接通过
原始画面失败但视觉修正后通过
原始画面失败且修正后仍失败
原始画面只有 warn，需要进一步视觉修正
```

## 5. 真实网络参考与版权边界

AI 可以参考真实世界和公开资料中的抽象视觉规律，例如：

- 建筑比例
- 道路层次
- 树冠结构
- 地面材质关系
- 色彩明暗关系
- 城镇空间组织方式

AI 不能复制真实网络图片、游戏截图、商业素材、角色形象、logo、UI 版式或可识别的独创表达。

参考真实网络数据时，只能走这条路径：

```txt
真实参考
-> 抽象视觉原则
-> 项目自有像素配方
-> 视觉判断审查
```

项目不存储参考图片，不照抄网络图，不生成可识别 IP 风格。

## 6. Runtime 存储边界

视觉系统不直接读写本地文件存档。正式 runtime 通过 `RuntimeStoreAdapter` 存取世界。

当前状态：

- 开发 / smoke：`LocalFileRuntimeStore`，目录为 `data/world-runtime`。
- 生产：本地文件 store 默认禁用。
- 下一阶段：接入 `DatabaseRuntimeStore`，用于正式云端持久世界。

## 7. 当前验收标准

当前阶段通过以下条件才算稳定：

- `/world` 保持只读。
- `/api/world/tick` 显式推进 tick。
- `WorldRuntimeSaveRecord` 是唯一 runtime 主存档。
- 视觉生成经过 `VisualJudgeReport`。
- 不合格视觉输出生成 `VisualCorrectionPlan`。
- 修正只改视觉表达，不改世界事实。
- `VisualCorrectionPlan` 可以落到 pixel buffer 并复审。
- 视觉判断覆盖结构、路径、生态、事实一致性、风格安全。
- 高级视觉审稿覆盖施工阶段、建筑入口、生态过渡和玩家阅读焦点。
- build、lint、核心 smoke 全部通过。
