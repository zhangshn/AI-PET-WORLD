import path from "node:path"

export const aiPetWorldProjectRoot = path.resolve(/* turbopackIgnore: true */ process.cwd())
export const aiPetWorldDataRoot = path.resolve(
  /* turbopackIgnore: true */
  process.env.AI_PET_WORLD_DATA_ROOT ??
    (process.platform === "win32" ? "D:\\AI-PET-WORLD-DATA" : path.join(aiPetWorldProjectRoot, ".ai-pet-world-data")),
)
export const aiPetWorldPhysicalRuntimeRoot = path.join(/* turbopackIgnore: true */ aiPetWorldDataRoot, "hot", "runtime")
export const aiPetWorldCatalogPath = path.join(/* turbopackIgnore: true */ aiPetWorldDataRoot, "catalog", "ai-pet-world-catalog.sqlite")

// Existing scripts retain .runtime paths. After migration this path is a junction
// to aiPetWorldPhysicalRuntimeRoot, preserving every historical logical identity.
export const aiPetWorldRuntimeRoot = path.join(/* turbopackIgnore: true */ aiPetWorldProjectRoot, ".runtime")
export const aiPainterRuntimeRoot = path.join(/* turbopackIgnore: true */ aiPetWorldRuntimeRoot, "ai-painter")
