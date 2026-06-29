# 紫微斗数完整排盘文档入口

版本：v0.2  
状态：已拆分为模块化文档  
更新日期：2026-06-27

这个文件只保留总入口。紫微斗数完整排盘不要把算法、页面、星曜、调试、测试全部堆在一个目录或一个文档里，后续统一按 `docs/ziwei/` 的拆分执行。

## 文档目录

| 文档 | 内容 |
|---|---|
| [README.md](./ziwei/README.md) | 紫微完整盘总览、边界和当前目标 |
| [DIRECTORY_STRUCTURE.md](./ziwei/DIRECTORY_STRUCTURE.md) | 代码目录结构、每层职责、禁止混放规则 |
| [PARAMETER_CONTRACTS.md](./ziwei/PARAMETER_CONTRACTS.md) | 参数、类型、枚举的唯一来源，禁止重复定义 |
| [LEGACY_MIGRATION.md](./ziwei/LEGACY_MIGRATION.md) | 现有紫微模块如何按新架构整改迁移 |
| [ALGORITHM_MODULES.md](./ziwei/ALGORITHM_MODULES.md) | 排盘算法流水线、星曜安放模块、数据流 |
| [PAGE_STRUCTURE.md](./ziwei/PAGE_STRUCTURE.md) | `/ziwei` 页面、组件、API、ViewModel 拆分 |
| [IMPLEMENTATION_PLAN.md](./ziwei/IMPLEMENTATION_PLAN.md) | 分阶段实施顺序、验收标准、风险 |
| [EXECUTION_TABLE.md](./ziwei/EXECUTION_TABLE.md) | 准备开工用的执行计划表、依赖、验收、状态 |

## 核心原则

1. `ziwei-core` 继续保留已有基础算法，不把完整页面盘面直接塞进人格模型。
2. 参数、类型、枚举统一放进 `contracts`，只定义一次，算法、API、页面都 import 使用。
3. 完整排盘新增独立模块：本命地基、星曜目录、安星流水线、完整盘组装、页面 ViewModel 分开。
4. 原先已有紫微内容也必须按新架构整改，不能继续在旧文件里扩写新功能。
5. 主星、辅曜、煞曜、四化、杂曜、长生十二神、年/月/日/时系星曜分别放在独立目录。
6. 页面组件按输入、宫格、宫位详情、星曜总表、动态盘、调试 JSON 拆开。
7. 每颗星必须可追踪：星曜定义、安星规则、落宫结果、页面展示都不能混在同一个文件里。
