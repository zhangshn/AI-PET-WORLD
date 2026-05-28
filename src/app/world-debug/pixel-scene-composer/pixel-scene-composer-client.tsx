// 该组件用于观察 Debug 像素组合效果，不作为正式核心算法或验算资源库。

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

type PixelReferenceLayer = "tile" | "trace" | "object" | "sprite" | "atmosphere" | "ui";

type PixelVisualReference = {
  id: string;
  label: string;
  layer: PixelReferenceLayer;
  description: string;
  referenceSources: string[];
  boundaryTags: string[];
};

type VisualReferenceSection = {
  title: string;
  purpose: string;
  references: PixelVisualReference[];
  formalInputs: string[];
};

const VISUAL_REFERENCE_SECTIONS: VisualReferenceSection[] = [
  {
    title: "Tile Layer｜地面视觉参考",
    purpose: "只观察地面表现效果；正式地面仍由 SpaceGrid 与 WorldViewModel 计算结果决定。",
    references: [
      buildReference("grass", "grass", "tile", "基础草地表现参考，用于观察自然地面可读性。"),
      buildReference("pressed_grass", "pressed_grass", "tile", "草地被压低的表现参考。它不是道路事实，只能来自痕迹投影。"),
      buildReference("worn_grass", "worn_grass", "tile", "长期使用后的磨损草地表现参考。"),
      buildReference("exposed_soil", "exposed_soil", "tile", "裸土表现参考，正式世界必须来自痕迹或生态状态。"),
      buildReference("ecology_transition", "ecology_transition", "tile", "生态过渡地面表现参考。"),
      buildReference("recovery_growth", "recovery_growth", "tile", "恢复生长地面表现参考。"),
      buildReference("boundary", "boundary", "tile", "世界边界表现参考。"),
    ],
    formalInputs: ["SpaceGrid.cells", "terrainKind", "regionKind", "TraceField projection", "ecologyHealthHint"],
  },
  {
    title: "Trace Layer｜痕迹视觉参考",
    purpose: "只观察痕迹如何被看见；正式痕迹事实必须来自 TraceField。",
    references: [
      buildReference("trace_pressed_grass", "草地压低", "trace", "movement / spatial_use 痕迹的可见表现参考。"),
      buildReference("trace_exposed_soil", "裸土", "trace", "高强度使用后的裸土痕迹表现参考。"),
      buildReference("trace_worn_ground", "磨损地面", "trace", "反复经过、等待或使用后的磨损表现参考。"),
      buildReference("trace_maintained_area", "维护痕迹", "trace", "管家维护行为的区域提示参考。"),
      buildReference("trace_waiting_spot", "等待点", "trace", "管家等待、观察、短暂停留后的弱痕迹参考。"),
      buildReference("trace_attention_glow", "关注点", "trace", "管家关注点的轻提示参考，不是世界命令。"),
    ],
    formalInputs: ["TraceField", "TraceLifecycle", "TraceInfluence", "TraceVisualProjection", "MemorySeed"],
  },
  {
    title: "Object Layer｜自然对象视觉参考",
    purpose: "只观察树、灌木、石头、花、蘑菇和生态信号的组合密度。正式对象必须受世界事实和派生规则约束。",
    references: [
      buildReference("tree", "tree", "object", "树木表现参考。正式事实来自 placements；视觉补足必须标记 derived_visual_only。"),
      buildReference("bush", "bush", "object", "灌木表现参考，用于观察自然密度。"),
      buildReference("stone", "stone", "object", "石头表现参考，用于观察地表节奏。"),
      buildReference("flower", "flower", "object", "花朵表现参考，通常用于较高生态健康区域。"),
      buildReference("mushroom", "mushroom", "object", "蘑菇表现参考，通常用于潮湿或恢复区域。"),
      buildReference("insect_signal", "insect_signal", "object", "小生态信号表现参考。"),
      buildReference("grass_tuft", "grass_tuft", "object", "草簇表现参考，用于降低纯 tile 网格感。"),
    ],
    formalInputs: ["HomeMapState.placements", "derived_visual_only", "world seed", "naturalGrowth", "spacePressure"],
  },
  {
    title: "Sprite Layer｜生命主体视觉参考",
    purpose: "只观察角色占位表现。正式 /world 当前只允许管家；宠物没有正式事实前不能显示。",
    references: [
      buildReference("butler_observe", "butler.observe", "sprite", "管家观察姿态表现参考。"),
      buildReference("butler_wait", "butler.wait", "sprite", "管家等待姿态表现参考。"),
      buildReference("butler_maintain", "butler.maintain", "sprite", "管家维护姿态表现参考。"),
      buildReference("future_pet_gated", "future_pet.gated", "sprite", "未来宠物视觉占位参考；没有正式宠物事实前不能进入 /world。"),
    ],
    formalInputs: ["ButlerState", "lastButlerRuntimeDecision", "existing actor fact only"],
  },
  {
    title: "Atmosphere Layer｜氛围视觉参考",
    purpose: "只观察光照、湿度和世界阶段的氛围效果。正式氛围必须来自世界状态。",
    references: [
      buildReference("atmosphere_calm", "calm", "atmosphere", "平稳氛围表现参考。"),
      buildReference("atmosphere_warm", "warm", "atmosphere", "照料状态较好时的温暖氛围参考。"),
      buildReference("atmosphere_recovering", "recovering", "atmosphere", "生态恢复时的氛围参考。"),
      buildReference("weather_damp", "damp", "atmosphere", "潮湿天气表现参考。"),
    ],
    formalInputs: ["groundHealth", "careReadiness", "spacePressure", "world phase"],
  },
  {
    title: "UI Overlay｜轻 UI 视觉参考",
    purpose: "只观察轻 UI 表达。正式 UI 只能承载管家一句话、P-Phone 与必要状态。",
    references: [
      buildReference("ui_butler_line", "管家一句话", "ui", "管家对世界状态的自然解释参考。"),
      buildReference("ui_p_phone", "P-Phone 最近记录", "ui", "P-Phone 最近世界记录参考。"),
      buildReference("ui_new_record", "新记录提示", "ui", "有新事件时的轻提示参考。"),
    ],
    formalInputs: ["WorldViewModel.butlerExplanation", "WorldViewModel.pPhone"],
  },
];

