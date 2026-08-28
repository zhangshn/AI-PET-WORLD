import { AiConsoleWorkspacePage, createAiConsoleWorkspaceMetadata } from "../../ai-console-workspace"

type PageProps = { params: Promise<{ view?: string[] }> }

export async function generateMetadata({ params }: PageProps) {
  const { view = [] } = await params
  return createAiConsoleWorkspaceMetadata("evidence", view.join("/") || undefined)
}

export default async function EvidenceWorkspacePage({ params }: PageProps) {
  const { view = [] } = await params
  return <AiConsoleWorkspacePage moduleSlug="evidence" workspaceSlug={view.join("/") || undefined} />
}

