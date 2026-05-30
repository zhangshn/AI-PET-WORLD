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

  const removedVisualDebugPaths = [
    path.join(repoRoot, "src", "app", "world-debug", "tree-render-test", "page.tsx"),
    path.join(repoRoot, "src", "app", "world-debug", "tree-render-test", "tree-render-test-client.tsx"),
    path.join(repoRoot, "src", "app", "world-debug", "pixel-scene-composer", "page.tsx"),
    path.join(repoRoot, "src", "app", "world-debug", "pixel-scene-composer", "pixel-scene-composer-client.tsx"),
  ]

  removedVisualDebugPaths.forEach((filePath) => {
    assert(!fs.existsSync(filePath), `Old visual debug file still exists: ${path.relative(repoRoot, filePath)}`)
  })

  const pageSource = readFile(newVisualLabPagePath, "pixel-visual-lab page")
  const clientSource = readFile(newVisualLabClientPath, "pixel-visual-lab client")
  const composerSource = readFile(composerPanelPath, "pixel scene composer panel")
  const groundSource = readFile(groundPanelPath, "ground tile test panel")
  const treeSource = readFile(treePanelPath, "tree render test panel")
  const treePreviewSource = readFile(treePreviewPath, "tree cluster preview")
  const combinedVisualSource = [pageSource, clientSource, composerSource, groundSource, treeSource].join("\n")

  const requiredTokens = [
    "PixelVisualLabClient",
    "PixelSceneComposerPanel",
    "GroundTileTestPanel",
    "TreeRenderTestPanel",
    "VISUAL ONLY",
    "地面绘制",
    "formal_ground_recipe_v1",
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
  assert(treePreviewSource.includes("renderTreeShadow"), "Tree preview should keep tree shadow.")
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
    "createPet",
    "pet_default",
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
  console.log("Old tree-render-test route removed: ok")
  console.log("Old pixel-scene-composer route removed: ok")
  console.log("Composer panel moved into visual lab: ok")
  console.log("Ground tile panel added to visual lab: ok")
  console.log("Tree panel is tree-only: ok")
  console.log("Tree shadow kept without grass/ground: ok")
  console.log("Visual lab does not touch runtime/world facts: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