const DEBUG_BOUNDARIES = [
  "本页是 Debug 组合预览实验室，不是正式核心验算库。",
  "本页只观察视觉组合效果，不验证世界事实是否正确。",
  "正式世界算法以 HomeMapState、SpaceGrid、TraceField、WorldViewModel 的计算结果为准。",
  "本页的参数、seed、SVG 预览和视觉参考项不能写入 runtime save。",
  "如果某个视觉参考要进入 /world，必须先沉淀到正式 mapper，并通过对应 smoke 验收。",
];

const FLAT_REFERENCES = VISUAL_REFERENCE_SECTIONS.flatMap((section) => section.references);

export default function PixelSceneComposerClient() {
  const [fact, setFact] = useState<SceneComposerFact>(DEFAULT_FACT);
  const [selectedReferenceId, setSelectedReferenceId] = useState(FLAT_REFERENCES[0]?.id ?? "grass");
  const safeFact = useMemo(() => normalizeSceneComposerFact(fact), [fact]);
  const sceneSvg = useMemo(() => buildSceneSvg(safeFact), [safeFact]);
  const plan = useMemo(() => composeScene(safeFact), [safeFact]);
  const selectedReference = useMemo(
    () => FLAT_REFERENCES.find((reference) => reference.id === selectedReferenceId) ?? FLAT_REFERENCES[0],
    [selectedReferenceId]
  );

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
        <p style={styles.kicker}>WORLD DEBUG / PIXEL SCENE COMPOSER / VISUAL REFERENCE ONLY</p>
        <h1 style={styles.title}>Pixel Scene Composer</h1>
        <p style={styles.description}>
          这里是像素组合预览实验室，只用于观察地面 tile、痕迹、生态过渡、自然对象、生命主体和图层关系的视觉组合效果。
          它不是正式核心验算库，不验证世界事实是否正确，不写入正式世界事实，不推进 runtime Tick，不替代正式 /world。
        </p>
      </section>

      <section style={styles.layout}>
        <aside style={styles.controlPanel}>
          <h2 style={styles.cardTitle}>Debug 预览参数</h2>
          <p style={styles.cardText}>调整这些参数，只观察组合效果。正式世界计算结果必须通过核心验算链路确认。</p>
          <label style={styles.fieldGroup}>
            <span style={styles.fieldLabel}>biome</span>
            <select value={safeFact.biome} onChange={updateBiome} style={styles.selectInput}>
              {BIOME_OPTIONS.map((biome) => <option key={biome} value={biome}>{biome}</option>)}
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
            <button type="button" onClick={randomizeSeed} style={styles.button}>随机 seed</button>
            <button type="button" onClick={resetFact} style={styles.secondaryButton}>重置</button>
          </div>
        </aside>

        <section style={styles.previewPanel}>
          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>组合场景预览</h2>
              <p style={styles.cardText}>目标不是验证核心算法，而是观察 tile、痕迹、生态过渡、草和对象能否形成自然整体。</p>
            </div>
            <Image alt="Pixel world scene composer preview" height={432} src={toSvgDataUri(sceneSvg)} style={styles.sceneImage} unoptimized width={768} />
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Debug 视觉参考库</h2>
            <p style={styles.cardText}>这里保存的是视觉组合参考，不是正式核心资源库。点击参考项可以查看预览、参考输入和正式接入边界。</p>
            <div style={styles.assetWorkbench}>
              <div style={styles.assetLibraryGrid}>
                {VISUAL_REFERENCE_SECTIONS.map((section) => (
                  <section key={section.title} style={styles.assetCard}>
                    <h3 style={styles.assetTitle}>{section.title}</h3>
                    <p style={styles.assetPurpose}>{section.purpose}</p>
                    <div style={styles.assetTagGroup}>
                      {section.references.map((reference) => (
                        <button aria-pressed={selectedReference.id === reference.id} key={reference.id} onClick={() => setSelectedReferenceId(reference.id)} style={selectedReference.id === reference.id ? styles.activeAssetButton : styles.assetButton} type="button">
                          {reference.label}
                        </button>
                      ))}
                    </div>
                    <div style={styles.ruleSourceBox}>
                      <strong>正式输入参考</strong>
                      <ul style={styles.compactList}>{section.formalInputs.map((source) => <li key={source}>{source}</li>)}</ul>
                    </div>
                  </section>
                ))}
              </div>
              <ReferencePreviewPanel reference={selectedReference} />
            </div>
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Debug 边界</h2>
            <ul style={styles.ruleList}>{DEBUG_BOUNDARIES.map((rule) => <li key={rule} style={styles.ruleItem}>{rule}</li>)}</ul>
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Debug 组合摘要</h2>
            <dl style={styles.debugList}>
              <DebugRow label="biome" value={plan.biome} />
              <DebugRow label="moisture" value={plan.moisture} />
              <DebugRow label="decorationDensity" value={plan.decorationDensity} />
              <DebugRow label="trace shape" value={plan.traceShape} />
              <DebugRow label="trace density" value={plan.traceDensity} />
              <DebugRow label="grass tiles" value={plan.summary.grassTiles} />
              <DebugRow label="pressed grass tiles" value={plan.summary.pressedGrassTiles} />
              <DebugRow label="worn grass tiles" value={plan.summary.wornGrassTiles} />
              <DebugRow label="exposed soil tiles" value={plan.summary.exposedSoilTiles} />
              <DebugRow label="ecology transition tiles" value={plan.summary.ecologyTransitionTiles} />
              <DebugRow label="grass tufts" value={plan.summary.grassTufts} />
              <DebugRow label="trees" value={plan.summary.trees} />
              <DebugRow label="bushes" value={plan.summary.bushes} />
              <DebugRow label="stones" value={plan.summary.stones} />
              <DebugRow label="flowers" value={plan.summary.flowers} />
              <DebugRow label="mushrooms" value={plan.summary.mushrooms} />
              <DebugRow label="insect signals" value={plan.summary.insectSignals} />
            </dl>
          </article>
        </section>
      </section>
    </main>
  );
}

