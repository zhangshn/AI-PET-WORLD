# 项目文档权威索引

更新时间：2026-07-14 14:39:13 +08:00

状态：正式文档治理入口 / 已生效 / 当前世界地图主线受数据缺口和人工拒绝阻断

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

未经项目所有者明确允许，任何智能体和程序不得修改已锁定页面的布局、样式、入口、名称或信息层级；如发现新需求、缺陷或无法继续的问题，必须先向项目所有者说明原因、影响和拟议调整，停止页面修改并等待明确指令后方可执行。

## 1. 唯一当前执行入口

当前世界地图工作的唯一执行入口是：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

当前唯一程序入口是：

```text
npm run run:complete-game-world
```

旧计划、阶段进度表和旧 `live-world` 文档已经删除。当前执行指南之外不得再建立平行计划。

## 2. 文档优先级

| 优先级 | 类型 | 位置 | 权限 |
|---:|---|---|---|
| 0 | 项目所有者明确命令 | 当前任务 | 可以批准、拒绝或调整正式计划 |
| 1 | 智能体入口规则 | `AGENTS.md` | 强制所有新窗口先读取文档权威和当前执行指南 |
| 2 | 整体业务与长期架构 | `docs/BUSINESS_SPEC.md`、`docs/ARCHITECTURE.md` | 定义两大核心业务、长期产品边界和系统关系；不直接决定当前任务下一步 |
| 3 | 当前执行指南 | `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md` | 决定当前状态、阻断和下一步 |
| 4 | 文档治理 | `docs/DOCUMENTATION_POLICY.md`、本文档 | 决定文档分类、时间戳和修改规则 |
| 5 | 正式地图架构 | `docs/game-world-generation/` 的 3 份正式规格 | 定义视觉实现、训练数据来源、审核自动化与存储；不得再按阶段目录拼接平行路线 |
| 6 | 世界视觉数据字典 | `docs/world-visual-data-dictionary/` | 定义小模型、审核器和人工审核共用的视觉事实 |
| 7 | 页面与后台锁定规格 | `docs/ai-painter-progress/` 中的 `*_LOCKED_SPEC*` | 约束控制台和自动保存边界 |
| 8 | 自动化与实施契约 | `docs/ai-painter-progress/` 的自动保存、诊断、后台和模型对齐规格 | 约束程序行为，不决定总路线 |
| 9 | 人格数据技术子系统 | `docs/ziwei/` | 独立维护紫微斗数与相关数据；不参与当前地图执行顺序，但长期必须通过人格映射契约服务 AI 管家 |

### 2.1 AI Painter 正式阅读链

任何窗口处理 AI Painter、原图库、训练数据、完整地图模型或控制台前，必须按下列顺序逐级读取，不得从某个下级目录自行反推总路线：

```text
DOCUMENT_AUTHORITY_INDEX.md
-> BUSINESS_SPEC.md                         [业务目的和产品边界]
-> ARCHITECTURE.md                          [系统关系和统一数据流]
-> CURRENT_EXECUTION_GUIDE_20260710.md      [当前状态、阻断和下一步]
-> 当前任务对应的一份正式规格
   -> AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md   [模型与推理]
   -> TRAINING_DATA_AND_SOURCE_POLICY.md         [原图、样本与数据包]
   -> REVIEW_AUTOMATION_AND_STORAGE_SPEC.md      [审核、自动化与存储]
-> DIRECTORY_STRUCTURE.md                   [代码与数据物理位置]
-> 对应 *_LOCKED_SPEC.md                    [仅在修改页面或后台契约时读取]
```

AI Painter 数据关系固定为：五类原图库是并行视觉知识分类，不是五个执行阶段、五个 Runtime 图层或五个独立模型。合格记录经统一登记进入同一个不可变完整世界数据包，由单一正式完整世界推理入口消费并生成完整地图候选；禁止把分类图片机械拼接成最终地图。

项目身份同时固定为：AI-PET-WORLD 是像素风格自主世界游戏，本地小 AI 是游戏智能核心；AI Painter 只是视觉生产子系统，“画图”只是它服务游戏的一项功能。任何文档或智能体不得把项目简化成 AI 绘图工具，也不得让 AI Painter 取代世界事实、Runtime、世界导演或角色自主系统。

第一版正式视觉契约固定为 2D 高分辨率像素风完整地图：模型原生画布 `1024×768`，正式候选必须覆盖完整地图并直接生成该分辨率。禁止从 `256×192`、tile、sprite、局部材料或其他低分辨率图放大、拼接得到正式候选；当前仍因数据、地球参数快照、checkpoint 和 owner review 阻断。

本文档中的分辨率术语只有一种解释：`1024×768` 是原图、正式候选、机器审核、owner review 和 Runtime 的唯一原生画布；`256×192 -> 512×384 -> 1024×768` 只描述训练内部可采用的渐进分辨率，不授权把低分辨率 RGB 输出放大为正式候选。任何窗口若把训练阶段分辨率解释成正式输出契约，必须以本条纠正，不得建立另一份路线说明。

