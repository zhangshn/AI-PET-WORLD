# AI-PET-WORLD

更新时间：2026-08-03 11:12:09 +08:00

状态：active-project-navigation

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本文件只负责项目导航。完整业务定义以[业务规格](docs/BUSINESS_SPEC.md)为准。

## 正式文档入口

1. [文档权威索引](docs/DOCUMENT_AUTHORITY_INDEX.md)
2. [业务规格](docs/BUSINESS_SPEC.md)
3. [项目总体架构](docs/ARCHITECTURE.md)
4. [本地自研AI能力与Codex职能迁移主体架构](docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md)
5. [唯一模块计划表](docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md)
6. 当前模块对应的一份正式规格

## 主要目录

| 路径 | 职责 |
|---|---|
| `src/` | 页面、API、本地AI应用层与游戏Runtime |
| `ml/ai-painter/` | 本地AI Painter模型、训练、验证与推理 |
| `scripts/` | 确定性构建、检查、训练编排、审核与证据程序 |
| `docs/` | 正式业务、架构、规格、治理与唯一计划表 |
| `data/` | 可版本化事实、合同、字典和正式数据记录 |
| `.runtime/` | 不可变运行证据、模型、日志、审核和状态指针 |

## 只读基础检查

```text
npm run check:documentation-policy
npm run check:encoding
npx tsc --noEmit --incremental false
```

`npm run build`不是只读检查：它会写入`.next`并在受保护事务中临时持有`.runtime`入口，因此必须提供与本次构建目标和命令绑定的可信Owner签名授权，并在首次写入前原子消费。
