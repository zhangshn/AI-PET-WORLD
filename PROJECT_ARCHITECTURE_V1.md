> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD Architecture V1（历史参考）

> LEGACY NOTICE / 历史文档声明
>
> 本文件是旧版架构参考文档，不再作为当前 AI-PET-WORLD 的最高实现依据。
>
> 若本文件与用户最新三份正式文档冲突，以最新三份正式文档为准：
>
> 1. `AI-PET-WORLD MVP完整计划书 v1.5`
> 2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`
> 3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`

## 当前正式边界

当前正式 MVP 已确认：

1. 世界内容必须由规则、状态、生成容器和可审计链路产生。
2. FormalVisualModel First。
3. FormalWorldView 只能只读 FormalVisualModel。
4. 初始世界只允许以管家、第一片家园、基础资源、临时住所、初始照护区、安静生活区、工具储备区、自然边界和世界状态作为开局事实。
5. 宠物未来能力保留，但只能通过 LifeEvent / CompanionDecision / accept_companion 后置进入。
6. 后续重点是 worldSeed + personality layout input schema，以及长期 Construction / MapDiff 世界演化。

## 使用方式

本文件仅用于追溯旧架构思路。

当前实现和后续 Codex 指令请以以下文件为准：

1. `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md`
2. `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md`
3. `src/world/engine-notes/MVP_ALIGN_02_REMOVE_INCUBATOR_AND_DEFAULT_PET_CHAIN.md`
4. `src/world/engine-notes/MVP_ALIGN_03_DOCUMENTATION_ALIGNMENT_MODULE.md`
