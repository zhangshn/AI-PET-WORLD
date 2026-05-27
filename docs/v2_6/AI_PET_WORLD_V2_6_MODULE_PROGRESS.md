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
| WORLD-PIXEL-RULE-MAPPER-00 | 100% | 完成 | 正式 `/world` 已接入 SpaceGrid / TraceField / HomeMapState / ButlerState → WorldViewModel → PixelWorldView；lint、tsc、build、pixel smoke 已通过；正式链路已无 Debug/SVG/Scene Composer 主链路残留 |
| M7 管家行为 → 痕迹闭环 | 55% | 进行中 | v0 已接入并补守卫：Butler decision → intent → world rule validation → trace closure → TraceField / MemorySeedField；closure smoke 已通过，确认不默认生成宠物、不绕过 SafeApply、不让 observe/wait 写 HomeMapState |
| M8 管家记忆与学习 | 0% | 未开始 | 后置 |
| M9 世界学习 v0 | 0% | 未开始 | 后置 |
| M10 宠物学习预留 | 0% | 未开始 | 后置 |
| M11 主世界正式体验整理 | 进行中 | 进行中 | `/world` 已有正式 PixelWorldView 主链路，后续继续整理视觉体验与 UI overlay |
| M12 构建与质量验收 | 持续 | 持续 | 每个模块后必须 lint / tsc / build / smoke |

## 当前路线

WORLD-PIXEL-RULE-MAPPER-00 已完成并收口。M7 管家行为 → 痕迹闭环已经进入中段：管家运行决策可以转成正式意图，经过世界规则验证后沉淀为 TraceFact，并进入 TraceField / MemorySeedField。当前新增 `smoke:butler-trace-closure` 用于守卫这条链路。

下一步继续 M7 的事件与审计表达，让 `/world` 和 P-Phone 能更清楚地解释：管家为什么等待、为什么维护、为什么没有强行改写 HomeMapState，以及它留下了什么痕迹。

## WORLD-PIXEL-RULE-MAPPER-00 完成内容

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
- `WorldViewModel` 不直接依赖 `scene-composer-gateway`
- `PixelWorldView` 使用 Canvas，只读 `WorldViewModel`
- smoke 已守卫默认宠物不生成、runtime 不写入、tick 不推进

## M7 管家行为 → 痕迹闭环

目标链路：

```txt
ButlerState / runtime decision
→ Butler intent
→ World rule validation
→ SafeApply
→ Trace / Event / Resource / HomeMapState diff
→ MemorySeed
→ 下一轮 RuntimeSaveRecord
```

当前已完成：

- `ButlerRuntimeDecision → ButlerRuntimeIntent`
- `ButlerRuntimeIntent → ButlerWorldRuleValidation`
- `runTraceLifecycleTick → applyButlerRuntimeTraceClosure`
- `TraceField → TraceMemorySeedField`
- `lastButlerRuntimeIntent` 持久化
- `lastButlerWorldRuleValidation` 持久化
- `smoke:butler-trace-closure` 已新增并通过
- `observe_world / wait_for_resources` 不写 HomeMapState diff，但允许留下验证后的行为痕迹
- `continue_construction / maintain_home` 仍必须通过 SafeApply 才能写 HomeMapState diff
- 明确守卫 `no_pet_fact_created`，M7 不默认生成宠物

M7 不负责改画图算法，不负责默认生成宠物，不负责世界学习。M7 只负责把管家的正式行为结果接入世界事实变化与痕迹沉淀。
