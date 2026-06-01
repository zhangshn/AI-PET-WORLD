# AI-PET-WORLD V2.6｜像素视觉算法与 Recipe 工作流

> 本文档用于锁定 AI-PET-WORLD 正式像素世界 UI 的视觉算法工作流。
>
> 本文档优先级高于临时实现口径。后续所有 `/world` 视觉恢复、正式画图算法、Debug 页面扩展、素材算法设计，都必须先参考本文档。

---

## 1. 核心结论

AI-PET-WORLD 的正式像素世界不是手写一张图，也不是在 `/world` 里临时拼 placeholder。

正式方向是：

```txt
Debug 单体视觉算法测试
→ Debug 场景组合测试
→ Formal Recipe 固化
→ Formal Renderer 接入
→ /world 使用真实世界数据组合显示
```

也就是说：

```txt
/world-debug/pixel-visual-lab
= 正式视觉算法测试台

/world
= 使用真实 runtime / WorldViewModel 数据，调用已验证 recipe 的正式主世界
```

禁止出现：

```txt
Debug 里一套好看的算法
/world 里另写一套临时破图
```

---

## 2. Debug 页面的正式定位

`/world-debug/pixel-visual-lab` 不是玩具页面，不是假场景页面，不是可有可无的测试页。

它的正式定位是：

```txt
视觉素材算法测试台
视觉 recipe 验收台
场景组合算法验证台
```

它用于测试：

```txt
树怎么画
地面怎么画
痕迹怎么画
石头怎么画
灌木怎么画
花草怎么画
蘑菇怎么画
建设物怎么画
氛围怎么画
人物后续怎么画
场景怎么组合
```

Debug 页面里的视觉结果不是最终正式页面，但 Debug 中验证通过的算法，必须能被抽成 formal recipe 进入正式 renderer。

---

## 3. 正式 `/world` 的定位

`/world` 不是视觉算法试验场。

`/world` 只做：

```txt
runtime save
→ WorldViewModel
→ FormalPixelRenderModel
→ formal recipes
→ FormalPixelSvgView / future PixiJS
```

`/world` 不允许：

```txt
临时写 tree = 几个 rect
临时写 ground = 大色块
临时写 actor = 小方块人
临时写 object placeholder
绕过 Debug 视觉算法
直接读 Debug 页面代码
直接写 runtime
推进 Tick
生成默认宠物
生成世界事实
```

`/world` 必须只使用已经验证过的 formal recipe。

---

## 4. 正确制作顺序

所有视觉内容必须按这个顺序推进：

```txt
1. Debug 单体设计
2. Debug 参数调试
3. Debug 场景组合预览
4. 形成 formal recipe
5. 接入 formal renderer
6. 接入 /world
7. smoke 锁定不可退回 placeholder
```

禁止顺序：

```txt
先在 /world 随便画
再回头说以后优化
```

---

## 5. 单体算法先于场景组合

AI-PET-WORLD 的像素世界必须先把每个视觉内容的算法分开设计好，再组合。

正确结构：

```txt
visual recipes
├─ ground recipe
├─ trace recipe
├─ tree recipe
├─ bush recipe
├─ stone recipe
├─ flower recipe
├─ mushroom recipe
├─ construction recipe
├─ facility recipe
├─ atmosphere recipe
└─ actor recipe（后置）

scene composition
├─ layer order
├─ y-sort
├─ density
├─ viewport
├─ scale
└─ final output
```

原则：

```txt
单体算法分开
视觉语言统一
组合规则统一
```

---

## 6. 第一阶段优先级：先画世界，不做人

当前阶段暂停人物 / 管家像素设计。

当前优先级是先把世界本体画出来：

```txt
1. Ground / Tile
2. Trace
3. Tree
4. Bush
5. Stone
6. Flower / grass detail
7. Mushroom / small ecology
8. Construction / facility placeholder
9. Atmosphere
10. Scene composition / viewport
```

人物 / Butler Actor 后置。

人物后续必须单独做 Debug 设计，不允许继续使用小方块人作为正式口径。

---

## 7. Debug 页面应包含的区域

`/world-debug/pixel-visual-lab` 后续应逐步扩展为：

```txt
/world-debug/pixel-visual-lab

├─ 单体设计
│  ├─ Ground / Tile 绘制
│  ├─ Trace 绘制
│  ├─ Tree 绘制
│  ├─ Bush 绘制
│  ├─ Stone 绘制
│  ├─ Flower / Grass 绘制
│  ├─ Mushroom 绘制
│  ├─ Construction 绘制
│  ├─ Atmosphere 绘制
│  └─ Actor / Butler 绘制（后置）
│
├─ 场景组合
│  ├─ Forest scene
│  ├─ Initial home scene
│  ├─ Trace path scene
│  ├─ Recovery growth scene
│  ├─ Construction scene
│  └─ Future town scene
│
└─ 算法输出摘要
   ├─ recipe id
   ├─ 参数
   ├─ seed
   ├─ 是否可进入 formal renderer
   └─ 对应 formal recipe 文件
```

---

## 8. 每个 recipe 的验收标准

每个 recipe 必须满足：

```txt
可由参数驱动
可稳定复现
使用 stable seed
不使用 Math.random 直接决定正式画面
不写 runtime
不生成世界事实
不读取 Debug 页面 runtime
不生成默认宠物
可被 smoke 检查 recipe marker
```

每个 recipe 必须有 marker，例如：

```txt
formal_ground_recipe
formal_tree_recipe_v1
formal_trace_recipe_v1
formal_bush_recipe_v1
formal_stone_recipe_v1
```

smoke 必须检查 marker，防止退回 placeholder。

---

## 9. 当前已开始的 recipe

当前已开始：

```txt
formal_tree_recipe_v1
formal_ground_recipe
```

但视觉上仍需要以 Debug 测试台为准继续调试。

当前这些 recipe 不代表最终美术完成，只代表正式 recipe 链路已经开始建立。

---

## 10. 后续每次执行前必须做的事

后续每次动代码前，必须先输出：

```txt
1. 当前进度表
2. 本轮目标
3. 本轮参考文档
4. 本轮不做什么
5. 本轮要改哪些文件
```

必须先参考：

```txt
docs/v2_6/AI_PET_WORLD_V2_6_MODULE_PROGRESS.md
docs/v2_6/AI_PET_WORLD_V2_6_PIXEL_VISUAL_RECIPE_WORKFLOW.md
```

禁止不打印进度表直接动代码。

---

## 11. 一句话原则

```txt
先在 Debug 里把每个视觉内容画对。
再把画对的算法抽成 formal recipe。
最后 /world 只组合真实世界数据和已验证 recipe。
```
