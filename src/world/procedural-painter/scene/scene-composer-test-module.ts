// 该文件用于测试像素世界的素材组合规则。

export type PixelSceneBiome = "forest" | "grassland" | "desert" | "oasis";

export type PixelSceneWorldFact = {
  id: string;
  biome: PixelSceneBiome;
  moisture: number;
  density: number;
  pathCurve: number;
  worldSeed: string;
};

type TileKind = "grass" | "path" | "edge";
type SceneObjectKind = "tree" | "bush" | "stone" | "flower" | "actor";
type SceneObjectLayer = "back" | "middle" | "front";

type Palette = {
  bg: string;
  grassA: string;
  grassB: string;
  grassC: string;
  grassDark: string;
  grassLight: string;
  pathA: string;
  pathB: string;
  pathDark: string;
  pathLight: string;
  shadow: string;
  treeTrunkDark: string;
  treeTrunk: string;
  treeTrunkLight: string;
  leafDark: string;
  leaf: string;
  leafLight: string;
  leafUnder: string;
  bushDark: string;
  bush: string;
  bushLight: string;
  stone: string;
  stoneLight: string;
  flower: string;
  actorDark: string;
  actor: string;
};

type Tile = {
  id: string;
  x: number;
  y: number;
  kind: TileKind;
  variant: number;
  edgeMask?: string;
};

type GrassTuft = {
  id: string;
  x: number;
  y: number;
  height: number;
  light: boolean;
  layer: SceneObjectLayer;
};

type SceneObject = {
  id: string;
  kind: SceneObjectKind;
  x: number;
  y: number;
  scale: number;
  layer: SceneObjectLayer;
  health?: number;
  age?: number;
};

export type PixelSceneCompositionPlan = {
  width: number;
  height: number;
  tileSize: number;
  biome: PixelSceneBiome;
  moisture: number;
  density: number;
  tiles: Tile[];
  grassTufts: GrassTuft[];
  objects: SceneObject[];
  summary: {
    grassTiles: number;
    pathTiles: number;
    edgeTiles: number;
    grassTufts: number;
    trees: number;
    bushes: number;
    stones: number;
    flowers: number;
  };
};

const TILE_SIZE = 24;
const COLUMNS = 32;
const ROWS = 18;
const WIDTH = COLUMNS * TILE_SIZE;
const HEIGHT = ROWS * TILE_SIZE;

export function buildDefaultPixelSceneFact(input: Partial<PixelSceneWorldFact> = {}): PixelSceneWorldFact {
  return {
    id: input.id ?? "pixel_scene_composer_preview",
    biome: input.biome ?? "forest",
    moisture: input.moisture ?? 74,
    density: input.density ?? 72,
    pathCurve: input.pathCurve ?? 58,
    worldSeed: input.worldSeed ?? "ai_pet_world_scene_composer_seed_001",
  };
}

export function composePixelWorldScene(fact: PixelSceneWorldFact): PixelSceneCompositionPlan {
  const clean = normalizeFact(fact);
  const layoutSeed = `${clean.worldSeed}:${clean.id}:scene-composer-v3:${clean.biome}`;
  const tileRandom = seededRandom(`${layoutSeed}:tile-variants`);
  const grassRandom = seededRandom(`${layoutSeed}:grass-anchors`);
  const objectRandom = seededRandom(`${layoutSeed}:object-anchors`);
  const tiles = buildTiles(clean, tileRandom);
  const grassTufts = buildGrassTufts(clean, tiles, grassRandom);
  const objects = buildSceneObjects(clean, tiles, objectRandom);

  return {
    width: WIDTH,
    height: HEIGHT,
    tileSize: TILE_SIZE,
    biome: clean.biome,
    moisture: clean.moisture,
    density: clean.density,
    tiles,
    grassTufts,
    objects,
    summary: {
      grassTiles: tiles.filter((tile) => tile.kind === "grass").length,
      pathTiles: tiles.filter((tile) => tile.kind === "path").length,
      edgeTiles: tiles.filter((tile) => tile.kind === "edge").length,
      grassTufts: grassTufts.length,
      trees: objects.filter((object) => object.kind === "tree").length,
      bushes: objects.filter((object) => object.kind === "bush").length,
      stones: objects.filter((object) => object.kind === "stone").length,
      flowers: objects.filter((object) => object.kind === "flower").length,
    },
  };
}

