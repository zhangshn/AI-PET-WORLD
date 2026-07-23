import { createHash } from "node:crypto"
import fs from "node:fs"
import { opendir, readFile, rename, stat, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import {
  catalogPath,
  dataRoot,
  ensureStorageRoots,
  isInside,
  migrationsRoot,
  physicalRuntimeRoot,
  projectRoot,
  projectRuntimeRoot,
} from "./lib/ai-pet-world-storage.mjs"
import { closeStorageCatalog, inferRunId, openStorageCatalog, upsertStorageMeta } from "./lib/ai-pet-world-storage-catalog.mjs"

const mode = process.argv.includes("--activate") ? "activate" : process.argv.includes("--verify-only") ? "verify" : "copy"
const requestedMigrationId = argumentValue("--migration-id")
const migrationId = requestedMigrationId ?? `runtime-to-d-${new Date().toISOString().replace(/[:.]/g, "-")}`
const evidenceDir = path.join(migrationsRoot, migrationId)
const manifestPath = path.join(evidenceDir, "migration-manifest.json")

ensureStorageRoots()
assertPathBoundaries()

if (mode === "activate") {
  await activateVerifiedMigration()
} else {
  await copyAndVerify()
}

async function copyAndVerify() {
  await assertNoActiveTraining()
  fs.mkdirSync(evidenceDir, { recursive: true })
  const startedAtUtc = new Date().toISOString()
  writeMigrationRun({ status: mode === "copy" ? "copying" : "verifying", startedAtUtc })
  if (mode === "copy") await runRobocopy()

  const db = openStorageCatalog()
  db.exec("DELETE FROM migration_file_checks WHERE migration_id = " + sqlString(migrationId))
  const source = await scanSource(db)
  const destination = await scanDestination(db)
  const missingRows = db.prepare(`SELECT COUNT(*) AS count FROM migration_file_checks WHERE migration_id=? AND verified=0`).get(migrationId)
  const mismatchCount = Number(missingRows.count)
  const manifestSha256 = buildManifestHash(db)
  const status = mismatchCount === 0 && source.fileCount === destination.fileCount && source.bytes === destination.bytes
    ? "verified_pending_activation"
    : "verification_failed"
  const finishedAtUtc = new Date().toISOString()
  const manifest = {
    schemaVersion: "ai-pet-world-data-store-migration-v1",
    migrationId,
    status,
    sourceRoot: projectRuntimeRoot,
    destinationRoot: physicalRuntimeRoot,
    catalogPath,
    startedAtUtc,
    finishedAtUtc,
    source,
    destination,
    mismatchCount,
    manifestSha256,
    activationAllowed: status === "verified_pending_activation",
    sourceDeletionAllowed: false,
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8")
  writeMigrationRun({
    status,
    startedAtUtc,
    finishedAtUtc,
    source,
    destination,
    mismatchCount,
    manifestSha256,
    detail: { manifestPath },
  })
  upsertStorageMeta("active_migration_id", migrationId)
  upsertStorageMeta("physical_runtime_root", physicalRuntimeRoot)
  closeStorageCatalog()
  console.log(JSON.stringify(manifest, null, 2))
  if (status !== "verified_pending_activation") process.exitCode = 2
}

async function scanSource(db) {
  console.log(`[migration] hashing source ${projectRuntimeRoot}`)
  const insert = db.prepare(`
    INSERT INTO migration_file_checks(migration_id, logical_path, source_bytes, source_modified_ms, source_sha256)
    VALUES (?, ?, ?, ?, ?)
  `)
  let fileCount = 0
  let bytes = 0
  let batchCount = 0
  db.exec("BEGIN")
  for await (const files of walkFileBatches(projectRuntimeRoot)) {
    const rows = await Promise.all(files.map(async (file) => ({ file, info: await stat(file), sha256: await hashFile(file) })))
    for (const { file, info, sha256 } of rows) {
      const relative = path.relative(projectRuntimeRoot, file).replace(/\\/g, "/")
      const logicalPath = `.runtime/${relative}`
      insert.run(migrationId, logicalPath, info.size, Math.trunc(info.mtimeMs), sha256)
      fileCount += 1
      bytes += info.size
      batchCount += 1
      if (batchCount >= 1000) {
        db.exec("COMMIT; BEGIN")
        batchCount = 0
      }
      if (fileCount % 10000 === 0) console.log(`[migration] source ${fileCount} files / ${bytes} bytes`)
    }
  }
  db.exec("COMMIT")
  return { fileCount, bytes }
}

async function scanDestination(db) {
  console.log(`[migration] hashing destination ${physicalRuntimeRoot}`)
  const lookup = db.prepare(`SELECT source_bytes, source_sha256 FROM migration_file_checks WHERE migration_id=? AND logical_path=?`)
  const update = db.prepare(`
    UPDATE migration_file_checks
    SET destination_bytes=?, destination_modified_ms=?, destination_sha256=?, verified=?, error=?
    WHERE migration_id=? AND logical_path=?
  `)
  const insertDestinationOnly = db.prepare(`
    INSERT INTO migration_file_checks(migration_id, logical_path, source_bytes, source_modified_ms, source_sha256, destination_bytes, destination_modified_ms, destination_sha256, verified, error)
    VALUES (?, ?, 0, 0, '', ?, ?, ?, 0, 'destination_only')
  `)
  const upsertArtifact = db.prepare(`
    INSERT INTO artifacts(logical_path, physical_uri, storage_layer, run_id, artifact_type, byte_size, modified_at_utc, sha256, migration_id, indexed_at_utc)
    VALUES (?, ?, 'hot', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(logical_path) DO UPDATE SET
      physical_uri=excluded.physical_uri,
      storage_layer='hot',
      run_id=excluded.run_id,
      artifact_type=excluded.artifact_type,
      byte_size=excluded.byte_size,
      modified_at_utc=excluded.modified_at_utc,
      sha256=excluded.sha256,
      migration_id=excluded.migration_id,
      indexed_at_utc=excluded.indexed_at_utc
  `)
  let fileCount = 0
  let bytes = 0
  let batchCount = 0
  db.exec("BEGIN")
  for await (const files of walkFileBatches(physicalRuntimeRoot)) {
    const rows = await Promise.all(files.map(async (file) => ({ file, info: await stat(file), sha256: await hashFile(file) })))
    for (const { file, info, sha256 } of rows) {
      const relative = path.relative(physicalRuntimeRoot, file).replace(/\\/g, "/")
      const logicalPath = `.runtime/${relative}`
      const source = lookup.get(migrationId, logicalPath)
      const verified = source && Number(source.source_bytes) === info.size && source.source_sha256 === sha256 ? 1 : 0
      const error = !source ? "destination_only" : Number(source.source_bytes) !== info.size ? "byte_size_mismatch" : source.source_sha256 !== sha256 ? "sha256_mismatch" : null
      if (source) update.run(info.size, Math.trunc(info.mtimeMs), sha256, verified, error, migrationId, logicalPath)
      else insertDestinationOnly.run(migrationId, logicalPath, info.size, Math.trunc(info.mtimeMs), sha256)
      upsertArtifact.run(
        logicalPath,
        file,
        inferRunId(logicalPath),
        artifactType(logicalPath),
        info.size,
        info.mtime.toISOString(),
        sha256,
        migrationId,
        new Date().toISOString(),
      )
      fileCount += 1
      bytes += info.size
      batchCount += 1
      if (batchCount >= 1000) {
        db.exec("COMMIT; BEGIN")
        batchCount = 0
      }
      if (fileCount % 10000 === 0) console.log(`[migration] destination ${fileCount} files / ${bytes} bytes`)
    }
  }
  db.exec("COMMIT")
  return { fileCount, bytes }
}

async function activateVerifiedMigration() {
  if (!requestedMigrationId) throw new Error("--activate requires --migration-id")
  await assertNoActiveTraining()
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  if (manifest.status !== "verified_pending_activation" || manifest.mismatchCount !== 0) {
    throw new Error(`migration is not verified: ${manifest.status}`)
  }
  const runtimeInfo = await fs.promises.lstat(projectRuntimeRoot)
  if (runtimeInfo.isSymbolicLink()) throw new Error("project .runtime is already a link")
  const backupRoot = path.join(projectRoot, `.runtime-f-drive-backup-${migrationId}`)
  if (!isInside(backupRoot, projectRoot) || !isInside(physicalRuntimeRoot, dataRoot)) throw new Error("activation path boundary failed")
  if (fs.existsSync(backupRoot)) throw new Error(`backup already exists: ${backupRoot}`)
  await rename(projectRuntimeRoot, backupRoot)
  try {
    await symlink(physicalRuntimeRoot, projectRuntimeRoot, "junction")
  } catch (error) {
    await rename(backupRoot, projectRuntimeRoot)
    throw error
  }
  const activatedAtUtc = new Date().toISOString()
  const activated = { ...manifest, status: "activated", activatedAtUtc, backupRoot, sourceDeletionAllowed: false }
  await writeFile(manifestPath, JSON.stringify(activated, null, 2) + "\n", "utf8")
  writeMigrationRun({
    status: "activated",
    startedAtUtc: manifest.startedAtUtc,
    finishedAtUtc: activatedAtUtc,
    source: manifest.source,
    destination: manifest.destination,
    mismatchCount: 0,
    manifestSha256: manifest.manifestSha256,
    detail: { manifestPath, backupRoot },
  })
  upsertStorageMeta("active_migration_id", migrationId)
  upsertStorageMeta("active_runtime_root", physicalRuntimeRoot)
  upsertStorageMeta("f_drive_backup_root", backupRoot)
  closeStorageCatalog()
  console.log(JSON.stringify(activated, null, 2))
}

async function runRobocopy() {
  console.log(`[migration] copying ${projectRuntimeRoot} -> ${physicalRuntimeRoot}`)
  const args = [projectRuntimeRoot, physicalRuntimeRoot, "/E", "/COPY:DAT", "/DCOPY:DAT", "/R:2", "/W:1", "/MT:16", "/XJ", "/NP", "/NFL", "/NDL", "/TEE", `/LOG:${path.join(evidenceDir, "robocopy.log")}`]
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn("robocopy", args, { stdio: "inherit", windowsHide: true })
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 16))
  })
  if (exitCode >= 8) throw new Error(`robocopy failed with exit code ${exitCode}`)
}

