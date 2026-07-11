# AI-PET-WORLD 文档与项目目录结构

更新时间：2026-07-11 12:32:00 +08:00

状态：active-reference / 已规整 / 不决定当前执行顺序

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 项目根目录

| 路径 | 唯一职责 |
|---|---|
| `README.md` | 项目总入口、两大核心业务和当前工作导航。 |
| `AGENTS.md` | 所有智能体必须执行的读取顺序和边界。 |
| `docs/` | 当前有效的业务、架构、数据定义和程序契约；不保存旧文档。 |
| `src/` | 页面、API、AI 管家、世界 Runtime 和游戏地图代码。 |
| `ml/ai-painter/` | 本地视觉模型、训练、推理和数据处理。 |
| `scripts/` | 自动检查、训练、推理、审核、归档和合成入口。 |
| `data/` | 可版本化的结构化事实、字典导出、训练样本和正式记录。 |
| `.runtime/` | 程序自动生成的运行状态、图片、模型、日志、审核和失败证据。 |

## 2. 正式文档目录

```text
docs/
├─ DOCUMENT_AUTHORITY_INDEX.md
├─ DOCUMENTATION_POLICY.md
├─ BUSINESS_SPEC.md
├─ ARCHITECTURE.md
├─ DIRECTORY_STRUCTURE.md
├─ game-world-generation/
│  ├─ CURRENT_EXECUTION_GUIDE_20260710.md
│  ├─ AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md
│  ├─ TRAINING_DATA_AND_SOURCE_POLICY.md
│  └─ REVIEW_AUTOMATION_AND_STORAGE_SPEC.md
├─ world-visual-data-dictionary/
├─ ai-painter-progress/
└─ ziwei/
```

| 路径 | 内容 | 能否决定当前下一步 |
|---|---|---:|
| `docs/DOCUMENT_AUTHORITY_INDEX.md` | 文档优先级和正式入口。 | 否，只治理读取顺序。 |
| `docs/BUSINESS_SPEC.md` | 两大核心业务和长期业务边界。 | 否。 |
| `docs/ARCHITECTURE.md` | AI 管家与类地球世界的长期架构。 | 否。 |
| `docs/game-world-generation/` | 当前完整世界地图架构、模型、审核和执行指南。 | 只有当前执行指南可以。 |
| `docs/world-visual-data-dictionary/` | 分层视觉事实、对象、地形、过渡、失败码和训练标签。 | 否，是数据标准。 |
| `docs/ai-painter-progress/` | 后台页面、自动保存、模型对齐、诊断和修复契约。 | 否，是程序契约。 |
| `docs/ziwei/` | AI 管家人格数据子系统。 | 不参与当前地图顺序。 |

当前世界地图唯一执行文档：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

## 3. 文档清理边界

| 内容 | 处理规则 |
|---|---|
| 旧计划、旧进度表、阶段闭合报告 | 删除，不保留 Markdown 历史副本。 |
| 重复业务说明和重复架构说明 | 合并进 `BUSINESS_SPEC.md` 或 `ARCHITECTURE.md` 后删除。 |
| 当前地图架构规格 | 只保留 3 份下级规格，由当前执行指南按任务导航。 |
| 世界视觉数据字典条目 | 保留分层文件；它们是结构化数据源，不是阶段报告。 |
| 智能体读取视觉字典 | 只读 README、当前导出 JSON 和任务涉及条目，禁止默认全量读取。 |
| 页面与自动化锁定规格 | 保留；程序检查直接依赖这些契约。 |
| 图片、JSON、模型、训练日志、审核记录 | 不属于文档清理范围，继续由程序自动保存。 |

禁止创建 `history/`、`old-docs/`、`archive-docs/` 或新的平行计划目录。

## 4. 两大业务代码边界

| 核心业务 | 主要代码边界 | 主要文档边界 |
|---|---|---|
| AI 管家人格与角色自主 | `src/ai/personality-core/`、`src/ai/destiny-core/`、相关管家运行模块 | `docs/BUSINESS_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/ziwei/` |
| 类地球世界自主运行与生长 | `src/world/`、`src/app/world/`、世界相关 API | `docs/game-world-generation/`、`docs/world-visual-data-dictionary/` |

AI Painter 是类地球世界的视觉表达系统，不能决定世界事实：

| 路径 | 职责 |
|---|---|
| `ml/ai-painter/` | 本地模型训练和推理。 |
| `src/app/ai-painter-progress/` | 后台查看与控制入口。 |
| `src/app/api/ai-painter/` | 训练状态、图片、归档和审核 API。 |
| `.runtime/ai-painter/` | 程序自动保存的训练与推理证据。 |

## 5. 数据与展示边界

| 数据 | 正式位置 | 规则 |
|---|---|---|
| 世界事实 | `data/` 或世界 Runtime 存储 | 先于视觉存在。 |
| 视觉字典导出 | `data/world-visual-data-dictionary/` | 由字典文档导出，供程序读取。 |
| 训练与推理产物 | `.runtime/ai-painter/` | 成功、失败和中间结果全部自动保存。 |
| RuntimeFrame | `.runtime/game-map-runtime-frame/` 及正式晋级存储 | 未通过全部闸门不得进入 `/world`。 |
| 被拒绝结果 | `.runtime` 对应失败归档 | 不删除，不作为正式画面。 |

`/world` 只能展示通过机器审核和项目所有者最终验收的完整 RuntimeFrame；训练图、局部图、候选图、失败图和程序占位图不得进入正式世界。