export function buildPixelWorldSceneSvg(fact: PixelSceneWorldFact): string {
  const plan = composePixelWorldScene(fact);
  const palette = paletteFor(plan.biome, plan.moisture);
  const objectsByDepth = [...plan.objects].sort((left, right) => left.y - right.y);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}" shape-rendering="crispEdges" role="img" aria-label="AI-PET-WORLD pixel scene composer preview">`,
    `<rect x="0" y="0" width="${plan.width}" height="${plan.height}" fill="${palette.bg}"/>`,
    plan.tiles.map((tile) => renderTile(tile, palette)).join("\n"),
    renderTileDecorations(plan.tiles, palette, plan.moisture),
    plan.grassTufts.filter((tuft) => tuft.layer === "back").map((tuft) => renderGrassTuft(tuft, palette)).join("\n"),
    objectsByDepth.map((object) => renderObjectShadow(object, palette)).join("\n"),
    objectsByDepth.map((object) => renderSceneObject(object, palette)).join("\n"),
    plan.grassTufts.filter((tuft) => tuft.layer !== "back").map((tuft) => renderGrassTuft(tuft, palette)).join("\n"),
    `<text x="18" y="28" font-size="13" fill="#e6f4e6" font-family="monospace">${escapeText(plan.biome)} moisture=${plan.moisture} density=${plan.density} pathCurve=${normalizeFact(fact).pathCurve}</text>`,
    `</svg>`,
  ].join("\n");
}

function buildTiles(fact: PixelSceneWorldFact, random: () => number): Tile[] {
  const pathCenters = Array.from({ length: COLUMNS }, (_, column) => {
    const curve = (fact.pathCurve - 50) / 50;
    const wave = Math.sin((column / COLUMNS) * Math.PI * 1.35 + curve * 0.8) * (1.2 + Math.abs(curve) * 1.5);
    const slope = 11.5 - column * 0.12;
    return slope + wave + curve * 2.2;
  });

  const pathWidth = fact.biome === "desert" ? 1.9 : fact.biome === "grassland" ? 1.45 : 1.3;
  const tiles: Tile[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const center = pathCenters[column] ?? 0;
      const distance = Math.abs(row - center);
      const kind: TileKind = distance <= pathWidth ? "path" : distance <= pathWidth + 0.95 ? "edge" : "grass";
      const variant = Math.floor(random() * 4);
      const edgeMask = kind === "edge" ? row < center ? "top" : "bottom" : undefined;

      tiles.push({
        id: `tile_${column}_${row}`,
        x: column * TILE_SIZE,
        y: row * TILE_SIZE,
        kind,
        variant,
        edgeMask,
      });
    }
  }

  return tiles;
}

function buildGrassTufts(fact: PixelSceneWorldFact, tiles: Tile[], random: () => number): GrassTuft[] {
  const moistureRate = fact.moisture / 100;
  const densityRate = fact.density / 100;
  const biomeFactor = fact.biome === "desert" ? 0.34 : fact.biome === "oasis" ? 1.25 : fact.biome === "grassland" ? 1.18 : 1;
  const includeRate = clamp((0.1 + moistureRate * 0.34) * densityRate * biomeFactor, 0, 0.86);
  const candidateCount = 260;
  const tufts: GrassTuft[] = [];

  for (let index = 0; index < candidateCount; index += 1) {
    const x = 6 + Math.round(random() * (WIDTH - 12));
    const y = 84 + Math.round(random() * (HEIGHT - 98));
    const includeRoll = random();
    const tile = findTileAt(tiles, x, y);

    if (includeRoll > includeRate || !tile || tile.kind === "path") {
      continue;
    }

    const height = Math.round(3 + random() * (4 + moistureRate * 10));
    const layer: SceneObjectLayer = y > 292 ? "front" : random() > 0.65 ? "middle" : "back";

    tufts.push({
      id: `grass_${index}`,
      x,
      y,
      height,
      light: random() > 0.56 - moistureRate * 0.18,
      layer,
    });
  }

  return tufts;
}

