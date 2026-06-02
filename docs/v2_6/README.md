# AI-PET-WORLD V2.6 正式文档入口

本目录是当前 V2.6 唯一有效业务、架构与实现口径入口。

## 标准来源

当前所有文档只允许来自以下标准：

1. `AI-PET-WORLD V2.6｜完整业务架构总图（强化版｜含正式像素主世界绘制方案）`
2. `AI-PET-WORLD V2.6｜无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案`
3. `AI-PET-WORLD V2.6｜正式像素主世界绘制算法`

旧 engine-notes、旧阶段 closeout、旧进度表、旧 renderer 计划、旧素材工作流、旧 doc / docx / xmind / txt 导出文档全部删除，不再作为当前开发依据。

## 当前保留文档

| 文件 | 作用 |
|---|---|
| `AI_PET_WORLD_V2_6_BUSINESS_ARCHITECTURE.md` | 完整业务架构总图强化版，按上传标准写入 |
| `AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md` | 当前确认业务原则；后续产品与工程判断首先对照本文 |
| `AI_PET_WORLD_V2_6_RULE_BASED_AI_PIXEL_IMPLEMENTATION.md` | 无大数据训练阶段规则型 AI 自主世界与像素表现落地方案，按上传标准写入 |
| `AI_PET_WORLD_V2_6_PIXEL_WORLD_RENDERING_ALGORITHM.md` | 正式像素主世界绘制算法，保留并对齐上传标准 |
| `AI_PET_WORLD_V2_6_PROJECT_AUDIT_2026_06_02.md` | 2026-06-02 项目审查、文档差距、清理结果与当前画面卡点 |

补充设计文档：

| 文件 | 作用 |
|---|---|
| `../visual/AI_PET_WORLD_FORMAL_PIXEL_DRAWING_SYSTEM_PLAN.md` | 正式像素画图系统详细设计；用于继续深化对象级像素配方 |

## 红线

- `/world` 是 PixelWorldView，不是 SVG / Debug composer。
- 当前 `/world` 已接入只读 PixiJS PixelWorldView；仍属于工程预览，尚未达到正式产品画面。
- Pixel Scene Composer 是 Debug 视觉参考库，只能存在于 `/world-debug` 或同等调试场景，不能作为核心资源库或正式算法库。
- WorldViewModel 是正式表现模型。
- PixelWorldView 只读 WorldViewModel。
- 当前阶段不训练大模型。
- 当前正式画面不依赖仓库内静态 PNG 素材，旧参考图、裁切包和生成图已经清理。
- 不设置独立 road/path 架构，长期移动结果归入痕迹体系。
- 宠物不默认进入世界。
- 管家行为闭环已完成；宠物学习、世界学习尚未完成，不得写成已完成能力。
- 未来正式主世界按端游式体验设计，不做网页卡片式主页。
