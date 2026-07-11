# AI-PET-WORLD

更新时间：2026-07-11 12:32:00 +08:00

状态：当前项目导航 / 完整自然家园地图阶段 / blocked

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 整个项目的两大核心业务

1. **AI 管家人格与角色自主**：用户只能申请 AI 管家；以紫微斗数和八字作为性格数据来源；支持现实自我映射与平行世界反向紫微映射；最终形成具备稳定人格、记忆、动机和自主决策能力的角色。
2. **类地球世界自主运行与生长**：以当前地球参数和自然规律为第一基准，建立持续存在、能够自主运行、自主生长并长期演化的游戏世界。

两条业务相互驱动：管家在世界中自主行动并改变合法世界事实，世界环境和事件再影响管家的下一轮判断。

## 当前唯一工作范围

当前只完成第一版专业自然家园完整游戏地图。

```text
世界视觉数据字典
-> 世界导演层
-> 地图结构与语义层
-> 材料与过渡层
-> 物体摆放层
-> 完整地图合成
-> 机器审核
-> 失败回写
-> 下一轮训练
```

当前阶段不做：

- 管家人物和角色行为实现。
- 玩家交互、建筑、施工、动物、小镇和城市。
- 旧的 5×5 Chunk / 9张候选图路线。
- 紫微斗数人格映射实现；它属于第一核心业务，但当前地图阶段不启动。
- 盲目继续 grass、road、water 等局部材料训练。

## 当前状态

```text
status = blocked
canEnterWorld = false
blockers = owner_review_rejected, data_gap_insufficient,
           model_training_alignment_failed,
           training_data_persistence_failed,
           complete_world_visual_inference_not_implemented
```

第一版完整世界地图尚未成功。机器审核通过不代表最终通过，项目所有者人工拒绝的 RuntimeFrame 不得进入 `/world`。

## 必读顺序

1. `docs/DOCUMENT_AUTHORITY_INDEX.md`
2. `docs/BUSINESS_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`
5. 当前任务涉及的一份正式规格：
   - `docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md`
   - `docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md`
   - `docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md`

视觉字典禁止默认批量读取；只读其 README、当前导出 JSON 和任务明确涉及的条目。

旧计划、旧进度表和 `docs/live-world/` 历史文档已删除，不再作为项目资料保留。

## 当前程序入口

```bash
npm run check:documentation-policy
npm run check:ai-painter-model-training-alignment
npm run check:complete-game-world
npm run run:complete-game-world
```

当前正式下一步是闭合完整地图数据缺口并实现视觉条件编译器；达到数据门槛后才能接入当前任务包驱动的完整地图推理。
