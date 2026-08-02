# 项目文档权威索引

更新时间：2026-08-02 09:55:00 +08:00

状态：正式文档治理入口 / V7 GPU激活已授权 / 首次冒烟在训练前因旧授权硬编码失败 / 修复与单次重试等待owner授权

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 2026-08-02 V7 GPU授权与首次冒烟失败边界

项目所有者已明确授权V7本地GPU训练，解决记录SHA-256=`03f2b9d275a3e42f1086f09cccce86c086afe3c6909650963b88cded62908e62`。第一次冒烟在创建checkpoint和进入训练之前被Python训练器的旧`trainingAuthorizationStatus=owner_approved`硬编码拒绝；失败记录SHA-256=`9f01e6d2f69d0276a8dc62e22f5789a6071eaea2284a913c37e8a6795d28ba30`，GPU训练实际开始=false。

程序已失败即停，stage-0/1/2均未启动。当前最新owner动作请求为`owner-action-request-v7-mvp64-smoke-authorization-gate-repair-retry-20260802`，SHA-256=`219f8d3bd5643ac0ae7fb9eb5bea6d9a6f3df21b085eaae2c5228ea8e0e45e66`。只有项目所有者另行明确批准后，才允许把Python门禁升级为验证当前嵌套授权文件及SHA-256，并重试一次冒烟；不得降低训练或审核标准。

## 2026-08-02 新64组容量、数据集与GPU授权边界闭合

slot-146至209当前64个活动成功记录已全部登记为V7正式容量，序号01至64一一对应且无双重活动记录；正式分割为`48/8/4/4`，旧失败版本保留但容量为0。最新数据集manifest为`data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json`，SHA-256=`8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa`；最新容量计划SHA-256=`9e2166393fd49561c47d985b92601caae2820867df33c1a06f176b99c39fceb5`，缺口为0。

CPU完整模型门禁报告SHA-256=`4fc8bc3e4fa0c87fdeacfcd55eacdd893718177e8c4edfa73406e411c38ecf52`，失败项为0。GPU训练激活申请已落盘为`.runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-gpu-training-activation-20260802/request.json`，SHA-256=`5d0343db6b9865315e4d5aa7260c03571e27bf28f35594d0fc970ad5305dfff8`，状态仍为`waiting_owner_authorization`。没有启动GPU、推理、RuntimeFrame或`/world`；只有项目所有者对该申请作出新的明确批准后，才允许进入V7训练冒烟检查及stage-0/1/2。

未经项目所有者明确允许，任何智能体和程序不得修改已锁定页面的布局、样式、入口、名称或信息层级；如发现新需求、缺陷或无法继续的问题，必须先向项目所有者说明原因、影响和拟议调整，停止页面修改并等待明确指令后方可执行。

## 2026-08-01 新64组第01张单图生成闭合

单图授权=`project-owner-authorization-2026-08-01-v7-capacity-slot-146-single-rgb-generation`，本地授权记录SHA-256=`2ebb157da62619536e8e77aecd1b71de52c50ab66e63cc7e0e94d78230ee1370`。程序只调用一次内置生成，生成`ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3`，审核派生图SHA-256=`eb5c085a05f775ea8df2a8912ff806794dca25b7a378dc54102b142aecf43125`；最终机器审核通过，owner审核仍为`pending_review`，训练资格为false。

单次执行解决记录SHA-256=`f993e12b2924d0f79a2918048c5eae64e1a55ae7de47b164e5670b47b429781a`。该授权没有扩展到第02张、自动重试、容量登记、GPU、RuntimeFrame或`/world`。

## 2026-08-01 完整世界训练与动态准备合同生效

最新机器可读业务合同=`data/ai-painter/system-governance/complete-map-world-training-and-dynamic-readiness-contract-v2.json`，SHA-256=`a3ebae47ab542cfc818b99fd9237356edda18d666253a85ac00def4c2cf1b9bd`。该合同明确训练原图、未来游戏实际画面和未来动态世界底图是同一目标；每个像素必须属于世界，画幅铺满四边，禁止外部背景、纯色遮罩、悬浮切片和非世界留白；64组必须完成2016对唯一性检查。

owner升级授权记录=`.runtime/ai-painter/owner-action-requests/owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-upgrade-20260731/request.json`，SHA-256=`0365b1193922d8b5321bbd29e02ea16e4c769524cbbce66aaee9b01ace2588b2`。新64组01至05及53共6张候选已归入未通过并由新版机器审核再次拒绝；成功类型页记录0，未通过页可检索6条。64个条件包和条件引导已全面重建，最终框架审核64/64、2016/2016对不同；综合回归报告=`.runtime/ai-painter/thailand-rebuild64-full-world-dynamic-readiness-checks/thailand-rebuild64-full-world-dynamic-readiness-check-2026-07-31T17-07-13-035Z/check-report.json`、SHA-256=`4a40023412969c71ac4abea772141692e56eb29ba7c57a47bc9eb44847d770fe`。RGB生成、GPU、RuntimeFrame和`/world`均未授权。

## 2026-07-31 自主训练原图页面清除全部旧图

项目所有者要求`autonomous-generation-training-originals`只显示新64组，不得继续显示之前旧图。页面原有41条，其中40条属于新64组之前的旧自主训练记录，唯一新组记录为slot-198 V3。程序已把40/40旧记录正式归入`failed-records`，保留40张原图及全部审核历史、删除0、移动目录0、撤回旧注册容量贡献37个。归档结果路径=`.runtime/ai-painter/pre-rebuild64-autonomous-original-failed-group-archives/pre-rebuild64-autonomous-original-failed-archive-2026-07-31T12-03-48-381Z-completed/archive-result.json`，SHA-256=`862ce1734c0a95b9c3b168d020cd5f388c475727e4cb593cece4fe0df7d48449`。

本地页面刷新验证：自主训练原图活动记录=`1`、带图片记录=`1`、下拉记录=`1`，只剩`ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v3`，显示`新64组第53张`。该记录仍为机器通过、`ownerReviewStatus=pending_review`，未代写通过。数据集重建检查通过，V7容量贡献=`0`，当前新64组合规RGB容量0/64、GPU=0。

## 2026-07-31 旧RGB归入未通过与新64组重新编号

项目所有者明确要求：旧生成内容不再作为正样本，但不得删除，必须进入未通过组；新64组从`01`重新编码。正式归档保留旧slot-146至197及slot-198 V1/V2共54张原图和全部历史，最终54/54为`rejected`，删除0、移动0、旧注册容量贡献0。结果路径=`.runtime/ai-painter/legacy-v7-capacity-rgb-failed-group-archives/legacy-v7-capacity-rgb-failed-group-archive-2026-07-31T11-36-41-250Z-completed/archive-result.json`，SHA-256=`35b26b1ba9335211ca54e67130860cb1c8bdcaeccebede6debeaada663c9a5b7`。

新64组机器可读编号注册表=`data/ai-painter/system-governance/thailand-rebuild64-sequence-registry-v1.json`，SHA-256=`453c3215951adc48a9fa9634e71de504a35f065e2437cac95d34f4635790d149`。固定映射为原槽位146对应新编号01、原槽位198对应新编号53、原槽位209对应新编号64；旧recordId和目录不改名，只保留来源追溯。新的slot-198 V3绑定`新64组第53张`，仍是机器通过、等待owner审核，不得代写owner通过。其余63项状态为`complete_composition_condition_and_rgb_rebuild_required`，必须分别使用自身泰国测量包和独立完整构图架构重建。当前新组合规RGB容量0/64、GPU=0，不得启动批量RGB、训练、RuntimeFrame或`/world`。

## 2026-07-30 slot-149正式通过并登记容量

项目所有者明确回复“通过”。owner reviewId=`ai-cold-start-owner-review-ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v1-2026-07-30T01-25-18-362Z`已正式写入；容量贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-149-2026-07-30T01-25-54-965Z`、SHA-256=`5ba1acb7ce6bdb6fee9c7028d1ab422720a4344264e84d8379df4efb2098125d`登记并检查通过。

本地解决记录=`owner-action-request-slot-149-owner-visual-review-resolution-20260730`、状态=`resolved_owner_authorized`、SHA-256=`211f15490f25602ae862dbcdd30cbd9f219c569616cc15e052d5fb2bc070915f`；原等待请求保持不可变。当前合规RGB容量4/64、缺口60、GPU=0。本次通过只闭合slot-149，不授权slot-150 RGB、GPU训练、RuntimeFrame或`/world`。

## 2026-07-30 slot-149单张草图等待owner审核

项目所有者本轮只授权slot-149的一张草图。正式requestId=`conditional-rgb-149-2026-07-30T01-13-00-083Z`，recordId=`ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v1`，审核派生图SHA-256=`c74339a56b0d1d9a76cced942857d76cfe58a37464b2afc4c04e9bb88feaf039`。本图只消费当前conditionId=`earth-reference-v7-v7-capacity-slot-149-3fa4124cfd20`的泰国测量事实派生条件，历史RGB引用=0；机器审核全部通过，无水条件、下部边界纵向道路、完整地图范围、干湿季过渡生态、风格和145张全历史构图新颖性均无失败。

机器通过不等于owner通过。当前固定`ownerReviewStatus=pending_review`、`conditionalTrainingEligible=false`；本地请求`owner-action-request-slot-149-owner-visual-review-20260730`已保存并索引。当前容量仍为3/64、缺口61、GPU=0；不得自动登记容量、进入slot-150、RuntimeFrame或`/world`。唯一下一动作是项目所有者审核当前图片并明确通过或拒绝。

## 2026-07-30 slot-148正式通过并登记容量

项目所有者明确回复“通过”。owner reviewId=`ai-cold-start-owner-review-ai-cold-start-v7-v7-capacity-slot-148-grassland-forest-transition-v1-2026-07-30T00-59-59-431Z`已正式写入；容量贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-148-2026-07-30T01-00-47-626Z`、SHA-256=`1366f1b40928d460a1995e9aad520929bdaeef0f0f29dbe6fd4f2c260f1321ba`登记并检查通过。

