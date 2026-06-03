async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL VISUAL LAB SMOKE")
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

  const newVisualLabDir = path.join(
    repoRoot,
    "src",
    "app",
    "world-debug",
    "pixel-visual-lab"
  )
  const newVisualLabPagePath = path.join(newVisualLabDir, "page.tsx")
  const newVisualLabClientPath = path.join(newVisualLabDir, "pixel-visual-lab-client.tsx")
  const composerPanelPath = path.join(newVisualLabDir, "pixel-scene-composer-panel.tsx")
  const groundPanelPath = path.join(newVisualLabDir, "ground-tile-test-panel.tsx")
  const treePanelPath = path.join(newVisualLabDir, "tree-render-test-panel.tsx")
  const treePreviewPath = path.join(repoRoot, "src", "world", "procedural-painter", "tree", "tree-cluster-art-preview.ts")
  const sharedTreeRecipePath = path.join(repoRoot, "src", "world", "procedural-painter", "scene-composer", "scene-composer-tree-recipe.ts")

  const pageSource = readFile(newVisualLabPagePath, "pixel-visual-lab page")
  const clientSource = readFile(newVisualLabClientPath, "pixel-visual-lab client")
  const composerSource = readFile(composerPanelPath, "pixel scene composer panel")
  const groundSource = readFile(groundPanelPath, "ground tile test panel")
  const treeSource = readFile(treePanelPath, "tree render test panel")
  const treePreviewSource = readFile(treePreviewPath, "tree cluster preview")
  const sharedTreeRecipeSource = readFile(sharedTreeRecipePath, "scene composer tree recipe")
  const combinedVisualSource = [pageSource, clientSource, composerSource, groundSource, treeSource].join("\n")

  const requiredTokens = [
    "PixelVisualLabClient",
    "PixelSceneComposerPanel",
    "GroundTileTestPanel",
    "TreeRenderTestPanel",
    "VISUAL ONLY",
    "地面绘制",
    "ground_tile_recipe",
    "单树预览",
    "不包含草地、草根、前景草或场景融合",
    "不读取 runtime",
    "不写入世界事实",
    "不推进 Tick",
    "不替代正式 /world",
  ]

  requiredTokens.forEach((token) => {
    assert(combinedVisualSource.includes(token), `Pixel visual lab is missing required token: ${token}`)
  })

  assert(treePreviewSource.includes("data-visual-scope=\"tree_only\""), "Tree preview should be marked tree_only.")
  assert(treePreviewSource.includes("data-tree-algorithm=\"scene_composer_tree_recipe\""), "Tree preview should use the scene composer tree recipe.")
  assert(treePreviewSource.includes("renderSceneComposerTreeShadow"), "Tree preview should keep scene composer tree shadow.")
  assert(treePreviewSource.includes("renderSceneComposerTreeObject"), "Tree preview should render the scene composer tree object.")
  assert(sharedTreeRecipeSource.includes("renderSceneComposerTreeShadow"), "Shared scene composer tree recipe should expose tree shadow.")
  assert(sharedTreeRecipeSource.includes("renderSceneComposerTreeObject"), "Shared scene composer tree recipe should expose tree object.")
  assert(!treeSource.includes("buildTreeSceneIntegrationSvg"), "Tree panel should not render scene integration.")
  assert(!treePreviewSource.includes("renderFrontGrass"), "Tree preview should not render front grass.")
  assert(!treePreviewSource.includes("renderGround("), "Tree preview should not render ground as part of tree-only preview.")

  const forbiddenRuntimeTokens = [
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "runTraceLifecycleTick",
    "WorldViewModel",
    "HomeMapState",
    "PetSystem",
    "createUnplannedLife",
    "unplanned_life_default",
  ]
  const forbiddenRuntimeHits = forbiddenRuntimeTokens.filter((token) =>
    combinedVisualSource.includes(token)
  )

  assert(
    forbiddenRuntimeHits.length === 0,
    `Pixel visual lab should stay visual-only but contains: ${forbiddenRuntimeHits.join(", ")}`
  )

  console.log("PIXEL VISUAL LAB SMOKE")
  console.log("Unified visual debug page exists: ok")
  console.log("Composer panel moved into visual lab: ok")
  console.log("Ground tile panel added to visual lab: ok")
  console.log("Tree panel uses scene composer tree recipe: ok")
  console.log("Tree shadow kept without grass/ground: ok")
  console.log("Visual lab does not touch runtime/world facts: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})