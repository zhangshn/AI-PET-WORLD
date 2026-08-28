import { initializeCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const args = parseArgs(process.argv.slice(2))
const required = [
  "current-task-capsule",
  "current-task-terminal",
  "current-candidate",
  "latest-training-terminal",
]
for (const key of required) {
  if (!args.get(key)?.[0]) throw new Error(`missing_argument_${key}`)
}

const result = await initializeCurrentExecutionRegistry({
  currentTaskCapsulePath: args.get("current-task-capsule")[0],
  currentTaskTerminalPath: args.get("current-task-terminal")[0],
  currentCandidatePath: args.get("current-candidate")[0],
  latestTrainingTerminalPath: args.get("latest-training-terminal")[0],
  archivedEvidenceNamespaces: args.get("archive-namespace") ?? [],
})

if (!result.ok) throw new Error(result.errorCode ?? "current_execution_registry_migration_failed")
process.stdout.write(`${JSON.stringify({
  status: "current_execution_registry_migrated",
  registryRevision: result.registry?.registryRevision,
  currentTaskId: result.registry?.taskId,
  currentRunId: result.registry?.runId,
  latestTrainingRunId: result.registry?.latestTrainingTerminal?.runId,
  archivedNamespaces: result.archivedNamespaces,
  registrySha256: result.registrySha256,
}, null, 2)}\n`)

function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith("--")) throw new Error(`unexpected_argument_${value}`)
    const key = value.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith("--")) throw new Error(`missing_argument_value_${key}`)
    parsed.set(key, [...(parsed.get(key) ?? []), next])
    index += 1
  }
  return parsed
}
