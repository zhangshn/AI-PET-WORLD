import { getAiConsoleWorkspace } from "@/app/ai-console/ai-console-workspace-catalog"
import { queryAiConsoleWorkspaceProjection } from "@/server/ai-console/workspace-projection"

export const dynamic = "force-dynamic"

const SAFE_SLUG = /^[a-z][a-z0-9-]{1,47}$/u

export async function GET(request: Request, context: { params: Promise<{ moduleSlug: string; workspaceSlug: string }> }) {
  const { moduleSlug, workspaceSlug } = await context.params
  if (!SAFE_SLUG.test(moduleSlug) || !SAFE_SLUG.test(workspaceSlug)) {
    return queryError("invalid_workspace_identity", 400)
  }

  const workspace = getAiConsoleWorkspace(moduleSlug, workspaceSlug)
  if (!workspace) return queryError("workspace_not_found", 404)

  const requestedView = new URL(request.url).searchParams.get("view")
  if (requestedView && !workspace.workAreas.includes(requestedView)) {
    return queryError("view_not_in_workspace_contract", 400)
  }

  const selectedView = requestedView ?? workspace.workAreas[0] ?? "default"
  const projection = await queryAiConsoleWorkspaceProjection(workspace, selectedView)

  return Response.json({
    ok: true,
    schemaVersion: "ai_console_workspace_query_v1",
    contractStatus: "ready",
    dataStatus: projection.dataStatus,
    sourceIdentity: projection.sourceIdentity,
    workspaceIdentity: `${moduleSlug}/${workspaceSlug}`,
    selectedView,
    queryContract: {
      method: "GET",
      readonly: true,
      primaryEntity: workspace.primaryEntity,
      allowedViews: workspace.workAreas,
      filterFields: workspace.fields.map((field) => field.canonicalName),
      sourceOfTruth: workspace.sourceOfTruth,
      updateSemantics: workspace.updateSemantics,
    },
    result: projection,
  }, { headers: { "Cache-Control": "no-store" } })
}

function queryError(errorCode: string, status: number) {
  return Response.json({
    ok: false,
    schemaVersion: "ai_console_workspace_query_v1",
    contractStatus: "rejected",
    dataStatus: "not_connected",
    errorCode,
  }, { status, headers: { "Cache-Control": "no-store" } })
}