function buildSceneObjects(fact: PixelSceneWorldFact, tiles: Tile[], random: () => number): SceneObject[] {
  const densityRate = fact.density / 100;
  const biomeFactor = fact.biome === "desert" ? 0.4 : fact.biome === "grassland" ? 0.82 : fact.biome === "oasis" ? 0.92 : 1;
  const includeRate = clamp((0.22 + densityRate * 0.62) * biomeFactor, 0.08, 0.86);
  const candidateCount = fact.biome === "desert" ? 34 : 52;
  const objects: SceneObject[] = [];

  const actorTile = tiles.find((tile) => tile.kind === "path" && tile.x > 260 && tile.x < 360 && tile.y > 200) ?? tiles.find((tile) => tile.kind === "path");
  if (actorTile) {
    objects.push({ id: "actor_preview", kind: "actor", x: actorTile.x + 12, y: actorTile.y + 22, scale: 1, layer: "middle" });
  }

  for (let index = 0; index < candidateCount; index += 1) {
    const x = 18 + Math.round(random() * (WIDTH - 36));
    const y = 92 + Math.round(random() * (HEIGHT - 128));
    const includeRoll = random();
    const roll = random();
    const scaleRoll = random();
    const tile = findTileAt(tiles, x, y);

    if (includeRoll > includeRate || !tile || tile.kind !== "grass") {
      continue;
    }

    const nearExisting = objects.some((object) => Math.abs(object.x - x) < 42 && Math.abs(object.y - y) < 36);
    if (nearExisting && roll < 0.72) {
      continue;
    }

    if (roll < treeChanceFor(fact.biome)) {
      objects.push({
        id: `tree_${index}`,
        kind: "tree",
        x,
        y,
        scale: 0.72 + scaleRoll * 0.42,
        layer: y < 210 ? "back" : y > 300 ? "front" : "middle",
        health: clamp(Math.round(58 + fact.moisture * 0.36 + random() * 22), 20, 100),
        age: clamp(Math.round(22 + random() * 88), 0, 120),
      });
    } else if (roll < 0.58) {
      objects.push({ id: `bush_${index}`, kind: "bush", x, y, scale: 0.72 + scaleRoll * 0.45, layer: y < 210 ? "back" : "middle" });
    } else if (roll < 0.78) {
      objects.push({ id: `stone_${index}`, kind: "stone", x, y, scale: 0.78 + scaleRoll * 0.36, layer: "middle" });
    } else {
      objects.push({ id: `flower_${index}`, kind: "flower", x, y, scale: 0.72 + scaleRoll * 0.32, layer: "middle" });
    }
  }

  return objects;
}

function treeChanceFor(biome: PixelSceneBiome): number {
  if (biome === "desert") {
    return 0.12;
  }

  if (biome === "grassland") {
    return 0.18;
  }

  if (biome === "oasis") {
    return 0.28;
  }

  return 0.34;
}

function renderTile(tile: Tile, p: Palette): string {
  if (tile.kind === "path") {
    const color = tile.variant % 2 === 0 ? p.pathA : p.pathB;
    return `<rect x="${tile.x}" y="${tile.y}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${color}"/>`;
  }

  if (tile.kind === "edge") {
    const base = tile.variant % 2 === 0 ? p.grassB : p.grassA;
    const edgeY = tile.edgeMask === "top" ? tile.y + 14 : tile.y;
    return [
      `<rect x="${tile.x}" y="${tile.y}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${base}"/>`,
      `<rect x="${tile.x}" y="${edgeY}" width="${TILE_SIZE}" height="10" fill="${p.pathA}" opacity="0.9"/>`,
      `<rect x="${tile.x + 3}" y="${edgeY + 1}" width="6" height="3" fill="${p.grassLight}" opacity="0.72"/>`,
      `<rect x="${tile.x + 15}" y="${edgeY + 5}" width="6" height="3" fill="${p.grassDark}" opacity="0.5"/>`,
    ].join("\n");
  }

  const color = tile.variant === 0 ? p.grassA : tile.variant === 1 ? p.grassB : p.grassC;
  return `<rect x="${tile.x}" y="${tile.y}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${color}"/>`;
}

function renderTileDecorations(tiles: Tile[], p: Palette, moisture: number): string {
  const wetRate = moisture / 100;
  return tiles
    .filter((tile) => tile.kind !== "edge")
    .map((tile, index) => {
      if (tile.kind === "path") {
        return index % 7 === 0
          ? `<rect x="${tile.x + 7}" y="${tile.y + 12}" width="6" height="3" fill="${p.pathDark}" opacity="0.52"/>`
          : `<rect x="${tile.x + 15}" y="${tile.y + 7}" width="3" height="3" fill="${p.pathLight}" opacity="0.45"/>`;
      }

      const accent = index % 5 === 0 ? p.grassLight : p.grassDark;
      const opacity = index % 5 === 0 ? 0.22 + wetRate * 0.22 : 0.18 + wetRate * 0.18;
      return `<rect x="${tile.x + 5 + (index % 3) * 5}" y="${tile.y + 8 + (index % 4) * 3}" width="3" height="3" fill="${accent}" opacity="${opacity}"/>`;
    })
    .join("\n");
}

