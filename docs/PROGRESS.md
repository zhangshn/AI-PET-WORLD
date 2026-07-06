# AI-PET-WORLD 当前进度表

更新：2026-07-06  
当前唯一主线：P0 活世界 Schema 收口

## 1. 当前结论

项目总计划已重构。旧 P7-8 “完整自然家园 RuntimeFrame 材料槽合成”不再作为当前唯一主线继续推进。其产物和经验保留为历史实验、视觉参考和负样本来源。

当前主线改为：

```txt
P0 活世界 Schema 收口
```

原因：

```txt
世界数据协议未锁死前，继续整图训练、材料槽合成或 /world 展示都会继续试错。
```

## 2. 已完成

| 模块 | 状态 | 说明 |
|---|---:|---|
| 活世界定版方案 | 完成 | 已写入 `docs/live-world/AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md`。 |
| 活世界目录结构 | 完成 | 已写入 `docs/live-world/DIRECTORY_STRUCTURE.md`。 |
| 活世界文档入口 | 完成 | 已写入 `docs/live-world/README.md`。 |
| 旧活世界方案入口迁移 | 完成 | `docs/LIVE_WORLD_MVP_RULE_DICTIONARY_AND_AI_PAINTER_PLAN.md` 已改为迁移入口。 |
| 项目 README 重构 | 完成 | README 改为项目总入口，不再承载详细阶段计划。 |
| 项目总计划 | 完成 | 已新增 `docs/PROJECT_MASTER_PLAN.md`。 |
| 唯一执行计划表 | 完成 | 已重构 `docs/EXECUTION_PLAN.md`。 |
| 当前进度表 | 完成 | 当前文件已切换到 P0 活世界 Schema 主线。 |

## 3. 当前任务表

| 编号 | 任务 | 状态 | 说明 |
|---|---|---:|---|
| P0-1 | 建立 `src/world/live-world/` 目录 | 待做 | 类型、规则、碰撞、视觉输入、候选、评审、样本分目录。 |
| P0-2 | 定义 `world-types.ts` | 待做 | WorldState、TimeState、ChunkState、ChunkRuntimeState。 |
| P0-3 | 定义 `terrain-types.ts` | 待做 | TerrainType、BiomeType、MovementClass、TileOverlay。 |
| P0-4 | 定义 `lifecycle-types.ts` | 待做 | EntityLifecycle、各资源 Stage。 |
| P0-5 | 定义 `entity-types.ts` | 待做 | WorldEntity discriminated union。 |
| P0-6 | 定义 `collision-types.ts` | 待做 | CollisionState、Footprint、Projection 输出。 |
| P0-7 | 定义 `visual-types.ts` | 待做 | ChunkVisualInput、ChunkVisualOutput、VisualConstraints。 |
| P0-8 | 定义 `candidate-types.ts` | 待做 | VisualCandidate。 |
| P0-9 | 定义 `review-types.ts` | 待做 | ReviewResult、StructureIssue、VisualIssue。 |
| P0-10 | 定义 `sample-types.ts` | 待做 | SampleRecord、SampleDecision、LicenseStatus。 |
| P0-11 | 定义 `placement-rules.ts` | 待做 | ResourcePlacementRule 和 MVP 资源矩阵。 |
| P0-12 | 定义 POC-0 输入样例 | 待做 | 32x32、512x512、tree x3、rock x2 等。 |
| P0-13 | 定义归档样例 | 待做 | world-runs、world-visual-candidates、world-samples。 |
| P0-14 | TypeScript 检查 | 待做 | 类型可编译。 |

## 4. 暂停事项

| 事项 | 状态 | 原因 |
|---|---:|---|
| 继续整图训练 | 暂停 | 等 P0 Schema 和 POC-0。 |
| P7-8 材料槽合成 | 暂停 | 保留历史经验，当前不作为主线。 |
| `/world` 正式展示推进 | 暂停 | 新活世界 Runtime 未完成。 |
| 自动评审 | 后置 | P5 再做。 |
| 训练闭环 | 后置 | P6 再做。 |
| 管家行为 | 后置 | P8 再做。 |
| 人物、建筑、动物、动态帧 | 后置 | P9 再做。 |

## 5. 当前阻塞

| 阻塞 | 说明 | 解决方式 |
|---|---|---|
| 世界数据协议未落地 | 文档已定，但 TypeScript 类型还未落地。 | 执行 P0-1 到 P0-11。 |
| 旧计划和新计划曾冲突 | README、EXECUTION_PLAN、PROGRESS 旧内容仍指向 P7-8。 | 已重构为 P0 主线。 |
| AI Painter 输入协议未实现 | 小模型仍缺结构化 ChunkVisualInput 落地。 | P0 完成后进入 P1。 |

## 6. 下一步

唯一下一步：

```txt
开始 P0 Schema 文件落地。
```

执行顺序：

```txt
1. 建立 src/world/live-world/ 目录
2. 落地 types/
3. 落地 rules/
4. 落地 POC-0 input spec
5. 落地 archive spec
6. 运行检查
```

## 7. 历史记录

旧 P7-8 自然家园材料槽、v149 局部基准、v46/v47 RuntimeFrame 候选、Material Quality Judge、VisualJudge 和 owner review 记录保留为历史经验。它们不删除，但当前不再作为执行主线。

