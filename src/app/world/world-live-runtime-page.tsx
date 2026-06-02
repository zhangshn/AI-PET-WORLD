import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import { buildWorldViewModelForPixelWorld } from "@/world/world-view-model"
import { PixelWorldViewReadonlyEntry } from "./components/pixel-worldview-readonly-entry/pixel-worldview-readonly-entry"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()
  const saveRecord = runtimeView.saveRecord
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord,
    isPersisted: runtimeView.isPersisted,
  })
  return <PixelWorldViewReadonlyEntry worldViewModel={worldViewModel} />
}
