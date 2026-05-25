// 该文件为树木 SVG 预览增加体积实验层。

import type { PixelTreeRenderTestResult, PixelTreeWorldFact } from "./tree-render-test-module";

export function addTreeVolumePreviewLayer(svg: string, test: PixelTreeRenderTestResult): string {
  const volumeSvg = buildVolumeSvg(test);
  return svg.replace("</svg>", `${volumeSvg}\n</svg>`);
}

function buildVolumeSvg(test: PixelTreeRenderTestResult): string {
  const palette = getVolumePalette(test.fact.biome);
  const baseX = Math.round(test.structure.anchor.x + test.structure.trunk.lean);
  const baseY = Math.round(test.structure.anchor.y);
  const crownY = Math.round(baseY - test.decision.trunkHeight - test.decision.crownHeight * 0.12);
  const crownWidth = Math.max(24, Math.round(test.decision.crownWidth));
  const crownHeight = Math.max(20, Math.round(test.decision.crownHeight));
  const trunkSideWidth = Math.max(2, Math.round(test.structure.trunk.width * 0.18));
  const trunkSideHeight = Math.max(8, Math.round(test.structure.trunk.height * 0.72));

  return [
    `<ellipse cx="${baseX + Math.round(crownWidth * 0.18)}" cy="${crownY + Math.round(crownHeight * 0.2)}" rx="${Math.round(crownWidth * 0.25)}" ry="${Math.round(crownHeight * 0.14)}" fill="${palette.frontShade}" opacity="0.28"/>`,
    `<ellipse cx="${baseX - Math.round(crownWidth * 0.22)}" cy="${crownY - Math.round(crownHeight * 0.16)}" rx="${Math.round(crownWidth * 0.18)}" ry="${Math.round(crownHeight * 0.12)}" fill="${palette.frontLight}" opacity="0.34"/>`,
    `<rect x="${Math.round(test.structure.trunk.x + test.structure.trunk.lean - 1)}" y="${Math.round(test.structure.trunk.y + test.structure.trunk.height * 0.12)}" width="${trunkSideWidth}" height="${trunkSideHeight}" fill="${palette.trunkSide}" opacity="0.26"/>`,
  ].join("\n");
}

function getVolumePalette(biome: PixelTreeWorldFact["biome"]): {
  frontShade: string;
  frontLight: string;
  trunkSide: string;
} {
  if (biome === "desert") {
    return { frontShade: "#70763e", frontLight: "#d1cf75", trunkSide: "#4a321b" };
  }

  if (biome === "oasis") {
    return { frontShade: "#247057", frontLight: "#a5e3b5", trunkSide: "#4e321f" };
  }

  if (biome === "forest") {
    return { frontShade: "#1d5a2f", frontLight: "#91d66a", trunkSide: "#3f2416" };
  }

  return { frontShade: "#34733a", frontLight: "#b5e37b", trunkSide: "#4c2f18" };
}
