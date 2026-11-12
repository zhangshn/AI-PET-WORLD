"use client"

import { useSyncExternalStore } from "react"

import type { AiConsoleLiveSnapshot } from "@/shared/ai-console/observation-types"
export type { AiConsoleLiveSnapshot } from "@/shared/ai-console/observation-types"

export type AiConsoleLiveHistoryPoint = {
  observedAtUtc: string
  cpu: number | null
  memory: number | null
  gpu: number | null
  vram: number | null
  temperature: number | null
  power: number | null
  loss: number | null
  epoch: number | null
}

type AiConsoleLiveStoreState = {
  connection: "connecting" | "connected" | "failed"
  snapshot: AiConsoleLiveSnapshot | null
  history: readonly AiConsoleLiveHistoryPoint[]
  errorCode: string | null
  receivedAtUtc: string | null
  roundTripDurationMs: number | null
}

const sessionHistoryKey = "ai-console-live-observability-history-v2"
const targetRefreshIntervalMs = 250
const maximumHistoryPoints = 600
const listeners = new Set<() => void>()
const serverState: AiConsoleLiveStoreState = { connection: "connecting", snapshot: null, history: [], errorCode: null, receivedAtUtc: null, roundTripDurationMs: null }
let storeState: AiConsoleLiveStoreState = serverState
let intervalId: number | null = null
let requestInFlight: Promise<void> | null = null

function emit(nextState: AiConsoleLiveStoreState) {
  storeState = nextState
  for (const listener of listeners) listener()
}

function readSessionHistory(): AiConsoleLiveHistoryPoint[] {
  try {
    const raw = window.sessionStorage.getItem(sessionHistoryKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((point): point is AiConsoleLiveHistoryPoint => (
      typeof point === "object" && point !== null && typeof (point as AiConsoleLiveHistoryPoint).observedAtUtc === "string"
    )).slice(-maximumHistoryPoints)
  } catch {
    return []
  }
}

function addHistoryPoint(snapshot: AiConsoleLiveSnapshot): readonly AiConsoleLiveHistoryPoint[] {
  const current = storeState.history.length > 0 ? [...storeState.history] : readSessionHistory()
  if (current.at(-1)?.observedAtUtc === snapshot.observedAtUtc) return current
  const next = [...current, {
    observedAtUtc: snapshot.observedAtUtc,
    cpu: snapshot.resources.cpuUtilization,
    memory: snapshot.resources.memoryUtilization,
    gpu: snapshot.resources.gpuUtilization,
    vram: snapshot.resources.vramUtilization,
    temperature: snapshot.resources.gpuTemperatureCelsius,
    power: snapshot.resources.gpuPowerDrawWatts,
    loss: snapshot.trainingTelemetry.latest?.loss ?? null,
    epoch: snapshot.trainingTelemetry.latest?.epoch ?? null,
  }].slice(-maximumHistoryPoints)
  try { window.sessionStorage.setItem(sessionHistoryKey, JSON.stringify(next)) } catch { /* browser storage is optional */ }
  return next
}

function isLiveSnapshot(payload: unknown): payload is AiConsoleLiveSnapshot {
  if (typeof payload !== "object" || payload === null) return false
  const candidate = payload as Partial<AiConsoleLiveSnapshot>
  return candidate.ok === true
    && candidate.schemaVersion === "ai_console_live_observability_v2"
    && typeof candidate.observedAtUtc === "string"
    && typeof candidate.sampleSequence === "number"
    && typeof candidate.sampleCompletedAtUtc === "string"
    && typeof candidate.sampleDurationMs === "number"
    && candidate.timestampPrecision === "milliseconds"
    && typeof candidate.channelTimings === "object"
    && typeof candidate.resources === "object"
    && typeof candidate.trainingProcesses === "object"
    && typeof candidate.trainingTelemetry === "object"
}

export function refreshAiConsoleLiveObservability(): Promise<void> {
  if (requestInFlight) return requestInFlight
  const requestStartedAt = performance.now()
  requestInFlight = fetch("/api/ai-console/observability/live", { cache: "no-store", credentials: "same-origin" })
    .then(async (response) => {
      const payload = await response.json() as unknown
      if (!response.ok || !isLiveSnapshot(payload)) throw new Error("ai_console_live_observability_response_invalid")
      emit({
        connection: "connected",
        snapshot: payload,
        history: addHistoryPoint(payload),
        errorCode: null,
        receivedAtUtc: new Date().toISOString(),
        roundTripDurationMs: Number((performance.now() - requestStartedAt).toFixed(3)),
      })
    })
    .catch((error: unknown) => {
      emit({ ...storeState, connection: "failed", errorCode: error instanceof Error ? error.message : "ai_console_live_observability_request_failed" })
    })
    .finally(() => {
      requestInFlight = null
    })
  return requestInFlight
}

function startPolling() {
  if (intervalId !== null) return
  void refreshAiConsoleLiveObservability()
  intervalId = window.setInterval(() => { void refreshAiConsoleLiveObservability() }, targetRefreshIntervalMs)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  startPolling()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getSnapshot() {
  return storeState
}

function getServerSnapshot() {
  return serverState
}

export function useAiConsoleLiveObservability(): AiConsoleLiveStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