本地解决记录=`owner-action-request-slot-148-owner-visual-review-resolution-20260730`、状态=`resolved_owner_authorized`；原等待请求保持不可变。当前合规RGB容量3/64、缺口61、GPU=0。本次通过只闭合slot-148，不授权slot-149 RGB、GPU训练、RuntimeFrame或`/world`。

## 2026-07-30 slot-148单张草图等待owner审核

项目所有者本轮只授权slot-148的一张草图。正式requestId=`conditional-rgb-148-2026-07-30T00-47-59-844Z`，recordId=`ai-cold-start-v7-v7-capacity-slot-148-grassland-forest-transition-v1`，审核派生图SHA-256=`dfab6240b07dddeab8b40c6d2e278daa0c98146959061901681f90403f090dfa`。本图只消费当前conditionId=`earth-reference-v7-v7-capacity-slot-148-34b9a66ce3f6`的泰国测量事实派生条件，历史RGB引用=0；机器审核全部通过，无水条件、右侧边界道路、完整地图范围、旱季生态、风格和144张全历史构图新颖性均无失败。

机器通过不等于owner通过。当前固定`ownerReviewStatus=pending_review`、`conditionalTrainingEligible=false`；本地请求`owner-action-request-slot-148-owner-visual-review-20260730`已保存并索引。当前容量仍为2/64、缺口62、GPU=0；不得自动登记容量、进入slot-149、RuntimeFrame或`/world`。唯一下一动作是项目所有者审核当前图片并明确通过或拒绝。

## 2026-07-30 slot-147正式通过并登记容量

项目所有者明确回复“通过”。owner reviewId=`ai-cold-start-owner-review-ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v1-2026-07-30T00-38-37-710Z`已正式写入；容量贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-147-2026-07-30T00-39-05-580Z`、SHA-256=`bfb5fda9a3916ad733f8d72668c81a01bc69e0b69a875b0522075690951c77ca`登记并检查通过。

本地解决记录=`owner-action-request-slot-147-owner-visual-review-resolution-20260730`、状态=`resolved_owner_authorized`；原等待请求保持不可变。当前合规RGB容量2/64、缺口62、GPU=0。本次通过只闭合slot-147，不授权slot-148 RGB、GPU训练、RuntimeFrame或`/world`。

## 2026-07-29 slot-147单张草图等待owner审核

项目所有者本轮只授权slot-147的一张草图。正式requestId=`conditional-rgb-147-2026-07-29T13-28-05-306Z`，recordId=`ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v1`，审核派生图SHA-256=`0dce7acccce15d238ff92afe2bb9dc47ee54e730db0da8569640a5aba1dbbf12`。本图仅消费当前conditionId=`earth-reference-v7-v7-capacity-slot-147-1f2122e8a74a`的泰国测量事实派生条件，历史RGB读取=0；机器审核全部通过，无水条件、水陆语义、道路条件、完整地图范围、风格和143张全历史构图新颖性均无失败。

机器通过不等于owner通过。当前固定`ownerReviewStatus=pending_review`、`conditionalTrainingEligible=false`；本地请求`owner-action-request-slot-147-owner-visual-review-20260729`已保存并索引。当前容量仍为1/64、缺口63、GPU=0；不得自动登记容量、进入slot-148、RuntimeFrame或`/world`。唯一下一动作是项目所有者审核当前图片并明确通过或拒绝。

## 2026-07-29 本地系统主责与Codex员工边界

项目所有者明确要求逐步脱离Codex：本地系统是正式判断、授权请求、审核状态和长期记忆的唯一载体，Codex只作为受控执行与检查员工，最终缩减为按本地系统分派任务执行对应检查。机器可读职责合同为`data/ai-painter/system-governance/local-ai-responsibility-contract-v1.json`；本地owner动作请求采用`owner-action-request`合同，保存在`.runtime/ai-painter/owner-action-requests/`并进入程序事件和SQLite索引。

slot-146“视觉完全通过但机器把森林暗部误识别为水体”的真实说明已经按该合同保存为`owner-action-request-slot-146-water-false-positive-20260729`，状态=`resolved_owner_authorized`。该补录引用原机器拒绝、回归、同图复审、owner通过和容量登记证据，不生成新RGB、不修改历史审核、不启动GPU。以后同类原因说明、最小授权范围、不变量、禁止副作用和获批后动作不得只存在于聊天中。

## 2026-07-29 slot-209条件通过及64槽位条件准备闭合

conditionId=`earth-reference-v7-v7-capacity-slot-209-d1621080b4dc`，SHA-256=`e479ea7599b7045e6c6df53899551edefb44fd5849e1185ba78a3d88cd9e2943`。split=`regression`、景观=`tropical-forest-glade`、季节=`dry_to_wet_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。`slot-146`至`209`的64个无RGB条件包已全部准备完成，条件缺口=0；当前合规RGB容量仍为0/64、GPU=0。不得进入`slot-210`或自动出图、训练、RuntimeFrame、`/world`；任何RGB仍须项目所有者另行明确授权。

## 2026-07-29 slot-208条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-208-16a9c5073afc`，SHA-256=`31032db3b308a0dd7fe005463e87990092d95752f7b5aea05d8e98863794231a`。split=`regression`、景观=`forested-low-mountain`、季节=`dry_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备63/64，还差1个；RGB=0、GPU=0，下一项为`slot-209`。

## 2026-07-29 slot-207条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-207-b4b811e6df88`，SHA-256=`b2c04962340d3f1b10985939c49372551590792351777efe4be535e85528d083`。split=`regression`、景观=`tropical-forest-glade`、季节=`wet_to_dry_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备62/64，还差2个；RGB=0、GPU=0，下一项为`slot-208`。

## 2026-07-29 slot-206条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-206-fc2f809de93c`，SHA-256=`70566752b9cb22743d1696f4f399379d3f6054b40252a4a90821671baf41ca1e`。split=`regression`、景观=`bamboo-grove`、季节=`wet_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备61/64，还差3个；RGB=0、GPU=0，下一项为`slot-207`。

## 2026-07-29 slot-205条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-205-91a2edbff991`，SHA-256=`8bc69a8d8641dafd92f1f60c258614cc23f34a7107c140a1cf0935b32b156925`。split=`challenge`、景观=`dry-dipterocarp-woodland`、季节=`dry_to_wet_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备60/64，还差4个；RGB=0、GPU=0，下一项为`slot-206`。

## 2026-07-29 slot-204条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-204-b7d2999c8387`，SHA-256=`4909a5ccb9179871b5d3e7e9a0ab8ac6d574ea1bff315ae2ed1ce75a9facd152`。split=`challenge`、景观=`forested-low-mountain`、季节=`dry_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备59/64，还差5个；RGB=0、GPU=0，下一项为`slot-205`。

## 2026-07-29 slot-203条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-203-2168e0d75810`，SHA-256=`bf565a5c770087d64bfd02f7062a254d36ff302c093a572727ffde8774cbe006`。split=`challenge`、景观=`tropical-forest-glade`、季节=`wet_to_dry_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备58/64，还差6个；RGB=0、GPU=0，下一项为`slot-204`。

## 2026-07-29 slot-202条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-202-ea99d888caf4`，SHA-256=`a9570e7c1e0ca443813a9a4a3bb10a5961b76965330d5064c5c8b425fef6539e`。split=`challenge`、景观=`dry-dipterocarp-woodland`、季节=`wet_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备57/64，还差7个；RGB=0、GPU=0，下一项为`slot-203`。

## 2026-07-29 slot-201条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-201-79c0ccf3d084`，SHA-256=`d602f2645ba8dbe8be753031f27e695e443c2e0bc71733d4c91845024bf90436`。split=`validation`、景观=`bamboo-grove`、季节=`dry_to_wet_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备56/64，还差8个；RGB=0、GPU=0，下一项为`slot-202`。

## 2026-07-29 slot-200条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-200-2453214a07ac`，SHA-256=`e70baeabd3b9b923bd8d5529828d04689268ba5928b67bcbbc78b099f6e207e7`。split=`validation`、景观=`forested-low-mountain`、季节=`dry_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备55/64，还差9个；RGB=0、GPU=0，下一项为`slot-201`。

## 2026-07-29 slot-199条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-199-a65aee175280`，SHA-256=`f89d61f9032738b346f24b87763e651506265b5bc25da549a11c0d11ec7d5768`。split=`validation`、景观=`grassland-forest-transition`、季节=`wet_to_dry_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备54/64，还差10个；RGB=0、GPU=0，下一项为`slot-200`。

