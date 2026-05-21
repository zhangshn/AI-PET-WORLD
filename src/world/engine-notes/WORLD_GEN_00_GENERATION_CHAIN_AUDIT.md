# AI-PET-WORLD WORLD-GEN-00 世界生成链路现状审计

## 1. 阶段定位

WORLD-GEN-00 是世界生成链路审计阶段。

本阶段只审计当前 world generation / map-state / placement / runtime 相关链路，明确已有能力与缺口。

本阶段不修改正式 UI。
本阶段不生成新的世界对象。
本阶段不生成 placement。
本阶段不修改 HomeMapState。
本阶段不修改 world-loop。
本阶段不接入 pet。
本阶段不读取 PNG / WORLD_MAP_ASSETS 作为世界事实来源。

## 2. 当前真实数据流

当前可观察链路为：

```text
create-world input
-> world creation runtime
-> first scene model
-> InitialHomeGenerator
-> HomeMapState
-> EnvironmentState / PlacementGeometryAudit
-> VisualState
-> RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView
```

当前 /world 已经可以从真实 `runtimeState.currentRenderableSnapshot` 构建 `FormalVisualModel`，并由 `FormalWorldView` 只读渲染。

## 3. 当前已有链路

### 3.1 worldSeed

当前已有 `src/world/generation/world-seed.ts`。

已存在能力：

1. `buildStableWorldSeed`。
2. `buildSeededNumber`。
3. `pickSeededItem`。

当前 `generateInitialHomeMapResult` 会从 ownerId、birthSignature、worldSalt 构建 seed。

注意：

当前 `worldSalt` 来自 create-world runtime 的 `createdAt`。只要 create-world input 被持久化，同一个输入可以稳定复现；但如果重新创建输入并生成新的 `createdAt`，即使用户生命信息相同，也可能得到不同 seed。

### 3.2 InitialHomeGenerator

当前已有 `src/world/generation/initial-home-generator.ts`。

已存在能力：

1. `generateInitialHomeMap`。
2. `generateInitialHomeMapResult`。
3. 从 recipe、seed、constructionStyle 构建初始 HomeMapState。
4. 生成 zones、placements、resources、constructionPlans。

当前 `mapDiffs` 初始为空数组。

### 3.3 HomeMapState

当前已有 `src/world/map-state/home-map-state-schema.ts`。

HomeMapState 已包含：

1. worldId。
2. ownerId。
3. seed。
4. mapSize。
5. zones。
6. placements。
7. resources。
8. constructionPlans。
9. mapDiffs。
10. createdAt / updatedAt。
11. tags。

### 3.4 MapDiff

当前已有 MapDiff schema 与基础引擎。

相关文件：

1. `src/world/map-state/home-map-state-schema.ts`。
2. `src/world/map-state/map-diff-engine.ts`。
3. `src/world/map-state/map-diff-validator.ts`。
4. `src/world/world-evolution/world-diff-proposal.ts`。

已存在能力：

1. addPlacement。
2. removePlacement。
3. updatePlacement。
4. movePlacement。
5. applyMapDiffs。
6. diff proposal 草案。
7. collision / protected placement 相关校验。

当前缺口：

MapDiff 已存在，但初始世界生成尚未通过 MapDiff 表达初始差异；世界演化规则也还没有覆盖完整的资源状态、人格倾向和布局差异化闭环。

### 3.5 PlacementEngine

当前已有 `src/world/placement/placement-engine.ts`。

已存在能力：

1. 从 recipe areas 构建 ground / support / path / structure / facility / nature / decoration / actor placements。
2. 使用 seed 影响部分坐标、数量和 asset variant。
3. 使用 constructionStyle 影响部分布局偏移和数量。
4. 通过规则校验输出 PlacementEngineResult。

重要发现：

当前 PlacementEngine 并不是完全固定模板，但也还不是完整的非固定布局规则系统。

已经有差异来源：

1. seed 会影响 ground asset variant。
2. seed 会影响 support edge 点位。
3. seed / adaptivePlanner / structuredBuilder 会影响部分 path route。
4. seed / protectiveKeeper 会影响 nature boundary 数量与点位。
5. seed / aestheticOrganizer 会影响 surface decoration 点位。
6. warmCaretaker / quietMaintainer / adaptivePlanner 会影响部分 facility 点位。

