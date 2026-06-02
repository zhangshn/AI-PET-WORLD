async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER CONTRACT")
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
  const combined = [contractSource, validatorSource, demoSource].join("\n")

  const requiredTokens = [
    "WorldFormalPixelWorldRendererContract",
    "WorldFormalPixelWorldRendererLayerContract",
    "WorldFormalPixelWorldRendererSafetyContract",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_CONTRACT_ID",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_LAYER_ORDER",
    "buildWorldFormalPixelWorldRendererContract",
    "validateWorldFormalPixelWorldRendererContract",
    "createMinimalWorldFormalPixelWorldRendererContract",
    "readonly_contract",
    "future_pixi_adapter",
    "pixel_buffer_frame",
    "renderer_ready_state",
    "PixelWorldPixelBufferFrame",
    "allowSvg: false",
    "allowCanvasDom: false",
    "allowCssGeometry: false",
    "allowRuntimeWrite: false",
    "allowDefaultPet: false",
    "allowDebugPanelImport: false",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing renderer contract token: ${token}`)
  })

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER CONTRACT")
  console.log("Formal PixelWorldView renderer contract exists: ok")
  console.log("Formal renderer contract validator exists: ok")
  console.log("Formal renderer contract demo exists: ok")
  console.log("Formal renderer contract safety exists: ok")
  console.log("Formal renderer contract layer order exists: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
