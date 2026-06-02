# AI-PET-WORLD 当前架构

## 业务主链

```txt
注册与出生信息
→ 紫微斗数人格映射
→ 管家灵魂与长期倾向
→ 世界创建
→ 世界规则运行
→ 管家自主决策
→ 建设、记忆、痕迹、时间线与 P-Phone 沟通
```

## 世界写入边界

正式世界变化只能来自规则验证后的运行链：

```txt
管家感知
→ 自主意图
→ 建设或世界变化候选
→ SafeApply
→ HomeMapState / Runtime Save
```

页面和渲染器不得写入世界事实。

## 正式画面

```txt
WorldRuntimeSaveRecord
→ WorldViewModel
→ PixelWorldView
→ Pixel Buffer
→ PixiJS
```

`/world` 是只读表现入口。它不推进 Tick，不创建默认宠物，不绕过规则写入状态。

## 当前开发入口

- `/world`：正式只读 PixiJS 世界。
- `/world-debug/pixel-visual-lab`：对象级像素配方实验室。
- `/world-debug/pixel-worldview-preview`：PixelWorldView 数据预览。
