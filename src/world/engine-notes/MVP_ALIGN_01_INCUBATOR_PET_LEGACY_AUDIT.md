> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD MVP-ALIGN-01 旧孵化器 / 默认宠物运行链路清理审计

## 1. 阶段定位

MVP-ALIGN-01 是当前 MVP 正式文档对齐审计阶段。

本阶段目标：

1. 审计当前仓库中与三份正式文档不一致的旧设定残留。
2. 重点识别“孵化器 / 胚胎 / 默认宠物 / 默认宠物设施 / pet_arrival / pet_rest”等旧路线。
3. 只做审计和清理建议，不直接删除代码。
4. 为下一步 WORLD-GEN-01 提供明确的修改范围。

本阶段不做：

1. 不修改运行时代码。
2. 不修改 /world 页面。
3. 不修改 placement-engine。
4. 不修改 generation recipe。
5. 不删除 incubator 文件。
6. 不删除 pet runtime 文件。
7. 不生成新的 placement。
8. 不接入 pet。
9. 不读取 PNG / WORLD_MAP_ASSETS。

## 2. 当前最高依据

当前代码和文档判断优先级：

```text
第一优先级：用户最新提交的三份正式文档
第二优先级：当前仓库真实代码
第三优先级：最近阶段文档
旧记忆 / 旧设计 / 旧文档：不能直接作为当前版本依据
```

当前三份正式文档主线要求：

1. 世界不是固定 UI 画出来的。
2. 世界内容必须通过规则、状态、生成容器和可审计链路产生。
3. FormalVisualModel First。
4. FormalWorldView 只能只读 FormalVisualModel。
5. 开局不应默认出现宠物。
6. 宠物相关内容应后置到 LifeEvent / CompanionDecision / accept_companion 之后。
7. 当前正式文档没有“孵化器”作为开局核心设施。

## 3. 当前已对齐内容

以下内容目前与正式文档主线基本一致：

| 模块 | 当前状态 | 结论 |
|---|---|---|
| FormalVisualModel schema | 已建立正式视觉模型容器 | 对齐 |
| FormalVisualGenerator | 从 RenderableWorldSnapshot 纯函数生成 FormalVisualModel | 对齐 |
| FormalWorldView | 只读 FormalVisualModel 渲染 | 对齐 |
| /world Formal 接入 | 从 runtimeState.currentRenderableSnapshot 构建 FormalVisualModel | 对齐 |
| /world Formal / Debug 切换 | 默认 Formal，Debug 保留 | 对齐 |
| /world 空状态文案 | 已移除“孵化器” | 对齐 |
| WORLD-GEN-00 | 已审计生成链路和 pet 默认风险 | 对齐审计目标 |

## 4. 当前未对齐内容总览

以下内容仍与正式文档主线不一致：

| 风险类型 | 当前表现 | 风险级别 | 下一步建议 |
|---|---|---:|---|
| 孵化器文案残留 | world-first-scene-model 仍写“孵化器” | 高 | WORLD-GEN-01 前先修正文案 |
| 孵化器系统残留 | src/types/incubator.ts / src/systems/incubatorSystem.ts | 高 | 审计引用后隔离或归档 |
| 默认 embryo pet runtime | pet-runtime-context 默认 lifeStage = embryo | 高 | 改为 pet absent / pending / not_accepted |
| 默认 incubating action | pet runtime 默认 currentAction = incubating | 高 | 从正式链路移除 |
| /world Tick 默认创建 pet context | manual tick 创建 embryo pet runtime | 高 | pet context 必须后置或可选 |
| 初始 pet actor | placement-engine 创建 pet-near-arrival-point | 高 | WORLD-GEN-01 移除默认 pet actor |
| 初始 pet 设施 | pet-bed / food-bowl / water-bowl | 高 | 改为中性基础设施或后置 MapDiff |
| pet_arrival / pet_rest recipe | initial-home-scene-recipe 以宠物抵达为核心区域 | 高 | 改为中性区域或后置生成 |
| 旧 docs/mvp 孵化器示例 | docs/mvp/PERSONALITY_DRIVEN_WORLD_ENGINE.md 有旧示例 | 中 | 标记旧文档或迁移 |

