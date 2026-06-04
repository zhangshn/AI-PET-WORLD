import type { WorldViewModel } from "@/world/world-view-model"
import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  mapPixelWorldViewModelFromSnapshot,
  mapWorldViewModelToPixelWorldSourceSnapshot,
} from "@/world/pixel-worldview"
import type { VisualDisplayGateDecision } from "@/world/visual-judge"
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
            <VisualDisplayBlockedPanel gate={displayGate} />
          )}
        </section>

        {displayGate.status !== "allow_display" ? (
          <VisualGateDebugStrip gate={displayGate} />
        ) : null}
      </section>
    </main>
  )
}

function VisualDisplayBlockedPanel(input: {
  gate: VisualDisplayGateDecision
}) {
  return (
    <section style={styles.blockedPanel}>
      <div style={styles.blockedTitle}>Visual frame blocked</div>
      <p style={styles.blockedText}>
        {input.gate.review.remainingFailCount} visual review issue(s) remain.
        The renderer will correct presentation only, without changing world facts.
      </p>
    </section>
  )
}

function VisualGateDebugStrip(input: {
  gate: VisualDisplayGateDecision
}) {
  return (
    <aside style={styles.debugStrip}>
      <span>gate: {input.gate.status}</span>
      <span>final: {input.gate.review.finalSeverity}</span>
      <span>fixed: {input.gate.review.resolvedFindingCount}</span>
      <span>visual cells: {input.gate.review.generatedVisualOnlyCellCount}</span>
    </aside>
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
  debugStrip: {
    bottom: 12,
    color: "rgba(216, 234, 216, 0.38)",
    display: "flex",
    fontSize: 10,
    gap: 10,
    left: 14,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 2,
  },
  blockedPanel: {
    background: "rgba(10, 20, 17, 0.78)",
    border: "1px solid rgba(202, 104, 82, 0.42)",
    display: "grid",
    gap: 10,
    maxWidth: 520,
    padding: 24,
  },
  blockedTitle: {
    color: "#ffb39f",
    fontSize: 24,
    fontWeight: 800,
  },
  blockedText: {
    color: "rgba(216, 234, 216, 0.76)",
    lineHeight: 1.7,
    margin: 0,
  },
} as const
