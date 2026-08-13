import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const STAGE4_EVIDENCE_ELIGIBILITY_SCHEMA =
  "ai-painter-stage4-execution-evidence-eligibility-registry-v1"

const HISTORICAL_STATUS_MARKERS = Object.freeze([
  "failed",
  "failure",
  "exited",
  "superseded",
  "partial",
  "cancelled",
  "rejected",
  "blocked",
])

const SUCCESS_STATUS_MARKERS = Object.freeze(["passed", "succeeded", "success"])

export function classifyTerminalForExecution(status) {
  const normalized = String(status ?? "").trim().toLowerCase()
  if (!normalized) return "unknown_fail_closed"
  if (HISTORICAL_STATUS_MARKERS.some((marker) => normalized.includes(marker))) {
    return "historical_readonly"
  }
  if (SUCCESS_STATUS_MARKERS.some((marker) => normalized.includes(marker))) {
    return "success_terminal"
  }
  return "unknown_fail_closed"
}

export function buildStage4EvidenceEligibilityRegistry({
  root = process.cwd(),
  registryId,
  authorization,
  reusableEvidence,
  historicalEvidence,
  discoveredHistoricalEvidence = [],
  recordedAtUtc = new Date().toISOString(),
}) {
  assert(/^[0-9]{8}-[0-9]{9}$/.test(registryId), "stage4 evidence registry id is invalid")
  assert(authorization?.path && authorization?.sha256, "stage4 evidence registry authorization is missing")
  verifyFile(root, authorization.path, authorization.sha256, "registry authorization")
  assert(Array.isArray(reusableEvidence) && reusableEvidence.length > 0, "reusable evidence list is empty")
  assert(Array.isArray(historicalEvidence), "historical evidence list is invalid")
  assert(Array.isArray(discoveredHistoricalEvidence), "discovered historical evidence list is invalid")

  const canonicalRoot = `.runtime/ai-painter/stage4-execution-evidence-eligibility/${registryId}/canonical`
  const roles = {}
  const seenCanonicalNames = new Set()
  for (const item of reusableEvidence) {
    assertRole(item.role)
    assert(!roles[item.role], `duplicate reusable evidence role: ${item.role}`)
    const terminal = verifySuccessTerminal(root, item.successTerminal)
    const source = verifyFile(root, item.source.path, item.source.sha256, `reusable evidence ${item.role}`)
    verifyRegistrationChain(root, item.successTerminal, item.registrationChain ?? [], item.source)
    const extension = path.extname(source.absolutePath) || ".bin"
    const canonicalName = `${safeRole(item.role)}-${item.source.sha256}${extension}`
    assert(!seenCanonicalNames.has(canonicalName), `duplicate canonical evidence name: ${canonicalName}`)
    seenCanonicalNames.add(canonicalName)
    const canonicalPath = `${canonicalRoot}/${canonicalName}`
    roles[item.role] = {
      disposition: "active_reusable_success_evidence",
      canonicalPath,
      sha256: item.source.sha256,
      sourceHistoricalPath: normalizeProjectPath(item.source.path),
      successTerminal: terminal,
    }
  }

  const historical = [...historicalEvidence, ...discoveredHistoricalEvidence].map((item) => {
    const terminalPath = normalizeProjectPath(item.terminal.path)
    const terminalValue = readVerifiedJson(root, terminalPath, item.terminal.sha256, "historical terminal")
    const disposition = classifyTerminalForExecution(terminalValue.status)
    assert(disposition === "historical_readonly", `historical terminal is not failed/exited/partial: ${terminalPath}`)
    return {
      disposition,
      terminalPath,
      terminalSha256: item.terminal.sha256,
      terminalStatus: terminalValue.status,
      runRoot: normalizeProjectPath(item.runRoot),
      executionUseAllowed: false,
      analysisReadAllowed: true,
    }
  })
  const uniqueHistorical = [...new Map(historical.map((item) => [item.terminalPath, item])).values()]

  return {
    schemaVersion: STAGE4_EVIDENCE_ELIGIBILITY_SCHEMA,
    registryId,
    status: "stage4_execution_evidence_eligibility_registered",
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    authorization,
    policy: {
      executionRequiresCanonicalPath: true,
      sha256AloneNeverSelectsEvidence: true,
      siblingPathInferenceForbidden: true,
      failedExitedPartialSupersededExecutionUseAllowed: false,
      historicalAnalysisReadAllowed: true,
      ambiguousResolutionFailsClosed: true,
      unknownTerminalStatusFailsClosed: true,
    },
    roles,
    historical: uniqueHistorical,
  }
}

