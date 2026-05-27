// 该组件用于交互式测试像素世界组合算法，并集中展示规则资产库。

"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
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

type PixelAssetLayer = "tile" | "trace" | "object" | "sprite" | "atmosphere" | "ui";

type PixelAssetDefinition = {
  id: string;
  label: string;
  layer: PixelAssetLayer;
  description: string;
  ruleSources: string[];
  tags: string[];
};

type AssetLibrarySection = {
  title: string;
  purpose: string;
  assets: PixelAssetDefinition[];
  ruleSources: string[];
};

const ASSET_LIBRARY_SECTIONS: AssetLibrarySection[] = [
  {
    title: "Tile Layer｜地面资产",
    purpose: "负责把 SpaceGrid、生态健康、湿度、空间压力和痕迹强度转成稳定地表表现。",
    assets: [
      buildAsset("grass", "grass", "tile", "基础草地 tile，用于稳定表现可通行自然地面。"),
      buildAsset("pressed_grass", "pressed_grass", "tile", "被反复使用后压低的草地，不是路径事实，只是痕迹表现。"),
      buildAsset("worn_grass", "worn_grass", "tile", "长期使用后的磨损草地，由 traceStrength 和空间使用反馈决定。"),
      buildAsset("exposed_soil", "exposed_soil", "tile", "草皮被磨开后的裸土表现，必须来自痕迹或低生态健康。"),
      buildAsset("ecology_transition", "ecology_transition", "tile", "生态过渡地面，用于表现湿度、恢复、衰退之间的混合区域。"),
      buildAsset("recovery_growth", "recovery_growth", "tile", "恢复生长 tile，用于地面健康回升、照料增加后的表现。"),
      buildAsset("soil", "soil", "tile", "土壤地面，来自 terrainKind 或建设前后的事实。"),
      buildAsset("built", "built", "tile", "建设地面，只能来自 HomeMapState / SafeApply 后的事实。"),
      buildAsset("boundary", "boundary", "tile", "世界边界与不可通行边界的表现层。"),
    ],
    ruleSources: ["SpaceGrid.cells", "terrainKind", "regionKind", "traceStrength", "ecologyHealthHint", "moistureHint"],
  },
  {
    title: "Trace Layer｜痕迹资产",
    purpose: "负责把世界长期运行留下的痕迹转成可见地表变化，而不是装饰贴图。",
    assets: [
      buildAsset("trace_pressed_grass", "草地压低", "trace", "由 movement / spatial_use 痕迹转成的草地压低表现。"),
      buildAsset("trace_exposed_soil", "裸土", "trace", "高强度使用或生态下降后出现的裸土痕迹。"),
      buildAsset("trace_worn_ground", "磨损地面", "trace", "反复经过、等待或使用后的地面磨损。"),
      buildAsset("trace_maintained_area", "维护痕迹", "trace", "管家维护行为留下的稳定区域提示。"),
      buildAsset("trace_repaired_ground", "恢复痕迹", "trace", "地面恢复、修补、照料后的痕迹表现。"),
      buildAsset("trace_waiting_spot", "等待点", "trace", "管家等待、观察或短暂停留后形成的弱痕迹。"),
      buildAsset("trace_attention_glow", "关注点", "trace", "管家注意到的区域，只是提示，不是命令。"),
    ],
    ruleSources: ["TraceField", "TraceLifecycle", "TraceInfluence", "TraceVisualProjection", "MemorySeed"],
  },
  {
    title: "Object Layer｜自然对象资产",
    purpose: "负责树、灌木、石头、花、蘑菇和小生态信号的世界表现。",
    assets: [
      buildAsset("tree", "tree", "object", "树木对象。正式事实来自 placements，视觉补足来自 derived_visual_only。"),
      buildAsset("bush", "bush", "object", "灌木对象，用于补足自然密度和生态层次。"),
      buildAsset("stone", "stone", "object", "石头对象，用于地表节奏、边界和磨损区域过渡。"),
      buildAsset("flower", "flower", "object", "花朵点缀，通常代表较高生态健康和照料状态。"),
      buildAsset("mushroom", "mushroom", "object", "蘑菇对象，通常来自潮湿、恢复或低光照区域。"),
      buildAsset("insect_signal", "insect_signal", "object", "小生态信号，用于表现世界开始有生命活动。"),
      buildAsset("grass_tuft", "grass_tuft", "object", "草簇对象，用于减少纯 tile 网格感。"),
    ],
    ruleSources: ["HomeMapState.placements", "derived_visual_only", "world seed", "naturalGrowth", "spacePressure"],
  },
  {
    title: "Sprite Layer｜生命主体资产",
    purpose: "负责管家与未来宠物的像素主体表现。宠物未正式入场前不能默认显示。",
    assets: [
      buildAsset("butler_observe", "butler.observe", "sprite", "管家观察姿态，由 selectedMotivation=observe_world 驱动。"),
      buildAsset("butler_wait", "butler.wait", "sprite", "管家等待姿态，由资源不足或规则限制驱动。"),
      buildAsset("butler_maintain", "butler.maintain", "sprite", "管家维护姿态，由 maintain_home 或 repair 相关意图驱动。"),
      buildAsset("future_pet_gated", "future_pet.gated", "sprite", "未来宠物资产占位。没有正式宠物事实前不能显示。"),
    ],
    ruleSources: ["ButlerState", "lastButlerRuntimeDecision", "existing actor fact only"],
  },
  {
    title: "Atmosphere Layer｜氛围资产",
    purpose: "负责让时间线、生态状态和世界阶段影响整体光照与氛围。",
    assets: [
      buildAsset("atmosphere_calm", "calm", "atmosphere", "平稳世界氛围。"),
      buildAsset("atmosphere_warm", "warm", "atmosphere", "照料状态较好时的温暖氛围。"),
      buildAsset("atmosphere_recovering", "recovering", "atmosphere", "地面恢复、生态修复时的氛围。"),
      buildAsset("atmosphere_busy", "busy", "atmosphere", "空间压力较高或世界活动密集时的氛围。"),
      buildAsset("weather_clear", "clear", "atmosphere", "晴朗基础天气表现。"),
      buildAsset("weather_soft", "soft", "atmosphere", "柔和天气表现。"),
      buildAsset("weather_damp", "damp", "atmosphere", "潮湿天气表现。"),
    ],
    ruleSources: ["groundHealth", "careReadiness", "spacePressure", "world phase"],
  },
  {
    title: "UI Overlay｜轻 UI 资产",
    purpose: "只承载管家一句话、P-Phone 与必要状态，不替代主世界画面。",
    assets: [
      buildAsset("ui_butler_line", "管家一句话", "ui", "管家对世界状态的自然解释。"),
      buildAsset("ui_p_phone", "P-Phone 最近记录", "ui", "P-Phone 最近世界记录。"),
      buildAsset("ui_new_record", "新记录提示", "ui", "有新事件时的轻提示。"),
    ],
    ruleSources: ["WorldViewModel.butlerExplanation", "WorldViewModel.pPhone"],
  },
];

