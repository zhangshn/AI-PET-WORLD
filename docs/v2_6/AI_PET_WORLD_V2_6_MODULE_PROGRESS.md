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
| M7 管家行为 → 痕迹闭环 | 100% | 完成 | 已完成并收口：Butler decision → intent → world rule validation → trace closure → TraceField / MemorySeedField → lastButlerRuntimeAuditSummary → /world explanation / P-Phone explanation；closeout 文档已写入，相关 smoke 已通过 |
| M8 管家记忆与学习 | 0% | 未开始 | 后置，不在 MVP 收口范围内 |
| M9 世界学习 v0 | 0% | 未开始 | 后置，不在 MVP 收口范围内 |
| M10 宠物学习预留 | 0% | 未开始 | 后置，不在 MVP 收口范围内 |
| M11 主世界正式体验整理 | 20% | 进行中 | 第一轮已完成：`/world` 增加正式用户可见顶部说明、世界状态、只读说明；`smoke:m11-formal-surface` 已通过，确认无用户可见后台词、不默认生成宠物、不回退旧渲染 |
| M12 构建与质量验收 | 持续 | 持续 | 每个模块后必须 lint / tsc / build / smoke |

## 当前路线

WORLD-PIXEL-RULE-MAPPER-00 已完成并收口。M7 管家行为 → 痕迹闭环已完成并写入收口报告。M11 已进入 MVP 收口路线，第一轮正式世界表层已通过验收。

下一步继续整理 `create-world → /world` 的最短用户路径，重点检查输入页文案、创建结果是否被正式主世界读取、是否仍有 Debug / 工程表达残留，并准备一个可演示、可部署、可让真实用户打开体验的 Web MVP。

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

## M7 管家行为 → 痕迹闭环完成内容

目标链路：

```txt
ButlerState / runtime decision
→ Butler intent
→ World rule validation
→ SafeApply
→ Trace / Event / Resource / HomeMapState diff
→ MemorySeed
→ ButlerRuntimeAuditSummary
→ /world explanation / P-Phone explanation
→ 下一轮 RuntimeSaveRecord
```

已完成：

- `ButlerRuntimeDecision → ButlerRuntimeIntent`
- `ButlerRuntimeIntent → ButlerWorldRuleValidation`
- `runTraceLifecycleTick → applyButlerRuntimeTraceClosure`
- `TraceField → TraceMemorySeedField`
- `lastButlerRuntimeIntent` 持久化
- `lastButlerWorldRuleValidation` 持久化
- `lastButlerRuntimeAuditSummary` 持久化
- `/world` 管家解释优先读取 `lastButlerRuntimeAuditSummary`
- `P-Phone` 优先读取 `lastButlerRuntimeAuditSummary`
- `AI_PET_WORLD_V2_6_M7_BUTLER_TRACE_CLOSURE_CLOSEOUT.md` 已新增
- `smoke:butler-trace-closure` 已新增并通过
- `smoke:m7-explanation` 已新增并通过，已守卫 audit-summary-first 解释路径
- `smoke:m7-audit-summary` 已新增并通过
- `smoke:m7-closeout` 已新增并通过
- `observe_world / wait_for_resources` 不写 HomeMapState diff，但允许留下验证后的行为痕迹
- `continue_construction / maintain_home` 仍必须通过 SafeApply 才能写 HomeMapState diff
- 明确守卫 `no_pet_fact_created`，M7 不默认生成宠物
- 明确守卫正式 `/world` 不回退 SVG / Scene Composer / Debug 主链路

## M11 主世界正式体验整理当前完成内容

- `/world` 顶部增加正式用户可见说明。
- `/world` 显示当前运行记录次数。
- `/world` 明确提示打开页面只读取世界，不强行推进时间。
- 保留正式 PixelWorldView 主链路。
- 保留管家说明与 P-Phone 两个用户可理解入口。
- `smoke:m11-formal-surface` 已新增并通过。
- 已守卫用户可见文案不暴露 TraceField、AuditSummary、WorldViewModel、SafeApply 等后台词。
- 已守卫不默认生成宠物。

M11 不负责扩展 M8 / M9 / M10，不负责新增小镇、公园、医院、多用户或复杂宠物系统。M11 只负责把当前自主世界闭环整理成可体验的 MVP。