## 2026-07-29 slot-198条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-198-cf3efb3de859`，SHA-256=`23fde51a857ab28371bbed3975119c5fdcb9d4ed4ceda5b6573640eb1f321fed`。split=`validation`、景观=`grassland-forest-transition`、季节=`wet_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备53/64，还差11个；RGB=0、GPU=0，下一项为`slot-199`。

## 2026-07-29 slot-197条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-197-7a9dd9b64762`，SHA-256=`3f981a6d1cfa2439414f0fa8c45dd02acae8949be373de106c19b1caff526e32`。split=`validation`、景观=`tropical-forest-glade`、季节=`dry_to_wet_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备52/64，还差12个；RGB=0、GPU=0，下一项为`slot-198`。

## 2026-07-29 slot-196条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-196-6a9629fbca81`，SHA-256=`5c54f023d3c3d34ba9cd3b2889756fe84c37cc9843e84de9b4de8bff5a7bc649`。split=`validation`、景观=`seasonal-evergreen-semi-evergreen-forest`、季节=`dry_season`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备51/64，还差13个；RGB=0、GPU=0，下一项为`slot-197`。

## 2026-07-29 slot-195条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-195-fd582468ba98`，SHA-256=`2b10023d2d72f9007a348e89f2203df34066b929e959e61013fead9f39c7408a`。split=`validation`、景观=`seasonal-evergreen-semi-evergreen-forest`、季节=`wet_to_dry_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备50/64，还差14个；RGB=0、GPU=0，下一项为`slot-196`。

## 2026-07-29 slot-194通用支流弧度修复与条件通过

项目所有者明确批准只扩展内部支流的通用测量弧度候选搜索。首次失败runId=`earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-07-29T06-20-43-456Z`、failure SHA-256=`4115e1d176285926270e44ea18f653b8e5088c09924f0387e995875fdcd540c0`保持不可变。修复不修改泰国测量事实、连接契约、23通道或审核阈值，不读取槽位编号、历史几何或历史RGB。最终conditionId=`earth-reference-v7-v7-capacity-slot-194-e26f0b5e29dc`、manifest SHA-256=`91ef46399616f62255aa120ffff688a6484867adb51775b99c25ba5cedc9d6e1`；选定弧度比例`0.68`、曲流度`1.234338`、最小弯曲半径比例`1.152682`，全部原阈值与独立检查通过。条件准备49/64，还差15个；RGB=0、GPU=0，下一项为`slot-195`。

## 2026-07-29 slot-193条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-193-d48b35223281`，SHA-256=`f50d6b2ef050178b9df84dbad86f5cd69071ae736153010ac8eed0e8006580e9`。景观=`tropical-forest-glade`、季节=`dry_to_wet_transition`；独立泰国测量、连接、主题、细节和全历史新颖性门禁通过。条件准备48/64，还差16个；RGB=0、GPU=0，下一项为`slot-194`。

## 2026-07-29 slot-192条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-192-5ceac7540d1c`，SHA-256=`0d35e7e50978943fb031fd2936febe6d3b739411878305ba7228949c0b412583`。景观=`forested-low-mountain`、季节=`dry_season`；独立测量、连接、主题、细节和全历史新颖性门禁通过。条件准备47/64，还差17个。

## 2026-07-29 slot-191条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-191-71b6e11c2f2e`，SHA-256=`90602cd515927ef2f7592298f273fc122d8270c1f25a2419018d7cfa6638171f`。景观=`forested-low-mountain`、季节=`wet_to_dry_transition`；全部无RGB门禁与独立检查通过。条件准备46/64，还差18个。

## 2026-07-29 slot-190曲流修复与条件闭合

项目所有者批准只修复通用匿名分汊河道曲率构建，不改变泰国测量事实、连接契约、边界端口、23通道或审核阈值。两次失败run及其SHA-256分别为`earth-geospatial-v7-slot-condition-v7-capacity-slot-190-2026-07-29T04-47-37-729Z` / `0bb4ac38db9dc7c7ed57d517c2646326f030501f6a52727e095eb7203922e8f1`和`earth-geospatial-v7-slot-condition-v7-capacity-slot-190-2026-07-29T05-23-19-132Z` / `66ea77c1815a7e38269cc5167e8bcf0a07617b0255d5ba2784be9681b9458cfb`，继续作为不可变失败证据保留。最终通用方法在测量选择侧匿名边界空间不足时按可用空间重映射内部弧向，仍由全部八段泰国DEM/D8支撑驱动，不读取槽位编号、历史几何或历史RGB。最终conditionId=`earth-reference-v7-v7-capacity-slot-190-fa2d04c6c3fc`，manifest SHA-256=`394625711319289d2b4284903748eafcefb4830af220f0671b74495e50d3ccee`；分汊曲流度`1.225397`通过未改变的最低值`1.223141`。全部无RGB门禁通过；条件准备45/64，还差19个。

## 2026-07-29 slot-189条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-189-42435c0390b3`，SHA-256=`8cae9f764e0dde4f7bc6c8c98d60e913ae65f4118bdc72ab6c0f529b3f495826`。全部无RGB门禁通过；条件准备44/64，还差20个。

## 2026-07-29 slot-188条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-188-feacb5c81d48`，SHA-256=`d4a0a02d8c96dbf2eda6d9abb9d1c5a9cb3ac8f0604e3bcad322aa4f58b2c02c`。全部无RGB门禁通过；条件准备43/64，还差21个。

## 2026-07-29 slot-187条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-187-28f5c795bd7d`，SHA-256=`ba3026f6424cdcca7ce4a5d80ae6b83dd2fc93597bc6e34e45f4e32d51497e5b`。全部无RGB门禁通过；条件准备42/64，还差22个。

## 2026-07-29 slot-185至186条件连续闭合

`slot-185` conditionId=`earth-reference-v7-v7-capacity-slot-185-b3329fcce28b`，SHA-256=`63acc8a01ccae9fe45e0d171c464f1851bdbf10fbfcb82172e829ace58685462`；`slot-186` conditionId=`earth-reference-v7-v7-capacity-slot-186-df4a7964e5db`，SHA-256=`533e82c7d48b715b55b474b950ec30b38f9615d9beec6514b1310d0e09dab4ec`。两槽全部无RGB门禁通过；条件准备41/64，还差23个。

## 2026-07-29 slot-184条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-184-e62e597b4849`，manifest SHA-256=`dac1a7a4adf41b3ef2eb03b534d7e98396c51830a290a630e5c690b5331151cb`。条件准备39/64，还差25个；未生成RGB。

## 2026-07-29 slot-183条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-183-5f99e62cd578`，manifest SHA-256=`87d5cf6e8951a860dbc4e9033859966aa5de6f6bd0fd3540c3732aebced6766a`。条件准备38/64，还差26个；未生成RGB。

## 2026-07-29 slot-182条件已通过

`v7-capacity-slot-182`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-182-ed117d06fcce`，manifest SHA-256=`de44121ab9a1cece7c3cc81ab0d6a854c1b26f76840f71ce4e57a0cec6b55388`。全部无RGB门禁通过；当前条件准备37/64，还差27个。

## 2026-07-29 slot-181条件已通过

`v7-capacity-slot-181`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-181-603f54a6bfaa`，manifest SHA-256=`d7f44d5e486317d8da75fe58ad88ca6afc6330842976f1e26e871c6f28f7d6d1`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备36/64，还差28个。

## 2026-07-29 slot-180条件已通过

`v7-capacity-slot-180`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-180-66287cc3d045`，manifest SHA-256=`18b017ec62c9eec6e6bb0f85d069c87f46826b63c1bd839ca5eb3642b3a61246`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备35/64，还差29个。

## 2026-07-29 slot-179条件已通过

`v7-capacity-slot-179`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-179-ff16f87ae958`，manifest SHA-256=`a1b9e01f52821436a8d95a25cfbc112da6083eb96813aa75faba74b157e590c5`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备34/64，还差30个。

## 2026-07-29 slot-178条件已通过

`v7-capacity-slot-178`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-178-89305d8f2d40`，manifest SHA-256=`f99eda710a394acacad0c9c19d856a3e19396e7a103a0c1f912c6904631a2727`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备33/64，还差31个。

## 2026-07-29 slot-177条件已通过

`v7-capacity-slot-177`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-177-573093a10286`，manifest SHA-256=`8f4487cb96a3d29aeb7df41b4617f410f9a5c9ef2774bf169420937fa695b940`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备32/64，还差32个。

## 2026-07-29 slot-176条件已通过

`v7-capacity-slot-176`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-176-feb30be8a4f2`，manifest SHA-256=`aaea7de29ffc61fc23cb2b8b92e2d54fabe7928877242e7314cb9e955a78bd65`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备31/64，还差33个。

## 2026-07-29 slot-175条件已通过

`v7-capacity-slot-175`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-175-824651386964`，manifest SHA-256=`1d119d8b259a238889fea3002679001513ccf8cac612822298f0163cc8ac0048`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备30/64，还差34个。

## 2026-07-29 slot-174条件已通过

`v7-capacity-slot-174`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-174-94eae04391ed`，manifest SHA-256=`f7d396f6e373f4917d1ac9e6efb9ca58183ffef14ee5d786cabd2c419d1820e5`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备29/64，还差35个。

## 2026-07-29 slot-173条件已通过

`v7-capacity-slot-173`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-173-fd4d8f71499b`，manifest SHA-256=`7d47e19b213a677561b36cc850ef9e14d6ff6ce013c0396dbabe4b8b341f424e`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备28/64，还差36个。

