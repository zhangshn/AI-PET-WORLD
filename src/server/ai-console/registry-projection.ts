import type { AiConsoleWorkspaceDefinition, AiConsoleWorkspaceField } from "@/app/ai-console/ai-console-workspace-catalog"
import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { readAiConsoleRegistryWorkspace } from "./registry-store"

const registeredModules = new Set(["training", "reviews", "archive"])

export function getAiConsolePrimaryRegistryProjectionAvailability(
  moduleSlug: string,
): "connected" | "not_connected" {
  return registeredModules.has(moduleSlug) ? "connected" : "not_connected"
}

export async function queryAiConsolePrimaryRegistryProjection(
  workspace: AiConsoleWorkspaceDefinition,
): Promise<AiConsoleProjectionResult> {
  const workspaceIdentity = `${workspace.moduleSlug}/${workspace.slug}`
  const registryRead = await readAiConsoleRegistryWorkspace(workspaceIdentity)
  if (registryRead.status !== "connected") {
    if (registryRead.status === "not_connected") {
      return createNotConnectedProjection(registryRead.reasonCode)
    }
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_primary_registry",
      writerIdentity: "ai_console_primary_registry_reader_v1",
      reasonCode: registryRead.reasonCode,
      evidenceReferences: registryRead.evidenceReferences,
    })
  }

  const recordFailure = validateWorkspaceRecords(registryRead.records, workspace.fields)
  if (recordFailure) {
    return createUnknownOrStaleProjection({
      sourceIdentity: registryRead.registryIdentity,
      writerIdentity: registryRead.writerIdentity,
      reasonCode: recordFailure,
      evidenceReferences: registryRead.evidenceReferences,
    })
  }

  return createProjection({
    sourceIdentity: registryRead.registryIdentity,
    writerIdentity: registryRead.writerIdentity,
    observedAtUtc: registryRead.committedAtUtc,
    sourceRevision: registryRead.registryRevision,
    evidenceReferences: [
      ...registryRead.evidenceReferences,
      `sha256:${registryRead.registrySha256}`,
    ],
    trustStatus: "verified_registry",
    records: registryRead.records,
  })
}

function validateWorkspaceRecords(
  records: readonly Record<string, unknown>[],
  fields: readonly AiConsoleWorkspaceField[],
): string | null {
  const fieldByName = new Map(fields.map((field) => [field.canonicalName, field]))
  for (const record of records) {
    if (Object.keys(record).some((fieldName) => !fieldByName.has(fieldName))) {
      return "ai_console_primary_registry_unregistered_field"
    }
    for (const field of fields) {
      const value = record[field.canonicalName]
      if (value === null || value === undefined) {
        if (!field.nullable) return "ai_console_primary_registry_required_field_missing"
        continue
      }
      if (!matchesFieldType(value, field)) {
        return "ai_console_primary_registry_field_type_mismatch"
      }
    }
  }
  return null
}

function matchesFieldType(value: unknown, field: AiConsoleWorkspaceField): boolean {
  if (field.dataType === "integer") return typeof value === "number" && Number.isInteger(value)
  if (field.dataType === "scalar") return typeof value === "number" && Number.isFinite(value)
  if (field.dataType === "boolean") return typeof value === "boolean"
  if (field.dataType === "structured") return typeof value === "object" && value !== null
  if (field.dataType === "sha256") return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
  if (field.dataType === "timestamp_utc") return typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value))
  return typeof value === "string" && value.length > 0
}
