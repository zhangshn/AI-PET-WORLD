async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const runtimeGatewayPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-gateway.ts")
  const runtimeSchemaPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-schema.ts")
  const auditSummaryPath = path.join(repoRoot, "src", "world", "runtime", "butler-runtime-audit-summary.ts")

  function fail(message) {
    console.log("M7 AUDIT SUMMARY SMOKE")
    console.log("This smoke intentionally writes the local runtime save by running one explicit runtime tick.")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function parseJson(raw, message) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      fail(`${message} ${error.message}`)
    }
  }

  function installTypeScriptRequireHook() {
    const moduleConstructor = moduleApi.default
    const originalResolveFilename = moduleConstructor._resolveFilename

    moduleConstructor._resolveFilename = function resolveFilename(request, parent, isMain, options) {
      if (request.startsWith("@/")) {
        return originalResolveFilename.call(this, path.join(repoRoot, "src", request.slice(2)), parent, isMain, options)
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

  function assertStaticContract() {
    const gatewaySource = fs.readFileSync(runtimeGatewayPath, "utf8")
    const schemaSource = fs.readFileSync(runtimeSchemaPath, "utf8")
    const auditSource = fs.readFileSync(auditSummaryPath, "utf8")
    const combinedSource = [gatewaySource, schemaSource, auditSource].join("\n")

    const requiredTokens = [
      "ButlerRuntimeAuditSummary",
      "lastButlerRuntimeAuditSummary",
      "buildButlerRuntimeAuditSummary",
      "homeMapWriteStatus",
      "traceWriteStatus",
      "memorySeedCount",
      "userFacingSummary",
      "safeguards",
      "safe_apply_boundary_recorded",
      "memory_seed_count_recorded",
      "no_default_pet_fact",
    ]

    requiredTokens.forEach((token) =>
      assert(combinedSource.includes(token), `M7 audit summary path is missing required token: ${token}.`)
    )

    const forbiddenTokens = [
      "JSON.stringify(record)",
      "finalScore",
      "riskPenalty",
      "createPet",
      "pet_default",
      "buildSceneSvg",
      "scene-composer-gateway",
    ]
    const forbiddenHits = forbiddenTokens.filter((token) => combinedSource.includes(token))

    assert(
      forbiddenHits.length === 0,
      `M7 audit summary path contains forbidden tokens: ${forbiddenHits.join(", ")}`
    )
  }

  function findCurrentButlerTrace(record, summary) {
    return record.traceField?.traces.find(
      (trace) =>
        trace.id === summary.traceId &&
        trace.sourceKind === "butler_behavior" &&
        trace.updatedAtTick === record.tick &&
        trace.tags.includes("m7_butler_trace_closure") &&
        trace.tags.includes("not_pet_trace")
    )
  }

  function assertSummary(record) {
    const summary = record.lastButlerRuntimeAuditSummary
    const intent = record.lastButlerRuntimeIntent
    const validation = record.lastButlerWorldRuleValidation
    const action = record.lastRuntimeAction

    assert(summary, "lastButlerRuntimeAuditSummary was not persisted.")
    assert(intent, "Runtime record is missing lastButlerRuntimeIntent.")
    assert(validation, "Runtime record is missing lastButlerWorldRuleValidation.")
    assert(record.traceMemorySeedField, "Runtime record is missing TraceMemorySeedField.")

    assert(summary.tick === record.tick, "Audit summary tick does not match runtime tick.")
    assert(summary.motivation === intent.motivation, "Audit summary motivation does not match intent motivation.")
    assert(summary.intentKind === intent.kind, "Audit summary intentKind does not match intent kind.")
    assert(
      summary.validationStatus === (validation.ok ? "passed" : "blocked"),
      "Audit summary validationStatus does not match validation result."
    )
    assert(summary.safeApplyRequired === validation.safeApplyRequired, "Audit summary safeApplyRequired does not match validation.")
    assert(summary.acceptedDiffCount === (action?.acceptedDiffCount ?? 0), "Audit summary acceptedDiffCount does not match lastRuntimeAction.")
    assert(summary.memorySeedCount === record.traceMemorySeedField.summary.totalSeeds, "Audit summary memorySeedCount does not match TraceMemorySeedField.")
    assert(summary.tags.includes("butler_runtime_audit_summary"), "Audit summary missing primary tag.")
    assert(summary.tags.includes("m7_butler_trace_closure"), "Audit summary missing M7 tag.")
    assert(summary.tags.includes("safe_apply_boundary_recorded"), "Audit summary missing SafeApply boundary tag.")
    assert(summary.tags.includes("memory_seed_count_recorded"), "Audit summary missing memory seed count tag.")
    assert(summary.tags.includes("no_default_pet_fact"), "Audit summary missing no default pet guard tag.")
    assert(summary.safeguards.some((item) => item.includes("世界规则验证")), "Audit safeguards do not mention world rule validation.")
    assert(summary.safeguards.some((item) => item.includes("SafeApply") || item.includes("HomeMapState")), "Audit safeguards do not mention SafeApply / HomeMapState boundary.")
    assert(summary.safeguards.some((item) => item.includes("宠物")), "Audit safeguards do not mention no default pet fact.")
    assert(summary.userFacingSummary.includes("管家"), "Audit userFacingSummary does not mention butler.")
    assert(summary.userFacingSummary.includes("痕迹"), "Audit userFacingSummary does not mention trace.")
    assert(summary.userFacingSummary.includes("记忆种子") || summary.userFacingSummary.includes("记忆"), "Audit userFacingSummary does not mention memory seed.")

    if (intent.kind === "resource_wait" || intent.kind === "observation") {
      assert(summary.homeMapWriteStatus === "not_requested", "Observe/resource wait summary should not request HomeMapState write.")
    }

    if (summary.traceWriteStatus === "created") {
      assert(summary.traceId, "Created trace summary has no traceId.")
      assert(summary.traceType, "Created trace summary has no traceType.")
      const trace = findCurrentButlerTrace(record, summary)
      assert(trace, "Audit summary traceId does not point to current butler trace.")
      assert(trace.type === summary.traceType, "Audit summary traceType does not match trace type.")
    }

    return summary
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(runtimeGatewayPath)) fail("Runtime gateway is missing.")
  if (!fs.existsSync(runtimeSchemaPath)) fail("Runtime schema is missing.")
  if (!fs.existsSync(auditSummaryPath)) fail("Butler audit summary module is missing.")

  installTypeScriptRequireHook()
  assertStaticContract()

  const { runAndPersistOneRuntimeTick, readWorldRuntimeForView } = localRequire(runtimeGatewayPath)
  const beforeRecord = parseJson(fs.readFileSync(savePath, "utf8"), "Runtime save before M7 audit summary smoke is not valid JSON.")
  const beforeTick = beforeRecord.tick
  const result = await runAndPersistOneRuntimeTick({ now: Date.now() })

  assert(result.persisted, "Explicit runtime tick was not persisted.")
  assert(result.nextSaveRecord.lastButlerRuntimeAuditSummary, "Runtime tick result did not expose audit summary.")
  assert(result.tags.includes("butler_runtime_audit_summary_persisted"), "Runtime tick result is missing audit summary tag.")

  const afterRecord = parseJson(fs.readFileSync(savePath, "utf8"), "Runtime save after M7 audit summary smoke is not valid JSON.")
  assert(afterRecord.tick === beforeTick + 1, "M7 audit summary smoke did not advance exactly one explicit runtime tick.")
  const summary = assertSummary(afterRecord)

  const beforeReadRaw = fs.readFileSync(savePath, "utf8")
  const beforeReadHash = crypto.createHash("sha256").update(beforeReadRaw).digest("hex")
  const viewResult = await readWorldRuntimeForView()
  const afterReadRaw = fs.readFileSync(savePath, "utf8")
  const afterReadHash = crypto.createHash("sha256").update(afterReadRaw).digest("hex")
  const afterReadRecord = parseJson(afterReadRaw, "Runtime save after read-only check is not valid JSON.")

  assert(viewResult.saveRecord.lastButlerRuntimeAuditSummary, "Read-only view did not expose audit summary.")
  assert(afterReadRecord.tick === afterRecord.tick, "readWorldRuntimeForView changed runtime tick.")
  assert(afterReadHash === beforeReadHash, "readWorldRuntimeForView changed runtime save hash.")

  console.log("M7 AUDIT SUMMARY SMOKE")
  console.log("This smoke intentionally writes the local runtime save by running one explicit runtime tick.")
  console.log(`Tick before: ${beforeTick}`)
  console.log(`Tick after: ${afterRecord.tick}`)
  console.log(`Motivation: ${summary.motivation}`)
  console.log(`Intent: ${summary.intentKind}`)
  console.log(`Validation: ${summary.validationStatus}`)
  console.log(`HomeMap write: ${summary.homeMapWriteStatus}`)
  console.log(`Trace write: ${summary.traceWriteStatus}`)
  console.log(`Trace: ${summary.traceId ?? "none"}`)
  console.log(`Memory seeds: ${summary.memorySeedCount}`)
  console.log("Butler runtime audit summary persisted: ok")
  console.log("Summary trace pointer: ok")
  console.log("Summary safeguards: ok")
  console.log("readWorldRuntimeForView read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
