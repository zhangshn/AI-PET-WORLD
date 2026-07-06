# 紫微斗数完整排盘文档入口

版本：v0.3
状态：已迁移到当前 8 份紫微斗数文档
更新日期：2026-07-04

这个文件只保留总入口。紫微斗数完整排盘不要把算法、页面、星曜、调试、测试全部堆在一个目录或一个文档里，后续统一按 `docs/ziwei/` 的拆分执行。

## 文档目录

| 文档 | 内容 |
|---|---|
| [README.md](./ziwei/README.md) | 紫微斗数文档入口、项目目的和当前状态 |
| [ROADMAP.md](./ziwei/ROADMAP.md) | P22-P34 闭合进度和 P35 资料采集与分析路线 |
| [DIRECTORY_STRUCTURE.md](./ziwei/DIRECTORY_STRUCTURE.md) | 当前 8 份文档、核心代码目录和检查脚本 |
| [ALGORITHM_CONTRACTS.md](./ziwei/ALGORITHM_CONTRACTS.md) | 参数契约、硬规则来源和闭合检查 |
| [CONTENT_DATA_DICTIONARY.md](./ziwei/CONTENT_DATA_DICTIONARY.md) | 数据字典规模、边界和 P24-P34 闭合范围 |
| [SOURCE_STORAGE_BOUNDARY.md](./ziwei/SOURCE_STORAGE_BOUNDARY.md) | 理论来源、来源引用和可存储边界 |
| [PAGE_ACCEPTANCE.md](./ziwei/PAGE_ACCEPTANCE.md) | `/ziwei` 页面展示和人工验收要求 |
| [EXECUTION_TABLE.md](./ziwei/EXECUTION_TABLE.md) | 已完成进度和 P35 资料采集执行状态 |

## 核心原则

1. 紫微斗数资料和算法先闭合，再考虑行为映射。
2. 参数、枚举、星曜、格局、四化、庙旺落陷、动态盘规则只定义一次。
3. 页面只读取 API / ViewModel，不直接改底层算法。
4. 数据字典是数据字典，当前盘解释是当前盘解释。
5. 公版古籍可以存原文和自有摘要；现代资料只做来源索引和人工复核，不采集现代书籍内容、截图、商标、图标或成套表达。
6. 当前闭合检查入口为 `check-hard-rule-source-drift.mjs`、`check-content-knowledge-repository.mjs`、`check-p24-p34-closure.mjs`。
