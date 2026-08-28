# AI控制台系统架构规格

更新时间：2026-08-28 19:30:00 +08:00

状态：active-normative-target

文档版本：`AI-CONSOLE-ARCHITECTURE-1.0`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 文档职责

本文定义AI控制台的系统边界、层次、依赖方向、查询与控制分离以及本地独立运行合同，不重复页面功能清单和字段明细。

## 2. 系统上下文

```text
AI控制台页面
→ 新平台页面查询合同API
→ 受信业务投影适配器（逐模块接入）
→ 本地任务、训练、审核、Runtime和资源服务
→ 本地登记、SQLite与不可变证据
```

控制路径单独建立：

```text
AP-10控制页面
→ 本地控制API
→ 回环会话、同源与CSRF复核
→ 命令验证、修订校验与幂等状态机
→ 已登记的本地安全执行器
→ 结果终态与不可变证据
```

观察路径不得产生写入；控制路径不得绕过命令状态机。

## 3. 前端应用壳架构

```text
ApplicationShell
├─ Topbar                         固定主体框架
├─ Body
│  ├─ PrimaryNavigation          固定主体框架
│  ├─ Workspace                  框架内独立滚动
│  │  ├─ PlatformHeader
│  │  ├─ OperatingLoop
│  │  └─ FrameworkStack
│  │     ├─ Framework            外层大Frame
│  │     │  └─ ModuleFrame[]     内层小Frame
│  │     └─ ...
│  └─ ContextRail                框架内平台上下文
└─ Statusbar                     固定状态摘要
```

外层`Framework`表达业务责任边界，内层`ModuleFrame`表达一级模块，模块内部目录进入二级工作页。不得把模块Frame放到外层Frame之外，也不得把全部模块做成无所属关系的卡片墙。

## 4. 代码分层

