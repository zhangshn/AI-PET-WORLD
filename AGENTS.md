# AI-PET-WORLD 智能体执行规则

更新时间：2026-07-11 12:32:00 +08:00

状态：active-governance / 所有项目窗口和智能体必须遵守

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 必读入口

开始任何世界地图任务前，必须依次读取：

1. `docs/DOCUMENT_AUTHORITY_INDEX.md`
2. `docs/BUSINESS_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`
5. 当前任务涉及的一个正式下级规格：
   - 视觉实现：`docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md`
   - 数据来源：`docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md`
   - 审核/自动化/存储：`docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md`

禁止默认批量读取 `docs/world-visual-data-dictionary/`。只读取其 `README.md`、当前导出 JSON 和当前任务明确涉及的字典条目。

## 当前范围

当前只处理第一版专业自然家园完整游戏地图及其数据、模型、审核、自动保存和控制台支撑。

整个项目的两大核心业务已经锁定为：

1. AI 管家的性格数据、性格映射和角色自主。正式角色只能申请 AI 管家；紫微斗数和八字是人格数据来源；用户可选现实自我映射或平行世界反向紫微映射。
2. 以地球参数和自然规律为基准的类地球世界自主运行、自主生长与长期演化。

当前地图任务是第二核心业务的第一阶段，不代表整个项目只有地图生成业务。

未经项目所有者明确命令，不得开始或恢复：

- 旧 5×5 Chunk、9张候选图或 P10-B3 路线。
- 管家角色实现、玩家交互、建筑、动物和后续生态扩展。
- 紫微斗数人格映射实现；它属于第一核心业务，但不参与当前地图任务的执行顺序。
- 单纯局部材料盲训。

## 文档边界

- `docs/game-world-generation/`：当前正式架构。
- `docs/world-visual-data-dictionary/`：当前视觉事实参考。
- `docs/ai-painter-progress/`：页面锁定规格和实施证据。
- `docs/ziwei/`：独立维护的人格数据子系统；长期服务 AI 管家人格映射，当前不参与世界地图任务。

旧计划、旧进度表和旧 `live-world` 文档已经删除。智能体不得重新建立平行计划或历史副本。

## 当前阻断

```text
owner_review_rejected
data_gap_insufficient
```

当前下一步是完整地图数据缺口闭合。任何改变数据标准、模型路线、审核门槛、页面结构或自动保存边界的操作，必须先说明并获得项目所有者命令。
