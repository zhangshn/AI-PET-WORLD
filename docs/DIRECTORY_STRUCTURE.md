# AI-PET-WORLD 目录结构文档

版本：v1.0  
状态：正式目录基线  
更新时间：2026-06-25

本文档只描述目录职责。总入口见 [README.md](../README.md)，技术架构见 [ARCHITECTURE.md](./ARCHITECTURE.md)，实时进度见 [PROGRESS.md](./PROGRESS.md)。

## 1. 根目录

| 路径 | 职责 | 备注 |
|---|---|---|
| `README.md` | 项目总入口和业务总览 | 不写每日进度细节 |
| `docs/` | 正式专题文档 | 只保留执行计划、进度、架构和目录结构文档 |
| `docs/PROGRESS.md` | 当前进度表 | 每次大模块完成后更新 |
| `src/` | Next.js 应用、世界 Runtime、视觉链路服务端代码 | TypeScript 主体 |
| `ml/ai-painter/` | 本地 AI Painter 小模型、训练脚本、推理脚本、测试 | Python / PyTorch |
| `scripts/` | 项目检查、smoke、归档脚本 | Node 脚本 |
| `data/` | 本地 MVP 数据 | 可持久化开发数据 |
| `.runtime/` | 本地训练输出、候选图、归档结果 | 运行产物，不作为源码逻辑 |
| `services/` | 服务类辅助模块 | 保持轻量 |
| `tools/` | 工具脚本或辅助工具 | 不放业务主链 |

## 2. `src/app`

Next.js App Router 页面和 API。

| 路径 | 职责 |
|---|---|
| `src/app/page.tsx` | 首页 |
| `src/app/create-world/` | 创建世界入口 |
| `src/app/world/` | 玩家世界页，只能展示 ApprovedFrame / RuntimeFrame |
| `src/app/world-visual-control/` | 视觉控制或调试入口 |
| `src/app/ai-painter-progress/` | 本地 AI Painter 训练中心 |
| `src/app/api/world/` | 世界创建、tick、视觉链路 API |
| `src/app/api/ai-painter/` | AI Painter 训练、数据、结果、资源账本 API |

## 3. `src/app/ai-painter-progress`

训练中心页面。

| 路径 | 职责 |
|---|---|
| `page.tsx` | 训练中心入口页面 |
| `progress-client.tsx` | 训练主页客户端状态与入口卡片 |
| `_lib/progress-types.ts` | 训练进度类型 |
| `_lib/progress-view-model.ts` | 训练进度显示逻辑 |
| `_components/` | 页面通用展示组件 |
| `generated-results/` | 训练后生成内容、失败记录、ApprovedFrame 状态 |
| `natural-home/` | 自然家园训练详情 |
| `dataset-inventory/` | 数据与资产清单 |
| `local-assets/` | 本地资产库 |
| `structure-guided/` | 结构引导模型详情 |
| `rgb-refiner/` | RGB 细化模型详情 |
| `component-readiness/` | 部件实例闸门 |
| `training-expansion/` | 训练扩张 |
| `autonomous-training/` | 自主训练闭环预留入口 |

页面规则：

- 主页只放状态和入口，不堆训练图。
- 所有训练后图片、失败图、时间戳、资源账本进入 `generated-results/`。
- 未过 VisualJudge 的图不能被描述为正式世界图。

## 4. `src/world`

世界业务核心。

| 路径 | 职责 |
|---|---|
| `src/world/runtime/` | 世界 Runtime schema、store、gateway、tick runner |
| `src/world/runtime-core/` | Runtime tick 内部核心逻辑 |
| `src/world/butler/` | 管家人格和运行时 profile |
| `src/world/construction/` | 自主建设计划、执行、安全提交、审计 |
| `src/world/environment/` | 地形、材料、生态环境状态 |
| `src/world/ecology/` | 生态规则、区域类型 |
| `src/world/trace/` | 世界痕迹、记忆种子、trace 生命周期 |
| `src/world/map-state/` | 家园地图状态、diff、持久化 |
| `src/world/placement/` | 放置规则、布局规则 |
| `src/world/space/` | 世界空间网格与摘要 |
| `src/world/spatial/` | 空间几何 |
| `src/world/creation/` | 创建世界输入、人格映射到世界风格 |
| `src/world/core-rules/` | 世界规则注册和网关 |
| `src/world/resource-cycle/` | 资源循环 |

规则：

- `world` 层维护事实，不做美术表达。
- 世界事实通过 VisualFactManifest / Condition 进入 AI Painter。
- AI Painter 不得反向篡改 Runtime 事实。

## 5. `src/world/world-visual-painter`

正式视觉链路。