## 2026-07-29 slot-172条件已通过

`v7-capacity-slot-172`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-172-6a996f1c94e6`，manifest SHA-256=`8b6315162da1819c2421ab7c7801065f8671c0dcea54b941dcfe3e8042654e0a`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备27/64，还差37个。

## 2026-07-29 slot-171条件已通过

`v7-capacity-slot-171`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-171-b692273e7e86`，manifest SHA-256=`eebf2c77821c827271d84a2fa10e3801099ae5e4156d54c6be1b4d09f513a0f7`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备26/64，还差38个。

## 2026-07-29 slot-170条件已通过

`v7-capacity-slot-170`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-170-535897efb478`，manifest SHA-256=`72883d2604b22f578046acc0603f0d9246e64cb96fd06ef9436adade98238cf0`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备25/64，还差39个。

## 2026-07-29 slot-169条件已通过

`v7-capacity-slot-169`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-169-30dd0db126a1`，manifest SHA-256=`be36ee4348893e3bb5e72d3ccbe8cc0b45d363e1dfb3f29a7bc89d5a13b26a70`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备24/64，还差40个。

## 2026-07-29 slot-168条件已通过

`v7-capacity-slot-168`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-168-149a7e7109b2`，manifest SHA-256=`a1554f520f77ea316409c1a40ff331cd587ee62cde419ab5b59f6135ce52ea15`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备23/64，还差41个。

## 2026-07-29 slot-167条件已通过

`v7-capacity-slot-167`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-167-ded69119ce82`，manifest SHA-256=`b047792cded78e8703a9da51ac92308e055d62d4e0f08cd99a76ee469e2071fd`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备22/64，还差42个。

## 2026-07-29 slot-166条件已通过

`v7-capacity-slot-166`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-166-f9e62b095fa4`，manifest SHA-256=`5e7f9a71697067916d018c11716a7653797e5c9cd3bd8ccf3c3242cb6fc04d02`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备21/64，还差43个。

## 2026-07-29 slot-165条件已通过

`v7-capacity-slot-165`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-165-bd53548137b4`，manifest SHA-256=`d7e0ce8aadd0b3982fc83a92951dde3917ef4b80a3c2c23761f1a31f0a7bc85b`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备20/64，还差44个。

## 2026-07-29 slot-164条件已通过

`v7-capacity-slot-164`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-164-fa21b716dc52`，manifest SHA-256=`ce2e3721b82da955463aa9a3f39d581dde8fd0f1c177173125be1a09b996cdb1`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备19/64，还差45个。

## 2026-07-29 slot-163条件已通过

`v7-capacity-slot-163`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-163-ebbf10c73520`，manifest SHA-256=`3d7e24eeff5ddb1f8aa430659714bcdbdf76b3c431dc425c3c9288d3752efa49`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备18/64，还差46个。

## 2026-07-29 slot-162条件已通过

`v7-capacity-slot-162`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-162-18529ba16b7b`，manifest SHA-256=`ea2e620ac423f3b28c6a2705d877a7377827f7a665bea933ea3387577be1488f`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。当前条件准备17/64，还差47个。

## 2026-07-29 slot-161条件已通过

`v7-capacity-slot-161`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-161-2a78f62ac376`，manifest SHA-256=`1d409a04eb93511bdadac0476b474cb548b7f8e4eadf740c7ff0d3b79baabade`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。

## 2026-07-29 slot-160条件已通过

`v7-capacity-slot-160`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-160-6cd8605dcde2`，manifest SHA-256=`7b7e03a89eec1893dbfb62783aff52538d23f96329bcf2f5f630a4d4a51d7c77`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。

## 2026-07-29 slot-159条件已通过

`v7-capacity-slot-159`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-159-5f15cd14eb37`，manifest SHA-256=`eb0be9fda07a453a1ebbfa659a513686ad72e8e67a3b6809b6803c71fe70ce96`。泰国测量事实、独立连接、主题与细节身份及全历史新颖性全部通过；未生成RGB。

## 2026-07-29 slot-158条件已通过

`v7-capacity-slot-158`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-158-1075ea428855`，manifest SHA-256=`2cb617b017dbc67ec7bb25d950df28d92c5ba188ff68f121569bfb5daab7ede1`。同类同季节条件下仍保持独立测量、连接、主题和细节身份；未生成RGB。

## 2026-07-29 slot-157条件已通过

`v7-capacity-slot-157`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-157-7ce7d5578279`，manifest SHA-256=`3a14340d111398cd0d666ac067dc81fa66a7c7687ba0403a254e3b4da0182260`。独立测量、连接、主题与细节身份未命中历史重复；未生成RGB。

## 2026-07-29 slot-156条件已通过

`v7-capacity-slot-156`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-156-a258a86d953b`，manifest SHA-256=`d04f3de393722e42967d402c2d176be8ace87651dbd62e2f7ba12e44db4509fb`。景观类型为季节常绿/半常绿森林，独立连接与全历史新颖性证据闭合；未生成RGB。

## 2026-07-29 slot-155条件已通过

`v7-capacity-slot-155`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-155-2792561c5b21`，manifest SHA-256=`dc4713cab8313a60967860de11f6c28fb71041d7d8c5c563740c655be1959868`。同类型、同季节条件下仍保持独立测量、连接、主题和细节身份；未生成RGB。

## 2026-07-29 slot-154条件已通过

`v7-capacity-slot-154`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-154-b48c8835876c`，manifest SHA-256=`a163cfd9c88393df785298796cc2c05ac11fc37d26313af4377b05a7da4aec45`。测量、连接、主题、细节和全历史新颖性证据独立；未生成RGB。

## 2026-07-29 slot-153条件已通过

`v7-capacity-slot-153`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-153-e324b3035843`，manifest SHA-256=`7a23ad57cc9bf842615f7a9a81ffcb78332a3b221a097ad2874b86693e808b74`。它与同类slot-146保持独立测量、连接、主题和细节身份，全历史新颖性检查通过；未生成RGB。

## 2026-07-29 slot-152条件已通过

`v7-capacity-slot-152`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-152-22c370f8a958`，manifest SHA-256=`de0192ad391c1b0b9ae682d103bede92d0f0cc4784872cbc43c341d6635714bb`。修复后的PathGraph入口方法、完整地图、独立连接和全历史新颖性门禁均通过；未生成RGB。

## 2026-07-29 slot-151道路跨度修复已通过

经项目所有者精确授权，程序仅修正独立区域PathGraph端口到内部入口的匿名道路纵深和道路生成器对该入口的消费，不改变测量事实、区域blueprint ID、端口ID或审核阈值。`slot-151`最终conditionId=`earth-reference-v7-v7-capacity-slot-151-b0bfa3256c3a`、manifest SHA-256=`827b781528c570f4458097412c3a4610e5322bcb17f7491af432330c7f18f4dc`；实际道路跨度=`0.478516`、碰撞重叠=0，全部无RGB条件门禁通过。此前两次失败继续作为不可变诊断证据保留。

## 2026-07-29 slot-151条件构建失败关闭

`v7-capacity-slot-151`在RGB前被完整地图范围门禁阻断。道路最大归一化跨度为`0.317383`，低于正式阈值`0.35`；失败证据SHA-256=`8cd4057f6a7feddae6d8b4e9bb6cc2cda9efc2be1a713b247ba64590282c0a62`。道路自然度、区域端口连接和全历史新颖性均通过，唯一问题是内部道路延伸不足，不能证明完整地图尺度。当前禁止降低阈值、跳槽或重试；须等待项目所有者明确授权仅修正匿名道路跨度构建方法。

## 2026-07-29 第五个新槽位条件已通过

`v7-capacity-slot-150`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-150-99d6a20b8bc4`，manifest SHA-256=`e0aa1ddc122d3a966ccf5662e642a68235674cefab9a88694550165a4a46d624`。它与同类slot-149保持独立测量事实、区域连接、主题架构、实例细节和新颖性证据；未生成RGB。

## 2026-07-29 第四个新槽位条件已通过