## 5. 具体文件审计

### 5.1 src/world/runtime/world-first-scene-model.ts

当前问题：

1. subtitle 仍写：

```text
管家、孵化器和第一片家园区域已经根据你的输入生成。
```

2. milestones 仍包含：

```text
孵化器已就位
前期核心任务是维持孵化器稳定，等待宠物正式出生。
```

风险判断：

1. 这是正式 /world 首屏展示模型的一部分。
2. 用户进入正式世界后会看到该文案。
3. 与当前三份正式文档不一致。
4. 应优先修正。

建议修改方向：

```text
管家和第一片家园区域已经根据你的输入生成。
```

milestone 建议改为：

```text
管家已生成
初始家园已形成
世界状态已建立
自主建设待启动
```

禁止再写：

```text
孵化器已就位
胚胎
等待宠物出生
```

### 5.2 src/app/world/world-route-page.tsx

当前状态：

1. 空状态文案已改为：

```text
请先输入出生信息。系统会据此生成管家、第一片家园与初始世界状态。
```

2. 这一处已经对齐。

仍存在问题：

1. handleManualTick 中仍然创建默认 pet runtime context。
2. lifeStage 仍然传入：

```text
embryo
```

风险判断：

1. 即使页面空状态文案已修正，Tick 运行时仍然默认创建宠物状态。
2. 这会让宠物在未被 LifeEvent / CompanionDecision 接纳前进入运行链路。
3. 与宠物后置原则冲突。

建议修改方向：

1. 手动 Tick 暂时只使用 ButlerRuntimeContext。
2. PetRuntimeContext 应改为可选。
3. 在没有 accept_companion / pet accepted 事件前，不构造 petIntentContext。
4. UI 中 Pet Runtime 字段显示“未接入 / 后置等待”。

### 5.3 src/world/runtime-context/pet-runtime-context-schema.ts

当前问题：

当前类型仍包含：

```text
embryo
hatching
incubating
```

当前默认 builder 逻辑：

```text
lifeStage 默认 embryo
currentAction 默认 incubating
location.label 默认 孵化器
need reason 写 胚胎阶段主要需要稳定、安全的孵化环境
observation 写 宠物仍处于孵化阶段
profileLink 写 胚胎阶段暂不绑定完整宠物人格
```

风险判断：

1. 这是运行时 pet context 的默认入口。
2. 当前 world-route-page 会直接调用它。
3. 因此不是单纯未使用旧代码，而是仍在正式 Tick 链路中被使用。
4. 与当前文档主线严重冲突。

建议修改方向：

选项 A：短期隔离。

1. 保留类型文件，但不在 /world 默认 Tick 中调用。
2. 在 pet 未被接纳前，不构造 PetRuntimeContext。
3. 将当前文件标记为 legacy / pending migration。

选项 B：协议修正。

1. 新增 pet absent / pending / unaccepted 状态。
2. 删除或弃用 embryo / hatching / incubating。
3. 默认 builder 不再构造实体宠物。
4. pet context 只在 LifeEvent / CompanionDecision 后生成。

优先建议：先做选项 A，再做选项 B。

### 5.4 src/world/placement/placement-engine.ts

当前问题：

当前初始 placements 会生成：

```text
pet-arrival-point
pet-bed
pet-near-arrival-point
petPoseSkeletonIdleFront01
food-bowl
water-bowl
```

其中：

```text
pet-near-arrival-point
```

是 actor placement，label 为“宠物”，tags 包含：

```text
pet
actor
```

风险判断：

1. 这表示开局默认出现宠物 actor。
2. 这不是后置，也不是等待接纳。
3. 与当前 MVP 正式文档不一致。
4. 这是 WORLD-GEN-01 的最高优先级清理目标。

建议修改方向：