export function discoverStage4HistoricalEvidence({
  root = process.cwd(),
  searchRoots = [".runtime/ai-painter"],
} = {}) {
  const results = []
  for (const searchRoot of searchRoots) {
    const absoluteRoot = resolveInsideRoot(root, searchRoot)
    if (!fs.existsSync(absoluteRoot)) continue
    walk(absoluteRoot, (absolutePath) => {
      if (path.basename(absolutePath).toLowerCase() !== "phase-terminal.json") return
      const logicalPath = normalizeProjectPath(path.relative(root, absolutePath))
      if (!logicalPath.toLowerCase().includes("stage4")) return
      let value
      try { value = JSON.parse(fs.readFileSync(absolutePath, "utf8")) } catch { return }
      if (classifyTerminalForExecution(value.status) !== "historical_readonly") return
      results.push({
        runRoot: normalizeProjectPath(path.dirname(logicalPath)),
        terminal: { path: logicalPath, sha256: sha256File(absolutePath) },
      })
    })
  }
  return results.sort((left, right) => left.terminal.path.localeCompare(right.terminal.path))
}

function verifyRegistrationChain(root, terminalBinding, chain, sourceBinding) {
  if (
    normalizeProjectPath(terminalBinding.path) === normalizeProjectPath(sourceBinding.path)
    && terminalBinding.sha256 === sourceBinding.sha256
  ) return
  const registrars = [terminalBinding, ...chain]
  const targets = [...chain, sourceBinding]
  assert(registrars.length === targets.length, "evidence registration chain is invalid")
  for (let index = 0; index < registrars.length; index += 1) {
    const registrar = readVerifiedJson(
      root,
      registrars[index].path,
      registrars[index].sha256,
      `evidence registrar ${index}`,
    )
    const expected = {
      path: normalizeProjectPath(targets[index].path),
      sha256: targets[index].sha256,
    }
    assert(
      containsExactBinding(registrar, expected),
      `evidence is not explicitly registered by its lineage: ${expected.path}`,
    )
  }
}

function containsExactBinding(value, expected) {
  if (!value || typeof value !== "object") return false
  if (
    normalizeProjectPath(value.path) === expected.path
    && value.sha256 === expected.sha256
  ) return true
  for (const [key, candidatePath] of Object.entries(value)) {
    if (!key.endsWith("Path") || typeof candidatePath !== "string") continue
    const prefix = key.slice(0, -"Path".length)
    if (!prefix) continue
    const sha256Key = `${prefix}Sha256`
    if (
      Object.prototype.hasOwnProperty.call(value, sha256Key)
      && normalizeProjectPath(candidatePath) === expected.path
      && value[sha256Key] === expected.sha256
    ) return true
  }
  return Object.values(value).some((child) => containsExactBinding(child, expected))
}

export function materializeStage4EvidenceRegistry({ root = process.cwd(), registry, registryPath }) {
  assert(registry?.schemaVersion === STAGE4_EVIDENCE_ELIGIBILITY_SCHEMA, "stage4 evidence registry schema changed")
  const registryAbsolute = resolveInsideRoot(root, registryPath)
  assert(!fs.existsSync(registryAbsolute), "stage4 evidence registry already exists")
  fs.mkdirSync(path.dirname(registryAbsolute), { recursive: true })
  for (const entry of Object.values(registry.roles)) {
    const source = resolveInsideRoot(root, entry.sourceHistoricalPath)
    const destination = resolveInsideRoot(root, entry.canonicalPath)
    assert(!fs.existsSync(destination), `canonical evidence already exists: ${entry.canonicalPath}`)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
    assert(sha256File(destination) === entry.sha256, `canonical evidence hash mismatch: ${entry.canonicalPath}`)
  }
  writeExclusiveJson(registryAbsolute, registry)
  return {
    path: normalizeProjectPath(path.relative(root, registryAbsolute)),
    sha256: sha256File(registryAbsolute),
  }
}