`v7-capacity-slot-149`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-149-37d101ef8c7b`，manifest SHA-256=`2a9a3e9fded969c8b644853906c83af0c7aba0e78a6695a13041be6aa2ba8463`。景观事实为`tropical-forest-glade`，独立来源、区域连接、主题架构、实例细节和跨槽位新颖性证据均已闭合；未生成RGB。

## 2026-07-29 第三个新槽位条件已通过

`v7-capacity-slot-148`无RGB条件已通过：conditionId=`earth-reference-v7-v7-capacity-slot-148-86c122f8c0dc`，manifest SHA-256=`fc17b2fd59673fb19dfec681d168caadbd53361765eef8a63fa8dd0965f66b23`。它与slot-147虽同属`grassland-forest-transition`，但各自绑定独立测量事实、区域连接、主题架构和实例细节；跨槽位新颖性检查通过。当前合规RGB容量仍为0/64。

## 2026-07-29 第二个新槽位条件已通过

`v7-capacity-slot-147`无RGB条件已通过独立检查：conditionId=`earth-reference-v7-v7-capacity-slot-147-37e388ad0aac`，manifest SHA-256=`1a91521338053873e15cd56ecd269b4351bbef2bae7c5c8d47d590d0f1930bb9`。该槽位的逐窗景观事实为`grassland-forest-transition`，与`slot-146`的`forested-low-mountain`分别绑定独立来源、区域连接、WorldFacts、完整地图23通道和两层新颖性证据。两槽均未生成RGB，当前合规训练容量仍为0/64。

## 2026-07-29 新64槽位条件准备已开始

首个新槽位`v7-capacity-slot-146`无RGB条件包已完成并独立检查通过：conditionId=`earth-reference-v7-v7-capacity-slot-146-e4cd4599e751`，manifest SHA-256=`8f6ec17d84afa04404bac0cf18fdcb6ed3fffc70b856105bd0e3ff8ed6004ca4`。该槽位的真实地球来源、独立区域连接、逐窗景观事实、完整地图23通道、`focal_area=0`、来源边界、构图新颖性、hash及SQLite证据已闭合；未生成RGB、未启动GPU。

当前合规RGB训练容量仍为0/64。既有有界数据准备授权允许按顺序构建下一槽位无RGB条件，但任何RGB继续逐张授权，GPU训练仍须等待64张合规样本和全部审计通过。

## 2026-07-29 泰国MVP活动景观范围已批准

项目所有者已批准把首次泰国MVP景观范围收窄到当前Sakaerat/Wang Nam Khiao正式数据包能够证明的7类：`seasonal-evergreen-semi-evergreen-forest`、`dry-dipterocarp-woodland`、`bamboo-grove`、`tropical-forest-glade`、`grassland-forest-transition`、`wet-season-drainage-hollow`、`forested-low-mountain`。原20类目录仍是长期景观目录；其余13类属于未来增强，只有在补充对应真实地区或生态类型的正式来源包并另行获批后才能进入活动训练范围。

64个新槽位已经由各自测量事实与批准的泰国区域生态事实完成逐窗景观派生，禁止按配额硬分类型。最新容量计划SHA-256=`96432fbe01419c28addecf989e9c0d60c71162abd8879980dd00922a8f94c800`；最新窗口计划SHA-256=`4f9dcb79b1ca1c140de2220dc0b43c545e89da0818dbb8d36934f40daf7dd813`。64个窗口、直接指纹与变换规范指纹全部唯一，重叠对=0，split为48/8/4/4。当前合规训练容量仍为0/64。

当前授权只允许按槽构建和独立检查无RGB条件包。每槽须绑定独立真实地球来源、区域连接、WorldFacts、World Director、完整地图任务、正式23通道、主题架构身份和实例细节身份；历史RGB不得成为生成输入，现实精确几何不得直接进入游戏坐标。RGB继续逐张授权，批量RGB和GPU训练仍然阻断。

## 2026-07-29 区域连接事实作用域修正

项目所有者已批准隔离历史40条并从泰国MVP数据包重建64条。隔离证据SHA-256=`c76d7bb4069872a6a73eda5643af17050e3ffd034df4e6c265143c1e7ba75b05`；新容量计划SHA-256=`3613fa77f91fe71e7f4799992d617ef12ed4b72681e7e769ea97425d40a5c5f1`；64窗口计划SHA-256=`28b966105876a2724d4a218a812d76bfc6014d410085de45a0299ae83491c955`。新槽位范围为146至209，split为48/8/4/4，窗口重叠对为0。当前Sakaerat事实包不能证明旧20类中的全部生态类型，逐窗生态身份禁止按配额硬填；必须由项目所有者决定收窄首次MVP类型范围或补充新的泰国多生态来源包。

修订后全历史程序审计已经执行：条件审计runId=`ai-assisted-v7-qualified-condition-topology-audit-2026-07-29T01-18-43-568Z`、SHA-256=`229ec90d07aea110722c24d2141d9ae25527a571f70a314c7acc56165d7adc6b`；RGB诊断runId=`ai-assisted-v7-qualified-topology-diagnosis-2026-07-29T01-19-47-732Z`、SHA-256=`bef7906e1d9c96ed38979c6d31f461c4ac72e87fdfc597d7004c4e23a10ba82f`。修订前40条容量记录通过0条，40条全部缺少正式真实地球来源包、复用`region-0001`具体连接实例、携带旧`home_center`并缺少主题/细节身份。修订前40/64固定为历史统计，当前可训练真值不得继续显示为40；V7 GPU训练失败关闭。

项目所有者确认：`natural-home-large-world-connectivity-v1`是所有区域共同遵守的连接数据结构与合法性契约，不是统一构图模板；`mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`是一个具体运行区域的连接实例，不是V7训练槽位和未来所有玩家世界的默认蓝图。

`region-0001`已经批准的北入南出、东侧相邻/共享水系、南侧道路连接和西侧自然边界继续作为该区域tick 3的不可变事实保留。除非任务明确表达的就是该同一运行区域，否则任何训练槽位、匿名真实地理条件、世界导演、23通道或生成提示都不得继承这些具体方向、端口和空间位置。完整地图所要求的“大世界连接语义”只表示当前区域必须绑定自身合法的RegionGraph、EdgePort、PathGraph、HydrologyGraph与WalkableGraph；不表示所有地图必须在相同边界设置相同道路和水口。

V7每个容量槽位必须绑定独立训练区域身份和由当前槽位事实决定的连接实例。水体是否存在、是否跨区域、流向、边界口、道路入口/出口及其相互位置均不得从`region-0001`复制。无跨区域水系、封闭水体、内部湿地或无主要水体必须保持各自事实，不能被统一改造成北入南出的东侧大河。

独立连接实例不得被解释成孤立地图。所有训练区域必须能作为节点加入同一类地球大世界RegionGraph，并至少具有一组已配对、可追溯、可验证的跨区域通行连接；相邻生态、海拔和存在时的水文关系也必须连续。各区域连接方向与类型可以不同，但不得缺少邻接、使用悬空端口或依靠RGB外观证明连接。

不重复门禁覆盖每一张历史和未来完整地图，不按slot编号建立例外。新条件和新RGB必须分别证明主题架构与实例细节均未复用：前者比较连接拓扑、水文/道路关系、空间与生态分区、边界和阅读层级；后者比较具体轨迹、轮廓、对象实例/对象簇、密度节奏、空隙和过渡。只改变风格以外的少量表面内容仍不得计为新世界。统一游戏视觉语言可以共享，具体世界内容不能共享。

该作用域错误可能影响既有条件包和容量资格。修订前“40/64可信容量”和slot-124无RGB条件继续保留为历史程序证据，但当前训练资格固定为等待连接作用域、主题架构和实例细节三项全历史重审；在逐条确认独立区域身份、独立连接事实、23通道及两层唯一性前，不得生成新RGB或启动V7 GPU训练。

### 长期真实地球数据来源边界

本文件及下级正式规格描述整个长期自主世界，不得把当前泰国MVP实现写成全世界唯一数据源。世界底层事实必须来自对应真实地区的地图与权威地理测量；泰国Sakaerat / Wang Nam Khiao只是当前第一份区域数据包和执行样本。

每次扩展到新国家或地区，必须先建立独立、版本化、可审计的`RealEarthRegionSourcePackage`，绑定真实区域身份与范围，并保存地形、土地覆盖、气候/季节、土壤/湿度、水文、生态和区域连接数据的来源、许可、版本、采集时间、hash及派生链。缺少当前区域数据包时不得用泰国数据、旧区域事实、历史图片或生成器猜测补位。

真实地图和地理测量负责形成WorldFacts及结构条件；外部地图RGB、卫星图、瓦片、照片和历史生成RGB仍不得直接作为正式训练目标或后续生成参考。游戏坐标可以经过正式归一化，但必须保持事实谱系可追溯，且不能把一个地区的事实冒充另一个地区。

#### 作用域矩阵

| 层级 | 当前身份 | 允许内容 | 禁止误解 |
|---|---|---|---|
| 长期产品规则 | 真实地球多区域自主世界 | 不同玩家世界和不同区域分别绑定对应真实地球来源包并连接成大世界 | 不表示当前MVP已经同时建设全球 |
| 当前MVP执行 | 泰国Sakaerat / Wang Nam Khiao首个自然家园区域数据包 | 仅用该包闭合当前地图数据、训练、审核与Runtime链 | 不得把泰国包称为长期全球唯一来源 |
| 后续区域扩展 | 尚未逐区批准 | 项目所有者确定地区后，新建该地区`RealEarthRegionSourcePackage`并完成来源与派生审核 | 不得复用泰国地形、水文、生态和连接事实 |
| 视觉训练 | WorldFacts、World Director、23通道和当前区域RGB配对 | 由真实地图/测量派生事实，再由本地视觉系统生成游戏RGB | 不得直接训练外部地图RGB、卫星图、瓦片或历史生成图 |

权威分工固定为：

- `BUSINESS_SPEC.md`定义为什么长期必须使用真实地球多区域来源，以及泰国仅为MVP。
- `ARCHITECTURE.md`定义`RealEarthRegionSourcePackage`、WorldFacts与RegionGraph的数据流。
- `TRAINING_DATA_AND_SOURCE_POLICY.md`定义来源字段、许可、hash、派生、训练资格和阻断。
- `CURRENT_EXECUTION_GUIDE_20260710.md`定义当前只执行泰国MVP，不自动进入其他地区。

## 2026-07-25 当前MVP容量覆盖决策

项目所有者已批准`owner-approved-v7-mvp-first-training-capacity-64-20260725`：V7首次MVP训练门槛固定为64张独立完整地图，split固定为`48 train / 8 validation / 4 challenge / 4 regression`。原128张与`96/16/8/8`保留为后续正式增强目标，不再阻断首次MVP训练。

程序最新容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-25T05-21-03-494Z`确认：历史记录43条，可信26条，镜像、旋转或共享骨架派生暂停17条，审计失败0条；当前缺口38条，split缺口为`27 / 6 / 2 / 3`，缺口身份固定为`v7-capacity-slot-108`至`v7-capacity-slot-145`。旧连续批次保持停止，不得恢复。

