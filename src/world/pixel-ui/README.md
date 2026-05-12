# AI-PET-WORLD Pixel UI System

当前目录负责：定义 AI-PET-WORLD 像素 UI / 像素世界的分层、对象、资产、组合、风格映射与渲染接入规范。

## 最高原则

AI-PET-WORLD 不是文字游戏，也不是固定图片地图。

它是一个由紫微斗数 / 八字、管家人格、宠物状态、世界阶段共同驱动的 AI 像素生命世界。

正确路线：

```txt
先分层
再定义每层对象
再拆对象部件
再定义组合规则
再接紫微 / 八字风格
再用低保真代码像素块验证
最后替换正式 UI / 美术素材
```

## 当前业务逻辑固定

```txt
孵化仓不要了。
没有孵化仓。
没有胚胎。
没有孵化。
没有 hatch 业务概念。

小镇里有宠物领养中心。
管家会自己去小镇宠物领养中心报名领养。
报名后，领养中心 / 系统审核与分配。
宠物被送达玩家家园。
宠物抵达家园的那一刻，是它与这个世界建立关系的命格时刻。
```

## 目录结构规划

```txt
src/world/pixel-ui/
├─ README.md
├─ layers/
│  ├─ visual-layer-schema.ts
│  ├─ visual-layer-registry.ts
│  └─ visual-layer-gateway.ts
├─ objects/
│  ├─ world-object-schema.ts
│  ├─ world-object-registry.ts
│  └─ world-object-gateway.ts
├─ assets/
│  ├─ asset-part-schema.ts
│  ├─ asset-part-registry.ts
│  └─ asset-part-gateway.ts
├─ compositions/
│  ├─ composition-schema.ts
│  ├─ composition-registry.ts
│  └─ composition-gateway.ts
├─ styles/
│  ├─ ziwei-visual-style-schema.ts
│  ├─ ziwei-visual-style-mapper.ts
│  └─ ziwei-visual-style-gateway.ts
├─ runtime/
│  ├─ visual-state-schema.ts
│  ├─ visual-state-builder.ts
│  └─ visual-state-gateway.ts
└─ renderers/
   ├─ low-fi/
   │  ├─ low-fi-renderer-schema.ts
   │  └─ low-fi-renderer-gateway.ts
   └─ pixi/
      └─ pixi-layer-binding.ts
```

## 开发顺序

| 顺序 | 阶段 | 目录 | 目标 | 状态 |
|---:|---|---|---|---:|
| UI-00 | 目录与总规则 | `src/world/pixel-ui/README.md` | 固定目录结构、边界、开发顺序 | 当前完成 |
| UI-01 | 世界视觉层级 | `layers/` | 地面层、草地层、树木层、建筑层、角色层、特效层等总分层 | 下一步 |
| UI-02 | 世界对象层 | `objects/` | 每一层里有哪些世界对象 | 未开始 |
| UI-03 | 资产部件层 | `assets/` | 草地、树木、房子、眼睛、鼻子、嘴巴、四肢等细颗粒拆分 | 未开始 |
| UI-04 | 组合规则层 | `compositions/` | 部件如何组合成草地、树、房子、管家、宠物、领养中心 | 未开始 |
| UI-05 | 紫微视觉风格层 | `styles/` | 紫微 / 八字风格如何影响部件选择、颜色倾向、布局倾向 | 未开始 |
| UI-06 | 世界状态视觉驱动 | `runtime/` | 时间、天气、宠物状态、管家任务如何影响画面 | 未开始 |
| UI-07 | 低保真渲染层 | `renderers/low-fi/` | 用代码像素块验证分层和组合逻辑 | 未开始 |
| UI-08 | Pixi 图层绑定 | `renderers/pixi/` | 接入当前 Pixi 舞台图层 | 未开始 |
| UI-09 | 正式 UI / 美术素材 | 后续资源目录 | 正式像素素材、角色帧、房屋图块、P-Phone UI | 最后做 |

## 世界视觉总分层

后续 `layers/` 必须按这个顺序定义，不允许先跳到部件或正式美术。

```txt
01. 地面基础层：土地、泥地、石地、水边、边界地形
02. 草地层：草皮、小草、草丛、花、杂草、踩踏痕迹
03. 树木 / 自然层：树干、树冠、树叶、树影、石头、落叶
04. 路径层：土路、石路、家园路、小镇路、脚印路线
05. 建筑基础层：地基、平台、围栏底座、庭院底座
06. 建筑主体层：房子墙体、屋顶、门、窗、领养中心主体
07. 建筑细节层：灯、招牌、门把手、窗光、花盆、柜台
08. 家具 / 设施层：食物碗、水盆、宠物床、储物箱、观察点
09. 角色阴影层：管家影子、宠物影子、移动落点
10. 角色身体层：管家身体、宠物身体
11. 角色细节层：眼睛、鼻子、嘴巴、耳朵、尾巴、衣服、工具
12. 角色动作层：走路、观察、建设、休息、吃饭、等待、报名领养
13. 情绪 / 状态特效层：光点、困倦泡泡、警觉符号、抵达光效
14. 交互反馈层：点击涟漪、可观察提示、入口提示、抵达点提示
15. 时间 / 天气 / 氛围层：白天、夜晚、灯光、天气、温暖 / 安静氛围
16. 开发审计层：F3，只服务开发，不属于正式玩家 UI
```

## 玩家家园内部层级

```txt
家园地面层
家园草地层
家园树木层
家园路径层
家园建筑底层
家园建筑主体层
家园建筑细节层
家园设施层
家园角色层
家园特效层
```

## 小镇 / 领养中心内部层级

```txt
小镇地面层
小镇草地层
小镇树木层
小镇道路层
小镇建筑层
领养中心建筑层
领养中心细节层
小镇服务层：报名点、等待区、宠物送达点
小镇角色层：管家前往小镇的状态表现
小镇特效层：报名提示、等待提示、送达提示
```

## 资产拆分原则

后续 `assets/` 不允许只粗略写成 `pet_actor`、`butler_actor`、`home_shelter`。

必须按细颗粒拆分：

```txt
草地就是草地
草尖就是草尖
树干就是树干
树冠就是树冠
树叶就是树叶
眼睛就是眼睛
鼻子就是鼻子
嘴巴就是嘴巴
耳朵就是耳朵
尾巴就是尾巴
衣服就是衣服
工具就是工具
门把手就是门把手
窗光就是窗光
```

然后再通过 `compositions/` 组合成：

```txt
草地
树
房子
管家
宠物
小镇领养中心
家园设施
交互反馈
```

## 禁止事项

```txt
不允许把孵化仓放进 Pixel UI 业务对象层。
不允许出现孵化仓、胚胎、孵化、hatch 作为产品 UI 对象。
不允许跳过 layers 直接写资产部件。
不允许跳过低保真直接做正式 UI / 美术素材。
不允许用大段文字面板替代像素表现。
不允许把 F3 开发审计当成正式玩家 UI。
```

## 旧目录说明

`src/world/pixel-world/` 目录中已经存在的文件属于前一轮试验性质的像素系统草稿。

在新的 `src/world/pixel-ui/` 目录稳定之前，暂不删除旧文件，避免影响当前构建。

后续会单独执行：

```txt
CLEANUP-PIXEL-OLD：清理或迁移旧 pixel-world 草稿文件
```
