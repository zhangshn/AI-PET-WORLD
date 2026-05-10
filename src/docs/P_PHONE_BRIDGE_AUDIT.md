# P-Phone Bridge Audit

当前文件负责：记录 P-Phone bridge 阶段的接入边界。

本阶段只新增 mapper，不接正式 P-Phone。

---

## 1. 当前阶段目标

当前阶段只建立：

```txt
ButlerMessageDeliveryDecision
↓
buildPPhoneButlerDeliveryPreview
↓
PPhoneMessageItem | null
```

这个 mapper 只把已经通过 message delivery boundary 的管家消息判断转换为 P-Phone 预览结构。

当前不写入正式消息线程，不生成 AiMessage，不改变 P-Phone UI。

---

## 2. 新增文件

当前新增：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryMapper.ts`

当前导出：

- `BuildPPhoneButlerDeliveryPreviewInput`
- `buildPPhoneButlerDeliveryPreview`

---

## 3. Mapper 输入边界

输入来源必须是：

- `ButlerMessageDeliveryDecision | null`
- 管家展示名 `butlerName`

mapper 只接受 delivery boundary 的结果，不直接读取：

- `WorldEvent`
- 系统日志
- 宠物状态事件
- 管家内部判断模块
- P-Phone policy 内部状态

---

## 4. Mapper 输出边界

当且仅当满足以下条件时，mapper 才返回 `PPhoneMessageItem`：

```txt
delivery exists
↓
delivery.canEnterDeliveryQueue === true
↓
delivery.draftText exists
↓
PPhoneMessageItem
```

否则返回 `null`。

返回的 `PPhoneMessageItem` 只用于预览或未来 bridge 审计，不代表已经发送。

---

## 5. 当前不接入内容

当前不做：

- 不接正式 P-Phone thread
- 不生成短信
- 不记录 AiMessage
- 不写 message delivery queue
- 不改 `pPhoneMessageMappers.ts`
- 不改 `pPhoneMessagePolicy.ts`
- 不改 P-Phone UI
- 不把 WorldEvent 转短信
- 不把系统日志转成管家消息

---

## 6. 后续接入顺序

后续建议按以下顺序推进：

1. 保持当前 mapper 独立。
2. 在 F3 / bridge 审计面板中预览 mapper 输出。
3. 建立正式 message delivery queue。
4. 只允许 delivery boundary 放行的消息进入 queue。
5. queue 再生成持久化 AiMessage。
6. P-Phone 继续只展示持久化消息。
7. 逐步移除旧的事件转短信入口。

---

## 7. 禁止事项

- 禁止在 mapper 中调用 `buildButlerMessageDecision`。
- 禁止在 mapper 中调用 `buildButlerMessageDeliveryDecision`。
- 禁止在 mapper 中读取 WorldEvent 并生成短信。
- 禁止在 mapper 中写 AiMessage。
- 禁止在 mapper 中接入 P-Phone 正式 thread。
- 禁止把 `draftText` 当成已发送消息。
- 禁止跳过 delivery boundary 直接生成 P-Phone 消息。

## 8. P-PHONE-BRIDGE-2 当前状态

当前已经新增 F3 bridge preview 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneBridgePreviewPanel.tsx`

当前展示：

- previewId
- sender
- senderName
- timeLabel
- text

边界原则：

- 只展示 preview
- 不接正式 P-Phone
- 不写 AiMessage
- 不替换旧事件逻辑

## 9. P-PHONE-BRIDGE-3 当前状态

当前已经新增未来 delivery queue 的临时队列项 builder：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryQueue.ts`

当前链路：

```txt
ButlerMessageDeliveryDecision
↓
buildPPhoneButlerDeliveryPreview
↓
buildPPhoneButlerDeliveryQueueItem
↓
PPhoneButlerDeliveryQueueItem | null
```

当前 queue item 只来自 delivery preview。

当前不做：

- 不持久化
- 不写 AiMessage
- 不接正式 P-Phone thread
- 不生成短信
- 不把事件自动转短信
- 不把系统日志转成管家消息

## 10. P-PHONE-BRIDGE-4 当前状态

当前已经新增 F3 delivery queue 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneDeliveryQueueDebugPanel.tsx`

当前展示：

- queueId
- source
- status
- decisionReason
- priority
- createdAtTick
- checkedAtTick
- messageText
- tags

当前状态：

- queue item 仍是 `preview_only`
- 不会写入 AiMessage
- 不会出现在正式 P-Phone
- 只用于 F3 / bridge 审计和未来 delivery queue 接入前验证

## 11. P-PHONE-DELIVERY-1 当前状态

当前已经新增未来正式 delivery queue item builder：

- `buildPPhoneButlerFutureDeliveryQueueItem`
- `PPhoneButlerFutureDeliveryQueueItem`

