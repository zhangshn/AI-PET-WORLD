import type {
  WorldRuntimeEventLog,
  WorldRuntimeSaveRecord,
} from "@/world/runtime/world-runtime-schema"

import type { WorldViewModel } from "./world-view-model-schema"

export function buildPPhoneView(input: {
  saveRecord: WorldRuntimeSaveRecord
}): WorldViewModel["pPhone"] {
  const latestEvent =
    input.saveRecord.recentEvents[input.saveRecord.recentEvents.length - 1]
  const summary = input.saveRecord.lastButlerRuntimeAuditSummary

  if (summary) {
    return {
      unreadCount: 1,
      latestMessageTitle: buildSummaryTitle(summary.intentKind),
      latestMessageBody: buildSummaryMessage({ saveRecord: input.saveRecord }),
    }
  }

  if (!latestEvent) {
    return {
      unreadCount: 0,
      latestMessageTitle: "世界记录",
      latestMessageBody: "世界正在等待下一次明确的运行推进。",
    }
  }

  return {
    unreadCount: 1,
    latestMessageTitle: localizeEventTitle({
      event: latestEvent,
      saveRecord: input.saveRecord,
    }),
    latestMessageBody: localizeEventBody({
      event: latestEvent,
      saveRecord: input.saveRecord,
    }),
  }
}

function buildSummaryTitle(intentKind: string): string {
  if (intentKind === "resource_wait") return "管家留下了等待痕迹"
  if (intentKind === "observation") return "管家记录了一次观察"
  if (intentKind === "maintenance") return "管家完成了一次维护判断"
  if (intentKind === "construction") return "管家完成了一次建设判断"

  return "管家留下了新的行动记录"
}

function buildSummaryMessage(input: {
  saveRecord: WorldRuntimeSaveRecord
}): string {
  const summary = input.saveRecord.lastButlerRuntimeAuditSummary

  if (!summary) return "世界正在整理本轮管家记录。"

  const validationText =
    summary.validationStatus === "passed"
      ? "这次行动已经通过世界规则验证。"
      : "这次行动被世界规则拦下，没有写入新的世界事实。"
  const writeText = buildHomeWriteText(summary.homeMapWriteStatus)
  const traceText = summary.traceId
    ? `本轮痕迹类型：${traceTypeToText(summary.traceType ?? "")}。`
    : "本轮没有找到可公开展示的新痕迹。"
  const memoryText =
    summary.memorySeedCount > 0
      ? `当前可参考的记忆种子：${summary.memorySeedCount} 条。`
      : "当前还没有稳定记忆种子。"

  return `${validationText}${writeText}${traceText}${memoryText}`
}

function buildHomeWriteText(homeMapWriteStatus: string): string {
  if (homeMapWriteStatus === "not_requested") {
    return "管家没有强行改写家园事实，只把经过验证的行为沉淀为痕迹。"
  }

  if (homeMapWriteStatus === "safe_apply_written") {
    return "本轮有家园变化通过正式写入边界，已经进入世界记录。"
  }

  if (homeMapWriteStatus === "safe_apply_no_diff") {
    return "本轮保留正式写入边界，但没有新的家园变化进入世界记录。"
  }

  return "本轮家园变化被世界规则拦下，没有写入。"
}

function localizeEventTitle(input: {
  event: WorldRuntimeEventLog
  saveRecord: WorldRuntimeSaveRecord
}): string {
  const intent = input.saveRecord.lastButlerRuntimeIntent

  if (input.event.tags.includes("butler_trace_closure")) {
    if (intent?.kind === "resource_wait") return "管家留下了等待痕迹"
    if (intent?.kind === "observation") return "管家记录了一次观察"
    if (intent?.kind === "maintenance") return "管家完成了一次维护判断"
    if (intent?.kind === "construction") return "管家完成了一次建设判断"

    return "管家留下了新的行动记录"
  }

  if (input.event.title === "世界继续运行") return "世界继续运行"
  if (input.event.title.toLowerCase().includes("butler")) return "管家更新了判断"
  if (input.event.title.toLowerCase().includes("trace")) return "世界留下了新的痕迹"

  return input.event.title || "世界记录"
}

function localizeEventBody(input: {
  event: WorldRuntimeEventLog
  saveRecord: WorldRuntimeSaveRecord
}): string {
  const intent = input.saveRecord.lastButlerRuntimeIntent
  const validation = input.saveRecord.lastButlerWorldRuleValidation
  const trace = findCurrentButlerTrace(input.saveRecord)
  const memorySeedCount =
    input.saveRecord.traceMemorySeedField?.summary.totalSeeds ?? 0

  if (input.event.tags.includes("butler_trace_closure") && intent && validation) {
    const validationText = validation.ok
      ? "这次行动已经通过世界规则验证。"
      : "这次行动被世界规则拦下，没有写入新的世界事实。"
    const homeMapText =
      intent.kind === "resource_wait" || intent.kind === "observation"
        ? "管家没有强行改写家园事实，只把经过验证的行为沉淀为痕迹。"
        : "如果要改变家园结构，仍然必须通过正式写入边界。"
    const traceText = trace
      ? `本轮痕迹类型：${traceTypeToText(trace.type)}。`
      : "本轮没有找到可公开展示的新痕迹。"
    const memoryText =
      memorySeedCount > 0
        ? `当前可参考的记忆种子：${memorySeedCount} 条。`
        : "当前还没有稳定记忆种子。"

    return `${validationText}${homeMapText}${traceText}${memoryText}`
  }

  if (input.event.body.includes("资源不足")) {
    return "管家判断当前资源不足，因此暂时等待，没有强行改变家园。"
  }

  if (input.event.body.includes("痕迹")) {
    return "世界运行后，部分区域的痕迹状态被继续观察和沉淀。"
  }

  if (input.event.body.includes("建设")) {
    return "管家重新评估了建设节奏，并等待规则允许后的下一步。"
  }

  return input.event.body || "世界继续保持可观察状态。"
}

function findCurrentButlerTrace(saveRecord: WorldRuntimeSaveRecord) {
  const intent = saveRecord.lastButlerRuntimeIntent
  const validation = saveRecord.lastButlerWorldRuleValidation

  return saveRecord.traceField?.traces.find(
    (trace) =>
      trace.sourceKind === "butler_behavior" &&
      trace.updatedAtTick === saveRecord.tick &&
      trace.tags.includes("butler_trace_closure") &&
      trace.tags.includes("not_pet_trace") &&
      (!intent || trace.derivedFrom.includes(intent.id)) &&
      (!validation || trace.derivedFrom.includes(validation.id))
  )
}

function traceTypeToText(type: string): string {
  if (type === "time_passage") return "等待留下的时间痕迹"
  if (type === "spatial_use") return "空间使用痕迹"
  if (type === "construction_maintenance") return "维护痕迹"
  if (type === "ecology_change") return "生态变化痕迹"
  if (type === "emotion_attention") return "注意力痕迹"
  if (type === "behavior_activity") return "行为活动痕迹"
  if (type === "movement") return "移动痕迹"

  return "世界事件痕迹"
}
