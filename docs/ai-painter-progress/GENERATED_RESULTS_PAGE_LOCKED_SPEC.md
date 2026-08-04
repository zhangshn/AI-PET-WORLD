# AI Painter 生成结果归档页面锁定规格

更新时间：2026-07-10 19:50:04 +08:00

状态：active-generated-results-page-contract

强制规则：不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 页面身份

| 项目 | 内容 |
|---|---|
| 页面名称 | 生成结果归档 |
| 页面 URL | `/ai-painter-progress/generated-results` |
| 页面源码 | `src/app/ai-painter-progress/generated-results/page.tsx` |
| 页面职责 | 读取并展示本地小模型程序已经自动保存的数据 |
| 页面禁止职责 | 不训练、不推理、不归档、不搬运文件、不重命名、不替程序补记录 |

## 2. 页面硬边界

| 规则 | 固定要求 |
|---|---|
| 不改版本名 | 目录名是什么就显示什么，`v54` 必须显示为 `v54` |
| 不改数据路径 | 页面只读已有路径，不移动、不复制、不删除 |
| 不伪造记录 | 没有程序写入的文件，页面不能伪造成成功记录 |
| 不替程序归档 | 自动保存是本地小模型程序能力，不是 Codex 手工补账 |
| 不进入 `/world` | 本页面任何图都不能直接成为正式世界画面 |
| 不随意改样式 | 没有项目所有者明确要求，不调整布局、颜色、卡片风格和入口结构 |
| 先问再改 | 如果发现页面读取规则、数据结构或训练记录链路走不下去，必须停止并询问项目所有者 |

## 3. 固定页面结构

页面只允许包含以下区块，顺序固定。

| 顺序 | 区块 | 内容 | 是否允许新增 |
|---:|---|---|---|
| 1 | 页头统计 | 已记录推理结果、自动保存目录、失败记录、候选记录、ApprovedFrame | 否 |
| 2 | 本地小模型自动保存目录 | 原样列出程序已写入的训练、数据、候选、推理、审核目录 | 否 |
| 3 | ApprovedFrame | 只在存在正式 ApprovedFrame 记录时显示 | 否 |
| 4 | 训练后生成结果 | 读取 `generated-results` 索引和固定 fallback 结果 | 否 |
| 5 | 记录规则 | 说明成功、失败、候选都必须保留，但不能直接进入 `/world` | 否 |

新增区块、重排区块、改入口名称、改页面视觉样式，都必须先询问项目所有者。

## 4. 固定读取来源

### 4.1 生成结果索引

| 数据 | 路径 |
|---|---|
| 生成结果索引 | `.runtime/ai-painter/generated-results/index.json` |
| 生成图片 | `.runtime/ai-painter/generated-results/images/` |
| 摘要文件 | `.runtime/ai-painter/generated-results/summaries/` |
| 诊断文件 | `.runtime/ai-painter/generated-results/diagnoses/` |
| 质量闸门 | `.runtime/ai-painter/generated-results/quality-gates/` |
| 行级明细 | `.runtime/ai-painter/generated-results/rows/` |

### 4.2 本地小模型自动保存目录

页面必须从以下目录读取已经存在的程序输出，且必须原样显示目录名。

| 根目录 | 允许显示的目录模式 |
|---|---|
| `.runtime/ai-painter/` | `natural-home-v*` |
| `.runtime/ai-painter/` | `natural-home-local-detail-v*` |
| `.runtime/ai-painter/` | `construction-home-v*` |
| `.runtime/ai-painter/` | `game-map-material-slot-v*` |
| `.runtime/ai-painter/` | `training-run-archive` |
| `.runtime/ai-painter/` | `generated-results` |
| `.runtime/game-map-material-slot-inference-runs/world-d0znz8/0/` | `material-slot-inference-*` |

### 4.3 证据文件

页面只展示已经存在的证据文件名，不根据缺失文件猜测结论。

| 证据文件 | 含义 |
|---|---|
| `training-summary.json` | 训练摘要 |
| `latest.json` | 最新运行记录 |
| `manifest.json` | 目录清单 |
| `dataset-summary.json` | 数据集摘要 |
| `combined-model-root-manifest.json` | 合并模型清单 |
| `material-quality-report.json` | 材料质量报告 |
| `selection-report.json` | 选择报告 |
| `review-report.json` | 审核报告 |
| `contact-sheet.png` | 候选图总览 |
| `best.pt` | 模型权重 |

## 5. 固定显示字段

自动保存目录卡片只显示以下字段。

| 字段 | 来源 | 规则 |
|---|---|---|
| 类型 | 根据目录名分类 | 只用于阅读辅助，不改变目录名 |
| 目录名 | 文件夹原名 | 必须原样显示 |
| 自动保存路径 | 相对项目路径 | 必须原样显示 |
| 更新时间 | 目录 mtime | 只读 |
| 证据文件 | 已检测到的文件名 | 只读 |

禁止新增“通过”“最终成功”“专业达标”等结论字段，除非该结论来自程序写入的正式审核记录。

## 6. 固定分类规则

| 目录名包含 | 显示类型 |
|---|---|
| `training` | 训练目录 |
| `dataset` | 数据目录 |
| `candidate` | 候选目录 |
| `inference` | 推理目录 |
| `generation` | 生成目录 |
| `selection` / `review` / `gate` | 审核目录 |
| `combined` | 合并模型目录 |
| `material-slot-inference` | 材料推理目录 |
| `training-run-archive` | 训练自动保存记录 |
| 其他 | 自动保存目录 |

分类只用于页面阅读，不允许据此重命名文件夹。

## 7. 修改流程

任何人修改本页面前，必须按以下流程执行。

| 步骤 | 要求 |
|---:|---|
| 1 | 先阅读本文件 |
| 2 | 确认修改是否只影响读取展示 |
| 3 | 如果涉及数据结构、版本命名、训练闭环、页面区块新增或样式调整，先停止 |
| 4 | 向项目所有者说明原因和影响 |
| 5 | 得到明确命令后再修改 |
| 6 | 修改后运行 TypeScript、lint、页面请求验证 |

## 8. 验收标准

| 验收项 | 通过标准 |
|---|---|
| 页面可打开 | `/ai-painter-progress/generated-results` 返回 200 |
| 目录名准确 | `v54`、`v51`、`v50` 等按原目录名显示 |
| 数据不被移动 | 修改页面不改变 `.runtime` 数据 |
| 自动保存可见 | 本地小模型自动保存目录能在页面看到 |
| 无自由发挥 | 没有新增未批准区块、样式或结论 |
| 检查通过 | `npx tsc --noEmit` 和页面相关 lint 通过 |
| 页面锁定检查 | `npm run check:ai-painter-generated-results-page-lock` 通过 |

## 9. 固定回答口径

当项目所有者问“数据在哪里”时，必须按以下顺序回答：

1. 页面读取的是程序自动保存目录，不是 Codex 手工归档。
2. 数据目录名原样显示，不改版本名。
3. 页面只能读已有数据，不能伪造训练记录。
4. 如果页面查不到但磁盘存在，优先检查页面读取范围。
5. 如果磁盘不存在，说明程序没有自动保存成功，必须停止并查训练程序。

## 10. 后续文档强制句

从本文件之后新增或更新的项目文档，必须包含这句话：

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。