项目所有者已签发有界数据建设授权`owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725`。程序完成窗口规划runId=`earth-geospatial-v7-mvp-window-plan-2026-07-25T06-31-05-371Z`：在已批准的Sakaerat/Wang Nam Khiao测量包内建立49个互不重叠的4:3候选窗口，按38个缺口槽位选择38个，保留11个未使用；独立检查确认38个直接指纹和变换规范指纹全部唯一，选中窗口重叠对为0，3个SQLite artifact与2条中英文程序事件一致。

当前授权只允许程序逐槽构建并检查新的匿名游戏坐标WorldFacts、World Director、完整地图任务和正式23通道；不允许自动出图、批量生成或V7 GPU训练。每槽必须保持`focal_area=0`，不得携带现实/OSM精确几何，不得读取历史RGB，必须通过完整地图范围、来源、hash、非镜像/非共享骨架和SQLite证据检查。任何RGB仍须项目所有者另行明确授权；数据达到64张并通过全部审计后，GPU训练仍须再次单独授权。

首个槽位`v7-capacity-slot-108`已经完成无RGB条件包，runId=`earth-geospatial-v7-slot-condition-v7-capacity-slot-108-2026-07-25T08-29-49-749Z`，conditionId=`earth-reference-v7-v7-capacity-slot-108-0d0cb362aedc`。该train槽位绑定`seasonal-evergreen-semi-evergreen-forest`与`wet_to_dry_transition`，正式23通道、完整地图范围、`focal_area=0`、来源谱系、hash、非真实几何复制、非历史RGB和SQLite独立检查全部通过；35个artifact与2条中英文程序事件已索引。该槽位仍为`complete_map_conditions_ready_rgb_authorization_required`，RGB、GPU、候选、RuntimeFrame和`/world`均为0。

## 1. 唯一当前执行入口

当前世界地图工作的唯一执行入口是：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

当前唯一程序入口是：

```text
npm run run:complete-game-world
```

旧计划、阶段进度表和旧 `live-world` 文档已经删除。当前执行指南之外不得再建立平行计划。

## 2. 文档优先级

| 优先级 | 类型 | 位置 | 权限 |
|---:|---|---|---|
| 0 | 项目所有者明确命令 | 当前任务 | 可以批准、拒绝或调整正式计划 |
| 1 | 智能体入口规则 | `AGENTS.md` | 强制所有新窗口先读取文档权威和当前执行指南 |
| 2 | 整体业务与长期架构 | `docs/BUSINESS_SPEC.md`、`docs/ARCHITECTURE.md` | 定义两大核心业务、长期产品边界和系统关系；不直接决定当前任务下一步 |
| 3 | 当前执行指南 | `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md` | 决定当前状态、阻断和下一步 |
| 4 | 文档治理 | `docs/DOCUMENTATION_POLICY.md`、本文档 | 决定文档分类、时间戳和修改规则 |
| 5 | 正式地图架构 | `docs/game-world-generation/` 的 3 份正式规格 | 定义视觉实现、训练数据来源、审核自动化与存储；不得再按阶段目录拼接平行路线 |
| 6 | 世界视觉数据字典 | `docs/world-visual-data-dictionary/` | 定义小模型、审核器和人工审核共用的视觉事实 |
| 7 | 页面与后台锁定规格 | `docs/ai-painter-progress/` 中的 `*_LOCKED_SPEC*` | 约束控制台和自动保存边界 |
| 8 | 自动化与实施契约 | `docs/ai-painter-progress/` 的自动保存、诊断、后台和模型对齐规格 | 约束程序行为，不决定总路线 |
| 9 | 人格数据技术子系统 | `docs/ziwei/` | 独立维护紫微斗数与相关数据；不参与当前地图执行顺序，但长期必须通过人格映射契约服务 AI 管家 |

### 2.1 AI Painter 正式阅读链

任何窗口处理 AI Painter、原图库、训练数据、完整地图模型或控制台前，必须按下列顺序逐级读取，不得从某个下级目录自行反推总路线：

```text
DOCUMENT_AUTHORITY_INDEX.md
-> BUSINESS_SPEC.md                         [业务目的和产品边界]
-> ARCHITECTURE.md                          [系统关系和统一数据流]
-> CURRENT_EXECUTION_GUIDE_20260710.md      [当前状态、阻断和下一步]
-> 当前任务对应的一份正式规格
   -> AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md   [模型与推理]
   -> TRAINING_DATA_AND_SOURCE_POLICY.md         [原图、样本与数据包]
   -> REVIEW_AUTOMATION_AND_STORAGE_SPEC.md      [审核、自动化与存储]
-> DIRECTORY_STRUCTURE.md                   [代码与数据物理位置]
-> 对应 *_LOCKED_SPEC.md                    [仅在修改页面或后台契约时读取]
```

AI Painter 数据关系固定为：五类原图库是并行视觉知识分类，不是五个执行阶段、五个 Runtime 图层或五个独立模型。合格记录经统一登记进入同一个不可变完整世界数据包，由单一正式完整世界推理入口消费并生成完整地图候选；禁止把分类图片机械拼接成最终地图。

项目身份同时固定为：AI-PET-WORLD 是像素风格自主世界游戏，本地小 AI 是游戏智能核心；AI Painter 只是视觉生产子系统，“画图”只是它服务游戏的一项功能。任何文档或智能体不得把项目简化成 AI 绘图工具，也不得让 AI Painter 取代世界事实、Runtime、世界导演或角色自主系统。

第一版正式视觉契约固定为 2D 高分辨率像素风完整地图：本地正式模型原生画布 `1024×768`，正式候选必须覆盖完整地图并直接生成该分辨率。禁止从 `256×192`、tile、sprite、局部材料或其他低分辨率图放大、拼接得到正式候选；当前仍因数据、checkpoint 和 owner review 阻断。

“完整地图”是业务范围和空间结构契约，不是文件尺寸名称。任何只表现单一河段、单一道路、单一池塘、单一林间空地、单一材质范围或放大局部生态单元的图，即使铺满 `1024×768`，仍固定判定为局部图，不得登记为完整地图 target、自主生成训练原图、正式候选或 RuntimeFrame。完整地图必须由同一任务包同时证明整体入口/出口关系、连续自然通行组织、多个可辨识空间或生态分区、自然边界和大世界连接语义；水体是否出现及其占比只能服从当前世界事实，不得把东南亚生态身份解释成所有地图都以水体为主体。完整地图范围尚不能由机器证明时，生成前必须阻断。

冷启动基础完整地图原图的正式作用固定为建立完整地图视觉知识与计算标准，而不是仅供页面查看，也不是供下一张图直接临摹。程序必须从经审核集合提取并版本化保存镜头/世界尺度、整体构图层次、入口/出口与自然通行关系、空间与生态分区组织、水体分布变化、对象尺寸和密度、像素纹理、色彩、光照及游戏可读性标准。生成请求只能消费该聚合标准的机器数值和文字契约，以及当前世界事实、世界导演和本轮23通道；历史完整地图 RGB 引用继续固定为0。所有合格图共享游戏视觉语言，但不得共享同一河流、道路、区域组合或整体构图模板。

初始自然世界不得提前定义家园选址。固定家园中心、规则中央空地、道路汇聚平台、建筑候选地和施工预留地均不属于当前地图事实；AI Painter 不得自行添加。家园选址与修路由 AI 管家在未来 Runtime 中根据人格、记忆、目标和世界事实自主决定，并在合法 WorldFact 产生后才允许视觉表达。`focal_area` 在初始地图阶段仅作为全零兼容通道保留，不进入可视条件引导。

出图授权固定采用“双条件门禁”：正式当前执行文档明确允许该具体任务，并且项目所有者给出单图命令或有界批次命令。历史批次`owner-authorized-v7-remaining-104-continuous-batch-20260723`已经停止，不再授权任何新RGB。程序不得依据历史槽位、缺口或“继续”自行恢复该批次。范围不明、重复风险、共享骨架风险或局部图风险必须在调用生成算力前阻断。

## 2026-07-24 当前治理覆盖

项目所有者已停止连续出图，并授权执行`owner-authorized-transform-derived-capacity-suspension-and-sakaerat-engineering-pretrain-20260724`。程序审计确认17条已登记容量属于镜像、旋转或共享构图骨架派生；这些历史记录、图片、审核和hash继续不可变保存，但容量资格已由独立重分类证据暂停，不得计入128张正式V7数据包。

当前可信完整地图为26张，正式缺口为102张。最新容量计划runId=`ai-assisted-v7-data-capacity-plan-2026-07-23T23-02-25-228Z`；重分类runId=`ai-assisted-v7-capacity-reclassification-2026-07-23T22-54-14-255Z`，重分类文件SHA-256=`24f126487ccbd353d840b84f07edd6a4cf9646a2bd9a6940b514de1c44d770f2`。

