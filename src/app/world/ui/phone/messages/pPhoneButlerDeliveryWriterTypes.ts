/**
 * 当前文件负责：定义管家 P-Phone delivery 受控写入边界类型。
 *
 * 注意：
 * 这里不写 AiMessage。
 * 这里只定义 writer 输入、开关与结果类型。
 */

import type {
  CreateAiMessageRecordInput,
} from "@/ai/data-core/ai-data-gateway"

export type PPhoneButlerDeliveryWriteMode =
  | "disabled"
  | "manual_audit_only"
  | "enabled"

export type PPhoneButlerDeliveryWriteControl = {
  mode: PPhoneButlerDeliveryWriteMode
  reason: string
}

export type PPhoneButlerDeliveryWriteStatus =
  | "disabled"
  | "manual_audit_only"
  | "missing_record_input"
  | "blocked"
  | "written"
  | "skipped_duplicate"

export type PPhoneButlerDeliveryWriteResult = {
  status: PPhoneButlerDeliveryWriteStatus
  canWrite: boolean
  didWrite: boolean
  messageId: string | null
  recordId: string | null
  reason: string
  tags: string[]
}

export type BuildPPhoneButlerDeliveryWritePreviewInput = {
  recordInput: CreateAiMessageRecordInput | null
  control: PPhoneButlerDeliveryWriteControl
}

export function createDisabledPPhoneButlerDeliveryWriteControl(
  reason = "当前处于开发审计阶段，禁止自动写入 AiMessage。"
): PPhoneButlerDeliveryWriteControl {
  return {
    mode: "disabled",
    reason,
  }
}

export function createManualAuditPPhoneButlerDeliveryWriteControl(
  reason = "当前只允许手动审计，不允许自动写入 AiMessage。"
): PPhoneButlerDeliveryWriteControl {
  return {
    mode: "manual_audit_only",
    reason,
  }
}

export function createEnabledPPhoneButlerDeliveryWriteControl(
  reason = "显式允许本次写入。"
): PPhoneButlerDeliveryWriteControl {
  return {
    mode: "enabled",
    reason,
  }
}

export function buildPPhoneButlerDeliveryWritePreview(
  input: BuildPPhoneButlerDeliveryWritePreviewInput
): PPhoneButlerDeliveryWriteResult {
  if (!input.recordInput) {
    return {
      status: "missing_record_input",
      canWrite: false,
      didWrite: false,
      messageId: null,
      recordId: null,
      reason: "当前没有可写入的 AiMessage record input。",
      tags: ["p-phone-delivery-writer", "missing-record-input"],
    }
  }

  if (input.control.mode === "disabled") {
    return {
      status: "disabled",
      canWrite: false,
      didWrite: false,
      messageId: input.recordInput.messageId,
      recordId: input.recordInput.id ?? null,
      reason: input.control.reason,
      tags: [
        "p-phone-delivery-writer",
        "disabled",
        "no-write",
        ...input.recordInput.tags,
      ],
    }
  }

  if (input.control.mode === "manual_audit_only") {
    return {
      status: "manual_audit_only",
      canWrite: false,
      didWrite: false,
      messageId: input.recordInput.messageId,
      recordId: input.recordInput.id ?? null,
      reason: input.control.reason,
      tags: [
        "p-phone-delivery-writer",
        "manual-audit-only",
        "no-write",
        ...input.recordInput.tags,
      ],
    }
  }

  return {
    status: "blocked",
    canWrite: true,
    didWrite: false,
    messageId: input.recordInput.messageId,
    recordId: input.recordInput.id ?? null,
    reason:
      "写入开关已启用，但当前函数只负责 preview，不执行真实写入。",
    tags: [
      "p-phone-delivery-writer",
      "enabled-preview-only",
      ...input.recordInput.tags,
    ],
  }
}
