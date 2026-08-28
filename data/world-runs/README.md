# World Runs 归档目录

更新时间：2026-08-03 09:23:45 +08:00

状态：active-data-directory-contract

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

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
