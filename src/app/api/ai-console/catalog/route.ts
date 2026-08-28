import { aiCapabilityDomains, aiConsoleFrameworks, aiConsoleModules } from "@/app/ai-console/ai-console-catalog"
import { aiConsoleWorkspaceDefinitions, validateAiConsoleWorkspaceCatalog } from "@/app/ai-console/ai-console-workspace-catalog"

export const dynamic = "force-dynamic"

export function GET() {
  const integrity = validateAiConsoleWorkspaceCatalog()
  if (!integrity.ok) {
    return Response.json({
      ok: false,
      schemaVersion: "ai_console_catalog_v1",
      errorCode: "catalog_integrity_failure",
      diagnostics: integrity.diagnostics,
    }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }

  return Response.json({
    ok: true,
    schemaVersion: "ai_console_catalog_v1",
    contractStatus: "ready",
    dataStatus: "not_connected",
    sourceIdentity: "ai_console_static_product_catalog",
    capabilities: aiCapabilityDomains,
    frameworks: aiConsoleFrameworks,
    modules: aiConsoleModules,
    workspaces: aiConsoleWorkspaceDefinitions,
    integrity,
  }, { headers: { "Cache-Control": "no-store" } })
}

