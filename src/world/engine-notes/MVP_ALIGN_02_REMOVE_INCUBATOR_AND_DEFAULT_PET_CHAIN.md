> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD MVP-ALIGN-02 移除旧孵化器与默认宠物链路

## 1. 阶段定位

本阶段清理当前正式链路中的旧孵化器路线、默认宠物生成路线、默认宠物设施路线。

本阶段不是删除宠物产品方向。

宠物未来能力保留，但只能通过 LifeEvent / CompanionDecision / accept_companion 后置进入。

## 2. 已清理内容

本阶段已移除当前正式链路中的旧孵化器入口。

本阶段已移除默认 pet actor。

本阶段已移除默认 pet placement。

本阶段已移除 `pet_arrival` / `pet_rest` 初始区域。

本阶段已移除或断开 IncubatorSystem 当前正式入口。

## 3. 当前开局允许出现

当前开局只允许出现：

1. 管家。
2. 第一片家园。
3. 基础资源。
4. 临时住所。
5. 初始入口区。
6. 初始照护区。
7. 安静生活区。
8. 工具储备区。
9. 自然边界。
10. 世界状态。

当前开局不允许出现：

1. 孵化器。
2. 胚胎。
3. 默认宠物。
4. 默认宠物床。
5. 默认宠物抵达区。
6. 默认宠物休息区。

## 4. 宠物后置规则

宠物系统未来能力没有被删除。

宠物只能在后续 LifeEvent / CompanionDecision / accept_companion 之后进入世界。

在该事件链路发生前：

1. 不构造默认 PetRuntimeContext。
2. 不生成 pet actor。
3. 不生成 pet placement。
4. 不生成 pet 专属设施。
5. 不把宠物作为初始世界事实。

## 5. 已处理模块

本阶段处理了：

1. 初始地图区域类型。
2. 初始 scene recipe。
3. initial home generator 中的旧宠物文案。
4. placement-engine 默认宠物 actor / 默认宠物设施。
5. placement rules / layout rules 中旧宠物命名。
6. PetRuntimeContext 默认孵化器运行态。
7. ButlerRuntimeContext 中孵化器任务与关注目标。
8. 旧 IncubatorSystem 当前正式入口。
9. WorldState incubator 字段。
10. world persistence incubator 字段。
11. adoption 对 incubator 的当前正式依赖。
12. construction / visualization / debug scenario 中旧宠物休息区命名。

## 6. 素材保留说明

宠物素材定义可以保留，用于未来后置宠物关系阶段。

素材定义不等于初始世界事实。

当前正式初始世界不能默认引用后置宠物素材。

## 7. 当前不做

本阶段不做：

1. 删除宠物产品方向。
2. 实现新的 LifeEvent / CompanionDecision。
3. 默认接入 pet。
4. 读取 PNG / WORLD_MAP_ASSETS 作为世界事实来源。
5. 修改 FormalVisualModel / FormalWorldView 路线。
6. 通过 CSS 隐藏旧事实。
7. 新增 mock。

## 8. 下一步

下一步建议进入：

```text
WORLD-GEN-02：worldSeed + personality layout input schema
```

或先做一次全仓库一致性检查，确认旧 docs 与当前三份正式文档的优先级边界。
