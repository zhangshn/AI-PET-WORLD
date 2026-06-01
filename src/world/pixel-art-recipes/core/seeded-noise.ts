// 该文件用于提供程序化像素美术生成的可复现噪声工具。

export function noiseAt(seed: string, x: number, y: number, salt: number): number {
  return (hashString(`${seed}:${x}:${y}:${salt}`) % 10000) / 10000;
}

export function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function isLocalNoisePeak(seed: string, x: number, y: number, salt: number): boolean {
  const current = noiseAt(seed, x, y, salt);
  const neighbors = [
    noiseAt(seed, x - 1, y, salt),
    noiseAt(seed, x + 1, y, salt),
    noiseAt(seed, x, y - 1, salt),
    noiseAt(seed, x, y + 1, salt),
  ];

  return neighbors.filter((value) => value > current).length <= 1;
}
