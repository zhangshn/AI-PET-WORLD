import { AiConsoleWorkspacePage, createAiConsoleWorkspaceMetadata } from "../../ai-console-workspace"

type PageProps = {
  params: Promise<{ view?: string[] }>
}

export async function generateMetadata({ params }: PageProps) {
  const { view = [] } = await params
  return createAiConsoleWorkspaceMetadata("tasks", view.join("/") || undefined)
}

export default async function TasksWorkspacePage({ params }: PageProps) {
  const { view = [] } = await params
  return <AiConsoleWorkspacePage moduleSlug="tasks" workspaceSlug={view.join("/") || undefined} />
}