画法/生成算法与风格契约必须分开理解并同时满足：前者定义世界事实、导演结果、23 通道条件和本地模型如何生成本轮新像素；后者定义所有合格画面共享的视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性。季节、湿度、生态类型和对象状态可以改变画面内容与状态色彩，但不得自行改变上述共同视觉语法。

第一版当前世界档案固定为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`，以东南亚大陆热带季风低地、河谷和丘陵生态为现实参照。机器权威文件为 `mainland-southeast-asia-tropical-monsoon-profile-v1.json`、对应物种目录、`coverage-blueprint.json` 和 `provisional-visual-snapshot-v2.json`。旧温带概念图片、原图库记录和来源副本已按项目所有者命令删除；旧档案定义文件只作迁移说明，不得进入当前训练或自动恢复记录。

第一版自然家园同时是未来类地球大世界中的第一个连接区域，不是孤立图片。大世界连接原则的机器权威为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。项目所有者已命令按真实地球条件定义第一版连接，程序据当前东南亚热带季风档案、NASA 快照和湄公河委员会水文/地理事实登记 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`；它不复制真实地图几何。Runtime 世界事实迁移已由项目所有者授权并由程序写入 tick 2；项目所有者随后审核通过连接事实，程序写入 tick 3。迁移报告位于 `.runtime/world-connectivity-migrations/latest.json`，审核记录位于 `.runtime/world-connectivity-owner-reviews/latest.json`；当前只剩连接训练覆盖门槛未批准。

## 3. 目录分类

```text
docs/
├─ DOCUMENT_AUTHORITY_INDEX.md              [active-governance]
├─ DOCUMENTATION_POLICY.md                   [active-governance]
├─ game-world-generation/                    [active-architecture]
├─ world-visual-data-dictionary/             [active-reference]
├─ ai-painter-progress/                      [active-locks + automation-contracts]
└─ ziwei/                                    [separate-subsystem / personality-data-input]
```

根目录 `README.md` 只负责当前导航；根目录 `AGENTS.md` 负责强制新智能体窗口遵守上述读取顺序。

## 4. 当前状态

```text
status = blocked
canEnterWorld = false
blockers = owner_review_rejected, data_gap_insufficient,
           project_owned_checkpoint_missing,
           world_connectivity_coverage_thresholds_pending
```

自有扩散训练程序、采样器和 `strict-project-owned-training-data-v1` IP 门禁已经实现并通过检查。第一版真实地球参照连接蓝图、Runtime 迁移及项目所有者审核记录均已写入，当前世界为 tick 3；下一正式阶段是按五类并行视觉知识目录获取、接收、审核并登记绑定连接事实的合规 RGB 数据，统一构建完整世界数据包并训练首个项目自有 checkpoint。连接覆盖门槛仍须项目所有者批准。不是只做 20 张完整地图，不是继续旧的 P10-B3 Chunk 出图，也不是盲目训练局部材料。

## 5. 旧文档清理规则

1. 已被当前正式文档替代的旧计划、旧进度和旧阶段报告必须删除。
2. 不建立历史文档副本，也不允许旧文档重新取得执行权。
3. 训练失败、审核和模型运行证据由程序保存在 `data/` 或 `.runtime/`，不依赖 Markdown 文档保存。
4. 删除文档不得删除程序自动保存的图片、JSON、模型、日志和审核记录。
5. 当前地图下级规格固定为 3 份；不得重新建立 `00-15` 阶段文档树。
6. 世界视觉数据字典的分层条目是机器参考，不属于智能体默认必读集。

## 6. 状态词

| 状态 | 含义 |
|---|---|
| `active-governance` | 当前文档治理依据 |
| `active-architecture` | 当前正式架构和验收依据 |
| `active-reference` | 当前数据字典或标准参考 |
| `active-lock` | 已锁定页面、API 或自动保存边界 |
| `automation-contract` | 自动保存、后台、诊断或训练控制器必须遵守的程序契约 |
| `separate-subsystem` | 独立维护的技术子系统；`docs/ziwei/` 不参与当前地图执行顺序，但其结构化结果属于 AI 管家核心业务输入 |
| `blocked` | 规则有效，但当前条件不足，禁止晋级 |

## 7. 修改规则

所有新增或更新的正式文档必须同时具备：

1. `更新时间：YYYY-MM-DD HH:mm:ss +08:00`。
2. `状态：...`。
3. 固定项目所有者控制句。
4. 明确的数据来源、适用范围和禁止事项。
5. 如改变当前执行顺序，必须同步更新当前执行指南。
6. 页面布局、样式、入口、名称和信息层级属于项目所有者锁定内容；提出需求不等于获得修改授权，必须等待项目所有者明确指令。
