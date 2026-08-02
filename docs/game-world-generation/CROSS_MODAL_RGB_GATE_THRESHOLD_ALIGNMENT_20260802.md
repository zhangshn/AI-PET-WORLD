# 条件图与 RGB 水体构图门禁对齐（2026-08-02）

## 目的

本规则用于防止条件数据包本身互不重复，但 ImageGen 输出又坍缩成历史 RGB 已有水体骨架。训练原图同时是未来游戏世界画面，因此条件阶段和生成后阶段必须执行同一尺度、同一阈值的全历史水体形状比较。

## 正式规则

- 候选条件图只与历史 RGB 做审核比较，不得把历史 RGB 作为生成参考。
- 比较对象必须覆盖全部历史完整地图，不得只比较同槽位、同景观或当前64组。
- 水体掩码必须执行位置与尺度归一化；强重复门禁 `normalizedWaterShapeIntersection` 上限固定为 `0.45`。
- 生成前条件图门禁与生成后 RGB 构图门禁必须共用 `0.45`，不得出现前检宽松、后检严格的阈值漂移。
- 主河、支流、分汊、回水汊、岸线、真实北侧入口、真实南侧出口以及道路入口全部计入完整骨架；不能仅比较主河中心线。
- 道路候选必须从当前测量窗口和当前入口侧投影生成，禁止复用其他槽位的道路连接模板。
- `main_channel_connected_floodplain_backwater_finger` 必须由当前测量支撑带派生多个真实连通的回水汊，不得退化为单一环形岛模板。
- 任一机器门禁失败，原图和证据保留并进入 `failed-records`；不得自动重试、降低阈值或代写项目所有者通过。

## 本轮验证

- 新64组第45张（slot-190）使用 `sakaerat-measurement-window-r06-c09-v3`，条件为北入南出、东侧道路入口、东侧内部源头支流连接主河。生成记录 `ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v5` 只调用一次 ImageGen；生成后与历史 `ai-cold-start-map-014-pond-short-creek` 的归一化水体形状交并值为 `0.506475`，超过新旧统一阈值 `0.45`，因此机器拒绝并进入未通过组，不得训练且未重试。
- 新64组第49张（slot-194）使用 `sakaerat-measurement-window-r04-c08-v3`，条件为北入南出、西侧道路入口、三条真实连通回水汊。阈值对齐后重新执行生成前跨模态审计，共比较256份历史 RGB，重复命中0；记录 `ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6` 只调用一次 ImageGen，机器全部硬门禁通过。项目所有者于2026-08-02明确回复“算通过了”，正式 owner 审核已写为 `owner_approved`，并完成 V7 validation 容量登记与独立检查。
- 当前64份条件包完整框架审计为64/64通过、2016/2016对不同；道路、水文类型、完整骨架、共享构造语法重复均为0。

## 运行边界

本轮历史 RGB 生成引用为0，GPU=0，RuntimeFrame=0，`/world`未启动。slot-190若需再次返工，必须由项目所有者另行明确授权。

## 2026-08-02 slot-190 v6结果

项目所有者授权从正式泰国包继续寻找不相似数据。`r05-c09-v3`因条件宏观架构命中slot-190 v4而在出图前淘汰；`r04-c07-v3`因跨模态命中6张历史RGB而在出图前淘汰，二者均未消耗ImageGen。最终未被历史条件使用过的`r09-c11-v3`通过64/64、2016/2016对及全历史条件/RGB零命中门禁后，只调用一次ImageGen生成slot-190 v6。生成后RGB仍与`ai-cold-start-map-014-pond-short-creek`出现`0.512`的归一化水体形状相似度，并在东侧授权道路入口之外形成南侧道路边界接触，因此机器以`complete_map_composition_diversity_failed`和`condition_terrain_path_ground_uncontracted_boundary_contact`拒绝。该结果证明条件唯一性不能保证生成器不发生RGB坍缩；v6保留在未通过组，不得训练、不自动重试。

## 2026-08-02 slot-190 v7 解决结果

项目所有者以“继续”授权第45张再执行一次有界重建。程序没有换随机种子或修改失败RGB，而是从正式Sakaerat/Wang Nam Khiao泰国测量数据中选定历史条件使用数为0的`sakaerat-measurement-window-r02-c07-v3`，并将内部水网明确建模为“两条彼此分离的内陆源头支流汇入北进南出主河”，道路只允许接触东侧边界。最终conditionId=`earth-reference-v7-v7-capacity-slot-190-c873391d9acd`，生成前比较257份历史条件，跨模态历史RGB水体形状命中0，主题架构命中0，不完整比较0。

当前64组回归为64/64通过、2016/2016对不同，重复和关注项均为0。在只读取当前权威条件引导图、历史与失败RGB生成引用为0的前提下，Codex内置ImageGen只调用1次，未重试。新记录=`ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v7`，机器通过完整画幅、条件对齐、北入南出水文连通、构图新颖性及历史匹配门禁，问题数为0。项目所有者于2026-08-02明确回复“通过”，正式owner reviewId=`ai-cold-start-owner-review-ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v7-2026-08-02T00-58-24-760Z`已写入；记录状态为`ai_assisted_cold_start_eligible`，条件绑定为`formal_conditional_training_eligible_owner_approved`。V7容量已按`v7-capacity-slot-190`（train）登记，独立检查通过；本次通过不授权立即启动GPU训练、RuntimeFrame或`/world`。
