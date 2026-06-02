async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER CONTRACT SMOKE")
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

  const contractSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-contract.ts"),
    "Formal PixelWorldView renderer contract"
  )
  const validatorSource = readFile(
    path.join(
      repoRoot,
      "src",
      "world",
      "pixel-worldview",
      "world-formal-pixelworldview-renderer-contract-validator.ts"
    ),
    "Formal PixelWorldView renderer contract validator"
  )
  const demoSource = readFile(
    path.join(
      repoRoot,
      "src",
      "world",
      "pixel-worldview",
      "world-formal-pixelworldview-renderer-contract-demo.ts"
    ),
    "Formal PixelWorldView renderer contract demo"
  )
  const contractScriptSource = readFile(
    path.join(repoRoot, "scripts", "run-world-formal-pixelworldview-renderer-contract.cjs"),
    "Formal PixelWorldView renderer contract script"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const indexSource = readFile(path.join(repoRoot, "src", "world", "pixel-worldview", "index.ts"), "PixelWorldView index")
  const combined = [contractSource, validatorSource, demoSource, contractScriptSource, packageSource, indexSource].join("\n")

  const requiredTokens = [
    "WorldFormalPixelWorldRendererContract",
    "WorldFormalPixelWorldRendererLayerContract",
    "WorldFormalPixelWorldRendererSafetyContract",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_CONTRACT_ID",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_LAYER_ORDER",
    "buildWorldFormalPixelWorldRendererContract",
    "validateWorldFormalPixelWorldRendererContract",
    "createMinimalWorldFormalPixelWorldRendererContract",
    "PixelWorldPixelBufferFrame",
    "readonly_contract",
    "future_pixi_adapter",
    "pixel_buffer_frame",
    "renderer_ready_state",
    "allowDebugPanelImport",
    "Formal PixelWorldView renderer contract exists",
    "Formal renderer contract safety exists",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing renderer contract smoke token: ${token}`)
  })

  const requiredExports = [
    "./world-formal-pixelworldview-renderer-contract",
    "./world-formal-pixelworldview-renderer-contract-validator",
    "./world-formal-pixelworldview-renderer-contract-demo",
  ]
  requiredExports.forEach((token) => {
    assert(indexSource.includes(token), `Formal renderer contract public export is missing: ${token}`)
  })
  assert(
    packageSource.includes("contract:world-formal-pixelworldview-renderer"),
    "Formal PixelWorldView renderer contract package script is missing."
  )
  assert(
    packageSource.includes("smoke:world-formal-pixelworldview-renderer-contract"),
    "Formal PixelWorldView renderer contract smoke package script is missing."
  )

  const forbiddenCallTokens = [
    "runAndPersistOneRuntimeTick(",
    "writeWorldRuntimeSaveRecord(",
    "createPet(",
    "buildSceneSvg(",
    "buildFormalPixelSvg(",
    "buildFormalPixelRenderModel(",
    "WorldPainterReadonlyPreview(",
    "ProceduralRendererView(",
    "FormalWorldView(",
    "getContext(",
    "dangerouslySetInnerHTML(",
  ]
  const forbiddenHits = forbiddenCallTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `Renderer contract contains forbidden calls: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER CONTRACT SMOKE")
  console.log("Formal PixelWorldView renderer contract definition exists: ok")
  console.log("Formal PixelWorldView renderer contract validator exists: ok")
  console.log("Formal PixelWorldView renderer contract demo exists: ok")
  console.log("Formal PixelWorldView renderer contract script exists: ok")
  console.log("Formal renderer contract public export exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No renderer dependency call: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
