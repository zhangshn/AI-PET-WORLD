// 该文件用于解析自然石头像素对象的颜色、透明度和图元类型。

import type { PixelLayerKind, PixelPrimitiveKind } from "../../../pixel-primitives/pixel-primitive-schema";
import { PIXEL_PALETTE } from "../../../pixel-primitives/pixel-style-foundation";
import { mixHex } from "../../core/color-utils";
import type { StoneTemplate, StoneTone } from "./stone-object-types";

export function resolveStonePrimitive(tone: StoneTone, width: number, height: number): PixelPrimitiveKind {
  if (tone === "highlight") return "highlight_block";

  if (tone === "outline" || tone === "dark" || tone === "ambientDark" || tone === "crack" || tone === "textureDark") {
    return "dark_block";
  }

  if (tone === "textureLight") return "noise_block";
  if (width <= 3 && height <= 3) return "dot_block";
  if (width > height) return "wide_block";

  return "square_block";
}

export function resolveStoneColor(tone: StoneTone, template: StoneTemplate): string {
  const ambientDark = mixHex(PIXEL_PALETTE.stoneDark, PIXEL_PALETTE.grassDark, template.environmentTintStrength);
  const ambientOutline = mixHex("#2f3733", PIXEL_PALETTE.grassDark, template.environmentTintStrength);
  const ambientCrack = mixHex("#39413c", PIXEL_PALETTE.grassDark, template.environmentTintStrength * 0.8);
  const textureLight = mixHex(PIXEL_PALETTE.stoneLight, PIXEL_PALETTE.stone, 0.28);
  const textureDark = mixHex(PIXEL_PALETTE.stoneDark, PIXEL_PALETTE.grassDark, 0.1);

  if (tone === "outline") return ambientOutline;
  if (tone === "shadow") return PIXEL_PALETTE.shadow;
  if (tone === "dark") return PIXEL_PALETTE.stoneDark;
  if (tone === "ambientDark") return ambientDark;
  if (tone === "main") return PIXEL_PALETTE.stone;
  if (tone === "light") return PIXEL_PALETTE.stoneLight;
  if (tone === "highlight") return PIXEL_PALETTE.highlight;
  if (tone === "textureLight") return textureLight;
  if (tone === "textureDark") return textureDark;

  return ambientCrack;
}

export function resolveStoneOpacity(tone: StoneTone): number {
  if (tone === "highlight") return 0.68;
  if (tone === "textureLight") return 0.72;
  if (tone === "textureDark") return 0.78;
  if (tone === "crack") return 0.86;

  return 1;
}

export function resolveStoneLayer(): PixelLayerKind {
  return "object";
}
