# AI-PET-WORLD 当前架构

版本：v2.6  
日期：2026-06-03  
状态：当前正式主线

## 1. 业务主链

```txt
注册与出生信息
-> 紫微斗数 / 生命人格核心
-> 管家灵魂与长期人格
-> 世界创建
-> 世界规则运行
-> 管家自主决策
-> 建设、生态、痕迹、事件、记忆
-> P-Phone 沟通
```

用户可以提出建议，但建议不是命令。管家是否采纳，取决于人格、记忆、资源、空间、规则和当前世界压力。

## 2. 正式世界写入边界

正式世界变化只能来自规则验证后的运行链：

```txt
管家感知
-> 自主动机
-> 意图
-> 建设或世界变化候选
-> SafeApply
-> HomeMapState / WorldRuntimeSaveRecord
```

页面、渲染器、视觉判断系统都不得写入世界事实。

## 3. Runtime 主线

当前正式持久化结构是 `WorldRuntimeSaveRecord`。它保存：

- `HomeMapState`
- 管家正式人格快照
- 管家运行时 profile
- 最近事件
- 最近管家决策、意图与规则验证
- 痕迹、记忆种子与 trace influence

后续 tick 必须读取 save record 中保存的管家人格，不得在 tick 内用默认生日重新构造人格。

## 4. Runtime 存储边界

正式 runtime 通过 `RuntimeStoreAdapter` 访问存储：

```txt
RuntimeStoreAdapter
├─ LocalFileRuntimeStore      // 开发与 smoke 测试
├─ DatabaseRuntimeStore       // 正式部署目标
└─ BrowserLocalRuntimeStore   // 未来离线实验
```

当前开发 adapter 是 `LocalFileRuntimeStore`，落盘目录是 `data/world-runtime`。生产环境不会默认启用本地文件存储；如果没有配置正式数据库 store，生产 runtime store 会返回 `runtime_store_not_configured`，避免把本地文件系统误当正式持久化方案。

## 5. 正式画面主链

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
-> PixiJS
```

`/world` 是只读表现入口。它不推进 tick，不创建默认世界，不绕过规则写入状态。没有存档时，正式页面应提示用户先创建世界。

## 6. 视觉判断系统

视觉判断系统审查的是画面表达，不是 runtime 世界事实。它可以生成视觉修正计划，但修正范围只能包括：

- 位置微调
- 密度调整
- 遮挡修正
- 对象比例修正
- 风格一致性修正
- 版权和参考安全修正
- 错误视觉块移除

它不能新增不存在的建筑、角色、事件或世界事实。

当前修正模型分为 `VisualCorrectionIntent` 和 `VisualCorrectionAction`。Intent 表示结构化修正目标，Action 表示当前 pixel buffer 上的执行方式。所有 intent 都必须是 visual-only，并且保留 runtime facts。

部分 intent 可以在 corrected pixel buffer 中生成 `visual_only` cell，例如施工 cue、入口痕迹 cue、路径连接 cue 和生态过渡 cue。这些 cell 只属于视觉表达，不会写入 `WorldRuntimeSaveRecord`。

展示闸门现在输出 `VisualDisplayGateReview`。它记录原始审查、修正执行、复审结果、剩余失败、已解决问题和阻塞原因，确保玩家看到的画面一定经过“原始审查 -> 视觉修正 -> 复审”的闭环。

当前视觉判断已经接入 `VisualFactManifest`。这使系统能判断画面元素来自哪里：

- 建设事实
- 生态事实
- 地形事实
- 事件 / 痕迹事实
- 管家行为
- actor / atmosphere
- 纯视觉派生内容

当前高级视觉审稿已经覆盖：

- 建筑 / 设施是否有可读主体。
- 施工阶段是否有地基、框架、脚手架或未完成边缘线索。
- 建筑入口附近是否有道路、痕迹或维护路径。
- 生态变化是否形成连续过渡，而不是碎片化点状噪声。
- 玩家中央阅读区域是否被高不透明度细节挤满。

## 7. 开发入口

- `/world`：正式只读 PixiJS 世界。
- `/create-world`：创建世界入口。
- `/api/world/tick`：显式推进 runtime tick。
- `/world-debug/pixel-visual-lab`：对象级像素配方实验室。
- `/world-debug/pixel-worldview-preview`：PixelWorldView 数据预览。

## 8. 当前验收状态

当前主线必须保持：

- 类型检查通过。
- lint 通过。
- production build 通过。
- runtime smoke 通过。
- visual judge smoke 通过。
- Pixi entry smoke 通过。
- visual reference safety smoke 通过。