当前MVP新增世界数据的事实锚点固定为`data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json`。它提供泰国Sakaerat / Wang Nam Khiao公开可核验的生态、海拔、水文和季节事实。项目所有者批准的`owner-approved-real-geography-naturalization-route-20260724`允许程序使用有明确许可、版本和来源的高程、土地覆盖、气候与土壤测量派生自然世界事实和自然拓扑，但必须剔除城市、建筑、工程道路、耕地地块与人工水体，并保存来源、hash和全部派生步骤；外部RGB、地图瓦片视觉和现实导航地图仍禁止作为训练图或图片参考。

当前只允许使用26张可信完整地图建立非正式工程预训练数据包并验证本地训练链。该工程预训练不得被称为正式V7训练，不得授予正式推理、候选、RuntimeFrame或`/world`资格，也不得生成新RGB。V7 GPU正式训练仍未授权。

本文档中的分辨率术语固定分为两条且不得混用：正式本地模型 target、正式候选、owner review、Runtime 和 `/world` 的唯一原生画布是 `1024×768`；AI 辅助冷启动来源可按 `owner-approved-high-resolution-four-three-derivative-v1` 保存不小于 `1024×768` 的精确 4:3 原始文件，并由程序生成 nearest-neighbor、无裁切、无放大的 `1024×768` 训练/机器审核派生图。该派生图不具备正式候选、Runtime 或独立训练资格。`256×192 -> 512×384 -> 1024×768` 只描述训练内部渐进分辨率。任何窗口不得把冷启动派生图或训练阶段图解释成正式输出契约。

画法/生成算法与风格契约必须分开理解并同时满足：前者定义世界事实、导演结果、23 通道条件和本地模型如何生成本轮新像素；后者定义所有合格画面共享的视角、世界尺度、对象比例、像素纹理语言、轮廓、光照、接地、遮挡和游戏可读性。季节、湿度、生态类型和对象状态可以改变画面内容与状态色彩，但不得自行改变上述共同视觉语法。

第一版当前世界档案固定为 `mainland-southeast-asia-tropical-monsoon-natural-home-v1`，以东南亚大陆热带季风低地、河谷和丘陵生态为现实参照。机器权威文件为 `mainland-southeast-asia-tropical-monsoon-profile-v1.json`、对应物种目录、`coverage-blueprint.json` 和 `provisional-visual-snapshot-v2.json`。旧温带概念图片、原图库记录和来源副本已按项目所有者命令删除；旧档案定义文件只作迁移说明，不得进入当前训练或自动恢复记录。

第一版自然家园同时是未来类地球大世界中的第一个连接区域，不是孤立图片。大世界连接原则的机器权威为 `natural-home-large-world-connectivity-v1`，位置为 `data/world-samples/world-connectivity/world-connectivity-contract-v1.json`。项目所有者已命令按真实地球条件定义第一版连接，程序据当前东南亚热带季风档案、NASA 快照和湄公河委员会水文/地理事实登记 `mainland-southeast-asia-earth-reference-natural-home-region-0001-v1`；它不复制真实地图几何。Runtime 世界事实迁移已由项目所有者授权并由程序写入 tick 2；项目所有者随后审核通过连接事实，程序写入 tick 3。迁移报告位于 `.runtime/world-connectivity-migrations/latest.json`，审核记录位于 `.runtime/world-connectivity-owner-reviews/latest.json`。连接训练覆盖门槛已批准为27条正样本、27条负样本且9个覆盖轴各不少于3正+3负；程序已自动保存并复核27正/27负，九轴全部达到3正+3负。

## 3. 目录分类

```text
docs/
├─ DOCUMENT_AUTHORITY_INDEX.md              [active-governance]
├─ DOCUMENTATION_POLICY.md                   [active-governance]
├─ game-world-generation/                    [active-architecture]
├─ world-visual-data-dictionary/             [active-reference]
├─ ai-painter-progress/                      [active-locks + automation-contracts]
└─ ziwei/                                    [separate-subsystem / personality-data-input]
```

根目录 `README.md` 只负责当前导航；根目录 `AGENTS.md` 负责强制新智能体窗口遵守上述读取顺序。

## 4. 当前状态

```text
status = blocked
canEnterWorld = false
blockers = owner_review_missing_identity, formal_gate_missing,
           data_gap_insufficient,
           ai_assisted_v7_training_blocked_pending_approved_128_dataset_implementation
```

自有扩散采样器、Autoencoder训练程序和 `strict-project-owned-training-data-v1` IP 门禁已经实现并通过检查。第一版真实地球参照连接蓝图、Runtime迁移及项目所有者审核记录均已写入，当前世界为tick 3。当前v2的21套世界事实、导演、任务包和23通道均已通过结构与完整地图范围门；21/21后置RGB条件配对、27正/27负连接覆盖和九轴各3正+3负均已由程序自动保存并复核。V2至V5训练及验证作为不可变历史保留；V5 challenge验证失败后，项目所有者已授权V6修复。V6 CPU回归、冒烟和Stage 0至Stage 2三级正式渐进训练均已完成。最新Stage 2 runId=`ai-assisted-conditional-denoiser-v6-stage-2-2026-07-21T19-11-57-819Z`，checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，严格继承Stage 1 checkpoint SHA-256=`23593901bd7c9dff385a1c943867b0da1f990b6e8f1fa530359cf5da4062e921`，以原生`1024×768`完成40轮，最佳轮次36、最佳验证指标`2.792788481960694`，固定`formalInferenceEligible=false`。V6单张challenge验证已执行并机器拒绝，V6诊断与V7当前状态以第9节为准；不得重复Stage 2训练，也不得回到旧P10-B3 Chunk路线或局部材料盲训。

AI辅助单图推理验证已经接通验证专用机器审核：生成后必须自动执行VJ-0、VJ-1、VJ-2、版本化风格指纹和构图新颖性审核，保存图片、条件、checkpoint、审核hash、中英文记录和失败学习。验证结果无论机器通过或拒绝都固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`，不得写入原图库或进入`/world`。

旧批次第002号 V4、第005号 V2、第006号 V5及其机器/项目所有者审核继续作为不可变历史证据保存，不得自动重试、递增版本或绑定到当前新条件。当前权威条件身份为 `complete-map-v2-001...021`：生成前蓝图快照保持 `pairedRgbCount=0`，证明没有用历史RGB反推或回绑；后置当前v2配对由独立审核记录和不可变数据包统计，当前严格结果为21/21，未配对数为0。不得从旧版本审核结果推断当前配对完成；历史完整地图图像引用继续固定为0。

## 5. 旧文档清理规则

1. 已被当前正式文档替代的旧计划、旧进度和旧阶段报告必须删除。
2. 不建立历史文档副本，也不允许旧文档重新取得执行权。
3. 训练失败、审核和模型运行证据由程序保存在 `data/` 或 `.runtime/`，不依赖 Markdown 文档保存。
4. 删除文档不得删除程序自动保存的图片、JSON、模型、日志和审核记录。
5. 当前地图下级规格固定为 3 份；不得重新建立 `00-15` 阶段文档树。
6. 世界视觉数据字典的分层条目是机器参考，不属于智能体默认必读集。

## 6. 状态词

| 状态 | 含义 |
|---|---|
| `active-governance` | 当前文档治理依据 |
| `active-architecture` | 当前正式架构和验收依据 |
| `active-reference` | 当前数据字典或标准参考 |
| `active-lock` | 已锁定页面、API 或自动保存边界 |
| `automation-contract` | 自动保存、后台、诊断或训练控制器必须遵守的程序契约 |
| `separate-subsystem` | 独立维护的技术子系统；`docs/ziwei/` 不参与当前地图执行顺序，但其结构化结果属于 AI 管家核心业务输入 |
| `blocked` | 规则有效，但当前条件不足，禁止晋级 |

## 7. 修改规则

所有新增或更新的正式文档必须同时具备：

1. `更新时间：YYYY-MM-DD HH:mm:ss +08:00`。
2. `状态：...`。
3. 固定项目所有者控制句。
4. 明确的数据来源、适用范围和禁止事项。
5. 如改变当前执行顺序，必须同步更新当前执行指南。
6. 页面布局、样式、入口、名称和信息层级属于项目所有者锁定内容；提出需求不等于获得修改授权，必须等待项目所有者明确指令。

## 8. 2026-07-22 V6单图验证最新状态

本节覆盖本文中“等待V6单张challenge验证”的历史描述。项目所有者已授权唯一`challenge`样本`complete-map-v2-014`的V6 held-out单图验证。正式程序生成runId=`ai-assisted-conditional-inference-validation-v6-2026-07-21T20-39-03-363Z`，绑定V6 Stage 2 checkpoint SHA-256=`3a4cfd161c80402664eba35010159913be1ae3dc08c954600d577ddef1f9fbc9`，生成原生`1024×768`图片SHA-256=`6ce37acc6278d5d7bbae6210e8273c634358fc1301936be9d394725fe2cf039e`。

机器审核状态为`machine_rejected`：VJ-0、VJ-1通过，VJ-2以`condition_terrain_path_ground_coverage_mismatch`拒绝，Professional Aesthetic当前通过。程序已自动保存图片、23通道条件、checkpoint、seed、model-report、manifest、machine-review、双语过程事件和D盘SQLite索引；自动失败学习runId=`auto-visual-judge-learning-2026-07-21T20-39-36-899Z`已摄取本轮审核。该图固定`formalCandidate=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`，不能进入原图库、候选、Runtime或`/world`。

该等待诊断门禁已经由第9节取代。V6历史图和机器拒绝结论保持不变，不得覆盖、重绑或重新解释为通过。

## 9. 2026-07-22 V6失败诊断与V7修复最新状态

项目所有者已授权V6失败诊断与修复。程序完成诊断runId=`ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z`，证据位于`.runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v6/ai-assisted-conditional-v6-diagnosis-2026-07-21T21-45-18-698Z/diagnosis.json`。诊断确认V6训练rollout和正式推理都从纯高斯噪声开始，不存在读取target图直接出图的捷径；V6失败根因是训练/验证容量仅`16/2`、checkpoint只评估一个validation样本和一个seed、像素级指标不能可靠代表完整地图语义，以及Professional Aesthetic对单轴纹理异常只记录通过结果而缺少诊断提示。

V7合同固定为`all-validation-multiseed-semantic-rollout-unet-v7`：checkpoint选择必须覆盖全部validation样本、每样本至少2个固定seed，并把最差完整采样轨迹计入分数；训练目标新增道路、水体、岸线、对象占地和焦点区域的对比约束，以及`8×6`空间网格RGB约束。V7不改变世界事实、世界导演、23通道数量与身份、数据来源政策、页面结构或已有审核拒绝门槛。Professional Aesthetic只增加`professional_single_axis_texture_envelope_exceeded_diagnostic`诊断警告，原`minimumMultiscaleViolationCount=4`和历史V6机器审核结论不变。

程序完成最新纯CPU回归runId=`ai-assisted-conditional-v7-cpu-regression-2026-07-22T00-20-01-226Z`，证据位于`.runtime/ai-painter/ai-assisted-conditional-v7-repair-checks/ai-assisted-conditional-v7-cpu-regression-2026-07-22T00-20-01-226Z/report.json`；2个validation样本、每样本2个seed，共4条完整采样轨迹通过数值、梯度、23通道、challenge隔离、容量批准合同和诊断警告回归。本轮没有GPU训练、推理或新RGB。

项目所有者于2026-07-22批准V7验证容量为128张独立完整地图，固定split为`96 train / 16 validation / 8 challenge / 8 regression`。最新审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`确认旧21条基线与3条V7容量贡献合计24/24合格、审计失败0条、正式缺口104条；剩余split固定规划为`77 train / 14 validation / 7 challenge / 6 regression`。任何复制、裁切、轻微变体、只换seed、旧图重绑、局部图或尺寸达标但不具备完整地图语义的图片都不得计数。

