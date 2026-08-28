import { AiConsoleWorkspacePage, createAiConsoleWorkspaceMetadata } from "../../ai-console-workspace"

type PageProps = { params: Promise<{ view?: string[] }> }

export async function generateMetadata({ params }: PageProps) {
  const { view = [] } = await params
  return createAiConsoleWorkspaceMetadata("control", view.join("/") || undefined)
}

export default async function ControlWorkspacePage({ params }: PageProps) {
  const { view = [] } = await params
  return <AiConsoleWorkspacePage moduleSlug="control" workspaceSlug={view.join("/") || undefined} />
}

