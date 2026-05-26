// 该组件用于交互式测试像素世界组合算法。

"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  buildDefaultSceneComposerFact,
  buildSceneSvg,
  composeScene,
} from "@/world/procedural-painter/scene-composer/scene-composer-gateway";
import type {
  SceneComposerBiome,
  SceneComposerFact,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema";

const BIOME_OPTIONS: SceneComposerBiome[] = ["forest", "grassland", "desert", "oasis"];

const DEFAULT_FACT = buildDefaultSceneComposerFact();

export default function PixelSceneComposerClient() {
  const [fact, setFact] = useState<SceneComposerFact>(DEFAULT_FACT);
  const safeFact = useMemo(() => normalizeSceneComposerFact(fact), [fact]);
  const sceneSvg = useMemo(() => buildSceneSvg(safeFact), [safeFact]);
  const plan = useMemo(() => composeScene(safeFact), [safeFact]);

  function updateBiome(event: ChangeEvent<HTMLSelectElement>) {
    setFact((current) => ({ ...normalizeSceneComposerFact(current), biome: event.target.value as SceneComposerBiome }));
  }

  function updateNumberField(field: "moisture" | "decorationDensity" | "roadShape") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setFact((current) => ({ ...normalizeSceneComposerFact(current), [field]: Number(event.target.value) }));
    };
  }

  function updateSeed(event: ChangeEvent<HTMLInputElement>) {
    setFact((current) => ({ ...normalizeSceneComposerFact(current), worldSeed: event.target.value }));
  }

  function randomizeSeed() {
    const suffix = Math.random().toString(36).slice(2, 10);
    setFact((current) => ({ ...normalizeSceneComposerFact(current), worldSeed: `ai_pet_world_scene_seed_${suffix}` }));
  }

  function resetFact() {
    setFact(DEFAULT_FACT);
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.kicker}>WORLD DEBUG / PIXEL SCENE COMPOSER</p>
        <h1 style={styles.title}>Pixel Scene Composer</h1>
        <p style={styles.description}>
          这个页面测试“素材如何组合成世界”：地面 tile、路径、边缘过渡、草簇、树、灌木、石头、花和角色占位。
          它不写入正式世界事实，只验证组合规则能不能减少贴图感。
        </p>
      </section>

      <section style={styles.layout}>
        <aside style={styles.controlPanel}>
          <h2 style={styles.cardTitle}>场景事实参数</h2>
          <p style={styles.cardText}>调整这些参数，观察组合算法如何改变地貌、路径、植被密度和场景层级。</p>

          <label style={styles.fieldGroup}>
            <span style={styles.fieldLabel}>biome</span>
            <select value={safeFact.biome} onChange={updateBiome} style={styles.selectInput}>
              {BIOME_OPTIONS.map((biome) => (
                <option key={biome} value={biome}>
                  {biome}
                </option>
              ))}
            </select>
          </label>

          <RangeControl label="moisture" value={safeFact.moisture} onChange={updateNumberField("moisture")} />
          <RangeControl label="decorationDensity" value={safeFact.decorationDensity} onChange={updateNumberField("decorationDensity")} />
          <RangeControl label="roadShape" value={safeFact.roadShape} onChange={updateNumberField("roadShape")} />

          <label style={styles.fieldGroup}>
            <span style={styles.fieldLabel}>worldSeed</span>
            <input value={safeFact.worldSeed} onChange={updateSeed} style={styles.textInput} />
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

        <section style={styles.previewPanel}>
          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>组合场景预览</h2>
              <p style={styles.cardText}>
                目标不是单个素材好看，而是验证 tile、路径、边缘、草和对象能否组成一个整体。
              </p>
            </div>
            <Image
              alt="Pixel world scene composer preview"
              height={432}
              src={toSvgDataUri(sceneSvg)}
              style={styles.sceneImage}
              unoptimized
              width={768}
            />
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>组合计划 Summary</h2>
            <dl style={styles.debugList}>
              <DebugRow label="biome" value={plan.biome} />
              <DebugRow label="moisture" value={plan.moisture} />
              <DebugRow label="decorationDensity" value={plan.decorationDensity} />
              <DebugRow label="roadShape" value={plan.roadShape} />
              <DebugRow label="grass tiles" value={plan.summary.grassTiles} />
              <DebugRow label="path tiles" value={plan.summary.pathTiles} />
              <DebugRow label="edge tiles" value={plan.summary.edgeTiles} />
              <DebugRow label="grass tufts" value={plan.summary.grassTufts} />
              <DebugRow label="trees" value={plan.summary.trees} />
              <DebugRow label="bushes" value={plan.summary.bushes} />
              <DebugRow label="stones" value={plan.summary.stones} />
              <DebugRow label="flowers" value={plan.summary.flowers} />
            </dl>
          </article>
        </section>
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

function normalizeSceneComposerFact(
  fact: SceneComposerFact & {
    density?: number;
    pathCurve?: number;
  }
): SceneComposerFact {
  return {
    id: fact.id ?? DEFAULT_FACT.id,
    biome: BIOME_OPTIONS.includes(fact.biome) ? fact.biome : DEFAULT_FACT.biome,
    moisture: normalizeRangeValue(fact.moisture, DEFAULT_FACT.moisture),
    decorationDensity: normalizeRangeValue(
      fact.decorationDensity ?? fact.density,
      DEFAULT_FACT.decorationDensity
    ),
    roadShape: normalizeRangeValue(
      fact.roadShape ?? fact.pathCurve,
      DEFAULT_FACT.roadShape
    ),
    worldSeed: fact.worldSeed ?? DEFAULT_FACT.worldSeed,
  };
}

function normalizeRangeValue(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "42px",
    color: "#eef7ef",
    background:
      "radial-gradient(circle at 18% 12%, rgba(92, 154, 83, 0.24), transparent 30%), linear-gradient(135deg, #101917 0%, #1a2822 56%, #0f1715 100%)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    maxWidth: "1100px",
    marginBottom: "26px",
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
    maxWidth: "980px",
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
  previewPanel: {
    display: "grid",
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
  sceneImage: {
    display: "block",
    width: "100%",
    maxWidth: "960px",
    height: "auto",
    borderRadius: "18px",
    imageRendering: "pixelated",
    background: "#17231f",
  },
  debugList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    margin: 0,
  },
  debugRow: {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.055)",
  },
} satisfies Record<string, CSSProperties>;
