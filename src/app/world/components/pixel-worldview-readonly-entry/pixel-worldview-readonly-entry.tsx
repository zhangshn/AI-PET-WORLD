import type { WorldViewModel } from "@/world/world-view-model"
import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  mapPixelWorldViewModelFromSnapshot,
  mapWorldViewModelToPixelWorldSourceSnapshot,
} from "@/world/pixel-worldview"
import {
  buildVisualDisplayGateDecision,
  buildVisualFactManifestFromWorldViewModel,
} from "@/world/visual-judge"
import { buildVisualGenerationPlan } from "@/world/visual-generation"

import { PixiPixelWorldRendererClient } from "../pixi-pixel-world-renderer/pixi-pixel-world-renderer.client"

export function PixelWorldViewReadonlyEntry(input: {
  worldViewModel: WorldViewModel
}) {
  const source = mapWorldViewModelToPixelWorldSourceSnapshot(input.worldViewModel)
  const pixelModel = mapPixelWorldViewModelFromSnapshot(source)
  const visualGenerationPlan = buildVisualGenerationPlan({
    worldViewModel: input.worldViewModel,
  })
  const visualFactManifest = buildVisualFactManifestFromWorldViewModel(
    input.worldViewModel
  )
  const renderPlan = buildPixelWorldRenderPlan(pixelModel, {
    visualGenerationPlan,
  })
  const rendererResult = buildPixelWorldRendererFrame({
    plan: renderPlan,
    target: "formal_world",
  })
  const bufferResult = buildPixelWorldPixelBufferFrame({
    plan: renderPlan,
    frame: rendererResult.frame,
  })
  const displayGate = buildVisualDisplayGateDecision({
    visualGenerationPlan,
    renderPlan,
    pixelBufferFrame: bufferResult.buffer,
    visualFactManifest,
  })
  const playerVisibleBuffer =
    displayGate.correctedPixelBufferFrame ?? bufferResult.buffer

  return (
    <main style={styles.page}>
      <section style={styles.worldShell}>
        <header style={styles.minimalHud}>
          <span style={styles.worldName}>AI-PET-WORLD</span>
          <span style={styles.tick}>Tick {input.worldViewModel.tick}</span>
        </header>

        <section style={styles.stage}>
          {displayGate.canShowToPlayer ? (
            <PixiPixelWorldRendererClient buffer={playerVisibleBuffer} />
          ) : (
            <VisualDisplayBlockedPanel />
          )}
        </section>
      </section>
    </main>
  )
}

function VisualDisplayBlockedPanel() {
  return (
    <section style={styles.blockedPanel}>
      <div style={styles.blockedTitle}>Visual review in progress</div>
      <p style={styles.blockedText}>World frame is not ready for display.</p>
    </section>
  )
}

const styles = {
  page: {
    background: "#0b1411",
    color: "#d8ead8",
    minHeight: "100vh",
    overflow: "hidden",
  },
  worldShell: {
    background:
      "radial-gradient(circle at 50% 18%, #21362e 0, #14231e 46%, #09110f 100%)",
    minHeight: "100vh",
    overflow: "hidden",
    position: "relative",
  },
  minimalHud: {
    alignItems: "center",
    color: "rgba(216, 234, 216, 0.72)",
    display: "flex",
    fontSize: 12,
    justifyContent: "space-between",
    left: 20,
    letterSpacing: "0.08em",
    pointerEvents: "none",
    position: "absolute",
    right: 20,
    top: 16,
    zIndex: 2,
  },
  worldName: {
    textTransform: "uppercase",
  },
  tick: {
    background: "rgba(10, 20, 17, 0.56)",
    border: "1px solid rgba(200, 223, 143, 0.22)",
    color: "#c8df8f",
    padding: "6px 8px",
  },
  stage: {
    display: "grid",
    minHeight: "100vh",
    placeItems: "center",
    padding: 20,
  },
  blockedPanel: {
    background: "rgba(10, 20, 17, 0.66)",
    border: "1px solid rgba(216, 234, 216, 0.14)",
    display: "grid",
    gap: 8,
    padding: "18px 22px",
  },
  blockedTitle: {
    color: "rgba(216, 234, 216, 0.82)",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  blockedText: {
    color: "rgba(216, 234, 216, 0.48)",
    fontSize: 12,
    margin: 0,
  },
} as const