const RULE_LIBRARY = [
  "规则资产库不是大数据训练模型；当前阶段用显式规则、权重参数、世界种子、痕迹反馈和小样本日志迭代。",
  "正式 /world 只读 WorldViewModel；资产库和调参实验统一留在 /world-debug/pixel-scene-composer。",
  "derived_visual_only 只能进入 WorldViewModel，必须带 not_world_fact / no_runtime_write，不能写入 HomeMapState。",
  "Pixel Scene Composer 验证的是组合规则，不是正式产品页；后续新增资产先在这里观察，再沉淀到正式 mapper。",
];

const FLAT_ASSETS = ASSET_LIBRARY_SECTIONS.flatMap((section) => section.assets);

export default function PixelSceneComposerClient() {
  const [fact, setFact] = useState<SceneComposerFact>(DEFAULT_FACT);
  const [selectedAssetId, setSelectedAssetId] = useState(FLAT_ASSETS[0]?.id ?? "grass");
  const safeFact = useMemo(() => normalizeSceneComposerFact(fact), [fact]);
  const sceneSvg = useMemo(() => buildSceneSvg(safeFact), [safeFact]);
  const plan = useMemo(() => composeScene(safeFact), [safeFact]);
  const selectedAsset = useMemo(
    () => FLAT_ASSETS.find((asset) => asset.id === selectedAssetId) ?? FLAT_ASSETS[0],
    [selectedAssetId]
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
            <button type="button" onClick={randomizeSeed} style={styles.button}>随机 seed</button>
            <button type="button" onClick={resetFact} style={styles.secondaryButton}>重置</button>
          </div>
        </aside>

        <section style={styles.previewPanel}>
          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>组合场景预览</h2>
              <p style={styles.cardText}>目标不是单个素材好看，而是验证 tile、移动痕迹、生态过渡、草和对象能否组成一个整体。</p>
            </div>
            <Image alt="Pixel world scene composer preview" height={432} src={toSvgDataUri(sceneSvg)} style={styles.sceneImage} unoptimized width={768} />
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>规则资产库</h2>
            <p style={styles.cardText}>后续新增 tile、trace、object、sprite、atmosphere 资产都先放在这里观察。点击资产可以查看像素预览、规则来源和正式接入边界。</p>
            <div style={styles.assetWorkbench}>
              <div style={styles.assetLibraryGrid}>
                {ASSET_LIBRARY_SECTIONS.map((section) => (
                  <section key={section.title} style={styles.assetCard}>
                    <h3 style={styles.assetTitle}>{section.title}</h3>
                    <p style={styles.assetPurpose}>{section.purpose}</p>
                    <div style={styles.assetTagGroup}>
                      {section.assets.map((asset) => (
                        <button aria-pressed={selectedAsset.id === asset.id} key={asset.id} onClick={() => setSelectedAssetId(asset.id)} style={selectedAsset.id === asset.id ? styles.activeAssetButton : styles.assetButton} type="button">
                          {asset.label}
                        </button>
                      ))}
                    </div>
                    <div style={styles.ruleSourceBox}>
                      <strong>规则来源</strong>
                      <ul style={styles.compactList}>
                        {section.ruleSources.map((source) => <li key={source}>{source}</li>)}
                      </ul>
                    </div>
                  </section>
                ))}
              </div>
              <AssetPreviewPanel asset={selectedAsset} />
            </div>
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>规则边界</h2>
            <ul style={styles.ruleList}>{RULE_LIBRARY.map((rule) => <li key={rule} style={styles.ruleItem}>{rule}</li>)}</ul>
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

function buildAsset(id: string, label: string, layer: PixelAssetLayer, description: string): PixelAssetDefinition {
  return { id, label, layer, description, ruleSources: ruleSourcesForLayer(layer), tags: tagsForLayer(layer) };
}

function ruleSourcesForLayer(layer: PixelAssetLayer): string[] {
  if (layer === "tile") return ["SpaceGrid.cells", "terrainKind", "traceStrength", "ecologyHealthHint"];
  if (layer === "trace") return ["TraceField", "TraceLifecycle", "TraceInfluence", "MemorySeed"];
  if (layer === "object") return ["HomeMapState.placements", "derived_visual_only", "world seed", "naturalGrowth"];
  if (layer === "sprite") return ["ButlerState", "lastButlerRuntimeDecision", "existing actor fact only"];
  if (layer === "atmosphere") return ["groundHealth", "careReadiness", "spacePressure", "world phase"];
  return ["WorldViewModel.butlerExplanation", "WorldViewModel.pPhone"];
}

function tagsForLayer(layer: PixelAssetLayer): string[] {
  if (layer === "object") return ["derived_visual_only", "not_world_fact", "no_runtime_write"];
  if (layer === "sprite") return ["no_default_pet_actor", "existing_fact_required"];
  if (layer === "trace") return ["trace_projection", "not_decoration"];
  return ["world_view_projection", "read_only"];
}

function AssetPreviewPanel({ asset }: { asset: PixelAssetDefinition }) {
  return (
    <aside style={styles.assetPreviewPanel}>
      <div>
        <p style={styles.assetPreviewKicker}>当前查看资产</p>
        <h3 style={styles.assetPreviewTitle}>{asset.label}</h3>
        <p style={styles.assetPurpose}>{asset.description}</p>
      </div>
      <AssetPreviewCanvas asset={asset} />
      <div style={styles.assetMetaGrid}>
        <div style={styles.ruleSourceBox}><strong>正式图层</strong><p style={styles.metaText}>{asset.layer}</p></div>
        <div style={styles.ruleSourceBox}><strong>接入边界</strong><p style={styles.metaText}>{asset.tags.join(" / ")}</p></div>
      </div>
      <div style={styles.ruleSourceBox}>
        <strong>规则来源</strong>
        <ul style={styles.compactList}>{asset.ruleSources.map((source) => <li key={source}>{source}</li>)}</ul>
      </div>
    </aside>
  );
}

function AssetPreviewCanvas({ asset }: { asset: PixelAssetDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    drawAssetPreview(context, asset);
  }, [asset]);

  return <canvas aria-label={`asset preview ${asset.label}`} height={192} ref={canvasRef} role="img" style={styles.assetPreviewCanvas} width={192} />;
}

function drawAssetPreview(context: CanvasRenderingContext2D, asset: PixelAssetDefinition) {
  context.clearRect(0, 0, 192, 192);
  context.fillStyle = "#12301f";
  context.fillRect(0, 0, 192, 192);
  drawPreviewGround(context, asset);
  if (asset.layer === "tile") drawTilePreview(context, asset.id);
  if (asset.layer === "trace") drawTracePreview(context, asset.id);
  if (asset.layer === "object") drawObjectPreview(context, asset.id);
  if (asset.layer === "sprite") drawSpritePreview(context, asset.id);
  if (asset.layer === "atmosphere") drawAtmospherePreview(context, asset.id);
  if (asset.layer === "ui") drawUiPreview(context, asset.id);
}

function drawPreviewGround(context: CanvasRenderingContext2D, asset: PixelAssetDefinition) {
  context.fillStyle = asset.layer === "atmosphere" ? "#315b37" : "#2e793e";
  context.fillRect(18, 18, 156, 156);
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
      context.fillRect(18 + column * 19, 18 + row * 19, 19, 19);
    }
  }
}

