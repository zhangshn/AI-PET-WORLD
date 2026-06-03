import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import { buildWorldViewModelForPixelWorld } from "@/world/world-view-model"

import { PixelWorldViewReadonlyEntry } from "./components/pixel-worldview-readonly-entry/pixel-worldview-readonly-entry"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()

  if (!runtimeView.isPersisted) {
    return (
      <main style={emptyWorldStyles.page}>
        <section style={emptyWorldStyles.card}>
          <div style={emptyWorldStyles.brand}>AI-PET-WORLD</div>
          <h1 style={emptyWorldStyles.title}>世界尚未创建</h1>
          <p style={emptyWorldStyles.body}>
            正式世界需要先由出生信息生成管家人格、世界种子和第一片家园。
            这里不会展示默认世界，也不会偷偷写入 runtime。
          </p>
          <a href="/create-world" style={emptyWorldStyles.link}>
            去创建世界
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
    background: "#17231f",
    color: "#d8ead8",
    display: "flex",
    minHeight: "100vh",
    padding: 24,
  },
  card: {
    background: "#1f302a",
    border: "1px solid #3f6861",
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
