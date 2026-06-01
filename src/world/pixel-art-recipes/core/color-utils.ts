// 该文件用于提供程序化像素美术生成的颜色混合工具。

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mixHex(baseHex: string, tintHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const tint = hexToRgb(tintHex);

  const r = Math.round(base.r * (1 - amount) + tint.r * amount);
  const g = Math.round(base.g * (1 - amount) + tint.g * amount);
  const bValue = Math.round(base.b * (1 - amount) + tint.b * amount);

  return rgbToHex(r, g, bValue);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, bValue: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(bValue)}`;
}

export function toHex(value: number): string {
  return clamp(value, 0, 255).toString(16).padStart(2, "0");
}