| 层 | 代码位置 | 职责 |
|---|---|---|
| 平台目录 | `src/app/ai-console/ai-console-catalog.ts` | 四大Frame、十模块、能力域和一级路由 |
| 工作页目录 | `src/app/ai-console/ai-console-workspace-catalog.ts` | 52工作页、字段、状态、来源和呈现类型 |
| 一级页面 | `src/app/ai-console/page.tsx` | 固定平台壳和嵌套Frame投影 |
| 二级渲染 | `src/app/ai-console/ai-console-workspace.tsx` | 模块总览与工作页统一骨架 |
| 页面交互 | `src/app/ai-console/ai-console-workspace-interactions.tsx` | 视图切换、字段筛选、受信记录选择、结果内检索、只读详情和合同连接 |
| 查询合同API | `src/app/api/ai-console/` | 新平台目录与工作页合同，只读失败关闭 |
| 受信投影协议 | `src/server/ai-console/projection-contract.ts` | 统一连接状态、记录、来源、不可用字段和来源证明 |
| AP-08投影适配器 | `src/server/ai-console/system-projection.ts` | 不启动外部进程的CPU、内存、磁盘、当前查询服务与确定性健康探测 |
| AP-05投影适配器 | `src/server/ai-console/data-projection.ts` | 从新平台正式工作页目录投影实体与字段字典，从正式产品文档投影数据发布准入、六类条件Schema和质量门禁；真实发布、Runtime使用与质量报告身份保持未接入 |
| AP-02投影适配器 | `src/server/ai-console/capability-projection.ts` | 从新平台正式能力域目录投影模态与责任，从正式文档投影资格门禁、成熟度、迁移顺序与机器验收合同；具体能力版本结果和机器验收状态保持未接入 |
| AP-01投影适配器 | `src/server/ai-console/task-projection.ts` | 投影版本化闭环流程目录，不读取或改变活动任务与训练状态 |
| AP-06投影适配器 | `src/server/ai-console/runtime-projection.ts` | 只调用正式RuntimeFrame Store和World Runtime Store Adapter的读取入口；缺失联合登记字段保持空值 |
| AP-07投影适配器 | `src/server/ai-console/evidence-projection.ts` | 路由正式证据、事件、控制事务以及证据类型、可恢复事务门禁和政策边界产品合同；任务胶囊与政策报告索引未接入时保持空值或失败关闭 |
| AP-07正式证据投影 | `src/server/ai-console/formal-evidence-projection.ts` | 从固定V7证据索引投影内容寻址身份、逻辑路径、原始字节摘要、来源修订、登记事务和双哈希链；完整性冲突返回`unknown_or_stale` |
| AP-07控制事件投影 | `src/server/ai-console/control-event-projection.ts` | 从固定控制事件JSONL和Head索引返回单调事件、状态转换、事务身份与回执绑定；完整性冲突返回`unknown_or_stale` |
| AP-07控制事务投影 | `src/server/ai-console/control-transaction-projection.ts` | 从新控制台独立SQLite事务登记投影控制提交事务；产品门禁视图与真实事务视图保持分层 |
| 新平台主登记读取器 | `src/server/ai-console/registry-store.ts` | 只读取固定的`data/ai-console/registry/primary-registry-v1.json`，验证Schema、登记身份、单调修订、可信写入器、15个工作页集合和SHA-256；禁止目录扫描 |
| AP-03/AP-04/AP-09投影 | `src/server/ai-console/registry-projection.ts` | 对主登记记录逐字段验证名称、必填项和机器类型；校验后的真实空集允许返回`connected · 0`，任何冲突失败关闭 |
| AP-10命令目录投影 | `src/server/ai-console/control-projection.ts` | 投影命令定义、目标类型、角色、验证规则、参数Schema和安全边界；执行器未登记时返回`partial`并保持无写入 |
| 工作页投影路由 | `src/server/ai-console/workspace-projection.ts` | 只按正式工作页身份选择新平台投影适配器，未登记适配器失败关闭 |
| 本地操作员会话 | `src/server/ai-console-control/operator-session.ts` | 只向回环地址签发短时服务端签名会话；变更请求必须同时通过同源、HttpOnly Cookie与CSRF复核 |
| 安全命令服务 | `src/server/ai-console-control/control-command-service.ts` | 当前只接受`verify_primary_registry`，固定目标、校验登记修订与幂等身份，只读复核新平台主登记并以`wx`语义写入不可变回执；新回执落盘后立即按严格Schema重新读取验证 |
| 控制事件账本 | `src/server/ai-console-control/control-event-ledger.ts` | 对V5后安全命令建立固定JSONL哈希链和原子替换Head索引；使用进程队列、跨进程短锁、单调序号、前序摘要和写后复核，禁止目录扫描 |
| 控制提交事务库 | `src/server/ai-console-control/control-transaction-store.ts` | 使用Node本地SQLite和`BEGIN IMMEDIATE`原子维护V6事务、元数据修订与事务哈希链；写后重新核对数据库、回执、事件和事件Head，不读取旧数据库 |
| 正式证据索引 | `src/server/ai-console-control/formal-evidence-index.ts` | 使用独立SQLite原子保存V7四个固定控制表面的原始字节BLOB、内容寻址身份、来源绑定、证据链与登记批次链；只接受命令服务显式输入，不提供目录扫描器 |
| 控制API | `src/app/api/ai-console/control/` | 只接受回环地址，签发本地操作员会话、查询安全执行器状态、提交主登记核验和按精确命令身份读取回执；成功复核返回`integrityStatus=verified`和固定逻辑路径，禁止任意路径与目录扫描 |

## 5. 依赖规则

