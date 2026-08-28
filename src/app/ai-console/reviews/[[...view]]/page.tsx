import { AiConsoleWorkspacePage, createAiConsoleWorkspaceMetadata } from "../../ai-console-workspace"

type PageProps = { params: Promise<{ view?: string[] }> }

export async function generateMetadata({ params }: PageProps) {
  const { view = [] } = await params
  return createAiConsoleWorkspaceMetadata("reviews", view.join("/") || undefined)
}

export default async function ReviewsWorkspacePage({ params }: PageProps) {
  const { view = [] } = await params
  return <AiConsoleWorkspacePage moduleSlug="reviews" workspaceSlug={view.join("/") || undefined} />
}

