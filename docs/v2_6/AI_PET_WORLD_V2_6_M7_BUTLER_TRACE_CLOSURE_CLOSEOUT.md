# AI-PET-WORLD V2.6｜M7 管家行为 → 痕迹闭环收口报告

> 本文档只记录 M7 的正式完成范围、链路边界、验收命令和后续路线。M7 不扩展宠物系统、不扩展世界学习、不修改画图算法。

## 1. 模块结论

M7 管家行为 → 痕迹闭环已完成。

当前正式链路：

```txt
ButlerRuntimeDecision
→ ButlerRuntimeIntent
→ ButlerWorldRuleValidation
→ SafeApply / no HomeMapState write boundary
→ applyButlerRuntimeTraceClosure
→ TraceField
→ TraceMemorySeedField
→ ButlerRuntimeAuditSummary
→ /world explanation
→ P-Phone explanation
→ RuntimeSaveRecord
```

M7 的完成意义：管家不再只是生成一个动机结果，而是能把运行决策转换成可审计、可解释、可沉淀的世界事实链路。

## 2. 已完成能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 管家动机转正式意图 | 完成 | `ButlerRuntimeDecision → ButlerRuntimeIntent` |
| 世界规则验证 | 完成 | `ButlerRuntimeIntent → ButlerWorldRuleValidation` |
| SafeApply 边界 | 完成 | construction / maintenance 仍必须通过 SafeApply 才能写 HomeMapState |
| observe / wait 边界 | 完成 | observe_world / wait_for_resources 不写 HomeMapState diff |
| 管家行为痕迹 | 完成 | 通过验证后生成 `sourceKind = butler_behavior` 的 TraceFact |
| TraceField 持久化 | 完成 | 行为痕迹进入 runtime save |
| TraceMemorySeedField 持久化 | 完成 | 痕迹继续生成记忆种子字段 |
| ButlerRuntimeAuditSummary | 完成 | 结构化记录本轮动机、意图、验证、写入边界、Trace、MemorySeed 和 safeguards |
| /world 管家解释 | 完成 | 优先读取 `lastButlerRuntimeAuditSummary` |
| P-Phone 解释 | 完成 | 优先读取 `lastButlerRuntimeAuditSummary` |
| closeout smoke | 完成 | `smoke:m7-closeout` 已新增并通过 |

## 3. 关键运行事实

M7 明确持久化以下字段：

```txt
lastButlerRuntimeDecision
lastButlerRuntimeIntent
lastButlerWorldRuleValidation
lastButlerRuntimeAuditSummary
traceField
traceMemorySeedField
traceInfluenceSummary
```

其中 `lastButlerRuntimeAuditSummary` 是 M7 之后前台解释的优先事实来源。

## 4. 安全边界

M7 已守住以下红线：

- 不默认生成宠物。
- 不把宠物作为默认 actor 或 trace 写入世界。
- 不改画图算法。
- 不绕过世界规则验证。
- 不让 observe_world / wait_for_resources 写 HomeMapState diff。
- construction / maintenance 仍必须经过 SafeApply 才能写 HomeMapState。
- `/world` 仍然只读 WorldViewModel。
- `readWorldRuntimeForView` 不推进 tick，不写 runtime。
- 正式 `/world` 不回退 SVG、Scene Composer、ProceduralRenderer 或 Debug 主链路。
- 前台解释不暴露 finalScore、riskPenalty、rawScore、debugScore 或 JSON debug 数据。

## 5. 已通过验收命令

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:m7-closeout
npm run smoke:m7-explanation
npm run smoke:m7-audit-summary
npm run smoke:butler-trace-closure
npm run smoke:world-pixel-viewmodel-primary
```

## 6. M7 不包含内容

M7 不包含：

- 宠物正式入场。
- 宠物学习。
- 管家长期记忆系统完整实现。
- 世界学习 v0。
- 小镇、公园、医院等扩展区域。
- 新画图算法。
- 新像素美术资产体系。
- 用户直接控制管家或宠物。

这些内容全部进入后续阶段或 MVP 收口后的扩展路线。

## 7. 下一步路线

M7 完成后，不建议立刻大跳 M8 / M9 扩功能。

下一步进入 MVP 收口路线：

```txt
1. 固定当前 /world 正式主链路
2. 整理 create-world → /world 的最短用户路径
3. 检查正式 UI 是否仍有 Debug / 工程表达残留
4. 做 MVP 用户可见体验收口
5. 再决定是否进入 M8 管家记忆与学习
```

MVP 目标不是完整世界，而是让用户看到：

```txt
一个由管家自主判断、世界规则验证、痕迹沉淀和前台解释构成的小型 AI 自主世界闭环。
```
