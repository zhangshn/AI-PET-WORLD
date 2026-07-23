import fs from "node:fs"
import path from "node:path"

export const projectRoot = path.resolve(process.cwd())
export const projectRuntimeRoot = path.join(projectRoot, ".runtime")
export const dataRoot = path.resolve(
  process.env.AI_PET_WORLD_DATA_ROOT ?? (process.platform === "win32" ? "D:\\AI-PET-WORLD-DATA" : path.join(projectRoot, ".ai-pet-world-data")),
)
export const hotRoot = path.join(dataRoot, "hot")
export const physicalRuntimeRoot = path.join(hotRoot, "runtime")
export const coldRunsRoot = path.join(dataRoot, "cold", "runs")
export const catalogRoot = path.join(dataRoot, "catalog")
export const catalogPath = path.join(catalogRoot, "ai-pet-world-catalog.sqlite")
export const migrationsRoot = path.join(dataRoot, "migrations")

export function ensureStorageRoots() {
  for (const directory of [hotRoot, physicalRuntimeRoot, coldRunsRoot, catalogRoot, migrationsRoot]) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

export function logicalProjectPath(absolutePath) {
  const resolved = path.resolve(absolutePath)
  const relative = path.relative(projectRoot, resolved)
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return relative.replace(/\\/g, "/") || "."
  }
  if (isInside(resolved, physicalRuntimeRoot)) {
    return path.join(".runtime", path.relative(physicalRuntimeRoot, resolved)).replace(/\\/g, "/")
  }
  return resolved.replace(/\\/g, "/")
}

export function physicalPathForLogical(logicalPath) {
  const normalized = logicalPath.replace(/\\/g, "/")
  if (normalized === ".runtime" || normalized.startsWith(".runtime/")) {
    return path.join(physicalRuntimeRoot, normalized.slice(".runtime".length))
  }
  return path.resolve(projectRoot, logicalPath)
}

export function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}
