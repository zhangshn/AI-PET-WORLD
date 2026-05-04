/**
 * 当前文件负责：整理未来手机观察模块所需的日志数据。
 */

import type { WorldEvent } from "@/types/event"

import {
  buildLatestWorldObservationViewModels,
  type WorldObservationViewModel,
} from "./worldObservationMappers"

export type PhoneObservationLogItem = {
  id: string
  category: string
  timeLabel: string
  focus: string | null
  title: string
  summary: string
  detail: string
  previewText: string
}

export type PhoneObservationGroup = {
  groupLabel: string
  items: PhoneObservationLogItem[]
}

export type PhoneObservationModuleData = {
  moduleTitle: string
  moduleSubtitle: string
  latestTitle: string
  latestSummary: string
  unreadCount: number
  totalCount: number
  groups: PhoneObservationGroup[]
}

function toPhoneObservationLogItem(
  item: WorldObservationViewModel
): PhoneObservationLogItem {
  return {
    id: item.id,
    category: item.category,
    timeLabel: item.timeLabel,
    focus: item.focus,
    title: item.title,
    summary: item.summary,
    detail: item.detail,
    previewText: item.focus
      ? `${item.focus} · ${item.title}：${item.summary}`
      : `${item.title}：${item.summary}`,
  }
}

function getGroupLabel(timeLabel: string): string {
  const [dayPart] = timeLabel.split("·")
  const normalizedDay = dayPart.trim()

  return normalizedDay || "未知日期"
}

function groupPhoneObservationItems(
  items: PhoneObservationLogItem[]
): PhoneObservationGroup[] {
  const groupMap = new Map<string, PhoneObservationLogItem[]>()

  for (const item of items) {
    const groupLabel = getGroupLabel(item.timeLabel)
    const existing = groupMap.get(groupLabel) ?? []

    existing.push(item)
    groupMap.set(groupLabel, existing)
  }

  return Array.from(groupMap.entries()).map(([groupLabel, groupItems]) => ({
    groupLabel,
    items: groupItems,
  }))
}

export function buildPhoneObservationModuleData(
  events: WorldEvent[],
  limit = 20
): PhoneObservationModuleData {
  const items = buildLatestWorldObservationViewModels(events, limit).map(
    toPhoneObservationLogItem
  )

  const latest = items[0]

  return {
    moduleTitle: "观察记录",
    moduleSubtitle: "世界正在自动记录生命反应",
    latestTitle: latest?.title ?? "暂无记录",
    latestSummary: latest?.previewText ?? "世界暂时很安静。",
    unreadCount: items.length,
    totalCount: items.length,
    groups: groupPhoneObservationItems(items),
  }
}