async function assertNoActiveTraining() {
  const statePath = path.join(projectRuntimeRoot, "ai-painter", "training-control", "state.json")
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"))
    if (state.status === "running") throw new Error(`training is active: ${state.action ?? "unknown"}`)
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message.startsWith("training is active"))) throw error
  }
}

function writeMigrationRun(input) {
  const db = openStorageCatalog()
  db.prepare(`
    INSERT INTO migration_runs(migration_id, status, source_root, destination_root, started_at_utc, finished_at_utc, source_file_count, source_bytes, destination_file_count, destination_bytes, verified_file_count, mismatch_count, manifest_sha256, detail_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(migration_id) DO UPDATE SET
      status=excluded.status,
      finished_at_utc=excluded.finished_at_utc,
      source_file_count=excluded.source_file_count,
      source_bytes=excluded.source_bytes,
      destination_file_count=excluded.destination_file_count,
      destination_bytes=excluded.destination_bytes,
      verified_file_count=excluded.verified_file_count,
      mismatch_count=excluded.mismatch_count,
      manifest_sha256=excluded.manifest_sha256,
      detail_json=excluded.detail_json
  `).run(
    migrationId,
    input.status,
    projectRuntimeRoot,
    physicalRuntimeRoot,
    input.startedAtUtc,
    input.finishedAtUtc ?? null,
    input.source?.fileCount ?? 0,
    input.source?.bytes ?? 0,
    input.destination?.fileCount ?? 0,
    input.destination?.bytes ?? 0,
    input.destination?.fileCount && input.mismatchCount === 0 ? input.destination.fileCount : 0,
    input.mismatchCount ?? 0,
    input.manifestSha256 ?? null,
    JSON.stringify(input.detail ?? {}),
  )
}

