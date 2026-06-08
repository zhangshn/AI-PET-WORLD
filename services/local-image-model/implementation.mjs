// 当前文件作用：定义 AI-PET-WORLD 自研 local image model implementation 接入口；默认未接真实图像模型时不生成图片、不返回假图。

const IMPLEMENTATION_MODEL_NAME =
  "ai-pet-world-local-image-model-implementation"
const IMPLEMENTATION_VERSION = "implementation-missing-1"

export function readLocalImageModelImplementationHealth(input) {
  return {
    ok: false,
    status: "local_image_model_implementation_not_connected",
    model: IMPLEMENTATION_MODEL_NAME,
    version: IMPLEMENTATION_VERSION,
    implementationConnected: false,
    supportsWorldVisualPainter: true,
    supportsResponseContract: true,
    supportsHiddenCandidateOutput: true,
    supportsPng: true,
    supportsWebp: true,
    supportsJpg: true,
    requiredResponseShape: input.requiredResponseFields,
    message: "local image model implementation 尚未接入真实图像生成能力。",
    messageEn:
      "The local image model implementation has not connected a real image generation capability yet.",
    nextStep: {
      zh: "下一步接入真实图像生成实现，使 /generate 返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect a real image generation implementation so /generate returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "local_image_model_implementation",
      "implementation_not_connected",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runLocalImageModelImplementationDryRun(input) {
  return {
    ok: false,
    status: "local_image_model_implementation_not_connected",
    model: IMPLEMENTATION_MODEL_NAME,
    version: IMPLEMENTATION_VERSION,
    implementationConnected: false,
    ...input.requestAudit,
    requiredResponseShape: input.requiredResponseFields,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "契约服务理解正式视觉请求，但真实 local image model implementation 尚未接入，因此不能声明会返回 6 个图片字段。",
    messageEn:
      "The contract service understands the formal visual request, but no real local image model implementation is connected, so it cannot declare the six image fields.",
    nextStep: {
      zh: "接入真实 local image model 后，dry-run 必须返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting a real local image model, dry-run must return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "local_image_model_dry_run",
      "implementation_not_connected",
      "request_contract_checked",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function generateLocalImageCandidate(input) {
  return {
    ok: false,
    status: "local_image_model_implementation_not_connected",
    model: IMPLEMENTATION_MODEL_NAME,
    version: IMPLEMENTATION_VERSION,
    implementationConnected: false,
    ...input.requestAudit,
    requiredResponseShape: input.requiredResponseFields,
    message:
      "真实 local image model implementation 尚未接入。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "No real local image model implementation is connected. This service will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实图像生成模型，使 /generate 返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect a real image generation model so /generate returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "local_image_model_generate",
      "implementation_not_connected",
      "request_contract_checked",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}