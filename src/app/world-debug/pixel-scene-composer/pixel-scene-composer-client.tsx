// 该组件用于交互式测试像素世界组合算法，并集中展示规则资产库。

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

type AssetLibrarySection = {
  title: string;
  purpose: string;
  assets: string[];
  ruleSources: string[];
};

const ASSET_LIBRARY_SECTIONS: AssetLibrarySection[] = [
  {
    title: "Tile Layer｜地面资产",
    purpose: "负责把 SpaceGrid、生态健康、湿度、空间压力和痕迹强度转成稳定地表表现。",
    assets: ["grass", "pressed_grass", "worn_grass", "exposed_soil", "ecology_transition", "recovery_growth", "soil", "built", "boundary"],
    ruleSources: ["SpaceGrid.cells", "terrainKind", "regionKind", "traceStrength", "ecologyHealthHint", "moistureHint"],
  },
  {
    title: "Trace Layer｜痕迹资产",
    purpose: "负责把世界长期运行留下的痕迹转成可见地表变化，而不是装饰贴图。",
    assets: ["草地压低", "裸土", "磨损地面", "维护痕迹", "恢复痕迹", "等待点", "关注点"],
    ruleSources: ["TraceField", "TraceLifecycle", "TraceInfluence", "TraceVisualProjection", "MemorySeed"],
  },
  {
    title: "Object Layer｜自然对象资产",
    purpose: "负责树、灌木、石头、花、蘑菇和小生态信号的世界表现。",
    assets: ["tree", "bush", "stone", "flower", "mushroom", "insect_signal", "grass_tuft"],
    ruleSources: ["HomeMapState.placements", "derived_visual_only", "world seed", "naturalGrowth", "spacePressure"],
  },
  {
    title: "Sprite Layer｜生命主体资产",
    purpose: "负责管家与未来宠物的像素主体表现。宠物未正式入场前不能默认显示。",
    assets: ["butler.observe", "butler.wait", "butler.maintain", "future_pet.gated"],
    ruleSources: ["ButlerState", "lastButlerRuntimeDecision", "existing actor fact only"],
  },
  {
    title: "Atmosphere Layer｜氛围资产",
    purpose: "负责让时间线、生态状态和世界阶段影响整体光照与氛围。",
    assets: ["calm", "warm", "recovering", "busy", "clear", "soft", "damp"],
    ruleSources: ["groundHealth", "careReadiness", "spacePressure", "world phase"],
  },
  {
    title: "UI Overlay｜轻 UI 资产",
    purpose: "只承载管家一句话、P-Phone 与必要状态，不替代主世界画面。",
    assets: ["管家一句话", "P-Phone 最近记录", "新记录提示"],
    ruleSources: ["WorldViewModel.butlerExplanation", "WorldViewModel.pPhone"],
  },
];

const RULE_LIBRARY = [
  "规则资产库不是大数据训练模型；当前阶段用显式规则、权重参数、世界种子、痕迹反馈和小样本日志迭代。",
  "正式 /world 只读 WorldViewModel；资产库和调参实验统一留在 /world-debug/pixel-scene-composer。",
  "derived_visual_only 只能进入 WorldViewModel，必须带 not_world_fact / no_runtime_write，不能写入 HomeMapState。",
  "Pixel Scene Composer 验证的是组合规则，不是正式产品页；后续新增资产先在这里观察，再沉淀到正式 mapper。",
];