1. UI只能依赖新平台目录和`/api/ai-console/`。
2. `/api/ai-console/`不得导入、调用或转发`/api/ai-painter/`。
3. 新平台不得导航、嵌入或读取`/ai-painter-progress/`。
4. 页面目录是静态产品事实，不是运行状态数据库。
5. 权威运行状态必须由受信投影服务验证登记修订、来源和证据；直接机器观察必须带采样时间、探测器与字段不可用原因。
6. 控制权限必须由本地服务端验证，不能依赖前端是否显示按钮。
7. Runtime投影只允许读取文档登记的单一索引或Store Adapter；禁止扫描运行目录、按修改时间推断最新记录，禁止借用训练页面查询服务。
8. AP-07产品合同目录不得冒充运行证据；`evidenceId`、`transactionId`和`policyBoundaryReportId`只能来自独立的新平台正式索引，不能从文件名、旧页面API或目录时间推断。
9. 新平台主登记只能从文档登记的固定逻辑路径读取；不得扫描`.runtime/ai-painter`、`data/ai-painter`或任何历史训练目录补全记录。
10. 控制命令定义与命令执行身份必须分层；`executorIdentity`为空时页面只展示合同，不得提交、排队或执行命令。
11. 当前唯一执行身份固定为`ai_console_primary_registry_verifier_v1`；执行边界固定为`new_ai_console_registry_only`，只允许新控制台自身的回执、事件、控制事务和正式证据登记，不得扩展解释为训练、审核、Checkpoint、Runtime、进程、Shell、业务数据库或旧平台数据库操作权限。
12. 控制回执只写入`.runtime/ai-console/control/command-receipts/{commandId}.json`；文件名、命令身份和内容SHA-256必须一致，已存在身份只能精确读取，不能覆盖。
13. 回执查询必须由调用方提供完整命令身份；服务端不得提供目录枚举、最近文件推断或任意路径参数，页面不得把未知命令显示为真实空历史。
14. 回环边界必须同时验证请求URL、`Host`和存在时的`X-Forwarded-Host`；不得因框架归一化请求URL而忽略非回环主机头。
15. 控制事件主表只允许追加到固定JSONL，Head只允许在短锁内按已验证链原子替换；锁超时、链断裂、Head超前或回执绑定冲突必须失败关闭。
16. 控制事务库固定为`.runtime/ai-console/control/control-transactions-v1.sqlite`；只允许`ai_console_control_transaction_writer_v1`写入，必须启用SQLite完整性检查、固定Schema、FULL同步和数据库忙等待，禁止接受客户端SQL或任意数据库路径。
17. 正式证据索引固定为`.runtime/ai-console/evidence/formal-evidence-index-v1.sqlite`；只允许`ai_console_formal_evidence_index_writer_v1`写入。每批必须恰好登记命令回执、控制事件账本、事件Head和控制事务库四类原始字节，使用嵌入式不可变BLOB、内容寻址身份、双哈希链和首次合格事务边界；禁止接受客户端路径、扫描目录或补录V7以前事务。

## 6. 状态与失败关闭

- `contractStatus`表示页面合同是否合法且可读取。
- `dataStatus`表示权威业务数据是否可用。
- 合同成功不等于训练、任务或资源运行正常。
- 数据缺失返回`null`和原因码，不返回推测值。
- 身份、修订、证据或来源冲突时返回明确错误，不回退旧记录。

## 7. 本地独立运行

控制台是本地系统的观察与操作入口，不是Runtime必要依赖。关闭浏览器或外部开发工具后，本地任务、训练、验证、审核、发布、Runtime和证据保存必须继续。

## 8. 架构验收

1. 顶部与左侧目录属于固定ApplicationShell。
2. 四个外层Framework各自包含登记的ModuleFrame。
3. 页面和API无旧训练页面依赖。
4. 查询与控制链分离，GET观察无副作用。
5. 新能力域复用同一十模块架构，不复制第二套控制台。
6. 唯一安全命令通过回环会话、同源、CSRF、目标、修订、幂等和回执完整性检查；未登记执行器保持禁用。
7. 正式证据索引通过SQLite完整性、固定Schema、登记批次、证据链、嵌入字节摘要和来源绑定检查；AP-07默认视图只显示全部校验通过的记录。
