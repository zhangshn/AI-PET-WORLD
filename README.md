# AI-PET-WORLD

更新时间：2026-08-24 09:48:00 +08:00

状态：active-project-navigation

文档版本：`AI-PET-WORLD-NAVIGATION-1.0`

生效日期：`2026-08-24`

文档状态：`active_internal_navigation`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

本文件只负责项目导航。完整业务定义以[业务规格](docs/BUSINESS_SPEC.md)为准。

## 正式文档入口

1. [文档权威索引](docs/DOCUMENT_AUTHORITY_INDEX.md)
2. [业务规格](docs/BUSINESS_SPEC.md)
3. [项目总体架构](docs/ARCHITECTURE.md)
4. [本地自研AI能力与Codex职能迁移主体架构](docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md)
5. [唯一模块计划表](docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md)
6. 当前模块对应的一份正式规格

AI Painter 当前正式合同、历史合同替代关系和能力发布信任链统一由其正式主体规格登记。历史合同保留原始字节用于复核，但不得启动新工作。正式能力由本地系统依据当前业务合同、完整机器证据和原子发布记录自主建立、验证、发布与回退，不以Owner逐次签名作为产品运行前提；实际可运行能力状态只从机器注册表读取，不在README复制。

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

`npm run build`不是只读检查：它会写入`.next`并在受保护事务中临时持有`.runtime`入口。由本地自研AI执行时，必须属于当前项目合同允许的任务、通过资源与写入边界检查并使用内部幂等票据；由Codex等外部智能体执行时，仍须位于Owner当前明确任务范围内。两者均不得凭页面身份、聊天历史或自报状态绕过门禁。
