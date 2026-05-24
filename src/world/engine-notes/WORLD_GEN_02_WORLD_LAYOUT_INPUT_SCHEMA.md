> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD WORLD-GEN-02 世界布局输入协议模块

## 1. 模块定位

WORLD-GEN-02 建立 `worldSeed + personality layout input schema`。

本模块目标不是做 UI，也不是调整 FormalWorldView，而是把初始家园布局从“固定 recipe + 局部 seed 偏移”推进到“稳定 seed + 管家建设人格 + 资源状态 + 世界阶段 + layout variant”共同驱动。

## 2. 最高依据

本模块遵循：

1. `AI-PET-WORLD MVP完整计划书 v1.5`
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`
4. `P8_FORMAL_VISUAL_STAGE_PLAN.md`
5. `ENGINE_DEVELOPMENT_GUARDRAILS.md`
6. `MVP_ALIGN_03_DOCUMENTATION_ALIGNMENT_MODULE.md`

## 3. 本模块完成内容

本模块新增 / 扩展了以下能力：

1. 在 `generation-schema.ts` 中新增 `WorldLayoutGenerationInput`。
2. 新增 `WorldLayoutPersonalityInput`，承接管家建设人格对布局的影响。
3. 新增 `WorldLayoutResourceInput`，承接初始资源状态对布局的影响。
4. 新增 `WorldLayoutPhaseInput`，承接初始世界阶段对布局的影响。
5. 新增 `WorldLayoutVariantInput`，由 seed 稳定派生布局变体。
6. 新增 `world-layout-input-builder.ts`，从 `InitialHomeGenerationInput + seed + resources` 构建布局输入。
7. 新增 `world-layout-input-audit.ts`，审计布局输入是否符合当前 MVP 边界。
8. `initial-home-generator.ts` 已构建 layout input 并传入 PlacementEngine。
9. `placement-engine.ts` 已开始读取 layout input 影响路径、住所、自然边界、安静生活区和装饰。

## 4. Layout Input 字段

`WorldLayoutGenerationInput` 包含：

```text
worldId
ownerId
seed
birthSignature
worldSalt
personality
resources
phase
variant
tags
```

其中：

| 字段 | 作用 |
|---|---|
| seed | 保证同一输入稳定复现。 |
| personality | 管家建设人格对路径、边界、照护、审美、安静区和适应性的影响。 |
| resources | 初始资源对紧凑度、自然密度、建设准备和照护准备的影响。 |
| phase | 初始世界阶段对发展压力和扩张准备度的影响。 |
| variant | seed 派生出的 pathStyle、shelterBias、natureBias、quietAreaBias。 |

## 5. PlacementEngine 如何读取 layout input

当前 PlacementEngine 已使用 layout input：

1. `variant.pathStyle` 影响核心路径是否 direct / curved / clustered。
2. `variant.shelterBias` 影响临时住所偏向中心、边界保护或资源邻近。
3. `variant.natureBias` 影响自然边界开放、柔和或密集。
4. `variant.quietAreaBias` 影响安静生活区靠近住所、自然或照护点。
5. `personality.structurePreference` 影响路径和储物工具区秩序。
6. `personality.aestheticPreference` 影响地表装饰与承托边缘柔化。
7. `personality.protectionPreference` 影响自然边界密度。
8. `personality.quietPreference` 影响安静生活区留白和装饰数量。
9. `resources.spacePressure` 影响承托区紧凑程度。
10. `resources.naturalGrowth` 影响自然物数量。

## 6. Recipe 的新边界

Recipe 仍然存在，但它只是候选结构，不是固定最终画面。

最终 placements 必须经过：

```text
worldSeed
+ personality layout input
+ resource layout input
+ phase input
+ layout variant
+ PlacementEngine
+ PlacementRules
```

后才能成为 `HomeMapState.placements`。

## 7. 禁止回流内容

本模块没有恢复，也禁止恢复：

1. 孵化器。
2. 胚胎 / hatching / incubating 默认路线。
3. 默认宠物开局。
4. 默认 pet actor。
5. 默认 pet bed。
6. pet_arrival / pet_rest 初始区域。
7. UI / CSS 决定布局事实。
8. Math.random / Date.now / any 生成布局差异。

## 8. 验收标准

本模块验收标准：

1. 同一 seed + 同一 input 生成稳定 layout input。
2. 不同 ownerId / birthSignature / worldSalt 可产生不同 variant。
3. 不同管家建设人格可影响 pathStyle、shelterBias、natureBias、quietAreaBias。
4. 不同资源状态可影响自然密度、承托紧凑度和布局阶段。
5. PlacementEngine 读取 layout input，而不是只读固定 recipe。
6. 正式代码中不重新出现旧孵化器 / 默认宠物路线。

## 9. 下一模块建议

下一模块进入：

```text
WORLD-GEN-03：布局差异化验证与 debug audit
```

WORLD-GEN-03 目标：

1. 构建多个 seed / 人格 / 资源组合的生成对照。
2. 验证同一 input 稳定复现。
3. 验证不同 input 产生可观察差异。
4. 输出布局差异 audit，而不是靠肉眼猜测。
