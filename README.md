# AI-PET-WORLD

更新时间：2026-08-24 07:35:09 +08:00

状态：active-project-navigation

文档版本：`AI-PET-WORLD-NAVIGATION-1.0`

生效日期：`2026-08-24`

批准状态：`active_internal_navigation`

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本文件只负责项目导航。完整业务定义以[业务规格](docs/BUSINESS_SPEC.md)为准。

## 正式文档入口

1. [文档权威索引](docs/DOCUMENT_AUTHORITY_INDEX.md)
2. [业务规格](docs/BUSINESS_SPEC.md)
3. [项目总体架构](docs/ARCHITECTURE.md)
4. [本地自研AI能力与Codex职能迁移主体架构](docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md)
5. [唯一模块计划表](docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md)
6. 当前模块对应的一份正式规格

AI Painter 当前正式合同、历史合同替代关系和能力发布信任链统一由其正式主体规格登记。历史合同保留原始字节用于复核，但不得授权新工作；受信能力发布注册表当前没有正式发布记录，因此正式推理、RuntimeFrame和进入世界保持失败关闭。

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
npm run check:ai-painter-document-contracts
npm run check:encoding
npx tsc --noEmit --incremental false
```

`npm run build`不是只读检查：它会写入`.next`并在受保护事务中临时持有`.runtime`入口，因此属于研发写操作，必须绑定与本次能力变更范围和命令一致的可信Owner身份，并在首次写入前原子消费。已发布能力版本的日常生成与审核不适用该研发构建规则。
