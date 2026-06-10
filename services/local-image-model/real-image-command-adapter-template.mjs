// 当前文件作用：定义真实本地图像模型命令适配模板；只解析 stdin 与输出契约，不生成图片、不返回假图。

import { pathToFileURL } from "node:url"

export const REAL_IMAGE_COMMAND_ADAPTER_TEMPLATE_NAME =
  "ai-pet-world-real-image-command-adapter-template"

export const REAL_IMAGE_COMMAND_ADAPTER_TEMPLATE_VERSION =
  "adapter-template-noop-1"

const REQUIRED_PAYLOAD_FIELDS = [
  "requestId",
  "modelTask",
  "promptPackage",
  "outputStorage",
  "outputFileName",
  "manifest",
  "responseContract",
  "executionContract",
  "controlSketch",
  "visualFixHints",
  "worldFactMetadata",
  "constraints",
  "readiness",
  "canShowToPlayer",
]

if (isExecutedDirectly()) {
  main().catch((error) => {
    writeFailureAndExit({
      status: "real_image_command_adapter_template_unhandled_error",
      message: error instanceof Error ? error.message : String(error),
    })
  })
}

export async function readRealImageCommandAdapterTemplateStdin() {
  const chunks = []

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()

  if (!text) {
    return buildFailure({
      status: "real_image_command_adapter_template_stdin_empty",
      message: "真实模型适配模板 stdin 不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)

    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({
          status: "real_image_command_adapter_template_stdin_not_object",
          message: "真实模型适配模板 stdin 必须是 JSON 对象。",
        })
  } catch {
    return buildFailure({
      status: "real_image_command_adapter_template_stdin_json_invalid",
      message: "真实模型适配模板 stdin 不是合法 JSON。",
    })
  }
}

export function buildRealImageCommandAdapterTemplateContext(payload = {}) {
  if (!isRecord(payload)) {
    return buildFailure({
      status: "real_image_command_adapter_template_payload_invalid",
      message: "真实模型适配模板 payload 必须是对象。",
    })
  }

  const missingFields = REQUIRED_PAYLOAD_FIELDS.filter(
    (field) => !Object.hasOwn(payload, field)
  )

  if (missingFields.length > 0) {
    return buildFailure({
      status: "real_image_command_adapter_template_payload_field_missing",
      message: `真实模型适配模板 payload 缺少字段：${missingFields.join(", ")}。`,
      detail: { missingFields },
    })
  }

  if (payload.canShowToPlayer !== false) {
    return buildFailure({
      status: "real_image_command_adapter_template_visibility_invalid",
      message: "真实模型适配模板 payload 顶层必须保持 canShowToPlayer=false。",
    })
  }

  if (!isNonEmptyString(payload.outputFileName)) {
    return buildFailure({
      status: "real_image_command_adapter_template_output_file_name_missing",
      message: "真实模型适配模板缺少 outputFileName。",
    })
  }

  if (!isRecord(payload.outputStorage)) {
    return buildFailure({
      status: "real_image_command_adapter_template_output_storage_invalid",
      message: "真实模型适配模板缺少 outputStorage 对象。",
    })
  }

  if (!isRecord(payload.promptPackage)) {
    return buildFailure({
      status: "real_image_command_adapter_template_prompt_package_invalid",
      message: "真实模型适配模板缺少 promptPackage 对象。",
    })
  }

  if (!isRecord(payload.responseContract)) {
    return buildFailure({
      status: "real_image_command_adapter_template_response_contract_invalid",
      message: "真实模型适配模板缺少 responseContract 对象。",
    })
  }

  return {
    ok: true,
    status: "real_image_command_adapter_template_context_ready",
    adapter: REAL_IMAGE_COMMAND_ADAPTER_TEMPLATE_NAME,
    version: REAL_IMAGE_COMMAND_ADAPTER_TEMPLATE_VERSION,
    requestId: payload.requestId,
    outputFileName: payload.outputFileName,
    imageFormat: payload.outputStorage.imageFormat,
    publicBaseUrl: payload.outputStorage.publicBaseUrl,
    outputDirectoryConfigured: Boolean(
      process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR
    ),
    outputDirectoryHidden: true,
    modelTask: sanitizeObject(payload.modelTask),
    promptPackage: sanitizeObject(payload.promptPackage),
    controlSketch: sanitizeObject(payload.controlSketch),
    worldFactMetadata: sanitizeObject(payload.worldFactMetadata),
    visualFixHintCount: Array.isArray(payload.visualFixHints)
      ? payload.visualFixHints.length
      : 0,
    responseContract: sanitizeObject(payload.responseContract),
    constraints: sanitizeObject(payload.constraints),
    canShowToPlayer: false,
    tags: [
      "real_image_command_adapter_template",
      "context_ready",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function buildRealImageCommandAdapterTemplateNotImplemented(input = {}) {
  return buildFailure({
    status: "real_image_command_adapter_template_not_implemented",
    message:
      "这是 AI-PET-WORLD 真实模型命令适配模板，不是真实图像模型。请复制此模板并在你自己的脚本中调用真实模型生成 PNG/WebP/JPG。",
    detail: {
      requestId: input.context?.requestId ?? null,
      outputFileName: input.context?.outputFileName ?? null,
      imageFormat: input.context?.imageFormat ?? null,
      requiredStdout: {
        ok: true,
        status: "real_image_generated",
        imageFileName: input.context?.outputFileName ?? "<same-as-stdin-outputFileName>",
        imageFormat: input.context?.imageFormat ?? "png",
        width: 1536,
        height: 1024,
        license: "self_owned",
        originalityConfirmed: true,
      },
      implementationSteps: [
        "read stdin JSON",
        "run your real local image model",
        "write a real PNG/WebP/JPG file under AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR",
        "return stdout JSON with imageFileName exactly equal to stdin outputFileName",
      ],
    },
  })
}

async function main() {
  const stdinResult = await readRealImageCommandAdapterTemplateStdin()

  if (!stdinResult.ok) {
    writeFailureAndExit(stdinResult)
    return
  }

  const context = buildRealImageCommandAdapterTemplateContext(stdinResult.payload)

  if (!context.ok) {
    writeFailureAndExit(context)
    return
  }

  writeFailureAndExit(
    buildRealImageCommandAdapterTemplateNotImplemented({ context })
  )
}

function buildFailure(input) {
  return {
    ok: false,
    status: input.status,
    adapter: REAL_IMAGE_COMMAND_ADAPTER_TEMPLATE_NAME,
    version: REAL_IMAGE_COMMAND_ADAPTER_TEMPLATE_VERSION,
    message: input.message ?? null,
    detail: input.detail ?? null,
    canGenerateRealBitmap: false,
    canShowToPlayer: false,
    tags: [
      "real_image_command_adapter_template",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function writeFailureAndExit(payload) {
  process.stderr.write(JSON.stringify(payload, null, 2))
  process.exitCode = 1
}

function sanitizeObject(value) {
  return isRecord(value) ? value : {}
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isExecutedDirectly() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false
}
