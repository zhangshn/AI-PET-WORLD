import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  consumeOwnerAuthorization,
  OwnerAuthorizationCoreError,
  verifyOwnerAuthorization,
} from "../src/server/project-owner-authorization-core.mjs"

const root = process.cwd()
const runtimePath = path.join(root, ".runtime")
const holdPath = path.join(path.dirname(root), ".ai-pet-world-runtime-junction-production-build-hold")
const markerName = ".ai-pet-world-production-build-placeholder"
const markerPath = path.join(runtimePath, markerName)
const preparedPlaceholderPath = path.join(path.dirname(root), `.ai-pet-world-production-build-placeholder-${process.pid}`)
const backupPrefix = ".runtime-f-drive-backup-"
const backupHoldPrefix = ".ai-pet-world-production-build-hold--runtime-backup--"
const buildAction = "platform.production_build"
const buildRoute = "cli:scripts/build-next-production.mjs"

const runtimeState = inspectRuntimeState()
let authorization
try {
  authorization = verifyOwnerAuthorization({
    root,
    authorizationPath: process.env.AI_PET_WORLD_OWNER_AUTHORIZATION_PATH,
    providedSha256: process.env.AI_PET_WORLD_OWNER_AUTHORIZATION_SHA256,
    ownerCommandRef: process.env.AI_PET_WORLD_OWNER_COMMAND_REF,
    scope: process.env.AI_PET_WORLD_OWNER_AUTHORIZATION_SCOPE,
    expectation: {
      action: buildAction,
      method: "EXEC",
      route: buildRoute,
      target: runtimeState,
      payload: {
        executable: process.execPath,
        command: ["node_modules/next/dist/bin/next", "build", "--webpack"],
      },
    },
  })
  authorization.consumptionPath = consumeOwnerAuthorization(authorization, {
    root,
    consumptionRoot: "data/ai-painter/system-governance/owner-authorization-consumptions",
  })
} catch (error) {
  if (error instanceof OwnerAuthorizationCoreError) {
    console.error(JSON.stringify({ ok: false, status: "production_build_authorization_failed", code: error.code, message: error.message }, null, 2))
    process.exit(1)
  }
  throw error
}

recoverInterruptedBuild()
recoverInterruptedRuntimeBackups()

const runtimeRealPath = fs.realpathSync.native(runtimePath)
const runtimeIsExternal = !samePath(runtimeRealPath, runtimePath)

if (!runtimeIsExternal) {
  process.exit(runNextBuild())
}

if (fs.existsSync(holdPath)) {
  throw new Error(`Production build hold path already exists: ${holdPath}`)
}

let runtimeHeld = false
let placeholderPrepared = false
let heldRuntimeBackups = []
let exitCode = 1
try {
  prepareRuntimePlaceholder()
  placeholderPrepared = true
  fs.renameSync(runtimePath, holdPath)
  runtimeHeld = true
  fs.renameSync(preparedPlaceholderPath, runtimePath)
  placeholderPrepared = false
  heldRuntimeBackups = holdRuntimeBackups()
  exitCode = runNextBuild()
} finally {
  try {
    if (runtimeHeld) restoreRuntimeJunction()
  } finally {
    try {
      restoreRuntimeBackups(heldRuntimeBackups)
    } finally {
      if (placeholderPrepared && fs.existsSync(preparedPlaceholderPath)) fs.rmSync(preparedPlaceholderPath, { recursive: true })
    }
  }
}

process.exit(exitCode)

function runNextBuild() {
  const result = spawnSync(
    process.execPath,
    ["--max-old-space-size=16384", "node_modules/next/dist/bin/next", "build", "--webpack"],
    { cwd: root, env: process.env, stdio: "inherit" },
  )
  if (result.error) throw result.error
  return result.status ?? 1
}

function inspectRuntimeState() {
  return {
    workspaceRoot: path.resolve(root).replaceAll("\\", "/"),
    runtimePath: path.resolve(runtimePath).replaceAll("\\", "/"),
    runtimeExists: fs.existsSync(runtimePath),
    runtimeRealPath: fs.existsSync(runtimePath) ? fs.realpathSync.native(runtimePath).replaceAll("\\", "/") : null,
    interruptedHoldPresent: fs.existsSync(holdPath),
    placeholderPresent: fs.existsSync(markerPath),
  }
}

