> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD MVP-ALIGN-03 文档体系对齐模块

## 1. 模块定位

MVP-ALIGN-03 是文档体系对齐模块。

本模块目标是清理或降级当前仓库中会误导后续开发的旧 README、旧 docs/mvp、旧架构文档、旧测试报告和乱码阶段计划。

本模块不修改运行时代码。
本模块不修改 world generation 代码。
本模块不修改 placement-engine。
本模块不修改 FormalVisualModel / FormalWorldView。
本模块不新增 UI。
本模块不接入 pet。

## 2. 当前最高依据

当前最高依据是用户最新提交的三份正式文档：

1. `AI-PET-WORLD MVP完整计划书 v1.5`
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`

如果旧 README、旧 docs/mvp、旧测试报告、旧架构文档与三份正式文档冲突，以三份正式文档为准。

## 3. 本模块已完成

本模块已完成：

1. 重写 `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md`，修复乱码并整理为 UTF-8 中文。
2. 清理 `src/systems/home/README.md` 中旧孵化器路线和默认宠物路线。
3. 将 `docs/mvp/PERSONALITY_DRIVEN_WORLD_ENGINE.md` 标记为历史参考。
4. 将 `docs/mvp/PROJECT_FILE_AUDIT.md` 标记为历史参考。
5. 将 `docs/mvp/AI_PET_WORLD_ARCHITECTURE_FREEZE.md` 标记为历史参考。
6. 将 `PROJECT_ARCHITECTURE_V1.md` 标记为历史参考。
7. 将 `src/docs/MVP_REMAINING_TEST_REPORT_2026-05-12.md` 标记为历史测试记录。
8. 重写 `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md`，明确当前正式 MVP 红线和下一模块。

## 4. 当前正式 MVP 边界

当前正式 MVP 不再包含：

1. 旧孵化器路线。
2. 胚胎 / hatching / incubating 默认路线。
3. 默认宠物开局。
4. 默认 pet actor。
5. 默认 pet bed。
6. pet_arrival / pet_rest 初始区域。
7. 用旧 docs/mvp 作为当前最高依据。

当前正式 MVP 开局只允许出现：

1. 管家。
2. 第一片家园。
3. 基础资源。
4. 初始入口区。
5. 初始照护区。
6. 临时住所。
7. 安静生活区。
8. 工具储备区。
9. 自然边界。
10. 世界状态。

宠物未来能力保留，但只能通过：

```text
TownAdoptionPrecheck
-> ButlerAdoptionIntent
-> adoption_safe_apply
```

后置进入。

## 5. 已完成内容总表

| 模块 | 状态 | 说明 |
|---|---:|---|
| FormalVisualModel schema | 已完成 | 正式视觉模型容器已建立。 |
| FormalVisualGenerator | 已完成 | 从 RenderableWorldSnapshot / VisualState 派生 FormalVisualModel。 |
| FormalWorldView | 已完成 | 只读 FormalVisualModel。 |
| /world Formal 接入 | 已完成 | 默认 Formal，Debug 可切换。 |
| 旧孵化器正式链路 | 已清理 | 当前正式链路不再使用。 |
| 默认宠物 actor / placement | 已清理 | 初始世界不再默认生成。 |
| pet_arrival / pet_rest | 已清理 | 初始区域已中性化。 |
| 旧 README / docs | 已标记或清理 | 旧 docs 不再作为当前最高依据。 |
| P8 乱码文档 | 已修复 | 总控计划已重写为 UTF-8 中文。 |

## 6. 当前未完成内容

| 模块 | 状态 | 后续阶段 |
|---|---:|---|
| worldSeed + personality layout input schema | 未完成 | WORLD-GEN-02 |
| 不同 seed / 人格 / 资源状态差异化验证 | 未完成 | WORLD-GEN-02 / WORLD-GEN-03 |
| ConstructionPlanner | 未完成 | CONSTRUCTION 模块 |
| ConstructionExecutor | 未完成 | CONSTRUCTION 模块 |
| MapDiff 驱动长期建设变化 | 未完成 | WORLD-EVOLUTION / CONSTRUCTION 模块 |
| TownAdoptionPrecheck | 未完成 | LIFE-EVENT 模块 |
| ButlerAdoptionIntent | 未完成 | LIFE-EVENT 模块 |
| adoption_safe_apply 后置宠物接入 | 未完成 | PET 后置接入模块 |

## 7. 剩余旧词处理规则

后续全仓库搜索到旧词时，按以下规则判断：

1. 出现在 `MVP_ALIGN_01`、`MVP_ALIGN_02`、`MVP_ALIGN_03`：允许，因为这些文档记录清理过程。
2. 出现在 Guardrails：允许，因为它是在禁止旧路线回流。
3. 出现在 legacy docs：允许，但必须有 legacy 声明。
4. 出现在 historical 测试报告：允许，但必须有 historical 声明。
5. 出现在正式运行代码、正式 README、正式计划文档中：不允许，必须继续清理。

## 8. 下一大模块

下一大模块进入：

```text
WORLD-GEN-02：worldSeed + personality layout input schema
```

WORLD-GEN-02 目标：

1. 定义世界生成输入协议。
2. 明确 seed、管家人格、constructionStyle、resources、world phase 如何影响布局。
3. 让同一 seed + 同一状态稳定复现。
4. 让不同 seed / 人格 / 资源状态产生可观察差异。
5. 为后续 ConstructionPlanner / MapDiff 演化打基础。