export default function PixelSceneComposerClient() {
  const [fact, setFact] = useState<SceneComposerFact>(DEFAULT_FACT);
  const safeFact = useMemo(() => normalizeSceneComposerFact(fact), [fact]);
  const sceneSvg = useMemo(() => buildSceneSvg(safeFact), [safeFact]);
  const plan = useMemo(() => composeScene(safeFact), [safeFact]);

  function updateBiome(event: ChangeEvent<HTMLSelectElement>) {
    setFact((current) => ({ ...normalizeSceneComposerFact(current), biome: event.target.value as SceneComposerBiome }));
  }

  function updateNumberField(field: "moisture" | "decorationDensity" | "traceShape") {
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
        <p style={styles.kicker}>WORLD DEBUG / PIXEL SCENE COMPOSER / ASSET LIBRARY</p>
        <h1 style={styles.title}>Pixel Scene Composer</h1>
        <p style={styles.description}>
          这里是像素世界组合规则实验室，也是规则资产库入口。它用于观察地面 tile、痕迹、生态过渡、自然对象、生命主体和图层关系如何组合成世界。
          它不写入正式世界事实，不推进 runtime Tick，不替代正式 /world。
        </p>
      </section>

      <section style={styles.layout}>
        <aside style={styles.controlPanel}>
          <h2 style={styles.cardTitle}>场景事实参数</h2>
          <p style={styles.cardText}>调整这些参数，观察组合算法如何改变地貌、移动痕迹、植被密度和场景层级。</p>

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
          <RangeControl label="traceShape" value={safeFact.traceShape} onChange={updateNumberField("traceShape")} />

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
                目标不是单个素材好看，而是验证 tile、移动痕迹、生态过渡、草和对象能否组成一个整体。
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
            <h2 style={styles.cardTitle}>规则资产库</h2>
            <p style={styles.cardText}>
              后续新增 tile、trace、object、sprite、atmosphere 资产都先放在这里观察。进入正式 /world 前，必须沉淀为 WorldViewModel mapper 或 PixelWorld renderer 规则。
            </p>
            <div style={styles.assetLibraryGrid}>
              {ASSET_LIBRARY_SECTIONS.map((section) => (
                <section key={section.title} style={styles.assetCard}>
                  <h3 style={styles.assetTitle}>{section.title}</h3>
                  <p style={styles.assetPurpose}>{section.purpose}</p>
                  <div style={styles.assetTagGroup}>
                    {section.assets.map((asset) => (
                      <span key={asset} style={styles.assetTag}>{asset}</span>
                    ))}
                  </div>
                  <div style={styles.ruleSourceBox}>
                    <strong>规则来源</strong>
                    <ul style={styles.compactList}>
                      {section.ruleSources.map((source) => (
                        <li key={source}>{source}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>规则边界</h2>
            <ul style={styles.ruleList}>
              {RULE_LIBRARY.map((rule) => (
                <li key={rule} style={styles.ruleItem}>{rule}</li>
              ))}
            </ul>
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>组合计划 Summary</h2>
            <dl style={styles.debugList}>
              <DebugRow label="biome" value={plan.biome} />
              <DebugRow label="moisture" value={plan.moisture} />
              <DebugRow label="decorationDensity" value={plan.decorationDensity} />
              <DebugRow label="trace shape" value={plan.traceShape} />
              <DebugRow label="trace density" value={plan.traceDensity} />
              <DebugRow label="grass tiles" value={plan.summary.grassTiles} />
              <DebugRow label="long-used area tiles" value={plan.summary.longUsedAreaTiles} />
              <DebugRow label="trace edge tiles" value={plan.summary.traceEdgeTiles} />
              <DebugRow label="trace influenced tiles" value={plan.summary.traceInfluencedTiles} />
              <DebugRow label="movement influenced tiles" value={plan.summary.movementInfluencedTiles} />
              <DebugRow label="spatial use influenced tiles" value={plan.summary.spatialUseInfluencedTiles} />
              <DebugRow label="ecology influenced tiles" value={plan.summary.ecologyInfluencedTiles} />
              <DebugRow label="pressed grass tiles" value={plan.summary.pressedGrassTiles} />
              <DebugRow label="worn grass tiles" value={plan.summary.wornGrassTiles} />
              <DebugRow label="exposed soil tiles" value={plan.summary.exposedSoilTiles} />
              <DebugRow label="ecology transition tiles" value={plan.summary.ecologyTransitionTiles} />
              <DebugRow label="suppressed grass tufts" value={plan.summary.traceSuppressedGrassTufts} />
              <DebugRow label="avoided generated objects" value={plan.summary.traceAvoidedGeneratedObjects} />
              <DebugRow label="grass tufts" value={plan.summary.grassTufts} />
              <DebugRow label="trees" value={plan.summary.trees} />
              <DebugRow label="bushes" value={plan.summary.bushes} />
              <DebugRow label="stones" value={plan.summary.stones} />
              <DebugRow label="flowers" value={plan.summary.flowers} />
              <DebugRow label="mushrooms" value={plan.summary.mushrooms} />
              <DebugRow label="insect signals" value={plan.summary.insectSignals} />
              <DebugRow label="healthy trees" value={plan.summary.healthyTrees} />
              <DebugRow label="stressed trees" value={plan.summary.stressedTrees} />
              <DebugRow label="mature trees" value={plan.summary.matureTrees} />
              <DebugRow label="declining objects" value={plan.summary.decliningObjects} />
              <DebugRow label="ecology objects" value={plan.summary.ecologyObjects} />
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
    /** @deprecated Legacy debug compatibility. Use traceShape. */
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
    traceShape: normalizeRangeValue(
      fact.traceShape ?? fact.roadShape ?? fact.pathCurve,
      DEFAULT_FACT.traceShape
    ),
    traceDensity: normalizeRangeValue(
      fact.traceDensity,
      DEFAULT_FACT.traceDensity
    ),
    worldSeed: fact.worldSeed ?? DEFAULT_FACT.worldSeed,
    hasTraceFact: fact.hasTraceFact ?? DEFAULT_FACT.hasTraceFact,
    traceFacts: fact.traceFacts ?? DEFAULT_FACT.traceFacts,
    includeActorPlaceholder:
      fact.includeActorPlaceholder ?? DEFAULT_FACT.includeActorPlaceholder,
    factObjects: fact.factObjects ?? DEFAULT_FACT.factObjects,
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
  assetLibraryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
    marginTop: "18px",
  },
  assetCard: {
    display: "grid",
    gap: "10px",
    padding: "14px",
    border: "1px solid rgba(191, 225, 196, 0.16)",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.045)",
  },
  assetTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#eef7ef",
  },
  assetPurpose: {
    margin: 0,
    color: "#b9cabb",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  assetTagGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  assetTag: {
    padding: "3px 7px",
    borderRadius: "999px",
    color: "#14301d",
    background: "#9fceaa",
    fontSize: "11px",
    fontWeight: 800,
  },
  ruleSourceBox: {
    padding: "10px",
    borderRadius: "12px",
    background: "rgba(9, 20, 17, 0.55)",
    color: "#d8ead8",
    fontSize: "12px",
    lineHeight: 1.55,
  },
  compactList: {
    margin: "6px 0 0",
    paddingLeft: "18px",
  },
  ruleList: {
    display: "grid",
    gap: "10px",
    margin: "12px 0 0",
    padding: 0,
    listStyle: "none",
  },
  ruleItem: {
    padding: "12px 14px",
    borderRadius: "14px",
    color: "#d8ead8",
    background: "rgba(255, 255, 255, 0.055)",
    fontSize: "13px",
    lineHeight: 1.6,
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
