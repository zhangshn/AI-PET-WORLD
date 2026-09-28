"use client"

import { useSyncExternalStore } from "react"
import type { CurrentSummaryReadState, CurrentSummarySnapshot } from "./ai-console-training-summary-model"

export const currentExecutionRefreshMs = 1_000
const initial: CurrentSummaryReadState = { connection: "connecting", snapshot: null, errorCode: null, observedNowMs: 0 }
let state = initial
const listeners = new Set<() => void>()
let interval: ReturnType<typeof setInterval> | null = null
let controller: AbortController | null = null
let inFlight: Promise<void> | null = null

function emit(next: CurrentSummaryReadState) {
  state = next
  for (const listener of listeners) listener()
}
function valid(value: unknown): value is CurrentSummarySnapshot {
  if (typeof value !== "object" || value === null) return false
  const v = value as Partial<CurrentSummarySnapshot>
  return v.schemaVersion === "ai_console_ai_painter_current_execution_projection_v1"
    && v.sourceIdentity === "ai-painter-current-execution"
    && v.sourcePath === ".runtime/ai-painter/current-execution-registry/current.json"
    && ["connected", "unknown_or_stale"].includes(v.dataStatus ?? "")
}
export function refreshCurrentExecution() {
  if (inFlight) return inFlight
  const request = new AbortController()
  controller = request
  const timeout = setTimeout(() => request.abort(new Error("current_execution_request_timeout")), 8_000)
  inFlight = (async () => {
    try {
      const response = await fetch("/api/ai-console/observability/current-execution", { cache: "no-store", credentials: "same-origin", signal: request.signal })
      const payload: unknown = await response.json()
      if (!response.ok || !valid(payload)) throw new Error("current_execution_projection_response_invalid")
      if (!request.signal.aborted) emit({ connection: "ready", snapshot: payload, errorCode: payload.reasonCode, observedNowMs: Date.now() })
    } catch (error) {
      if (listeners.size) emit({ ...state, connection: "failed", errorCode: error instanceof Error ? error.message : "current_execution_request_failed", observedNowMs: Date.now() })
    } finally {
      clearTimeout(timeout)
      if (controller === request) controller = null
      inFlight = null
    }
  })()
  return inFlight
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (interval === null) {
    void refreshCurrentExecution()
    interval = setInterval(() => {
      emit({ ...state, observedNowMs: Date.now() })
      void refreshCurrentExecution()
    }, currentExecutionRefreshMs)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      if (interval !== null) clearInterval(interval)
      interval = null
      controller?.abort()
    }
  }
}
export function useAiConsoleCurrentExecution() {
  return useSyncExternalStore(subscribe, () => state, () => initial)
}
