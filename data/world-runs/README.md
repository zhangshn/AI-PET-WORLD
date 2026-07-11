# World Runs 归档目录

每次世界视觉生成运行必须写入：

```txt
data/world-runs/{runId}/
  input.chunk.json
  output.image.png
  output.meta.json
  auto-judge.json
  manual-review.json
  sample-decision.json
```

P1 阶段 `auto-judge.json` 可以是 placeholder，因为自动评审在 P5 实现。