function buildReference(id: string, label: string, layer: PixelReferenceLayer, description: string): PixelVisualReference {
  return { id, label, layer, description, referenceSources: referenceSourcesForLayer(layer), boundaryTags: boundaryTagsForLayer(layer) };
}

function referenceSourcesForLayer(layer: PixelReferenceLayer): string[] {
  if (layer === "tile") return ["SpaceGrid.cells", "terrainKind", "traceStrength", "ecologyHealthHint"];
  if (layer === "trace") return ["TraceField", "TraceLifecycle", "TraceInfluence", "MemorySeed"];
  if (layer === "object") return ["HomeMapState.placements", "derived_visual_only", "world seed", "naturalGrowth"];
  if (layer === "sprite") return ["ButlerState", "lastButlerRuntimeDecision", "existing actor fact only"];
  if (layer === "atmosphere") return ["groundHealth", "careReadiness", "spacePressure", "world phase"];
  return ["WorldViewModel.butlerExplanation", "WorldViewModel.pPhone"];
}

function boundaryTagsForLayer(layer: PixelReferenceLayer): string[] {
  if (layer === "object") return ["visual_reference_only", "derived_visual_only", "no_runtime_write"];
  if (layer === "sprite") return ["visual_reference_only", "no_default_pet_actor", "existing_fact_required"];
  if (layer === "trace") return ["visual_reference_only", "trace_projection", "not_decoration"];
  return ["visual_reference_only", "read_only"];
}

