# 完整游戏世界生成正式文档索引

更新时间：2026-10-14 23:16:43 +08:00

状态：active-game-world-document-index

文档版本：`AI-PAINTER-DOCUMENT-INDEX-1.4`

替代版本：`AI-PAINTER-DOCUMENT-INDEX-1.3`

生效日期：`2026-10-14`

文档状态：`active_internal_formal_index`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

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
| `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | 定义AI Painter长期业务主体、输入输出、四段机器接口、稳定需求编号、自主能力生命周期、机器发布、自动审核、完整MVP生命视觉合同与验收责任 |
| `TRAINING_DATA_AND_SOURCE_POLICY.md` | 定义样本来源、数据合同和严格门槛 |
| `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 定义本地自动审核、发布/回退、失败学习、内部任务票据、状态投影和存储 |
| `FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md` | 定义流动水体边界连接、相邻EdgePort和全历史骨架唯一性 |
| `CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md` | 定义条件图对历史RGB的模板收敛预防 |
| `CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md` | 锁定条件预检与RGB复审使用相同水体阈值 |
| `README.md` | 只提供阅读导航 |
| `DOCUMENT_INDEX.md` | 只声明正式文件清单 |

## 已合并删除的内容

原 `00-15` 阶段目录中的世界理解、导演、多尺度、过渡、视觉原子、审美、失败记忆、训练数据、模型计划、数据缺口、审核、实施路线、控制台、数据库和自主循环文档，已分别合并进入正式主体规格、数据与来源规则、审核与存储规格。三份补充规格只细化水文和跨模态门禁；旧局部作用域合同不代表全MVP已实现，也不恢复阶段性文档树。

这些旧文件不得恢复，也不得另建 `history`、`archive-docs` 或平行计划保存副本。运行证据继续保存在 `data/` 和 `.runtime/`，不受 Markdown 清理影响。

这里的“旧文件不得恢复”只指已经合并删除的旧 Markdown 阶段文档，不包括不可变机器合同和运行证据。历史机器合同必须保留原始字节，由替代索引声明停用状态且不得启动新任务。自主能力V3机器合同、发布注册V2和CPU自治核心已经建立；正式训练、审核和Runtime持续执行器仍为`program_adoption_pending`，不得伪称自主模型能力已经发布。

## 字典边界

`docs/world-visual-data-dictionary/` 的分层条目继续作为机器可导出的正式事实定义，不计入智能体默认阅读链。需要字段细节时只读取相关条目，不得全量读取后改变当前路线。

主体规格1.60原第9.6.1至9.6.42节及子条款，只经`data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-clauses-v1.json`查询原字节快照。现行1.68不重复这些候选专属细节；旧条款按旧版本复核，不能按同号章节继承为新任务规则。主体规格第17.1节分别登记CPU准备、独立零更新GPU因果诊断及目标层精度候选GPU／训练政策，各自取得自身准入，不互相继承资格；第17.2及17.3节明确迁移实现范围，第17.4节定义符合声明转换；目标层候选执行政策v2只调整训练时限为4200秒，v1的2700秒政策及主体1.67原字节保留供历史复核，不继承旧资格；动态运行由既有机器入口提供。