function renderGrassTuft(tuft: GrassTuft, p: Palette): string {
  const color = tuft.light ? p.grassLight : p.grassDark;
  return [
    `<rect x="${tuft.x}" y="${tuft.y - tuft.height}" width="3" height="${tuft.height}" fill="${color}"/>`,
    `<rect x="${tuft.x + 3}" y="${tuft.y - Math.max(2, tuft.height - 3)}" width="3" height="${Math.max(2, tuft.height - 3)}" fill="${tuft.light ? p.grassA : p.grassDark}" opacity="0.86"/>`,
  ].join("\n");
}

function renderObjectShadow(object: SceneObject, p: Palette): string {
  if (object.kind === "flower") {
    return "";
  }

  const rx = Math.round((object.kind === "tree" ? 34 : object.kind === "actor" ? 12 : 16) * object.scale);
  const ry = Math.round((object.kind === "tree" ? 10 : 6) * object.scale);
  return `<ellipse cx="${object.x}" cy="${object.y + 2}" rx="${rx}" ry="${ry}" fill="${p.shadow}" opacity="0.42"/>`;
}

function renderSceneObject(object: SceneObject, p: Palette): string {
  if (object.kind === "tree") {
    return renderTree(object, p);
  }

  if (object.kind === "bush") {
    return renderBush(object, p);
  }

  if (object.kind === "stone") {
    return renderStone(object, p);
  }

  if (object.kind === "flower") {
    return renderFlower(object, p);
  }

  return renderActor(object, p);
}

function renderTree(object: SceneObject, p: Palette): string {
  const scale = object.scale;
  const trunkWidth = Math.round((9 + (object.age ?? 40) * 0.04) * scale);
  const trunkHeight = Math.round((45 + (object.age ?? 40) * 0.08) * scale);
  const trunkX = Math.round(object.x - trunkWidth / 2);
  const trunkY = Math.round(object.y - trunkHeight);
  const crownY = trunkY - Math.round(36 * scale);
  const crownScale = scale * (0.9 + (object.health ?? 80) * 0.002);

  return [
    `<rect x="${trunkX}" y="${trunkY}" width="${trunkWidth}" height="${trunkHeight}" fill="${p.treeTrunkDark}"/>`,
    `<rect x="${trunkX + Math.max(2, Math.round(trunkWidth * 0.28))}" y="${trunkY + 4}" width="${Math.max(4, Math.round(trunkWidth * 0.54))}" height="${trunkHeight - 6}" fill="${p.treeTrunk}"/>`,
    `<rect x="${trunkX + trunkWidth - 4}" y="${trunkY + 12}" width="3" height="${Math.round(trunkHeight * 0.52)}" fill="${p.treeTrunkLight}"/>`,
    renderLeafCluster(object.x + Math.round(20 * scale), crownY + Math.round(20 * scale), crownScale, p.leafDark, [4, 10, 18, 24, 25, 20, 11]),
    renderLeafCluster(object.x - Math.round(8 * scale), crownY + Math.round(14 * scale), crownScale, p.leaf, [5, 13, 22, 28, 27, 20, 9]),
    renderLeafCluster(object.x - Math.round(23 * scale), crownY + Math.round(21 * scale), crownScale * 0.78, p.leaf, [4, 10, 16, 20, 18, 10]),
    renderLeafCluster(object.x - Math.round(12 * scale), crownY + Math.round(4 * scale), crownScale * 0.68, p.leafLight, [3, 7, 13, 15, 10, 4]),
    renderLeafCluster(object.x + Math.round(1 * scale), crownY + Math.round(40 * scale), crownScale * 0.86, p.leafUnder, [5, 14, 22, 24, 17, 8]),
  ].join("\n");
}

function renderLeafCluster(cx: number, cy: number, scale: number, color: string, rows: number[]): string {
  const rowHeight = Math.max(3, Math.round(4 * scale));
  const topY = Math.round(cy - (rows.length * rowHeight) / 2);
  return rows
    .map((row, index) => {
      const width = Math.max(6, Math.round(row * 3 * scale));
      const x = Math.round(cx - width / 2 + (index % 3) * 2);
      const y = topY + index * rowHeight;
      return `<rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" fill="${color}"/>`;
    })
    .join("\n");
}

