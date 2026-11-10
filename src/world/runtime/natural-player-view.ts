import {resolveRuntimePath} from '../../../scripts/lib/runtime-working-directory.mjs'
import path from "node:path"
import { NextResponse } from "next/server"
import { authorizeWorldPlayerRead } from "@/server/world-player-access/session.mjs"
import { readLatestGameMapRuntimeFrameRecord } from "@/world/game-map-frame"
import { createProductionWorldRuntimeStore } from "./world-runtime-production-store"
import { recentNaturalPlayerHistory, type PlayerHistory } from "./natural-player-history"
import type { NaturalWorldJson, NaturalWorldJsonObject } from "./world-runtime-schema"

type ReadGrant = {
  permission: string
  ownerId: string
  playerId: string
  worldId: string
}

type PlayerWeatherProgress =
  | { status: "unavailable" }
  | { status: "stopped"; day: number }
  | { status: "exhausted" | "ongoing"; day: number; validatedThroughDay: number; daysRemaining: number }

function object(value: NaturalWorldJson | undefined): NaturalWorldJsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined
}

export async function readNaturalPlayerView(grant: ReadGrant, includeHistory = false, historyCursor?: string | string[]) {
  if (grant.permission !== "world.read" || grant.worldId !== "mvp-natural-world-001") return null
  const root = resolveRuntimePath("data/world-runtime")
  const store = createProductionWorldRuntimeStore(root)
  if (!store.readNatural || !store.readNaturalTransition) return null
  const result = await store.readNatural({
    ownerId: grant.ownerId, worldId: grant.worldId, expectedPlayerId: grant.playerId,
  })
  if (result.status !== "found" || !result.record) return null
  const record = result.record
  const evolution = object(object(record.worldState.payload.environment)?.evolution)
  const weather = object(evolution?.weather)
  const values = weather?.values
  const fields = weather?.fieldOrder
  const units = weather?.units
  const validWeather = JSON.stringify(fields) === JSON.stringify(["PRECTOTCORR","RH2M","T2M","WS2M"]) &&
    JSON.stringify(units) === JSON.stringify(["mm/day","%","C","m/s"]) &&
    Array.isArray(values) && values.length === 4 && values.every(n => typeof n === "number" && Number.isFinite(n))
  const logicalEnd = evolution?.logicalEndUtc
  const key = object(evolution?.commit)?.businessKey
  let lastEvent: "maintenance" | "evolution" | null = null
  let history: PlayerHistory | null = null
  if (typeof key === "string") {
    const { ownerId, playerId, worldId, worldSeed, worldProfileId, regionId } = record
    const event = await store.readNaturalTransition({identity:{ownerId,playerId,worldId,worldSeed,worldProfileId,regionId},businessKey:key})
    if (event.status !== "found" || !event.receipt || !event.event || event.receipt.fileSha256 !== result.fileSha256 ||
      event.event.cursor !== record.eventCursor) return null
    lastEvent = event.event.eventKind
    if (includeHistory && result.fileSha256) {
      const readTransition = store.readNaturalTransition
      history = await recentNaturalPlayerHistory(root, result.path, record, result.fileSha256,
        query => query.businessKey === key ? Promise.resolve(event) : readTransition(query), historyCursor)
      if (historyCursor !== undefined && history.status === "available") {
        const latest = await store.readNatural({ownerId, worldId, expectedPlayerId:playerId})
        if (latest.status !== "found" || latest.fileSha256 !== result.fileSha256)
          history = {status:"stale_page", entries:[]}
      }
    }
  }
  const frame = await readLatestGameMapRuntimeFrameRecord({ownerId:grant.ownerId,worldId:grant.worldId,currentTick:record.tick})
  let weatherProgress: PlayerWeatherProgress | null = null
  if (includeHistory) {
    weatherProgress = {status:"unavailable"}
    try {
      const {readNaturalPlayerWeatherProgress} = await import("@/server/world-player-access/weather-progress.mjs")
      const progress = await readNaturalPlayerWeatherProgress(grant,{record,fileSha256:result.fileSha256})
      if (progress.day === record.tick) {
        if (progress.status === "stopped" && progress.reason === "service_stopped") {
          weatherProgress = {status:"stopped",day:record.tick}
        } else if (((progress.status === "exhausted" && progress.reason === "validated_horizon_exhausted" && progress.daysRemaining === 0) ||
                    (progress.status === "ongoing" && progress.reason === "within_bound" && progress.daysRemaining > 0)) &&
                   Number.isSafeInteger(progress.validatedThroughDay) && Number.isSafeInteger(progress.daysRemaining)) {
          weatherProgress = {status:progress.status,day:record.tick,validatedThroughDay:progress.validatedThroughDay,daysRemaining:progress.daysRemaining}
        }
      }
    } catch {
      // The authorized Store result remains readable if its weather-service evidence cannot be verified.
    }
  }
  // The legacy visual frame record does not certify a native, semantically approved
  // frame for the current natural snapshot. Keep candidates behind that release gate.
  const frameStatus = frame.status === "empty" ? "missing" :
    frame.status === "failed" ? "unavailable" :
    frame.status === "invalid" && !frame.warnings.includes("legacy_runtime_frame_missing_natural_world_authority") ? "conflict" : "unverified"
  return {worldId:record.worldId,tick:record.tick,eventCount:record.eventCursor,lastEvent,history,weatherProgress,
    date:typeof logicalEnd === "string" ? logicalEnd.slice(0,10) : null,
    weather:validWeather ? {rain:Number(values[0]),humidity:Number(values[1]),temperature:Number(values[2]),wind:Number(values[3])} : null,
    frameStatus} as const
}

export async function readNaturalPlayerFrameResponse(request:Request,worldId:string) {
  const grant=await authorizeWorldPlayerRead(request,worldId)
  const headers={"Cache-Control":"private, no-store",Vary:"Cookie"}
  if (!grant.ok) return NextResponse.json({ok:false,status:grant.errorCode},{status:grant.status,headers})
  const view=await readNaturalPlayerView(grant)
  if (!view) return NextResponse.json({ok:false,status:"world_state_unavailable"},{status:503,headers})
  const responses = {
    missing: [404, "natural_frame_unpublished"],
    unverified: [409, "natural_frame_unqualified"],
    conflict: [409, "natural_frame_record_conflict"],
    unavailable: [503, "natural_frame_read_unavailable"],
  } as const
  const [status, reason] = responses[view.frameStatus]
  return NextResponse.json({ok:false,status:reason},{status,headers})
}
