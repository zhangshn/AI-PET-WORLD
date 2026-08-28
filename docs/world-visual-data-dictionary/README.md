# 世界视觉数据字典入口

更新时间：2026-08-26 15:45:00 +08:00

文档版本：`WORLD-VISUAL-DICTIONARY-REFERENCE-1.0`

生效日期：`2026-08-26`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

状态：active-reference

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 当前读取入口与来源边界

当前任务只允许先读取：

```text
data/world-visual-data-dictionary/latest.json
```

再读取该指针绑定的规范化导出文件及任务明确涉及的entry ID。规范化导出是当前视觉词汇读取入口；结构化源只承担字典维护、迁移和历史溯源，不是运行时治理状态机，也不得被普通任务直接扫描。

结构化维护源为：

```text
data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json
```

该文件保存84个条目的完整正文、稳定ID、类别、版本、历史状态、失败码和来源迁移记录。运行时规范化导出为：

```text
data/world-visual-data-dictionary/mvp-natural-home-v0.3.json
data/world-visual-data-dictionary/latest.json
```

供项目审查的完整打印版为：

```text
docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md
```

## 2. 当前语义与历史兼容隔离

`mvp-natural-home-v0.3`形成于旧治理阶段。为保持既有训练包、审核报告和运行证据可按原SHA-256复核，结构化源中仍可能出现`owner review`、`owner accepted`、`owner rejected`及对应旧失败码或训练标签。这些内容只属于历史兼容词汇，不具有当前执行效力。

当前强制规则如下：

1. 旧Owner词汇不得授权、阻断、恢复、发布或回退当前任务。
2. 新任务不得生成`pending_owner_review`、`machine_pass_owner_review_required`等旧状态、失败码或训练标签。
3. 当前审核状态只采用`docs/ARCHITECTURE.md`和`docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md`定义的机器审核生命周期。
4. 当前Owner职责只采用`docs/DOCUMENT_AUTHORITY_INDEX.md`中的`GOV-OWNER-001`；视觉字典不得另行定义Owner职责。
5. 历史证据需要解释旧词汇时，只能按当时记录原义读取，不得将其投影为当前任务状态。
6. 若程序仍从旧词汇生成当前状态，该程序属于`program_adoption_pending`或不符合项，不能反向改变正式文档。

## 3. 智能体读取规则

Codex 不得默认读取整个结构化源或完整打印版。

普通地图任务只读取：

1. 本 README。
2. `data/world-visual-data-dictionary/latest.json`绑定的规范化导出。
3. 当前任务明确引用的entry ID。

需要某个条目时，按entry ID从规范化导出读取，不得遍历全部84条后自由组合新路线。只有执行字典维护任务时才允许读取结构化源，并必须保留历史字段的非执行属性。当前执行顺序只由`docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`决定。

## 4. 类别

字典保留以下 26 类：world ontology、spatial grid、map grammar、terrain、transition、objects、ecology、gameplay、runtime state、map structure、visual style、drawing method、art direction、material recipe、composition recipe、render layer recipe、quality rubric、composition、director、generation task、review、training、schema、database、versions 和 baseline。

## 5. 修改流程

1. 修改结构化源中的目标 entry，保留稳定 ID。
2. 更新时间、版本和变更原因。
3. 运行 `npm run export:world-visual-data-dictionary`。
4. 运行 `npm run check:world-visual-data-dictionary`。
5. 运行 `npm run print:world-visual-data-dictionary` 更新完整打印版。
6. 若修改仍处于生效业务、安全和机器合同内，由本地系统按能力生命周期自主验证、登记和发布；若触及长期业务目标、WorldFacts权威边界、来源许可、安全上限或审计真实性，必须失败关闭并形成政策边界报告。
7. 不得以字典修改降低审核阈值、删除失败证据或恢复旧Owner逐任务审批状态。

## 6. 数据库边界

结构化源已经按未来数据库迁移准备。数据库迁移后，entry ID、字典版本、失败码、训练标签和审核引用必须保持不变；Markdown 不再作为每个字典条目的独立数据源。
