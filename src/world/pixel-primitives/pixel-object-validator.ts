// 该文件用于校验像素对象 recipe 输出是否符合语义结构与基础边界。

import { PIXEL_OBJECT_SIZE_LIMITS } from "./pixel-style-foundation";
import { getPixelSemanticStructure } from "./semantic-structure-library";
import type { PixelObjectRecipeResult, PixelObjectValidation, PixelPartId } from "./pixel-primitive-schema";

export function validatePixelObjectRecipe(result: Omit<PixelObjectRecipeResult, "validation">): PixelObjectValidation {
  const messages: string[] = [];
  const semantic = getPixelSemanticStructure(result.kind);
  const sizeLimit = PIXEL_OBJECT_SIZE_LIMITS[result.kind];
  const usedParts = new Set<PixelPartId>(result.usedParts);

  semantic.requiredParts.forEach((partId) => {
    if (!usedParts.has(partId)) messages.push(`缺少必要部件：${partId}`);
  });

  semantic.forbiddenParts.forEach((forbiddenPart) => {
    if (result.usedParts.some((partId) => partId.includes(forbiddenPart))) {
      messages.push(`包含禁止部件：${forbiddenPart}`);
    }
  });

  if (result.anchor.type !== semantic.anchorType) {
    messages.push(`锚点类型不匹配：需要 ${semantic.anchorType}，实际 ${result.anchor.type}`);
  }

  if (result.bounds.width < sizeLimit.minWidth || result.bounds.width > sizeLimit.maxWidth) {
    messages.push(`宽度超出范围：${result.bounds.width}`);
  }

  if (result.bounds.height < sizeLimit.minHeight || result.bounds.height > sizeLimit.maxHeight) {
    messages.push(`高度超出范围：${result.bounds.height}`);
  }

  if (result.blocks.length === 0) messages.push("没有生成任何像素块");
  if (!result.recipeId) messages.push("缺少 recipeId");
  if (!result.recipeVersion) messages.push("缺少 recipeVersion");

  const invalidOpacityBlocks = result.blocks.filter((block) => block.opacity < 0 || block.opacity > 1);
  if (invalidOpacityBlocks.length > 0) messages.push("存在非法透明度像素块");

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["结构通过：anchor / bounds / parts / recipe 均符合 v1 规则。"] : messages,
  };
}
