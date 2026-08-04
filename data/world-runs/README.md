# World Runs 归档目录

更新时间：2026-08-03 09:23:45 +08:00

状态：active-data-directory-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

每次世界视觉生成运行使用不可变 `runId` 独立保存：

```text
data/world-runs/<runId>/
├─ input.chunk.json
├─ output.image.png
├─ output.meta.json
├─ auto-judge.json
├─ manual-review.json
└─ sample-decision.json
```

缺少的阶段证据必须显式记录为未执行或不可用，禁止伪造占位审核结论。目录不授予训练、RuntimeFrame 或世界展示资格。
