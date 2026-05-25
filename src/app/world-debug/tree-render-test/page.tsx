// 该页面用于测试程序化树木绘制模块。

import {
  buildPixelTreeBiomeSvgGallery,
  buildPixelTreeSvgPreview,
} from "@/world/procedural-painter/tree/tree-render-test-preview";
import { buildDefaultPixelTreeFact } from "@/world/procedural-painter/tree/tree-render-test-module";

const singleTree = buildPixelTreeSvgPreview(
  buildDefaultPixelTreeFact({
    id: "tree_single_preview",
    x: 160,
    y: 254,
    biome: "forest",
    growth: 84,
    health: 90,
    moisture: 74,
  }),
  {
    width: 320,
    height: 320,
    background: "soft_ground",
    title: "AI-PET-WORLD procedural tree preview",
    showDebugLabel: true,
  },
);

const biomeGallerySvg = buildPixelTreeBiomeSvgGallery();

export default function TreeRenderTestPage() {
  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.kicker}>WORLD DEBUG / PROCEDURAL PAINTER</p>
        <h1 style={styles.title}>Tree Render Test</h1>
        <p style={styles.description}>
          这个页面只测试“树的规则绘制脑子”：TreeFact → Perception → VisualDecision → Structure → DrawCommands → SVG。
          它不写入世界事实，不调用外部 AI，不使用贴图资产。
        </p>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>单棵树预览</h2>
            <p style={styles.cardText}>同一组世界参数会稳定生成同一棵树。</p>
          </div>
          <img
            alt="Procedural pixel tree preview"
            src={toSvgDataUri(singleTree.svg)}
            style={styles.previewImage}
          />
        </article>

        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>四种地貌样例</h2>
            <p style={styles.cardText}>forest / grassland / desert / oasis 会生成不同树形、颜色和密度。</p>
          </div>
          <img
            alt="Procedural pixel tree biome gallery"
            src={toSvgDataUri(biomeGallerySvg)}
            style={styles.galleryImage}
          />
        </article>
      </section>

      <section style={styles.debugPanel}>
        <h2 style={styles.cardTitle}>当前测试输出</h2>
        <dl style={styles.debugList}>
          <div style={styles.debugRow}>
            <dt>biome</dt>
            <dd>{singleTree.summary.biome}</dd>
          </div>
          <div style={styles.debugRow}>
            <dt>growth</dt>
            <dd>{singleTree.summary.growth}</dd>
          </div>
          <div style={styles.debugRow}>
            <dt>health</dt>
            <dd>{singleTree.summary.health}</dd>
          </div>
          <div style={styles.debugRow}>
            <dt>moisture</dt>
            <dd>{singleTree.summary.moisture}</dd>
          </div>
          <div style={styles.debugRow}>
            <dt>draw commands</dt>
            <dd>{singleTree.summary.commandCount}</dd>
          </div>
          <div style={styles.debugRow}>
            <dt>deterministic key</dt>
            <dd>{singleTree.summary.deterministicKey}</dd>
          </div>
          <div style={styles.debugRow}>
            <dt>audit</dt>
            <dd>{singleTree.test.audit.tags.join(" / ")}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "48px",
    color: "#eef7ef",
    background:
      "radial-gradient(circle at 20% 10%, rgba(74, 129, 88, 0.28), transparent 34%), linear-gradient(135deg, #101917 0%, #1b2823 54%, #0f1715 100%)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    maxWidth: "980px",
    marginBottom: "28px",
  },
  kicker: {
    margin: "0 0 8px",
    color: "#9fceaa",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.16em",
  },
  title: {
    margin: "0 0 14px",
    fontSize: "44px",
    lineHeight: 1,
  },
  description: {
    margin: 0,
    maxWidth: "920px",
    color: "#c7d8ca",
    fontSize: "16px",
    lineHeight: 1.75,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 440px) minmax(560px, 1fr)",
    gap: "20px",
    alignItems: "stretch",
  },
  card: {
    padding: "20px",
    border: "1px solid rgba(191, 225, 196, 0.18)",
    borderRadius: "24px",
    background: "rgba(8, 18, 15, 0.58)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)",
  },
  cardHeader: {
    marginBottom: "16px",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
  },
  cardText: {
    margin: 0,
    color: "#b9cabb",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  previewImage: {
    display: "block",
    width: "100%",
    maxWidth: "360px",
    height: "auto",
    margin: "0 auto",
    borderRadius: "18px",
    imageRendering: "pixelated",
    background: "#17231f",
  },
  galleryImage: {
    display: "block",
    width: "100%",
    height: "auto",
    borderRadius: "18px",
    imageRendering: "pixelated",
    background: "#17231f",
  },
  debugPanel: {
    marginTop: "20px",
    padding: "20px",
    border: "1px solid rgba(191, 225, 196, 0.16)",
    borderRadius: "24px",
    background: "rgba(8, 18, 15, 0.5)",
  },
  debugList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    margin: 0,
  },
  debugRow: {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.055)",
  },
} satisfies Record<string, React.CSSProperties>;
