import { WorldLiveRuntimePage } from "./world-live-runtime-page"

export const dynamic = "force-dynamic"

export default async function Page(props: {
  searchParams?: Promise<{ worldId?: string; history?: string | string[] }>
}) {
  const searchParams = await props.searchParams
  return <WorldLiveRuntimePage worldId={searchParams?.worldId} historyCursor={searchParams?.history} />
}
