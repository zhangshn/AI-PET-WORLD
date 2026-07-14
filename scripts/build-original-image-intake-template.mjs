import fs from "node:fs"
import path from "node:path"
import { ORIGINAL_IMAGE_INTAKE_SCHEMA_VERSION } from "./lib/original-image-library-contract.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "original-image-intake-templates")
const LIBRARY_PATH = "data/world-samples/original-image-library/natural-home-v1/library.json"
const KNOWLEDGE_CATALOG_PATH = "data/world-samples/original-image-library/natural-home-v1/parallel-visual-knowledge-catalog-v1.json"
const createdAtUtc = new Date().toISOString()
const templateId = `original-image-intake-template-${createdAtUtc.replace(/[:.]/g, "-")}`
const templateRoot = path.join(OUTPUT_ROOT, templateId)
const library = readJson(path.join(ROOT, LIBRARY_PATH))
const snapshotPath = library.provisionalVisualSnapshotPath
const speciesCatalogPath = library.currentSpeciesCatalogPath
const snapshot = readJson(path.join(ROOT, snapshotPath))
const speciesCatalog = readJson(path.join(ROOT, speciesCatalogPath))
const knowledgeCatalog = readJson(path.join(ROOT, KNOWLEDGE_CATALOG_PATH))
const firstSpecies = speciesCatalog.species[0]

const sharedWorldBinding = {
  worldProfileId: snapshot.worldProfileId,
  biomeType: snapshot.biomeType,
  snapshotId: snapshot.snapshotId,
  snapshotPath,
  snapshotIsFinal: snapshot.isFinal,
  environment: snapshot.environment,
  speciesCatalogId: speciesCatalog.catalogId,
  speciesCatalogPath,
  parallelVisualKnowledgeCatalogId: knowledgeCatalog.catalogId,
  parallelVisualKnowledgeCatalogPath: KNOWLEDGE_CATALOG_PATH,
  worldId: null,
  tick: null,
  taskPackageId: null,
  conditionPackPath: null,
}

const templates = knowledgeCatalog.categories.map((category) => {
  const categoryId = category.categoryId
  const templatePath = path.join(templateRoot, `${categoryId}-request-template.json`)
  const template = {
    schemaVersion: ORIGINAL_IMAGE_INTAKE_SCHEMA_VERSION,
    categoryId,
    title: `REQUIRED_${categoryId.replaceAll("-", "_").toUpperCase()}_ORIGINAL_IMAGE_TITLE`,
    imagePath: `REQUIRED_${categoryId.replaceAll("-", "_").toUpperCase()}_IMAGE_PATH.png`,
    source: {
      sourceType: "owner_created",
      creationMethod: "project_owner_original_human_created",
      rightsHolder: "REQUIRED_RIGHTS_HOLDER_ID",
      thirdPartyContentUsed: false,
      thirdPartyGenerativeModelUsed: false,
      copiedFromExistingWork: false,
    },
    classification: classificationForCategory(categoryId, firstSpecies),
    worldBinding: sharedWorldBinding,
    layerFiles: [],
    conditionFiles: [],
    rightsFiles: [],
    reviewFiles: [],
    requiredBeforeIntake: [
      "replace every REQUIRED_* placeholder",
      "declare third-party fields truthfully",
      "keep the current library snapshot binding unless the owner approves a newer snapshot version",
      "use the category knowledge vocabulary instead of inventing a parallel name",
      categoryId === "complete-maps" ? "formal high-resolution pixel-style complete-map originals must be exactly 1024x768 and must not be low-resolution upscales; blocked concept references may retain a 4:3 source canvas" : "preserve enough environmental context for audited semantic learning",
      "intake does not create a formal training sample",
    ],
  }
  writeJson(templatePath, template)
  return {
    categoryId,
    templatePath: projectPath(templatePath),
    dictionaryEntryIds: category.dictionaryEntryIds,
  }
})

const manifestPath = path.join(templateRoot, "manifest.json")
const manifest = {
  schemaVersion: "original-image-intake-template-manifest-v1",
  templateId,
  status: "five_parallel_category_templates_created",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  worldProfileId: snapshot.worldProfileId,
  snapshotId: snapshot.snapshotId,
  snapshotIsFinal: snapshot.isFinal,
  acquisitionOrder: knowledgeCatalog.acquisitionOrder,
  categoryCount: templates.length,
  templates,
  automaticStorage: true,
}
writeJson(manifestPath, manifest)

const completeMapTemplate = templates.find((item) => item.categoryId === "complete-maps")
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "original-image-intake-template-latest-v1",
  templateId,
  manifestPath: projectPath(manifestPath),
  templatePath: completeMapTemplate?.templatePath ?? null,
  templates,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  automaticStorage: true,
})

console.log(JSON.stringify({
  status: "original_image_intake_templates_created",
  templateId,
  manifestPath: projectPath(manifestPath),
  categoryCount: templates.length,
  templates,
}, null, 2))

function classificationForCategory(categoryId, species) {
  if (categoryId === "complete-maps") {
    return { mapScope: "complete-natural-home-map", knowledgeRole: "global_composition_style_and_gameplay_readability" }
  }
  if (categoryId === "terrain") {
    return { terrainType: "grass", stateId: "wet_season_moist_healthy_open", dictionaryEntryIds: ["terrain/grass"] }
  }
  if (categoryId === "vegetation") {
    return {
      plantKind: species.plantKind,
      speciesId: species.speciesId,
      lifeStage: "mature_wet_healthy",
      season: "wet_season",
      healthState: "healthy",
      resourceState: "not_visible",
      dictionaryEntryIds: ["objects/tree"],
    }
  }
  if (categoryId === "natural-objects") {
    return { objectKind: "rock", stateId: "embedded_moist_ground", dictionaryEntryIds: ["objects/rock"] }
  }
  if (categoryId === "transitions") {
    return {
      transitionKind: "grass-to-path",
      stateId: "post_rain_soft_damp_edge",
      polarity: "positive",
      dictionaryEntryIds: ["transition/grass-to-path"],
    }
  }
  throw new Error(`unsupported original image category: ${categoryId}`)
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}