function buildManifestHash(db) {
  const hash = createHash("sha256")
  for (const row of db.prepare(`SELECT logical_path, source_bytes, source_sha256 FROM migration_file_checks WHERE migration_id=? ORDER BY logical_path`).iterate(migrationId)) {
    hash.update(`${row.logical_path}\0${row.source_bytes}\0${row.source_sha256}\n`)
  }
  return hash.digest("hex")
}

async function* walkFiles(root) {
  const directories = [root]
  while (directories.length > 0) {
    const current = directories.pop()
    const directory = await opendir(current)
    for await (const entry of directory) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) directories.push(fullPath)
      else if (entry.isFile()) yield fullPath
    }
  }
}

async function* walkFileBatches(root, batchSize = 16) {
  let batch = []
  for await (const file of walkFiles(root)) {
    batch.push(file)
    if (batch.length >= batchSize) {
      yield batch
      batch = []
    }
  }
  if (batch.length > 0) yield batch
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256")
    const stream = fs.createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.once("error", reject)
    stream.once("end", () => resolve(hash.digest("hex")))
  })
}

function assertPathBoundaries() {
  if (projectRuntimeRoot !== path.join(projectRoot, ".runtime")) throw new Error("unexpected project runtime path")
  if (!isInside(physicalRuntimeRoot, dataRoot)) throw new Error("destination is outside data root")
  if (path.parse(projectRuntimeRoot).root.toLowerCase() === path.parse(physicalRuntimeRoot).root.toLowerCase()) {
    throw new Error("source and destination must be on different volumes")
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function artifactType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image"
  if ([".pt", ".pth", ".ckpt", ".safetensors"].includes(extension)) return "checkpoint"
  if ([".json", ".jsonl"].includes(extension)) return "record"
  if ([".log", ".txt"].includes(extension)) return "log"
  return "file"
}
