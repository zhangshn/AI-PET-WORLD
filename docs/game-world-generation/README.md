# 完整游戏世界生成文档入口

更新时间：2026-07-11 12:32:00 +08:00

状态：active-architecture / 文档已收缩为单一执行指南与三份正式规格

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 必读顺序

```text
1. ../DOCUMENT_AUTHORITY_INDEX.md
2. ../BUSINESS_SPEC.md
3. ../ARCHITECTURE.md
4. CURRENT_EXECUTION_GUIDE_20260710.md
5. 当前任务涉及的一份正式规格
```

正式规格：

| 任务 | 文件 |
|---|---|
| AI Painter 视觉实现、条件编译、模型能力、完整推理 | `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` |
| 训练样本、来源、数据包、严格审计 | `TRAINING_DATA_AND_SOURCE_POLICY.md` |
| 审核、失败学习、自主循环、实时状态、控制台、存储 | `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` |

禁止默认一次性读取全部三份规格。先由当前执行指南确定任务，再读取对应的一份。

## 当前状态

```text
status = blocked
canEnterWorld = false
blockers = owner_review_rejected
           data_gap_insufficient
           model_training_alignment_failed
           training_data_persistence_failed
           complete_world_visual_inference_not_implemented
```

已实现：严格数据审计、VisualFactManifest、动态世界导演、完整视觉任务包、失败反馈消费、自动保存与门禁。

未实现：视觉条件编译器、当前任务包驱动的真实完整地图推理、原生正式分辨率新候选、闭合的专业审美学习模型。

## 固定禁止事项

1. 不恢复旧 5×5 Chunk、P10-P17 或版本号盲训路线。
2. 不把局部材料训练当作完整地图训练。
3. 不复用、复制或放大旧图冒充本轮新图。
4. 不建立“项目内部视觉教师”，不让程序直绘图成为专业正样本。
5. 不从视觉字典条目自行拼接新计划。
6. 不把机器审核通过当作项目所有者终审通过。

世界视觉字典是机器参考，只按需读取 `../world-visual-data-dictionary/README.md`、当前导出 JSON 和任务涉及条目。

