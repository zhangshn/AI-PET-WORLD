/**
 * 当前文件负责：整理 P-Phone 联系人数据。
 */

import type { WorldHudBundle } from "../../../utils/worldHudMappers"
import type { PPhoneContactId } from "../PPhoneTypes"

export type PPhoneContact = {
  id: PPhoneContactId
  name: string
  role: string
  description: string
}

export function buildPPhoneContacts(hud: WorldHudBundle): PPhoneContact[] {
  return [
    {
      id: "butler",
      name: hud.butler.name,
      role: "管家",
      description: "环境维护、状态观察、机会提供者。",
    },
    {
      id: "world-notice",
      name: "World Notice",
      role: "世界通知",
      description: "只记录重大的世界建设、生态变化与阶段事件。",
    },
  ]
}