1. createActorPlacements 只生成 butler actor。
2. 不生成 pet-near-arrival-point。
3. 不使用 petPoseSkeletonIdleFront01。
4. pet actor 只能由 LifeEvent / CompanionDecision / MapDiff 后置生成。

设施建议：

1. pet-bed 不应开局默认出现。
2. food-bowl / water-bowl 如果作为宠物专属设施，应后置。
3. 如果保留，应改为中性基础生活物资，不打 pet tag，不作为宠物事实。

### 5.5 src/world/generation/initial-home-scene-recipe.ts

当前问题：

当前 recipe 仍以宠物抵达为核心场景：

```text
pet_arrival
pet_rest
宠物抵达区
宠物休息区
宠物床
宠物送达玩家家园后的第一位置
```

风险判断：

1. 初始世界骨架仍是宠物优先旧设计。
2. 即使删除 pet actor，只要 recipe 仍然叫 pet_arrival / pet_rest，生成系统仍会围绕宠物后置前不存在的事实组织空间。
3. 与当前“宠物后置”冲突。

建议修改方向：

将 pet 相关区域改为中性区域：

| 当前命名 | 建议命名 |
|---|---|
| pet_arrival | entry_area / world_entry / relation_pending_area |
| pet_rest | quiet_rest_area / companion_future_area / reserved_life_area |
| 宠物抵达区 | 初始入口区 / 关系待定区 |
| 宠物休息区 | 安静休息区 / 预留生活区 |
| 宠物床 | 暂不生成，或改为中性休息垫 |

注意：

1. 不能在 recipe 中暗示宠物已存在。
2. 可以保留“未来关系预留空间”，但不能生成宠物事实。
3. 如果要为未来宠物预留区域，必须写成 pending / reserved，而不是 pet arrived。

### 5.6 src/types/incubator.ts

当前问题：

文件定义：

```text
IncubatorState
hasEmbryo
embryoName
progress
stability
status: incubating / ready_to_hatch / hatched
```

风险判断：

1. 当前三份正式文档没有孵化器系统。
2. 该文件属于旧 MVP 设定残留。
3. 目前不能直接作为当前版本依据。

建议处理：

1. 先搜索所有引用。
2. 如果仅由旧 systems 引用，标记 legacy。
3. 下一步可迁入 legacy 目录或删除。
4. 删除前必须确认不会影响 build。

### 5.7 src/systems/incubatorSystem.ts

当前问题：

默认初始化：

```text
hasEmbryo: true
embryoName: Mochi
progress: 0
stability: 85
status: incubating
```

风险判断：

1. 这是明确的孵化器运行系统。
2. 与当前正式文档不一致。
3. 如果仍被 worldEngine 或其他旧链路调用，会造成旧主线回流。

建议处理：

1. 审计引用。
2. 如果已不在当前正式 world-loop 使用，标记 legacy。
3. 如果仍在旧 engine 使用，后续需要断开正式入口。
4. 不建议在未查引用前直接删除。

### 5.8 docs/mvp/PERSONALITY_DRIVEN_WORLD_ENGINE.md

当前问题：

旧 docs/mvp 文档仍含“孵化器位置”等示例。

风险判断：

1. 该文档版本较旧。
2. 与用户最新三份正式文档存在冲突。
3. 容易误导后续开发。

建议处理：

1. 在文件顶部标记：旧版参考，不作为当前 MVP 最高依据。
2. 或迁移到 legacy docs。
3. 后续所有 Codex 指令不得引用该文档作为当前最高规则。

## 6. 当前对齐状态总表

| 模块 | 对齐状态 | 说明 |
|---|---|---|
| P8 Formal 视觉链路 | 通过 | 继续保留 |
| /world 空状态文案 | 通过 | 已移除孵化器 |
| /world 首屏模型文案 | 不通过 | world-first-scene-model 仍有孵化器 |
| /world Tick runtime | 不通过 | 默认构造 embryo pet runtime |
| PetRuntimeContext | 不通过 | embryo / hatching / incubating / 孵化器残留 |
| PlacementEngine | 不通过 | 默认生成 pet actor / pet facilities |
| InitialHomeSceneRecipe | 不通过 | pet_arrival / pet_rest 旧骨架 |
| IncubatorSystem | 不通过 | 旧孵化器系统仍存在 |
| docs/mvp 旧文档 | 不通过 | 有旧示例，需降级为 legacy |

