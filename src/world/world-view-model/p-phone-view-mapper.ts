import type { WorldRuntimeEventLog, WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"

import type { WorldViewModel } from "./world-view-model-schema"

export function buildPPhoneView(input: {
  saveRecord: WorldRuntimeSaveRecord
}): WorldViewModel["pPhone"] {
  const latestEvent =
    input.saveRecord.recentEvents[input.saveRecord.recentEvents.length - 1]

  if (!latestEvent) {
    return {
      unreadCount: 0,
      latestMessageTitle: "世界记录",
      latestMessageBody: "世界正在等待下一次明确的运行推进。",
    }
  }

  return {
    unreadCount: 1,
    latestMessageTitle: localizeEventTitle(latestEvent),
    latestMessageBody: localizeEventBody(latestEvent),
  }
}

function localizeEventTitle(event: WorldRuntimeEventLog): string {
  if (event.title === "World runtime continued") return "世界继续运行"
  if (event.title.toLowerCase().includes("butler")) return "管家更新了判断"
  if (event.title.toLowerCase().includes("trace")) return "世界留下了新的痕迹"

  return event.title || "世界记录"
}

function localizeEventBody(event: WorldRuntimeEventLog): string {
  if (
    event.body.includes("resources insufficient") ||
    event.body.includes("waited without forcing")
  ) {
    return "管家判断当前资源不足，因此暂时等待，没有强行改变家园。"
  }

  if (event.body.includes("trace") || event.body.includes("Trace")) {
    return "世界运行后，部分区域的痕迹状态被继续观察和沉淀。"
  }

  if (event.body.includes("construction")) {
    return "管家重新评估了建设节奏，并等待规则允许后的下一步。"
  }

  if (event.body.includes("Audit")) {
    return "世界完成了一次运行记录，管家保持谨慎观察。"
  }

  return event.body || "世界继续保持可观察状态。"
}
