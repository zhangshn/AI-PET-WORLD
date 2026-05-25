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
  const commands = test.commands.map(commandToSvg).join("\n");
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
    commands,
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