function ReferencePreviewPanel({ reference }: { reference: PixelVisualReference }) {
  return (
    <aside style={styles.assetPreviewPanel}>
      <div>
        <p style={styles.assetPreviewKicker}>当前查看参考</p>
        <h3 style={styles.assetPreviewTitle}>{reference.label}</h3>
        <p style={styles.assetPurpose}>{reference.description}</p>
      </div>
      <div style={styles.assetMetaGrid}>
        <div style={styles.ruleSourceBox}><strong>参考图层</strong><p style={styles.metaText}>{reference.layer}</p></div>
        <div style={styles.ruleSourceBox}><strong>接入边界</strong><p style={styles.metaText}>{reference.boundaryTags.join(" / ")}</p></div>
      </div>
      <div style={styles.ruleSourceBox}>
        <strong>参考输入</strong>
        <ul style={styles.compactList}>{reference.referenceSources.map((source) => <li key={source}>{source}</li>)}</ul>
      </div>
    </aside>
  );
}

function RangeControl({ label, value, onChange }: { label: string; value: number; onChange: (event: ChangeEvent<HTMLInputElement>) => void; }) {
  return <label style={styles.fieldGroup}><span style={styles.fieldLabel}>{label}</span><input min={0} max={100} type="range" value={value} onChange={onChange} /><span style={styles.valuePill}>{value}</span></label>;
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return <div style={styles.debugRow}><dt>{label}</dt><dd>{value}</dd></div>;
}

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeSceneComposerFact(fact: SceneComposerFact & { density?: number; /** @deprecated Legacy debug compatibility. Use traceShape. */ pathCurve?: number; }): SceneComposerFact {
  return {
    id: fact.id ?? DEFAULT_FACT.id,
    biome: BIOME_OPTIONS.includes(fact.biome) ? fact.biome : DEFAULT_FACT.biome,
    moisture: normalizeRangeValue(fact.moisture, DEFAULT_FACT.moisture),
    decorationDensity: normalizeRangeValue(fact.decorationDensity ?? fact.density, DEFAULT_FACT.decorationDensity),
    traceShape: normalizeRangeValue(fact.traceShape ?? fact.roadShape ?? fact.pathCurve, DEFAULT_FACT.traceShape),
    traceDensity: normalizeRangeValue(fact.traceDensity, DEFAULT_FACT.traceDensity),
    worldSeed: fact.worldSeed ?? DEFAULT_FACT.worldSeed,
    hasTraceFact: fact.hasTraceFact ?? DEFAULT_FACT.hasTraceFact,
    traceFacts: fact.traceFacts ?? DEFAULT_FACT.traceFacts,
    includeActorPlaceholder: fact.includeActorPlaceholder ?? DEFAULT_FACT.includeActorPlaceholder,
    factObjects: fact.factObjects ?? DEFAULT_FACT.factObjects,
  };
}

