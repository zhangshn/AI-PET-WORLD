# AI-PET-WORLD P8 正式视觉阶段总控计划

## 1. 文档定位

本文档是 P8 正式视觉阶段与后续世界生成模块的总控计划。

当前最高依据：

1. `AI-PET-WORLD MVP完整计划书 v1.5`。
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`。
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`。

若旧 README、旧 docs/mvp、旧测试报告与以上三份正式文档冲突，以三份正式文档为准。

## 2. 当前正式主线

当前正式主线不是前端手写世界画面，而是：

```text
世界事实
-> 渲染投影
-> RenderableWorldSnapshot / VisualState
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView 只读渲染
```

核心原则：

1. 世界内容必须由规则、状态、生成容器和可审计链路产生。
2. FormalVisualModel 是正式视觉模型容器。
3. FormalWorldView 只能只读 FormalVisualModel。
4. Debug View 与 Formal World View 必须分离。
5. CSS 只能控制表现，不能决定世界事实。
6. PNG / WORLD_MAP_ASSETS 只能作为表现资源，不能作为世界事实来源。
7. 当前正式 MVP 不包含孵化器 / 胚胎 / 默认宠物开局路线。
8. 宠物未来能力保留，但只能通过 LifeEvent / CompanionDecision / accept_companion 后置进入。

## 3. 已完成阶段总表

| 阶段 | 状态 | 说明 |
|---|---:|---|
| P8-I-RESET | 已完成 | 作废旧 FormalWorldView 手写视觉路线。 |
| VISUAL-MODEL-00 | 已完成 | 定义 FormalVisualModel schema。 |
| VISUAL-MODEL-01 | 已完成 | 实现 FormalVisualGenerator 纯函数层。 |
| FORMAL-VIEW-00 | 已完成 | 新增 FormalWorldView 只读组件。 |
| FORMAL-VIEW-01 | 已完成 | 新增 preview harness，限定为开发预览。 |
| FORMAL-VIEW-02 | 已完成 | 完成 /world 正式接入前检查。 |
| FORMAL-VIEW-03 | 已完成 | /world 从真实 snapshot 构建 FormalVisualModel。 |
| FORMAL-VIEW-04 | 已完成 | 默认 Formal，Debug 保留，Both 用于开发对照。 |
| WORLD-GEN-00 | 已完成 | 审计世界生成链路和旧宠物默认风险。 |
| MVP-ALIGN-01 | 已完成 | 审计旧孵化器 / 默认宠物运行链路。 |
| WORLD-GEN-01A/B | 已完成 | 修正正式首屏旧文案，断开 /world 默认 pet runtime。 |
| MVP-ALIGN-02 | 已完成 | 移除正式链路中的旧孵化器 / 默认宠物 / pet_arrival / pet_rest。 |
| MVP-ALIGN-03 | 当前阶段 | 对齐文档体系，清理旧 README / legacy docs / 乱码计划文档。 |

## 4. 已废弃路线

以下路线已作废，不能恢复：

1. 在 FormalWorldView 组件内生成 FormalWorldVisualItem。
2. 在 FormalWorldView 组件内生成 FormalActorVisualItem。
3. 在组件内写 buildFormalWorldVisualItems。
4. 在组件内写 buildFormalActorVisualItems。
5. 由前端组件决定树、房子、道路、设施、管家或宠物如何存在。
6. 用 PNG / WORLD_MAP_ASSETS 反向决定世界对象是否存在。
7. 默认生成孵化器、胚胎、宠物、宠物床、宠物抵达区、宠物休息区。

## 5. Formal 视觉链路现状

当前已建立的正式视觉链路：

```text
HomeMapState / WorldState
-> placements / MapDiff
-> VisualState / RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView
```

边界：

1. HomeMapState 保存世界事实。
2. MapDiff 保存世界变化。
3. VisualState / RenderableWorldSnapshot 保存可渲染投影。
4. FormalVisualModel 保存正式玩家主视觉模型。
5. FormalWorldView 只负责渲染 FormalVisualModel。
6. Debug Renderer 只用于工程对照，不是最终玩家 UI。

## 6. 世界生成链路现状

当前已具备：

1. worldSeed。
2. InitialHomeGenerator。
3. HomeMapState。
4. Scene Recipe。
5. PlacementEngine。
6. Placement rules / layout rules。
7. RenderableWorldSnapshot。
8. FormalVisualModel。
9. FormalWorldView。

当前已完成中性化：

1. `pet_arrival` 已移除。
2. `pet_rest` 已移除。
3. 初始世界不再默认生成 pet actor。
4. 初始世界不再默认生成 pet bed。
5. 初始世界不再默认生成 pet 专属设施。
6. 初始区域改为 entry_area / initial_care / temporary_shelter / quiet_living / storage_tools / natural_boundary。

仍未完成：

1. personality layout input schema。
2. 不同 seed / 管家人格 / 资源状态的可观察差异验证。
3. ConstructionPlanner。
4. ConstructionExecutor。
5. MapDiff 驱动的长期建设变化。

## 7. 宠物后置与旧孵化器清理现状

当前正式 MVP 规则：

1. 不再使用孵化器作为当前正式设定。
2. 不再使用胚胎 / hatching / incubating 默认路线。
3. 开局不默认出现宠物。
4. 开局不默认出现 pet actor。
5. 开局不默认出现 pet bed。
6. 开局不出现 pet_arrival / pet_rest 初始区域。
7. 宠物未来能力保留。
8. 宠物只能通过 LifeEvent / CompanionDecision / accept_companion 后置进入。

## 8. 当前遗留问题

| 问题 | 状态 | 处理方式 |
|---|---:|---|
| 旧 README 仍可能误导后续开发 | MVP-ALIGN-03 处理 | 清理或改写为当前正式设定。 |
| 旧 docs/mvp 仍可能含旧路线 | MVP-ALIGN-03 处理 | 加 legacy 声明，不再作为最高依据。 |
| 旧测试报告 / artifacts 仍有历史字段 | MVP-ALIGN-03 处理 | 标记 historical，不作为当前规则。 |
| P8 总控文档曾出现乱码 | MVP-ALIGN-03 处理 | 本文件已重写为 UTF-8 中文。 |
| worldSeed + 人格布局输入仍未完成 | 后续 WORLD-GEN-02 | 实现世界生成差异化输入协议。 |

## 9. 下一大模块计划

MVP-ALIGN-03 完成后，进入：

```text
WORLD-GEN-02：worldSeed + personality layout input schema
```

WORLD-GEN-02 目标：

1. 定义世界生成输入协议。
2. 明确 seed、管家人格、constructionStyle、resources、world phase 如何影响布局。
3. 让同一 seed + 同一状态稳定复现。
4. 让不同 seed / 人格 / 资源状态产生可观察差异。
5. 为后续 ConstructionPlanner / MapDiff 演化打基础。

## 10. 当前最终结论

P8 Formal 视觉链路已完成并保留。

当前不再回到前端手写世界内容路线。

当前不再回到孵化器 / 胚胎 / 默认宠物开局路线。

后续开发必须围绕规则生成、结构化世界事实、FormalVisualModel First、宠物后置和非固定布局差异化继续推进。