## 7. 不建议直接做的事情

当前不建议直接：

1. 大范围删除 incubator 文件。
2. 大范围删除 pet runtime 文件。
3. 删除所有 pet 相关类型。
4. 直接重写 placement-engine。
5. 直接重写 initial-home-scene-recipe。
6. 在 /world 中隐藏问题但保留运行逻辑。

原因：

1. 可能仍有旧模块引用。
2. 直接删除可能导致 build 失败。
3. pet 后置需要保留未来接入能力，而不是完全消灭 pet 系统。
4. 应先断开“默认生成 / 默认运行”入口，再逐步迁移。

## 8. 建议下一步：WORLD-GEN-01

建议下一步进入：

```text
WORLD-GEN-01：宠物默认生成逻辑回滚 / 宠物后置对齐
```

WORLD-GEN-01 应分成四个小步骤：

### 8.1 WORLD-GEN-01A：修正正式首屏文案

修改：

```text
src/world/runtime/world-first-scene-model.ts
```

目标：

1. 移除 subtitle 中的“孵化器”。
2. 移除 milestone 中的“孵化器已就位”。
3. 改成“初始世界状态已建立 / 管家已进入家园 / 自主建设待启动”。

### 8.2 WORLD-GEN-01B：断开 /world 默认 pet runtime

修改：

```text
src/app/world/world-route-page.tsx
```

目标：

1. 手动 Tick 默认只构造 ButlerRuntimeContext。
2. 在没有 pet accepted 事实前，不构造 PetRuntimeContext。
3. Runtime UI 显示宠物为“后置等待 / 未接入”。

### 8.3 WORLD-GEN-01C：移除初始 pet actor / pet placement

修改：

```text
src/world/placement/placement-engine.ts
```

目标：

1. 初始 createActorPlacements 只生成 butler。
2. 不生成 pet-near-arrival-point。
3. 不生成 petPoseSkeletonIdleFront01。
4. pet actor 后续必须通过 LifeEvent / CompanionDecision / MapDiff 进入。

### 8.4 WORLD-GEN-01D：中性化 initial recipe

修改：

```text
src/world/generation/initial-home-scene-recipe.ts
```

目标：

1. pet_arrival 改为中性入口或关系预留区。
2. pet_rest 改为安静休息区或预留生活区。
3. 移除“宠物送达 / 宠物休息 / 宠物床”文案。
4. 如果保留预留区域，必须写成 pending / reserved，而不是宠物已存在。

## 9. WORLD-GEN-01 红线

WORLD-GEN-01 必须遵守：

1. 不删除 pet 未来系统能力。
2. 只移除默认出现、默认运行、默认设施。
3. 不把 pet 从产品中永久删除。
4. 不把孵化器重新作为当前正式设定。
5. 不新增 UI 假象掩盖运行时问题。
6. 不读取 PNG / WORLD_MAP_ASSETS 作为世界事实。
7. 不破坏 FormalVisualModel / FormalWorldView 链路。
8. 不修改人格核心。
9. 不修改已完成 P8 Formal 结构。

## 10. 当前最终结论

当前整体内容不是完全按三份正式文档走。

已经对齐的部分主要是：

```text
FormalVisualModel
FormalVisualGenerator
FormalWorldView
/world Formal 接入
/world Formal / Debug 切换
/world 空状态文案
```

仍未对齐的主要是：

```text
孵化器旧系统
默认 embryo pet runtime
默认 pet actor
默认 pet facilities
pet_arrival / pet_rest 旧 recipe
world-first-scene-model 旧文案
旧 docs/mvp 文档残留
```

下一步必须优先处理默认 pet / 孵化器旧逻辑，而不是继续做新的布局增强。
