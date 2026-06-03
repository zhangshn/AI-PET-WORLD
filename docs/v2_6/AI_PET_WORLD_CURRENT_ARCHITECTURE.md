# AI-PET-WORLD 当前架构

## 业务主链

```txt
注册与出生信息
-> 紫微斗数 / 生命人格核心
-> 管家灵魂与长期人格
-> 世界创建
-> 世界规则运行
-> 管家自主决策
-> 建设、记忆、痕迹、时间线与 P-Phone 沟通
```

## 正式世界写入边界

正式世界变化只能来自规则验证后的运行链：

```txt
管家感知
-> 自主意图
-> 建设或世界变化候选
-> SafeApply
-> HomeMapState / Runtime Save
```

页面和渲染器不得写入世界事实。

## Runtime 主线

当前正式持久化结构是 `WorldRuntimeSaveRecord`。它保存：

- `HomeMapState`
- 管家正式人格快照
- 管家运行时 profile
- 最近事件
- 最近管家决策、意图与规则验证
- 痕迹、记忆种子与 trace influence

后续 tick 必须读取 save record 内保存的管家人格，不得在 tick 内用默认生日重新构造人格。

## 正式画面

```txt
WorldRuntimeSaveRecord
-> WorldViewModel
-> PixelWorldView
-> Pixel Buffer
-> PixiJS
```

`/world` 是只读表现入口。它不推进 tick，不创建未规划生命体，不绕过规则写入状态。没有存档时，正式页应提示用户先创建世界。

## 开发入口

- `/world`：正式只读 PixiJS 世界。
- `/create-world`：创建世界入口。
- `/world-debug/pixel-visual-lab`：对象级像素配方实验室。
- `/world-debug/pixel-worldview-preview`：PixelWorldView 数据预览。
