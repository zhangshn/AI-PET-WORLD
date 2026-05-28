# AI-PET-WORLD V2.6 正式文档入口

本目录是当前 V2.6 唯一有效业务、架构与实现口径入口。

## 标准来源

当前所有文档只允许来自以下标准：

1. `AI-PET-WORLD V2.6｜完整业务架构总图（强化版｜含正式像素主世界绘制方案）`
2. `AI-PET-WORLD V2.6｜无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案`
3. `AI-PET-WORLD V2.6｜正式像素主世界绘制算法`

旧 engine-notes、旧 procedural renderer、旧 debug view、旧 MVP closeout、旧 doc / docx / xmind / txt 导出文档全部删除，不再作为当前开发依据。

## 当前保留文档

| 文件 | 作用 |
|---|---|
| `AI_PET_WORLD_V2_6_BUSINESS_ARCHITECTURE.md` | 完整业务架构总图强化版，按上传标准写入 |
| `AI_PET_WORLD_V2_6_RULE_BASED_AI_PIXEL_IMPLEMENTATION.md` | 无大数据训练阶段规则型 AI 自主世界与像素表现落地方案，按上传标准写入 |
| `AI_PET_WORLD_V2_6_PIXEL_WORLD_RENDERING_ALGORITHM.md` | 正式像素主世界绘制算法，保留并对齐上传标准 |
| `AI_PET_WORLD_V2_6_MODULE_PROGRESS.md` | 当前模块进度与下一步路线 |
| `AI_PET_WORLD_V2_6_M7_BUTLER_TRACE_CLOSURE_CLOSEOUT.md` | M7 管家行为 → 痕迹闭环收口报告 |
| `AI_PET_WORLD_V2_6_HANDOFF_M11_MVP_CLOSEOUT.md` | M11 / MVP 收口交接文档，新窗口继续前必须先读 |

## 红线

- `/world` 是 PixelWorldView，不是 SVG / Debug composer。
- 当前 `/world` 正式主页已清空，等待正式画图算法和核心验算库边界重整后再恢复画面。
- Pixel Scene Composer 是 Debug 视觉参考库，只能存在于 `/world-debug` 或同等调试场景，不能作为核心资源库或正式算法库。
- WorldViewModel 是正式表现模型。
- PixelWorldView 只读 WorldViewModel。
- 当前阶段不训练大模型。
- 不设置独立 road/path 架构，长期移动结果归入痕迹体系。
- 宠物不默认进入世界。
- 管家行为闭环已完成；宠物学习、世界学习尚未完成，不得写成已完成能力。
- 未来正式主世界按端游式体验设计，不做网页卡片式主页。
