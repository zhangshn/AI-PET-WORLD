// 该组件用于交互式测试程序化树木绘制参数。

"use client";

import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  buildDefaultPixelTreeFact,
  type PixelTreeBiome,
  type PixelTreeWorldFact,
} from "@/world/procedural-painter/tree/tree-render-test-module";
import {
  buildPixelTreeBiomeSvgGallery,
  buildPixelTreeSvgPreview,
} from "@/world/procedural-painter/tree/tree-render-test-preview";

const BIOME_OPTIONS: PixelTreeBiome[] = ["forest", "grassland", "desert", "oasis"];

const DEFAULT_FACT = buildDefaultPixelTreeFact({
  id: "tree_interactive_preview",
  x: 160,
  y: 254,
  biome: "forest",
  growth: 84,
  health: 90,
  moisture: 74,
  age: 28,
  worldSeed: "ai_pet_world_interactive_tree_seed_001",
});

const biomeGallerySvg = buildPixelTreeBiomeSvgGallery();

export default function TreeRenderTestClient() {
  const [fact, setFact] = useState<PixelTreeWorldFact>(DEFAULT_FACT);

  const preview = useMemo(
    () =>
      buildPixelTreeSvgPreview(fact, {
        width: 320,
        height: 320,
        background: "soft_ground",
        title: "AI-PET-WORLD procedural tree preview",
        showDebugLabel: true,
      }),
    [fact],
  );

  function updateBiome(event: ChangeEvent<HTMLSelectElement>) {
    setFact((current) => ({
      ...current,
      biome: event.target.value as PixelTreeBiome,
    }));
  }

  function updateNumberField(field: "growth" | "health" | "moisture" | "age") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setFact((current) => ({
        ...current,
        [field]: Number(event.target.value),
      }));
    };
  }

  function updateSeed(event: ChangeEvent<HTMLInputElement>) {
    setFact((current) => ({
      ...current,
      worldSeed: event.target.value,
    }));
  }

  function randomizeSeed() {
    const suffix = Math.random().toString(36).slice(2, 10);
    setFact((current) => ({
      ...current,
      worldSeed: `ai_pet_world_tree_seed_${suffix}`,
    }));
  }

  function resetFact() {
    setFact(DEFAULT_FACT);
  }

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

      <section style={styles.layout}>
        <aside style={styles.controlPanel}>
          <h2 style={styles.cardTitle}>树规则参数</h2>
          <p style={styles.cardText}>调整这些世界事实参数，观察树的形态、颜色、密度和结构如何变化。</p>

          <label style={styles.fieldGroup}>
            <span style={styles.fieldLabel}>biome</span>
            <select value={fact.biome} onChange={updateBiome} style={styles.selectInput}>
              {BIOME_OPTIONS.map((biome) => (
                <option key={biome} value={biome}>
                  {biome}
                </option>
              ))}
            </select>
          </label>

          <RangeControl label="growth" value={fact.growth} onChange={updateNumberField("growth")} />
          <RangeControl label="health" value={fact.health} onChange={updateNumberField("health")} />
          <RangeControl label="moisture" value={fact.moisture} onChange={updateNumberField("moisture")} />

          <label style={styles.fieldGroup}>
            <span style={styles.fieldLabel}>age</span>
            <input min={0} max={120} type="range" value={fact.age} onChange={updateNumberField("age")} />
            <span style={styles.valuePill}>{fact.age}</span>
          </label>

          <label style={styles.fieldGroup}>
            <span style={styles.fieldLabel}>worldSeed</span>
            <input value={fact.worldSeed} onChange={updateSeed} style={styles.textInput} />
          </label>

          <div style={styles.buttonRow}>
            <button type="button" onClick={randomizeSeed} style={styles.button}>
              随机 seed
            </button>
            <button type="button" onClick={resetFact} style={styles.secondaryButton}>
              重置
            </button>
          </div>
        </aside>

        <section style={styles.previewGrid}>
          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>实时树预览</h2>
              <p style={styles.cardText}>同一组参数和 seed 会稳定生成同一棵树。</p>
            </div>
            <img
              alt="Procedural pixel tree preview"
              src={toSvgDataUri(preview.svg)}
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
      </section>

      <section style={styles.debugPanel}>
        <h2 style={styles.cardTitle}>当前测试输出</h2>
        <dl style={styles.debugList}>
          <DebugRow label="biome" value={preview.summary.biome} />
          <DebugRow label="growth" value={preview.summary.growth} />
          <DebugRow label="health" value={preview.summary.health} />
          <DebugRow label="moisture" value={preview.summary.moisture} />
          <DebugRow label="growthStage" value={preview.test.perception.growthStage} />
          <DebugRow label="healthState" value={preview.test.perception.healthState} />
          <DebugRow label="moistureState" value={preview.test.perception.moistureState} />
          <DebugRow label="speciesStyle" value={preview.test.decision.speciesStyle} />
          <DebugRow label="draw commands" value={preview.summary.commandCount} />
          <DebugRow label="deterministic key" value={preview.summary.deterministicKey} />
          <DebugRow label="audit" value={preview.test.audit.tags.join(" / ")} />
        </dl>
      </section>
    </main>
  );
}

function RangeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={styles.fieldGroup}>
      <span style={styles.fieldLabel}>{label}</span>
      <input min={0} max={100} type="range" value={value} onChange={onChange} />
      <span style={styles.valuePill}>{value}</span>
    </label>
  );
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.debugRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
  layout: {
    display: "grid",
    gridTemplateColumns: "320px minmax(0, 1fr)",
    gap: "20px",
    alignItems: "start",
  },
  controlPanel: {
    position: "sticky",
    top: "24px",
    padding: "20px",
    border: "1px solid rgba(191, 225, 196, 0.18)",
    borderRadius: "24px",
    background: "rgba(8, 18, 15, 0.64)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)",
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 440px) minmax(520px, 1fr)",
    gap: "20px",
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
  fieldGroup: {
    display: "grid",
    gap: "8px",
    marginTop: "18px",
  },
  fieldLabel: {
    color: "#d8ead8",
    fontSize: "13px",
    fontWeight: 700,
  },
  selectInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid rgba(191, 225, 196, 0.24)",
    borderRadius: "12px",
    color: "#eef7ef",
    background: "#17231f",
  },
  textInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid rgba(191, 225, 196, 0.24)",
    borderRadius: "12px",
    color: "#eef7ef",
    background: "#17231f",
  },
  valuePill: {
    justifySelf: "start",
    padding: "4px 9px",
    borderRadius: "999px",
    color: "#16301f",
    background: "#9fceaa",
    fontSize: "12px",
    fontWeight: 800,
  },
  buttonRow: {
    display: "flex",
    gap: "10px",
    marginTop: "18px",
  },
  button: {
    padding: "10px 14px",
    border: 0,
    borderRadius: "12px",
    color: "#102119",
    background: "#9fceaa",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 14px",
    border: "1px solid rgba(191, 225, 196, 0.24)",
    borderRadius: "12px",
    color: "#d8ead8",
    background: "rgba(255, 255, 255, 0.06)",
    fontWeight: 800,
    cursor: "pointer",
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
} satisfies Record<string, CSSProperties>;