| 路径 | 职责 |
|---|---|
| `visual-fact-manifest/` | 把世界事实整理为视觉事实清单 |
| `world-generation-condition/` | 生成世界视觉条件 |
| `composition-plan/` | 构图方案 |
| `terrain-plan/` | 地形方案 |
| `asset-plan/` | 资产方案 |
| `motion-plan/` | 动态方案 |
| `visual-unit/` | VisualUnit v0 schema、registry、状态帧、运行时帧 |
| `training-data/` | 训练数据 manifest |
| `internal-image-model/` | 内部本地小模型候选图生成入口 |
| `ai-image-candidate/` | 候选图存储和读取闸门 |
| `visual-review/` | VisualJudge 审核报告 |
| `visual-quality/` | 视觉质量判断 |
| `visual-fix/` | 视觉修正计划 |
| `approved-frame/` | ApprovedFrame 构建、存储、读取闸门 |
| `authorized-data/` | 授权数据和规则来源 |
| `visual-rule-dataset/` | 视觉规则数据 |
| `visual-target-policy/` | MVP 视觉目标策略 |

规则：

- Candidate 不能直接展示给玩家。
- ApprovedFrame 必须绑定 worldId、tick、sourceFactIds、图片 hash、review hash。
- VJ-2 未完成前，生产批准必须保持 false。

## 6. `src/server`

AI Painter 服务端控制层。

| 文件 / 模块 | 职责 |
|---|---|
| `ai-painter-training-controller.ts` | 训练任务控制器 |
| `ai-painter-training-state.ts` | 训练状态读取 |
| `ai-painter-training-result-archive.ts` | 训练结果归档 |
| `ai-painter-training-quality-gate.ts` | 训练质量门 |
| `ai-painter-resource-usage.ts` | GPU、功耗、电费、token 账本 |
| `ai-painter-training-world-promotion.ts` | 训练结果进入世界视觉链路的受控桥 |

规则：

- 服务端可以调度本地训练。
- 训练输出必须自动保存，不靠 Codex 手动记录。
- 失败图、打回图、候选图、资源账本都要保留。

## 7. `ml/ai-painter`

本地自研小模型。

| 路径 | 职责 |
|---|---|
| `configs/` | 训练配置 |
| `scripts/` | 数据准备、训练、推理、筛选、归档脚本 |
| `src/ai_painter/training/` | PyTorch 模型、dataset、trainer、loss |
| `src/ai_painter/inference/` | 推理与评估 |
| `src/ai_painter/quality_learning/` | 质量学习相关模块 |
| `tests/` | Python 测试 |

规则：

- 这里是本地 AI 小模型主体，不是程序画图产品逻辑。
- 允许使用 PyTorch、CUDA、PIL、numpy 等基础库。
- 不允许接入第三方在线绘图 API 作为正式画面来源。

## 8. `data`

本地 MVP 数据。

| 路径 | 职责 |
|---|---|
| `data/world-runtime/` | 世界 runtime 本地存档 |
| `data/world-visual-candidates/` | 视觉候选图记录 |
| `data/world-approved-frames/` | ApprovedFrame 本地记录 |
| `data/visual-units/` | VisualUnit 可组合视觉单元数据契约、状态、生命周期和未来训练样例 |

本地文件持久化只用于 MVP 开发。生产环境需要数据库适配器。

## 9. `.runtime/ai-painter`

本地训练运行产物。

典型内容：

- 训练 summary。
- checkpoint。
- generated PNG。
- hidden candidates。
- quality ledger。
- allowlist dataset。
- resource usage。
- archived generated results。

规则：

- 所有训练结果必须自动保存。
- 失败图也必须保存。
- 每次训练要记录时间戳、耗时、资源、电费估算和本地计算 token。

## 10. VisualUnit v0 目录状态

已建立 TypeScript 基础目录：

```txt
src/world/world-visual-painter/visual-unit/
  visual-unit-schema.ts
  visual-unit-registry.ts
  visual-unit-state-frame.ts
  visual-unit-runtime-frame.ts
  index.ts
```

已建立数据目录：

```txt
data/visual-units/
  manifest.json
  natural/
    tree/
      natural-tree-static-v0-001/
        metadata.json
        state.json
        lifecycle.json
        target/
        mask/
```

当前样例是 contract-only：没有 target PNG 和同源 mask 前，不能进入训练，也不能进入正式世界。

待建立训练目录：

```txt
src/world/world-visual-painter/visual-unit/
  visual-unit-judge.ts

ml/ai-painter/src/ai_painter/visual_units/
  dataset.py
  model.py
  trainer.py
  inference.py

data/visual-units/
  butler/
  character/
  building/
  facility/
  item/
  animal/
  effect/
```

下一步只允许按 VisualUnit v0 模块继续推进，不要把人物、建筑、动物或动态内容混入当前自然家园底座训练。
