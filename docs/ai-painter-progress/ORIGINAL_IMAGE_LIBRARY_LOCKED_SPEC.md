# AI Painter 原图资料库页面锁定规格

更新时间：2026-07-12 17:02:07 +08:00

状态：active-lock / 第一版家园原图目录与三级只读页面已定义

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 页面身份

| 层级 | 固定入口 | 职责 |
|---|---|---|
| 一级 | `/ai-painter-progress/original-images` | 展示第一版家园原图库分类和真实记录统计 |
| 二级 | `/ai-painter-progress/original-images/<categoryId>` | 展示所选分类下程序已经保存的原图记录 |
| 三级 | `/ai-painter-progress/original-images/<categoryId>/<recordId>` | 展示单条原图、原始路径、来源、状态、绑定和审核信息 |

页面是只读资料库。GET 页面不得创建目录、复制图片、生成清单、修改时间或补造训练记录。

页面固定为三级信息架构，文件目录可以具有更多语义深度。二级分类页必须展示该分类的完整物理目录规则，并对植物分类展示 `plantKind -> speciesId -> lifeStage -> season -> recordId` 及当前现实物种目录；三级页仍只对应单条真实记录。URL 不机械复制每一个文件夹层级，但页面显示的相对路径和目录顺序必须与接收程序完全一致。

所有原图从现在开始必须在控制台展示，不是后期功能。接收程序成功保存原图后必须原子更新 `index.json`；控制台通过轻量事件流监听索引变化并自动刷新，不需要项目所有者或 Codex 手工刷新、归档或补写。二级分类页必须直接展示该分类全部真实记录的图片缩略图、状态、尺寸和路径，三级页展示完整图片与全部来源、权属、分类和审核数据。事件流只监听索引文件变化，不得循环扫描训练目录或发送完整训练台账。

## 2. 正式目录

```text
data/world-samples/original-image-library/
└─ natural-home-v1/
   ├─ library.json
   ├─ index.json                 [程序自动维护，页面只读]
   ├─ parallel-visual-knowledge-catalog-v1.json
   ├─ complete-maps/
   │  └─ <recordId>/
   ├─ terrain/
   │  └─ <terrainType>/<stateId>/<recordId>/
   ├─ vegetation/
   │  └─ <plantKind>/<speciesId>/<lifeStage>/<season>/<recordId>/
   ├─ natural-objects/
   │  └─ <objectKind>/<stateId>/<recordId>/
   └─ transitions/
      └─ <transitionKind>/<recordId>/
```

每条记录目录固定使用：

```text
<recordId>/
├─ record.json
├─ source/<original-file>
├─ layers/       [可选，原创分层源文件]
├─ conditions/   [可选，结构条件与 Mask]
├─ rights/       [可选但独立训练资格必须具备权属证据]
└─ reviews/      [可选，机器、人工和 IP 审核]
```

`record.json` 必须符合 `data/world-samples/schemas/original-image-record-v1.schema.json`。目录可以按植物或物品状态继续分层，但页面必须保留并显示真实相对路径，不得重命名。

## 3. 数据边界

1. 本目录保存原始视觉来源，不替代正式样本登记和不可变数据包。
2. 通过来源、视觉、机器、owner 和 IP 审核后，程序才可通过正式登记入口复制留存到 `data/world-samples/registry/`。
3. 历史 `data/ai-painter-datasets/**/source-originals` 主要包含旧局部裁片，不自动迁入本目录，也不自动取得独立训练资格。
4. OpenAI 或其他第三方生成模型输出必须如实标记，按当前来源政策固定不能成为独立训练样本。
5. 页面没有显示的记录不能由页面补造；必须由原图接收或登记程序自动写入。

## 4. 固定分类

| categoryId | 页面名称 | 当前范围 |
|---|---|---|
| `complete-maps` | 完整地图原图 | 完整自然家园视觉 |
| `terrain` | 地形原图 | 草地、道路、水体、水岸和土壤 |
| `vegetation` | 植物原图 | 植物种类、生命周期、季节和健康状态 |
| `natural-objects` | 自然物品原图 | 石头等当前允许自然物品 |
| `transitions` | 过渡与接地原图 | 地形过渡、对象接地和遮挡 |

人物、AI 管家、宠物、动物、昆虫、建筑和施工不进入第一版家园原图库。

### 4.1 分类不是阶段

五个分类同时属于一个原图库，彼此是并行的数据组织维度，不是“地形训练 -> 植物训练 -> 对象训练 -> 过渡训练 -> 完整地图训练”的阶段流程。页面卡片顺序只用于固定导航，不表示优先级、完成顺序、模型数量或 Runtime 图层顺序。

分类目录保存的是视觉知识来源和证据：语义分类原图可以包含完整环境上下文；完整地图原图负责全局构图和统一性。程序不得从各目录选择图片进行机械拼接。所有合格记录必须经正式登记和统一数据包构建后，由完整世界模型体系消费。

## 5. 页面显示字段

一级显示分类数、原图记录总数、可用于训练数和阻断数。二级显示原始记录名、真实目录、状态、更新时间和图片尺寸。三级显示原图、SHA-256、来源方法、权利人、第三方内容标记、世界绑定、分类状态和审核状态。

页面不执行审核、不改变训练资格、不晋级 RuntimeFrame，也不把任何原图直接送入 `/world`。

## 6. 程序自动接收入口

```text
npm run build:original-image-intake-template
npm run intake:original-image -- --request <original-image-intake-request-v1.json>
npm run check:original-image-library
```

接收程序必须验证分类、来源声明、图片解码和分类字段，复制原图与证据文件，计算 SHA-256，写入不可变 `record.json`，再原子更新 `index.json`。完整地图原图当前固定校验为 `1024×768`。任何接收失败必须自动写入 `.runtime/ai-painter/original-image-intake-rejections/`，不得留下半写目录或虚假索引。

`build:original-image-intake-template` 必须一次生成五类并行接收模板和统一 `manifest.json`，不能只生成 `complete-maps` 模板。五类模板必须绑定同一个字典版本、生态档案、临时环境快照和并行知识目录；模板顺序仅用于 manifest 稳定显示，不表示接收或训练顺序。

原图接收成功只代表 `intake`。第三方内容、第三方生成模型、复制既有作品或不明来源自动标记 `blocked`；无论哪一种状态，均不能绕过后续机器审核、owner 审核、IP 审核和正式样本登记。
