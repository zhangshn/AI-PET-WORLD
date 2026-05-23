> Status: must follow V2.0 FormalVisualModel First. Assets and UI may express world facts, but must not generate world facts.

# app/world Architecture

`src/app/world` 属于第 10 层：展示 / 交互层。

`/world` 是正式玩家体验页面，只展示管家、宠物、家园和世界运行结果。`/personality-test` 才能显示底层命理调试。

`/world` 不允许展示紫微、八字、星曜、宫位、流年等底层术语。展示层可以呈现生命气质、状态、关系、家园变化和世界反馈，但不能把命理核心的调试字段直接暴露给正式体验。

P-Phone 是管家可能主动联系玩家的入口，不是系统日志查看器。P-Phone 消息不应由事件日志自动转短信，而应来自管家自主判断后的可能联系。

UI 层不得写核心 AI 逻辑、世界运行逻辑、管家消息判断逻辑、宠物学习逻辑、管家教育规则或命理算法细节。`src/app/world` 只能调用 gateway、展示结果并接收玩家互动影响。
