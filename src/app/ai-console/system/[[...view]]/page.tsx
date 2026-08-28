import { AiConsoleWorkspacePage, createAiConsoleWorkspaceMetadata } from "../../ai-console-workspace"

type PageProps = { params: Promise<{ view?: string[] }> }

export async function generateMetadata({ params }: PageProps) {
  const { view = [] } = await params
  return createAiConsoleWorkspaceMetadata("system", view.join("/") || undefined)
}

export default async function SystemWorkspacePage({ params }: PageProps) {
  const { view = [] } = await params
  return <AiConsoleWorkspacePage moduleSlug="system" workspaceSlug={view.join("/") || undefined} />
}

