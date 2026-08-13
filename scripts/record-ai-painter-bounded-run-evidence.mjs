import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { indexArtifact, indexProgramEvent } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const args = parseArgs(process.argv.slice(2))
const root = process.cwd()
const runRoot = resolveLogical(args.runRoot)
const terminal = resolveLogical(args.terminal)
if (!fs.statSync(runRoot).isDirectory()) throw new Error("run root is not a directory")
if (!fs.statSync(terminal).isFile()) throw new Error("terminal is not a file")
const terminalValue = JSON.parse(fs.readFileSync(terminal, "utf8"))
const timestamp = terminalValue.recordedAtUtc ?? new Date().toISOString()
const status = terminalValue.status ?? "unknown"
const eventLedger = path.join(runRoot, "program-event.json")
if (fs.existsSync(eventLedger)) throw new Error("program event already exists")
const event = {
  id: `${args.runId}:${args.kind}`,
  timestamp,
  action: args.action,
  runId: args.runId,
  kind: args.kind,
  status,
  title: args.title,
  titleZh: args.titleZh,
  evidencePath: logicalProjectPath(terminal),
  terminalSha256: sha256(terminal),
}
fs.writeFileSync(eventLedger, `${JSON.stringify(event, null, 2)}\n`, { encoding: "utf8", flag: "wx" })

for (const file of walk(runRoot)) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: args.runId,
    artifactType: args.kind,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256(file),
  })
}
indexProgramEvent(event)
process.stdout.write(`${JSON.stringify({ status: "indexed", runId: args.runId, event, eventLedger: logicalProjectPath(eventLedger) }, null, 2)}\n`)

function parseArgs(values) {
  const result = {}
  for (let i = 0; i < values.length; i += 2) {
    const name = values[i]
    if (!name?.startsWith("--") || !values[i + 1]) throw new Error(`invalid argument: ${name}`)
    result[name.slice(2)] = values[i + 1]
  }
  for (const name of ["runRoot", "terminal", "runId", "kind", "action", "title", "titleZh"]) {
    if (!result[name]) throw new Error(`--${name} is required`)
  }
  return result
}

function resolveLogical(value) {
  if (path.isAbsolute(value)) throw new Error("absolute logical path is forbidden")
  const normalized = value.replaceAll("\\", "/")
  const resolved = normalized === ".runtime" || normalized.startsWith(".runtime/")
    ? path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime", normalized.slice(".runtime/".length))
    : path.resolve(root, value)
  const permitted = resolved.startsWith(path.resolve(root) + path.sep)
    || resolved.startsWith(path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime") + path.sep)
  if (!permitted) throw new Error("logical path escapes registered storage")
  return resolved
}

function walk(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(child))
    else if (entry.isFile()) files.push(child)
  }
  return files
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}
