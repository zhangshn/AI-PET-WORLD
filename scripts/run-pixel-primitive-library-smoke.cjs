async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL PRIMITIVE LIBRARY SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function readFile(filePath, label) {
    assert(fs.existsSync(filePath), `${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
  }

  const primitiveDir = path.join(repoRoot, "src", "world", "pixel-primitives")
  const naturalRecipeDir = path.join(primitiveDir, "natural-recipes")
  const pixelArtRecipeDir = path.join(repoRoot, "src", "world", "pixel-art-recipes")
  const schemaPath = path.join(primitiveDir, "pixel-primitive-schema.ts")
  const stylePath = path.join(primitiveDir, "pixel-style-foundation.ts")
  const semanticPath = path.join(primitiveDir, "semantic-structure-library.ts")
  const primitivePath = path.join(primitiveDir, "pixel-primitive-library.ts")
  const shapePath = path.join(primitiveDir, "pixel-shape-library.ts")
  const partPath = path.join(primitiveDir, "pixel-part-library.ts")
  const recipePath = path.join(primitiveDir, "pixel-object-recipes.ts")
  const validatorPath = path.join(primitiveDir, "pixel-object-validator.ts")
  const rendererPath = path.join(primitiveDir, "pixel-primitive-svg-renderer.ts")
  const indexPath = path.join(primitiveDir, "index.ts")
  const naturalIndexPath = path.join(naturalRecipeDir, "index.ts")
  const pixelArtIndexPath = path.join(pixelArtRecipeDir, "index.ts")
  const stoneObjectRecipePath = path.join(pixelArtRecipeDir, "recipes", "stone-object-recipe.ts")
  const grassTileRecipePath = path.join(pixelArtRecipeDir, "recipes", "grass-tile-recipe.ts")
  const insectSignalRecipePath = path.join(pixelArtRecipeDir, "recipes", "insect-signal-recipe.ts")
  const treeObjectRecipePath = path.join(pixelArtRecipeDir, "recipes", "tree-object-recipe.ts")
  const stoneObjectRecipeModuleDir = path.join(pixelArtRecipeDir, "recipes", "stone-object")
  const panelPath = path.join(repoRoot, "src", "app", "world-debug", "pixel-visual-lab", "pixel-primitive-library-panel.tsx")
  const clientPath = path.join(repoRoot, "src", "app", "world-debug", "pixel-visual-lab", "pixel-visual-lab-client.tsx")

  const naturalIndexSource = readFile(naturalIndexPath, "natural recipe index")
  const pixelArtIndexSource = readFile(pixelArtIndexPath, "pixel art recipe index")
  const stoneObjectRecipeSource = readFile(stoneObjectRecipePath, "natural stone object recipe")
  const grassTileRecipeSource = readFile(grassTileRecipePath, "natural grass tile recipe")
  const insectSignalRecipeSource = readFile(insectSignalRecipePath, "natural insect signal recipe")
  const treeObjectRecipeSource = readFile(treeObjectRecipePath, "natural tree object recipe")
  assert(naturalIndexSource.includes("buildNaturalStoneObjectRecipe"), "Natural recipe index should use the stable stone builder.")
  assert(naturalIndexSource.includes("buildNaturalGrassTileRecipe"), "Natural recipe index should use the stable grass tile builder.")
  assert(naturalIndexSource.includes("buildNaturalInsectSignalRecipe"), "Natural recipe index should use the stable insect signal builder.")
  assert(naturalIndexSource.includes("buildNaturalTreeObjectRecipe"), "Natural recipe index should use the stable tree builder.")
  assert(naturalIndexSource.includes("buildNaturalObjectRecipe"), "Natural recipe index should export the stable natural object builder.")
  assert(pixelArtIndexSource.includes("./recipes/stone-object-recipe"), "Pixel art recipe public exports should include the stone object recipe.")
  assert(pixelArtIndexSource.includes("./recipes/grass-tile-recipe"), "Pixel art recipe public exports should include the grass tile recipe.")
  assert(pixelArtIndexSource.includes("./recipes/insect-signal-recipe"), "Pixel art recipe public exports should include the insect signal recipe.")
  assert(pixelArtIndexSource.includes("./recipes/tree-object-recipe"), "Pixel art recipe public exports should include the tree object recipe.")
  assert(stoneObjectRecipeSource.includes("buildNaturalStoneObjectRecipe"), "Stone object recipe should export its stable builder.")
  assert(grassTileRecipeSource.includes("buildNaturalGrassTileRecipe"), "Grass tile recipe should export its stable builder.")
  assert(insectSignalRecipeSource.includes("buildNaturalInsectSignalRecipe"), "Insect signal recipe should export its stable builder.")
  assert(treeObjectRecipeSource.includes("buildNaturalTreeObjectRecipe"), "Tree object recipe should export its stable builder.")

  const sources = [
    readFile(schemaPath, "pixel primitive schema"),
    readFile(stylePath, "pixel style foundation"),
    readFile(semanticPath, "semantic structure library"),
    readFile(primitivePath, "pixel primitive library"),
    readFile(shapePath, "pixel shape library"),
    readFile(partPath, "pixel part library"),
    readFile(recipePath, "pixel object recipes"),
    readFile(validatorPath, "pixel object validator"),
    readFile(rendererPath, "pixel primitive svg renderer"),
    readFile(indexPath, "pixel primitives index"),
    naturalIndexSource,
    pixelArtIndexSource,
    stoneObjectRecipeSource,
    grassTileRecipeSource,
    insectSignalRecipeSource,
    treeObjectRecipeSource,
    readFile(path.join(stoneObjectRecipeModuleDir, "stone-object-details.ts"), "stone object details"),
    readFile(path.join(stoneObjectRecipeModuleDir, "stone-object-environment.ts"), "stone object environment"),
    readFile(panelPath, "pixel primitive library panel"),
    readFile(clientPath, "pixel visual lab client"),
  ]
  const combined = sources.join("\n")

  const requiredTokens = [
    "PixelBlock",
    "PixelSemanticStructure",
    "semantic-structure-library",
    "PIXEL_SEMANTIC_STRUCTURES",
    "tree_semantic_structure_v1",
    "insect_semantic_structure_v1",
    "butler_semantic_structure_v1",
    "PIXEL_PRIMITIVE_LIBRARY",
    "PIXEL_SHAPE_LIBRARY",
    "PIXEL_PART_LIBRARY",
    "buildPixelObjectRecipe",
    "buildNaturalObjectRecipe",
    "buildNaturalStoneObjectRecipe",
    "buildNaturalGrassTileRecipe",
    "buildNaturalInsectSignalRecipe",
    "buildNaturalTreeObjectRecipe",
    "natural_stone_object_recipe",
    "natural_grass_tile_recipe",
    "natural_insect_signal_recipe",
    "natural_tree_object_recipe",
    "applyShapeNoiseFilter",
    "applyTextureDitherFilter",
    "buildForegroundGrassBlend",
    "renderPixelObjectToSvg",
    "validatePixelObjectRecipe",
    "像素原型库",
    "树木",
    "草地",
    "石头",
    "昆虫",
    "管家",
    "Validator",
    "语义结构",
    "usedShapes",
    "usedParts",
    "usedPrimitives",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  const forbiddenRuntimeTokens = [
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "runTraceLifecycleTick",
    "WorldViewModel",
    "HomeMapState",
    "PetSystem",
    "createPet",
    "pet_default",
  ]
  const forbiddenHits = forbiddenRuntimeTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `Pixel primitive library should stay visual-only but contains: ${forbiddenHits.join(", ")}`)

  assert(combined.includes("scene_composer_tree_recipe"), "Tree recipe should mark scene_composer_tree_recipe as golden algorithm.")
  assert(combined.includes("formal_ground_recipe"), "Grass tile recipe should mark formal_ground_recipe as golden algorithm.")
  assert(!combined.includes("pixel-learning"), "Pixel primitive library should not include pixel-learning module yet.")

  console.log("PIXEL PRIMITIVE LIBRARY SMOKE")
  console.log("Pixel primitives directory exists: ok")
  console.log("Semantic structures exist: ok")
  console.log("Primitive / shape / part libraries exist: ok")
  console.log("Object recipes exist: ok")
  console.log("Natural stone object recipe exists: ok")
  console.log("Natural grass tile recipe exists: ok")
  console.log("Natural insect signal recipe exists: ok")
  console.log("Natural tree object recipe exists: ok")
  console.log("Pixel art recipe public exports exist: ok")
  console.log("Validator exists: ok")
  console.log("SVG renderer exists: ok")
  console.log("Pixel Visual Lab tab exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No learning module: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
