import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import { buildWorldViewModelForPixelWorld } from "@/world/world-view-model"

import { PixelWorldViewReadonlyEntry } from "./components/pixel-worldview-readonly-entry/pixel-worldview-readonly-entry"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()

  if (!runtimeView.isPersisted) {
    return (
      <main style={emptyWorldStyles.page}>
        <section style={emptyWorldStyles.panel}>
          <div style={emptyWorldStyles.brand}>AI-PET-WORLD</div>
          <h1 style={emptyWorldStyles.title}>World not created</h1>
          <p style={emptyWorldStyles.body}>
            Create a formal world first. This screen will not generate a default
            runtime or rewrite world facts.
          </p>
          <a href="/create-world" style={emptyWorldStyles.link}>
            Create world
          </a>
        </section>
      </main>
    )
  }

  const saveRecord = runtimeView.saveRecord
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord,
    isPersisted: runtimeView.isPersisted,
  })

  return <PixelWorldViewReadonlyEntry worldViewModel={worldViewModel} />
}

const emptyWorldStyles = {
  page: {
    alignItems: "center",
    background:
      "radial-gradient(circle at 50% 22%, #21362e 0, #14231e 48%, #09110f 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 24,
  },
  panel: {
    background: "rgba(10, 20, 17, 0.38)",
    border: "1px solid rgba(143, 190, 159, 0.22)",
    maxWidth: 520,
    padding: 28,
  },
  brand: {
    color: "rgba(216, 234, 216, 0.68)",
    fontSize: 13,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    margin: "0 0 12px",
  },
  body: {
    lineHeight: 1.8,
    margin: "0 0 20px",
  },
  link: {
    background: "#c8df8f",
    color: "#142014",
    display: "inline-block",
    fontWeight: 700,
    padding: "12px 16px",
    textDecoration: "none",
  },
} as const
