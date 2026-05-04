/**
 * 当前文件负责：提供手机 Mock 组件共享类型与轻量状态文案。
 */

import type { PhoneModuleCard } from "../../utils/phoneModuleMappers"

export type PhoneMockModuleId = PhoneModuleCard["id"]

export function getPhoneMockStatusLabel(
  status: PhoneModuleCard["status"]
): string {
  if (status === "active") return "活跃"
  if (status === "warning") return "注意"
  if (status === "quiet") return "安静"
  if (status === "locked") return "未开放"

  return "正常"
}