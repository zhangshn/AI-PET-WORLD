async function main() {
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)

  function fail(message) {
    console.log("VISUAL REFERENCE SAFETY SMOKE")
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

  function installTypeScriptRequireHook() {
    const moduleConstructor = moduleApi.default
    const originalResolveFilename = moduleConstructor._resolveFilename

    moduleConstructor._resolveFilename = function resolveFilename(
      request,
      parent,
      isMain,
      options
    ) {
      if (request.startsWith("@/")) {
        return originalResolveFilename.call(
          this,
          path.join(repoRoot, "src", request.slice(2)),
          parent,
          isMain,
          options
        )
      }

      return originalResolveFilename.call(this, request, parent, isMain, options)
    }

    localRequire.extensions[".ts"] = function compileTypescript(module, filename) {
      const source = fs.readFileSync(filename, "utf8")
      const output = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      }).outputText

      module._compile(output, filename)
    }
  }

  installTypeScriptRequireHook()

  const visualReferenceDir = path.join(repoRoot, "src", "world", "visual-reference")
  const visualJudgeDir = path.join(repoRoot, "src", "world", "visual-judge")
  const schemaSource = readFile(path.join(visualReferenceDir, "visual-reference-schema.ts"), "visual reference schema")
  const policySource = readFile(path.join(visualReferenceDir, "visual-reference-policy.ts"), "visual reference policy")
  const guidelinesSource = readFile(path.join(visualReferenceDir, "visual-reference-guidelines.ts"), "visual reference guidelines")
  const indexSource = readFile(path.join(visualReferenceDir, "index.ts"), "visual reference index")
  const visualJudgeStyleSource = readFile(path.join(visualJudgeDir, "visual-style-safety-policy.ts"), "visual judge style safety")
  const visualJudgeGatewaySource = readFile(path.join(visualJudgeDir, "visual-judge-gateway.ts"), "visual judge gateway")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [
    schemaSource,
    policySource,
    guidelinesSource,
    indexSource,
    visualJudgeStyleSource,
    visualJudgeGatewaySource,
    packageSource,
  ].join("\n")

  const requiredTokens = [
    "VisualReferenceGuideline",
    "VisualStyleSafetyPolicy",
    "VISUAL_STYLE_SAFETY_POLICY",
    "VISUAL_REFERENCE_GUIDELINES",
    "abstract_principle_only",
    "forbidsDirectCopy",
    "forbidsNamedArtistImitation",
    "forbidsIPReplication",
    "forbidsReferenceImageReconstruction",
    "allowsGenericPixelArtPrinciples",
    "allowsRealWorldObservation",
    "requiresTransformativeOriginalExpression",
    "auditVisualStyleSafety",
    "style_safety",
    "smoke:visual-reference-safety",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  const forbiddenSourceTokens = [
    "downloadReferenceImage",
    "storeReferenceImage",
    "copySpecificScreenshot",
    "namedArtistStylePrompt",
    "franchiseStyleClone",
  ]
  const forbiddenHits = forbiddenSourceTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `Visual reference layer should not store/copy reference expressions: ${forbiddenHits.join(", ")}`)

  const {
    VISUAL_STYLE_SAFETY_POLICY,
    listVisualReferenceGuidelines,
  } = localRequire(path.join(repoRoot, "src", "world", "visual-reference", "index.ts"))
  const { buildVisualCorrectionPlan, judgePixelWorldVisual } = localRequire(
    path.join(repoRoot, "src", "world", "visual-judge", "index.ts")
  )

  assert(VISUAL_STYLE_SAFETY_POLICY.forbidsDirectCopy === true, "Direct copy must be forbidden.")
  assert(VISUAL_STYLE_SAFETY_POLICY.forbidsNamedArtistImitation === true, "Named artist imitation must be forbidden.")
  assert(VISUAL_STYLE_SAFETY_POLICY.allowsRealWorldObservation === true, "Real-world observation should be allowed.")
  assert(
    listVisualReferenceGuidelines().every((guideline) => guideline.allowedUse === "abstract_principle_only"),
    "Every visual reference guideline must be abstract-principle-only."
  )

  const styleUnsafeReport = judgePixelWorldVisual(createStyleUnsafeInput())
  const styleUnsafePlan = buildVisualCorrectionPlan(styleUnsafeReport)
  assert(!styleUnsafeReport.ok, "Unsafe style report should fail.")
  assert(
    styleUnsafeReport.findings.some((finding) => finding.category === "style_safety"),
    "Unsafe style intent should create a style_safety finding."
  )
  assert(
    styleUnsafePlan.actions.some((action) => action.type === "remove_forbidden_visual_token"),
    "Unsafe style intent should create a remove_forbidden_visual_token correction action."
  )

  console.log("VISUAL REFERENCE SAFETY SMOKE")
  console.log("Visual reference schema exists: ok")
  console.log("Visual style safety policy exists: ok")
  console.log("Guidelines are abstract-principle-only: ok")
  console.log("No reference-image storage/copy path: ok")
  console.log(`Style safety findings: ${styleUnsafeReport.findings.filter((finding) => finding.category === "style_safety").length}`)
  console.log("Result: PASS")
}

