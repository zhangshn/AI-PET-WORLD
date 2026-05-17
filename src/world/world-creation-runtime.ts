/**
 * 当前文件负责：把创建世界输入转换为本地可运行的世界生成参数。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export const CREATE_WORLD_STORAGE_KEY = "ai-pet-world:create-world-input"

export type CreateWorldPerspective = "unspecified" | "female" | "male"

export type CreateWorldInput = {
  year: number
  month: number
  day: number
  time: string
  perspective: CreateWorldPerspective
  createdAt: number
}

export type WorldCreationRuntimeInput = {
  createWorldInput: CreateWorldInput
}

export type WorldCreationRuntimeResult = {
  worldId: string
  ownerId: string
  birthSignature: string
  worldSalt: string
  butlerConstructionStyle: ButlerConstructionStyleVector
  now: number
}

export function parseCreateWorldInput(
  rawValue: string | null
): CreateWorldInput | null {
  if (!rawValue) return null

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<CreateWorldInput>

    if (!isValidYear(parsedValue.year)) return null
    if (!isValidMonth(parsedValue.month)) return null
    if (!isValidDay(parsedValue.day)) return null
    if (!isValidTime(parsedValue.time)) return null
    if (!isValidPerspective(parsedValue.perspective)) return null

    return {
      year: parsedValue.year,
      month: parsedValue.month,
      day: parsedValue.day,
      time: parsedValue.time,
      perspective: parsedValue.perspective,
      createdAt:
        typeof parsedValue.createdAt === "number"
          ? parsedValue.createdAt
          : Date.now(),
    }
  } catch {
    return null
  }
}

export function buildWorldCreationRuntime(
  input: WorldCreationRuntimeInput
): WorldCreationRuntimeResult {
  const birthSignature = buildBirthSignature(input.createWorldInput)
  const stableToken = buildStableToken(birthSignature)
  const style = buildDeterministicConstructionStyle(birthSignature)

  return {
    worldId: `world-${stableToken}`,
    ownerId: `owner-${stableToken}`,
    birthSignature,
    worldSalt: `local-mvp-${input.createWorldInput.createdAt}`,
    butlerConstructionStyle: style,
    now: input.createWorldInput.createdAt,
  }
}

export function buildBirthSignature(input: CreateWorldInput): string {
  return [
    input.year.toString().padStart(4, "0"),
    input.month.toString().padStart(2, "0"),
    input.day.toString().padStart(2, "0"),
    input.time,
    input.perspective,
  ].join("-")
}

function buildDeterministicConstructionStyle(
  birthSignature: string
): ButlerConstructionStyleVector {
  return {
    structuredBuilder: buildStyleValue(birthSignature, "structuredBuilder"),
    warmCaretaker: buildStyleValue(birthSignature, "warmCaretaker"),
    protectiveKeeper: buildStyleValue(birthSignature, "protectiveKeeper"),
    aestheticOrganizer: buildStyleValue(birthSignature, "aestheticOrganizer"),
    quietMaintainer: buildStyleValue(birthSignature, "quietMaintainer"),
    adaptivePlanner: buildStyleValue(birthSignature, "adaptivePlanner"),
  }
}

function buildStyleValue(signature: string, salt: string): number {
  const normalized = hashToUnit(`${signature}:${salt}`)
  const value = 0.28 + normalized * 0.58

  return Number(value.toFixed(3))
}

function buildStableToken(value: string): string {
  return Math.abs(hashString(value)).toString(36)
}

function hashToUnit(value: string): number {
  const hash = Math.abs(hashString(value))

  return (hash % 10_000) / 10_000
}

function hashString(value: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash | 0
}

function isValidYear(value: unknown): value is number {
  return typeof value === "number" && value >= 1900 && value <= 2100
}

function isValidMonth(value: unknown): value is number {
  return typeof value === "number" && value >= 1 && value <= 12
}

function isValidDay(value: unknown): value is number {
  return typeof value === "number" && value >= 1 && value <= 31
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
}

function isValidPerspective(value: unknown): value is CreateWorldPerspective {
  return value === "unspecified" || value === "female" || value === "male"
}