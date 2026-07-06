# AI 活世界生成系统目录结构

更新日期：2026-07-06

本文定义活世界生成系统的目录职责。目标是把世界事实、视觉候选、训练样本、Runtime 数据、临时产物和正式文档彻底分开，避免后续继续出现“训练图当正式世界”“候选图直接进样本”“图片反推世界事实”等混乱。

## 1. 文档目录

```txt
docs/live-world/
  README.md
  AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md
  DIRECTORY_STRUCTURE.md
```

| 文件 | 职责 |
|---|---|
| `README.md` | 活世界文档入口，只做导航和当前阶段说明。 |
| `AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md` | 定版主方案，后续开发和验收以此为准。 |
| `DIRECTORY_STRUCTURE.md` | 目录结构、数据边界和后续落地位置定义。 |

规则：

```txt
1. 不再在 docs 根目录继续散落新的活世界临时方案。
2. 不再用讨论稿替代正式方案。
3. 后续新增细分文档必须放入 docs/live-world/。
4. 旧的活世界方案如需保留，只能作为历史参考，不作为执行依据。
```

## 2. 未来代码目录

P0 落地时，建议在 `src/world/live-world/` 下新增活世界核心代码。该目录只放与活世界数据协议、生成、碰撞、视觉输入、候选、评审、样本和 Runtime 状态相关的代码。

```txt
src/world/live-world/
  types/
    world-types.ts
    terrain-types.ts
    lifecycle-types.ts
    entity-types.ts
    collision-types.ts
    visual-types.ts
    candidate-types.ts
    review-types.ts
    sample-types.ts

  rules/
    placement-rules.ts
    terrain-rules.ts
    lifecycle-rules.ts
    visual-constraint-rules.ts

  generation/
    world-generator.ts
    chunk-generator.ts
    tile-generator.ts
    entity-placement.ts

  collision/
    collision-projection.ts
    walkable-layer-builder.ts
    interaction-layer-builder.ts

  visual-input/
    chunk-visual-input-builder.ts
    mask-builder.ts
    neighbor-context-builder.ts
    input-payload-hash.ts

  candidates/
    visual-candidate-writer.ts
    visual-candidate-reader.ts

  review/
    manual-review-contract.ts
    review-result-writer.ts

  samples/
    sample-record-writer.ts
    sample-registry.ts

  runtime/
    chunk-activation.ts
    chunk-sleeping.ts
    runtime-state.ts
```

命名规则：

```txt
1. 不使用大量 index.ts 堆 barrel export。
2. 类型按职责拆分，避免一个巨型 types.ts。
3. 文件名直接表达职责，不用 vague 的 helper、utils、common。
4. visual output、review、sample 必须拆开，不允许写在同一个对象里。
5. AI Painter 只能读取 ChunkVisualInput，不允许读取 WorldState 后自行解释世界。
```

## 3. 现有工程衔接目录

当前项目已有或计划使用的入口：

```txt
src/app/api/world/visual/generate/
src/app/api/ai-painter/
src/world/world-visual-painter/
src/world/game-map-frame/
src/world/runtime/
```

职责边界：

| 目录 | 职责 |
|---|---|
| `src/app/api/world/visual/generate/` | 世界视觉生成请求入口。只负责接收请求、写候选、返回结果，不负责训练。 |
| `src/app/api/ai-painter/` | AI Painter 训练、推理、进度、归档接口。不得修改世界事实。 |
| `src/world/world-visual-painter/` | 现有视觉候选、ApprovedFrame、质量审核相关代码。后续与 `live-world/visual-input` 对接。 |
| `src/world/game-map-frame/` | 现有地图帧、合成器、RuntimeFrame 相关代码。后续只消费通过审核的正式视觉结果。 |
| `src/world/runtime/` | 现有世界运行时。后续接入 chunk 激活、休眠和补算。 |

## 4. 正式数据目录

活世界正式数据放在 `data/` 下。`data/` 是项目生命周期数据，不是临时运行缓存。

```txt
data/live-world/
  world-states/
  chunk-states/
  poc-inputs/
  schemas/

data/world-runs/
  {runId}/
    input.chunk.json
    output.image.png
    output.meta.json
    auto-judge.json
    manual-review.json
    sample-decision.json

data/world-visual-candidates/
  {candidateId}/
    input.chunk.json
    output.image.png
    candidate.meta.json

data/world-samples/
  positive/
    {sampleId}/
      input.chunk.json
      output.image.png
      review.json
      sample.json
  negative/
    {sampleId}/
      input.chunk.json
      output.image.png
      review.json
      sample.json
```

规则：

```txt
1. world-states 保存世界事实。
2. world-runs 保存每次生成的完整运行档案。
3. world-visual-candidates 保存候选图，不等于训练样本。
4. world-samples 只保存人工复核后的正负样本。
5. external_reference + unknown 或 do_not_train 不得进入 world-samples。
```

## 5. 临时产物目录

`.runtime/` 只放本地运行、训练、推理、失败、中间产物。

```txt
.runtime/
  ai-painter/
  game-map-runtime-frame/
  game-map-rejected-runtime-frames/
  diagnostics/
```

规则：

```txt
1. .runtime 不是正式世界事实来源。
2. .runtime 里的图不能直接喂给 /world 当正式画面。
3. 训练成功或失败产物必须经过归档和人工复核后，才允许进入 data/world-samples。
4. 失败图不能删除，应作为负样本或诊断依据保留。
```

## 6. API 目录边界

| API | 职责 | 禁止事项 |
|---|---|---|
| `/api/world/visual/generate` | 接收 ChunkVisualInput 或候选请求，生成 VisualCandidate | 禁止直接写入正样本库 |
| `/api/ai-painter/*` | 本地模型训练、推理、进度、归档 | 禁止修改 WorldState |
| `/api/world/*` | 世界创建、tick、Runtime 状态 | 禁止把图片当世界事实 |

## 7. 页面目录边界

| 页面 | 职责 |
|---|---|
| `/world` | 只展示通过世界事实和审核视觉结果构成的正式 Runtime 画面。 |
| `/ai-painter-progress` | 展示训练过程、候选、失败和诊断，不是正式游戏画面。 |
| `/world-visual-control` | 视觉候选、审核、诊断控制台。 |

规则：

```txt
/world 禁止直接读取训练目录图片。
/world 禁止展示未审核 candidate。
/world 禁止展示失败图、crop、patch、material slot、单个局部样本。
```

## 8. 工程安全规则

高风险文件：

```txt
route.ts
schema 文件
生成器文件
数据字典文件
AI Painter 调用文件
归档写入文件
```

写入前：

```txt
1. 必须新建分支。
2. 禁止直接改 main。
3. 必须读取原文件完整内容。
4. 必须记录原始行数。
5. 必须确认中文编码。
```

写入后：

```txt
1. 写入后立即读回。
2. 对比行数。
3. 检查关键 export。
4. 检查文件尾部是否完整。
5. 检查是否出现乱码。
6. 发现截断立即停止。
```

## 9. 当前落地顺序

```txt
P0-1 建立 src/world/live-world/types/
P0-2 定义 world / terrain / lifecycle / entity / collision / visual / candidate / review / sample 类型
P0-3 定义 placement rules 和 visual constraints
P0-4 定义 POC-0 input.chunk.json
P0-5 定义 archive spec 和 writer
P0-6 再进入单 Chunk POC
```

