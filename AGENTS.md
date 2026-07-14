# AI-PET-WORLD 智能体执行规则

更新时间：2026-07-14 14:39:13 +08:00

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

第一版正式视觉已经由项目所有者锁定为 2D 高分辨率像素风完整地图：模型必须原生生成 `1024×768` 完整地图，不再使用 `256×192 -> 4× nearest-neighbor` 的低分辨率像素画契约。高分辨率像素风必须统一视角、尺度、像素纹理语言、轮廓、光照、对象接地和游戏可读性；不得把普通数字插画、tile 拼接、局部 sprite 放大或平滑缩放冒充正式完整地图。

分辨率解释固定为：原图、正式候选、机器审核、项目所有者审核和 Runtime 只认原生 `1024×768` 文件；`256×192` 或 `512×384` 只允许作为模型训练内部的渐进阶段，不能作为候选保存后放大取得正式资格。画法/生成算法负责把世界事实、23 通道条件和模型状态转换为新像素；风格契约负责统一视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性。两者必须同时满足，不能互相替代。

整个项目的两大核心业务已经锁定为：

1. AI 管家的性格数据、性格映射和角色自主。正式角色只能申请 AI 管家；紫微斗数和八字是人格数据来源；用户可选现实自我映射或平行世界反向紫微映射。
2. 以地球参数和自然规律为基准的类地球世界自主运行、自主生长与长期演化。

当前地图任务是第二核心业务的第一阶段，不代表整个项目只有地图生成业务。

第一版自然家园必须被视为未来类地球大世界的第一个连接区域，而不是孤立概念图。大世界连接机器契约固定为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。项目所有者已命令按真实地球实际情况定义第一版连接；正式蓝图为 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`，水流北入南出、道路南侧接入、西侧保持自然边界。项目所有者已于 2026-07-13 授权 Runtime 世界事实迁移并审核通过迁移结果；程序已生成 tick 3，自动保存迁移证据和 `.runtime/world-connectivity-owner-reviews/latest.json`。连接训练覆盖门槛仍未批准。智能体不得用图片反推或创造连接。

AI-PET-WORLD 的产品身份是像素风格自主世界游戏。本地小 AI 是游戏核心智能系统，不是单一画图程序；它长期负责世界理解、世界导演、状态推理、角色自主、失败学习和世界演化。AI Painter 只是本地小 AI 的视觉生产子系统之一，只负责把已存在的世界事实转成游戏画面，不得被描述成整个小 AI、整个游戏或世界事实生成器。

第一版 MVP 世界档案已由项目所有者锁定为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`：以东南亚大陆热带季风低地、河谷和丘陵为现实生态参照，包含热带雨林及季节性森林、河岸、草地、淡水湿地和低山环境；当前明确排除雪、冰川、高山苔原、荒漠、寒温带白桦/针叶林身份及未经批准的海岸红树林子档案。现实事实可以进入世界数据，但外部数据集、地图、文字和图片仍必须逐项保存来源、版本和许可；禁止把权威网站图片自动当作训练数据。

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
owner_review_missing_identity
formal_gate_missing
data_gap_insufficient
project_owned_checkpoint_missing
world_connectivity_coverage_thresholds_pending
```

自有扩散训练程序、采样器、严格项目自有 IP 数据门禁、版本化地球气候参数快照、第一版真实地球参照连接蓝图、Runtime 连接事实迁移和项目所有者审核记录已经实现。当前 tick 3 已保存区域身份、三个邻居、四个当前区域连接口、南侧道路连接、北入南出的水文图和审核身份；当前下一步是制作、审核、登记绑定23通道、当前热带季风档案和已批准连接事实的合法 `1024×768` 高分辨率像素风 RGB 数据，闭合独立数据缺口后训练首个项目自有 checkpoint。连接覆盖数量门槛不得由智能体自行设定。任何改变数据标准、模型路线、审核门槛、页面结构或自动保存边界的操作，必须先说明并获得项目所有者命令。

项目所有者已于 2026-07-13 明确授权 `owner-authorized-ai-assisted-cold-start-v1`：OpenAI 生成的高分辨率像素风原图可以进入单独的 AI 辅助冷启动数据通道，但必须保存生成来源、提示词、时间、hash、owner 授权和审核结果，并固定 `independentTrainingEligible=false`。由此训练的 checkpoint 必须标记 AI 生成数据依赖；不得冒充纯项目独立数据 checkpoint。原 `strict-project-owned-training-data-v1` 通道继续保留，未来用于无第三方生成输出依赖的纯项目数据训练。