function drawTilePreview(context: CanvasRenderingContext2D, id: string) {
  const color = id === "pressed_grass" ? "#72aa59" : id === "worn_grass" ? "#91a45d" : id === "exposed_soil" ? "#9f6b42" : id === "ecology_transition" ? "#85a85b" : id === "recovery_growth" ? "#92cb69" : id === "soil" ? "#a06f43" : id === "built" ? "#b38f5f" : id === "boundary" ? "#4d6845" : "#78ba63";
  context.fillStyle = color;
  context.fillRect(42, 42, 108, 108);
  context.fillStyle = "rgba(255,255,255,0.11)";
  context.fillRect(54, 58, 42, 6);
  context.fillRect(84, 96, 50, 6);
  context.fillStyle = "rgba(0,0,0,0.13)";
  context.fillRect(64, 126, 58, 7);
  if (id === "boundary") {
    context.fillStyle = "rgba(20,38,24,0.45)";
    for (let x = 42; x < 150; x += 12) context.fillRect(x, 42, 6, 108);
  }
}

function drawTracePreview(context: CanvasRenderingContext2D, id: string) {
  const color = id === "trace_exposed_soil" ? "#895f3a" : id === "trace_worn_ground" ? "#7c673f" : id === "trace_maintained_area" ? "#bfd47f" : id === "trace_repaired_ground" ? "#accb70" : id === "trace_waiting_spot" ? "#8297bb" : id === "trace_attention_glow" ? "#f1d46a" : "#5e8545";
  context.fillStyle = color;
  for (let index = 0; index < 14; index += 1) {
    context.fillRect(42 + ((index * 19) % 102), 62 + ((index * 13) % 64), 24 - (index % 3) * 4, 7);
  }
  if (id === "trace_attention_glow") {
    context.fillStyle = "rgba(255,255,255,0.28)";
    context.fillRect(90, 84, 12, 12);
    context.fillRect(82, 92, 28, 4);
  }
}

