/**
 * 褰撳墠鏂囦欢璐熻矗锛氫繚瀛樺拰璇诲彇 runtime 瀹跺洯鍦板浘鏈湴蹇収銆? */

import type { ConstructionPlan } from "@/world/construction/construction-schema"

import type { HomeMapState } from "./home-map-state-schema"

export const HOME_MAP_LOCAL_STORAGE_VERSION = 1

const HOME_MAP_LOCAL_STORAGE_PREFIX = "ai-pet-world:home-map"

export type HomeMapLocalSnapshot = {
  version: number
  worldId: string
  ownerId: string
  homeMapState: HomeMapState
  constructionPlan: ConstructionPlan | null
  constructionMessage: string
  lastAutoConstructionTick: number | null
  savedAt: number
}

export type HomeMapLocalIdentityInput = {
  worldId: string
  ownerId: string
}

export type SaveHomeMapLocalSnapshotInput = HomeMapLocalIdentityInput & {
  snapshot: HomeMapLocalSnapshot
}

export function buildHomeMapLocalStorageKey(
  worldId: string,
  ownerId: string
): string {
  return `${HOME_MAP_LOCAL_STORAGE_PREFIX}:${worldId}:${ownerId}:v${HOME_MAP_LOCAL_STORAGE_VERSION}`
}

export function loadHomeMapLocalSnapshot(
  input: HomeMapLocalIdentityInput
): HomeMapLocalSnapshot | null {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(
      buildHomeMapLocalStorageKey(input.worldId, input.ownerId)
    )

    if (!value) return null

    return normalizeHomeMapLocalSnapshot(JSON.parse(value), input)
  } catch {
    return null
  }
}

export function saveHomeMapLocalSnapshot(
  input: SaveHomeMapLocalSnapshotInput
): void {
  if (typeof window === "undefined") return

  const snapshot: HomeMapLocalSnapshot = {
    ...input.snapshot,
    version: HOME_MAP_LOCAL_STORAGE_VERSION,
    worldId: input.worldId,
    ownerId: input.ownerId,
  }

  try {
    window.localStorage.setItem(
      buildHomeMapLocalStorageKey(input.worldId, input.ownerId),
      JSON.stringify(snapshot)
    )
  } catch {
    return
  }
}

export function clearHomeMapLocalSnapshot(
  input: HomeMapLocalIdentityInput
): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(
      buildHomeMapLocalStorageKey(input.worldId, input.ownerId)
    )
  } catch {
    return
  }
}

function normalizeHomeMapLocalSnapshot(
  value: unknown,
  input: HomeMapLocalIdentityInput
): HomeMapLocalSnapshot | null {
  if (!isRecord(value)) return null
  if (value.version !== HOME_MAP_LOCAL_STORAGE_VERSION) return null
  if (value.worldId !== input.worldId) return null
  if (value.ownerId !== input.ownerId) return null
  if (!isHomeMapStateLike(value.homeMapState)) return null
  if (
    value.constructionPlan !== null &&
    !isConstructionPlanLike(value.constructionPlan)
  ) {
    return null
  }
  if (typeof value.constructionMessage !== "string") return null
  if (
    value.lastAutoConstructionTick !== null &&
    typeof value.lastAutoConstructionTick !== "number"
  ) {
    return null
  }
  if (typeof value.savedAt !== "number") return null

  return {
    version: value.version,
    worldId: value.worldId,
    ownerId: value.ownerId,
    homeMapState: value.homeMapState,
    constructionPlan: value.constructionPlan,
    constructionMessage: value.constructionMessage,
    lastAutoConstructionTick: value.lastAutoConstructionTick,
    savedAt: value.savedAt,
  }
}

function isHomeMapStateLike(value: unknown): value is HomeMapState {
  if (!isRecord(value)) return false

  return (
    typeof value.worldId === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.seed === "string" &&
    isRecord(value.mapSize) &&
    Array.isArray(value.zones) &&
    Array.isArray(value.placements) &&
    isRecord(value.resources) &&
    Array.isArray(value.constructionPlans) &&
    Array.isArray(value.mapDiffs) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    Array.isArray(value.tags)
  )
}

function isConstructionPlanLike(value: unknown): value is ConstructionPlan {
  if (!isRecord(value)) return false

  return (
    typeof value.id === "string" &&
    typeof value.projectType === "string" &&
    typeof value.title === "string" &&
    typeof value.reason === "string" &&
    typeof value.targetZoneType === "string" &&
    typeof value.status === "string" &&
    typeof value.currentStage === "string" &&
    typeof value.priority === "number" &&
    Array.isArray(value.stages) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    Array.isArray(value.tags)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