function renderBush(object: SceneObject, p: Palette): string {
  const scale = object.scale;
  return [
    renderLeafCluster(object.x, object.y - Math.round(13 * scale), scale * 0.72, p.bushDark, [3, 7, 12, 13, 8, 3]),
    renderLeafCluster(object.x - Math.round(11 * scale), object.y - Math.round(10 * scale), scale * 0.58, p.bush, [3, 8, 11, 8, 3]),
    renderLeafCluster(object.x + Math.round(9 * scale), object.y - Math.round(11 * scale), scale * 0.56, p.bush, [3, 8, 10, 7, 3]),
    `<rect x="${Math.round(object.x - 5 * scale)}" y="${Math.round(object.y - 24 * scale)}" width="6" height="3" fill="${p.bushLight}"/>`,
  ].join("\n");
}

function renderStone(object: SceneObject, p: Palette): string {
  const width = Math.round(17 * object.scale);
  const height = Math.round(9 * object.scale);
  const x = Math.round(object.x - width / 2);
  const y = Math.round(object.y - height);
  return [
    `<rect x="${x}" y="${y + 3}" width="${width}" height="${height}" fill="${p.stone}"/>`,
    `<rect x="${x + 4}" y="${y}" width="${Math.max(5, width - 8)}" height="4" fill="${p.stoneLight}"/>`,
  ].join("\n");
}

function renderFlower(object: SceneObject, p: Palette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  return [
    `<rect x="${x}" y="${y - 9}" width="3" height="9" fill="${p.grassDark}"/>`,
    `<rect x="${x - 3}" y="${y - 12}" width="3" height="3" fill="${p.flower}"/>`,
    `<rect x="${x + 3}" y="${y - 12}" width="3" height="3" fill="${p.flower}"/>`,
    `<rect x="${x}" y="${y - 15}" width="3" height="3" fill="${p.flower}"/>`,
  ].join("\n");
}

function renderActor(object: SceneObject, p: Palette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  return [
    `<rect x="${x - 9}" y="${y - 27}" width="18" height="18" fill="${p.actorDark}"/>`,
    `<rect x="${x - 6}" y="${y - 36}" width="15" height="15" fill="${p.actor}"/>`,
    `<rect x="${x - 3}" y="${y - 30}" width="3" height="3" fill="#122017"/>`,
    `<rect x="${x - 6}" y="${y - 9}" width="6" height="9" fill="${p.actorDark}"/>`,
    `<rect x="${x + 3}" y="${y - 9}" width="6" height="9" fill="${p.actorDark}"/>`,
  ].join("\n");
}

