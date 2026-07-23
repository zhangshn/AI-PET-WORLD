import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { listLatestIndexedArtifacts } from "@/server/ai-pet-world-storage-catalog"

const RELATIVE_REQUEST_ROOT = ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests"

export type ConditionalRgbGenerationAttemptRecord = {
  attemptId: string
  requestId: string
  outputRecordId: string
  status: string
  failureCode: string
  failureMessage: string
  attemptedRoute: string
  createdAtUtc: string
  createdAtAsiaShanghai: string
  generatedImageCreated: boolean
  generatedImagePath: string | null
  automaticStorage: boolean
  evidencePath: string
}

export async function listConditionalRgbGenerationAttempts(limit = 80) {
  const indexedArtifacts = listLatestIndexedArtifacts(RELATIVE_REQUEST_ROOT, Math.max(limit * 4, 320))
  if (indexedArtifacts) {
    const indexedAttempts = indexedArtifacts
      .filter((artifact) => artifact.path.includes("/generation-attempts/") && artifact.name.endsWith(".json"))
      .slice(0, limit)
    const attempts = await Promise.all(
      indexedAttempts.map((artifact) => readAttemptRecord(
        path.join(process.cwd(), artifact.path),
        artifact.path,
        Date.parse(artifact.modifiedAt),
      )),
    )
    return attempts.filter((attempt): attempt is ConditionalRgbGenerationAttemptRecord => attempt !== null)
  }

  const absoluteRoot = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".runtime",
    "ai-painter",
    "ai-assisted-cold-start",
    "conditional-rgb-generation-requests",
  )
  try {
    const requestEntries = await readdir(absoluteRoot, { withFileTypes: true })
    const candidates: Array<{ absolutePath: string; relativePath: string; modifiedAtMs: number }> = []
    for (const requestEntry of requestEntries) {
      if (!requestEntry.isDirectory() || !requestEntry.name.startsWith("conditional-rgb-")) continue
      const attemptsRoot = path.join(absoluteRoot, requestEntry.name, "generation-attempts")
      let attemptEntries
      try {
        attemptEntries = await readdir(attemptsRoot, { withFileTypes: true })
      } catch {
        continue
      }
      for (const attemptEntry of attemptEntries) {
        if (!attemptEntry.isFile() || !attemptEntry.name.endsWith(".json")) continue
        const absolutePath = path.join(attemptsRoot, attemptEntry.name)
        const info = await stat(absolutePath)
        candidates.push({
          absolutePath,
          relativePath: path.join(
            RELATIVE_REQUEST_ROOT,
            requestEntry.name,
            "generation-attempts",
            attemptEntry.name,
          ).replaceAll("\\", "/"),
          modifiedAtMs: info.mtimeMs,
        })
      }
    }

    candidates.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
    const attempts: ConditionalRgbGenerationAttemptRecord[] = []
    for (const candidate of candidates.slice(0, limit)) {
      const attempt = await readAttemptRecord(candidate.absolutePath, candidate.relativePath, candidate.modifiedAtMs)
      if (attempt) attempts.push(attempt)
    }
    return attempts
  } catch {
    return []
  }
}

async function readAttemptRecord(absolutePath: string, relativePath: string, modifiedAtMs: number) {
  const json = await readJson(absolutePath)
  if (!json) return null
  return {
    attemptId: stringValue(json.attemptId) ?? path.basename(relativePath, ".json"),
    requestId: stringValue(json.requestId) ?? "--",
    outputRecordId: stringValue(json.outputRecordId) ?? "--",
    status: stringValue(json.status) ?? "failed",
    failureCode: stringValue(json.failureCode) ?? "generation_attempt_failed",
    failureMessage: stringValue(json.failureMessage) ?? "--",
    attemptedRoute: stringValue(json.attemptedRoute) ?? "--",
    createdAtUtc: stringValue(json.createdAtUtc) ?? new Date(modifiedAtMs).toISOString(),
    createdAtAsiaShanghai: stringValue(json.createdAtAsiaShanghai) ?? "--",
    generatedImageCreated: booleanValue(json.generatedImageCreated) ?? false,
    generatedImagePath: normalizeProjectPath(stringValue(json.generatedImagePath)),
    automaticStorage: booleanValue(json.automaticStorage) ?? false,
    evidencePath: relativePath,
  } satisfies ConditionalRgbGenerationAttemptRecord
}

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function normalizeProjectPath(value: string | null) {
  if (!value) return null
  const normalized = value.replaceAll("\\", "/")
  const cwd = process.cwd().replaceAll("\\", "/")
  if (normalized.startsWith(`${cwd}/`)) return normalized.slice(cwd.length + 1)
  if (normalized.startsWith(".runtime/") || normalized.startsWith("data/")) return normalized
  return null
}