function normalizeRangeValue(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

const styles = {
  page: { minHeight: "100vh", padding: "42px", color: "#eef7ef", background: "radial-gradient(circle at 18% 12%, rgba(92, 154, 83, 0.24), transparent 30%), linear-gradient(135deg, #101917 0%, #1a2822 56%, #0f1715 100%)", fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
  header: { maxWidth: "1100px", marginBottom: "26px" },
  kicker: { margin: "0 0 8px", color: "#9fceaa", fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em" },
  title: { margin: "0 0 14px", fontSize: "44px", lineHeight: 1 },
  description: { margin: 0, maxWidth: "980px", color: "#c7d8ca", fontSize: "16px", lineHeight: 1.75 },
  layout: { display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "20px", alignItems: "start" },
  controlPanel: { position: "sticky", top: "24px", padding: "20px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "24px", background: "rgba(8, 18, 15, 0.64)", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)" },
  previewPanel: { display: "grid", gap: "20px" },
  card: { padding: "20px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "24px", background: "rgba(8, 18, 15, 0.58)", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)" },
  cardHeader: { marginBottom: "16px" },
  cardTitle: { margin: "0 0 8px", fontSize: "20px" },
  cardText: { margin: 0, color: "#b9cabb", fontSize: "14px", lineHeight: 1.6 },
  fieldGroup: { display: "grid", gap: "8px", marginTop: "18px" },
  fieldLabel: { color: "#d8ead8", fontSize: "13px", fontWeight: 700 },
  selectInput: { width: "100%", padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#eef7ef", background: "#17231f" },
  textInput: { width: "100%", padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#eef7ef", background: "#17231f" },
  valuePill: { justifySelf: "start", padding: "4px 9px", borderRadius: "999px", color: "#16301f", background: "#9fceaa", fontSize: "12px", fontWeight: 800 },
  buttonRow: { display: "flex", gap: "10px", marginTop: "18px" },
  button: { padding: "10px 14px", border: 0, borderRadius: "12px", color: "#102119", background: "#9fceaa", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { padding: "10px 14px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.06)", fontWeight: 800, cursor: "pointer" },
  sceneImage: { display: "block", width: "100%", maxWidth: "960px", height: "auto", borderRadius: "18px", imageRendering: "pixelated", background: "#17231f" },
  assetWorkbench: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: "16px", alignItems: "start", marginTop: "18px" },
  assetLibraryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px" },
  assetCard: { display: "grid", gap: "10px", padding: "14px", border: "1px solid rgba(191, 225, 196, 0.16)", borderRadius: "18px", background: "rgba(255, 255, 255, 0.045)" },
  assetTitle: { margin: 0, fontSize: "16px", color: "#eef7ef" },
  assetPurpose: { margin: 0, color: "#b9cabb", fontSize: "13px", lineHeight: 1.6 },
  assetTagGroup: { display: "flex", flexWrap: "wrap", gap: "6px" },
  assetButton: { padding: "5px 8px", border: 0, borderRadius: "999px", color: "#14301d", background: "#9fceaa", fontSize: "11px", fontWeight: 800, cursor: "pointer" },
  activeAssetButton: { padding: "5px 8px", border: "1px solid #efffe8", borderRadius: "999px", color: "#efffe8", background: "#477c3e", fontSize: "11px", fontWeight: 900, cursor: "pointer" },
  assetPreviewPanel: { position: "sticky", top: "24px", display: "grid", gap: "12px", padding: "14px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "18px", background: "rgba(8, 18, 15, 0.72)" },
  assetPreviewKicker: { margin: "0 0 4px", color: "#9fceaa", fontSize: "11px", fontWeight: 800 },
  assetPreviewTitle: { margin: "0 0 8px", color: "#eef7ef", fontSize: "20px" },
  assetMetaGrid: { display: "grid", gap: "8px" },
  metaText: { margin: "6px 0 0", color: "#d8ead8", fontSize: "12px", lineHeight: 1.55 },
  ruleSourceBox: { padding: "10px", borderRadius: "12px", background: "rgba(9, 20, 17, 0.55)", color: "#d8ead8", fontSize: "12px", lineHeight: 1.55 },
  compactList: { margin: "6px 0 0", paddingLeft: "18px" },
  ruleList: { display: "grid", gap: "10px", margin: "12px 0 0", padding: 0, listStyle: "none" },
  ruleItem: { padding: "12px 14px", borderRadius: "14px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.055)", fontSize: "13px", lineHeight: 1.6 },
  debugList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", margin: 0 },
  debugRow: { padding: "12px", borderRadius: "14px", background: "rgba(255, 255, 255, 0.055)" },
} satisfies Record<string, CSSProperties>;