function createStyleUnsafeInput() {
  return {
    visualGenerationPlan: {
      worldId: "visual-reference-safety-smoke-world",
      tick: 1,
      deterministicKey: "visual_reference_safety_smoke",
      objectRecipes: [
        {
          recipeId: "natural_tree_object_recipe",
          recipeVersion: "smoke",
          sourceObjectId: "tree_primary",
          kind: "tree",
          anchor: { type: "center_bottom", x: 48, y: 64 },
          bounds: { x: 40, y: 42, width: 24, height: 28 },
          blocks: [
            {
              id: "tree_block_1",
              x: 40,
              y: 42,
              width: 12,
              height: 12,
              color: "#2f7a3d",
              opacity: 1,
              layer: "object",
              stateTags: ["copy_reference_image"],
            },
            {
              id: "tree_block_2",
              x: 52,
              y: 44,
              width: 10,
              height: 10,
              color: "#78c65a",
              opacity: 1,
              layer: "object",
              stateTags: ["named_artist_imitation"],
            },
            {
              id: "tree_block_3",
              x: 46,
              y: 56,
              width: 9,
              height: 13,
              color: "#11381f",
              opacity: 1,
              layer: "object",
              stateTags: ["original_visual_expression"],
            },
          ],
          deterministicKey: "tree:tree_primary",
          stateTags: ["abstract_principle_only"],
        },
      ],
      objectMigration: {
        blockEnabledKinds: ["tree"],
        markerFallbackKinds: [],
        blockEnabledObjectCount: 1,
        markerFallbackObjectCount: 0,
        tags: ["visual_generation_object_migration"],
      },
      actorSpriteFrames: [],
      traceVisuals: [],
      atmosphereVisuals: [],
      audit: { ok: true, warnings: [], tags: ["visual_generation_audit"] },
      tags: ["visual_generation_plan"],
    },
    renderPlan: {
      worldId: "visual-reference-safety-smoke-world",
      tick: 1,
      canvas: { width: 200, height: 140, tileSize: 16 },
      commands: [
        {
          id: "render_object_block_tree_primary_1",
          layer: "object",
          kind: "draw_object_block",
          sourceId: "tree_primary",
          bounds: { x: 40, y: 42, width: 12, height: 12 },
          sortY: 54,
          recipeId: "natural_tree_object_recipe",
          colorHint: "#2f7a3d",
          opacity: 1,
          visible: true,
          stateTags: ["visual_generation_block"],
        },
      ],
      layerSummaries: [{ layer: "object", count: 1 }],
    },
    pixelBufferFrame: {
      bufferId: "visual_reference_safety_smoke_buffer",
      worldId: "visual-reference-safety-smoke-world",
      tick: 1,
      canvas: { width: 200, height: 140, tileSize: 16 },
      layers: [
        {
          layer: "object",
          cells: [
            {
              id: "buffer_tree_primary_1",
              layer: "object",
              kind: "object_block",
              x: 40,
              y: 42,
              width: 12,
              height: 12,
              sourceCommandId: "render_object_block_tree_primary_1",
              visible: true,
              opacity: 1,
              colorHint: "#2f7a3d",
              recipeId: "natural_tree_object_recipe",
              stateTags: ["visual_generation_block"],
            },
          ],
          visibleCount: 1,
          hiddenCount: 0,
        },
      ],
      cellCount: 1,
    },
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