当前链路：

```txt
ButlerMessageDeliveryDecision
↓
buildPPhoneButlerDeliveryPreview
↓
buildPPhoneButlerDeliveryQueueItem
↓
buildPPhoneButlerFutureDeliveryQueueItem
↓
PPhoneButlerFutureDeliveryQueueItem | null
```

当前 future delivery queue item 只是数据边界。

当前不做：

- 不持久化
- 不写 AiMessage
- 不生成真实短信
- 不接正式 P-Phone thread

## 12. P-PHONE-DELIVERY-2 当前状态

当前已经新增 AiMessage record input builder：

- `src/app/world/ui/phone/messages/pPhoneButlerAiMessageRecordBuilder.ts`
- `buildPPhoneButlerAiMessageRecordInput`

当前链路：

```txt
PPhoneButlerFutureDeliveryQueueItem
↓
buildPPhoneButlerAiMessageRecordInput
↓
CreateAiMessageRecordInput | null
```

当前只构造 `CreateAiMessageRecordInput`。

当前不做：

- 不调用 `recordAiMessage`
- 不调用 `recordAiMessageOnce`
- 不写入 AiMessage
- 不进入正式 P-Phone thread

## 13. P-PHONE-DELIVERY-3 当前状态

当前已经新增 F3 AiMessage record preview 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneAiMessageRecordPreviewPanel.tsx`

当前展示：

- id
- source
- entityType
- entityId
- importance
- userVisibleChannel
- messageId
- messageChannel
- triggerReason
- sourceEventId
- messageText
- tags

该面板只展示未来可能写入 AiMessage 的输入内容。

## 14. P-PHONE-DELIVERY-4 当前状态

当前已经完成 P-Phone delivery bridge 的第二批基础建设文档固化。

当前整体链路：

```txt
ButlerMessageDeliveryDecision
↓
P-Phone bridge preview
↓
preview_only queue item
↓
future_delivery_ready queue item
↓
CreateAiMessageRecordInput preview
```

当前仍然不接正式 P-Phone，不写 AiMessage，不把事件自动转短信。

## 15. P-PHONE-DELIVERY-5 当前状态

当前已经新增受控写入开关类型：

- `PPhoneButlerDeliveryWriteControl`
- `PPhoneButlerDeliveryWriteMode`
- `PPhoneButlerDeliveryWriteResult`
- `createDisabledPPhoneButlerDeliveryWriteControl`
- `createManualAuditPPhoneButlerDeliveryWriteControl`
- `createEnabledPPhoneButlerDeliveryWriteControl`

默认状态是：

```txt
disabled
↓
no write
↓
preview only
```

当前文件：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryWriterTypes.ts`

当前只定义写入边界，不写 AiMessage。

## 16. P-PHONE-DELIVERY-6 当前状态

