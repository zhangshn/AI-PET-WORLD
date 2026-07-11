# 完整游戏世界生成正式文档索引

更新时间：2026-07-11 12:32:00 +08:00

状态：active-architecture-index / 6 份文档 / 禁止重建阶段性文档树

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 当前文件

```text
docs/game-world-generation/
├─ README.md
├─ DOCUMENT_INDEX.md
├─ CURRENT_EXECUTION_GUIDE_20260710.md
├─ AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md
├─ TRAINING_DATA_AND_SOURCE_POLICY.md
└─ REVIEW_AUTOMATION_AND_STORAGE_SPEC.md
```

| 文档 | 权限 |
|---|---|
| `CURRENT_EXECUTION_GUIDE_20260710.md` | 唯一决定当前状态、阻断和下一步 |
| `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | 定义完整视觉生产技术边界 |
| `TRAINING_DATA_AND_SOURCE_POLICY.md` | 定义样本来源、数据合同和严格门槛 |
| `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 定义审核、回写、自动运行和存储 |
| `README.md` | 只提供阅读导航 |
| `DOCUMENT_INDEX.md` | 只声明正式文件清单 |

## 已合并删除的内容

原 `00-15` 阶段目录中的世界理解、导演、多尺度、过渡、视觉原子、审美、失败记忆、训练数据、模型计划、数据缺口、审核、实施路线、控制台、数据库和自主循环文档，已分别合并进入上述三份正式规格。

这些旧文件不得恢复，也不得另建 `history`、`archive-docs` 或平行计划保存副本。运行证据继续保存在 `data/` 和 `.runtime/`，不受 Markdown 清理影响。

## 字典边界

`docs/world-visual-data-dictionary/` 的分层条目继续作为机器可导出的正式事实定义，不计入智能体默认阅读链。需要字段细节时只读取相关条目，不得全量读取后改变当前路线。

