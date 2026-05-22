# AI-PET-WORLD 人格驱动规则世界引擎设计文档（历史参考）

> LEGACY NOTICE / 历史文档声明
>
> 本文件为旧版 MVP 设计参考，不再作为当前 AI-PET-WORLD 的最高实现依据。
>
> 若本文件内容与用户最新提交的三份正式文档冲突，必须以最新三份正式文档为准：
>
> 1. `AI-PET-WORLD MVP完整计划书 v1.5`
> 2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`
> 3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`

## 当前正式边界

当前正式 MVP 已明确：

1. 初始世界只以管家、第一片家园、基础资源、临时住所、初始照护区、安静生活区、工具储备区、自然边界和世界状态为开局事实。
2. 宠物未来能力保留，但只能通过后置生命关系链路进入。
3. 世界内容必须通过规则、状态、生成容器和可审计链路产生。
4. FormalWorldView 只能只读 FormalVisualModel，不生成世界事实。
5. 旧版设定中与当前三份正式文档冲突的内容，不再作为当前实现依据。

## 使用方式

本文件仅用于追溯早期设计思路。

后续 Codex / 开发实现不能引用本文件中的旧设定作为当前实现依据。

当前主线请参考：

1. `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md`
2. `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md`
3. `src/world/engine-notes/MVP_ALIGN_02_REMOVE_INCUBATOR_AND_DEFAULT_PET_CHAIN.md`
4. `src/world/engine-notes/MVP_ALIGN_03_DOCUMENTATION_ALIGNMENT_MODULE.md`
