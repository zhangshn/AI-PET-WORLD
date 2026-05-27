import { PixelWorldView } from "@/app/world/components/pixel-world-view"
import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import { buildWorldViewModelForPixelWorld } from "@/world/world-view-model"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()
  const saveRecord = runtimeView.saveRecord
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord,
    isPersisted: runtimeView.isPersisted,
  })

  return <PixelWorldView model={worldViewModel} />
}
