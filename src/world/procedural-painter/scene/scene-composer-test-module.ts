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
  const stableBaseSeed = `${clean.worldSeed}:${clean.id}:scene-composer-v2:${clean.biome}:${clean.pathCurve}`;
  const tileRandom = seededRandom(`${stableBaseSeed}:tiles`);
  const grassRandom = seededRandom(`${stableBaseSeed}:grass:${clean.density}`);
  const objectRandom = seededRandom(`${stableBaseSeed}:objects:${clean.density}`);
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
  const grassTiles = tiles.filter((tile) => tile.kind !== "path");
  const moistureRate = fact.moisture / 100;
  const densityRate = fact.density / 100;
  const biomeFactor = fact.biome === "desert" ? 0.34 : fact.biome === "oasis" ? 1.25 : fact.biome === "grassland" ? 1.18 : 1;
  const count = Math.round(grassTiles.length * (0.12 + moistureRate * 0.28) * densityRate * biomeFactor);
  const tufts: GrassTuft[] = [];

  for (let index = 0; index < count; index += 1) {
    const tile = grassTiles[Math.floor(random() * grassTiles.length)];
    if (!tile) {
      continue;
    }

    const x = tile.x + 3 + Math.round(random() * (TILE_SIZE - 6));
    const y = tile.y + 6 + Math.round(random() * (TILE_SIZE - 3));
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
  const grassTiles = tiles.filter((tile) => tile.kind === "grass" && tile.y > 64 && tile.y < HEIGHT - 48);
  const densityRate = fact.density / 100;
  const objectCount = fact.biome === "desert" ? Math.round(4 + densityRate * 7) : Math.round(10 + densityRate * 18);
  const objects: SceneObject[] = [];

  const actorTile = tiles.find((tile) => tile.kind === "path" && tile.x > 260 && tile.x < 360 && tile.y > 200) ?? tiles.find((tile) => tile.kind === "path");
  if (actorTile) {
    objects.push({ id: "actor_preview", kind: "actor", x: actorTile.x + 12, y: actorTile.y + 22, scale: 1, layer: "middle" });
  }

  for (let index = 0; index < objectCount; index += 1) {
    const tile = grassTiles[Math.floor(random() * grassTiles.length)];
    if (!tile) {
      continue;
    }

    const x = tile.x + 8 + Math.round(random() * 12);
    const y = tile.y + 18 + Math.round(random() * 6);
    const roll = random();
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
        scale: 0.72 + random() * 0.42,
        layer: y < 210 ? "back" : y > 300 ? "front" : "middle",
        health: clamp(Math.round(58 + fact.moisture * 0.36 + random() * 22), 20, 100),
        age: clamp(Math.round(22 + fact.density * 0.7 + random() * 46), 0, 120),
      });
    } else if (roll < 0.58) {
      objects.push({ id: `bush_${index}`, kind: "bush", x, y, scale: 0.72 + random() * 0.45, layer: y < 210 ? "back" : "middle" });
    } else if (roll < 0.78) {
      objects.push({ id: `stone_${index}`, kind: "stone", x, y, scale: 0.78 + random() * 0.36, layer: "middle" });
    } else {
      objects.push({ id: `flower_${index}`, kind: "flower", x, y, scale: 0.72 + random() * 0.32, layer: "middle" });
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
      const opacity = index % 5 === 0 ? 0.32 + wetRate * 0.32 : 0.22 + wetRate * 0.2;
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
      grassA: dry ? "#746939" : "#817e40",
      grassB: dry ? "#887744" : wet ? "#8c9b55" : "#8a8848",
      grassC: dry ? "#625a31" : wet ? "#667d46" : "#706f3d",
      grassDark: dry ? "#4d482b" : "#5a6135",
      grassLight: dry ? "#aa9653" : wet ? "#c6ca6b" : "#b8aa5c",
      pathA: dry ? "#c98a35" : "#a98543",
      pathB: dry ? "#d99b42" : "#b9914b",
      pathDark: "#8a6334",
      pathLight: "#e3bd68",
      shadow: "#1b2117",
      treeTrunkDark: "#6b4b2b",
      treeTrunk: "#9b7445",
      treeTrunkLight: "#c79a5e",
      leafDark: dry ? "#4a4f2b" : "#5b6634",
      leaf: dry ? "#838746" : "#8f9f54",
      leafLight: dry ? "#bbb463" : "#d1d174",
      leafUnder: dry ? "#33391f" : "#424d28",
      bushDark: "#4e552f",
      bush: "#7d8849",
      bushLight: "#b7b85f",
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
      grassA: dry ? "#447448" : wet ? "#2e9b62" : "#3f8559",
      grassB: dry ? "#4f8352" : wet ? "#35af70" : "#479466",
      grassC: dry ? "#315f3e" : wet ? "#237d56" : "#2f6d4d",
      grassDark: dry ? "#25513a" : "#146846",
      grassLight: dry ? "#8fc57d" : wet ? "#9cefb5" : "#87d69a",
      pathA: dry ? "#9d8145" : "#6d7947",
      pathB: dry ? "#b19150" : "#778753",
      pathDark: "#4f5b36",
      pathLight: "#b9c878",
      shadow: "#102019",
      treeTrunkDark: "#604028",
      treeTrunk: "#936139",
      treeTrunkLight: "#bf8953",
      leafDark: dry ? "#246045" : "#137053",
      leaf: dry ? "#5c9869" : "#45bd85",
      leafLight: dry ? "#96c988" : "#a2eebc",
      leafUnder: dry ? "#255142" : "#105241",
      bushDark: "#1a6b4f",
      bush: "#4fb77e",
      bushLight: "#9deab4",
      stone: "#48665d",
      stoneLight: "#78a090",
      flower: "#f48be5",
      actorDark: "#426a5c",
      actor: "#95c7b0",
    };
  }

  return {
    bg: "#17231f",
    grassA: dry ? "#476934" : wet ? "#38a443" : "#3f7d3c",
    grassB: dry ? "#58783d" : wet ? "#48b751" : "#4f8d43",
    grassC: dry ? "#35512b" : wet ? "#2e7f39" : "#336936",
    grassDark: dry ? "#264026" : wet ? "#166028" : "#28572c",
    grassLight: dry ? "#8faf5a" : wet ? "#91e66a" : "#7fc360",
    pathA: dry ? "#b57f34" : "#a57934",
    pathB: dry ? "#c48d3b" : "#b3843b",
    pathDark: "#805d2f",
    pathLight: "#d5a75b",
    shadow: "#111b15",
    treeTrunkDark: "#5a351f",
    treeTrunk: "#8a5a31",
    treeTrunkLight: "#b87a3a",
    leafDark: dry ? "#244021" : wet ? "#0f5a2d" : "#154526",
    leaf: dry ? "#507d38" : wet ? "#46a84a" : "#3f873d",
    leafLight: dry ? "#91b65d" : wet ? "#93df68" : "#7ec35c",
    leafUnder: dry ? "#1b3320" : wet ? "#0e3f22" : "#10351e",
    bushDark: dry ? "#2d5129" : "#17612f",
    bush: dry ? "#5e913d" : "#3da248",
    bushLight: dry ? "#9fc15d" : "#8fdb65",
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