当前已经新增受控 manual writer：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryWriter.ts`
- `writePPhoneButlerDeliveryMessageOnce`

写入条件必须是：

```txt
recordInput exists
↓
control.mode === "enabled"
↓
recordAiMessageOnce
```

默认业务链路不调用该 writer。

当前不做：

- 不自动写 AiMessage
- 不在 worldEngine 中触发写入
- 不在 butlerSystem 中触发写入
- 不在 React render 中触发写入
- 不接正式 P-Phone thread

## 17. P-PHONE-DELIVERY-7 当前状态

当前已经新增 writer result 类型，用于区分写入边界结果：

- `disabled`
- `manual_audit_only`
- `missing_record_input`
- `blocked`
- `written`
- `skipped_duplicate`

这些状态只描述 writer 边界的结果，不代表 UI 可以自动发送消息。

默认 F3 审计面板只展示 `disabled` preview。

## 18. P-PHONE-DELIVERY-8 当前状态

当前已经新增 F3 manual writer 审计面板：

- `src/app/world/components/butler-debug/ButlerPPhoneDeliveryWriterAuditPanel.tsx`

当前展示：

- status
- canWrite
- didWrite
- messageId
- recordId
- reason
- tags

当前面板：

- 不提供按钮
- 不调用 `recordAiMessageOnce`
- 不写 AiMessage
- 只展示 disabled preview

## 19. P-PHONE-DELIVERY-9 当前状态

当前已经新增 P-Phone read-only integration preview：

- `src/app/world/ui/phone/messages/pPhoneButlerRecordPreviewMapper.ts`
- `src/app/world/components/butler-debug/ButlerPPhoneReadonlyIntegrationPreviewPanel.tsx`

当前链路：

```txt
CreateAiMessageRecordInput
↓
buildPPhoneButlerRecordPreviewMessage
↓
PPhoneMessageItem | null
```

当前只把 record input 转成 P-Phone 只读预览消息。

当前不接正式 P-Phone thread，不写 AiMessage。

## 20. P-PHONE-DELIVERY-10 当前状态

当前已经完成 P-Phone delivery 第三批基础建设文档固化。

当前整体链路：

```txt
ButlerMessageDeliveryDecision
↓
delivery preview
↓
future delivery queue item
↓
CreateAiMessageRecordInput
↓
writer disabled preview
↓
read-only P-Phone integration preview
```

当前仍然不做：

- 不自动写 AiMessage
- 不生成真实短信
- 不替换正式 P-Phone thread
- 不把事件自动转短信
- 不把系统日志转成管家消息

## 21. P-PHONE-DELIVERY-11 当前状态

当前已经修复 manual writer 的重复写入判断。

当前写入顺序：

```txt
recordInput
↓
control.mode === "enabled"
↓
find existing AiMessage by messageId
↓
existing → skipped_duplicate
↓
not existing → recordAiMessageOnce
```

当前 duplicate 判断发生在写入前。

这样可以避免先写入再判断重复造成的边界混乱。

## 22. P-PHONE-DELIVERY-12 当前状态

当前已经新增 persisted readback mapper：

- `src/app/world/ui/phone/messages/pPhoneButlerDeliveryReadback.ts`
- `buildPPhoneButlerDeliveryReadback`

当前链路：

```txt
CreateAiMessageRecordInput
↓
getAiDataRecords({ kind: "message" })
↓
find by messageId
↓
PPhoneButlerDeliveryReadbackResult
```

该 mapper 只读取持久化记录，不写 AiMessage，不接正式 P-Phone thread。

## 23. P-PHONE-DELIVERY-13 当前状态

当前已经新增 F3 手动写入面板：

- `src/app/world/components/butler-debug/ButlerPPhoneManualDeliveryWritePanel.tsx`

当前行为：

- 只有点击按钮时才调用 `writePPhoneButlerDeliveryMessageOnce`
- 点击时使用显式 `enabled` control
- 写入结果保存在组件 `useState`
- 写入后触发 readback 面板刷新

当前不做：

- 不自动写入
- 不在 React render 中写入
- 不替换正式 P-Phone thread
- 不让 UI 自动发送消息

## 24. P-PHONE-DELIVERY-14 当前状态

当前已经新增 F3 persisted readback 面板：

- `src/app/world/components/butler-debug/ButlerPPhoneDeliveryReadbackPanel.tsx`

当前展示：

- found
- messageId
- recordId
- reason
- P-Phone preview
- tags

该面板用于验证手动写入后，AiMessage 是否能被持久化读取链路读到。

它不替换正式 P-Phone thread。

## 25. P-PHONE-DELIVERY-15 当前状态

当前已经完成 P-Phone delivery 第四批基础建设：

- 写入前 messageId 去重
- 开发限定手动写入按钮
- 持久化 readback mapper
- F3 手动写入结果审计
- F3 持久化读取验证

当前允许：

- 开发面板点击按钮时显式 enabled 写入 AiMessage
- 写入后通过 `getAiDataRecords` 读取验证

当前仍然禁止：

- 不自动写 AiMessage
- 不在 worldEngine 中触发写入
- 不在 butlerSystem 中触发写入
- 不在 React render 中触发写入
- 不替换正式 P-Phone thread
- 不把事件自动转短信
- 不把系统日志转成管家消息

## 26. P-PHONE-INTEGRATION-BATCH-5 当前状态

当前已经开始正式 P-Phone butler thread 接入。

本轮完成：

- delivery-generated persisted butler message 优先显示
- 普通 persisted butler message 次级显示
- 旧 message-policy butler message 降级
- 旧 WorldEvent → butler message 仅作为 fallback
- World Notice 保持原样
- fallback butler status message 不再写入 AiMessage

当前仍然不做：

- 不自动写 AiMessage
- 不删除旧 event policy
- 不关闭 World Notice
- 不让 P-Phone UI 决定管家是否联系玩家
- 不新增 F3 面板

## 27. P-PHONE-MIGRATION-BATCH-6 当前状态

当前已经降级旧 WorldEvent → butler message 逻辑。

本轮完成：

- 新增 `ENABLE_LEGACY_BUTLER_EVENT_MESSAGES = false`
- 默认关闭 `pet_hatched / offline_catchup / dual_agent_interaction` 自动生成管家短信
- 旧 event policy 不再写入 butler AiMessage
- World Notice 保持事件来源
- World Notice 仍可写入 AiMessage

当前边界：

- 新管家短信必须来自 message delivery 链路
- 旧 WorldEvent 不再自动变成管家短信
- World Notice 暂时保留
- 不新增 F3 面板
- 不改变宠物行为
- 不改变 worldEngine 调度