export function validateStage4ExecutionEvidenceBinding({
  root = process.cwd(),
  registryPath,
  registrySha256,
  role,
  binding,
}) {
  assertRole(role)
  const registry = readVerifiedJson(root, registryPath, registrySha256, "execution evidence registry")
  assert(registry.schemaVersion === STAGE4_EVIDENCE_ELIGIBILITY_SCHEMA, "execution evidence registry schema changed")
  assert(registry.status === "stage4_execution_evidence_eligibility_registered", "execution evidence registry is inactive")
  assert(registry.policy?.executionRequiresCanonicalPath === true, "canonical execution evidence policy is disabled")
  assert(registry.policy?.sha256AloneNeverSelectsEvidence === true, "SHA-only evidence selection is enabled")
  const entry = registry.roles?.[role]
  assert(entry?.disposition === "active_reusable_success_evidence", `execution evidence role is not reusable: ${role}`)
  const actualPath = normalizeProjectPath(binding?.path)
  assert(actualPath === entry.canonicalPath, `execution evidence must use canonical registered path: ${role}`)
  assert(binding?.sha256 === entry.sha256, `execution evidence SHA-256 changed: ${role}`)
  verifySuccessTerminal(root, entry.successTerminal)
  verifyFile(root, entry.canonicalPath, entry.sha256, `canonical execution evidence ${role}`)
  for (const historical of registry.historical ?? []) {
    const runRoot = `${historical.runRoot.replace(/\/$/, "")}/`
    assert(!`${actualPath}/`.startsWith(runRoot), `historical evidence path cannot drive execution: ${role}`)
  }
  return { role, path: actualPath, sha256: entry.sha256, disposition: entry.disposition }
}

function verifySuccessTerminal(root, binding) {
  const value = readVerifiedJson(root, binding?.path, binding?.sha256, "success terminal")
  const disposition = classifyTerminalForExecution(value.status)
  assert(disposition === "success_terminal", `evidence source terminal is not successful: ${binding?.path}`)
  return {
    path: normalizeProjectPath(binding.path),
    sha256: binding.sha256,
    status: value.status,
  }
}

function readVerifiedJson(root, value, expectedSha256, label) {
  const verified = verifyFile(root, value, expectedSha256, label)
  return JSON.parse(fs.readFileSync(verified.absolutePath, "utf8"))
}

function verifyFile(root, value, expectedSha256, label) {
  const normalized = normalizeProjectPath(value)
  const absolutePath = resolveInsideRoot(root, normalized)
  assert(fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(), `${label} is missing: ${normalized}`)
  assert(/^[a-f0-9]{64}$/.test(expectedSha256 ?? ""), `${label} SHA-256 is invalid`)
  assert(sha256File(absolutePath) === expectedSha256, `${label} SHA-256 changed: ${normalized}`)
  return { path: normalized, absolutePath }
}

function resolveInsideRoot(root, value) {
  assert(typeof value === "string" && value.length > 0, "project evidence path is missing")
  assert(!path.isAbsolute(value), `absolute evidence path is forbidden: ${value}`)
  const normalizedRoot = path.resolve(root)
  const absolute = path.resolve(normalizedRoot, value)
  const relative = path.relative(normalizedRoot, absolute)
  assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `evidence path escapes project: ${value}`)
  return absolute
}

function normalizeProjectPath(value) {
  return String(value ?? "").replaceAll("\\", "/")
}

function safeRole(role) {
  return role.replace(/[^a-zA-Z0-9._-]/g, "-")
}

function assertRole(role) {
  assert(/^[a-z][a-zA-Z0-9.]{2,127}$/.test(role ?? ""), `invalid evidence role: ${role}`)
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function writeExclusiveJson(value, body) {
  const fd = fs.openSync(value, "wx")
  try {
    fs.writeFileSync(fd, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

function walk(directory, callback) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(child, callback)
    else if (entry.isFile()) callback(child)
  }
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
