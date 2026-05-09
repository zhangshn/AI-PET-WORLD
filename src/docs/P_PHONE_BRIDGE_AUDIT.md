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
