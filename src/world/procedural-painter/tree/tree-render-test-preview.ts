// 该文件把程序化树木绘制命令转换为可测试的 SVG 预览。

import {
  buildDefaultPixelTreeFact,
  buildPixelTreeBiomeSamples,
  runPixelTreeRenderTest,
  type PixelTreeDrawCommand,
  type PixelTreeRenderTestResult,
  type PixelTreeWorldFact,
} from "./tree-render-test-module";

export type PixelTreeSvgPreviewOptions = {
  width?: number;
  height?: number;
  background?: "transparent" | "lab_grid" | "soft_ground";
  title?: string;
  showDebugLabel?: boolean;
};

export type PixelTreeSvgPreviewResult = {
  test: PixelTreeRenderTestResult;
  svg: string;
  summary: {
    commandCount: number;
    biome: PixelTreeWorldFact["biome"];
    growth: number;
    health: number;
    moisture: number;
    deterministicKey: string;
  };
};

export function buildPixelTreeSvgPreview(
  input: PixelTreeWorldFact = buildDefaultPixelTreeFact(),
  options: PixelTreeSvgPreviewOptions = {},
): PixelTreeSvgPreviewResult {
  const test = runPixelTreeRenderTest(input);
  const width = options.width ?? 320;
  const height = options.height ?? 320;
  const svg = composeSvgPreview(test, {
    width,
    height,
    background: options.background ?? "soft_ground",
    title: options.title ?? `${test.fact.biome} tree`,
    showDebugLabel: options.showDebugLabel ?? true,
  });

  return {
    test,
    svg,
    summary: {
      commandCount: test.commands.length,
      biome: test.fact.biome,
      growth: test.fact.growth,
      health: test.fact.health,
      moisture: test.fact.moisture,
      deterministicKey: `${test.fact.worldSeed}:${test.fact.id}`,
    },
  };
}

export function buildPixelTreeBiomeSvgGallery(): string {
  const samples = buildPixelTreeBiomeSamples();
  const cellWidth = 240;
  const cellHeight = 300;
  const width = cellWidth * samples.length;
  const height = cellHeight;
  const cells = samples
    .map((sample, index) => {
      const shiftedFact: PixelTreeWorldFact = {
        ...sample,
        x: 120,
        y: 238,
      };
      const preview = buildPixelTreeSvgPreview(shiftedFact, {
        width: cellWidth,
        height: cellHeight,
        background: "soft_ground",
        showDebugLabel: true,
      });

      return `<g transform="translate(${index * cellWidth}, 0)">${stripOuterSvg(preview.svg)}</g>`;
    })
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#17231f"/>`,
    cells,
    "</svg>",
  ].join("\n");
}

function composeSvgPreview(
  test: PixelTreeRenderTestResult,
  options: Required<PixelTreeSvgPreviewOptions> & { width: number; height: number },
): string {
  const background = buildBackgroundSvg(options.width, options.height, options.background);
  const baseBack = buildTreeBaseBackSvg(test);
  const commands = test.commands.map(commandToSvg).join("\n");
  const baseFront = buildTreeBaseFrontSvg(test);
  const debugLabel = options.showDebugLabel
    ? `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeSvgText(
        `${test.fact.biome} g${test.fact.growth} h${test.fact.health} m${test.fact.moisture}`,
      )}</text>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}" shape-rendering="crispEdges" role="img" aria-label="${escapeSvgText(
      options.title,
    )}">`,
    `<title>${escapeSvgText(options.title)}</title>`,
    background,
    baseBack,
    commands,
    baseFront,
    debugLabel,
    "</svg>",
  ].join("\n");
}

function buildBackgroundSvg(
  width: number,
  height: number,
  background: Required<PixelTreeSvgPreviewOptions>["background"],
): string {
  if (background === "transparent") {
    return "";
  }

  if (background === "lab_grid") {
    const gridLines: string[] = [`<rect x="0" y="0" width="${width}" height="${height}" fill="#14201c"/>`];

    for (let x = 0; x <= width; x += 16) {
      gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#24322d" stroke-width="1"/>`);
    }

    for (let y = 0; y <= height; y += 16) {
      gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#24322d" stroke-width="1"/>`);
    }

    return gridLines.join("\n");
  }

  return [
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#17231f"/>`,
    `<ellipse cx="${width / 2}" cy="${height - 54}" rx="${width * 0.34}" ry="26" fill="#263f2f" opacity="0.82"/>`,
  ].join("\n");
}

