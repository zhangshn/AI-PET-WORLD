/**
 * 当前文件职责：把创建世界输入转换为世界生成运行时参数。
 */

import { buildButlerProfile } from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

import { buildButlerConstructionStyleFromLifeCore } from "./life-core-to-world-style"
import type {
  CreateWorldInput,
  CreateWorldPerspective,
  WorldCreationRuntimeInput,
  WorldCreationRuntimeResult,
  WorldCreationStyleSource,
} from "./world-creation-schema"

export type {
  CreateWorldInput,
  CreateWorldPerspective,
  WorldCreationRuntimeInput,
  WorldCreationRuntimeResult,
  WorldCreationStyleSource,
} from "./world-creation-schema"

export const CREATE_WORLD_STORAGE_KEY = "ai-pet-world:create-world-input"

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
          : buildStableCreatedAtFromInput(parsedValue),
    }
  } catch {
    return null
  }
}

export function serializeCreateWorldInput(input: CreateWorldInput): string {
  return JSON.stringify(input)
}

export function buildWorldCreationRuntime(
  input: WorldCreationRuntimeInput
): WorldCreationRuntimeResult {
  const birthSignature = buildBirthSignature(input.createWorldInput)
  const stableToken = buildStableToken(birthSignature)
  const fallbackStyle = buildDeterministicConstructionStyle(birthSignature)
  const styleResult = buildRuntimeStyle({
    createWorldInput: input.createWorldInput,
    fallbackStyle,
  })

  return {
    worldId: `world-${stableToken}`,
    ownerId: `owner-${stableToken}`,
    birthSignature,
    worldSalt: `local-mvp-${input.createWorldInput.createdAt}`,
    butlerConstructionStyle: styleResult.constructionStyle,
    now: input.createWorldInput.createdAt,
    styleSource: styleResult.source,
    debug: {
      source: "world_creation_runtime",
      note: styleResult.note,
      warnings: styleResult.warnings,
    },
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

function buildRuntimeStyle(input: {
  createWorldInput: CreateWorldInput
  fallbackStyle: ButlerConstructionStyleVector
}): {
  constructionStyle: ButlerConstructionStyleVector
  source: WorldCreationStyleSource
  note: string
  warnings: string[]
} {
  try {
    const birthTime = parseCreateWorldTime(input.createWorldInput.time)
    const hasBirthHour = birthTime !== null
    const genderPerspective = resolveGenderPerspective(
      input.createWorldInput.perspective
    )

    const butlerProfile = buildButlerProfile({
      birth: {
        year: input.createWorldInput.year,
        month: input.createWorldInput.month,
        day: input.createWorldInput.day,
        hour: birthTime?.hour,
        minute: birthTime?.minute,
      },
      mappingMode: "self_projection",
      genderPerspective,
      displayName: "管家",
    })

    const lifeCoreStyle = buildButlerConstructionStyleFromLifeCore({
      butlerProfile,
      fallbackStyle: input.fallbackStyle,
    })

    return {
      constructionStyle: lifeCoreStyle.constructionStyle,
      source: lifeCoreStyle.source,
      note: hasBirthHour
        ? "世界创建已接入管家人格核心，并使用完整出生时间映射建设风格。"
        : "世界创建已接入管家人格核心；出生时间不可用时使用日期模式映射建设风格。",
      warnings: [],
    }
  } catch (error) {
    return {
      constructionStyle: input.fallbackStyle,
      source: "deterministic_fallback",
      note: "人格核心映射失败，已回退到稳定的确定性建设风格，保证世界创建不中断。",
      warnings: [getErrorMessage(error)],
    }
  }
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

function parseCreateWorldTime(
  value: string
): { hour: number; minute: number } | null {
  if (!isValidTime(value)) return null

  const [hourText, minuteText] = value.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  return { hour, minute }
}

function resolveGenderPerspective(
  perspective: CreateWorldPerspective
): "male" | "female" {
  if (perspective === "female") return "female"

  return "male"
}

function buildStableCreatedAtFromInput(
  input: Partial<CreateWorldInput>
): number {
  if (
    !isValidYear(input.year) ||
    !isValidMonth(input.month) ||
    !isValidDay(input.day) ||
    !isValidTime(input.time) ||
    !isValidPerspective(input.perspective)
  ) {
    return 0
  }

  const birthTime = parseCreateWorldTime(input.time)
  const hour = birthTime?.hour ?? 0
  const minute = birthTime?.minute ?? 0
  const perspectiveOffset =
    input.perspective === "female" ? 2 : input.perspective === "male" ? 1 : 0

  return (
    input.year * 10_000_000 +
    input.month * 100_000 +
    input.day * 1_000 +
    hour * 10 +
    Math.floor(minute / 10) +
    perspectiveOffset
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message

  return "Unknown world creation runtime error"
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