function drawObjectPreview(context: CanvasRenderingContext2D, id: string) {
  if (id === "tree") {
    context.fillStyle = "rgba(14,30,18,0.28)"; context.fillRect(60, 126, 74, 14);
    context.fillStyle = "#744f2f"; context.fillRect(88, 82, 18, 52);
    context.fillStyle = "#2f6136"; context.fillRect(54, 50, 86, 46);
    context.fillStyle = "#5fa456"; context.fillRect(72, 34, 54, 36); return;
  }
  if (id === "bush" || id === "grass_tuft") {
    context.fillStyle = "#366f35"; context.fillRect(56, 102, 82, 34);
    context.fillStyle = "#65a657"; context.fillRect(72, 78, 48, 38); context.fillRect(46, 94, 38, 30); return;
  }
  if (id === "stone") {
    context.fillStyle = "#68716f"; context.fillRect(58, 98, 78, 34);
    context.fillStyle = "#a4aaa4"; context.fillRect(78, 82, 42, 18); return;
  }
  if (id === "flower") {
    context.fillStyle = "#4f8f45"; context.fillRect(92, 92, 8, 46);
    context.fillStyle = "#d87d86"; context.fillRect(76, 70, 40, 24);
    context.fillStyle = "#ead66b"; context.fillRect(88, 76, 16, 14); return;
  }
  if (id === "mushroom") {
    context.fillStyle = "#f1d9bc"; context.fillRect(88, 94, 16, 40);
    context.fillStyle = "#c75f5f"; context.fillRect(64, 70, 64, 28);
    context.fillStyle = "#f7d5d5"; context.fillRect(82, 76, 10, 8); context.fillRect(106, 82, 8, 6); return;
  }
  context.fillStyle = "#263321"; context.fillRect(76, 96, 18, 18); context.fillRect(106, 104, 16, 16);
  context.fillStyle = "#f5df6e"; context.fillRect(96, 72, 12, 12);
}

