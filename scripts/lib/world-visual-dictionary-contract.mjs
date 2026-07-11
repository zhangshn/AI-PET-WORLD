import fs from "node:fs"
import path from "node:path"

export const ACTIVE_SINGLE_MAP_DOCUMENTS = [
  "versions/current-single-map-visual-scope",
  "generation-task/task-package-schema",
  "generation-task/complete-map-image-generation-contract",
  "director/director-output-schema",
  "director/complete-map-layout-constraints",
  "ecology/single-map-ecology-fields",
  "material-recipe/single-map-material-field-schema",
  "material-recipe/complete-map-material-token-library",
  "composition-recipe/single-map-composition-fields",
  "map-grammar/natural-home-complete-map-template",
  "spatial-grid/complete-map-canvas-contract",
  "render-layer-recipe/complete-map-layer-stack-v2",
  "objects/complete-map-object-placement-library",
  "transition/grass-to-path",
  "transition/grass-to-water",
  "transition/object-to-ground",
  "review/single-map-visual-acceptance",
  "review/complete-map-drawability-gate",
  "review/failure-codes",
  "training/complete-map-drawability-readiness",
]

export const REQUIRED_TASK_PACKAGE_FIELDS = [
  "schemaVersion",
  "taskId",
  "createdAt",
  "dictionaryVersionId",
  "worldId",
  "ownerId",
  "tick",
  "outputSize",
  "singleMapScope",
  "sourceFactIds",
  "directorPlan",
  "mapGrammar",
  "spatialLayers",
  "ecologyState",
  "singleMapEcologyFields",
  "gameplayContract",
  "visualStyle",
  "drawingProcess",
  "artDirection",
  "materialRecipes",
  "singleMapMaterialFields",
  "compositionRecipe",
  "singleMapCompositionFields",
  "renderLayerRecipe",
  "qualityRubric",
  "singleMapAcceptance",
  "allowedEntities",
  "forbiddenContent",
  "previousFailures",
  "storageContract",
]

export const REQUIRED_DIRECTOR_OUTPUT_FIELDS = [
  "schemaVersion",
  "directorRunId",
  "createdAt",
  "dictionaryVersionId",
  "worldId",
  "tick",
  "sourceFactIds",
  "singleMapScopePlan",
  "sceneIntent",
  "compositionPlan",
  "terrainPlan",
  "assetPlan",
  "motionPlan",
  "drawingProcessPlan",
  "artDirectionPlan",
  "materialRecipePlan",
  "singleMapEcologyPlan",
  "singleMapMaterialPlan",
  "compositionRecipePlan",
  "singleMapCompositionPlan",
  "renderLayerRecipePlan",
  "qualityRubricPlan",
  "singleMapAcceptancePlan",
  "fixPlanInput",
  "generationTaskDraft",
  "safety",
]

export function loadWorldVisualDictionaryContract(options = {}) {
  const root = options.root ? path.resolve(options.root) : process.cwd()
  const latestPath = path.resolve(root, options.latestPath ?? "data/world-visual-data-dictionary/latest.json")
  const latest = readJson(latestPath)
  const dictionaryPath = path.resolve(root, latest.dictionaryPath)
  const dictionary = readJson(dictionaryPath)
  const entryIds = new Set(dictionary.entries.map((entry) => entry.id))
  const missingActiveDocuments = ACTIVE_SINGLE_MAP_DOCUMENTS.filter((id) => !entryIds.has(id))
  const missingRequiredCategories = Array.isArray(dictionary.summary?.missingCategories)
    ? dictionary.summary.missingCategories
    : []
  const unregisteredHardFailureCodeCount =
    dictionary.summary?.unregisteredHardFailureCodeCount ??
    dictionary.unregisteredHardFailureCodes?.length ??
    null

  return {
    schemaVersion: "world-visual-dictionary-runtime-contract-v1",
    dictionaryVersionId: dictionary.dictionaryVersionId,
    dictionaryStatus: dictionary.status,
    latestPath: projectRelative(root, latestPath),
    dictionaryPath: projectRelative(root, dictionaryPath),
    generatedAt: dictionary.generatedAt,
    activeScope: "single_complete_map_visual",
    reservedScopes: ["player_character", "player_movement", "click_interaction", "build_interaction", "multi_tick_runtime_state"],
    requiredActiveDocuments: ACTIVE_SINGLE_MAP_DOCUMENTS,
    requiredTaskPackageFields: REQUIRED_TASK_PACKAGE_FIELDS,
    requiredDirectorOutputFields: REQUIRED_DIRECTOR_OUTPUT_FIELDS,
    summary: {
      documentCount: dictionary.summary?.documentCount ?? dictionary.entries.length,
      entryCount: dictionary.summary?.entryCount ?? dictionary.entries.length,
      categoryCount: Object.keys(dictionary.summary?.categories ?? {}).length,
      registeredFailureCodeCount:
        dictionary.summary?.registeredFailureCodeCount ?? dictionary.registeredFailureCodes?.length ?? null,
      hardFailureCodeCount: dictionary.summary?.hardFailureCodeCount ?? dictionary.hardFailureCodes?.length ?? null,
      unregisteredHardFailureCodeCount,
      missingRequiredCategories,
      missingActiveDocuments,
    },
    passed:
      dictionary.schemaVersion === "world-visual-data-dictionary-export-v1" &&
      latest.dictionaryVersionId === dictionary.dictionaryVersionId &&
      missingRequiredCategories.length === 0 &&
      missingActiveDocuments.length === 0 &&
      unregisteredHardFailureCodeCount === 0,
  }
}

export function assertWorldVisualDictionaryContract(contract) {
  assert(contract.schemaVersion === "world-visual-dictionary-runtime-contract-v1", "invalid dictionary contract schema")
  assert(contract.activeScope === "single_complete_map_visual", "dictionary contract must use single map visual scope")
  assert(contract.passed === true, "dictionary contract did not pass")
  assert(contract.summary.missingRequiredCategories.length === 0, "dictionary contract missing required categories")
  assert(contract.summary.missingActiveDocuments.length === 0, "dictionary contract missing active documents")
  assert(contract.summary.unregisteredHardFailureCodeCount === 0, "dictionary contract has unregistered hard failures")
  assert(hasAll(contract.requiredTaskPackageFields, REQUIRED_TASK_PACKAGE_FIELDS), "missing required task package fields")
  assert(hasAll(contract.requiredDirectorOutputFields, REQUIRED_DIRECTOR_OUTPUT_FIELDS), "missing required director output fields")
}

export function tryLoadWorldVisualDictionaryContract(options = {}) {
  try {
    const contract = loadWorldVisualDictionaryContract(options)
    assertWorldVisualDictionaryContract(contract)
    return contract
  } catch (error) {
    return {
      schemaVersion: "world-visual-dictionary-runtime-contract-v1",
      activeScope: "single_complete_map_visual",
      passed: false,
      error: error instanceof Error ? error.message : "unknown_dictionary_contract_error",
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function hasAll(values, required) {
  const valueSet = new Set(values)
  return required.every((value) => valueSet.has(value))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function projectRelative(root, filePath) {
  const relative = path.relative(root, filePath)
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative.replace(/\\/g, "/")
    : filePath
}
