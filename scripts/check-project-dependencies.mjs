import { auditProjectDependencies } from './lib/project-dependency-audit.mjs'

const result = auditProjectDependencies()
console.log(JSON.stringify({ scope: result.scope, files: result.files, edgeCount: result.edgeCount,
  staticCycles: result.staticCycles, includingDeferredCycles: result.includingDeferredCycles,
  unresolvedLocalImports: result.unresolved.length, computedImports: result.computedImports.length,
  localRequireFunctionCalls: result.localRequireCalls.length,
  verifiedAssetImports: result.assetImports.length, outsideSourceImports: result.outsideSourceImports,
  runtimeEvidenceImports: result.runtimeEvidenceImports,
  skippedLinks: result.skippedLinks, parseErrors: result.parseErrors,
  limitation: 'Deferred cycles and unresolved/computed paths require runtime-specific review; absence of a static cycle is not business closure.' }, null, 2))
if (result.includingDeferredCycles.length || result.parseErrors.length || result.skippedLinks.length || result.runtimeEvidenceImports.length) process.exitCode = 1