function recoverInterruptedBuild() {
  if (!fs.existsSync(holdPath)) return
  if (!fs.existsSync(runtimePath)) {
    fs.renameSync(holdPath, runtimePath)
    return
  }
  const entries = fs.readdirSync(runtimePath)
  if (!isSafeRuntimePlaceholder(entries)) {
    throw new Error(`Cannot recover runtime junction because placeholder contains unexpected files: ${entries.join(", ")}`)
  }
  const placeholderHold = `${runtimePath}.interrupted-placeholder-${process.pid}`
  fs.renameSync(runtimePath, placeholderHold)
  try {
    fs.renameSync(holdPath, runtimePath)
    fs.rmSync(placeholderHold, { recursive: true })
  } catch (error) {
    if (!fs.existsSync(runtimePath) && fs.existsSync(placeholderHold)) fs.renameSync(placeholderHold, runtimePath)
    throw error
  }
}

function prepareRuntimePlaceholder() {
  if (fs.existsSync(preparedPlaceholderPath)) {
    throw new Error(`Prepared production build placeholder already exists: ${preparedPlaceholderPath}`)
  }
  try {
    fs.mkdirSync(preparedPlaceholderPath)
    fs.writeFileSync(path.join(preparedPlaceholderPath, markerName), "runtime junction intentionally hidden during production build\n", { flag: "wx" })
  } catch (error) {
    if (fs.existsSync(preparedPlaceholderPath)) fs.rmSync(preparedPlaceholderPath, { recursive: true })
    throw error
  }
}

function recoverInterruptedRuntimeBackups() {
  const parent = path.dirname(root)
  const restored = []
  try {
    for (const entry of fs.readdirSync(parent)) {
      if (!entry.startsWith(backupHoldPrefix)) continue
      const originalName = entry.slice(backupHoldPrefix.length)
      const heldPath = path.join(parent, entry)
      const originalPath = path.join(root, originalName)
      if (fs.existsSync(originalPath)) throw new Error(`Cannot recover held runtime backup because destination exists: ${originalPath}`)
      fs.renameSync(heldPath, originalPath)
      restored.push({ heldPath, originalPath })
    }
  } catch (error) {
    for (const item of restored.toReversed()) {
      if (fs.existsSync(item.originalPath) && !fs.existsSync(item.heldPath)) fs.renameSync(item.originalPath, item.heldPath)
    }
    throw error
  }
}

function holdRuntimeBackups() {
  const parent = path.dirname(root)
  const held = []
  try {
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith(backupPrefix)) continue
      const source = path.join(root, entry)
      const destination = path.join(parent, `${backupHoldPrefix}${entry}`)
      if (fs.existsSync(destination)) throw new Error(`Runtime backup hold path already exists: ${destination}`)
      fs.renameSync(source, destination)
      held.push({ source, destination })
    }
    return held
  } catch (error) {
    restoreRuntimeBackups(held)
    throw error
  }
}

function restoreRuntimeBackups(held) {
  for (const entry of held.toReversed()) {
    if (fs.existsSync(entry.source)) throw new Error(`Cannot restore runtime backup because destination exists: ${entry.source}`)
    if (fs.existsSync(entry.destination)) fs.renameSync(entry.destination, entry.source)
  }
}

function restoreRuntimeJunction() {
  if (!fs.existsSync(runtimePath)) {
    fs.renameSync(holdPath, runtimePath)
    return
  }
  const entries = fs.readdirSync(runtimePath)
  if (!isSafeRuntimePlaceholder(entries)) {
    throw new Error(`Production build wrote unexpected runtime files; junction remains safely held at ${holdPath}`)
  }
  if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath)
  fs.rmdirSync(runtimePath)
  fs.renameSync(holdPath, runtimePath)
}

function isSafeRuntimePlaceholder(entries) {
  return entries.length === 0 || (entries.length === 1 && entries[0] === markerName)
}

function samePath(left, right) {
  const normalize = (value) => path.resolve(value).replaceAll("/", "\\").toLowerCase()
  return normalize(left) === normalize(right)
}