function buildTreeBaseBackSvg(test: PixelTreeRenderTestResult): string {
  const colors = resolveBaseColors(test.fact.biome);
  const baseX = test.structure.anchor.x + test.structure.trunk.lean;
  const baseY = test.structure.anchor.y;
  const baseWidth = Math.max(28, Math.round(test.decision.trunkWidth * 2.55));
  const marks = buildSeededBaseMarks(test, colors, "back");

  return [
    `<ellipse cx="${round(baseX)}" cy="${round(baseY + 5)}" rx="${round(baseWidth * 1.25)}" ry="13" fill="${colors.soil}" opacity="0.48"/>`,
    `<ellipse cx="${round(baseX + 2)}" cy="${round(baseY + 7)}" rx="${round(baseWidth * 0.7)}" ry="5" fill="${colors.dark}" opacity="0.46"/>`,
    `<line x1="${round(baseX - baseWidth * 0.4)}" y1="${round(baseY + 2)}" x2="${round(baseX - 5)}" y2="${round(baseY + 7)}" stroke="${colors.root}" stroke-width="3" stroke-linecap="square" opacity="0.68"/>`,
    `<line x1="${round(baseX + 5)}" y1="${round(baseY + 2)}" x2="${round(baseX + baseWidth * 0.42)}" y2="${round(baseY + 8)}" stroke="${colors.root}" stroke-width="3" stroke-linecap="square" opacity="0.68"/>`,
    marks,
  ].join("\n");
}

function buildTreeBaseFrontSvg(test: PixelTreeRenderTestResult): string {
  const colors = resolveBaseColors(test.fact.biome);
  const marks = buildSeededBaseMarks(test, colors, "front");
  return marks;
}

function buildSeededBaseMarks(
  test: PixelTreeRenderTestResult,
  colors: ReturnType<typeof resolveBaseColors>,
  stage: "back" | "front",
): string {
  const random = createSeededRandom(`${test.fact.worldSeed}:${test.fact.id}:base:${stage}`);
  const baseX = test.structure.anchor.x + test.structure.trunk.lean;
  const baseY = test.structure.anchor.y;
  const baseWidth = Math.max(28, Math.round(test.decision.trunkWidth * 2.55));
  const grassCount = stage === "front" ? 16 : 10;
  const debrisCount = stage === "front" ? 5 : 4;
  const parts: string[] = [];

  for (let index = 0; index < grassCount; index += 1) {
    const x = baseX + Math.round((random() - 0.5) * baseWidth * 2.1);
    const height = Math.round(4 + random() * (test.fact.biome === "desert" ? 5 : 10));
    const y = baseY + Math.round((random() - 0.12) * 16) - height;
    const color = random() > 0.62 ? colors.grassLight : colors.grass;
    parts.push(`<rect x="${round(x)}" y="${round(y)}" width="2" height="${height}" fill="${color}" opacity="0.9"/>`);
  }

  for (let index = 0; index < debrisCount; index += 1) {
    const size = random() > 0.68 ? 3 : 2;
    const x = baseX + Math.round((random() - 0.5) * baseWidth * 2.1);
    const y = baseY + Math.round(3 + random() * 18);
    parts.push(`<rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" fill="${colors.debris}" opacity="0.72"/>`);
  }

  return parts.join("\n");
}

function resolveBaseColors(biome: PixelTreeWorldFact["biome"]): {
  soil: string;
  dark: string;
  root: string;
  grass: string;
  grassLight: string;
  debris: string;
} {
  if (biome === "desert") {
    return { soil: "#6b5635", dark: "#2f2519", root: "#75512b", grass: "#8b8c4d", grassLight: "#b4aa63", debris: "#c2a567" };
  }

  if (biome === "oasis") {
    return { soil: "#2e6149", dark: "#163228", root: "#6e4a2d", grass: "#54ad77", grassLight: "#91d7a1", debris: "#7fc38d" };
  }

  if (biome === "forest") {
    return { soil: "#2b4c31", dark: "#142319", root: "#6b4527", grass: "#3f7d3c", grassLight: "#7ab85c", debris: "#a98145" };
  }

  return { soil: "#365d35", dark: "#1c2d1e", root: "#784d2a", grass: "#5a9b45", grassLight: "#9fd36a", debris: "#b08c45" };
}

function commandToSvg(command: PixelTreeDrawCommand): string {
  if (command.type === "pixelRect") {
    return `<rect x="${round(command.x)}" y="${round(command.y)}" width="${round(command.width)}" height="${round(
      command.height,
    )}" fill="${command.color}" opacity="${command.opacity}"/>`;
  }

  if (command.type === "pixelEllipse") {
    return `<ellipse cx="${round(command.x)}" cy="${round(command.y)}" rx="${round(command.radiusX)}" ry="${round(
      command.radiusY,
    )}" fill="${command.color}" opacity="${command.opacity}"/>`;
  }

  return `<line x1="${round(command.x1)}" y1="${round(command.y1)}" x2="${round(command.x2)}" y2="${round(
    command.y2,
  )}" stroke="${command.color}" stroke-width="${Math.max(1, round(command.width))}" stroke-linecap="square" opacity="${command.opacity}"/>`;
}

function stripOuterSvg(svg: string): string {
  return svg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")
    .trim();
}

function round(value: number): number {
  return Math.round(value);
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed);

  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