function drawSpritePreview(context: CanvasRenderingContext2D, id: string) {
  context.fillStyle = "rgba(16,26,38,0.28)"; context.fillRect(66, 138, 60, 12);
  context.fillStyle = id === "future_pet_gated" ? "#7b6a58" : "#f1d6b0"; context.fillRect(86, 60, 22, 22);
  context.fillStyle = id === "butler_maintain" ? "#718953" : id === "butler_observe" ? "#5368b2" : "#445c8e"; context.fillRect(80, 84, 34, 52);
  context.fillStyle = id === "future_pet_gated" ? "#c95f5f" : "#e8f0df"; context.fillRect(106, 96, 18, 22);
}

function drawAtmospherePreview(context: CanvasRenderingContext2D, id: string) {
  const overlay = id.includes("warm") ? "rgba(236,194,100,0.25)" : id.includes("recovering") ? "rgba(126,190,112,0.25)" : id.includes("busy") ? "rgba(92,106,138,0.22)" : id.includes("damp") ? "rgba(98,147,170,0.26)" : id.includes("soft") ? "rgba(227,226,181,0.18)" : "rgba(255,255,255,0.08)";
  context.fillStyle = overlay;
  context.fillRect(18, 18, 156, 156);
  context.fillStyle = "rgba(255,255,255,0.22)";
  context.fillRect(44, 48, 104, 8);
}

function drawUiPreview(context: CanvasRenderingContext2D, id: string) {
  context.fillStyle = "rgba(246,241,201,0.9)"; context.fillRect(42, 54, 108, 86);
  context.fillStyle = "#496a42"; context.fillRect(58, 78, id === "ui_new_record" ? 54 : 76, 10); context.fillRect(58, 100, 58, 8);
  context.fillStyle = "#9fceaa"; context.fillRect(58, 116, 34, 12);
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
  assetPreviewCanvas: { width: "100%", maxWidth: "240px", height: "auto", borderRadius: "14px", border: "1px solid rgba(191, 225, 196, 0.2)", imageRendering: "pixelated", background: "#102119" },
  assetMetaGrid: { display: "grid", gap: "8px" },
  metaText: { margin: "6px 0 0", color: "#d8ead8", fontSize: "12px", lineHeight: 1.55 },
  ruleSourceBox: { padding: "10px", borderRadius: "12px", background: "rgba(9, 20, 17, 0.55)", color: "#d8ead8", fontSize: "12px", lineHeight: 1.55 },
  compactList: { margin: "6px 0 0", paddingLeft: "18px" },
  ruleList: { display: "grid", gap: "10px", margin: "12px 0 0", padding: 0, listStyle: "none" },
  ruleItem: { padding: "12px 14px", borderRadius: "14px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.055)", fontSize: "13px", lineHeight: 1.6 },
  debugList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", margin: 0 },
  debugRow: { padding: "12px", borderRadius: "14px", background: "rgba(255, 255, 255, 0.055)" },
} satisfies Record<string, CSSProperties>;
