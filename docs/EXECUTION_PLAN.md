# AI-PET-WORLD 唯一执行计划表

更新：2026-07-06  
状态：已按活世界定版方案重构

本文件是当前唯一执行计划。README 只做入口，项目总路线见 `docs/PROJECT_MASTER_PLAN.md`，活世界技术方案见 `docs/live-world/AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md`。

## 1. 当前唯一主线

```txt
P0 活世界 Schema 收口
```

当前不继续推进旧的 P7-8 材料槽完整图路线。旧 P7-8 产物作为历史实验和视觉参考保留，不作为当前执行主线。

## 2. 固定原则

| 编号 | 原则 | 说明 |
|---|---|---|
| RULE-001 | 世界事实优先 | 世界里有什么，必须先由 WorldState / ChunkState / Entity 决定。 |
| RULE-002 | AI Painter 只负责视觉表达 | AI 不决定资源、位置、碰撞、生命周期。 |
| RULE-003 | 图片不能反写世界 | 视觉输出错误时进入失败候选或负样本，不修改世界事实。 |
| RULE-004 | candidate 不等于 sample | 候选图必须经过人工复核后才能进入训练样本。 |
| RULE-005 | `/world` 只展示正式 Runtime | 未完成 P0/P1/P2 前，不推进正式展示。 |
| RULE-006 | 不提前做后置模块 | 管家行为、建筑、人物、动物、动态帧全部后置。 |
| RULE-007 | 文档先行 | 后续所有代码落地按 `docs/live-world/` 定版文档走。 |

## 3. 总阶段计划

| 阶段 | 名称 | 状态 | 目标 |
|---|---|---:|---|
| P0 | 活世界 Schema 收口 | 当前主线 | 定义世界事实、实体、生命周期、碰撞、视觉输入、候选、评审、样本协议。 |
| P1 | 单 Chunk POC | 待做 | 手写 32x32 Chunk，验证结构化输入到 AI Painter 候选图。 |
| P2 | 固定 seed 5x5 世界 | 后置 | 生成 25 个 Chunk 的小型自然家园世界。 |
| P3 | Runtime 区块激活 | 后置 | 玩家附近 3x3 Chunk 激活，远离 Chunk 休眠。 |
| P4 | 候选归档与样本库 | 后置 | VisualCandidate -> ManualReview -> SampleRecord 闭环。 |
| P5 | 自动结构评审 | 后置 | 检查资源数量、mask、路径、水岸、边缘和幻觉资源。 |
| P6 | AI Painter 训练闭环 | 后置 | 用正负样本优化结构到视觉生成。 |
| P7 | `/world` 正式自然家园 | 后置 | 通过机器与人工验收后展示正式 Runtime。 |
| P8 | 管家行为接入 | 后置 | 管家行为改变世界事实并触发地图变化。 |
| P9 | 人物、建筑、动物、动态世界 | 后置 | 扩展长期游戏体验。 |

## 4. P0 任务表

| 编号 | 任务 | 产物 | 状态 |
|---|---|---|---:|
| P0-1 | 建立活世界代码目录 | `src/world/live-world/` | 待做 |
| P0-2 | 定义世界基础类型 | `types/world-types.ts` | 待做 |
| P0-3 | 定义地形与生态类型 | `types/terrain-types.ts` | 待做 |
| P0-4 | 定义生命周期类型 | `types/lifecycle-types.ts` | 待做 |
| P0-5 | 定义实体强绑定 union | `types/entity-types.ts` | 待做 |
| P0-6 | 定义碰撞与 footprint | `types/collision-types.ts` | 待做 |
| P0-7 | 定义视觉输入输出 | `types/visual-types.ts` | 待做 |
| P0-8 | 定义候选记录 | `types/candidate-types.ts` | 待做 |
| P0-9 | 定义评审记录 | `types/review-types.ts` | 待做 |
| P0-10 | 定义样本记录 | `types/sample-types.ts` | 待做 |
| P0-11 | 定义资源生成规则 | `rules/placement-rules.ts` | 待做 |
| P0-12 | 定义 Mask 规范 | `docs/live-world` 或代码注释 | 待做 |
| P0-13 | 定义 POC-0 输入样例 | `data/live-world/poc-inputs/` | 待做 |
| P0-14 | 定义归档目录写入协议 | `data/world-runs` / `data/world-visual-candidates` | 待做 |
| P0-15 | 运行 TypeScript / lint 检查 | 编译通过 | 待做 |

## 5. P0 验收标准

P0 完成必须满足：

```txt
1. 所有基础类型不使用松散 string / object。
2. WorldEntity 使用 discriminated union。
3. EntityLifecycle 与 entityType 强绑定。
4. ChunkState 包含 runtimeState。
5. WorldState 包含 timeState。
6. CollisionState 拆分 visualSize / movementFootprint / visionFootprint / interactionFootprint。
7. ChunkVisualInput 包含 terrainMask / biomeMask / walkableMask / collisionMask / entityMap。
8. VisualCandidate / ReviewResult / SampleRecord 拆分。
9. POC-0 输入规范可落地。
10. 未接 AI Painter、未做 5x5、未推进 Runtime 展示。
```

## 6. 当前禁止事项

| 禁止项 | 原因 |
|---|---|
| 继续整图训练 | 世界数据协议未锁死，继续训练只会试错。 |
| 直接接 `/world` 展示 | 当前没有新协议下的正式 Runtime。 |
| 候选图直接入样本库 | 必须人工复核。 |
| 提前做管家行为 | 世界数据地基未完成。 |
| 提前做建筑、人物、动物 | 会打散 P0。 |
| 修改 route.ts 等高风险文件不读回 | 项目已有截断事故，必须防护。 |

## 7. 下一步

按顺序执行：

```txt
P0-1 建立 src/world/live-world/ 目录
P0-2 到 P0-10 落地类型文件
P0-11 落地 placement rules
P0-12 到 P0-14 落地 POC 和归档规范
P0-15 运行检查
```

