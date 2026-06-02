async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER SHELL")
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

  const shellSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-shell.ts"),
    "Formal PixelWorldView renderer shell"
  )
  const validatorSource = readFile(
    path.join(
      repoRoot,
      "src",
      "world",
      "pixel-worldview",
      "world-formal-pixelworldview-renderer-shell-validator.ts"
    ),
    "Formal PixelWorldView renderer shell validator"
  )
  const demoSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-shell-demo.ts"),
    "Formal PixelWorldView renderer shell demo"
  )
  const combined = [shellSource, validatorSource, demoSource].join("\n")

  const requiredTokens = [
    "WorldFormalPixelWorldRendererShellState",
    "WorldFormalPixelWorldRendererShellLayerState",
    "WorldFormalPixelWorldRendererShellSafetyState",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SHELL_ID",
    "buildWorldFormalPixelWorldRendererShellState",
    "validateWorldFormalPixelWorldRendererShellState",
    "createMinimalWorldFormalPixelWorldRendererShellState",
    "readonly_shell",
    "runtimeReadonly: true",
    "noDefaultPet: true",
    "noSvg: true",
    "noCanvasDom: true",
    "noCssGeometry: true",
    "noDebugPanelImport: true",
    "正式 renderer shell 只展示 readiness，不绘制世界",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing renderer shell token: ${token}`)
  })

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER SHELL")
  console.log("Formal PixelWorldView renderer shell exists: ok")
  console.log("Formal renderer shell validator exists: ok")
  console.log("Formal renderer shell demo exists: ok")
  console.log("Formal renderer shell safety exists: ok")
  console.log("Formal renderer shell readiness exists: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
