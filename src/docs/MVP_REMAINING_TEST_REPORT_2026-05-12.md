# AI-PET-WORLD MVP 剩余项补测报告

当前文件负责：记录第一轮 MVP 测试后剩余可自动 / 半自动补测项的执行结果。

测试日期：2026-05-12  
测试项目：`F:\ai-pet-world`  
测试入口：`http://localhost:3000/world`  
测试方式：浏览器自动化、10 分钟页面长跑、点击压力、存档边界、离线补算边界、截图留证。

---

## 1. 总结

本轮补测完成了大部分可以由后台自动完成的用例，但发现 2 个需要处理或确认的业务问题。

| 类别 | 结果 |
| --- | --- |
| 页面 10 分钟长跑 | PASS |
| 宠物出生 | PASS |
| 宠物出生后保存 / 刷新恢复 | PASS |
| 管家状态与行为执行快照 | PASS |
| 点击 / 连续点击稳定性 | PASS |
| 进出室内 10 次压力 | PASS |
| 连续刷新 5 次 | PASS |
| 坏 JSON 存档 fallback | PASS |
| version=999 坏版本存档 fallback | PASS |
| 离线补算边界 | PASS |
| Console 红错 | PASS |
| 孵化器出生后状态 | FAIL / 待修 |
| 家园成长推进 | FAIL / 待修 |

---

## 2. 发现的问题

### BUG-MVP-001：宠物出生后孵化器仍保留 `hasEmbryo: true`

关联用例：

- `M3-006` 出生后孵化器状态
- `M9-003` 宠物恢复

实际结果：

```txt
pet exists: true
incubator.status: hatched
incubator.progress: 100
incubator.hasEmbryo: true
```

证据：

- [pet-restore-check.json](test-artifacts/mvp-remaining-2026-05-12/pet-restore-check.json)
- [02_pet_birth_check.png](test-artifacts/mvp-remaining-2026-05-12/02_pet_birth_check.png)

判断：宠物已经出生并可恢复，但孵化器仍显示 `hasEmbryo: true`。如果产品定义是“hatched 后保留胚胎名作为历史记录”，可以改字段语义；如果不是，则应在 hatch 后清理 embryo active 状态。

### BUG-MVP-002：10 分钟运行后家园进度仍为 0

关联用例：

- `M5-003` 管家建设家园
- `M6-002` 临时住所成长
- `M6-003` 正式住所阶段
- `M6-004` 花园阶段
- `E2E-004` 管家自主管理

实际结果：

```txt
longRunMs: 600000
tickDelta: 309
home.progress: 0
home.constructionStage: temporary_shelter
home.lifecycle: incubator_care_phase
top homeGoal: stabilize_incubator
```

10 分钟样本中，管家出现过：

```txt
watching_incubator
watching_pet
offering_rest
offering_approach
offering_food
```

但没有观察到家园建设推进，`home.progress` 一直是 0。

证据：

- [remaining-test-results.json](test-artifacts/mvp-remaining-2026-05-12/remaining-test-results.json)
- [03_after_10_min_long_run.png](test-artifacts/mvp-remaining-2026-05-12/03_after_10_min_long_run.png)

判断：世界稳定运行，但家园成长链路没有进入建设推进。该问题会阻塞花园阶段、花园点击、后续空间成长和完整 E2E。

---

## 3. 已补测通过项

| 用例范围 | 结果 | 证据 |
| --- | --- | --- |
| `M1-001` 新用户初始化 | PASS | `01_new_user_initial.png` |
| `M3-005` 宠物出生 | PASS | tick 7 出生，等待约 15.5 秒 |
| `M4-002` 宠物基础状态 | PASS | action / mood / energy / hunger 有效 |
| `M5-001` 管家基础状态 | PASS | task / mood / latestBehaviorExecution 有效 |
| `M8-001 ~ M8-008` 点击稳定性 | PASS | 入口、出口、孵化器区域、空地、20 次连续点击无红错 |
| `M9-007` 坏 JSON 存档 | PASS | 页面 fallback，不白屏 |
| `M9-008` 坏版本存档 | PASS | `version=999` 后恢复为 v1 |
| `M10-001` 短离线不补算 | PASS | 1 分钟离线 tickDelta 0 |
| `M10-002` 2-30 分钟补算 | PASS | 10 分钟离线补算 2 tick |
| `M10-003` 30 分钟-6 小时补算 | PASS | 2 小时离线补算 6 tick |
| `M10-004` 6-24 小时补算 | PASS | 12 小时离线补算 24 tick |
| `M10-005` 超过 24 小时上限 | PASS | 3 天离线补算 48 tick |
| `M10-006` 补算后再次刷新 | PASS | 不重复无限补算 |
| `M13-001` 10 分钟长跑 | PASS | tickDelta 309，无 console error |
| `M13-002` 连续刷新 5 次 | PASS | tick 连续：313 → 317 |
| `M13-003` 进出室内压力 | PASS | 10 次入口 / 出口点击无红错 |
| `M13-004` 连续点击压力 | PASS | 20 次连续点击无红错 |
| `M13-005` 坏存档压力基础 | PASS | 坏 JSON 和坏版本均 fallback |

