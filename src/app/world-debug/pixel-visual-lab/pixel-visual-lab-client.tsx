// 该组件用于合并视觉 Debug 页面入口。

"use client";

import { useState, type CSSProperties } from "react";

import PixelSceneComposerClient from "../pixel-scene-composer/pixel-scene-composer-client";
import TreeRenderTestClient from "../tree-render-test/tree-render-test-client";

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
          这里只合并视觉 Debug 页面，用于观察像素组合、树木绘制、场景融合和图层效果。
          本页不读取 runtime，不写入世界事实，不推进 Tick，不替代正式 /world，也不参与核心资源库验算。
        </p>
      </section>

      <section style={styles.boundaryPanel}>
        <strong>当前边界：</strong>
        <span>只做视觉 Debug 合并。</span>
        <span>不进入正式 /world。</span>
        <span>不改变 WorldViewModel。</span>
        <span>不新增正式画图算法。</span>
      </section>

      <nav aria-label="Pixel visual debug sections" style={styles.tabs}>
        <button
          type="button"
          aria-pressed={mode === "composer"}
          onClick={() => setMode("composer")}
          style={mode === "composer" ? styles.activeTab : styles.tab}
        >
          Pixel Scene Composer
        </button>
        <button
          type="button"
          aria-pressed={mode === "tree"}
          onClick={() => setMode("tree")}
          style={mode === "tree" ? styles.activeTab : styles.tab}
        >
          Tree Render Test
        </button>
      </nav>

      <section style={styles.contentFrame}>
        {mode === "composer" ? <PixelSceneComposerClient /> : <TreeRenderTestClient />}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    color: "#eef7ef",
    background:
      "radial-gradient(circle at 18% 8%, rgba(83, 146, 103, 0.26), transparent 34%), linear-gradient(135deg, #0f1715 0%, #182521 58%, #0d1312 100%)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    maxWidth: "1100px",
    marginBottom: "18px",
  },
  kicker: {
    margin: "0 0 8px",
    color: "#9fceaa",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.16em",
  },
  title: {
    margin: "0 0 14px",
    fontSize: "44px",
    lineHeight: 1,
  },
  description: {
    margin: 0,
    maxWidth: "980px",
    color: "#c7d8ca",
    fontSize: "16px",
    lineHeight: 1.75,
  },
  boundaryPanel: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    marginBottom: "18px",
    padding: "14px 16px",
    border: "1px solid rgba(191, 225, 196, 0.16)",
    borderRadius: "18px",
    color: "#cfe4d2",
    background: "rgba(8, 18, 15, 0.52)",
    fontSize: "13px",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "18px",
  },
  tab: {
    padding: "11px 16px",
    border: "1px solid rgba(191, 225, 196, 0.2)",
    borderRadius: "999px",
    color: "#d9eadb",
    background: "rgba(8, 18, 15, 0.5)",
    fontWeight: 800,
    cursor: "pointer",
  },
  activeTab: {
    padding: "11px 16px",
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
    borderRadius: "28px",
    background: "rgba(4, 10, 8, 0.45)",
  },
} satisfies Record<string, CSSProperties>;