V7配置保持`trainingAuthorizationStatus=blocked_pending_approved_128_dataset_implementation`、`formalInferenceEligible=false`。`v7-capacity-slot-001`、`v7-capacity-slot-002`与`v7-capacity-slot-003`均已由正式入口登记容量贡献；最新数据包保持旧21条基线并加入3条V7贡献。剩余104槽已获得有界连续数据批次授权，但批次产物在逐张人工审核前不计入容量。数据包达到128张并通过身份、来源、23通道、完整地图范围、去重和split隔离审计后，仍须项目所有者另行授权V7 GPU训练。

## 10. 2026-07-22 V7容量槽位002单图最新状态

项目所有者已明确授权`v7-capacity-slot-002`唯一一张RGB。正式请求`conditional-rgb-002-2026-07-22T10-50-32-811Z`只使用该槽位的语义条件引导图，不使用历史完整地图RGB；程序自动接收`1448x1086`精确4:3源图，并以nearest-neighbor生成单独的`1024x768`训练/机器审核派生图。源图SHA-256=`96ee07168ba20d700299901a5abe907bb830be8764f5f656f372507ca5582b79`，派生图SHA-256=`d326d6073e91b1a8ba2bcccca5e153281326980b725ef987277b1fdbc75f92e3`。

项目所有者已于2026-07-22明确审核通过该图。程序自动写入owner审核、更新请求状态并登记`v7-capacity-slot-002`的train容量贡献；贡献证据SHA-256=`7f3dcf75cfc5a1804b7d3905afa0f463a4253bff3701f888881673ae8f2725f2`。slot-002闭环时的数据包ID=`natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-22T12-04-59-138Z`，条件绑定完整地图23条、V7贡献2条、未配对0条、阻断0条；当时容量审计runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T12-05-01-665Z`确认23/23合格、失败0、正式缺口105。该图仅取得AI辅助条件训练资格，仍固定`independentTrainingEligible=false`、`formalCandidate=false`、`runtimeFrameEligible=false`；slot-002不得重复生成，后续状态以第13节为准。

## 11. 2026-07-22 V7容量槽位003当前状态

项目所有者已明确授权准备`v7-capacity-slot-003`。程序首先如实保存“旱季配方未实现”和“道路与封闭边界碰撞”两次RGB前失败；随后只修复正式旱季任务配方，没有改变MVP世界档案、完整地图合同、23通道或审核门槛。成功任务runId=`ai-assisted-v7-data-task-v7-capacity-slot-003-2026-07-22T13-27-59-480Z`，身份固定为`train / lowland-evergreen-tropical-forest / dry_season / pairwise_landscape_season_baseline`，环境快照为`mainland-southeast-asia-tropical-monsoon-provisional-late-dry-season-v1`。

独立检查确认`channelCount=23`、`completeMapScopePassed=true`、`pairedRgbCount=0`、32项SQLite artifact及1条中英文程序事件均通过，且没有生成RGB或启动GPU。该段记录任务准备阶段的历史门禁；slot-003后续生成、审核和容量登记已经由第13节闭合。

## 12. 2026-07-23 原图审核按钮授权边界

项目所有者明确授权完整地图原图页面增加单条“通过 / 拒绝”审核按钮。GET页面继续只读；按钮只向正式审核程序提交owner命令，页面不得直接写业务数据。程序负责不可变审核、双时区时间、hash、双语事件、失败学习，并在V7容量槽位通过后自动登记贡献、检查贡献、重建和检查数据包、刷新容量审计。

该授权不包含自动生成容量缺口图片、不包含下一槽位自动准备或GPU训练。slot-003当时仍等待唯一一张RGB；该历史门禁已由第13节闭合。本地小AI继续是自主世界游戏的核心驱动，AI Painter只是把既有世界事实转成视觉的子系统，审核页面不得反向创造世界事实。

## 13. 2026-07-23 V7容量槽位003闭环状态

项目所有者已通过控制台审核slot-003。程序修正了审核服务遗漏V7槽位身份的问题，并使用原owner命令引用完成容量贡献登记、贡献检查、数据包重建与检查以及容量计划刷新。贡献runId=`ai-assisted-v7-capacity-contribution-v7-capacity-slot-003-2026-07-22T21-02-11-194Z`；最新容量计划runId=`ai-assisted-v7-data-capacity-plan-2026-07-22T21-04-46-042Z`确认24/24合格、正式缺口104条。当前不得自动准备`slot-004`、生成新RGB或启动V7 GPU训练。

## 14. 2026-07-24 可信26图非正式工程预训练完成状态

项目所有者授权的26图非正式工程预训练已经完成。不可变数据包ID=`ai-assisted-v7-engineering-pretraining-trusted-26-2026-07-23T23-45-32-454Z`，manifest SHA-256=`06b706d208607cf74a6436f53b3f5b2ed395fdece6a3319dc9bb0f2b5fc46586`，split固定为`21 train / 2 validation / 1 challenge / 2 regression`。数据包只使用21张当前`complete-map-v2`条件配对完整地图和V7槽位`001/002/003/033/034`，明确排除17条变换派生记录；为遵守初始自然世界自主性契约，程序只在数据包内部提供统一全零`focal_area`兼容通道，没有重写任何历史记录。

正式训练控制器完成runId=`ai-assisted-conditional-denoiser-v7-engineering-26-stage-0-2026-07-23T23-51-23-450Z`：在CUDA上以`256x192`完成6轮工程预训练，最佳轮次6、最佳验证指标=`3.538672380770246`、持续`53.495`秒。checkpoint SHA-256=`bc65e68936ce851142c94b2be65ced528f44a874361e39e02d31406c3419d382`。程序已自动保存6项训练产物、2条中英文事件、逐轮指标、数据/算法证据和D盘SQLite索引，并完成物理文件字节数与SHA-256复核。

本轮生成RGB为0，固定`trainingMode=nonformal_engineering_pretraining`、`formalV7TrainingAuthorized=false`、`formalInferenceEligible=false`、`runtimeFrameEligible=false`、`canEnterWorld=false`。它不能增加正式容量，当前可信容量仍为26、正式缺口仍为102。未经项目所有者新的单独授权，不得执行held-out RGB验证、恢复批量出图、启动正式V7训练、建立候选、RuntimeFrame或进入`/world`。
## 2026-07-29 slot-185条件已通过

conditionId=`earth-reference-v7-v7-capacity-slot-185-b3329fcce28b`，SHA-256=`63acc8a01ccae9fe45e0d171c464f1851bdbf10fbfcb82172e829ace58685462`。条件包40/64，还差24个。
