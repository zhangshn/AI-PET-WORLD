/** Shared validation of the existing local WorldRuntimeSaveRecord shape. */
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { WorldRuntimeEventLog, WorldRuntimeSaveRecord } from "./world-runtime-schema"

export function isWorldRuntimeSaveRecord(value: unknown): value is WorldRuntimeSaveRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<WorldRuntimeSaveRecord>
  const tick = record.tick
  if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0) return false
  const homeMapState = record.homeMapState
  if (!isHomeMapStateShape(homeMapState)) return false
  const recentEvents = record.recentEvents
  if (!isWorldRuntimeEventLogArray(recentEvents)) return false
  return (
    record.version === "v2.6-runtime-00" &&
    isNonEmptyIdentity(record.worldId) &&
    isNonEmptyIdentity(record.ownerId) &&
    isIsoTimestamp(record.savedAt) &&
    Boolean(record.butlerProfile) &&
    Boolean(record.butlerRuntimeProfile) &&
    Boolean(record.butlerBirthInput) &&
    typeof record.butlerMappingMode === "string" &&
    Boolean(record.butlerConstructionStyle) &&
    typeof record.worldCreationStyleSource === "string" &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string") &&
    homeMapState.worldId === record.worldId &&
    homeMapState.ownerId === record.ownerId &&
    recentEvents.every((event) => event.tick >= 0 && event.tick <= tick)
  )
}

function isNonEmptyIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function isHomeMapStateShape(value: unknown): value is HomeMapState {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<HomeMapState>
  return (
    typeof record.worldId === "string" &&
    typeof record.ownerId === "string" &&
    typeof record.seed === "string" &&
    isHomeMapSizeShape(record.mapSize) &&
    Array.isArray(record.zones) &&
    Array.isArray(record.placements) &&
    isHomeResourceStateShape(record.resources) &&
    Array.isArray(record.constructionPlans) &&
    Array.isArray(record.mapDiffs) &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.createdAt) &&
    Number.isFinite(record.updatedAt) &&
    record.updatedAt >= record.createdAt &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string")
  )
}

function isHomeMapSizeShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<HomeMapState["mapSize"]>
  return (
    typeof record.columns === "number" &&
    typeof record.rows === "number" &&
    typeof record.tileSize === "number"
  )
}

function isHomeResourceStateShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<HomeMapState["resources"]>
  return (
    typeof record.groundHealth === "number" &&
    typeof record.naturalGrowth === "number" &&
    typeof record.materialReadiness === "number" &&
    typeof record.careReadiness === "number" &&
    typeof record.spacePressure === "number" &&
    Array.isArray(record.tags)
  )
}

function isWorldRuntimeEventLogArray(value: unknown): value is WorldRuntimeEventLog[] {
  return Array.isArray(value) && value.every(isWorldRuntimeEventLogShape)
}

function isWorldRuntimeEventLogShape(value: unknown): value is WorldRuntimeEventLog {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<WorldRuntimeEventLog>
  return (
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.tick === "number" && Number.isInteger(record.tick) && record.tick >= 0 &&
    typeof record.title === "string" &&
    typeof record.body === "string" &&
    (record.source === "runtime" || record.source === "butler" || record.source === "construction" || record.source === "safe_apply" || record.source === "audit") &&
    isIsoTimestamp(record.createdAt) &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string")
  )
}
