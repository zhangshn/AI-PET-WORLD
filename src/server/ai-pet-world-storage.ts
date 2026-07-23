import path from "node:path"

export const aiPetWorldProjectRoot = path.resolve(process.cwd())
export const aiPetWorldDataRoot = path.resolve(
  process.env.AI_PET_WORLD_DATA_ROOT ??
    (process.platform === "win32" ? "D:\\AI-PET-WORLD-DATA" : path.join(aiPetWorldProjectRoot, ".ai-pet-world-data")),
)
export const aiPetWorldPhysicalRuntimeRoot = path.join(aiPetWorldDataRoot, "hot", "runtime")
export const aiPetWorldCatalogPath = path.join(aiPetWorldDataRoot, "catalog", "ai-pet-world-catalog.sqlite")

// Existing scripts retain .runtime paths. After migration this path is a junction
// to aiPetWorldPhysicalRuntimeRoot, preserving every historical logical identity.
export const aiPetWorldRuntimeRoot = path.join(aiPetWorldProjectRoot, ".runtime")
export const aiPainterRuntimeRoot = path.join(aiPetWorldRuntimeRoot, "ai-painter")
