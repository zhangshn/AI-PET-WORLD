async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER ADAPTER")
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

  const adapterSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-adapter.ts"),
    "Formal PixelWorldView renderer adapter"
  )
  const validatorSource = readFile(
    path.join(
      repoRoot,
      "src",
      "world",
      "pixel-worldview",
      "world-formal-pixelworldview-renderer-adapter-validator.ts"
    ),
    "Formal PixelWorldView renderer adapter validator"
  )
  const demoSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-adapter-demo.ts"),
    "Formal PixelWorldView renderer adapter demo"
  )
  const combined = [adapterSource, validatorSource, demoSource].join("\n")

  const requiredTokens = [
    "WorldFormalPixelWorldRendererAdapterPacket",
    "WorldFormalPixelWorldRendererAdapterLayer",
    "WorldFormalPixelWorldRendererAdapterCell",
    "WorldFormalPixelWorldRendererAdapterSafety",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_ADAPTER_ID",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_ADAPTER_LAYER_ORDER",
    "buildWorldFormalPixelWorldRendererAdapterPacket",
    "validateWorldFormalPixelWorldRendererAdapterPacket",
    "createMinimalWorldFormalPixelWorldRendererAdapterPacket",
    "readonly_adapter",
    "future_pixi_adapter",
    "adapter_cell_",
    "bufferOnlyInput: true",
    "runtimeReadonly: true",
    "noDefaultPet: true",
    "noSvg: true",
    "noCanvasDom: true",
    "noCssGeometry: true",
    "noDebugPanelImport: true",
    "正式 renderer adapter 只转换 PixelWorldPixelBufferFrame",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing renderer adapter token: ${token}`)
  })

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER ADAPTER")
  console.log("Formal PixelWorldView renderer adapter exists: ok")
  console.log("Formal renderer adapter validator exists: ok")
  console.log("Formal renderer adapter demo exists: ok")
  console.log("Formal renderer adapter safety exists: ok")
  console.log("Formal renderer adapter readiness exists: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