function paletteFor(biome: PixelSceneBiome, moisture: number): Palette {
  const dry = moisture <= 35;
  const wet = moisture >= 72;

  if (biome === "desert") {
    return {
      bg: "#17231f",
      grassA: dry ? "#8a7c47" : wet ? "#697849" : "#817e40",
      grassB: dry ? "#9b884c" : wet ? "#748858" : "#8a8848",
      grassC: dry ? "#71683b" : wet ? "#52663e" : "#706f3d",
      grassDark: dry ? "#625833" : wet ? "#3f5132" : "#5a6135",
      grassLight: dry ? "#b8a45e" : wet ? "#96a96a" : "#b0a85c",
      pathA: dry ? "#cf9346" : wet ? "#9c7c3f" : "#b58a42",
      pathB: dry ? "#dda34f" : wet ? "#aa8848" : "#c2964a",
      pathDark: "#8a6334",
      pathLight: "#e3bd68",
      shadow: "#1b2117",
      treeTrunkDark: "#6b4b2b",
      treeTrunk: "#9b7445",
      treeTrunkLight: "#c79a5e",
      leafDark: dry ? "#565532" : wet ? "#465431" : "#4f5c30",
      leaf: dry ? "#8e8b4c" : wet ? "#768c52" : "#88904e",
      leafLight: dry ? "#bdb468" : wet ? "#9eae6b" : "#bdbb6b",
      leafUnder: dry ? "#3f3e25" : wet ? "#344229" : "#384020",
      bushDark: dry ? "#5c5c35" : wet ? "#435631" : "#4e552f",
      bush: dry ? "#88894d" : wet ? "#6f8b54" : "#7d8849",
      bushLight: dry ? "#bdbb68" : wet ? "#95aa69" : "#b7b85f",
      stone: "#6a6245",
      stoneLight: "#9a8f62",
      flower: "#e9d783",
      actorDark: "#604131",
      actor: "#a87b54",
    };
  }

  if (biome === "oasis") {
    return {
      bg: "#17231f",
      grassA: dry ? "#5f814e" : wet ? "#246f52" : "#3f8559",
      grassB: dry ? "#6d9258" : wet ? "#2e8060" : "#479466",
      grassC: dry ? "#466b42" : wet ? "#1c5c49" : "#2f6d4d",
      grassDark: dry ? "#36543a" : wet ? "#104634" : "#25513a",
      grassLight: dry ? "#9fbf7f" : wet ? "#78b894" : "#87d69a",
      pathA: dry ? "#a88c50" : wet ? "#5b6844" : "#7d7748",
      pathB: dry ? "#b99b5b" : wet ? "#69774d" : "#8b8551",
      pathDark: "#4f5b36",
      pathLight: "#b9c878",
      shadow: "#102019",
      treeTrunkDark: "#604028",
      treeTrunk: "#936139",
      treeTrunkLight: "#bf8953",
      leafDark: dry ? "#37684c" : wet ? "#0e5c45" : "#1c634e",
      leaf: dry ? "#6f9d70" : wet ? "#2f946e" : "#4b9d77",
      leafLight: dry ? "#a1c48d" : wet ? "#7fc79d" : "#8ed0a0",
      leafUnder: dry ? "#315641" : wet ? "#0d4034" : "#16483b",
      bushDark: dry ? "#286547" : wet ? "#0f543d" : "#1a6b4f",
      bush: dry ? "#63a06f" : wet ? "#359368" : "#4fb77e",
      bushLight: dry ? "#a3cf8c" : wet ? "#7fc79d" : "#9deab4",
      stone: "#48665d",
      stoneLight: "#78a090",
      flower: "#f48be5",
      actorDark: "#426a5c",
      actor: "#95c7b0",
    };
  }

  return {
    bg: "#17231f",
    grassA: dry ? "#667e43" : wet ? "#1f7336" : "#3f7d3c",
    grassB: dry ? "#758d4e" : wet ? "#2a8541" : "#4f8d43",
    grassC: dry ? "#4d6338" : wet ? "#185a2d" : "#336936",
    grassDark: dry ? "#38482b" : wet ? "#0d3f1f" : "#28572c",
    grassLight: dry ? "#9daf62" : wet ? "#67a95a" : "#7fc360",
    pathA: dry ? "#c09243" : wet ? "#956f32" : "#a57934",
    pathB: dry ? "#ce9d4b" : wet ? "#a47d3a" : "#b3843b",
    pathDark: "#805d2f",
    pathLight: "#d5a75b",
    shadow: "#111b15",
    treeTrunkDark: "#5a351f",
    treeTrunk: "#8a5a31",
    treeTrunkLight: "#b87a3a",
    leafDark: dry ? "#354c2b" : wet ? "#0c4825" : "#154526",
    leaf: dry ? "#668a45" : wet ? "#2f8a3d" : "#3f873d",
    leafLight: dry ? "#9fb563" : wet ? "#68b85a" : "#7ec35c",
    leafUnder: dry ? "#263b25" : wet ? "#0a321b" : "#10351e",
    bushDark: dry ? "#3c5c31" : wet ? "#0e4c26" : "#17612f",
    bush: dry ? "#6f984a" : wet ? "#2c8941" : "#3da248",
    bushLight: dry ? "#a7bd65" : wet ? "#69b85b" : "#8fdb65",
    stone: "#536354",
    stoneLight: "#81927d",
    flower: biome === "grassland" ? "#f5f0a8" : "#e8f0db",
    actorDark: "#6c4930",
    actor: "#b89260",
  };
}

function normalizeFact(fact: PixelSceneWorldFact): PixelSceneWorldFact {
  return {
    ...fact,
    moisture: clamp(Math.round(fact.moisture), 0, 100),
    density: clamp(Math.round(fact.density), 0, 100),
    pathCurve: clamp(Math.round(fact.pathCurve), 0, 100),
  };
}

function findTileAt(tiles: Tile[], x: number, y: number): Tile | undefined {
  const column = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  return tiles.find((tile) => tile.x === column * TILE_SIZE && tile.y === row * TILE_SIZE);
}

function seededRandom(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return current >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
