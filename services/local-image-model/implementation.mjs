// 当前文件作用：定义 AI-PET-WORLD 自研 local image model implementation 接入口；默认未接真实图像模型时不生成图片、不返回假图。

import {
  buildImplementationNotConnectedDryRun,
  buildImplementationNotConnectedGenerate,
  buildImplementationNotConnectedHealth,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}

export function readLocalImageModelImplementationHealth(input = {}) {
  return buildImplementationNotConnectedHealth({
    requiredResponseFields: readRequiredResponseFields(input),
  })
}

export async function runLocalImageModelImplementationDryRun(input = {}) {
  return buildImplementationNotConnectedDryRun({
    requestAudit: input.requestAudit,
    requiredResponseFields: readRequiredResponseFields(input),
  })
}

export async function generateLocalImageCandidate(input = {}) {
  return buildImplementationNotConnectedGenerate({
    requestAudit: input.requestAudit,
    requiredResponseFields: readRequiredResponseFields(input),
  })
}