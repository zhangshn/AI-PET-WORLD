import { PixelWorldView } from "@/app/world/components/pixel-world-view"
import { buildPixelWorldViewModelFromRuntime } from "@/world/pixel-world"
import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()
  const saveRecord = runtimeView.saveRecord
  const worldViewModel = buildPixelWorldViewModelFromRuntime({
    saveRecord,
    isPersisted: runtimeView.isPersisted,
  })

  return <PixelWorldView model={worldViewModel} />
}
