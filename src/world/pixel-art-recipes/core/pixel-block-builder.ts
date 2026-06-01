// 该文件用于提供程序化像素美术生成的 PixelBlock 构造器。

import type { PixelBlock } from "../../pixel-primitives/pixel-primitive-schema";

type PixelBlockInput = Omit<PixelBlock, "id">;

export function createPixelBlockBuilder(prefix: string): { block: (input: PixelBlockInput) => PixelBlock } {
  let counter = 0;

  return {
    block(input: PixelBlockInput): PixelBlock {
      counter += 1;
      return { id: `${prefix}_${counter}`, ...input };
    },
  };
}
