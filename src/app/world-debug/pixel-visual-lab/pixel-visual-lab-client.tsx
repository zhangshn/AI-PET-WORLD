// 该组件用于合并视觉 Debug 页面入口。

"use client";

import { useState, type CSSProperties } from "react";

import PixelSceneComposerPanel from "./pixel-scene-composer-panel";
import TreeRenderTestPanel from "./tree-render-test-panel";

export type PixelVisualLabMode = "composer" | "tree";

export default function PixelVisualLabClient({
  initialMode = "composer",
}: {
  initialMode?: PixelVisualLabMode;
}) {
  const [mode, setMode] = useState<PixelVisualLabMode>(initialMode);

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.kicker}>WORLD DEBUG / PIXEL VISUAL LAB / VISUAL ONLY</p>
        <h1 style={styles.title}>Pixel Visual Lab</h1>
        <p style={styles.description}>
          视觉算法测试台：只看像素组合和树木绘制是否能接上后台算法输出。
          本页不读取 runtime，不写入世界事实，不推进 Tick，不替代正式 /world。
        </p>
      </section>

      <nav aria-label="Pixel visual debug sections" style={styles.tabs}>
        <button
          type="button"
          aria-pressed={mode === "composer"}
          onClick={() => setMode("composer")}
          style={mode === "composer" ? styles.activeTab : styles.tab}
        >
          场景组合
        </button>
        <button
          type="button"
          aria-pressed={mode === "tree"}
          onClick={() => setMode("tree")}
          style={mode === "tree" ? styles.activeTab : styles.tab}
        >
          树木绘制
        </button>
      </nav>

      <section style={styles.contentFrame}>
        {mode === "composer" ? <PixelSceneComposerPanel /> : <TreeRenderTestPanel />}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    color: "#eef7ef",
    background:
      "radial-gradient(circle at 18% 8%, rgba(83, 146, 103, 0.26), transparent 34%), linear-gradient(135deg, #0f1715 0%, #182521 58%, #0d1312 100%)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    maxWidth: "1000px",
    marginBottom: "16px",
  },
  kicker: {
    margin: "0 0 8px",
    color: "#9fceaa",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.16em",
  },
  title: {
    margin: "0 0 10px",
    fontSize: "40px",
    lineHeight: 1,
  },
  description: {
    margin: 0,
    maxWidth: "920px",
    color: "#c7d8ca",
    fontSize: "15px",
    lineHeight: 1.65,
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  tab: {
    padding: "10px 16px",
    border: "1px solid rgba(191, 225, 196, 0.2)",
    borderRadius: "999px",
    color: "#d9eadb",
    background: "rgba(8, 18, 15, 0.5)",
    fontWeight: 800,
    cursor: "pointer",
  },
  activeTab: {
    padding: "10px 16px",
    border: 0,
    borderRadius: "999px",
    color: "#102119",
    background: "#9fceaa",
    fontWeight: 900,
    cursor: "pointer",
  },
  contentFrame: {
    overflow: "hidden",
    border: "1px solid rgba(191, 225, 196, 0.14)",
    borderRadius: "24px",
    background: "rgba(4, 10, 8, 0.45)",
  },
} satisfies Record<string, CSSProperties>;
