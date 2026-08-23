# 完整游戏世界生成文档入口

更新时间：2026-08-24 07:35:09 +08:00

状态：active-game-world-generation-index

文档版本：`AI-PAINTER-DOCUMENT-ENTRY-1.0`

生效日期：`2026-08-24`

批准状态：`active_internal_navigation`

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本目录定义类地球世界的完整地图视觉生产、训练数据、审核存储、水文连接和跨模态去重合同。它不保存某次运行结果、临时阻断或授权历史。

## 阅读顺序

1. `../DOCUMENT_AUTHORITY_INDEX.md`
2. `../BUSINESS_SPEC.md`
3. `../ARCHITECTURE.md`
4. `CURRENT_EXECUTION_GUIDE_20260710.md`：项目唯一模块计划表
5. 当前模块直接涉及的一份正式规格

## 正式规格

| 文件 | 稳定职责 |
|---|---|
| `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | AI Painter业务输入输出、四段机器接口、需求追踪、能力版本、受信发布注册和模型实现边界 |
| `TRAINING_DATA_AND_SOURCE_POLICY.md` | 训练样本、来源、数据包与审计规则 |
| `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 审核、失败学习、自动写入和存储合同 |
| `FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md` | 流动水体端口、连通和全历史骨架唯一性 |
| `CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md` | 条件图对历史RGB的模板收敛防护 |
| `CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md` | 条件预检与RGB复审的水体阈值一致性 |
| `DOCUMENT_INDEX.md` | 本目录正式文件职责索引 |

运行状态、授权消费、训练指标、图片、失败码和不可变证据由本地程序写入`data/`、`.runtime/`和SQLite；目录README不复制这些事实。

世界视觉字典按需读取`../world-visual-data-dictionary/README.md`及任务涉及条目，不得从目录顺序推导训练顺序。

历史机器合同不在本目录复制或删除；它们由正式主体规格登记的替代索引保留并停用。当前正式运行能力只能来自受信能力发布注册表，不能由旧合同、调用方布尔字段或聊天记录自行声明。