仍然偏固定的部分：

1. mapSize 来自固定 scene recipe。
2. zones 来自固定 recipe area。
3. temporary shelter / incubator / storage 等核心区仍主要依赖固定 area center。
4. 当前没有多套 layout recipe 选择机制。
5. 当前没有明确的非固定布局验证测试。

### 3.6 layout recipe

当前已有 `src/world/generation/initial-home-scene-recipe.ts`。

已存在能力：

1. 固定 mapSize。
2. 固定 initial areas。
3. requiredAssets / optionalAssets。
4. placement rules。
5. construction phases。

当前 recipe 标签中包含 `placement_engine_required` 与 `no_ai_free_layout`，说明当前路线是规则引擎生成，而不是 AI 自由布局。

当前缺口：

recipe 当前更像单一初始场景模板，还没有形成可由 seed / 人格 / 资源状态选择的 recipe family。

### 3.7 constructionStyle

当前已有 constructionStyle 入口。

相关链路：

```text
create-world input
-> buildWorldCreationRuntime
-> buildWorldFirstSceneModel
-> generateInitialHomeMap
-> buildInitialHomePlacements
```

constructionStyle 当前会影响：

1. 初始 resources。
2. constructionPlans。
3. 部分 placement 坐标偏移。
4. 部分 path / nature / decoration 数量和点位。

当前缺口：

constructionStyle 已参与布局，但影响范围还不完整，缺少专门验证“不同人格输入产生可观察布局差异”的测试或 debug 文档。

### 3.8 visualTendency

当前审计没有发现明确的 `visualTendency` 实现入口。

当前结论：

1. 目前没有证据显示 visualTendency 已经误入世界事实层。
2. 当前主要是 constructionStyle 影响世界生成。
3. 后续如果新增 visualTendency，必须明确它属于正式视觉模型风格，不能反向生成 HomeMapState 事实。

### 3.9 pet 默认接入风险

当前 PlacementEngine 的初始 actor placement 中存在 butler 与 pet actor placement。

这与后续 P8-H / v1.5 中“pet 不作为开局默认 actor，必须后置进入”的原则存在冲突风险。

本阶段不修改该逻辑，只记录为 WORLD-GEN 后续必须处理的缺口。

## 4. 当前 placements 是否已经是非固定布局

结论：部分是，尚未完全是。

当前 placements 不是纯静态硬编码模板，因为 seed 与 constructionStyle 已经影响部分对象。

但是当前 placements 也不是完整的非固定布局系统，因为：

1. 核心 recipe 是单一固定场景。
2. 主要 zones 固定。
3. 核心结构中心点固定。
4. 缺少 layout recipe family。
5. 缺少 seed / 人格 / 资源状态差异化验证。
6. 初始 pet actor 默认 placement 需要与产品原则重新对齐。

## 5. 当前缺失内容

当前缺失：

1. 明确的 worldSeed / generation input schema。
2. 区分 persisted worldSeed 与 create-world 临时 createdAt 的规则。
3. InitialHomeGenerator 的非固定布局契约文档。
4. layout recipe family 或 recipe variant 选择机制。
5. PlacementEngine 的差异化规则测试。
6. 不同 seed 输出不同布局的验证。
7. 不同 constructionStyle 输出不同布局的验证。
8. resource state 影响布局或 MapDiff 的闭环。
9. pet 不默认接入的初始生成修正方案。
10. visualTendency 作为视觉风格而非世界事实的边界协议。
11. assetId / map-assets 与世界事实层的边界清理。
12. MapDiff 与世界演化规则的更完整覆盖。

## 6. 下一步建议

建议下一步进入：

```text
WORLD-GEN-01：worldSeed / generation input schema
```

WORLD-GEN-01 应优先明确：

1. 生成输入的稳定字段。
2. worldSeed 的持久化规则。
3. 同一 seed 必须稳定。
4. 不同 seed / 人格 / 资源状态必须产生可观察差异。
5. pet 不作为默认初始 actor。
6. visualTendency 不能反向写入世界事实。

在 WORLD-GEN-01 之后，再进入 InitialHomeGenerator / PlacementEngine 的非固定布局规则实现会更稳。
