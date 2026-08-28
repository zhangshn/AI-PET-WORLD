import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

const registryLogicalPath = "data/ai-console/registry/primary-registry-v1.json"

export const aiConsoleRegistryWorkspaceIdentities = [
  "training/overview",
  "training/plans",
  "training/models",
  "training/checkpoints",
  "training/runs",
  "reviews/current",
  "reviews/results",
  "reviews/evidence",
  "reviews/contracts",
  "reviews/failures",
  "archive/search",
  "archive/training",
  "archive/reviews",
  "archive/generations",
  "archive/contracts",
] as const

export type AiConsoleRegistryWorkspaceIdentity = (typeof aiConsoleRegistryWorkspaceIdentities)[number]

type AiConsolePrimaryRegistry = {
  schemaVersion: "ai_console_primary_registry_v1"
  registryIdentity: "ai_console_primary_registry"
  registryRevision: number
  writerIdentity: "ai_console_registry_bootstrap_v1" | "ai_console_registry_transaction_writer_v1"
  committedAtUtc: string
  sourceBoundary: "new_ai_console_only"
  recordSets: Record<AiConsoleRegistryWorkspaceIdentity, readonly Record<string, unknown>[]>
  registrySha256: string
}

export type AiConsoleRegistryWorkspaceRead =
  | {
      status: "connected"
      records: readonly Record<string, unknown>[]
      registryIdentity: string
      registryRevision: number
      writerIdentity: string
      committedAtUtc: string
      registrySha256: string
      evidenceReferences: readonly string[]
    }
  | {
      status: "not_connected" | "unknown_or_stale"
      reasonCode: string
      evidenceReferences: readonly string[]
    }

const allowedWriterIdentities = new Set([
  "ai_console_registry_bootstrap_v1",
  "ai_console_registry_transaction_writer_v1",
])

const expectedWorkspaceIdentitySet = new Set<string>(aiConsoleRegistryWorkspaceIdentities)

export async function readAiConsoleRegistryWorkspace(
  workspaceIdentity: string,
): Promise<AiConsoleRegistryWorkspaceRead> {
  if (!expectedWorkspaceIdentitySet.has(workspaceIdentity)) {
    return {
      status: "not_connected",
      reasonCode: "ai_console_registry_workspace_not_registered",
      evidenceReferences: [],
    }
  }

  const absoluteRegistryPath = path.join(process.cwd(), ...registryLogicalPath.split("/"))
  let rawRegistry: string
  try {
    rawRegistry = await readFile(absoluteRegistryPath, "utf8")
  } catch (error) {
    const reasonCode = isMissingFileError(error)
      ? "ai_console_primary_registry_not_connected"
      : "ai_console_primary_registry_read_failed"
    return {
      status: isMissingFileError(error) ? "not_connected" : "unknown_or_stale",
      reasonCode,
      evidenceReferences: [registryLogicalPath],
    }
  }

  let parsedRegistry: unknown
  try {
    parsedRegistry = JSON.parse(rawRegistry)
  } catch {
    return staleRegistry("ai_console_primary_registry_invalid_json")
  }

  const validationFailure = validateRegistry(parsedRegistry)
  if (validationFailure) return staleRegistry(validationFailure)

  const registry = parsedRegistry as AiConsolePrimaryRegistry
  const { registrySha256, ...unsignedRegistry } = registry
  const calculatedSha256 = createHash("sha256").update(JSON.stringify(unsignedRegistry), "utf8").digest("hex")
  if (calculatedSha256 !== registrySha256) {
    return staleRegistry("ai_console_primary_registry_sha256_mismatch")
  }

  return {
    status: "connected",
    records: registry.recordSets[workspaceIdentity as AiConsoleRegistryWorkspaceIdentity],
    registryIdentity: registry.registryIdentity,
    registryRevision: registry.registryRevision,
    writerIdentity: registry.writerIdentity,
    committedAtUtc: registry.committedAtUtc,
    registrySha256,
    evidenceReferences: [
      registryLogicalPath,
      "data/ai-console/schemas/ai-console-primary-registry-v1.schema.json",
    ],
  }
}

function validateRegistry(value: unknown): string | null {
  if (!isPlainRecord(value)) return "ai_console_primary_registry_invalid_shape"
  if (value.schemaVersion !== "ai_console_primary_registry_v1") return "ai_console_primary_registry_schema_mismatch"
  if (value.registryIdentity !== "ai_console_primary_registry") return "ai_console_primary_registry_identity_mismatch"
  if (!Number.isInteger(value.registryRevision) || Number(value.registryRevision) < 1) return "ai_console_primary_registry_revision_invalid"
  if (typeof value.writerIdentity !== "string" || !allowedWriterIdentities.has(value.writerIdentity)) return "ai_console_primary_registry_writer_untrusted"
  if (typeof value.committedAtUtc !== "string" || Number.isNaN(Date.parse(value.committedAtUtc)) || !value.committedAtUtc.endsWith("Z")) return "ai_console_primary_registry_timestamp_invalid"
  if (value.sourceBoundary !== "new_ai_console_only") return "ai_console_primary_registry_source_boundary_invalid"
  if (typeof value.registrySha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.registrySha256)) return "ai_console_primary_registry_sha256_invalid"
  if (!isPlainRecord(value.recordSets)) return "ai_console_primary_registry_record_sets_invalid"

  const actualWorkspaceIdentities = Object.keys(value.recordSets).sort()
  const expectedWorkspaceIdentities = [...aiConsoleRegistryWorkspaceIdentities].sort()
  if (JSON.stringify(actualWorkspaceIdentities) !== JSON.stringify(expectedWorkspaceIdentities)) {
    return "ai_console_primary_registry_workspace_set_mismatch"
  }

  for (const workspaceIdentity of aiConsoleRegistryWorkspaceIdentities) {
    const records = value.recordSets[workspaceIdentity]
    if (!Array.isArray(records) || records.some((record) => !isPlainRecord(record))) {
      return "ai_console_primary_registry_record_set_invalid"
    }
  }
  return null
}

function staleRegistry(reasonCode: string): AiConsoleRegistryWorkspaceRead {
  return {
    status: "unknown_or_stale",
    reasonCode,
    evidenceReferences: [registryLogicalPath],
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isMissingFileError(error: unknown): boolean {
  return isPlainRecord(error) && error.code === "ENOENT"
}
