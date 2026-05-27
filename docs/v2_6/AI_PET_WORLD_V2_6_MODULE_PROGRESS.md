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
| M7 管家行为 → 痕迹闭环 | 0% | 下一阶段 | 下一步进入：管家意图 → 世界规则验证 → SafeApply → Trace / Event / MemorySeed |
| M8 管家记忆与学习 | 0% | 未开始 | 后置 |
| M9 世界学习 v0 | 0% | 未开始 | 后置 |
| M10 宠物学习预留 | 0% | 未开始 | 后置 |
| M11 主世界正式体验整理 | 进行中 | 进行中 | `/world` 已有正式 PixelWorldView 主链路，后续继续整理视觉体验与 UI overlay |
| M12 构建与质量验收 | 持续 | 持续 | 每个模块后必须 lint / tsc / build / smoke |

## 当前路线

WORLD-PIXEL-RULE-MAPPER-00 已完成并收口。正式 `/world` 当前以 WorldViewModel 为唯一表现模型，以 PixelWorldView 为正式主世界视图。下一阶段进入 M7 管家行为 → 痕迹闭环。

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

## 下一阶段：M7 管家行为 → 痕迹闭环

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

M7 不负责改画图算法，不负责默认生成宠物，不负责世界学习。M7 只负责把管家的正式行为结果接入世界事实变化与痕迹沉淀。
