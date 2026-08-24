# 完整游戏世界生成正式文档索引

更新时间：2026-08-24 09:48:00 +08:00

状态：active-game-world-document-index

文档版本：`AI-PAINTER-DOCUMENT-INDEX-1.0`

生效日期：`2026-08-24`

文档状态：`active_internal_formal_index`

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 当前文件

```text
docs/game-world-generation/
├─ README.md
├─ DOCUMENT_INDEX.md
├─ CURRENT_EXECUTION_GUIDE_20260710.md
├─ AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md
├─ TRAINING_DATA_AND_SOURCE_POLICY.md
├─ REVIEW_AUTOMATION_AND_STORAGE_SPEC.md
├─ FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md
├─ CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md
└─ CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md
```

| 文档 | 权限 |
|---|---|
| `CURRENT_EXECUTION_GUIDE_20260710.md` | 项目唯一模块计划表；只在模块边界变化时更新 |
| `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | 定义AI Painter长期业务主体、输入输出、四段机器接口、稳定需求编号、自主能力生命周期、机器发布、历史合同替代、自动审核与研发边界 |
| `TRAINING_DATA_AND_SOURCE_POLICY.md` | 定义样本来源、数据合同和严格门槛 |
| `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 定义本地自动审核、发布/回退、失败学习、内部任务票据、状态投影和存储 |
| `FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md` | 定义流动水体边界连接、相邻EdgePort和全历史骨架唯一性 |
| `CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md` | 定义条件图对历史RGB的模板收敛预防 |
| `CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md` | 锁定条件预检与RGB复审使用相同水体阈值 |
| `README.md` | 只提供阅读导航 |
| `DOCUMENT_INDEX.md` | 只声明正式文件清单 |

## 已合并删除的内容

原 `00-15` 阶段目录中的世界理解、导演、多尺度、过渡、视觉原子、审美、失败记忆、训练数据、模型计划、数据缺口、审核、实施路线、控制台、数据库和自主循环文档，已分别合并进入正式主体规格、数据与来源规则、审核与存储规格。三份补充规格只承载已落地机器合同所需的水文和跨模态门禁，不代表恢复阶段性文档树。

这些旧文件不得恢复，也不得另建 `history`、`archive-docs` 或平行计划保存副本。运行证据继续保存在 `data/` 和 `.runtime/`，不受 Markdown 清理影响。

这里的“旧文件不得恢复”只指已经合并删除的旧 Markdown 阶段文档，不包括不可变机器合同和运行证据。历史机器合同必须保留原始字节，由替代索引声明后继与停用状态；新任务只能使用当前合同和受信能力发布注册表。

## 字典边界

`docs/world-visual-data-dictionary/` 的分层条目继续作为机器可导出的正式事实定义，不计入智能体默认阅读链。需要字段细节时只读取相关条目，不得全量读取后改变当前路线。
