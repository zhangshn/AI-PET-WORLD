# AI-PET-WORLD WORLD-GEN-01A/B 正式首屏文案修正与 pet runtime 断开

## 1. 阶段定位

WORLD-GEN-01A/B 用于修正正式 /world 链路中的旧首屏文案，并断开 /world 手动 Tick 默认 pet runtime。

本阶段不是删除宠物系统。
本阶段不是删除未来 pet 能力。
本阶段不修改 FormalVisualModel / FormalWorldView 链路。
本阶段不处理 placement-engine。
本阶段不处理 initial-home-scene-recipe。

## 2. 本阶段已完成

本阶段已完成：

1. 清理 `world-first-scene-model.ts` 中正式首屏旧孵化器文案。
2. 清理正式首屏 milestone 中关于孵化器、等待宠物出生的表述。
3. `/world` 手动 Tick 不再默认构造 `PetRuntimeContext`。
4. `/world` 手动 Tick 不再调用 `validatePetRuntimeContext`。
5. `/world` 手动 Tick 不再调用 `buildPetRuntimeContextSummary`。
6. `/world` 手动 Tick 不再把 `petIntentContext` 传给 `buildWorldLoopStep`。
7. UI 中 pet runtime 状态显示为后置等待，不显示 embryo / incubating。

## 3. 保留内容

本阶段保留：

1. 宠物系统。
2. pet runtime schema。
3. 未来 pet 能力。
4. placement-engine 旧逻辑。
5. initial-home-scene-recipe 旧逻辑。
6. FormalVisualModel / FormalWorldView 链路。
7. world-loop 链路。

## 4. 宠物后置原则

宠物后续只能通过后置生命关系链路进入：

```text
LifeEvent
-> CompanionDecision
-> accept_companion
-> pet runtime / pet actor
```

在该链路发生前：

1. /world 默认 Tick 不能构造 PetRuntimeContext。
2. /world 默认 Tick 不能传入 petIntentContext。
3. /world 不能显示宠物已出生。
4. /world 不能暗示宠物默认存在。

## 5. 本阶段未做

本阶段没有：

1. 删除宠物系统。
2. 修改 pet-runtime-context-schema。
3. 修改 placement-engine。
4. 修改 initial-home-scene-recipe。
5. 修改 world-loop。
6. 修改 HomeMapState。
7. 生成 world object。
8. 生成 placement。
9. 生成 actor。
10. 读取 PNG / WORLD_MAP_ASSETS。

## 6. 下一步

下一步建议进入：

```text
WORLD-GEN-01C：移除初始 pet actor / pet placement
```

目标是继续处理 placement-engine / initial recipe 中的旧 pet 默认生成风险，但必须单独分阶段执行。
