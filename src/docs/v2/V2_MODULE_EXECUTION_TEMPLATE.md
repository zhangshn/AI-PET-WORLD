# AI-PET-WORLD V2.6 Module Execution Template

> Status: V2.6 active execution template. Every current module should use this format before and after implementation.

## Start-Of-Round Declaration

```txt
当前阶段：
本轮目标：
本轮不做：
允许修改文件：
禁止修改文件：
是否生成世界事实：
世界事实链路：
是否影响宠物：
验证方式：
```

## Completion Report

```txt
已完成：
未完成：
改了哪些文件：
没有改哪些文件：
如何验证：
验证结果：
下一步建议：
```

## Default Validation Commands

For code-writing modules, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

For documentation-only modules, these commands may still be run as a stability check. If they are not run, the completion report must say why.

## Required World-Fact Statement

If the module creates or changes world facts, the round must explicitly state whether the change passes through:

```txt
HomeMapState -> MapDiff -> SafeApply -> EventLog -> FormalVisualModel
```

If the module only changes documents, UI presentation, or visual projection, say that it does not generate world facts.

## Required Pet/Adoption Statement

Every round must state whether it affects pets or town adoption.

Default rule:

```txt
No accepted AdoptionReview plus AdoptionSafeApply means no pet actor, no pet bed, no pet_arrival, and no pet_rest in formal world facts.
```
