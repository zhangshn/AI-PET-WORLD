# AI控制台文档入口

更新时间：2026-08-28 19:30:00 +08:00

状态：active-module-document-index

文档版本：`AI-CONSOLE-DOC-INDEX-2.0`

生效日期：`2026-08-27`

文档状态：`active_normative_target`

程序符合状态：`v7_formal_evidence_index_connected`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

本目录定义整个本地自研AI平台的全新统一控制台。它不等同、不导航、不嵌入也不调用旧AI Painter训练页面，并且不承担实时运行证据存储。

## 权威文档与职责

| 文档 | 业务作用 |
|---|---|
| `AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md` | 平台总纲：固定产品定位、十模块、四大Frame、观察/控制平面和稳定需求编号。 |
| `AI_CONSOLE_FUNCTIONAL_SPEC.md` | 功能规格：定义用户角色、全局功能、十模块与52个工作页能力、当前实现状态和功能验收。 |
| `AI_CONSOLE_ARCHITECTURE_SPEC.md` | 系统架构：定义应用壳、查询/控制分层、依赖方向、本地运行和失败关闭。 |
| `AI_CONSOLE_INFORMATION_ARCHITECTURE_AND_UI_STANDARD.md` | 信息架构与UI标准：定义路由、固定顶部/左侧主体壳、外层大Frame包含内层ModuleFrame及响应式验收。 |
| `AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md` | 数据与API：定义统一字段、连接状态、页面查询合同、空值和错误语义。 |

阅读顺序固定为：总纲 → 功能规格 → 系统架构 → 信息架构与UI标准 → 数据字典与API合同 → `docs/DIRECTORY_STRUCTURE.md`。

## 关联边界

- `src/app/ai-console/`：AI控制台一级总入口、十个专业模块总览与52个二级业务投影工作台；页面具备业务视图切换、字段筛选、页内定位、上下游、证据关系和可信连接状态，验证控制页支持按完整命令身份精确复核新平台控制回执。
- `src/app/api/ai-console/`：新平台自有的目录、二级页面查询合同和独立控制API；AP-01至AP-10均通过新平台适配器返回，控制API当前只允许核验新平台主登记，不读取旧AI Painter API。
- `src/server/ai-console/`：新平台统一只读投影协议、工作页路由、固定主登记读取器和模块投影适配器；AP-03、AP-04、AP-09只读取`data/ai-console/registry/primary-registry-v1.json`，不得导入旧页面服务。
- `src/server/ai-console-control/`：新平台独立控制服务；提供回环地址操作员会话、同源与CSRF复核、主登记修订校验、幂等执行和不可变回执。当前唯一允许的执行器是`ai_console_primary_registry_verifier_v1`，其余控制命令执行器保持禁用。
- `src/server/ai-console-control/control-event-ledger.ts`：新平台控制事件账本；只把新安全命令绑定到固定JSONL哈希链和单调Head索引，不扫描回执目录，不迁移旧运行内容。
- `src/server/ai-console-control/control-transaction-store.ts`：新平台控制提交事务库；通过本地SQLite原子事务绑定回执、事件、事件Head与事务记录，维护独立修订、事务哈希链和写后全链复核。
- `src/server/ai-console-control/formal-evidence-index.ts`：新平台正式证据索引；只登记命令链显式提供的四个固定表面，以内容寻址身份和嵌入式不可变BLOB保存原始字节快照，不扫描任何目录。
- `data/ai-console/`：新平台主登记与Schema；固定路径、独立来源边界、单调修订、可信写入器和SHA-256校验通过后，才允许把真实空登记显示为`connected · 0`。
- `scripts/check-ai-console-structure.mjs`：确定性检查十个模块、52个工作页、七类呈现、产品身份与运行身份分层、固定/响应式主体壳、二级交互合同和UI语言边界。
- `scripts/check-ai-console-primary-registry.mjs`：确定性检查新平台主登记身份、15个记录集、来源隔离和SHA-256。
- `scripts/check-ai-console-control-service.mjs`：确定性检查唯一安全命令、会话与CSRF边界、执行器隔离及现有不可变回执完整性。
- `scripts/check-ai-console-control-event-ledger.mjs`：确定性检查事件序号、前序摘要、事件摘要、事务身份、回执绑定和Head索引一致性。
- `scripts/check-ai-console-control-transaction-store.mjs`：确定性检查SQLite完整性、表结构、元数据摘要、事务序号与哈希链、回执和事件绑定。
- `scripts/check-ai-console-formal-evidence-index.mjs`：确定性检查正式证据索引Schema、登记批次、证据哈希链、嵌入字节摘要、来源绑定和最新固定表面一致性。
- `.runtime/ai-console/control/command-receipts/`：新控制台安全命令的不可变幂等回执；只保存新平台主登记核验结果，不保存或迁移旧训练证据。
- `.runtime/ai-console/control/control-event-ledger-v1.jsonl`与`control-event-ledger-head-v1.json`：新控制台追加式控制事件和固定Head索引；AP-07事件账本只从这两个精确路径读取。
- `.runtime/ai-console/control/control-transactions-v1.sqlite`：V6后新控制台安全命令的控制提交事务登记；不连接或迁移旧平台数据库。
- `.runtime/ai-console/evidence/formal-evidence-index-v1.sqlite`：V7后新控制台正式证据登记；原子保存命令回执、事件账本、事件Head和控制事务库的内容寻址字节快照，不读取旧平台目录。
- `src/app/ai-painter-progress/`：旧AI Painter训练与验证页面；与新AI控制台完全解耦，不属于其下游目录。
- `docs/ai-painter-progress/`：现有AI Painter训练页面和后台接口规格。
- `docs/DOCUMENT_AUTHORITY_INDEX.md`：项目文档权威顺序和Owner职责唯一来源。
- `docs/DIRECTORY_STRUCTURE.md`：项目目录职责。

实时状态、训练证据、控制命令和数据库记录必须来自本地程序及其正式机器记录；Markdown只定义长期接口和业务边界。
