# AI-PET-WORLD V2.6｜模块进度表

> 本进度表只依据《完整业务架构总图（强化版）》与《无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案》。

| 模块 | 进度 | 状态 | 说明 |
|---|---:|---|---|
| M1 移动痕迹契约迁移 | 100% | 完成 | road/path 正式架构已移除，movement trace / trace field 成为正式口径 |
| M2 世界空间底座 v0 | 100% | 完成 | SpaceGrid / SpaceCell / SpaceRegion 已建立 |
| M3 世界痕迹模型 v0 | 100% | 完成 | TraceFact / TraceField / TraceLifecycle 已建立 |
| M4 Trace-aware Scene Composer | 100% | 完成 | movement / spatial_use / ecology influence 已分层 |
| M5 痕迹视觉表现 v0 | 100% | 完成 | pressed_grass / worn_grass / exposed_soil / ecology_transition 已建立 |
| M6 生态对象规则深化 | 100% | 完成 | 生态对象规则主体已通过 lint / tsc / build 间接验收 |
| M6.5 legacy 命名清理 | 100% | 完成 | legacy road/path 业务口径已降级为兼容命名，正式文档与正式链路不再使用 |
| WORLD-PIXEL-RULE-MAPPER-00 | 90% | 基本完成 | 正式 `/world` 已接入 SpaceGrid / TraceField / HomeMapState / ButlerState → WorldViewModel → PixelWorldView；lint、tsc、build、pixel smoke 已通过 |
| M7 管家行为 → 痕迹闭环 | 0% | 未开始 | 下一阶段，进入前需先做 WORLD-PIXEL-RULE-MAPPER-00 收尾检查 |
| M8 管家记忆与学习 | 0% | 未开始 | 后置 |
| M9 世界学习 v0 | 0% | 未开始 | 后置 |
| M10 宠物学习预留 | 0% | 未开始 | 后置 |
| M11 主世界正式体验整理 | 进行中 | 进行中 | `/world` 已有正式 PixelWorldView 主链路，后续继续整理视觉体验与 UI overlay |
| M12 构建与质量验收 | 持续 | 持续 | 每个模块后必须 lint / tsc / build / smoke |

## 当前路线

WORLD-PIXEL-RULE-MAPPER-00 已完成主链路、Canvas 绘制增强与 smoke 守卫，当前可进入收尾检查。收尾检查通过后，再进入 M7 管家行为 → 痕迹闭环。

## WORLD-PIXEL-RULE-MAPPER-00 已完成内容

- `SpaceGrid → tiles`
- `TraceField → traces`
- `HomeMapState placements → objects`
- `ButlerState / decision → actors`
- `Resources / ecology / trace influence → atmosphere`
- `/world` 不引用 `buildSceneSvg`
- `/world` 不引用 `WorldPainterReadonlyPreview`
- `/world` 不引用 `FormalWorldView`
- `/world` 不引用 `ProceduralRendererView`
- `/world` 不把 Debug composer 搬进正式页
- `PixelWorldView` 使用 Canvas，只读 `WorldViewModel`
- smoke 已守卫默认宠物不生成、runtime 不写入、tick 不推进
