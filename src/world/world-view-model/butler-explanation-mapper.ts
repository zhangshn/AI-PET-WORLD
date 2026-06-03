import type { TraceFact } from "@/world/trace"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"

export type ButlerExplanationView = {
  title: string
  body: string
}

export function buildButlerExplanationView(input: {
  saveRecord: WorldRuntimeSaveRecord
}): ButlerExplanationView {
  const { saveRecord } = input
  const summary = saveRecord.lastButlerRuntimeAuditSummary

  if (summary) {
    return {
      title: buildSummaryTitle(summary.intentKind),
      body: buildSummaryBody({ saveRecord }),
    }
  }

  const decision = saveRecord.lastButlerRuntimeDecision
  const intent = saveRecord.lastButlerRuntimeIntent
  const validation = saveRecord.lastButlerWorldRuleValidation
  const trace = findCurrentButlerTrace(saveRecord)
  const memorySeedCount = saveRecord.traceMemorySeedField?.summary.totalSeeds ?? 0

  if (!decision || !intent || !validation) {
    return {
      title: "管家正在观察世界",
      body: "它会先读取家园状态、资源和痕迹，再决定是否需要行动。当前不会因为页面打开而推进世界。",
    }
  }

  if (!validation.ok) {
    return {
      title: "管家暂停了这次行动",
      body: `它原本倾向于${motivationToText(decision.selectedMotivation)}，但世界规则没有放行，所以没有强行改写家园。`,
    }
  }

  if (intent.kind === "resource_wait") {
    return {
      title: "管家选择等待资源稳定",
      body: buildTraceAwareBody({
        prefix: "它判断当前资源还不适合继续推进，所以没有改写家园事实。",
        trace,
        memorySeedCount,
      }),
    }
  }

  if (intent.kind === "observation") {
    return {
      title: "管家选择继续观察",
      body: buildTraceAwareBody({
        prefix: "它把世界里的变化当成信号，只记录经过验证的观察痕迹，不直接替世界做决定。",
        trace,
        memorySeedCount,
      }),
    }
  }

  if (intent.kind === "maintenance") {
    return {
      title: "管家正在维护家园",
      body: buildTraceAwareBody({
        prefix: "它会优先照看已经被使用过的区域；真正改变家园前，仍然必须经过 SafeApply。",
        trace,
        memorySeedCount,
      }),
    }
  }

  return {
    title: "管家正在评估建设",
    body: buildTraceAwareBody({
      prefix: "它会沿着当前计划谨慎推进；只有通过世界规则和 SafeApply 的变化，才会写入 HomeMapState。",
      trace,
      memorySeedCount,
    }),
  }
}

function buildSummaryTitle(intentKind: string): string {
  if (intentKind === "resource_wait") return "管家选择等待资源稳定"
  if (intentKind === "observation") return "管家选择继续观察"
  if (intentKind === "maintenance") return "管家正在维护家园"
  if (intentKind === "construction") return "管家正在评估建设"

  return "管家更新了判断"
}

function buildSummaryBody(input: {
  saveRecord: WorldRuntimeSaveRecord
}): string {
  const summary = input.saveRecord.lastButlerRuntimeAuditSummary

  if (!summary) return "管家正在整理本轮世界记录。"

  const boundaryText =
    summary.homeMapWriteStatus === "not_requested"
      ? "本轮没有请求改写 HomeMapState。"
      : summary.homeMapWriteStatus === "safe_apply_written"
        ? "本轮有家园变化通过 SafeApply 写入。"
        : summary.homeMapWriteStatus === "safe_apply_no_diff"
          ? "本轮保留 SafeApply 边界，但没有新的家园变化写入。"
          : "本轮家园变化被世界规则拦下，没有写入。"
  const traceText = summary.traceId
    ? `它留下了${traceTypeToText(summary.traceType ?? "")}，痕迹编号 ${summary.traceId}。`
    : "本轮没有形成新的可见行为痕迹。"
  const validationText =
    summary.validationStatus === "passed"
      ? "这次行动已经通过世界规则验证。"
      : "这次行动没有通过世界规则验证。"
  const memoryText =
    summary.memorySeedCount > 0
      ? `当前有 ${summary.memorySeedCount} 条记忆种子可供后续判断参考。`
      : "当前还没有稳定记忆种子。"

  return `${summary.userFacingSummary}${validationText}${boundaryText}${traceText}${memoryText}`
}

function findCurrentButlerTrace(
  saveRecord: WorldRuntimeSaveRecord
): TraceFact | undefined {
  const intent = saveRecord.lastButlerRuntimeIntent
  const validation = saveRecord.lastButlerWorldRuleValidation

  return saveRecord.traceField?.traces.find(
    (trace) =>
      trace.sourceKind === "butler_behavior" &&
      trace.updatedAtTick === saveRecord.tick &&
      trace.tags.includes("butler_trace_closure") &&
      trace.tags.includes("butler_trace_only") &&
      (!intent || trace.derivedFrom.includes(intent.id)) &&
      (!validation || trace.derivedFrom.includes(validation.id))
  )
}

function buildTraceAwareBody(input: {
  prefix: string
  trace?: TraceFact
  memorySeedCount: number
}): string {
  const traceText = input.trace
    ? `这次留下的是“${traceTypeToText(input.trace.type)}”，它会进入痕迹层，而不是直接变成宠物或新建筑。`
    : "这次没有找到可公开展示的新痕迹，但管家判断仍会被保留在运行记录中。"
  const memoryText =
    input.memorySeedCount > 0
      ? `当前已有 ${input.memorySeedCount} 条记忆种子可供后续判断参考。`
      : "当前还没有足够稳定的记忆种子。"

  return `${input.prefix}${traceText}${memoryText}`
}

function motivationToText(motivation: string): string {
  if (motivation === "wait_for_resources") return "等待资源稳定"
  if (motivation === "maintain_home") return "维护家园"
  if (motivation === "continue_construction") return "继续建设"
  if (motivation === "observe_world") return "观察世界"

  return "观察世界"
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