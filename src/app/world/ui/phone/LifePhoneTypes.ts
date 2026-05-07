/**
 * 当前文件负责：提供 Life Phone 正式 UI 共享类型与状态文案。
 */

import type { PhoneModuleCard } from "../../utils/phoneModuleMappers"

export type LifePhoneModuleId = PhoneModuleCard["id"]

export function getLifePhoneStatusLabel(
  status: PhoneModuleCard["status"]
): string {
  if (status === "active") return "活跃"
  if (status === "warning") return "注意"
  if (status === "quiet") return "安静"
  if (status === "locked") return "未开放"

  return "正常"
}