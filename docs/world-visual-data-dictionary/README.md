# 世界视觉数据字典入口

更新时间：2026-07-11 12:32:00 +08:00

状态：active-reference / mvp-natural-home-v0.3 / 结构化数据源已取代分散 Markdown 条目

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 正式数据源

```text
data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json
```

该文件保存 84 个条目的完整正文、稳定 ID、类别、版本、状态、失败码和来源迁移记录。运行时精简导出为：

```text
data/world-visual-data-dictionary/mvp-natural-home-v0.3.json
data/world-visual-data-dictionary/latest.json
```

项目所有者查看的完整打印版为：

```text
docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md
```

## 2. 智能体读取规则

Codex 不得默认读取整个结构化源或完整打印版。

普通地图任务只读取：

1. 本 README。
2. `data/world-visual-data-dictionary/latest.json`。
3. 当前任务明确引用的 entry ID。

需要某个条目时，按 entry ID 从结构化源读取，不得遍历全部 84 条后自由组合新路线。当前执行顺序只由 `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md` 决定。

## 3. 类别

字典保留以下 26 类：world ontology、spatial grid、map grammar、terrain、transition、objects、ecology、gameplay、runtime state、map structure、visual style、drawing method、art direction、material recipe、composition recipe、render layer recipe、quality rubric、composition、director、generation task、review、training、schema、database、versions 和 baseline。

## 4. 修改流程

1. 修改结构化源中的目标 entry，保留稳定 ID。
2. 更新时间、版本和变更原因。
3. 运行 `npm run export:world-visual-data-dictionary`。
4. 运行 `npm run check:world-visual-data-dictionary`。
5. 运行 `npm run print:world-visual-data-dictionary` 更新完整打印版。
6. 如果改变当前路线、标准或门槛，必须先获得项目所有者命令并同步当前执行指南。

## 5. 数据库边界

结构化源已经按未来数据库迁移准备。数据库迁移后，entry ID、字典版本、失败码、训练标签和审核引用必须保持不变；Markdown 不再作为每个字典条目的独立数据源。

