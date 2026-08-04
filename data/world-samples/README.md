# World Samples 正式样本目录

更新时间：2026-08-03 09:23:45 +08:00

状态：active-world-samples-directory-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

正式入口：

```text
data/world-samples/registry/<dictionaryVersion>/
data/world-samples/dataset-packages/<packageId>/
```

第一版家园原始视觉来源固定进入：

```text
data/world-samples/original-image-library/natural-home-v1/
```

该目录按完整地图、地形、植物、自然物品和过渡分层，每条原图使用独立 `record.json` 与 `source/` 文件。原图库是来源接收层，不替代 `registry/` 正式登记；页面只能读取，不能替程序创建记录。

原图接收和检查固定命令：

```text
npm run build:original-image-intake-template
npm run intake:original-image -- --request <request.json>
npm run check:original-image-library
```

`positive/`、`negative/`、`rejected/`、`pending/` 和历史路由目录只保留已有证据，不再作为正式样本计数入口。

正式登记命令：

```text
npm run register:complete-map-training-sample -- --request <registration-request.json>
```

程序自动复制留存图片、计算 SHA-256、写入时间戳和不可变记录。声明独立训练资格的请求还必须通过 `strict-project-owned-training-data-v1`，提供原创源文件、权利人、完整全球商业与训练权、第三方内容禁用声明、权属证据及其 hash。来源、许可、人工审核、IP审核、标签、任务身份和 split 必须由请求明确提供，程序不得补造。

`npm run build:project-owned-sample-intake-template` 生成绑定任务与23通道的待填写模板；模板不是正式样本。完成原创 RGB、机器审核、Owner视觉审核和IP审核后，登记程序才能接收该请求。

数据包命令：

```text
npm run build:current-complete-map-dataset-package
npm run check:current-complete-map-dataset-package
```