---

## 4. 离线补算边界结果

| 离线时长 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| 1 分钟 | 不补算 | tickDelta 0，无 offline event | PASS |
| 10 分钟 | 2 tick | tickDelta 2，有 offline event | PASS |
| 2 小时 | 6 tick | tickDelta 6，有 offline event | PASS |
| 12 小时 | 24 tick | tickDelta 24，有 offline event | PASS |
| 3 天 | 48 tick | tickDelta 48，有 offline event | PASS |

补算后再次刷新：

```txt
firstTick: 324
secondTick: 325
```

判断：没有重复无限补算；第二次刷新只出现正常页面运行 tick。

---

## 5. 10 分钟长跑样本

长跑时间：`600000ms`  
tick 增量：`309`  
采样数：`20`  
Console errors：`0`

观察到的宠物状态：

```txt
action: observing / resting / idle
mood: normal / curious
energy: 59–83
hunger: 22–58
```

观察到的管家状态：

```txt
task: watching_incubator / watching_pet / offering_rest / offering_approach / offering_food
mood: focused / calm / gentle
behaviorKind: incubator_watch / care_opportunity_support
```

观察到的家园状态：

```txt
progress: 0
constructionStage: temporary_shelter
lifecycle: incubator_care_phase
```

结论：运行稳定，宠物和管家状态有效；但家园建设没有推进。

---

## 6. 肉眼验收截图

截图目录：`src/docs/test-artifacts/mvp-remaining-2026-05-12/`

| 文件 | 说明 |
| --- | --- |
| [01_new_user_initial.png](test-artifacts/mvp-remaining-2026-05-12/01_new_user_initial.png) | 新用户首屏 |
| [02_pet_birth_check.png](test-artifacts/mvp-remaining-2026-05-12/02_pet_birth_check.png) | 宠物出生后画面 |
| [03_after_10_min_long_run.png](test-artifacts/mvp-remaining-2026-05-12/03_after_10_min_long_run.png) | 10 分钟长跑后画面 |
| [04_f3_after_long_run.png](test-artifacts/mvp-remaining-2026-05-12/04_f3_after_long_run.png) | 长跑后 F3 MVP Check |
| [05_click_before.png](test-artifacts/mvp-remaining-2026-05-12/05_click_before.png) | 点击测试前 |
| [06_after_shelter_entry_click.png](test-artifacts/mvp-remaining-2026-05-12/06_after_shelter_entry_click.png) | 入口点击后 |
| [07_after_shelter_exit_click.png](test-artifacts/mvp-remaining-2026-05-12/07_after_shelter_exit_click.png) | 出口点击后 |
| [08_after_incubator_click.png](test-artifacts/mvp-remaining-2026-05-12/08_after_incubator_click.png) | 孵化器区域点击后 |
| [09_after_empty_click.png](test-artifacts/mvp-remaining-2026-05-12/09_after_empty_click.png) | 空地点击后 |
| [10_after_20_clicks.png](test-artifacts/mvp-remaining-2026-05-12/10_after_20_clicks.png) | 连续点击后 |
| [11_after_5_refreshes.png](test-artifacts/mvp-remaining-2026-05-12/11_after_5_refreshes.png) | 连续刷新后 |
| [12_bad_version_recovered.png](test-artifacts/mvp-remaining-2026-05-12/12_bad_version_recovered.png) | 坏版本存档恢复后 |
| [13_after_10_enter_exit_cycles.png](test-artifacts/mvp-remaining-2026-05-12/13_after_10_enter_exit_cycles.png) | 进出室内 10 次后 |

---

## 7. 仍需人工或修复后复测

以下项本轮无法算通过：

- `M3-006`：孵化器出生后状态，因为 `hasEmbryo` 仍为 true。
- `M5-003`：建设家园，因为 10 分钟未观察到建设推进。
- `M6-002 ~ M6-004`：临时住所成长、正式住所阶段、花园阶段，受家园 progress=0 阻塞。
- `M8-004`：花园点击，当前自然运行未进入 garden/completed，花园焦点未启用。
- `E2E-004`：管家自主管理完整闭环，家园建设分支未跑通。
- `E2E-008`：完整 MVP 验收闭环，需要在上述问题修复后复测。

以下项需要人工肉眼确认体验质量：

- 点击反馈是否足够明显。
- 宠物 / 管家运动是否“像活物 / 管理者”，而不是只从状态字段判断。
- 主舞台像素世界是否满足最终审美预期。

---

## 8. 结论

当前 MVP 技术稳定性比第一轮覆盖更完整：

```txt
新用户进入
↓
宠物出生
↓
10 分钟页面稳定运行
↓
点击与压力操作
↓
保存 / 恢复 / 坏存档
↓
离线补算边界
```

但在业务闭环上仍有两个需要优先处理的问题：

```txt
宠物出生后 incubator.hasEmbryo 仍为 true
家园 progress 10 分钟仍为 0，建设/花园链路无法继续验收
```

建议优先修复这两个问题，再复测 `M3-006`、`M5-003`、`M6-002~004`、`M8-004` 和完整 `E2E-008`。
