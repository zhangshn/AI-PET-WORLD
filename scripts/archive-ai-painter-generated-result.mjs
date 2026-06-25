import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const cwd = process.cwd()
const archiveRoot = path.join(cwd, ".runtime", "ai-painter", "generated-results")
const indexPath = path.join(archiveRoot, "index.json")

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const id = buildResultId(args)
  const reviewStatus = requireEnum(args.status, ["failed", "candidate", "approved"], "--status")
  const imageFile = requireArg(args.image, "--image")
  const summaryFile = args.summary
  const diagnosisFile = args.diagnosis ?? summaryFile

  const archivedImage = path.join(archiveRoot, "images", `${id}.png`)
  const archivedSummary = summaryFile ? path.join(archiveRoot, "summaries", `${id}.json`) : ""
  const archivedDiagnosis = diagnosisFile ? path.join(archiveRoot, "diagnoses", `${id}.json`) : ""
  const archivedQualityGate = args.qualityGate ? path.join(archiveRoot, "quality-gates", `${id}.json`) : ""

  await ensureNotExists(archivedImage)
  await mkdir(path.dirname(archivedImage), { recursive: true })
  await copyFile(resolveWorkspaceFile(imageFile), archivedImage)

  if (summaryFile) await copyJsonFile(summaryFile, archivedSummary)
  if (diagnosisFile) await copyJsonFile(diagnosisFile, archivedDiagnosis)
  if (args.qualityGate) await copyJsonFile(args.qualityGate, archivedQualityGate)

  const index = await readIndex()
  index.results = index.results.filter((result) => result.id !== id)
  index.results.unshift({
    id,
    stage: requireArg(args.stage, "--stage"),
    title: requireArg(args.title, "--title"),
    description: requireArg(args.description, "--description"),
    reviewStatus,
    imageFile: toWorkspaceRelative(archivedImage),
    sourceFile: toWorkspaceRelative(resolveWorkspaceFile(imageFile)),
    summaryFile: archivedSummary ? toWorkspaceRelative(archivedSummary) : "",
    diagnosisFile: archivedDiagnosis ? toWorkspaceRelative(archivedDiagnosis) : "",
    qualityGateFile: archivedQualityGate ? toWorkspaceRelative(archivedQualityGate) : undefined,
  })
  index.updatedAt = new Date().toISOString()

  await mkdir(archiveRoot, { recursive: true })
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")

  console.log(JSON.stringify({ id, status: "archived", index: toWorkspaceRelative(indexPath) }, null, 2))
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`)
    const value = argv[i + 1]
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`)
    args[key.slice(2)] = value
    i += 1
  }
  return args
}

function buildResultId(args) {
  if (args.id) return normalizeId(args.id)
  const prefix = normalizeId(args.idPrefix ?? args.stage ?? "ai-painter-result")
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "z").toLowerCase()
  return `${prefix}-${stamp}`
}

function normalizeId(value) {
  const id = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  if (!id) throw new Error("Result id is empty after normalization.")
  if (!/^[a-z0-9_-]+$/.test(id)) throw new Error(`Invalid result id: ${id}`)
  return id
}

async function ensureNotExists(file) {
  try {
    await stat(file)
    throw new Error(`Archive target already exists; choose another id: ${toWorkspaceRelative(file)}`)
  } catch (error) {
    if (error?.code === "ENOENT") return
    throw error
  }
}

async function copyJsonFile(source, target) {
  const resolved = resolveWorkspaceFile(source)
  JSON.parse(await readFile(resolved, "utf8"))
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(resolved, target)
}

async function readIndex() {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8"))
    return {
      schemaVersion: "ai-painter-generated-results-index-v1",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      results: Array.isArray(parsed.results) ? parsed.results : [],
    }
  } catch {
    return { schemaVersion: "ai-painter-generated-results-index-v1", updatedAt: "", results: [] }
  }
}

function requireArg(value, name) {
  if (!value) throw new Error(`Missing required argument: ${name}`)
  return value
}

function requireEnum(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`${name} must be one of: ${allowed.join(", ")}`)
  return value
}

function resolveWorkspaceFile(file) {
  const resolved = path.resolve(cwd, file)
  const relative = path.relative(cwd, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`File is outside workspace: ${file}`)
  }
  return resolved
}

function toWorkspaceRelative(file) {
  return path.relative(cwd, file).replace(/\\/g, "/")
}
