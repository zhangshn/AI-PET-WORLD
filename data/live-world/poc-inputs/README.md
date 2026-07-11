# POC-0 输入目录

本目录用于保存 POC-0 的手写单 Chunk 输入。

POC-0 固定范围：

```txt
chunkSize = 32
tileSize = 16
pixelWidth = 512
pixelHeight = 512
chunkX = 0
chunkY = 0
```

POC-0 资源：

| 资源 | 数量 | 规则 |
|---|---:|---|
| tree | 3 | 严格匹配 |
| rock | 2 | 严格匹配 |
| grass_clump | 6 | 可视觉合并 |
| flower | 5 | 可装饰化 |
| reed | 4 | 必须靠近水岸 |
| berry_bush | 0 | 后置到 POC-1 或 P2 |

正式 `input.chunk.json` 在 P0 类型和基础校验稳定后再写入。

