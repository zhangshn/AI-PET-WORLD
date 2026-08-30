# 退役AI Painter页面资料索引

更新时间：2026-08-30 11:57:50 +08:00

状态：historical-retired-reference

文档版本：`AI-PAINTER-PROGRESS-RETIREMENT-1.0`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 退役结论

`/ai-painter-progress`及其全部子页面已退出当前产品与程序架构。现行统一入口固定为：

```text
/ai-console
```

旧网址只保留无状态永久重定向，不再渲染旧页面，不读取训练状态，不调用旧页面API，也不承担任务选择、验证、审核、控制或授权职责。

本目录保留的旧规格仅用于复核历史页面设计和解释旧运行证据。它们不是现行文档，不得被当前程序、检查器、Codex或本地AI用作路由、数据源、状态机、任务计划、权限或实现依赖。

## 2. 当前权威替代关系

| 旧页面职责 | 当前模块与正式入口 |
|---|---|
| 当前任务、活动执行、队列和闭环 | AP-01 `/ai-console/tasks` |
| 能力候选、资格和发布身份 | AP-02 `/ai-console/capabilities` |
| 训练计划、模型、Run、Checkpoint和训练遥测 | AP-03 `/ai-console/training` |
| 验证过程、机器审核、失败码和证据 | AP-04 `/ai-console/reviews` |
| 数据发布、样本、条件Schema和数据字典 | AP-05 `/ai-console/data` |
| 世界生成、候选、RuntimeFrame和世界消费 | AP-06 `/ai-console/runtime` |
| 不可变证据、事件、事务和政策边界 | AP-07 `/ai-console/evidence` |
| CPU、GPU、内存、磁盘、服务和遥测 | AP-08 `/ai-console/system` |
| 历史训练、审核、生成与合同检索 | AP-09 `/ai-console/archive` |
| 本地人工任务、训练、验证、能力、世界和紧急控制 | AP-10 `/ai-console/control` |

当前页面与后台合同只从`docs/ai-console/README.md`规定的正式阅读链取得。AI Painter长期业务、数据和审核边界继续由`docs/game-world-generation/`中的正式规格定义。

## 3. 代码、API与证据边界

| 路径 | 当前职责 |
|---|---|
| `src/app/ai-painter-progress/[[...legacyPath]]/page.tsx` | 唯一允许保留的旧路由兼容文件；永久重定向到`/ai-console`。 |
| `src/app/api/ai-painter/` | AI Painter共享后台API；仍可能服务`ai-painter-lab`等非退役业务，不随旧UI删除，也不是新控制台查询源。 |
| `src/server/ai-painter-current-training-types.ts` | 后台训练证据聚合使用的中立共享类型。 |
| `.runtime/ai-painter/`、`data/ai-painter/`、SQLite | 正式运行证据和机器状态；不可因页面退役而删除、覆盖或迁移成页面数据。 |

页面退役只删除可视UI和旧页面私有依赖，不删除后台训练程序、共享API、Checkpoint身份、运行证据、审核记录、事件账本或SQLite。

## 4. 固定检查

```text
npm run check:ai-painter-progress-retirement
npm run check:ai-console-structure
npx tsc --noEmit
```

退役检查必须证明：旧UI树只剩永久重定向、后台共享类型不再从页面目录导入、`ai-painter-lab`使用的共享API仍存在、当前AI控制台源码没有旧页面耦合。
