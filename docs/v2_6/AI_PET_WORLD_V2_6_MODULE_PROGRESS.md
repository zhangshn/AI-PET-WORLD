# AI-PET-WORLD V2.6｜模块进度表

| 模块 | 进度 | 状态 | 说明 |
|---|---:|---|---|
| M1 移动痕迹契约迁移 | 100% | 完成 | road/path 正式架构已移除，movement trace / trace field 成为正式口径 |
| M2 世界空间底座 v0 | 100% | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 100% | 完成 | TraceFact / TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 100% | 完成 | movement / spatial_use / ecology influence 已分层 |
| M5 痕迹视觉表现 v0 | 100% | 完成 | pressed_grass / worn_grass / exposed_soil / ecology_transition 已建立 |
| M6 生态对象规则深化 | 90%～100% | 基本完成 | 生态对象规则主体完成，需本地构建确认 |
| M6.5 legacy 命名清理 | 70%～100% | 进行中 | 需本地构建确认 |
| WORLD-PIXEL-RULE-MAPPER-00 | 0% | 下一步 | 必须先做，不能直接进入 M7 |
| M7 管家行为 → 痕迹闭环 | 0% | 未开始 | 等 WORLD-PIXEL-RULE-MAPPER-00 后再进入 |
| M8 管家记忆与学习 | 0% | 未开始 | 后置 |
| M9 世界学习 v0 | 0% | 未开始 | 后置 |
| M10 宠物学习预留 | 0% | 未开始 | 后置 |
| M11 主世界正式体验整理 | 进行中 | 进行中 | `/world` 已有 PixelWorldView 外壳，但 mapper 需修 |
| M12 构建与质量验收 | 持续 | 持续 | 每个模块后必须 lint / tsc / build / smoke |

## 当前路线

当前不能直接进入 M7。必须先执行 WORLD-PIXEL-RULE-MAPPER-00，把 Pixel Scene Composer 验证过的规则沉淀为正式 WorldViewModel mapper，并确保 PixelWorldView 只读 WorldViewModel 绘制。

