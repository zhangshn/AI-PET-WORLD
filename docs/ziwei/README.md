# 紫微斗数完整排盘总览

版本：v0.2  
状态：架构细化  
更新日期：2026-06-27

## 目标

在项目中新增一个可展示完整紫微斗数盘的页面和算法层，页面中要排出：

1. 十二宫完整盘：命宫、身宫、宫名、地支、宫干、五行局。
2. 全量星曜：14 主星、辅曜、煞曜、四化、杂曜、长生十二神、博士十二神、岁前/将前类星曜。
3. 动态盘：大限、流年、流月、流日、流时。
4. 调试信息：每颗星的安星来源、规则编号、输入参数、计算步骤。

## 当前代码基础

| 模块 | 当前已有 | 后续处理 |
|---|---|---|
| `ziwei-engine.ts` | 命宫、身宫、十二宫、五行局、14 主星、借宫 | 保留为基础算法，逐步拆出主星安放器 |
| `calculator.ts` | 把地支盘转成 `BirthPattern` | 保留给人格层，不作为完整排盘页面唯一数据源 |
| `dynamic/*` | 大运、流年、流月、流日、流时落宫 | 后续接入完整星曜和动态四化 |
| `knowledge/stars.ts` | 只定义空宫与 14 主星 | 扩展为独立 `star-catalog` |
| `src/app` | 暂无独立紫微完整盘页面 | 新增 `/ziwei` 页面和 API |

## 文档拆分

| 文档 | 说明 |
|---|---|
| [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md) | 先看这个，决定代码放哪里 |
| [PARAMETER_CONTRACTS.md](./PARAMETER_CONTRACTS.md) | 参数定义只放一处，其他模块统一调用 |
| [LEGACY_MIGRATION.md](./LEGACY_MIGRATION.md) | 旧紫微模块如何迁到新架构 |
| [ALGORITHM_MODULES.md](./ALGORITHM_MODULES.md) | 算法怎么拆、每一层输入输出是什么 |
| [RULE_SOURCE_TABLE.md](./RULE_SOURCE_TABLE.md) | 每个安星规则编号、当前口径、代码位置和待校准项 |
| [INTERPRETATION_LAYER.md](./INTERPRETATION_LAYER.md) | 解释层目录、契约、页面展示和规则追溯 |
| [PAGE_STRUCTURE.md](./PAGE_STRUCTURE.md) | 页面、组件、API、ViewModel 怎么拆 |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | 先做什么、后做什么、怎么验收 |
| [EXECUTION_TABLE.md](./EXECUTION_TABLE.md) | 开工执行表，按任务逐项推进 |

## 不混放原则

1. 跨模块参数只在 `contracts` 定义一次。
2. 星曜定义不写算法。
3. 安星算法不写 UI 文案。
4. 完整盘结构不改人格解释结构。
5. 页面组件不直接调用底层散函数，只读 API 或 ViewModel。
6. 调试输出和正式展示分开，不让页面组件拼装算法细节。
7. 旧模块只能作为迁移入口或兼容 adapter，不能继续承载新增完整盘功能。
