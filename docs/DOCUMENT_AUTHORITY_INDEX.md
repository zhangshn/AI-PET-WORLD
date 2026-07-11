# 项目文档权威索引

更新时间：2026-07-11 12:32:00 +08:00

状态：正式文档治理入口 / 已生效 / 当前世界地图主线受数据缺口和人工拒绝阻断

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

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
           model_training_alignment_failed,
           training_data_persistence_failed,
           complete_world_visual_inference_not_implemented
```

下一正式阶段是完整地图数据缺口闭合，不是继续旧的 P10-B3 Chunk 出图，也不是盲目训练局部材料。

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
